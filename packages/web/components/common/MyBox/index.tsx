import React, { forwardRef } from 'react';
import { Box, type BoxProps, type SpinnerProps } from '@chakra-ui/react';
import Loading, { type LoadingVariant } from '../MyLoading';

type Props = BoxProps & {
  isLoading?: boolean;
  text?: string;
  size?: SpinnerProps['size'];
  loadingVariant?: LoadingVariant;
};

/**
 * 支持 Loading 的 Box，当处于 Loading 状态时，子级内容正常渲染，但是会额外渲染一个 Loading，用于覆盖当前 Box 的子区域
 */
const MyBox = ({ text, isLoading, children, size, loadingVariant, ...props }: Props, ref: any) => {
  return (
    <Box ref={ref} position={isLoading ? 'relative' : 'unset'} {...props}>
      {children}
      {isLoading && <Loading fixed={false} text={text} size={size} variant={loadingVariant} />}
    </Box>
  );
};

export default React.memo(forwardRef(MyBox));
