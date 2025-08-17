export type BusinessTier = "level1" | "level2" | "level3" | "level4" | "level5" | "level6"

export interface TierFeatures {
  analytics: boolean
  multiStaff: boolean
  multiLocation: boolean
  reports: boolean
  advancedBooking: boolean
}

export interface Staff {
  id: string
  name: string
  role: string
  completionRate: number
  rating: number
  monthBookings: number
  monthRevenue: number
  services: string[]
  avatar?: string
  email?: string
  phone?: string
}

export interface Service {
  id: string
  name: string
  price: number
  durationMins: number
  category: "hair" | "spa" | "nails"
  description?: string
  assignedStaffIds: string[]
  emoji?: string
}

export interface Bundle {
  id: string
  name: string
  price: number
  durationMins: number
  services: string[]
  savingsPct?: number
  emoji?: string
}

export type BookingStatus = "CONFIRMED" | "PENDING" | "CANCELLED" | "COMPLETED" | "NO_SHOW"

export interface Booking {
  id: string
  client: {
    name: string
    phone: string
  }
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  dateISO: string
  timeISO: string
  status: BookingStatus
  price: number
  notes?: string
}

export type StaffApplicationStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface StaffApplication {
  id: string
  name: string
  email: string
  phone: string
  role: string
  experience: string
  skills: string[]
  appliedDate: string
  status: StaffApplicationStatus
  avatar?: string
}

export interface PerformanceData {
  kpis: {
    label: string
    value: string
    change?: number
    period?: string
  }[]
  charts?: {
    revenue?: { date: string; amount: number }[]
    bookings?: { date: string; count: number }[]
  }
}
// Display KPI used by KpiCard and analytics tiles
export type KPI = {
  label: string;
  value: string | number;
  change?: number;     // positive/negative deltas
  period?: string;     // e.g., "vs last month"
};

export interface Coupon {
  id: string
  name: string
  description: string
  discount: string
  used: number
  expires: string
  status: "ACTIVE" | "EXPIRED" | "EXPIRING"
  maxUses?: number
}

export interface BusinessProfile {
  id: string
  name: string
  type: string
  phone: string
  email: string
  description: string
  address: string
  hours: {
    [key: string]: {
      open: boolean
      start: string
      end: string
    }
  }
}

export interface PayoutSettings {
  mpesaNumber?: string
  flutterwaveSubaccountId?: string
  status: "VERIFIED" | "PENDING" | "REJECTED"
  schedule: string
}
