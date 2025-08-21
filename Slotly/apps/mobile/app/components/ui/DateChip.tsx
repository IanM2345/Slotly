import React from "react";
import { Chip, useTheme } from "react-native-paper";

export default function DateChip({ label, selected = false, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Chip
      compact
      onPress={onPress}
      selected={selected}
      style={{
        borderRadius: 10,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: theme.colors.outline,
      }}
      selectedColor={selected ? theme.colors.onPrimary : theme.colors.onSurface}
      textStyle={{ fontWeight: "700" }}
    >
      {label}
    </Chip>
  );
}


