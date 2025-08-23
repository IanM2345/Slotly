export interface StaffRegistration {
  businessId: string
  fullName: string
  address: string
  email: string
  phone: string
  nationalId: string
  nationalIdPhoto?: string | null;
  selfiePhoto?: string | null;
}

export interface StaffProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUri?: string
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface WeeklyAvailability {
  [key: string]: {
    enabled: boolean
    startTime: string
    endTime: string
  }
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
  isRead: boolean
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
