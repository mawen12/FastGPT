import Markdown from '@/components/Markdown';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  HStack
} from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useTranslation } from 'next-i18next';
import React from 'react';
import { accordionButtonStyle } from './constants';

const RenderReasoningContent = React.memo(function RenderReasoningContent({
  content,
  isChatting,
  isLastResponseValue,
  isDisabled
}: {
  content: string;
  isChatting: boolean;
  isLastResponseValue: boolean;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation();

  // 展示动画：聊天中且是最新的响应
  const showAnimation = isChatting && isLastResponseValue;

  return (
    // 使用抽屉组件展示思考信息
    <Accordion allowToggle defaultIndex={isLastResponseValue ? 0 : undefined}>
      {/* 底部和顶部无边框 */}
      <AccordionItem borderTop={'none'} borderBottom={'none'}>
        <AccordionButton {...accordionButtonStyle} py={1}>
          <HStack mr={2} spacing={1}>
            {/* 展示思考的图标 */}
            <MyIcon name={'core/chat/think'} w={'0.85rem'} />
            {/* 思考的固定文本：Think process */}
            <Box fontSize={'sm'}>{t('chat:ai_reasoning')}</Box>
          </HStack>

          {/* 仅在最新的一个AI响应还在处理中时，会展示 Loading 状态 */}
          {showAnimation && <MyIcon name={'common/loading'} w={'0.85rem'} />}
          {/* 展开与折叠的图标 */}
          <AccordionIcon color={'myGray.600'} ml={5} />
        </AccordionButton>
        <AccordionPanel
          py={0}
          pr={0}
          // 距离左侧 3rem
          pl={3}
          // 距离底部 2rem
          mt={2}
          // 仅左侧有边框，代表这块区域
          borderLeft={'2px solid'}
          borderColor={'myGray.300'}
          color={'myGray.500'}
        >
          {/* 使用 Markdown 展示内容 */}
          <Markdown source={content} showAnimation={showAnimation} isDisabled={isDisabled} />
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
});

export default RenderReasoningContent;
