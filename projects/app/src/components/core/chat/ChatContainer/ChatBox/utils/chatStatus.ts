import { ChatGenerateStatusEnum, ChatRoleEnum } from '@fastgpt/global/core/chat/constants';
import type { ChatSiteItemType } from '../type';

type ChatRoundStatusItem = Pick<ChatSiteItemType, 'obj' | 'status'>;

/**
 * 判断当前这一轮对话是否还在进行中（pending）
 *
 * - isChatting: 全局聊天开关：如果为 true，直接认为 pending
 * - chatGenerateStatus: 生成状态开关：如果是 generating，也认为 pending
 *      其状态值有 generating、done、error
 * - lastChat: 最后一条消息兜底：如果最后一条是AI且状态不是 finish，也认为 pending，
 *      其状态值有 loading、running、finish
 */
export const isChatRoundPending = ({
  isChatting,
  chatGenerateStatus,
  lastChat
}: {
  isChatting: boolean;
  chatGenerateStatus?: ChatGenerateStatusEnum;
  lastChat?: ChatRoundStatusItem;
}) => {
  if (isChatting) return true;
  if (chatGenerateStatus === ChatGenerateStatusEnum.generating) return true;
  return !!lastChat && lastChat.obj === ChatRoleEnum.AI && lastChat.status !== 'finish';
};
