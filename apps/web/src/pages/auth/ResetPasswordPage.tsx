import { Anchor, Button, PasswordInput, Stack, Text, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { IconBox } from '../../components/ui/IconBox'
import { PasswordStrengthField } from '../../components/ui/PasswordStrengthField'

interface ResetState {
  challengeId: string
}

/** PG-006 設定新密碼 */
export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ResetState | null
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!state?.challengeId) return <Navigate to="/forgot-password" replace />
  const { challengeId } = state

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      if (password.length < 8) throw new Error('密碼需至少 8 個字元')
      if (password !== confirm) throw new Error('兩次輸入的密碼不一致')
      await resetPassword(challengeId, password)
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重設密碼失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      kicker="設定新密碼"
      title="最後一步，更新密碼。"
      subtitle="設定完成後即可使用新密碼登入 my-deck。"
    >
      <Stack gap="xl">
        <div>
          <IconBox tone="yellow" size={64} c="#17324D">
            <IconLock size={30} stroke={1.8} aria-hidden />
          </IconBox>
          <Title order={2} c="#17324D" mt="md">
            設定新密碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            請輸入 8–64 個字元的新密碼，支援 Unicode。
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <Stack gap="lg">
          <PasswordStrengthField label="新密碼" value={password} onChange={setPassword} />
          <PasswordInput
            label="再次輸入新密碼"
            placeholder="再次輸入新密碼"
            value={confirm}
            onChange={(event) => setConfirm(event.currentTarget.value)}
          />
          <div className="md-notice md-notice-yellow">
            <IconLock size={20} stroke={1.8} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <Text fz={16} fw={600}>
              完成後，所有裝置都需要重新登入。
            </Text>
          </div>
          <Button fullWidth loading={submitting} onClick={() => void submit()}>
            重設密碼並返回登入
          </Button>
          <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455" ta="center">
            取消並返回登入
          </Anchor>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
