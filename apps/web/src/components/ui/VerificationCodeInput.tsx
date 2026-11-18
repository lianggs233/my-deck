import { PinInput } from '@mantine/core'

/** 6 位驗證碼輸入（PG-003/PG-005 共用：56px 高方塊、r16、#D8E2E8 邊） */
export function VerificationCodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <PinInput
      length={6}
      type="number"
      size="xl"
      value={value}
      onChange={onChange}
      aria-label="驗證碼"
      styles={{
        input: {
          width: 56,
          height: 64,
          borderRadius: 16,
          border: '1px solid #D8E2E8',
          background: '#FFFFFF',
          fontSize: 24,
          fontWeight: 600,
          color: '#17324D',
        },
      }}
    />
  )
}
