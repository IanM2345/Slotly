"use client"

import { View, StyleSheet } from "react-native"
import { Text, useTheme } from "react-native-paper"
import type { SlotlyTheme } from "../app/theme/paper"

export type StatusType =
  | "CONFIRMED"
  | "PENDING"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW"
  | "APPROVED"
  | "REJECTED"
  | "ACTIVE"
  | "EXPIRED"
  | "EXPIRING"
  | "RESCHEDULED"

interface StatusPillProps {
  status: StatusType
  size?: "small" | "medium"
}

export function StatusPill({ status, size = "medium" }: StatusPillProps) {
  const theme = useTheme() as SlotlyTheme

  const getStatusConfig = (status: StatusType) => {
    switch (status) {
      case "CONFIRMED":
      case "COMPLETED":
      case "APPROVED":
      case "ACTIVE":
        return {
          backgroundColor: theme.colors.success,
          textColor: "#FFFFFF",
          text: status,
        }
      case "PENDING":
        return {
          backgroundColor: theme.colors.warning,
          textColor: "#000000",
          text: status,
        }
      case "CANCELLED":
      case "REJECTED":
      case "NO_SHOW":
        return {
          backgroundColor: theme.colors.error,
          textColor: "#FFFFFF",
          text: status,
        }
      case "EXPIRED":
        return {
          backgroundColor: "#9CA3AF",
          textColor: "#FFFFFF",
          text: status,
        }
      case "EXPIRING":
        return {
          backgroundColor: "#F57C00",
          textColor: "#FFFFFF",
          text: "EXPIRING SOON",
        }
      default:
        return {
          backgroundColor: theme.colors.info,
          textColor: "#FFFFFF",
          text: status,
        }
    }
  }

  const config = getStatusConfig(status)
  const isSmall = size === "small"

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor },
        isSmall ? styles.smallContainer : styles.mediumContainer,
      ]}
    >
      <Text style={[styles.text, { color: config.textColor }, isSmall ? styles.smallText : styles.mediumText]}>
        {config.text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  smallContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mediumContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontWeight: "bold",
    textAlign: "center",
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
})