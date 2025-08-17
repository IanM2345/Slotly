"use client";

import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Surface, TouchableRipple, ActivityIndicator } from "react-native-paper";
import { useRouter } from "expo-router";
import { useTier } from "../../../context/TierContext";
import { LockedFeature } from "../../../components/LockedFeature"; // keep your original path
import { getStaff, getBookings } from "../../../lib/api/manager";

interface DashboardCard {
  title: string;
  subtitle: string;
  route: string;        // absolute path to avoid relative resolution issues on web
  locked?: boolean;
}

export default function DashboardIndex() {
  const router = useRouter();
  const { features, tierName } = useTier();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    staffCount: 0,
    todayBookings: 0,
    monthlyRevenue: "KES 0",
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const [staffData, bookingsData] = await Promise.all([
        getStaff("business-1"),
        getBookings("business-1"),
      ]);

      const todayISO = new Date().toISOString().split("T")[0];
      const todayBookings = bookingsData.filter((b) => b.date === todayISO).length;

      const monthlyRevenue = bookingsData
        .filter((b) => b.status === "COMPLETED")
        .reduce((sum, b) => sum + b.price, 0);

      setStats({
        staffCount: staffData.length,
        todayBookings,
        monthlyRevenue: `KES ${monthlyRevenue.toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use ABSOLUTE routes that match your folder: /business/dashboard/*
  const cards: DashboardCard[] = [
    {
      title: "Staff",
      subtitle: loading ? "Loading..." : `${stats.staffCount} team members`,
      route: "/business/dashboard/staff",
    },
    {
      title: "Bookings",
      subtitle: loading ? "Loading..." : `${stats.todayBookings} today`,
      route: "/business/dashboard/bookings",
    },
    {
      title: "Analytics",
      subtitle: loading ? "Loading..." : stats.monthlyRevenue,
      route: "/business/dashboard/analytics",
      locked: !features.analytics,
    },
  ];

  const handleCardPress = (card: DashboardCard) => {
    if (card.locked) return; // handled by overlay
    router.push(card.route as any); // absolute path avoids "/staff" issue on web
  };

  const handleUpgrade = () => {
    console.log("Navigate to upgrade screen");
    // router.push('/upgrade');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff69b4" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Business Dashboard</Text>
        <Text style={styles.subtitle}>Current plan: {tierName}</Text>
      </View>

      <View style={styles.cardsContainer}>
        {cards.map((card) => (
          <View key={card.title} style={styles.cardWrapper}>
            {card.locked ? (
              <LockedFeature
                title={card.title} // avoid "Analytics Analytics"
                description="Analytics are available on Pro and above"
                onPressUpgrade={handleUpgrade}
              >
                <Surface style={styles.card} elevation={2}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </Surface>
              </LockedFeature>
            ) : (
              <TouchableRipple
                onPress={() => handleCardPress(card)}
                style={styles.cardTouchable}
                rippleColor="rgba(255, 105, 180, 0.1)"
              >
                <Surface style={styles.card} elevation={2}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </Surface>
              </TouchableRipple>
            )}
          </View>
        ))}
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffc0cb",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#ffc0cb",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  cardWrapper: {
    minHeight: 120,
  },
  cardTouchable: {
    borderRadius: 12,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  bottomSpacing: {
    height: 40,
  },
});
