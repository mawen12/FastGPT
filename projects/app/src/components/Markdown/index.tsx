import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import RemarkMath from 'remark-math'; // Math syntax
import RemarkBreaks from 'remark-breaks'; // Line break
import RehypeKatex from 'rehype-katex'; // Math render
import RemarkGfm from 'remark-gfm'; // Special markdown syntax
import RehypeExternalLinks from 'rehype-external-links';

import styles from './index.module.scss';
import dynamic from 'next/dynamic';

import { Box } from '@chakra-ui/react';
import { CodeClassNameEnum, mdTextFormat } from './utils';
import { useCreation } from 'ahooks';
import type { AProps } from './A';
import MarkdownTable from '@fastgpt/web/components/common/Markdown/MarkdownTable';

const CodeLight = dynamic(() => import('./codeBlock/CodeLight'), { ssr: false });
const MermaidCodeBlock = dynamic(() => import('./img/MermaidCodeBlock'), { ssr: false });
const MdImage = dynamic(() => import('./img/Image'), { ssr: false });
const EChartsCodeBlock = dynamic(() => import('./img/EChartsCodeBlock'), { ssr: false });
const IframeCodeBlock = dynamic(() => import('./codeBlock/Iframe'), { ssr: false });
const IframeHtmlCodeBlock = dynamic(() => import('./codeBlock/iframe-html'), { ssr: false });
const VideoBlock = dynamic(() => import('./codeBlock/Video'), { ssr: false });
const AudioBlock = dynamic(() => import('./codeBlock/Audio'), { ssr: false });

const ChatGuide = dynamic(() => import('./chat/Guide'), { ssr: false });
const QuestionGuide = dynamic(() => import('./chat/QuestionGuide'), { ssr: false });
const A = dynamic(() => import('./A'), { ssr: false });

type Props = {
  source?: string;
  showAnimation?: boolean;
  isDisabled?: boolean;
  forbidZhFormat?: boolean;
} & AProps;
const Markdown = (props: Props) => {
  const source = props.source || '';

  // 当长度小于 20w 时，采用 Markdown 渲染
  if (source.length < 200000) {
    return <MarkdownRender {...props} />;
  }

  // 否则采用普通直接渲染
  return <Box whiteSpace={'pre-wrap'}>{source}</Box>;
};
const MarkdownRender = ({
  source = '',
  showAnimation,
  isDisabled,
  forbidZhFormat,

  chatAuthData,
  onOpenCiteModal
}: Props) => {
  // 自定义渲染组件映射，此处自定义了 img/pre/code/table/a
  const components = useCreation(() => {
    return {
      img: (props: any) => <Image {...props} alt={props.alt} chatAuthData={chatAuthData} />,
      pre: RewritePre,
      code: Code,
      table: MarkdownTable as any,
      a: (props: any) => (
        <A
          {...props}
          showAnimation={showAnimation}
          chatAuthData={chatAuthData}
          onOpenCiteModal={onOpenCiteModal}
        />
      )
    };
  }, [chatAuthData, onOpenCiteModal, showAnimation]);

  // 对输入文本进行预处理，如果 showAnimation 或 showAnimation 为真时，直接使用原文，否则进行中文文本格式优化
  const formatSource = useMemo(() => {
    if (showAnimation || forbidZhFormat) return source;
    return mdTextFormat(source);
  }, [forbidZhFormat, showAnimation, source]);

  const urlTransform = useCallback((val: string) => {
    return val;
  }, []);

  return (
    <Box position={'relative'}>
      <ReactMarkdown
        className={`markdown ${styles.markdown}
      ${showAnimation ? `${formatSource ? styles.waitingAnimation : styles.animation}` : ''}
    `}
        remarkPlugins={[RemarkMath, [RemarkGfm, { singleTilde: false }], RemarkBreaks]}
        rehypePlugins={[RehypeKatex, [RehypeExternalLinks, { target: '_blank' }]]}
        components={components}
        urlTransform={urlTransform}
      >
        {formatSource}
      </ReactMarkdown>
      {isDisabled && <Box position={'absolute'} top={0} right={0} left={0} bottom={0} />}
    </Box>
  );
};

export default React.memo(Markdown);

/* Custom dom */
function Code(e: any) {
  const { className, codeBlock, children } = e;
  const match = /language-(\w+)/.exec(className || '');
  const codeType = match?.[1]?.toLowerCase();

  const strChildren = String(children);

  const Component = useMemo(() => {
    if (codeType === CodeClassNameEnum.mermaid) {
      return <MermaidCodeBlock code={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.guide) {
      return <ChatGuide text={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.questionguide) {
      return <QuestionGuide text={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.echarts) {
      return <EChartsCodeBlock code={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.iframe) {
      return <IframeCodeBlock code={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.html || codeType === CodeClassNameEnum.svg) {
      return (
        <IframeHtmlCodeBlock className={className} codeBlock={codeBlock} match={match}>
          {children}
        </IframeHtmlCodeBlock>
      );
    }
    if (codeType === CodeClassNameEnum.video) {
      return <VideoBlock code={strChildren} />;
    }
    if (codeType === CodeClassNameEnum.audio) {
      return <AudioBlock code={strChildren} />;
    }

    return (
      <CodeLight className={className} codeBlock={codeBlock} match={match}>
        {children}
      </CodeLight>
    );
  }, [codeType, className, codeBlock, match, children, strChildren]);

  return Component;
}

function Image({ src, chatAuthData }: { src?: string; chatAuthData?: AProps['chatAuthData'] }) {
  return <MdImage src={src} chatAuthData={chatAuthData} />;
}

function RewritePre({ children }: any) {
  const modifiedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { codeBlock: true });
    }
    return child;
  });

  return <>{modifiedChildren}</>;
}
