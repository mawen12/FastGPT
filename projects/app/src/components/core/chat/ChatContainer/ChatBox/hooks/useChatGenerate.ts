import { type MutableRefObject } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useTranslation } from 'next-i18next';
import { useMemoizedFn } from 'ahooks';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import type {
  AIChatItemValueItemType,
  UserChatItemValueItemType
} from '@fastgpt/global/core/chat/type';
import {
  ChatGenerateStatusEnum,
  ChatRoleEnum,
  ChatStatusEnum
} from '@fastgpt/global/core/chat/constants';
import { chats2GPTMessages } from '@fastgpt/global/core/chat/adapt';
import {
  mergeChatResponseData,
  getChatTitleFromChatMessage
} from '@fastgpt/global/core/chat/utils';
import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
import { ChatRecordContext } from '@/web/core/chat/context/chatRecordContext';
import { WorkflowRuntimeContext } from '../../context/workflowRuntimeContext';
import { ChatBoxContext } from '../Provider';
import { formatChatValue2InputType, stripChatValueFileUrls } from '../utils/chatValue';
import {
  getInteractiveByHistories,
  refreshSubmittedFormInteractiveValues,
  rewriteHistoriesByInteractiveResponse
} from '../utils/interactive';
import { shouldAppendResumeInteractive } from '../utils/resume';
import { formatChatRequestVariables } from '../utils/requestVariables';
import type { ChatSiteItemType, ChatBoxInputType, SendPromptFnType } from '../type';
import type { StartChatFnProps, generatingMessageProps } from '../../type';
import { cloneDeep } from 'lodash';

type HumanChatSiteItemType = Extract<ChatSiteItemType, { obj: ChatRoleEnum.Human }>;

type SyncSidebarChatGenerateStatus = (
  status: ChatGenerateStatusEnum,
  options?: {
    hasBeenRead?: boolean;
    targetAppId?: string;
    targetChatId?: string;
    title?: string;
  }
) => void;

type FinishChatGenerateStatus = (params: {
  status: ChatGenerateStatusEnum;
  finishedInActiveChat: boolean;
  targetAppId?: string;
  targetChatId?: string;
  shouldUpdateChatBoxData?: (state: { appId?: string; chatId?: string }) => boolean;
}) => void;

type UseChatGenerateProps = {
  onStartChat?: (e: StartChatFnProps) => Promise<{ responseText: string; isNewChat?: boolean }>;
  isRoundPending: boolean;
  chatControllerRef: MutableRefObject<AbortController>;
  questionGuideControllerRef: MutableRefObject<AbortController>;
  pluginControllerRef: MutableRefObject<AbortController>;
  resumeControllerRef: MutableRefObject<AbortController | undefined>;
  resumedChatTargetRef: MutableRefObject<string | undefined>;
  activeChatIdRef: MutableRefObject<string | undefined>;
  TextareaDom: MutableRefObject<HTMLTextAreaElement | null>;
  resetInputVal: (value: ChatBoxInputType) => void;
  setQuestionGuide: (guides: string[]) => void;
  createQuestionGuide: () => Promise<void>;
  scrollToBottom: (behavior?: 'smooth' | 'auto', delay?: number) => void;
  generatingScroll: (force?: boolean) => void;
  syncSidebarChatGenerateStatus: SyncSidebarChatGenerateStatus;
  finishChatGenerateStatus: FinishChatGenerateStatus;
};

const isAbortByLeave = (reason: unknown) => {
  return reason === 'leave' || (reason instanceof Error && reason.message === 'leave');
};

