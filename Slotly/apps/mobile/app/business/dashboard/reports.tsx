"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  Banner,
  useTheme,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";

import { useSession } from "../../../context/SessionContext";
import { useTier } from "../../../context/TierContext";
import { VerificationGate } from "../../../components/VerificationGate";
import { LockedFeature } from "../../../components/LockedFeature";
import { Section } from "../../../components/Section";

// API modules (wired to your backend)
import {
  listReports,         // GET /api/manager/reports → { reports }
  previewReport,       // GET /api/manager/reports/[id] → PDF bytes
  downloadEmptyReport, // GET /api/manager/reports?empty=1 → blank PDF
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
  const { user } = useSession();
  const { features, tier } = useTier();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [lockedMsg, setLockedMsg] = useState<string|null>(null);
  const [reports, setReports] = useState<ReportCard[]>([]);

  // Mirror server: reports available on LEVEL_3+ (tier >= 3)
  const canAccessReports = useMemo(() => {
    const numericTier = typeof tier === 'string' ? parseInt(tier, 10) : (tier ?? 1);
    return numericTier >= 3 && features.reports;
  }, [tier, features.reports]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLockedMsg(null);

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
      const msg = err?.response?.status === 403
        ? "Your plan does not include Reports. Upgrade to unlock."
        : (err?.message || "Failed to load reports");
      
      if (err?.response?.status === 403) {
        setLockedMsg(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccessReports) {
      loadReports();
    } else {
      setLoading(false);
    }
  }, [canAccessReports, loadReports]);

  function periodToRange(period?: string) {
    if (!period) return null;
    // supports "YYYY-MM"
    const [y, m] = period.split("-").map((v) => parseInt(v, 10));
    if (!y || !m) return null;
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const text = start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return { start, end, text };
  }

  function extractKpis(analytics: any) {
    // Shape your analytics response into 4 headline figures
    // Fallbacks ensure safe rendering even if metrics are missing.
    const a = analytics || {};
    return {
      totalBookings: a?.kpis?.totalBookings ?? a?.analytics?.bookingsTotal ?? "—",
      totalRevenue:  a?.kpis?.totalRevenue  ?? a?.analytics?.revenueTotal  ?? "—",
      uniqueClients: a?.kpis?.uniqueClients ?? a?.analytics?.clients       ?? "—",
      showRate:      a?.kpis?.showRate      ?? "—",
    };
  }

  const handleDownload = useCallback(async (report: ReportCard) => {
    try {
      setLoading(true);
      let pdfBytes;

      if (report.fileUrl) {
        // Preferred path: if the backend stored a fileUrl, try to download directly first
        try {
          await WebBrowser.openBrowserAsync(report.fileUrl);
          return;
        } catch {
          // Fallback to API download
          pdfBytes = await previewReport({ reportId: report.id });
        }
      } else {
        // Get PDF bytes from API
        pdfBytes = await previewReport({ reportId: report.id });
      }

      const fileUri = FileSystem.documentDirectory + `slotly-report-${report.period}.pdf`;
      
      // Convert ArrayBuffer to base64 string
      const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { dialogTitle: "Share report PDF" });
      } else {
        Alert.alert("Success", `Saved to ${fileUri}`);
      }
    } catch (e: any) {
      console.error("Download error:", e);
      Alert.alert("Download failed", e?.message || "Could not download PDF");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownloadEmpty = useCallback(async () => {
    try {
      setLoading(true);
      const bytes = await downloadEmptyReport();
      const fileUri = FileSystem.documentDirectory + `slotly-report-empty.pdf`;
      
      // Convert ArrayBuffer to base64 string
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { dialogTitle: "Share report PDF" });
      } else {
        Alert.alert("Success", `Saved to ${fileUri}`);
      }
    } catch (e: any) {
      console.error("Empty download error:", e);
      Alert.alert("Download failed", e?.message || "Could not download empty report");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownloadCSV = useCallback(async (report: ReportCard) => {
    try {
      setLoading(true);
      const range = periodToRange(report.period);
      if (!range) {
        Alert.alert("Error", "Invalid period");
        return;
      }
      
      const csv = await getAnalyticsCsv({
        view: "daily",
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        metrics: "bookings,revenue,clients,noShows",
      });
      
      const dest = FileSystem.documentDirectory + `Business-Report-${report.period}.csv`;
      await FileSystem.writeAsStringAsync(dest, csv, { 
        encoding: FileSystem.EncodingType.UTF8 
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, { dialogTitle: "Share CSV" });
      } else {
        Alert.alert("Success", `Saved to ${dest}`);
      }
    } catch (e: any) {
      console.error("CSV export error:", e);
      Alert.alert("Export failed", e?.message || "Could not export CSV");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpgrade = useCallback(() => {
    router.push("/business/dashboard/billing");
  }, [router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!canAccessReports) {
    return (
      <VerificationGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton 
              icon="arrow-left" 
              size={24} 
              iconColor={theme.colors.onSurface} 
              onPress={() => router.back()} 
            />
            <Text style={styles.title}>Reports</Text>
          </View>

          <View style={styles.lockedContainer}>
            <LockedFeature
              title="Business Reports"
              description="Reports are available on Pro (Level 3) and above."
              onPressUpgrade={handleUpgrade}
            />
          </View>
        </View>
      </VerificationGate>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={24} 
            iconColor={theme.colors.onSurface} 
            onPress={() => router.back()} 
          />
          <Text style={styles.title}>Business Reports</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Working…</Text>
          </View>
        ) : error && !lockedMsg ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            <Button onPress={loadReports} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            {lockedMsg && (
              <View style={styles.bannerContainer}>
                <Banner visible icon="lock" style={styles.banner}>
                  {lockedMsg}{" "}
                  <Text 
                    onPress={handleUpgrade} 
                    style={{ color: theme.colors.primary }}
                  >
                    Upgrade
                  </Text>
                </Banner>
              </View>
            )}

            <Section title="Available Reports">
              <View style={styles.reportsContainer}>
                {reports.length === 0 ? (
                  <Surface style={styles.emptyState} elevation={1}>
                    <Text style={styles.emptyText}>No reports yet for your selected period.</Text>
                    <Button 
                      mode="contained" 
                      onPress={handleDownloadEmpty} 
                      style={styles.emptyButton} 
                      icon="download"
                    >
                      Download Empty Report
                    </Button>
                  </Surface>
                ) : (
                  reports.map((r) => (
                    <Surface key={r.id} style={styles.reportCard} elevation={2}>
                      <View style={styles.reportHeader}>
                        <View style={styles.reportInfo}>
                          <Text style={styles.reportTitle}>
                            {periodToRange(r.period)?.text ?? r.period} Business Report
                          </Text>
                          <Text style={styles.reportDate}>
                            Generated: {formatDate(r.createdAt)}
                          </Text>
                        </View>
                        <View style={styles.reportIcon}>
                          <Text style={styles.reportEmoji}>📊</Text>
                        </View>
                      </View>

                      <View style={styles.kpisGrid}>
                        <View style={styles.kpiItem}>
                          <Text style={styles.kpiValue}>
                            {r.kpis?.totalBookings ?? "—"}
                          </Text>
                          <Text style={styles.kpiLabel}>Total Bookings</Text>
                        </View>
                        <View style={styles.kpiItem}>
                          <Text style={styles.kpiValue}>
                            {r.kpis?.totalRevenue ?? "—"}
                          </Text>
                          <Text style={styles.kpiLabel}>Revenue</Text>
                        </View>
                        <View style={styles.kpiItem}>
                          <Text style={styles.kpiValue}>
                            {r.kpis?.uniqueClients ?? "—"}
                          </Text>
                          <Text style={styles.kpiLabel}>Unique Clients</Text>
                        </View>
                        <View style={styles.kpiItem}>
                          <Text style={styles.kpiValue}>
                            {r.kpis?.showRate ?? "—"}
                          </Text>
                          <Text style={styles.kpiLabel}>Show Rate</Text>
                        </View>
                      </View>

                      <View style={styles.reportActions}>
                        <Button
                          mode="outlined"
                          icon="download"
                          compact
                          style={styles.actionButton}
                          onPress={() => handleDownload(r)}
                        >
                          Download
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
          </>
        )}

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
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 12,
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
  bannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  banner: {
    marginBottom: 12,
  },
  reportsContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 12,
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
  kpisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
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
});