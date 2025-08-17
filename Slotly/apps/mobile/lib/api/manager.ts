import type {
  Staff,
  Service,
  Bundle,
  Booking,
  BookingStatus,
  StaffApplication,
  StaffApplicationStatus,
  PerformanceData,
  Coupon,
  BusinessProfile,
  PayoutSettings,
} from "../types"

// Mock data
const mockStaff: Staff[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    role: "Senior Stylist",
    completionRate: 95,
    rating: 4.8,
    monthBookings: 45,
    monthRevenue: 67500,
    services: ["Hair Cut", "Hair Color", "Styling"],
    email: "sarah@slotly.com",
    phone: "+254 712 345 678",
  },
  {
    id: "2",
    name: "Mike Chen",
    role: "Barber",
    completionRate: 92,
    rating: 4.6,
    monthBookings: 38,
    monthRevenue: 45600,
    services: ["Men's Cut", "Beard Trim", "Shave"],
    email: "mike@slotly.com",
    phone: "+254 723 456 789",
  },
  {
    id: "3",
    name: "Emma Wilson",
    role: "Nail Technician",
    completionRate: 98,
    rating: 4.9,
    monthBookings: 52,
    monthRevenue: 78000,
    services: ["Manicure", "Pedicure", "Nail Art"],
    email: "emma@slotly.com",
    phone: "+254 734 567 890",
  },
]

const mockServices: Service[] = [
  {
    id: "1",
    name: "Hair Cut & Style",
    price: 1500,
    durationMins: 60,
    category: "hair",
    description: "Professional haircut with styling",
    assignedStaffIds: ["1"],
    emoji: "✂️",
  },
  {
    id: "2",
    name: "Manicure",
    price: 800,
    durationMins: 45,
    category: "nails",
    description: "Classic manicure with polish",
    assignedStaffIds: ["3"],
    emoji: "💅",
  },
  {
    id: "3",
    name: "Relaxing Massage",
    price: 2500,
    durationMins: 90,
    category: "spa",
    description: "Full body relaxing massage",
    assignedStaffIds: ["2"],
    emoji: "💆",
  },
]

const mockBundles: Bundle[] = [
  {
    id: "1",
    name: "Pamper Package",
    price: 3500,
    durationMins: 150,
    services: ["Hair Cut & Style", "Manicure"],
    savingsPct: 15,
    emoji: "✨",
  },
]

const mockBookings: Booking[] = [
  {
    id: "1",
    client: { name: "Alice Brown", phone: "+254 712 345 678" },
    serviceId: "1",
    serviceName: "Hair Cut & Style",
    staffId: "1",
    staffName: "Sarah Johnson",
    dateISO: "2024-01-16",
    timeISO: "10:00",
    status: "CONFIRMED",
    price: 1500,
  },
  {
    id: "2",
    client: { name: "David Smith", phone: "+254 723 456 789" },
    serviceId: "2",
    serviceName: "Manicure",
    staffId: "3",
    staffName: "Emma Wilson",
    dateISO: "2024-01-16",
    timeISO: "14:00",
    status: "PENDING",
    price: 800,
  },
]

const mockApplications: StaffApplication[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@email.com",
    phone: "+254 745 123 456",
    role: "Hair Stylist",
    experience: "3 years",
    skills: ["Hair Cutting", "Coloring", "Styling"],
    appliedDate: "2024-01-15",
    status: "PENDING",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@email.com",
    phone: "+254 756 234 567",
    role: "Massage Therapist",
    experience: "5 years",
    skills: ["Deep Tissue", "Swedish", "Hot Stone"],
    appliedDate: "2024-01-14",
    status: "APPROVED",
  },
]

const mockCoupons: Coupon[] = [
  {
    id: "1",
    name: "New Year Special",
    description: "20% off all services",
    discount: "20%",
    used: 45,
    expires: "2024-01-31",
    status: "ACTIVE",
    maxUses: 100,
  },
  {
    id: "2",
    name: "Student Discount",
    description: "15% off with valid student ID",
    discount: "15%",
    used: 23,
    expires: "2024-12-31",
    status: "ACTIVE",
    maxUses: 200,
  },
]

// API Functions
export async function getStaffList(businessId: string): Promise<Staff[]> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return mockStaff
}

export async function updateStaffServices(staffId: string, serviceIds: string[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const staff = mockStaff.find((s) => s.id === staffId)
  if (staff) {
    const services = mockServices.filter((s) => serviceIds.includes(s.id)).map((s) => s.name)
    staff.services = services
  }
}

export async function getServices(businessId: string, opts?: { category?: Service["category"] }): Promise<Service[]> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  let filtered = mockServices
  if (opts?.category) {
    filtered = mockServices.filter((s) => s.category === opts.category)
  }
  return filtered
}

export async function getBundles(businessId: string): Promise<Bundle[]> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return mockBundles
}