/**
 * 管理 ChatBox 的普通发送和 SSE 增量生成流程。
 *
 * 这个 hook 承接原 `ChatBox/index.tsx` 中最核心的运行时逻辑：
 * - `generatingMessage`：按 SSE event 增量更新最后一条 AI 消息。
 * - `sendPrompt`：校验输入、创建 human/AI placeholder、调用 `onStartChat`、处理完成和失败。
 * - `abortRequest`：统一中断 chat、question guide、plugin 和 resume 请求。
 *
 * 输入约定：
 * - refs 仍由 ChatBox 持有，保证停止按钮、页面切换、恢复生成共用同一组 controller。
 * - `resetInputVal`、`createQuestionGuide`、`scrollToBottom`、`generatingScroll` 都来自前面 PR
 *   已抽出的基础 hook，`useChatGenerate` 只编排它们，不重新实现输入或滚动细节。
 * - `syncSidebarChatGenerateStatus` 负责侧边栏历史状态，本 hook 只在普通发送开始/完成/失败时调用它。
 *
 * 边界行为：
 * - `generatingMessage` 仍只更新最后一条 AI 消息；如果最后一条不是 AI，则直接跳过。
 * - interactive 输入会改写上一轮交互结果，不创建新的普通会话轮次。
 * - 发送失败且后端没有返回 `responseText` 时恢复用户输入，并回滚本轮 human/AI placeholder。
 * - `abortRequest('leave')` 触发的异常不 toast，也不额外标记错误状态，保持页面切换语义。
 */
