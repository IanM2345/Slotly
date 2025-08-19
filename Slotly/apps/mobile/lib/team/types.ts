export type StaffStatus = "active" | "inactive"

export interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: "Stylist" | "Therapist" | "Reception" | "Manager"
  status: StaffStatus
}
