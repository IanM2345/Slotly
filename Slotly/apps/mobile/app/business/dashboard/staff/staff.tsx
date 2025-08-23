"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Portal,
  Modal,
  Searchbar,
  Checkbox,
  List,
  Snackbar,
} from "react-native-paper"
import { useRouter } from "expo-router"

// local components
import { VerificationGate } from "../../../../components/VerificationGate"
import { Section } from "../../../../components/Section"
import { AvatarCircle } from "../../../../components/AvatarCircle"
import { ServiceChip } from "../../../../components/ServiceChip"

// manager API
import {
  listStaff,                 // { approvedStaff, pendingEnrollments }
  listServices,              // services[]
  listTimeOffRequests,       // time off GET
  decideTimeOff,             // time off PATCH
  reviewStaffEnrollment,     // approve/reject application
  listStaffByServiceAssignment, // <-- used to preload assignments
  assignStaffToService,
  unassignStaffFromService,
} from "../../../../lib/api/modules/manager"

import type { Staff, Service } from "../../../../lib/types"

// ---------- light types ----------
type PendingEnrollment = {
  id: string
  user?: { name?: string; email?: string }
}

type TimeOffRequestUI = {
  id: string
  staff?: { id?: string; name?: string }
  startDate: string | Date
  endDate: string | Date
  status?: "PENDING" | "APPROVED" | "REJECTED"
}

// One-shot assign/unassign helper (uses existing endpoints)
async function setStaffServices({ staffId, desiredServiceIds }: { staffId: string; desiredServiceIds: string[] }) {
  const byService = await listStaffByServiceAssignment() // { assigned, unassigned }  :contentReference[oaicite:1]{index=1}

  const currentlyAssignedByService = new Map<string, Set<string>>()
  for (const item of byService.assigned ?? []) {
    const svcId = item.serviceId ?? item.service?.id ?? item.id
    const staffSet = new Set<string>((item.staff || []).map((s: any) => s.id))
    currentlyAssignedByService.set(svcId, staffSet)
  }

  const allServiceIds = new Set<string>([
    ...(byService.assigned?.map((s: any) => s.serviceId ?? s.service?.id ?? s.id) || []),
    ...(byService.unassigned?.map((s: any) => s.serviceId ?? s.service?.id ?? s.id) || []),
  ])

  const desired = new Set(desiredServiceIds)
  const ops: Promise<any>[] = []

  for (const serviceId of allServiceIds) {
    const set = currentlyAssignedByService.get(serviceId) || new Set<string>()
    const isAssigned = set.has(staffId)
    const shouldBeAssigned = desired.has(serviceId)
    if (!isAssigned && shouldBeAssigned) {
      ops.push(assignStaffToService({ serviceId, staffId }))   // :contentReference[oaicite:2]{index=2}
    } else if (isAssigned && !shouldBeAssigned) {
      ops.push(unassignStaffFromService({ serviceId, staffId })) // :contentReference[oaicite:3]{index=3}
    }
  }
  if (ops.length) await Promise.all(ops)
  return { message: "Services updated" }
}

