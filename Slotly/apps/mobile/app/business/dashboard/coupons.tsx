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
  Menu,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { useTier } from "../../../context/TierContext"
import { VerificationGate } from "../../../components/VerificationGate"
import { LockedFeature } from "../../../components/LockedFeature"
import { Section } from "../../../components/Section"
import { FilterChipsRow } from "../../../components/FilterChipsRow"
import { StatusPill } from "../../../components/StatusPill"
import { ConfirmDialog } from "../../../components/ConfirmDialog"
import { getCoupons } from "../../../lib/api/manager"
import type { Coupon } from "../../../lib/types"

export default function CouponsScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { features } = useTier()
  const [loading, setLoading] = useState(true)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [selectedFilter, setSelectedFilter] = useState(["All"])
  const [menuVisible, setMenuVisible] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  useEffect(() => {
    if (features.advancedBooking) {
      loadCoupons()
    }
  }, [features.advancedBooking, selectedFilter])

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const couponsData = await getCoupons("business-1")
      let filtered = couponsData

      if (selectedFilter[0] !== "All") {
        const status = selectedFilter[0].toUpperCase().replace(" ", "_")
        filtered = couponsData.filter((coupon) => coupon.status === status)
      }

      setCoupons(filtered)
    } catch (error) {
      console.error("Error loading coupons:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = () => {
    router.push("/business/dashboard/billing" as any)
  }

  const handleCouponAction = (coupon: Coupon, action: string) => {
    setMenuVisible(null)

    switch (action) {
      case "edit":
        console.log("Edit coupon:", coupon.id)
        break
      case "deactivate":
        setConfirmDialog({
          visible: true,
          title: "Deactivate Coupon",
          message: `Are you sure you want to deactivate "${coupon.name}"?`,
          onConfirm: () => {
            console.log("Deactivate coupon:", coupon.id)
            setConfirmDialog((prev) => ({ ...prev, visible: false }))
          },
        })
        break
      case "extend":
        console.log("Extend coupon:", coupon.id)
        break
      case "clone":
        console.log("Clone coupon:", coupon.id)
        break
      case "archive":
        setConfirmDialog({
          visible: true,
          title: "Archive Coupon",
          message: `Are you sure you want to archive "${coupon.name}"?`,
          onConfirm: () => {
            console.log("Archive coupon:", coupon.id)
            setConfirmDialog((prev) => ({ ...prev, visible: false }))
          },
        })
        break
    }
  }

  const filterOptions = [
    { key: "All", label: "All" },
    { key: "Active", label: "Active" },
    { key: "Expired", label: "Expired" },
    { key: "Expiring Soon", label: "Expiring Soon" },
  ]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getUsagePercentage = (coupon: Coupon) => {
    if (!coupon.maxUses) return 0
    return Math.round((coupon.used / coupon.maxUses) * 100)
  }

  if (!features.advancedBooking) {
    return (
      <VerificationGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
            <Text style={styles.title}>Coupons & Promotions</Text>
          </View>

          <View style={styles.lockedContainer}>
            <LockedFeature
              title="Coupons & Promotions"
              description="Advanced marketing features are available on higher tier plans"
              onPressUpgrade={handleUpgrade}
            />
          </View>
        </View>
      </VerificationGate>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading coupons...</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Coupons & Promotions</Text>
        </View>

        {/* Filters */}
        <Section title="Filter Coupons">
          <FilterChipsRow
            options={filterOptions}
            selectedKeys={selectedFilter}
            onSelectionChange={setSelectedFilter}
            multiSelect={false}
          />
        </Section>

        {/* Create Coupon Button */}
        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={() => console.log("Create new coupon")}
            style={[styles.createButton, { backgroundColor: theme.colors.secondary }]}
            icon="plus"
          >
            Create New Coupon
          </Button>
        </View>

        {/* Coupons List */}
        <Section title={`Coupons (${coupons.length})`}>
          <View style={styles.couponsContainer}>
            {coupons.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No coupons found</Text>
                <Text style={styles.emptySubtext}>Create your first coupon to start promoting your services</Text>
              </Surface>
            ) : (
              coupons.map((coupon) => (
                <Surface key={coupon.id} style={styles.couponCard} elevation={2}>
                  <View style={styles.couponHeader}>
                    <View style={styles.couponInfo}>
                      <Text style={styles.couponName}>{coupon.name}</Text>
                      <Text style={styles.couponDescription}>{coupon.description}</Text>
                    </View>
                    <View style={styles.couponStatus}>
                      <StatusPill status={coupon.status} size="small" />
                      <Menu
                        visible={menuVisible === coupon.id}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            size={20}
                            onPress={() => setMenuVisible(coupon.id)}
                          />
                        }
                      >
                        <Menu.Item onPress={() => handleCouponAction(coupon, "edit")} title="Edit" />
                        {coupon.status === "ACTIVE" && (
                          <Menu.Item onPress={() => handleCouponAction(coupon, "deactivate")} title="Deactivate" />
                        )}
                        {coupon.status === "EXPIRING" && (
                          <Menu.Item onPress={() => handleCouponAction(coupon, "extend")} title="Extend" />
                        )}
                        <Menu.Item onPress={() => handleCouponAction(coupon, "clone")} title="Clone" />
                        <Menu.Item onPress={() => handleCouponAction(coupon, "archive")} title="Archive" />
                      </Menu>
                    </View>
                  </View>

                  <View style={styles.couponMetrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{coupon.discount}</Text>
                      <Text style={styles.metricLabel}>Discount</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{coupon.used}</Text>
                      <Text style={styles.metricLabel}>Used</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{formatDate(coupon.expires)}</Text>
                      <Text style={styles.metricLabel}>Expires</Text>
                    </View>
                  </View>

                  {coupon.maxUses && (
                    <View style={styles.usageBar}>
                      <View style={styles.usageBarBackground}>
                        <View
                          style={[
                            styles.usageBarFill,
                            {
                              width: `${getUsagePercentage(coupon)}%`,
                              backgroundColor: theme.colors.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.usageText}>
                        {coupon.used} / {coupon.maxUses} uses ({getUsagePercentage(coupon)}%)
                      </Text>
                    </View>
                  )}
                </Surface>
              ))
            )}
          </View>
        </Section>

        <ConfirmDialog
          visible={confirmDialog.visible}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, visible: false }))}
          destructive={confirmDialog.title.includes("Archive") || confirmDialog.title.includes("Deactivate")}
        />

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
  lockedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  createButton: {
    borderRadius: 25,
  },
  couponsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  couponCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  couponHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  couponInfo: {
    flex: 1,
    marginRight: 12,
  },
  couponName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  couponDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  couponStatus: {
    alignItems: "flex-end",
  },
  couponMetrics: {
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
    marginTop: 2,
  },
  usageBar: {
    marginTop: 8,
  },
  usageBarBackground: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  usageText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  bottomSpacing: {
    height: 40,
  },
})