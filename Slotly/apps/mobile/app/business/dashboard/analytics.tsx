// apps/mobile/app/business/dashboard/analytics.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { View, ScrollView, StyleSheet, Dimensions, Platform } from "react-native"
import { Text, Surface, ActivityIndicator, IconButton, Button, useTheme, TextInput, Banner } from "react-native-paper"
import { useRouter } from "expo-router"
import { useTier } from "../../../context/TierContext"
import { useVerification } from "../../../context/VerificationContext"
import { VerificationGate } from "../../../components/VerificationGate"
import { LockedFeature } from "../../../components/LockedFeature"
import { KpiCard } from "../../../components/KpiCard"
import { Section } from "../../../components/Section"
import { FilterChipsRow } from "../../../components/FilterChipsRow"
import { useSession } from "../../../context/SessionContext"

// API
import { getAnalytics, getAnalyticsCsv } from "../../../lib/api/modules/manager"

// File export
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"

// Date pickers
import DateTimePicker from "@react-native-community/datetimepicker"

// Charts
import Svg from "react-native-svg"
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryGroup,
  VictoryLine,
  VictoryPie,
  VictoryLegend,
  VictoryLabel,
  VictoryTheme,
} from "victory-native";

// Types
interface ServiceData {
  name: string
  count: number
}

interface StaffPerformanceData {
  name: string
  performanceScore: number
}

interface AnalyticsData {
  revenue?: Record<string, number>
  bookings?: Record<string, number>
  clients?: number
  popularServices?: ServiceData[]
  staffPerformance?: StaffPerformanceData[]
  noShows?: Record<string, number>
}

interface AnalyticsResponse {
  analytics: AnalyticsData
  meta: {
    startDate: string
    endDate: string
    view: string
  }
  kpis?: {
    bookings: number
    revenue: number
    cancellations: number
    noShows: number
    avgTicket: number
  }
  series?: {
    byDay: Array<{
      date: string
      bookings: number
      revenue: number
    }>
    byService: Array<{
      serviceId: string | null
      name: string
      count: number
      revenue: number
    }>
  }
}

interface KpiData {
  label: string
  value: string
  caption: string
  icon: string
  color: string
}

interface ChartPoint {
  x: string
  y: number
}

interface PieDataPoint {
  x: string
  y: number
  label: string
}

interface GroupedBarData {
  x: string[]
  a: number[]
  b: number[]
}

// Constants
const screenW = Dimensions.get("window").width
const chartW = Math.min(screenW - 32, 720)

type PeriodKey = "7d" | "30d" | "90d"
type ViewKey = "DAILY" | "WEEKLY" | "MONTHLY"

const periodToDays = (period: PeriodKey): number => ({
  "7d": 7,
  "30d": 30,
  "90d": 90,
}[period])

// Utility functions
const fmtDate = (d?: Date | null): string | undefined => {
  if (!d) return undefined
  try {
    return d.toISOString().slice(0, 10)
  } catch (error) {
    console.warn('Invalid date provided to fmtDate:', d)
    return undefined
  }
}

const labelDate = (d?: Date | null): string => {
  if (!d) return "—"
  try {
    return d.toDateString()
  } catch (error) {
    console.warn('Invalid date provided to labelDate:', d)
    return "—"
  }
}

const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

