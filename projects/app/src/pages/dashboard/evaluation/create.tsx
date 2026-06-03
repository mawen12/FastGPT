import MyBox from '@fastgpt/web/components/common/MyBox';
import DashboardContainer from '../../../pageComponents/dashboard/Container';
import { useTranslation } from 'next-i18next';
import { Box, Button, Flex, Input, VStack } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AIModelSelector from '@/components/Select/AIModelSelector';
import { useForm } from 'react-hook-form';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import FormLabel from '@fastgpt/web/components/common/MyBox/FormLabel';
import AppSelect from '@/components/Select/AppSelect';
import MyIcon from '@fastgpt/web/components/common/Icon';
import FileSelector, { type SelectFileItemType } from '@/components/Select/FileSelectorBox';
import { Trans } from 'next-i18next';
import MyIconButton from '@fastgpt/web/components/common/Icon/button';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { getAppDetailById } from '@/web/core/app/api';
import { useToast } from '@fastgpt/web/hooks/useToast';
import QuestionTip from '@fastgpt/web/components/common/MyTooltip/QuestionTip';
import { fileDownload } from '@/web/common/file/utils';
import { postCreateEvaluation } from '@/web/core/app/api/evaluation';
import { useMemo, useState } from 'react';
import Markdown from '@/components/Markdown';
import { getEvaluationFileHeader } from '@fastgpt/global/core/app/evaluation/utils';
import { evaluationFileErrors } from '@fastgpt/global/core/app/evaluation/constants';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { getErrText } from '@fastgpt/global/common/error/utils';

type EvaluationFormType = {
  name: string;
  evalModel: string;
  appId: string;
  evaluationFiles: SelectFileItemType[];
};

