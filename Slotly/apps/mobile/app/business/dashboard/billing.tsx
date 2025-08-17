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
  Switch,
  Divider,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { useTier } from "../../../context/TierContext"
import { VerificationGate } from "../../../components/VerificationGate"
import { Section } from "../../../components/Section"
import { TIER_NAMES } from "../../../lib/featureMatrix"
import type { BusinessTier } from "../../../lib/types"

interface BillingInfo {
  currentPlan: {
    name: string
    tier: BusinessTier
    price: number
    status: "ACTIVE" | "CANCELLED" | "PAST_DUE"
    nextBilling: string
    autoRenew: boolean
  }
  paymentHistory: {
    id: string
    date: string
    amount: number
    status: "PAID" | "PENDING" | "FAILED"
    description: string
  }[]
}

interface PlanOption {
  tier: BusinessTier
  name: string
  price: number
  features: string[]
  popular?: boolean
}

export default function BillingScreen() {
  const router = useRouter()
  const theme = useTheme()
  const { tier, setTier } = useTier()
  const [loading, setLoading] = useState(true)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [autoRenew, setAutoRenew] = useState(true)

  useEffect(() => {
    loadBillingInfo()
  }, [])

  const loadBillingInfo = async () => {
    setLoading(true)
    try {
      // Mock billing data
      await new Promise((resolve) => setTimeout(resolve, 600))
      
      const mockBillingInfo: BillingInfo = {
        currentPlan: {
          name: TIER_NAMES[tier],
          tier,
          price: getPlanPrice(tier),
          status: "ACTIVE",
          nextBilling: "2024-02-15",
          autoRenew: true,
        },
        paymentHistory: [
          {
            id: "1",
            date: "2024-01-15",
            amount: getPlanPrice(tier),
            status: "PAID",
            description: `${TIER_NAMES[tier]} Plan - Monthly`,
          },
          {
            id: "2",
            date: "2023-12-15",
            amount: getPlanPrice(tier),
            status: "PAID",
            description: `${TIER_NAMES[tier]} Plan - Monthly`,
          },
        ],
      }
      
      setBillingInfo(mockBillingInfo)
      setAutoRenew(mockBillingInfo.currentPlan.autoRenew)
    } catch (error) {
      console.error("Error loading billing info:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanPrice = (planTier: BusinessTier): number => {
    const prices: Record<BusinessTier, number> = {
      level1: 0,      // Starter - Free
      level2: 2500,   // Basic
      level3: 5000,   // Pro
      level4: 8500,   // Business
      level5: 15000,  // Enterprise
      level6: 25000,  // Premium
    }
    return prices[planTier]
  }

  const availablePlans: PlanOption[] = [
    {
      tier: "level1",
      name: "Starter",
      price: 0,
      features: ["Basic booking", "Up to 50 bookings/month", "Email support"],
    },
    {
      tier: "level2",
      name: "Basic",
      price: 2500,
      features: ["Everything in Starter", "Up to 200 bookings/month", "Staff management", "SMS notifications"],
    },
    {
      tier: "level3",
      name: "Pro",
      price: 5000,
      features: ["Everything in Basic", "Analytics dashboard", "Unlimited bookings", "Coupons & promotions"],
      popular: true,
    },
    {
      tier: "level4",
      name: "Business",
      price: 8500,
      features: ["Everything in Pro", "Multi-location", "Advanced reports", "Priority support"],
    },
    {
      tier: "level5",
      name: "Enterprise",
      price: 15000,
      features: ["Everything in Business", "Custom integrations", "Dedicated account manager", "White-label options"],
    },
    {
      tier: "level6",
      name: "Premium",
      price: 25000,
      features: ["Everything in Enterprise", "Custom development", "24/7 phone support", "SLA guarantee"],
    },
  ]

  const handlePlanSelect = (selectedTier: BusinessTier) => {
    if (selectedTier === tier) return
    
    console.log("Switching to plan:", selectedTier)
    setTier(selectedTier)
    
    // Update billing info
    if (billingInfo) {
      setBillingInfo({
        ...billingInfo,
        currentPlan: {
          ...billingInfo.currentPlan,
          tier: selectedTier,
          name: TIER_NAMES[selectedTier],
          price: getPlanPrice(selectedTier),
        },
      })
    }
  }

  const handleAutoRenewToggle = () => {
    setAutoRenew(!autoRenew)
    console.log("Auto-renew toggled:", !autoRenew)
  }

  const handleManagePayment = () => {
    console.log("Navigate to payment management")
    // TODO: Navigate to payment method management
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "PAID":
        return "#2E7D32"
      case "PENDING":
        return "#FBC02D"
      case "CANCELLED":
      case "FAILED":
      case "PAST_DUE":
        return "#C62828"
      default:
        return "#6B7280"
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading billing information...</Text>
      </View>
    )
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
          <Text style={styles.title}>Billing & Subscription</Text>
        </View>

        {/* Current Plan */}
        {billingInfo && (
          <Section title="Current Plan">
            <Surface style={styles.currentPlanCard} elevation={2}>
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{billingInfo.currentPlan.name}</Text>
                  <Text style={styles.planPrice}>
                    KSh {billingInfo.currentPlan.price.toLocaleString()}/month
                  </Text>
                </View>
                <View style={styles.planStatus}>
                  <Text style={[styles.statusText, { color: getStatusColor(billingInfo.currentPlan.status) }]}>
                    {billingInfo.currentPlan.status}
                  </Text>
                </View>
              </View>

              <View style={styles.planDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Next billing date:</Text>
                  <Text style={styles.detailValue}>{formatDate(billingInfo.currentPlan.nextBilling)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Auto-renew:</Text>
                  <Switch value={autoRenew} onValueChange={handleAutoRenewToggle} />
                </View>
              </View>

              <View style={styles.planActions}>
                <Button mode="outlined" onPress={handleManagePayment} style={styles.planActionBtn}>
                  Update Payment
                </Button>
                <Button mode="contained" onPress={handleManagePayment} style={styles.planActionBtn}>
                  Manage Plan
                </Button>
              </View>
            </Surface>
          </Section>
        )}

        {/* Available Plans */}
        <Section title="Available Plans">
          <View style={styles.plansContainer}>
            {availablePlans.map((plan) => (
              <Surface
                key={plan.tier}
                style={[
                  styles.planCard,
                  plan.tier === tier && styles.currentPlanHighlight,
                  plan.popular && styles.popularPlan,
                ]}
                elevation={plan.tier === tier ? 4 : 2}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                )}

                <View style={styles.planCardHeader}>
                  <Text style={styles.planCardName}>{plan.name}</Text>
                  <Text style={styles.planCardPrice}>
                    {plan.price === 0 ? "Free" : `KSh ${plan.price.toLocaleString()}/mo`}
                  </Text>
                </View>

                <View style={styles.planFeatures}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Text style={styles.featureIcon}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <Button
                  mode={plan.tier === tier ? "outlined" : "contained"}
                  onPress={() => handlePlanSelect(plan.tier)}
                  style={[
                    styles.selectPlanBtn,
                    plan.tier === tier && styles.currentPlanBtn,
                  ]}
                  disabled={plan.tier === tier}
                >
                  {plan.tier === tier ? "CURRENT PLAN" : "Select Plan"}
                </Button>
              </Surface>
            ))}
          </View>
        </Section>

        {/* Payment History */}
        {billingInfo && billingInfo.paymentHistory.length > 0 && (
          <Section title="Payment History">
            <Surface style={styles.historyCard} elevation={2}>
              {billingInfo.paymentHistory.map((payment, index) => (
                <View key={payment.id}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDescription}>{payment.description}</Text>
                      <Text style={styles.historyDate}>{formatDate(payment.date)}</Text>
                    </View>
                    <View style={styles.historyAmount}>
                      <Text style={styles.amountText}>KSh {payment.amount.toLocaleString()}</Text>
                      <Text style={[styles.historyStatus, { color: getStatusColor(payment.status) }]}>
                        {payment.status}
                      </Text>
                    </View>
                  </View>
                  {index < billingInfo.paymentHistory.length - 1 && <Divider style={styles.historyDivider} />}
                </View>
              ))}
            </Surface>
          </Section>
        )}

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
  currentPlanCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#1559C1",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "600",
  },
  planStatus: {
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  planDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
  },
  planActions: {
    flexDirection: "row",
    gap: 12,
  },
  planActionBtn: {
    flex: 1,
  },
  plansContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    position: "relative",
  },
  currentPlanHighlight: {
    borderWidth: 2,
    borderColor: "#1559C1",
  },
  popularPlan: {
    borderWidth: 2,
    borderColor: "#F57C00",
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    left: 20,
    backgroundColor: "#F57C00",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  planCardHeader: {
    marginBottom: 16,
    marginTop: 8,
  },
  planCardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  planCardPrice: {
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "600",
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureIcon: {
    color: "#2E7D32",
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 8,
    width: 16,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  selectPlanBtn: {
    borderRadius: 25,
  },
  currentPlanBtn: {
    borderColor: "#1559C1",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  historyInfo: {
    flex: 1,
  },
  historyDescription: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  historyAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: 14,
    color: "#1F2937",
    fontWeight: "600",
    marginBottom: 2,
  },
  historyStatus: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  historyDivider: {
    backgroundColor: "#F1F5F9",
  },
  bottomSpacing: {
    height: 40,
  },
})