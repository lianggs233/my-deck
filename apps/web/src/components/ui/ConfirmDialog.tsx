import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface ConfirmDialogProps {
  opened: boolean
  onClose: () => void
  title: string
  message: string
  /** 確認按鈕文字；danger 時為紅底白字 */
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** 確認對話框（OL-003 基底：放棄未保存／刪除標註等） */
export function ConfirmDialog({
  opened,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel = '繼續編輯',
  danger = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} centered size={480}>
      <Stack gap="xl">
        <Group gap="md" wrap="nowrap">
          {danger ? <IconAlertTriangle size={36} color="#B42318" stroke={1.8} aria-hidden /> : null}
          <Text fz={24} fw={700} c="#17324D" lh={1.3}>
            {title}
          </Text>
        </Group>
        <Text fz={16} c="#5D7184" lh={1.7}>
          {message}
        </Text>
        <Group grow>
          <Button
            variant="default"
            size="lg"
            styles={{
              root: {
                background: '#FFFFFF',
                border: '1px solid #D8E2E8',
                color: '#0B6455',
                fontWeight: 600,
              },
            }}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button size="lg" loading={loading} color={danger ? 'error' : 'teal'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
