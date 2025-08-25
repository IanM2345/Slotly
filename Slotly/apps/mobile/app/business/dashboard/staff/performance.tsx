"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet, Dimensions } from "react-native"
import { Text, Surface, TextInput, useTheme, IconButton, Button } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import { useToast } from "./_layout"
import { staffApi } from "../../../../../mobile/lib/api/modules/staff"
import type { PerformanceMetrics } from "../../../../lib/staff/types"
import Svg, { Line, Circle, Rect, Text as SvgText, Path } from 'react-native-svg'

const { width } = Dimensions.get('window')

// Sample data structure - you'll replace this with real API data
interface ChartDataPoint {
  date: string
  bookings: number
  earnings: number
  rating: number
  cancellations: number
}

export default function StaffPerformanceScreen() {
  const { businessId: businessIdParam } = useLocalSearchParams<{ businessId?: string }>();
  const businessId = typeof businessIdParam === "string" ? businessIdParam : undefined;
  
  const theme = useTheme()
  const { notify } = useToast()

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    completedBookings: 0,
    cancellations: 0,
    averageRating: 0,
    commissionEarned: 0,
  })

  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [loading, setLoading] = useState(false)

  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  })

  useEffect(() => {
    loadMetrics()
    loadChartData()
  }, [businessId])

  const loadMetrics = async () => {
    try {
      const data = await staffApi.getPerformanceMetrics({ businessId })
      setMetrics(data)
    } catch (error) {
      notify("Failed to load performance data")
    }
  }

  const loadChartData = async () => {
    setLoading(true)
    try {
      // Replace this with actual API call to get chart data
      // const data = await staffApi.getPerformanceChartData({ businessId, from: dateRange.from, to: dateRange.to })
      
      // Sample data for demonstration
      const sampleData: ChartDataPoint[] = [
        { date: 'Jan', bookings: 12, earnings: 15000, rating: 4.2, cancellations: 2 },
        { date: 'Feb', bookings: 18, earnings: 22500, rating: 4.5, cancellations: 1 },
        { date: 'Mar', bookings: 15, earnings: 18750, rating: 4.3, cancellations: 3 },
        { date: 'Apr', bookings: 22, earnings: 27500, rating: 4.7, cancellations: 2 },
        { date: 'May', bookings: 25, earnings: 31250, rating: 4.6, cancellations: 1 },
        { date: 'Jun', bookings: 20, earnings: 25000, rating: 4.4, cancellations: 4 },
        { date: 'Jul', bookings: 28, earnings: 35000, rating: 4.8, cancellations: 2 },
        { date: 'Aug', bookings: 24, earnings: 30000, rating: 4.5, cancellations: 3 },
      ]
      
      setChartData(sampleData)
    } catch (error) {
      notify("Failed to load chart data")
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeUpdate = () => {
    if (dateRange.from && dateRange.to) {
      loadChartData()
    } else {
      notify("Please select both start and end dates")
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

  // Simple SVG Chart Component
  const SimpleChart = ({ data, type }: { data: ChartDataPoint[], type: 'line' | 'bar' }) => {
    if (!data || data.length === 0) return null

    const chartWidth = width - 80
    const chartHeight = 200
    const padding = 40

    const maxBookings = Math.max(...data.map(d => d.bookings))
    const maxRating = 5 // Rating is always out of 5
    const maxCancellations = Math.max(...data.map(d => d.cancellations))

    const getX = (index: number) => (index * (chartWidth - padding * 2)) / (data.length - 1) + padding
    const getBookingsY = (value: number) => chartHeight - padding - ((value / maxBookings) * (chartHeight - padding * 2))
    const getRatingY = (value: number) => chartHeight - padding - ((value / maxRating) * (chartHeight - padding * 2))
    const getCancellationsY = (value: number) => chartHeight - padding - ((value / maxCancellations) * (chartHeight - padding * 2))

    if (type === 'line') {
      // Create path for bookings line
      const bookingsPath = data.map((point, index) => {
        const x = getX(index)
        const y = getBookingsY(point.bookings)
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      }).join(' ')

      // Create path for rating line
      const ratingsPath = data.map((point, index) => {
        const x = getX(index)
        const y = getRatingY(point.rating)
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      }).join(' ')

      return (
        <View style={styles.chartContainer}>
          <Svg width={chartWidth} height={chartHeight}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(percent => {
              const y = chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)
              return (
                <Line
                  key={percent}
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke={theme.colors.outline}
                  strokeOpacity={0.2}
                  strokeDasharray="2,2"
                />
              )
            })}

            {/* Bookings Line */}
            <Path
              d={bookingsPath}
              stroke="#4CAF50"
              strokeWidth={3}
              fill="none"
            />

            {/* Rating Line */}
            <Path
              d={ratingsPath}
              stroke="#FFC107"
              strokeWidth={3}
              fill="none"
            />

            {/* Data points */}
            {data.map((point, index) => (
              <View key={index}>
                {/* Bookings points */}
                <Circle
                  cx={getX(index)}
                  cy={getBookingsY(point.bookings)}
                  r={4}
                  fill="#4CAF50"
                />
                {/* Rating points */}
                <Circle
                  cx={getX(index)}
                  cy={getRatingY(point.rating)}
                  r={4}
                  fill="#FFC107"
                />
              </View>
            ))}

            {/* X-axis labels */}
            {data.map((point, index) => (
              <SvgText
                key={index}
                x={getX(index)}
                y={chartHeight - 10}
                fontSize="12"
                fill={theme.colors.onSurfaceVariant}
                textAnchor="middle"
              >
                {point.date}
              </SvgText>
            ))}
          </Svg>

          {/* Legend */}
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Bookings
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FFC107' }]} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Rating
              </Text>
            </View>
          </View>
        </View>
      )
    }

    // Bar Chart
    const barWidth = (chartWidth - padding * 2) / data.length * 0.7

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => {
            const y = chartHeight - padding - (percent / 100) * (chartHeight - padding * 2)
            return (
              <Line
                key={percent}
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke={theme.colors.outline}
                strokeOpacity={0.2}
                strokeDasharray="2,2"
              />
            )
          })}

          {/* Bars */}
          {data.map((point, index) => {
            const x = getX(index) - barWidth / 4
            const bookingsHeight = (point.bookings / maxBookings) * (chartHeight - padding * 2)
            const cancellationsHeight = (point.cancellations / maxCancellations) * (chartHeight - padding * 2)

            return (
              <View key={index}>
                {/* Bookings Bar */}
                <Rect
                  x={x - barWidth / 4}
                  y={chartHeight - padding - bookingsHeight}
                  width={barWidth / 2 - 2}
                  height={bookingsHeight}
                  fill="#4CAF50"
                  rx={2}
                />
                {/* Cancellations Bar */}
                <Rect
                  x={x + barWidth / 4}
                  y={chartHeight - padding - cancellationsHeight}
                  width={barWidth / 2 - 2}
                  height={cancellationsHeight}
                  fill="#F44336"
                  rx={2}
                />
              </View>
            )
          })}

          {/* X-axis labels */}
          {data.map((point, index) => (
            <SvgText
              key={index}
              x={getX(index)}
              y={chartHeight - 10}
              fontSize="12"
              fill={theme.colors.onSurfaceVariant}
              textAnchor="middle"
            >
              {point.date}
            </SvgText>
          ))}
        </Svg>

        {/* Legend */}
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Bookings
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Cancellations
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const renderChart = () => {
    if (loading) {
      return (
        <Surface style={styles.chartPlaceholder} elevation={0}>
          <IconButton icon="loading" size={32} iconColor={theme.colors.onSurfaceVariant} />
          <Text variant="bodyLarge" style={[styles.chartText, { color: theme.colors.onSurfaceVariant }]}>
            Loading chart data...
          </Text>
        </Surface>
      )
    }

    if (chartData.length === 0) {
      return (
        <Surface style={styles.chartPlaceholder} elevation={0}>
          <IconButton icon="chart-line" size={32} iconColor={theme.colors.onSurfaceVariant} />
          <Text variant="bodyLarge" style={[styles.chartText, { color: theme.colors.onSurfaceVariant }]}>
            No data available for selected period
          </Text>
        </Surface>
      )
    }

    return <SimpleChart data={chartData} type={chartType} />
  }

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
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              Performance Trends
            </Text>
            
            {/* Chart Type Toggle */}
            <View style={styles.chartToggle}>
              <IconButton
                icon="chart-line"
                size={20}
                iconColor={chartType === 'line' ? theme.colors.primary : theme.colors.onSurfaceVariant}
                style={[styles.toggleButton, chartType === 'line' && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setChartType('line')}
              />
              <IconButton
                icon="chart-bar"
                size={20}
                iconColor={chartType === 'bar' ? theme.colors.primary : theme.colors.onSurfaceVariant}
                style={[styles.toggleButton, chartType === 'bar' && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setChartType('bar')}
              />
            </View>
          </View>

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

          <Button 
            mode="contained" 
            onPress={handleDateRangeUpdate}
            style={styles.updateButton}
            disabled={loading}
          >
            Update Chart
          </Button>

          {/* Chart */}
          {renderChart()}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: "600",
    flex: 1,
  },
  chartToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    margin: 0,
    borderRadius: 6,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dateInput: {
    flex: 1,
  },
  toText: {
    marginHorizontal: 16,
  },
  updateButton: {
    marginBottom: 24,
  },
  chartContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  chartPlaceholder: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  chartText: {
    textAlign: "center",
    marginTop: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
})