export default function AnalyticsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { features } = useTier()
  const { isVerified } = useVerification()
  const { token } = useSession()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Using the new period-based API
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("30d")
  const [customDateRange, setCustomDateRange] = useState(false)
  
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [empty, setEmpty] = useState(false)
  const [lockedMsg, setLockedMsg] = useState<string | null>(null)

  // Cleanup date pickers on unmount
  useEffect(() => {
    return () => {
      setShowStartPicker(false)
      setShowEndPicker(false)
    }
  }, [])

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    setLockedMsg(null)
    
    try {
      let res: AnalyticsResponse
      
      if (customDateRange && startDate && endDate) {
        // Use legacy API with date range
        res = await getAnalytics({
          view: "monthly", // fallback view
          startDate: fmtDate(startDate),
          endDate: fmtDate(endDate),
          metrics: "bookings,revenue,clients,services,staffPerformance,noShows",
        })
      } else {
        // Use new period-based API (preferred)
        res = await getAnalytics(token, { 
          period: selectedPeriod, 
          tz: "Africa/Nairobi" 
        })
      }

      // The backend now returns both shapes - normalize for consistency
      let adapted: AnalyticsResponse
      if (res?.analytics) {
        // Current response shape
        adapted = res
      } else if (res?.kpis) {
        // Fallback - construct analytics from kpis/series
        const series = res.series || { byDay: [], byService: [] }
        const revenue: Record<string, number> = {}
        const bookings: Record<string, number> = {}
        
        series.byDay.forEach((item) => {
          if (item.date) {
            revenue[item.date] = item.revenue || 0
            bookings[item.date] = item.bookings || 0
          }
        })
        
        adapted = {
          analytics: {
            revenue,
            bookings,
            clients: res.kpis.bookings || 0,
            popularServices: series.byService.map((s) => ({
              name: s.name,
              count: s.count,
            })),
            staffPerformance: [],
            noShows: {},
          },
          meta: {
            startDate: fmtDate(startDate) || "",
            endDate: fmtDate(endDate) || "",
            view: customDateRange ? "custom" : selectedPeriod,
          },
          kpis: res.kpis,
          series: res.series,
        }
      } else {
        throw new Error("Unexpected response format")
      }

      setData(adapted)

      // Empty-state check
      const hasRevenue = Object.values(adapted.analytics.revenue || {}).some((v) => Number(v) > 0)
      const hasBookings = Object.values(adapted.analytics.bookings || {}).some((v) => Number(v) > 0)
      setEmpty(!(hasRevenue || hasBookings))
      
    } catch (e: unknown) {
      const status = (e as any)?.response?.status ?? (e as any)?.status
      const msg = (e as any)?.response?.data?.error || (e as any)?.message
      console.error("Error loading analytics:", e)

      if (status === 403 || status === 404) {
        setLockedMsg(
          status === 403
            ? ((e as any)?.response?.data?.suggestion
                ? `${(e as any)?.response?.data?.error} • ${(e as any)?.response?.data?.suggestion}`
                : "Analytics not available on your current plan.")
            : "No business found for your account."
        )
        setError(null)
      } else {
        const fallback = typeof msg === "string" && msg ? msg : "Failed to load analytics"
        setError(fallback)
      }

      // Render empty dataset
      setData({
        analytics: { revenue: {}, bookings: {}, clients: 0, popularServices: [], staffPerformance: [], noShows: {} },
        meta: { startDate: "", endDate: "", view: customDateRange ? "custom" : selectedPeriod },
      })
      setEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, customDateRange, startDate, endDate, token])

  useEffect(() => {
    if (features.analytics && isVerified) {
      loadAnalytics()
    }
  }, [features.analytics, isVerified, loadAnalytics])

  const periodOptions = [
    { key: "7d", label: "Last 7 Days" },
    { key: "30d", label: "Last 30 Days" },
    { key: "90d", label: "Last 90 Days" },
  ] as const

  // Helper functions for data transformation
  const dictToSeries = useCallback((d?: Record<string, number>): ChartPoint[] => {
    if (!d) return []
    return Object.keys(d)
      .sort()
      .map((k) => ({ x: k, y: isValidNumber(d[k]) ? d[k] : 0 }))
  }, [])

  const zipTwo = useCallback((
    dictA?: Record<string, number>,
    dictB?: Record<string, number>
  ): GroupedBarData => {
    const keysA = dictA ? Object.keys(dictA) : []
    const keysB = dictB ? Object.keys(dictB) : []
    const keys = Array.from(new Set([...keysA, ...keysB])).sort()
    
    return {
      x: keys,
      a: keys.map((k) => isValidNumber(dictA?.[k]) ? dictA[k] : 0),
      b: keys.map((k) => isValidNumber(dictB?.[k]) ? dictB[k] : 0),
    }
  }, [])

  const sumDict = useCallback((d?: Record<string, number>): number => {
    if (!d) return 0
    return Object.values(d).reduce((acc, val) => {
      return acc + (isValidNumber(val) ? val : 0)
    }, 0)
  }, [])

  const bookingsByWeekday = useCallback((bookings?: Record<string, number>): ChartPoint[] => {
    if (!bookings) return []
    
    const days = Array(7).fill(0) as number[]
    
    Object.entries(bookings).forEach(([bucket, count]) => {
      try {
        const date = new Date(bucket.length >= 10 ? bucket : bucket + "-01")
        if (!isNaN(date.getTime())) {
          const dow = date.getDay()
          if (dow >= 0 && dow <= 6 && isValidNumber(count)) {
            days[dow] += count
          }
        }
      } catch (error) {
        console.warn('Invalid date in bookings data:', bucket)
      }
    })
    
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return labels.map((label, i) => ({ x: label, y: days[i] }))
  }, [])

  // Derived data - prioritize KPIs from backend if available
  const kpis = useMemo((): KpiData[] => {
    const a = data?.analytics || {}
    const k = data?.kpis
    
    // Use backend KPIs if available, otherwise compute from analytics
    const totalRevenue = k?.revenue ?? sumDict(a.revenue)
    const totalBookings = k?.bookings ?? sumDict(a.bookings)
    const uniqueClients = isValidNumber(a.clients) ? a.clients : 0
    
    const topService = Array.isArray(a.popularServices) && a.popularServices.length > 0 
      ? a.popularServices[0] 
      : null

    return [
      {
        label: "Revenue",
        value: Intl.NumberFormat(undefined, { 
          style: "currency", 
          currency: "USD", 
          maximumFractionDigits: 0 
        }).format(totalRevenue / 100),
        caption: customDateRange ? "Custom Range" : `Last ${periodToDays(selectedPeriod)} days`,
        icon: "cash-multiple",
        color: "#1559C1",
      },
      {
        label: "Bookings",
        value: String(totalBookings),
        caption: customDateRange ? "Custom Range" : `Last ${periodToDays(selectedPeriod)} days`,
        icon: "calendar-check",
        color: "#0E7490",
      },
      {
        label: "Clients",
        value: String(uniqueClients),
        caption: customDateRange ? "Custom Range" : `Last ${periodToDays(selectedPeriod)} days`,
        icon: "account-group",
        color: "#A16207",
      },
      {
        label: "Top Service",
        value: topService ? topService.name : "—",
        caption: topService ? `${topService.count} bookings` : "",
        icon: "star-circle",
        color: "#7C3AED",
      },
    ]
  }, [data, selectedPeriod, customDateRange, sumDict])

  const groupBars = useMemo((): GroupedBarData => {
    const a = data?.analytics
    return zipTwo(a?.revenue, a?.bookings)
  }, [data, zipTwo])

  const pieData = useMemo((): PieDataPoint[] => {
    const list = data?.analytics?.popularServices || []
    const total = list.reduce((s, item) => {
      const count = isValidNumber(item?.count) ? item.count : 0
      return s + count
    }, 0)
    
    if (total === 0) return []
    
    return list.map((item): PieDataPoint => {
      const count = isValidNumber(item?.count) ? item.count : 0
      const percentage = Math.round((count / total) * 1000) / 10
      return {
        x: item.name || "Unknown",
        y: count,
        label: `${item.name || "Unknown"} ${percentage.toFixed(1)}%`,
      }
    })
  }, [data])

  const staffBars = useMemo((): ChartPoint[] => {
    const list = data?.analytics?.staffPerformance || []
    const validData = list.filter(s => s && typeof s.name === 'string' && isValidNumber(s.performanceScore))
    const sorted = [...validData].sort((a, b) => b.performanceScore - a.performanceScore)
    return sorted.map((s): ChartPoint => ({ 
      x: s.name || "Unknown", 
      y: s.performanceScore 
    }))
  }, [data])

  const weekdaySeries = useMemo((): ChartPoint[] => {
    return bookingsByWeekday(data?.analytics?.bookings)
  }, [data, bookingsByWeekday])

  // Event handlers
  const handleUpgrade = useCallback(() => {
    router.push("/business/dashboard/billing")
  }, [router])

  const handleExportCSV = useCallback(async () => {
    try {
      setLoading(true)
      
      if (!FileSystem.documentDirectory) {
        throw new Error('File system not available')
      }
      
      const params: any = {}
      
      if (customDateRange && startDate && endDate) {
        params.view = "monthly"
        params.startDate = fmtDate(startDate)
        params.endDate = fmtDate(endDate)
      } else {
        params.period = selectedPeriod
        params.tz = "Africa/Nairobi"
      }
      
      const csv = await getAnalyticsCsv(params)
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      const periodKey = customDateRange ? `${fmtDate(startDate)}_${fmtDate(endDate)}` : selectedPeriod
      const filename = `analytics_${periodKey}_${stamp}.csv`
      const fileUri = FileSystem.documentDirectory + filename

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { dialogTitle: "Export Analytics CSV" })
      } else {
        alert(`CSV saved to ${fileUri}`)
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to export CSV"
      console.error("CSV export failed:", e)
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, customDateRange, startDate, endDate])

  const handleGenerateReport = useCallback(() => {
    router.push("/business/dashboard/reports")
  }, [router])

  const handleDateRangeClear = useCallback(() => {
    setStartDate(null)
    setEndDate(null)
    setCustomDateRange(false)
  }, [])

  const handleStartDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowStartPicker(false)
    if (selectedDate) {
      setStartDate(selectedDate)
      setCustomDateRange(true)
    }
  }, [])

  const handleEndDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowEndPicker(false)
    if (selectedDate) {
      setEndDate(selectedDate)
      setCustomDateRange(true)
    }
  }, [])

  // Render locked state (feature flag or verification gate)
  if (!features.analytics || !isVerified) {
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
          <IconButton 
            icon="arrow-left" 
            size={24} 
            iconColor={theme.colors.onSurface} 
            onPress={() => router.back()} 
          />
          <Text style={styles.title}>Analytics</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Working…</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.error }]}>{error}</Text>
            <Button onPress={loadAnalytics} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            {lockedMsg && (
              <View style={{ paddingHorizontal: 16 }}>
                <Banner
                  visible
                  icon="lock"
                  style={{ marginBottom: 12, borderRadius: 12 }}
                >
                  {lockedMsg}
                </Banner>
              </View>
            )}

            {/* KPI Metrics */}
            <Section title="Key Metrics">
              <View style={styles.kpiGrid}>
                {kpis.map((kpi, i) => (
                  <View key={i} style={styles.kpiItem}>
                    <KpiCard kpi={kpi} />
                  </View>
                ))}
              </View>
            </Section>

            {/* Filters */}
            <Section title="Filters">
              <View style={styles.filtersContainer}>
                <Text style={styles.filterLabel}>Time Period</Text>
                <FilterChipsRow
                  options={periodOptions as unknown as { key: string; label: string }[]}
                  selectedKeys={[selectedPeriod] as unknown as string[]}
                  onSelectionChange={(v) => {
                    setSelectedPeriod(v[0] as PeriodKey)
                    setCustomDateRange(false)
                  }}
                  multiSelect={false}
                />

                <Text style={styles.filterLabel}>Custom Date Range (optional)</Text>
                <View style={{ gap: 8 }}>
                  <TextInput
                    mode="outlined"
                    label="Start date"
                    value={labelDate(startDate)}
                    right={<TextInput.Icon icon="calendar" onPress={() => setShowStartPicker(true)} />}
                    onFocus={() => setShowStartPicker(true)}
                    editable={false}
                  />
                  <TextInput
                    mode="outlined"
                    label="End date"
                    value={labelDate(endDate)}
                    right={<TextInput.Icon icon="calendar" onPress={() => setShowEndPicker(true)} />}
                    onFocus={() => setShowEndPicker(true)}
                    editable={false}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button mode="text" onPress={handleDateRangeClear}>
                      Clear
                    </Button>
                    <Button mode="outlined" onPress={loadAnalytics}>
                      Apply
                    </Button>
                  </View>
                </View>

                {/* Native date pickers */}
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={handleStartDateChange}
                  />
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={handleEndDateChange}
                  />
                )}

                <Button 
                  mode="contained" 
                  onPress={loadAnalytics} 
                  style={styles.updateButton} 
                  loading={loading}
                >
                  Update Charts
                </Button>
              </View>
            </Section>

            {/* Charts or Empty */}
            <Section title="Performance Charts">
              {empty ? (
                <Surface style={styles.chartContainer} elevation={1}>
                  <Text style={{ color: "#6B7280", marginBottom: 6 }}>No analytics yet.</Text>
                  <Text style={{ color: "#9CA3AF" }}>
                    You'll see charts here once you start getting bookings and revenue.
                  </Text>
                </Surface>
              ) : (
              <View style={styles.chartsContainer}>
                {/* Grouped Bar Chart */}
                <Surface style={styles.chartContainer} elevation={2}>
                  <Text style={styles.chartTitle}>Revenue & Bookings Trend</Text>
                  <Svg width={chartW} height={260}>
                    <VictoryChart
                      width={chartW}
                      height={260}
                      standalone={false}
                      theme={VictoryTheme.material}
                      domainPadding={{ x: 24, y: 12 }}
                    >
                      <VictoryLegend 
                        x={16} 
                        y={0} 
                        orientation="horizontal" 
                        gutter={20} 
                        data={[
                          { name: "Revenue", symbol: { type: "square" } },
                          { name: "Bookings", symbol: { type: "square" } },
                        ]}
                      />
                      <VictoryAxis 
                        tickFormat={(t: string) => String(t).slice(5)} 
                        style={{ 
                          tickLabels: { angle: -30, fontSize: 9, padding: 18 } 
                        }} 
                      />
                      <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}`} />
                      <VictoryGroup offset={10}>
                        <VictoryBar
                          data={groupBars.x.map((x, i) => ({ 
                            x, 
                            y: Math.round((groupBars.a[i] || 0) / 100) 
                          }))}
                          labels={({ datum }: { datum: ChartPoint }) => (datum.y ? `${datum.y}` : "")}
                          labelComponent={<VictoryLabel dy={-6} style={{ fontSize: 8 }} />}
                        />
                        <VictoryBar
                          data={groupBars.x.map((x, i) => ({ 
                            x, 
                            y: groupBars.b[i] || 0 
                          }))}
                          labels={({ datum }: { datum: ChartPoint }) => (datum.y ? `${datum.y}` : "")}
                          labelComponent={<VictoryLabel dy={-6} style={{ fontSize: 8 }} />}
                        />
                      </VictoryGroup>
                    </VictoryChart>
                  </Svg>
                </Surface>

                {/* Pie Chart */}
                <Surface style={styles.chartContainer} elevation={2}>
                  <Text style={styles.chartTitle}>Service Distribution</Text>
                  {pieData.length === 0 ? (
                    <Text style={{ color: "#6B7280" }}>No service activity yet.</Text>
                  ) : (
                    <Svg width={chartW} height={260}>
                      <VictoryPie
                        standalone={false}
                        width={chartW}
                        height={260}
                        data={pieData}
                        labels={({ datum }: { datum: PieDataPoint }) => datum.label}
                        labelPlacement="parallel"
                        labelRadius={(props) => typeof props.radius === "number" ? props.radius * 0.7 : 0}
                        padding={{ left: 30, right: 30, top: 10, bottom: 10 }}
                      />
                    </Svg>
                  )}
                </Surface>

                {/* Staff Performance Horizontal Bar Chart */}
                <Surface style={styles.chartContainer} elevation={2}>
                  <Text style={styles.chartTitle}>Staff Performance (Score)</Text>
                  <Svg width={chartW} height={260}>
                    <VictoryChart
                      width={chartW}
                      height={260}
                      standalone={false}
                      domainPadding={{ x: 20, y: 20 }}
                      theme={VictoryTheme.material}
                    >
                      <VictoryAxis dependentAxis tickFormat={(t: number) => `${t}%`} />
                      <VictoryAxis />
                      <VictoryBar
                        horizontal
                        data={staffBars}
                        labels={({ datum }: { datum: ChartPoint }) => `${datum.y}%`}
                        labelComponent={<VictoryLabel dx={-20} style={{ fontSize: 10 }} />}
                      />
                    </VictoryChart>
                  </Svg>
                </Surface>

                {/* Weekly Pattern Line Chart */}
                <Surface style={styles.chartContainer} elevation={2}>
                  <Text style={styles.chartTitle}>Weekly Pattern (Bookings by Day)</Text>
                  <Svg width={chartW} height={220}>
                    <VictoryChart
                      width={chartW}
                      height={220}
                      standalone={false}
                      theme={VictoryTheme.material}
                      domainPadding={{ x: 12, y: 10 }}
                    >
                      <VictoryAxis />
                      <VictoryAxis dependentAxis />
                      <VictoryLine
                        interpolation="monotoneX"
                        data={weekdaySeries}
                        labels={({ datum }: { datum: ChartPoint }) => (datum.y ? String(datum.y) : "")}
                        labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 9 }} />}
                      />
                    </VictoryChart>
                  </Svg>
                </Surface>
              </View>
              )}
            </Section>

            {/* Export & Reports Actions */}
            <Section title="Export & Reports">
              <View style={styles.actionsContainer}>
                <Button 
                  mode="outlined" 
                  onPress={handleExportCSV} 
                  style={styles.actionButton} 
                  icon="download"
                >
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