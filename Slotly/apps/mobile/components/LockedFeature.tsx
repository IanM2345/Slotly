import type React from "react"
import { View, StyleSheet } from "react-native"
import { Text, Button, Surface } from "react-native-paper"
import { useTier } from "../context/TierContext"

interface LockedFeatureProps {
  title: string
  description: string
  onPressUpgrade?: () => void
  children?: React.ReactNode
}

export function LockedFeature({ title, description, onPressUpgrade, children }: LockedFeatureProps) {
  const { tierName } = useTier()

  return (
    <View style={styles.container}>
      {children && <View style={styles.blurredContent}>{children}</View>}

      <Surface style={styles.overlay} elevation={4}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockEmoji}>🔒</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.currentTier}>Current plan: {tierName}</Text>

        <Button
          mode="contained"
          onPress={onPressUpgrade}
          style={styles.upgradeButton}
          labelStyle={styles.upgradeButtonText}
        >
          Upgrade Plan
        </Button>
      </Surface>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minHeight: 200,
  },
  blurredContent: {
    opacity: 0.3,
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
  },
  lockIcon: {
    marginBottom: 16,
  },
  lockEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
  },
  currentTier: {
    fontSize: 12,
    color: "#888",
    marginBottom: 20,
  },
  upgradeButton: {
    backgroundColor: "#ff69b4",
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
})
