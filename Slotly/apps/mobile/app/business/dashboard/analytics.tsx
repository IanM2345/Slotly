"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import { Text, Surface, ActivityIndicator, IconButton, Button, useTheme } from "react-native-paper"
import { useRouter } from "expo-router"
import { useTier } from "../../../context/TierContext"
import { useVerification } from "../../../context/VerificationContext"
import { VerificationGate } from "../../../components/VerificationGate"
import { LockedFeature } from "../../../components/LockedFeature"
import { KpiCard } from "../../../components/KpiCard"
import { Section } from "../../../components/Section"
import { FilterChipsRow } from "../../../components/FilterChipsRow"
import { getPerformance } from "../../../lib/api/manager"
import type { PerformanceData } from "../../../lib/types"

export default function AnalyticsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { features } = useTier()
  const { isVerified } = useVerification()
  const [loading, setLoading] = useState(true)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState(["MONTHLY"])
  const [selectedMetrics, setSelectedMetrics] = useState(["revenue", "bookings"])

  useEffect(() => {
    if (features.analytics && isVerified) {
      loadAnalytics()
    }
  }, [features.analytics, isVerified, selectedPeriod])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const data = await getPerformance("business-1", {
        period: selectedPeriod[0] as any,
        metrics: selectedMetrics,
      })
      setPerformanceData(data)
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = () => {
    router.push("/business/dashboard/billing")
  }

  const handleExportCSV = () => {
    console.log("Export CSV")
    // TODO: Implement CSV export
  }

  const handleGenerateReport = () => {
    console.log("Generate Report")
    // TODO: Navigate to reports
    router.push("/business/dashboard/reports")
  }

  const periodOptions = [
    { key: "DAILY", label: "Daily" },
    { key: "WEEKLY", label: "Weekly" },
    { key: "MONTHLY", label: "Monthly" },
  ]

  const metricOptions = [
    { key: "revenue", label: "Revenue" },
    { key: "bookings", label: "Bookings" },
    { key: "clients", label: "Clients" },
    { key: "staff", label: "Staff Performance" },
  ]

  const renderPlaceholderChart = (title: string, description: string) => (
    <Surface style={styles.chartContainer} elevation={2}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.placeholderChart}>
        <Text style={styles.placeholderText}>{description}</Text>
        <Text style={styles.placeholderSubtext}>Chart visualization will appear here</Text>
      </View>
    </Surface>
  )

  if (!features.analytics || !isVerified) {
    return (
      <VerificationGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
            <Text style={styles.title}>Analytics</Text>
          </View>

          <View style={styles.lockedContainer}>
            <LockedFeature
              title="Analytics Dashboard"
              description="Analytics are available on Pro and above"
              onPressUpgrade={handleUpgrade}
            />
          </View>
        </View>
      </VerificationGate>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Analytics</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <>
            {/* KPI Metrics */}
            {performanceData && (
              <Section title="Key Metrics">
                <View style={styles.kpiGrid}>
                  {performanceData.kpis.map((kpi, index) => (
                    <View key={index} style={styles.kpiItem}>
                      <KpiCard kpi={kpi} />
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* Filters */}
            <Section title="Filters">
              <View style={styles.filtersContainer}>
                <Text style={styles.filterLabel}>Time Period</Text>
                <FilterChipsRow
                  options={periodOptions}
                  selectedKeys={selectedPeriod}
                  onSelectionChange={setSelectedPeriod}
                  multiSelect={false}
                />

                <Text style={styles.filterLabel}>Metrics</Text>
                <FilterChipsRow
                  options={metricOptions}
                  selectedKeys={selectedMetrics}
                  onSelectionChange={setSelectedMetrics}
                  multiSelect={true}
                />

                <Button mode="contained" onPress={loadAnalytics} style={styles.updateButton} loading={loading}>
                  Update Charts
                </Button>
              </View>
            </Section>

            {/* Charts */}
            <Section title="Performance Charts">
              <View style={styles.chartsContainer}>
                {renderPlaceholderChart(
                  "Revenue & Bookings Trend",
                  "Bar chart showing revenue and booking trends over time",
                )}

                {renderPlaceholderChart("Service Distribution", "Pie chart showing distribution of services booked")}

                {renderPlaceholderChart(
                  "Staff Performance",
                  "Horizontal bar chart comparing staff performance metrics",
                )}

                {renderPlaceholderChart("Weekly Pattern", "Line chart showing booking patterns throughout the week")}
              </View>
            </Section>

            {/* Actions */}
            <Section title="Export & Reports">
              <View style={styles.actionsContainer}>
                <Button mode="outlined" onPress={handleExportCSV} style={styles.actionButton} icon="download">
                  Export CSV
                </Button>

                <Button
                  mode="contained"
                  onPress={handleGenerateReport}
                  style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
                  icon="file-document"
                >
                  Generate Report
                </Button>
              </View>
            </Section>
          </>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1559C1",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  lockedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  kpiItem: {
    width: "47%",
  },
  filtersContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
  },
  updateButton: {
    marginTop: 16,
    backgroundColor: "#1559C1",
  },
  chartsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  chartContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1559C1",
    marginBottom: 16,
  },
  placeholderChart: {
    height: 200,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 40,
  },
})