// 点击 Create a task 按钮后的页面
const EvaluationCreating = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string>();

  const { llmModelList } = useSystemStore();

  const { register, setValue, watch, handleSubmit } = useForm<EvaluationFormType>({
    defaultValues: {
      name: '',
      evalModel: llmModelList[0]?.model,
      appId: '',
      evaluationFiles: [] as SelectFileItemType[]
    }
  });

  const name = watch('name');
  const evalModel = watch('evalModel');
  const appId = watch('appId');
  const evaluationFiles = watch('evaluationFiles');

  const { runAsync: getAppDetail, loading: isLoadingAppDetail } = useRequest(() => {
    if (appId) return getAppDetailById(appId);
    return Promise.resolve(null);
  });

  const handleDownloadTemplate = async () => {
    const appDetail = await getAppDetail();
    const variables = appDetail?.chatConfig.variables;
    const templateContent = getEvaluationFileHeader(variables);

    fileDownload({
      text: templateContent,
      type: 'text/csv;charset=utf-8',
      filename: `${appDetail?.name}_evaluation.csv`
    });
  };

  const { runAsync: createEvaluation, loading: isCreating } = useRequest(
    async (data: EvaluationFormType) => {
      await postCreateEvaluation({
        file: data.evaluationFiles[0].file,
        name: data.name,
        evalModel: data.evalModel,
        appId: data.appId,
        percentListen: setPercent
      });
    },
    {
      onSuccess: () => {
        toast({
          title: t('dashboard_evaluation:evaluation_created'),
          status: 'success'
        });

        router.push('/dashboard/evaluation');
      },
      errorToast: '',
      onError: (error) => {
        if (error.message === evaluationFileErrors) {
          setError(error.message);
        } else if (error.message === TeamErrEnum.aiPointsNotEnough) {
          useSystemStore.getState().setNotSufficientModalType(error.message);
        } else {
          toast({
            title: t(getErrText(error)),
            status: 'error'
          });
        }
      }
    }
  );

  const onSubmit = async (data: EvaluationFormType) => {
    if (!data.appId) {
      return toast({
        title: t('dashboard_evaluation:app_required'),
        status: 'warning'
      });
    }
    if (!data.evaluationFiles || data.evaluationFiles.length === 0) {
      return toast({
        title: t('dashboard_evaluation:file_required'),
        status: 'warning'
      });
    }

    await createEvaluation(data);
  };

  return (
    <DashboardContainer>
      {() => (
        <MyBox h={'100%'} px={6} py={4} bg={'white'} overflow={'auto'}>
          {/* back 按钮 */}
          <Button
            // 点击回退到上一级 /dashboard/evaluation
            onClick={() => {
              router.push('/dashboard/evaluation');
            }}
            variant={'whitePrimary'}
            leftIcon={<MyIcon name={'common/backFill'} w={4} />}
          >
            {t('dashboard_evaluation:back')}
          </Button>

          {/* 竖向排列 */}
          <VStack py={8} gap={4}>
            {/* Task name 行 */}
            <Flex gap={20}>
              {/* Task name label */}
              <FormLabel
                w={'80px'}
                h={10}
                display={'flex'}
                alignItems={'center'}
                color={'myGray.900'}
                fontSize={'14px'}
                fontWeight={'medium'}
              >
                {t('dashboard_evaluation:Task_name')}
              </FormLabel>
              {/* Task name 输入框 */}
              <Input
                w={'406px'}
                h={10}
                bg={'myGray.50'}
                placeholder={t('dashboard_evaluation:Task_name_placeholder')}
                autoFocus
                {...register('name', {
                  required: true
                })}
              />
            </Flex>

            {/* Evaluation model 行 */}
            <Flex gap={20}>
              {/* Evaluation model label */}
              <FormLabel
                w={'80px'}
                h={10}
                display={'flex'}
                alignItems={'center'}
                color={'myGray.900'}
                fontSize={'14px'}
                fontWeight={'medium'}
              >
                {t('dashboard_evaluation:Evaluation_model')}
              </FormLabel>
              {/* Evaluation model 选择器 */}
              <AIModelSelector
                w={'406px'}
                bg={'myGray.50'}
                value={evalModel}
                list={llmModelList.map((item) => ({
                  label: item.name,
                  value: item.model
                }))}
                onChange={(e) => {
                  setValue('evalModel', e);
                }}
              />
            </Flex>

            {/* Evaluation app 行 */}
            <Flex gap={20}>
              {/* Evaluation app label */}
              <FormLabel
                w={'80px'}
                h={10}
                display={'flex'}
                alignItems={'center'}
                color={'myGray.900'}
                fontSize={'14px'}
                fontWeight={'medium'}
              >
                {t('dashboard_evaluation:Evaluation_app')}
                <QuestionTip
                  label={t('dashboard_evaluation:Evaluation_app_tip')}
                  ml={1}
                  w={'18px'}
                  h={'18px'}
                />
              </FormLabel>

              {/* Evaluation app 选择器 */}
              <Flex w={'406px'} flexDirection={'column'}>
                <AppSelect
                  value={appId}
                  onSelect={(id) => {
                    setValue('appId', id);
                  }}
                />
                {/* 当选择了之后,显示 download template 按钮 */}
                {appId && (
                  <Button
                    variant={'whiteBase'}
                    size={'sm'}
                    // TODO 此处存在问题,宽度无法正确容纳文本
                    w={'232px'}
                    h={9}
                    mt={2}
                    leftIcon={<MyIcon name={'common/download'} w={4} />}
                    onClick={handleDownloadTemplate}
                    isLoading={isLoadingAppDetail}
                  >
                    {t('dashboard_evaluation:click_to_download_template')}
                  </Button>
                )}
              </Flex>
            </Flex>

            {/* Evaluation documents 行 */}
            <Flex gap={20}>
              {/* Evaluation documents label */}
              <FormLabel
                w={'80px'}
                h={10}
                display={'flex'}
                alignItems={'center'}
                color={'myGray.900'}
                fontSize={'14px'}
                fontWeight={'medium'}
              >
                {t('dashboard_evaluation:Evaluation_file')}
              </FormLabel>

              {/* Evaluation documents 选择器,只有在选择了 Evaluation app 后才能操作 */}
              {appId ? (
                <Flex w={'406px'} flexDirection={'column'}>
                  <FileSelector
                    w={'full'}
                    maxCount={1}
                    fileType=".csv"
                    selectFiles={evaluationFiles}
                    setSelectFiles={(e) => {
                      setValue('evaluationFiles', e);
                    }}
                    FileTypeNode={
                      <Box fontSize={'xs'}>
                        <Trans
                          i18nKey="dashboard_evaluation:template_csv_file_select_tip"
                          values={{
                            fileType: '.csv'
                          }}
                          components={{
                            highlight: <Box as="span" color="primary.600" fontWeight="medium" />
                          }}
                        />
                      </Box>
                    }
                  />
                  {evaluationFiles && evaluationFiles.length > 0 && (
                    // 竖向展示上传的文件
                    <VStack mt={4} gap={2}>
                      {evaluationFiles.map((item, index) => (
                        <Flex
                          key={index}
                          w={'100%'}
                          bg={error ? 'red.50' : 'myGray.100'}
                          border={'1px solid'}
                          borderColor={error ? 'red.500' : 'transparent'}
                          lp={2}
                          borderRadius={'md'}
                          alignItems={'center'}
                        >
                          {/* 文件的 icon */}
                          <MyIcon name={item.icon as any} w={'1rem'} mr={2} />
                          {/* 文件名称 */}
                          <Box
                            color={'myGray.900'}
                            flex={1}
                            whiteSpace={'nowrap'}
                            textOverflow={'ellipsis'}
                            overflow={'hidden'}
                            fontSize={'14px'}
                          >
                            {item.name}
                          </Box>
                          {/* 文件的删除按钮 */}
                          <MyIconButton
                            icon="close"
                            hoverColor="red.500"
                            hoverBg="red.50"
                            onClick={() => {
                              setValue(
                                'evaluationFiles',
                                evaluationFiles.filter((_, i) => i !== index)
                              );

                              setError(undefined);
                            }}
                          />
                        </Flex>
                      ))}
                    </VStack>
                  )}
                  {/* 展示报错信息 */}
                  {error && (
                    <Box mt={4}>
                      <Flex alignItems={'center'} mb={2}>
                        <Box fontSize={14} mr={3} color={'myGray.900'}>
                          {t('dashboard_evaluation:check_format')}
                        </Box>
                        <Box
                          fontSize={11}
                          fontWeight={'medium'}
                          px={3}
                          py={1.5}
                          bg={'red.50'}
                          borderRadius={'sm'}
                          color={'red.500'}
                        >
                          {t('dashboard_evaluation:check_error')}
                        </Box>
                      </Flex>
                      <Markdown source={t('dashboard_evaluation:check_error_tip')} />
                    </Box>
                  )}
                </Flex>
              ) : (
                <Flex w={'406px'} fontSize={14} color={'myGray.500'} alignItems={'center'}>
                  {t('dashboard_evaluation:app_required')}
                </Flex>
              )}
            </Flex>
            {/* 底部的 Start the evaluation 按钮 */}
            <Flex w={'566px'} justifyContent={'flex-end'}>
              <Button
                h={9}
                mt={12}
                onClick={handleSubmit(onSubmit)}
                isLoading={isCreating}
                isDisabled={
                  !!error || !name || !evalModel || !appId || evaluationFiles.length === 0
                }
              >
                {isCreating
                  ? percent === 100
                    ? t('dashboard_evaluation:task_creating')
                    : t('dashboard_evaluation:file_uploading', { num: percent })
                  : t('dashboard_evaluation:start_evaluation')}
              </Button>
            </Flex>
          </VStack>
        </MyBox>
      )}
    </DashboardContainer>
  );
};

export default EvaluationCreating;

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['dashboard_evaluation', 'file']))
    }
  };
}
