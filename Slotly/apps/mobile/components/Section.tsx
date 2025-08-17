import type React from "react"
import { View, StyleSheet } from "react-native"
import { Text } from "react-native-paper"

interface SectionProps {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function Section({ title, children, action }: SectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
})