export default function StaffIndexScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)

  // Staff + Services
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])

  // Map: staffId -> serviceIds[] (preloaded assignments)
  const [staffAssignedIds, setStaffAssignedIds] = useState<Record<string, string[]>>({})

  // Applications
  const [pendingApps, setPendingApps] = useState<PendingEnrollment[]>([])

  // Time off
  const [timeOff, setTimeOff] = useState<TimeOffRequestUI[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // Edit services modal
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]) // IDs
  const [serviceSearch, setServiceSearch] = useState("")
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // 1) fetch staff & services
      const staffPayload = await listStaff()               // :contentReference[oaicite:4]{index=4}
      const servicesData = await listServices()            // :contentReference[oaicite:5]{index=5}

      // 2) fetch service assignments grouped by service
      const assignment = await listStaffByServiceAssignment() // { assigned, unassigned }  :contentReference[oaicite:6]{index=6}

      // Build: serviceId -> serviceName
      const serviceNameById = new Map<string, string>()
      ;(servicesData || []).forEach((s: any) => serviceNameById.set(s.id, s.name))

      // Build: staffId -> [serviceId]
      const mapByStaff: Record<string, string[]> = {}
      for (const item of assignment.assigned ?? []) {
        const svcId: string = item.serviceId ?? item.service?.id ?? item.id
        const staffArr = (item.staff || []) as Array<{ id: string }>
        for (const st of staffArr) {
          if (!mapByStaff[st.id]) mapByStaff[st.id] = []
          mapByStaff[st.id].push(svcId)
        }
      }
      setStaffAssignedIds(mapByStaff)

      // map approved staff to UI shape & attach service NAMES for display
      const mappedStaff: Staff[] = (staffPayload.approvedStaff || []).map((u: any) => {
        const svcIds = mapByStaff[u.id] || []
        const svcNames = svcIds.map((id: string) => serviceNameById.get(id)).filter(Boolean) as string[]
        return {
          id: u.id,
          name: u.name || "Unnamed",
          role: "STAFF",
          completionRate: 0,
          rating: 0,
          monthBookings: 0,
          monthRevenue: 0,
          services: svcNames, // show names in chips
        }
      })
      setStaff(mappedStaff)

      const mappedApps: PendingEnrollment[] = (staffPayload.pendingEnrollments || []).map((e: any) => ({
        id: e.id,
        user: e.user,
      }))
      setPendingApps(mappedApps)

      setServices(
        (servicesData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          durationMins: s.duration ?? s.durationMins ?? 0,
        })),
      )

      // pending time-off requests
      const timeOffRequests = (await listTimeOffRequests({ status: "PENDING" })) as any[] // :contentReference[oaicite:7]{index=7}
      const mappedTimeOff: TimeOffRequestUI[] = (timeOffRequests || []).map((r: any) => ({
        id: r.id,
        staff: r.staff,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      }))
      setTimeOff(mappedTimeOff)
    } catch (error) {
      console.error("Error loading staff data:", error)
    } finally {
      setLoading(false)
    }
  }

  // ===== Edit Services =====
  const handleEditServices = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    // Preselect from preloaded map (IDs)
    setSelectedServiceIds(staffAssignedIds[staffMember.id] || [])
    setServiceSearch("")
  }

  const handleSaveServices = async () => {
    if (!editingStaff) return
    try {
      // desired IDs already in state
      await setStaffServices({ staffId: editingStaff.id, desiredServiceIds: selectedServiceIds })

      // Update local state names for display
      const idSet = new Set(selectedServiceIds)
      const selectedNames = services.filter((s) => idSet.has(s.id)).map((s) => s.name)

      // 1) Update card chips (names)
      setStaff((prev) => prev.map((s) => (s.id === editingStaff.id ? { ...s, services: selectedNames } : s)))
      // 2) Update our preload map (ids)
      setStaffAssignedIds((prev) => ({ ...prev, [editingStaff.id]: [...selectedServiceIds] }))

      setEditingStaff(null)
      setToast("Services updated")
    } catch (error) {
      console.error("Error updating services:", error)
      setToast("Failed to update services")
    }
  }

  // ===== Applications =====
  const approveApp = async (enrollmentId: string) => {
    try {
      setBusyId(enrollmentId)
      await reviewStaffEnrollment({ enrollmentId, status: "APPROVED" }) // :contentReference[oaicite:8]{index=8}
      await loadData()
      setToast("Application approved")
    } catch (e) {
      console.error(e)
      setToast("Failed to approve")
    } finally {
      setBusyId(null)
    }
  }

  const rejectApp = async (enrollmentId: string) => {
    try {
      setBusyId(enrollmentId)
      await reviewStaffEnrollment({ enrollmentId, status: "REJECTED" }) // :contentReference[oaicite:9]{index=9}
      await loadData()
      setToast("Application rejected")
    } catch (e) {
      console.error(e)
      setToast("Failed to reject")
    } finally {
      setBusyId(null)
    }
  }

  // ===== Time-off =====
  const decideTimeoff = async ({
    id,
    status,
    startDate,
    endDate,
  }: {
    id: string
    status: "APPROVED" | "REJECTED"
    startDate: string | Date
    endDate: string | Date
  }) => {
    try {
      setBusyId(id)
      await decideTimeOff({ id, status, startDate, endDate }) // :contentReference[oaicite:10]{index=10}
      const updated = (await listTimeOffRequests({ status: "PENDING" })) as any[] // :contentReference[oaicite:11]{index=11}
      const mappedTimeOff: TimeOffRequestUI[] = (updated || []).map((r: any) => ({
        id: r.id,
        staff: r.staff,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      }))
      setTimeOff(mappedTimeOff)
      setToast(`Time off ${status.toLowerCase()}`)
    } catch (e) {
      console.error(e)
      setToast("Failed to update time off")
    } finally {
      setBusyId(null)
    }
  }

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase()),
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading staff…</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Staff Management</Text>
        </View>

        {/* ===== Applications ===== */}
        <Section title="Pending Staff Applications">
          {pendingApps.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, color: "#6B7280" }}>No pending applications</Text>
          ) : (
            <View style={styles.staffContainer}>
              {pendingApps.map((enr) => (
                <Surface key={enr.id} style={styles.staffCard} elevation={2}>
                  <View style={styles.staffHeader}>
                    <AvatarCircle name={enr.user?.name ?? "Applicant"} size={50} />
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{enr.user?.name ?? "Applicant"}</Text>
                      <Text style={styles.staffRole}>{enr.user?.email ?? ""}</Text>
                    </View>
                  </View>
                  <View style={styles.staffActions}>
                    <Button
                      mode="contained"
                      compact
                      loading={busyId === enr.id}
                      onPress={() => approveApp(enr.id)}
                      style={styles.actionButton}
                    >
                      Approve
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      loading={busyId === enr.id}
                      onPress={() => rejectApp(enr.id)}
                      style={styles.actionButton}
                    >
                      Reject
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          )}
        </Section>

        {/* ===== Staff ===== */}
        <Section title="Current Staff Members">
          <View style={styles.staffContainer}>
            {staff.map((member) => (
              <Surface key={member.id} style={styles.staffCard} elevation={2}>
                <View style={styles.staffHeader}>
                  <AvatarCircle name={member.name} size={50} />
                  <View style={styles.staffInfo}>
                    <Text style={styles.staffName}>{member.name}</Text>
                    <Text style={styles.staffRole}>{member.role}</Text>
                  </View>
                  <View style={styles.staffStats}>
                    <Text style={styles.statValue}>{member.completionRate}%</Text>
                    <Text style={styles.statLabel}>Completion</Text>
                  </View>
                </View>

                <View style={styles.staffMetrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>⭐ {member.rating}</Text>
                    <Text style={styles.metricLabel}>Rating</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>{member.monthBookings}</Text>
                    <Text style={styles.metricLabel}>This Month</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricValue}>KSh {member.monthRevenue.toLocaleString()}</Text>
                    <Text style={styles.metricLabel}>Revenue</Text>
                  </View>
                </View>

                <View style={styles.servicesSection}>
                  <Text style={styles.servicesTitle}>Services</Text>
                  <View style={styles.servicesContainer}>
                    {(member.services || []).length === 0 ? (
                      <Text style={{ color: "#6B7280" }}>No services assigned</Text>
                    ) : (
                      member.services.map((serviceName) => <ServiceChip key={serviceName} service={serviceName} />)
                    )}
                  </View>
                </View>

                <View style={styles.staffActions}>
                  <Button mode="outlined" onPress={() => handleEditServices(member)} style={styles.actionButton} compact>
                    Edit Services
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => router.push({ pathname: "/business/dashboard/staff", params: { id: member.id } })}
                    style={styles.actionButton}
                    compact
                  >
                    View Details
                  </Button>
                </View>
              </Surface>
            ))}
          </View>
        </Section>

        {/* ===== Time-off ===== */}
        <Section title="Time-off Requests (Pending)">
          {timeOff.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, color: "#6B7280" }}>No pending requests</Text>
          ) : (
            <View style={styles.staffContainer}>
              {timeOff.map((req) => (
                <Surface key={req.id} style={styles.staffCard} elevation={2}>
                  <View style={styles.staffHeader}>
                    <AvatarCircle name={req.staff?.name ?? "Staff"} size={46} />
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{req.staff?.name ?? "Staff"}</Text>
                      <Text style={styles.staffRole}>
                        {new Date(req.startDate).toDateString()} → {new Date(req.endDate).toDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.staffActions}>
                    <Button
                      mode="contained"
                      compact
                      loading={busyId === req.id}
                      onPress={() =>
                        decideTimeoff({
                          id: req.id,
                          status: "APPROVED",
                          startDate: req.startDate,
                          endDate: req.endDate,
                        })
                      }
                      style={styles.actionButton}
                    >
                      Approve
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      loading={busyId === req.id}
                      onPress={() =>
                        decideTimeoff({
                          id: req.id,
                          status: "REJECTED",
                          startDate: req.startDate,
                          endDate: req.endDate,
                        })
                      }
                      style={styles.actionButton}
                    >
                      Reject
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          )}
        </Section>

        {/* ===== Edit Services Modal ===== */}
        <Portal>
          <Modal visible={!!editingStaff} onDismiss={() => setEditingStaff(null)} contentContainerStyle={styles.modalContainer}>
            <Surface style={styles.modalContent} elevation={4}>
              <Text style={styles.modalTitle}>Edit Services - {editingStaff?.name}</Text>

              <Searchbar placeholder="Search services…" value={serviceSearch} onChangeText={setServiceSearch} style={styles.searchbar} />

              <ScrollView style={styles.servicesList}>
                {filteredServices.map((service) => (
                  <List.Item
                    key={service.id}
                    title={service.name}
                    description={`${service.durationMins}min • KSh ${service.price}`}
                    left={() => (
                      <Checkbox
                        status={selectedServiceIds.includes(service.id) ? "checked" : "unchecked"}
                        onPress={() => {
                          setSelectedServiceIds((prev) =>
                            prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id],
                          )
                        }}
                      />
                    )}
                    onPress={() => {
                      setSelectedServiceIds((prev) =>
                        prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id],
                      )
                    }}
                  />
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={() => setEditingStaff(null)} style={styles.modalButton}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={handleSaveServices} style={styles.modalButton}>
                  Save Changes
                </Button>
              </View>
            </Surface>
          </Modal>
        </Portal>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Toast */}
      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={2500}>
        {toast}
      </Snackbar>
    </VerificationGate>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
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
  staffContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  staffCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  staffHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  staffInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  staffRole: {
    fontSize: 14,
    color: "#6B7280",
  },
  staffStats: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  staffMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  metric: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  servicesSection: {
    marginBottom: 16,
  },
  servicesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  servicesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  staffActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1559C1",
    marginBottom: 16,
  },
  searchbar: {
    marginBottom: 16,
  },
  servicesList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 40,
  },
})