export async function getBookings(
  businessId: string,
  opts?: {
    dateISO?: string
    range?: "TODAY" | "TOMORROW" | "THIS_WEEK"
    status?: BookingStatus
    serviceId?: string
    staffId?: string
    page?: number
  },
): Promise<{ rows: Booking[]; total: number }> {
  await new Promise((resolve) => setTimeout(resolve, 600))

  let filtered = [...mockBookings]

  if (opts?.status) {
    filtered = filtered.filter((b) => b.status === opts.status)
  }

  if (opts?.serviceId) {
    filtered = filtered.filter((b) => b.serviceId === opts.serviceId)
  }

  if (opts?.staffId) {
    filtered = filtered.filter((b) => b.staffId === opts.staffId)
  }

  if (opts?.dateISO) {
    filtered = filtered.filter((b) => b.dateISO === opts.dateISO)
  }

  if (opts?.range === "TODAY") {
    const today = new Date().toISOString().split("T")[0]
    filtered = filtered.filter((b) => b.dateISO === today)
  }

  return { rows: filtered, total: filtered.length }
}

export async function createWalkInBooking(
  payload: Omit<Booking, "id" | "status"> & { status?: BookingStatus },
): Promise<Booking> {
  await new Promise((resolve) => setTimeout(resolve, 400))

  const newBooking: Booking = {
    ...payload,
    id: Date.now().toString(),
    status: payload.status || "CONFIRMED",
  }

  mockBookings.push(newBooking)
  return newBooking
}

export async function getStaffApplications(
  businessId: string,
  opts?: { status?: StaffApplicationStatus | "ALL" },
): Promise<StaffApplication[]> {
  await new Promise((resolve) => setTimeout(resolve, 500))

  if (!opts?.status || opts.status === "ALL") {
    return mockApplications
  }

  return mockApplications.filter((app) => app.status === opts.status)
}

export async function actOnApplication(
  businessId: string,
  payload: { id: string; action: "approve" | "reject"; reason?: string },
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400))

  const application = mockApplications.find((app) => app.id === payload.id)
  if (application) {
    application.status = payload.action === "approve" ? "APPROVED" : "REJECTED"

    // If approved, add to staff list
    if (payload.action === "approve") {
      const newStaff: Staff = {
        id: Date.now().toString(),
        name: application.name,
        role: application.role,
        completionRate: 0,
        rating: 0,
        monthBookings: 0,
        monthRevenue: 0,
        services: application.skills,
        email: application.email,
        phone: application.phone,
      }
      mockStaff.push(newStaff)
    }
  }
}

export async function getPerformance(
  businessId: string,
  opts?: {
    period?: "DAILY" | "WEEKLY" | "MONTHLY"
    start?: string
    end?: string
    metrics?: string[]
  },
): Promise<PerformanceData> {
  await new Promise((resolve) => setTimeout(resolve, 800))

  return {
    kpis: [
      { label: "Total Bookings", value: "156", change: 12, period: "vs last month" },
      { label: "Total Revenue", value: "KSh 234,500", change: 8, period: "vs last month" },
      { label: "Unique Clients", value: "89", change: 15, period: "vs last month" },
      { label: "Show Rate", value: "94%", change: 3, period: "vs last month" },
    ],
    charts: {
      revenue: [
        { date: "2024-01-10", amount: 15000 },
        { date: "2024-01-11", amount: 18000 },
        { date: "2024-01-12", amount: 12000 },
        { date: "2024-01-13", amount: 22000 },
        { date: "2024-01-14", amount: 25000 },
        { date: "2024-01-15", amount: 19000 },
        { date: "2024-01-16", amount: 21000 },
      ],
      bookings: [
        { date: "2024-01-10", count: 12 },
        { date: "2024-01-11", count: 15 },
        { date: "2024-01-12", count: 8 },
        { date: "2024-01-13", count: 18 },
        { date: "2024-01-14", count: 20 },
        { date: "2024-01-15", count: 14 },
        { date: "2024-01-16", count: 16 },
      ],
    },
  }
}

export async function getCoupons(businessId: string): Promise<Coupon[]> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return mockCoupons
}

export async function getBusinessProfile(businessId: string): Promise<BusinessProfile> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return {
    id: businessId,
    name: "Bella Beauty Salon",
    type: "Beauty Salon",
    phone: "+254 712 345 678",
    email: "info@bella.com",
    description: "Premium beauty services in the heart of Nairobi",
    address: "123 Kimathi Street, Nairobi",
    hours: {
      monday: { open: true, start: "09:00", end: "18:00" },
      tuesday: { open: true, start: "09:00", end: "18:00" },
      wednesday: { open: true, start: "09:00", end: "18:00" },
      thursday: { open: true, start: "09:00", end: "18:00" },
      friday: { open: true, start: "09:00", end: "19:00" },
      saturday: { open: true, start: "08:00", end: "17:00" },
      sunday: { open: false, start: "", end: "" },
    },
  }
}

export async function updateBusinessProfile(businessId: string, profile: Partial<BusinessProfile>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  console.log("Updated business profile:", profile)
}

export async function getPayoutSettings(businessId: string): Promise<PayoutSettings> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return {
    mpesaNumber: "+254 712 345 678",
    flutterwaveSubaccountId: "RS_1234567890",
    status: "VERIFIED",
    schedule: "Weekly on Fridays",
  }
}

export async function updatePayoutSettings(businessId: string, settings: Partial<PayoutSettings>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  console.log("Updated payout settings:", settings)
}
