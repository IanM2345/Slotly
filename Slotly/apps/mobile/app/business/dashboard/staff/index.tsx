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
} from "react-native-paper"
import { useRouter } from "expo-router"
import { VerificationGate } from "../../../../components/VerificationGate"
import { Section } from "../../../../components/Section"
import { AvatarCircle } from "../../../../components/AvatarCircle"
import { ServiceChip } from "../../../../components/ServiceChip"
import { getStaffList, getServices, updateStaffServices } from "../../../../lib/api/manager"
import type { Staff, Service } from "../../../../lib/types"

export default function StaffIndexScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceSearch, setServiceSearch] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [staffData, servicesData] = await Promise.all([getStaffList("business-1"), getServices("business-1")])
      setStaff(staffData)
      setServices(servicesData)
    } catch (error) {
      console.error("Error loading staff data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditServices = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    setSelectedServices(staffMember.services)
    setServiceSearch("")
  }

  const handleSaveServices = async () => {
    if (!editingStaff) return

    try {
      const serviceIds = services.filter((s) => selectedServices.includes(s.name)).map((s) => s.id)

      await updateStaffServices(editingStaff.id, serviceIds)

      // Update local state
      setStaff((prev) => prev.map((s) => (s.id === editingStaff.id ? { ...s, services: selectedServices } : s)))

      setEditingStaff(null)
    } catch (error) {
      console.error("Error updating services:", error)
    }
  }

  const handleViewDetails = (staffMember: Staff) => {
    router.push(`/(business)/dashboard/staff/${staffMember.id}`)
  }

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase()),
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading staff...</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Staff Management</Text>
        </View>

        <Section
          title="Current Staff Members"
          action={
            <Button mode="outlined" onPress={() => router.push("/(business)/dashboard/staff/applications")} compact>
              Applications
            </Button>
          }
        >
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
                    {member.services.map((service) => (
                      <ServiceChip key={service} service={service} />
                    ))}
                  </View>
                </View>

                <View style={styles.staffActions}>
                  <Button
                    mode="outlined"
                    onPress={() => handleEditServices(member)}
                    style={styles.actionButton}
                    compact
                  >
                    Edit Services
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => handleViewDetails(member)}
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

        {/* Edit Services Modal */}
        <Portal>
          <Modal
            visible={!!editingStaff}
            onDismiss={() => setEditingStaff(null)}
            contentContainerStyle={styles.modalContainer}
          >
            <Surface style={styles.modalContent} elevation={4}>
              <Text style={styles.modalTitle}>Edit Services - {editingStaff?.name}</Text>

              <Searchbar
                placeholder="Search services..."
                value={serviceSearch}
                onChangeText={setServiceSearch}
                style={styles.searchbar}
              />

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
                            prev.includes(service.name)
                              ? prev.filter((s) => s !== service.name)
                              : [...prev, service.name],
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
