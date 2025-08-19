"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import { Text, Surface, TextInput, useTheme, IconButton } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useToast } from "./_layout"
import { staffApi } from "../../../../lib/staff/api"
import type { PerformanceMetrics } from "../../../../lib/staff/types"

export default function StaffPerformanceScreen() {
  const theme = useTheme()
  const { notify } = useToast()

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    completedBookings: 0,
    cancellations: 0,
    averageRating: 0,
    commissionEarned: 0,
  })

  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  })

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      const data = await staffApi.getPerformanceMetrics()
      setMetrics(data)
    } catch (error) {
      notify("Failed to load performance data")
    }
  }

  const MetricCard = ({
    title,
    value,
    icon,
    iconColor,
  }: {
    title: string
    value: string | number
    icon: string
    iconColor: string
  }) => (
    <Surface style={styles.metricCard} elevation={1}>
      <View style={styles.metricContent}>
        <View style={styles.metricInfo}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {title}
          </Text>
          <Text variant="headlineMedium" style={[styles.metricValue, { color: theme.colors.onBackground }]}>
            {value}
          </Text>
        </View>
        <IconButton icon={icon} size={24} iconColor={iconColor} style={styles.metricIcon} />
      </View>
    </Surface>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="menu" size={24} iconColor={theme.colors.onBackground} style={styles.menuButton} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Performance
          </Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <MetricCard title="Completed Bookings" value={metrics.completedBookings} icon="target" iconColor="#4CAF50" />

          <MetricCard title="Cancellations" value={metrics.cancellations} icon="close-circle" iconColor="#F44336" />

          <MetricCard title="Average Rating" value={metrics.averageRating.toFixed(1)} icon="star" iconColor="#FFC107" />

          <MetricCard
            title="Commission Earned"
            value={`KSh ${metrics.commissionEarned.toLocaleString()}`}
            icon="currency-usd"
            iconColor="#4CAF50"
          />
        </View>

        {/* Performance Trends */}
        <Surface style={styles.trendsCard} elevation={1}>
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            Performance Trends
          </Text>

          <View style={styles.dateRangeRow}>
            <TextInput
              label="From (mm/dd/yyyy)"
              value={dateRange.from}
              onChangeText={(text) => setDateRange((prev) => ({ ...prev, from: text }))}
              mode="outlined"
              style={styles.dateInput}
              right={<TextInput.Icon icon="calendar" />}
            />

            <Text variant="bodyMedium" style={[styles.toText, { color: theme.colors.onSurfaceVariant }]}>
              to
            </Text>

            <TextInput
              label="To (mm/dd/yyyy)"
              value={dateRange.to}
              onChangeText={(text) => setDateRange((prev) => ({ ...prev, to: text }))}
              mode="outlined"
              style={styles.dateInput}
              right={<TextInput.Icon icon="calendar" />}
            />
          </View>

          <Surface style={styles.chartPlaceholder} elevation={0}>
            <IconButton icon="chart-line" size={32} iconColor={theme.colors.onSurfaceVariant} />
            <Text variant="bodyLarge" style={[styles.chartText, { color: theme.colors.onSurfaceVariant }]}>
              📈 Performance chart visualization would go here
            </Text>
          </Surface>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  menuButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flex: 1,
    minWidth: "45%",
  },
  metricContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  metricInfo: {
    flex: 1,
  },
  metricValue: {
    fontWeight: "700",
    marginTop: 4,
  },
  metricIcon: {
    margin: 0,
  },
  trendsCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 20,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  dateInput: {
    flex: 1,
  },
  toText: {
    marginHorizontal: 16,
  },
  chartPlaceholder: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  chartText: {
    textAlign: "center",
    marginTop: 8,
  },
})
