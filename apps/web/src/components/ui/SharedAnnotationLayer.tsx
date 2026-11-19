import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'

import type { SharedAnnotation, SharedReply } from '../../types/domain'

interface SharedAnnotationLayerProps {
  /** 目前頁的共享標註（學生只會收到 VISIBLE） */
  annotations: SharedAnnotation[]
  /** 是否可新增共享標註／留言（老師恒可；學生需被授權） */
  canShare: boolean
  /** 目前使用者 ID（判斷作者身份） */
  currentUserId: string
  isTeacher: boolean
  busy?: boolean
  onAddComment: (groupId: string, content: string) => void
  onEdit: (annotation: SharedAnnotation, content: string) => void
  onDelete: (annotation: SharedAnnotation) => void
  onReply: (annotation: SharedAnnotation, content: string) => void
  onEditReply: (reply: SharedReply, content: string) => void
  onDeleteReply: (reply: SharedReply) => void
  /** 老師管理：隱藏／顯示單則留言（學生看不到 HIDDEN） */
  onToggleVisibility?: (annotation: SharedAnnotation) => void
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })
}

function RoleBadge({ role }: { role: string }) {
  return role === 'TEACHER' ? (
    <Badge size="sm" color="#17324D" variant="filled">
      老師
    </Badge>
  ) : (
    <Badge size="sm" color="#12836F" variant="light">
      學生
    </Badge>
  )
}

function InlineComposer({
  placeholder,
  busy,
  onSubmit,
}: {
  placeholder: string
  busy?: boolean
  onSubmit: (content: string) => void
}) {
  const [value, setValue] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = value.trim()
    if (!content || content.length > 100) return
    onSubmit(content)
    setValue('')
  }
  return (
    <form onSubmit={submit}>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          maxLength={100}
          style={{ flex: 1 }}
          aria-label={placeholder}
        />
        <Button size="xs" type="submit" loading={busy} disabled={!value.trim()}>
          送出
        </Button>
      </Group>
    </form>
  )
}

function MessageItem({
  annotation,
  currentUserId,
  isTeacher,
  busy,
  onEdit,
  onDelete,
  onReply,
  onEditReply,
  onDeleteReply,
  onToggleVisibility,
}: {
  annotation: SharedAnnotation
  currentUserId: string
  isTeacher: boolean
  busy?: boolean
  onEdit: SharedAnnotationLayerProps['onEdit']
  onDelete: SharedAnnotationLayerProps['onDelete']
  onReply: SharedAnnotationLayerProps['onReply']
  onEditReply: SharedAnnotationLayerProps['onEditReply']
  onDeleteReply: SharedAnnotationLayerProps['onDeleteReply']
  onToggleVisibility?: SharedAnnotationLayerProps['onToggleVisibility']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(annotation.content)
  const isAuthor = annotation.author.id === currentUserId
  const canReply = isTeacher && annotation.author.role === 'STUDENT'

  return (
    <Stack gap={6} data-annotation-id={annotation.id}>
      <Group gap="xs" wrap="nowrap">
        <Text fz={14} fw={700} c="#17324D">
          {annotation.author.displayName}
        </Text>
        <RoleBadge role={annotation.author.role} />
        <Text fz={12} c="#5D7184">
          {formatTime(annotation.createdAt)}
        </Text>
        {annotation.visibility === 'HIDDEN' ? (
          <Badge size="sm" color="gray" variant="light">
            已隱藏
          </Badge>
        ) : null}
      </Group>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const content = draft.trim()
            if (!content || content.length > 100) return
            onEdit(annotation, content)
            setEditing(false)
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              maxLength={100}
              style={{ flex: 1 }}
              aria-label="編輯留言"
            />
            <Button size="xs" type="submit" loading={busy}>
              儲存
            </Button>
            <Button size="xs" variant="subtle" onClick={() => setEditing(false)}>
              取消
            </Button>
          </Group>
        </form>
      ) : (
        <Text fz={14} c="#17324D" style={{ whiteSpace: 'pre-wrap' }}>
          {annotation.content}
        </Text>
      )}

      {annotation.replies.length > 0 ? (
        <Stack gap={4} pl="md" style={{ borderLeft: '2px solid #DDF4EC' }}>
          {annotation.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              busy={busy}
              onEdit={onEditReply}
              onDelete={onDeleteReply}
            />
          ))}
        </Stack>
      ) : null}

      <Group gap={4}>
        {isAuthor && annotation.visibility === 'VISIBLE' && !editing ? (
          <>
            <Button size="compact-xs" variant="subtle" onClick={() => setEditing(true)}>
              編輯
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              onClick={() => onDelete(annotation)}
            >
              刪除
            </Button>
          </>
        ) : null}
        {isTeacher && onToggleVisibility ? (
          <ActionIcon
            variant="subtle"
            size="sm"
            aria-label={annotation.visibility === 'VISIBLE' ? '隱藏留言' : '顯示留言'}
            onClick={() => onToggleVisibility(annotation)}
          >
            {annotation.visibility === 'VISIBLE' ? (
              <IconEyeOff size={14} aria-hidden />
            ) : (
              <IconEye size={14} aria-hidden />
            )}
          </ActionIcon>
        ) : null}
      </Group>

      {canReply ? (
        <InlineComposer
          placeholder="回覆這則留言"
          busy={busy}
          onSubmit={(content) => onReply(annotation, content)}
        />
      ) : null}
    </Stack>
  )
}

