import { NextAPI } from '@/service/middleware/entry';
import type { ParentIdType } from '@fastgpt/global/common/parentFolder/type';
import { parseParentIdInMongo } from '@fastgpt/global/common/parentFolder/utils';
import { AppTypeEnum } from '@fastgpt/global/core/app/constants';
import { AppFolderTypeList, ToolTypeList, AppTypeList } from '@fastgpt/global/core/app/constants';
import type { AppSchemaType } from '@fastgpt/global/core/app/type';
import {
  CreateAppBodySchema,
  CreateAppResponseSchema,
  type CreateAppBodyType
} from '@fastgpt/global/openapi/core/app/common/api';
import {
  OwnerRoleVal,
  PerResourceTypeEnum,
  WritePermissionVal
} from '@fastgpt/global/support/permission/constant';
import { TeamAppCreatePermissionVal } from '@fastgpt/global/support/permission/user/constant';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { type ClientSession } from '@fastgpt/service/common/mongo';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { MongoApp } from '@fastgpt/service/core/app/schema';
import { MongoAppVersion } from '@fastgpt/service/core/app/version/schema';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import { checkTeamAppTypeLimit } from '@fastgpt/service/support/permission/teamLimit';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { getI18nAppType } from '@fastgpt/service/support/user/audit/util';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { getMyModels } from '@fastgpt/service/support/permission/model/controller';
import { removeUnauthModels } from '@fastgpt/global/core/workflow/utils';
import { getS3AvatarSource } from '@fastgpt/service/common/s3/sources/avatar';
import { isS3ObjectKey } from '@fastgpt/service/common/s3/utils';
import { MongoAppTemplate } from '@fastgpt/service/core/app/templates/templateSchema';
import { updateParentFoldersUpdateTime } from '@fastgpt/service/core/app/controller';
import { copyAvatarImage } from '@fastgpt/service/common/file/image/controller';
import { extractAppResourceRefsFromNodes } from '@fastgpt/service/core/app/resourceRefs';

import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';

async function handler(req: ApiRequestProps<CreateAppBodyType>) {
  const { body } = parseApiInput({
    req,
    bodySchema: CreateAppBodySchema
  });
  const { parentId, name, avatar, intro, type, modules, edges, chatConfig, templateId, utmParams } =
    body;

  // 凭证校验
  const { teamId, tmbId, userId, isRoot } = parentId
    ? await authApp({ req, appId: parentId, per: WritePermissionVal, authToken: true })
    : await authUserPer({ req, authToken: true, per: TeamAppCreatePermissionVal });

  // 上限校验
  await checkTeamAppTypeLimit({
    teamId,
    appCheckType: type === AppTypeEnum.workflowTool ? 'tool' : 'app'
  });

  const tmb = await MongoTeamMember.findById({ _id: tmbId }, 'userId')
    .populate<{
      user: { username: string };
    }>('user', 'username')
    .lean();

  // 创建app
  const appId = await onCreateApp({
    parentId,
    name,
    avatar,
    intro,
    type,
    modules: await (async () => {
      if (modules) {
        const myModels = new Set(
          await getMyModels({
            teamId,
            tmbId,
            isTeamOwner: isRoot || tmb?.role === 'owner'
          })
        );

        return removeUnauthModels({
          modules,
          allowedModels: myModels
        });
      }
      return [];
    })(),
    edges,
    chatConfig,
    teamId,
    tmbId,
    userAvatar: tmb?.avatar,
    username: tmb?.user?.username,
    templateId
  });

  pushTrack.createApp({
    type,
    uid: userId,
    teamId,
    tmbId,
    appId,
    ...utmParams
  });

  return CreateAppResponseSchema.parse(appId);
}

export default NextAPI(handler);

