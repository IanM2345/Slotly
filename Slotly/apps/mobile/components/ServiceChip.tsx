"use client"

import { Chip, useTheme } from "react-native-paper"

interface ServiceChipProps {
  service: string
  onPress?: () => void
  selected?: boolean
}

export function ServiceChip({ service, onPress, selected = false }: ServiceChipProps) {
  const theme = useTheme()

  return (
    <Chip
      selected={selected}
      onPress={onPress}
      style={{
        backgroundColor: selected ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
        marginRight: 4,
        marginBottom: 4,
      }}
      textStyle={{
        fontSize: 11,
        color: selected ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant,
      }}
      compact
    >
      {service}
    </Chip>
  )
}
