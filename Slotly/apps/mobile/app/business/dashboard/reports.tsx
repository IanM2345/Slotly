"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Platform, Alert } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useTier } from "../../../context/TierContext";
import { VerificationGate } from "../../../components/VerificationGate";
import { LockedFeature } from "../../../components/LockedFeature";
import { Section } from "../../../components/Section";

// API modules (wired to your backend)
import {
  listReports,         // GET /api/manager/reports → { reports }
  previewReport,       // GET /api/manager/reports/[id] → PDF bytes
  getAnalytics,        // GET /api/manager/analytics (JSON KPIs)
  getAnalyticsCsv,     // GET /api/manager/analytics?export=csv (CSV text)
} from "../../../lib/api/modules/manager";

type BackendReport = {
  id: string;
  businessId: string;
  period: string;     // e.g. "2025-01" (month key) or similar
  fileUrl?: string | null;
  createdAt: string;  // ISO
};

type ReportCard = BackendReport & {
  // enriched KPIs (best-effort)
  kpis?: {
    totalBookings?: number | string;
    totalRevenue?: number | string;
    uniqueClients?: number | string;
    showRate?: number | string;
  };
};

export default function ReportsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { features } = useTier();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportCard[]>([]);

  useEffect(() => {
    if (features.reports) {
      loadReports();
    }
  }, [features.reports]);

  async function loadReports() {
    setLoading(true);
    try {
      // 1) Fetch available reports (owner-scoped, plan-gated)
      const { reports: rows } = await listReports({});
      const list: BackendReport[] = Array.isArray(rows) ? rows : [];

      // 2) Enrich with KPIs from analytics (best-effort)
      const enriched = await Promise.all(
        list.map(async (r) => {
          const range = periodToRange(r.period);
          if (!range) return r as ReportCard;

          try {
            const analytics = await getAnalytics({
              startDate: range.start.toISOString(),
              endDate: range.end.toISOString(),
              // metrics is optional; backend may ignore it
              metrics: "totalBookings,totalRevenue,uniqueClients,showRate",
              view: "monthly",
            });
            const kpis = extractKpis(analytics);
            return { ...r, kpis };
          } catch {
            return { ...r, kpis: undefined };
          }
        })
      );

      setReports(enriched);
    } catch (err: any) {
      console.error("Error loading reports:", err);
      Alert.alert("Error", err?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  const handleUpgrade = () => {
    router.push("/business/dashboard/billing" as any)
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
              onPressUpgrade={() => router.push("/business/dashboard/billing")}
            />
          </View>
        </View>
      </VerificationGate>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading reports…</Text>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Business Reports</Text>
        </View>

        <Section title="Available Reports">
          <View style={styles.reportsContainer}>
            {cards.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No reports available</Text>
                <Text style={styles.emptySubtext}>Generate your first business report to get started</Text>
              </Surface>
            ) : (
              cards.map((r) => (
                <Surface key={r.id} style={styles.reportCard} elevation={2}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle}>
                        {periodToRange(r.period)?.text ?? r.period} Business Report
                      </Text>
                      <Text style={styles.reportDate}>Generated: {formatDate(r.createdAt)}</Text>
                    </View>
                    <View style={styles.reportIcon}>
                      <Text style={styles.reportEmoji}>📊</Text>
                    </View>
                  </View>

                  <View style={styles.kpisGrid}>
                    <View style={styles.kpiItem}>
                      <Text style={styles.kpiValue}>{r.kpis?.totalBookings ?? "—"}</Text>
                      <Text style={styles.kpiLabel}>Total Bookings</Text>
                    </View>
                    <View style={styles.kpiItem}>
                      <Text style={styles.kpiValue}>{r.kpis?.totalRevenue ?? "—"}</Text>
                      <Text style={styles.kpiLabel}>Revenue</Text>
                    </View>
                    <View style={styles.kpiItem}>
                      <Text style={styles.kpiValue}>{r.kpis?.uniqueClients ?? "—"}</Text>
                      <Text style={styles.kpiLabel}>Unique Clients</Text>
                    </View>
                    <View style={styles.kpiItem}>
                      <Text style={styles.kpiValue}>{r.kpis?.showRate ?? "—"}</Text>
                      <Text style={styles.kpiLabel}>Show Rate</Text>
                    </View>
                  </View>

                  <View style={styles.reportActions}>
                    <Button
                      mode="outlined"
                      icon="eye"
                      compact
                      style={styles.actionButton}
                      onPress={() => handlePreviewPDF(r)}
                    >
                      Preview
                    </Button>
                    <Button
                      mode="contained"
                      icon="download"
                      compact
                      style={styles.actionButton}
                      onPress={() => handleDownloadPDF(r)}
                    >
                      Download PDF
                    </Button>
                    <Button
                      mode="text"
                      icon="file-delimited"
                      compact
                      style={styles.actionButton}
                      onPress={() => handleDownloadCSV(r)}
                    >
                      CSV
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
  );
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