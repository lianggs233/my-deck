import { Anchor, Button, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconDoorEnter } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { classroomApi } from '../../api/mvp'
import { ApiError } from '../../api/http'
import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { StatusPill } from '../../components/ui/StatusPill'
import { clearGuestId, readGuestId, saveGuestId } from '../../utils/guest-identity'
import { homePath } from '../../utils/home-path'

const CODE_LENGTH = 6
/** 課堂碼字元集：大寫字母＋數字，排除 0／O／1／I（REQ-006／REQ-007） */
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/

function normalizeCode(input: string): string {
  return input.replace(/\s|-/g, '').toUpperCase().slice(0, CODE_LENGTH)
}

/** 公開加入課堂頁（REQ-007）：已登入學生或訪客以 6 位課堂碼加入 */
export function JoinClassroomPage() {
  const { code: codeParam = '' } = useParams()
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const { showError } = useErrorAlert()
  const [code, setCode] = useState(() => normalizeCode(codeParam))
  const [submitting, setSubmitting] = useState(false)
  const [guestInvalidOpened, setGuestInvalidOpened] = useState(false)

  const isStudent = user?.role === 'STUDENT'
  const isTeacher = user?.role === 'TEACHER'

  function goToClassroom(classroomId: string, guestId?: string | null) {
    const query = guestId ? `?guest=${encodeURIComponent(guestId)}` : ''
    navigate(`/classrooms/${classroomId}${query}`, { replace: true })
  }

  async function joinAsStudent(normalized: string) {
    const result = await classroomApi.join(normalized)
    goToClassroom(result.classroom.id)
  }

  async function joinAsGuest(normalized: string, guestId: string | null) {
    const result = await classroomApi.join(normalized, guestId)
    const newGuestId = result.participant.guestId ?? guestId
    if (newGuestId && newGuestId !== guestId) {
      if (!saveGuestId(newGuestId)) {
        showError('無法在此瀏覽器保存訪客身份，重新整理後將無法恢復本次身份。')
      }
    }
    goToClassroom(result.classroom.id, newGuestId ?? null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = normalizeCode(code)
    if (!CODE_PATTERN.test(normalized)) {
      showError('請輸入 6 位課堂碼（大寫字母或數字，不含 0、O、1、I）。')
      return
    }
    setSubmitting(true)
    try {
      if (isStudent) {
        await joinAsStudent(normalized)
      } else {
        await joinAsGuest(normalized, readGuestId())
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'GUEST_IDENTITY_INVALID') {
        // 訪客 ID 失效：須經使用者確認才建立新身份，不自動合併
        setGuestInvalidOpened(true)
      } else {
        showError(cause instanceof Error ? cause.message : '加入課堂失敗')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmNewGuestIdentity() {
    setGuestInvalidOpened(false)
    const normalized = normalizeCode(code)
    setSubmitting(true)
    try {
      clearGuestId()
      await joinAsGuest(normalized, null)
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : '加入課堂失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={'加入你的\n即時課堂'}
      subtitle={'輸入老師提供的課堂碼，\n同步觀看課堂目前頁面。'}
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="mint" leftSection={<IconDoorEnter size={16} aria-hidden />}>
            即時課堂
          </StatusPill>
          <Title order={2} fz={32} c="#17324D" mt="md">
            加入課堂
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            課堂碼為 6 位；課程碼為 8 位，只在加入課程時使用。
          </Text>
        </div>

        {isLoading ? null : (
          <Text fz={16} c="#5D7184" role="status">
            {isStudent
              ? `目前登入：${user?.displayName ?? ''}（學生）`
              : isTeacher
                ? '老師帳號無法以此頁加入課堂，請由課件詳情頁開始授課。'
                : '目前未登入，將以訪客身份加入。'}
          </Text>
        )}

        <form onSubmit={(event) => void submit(event)}>
          <Stack gap="lg">
            <TextInput
              label="課堂碼"
              placeholder="ABC234"
              value={code}
              onChange={(event) => setCode(normalizeCode(event.currentTarget.value))}
              maxLength={CODE_LENGTH}
              autoComplete="off"
              spellCheck={false}
              styles={{
                input: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                },
              }}
              required
            />
            <Button
              type="submit"
              loading={submitting}
              fullWidth
              disabled={isTeacher || !CODE_PATTERN.test(code)}
            >
              加入課堂
            </Button>
          </Stack>
        </form>

        {isStudent ? null : (
          <div className="md-notice md-notice-blue">
            <Stack gap={4}>
              <Text fz={16} fw={600}>
                訪客只能觀看老師目前頁面
              </Text>
              <Text fz={16} c="#5D7184">
                訪客不可簽到、作答、標註，也看不到共享標註或下載課件。
              </Text>
            </Stack>
          </div>
        )}

        <Text ta="center" fz={16} c="#5D7184">
          {user ? (
            <Anchor component={Link} to={homePath(user.role)} fz={16} fw={600} c="#0B6455">
              返回首頁
            </Anchor>
          ) : (
            <>
              已有帳號？{' '}
              <Anchor component={Link} to="/login" fz={16} fw={700} c="#0B6455">
                登入
              </Anchor>
            </>
          )}
        </Text>
      </Stack>

      <ConfirmDialog
        opened={guestInvalidOpened}
        onClose={() => setGuestInvalidOpened(false)}
        title="訪客身份已失效"
        message="此瀏覽器保存的訪客身份已失效，無法恢復先前的訪客身份。是否以新的訪客身份加入課堂？"
        confirmLabel="建立新身份並加入"
        cancelLabel="取消"
        onConfirm={() => void confirmNewGuestIdentity()}
      />
    </AuthLayout>
  )
}
