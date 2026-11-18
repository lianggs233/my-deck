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
import { IconChevronRight, IconCircleCheck, IconFolderPlus } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { courseApi } from '../../api/mvp'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyStateCard } from '../../components/ui/EmptyStateCard'
import { HeroBanner } from '../../components/ui/HeroBanner'
import { IconBox } from '../../components/ui/IconBox'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { StatusPill } from '../../components/ui/StatusPill'

/** PG-007 老師首頁（含 OL-002 建立課程、OL-003 放棄未保存） */
export function TeacherHomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpened, setCreateOpened] = useState(false)
  const [discardOpened, setDiscardOpened] = useState(false)
  const [name, setName] = useState('')
  const [modalError, setModalError] = useState('')

  const coursesQuery = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: () => courseApi.listTeacherCourses(),
  })
  const createCourseMutation = useMutation({
    mutationFn: (courseName: string) => courseApi.createCourse(courseName),
    onSuccess: async () => {
      closeModal()
      await queryClient.invalidateQueries({ queryKey: ['teacher-courses'] })
    },
    onError: (cause) => setModalError(cause instanceof Error ? cause.message : '建立課程失敗'),
  })

  function closeModal() {
    setCreateOpened(false)
    setName('')
    setModalError('')
  }

  function requestCloseModal() {
    if (name.trim() && !createCourseMutation.isPending) {
      setDiscardOpened(true)
      return
    }
    closeModal()
  }

  const courses = coursesQuery.data?.items ?? []

  return (
    <Stack gap={48}>
      <div>
        <Title order={1} c="#17324D">
          我的課程
        </Title>
        <Text fz={20} c="#5D7184" mt={4}>
          管理你的課程與課件，準備開始授課
        </Text>
      </div>

      <HeroBanner
        tone="navy"
        icon={<IconFolderPlus size={36} stroke={1.8} aria-hidden />}
        title="準備好下一堂課了嗎？"
        subtitle="建立課程、上傳課件，並分享課程碼給學生。"
        action={
          <Button
            bg="#FFC94A"
            c="#17324D"
            w={240}
            h={64}
            fz={16}
            fw={600}
            onClick={() => setCreateOpened(true)}
          >
            建立課程
          </Button>
        }
      />

      <section aria-labelledby="teacher-course-list">
        <SectionHeader
          title="課程列表"
          right={
            <StatusPill tone="mint" leftSection={<IconCircleCheck size={18} aria-hidden />}>
              帳號及身份已驗證
            </StatusPill>
          }
        />
        <Stack gap="md" mt="lg">
          {coursesQuery.isPending ? <Loader aria-label="課程載入中" mx="auto" my="xl" /> : null}

          {coursesQuery.isError ? (
            <Text fz={16} c="#B42318" role="alert">
              無法讀取課程，請確認登入狀態後重新整理。
            </Text>
          ) : null}

          {coursesQuery.isSuccess && courses.length === 0 ? (
            <EmptyStateCard
              icon={<IconFolderPlus size={44} stroke={1.6} aria-hidden />}
              title="尚未有課程"
              description="建立你的第一個課程，上傳課件並分享課程碼給學生。"
              note="你的角色為老師，註冊後不可自行更改。"
            />
          ) : null}

          {courses.map((course) => (
            <UnstyledButton
              key={course.id}
              onClick={() => navigate(`/teacher/courses/${course.id}`)}
              aria-label={`進入課程 ${course.name}`}
            >
              <Group
                gap="lg"
                wrap="nowrap"
                p="lg"
                style={{
                  borderRadius: 24,
                  background: '#FFFFFF',
                  border: '1px solid #D8E2E8',
                }}
              >
                <IconBox tone="yellow" size={56} c="#17324D">
                  <IconFolderPlus size={26} stroke={1.8} aria-hidden />
                </IconBox>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text fz={20} fw={600} c="#17324D" truncate>
                    {course.name}
                  </Text>
                  <Text fz={16} c="#5D7184">
                    課程碼 {course.code} · 2026 學年
                  </Text>
                </Stack>
                <Text fz={16} fw={600} c="#0B6455">
                  查看詳情
                </Text>
                <IconChevronRight size={16} color="#5D7184" aria-hidden />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </section>

      {/* OL-002 建立課程 */}
      <Modal
        opened={createOpened}
        onClose={requestCloseModal}
        withCloseButton={false}
        centered
        size={560}
      >
        <Stack gap="xl">
          <div>
            <Title order={2} c="#17324D">
              建立課程
            </Title>
            <Text fz={16} c="#5D7184" mt={4}>
              建立後會產生專屬課程碼，方便學生加入。
            </Text>
          </div>
          <TextInput
            label="課程名稱"
            placeholder="例如：中國語文・閱讀理解"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <div className="md-notice">
            <IconCircleCheck size={22} stroke={1.8} aria-hidden style={{ flexShrink: 0 }} />
            <Stack gap={2}>
              <Text fz={16} fw={600}>
                建立後自動產生 8 位課程碼
              </Text>
              <Text fz={16} c="#0B6455" opacity={0.75}>
                排除容易混淆的 0、O、1、I
              </Text>
            </Stack>
          </div>
          {modalError ? (
            <Text fz={16} c="#B42318" role="alert">
              {modalError}
            </Text>
          ) : null}
          <Group grow>
            <Button
              variant="default"
              styles={{
                root: {
                  background: '#FFFFFF',
                  border: '1px solid #D8E2E8',
                  color: '#0B6455',
                },
              }}
              onClick={requestCloseModal}
              disabled={createCourseMutation.isPending}
            >
              取消
            </Button>
            <Button
              loading={createCourseMutation.isPending}
              disabled={!name.trim()}
              onClick={() => createCourseMutation.mutate(name.trim())}
            >
              建立課程
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* OL-003 放棄未保存 */}
      <ConfirmDialog
        opened={discardOpened}
        onClose={() => setDiscardOpened(false)}
        title="放棄未保存內容？"
        message="目前填寫的內容尚未保存，離開後將會遺失。"
        confirmLabel="確認放棄"
        danger
        onConfirm={() => {
          setDiscardOpened(false)
          closeModal()
        }}
      />
    </Stack>
  )
}
