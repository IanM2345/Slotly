import type { BookingPreview, DashboardMetrics } from "./types"
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const dashboardApi = {
  async getMetrics(): Promise<DashboardMetrics> {
    await wait(120)
    return {
      bookingsToday: 127,
      revenueTodayKES: 45200,
      cancellationsToday: 3,
      noShowsToday: 1,
      bookingsChangePct: 12,
      revenueChangePct: 8,
      cancellationsDelta: 2,
      noShowsDelta: -1,
    }
  },

  async getUpcoming(limit = 5): Promise<BookingPreview[]> {
    await wait(120)
    return [
      { id: "b1", time: "10:00 AM", service: "Hair Cut", customer: "Jane Doe" },
      { id: "b2", time: "10:30 AM", service: "Massage", customer: "John Smith" },
      { id: "b3", time: "11:00 AM", service: "Manicure", customer: "Emma Davis" },
      { id: "b4", time: "01:30 PM", service: "Facial", customer: "Mike Chen" },
      { id: "b5", time: "03:00 PM", service: "Deep Tissue", customer: "Sarah Johnson" },
    ].slice(0, limit)
  },
}
