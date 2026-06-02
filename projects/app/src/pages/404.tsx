'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { serviceSideProps } from '@/web/common/i18n/utils';

// /404 页面,自动跳转到 /dashboard/agent
const NonePage = () => {
  const router = useRouter();
  useEffect(() => {
    router.push('/dashboard/agent');
  }, [router]);

  return <div></div>;
};

export default NonePage;
