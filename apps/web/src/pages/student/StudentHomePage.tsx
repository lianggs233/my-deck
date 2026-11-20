import {
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { IconBook2, IconChevronRight, IconCircleCheck, IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { courseApi } from '../../api/mvp'
import { EmptyStateCard } from '../../components/ui/EmptyStateCard'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { HeroBanner } from '../../components/ui/HeroBanner'
import { IconBox } from '../../components/ui/IconBox'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { StatusPill } from '../../components/ui/StatusPill'

/** PG-008 學生首頁（含 OL-004 加入課程） */
export function StudentHomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showError } = useErrorAlert()
  const [joinOpened, setJoinOpened] = useState(false)
  const [code, setCode] = useState('')

  const membershipsQuery = useQuery({
    queryKey: ['student-memberships'],
    queryFn: () => courseApi.listStudentMemberships(),
  })
  const joinMutation = useMutation({
    mutationFn: (courseCode: string) => courseApi.joinByCode(courseCode),
    onSuccess: async () => {
      setJoinOpened(false)
      setCode('')
      await queryClient.invalidateQueries({ queryKey: ['student-memberships'] })
    },
    onError: (cause) => showError(cause instanceof Error ? cause.message : '加入課程失敗'),
  })

  const membershipsLoadError = membershipsQuery.error
  useEffect(() => {
    if (membershipsLoadError) showError('無法讀取課程，請確認登入狀態後重新整理。')
  }, [membershipsLoadError, showError])

  const memberships = membershipsQuery.data?.items ?? []

  return (
    <Stack gap={32}>
      <div>
        <Title order={1} c="#17324D">
          學習中心
        </Title>
        <Text fz={20} c="#5D7184" mt={4}>
          查看已加入的課程，預覽課件並管理個人標註
        </Text>
      </div>

      <HeroBanner
        tone="teal"
        icon={<IconBook2 size={36} stroke={1.8} aria-hidden />}
        title="歡迎回來！"
        subtitle="輸入老師提供的課程碼，加入課程開始學習。"
        action={
          <Button
            bg="#FFC94A"
            c="#17324D"
            w={240}
            h={64}
            fz={16}
            fw={600}
            leftSection={<IconPlus size={20} aria-hidden />}
            onClick={() => setJoinOpened(true)}
          >
            加入課程
          </Button>
        }
      />

      <section aria-labelledby="student-course-list">
        <SectionHeader
          title="我的課程"
          right={
            <StatusPill tone="mint" leftSection={<IconCircleCheck size={18} aria-hidden />}>
              帳號及身份已驗證
            </StatusPill>
          }
        />
        <Stack gap="md" mt="lg">
          {membershipsQuery.isPending ? <Loader aria-label="課程載入中" mx="auto" my="xl" /> : null}

          {membershipsQuery.isSuccess && memberships.length === 0 ? (
            <EmptyStateCard
              icon={<IconBook2 size={44} stroke={1.6} aria-hidden />}
              title="尚未加入課程"
              description="輸入老師提供的 8 位課程碼，加入你的第一個課程。"
              note="你的角色為學生，註冊後不可自行更改。"
            />
          ) : null}

          {memberships.map((membership) => (
            <UnstyledButton
              key={membership.id}
              onClick={() => navigate(`/student/courses/${membership.course.id}`)}
              aria-label={`進入課程 ${membership.course.name}`}
            >
              <Group
                gap="lg"
                wrap="nowrap"
                p="lg"
                style={{ borderRadius: 24, background: '#FFFFFF', border: '1px solid #D8E2E8' }}
              >
                <IconBox tone="mint" size={56}>
                  <IconBook2 size={26} stroke={1.8} aria-hidden />
                </IconBox>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text fz={20} fw={600} c="#17324D" truncate>
                    {membership.course.name}
                  </Text>
                  <Text fz={16} c="#5D7184">
                    {membership.course.teacherName} · 2026 學年
                  </Text>
                </Stack>
                <Text fz={16} fw={600} c="#0B6455">
                  進入課程
                </Text>
                <IconChevronRight size={16} color="#5D7184" aria-hidden />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </section>

      {/* OL-004 加入課程 */}
      <Modal
        opened={joinOpened}
        onClose={() => {
          setJoinOpened(false)
          setCode('')
        }}
        withCloseButton={false}
        centered
        size={560}
      >
        <Stack gap="xl">
          <div>
            <Title order={2} c="#17324D">
              加入課程
            </Title>
            <Text fz={16} c="#5D7184" mt={4}>
              輸入老師提供的 8 位課程碼。
            </Text>
          </div>
          <TextInput
            label="課程碼"
            placeholder="例如：ABCD2345"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
          />
          <div className="md-notice">
            <IconBook2 size={22} stroke={1.8} aria-hidden style={{ flexShrink: 0 }} />
            <Stack gap={2}>
              <Text fz={16} fw={600}>
                加入後即可查看課堂入口
              </Text>
              <Text fz={16} c="#0B6455" opacity={0.75}>
                課程內容會顯示在你的首頁
              </Text>
            </Stack>
          </div>
          <Group grow>
            <Button
              variant="default"
              styles={{
                root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
              }}
              onClick={() => {
                setJoinOpened(false)
                setCode('')
              }}
              disabled={joinMutation.isPending}
            >
              取消
            </Button>
            <Button
              loading={joinMutation.isPending}
              disabled={code.trim().length !== 8}
              onClick={() => joinMutation.mutate(code.trim())}
            >
              加入課程
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
