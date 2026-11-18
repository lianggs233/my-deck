import { Anchor, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { StatusPill } from '../../components/ui/StatusPill'
import { VerificationCodeInput } from '../../components/ui/VerificationCodeInput'
import type { RegistrationChallenge } from '../../types/domain'
import { useCountdown } from '../../utils/use-countdown'

interface VerifyState {
  identifier: string
  challenge: RegistrationChallenge
}

/** PG-005 重設密碼驗證（安全驗證） */
export function ResetVerifyPage() {
  const { requestPasswordReset, verifyPasswordResetCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as VerifyState | null
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendTick, setResendTick] = useState(0)
  const secondsLeft = useCountdown(state?.challenge.resendAfterSeconds ?? 60, resendTick)

  if (!state?.challenge) return <Navigate to="/forgot-password" replace />

  const { identifier, challenge } = state

  async function verify() {
    setSubmitting(true)
    setError('')
    try {
      if (code.trim().length !== 6) throw new Error('請輸入 6 位驗證碼')
      await verifyPasswordResetCode(challenge.challengeId, code)
      navigate('/reset/password', { state: { challengeId: challenge.challengeId } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '驗證失敗')
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setError('')
    try {
      await requestPasswordReset(identifier)
      setResendTick((value) => value + 1)
      setCode('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新發送失敗')
    }
  }

  return (
    <AuthLayout
      kicker="安全驗證"
      title="確認你的身份。"
      subtitle="輸入我們剛發送的 6 位驗證碼，即可設定新密碼。"
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="yellow">安全驗證</StatusPill>
          <Title order={2} c="#17324D" mt="md">
            輸入驗證碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            驗證碼已發送至 {identifier}
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <Stack gap="lg" align="flex-start">
          <VerificationCodeInput value={code} onChange={setCode} />
          <Text fz={16} c="#5D7184">
            請勿與任何人分享驗證碼
          </Text>
          <Button fullWidth loading={submitting} onClick={() => void verify()}>
            驗證並繼續
          </Button>
          <Group justify="space-between" w="100%">
            {secondsLeft > 0 ? (
              <Text fz={16} c="#5D7184">
                {secondsLeft} 秒後可重新發送
              </Text>
            ) : (
              <Anchor fz={16} fw={600} c="#0B6455" onClick={() => void resend()}>
                重新發送驗證碼
              </Anchor>
            )}
            <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455">
              返回登入
            </Anchor>
          </Group>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
