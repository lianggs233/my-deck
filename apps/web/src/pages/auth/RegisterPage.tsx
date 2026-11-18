import {
  Anchor,
  Box,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { IconBook2, IconChevronDown, IconSchool } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { IconBox } from '../../components/ui/IconBox'
import { PasswordStrengthField } from '../../components/ui/PasswordStrengthField'
import { StatusPill } from '../../components/ui/StatusPill'
import type { UserRole } from '../../types/domain'

type Channel = 'PHONE' | 'EMAIL'

/**
 * 手機號碼地區碼選擇框（放在手機號碼輸入框內左側）。
 * 現版本不可編輯，僅支援香港 +852；預留後續可選不同地區。
 */
const regionOptions = [{ value: '+852', label: '+852' }]

/** 手機號碼輸入框內的地區選擇框（disabled） */
export function RegionCodeSelect() {
  return (
    <Select
      aria-label="地區碼"
      data={regionOptions}
      defaultValue="+852"
      disabled
      variant="unstyled"
      w={88}
      rightSection={<IconChevronDown size={16} color="#5D7184" aria-hidden />}
      styles={{
        input: {
          fontSize: 16,
          fontWeight: 600,
          color: '#5D7184',
          cursor: 'not-allowed',
        },
        root: { height: '100%' },
        wrapper: { height: '100%' },
      }}
    />
  )
}

const roleCards: { role: UserRole; icon: typeof IconSchool; name: string; description: string }[] =
  [
    {
      role: 'TEACHER',
      icon: IconSchool,
      name: '老師',
      description: '建立課程、上傳課件並開始授課',
    },
    { role: 'STUDENT', icon: IconBook2, name: '學生', description: '加入課程、預覽課件並記下重點' },
  ]

/** PG-002 註冊（步驟 1：選角色、填資料、發送驗證碼） */
export function RegisterPage() {
  const { requestRegistrationCode } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('TEACHER')
  const [channel, setChannel] = useState<Channel>('EMAIL')
  const [identifier, setIdentifier] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const request = { identifier, displayName, role, password }
      const challenge = await requestRegistrationCode(request)
      navigate('/register/verify', { state: { request, challenge } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '驗證碼發送失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      kicker="開始使用"
      title="建立你的 my-deck 帳號。"
      subtitle="註冊後即可建立或加入課程，與課堂保持同步。"
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="yellow">步驟 1 / 2</StatusPill>
          <Title order={2} c="#17324D" mt="md">
            建立帳號
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            選擇角色並填寫資料，註冊後角色不可自行更改。
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void sendCode(event)}>
          <Stack gap="lg">
            <Box component="fieldset" p={0} style={{ border: 0 }}>
              <Text component="legend" fz={16} fw={600} c="#17324D" mb={8}>
                選擇你的角色
              </Text>
              <Group gap="md" grow>
                {roleCards.map((card) => {
                  const selected = role === card.role
                  return (
                    <UnstyledButton
                      key={card.role}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRole(card.role)}
                    >
                      <Paper
                        radius="lg"
                        p="lg"
                        style={{
                          border: selected ? '2px solid #12836F' : '1px solid #D8E2E8',
                          background: selected ? '#DDF4EC' : '#FFFFFF',
                          height: '100%',
                        }}
                      >
                        <Group gap="md" wrap="nowrap">
                          <IconBox tone={selected ? 'mint' : 'gray'} size={48}>
                            <card.icon size={24} stroke={1.8} aria-hidden />
                          </IconBox>
                          <Box>
                            <Text fz={16} fw={700} c="#17324D">
                              {card.name}
                            </Text>
                            <Text fz={14} c="#5D7184" mt={2} lh={1.5}>
                              {card.description}
                            </Text>
                          </Box>
                        </Group>
                      </Paper>
                    </UnstyledButton>
                  )
                })}
              </Group>
            </Box>

            <Box component="fieldset" p={0} style={{ border: 0 }}>
              <Text component="legend" fz={16} fw={600} c="#17324D" mb={8}>
                驗證方式
              </Text>
              <Group gap="md">
                {(
                  [
                    { value: 'PHONE', label: '手機號碼' },
                    { value: 'EMAIL', label: '電子郵件' },
                  ] as const
                ).map((item) => {
                  const selected = channel === item.value
                  return (
                    <UnstyledButton
                      key={item.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChannel(item.value)}
                    >
                      <Box
                        px="lg"
                        h={40}
                        style={{
                          borderRadius: 16,
                          background: selected ? '#DDF4EC' : '#FFFFFF',
                          border: selected ? '1px solid #12836F' : '1px solid #D8E2E8',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Text fz={16} fw={600} c={selected ? '#0B6455' : '#5D7184'}>
                          {item.label}
                        </Text>
                      </Box>
                    </UnstyledButton>
                  )
                })}
              </Group>
            </Box>

            {channel === 'PHONE' ? (
              <TextInput
                label="手機號碼"
                placeholder="9123 4567"
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                required
                leftSection={<RegionCodeSelect />}
                leftSectionWidth={104}
                styles={{ input: { paddingLeft: 112 } }}
              />
            ) : (
              <TextInput
                label="電子郵件"
                placeholder="name@example.com"
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                required
              />
            )}
            <TextInput
              label="顯示名稱"
              placeholder="2–30 個字元"
              value={displayName}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              required
            />
            <PasswordStrengthField value={password} onChange={setPassword} />
            <Button type="submit" loading={submitting} fullWidth>
              發送驗證碼
            </Button>
            <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455" ta="center">
              返回登入
            </Anchor>
          </Stack>
        </form>
      </Stack>
    </AuthLayout>
  )
}
