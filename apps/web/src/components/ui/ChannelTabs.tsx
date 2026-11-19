import { Group, Text, UnstyledButton } from '@mantine/core'

export type Channel = 'PHONE' | 'EMAIL'

const channelTabs: { value: Channel; label: string }[] = [
  { value: 'PHONE', label: '手機號碼' },
  { value: 'EMAIL', label: '電子郵件' },
]

/** 手機號碼／電子郵件分段切換（登入 PG-001、註冊 PG-002 共用） */
export function ChannelTabs({
  value,
  onChange,
  ariaLabel,
}: {
  value: Channel
  onChange: (value: Channel) => void
  ariaLabel: string
}) {
  return (
    <Group
      gap={4}
      p={4}
      style={{ border: '1px solid #D8E2E8', borderRadius: 16, background: '#FFFFFF' }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {channelTabs.map((tab) => {
        const selected = value === tab.value
        return (
          <UnstyledButton
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
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
  )
}
