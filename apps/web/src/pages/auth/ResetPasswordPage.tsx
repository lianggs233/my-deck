import { Anchor, Button, PasswordInput, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { PasswordStrengthField } from '../../components/ui/PasswordStrengthField'

interface ResetState {
  challengeId: string
  code: string
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

  if (!state?.challengeId || !state.code) return <Navigate to="/forgot-password" replace />
  const { challengeId, code } = state

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      if (password.length < 8) throw new Error('密碼需至少 8 個字元')
      if (password !== confirm) throw new Error('兩次輸入的密碼不一致')
      await resetPassword(challengeId, code, password)
      navigate('/login', { replace: true, state: { reset: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重設密碼失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={'設定新密碼，\n重新安全登入'}
      subtitle={'重設成功後，所有舊工作階段\n都會撤銷。'}
    >
      <Stack gap="xl">
        <div>
          <Title order={2} fz={32} c="#17324D">
            設定新密碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4} style={{ whiteSpace: 'pre-line' }}>
            {'請使用未曾於其他網站使用的密碼，\n並達到安全強度要求。'}
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
            <Text ta="center" fz={16} fw={600} style={{ flex: 1 }}>
              完成後，所有裝置都需要重新登入。
            </Text>
          </div>
          <Button fullWidth loading={submitting} onClick={() => void submit()}>
            重設密碼並返回登入
          </Button>
          <Anchor component={Link} to="/login" ta="center" fz={16} fw={700} c="#0B6455">
            取消並返回登入
          </Anchor>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