function ReplyItem({
  reply,
  currentUserId,
  busy,
  onEdit,
  onDelete,
}: {
  reply: SharedReply
  currentUserId: string
  busy?: boolean
  onEdit: SharedAnnotationLayerProps['onEditReply']
  onDelete: SharedAnnotationLayerProps['onDeleteReply']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reply.content)
  const isAuthor = reply.author.id === currentUserId

  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="nowrap">
        <Text fz={13} fw={600} c="#17324D">
          {reply.author.displayName}
        </Text>
        <Badge size="xs" color="#17324D" variant="filled">
          老師回覆
        </Badge>
        <Text fz={12} c="#5D7184">
          {formatTime(reply.createdAt)}
        </Text>
      </Group>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const content = draft.trim()
            if (!content || content.length > 100) return
            onEdit(reply, content)
            setEditing(false)
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              maxLength={100}
              style={{ flex: 1 }}
              aria-label="編輯回覆"
            />
            <Button size="xs" type="submit" loading={busy}>
              儲存
            </Button>
            <Button size="xs" variant="subtle" onClick={() => setEditing(false)}>
              取消
            </Button>
          </Group>
        </form>
      ) : (
        <Text fz={13} c="#17324D" style={{ whiteSpace: 'pre-wrap' }}>
          {reply.content}
        </Text>
      )}
      {isAuthor && !editing ? (
        <Group gap={4}>
          <Button size="compact-xs" variant="subtle" onClick={() => setEditing(true)}>
            編輯
          </Button>
          <Button size="compact-xs" variant="subtle" color="red" onClick={() => onDelete(reply)}>
            刪除
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}

/**
 * 共享標註層（REQ-011～013）：依 groupId 聚合成標記，點開 Popover 顯示留言串。
 * 個人標註不在此層；訪客不會收到任何共享標註資料。
 */
export function SharedAnnotationLayer({
  annotations,
  canShare,
  currentUserId,
  isTeacher,
  busy,
  onAddComment,
  onEdit,
  onDelete,
  onReply,
  onEditReply,
  onDeleteReply,
  onToggleVisibility,
}: SharedAnnotationLayerProps) {
  // 依 groupId 聚合（建立時間早→晚已由服務端排序）
  const groups = new Map<string, SharedAnnotation[]>()
  for (const item of annotations) {
    const list = groups.get(item.groupId) ?? []
    list.push(item)
    groups.set(item.groupId, list)
  }

  return (
    <>
      {[...groups.entries()].map(([groupId, items]) => {
        const first = items[0]
        return (
          <Popover key={groupId} width={360} position="right-start" withArrow shadow="md">
            <Popover.Target>
              <button
                type="button"
                aria-label={`共享標註，${items.length} 則留言`}
                onClick={(event) => event.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${first.position.x * 100}%`,
                  top: `${first.position.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#12836F',
                  color: '#FFFFFF',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 1px 4px rgba(23, 50, 77, 0.35)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                {items.length}
              </button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="sm" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {items.map((annotation, index) => (
                  <div key={annotation.id}>
                    {index > 0 ? <Divider my={4} /> : null}
                    <MessageItem
                      annotation={annotation}
                      currentUserId={currentUserId}
                      isTeacher={isTeacher}
                      busy={busy}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onReply={onReply}
                      onEditReply={onEditReply}
                      onDeleteReply={onDeleteReply}
                      onToggleVisibility={onToggleVisibility}
                    />
                  </div>
                ))}
              </Stack>
              {canShare ? (
                <>
                  <Divider my="xs" />
                  <InlineComposer
                    placeholder="在此標記新增留言"
                    busy={busy}
                    onSubmit={(content) => onAddComment(groupId, content)}
                  />
                </>
              ) : null}
            </Popover.Dropdown>
          </Popover>
        )
      })}
    </>
  )
}
