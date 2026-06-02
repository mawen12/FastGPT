import { serviceSideProps } from '@/web/common/i18n/utils';
import React, { useEffect } from 'react';
import Loading from '@fastgpt/web/components/common/MyLoading';
import { useRouter } from 'next/router';

// /,默认展示 /dashboard/agent
const index = () => {
  const router = useRouter();
  useEffect(() => {
    router.push('/dashboard/agent');
  }, [router]);
  return <Loading></Loading>;
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content))
    }
  };
}
export default index;
