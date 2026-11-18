import {
  Anchor,
  Box,
  Button,
  Group,
  Paper,
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
import type { UserRole } from '../../types/domain'

type Channel = 'PHONE' | 'EMAIL'

const roleCards: { role: UserRole; icon: typeof IconSchool; name: string; description: string }[] =
  [
    { role: 'TEACHER', icon: IconSchool, name: '老師', description: '建立及帶領課堂' },
    { role: 'STUDENT', icon: IconBook2, name: '學生', description: '加入及參與課堂' },
  ]

const channelTabs: { value: Channel; label: string }[] = [
  { value: 'PHONE', label: '手機號碼' },
  { value: 'EMAIL', label: '電子郵件' },
]

/** 固定地區碼 +852；預留後續改為可選不同地區的選擇框（屆時換回 Select 元件） */
export const REGION_CODE = '+852'

export function RegionCodeSelect() {
  return (
    <Group gap={4} wrap="nowrap" pl={14} component="span" aria-label="地區號碼">
      <Text component="span" fz={16} fw={600} c="#5D7184">
        {REGION_CODE}
      </Text>
      <IconChevronDown size={16} color="#5D7184" aria-hidden />
    </Group>
  )
}

/** PG-002 註冊（選角色、填資料、免驗證碼直接註冊，成功後回登入頁） */
export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('TEACHER')
  const [channel, setChannel] = useState<Channel>('PHONE')
  const [identifier, setIdentifier] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      let submitIdentifier = identifier
      if (channel === 'PHONE') {
        // 校驗僅針對本地號碼（不含「+」），容忍貼上時的空格／破折號／已含 852 前綴
        const digits = identifier.replace(/\D/g, '')
        const local = digits.startsWith('852') && digits.length === 11 ? digits.slice(3) : digits
        if (!/^\d{8}$/.test(local)) {
          setError('請輸入 8 位數手機號碼。')
          return
        }
        submitIdentifier = `${REGION_CODE}${local}`
      }
      await register({ identifier: submitIdentifier, displayName, role, password })
      navigate('/login', { state: { registered: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '註冊失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={'建立你的\n課堂身份'}
      subtitle={'選擇老師或學生角色，\n完成驗證即可開始互動。'}
    >
      <Stack gap="xl">
        <div>
          <Title order={2} fz={32} c="#17324D">
            建立帳號
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            只需幾步，即可加入你的第一個課堂。
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void submit(event)}>
          <Stack gap="lg">
            <Box component="fieldset" p={0} style={{ border: 0 }}>
              <Text component="legend" fz={16} fw={600} c="#17324D" mb={8}>
                你的角色
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
                        p="md"
                        style={{
                          border: selected ? '2px solid #12836F' : '1px solid #D8E2E8',
                          background: selected ? '#DDF4EC' : '#FFFFFF',
                          height: '100%',
                        }}
                      >
                        <Group gap="md" wrap="nowrap">
                          <IconBox tone={card.role === 'TEACHER' ? 'mint' : 'yellow'} size={40}>
                            <card.icon size={22} stroke={1.8} aria-hidden />
                          </IconBox>
                          <Box>
                            <Text fz={16} fw={700} c="#17324D">
                              {card.name}
                            </Text>
                            <Text fz={14} c="#5D7184" mt={2}>
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

            {/* 頻道切換（分段控制） */}
            <Group
              gap={4}
              p={4}
              style={{ border: '1px solid #D8E2E8', borderRadius: 16, background: '#FFFFFF' }}
              role="tablist"
              aria-label="驗證方式"
            >
              {channelTabs.map((tab) => {
                const selected = channel === tab.value
                return (
                  <UnstyledButton
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setChannel(tab.value)}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 12,
                      background: selected ? '#DDF4EC' : 'transparent',
                    }}
                  >
                    <Text ta="center" fz={16} fw={600} c={selected ? '#0B6455' : '#5D7184'}>
                      {tab.label}
                    </Text>
                  </UnstyledButton>
                )
              })}
            </Group>

            <div>
              <Group justify="space-between" mb={8}>
                <Text
                  component="label"
                  htmlFor="register-display-name"
                  fz={16}
                  fw={600}
                  c="#17324D"
                >
                  顯示名稱
                </Text>
                <Text fz={14} c="#5D7184">
                  2–30 個字元
                </Text>
              </Group>
              <TextInput
                id="register-display-name"
                placeholder="陳老師"
                value={displayName}
                onChange={(event) => setDisplayName(event.currentTarget.value)}
                required
              />
            </div>

            {channel === 'PHONE' ? (
              <TextInput
                label="手機號碼"
                placeholder="9123 4567"
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                leftSection={<RegionCodeSelect />}
                leftSectionWidth={78}
                styles={{ input: { paddingLeft: 86 } }}
                inputMode="numeric"
                required
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

            <PasswordStrengthField value={password} onChange={setPassword} />

            <Button type="submit" loading={submitting} fullWidth>
              註冊
            </Button>
            <Text ta="center" fz={16} c="#5D7184">
              已有帳號？{' '}
              <Anchor component={Link} to="/login" fz={16} fw={700} c="#0B6455">
                返回登入
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Stack>
    </AuthLayout>
  )
}
