import { useToast } from './useToast';
import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useTranslation } from 'next-i18next';
import { useRequest as ahooksUseRequest } from 'ahooks';

interface Props extends UseMutationOptions<any, any, any, any> {
  successToast?: string | null;
  errorToast?: string | null;
}

type UseRequestFunProps<TData, TParams extends any[]> = Parameters<
  typeof ahooksUseRequest<TData, TParams>
>;

/**
 * 基于 ahooks.useRequest 封装了的请求 hook
 */
export const useRequest = <TData, TParams extends any[]>(
  server: UseRequestFunProps<TData, TParams>[0],
  options: UseRequestFunProps<TData, TParams>[1] & {
    errorToast?: string;
    successToast?: string;
  } = {},
  plugin?: UseRequestFunProps<TData, TParams>[2]
) => {
  const { t } = useTranslation();
  const { errorToast = 'Error', successToast, ...rest } = options || {};
  const { toast } = useToast();

  const res = ahooksUseRequest<TData, TParams>(
    // 请求地址
    server,
    {
      manual: true,
      ...rest,
      // 请求失败处理场景
      onError: (err, params) => {
        rest?.onError?.(err, params); // 触发 onError 回调
        if (errorToast !== '') {
          // 提取错误文本
          const errText = t(getErrText(err, errorToast || '') as any);
          // 展示文本
          if (errText) {
            toast({
              title: errText,
              status: 'error'
            });
          }
        }
      },
      // 请求成功处理场景
      onSuccess: (res, params) => {
        rest?.onSuccess?.(res, params); // 触发 onSuccess 回调
        // 弹出请求成功的处理场景
        if (successToast) {
          toast({
            title: successToast,
            status: 'success'
          });
        }
      }
    },
    plugin
  );

  return res;
};
