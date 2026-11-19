import { Group, Text } from '@mantine/core'
import { IconChevronDown } from '@tabler/icons-react'

import { REGION_CODE } from '../../utils/phone'

/** 地區碼前綴框（+852）；預留後續改為可選不同地區的選擇框（屆時換回 Select 元件） */
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
