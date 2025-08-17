"use client"

import { View, StyleSheet } from "react-native"
import { Text, useTheme } from "react-native-paper"

interface AvatarCircleProps {
  name: string
  size?: number
}

export function AvatarCircle({ name, size = 40 }: AvatarCircleProps) {
  const theme = useTheme()

  const getInitials = (name: string) => {
    const words = name.trim().split(" ")
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const getGradientColor = (name: string) => {
    // Simple hash to generate consistent colors
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }

    // Mix of blue and orange based on hash
    const hue = Math.abs(hash) % 2 === 0 ? 210 : 30 // Blue or Orange hue
    const saturation = 70 + (Math.abs(hash) % 30) // 70-100%
    const lightness = 45 + (Math.abs(hash) % 20) // 45-65%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  const initials = getInitials(name)
  const backgroundColor = getGradientColor(name)

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
})
