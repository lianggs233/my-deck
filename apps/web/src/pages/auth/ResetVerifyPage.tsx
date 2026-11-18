import { Anchor, Button, Stack, Text, Title } from '@mantine/core'
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
  const [challengeId, setChallengeId] = useState(state?.challenge.challengeId ?? '')
  const secondsLeft = useCountdown(state?.challenge.resendAfterSeconds ?? 60, resendTick)

  if (!state?.challenge) return <Navigate to="/forgot-password" replace />

  const { identifier } = state

  async function verify() {
    setSubmitting(true)
    setError('')
    try {
      await verifyPasswordResetCode(challengeId, code)
      navigate('/reset/password', { state: { challengeId, code } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '驗證失敗')
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setError('')
    try {
      const challenge = await requestPasswordReset(identifier)
      setChallengeId(challenge.challengeId)
      setResendTick((value) => value + 1)
      setCode('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新發送失敗')
    }
  }

  return (
    <AuthLayout
      title={'驗證身份，\n保護課堂資料'}
      subtitle={'此步驟用於確認帳號擁有者，\n不會泄露帳號註冊狀態。'}
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="yellow">安全驗證</StatusPill>
          <Title order={2} fz={32} c="#17324D" mt="md">
            輸入驗證碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4} style={{ whiteSpace: 'pre-line' }}>
            {'如帳號符合重設條件，驗證碼將發送至\n已綁定的手機號碼或電郵。'}
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <Stack gap="lg">
          <VerificationCodeInput value={code} onChange={setCode} />
          <Text ta="center" fz={16} c="#5D7184">
            請勿與任何人分享驗證碼
          </Text>
          <Button fullWidth loading={submitting} onClick={() => void verify()}>
            驗證並繼續
          </Button>
          <Text ta="center" fz={16} c="#5D7184">
            {secondsLeft > 0 ? (
              `${secondsLeft} 秒後可重新發送`
            ) : (
              <Anchor fz={16} fw={600} c="#0B6455" onClick={() => void resend()}>
                重新發送驗證碼
              </Anchor>
            )}
          </Text>
          <Anchor component={Link} to="/login" ta="center" fz={16} fw={700} c="#0B6455">
            返回登入
          </Anchor>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
