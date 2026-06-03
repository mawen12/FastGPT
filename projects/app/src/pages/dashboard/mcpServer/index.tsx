'use client';
import { serviceSideProps } from '@/web/common/i18n/utils';
import React, { useState } from 'react';
import DashboardContainer from '@/pageComponents/dashboard/Container';
import {
  Box,
  Button,
  Flex,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { deleteMcpServer, getMcpServerList } from '@/web/support/mcp/api';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EditMcpModal, {
  defaultForm,
  type EditMcForm
} from '@/pageComponents/dashboard/mcp/EditModal';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import MyIconButton from '@fastgpt/web/components/common/Icon/button';
import dynamic from 'next/dynamic';
import { type McpKeyType } from '@fastgpt/global/support/mcp/type';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { useUserStore } from '@/web/support/user/useUserStore';
import PopoverConfirm from '@fastgpt/web/components/common/MyPopover/PopoverConfirm';

const UsageWay = dynamic(() => import('@/pageComponents/dashboard/mcp/usageWay'), {
  ssr: false
});

// MCP Services 页面
const McpServer = () => {
  const { t } = useTranslation();
  const { isPc } = useSystem();
  const { userInfo } = useUserStore();

  const {
    data: mcpServerList = [],
    loading: loadingList,
    refresh: loadMcpList
  } = useRequest(getMcpServerList, {
    manual: false
  });

  const [editMcp, setEditMcp] = useState<EditMcForm>();
  const [usageWay, setUsageWay] = useState<McpKeyType>();

  const { runAsync: onDeleteMcpServer } = useRequest(deleteMcpServer, {
    manual: true,
    onSuccess: () => {
      loadMcpList();
    }
  });

  const isLoading = loadingList;

  return (
    <>
      <DashboardContainer>
        {({ MenuIcon }) => (
          <MyBox isLoading={isLoading} h={'100%'} p={6}>
            {isPc ? (
              // 顶部
              <Flex alignItems={'flex-end'} justifyContent={'space-between'}>
                <Box>
                  {/* MCP Services 名称 */}
                  <Box fontSize={'lg'} color={'myGray.900'} fontWeight={500}>
                    {t('dashboard_mcp:mcp_server')}
                  </Box>
                  {/* MCP Services 描述 */}
                  <Box fontSize={'xs'} color={'myGray.500'}>
                    {t('dashboard_mcp:mcp_server_description')}
                  </Box>
                </Box>
                {/* Create a new service 按钮 */}
                <Button
                  isDisabled={!userInfo?.permission.hasApikeyCreatePer}
                  onClick={() => setEditMcp(defaultForm)}
                >
                  {t('dashboard_mcp:create_mcp_server')}
                </Button>
              </Flex>
            ) : (
              <>
                <HStack>
                  <Box>{MenuIcon}</Box>
                  <Box fontSize={'lg'} color={'myGray.900'} fontWeight={500}>
                    {t('dashboard_mcp:mcp_server')}
                  </Box>
                </HStack>
                <Box fontSize={'xs'} color={'myGray.500'}>
                  {t('dashboard_mcp:mcp_server_description')}
                </Box>
                <Flex mt={2} justifyContent={'flex-end'}>
                  <Button
                    isDisabled={!userInfo?.permission.hasApikeyCreatePer}
                    onClick={() => setEditMcp(defaultForm)}
                  >
                    {t('dashboard_mcp:create_mcp_server')}
                  </Button>
                </Flex>
              </>
            )}

            {/* table */}
            <TableContainer mt={4} bg={'white'} borderRadius={'md'}>
              <Table>
                <Thead>
                  {/* 表头 */}
                  <Tr borderBottom={'base'}>
                    <Th bg={'white'}>{t('dashboard_mcp:mcp_name')}</Th>
                    <Th bg={'white'}>{t('dashboard_mcp:mcp_apps')}</Th>
                    <Th bg={'white'}></Th>
                  </Tr>
                </Thead>
                <Tbody fontSize={'sm'}>
                  {/* 表记录 */}
                  {mcpServerList.map((mcp) => {
                    return (
                      <Tr key={mcp._id} fontWeight={500} fontSize={'sm'} color={'myGray.900'}>
                        {/* MCP 名称 */}
                        <Td>{mcp.name}</Td>
                        {/* MCP 关联应用长度 */}
                        <Td>{mcp.apps.length}</Td>
                        <Td>
                          {/* 横向排列 */}
                          <HStack>
                            {/* Get started 按钮 */}
                            <Button
                              mr={4}
                              variant={'whiteBase'}
                              size={'sm'}
                              onClick={() => setUsageWay(mcp)}
                            >
                              {t('dashboard_mcp:start_use')}
                            </Button>

                            {/* Edit 按钮 */}
                            <MyIconButton
                              icon="edit"
                              onClick={() =>
                                setEditMcp({
                                  id: mcp._id,
                                  name: mcp.name,
                                  apps: mcp.apps
                                })
                              }
                            />

                            {/* Delete 按钮 */}
                            <PopoverConfirm
                              Trigger={
                                <Box>
                                  <MyIconButton
                                    icon="delete"
                                    hoverBg="red.50"
                                    hoverColor={'red.600'}
                                  />
                                </Box>
                              }
                              type="delete"
                              content={t('dashboard_mcp:delete_mcp_server_confirm_tip')}
                              onConfirm={() => onDeleteMcpServer(mcp._id)}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
              {/* 没有数据时,展示空 */}
              {mcpServerList.length === 0 && <EmptyTip />}
            </TableContainer>
          </MyBox>
        )}
      </DashboardContainer>

      {!!usageWay && <UsageWay mcp={usageWay} onClose={() => setUsageWay(undefined)} />}
      {/* Edit 按钮触发的 Modal */}
      {!!editMcp && (
        <EditMcpModal
          editMcp={editMcp}
          onClose={() => setEditMcp(undefined)}
          onSuccess={() => {
            setEditMcp(undefined);
            loadMcpList();
          }}
        />
      )}
    </>
  );
};

export default McpServer;

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['dashboard_mcp']))
    }
  };
}
