export interface StaffRegistration {
  businessId: string
  fullName: string
  address: string
  email: string
  phone: string
  nationalId: string
  nationalIdPhoto?: string
  selfiePhoto?: string
}

export interface StaffProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUri?: string
}

export interface AvailabilitySlot {
  day: string
  startTime: string
  endTime: string
  enabled: boolean
}

export interface TimeOffRequest {
  id: string
  fromDate: string
  toDate: string
  reason: string
  status: "pending" | "approved" | "rejected"
}

export interface Notification {
  id: string
  title: string
  time: string
  read: boolean
}

export interface PerformanceMetrics {
  completedBookings: number
  cancellations: number
  averageRating: number
  commissionEarned: number
}

export interface Appointment {
  id: string
  time: string
  clientName: string
  service: string
  duration: string
  status: "confirmed" | "pending" | "completed" | "cancelled"
}

/* -----------------------------
   Added for dashboard/api.ts
   ----------------------------- */

export interface DashboardMetrics {
  bookingsToday: number
  revenueTodayKES: number
  cancellationsToday: number
  noShowsToday: number
  bookingsChangePct: number    // e.g. +12 => +12%
  revenueChangePct: number     // e.g. +8  => +8%
  cancellationsDelta: number   // e.g. +2  => +2 from yesterday
  noShowsDelta: number         // e.g. -1  => -1 from yesterday
}

export type BookingPreview = {
  id: string
  time: string     // "10:00 AM"
  service: string  // "Massage"
  customer: string // "Jane Doe"
}
