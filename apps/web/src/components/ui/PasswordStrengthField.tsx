import { Box, Group, PasswordInput, Text } from '@mantine/core'

interface PasswordStrengthFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}

/** 密碼欄位 + 4 段強度條（PG-002/PG-006 共用） */
export function PasswordStrengthField({
  label = '密碼',
  value,
  onChange,
  placeholder = '輸入安全密碼',
  error,
}: PasswordStrengthFieldProps) {
  const strength = scorePassword(value)
  const filled = value ? Math.max(1, strength) : 0

  return (
    <div>
      <PasswordInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        error={error}
      />
      {value ? (
        <>
          <Group gap={6} mt="sm">
            {[0, 1, 2, 3].map((index) => (
              <Box
                key={index}
                h={6}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  background: index < filled ? '#12836F' : '#D8E2E8',
                }}
              />
            ))}
          </Group>
          <Text fz={16} fw={600} c="#0B6455" mt={6}>
            {strengthLabel(strength)} · 8–64 個字元，支援 Unicode
          </Text>
        </>
      ) : null}
    </div>
  )
}

function scorePassword(value: string): number {
  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

function strengthLabel(score: number): string {
  if (score <= 1) return '強度偏弱'
  if (score === 2) return '強度尚可'
  if (score === 3) return '強度良好'
  return '強度優秀'
}
