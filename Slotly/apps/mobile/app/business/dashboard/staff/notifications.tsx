"use client"

import { useState, useEffect } from "react"
import { ScrollView, View, StyleSheet } from "react-native"
import { Text, Surface, Button, useTheme, IconButton, List } from "react-native-paper"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams } from "expo-router"
import { useToast } from "./_layout"
import { staffApi } from "../../../../../mobile/lib/api/modules/staff"
import type { Notification } from "../../../../lib/staff/types"

export default function StaffNotificationsScreen() {
  const { businessId: businessIdParam } = useLocalSearchParams<{ businessId?: string }>();
  const businessId = typeof businessIdParam === "string" ? businessIdParam : undefined;
  
  const theme = useTheme()
  const { notify } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotifications()
  }, [businessId])

  const loadNotifications = async () => {
    try {
      const data = await staffApi.getNotifications({ businessId })
      setNotifications(data)
    } catch (error) {
      notify("Failed to load notifications")
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await staffApi.markNotificationRead(id, { businessId })
      setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, isRead: true } : notif)))
      notify("Marked as read")
    } catch (error) {
      notify("Failed to mark as read")
    }
  }

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      await staffApi.markAllRead({ businessId })
      setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })))
      notify("All notifications marked as read")
    } catch (error) {
      notify("Failed to mark all as read")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="menu" size={24} iconColor={theme.colors.onBackground} style={styles.menuButton} />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Notifications
          </Text>
          <Button
            mode="text"
            onPress={handleMarkAllAsRead}
            loading={loading}
            disabled={loading}
            labelStyle={{ color: theme.colors.primary }}
          >
            Mark all as read
          </Button>
        </View>

        {/* Notifications List */}
        <Surface style={styles.notificationsCard} elevation={1}>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
                No notifications yet
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <List.Item
                key={notification.id}
                title={notification.title}
                description={notification.time}
                titleStyle={{
                  color: theme.colors.onBackground,
                  fontWeight: notification.isRead ? "normal" : "bold",
                }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                style={[
                  styles.notificationItem,
                  !notification.isRead && { backgroundColor: theme.colors.primaryContainer },
                ]}
                right={() =>
                  !notification.isRead ? (
                    <Button
                      mode="text"
                      onPress={() => handleMarkAsRead(notification.id)}
                      labelStyle={{ color: theme.colors.primary, fontSize: 12 }}
                    >
                      Mark as read
                    </Button>
                  ) : null
                }
              />
            ))
          )}
        </Surface>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  menuButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: "700",
    flex: 1,
  },
  notificationsCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  emptyState: {
    padding: 48,
  },
  notificationItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
})