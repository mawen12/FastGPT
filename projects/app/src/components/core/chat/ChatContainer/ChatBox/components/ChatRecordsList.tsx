import React, { type ChangeEvent, type MutableRefObject } from 'react';
import { Box, Checkbox } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import type { ChatStatusEnum } from '@fastgpt/global/core/chat/constants';
import { ChatRoleEnum } from '@fastgpt/global/core/chat/constants';
import ChatBoxDivider from '../../../Divider';
import DeletedItemsCollapse from '../../DeletedItemsCollapse';
import { formatChatValue2InputType } from '../utils/chatValue';
import type { ChatSiteItemType } from '../type';
import ChatItem from './ChatItem';
import TimeBox from './TimeBox';

export type ChatRecordsListProps = {
  records: ChatSiteItemType[];
  expandedDeletedGroups: Set<string>;
  itemRefs: MutableRefObject<Map<string, HTMLElement | null>>;
  userAvatar?: string;
  appAvatar?: string;
  showVoiceIcon: boolean;
  showMarkIcon: boolean;
  statusBoxData:
    | {
        status: `${ChatStatusEnum}`;
        name: string;
      }
    | undefined;
  questionGuides: string[];
  onToggleDeletedGroup: (dataIds: string[]) => void;
  onRetry: (dataId?: string) => (() => Promise<void>) | undefined;
  onDelete: (dataId: string) => () => void;
  onMark: (chat: ChatSiteItemType, q?: string) => (() => void) | undefined;
  onAddUserLike: (chat: ChatSiteItemType) => (() => void) | undefined;
  onAddUserDislike: (chat: ChatSiteItemType) => (() => void) | undefined;
  onCloseCustomFeedback: (
    chat: ChatSiteItemType,
    index: number
  ) => (e: ChangeEvent<HTMLInputElement>) => void;
  onToggleFeedbackReadStatus: (chat: ChatSiteItemType) => (() => Promise<void>) | undefined;
};

const shouldShowTimeDivider = ({
  records,
  item,
  index
}: {
  records: ChatSiteItemType[];
  item: ChatSiteItemType;
  index: number;
}) => {
  if (index === 0 || !item.time || records[index - 1].time === undefined) return false;

  return (
    new Date(item.time).getTime() - new Date(records[index - 1].time!).getTime() > 10 * 60 * 1000
  );
};

/**
 * 渲染 ChatBox 的聊天记录列表。
 *
 * 本组件只接收已经预处理好的 `records`，不负责 log 模式 deleted group 的计算，也不直接
 * 调用删除、重试、反馈、标注 API。所有动作都由上层 hook 生成后作为 props 注入，组件内部
 * 只负责把 human/AI 记录、折叠按钮、时间分隔、自定义反馈和 admin mark 展示拼成原来的 JSX。
 *
 * 设计边界：
 * - `expandedDeletedGroups` 只用于判断 deleted record 是否渲染，展开/收起状态更新仍在父组件。
 * - `itemRefs` 继续由父级 context 持有，本组件只在每条可见记录渲染时登记 DOM 节点。
 * - AI 的 q 默认值仍取上一条 processed record 的文本，保持 admin mark 默认问题内容不变。
 */
const ChatRecordsList = ({
  records,
  expandedDeletedGroups,
  itemRefs,
  userAvatar,
  appAvatar,
  showVoiceIcon,
  showMarkIcon,
  statusBoxData,
  questionGuides,
  onToggleDeletedGroup,
  onRetry,
  onDelete,
  onMark,
  onAddUserLike,
  onAddUserDislike,
  onCloseCustomFeedback,
  onToggleFeedbackReadStatus
}: ChatRecordsListProps) => {
  const { t } = useTranslation();

  return (
    <Box id={'history'}>
      {/* 迭代展示聊天记录 */}
      {records.map((item, index) => {
        const shouldRender = !item.deleteTime || expandedDeletedGroups.has(item.dataId);

        return (
          <Box key={item.dataId}>
            {item.collapseTop && (
              <DeletedItemsCollapse
                count={item.collapseTop.count}
                isExpanded={item.collapseTop.isExpanded}
                onToggle={() => onToggleDeletedGroup(item.collapseTop!.dataIds)}
                position="top"
              />
            )}

            {shouldRender && (
              <Box
                ref={(e) => {
                  itemRefs.current.set(item.dataId, e);
                }}
              >
                {/* 时间线划分，对于跨度较长的记录，展示时间线 */}
                {shouldShowTimeDivider({ records, item, index }) && <TimeBox time={item.time!} />}

                <Box py={item.hideInUI ? 0 : 6}>
                  {/* Human 发送的内容 */}
                  {item.obj === ChatRoleEnum.Human && !item.hideInUI && (
                    <ChatItem
                      // 使用用户自己的头像
                      avatar={userAvatar}
                      // 聊天内容
                      chat={item}
                      // 重试操作
                      onRetry={onRetry(item.dataId)}
                      // 删除操作
                      onDelete={onDelete(item.dataId)}
                      // 是否为最后一条记录
                      isLastChild={index === records.length - 1}
                    />
                  )}
                  {/* AI 返回的内容 */}
                  {item.obj === ChatRoleEnum.AI && (
                    <ChatItem
                      // ai 采用当前应用的头像
                      avatar={appAvatar}
                      // 聊天记录
                      chat={item}
                      // 是否为最后一条记录
                      isLastChild={index === records.length - 1}
                      {...{
                        // 是否展示语音图标
                        showVoiceIcon,
                        // 状态数据
                        statusBoxData,
                        // 问题指南
                        questionGuides,
                        // 标记操作
                        onMark: onMark(
                          item,
                          formatChatValue2InputType(records[index - 1]?.value)?.text
                        ),
                        // Like 操作
                        onAddUserLike: onAddUserLike(item),
                        // Dislike 操作
                        onAddUserDislike: onAddUserDislike(item),
                        onToggleFeedbackReadStatus: onToggleFeedbackReadStatus(item)
                      }}
                    >
                      {item.customFeedbacks && item.customFeedbacks.length > 0 && (
                        <Box>
                          <ChatBoxDivider
                            icon={'core/app/customFeedback'}
                            text={t('common:core.app.feedback.Custom feedback')}
                          />
                          {item.customFeedbacks.map((text, i) => (
                            <Box key={i}>
                              <MyTooltip
                                label={t('common:core.app.feedback.close custom feedback')}
                              >
                                <Checkbox
                                  onChange={onCloseCustomFeedback(item, i)}
                                  icon={<MyIcon name={'common/check'} w={'12px'} />}
                                >
                                  {text}
                                </Checkbox>
                              </MyTooltip>
                            </Box>
                          ))}
                        </Box>
                      )}
                      {showMarkIcon && item.adminFeedback && (
                        <Box fontSize={'sm'}>
                          <ChatBoxDivider
                            icon="core/app/markLight"
                            text={t('common:core.chat.Admin Mark Content')}
                          />
                          <Box whiteSpace={'pre-wrap'}>
                            <Box color={'black'}>{item.adminFeedback.q}</Box>
                            <Box color={'myGray.600'}>{item.adminFeedback.a}</Box>
                          </Box>
                        </Box>
                      )}
                    </ChatItem>
                  )}
                </Box>
              </Box>
            )}

            {item.collapseBottom && item.collapseBottom.isExpanded && (
              <DeletedItemsCollapse
                count={item.collapseBottom.count}
                isExpanded={item.collapseBottom.isExpanded}
                onToggle={() => onToggleDeletedGroup(item.collapseBottom!.dataIds)}
                position="bottom"
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default React.memo(ChatRecordsList);
