import { View, StyleSheet } from "react-native"
import { Text, Surface } from "react-native-paper"
import type { KPI } from "../lib/types"

interface KpiCardProps {
  kpi: KPI
}

export function KpiCard({ kpi }: KpiCardProps) {
  const changeColor = kpi.change && kpi.change > 0 ? "#4CAF50" : kpi.change && kpi.change < 0 ? "#F44336" : "#666"
  const changeIcon = kpi.change && kpi.change > 0 ? "↗" : kpi.change && kpi.change < 0 ? "↘" : ""

  return (
    <Surface style={styles.container} elevation={2}>
      <Text style={styles.label}>{kpi.label}</Text>
      <Text style={styles.value}>{kpi.value}</Text>
      {kpi.change !== undefined && (
        <View style={styles.changeContainer}>
          <Text style={[styles.change, { color: changeColor }]}>
            {changeIcon} {Math.abs(kpi.change)}%
          </Text>
          {kpi.period && <Text style={styles.period}>{kpi.period}</Text>}
        </View>
      )}
    </Surface>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minHeight: 100,
  },
  label: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    fontWeight: "500",
  },
  value: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  change: {
    fontSize: 12,
    fontWeight: "600",
  },
  period: {
    fontSize: 10,
    color: "#888",
  },
})
