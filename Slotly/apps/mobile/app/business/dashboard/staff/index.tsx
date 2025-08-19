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

// manager API (real functions from your module)
import {
  listStaff,                 // { approvedStaff, pendingEnrollments }
  listServices,              // services[]
  listTimeOffRequests,       // time off GET
  decideTimeOff,             // time off PATCH
  reviewStaffEnrollment,     // approve/reject application
  listStaffByServiceAssignment,
  assignStaffToService,
  unassignStaffFromService,
} from "../../../../lib/api/modules/manager"

import type { Staff, Service } from "../../../../lib/types"

// convenience: make service assignment 1-shot for this screen
async function setStaffServices({ staffId, desiredServiceIds }: { staffId: string; desiredServiceIds: string[] }) {
  const byService = await listStaffByServiceAssignment(); // { assigned, unassigned }
  const currentlyAssignedByService = new Map<string, Set<string>>();
  for (const item of byService.assigned ?? []) {
    currentlyAssignedByService.set(item.serviceId, new Set((item.staff || []).map((s: any) => s.id)));
  }

  const allServiceIds = new Set<string>([
    ...(byService.assigned?.map((s: any) => s.serviceId) || []),
    ...(byService.unassigned?.map((s: any) => s.serviceId) || []),
  ]);

  const desired = new Set(desiredServiceIds);
  const ops: Promise<any>[] = [];

  for (const serviceId of allServiceIds) {
    const set = currentlyAssignedByService.get(serviceId) || new Set<string>();
    const isAssigned = set.has(staffId);
    const shouldBeAssigned = desired.has(serviceId);
    if (!isAssigned && shouldBeAssigned) {
      ops.push(assignStaffToService({ serviceId, staffId }));
    } else if (isAssigned && !shouldBeAssigned) {
      ops.push(unassignStaffFromService({ serviceId, staffId }));
    }
  }
  if (ops.length) await Promise.all(ops);
  return { message: "Services updated" };
}

export default function StaffIndexScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)

  // Staff + Services
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])

  // Applications
  const [pendingApps, setPendingApps] = useState<any[]>([])

  // Time off
  const [timeOff, setTimeOff] = useState<any[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // Edit services modal
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceSearch, setServiceSearch] = useState("")
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const staffPayload = await listStaff()
      const servicesData = await listServices()

      // map approved staff to UI shape (metrics default until you add an endpoint)
      const mappedStaff: Staff[] = (staffPayload.approvedStaff || []).map((u: any) => ({
        id: u.id,
        name: u.name || "Unnamed",
        role: "STAFF",
        completionRate: 0,
        rating: 0,
        monthBookings: 0,
        monthRevenue: 0,
        services: [], // initial: unknown; manager can edit below
      }))

      setStaff(mappedStaff)
      setPendingApps(staffPayload.pendingEnrollments || [])
      setServices(
        (servicesData || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          durationMins: s.duration ?? s.durationMins ?? 0,
        })),
      )

      // pending time-off requests
      const timeOffRequests = await listTimeOffRequests({ status: "PENDING" })
      setTimeOff(timeOffRequests || [])
    } catch (error) {
      console.error("Error loading staff data:", error)
    } finally {
      setLoading(false)
    }
  }

  // ===== Edit Services =====
  const handleEditServices = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    setSelectedServices(staffMember.services ?? [])
    setServiceSearch("")
  }

  const handleSaveServices = async () => {
    if (!editingStaff) return
    try {
      const serviceIds = services.filter((s) => selectedServices.includes(s.name)).map((s) => s.id)
      await setStaffServices({ staffId: editingStaff.id, desiredServiceIds: serviceIds })

      // Update local state with the chosen names
      setStaff((prev) => prev.map((s) => (s.id === editingStaff.id ? { ...s, services: selectedServices } : s)))
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
      await reviewStaffEnrollment({ enrollmentId, status: "APPROVED" })
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
      await reviewStaffEnrollment({ enrollmentId, status: "REJECTED" })
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
  const decideTimeoff = async ({ id, status, startDate, endDate }: { id: string; status: "APPROVED" | "REJECTED"; startDate: any; endDate: any }) => {
    try {
      setBusyId(id)
      await decideTimeOff({ id, status, startDate, endDate })
      const updated = await listTimeOffRequests({ status: "PENDING" })
      setTimeOff(updated || [])
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
              {pendingApps.map((enr: any) => (
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
                      member.services.map((service) => <ServiceChip key={service} service={service} />)
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
              {timeOff.map((req: any) => (
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
                      onPress={() => decideTimeoff({ id: req.id, status: "APPROVED", startDate: req.startDate, endDate: req.endDate })}
                      style={styles.actionButton}
                    >
                      Approve
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      loading={busyId === req.id}
                      onPress={() => decideTimeoff({ id: req.id, status: "REJECTED", startDate: req.startDate, endDate: req.endDate })}
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
                        status={selectedServices.includes(service.name) ? "checked" : "unchecked"}
                        onPress={() => {
                          setSelectedServices((prev) =>
                            prev.includes(service.name) ? prev.filter((s) => s !== service.name) : [...prev, service.name],
                          )
                        }}
                      />
                    )}
                    onPress={() => {
                      setSelectedServices((prev) =>
                        prev.includes(service.name) ? prev.filter((s) => s !== service.name) : [...prev, service.name],
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
