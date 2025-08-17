"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { useTier } from "../../../context/TierContext"
import { VerificationGate } from "../../../components/VerificationGate"
import { LockedFeature } from "../../../components/LockedFeature"
import { Section } from "../../../components/Section"

interface Report {
  id: string
  title: string
  period: string
  generatedDate: string
  kpis: {
    totalRevenue: string
    totalBookings: number
    uniqueClients: number
    averageServiceValue: string
  }
}

export default function ReportsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { features } = useTier()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    if (features.reports) {
      loadReports()
    }
  }, [features.reports])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Mock reports data
      await new Promise((resolve) => setTimeout(resolve, 800))
      
      const mockReports: Report[] = [
        {
          id: "1",
          title: "January 2024 Report",
          period: "January 1 - 31, 2024",
          generatedDate: "2024-02-01",
          kpis: {
            totalRevenue: "KSh 456,780",
            totalBookings: 234,
            uniqueClients: 156,
            averageServiceValue: "KSh 1,950",
          },
        },
        {
          id: "2",
          title: "December 2023 Report",
          period: "December 1 - 31, 2023",
          generatedDate: "2024-01-01",
          kpis: {
            totalRevenue: "KSh 523,450",
            totalBookings: 267,
            uniqueClients: 178,
            averageServiceValue: "KSh 1,960",
          },
        },
      ]
      
      setReports(mockReports)
    } catch (error) {
      console.error("Error loading reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = () => {
    router.push("/(business)/dashboard/billing")
  }

  const handlePreviewReport = (report: Report) => {
    console.log("Preview report:", report.id)
    // TODO: Implement report preview
  }

  const handleDownloadReport = (report: Report) => {
    console.log("Download report:", report.id)
    // TODO: Implement PDF download
  }

  const handleGenerateNewReport = () => {
    console.log("Generate new report")
    // TODO: Implement report generation
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  if (!features.reports) {
    return (
      <VerificationGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
            <Text style={styles.title}>Reports</Text>
          </View>

          <View style={styles.lockedContainer}>
            <LockedFeature
              title="Business Reports"
              description="Detailed business reports are available on Pro and above"
              onPressUpgrade={handleUpgrade}
            />
          </View>
        </View>
      </VerificationGate>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Business Reports</Text>
        </View>

        {/* Generate New Report */}
        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={handleGenerateNewReport}
            style={[styles.generateButton, { backgroundColor: theme.colors.secondary }]}
            icon="file-plus"
          >
            Generate New Report
          </Button>
        </View>

        {/* Available Reports */}
        <Section title="Available Reports">
          <View style={styles.reportsContainer}>
            {reports.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No reports available</Text>
                <Text style={styles.emptySubtext}>Generate your first business report to get started</Text>
              </Surface>
            ) : (
              reports.map((report) => (
                <Surface key={report.id} style={styles.reportCard} elevation={2}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle}>{report.title}</Text>
                      <Text style={styles.reportPeriod}>{report.period}</Text>
                      <Text style={styles.reportDate}>Generated: {formatDate(report.generatedDate)}</Text>
                    </View>
                    <View style={styles.reportIcon}>
                      <Text style={styles.reportEmoji}>📊</Text>
                    </View>
                  </View>

                  <View style={styles.reportKpis}>
                    <Text style={styles.kpisTitle}>Key Performance Indicators</Text>
                    <View style={styles.kpisGrid}>
                      <View style={styles.kpiItem}>
                        <Text style={styles.kpiValue}>{report.kpis.totalRevenue}</Text>
                        <Text style={styles.kpiLabel}>Total Revenue</Text>
                      </View>
                      <View style={styles.kpiItem}>
                        <Text style={styles.kpiValue}>{report.kpis.totalBookings}</Text>
                        <Text style={styles.kpiLabel}>Total Bookings</Text>
                      </View>
                      <View style={styles.kpiItem}>
                        <Text style={styles.kpiValue}>{report.kpis.uniqueClients}</Text>
                        <Text style={styles.kpiLabel}>Unique Clients</Text>
                      </View>
                      <View style={styles.kpiItem}>
                        <Text style={styles.kpiValue}>{report.kpis.averageServiceValue}</Text>
                        <Text style={styles.kpiLabel}>Avg. Service Value</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.reportActions}>
                    <Button
                      mode="outlined"
                      onPress={() => handlePreviewReport(report)}
                      style={styles.actionButton}
                      icon="eye"
                      compact
                    >
                      Preview
                    </Button>
                    <Button
                      mode="contained"
                      onPress={() => handleDownloadReport(report)}
                      style={styles.actionButton}
                      icon="download"
                      compact
                    >
                      Download PDF
                    </Button>
                  </View>
                </Surface>
              ))
            )}
          </View>
        </Section>

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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
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
  lockedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  generateButton: {
    borderRadius: 25,
  },
  reportsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  reportPeriod: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  reportIcon: {
    marginLeft: 16,
  },
  reportEmoji: {
    fontSize: 32,
  },
  reportKpis: {
    marginBottom: 20,
  },
  kpisTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  kpisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 12,
    width: "47%",
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  reportActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 40,
  },
})