// 创建 app
export const onCreateApp = async ({
  parentId,
  name,
  intro,
  avatar,
  type,
  modules,
  edges,
  chatConfig,
  teamId,
  tmbId,
  pluginData,
  username,
  userAvatar,
  templateId,
  session
}: {
  parentId?: ParentIdType;
  name?: string;
  avatar?: string;
  type: AppTypeEnum;
  modules?: AppSchemaType['modules'];
  edges?: AppSchemaType['edges'];
  chatConfig?: AppSchemaType['chatConfig'];
  intro?: string;
  teamId: string;
  tmbId: string;
  pluginData?: AppSchemaType['pluginData'];
  username?: string;
  userAvatar?: string;
  templateId?: string;
  session?: ClientSession;
}) => {
  // 如果有父级，则读取父级的 app
  if (parentId) {
    const parentApp = await MongoApp.findById(parentId, 'type').lean();

    // 父级类型合法性校验
    // 工具类应用只能创建在 tool folder 下
    if (ToolTypeList.includes(type) && parentApp?.type !== AppTypeEnum.toolFolder) {
      return Promise.reject('tool type can only be created in tool folder');
    }
    // agent 类应用只能创建在 folder 下
    if (AppTypeList.includes(type) && parentApp?.type !== AppTypeEnum.folder) {
      return Promise.reject('agent type can only be created in agent folder');
    }
  }

  // 定义事务内创建函数
  const create = async (session: ClientSession) => {
    // 计算 resourceRefs，从工作流节点提取外部资源引用
    const resourceRefs = extractAppResourceRefsFromNodes(modules);

    // 头像处理
    const _avatar = await (async () => {
      // 没传 templateId，直接用请求离得 avatar
      if (!templateId) return avatar;

      // 传了 templateId，读取模板头像
      const template = await MongoAppTemplate.findOne({ templateId }, 'avatar').lean();
      if (!template?.avatar) return avatar;

      const s3AvatarSource = getS3AvatarSource();
      // 若模板头像不是 S3 对象键，直接复用 URL
      if (!isS3ObjectKey(template.avatar?.slice(s3AvatarSource.prefix.length), 'avatar')) {
        return template.avatar;
      }

      // 复制一份到当前团队临时资源，避免直接引用模板资源
      return await copyAvatarImage({
        teamId,
        imageUrl: template.avatar,
        temporary: true,
        session
      });
    })();

    // 创建 app 主记录
    const [app] = await MongoApp.create(
      [
        {
          ...parseParentIdInMongo(parentId),
          avatar: _avatar,
          name,
          intro,
          teamId,
          tmbId,
          modules,
          edges,
          chatConfig,
          type,
          version: 'v2',
          pluginData,
          templateId,
          // 只有非 folder 类型才能携带 resourceRefs
          ...(!AppFolderTypeList.includes(type!) && { resourceRefs })
        }
      ],
      { session, ordered: true }
    );

    const appId = String(app._id);

    // 只有非 folder 类型才能具有版本快照
    if (!AppFolderTypeList.includes(type!)) {
      // 创建发布版本快照
      await MongoAppVersion.create(
        [
          {
            tmbId,
            appId,
            nodes: modules,
            edges,
            chatConfig,
            versionName: name,
            username,
            avatar: userAvatar,
            // 初始可发布版本
            isPublish: true,
            resourceRefs
          }
        ],
        { session, ordered: true }
      );
    }

    // 建立资源权限
    await MongoResourcePermission.insertOne({
      teamId,
      tmbId,
      resourceId: appId,
      // 保证新应用立刻可管控
      permission: OwnerRoleVal,
      resourceType: PerResourceTypeEnum.app
    });

    // 刷新头像
    await getS3AvatarSource().refreshAvatar(_avatar, undefined, session);

    // 触发父目录更新时间
    updateParentFoldersUpdateTime({
      parentId
    });

    // 异步审计日志
    (async () => {
      addAuditLog({
        tmbId,
        teamId,
        event: AuditEventEnum.CREATE_APP,
        params: {
          appName: name!,
          appType: getI18nAppType(type!)
        }
      });
    })();

    return appId;
  };

  // 如果调用方传了 session，则复用外部事务
  if (session) {
    return create(session);
  } else {
    // 否则自建事务执行
    return await mongoSessionRun(create);
  }
};
