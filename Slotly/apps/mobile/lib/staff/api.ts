import type {
  StaffRegistration,
  StaffProfile,
  PasswordChange,
  WeeklyAvailability,
  TimeOffRequest,
  Notification,
  PerformanceMetrics,
  Appointment,
} from "./types"

// Mock API functions - replace with real API calls
export const staffApi = {
  // Registration
  async registerStaff(data: StaffRegistration): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return { success: true, message: "Registration submitted successfully" }
  },

  // Profile
  async getProfile(): Promise<StaffProfile> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      id: "1",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "+254712345678",
      avatarUri: undefined,
    }
  },

  async updateProfile(profile: Partial<StaffProfile>): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { success: true, message: "Profile updated successfully" }
  },

  async changePassword(data: PasswordChange): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (data.newPassword !== data.confirmPassword) {
      throw new Error("Passwords do not match")
    }
    return { success: true, message: "Password changed successfully" }
  },

  // Availability
  async getAvailability(): Promise<WeeklyAvailability> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      monday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      tuesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      wednesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      thursday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      friday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      saturday: { enabled: true, startTime: "09:00", endTime: "17:00" },
      sunday: { enabled: false, startTime: "09:00", endTime: "17:00" },
    }
  },

  async saveAvailability(availability: WeeklyAvailability): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { success: true, message: "Availability updated successfully" }
  },

  async requestTimeOff(request: Omit<TimeOffRequest, "id" | "status">): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { success: true, message: "Time-off request submitted" }
  },

  async getTimeOffRequests(): Promise<TimeOffRequest[]> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return [
      { id: "1", fromDate: "2024-02-15", toDate: "2024-02-16", reason: "Personal", status: "pending" },
      { id: "2", fromDate: "2024-01-20", toDate: "2024-01-22", reason: "Vacation", status: "approved" },
    ]
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return [
      { id: "1", title: "New booking assigned", time: "2 hours ago", isRead: false },
      { id: "2", title: "Schedule updated", time: "1 day ago", isRead: false },
      { id: "3", title: "Payment processed", time: "2 days ago", isRead: true },
    ]
  },

  async markNotificationRead(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
  },

  async markAllRead(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500))
  },

  // Performance
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      completedBookings: 47,
      cancellations: 3,
      averageRating: 4.8,
      commissionEarned: 12450,
    }
  },

  // Schedule
  async getSchedule(filters?: { status?: string; date?: string }): Promise<Appointment[]> {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return [
      {
        id: "1",
        time: "09:00 AM",
        clientName: "Sarah Johnson",
        service: "Deep Tissue Massage",
        duration: "60 min",
        status: "confirmed",
      },
      {
        id: "2",
        time: "11:00 AM",
        clientName: "Mike Chen",
        service: "Facial Treatment",
        duration: "45 min",
        status: "pending",
      },
      {
        id: "3",
        time: "02:00 PM",
        clientName: "Emma Davis",
        service: "Manicure",
        duration: "30 min",
        status: "completed",
      },
      {
        id: "4",
        time: "04:00 PM",
        clientName: "James Wilson",
        service: "Hair Cut",
        duration: "45 min",
        status: "confirmed",
      },
    ]
  },
}
