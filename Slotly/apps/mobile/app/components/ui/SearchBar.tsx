import React from "react";
import { View } from "react-native";
import { TextInput, IconButton, useTheme } from "react-native-paper";

type SearchBarProps = {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onPressFilters?: () => void;
};

export default function SearchBar({ placeholder = "Search", value, onChangeText, onPressFilters }: SearchBarProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 }}>
      <TextInput
        mode="outlined"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        style={{ flex: 1 }}
        left={<TextInput.Icon icon="magnify" />}
        outlineColor={theme.colors.outline}
        activeOutlineColor={theme.colors.primary}
      />
      <IconButton
        icon="filter-variant"
        size={22}
        onPress={onPressFilters}
        containerColor={theme.colors.surface}
        iconColor={theme.colors.onSurface}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: theme.colors.outline }}
      />
    </View>
  );
}