export const useChatGenerate = ({
  onStartChat,
  isRoundPending,
  chatControllerRef,
  questionGuideControllerRef,
  pluginControllerRef,
  resumeControllerRef,
  resumedChatTargetRef,
  activeChatIdRef,
  TextareaDom,
  resetInputVal,
  setQuestionGuide,
  createQuestionGuide,
  scrollToBottom,
  generatingScroll,
  syncSidebarChatGenerateStatus,
  finishChatGenerateStatus
}: UseChatGenerateProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isPc } = useSystem();
  const { setNotSufficientModalType } = useSystemStore();

  const setChatBoxData = useContextSelector(ChatItemContext, (v) => v.setChatBoxData);
  const variablesForm = useContextSelector(ChatItemContext, (v) => v.variablesForm);
  const resetVariables = useContextSelector(ChatItemContext, (v) => v.resetVariables);
  const chatRecords = useContextSelector(ChatRecordContext, (v) => v.chatRecords);
  const setChatRecords = useContextSelector(ChatRecordContext, (v) => v.setChatRecords);
  const appId = useContextSelector(WorkflowRuntimeContext, (v) => v.appId);
  const chatId = useContextSelector(WorkflowRuntimeContext, (v) => v.chatId);
  const variableList = useContextSelector(ChatBoxContext, (v) => v.variableList);
  const startSegmentedAudio = useContextSelector(ChatBoxContext, (v) => v.startSegmentedAudio);
  const finishSegmentedAudio = useContextSelector(ChatBoxContext, (v) => v.finishSegmentedAudio);
  const setAudioPlayingChatId = useContextSelector(ChatBoxContext, (v) => v.setAudioPlayingChatId);
  const splitText2Audio = useContextSelector(ChatBoxContext, (v) => v.splitText2Audio);

  const generatingMessage = useMemoizedFn(
    ({
      responseValueId,
      event,
      text = '',
      reasoningText,
      status,
      name,
      tool,
      interactive,
      plan,
      planStatus,
      sandboxStatus,
      skill,
      variables,
      nodeResponse,
      durationSeconds,
      autoTTSResponse
    }: generatingMessageProps & { autoTTSResponse?: boolean }) => {
      setChatRecords((state) => {
        const histories = nodeResponse?.formInputResult
          ? refreshSubmittedFormInteractiveValues({
              histories: state,
              nodeResponse
            })
          : state;

        return histories.map((item, index) => {
          if (index !== histories.length - 1) return item;
          if (item.obj !== ChatRoleEnum.AI) return item;

          if (autoTTSResponse) {
            splitText2Audio(formatChatValue2InputType(item.value).text || '');
          }

          const updateIndex = (() => {
            if (!responseValueId) return item.value.length - 1;
            const index = item.value.findIndex((item) => item.id === responseValueId);
            if (index !== -1) return index;
            return item.value.length - 1;
          })();
          const updateValue: AIChatItemValueItemType = cloneDeep(item.value[updateIndex]);

          if (event === SseResponseEventEnum.flowNodeResponse && nodeResponse) {
            return {
              ...item,
              responseData: item.responseData
                ? [...item.responseData, nodeResponse]
                : [nodeResponse]
            };
          }
          if (event === SseResponseEventEnum.flowNodeStatus && status) {
            return {
              ...item,
              status,
              moduleName: name
            };
          }
          if (event === SseResponseEventEnum.sandboxStatus && sandboxStatus) {
            const getSandboxPhaseLabel = (): string => {
              const { phase, isWarmStart, skillName } = sandboxStatus;
              if (phase === 'deployingSkills') {
                return t('chat:sandbox_status_deployingSkills', { skillName: skillName ?? '' });
              }
              if (
                phase === 'downloadingPackage' ||
                phase === 'uploadingPackage' ||
                phase === 'extractingPackage'
              ) {
                return t(`chat:sandbox_status_${phase}` as any, { skillName: skillName ?? '' });
              }
              if (phase === 'ready') {
                return t(
                  isWarmStart ? 'chat:sandbox_status_ready_warm' : 'chat:sandbox_status_ready_cold'
                );
              }
              return t(`chat:sandbox_status_${phase}` as any);
            };
            return {
              ...item,
              status: 'loading' as const,
              moduleName: getSandboxPhaseLabel()
            };
          }
          if (event === SseResponseEventEnum.skillCall && skill) {
            const alreadyExists = item.value.some(
              (v) =>
                v.id === responseValueId &&
                v.skills?.some((s) => s.skillMdPath === skill.skillMdPath)
            );
            if (alreadyExists) return item;

            const skillId = skill.id || responseValueId || getNanoid(10);
            const val: AIChatItemValueItemType = {
              id: responseValueId,
              skills: [
                {
                  id: skillId,
                  skillName: skill.skillName,
                  skillAvatar: skill.skillAvatar || '',
                  description: skill.description,
                  skillMdPath: skill.skillMdPath
                }
              ]
            };
            return {
              ...item,
              value: [...item.value, val]
            };
          }
          if (event === SseResponseEventEnum.answer || event === SseResponseEventEnum.fastAnswer) {
            const answerUpdateIndex = (() => {
              if (responseValueId) {
                return item.value.findIndex((item) => item.id === responseValueId);
              }

              const latestIndex = item.value.length - 1;
              const latestValue = item.value[latestIndex];

              // reason 流只能续写“纯 reasoning”占位；否则说明上一段回答已成型，需要新起一段。
              if (
                reasoningText &&
                latestValue?.reasoning &&
                !latestValue.text?.content &&
                !latestValue.tools?.length &&
                !latestValue.tool &&
                !latestValue.skills?.length &&
                !latestValue.interactive &&
                !latestValue.plan &&
                !latestValue.planStatus &&
                !latestValue.agentPlanUpdate &&
                !latestValue.agentAsk &&
                !latestValue.agentStopGate &&
                !latestValue.contextCheckpoint
              ) {
                return latestIndex;
              }

              if (text) return latestIndex;

              return -1;
            })();
            const answerUpdateValue: AIChatItemValueItemType | undefined =
              answerUpdateIndex >= 0 ? cloneDeep(item.value[answerUpdateIndex]) : undefined;
            const replaceUpdateValue = (nextValue: AIChatItemValueItemType) => ({
              ...item,
              value: [
                ...item.value.slice(0, answerUpdateIndex),
                nextValue,
                ...item.value.slice(answerUpdateIndex + 1)
              ]
            });

            if (reasoningText) {
              if (answerUpdateValue?.reasoning) {
                answerUpdateValue.reasoning.content += reasoningText;
                return replaceUpdateValue(answerUpdateValue);
              } else if (answerUpdateValue?.text && !answerUpdateValue.text.content) {
                answerUpdateValue.reasoning = {
                  content: reasoningText
                };
                return replaceUpdateValue(answerUpdateValue);
              } else {
                const val: AIChatItemValueItemType = {
                  id: responseValueId,
                  reasoning: {
                    content: reasoningText
                  }
                };
                return {
                  ...item,
                  value: [...item.value, val]
                };
              }
            }
            if (text) {
              if (answerUpdateValue?.text) {
                answerUpdateValue.text.content += text;
                return replaceUpdateValue(answerUpdateValue);
              } else if (answerUpdateValue?.reasoning) {
                answerUpdateValue.text = {
                  content: text
                };
                return replaceUpdateValue(answerUpdateValue);
              } else {
                const newValue: AIChatItemValueItemType = {
                  id: responseValueId,
                  text: {
                    content: text
                  }
                };
                return {
                  ...item,
                  value: item.value.concat(newValue)
                };
              }
            }
          }

          if (event === SseResponseEventEnum.toolCall && tool) {
            const val: AIChatItemValueItemType = {
              id: responseValueId || tool.id,
              tools: [tool]
            };
            return {
              ...item,
              value: [...item.value, val]
            };
          }
          if (event === SseResponseEventEnum.toolParams && tool && updateValue.tools) {
            if (tool.params) {
              updateValue.tools = updateValue.tools.map((item) =>
                item.id === tool.id
                  ? { ...item, params: `${item.params || ''}${tool.params}` }
                  : item
              );
              return {
                ...item,
                value: [
                  ...item.value.slice(0, updateIndex),
                  updateValue,
                  ...item.value.slice(updateIndex + 1)
                ]
              };
            }
            return item;
          }
          if (event === SseResponseEventEnum.toolResponse && tool && updateValue.tools) {
            if (tool.response) {
              updateValue.tools = updateValue.tools.map((item) =>
                item.id === tool.id
                  ? { ...item, response: `${item.response || ''}${tool.response}` }
                  : item
              );

              return {
                ...item,
                value: [
                  ...item.value.slice(0, updateIndex),
                  updateValue,
                  ...item.value.slice(updateIndex + 1)
                ]
              };
            }
            return item;
          }

          if (event === SseResponseEventEnum.planStatus && planStatus) {
            const planStatusIndex = item.value.findIndex(
              (value) => !!value.planStatus || (!!responseValueId && value.id === responseValueId)
            );
            const nextPlanStatusValue: AIChatItemValueItemType = {
              id: responseValueId,
              planStatus
            };

            if (planStatusIndex >= 0) {
              return {
                ...item,
                value: [
                  ...item.value.slice(0, planStatusIndex),
                  {
                    ...item.value[planStatusIndex],
                    ...nextPlanStatusValue
                  },
                  ...item.value.slice(planStatusIndex + 1)
                ]
              };
            }

            return {
              ...item,
              value: [...item.value, nextPlanStatusValue]
            };
          }
          if (event === SseResponseEventEnum.plan && plan) {
            const planIndex = item.value.findIndex(
              (value) =>
                (!!responseValueId && value.id === responseValueId) ||
                !!value.planStatus ||
                (value.plan?.planId && value.plan.planId === plan.planId)
            );
            const nextPlanValue = {
              id: responseValueId || plan.planId,
              plan,
              planStatus: undefined
            };

            if (planIndex >= 0) {
              return {
                ...item,
                value: [
                  ...item.value.slice(0, planIndex),
                  {
                    ...item.value[planIndex],
                    ...nextPlanValue
                  },
                  ...item.value.slice(planIndex + 1)
                ]
              };
            }

            return {
              ...item,
              value: [...item.value, nextPlanValue]
            };
          }
          if (event === SseResponseEventEnum.updateVariables && variables) {
            resetVariables({ variables });
          }
          if (event === SseResponseEventEnum.interactive && interactive) {
            if (
              !shouldAppendResumeInteractive({
                existingValues: item.value,
                incomingInteractive: interactive
              })
            ) {
              return item;
            }

            const val: AIChatItemValueItemType = {
              interactive
            };

            return {
              ...item,
              value: item.value.concat(val)
            };
          }

          if (event === SseResponseEventEnum.workflowDuration && durationSeconds) {
            return {
              ...item,
              durationSeconds: item.durationSeconds
                ? +(item.durationSeconds + durationSeconds).toFixed(2)
                : durationSeconds
            };
          }

          return item;
        });
      });

      const forceScroll = event === SseResponseEventEnum.interactive;
      generatingScroll(forceScroll);
    }
  );

  const abortRequest = useMemoizedFn((reason: string = 'stop') => {
    chatControllerRef.current?.abort(new Error(reason));
    questionGuideControllerRef.current?.abort(new Error(reason));
    pluginControllerRef.current?.abort(new Error(reason));
    resumeControllerRef.current?.abort(new Error(reason));
  });

  // 发送消息
  const sendPrompt = useMemoizedFn<SendPromptFnType>(
    ({
      // 文本内容
      text = '',
      // 文件列表
      files = [],
      // 历史记录
      history = chatRecords,
      interactive,
      autoTTSResponse = false,
      hideInUI = false
    }) => {
      // 执行表单提交
      variablesForm.handleSubmit(
        async ({ variables = {} }) => {
          // 校验聊天状态
          if (!onStartChat) return;
          // 当前聊天尚未结束，不允许再次发送消息
          if (isRoundPending) {
            if (!hideInUI) {
              toast({
                title: t('chat:is_chatting'),
                status: 'warning'
              });
            }
            return;
          }

          questionGuideControllerRef.current?.abort(new Error('stop'));

          // 对用户输入的内容去除首尾空格
          text = text.trim();

          // 当没有文本或者文件长度时，无法发起聊天
          if (!text && files.length === 0) {
            toast({
              title: t('chat:content_empty'),
              status: 'warning'
            });
            return;
          }

          // 合法化请求参数，过滤非法的参数
          const requestVariables = formatChatRequestVariables({ variableList, variables });

          // 生成 human 聊天ID
          const humanChatId = getNanoid(24);
          // 生成该对话的响应聊天ID
          const responseChatId = getNanoid(24);

          if (autoTTSResponse) {
            await startSegmentedAudio();
            setAudioPlayingChatId(responseChatId);
          }

          // 构造 human 聊天，即用户输入的聊天
          const currentHumanChat: HumanChatSiteItemType = {
            id: humanChatId,
            dataId: humanChatId,
            obj: ChatRoleEnum.Human,
            time: new Date(),
            hideInUI,
            value: [
              // 聊天输入的文件
              ...files.map((file) => ({
                file: {
                  // 文件类型
                  type: file.type,
                  // 文件名称
                  name: file.name,
                  // 文件上传后的 url
                  url: file.url,
                  key: file.key || ''
                }
              })),
              // 人类聊天输入的文本
              ...(text
                ? [
                    {
                      text: {
                        content: text
                      }
                    }
                  ]
                : [])
            ] as UserChatItemValueItemType[],
            // 此处为人类聊天内容结束
            status: ChatStatusEnum.finish
          };

          // 构造最新的聊天记录，加入 human 的对话，和 ai 待返回的对话
          const newChatList: ChatSiteItemType[] = [
            // 加入历史记录
            ...history,
            // 加入当前人类输入的内容
            currentHumanChat,
            // 构造 AI 的待响应内容
            {
              id: responseChatId,
              dataId: responseChatId,
              obj: ChatRoleEnum.AI,
              value: [
                {
                  // ai 待返回的内容
                  text: {
                    content: ''
                  }
                }
              ],
              // 处于 loading 状态
              status: ChatStatusEnum.loading
            }
          ];

          // 从消息中提取作为 chat title 的文本
          const temporaryHistoryTitle = getChatTitleFromChatMessage(currentHumanChat);

          resumedChatTargetRef.current = `${appId}:${chatId}`;

          // 设置聊天的数据
          setChatBoxData((state) =>
            // 检查是否位于当前聊天
            state.appId === appId && state.chatId === chatId
              ? {
                  ...state,
                  // 设置 chat 的 title
                  title: temporaryHistoryTitle,
                  // 该 chat 为生成中的状态
                  chatGenerateStatus: ChatGenerateStatusEnum.generating,
                  // 设置为尚未读取
                  hasBeenRead: false
                }
              : // 非当前聊天，无需修改 state
                state
          );

          // 同步到左侧聊天框的 status + title + hasBeenRead
          syncSidebarChatGenerateStatus(ChatGenerateStatusEnum.generating, {
            hasBeenRead: false,
            title: temporaryHistoryTitle
          });

          // 回写聊天记录
          setChatRecords(
            interactive
              ? rewriteHistoriesByInteractiveResponse({
                  histories: newChatList,
                  interactive,
                  interactiveVal: text
                })
              : newChatList
          );

          // 重置输入框的值
          resetInputVal({});
          setQuestionGuide([]);
          // 滚动到底部
          scrollToBottom('smooth', 100);

          // 构造停止fetch请求
          const abortSignal = new AbortController();

          try {
            chatControllerRef.current = abortSignal;

            // 构造可用于 ai 请求的对话
            const messages = chats2GPTMessages({
              messages: newChatList.slice(0, -1).map((item) => {
                if (item.obj === ChatRoleEnum.Human) {
                  return {
                    ...item,
                    value: stripChatValueFileUrls(item.value)
                  };
                }
                return item;
              }),
              reserveId: true,
              reserveTool: true
            });

            // 发送 ai 请求
            const { responseText } = await onStartChat({
              messages,
              responseChatItemId: responseChatId,
              controller: abortSignal,
              generatingMessage: (e) => generatingMessage({ ...e, autoTTSResponse }),
              variables: requestVariables
            });

            let newChatHistories: ChatSiteItemType[] = [];

            //
            setChatRecords((state) => {
              newChatHistories = state.map((item, index) => {
                if (index !== state.length - 1) return item;

                const responseData = mergeChatResponseData(item.responseData || []);
                if (!abortSignal?.signal?.aborted) {
                  const uncaughtErr = responseData.find((r) => r.error)?.error;
                  const err = uncaughtErr ?? responseData[responseData.length - 1]?.errorText;
                  if (err) {
                    toast({
                      title: t(getErrText(err)),
                      status: 'warning'
                    });
                  }
                }

                return {
                  ...item,
                  status: ChatStatusEnum.finish,
                  time: new Date(),
                  responseData
                };
              });

              const { interactive: lastInteractive } = getInteractiveByHistories(state);
              if (lastInteractive?.type === 'paymentPause' && !lastInteractive.params.continue) {
                setNotSufficientModalType(TeamErrEnum.aiPointsNotEnough);
              }

              return newChatHistories;
            });

            setTimeout(() => {
              if (!getInteractiveByHistories(newChatHistories).interactive) {
                createQuestionGuide();
              }

              generatingScroll(true);
              if (isPc) {
                TextareaDom.current?.focus();
              }
            }, 100);

            if (autoTTSResponse) {
              splitText2Audio(responseText, true);
            }
            const finishedInActiveChat = activeChatIdRef.current === chatId;
            finishChatGenerateStatus({
              status: ChatGenerateStatusEnum.done,
              finishedInActiveChat,
              shouldUpdateChatBoxData: (state) => state.appId === appId && state.chatId === chatId
            });
          } catch (err: any) {
            // 处理异常
            if (isAbortByLeave(err)) {
              return;
            }

            toast({
              title: t(getErrText(err, t('common:core.chat.error.Chat error') as any)),
              status: 'error',
              duration: 5000,
              isClosable: true
            });

            setChatRecords((state) =>
              state.map((item, index) => {
                if (index !== state.length - 1) return item;
                return {
                  ...item,
                  time: new Date(),
                  status: ChatStatusEnum.finish
                };
              })
            );

            if (!err?.responseText) {
              resetInputVal({ text, files });
              setChatRecords(newChatList.slice(0, newChatList.length - 2));
            }

            const finishedInActiveChat = activeChatIdRef.current === chatId;
            finishChatGenerateStatus({
              status: ChatGenerateStatusEnum.error,
              finishedInActiveChat,
              shouldUpdateChatBoxData: (state) => state.appId === appId && state.chatId === chatId
            });
          }

          if (autoTTSResponse) {
            finishSegmentedAudio();
          }
        },
        () => {}
      )();
    }
  );

  return {
    abortRequest,
    generatingMessage,
    sendPrompt
  };
};
