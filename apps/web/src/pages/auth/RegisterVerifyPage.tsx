import { Anchor, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { StatusPill } from '../../components/ui/StatusPill'
import { VerificationCodeInput } from '../../components/ui/VerificationCodeInput'
import type { RegisterRequest, RegistrationChallenge } from '../../types/domain'
import { homePath } from '../../utils/home-path'
import { useCountdown } from '../../utils/use-countdown'

interface VerifyState {
  request: RegisterRequest
  challenge: RegistrationChallenge
}

/** PG-003 註冊驗證（步驟 2：6 位驗證碼 + 倒數重發） */
export function RegisterVerifyPage() {
  const { completeRegister, requestRegistrationCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as VerifyState | null
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendTick, setResendTick] = useState(0)
  const secondsLeft = useCountdown(state?.challenge.resendAfterSeconds ?? 60, resendTick)

  if (!state?.request || !state?.challenge) return <Navigate to="/register" replace />

  const { request, challenge } = state
  const deliveryText = challenge.delivery === 'EMAIL' ? '電郵' : '手機短訊'

  async function verifyAndLogin() {
    setSubmitting(true)
    setError('')
    try {
      if (code.trim().length !== 6) throw new Error('請輸入 6 位驗證碼')
      const session = await completeRegister(request.role, request.displayName)
      navigate(homePath(session.user.role), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '驗證失敗')
    } finally {
      setSubmitting(false)
    }
  }

  async function resend() {
    setError('')
    try {
      await requestRegistrationCode(request)
      setResendTick((value) => value + 1)
      setCode('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新發送失敗')
    }
  }

  return (
    <AuthLayout
      kicker="安全驗證"
      title="驗證你的帳號。"
      subtitle="輸入驗證碼以完成註冊，開始你的課堂旅程。"
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="yellow">步驟 2 / 2</StatusPill>
          <Title order={2} c="#17324D" mt="md">
            輸入驗證碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            6 位驗證碼已發送至你的{deliveryText}
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
            驗證碼有效期及重發次數受安全限制
          </Text>
          <Button fullWidth loading={submitting} onClick={() => void verifyAndLogin()}>
            驗證並登入
          </Button>
          <Group justify="space-between" w="100%" fz={16}>
            {secondsLeft > 0 ? (
              <Text fz={16} c="#5D7184">
                {secondsLeft} 秒後可重新發送
              </Text>
            ) : (
              <Anchor fz={16} fw={600} c="#0B6455" onClick={() => void resend()}>
                重新發送驗證碼
              </Anchor>
            )}
            <Anchor component={Link} to="/register" fz={16} fw={600} c="#0B6455">
              更改手機號碼
            </Anchor>
          </Group>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
