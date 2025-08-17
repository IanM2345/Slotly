"use client"

import type React from "react"
import { View, StyleSheet } from "react-native"
import { Text, Surface, List } from "react-native-paper"
import { useVerification } from "../context/VerificationContext"
import { useRouter } from "expo-router"

interface VerificationGateProps {
  children: React.ReactNode
}

export function VerificationGate({ children }: VerificationGateProps) {
  const { status } = useVerification()
  const router = useRouter()

  if (status === "verified") {
    return <>{children}</>
  }

  const handleEditProfile = () => {
    router.push("/business/settings/profile")
  }

  const handleViewStatus = () => {
    router.push("/business/onboarding/pending")
  }

  const handleContactSupport = () => {
    console.log("Navigate to support")
    // TODO: Implement support navigation
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.banner} elevation={2}>
        <Text style={styles.bannerTitle}>
          {status === "pending" ? "Verification Pending" : "Verification Required"}
        </Text>
        <Text style={styles.bannerText}>
          {status === "pending"
            ? "Your business is under review. Limited features are available."
            : "Please complete business verification to access all features."}
        </Text>
      </Surface>

      <Surface style={styles.actionsContainer} elevation={1}>
        <Text style={styles.actionsTitle}>Available Actions</Text>

        <List.Item
          title="Edit Business Profile"
          description="Update your business information"
          left={(props) => <List.Icon {...props} icon="store-edit" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleEditProfile}
          style={styles.actionItem}
        />

        <List.Item
          title="View Verification Status"
          description="Check your verification progress"
          left={(props) => <List.Icon {...props} icon="check-circle-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleViewStatus}
          style={styles.actionItem}
        />

        <List.Item
          title="Contact Support"
          description="Get help with verification"
          left={(props) => <List.Icon {...props} icon="help-circle-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={handleContactSupport}
          style={styles.actionItem}
        />
      </Surface>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F8FAFC",
  },
  banner: {
    backgroundColor: "#FFF6EE",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#F57C00",
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E66400",
    marginBottom: 8,
  },
  bannerText: {
    fontSize: 14,
    color: "#C65000",
    lineHeight: 20,
  },
  actionsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#374151",
    padding: 16,
    paddingBottom: 8,
  },
  actionItem: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
})
