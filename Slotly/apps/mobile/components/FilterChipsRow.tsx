import { ScrollView, StyleSheet } from "react-native"
import { Chip } from "react-native-paper"

interface FilterChipsRowProps {
  options: { key: string; label: string }[]
  selectedKeys: string[]
  onSelectionChange: (selectedKeys: string[]) => void
  multiSelect?: boolean
}

export function FilterChipsRow({ options, selectedKeys, onSelectionChange, multiSelect = false }: FilterChipsRowProps) {
  const handleChipPress = (key: string) => {
    if (multiSelect) {
      const newSelection = selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]
      onSelectionChange(newSelection)
    } else {
      onSelectionChange([key])
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {options.map((option) => (
        <Chip
          key={option.key}
          selected={selectedKeys.includes(option.key)}
          onPress={() => handleChipPress(option.key)}
          style={styles.chip}
          textStyle={styles.chipText}
          mode="outlined"
        >
          {option.label}
        </Chip>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    marginVertical: 4,
  },
  chipText: {
    fontSize: 12,
  },
})
