import {
  Box,
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { IconCloudUpload, IconCopy, IconFile, IconFolder } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { courseApi, coursewareApi } from '../../api/mvp'
import { CoursewareRow } from '../../components/ui/CoursewareRow'
import { PageHeading } from '../../components/ui/PageHeading'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`
}

/** PG-011 老師課程詳情（課件 tab + 上傳對話框 OL-005/OL-006） */
export function TeacherCoursePage() {
  const { courseId = '' } = useParams()
  const queryClient = useQueryClient()
  const [uploadOpened, setUploadOpened] = useState(false)
  const [cancelOpened, setCancelOpened] = useState(false)
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const courseQuery = useQuery({
    queryKey: ['course', courseId, 'TEACHER'],
    queryFn: () => courseApi.getCourse(courseId, 'TEACHER'),
    enabled: Boolean(courseId),
  })
  const coursewareQuery = useQuery({
    queryKey: ['coursewares', courseId],
    queryFn: () => coursewareApi.list(courseId),
    enabled: Boolean(courseId),
  })
  const completeUploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('請先選擇檔案')
      return coursewareApi.completeUpload(courseId, { fileName: file.name, sizeBytes: file.size })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coursewares', courseId] })
      closeUpload()
    },
  })

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function closeUpload() {
    stopTimer()
    setUploadOpened(false)
    setFile(null)
    setProgress(0)
    setUploading(false)
  }

  function startUpload() {
    if (!file) return
    setUploading(true)
    setProgress(0)
    stopTimer()
    timerRef.current = setInterval(() => {
      setProgress((value) => {
        const next = Math.min(100, value + 10)
        if (next >= 100) {
          stopTimer()
          completeUploadMutation.mutate()
        }
        return next
      })
    }, 120)
  }

  function requestCloseUpload() {
    if (uploading && !completeUploadMutation.isPending) {
      setCancelOpened(true)
      return
    }
    closeUpload()
  }

  if (courseQuery.isPending || coursewareQuery.isPending) {
    return <Loader aria-label="課程資料載入中" mx="auto" my="xl" />
  }

  if (!courseQuery.data) {
    return (
      <Text fz={16} c="#B42318" role="alert">
        課程不存在或你沒有權限查看。
      </Text>
    )
  }

  const course = courseQuery.data

  return (
    <Stack gap={32}>
      <PageHeading
        roleLabel="老師"
        title={course.name}
        meta={`${course.teacherName} · ${course.schoolYear ?? ''} · ${course.studentCount ?? 0} 位學生`}
        actions={
          <>
            {course.code ? (
              <Stack gap={4} align="flex-end">
                <Text fz={16} c="#5D7184">
                  課程碼
                </Text>
                <Group gap="sm" wrap="nowrap">
                  <CopyButton value={course.code} timeout={2000}>
                    {({ copied, copy }) => (
                      <Button
                        variant="default"
                        size="sm"
                        h={40}
                        leftSection={<IconCopy size={16} aria-hidden />}
                        styles={{
                          root: {
                            background: '#FFFFFF',
                            border: '1px solid #D8E2E8',
                            color: '#0B6455',
                          },
                        }}
                        onClick={copy}
                      >
                        {copied ? '已複製' : '複製課程碼'}
                      </Button>
                    )}
                  </CopyButton>
                  <Text fz={32} fw={700} c="#0B6455" lh={1}>
                    {course.code}
                  </Text>
                </Group>
              </Stack>
            ) : null}
            <Button
              leftSection={<IconCloudUpload size={20} aria-hidden />}
              h={64}
              onClick={() => setUploadOpened(true)}
            >
              上傳課件
            </Button>
          </>
        }
      />

      <Paper radius="lg" bg="#FFFFFF" style={{ border: '1px solid #D8E2E8' }}>
        <Tabs defaultValue="courseware">
          <Tabs.List px="xl" pt="md">
            <Tabs.Tab value="courseware" fz={20} fw={600}>
              課件
            </Tabs.Tab>
            <Tabs.Tab value="sessions" fz={20} fw={600} c="#5D7184">
              課堂記錄
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="courseware" px="xl" py="lg">
            <Stack gap="md">
              {(coursewareQuery.data?.items ?? []).map((courseware) => (
                <CoursewareRow
                  key={courseware.id}
                  courseware={courseware}
                  linkPrefix={`/teacher/courses/${courseId}`}
                />
              ))}
              <Text fz={16} c="#5D7184" mt="sm">
                課件只供課程老師管理；學生不會看到原始簡報下載入口。
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sessions" px="xl" py="xl">
            <Text fz={16} c="#5D7184" ta="center" py="xl">
              尚未有課堂記錄
            </Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* OL-005 上傳課件 */}
      <Modal
        opened={uploadOpened}
        onClose={requestCloseUpload}
        withCloseButton={false}
        centered
        size={640}
      >
        <Stack gap="xl">
          <div>
            <Title order={2} c="#17324D">
              上傳課件
            </Title>
            <Text fz={16} c="#5D7184" mt={4}>
              每次上傳一個 PPT 或 PPTX 檔案。
            </Text>
          </div>

          {file ? (
            <Group
              gap="md"
              wrap="nowrap"
              p="lg"
              style={{ borderRadius: 16, border: '1px solid #D8E2E8', background: '#FFFFFF' }}
            >
              <Box c="#0B6455">
                <IconFile size={28} stroke={1.8} aria-hidden />
              </Box>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fz={16} fw={600} c="#17324D" truncate>
                  {file.name}
                </Text>
                <Text fz={16} c="#5D7184">
                  {formatSize(file.size)} · {file.name.split('.').pop()?.toUpperCase()}
                </Text>
              </Stack>
              <Button
                variant="default"
                size="sm"
                h={40}
                disabled={uploading}
                styles={{
                  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
                }}
                onClick={() => setFile(null)}
              >
                移除
              </Button>
            </Group>
          ) : (
            <Box
              p="xl"
              style={{
                borderRadius: 16,
                border: '1px solid #D8E2E8',
                background: '#F5F8F6',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="md" wrap="nowrap">
                  <Box c="#0B6455">
                    <IconFolder size={28} stroke={1.8} aria-hidden />
                  </Box>
                  <Text fz={16} fw={600} c="#17324D">
                    選擇要上傳的課件
                  </Text>
                </Group>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ppt,.pptx"
                  hidden
                  onChange={(event) => {
                    const chosen = event.currentTarget.files?.[0]
                    if (chosen) setFile({ name: chosen.name, size: chosen.size })
                  }}
                />
                <Button
                  variant="default"
                  size="sm"
                  h={40}
                  styles={{
                    root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  選擇檔案
                </Button>
              </Group>
            </Box>
          )}

          {uploading || progress > 0 ? (
            <Stack gap="xs">
              <Group justify="space-between" fz={16}>
                <Text fw={600} c="#17324D">
                  上傳進度
                </Text>
                <Text fw={600} c="#0B6455">
                  {progress}%
                </Text>
              </Group>
              <Progress value={progress} size={12} radius="xl" color="teal" />
              <Text fz={16} c="#5D7184">
                上傳完成後會自動開始轉換
              </Text>
            </Stack>
          ) : null}

          <Group grow>
            <Button
              variant="default"
              styles={{
                root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
              }}
              onClick={requestCloseUpload}
              disabled={completeUploadMutation.isPending}
            >
              取消上傳
            </Button>
            <Button
              loading={uploading || completeUploadMutation.isPending}
              disabled={!file || uploading}
              onClick={startUpload}
            >
              開始上傳
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* OL-006 取消上傳 */}
      <ConfirmDialog
        opened={cancelOpened}
        onClose={() => setCancelOpened(false)}
        title="取消上傳？"
        message="課件尚未上傳完成，取消後需要重新選擇檔案。"
        confirmLabel="確認取消"
        danger
        onConfirm={() => {
          setCancelOpened(false)
          closeUpload()
        }}
      />
    </Stack>
  )
}
