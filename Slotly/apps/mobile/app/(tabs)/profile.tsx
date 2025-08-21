import React, { useState, useMemo, useContext } from "react";
import { View, ScrollView, StyleSheet, Platform, Share } from "react-native";
import {
  Text,
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  useTheme,
  Surface,
  Chip,
  Snackbar,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { SessionContext } from "../../context/SessionContext";
import ListRow from "../components/ui/ListRow";
import UICard from "../components/ui/Card";

type UserData = {
  name: string;
  email: string;
  phone: string;
  profileImage?: string;
  joinDate: string;
  totalBookings: number;
  userId?: string;
};

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const session: any = useContext(SessionContext as any);
  const [userData] = useState<UserData>({
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+254 712 345 678",
    profileImage: "https://via.placeholder.com/150x150.png?text=JD",
    joinDate: "January 2024",
    totalBookings: 12,
    userId: "u1001",
  });

  const resolvedUserId: string | undefined = useMemo(() => {
    const u = (session && session.user) ? session.user : {};
    return u.userId || u.id || userData.userId;
  }, [session, userData.userId]);

  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: "" });

  const copyOrShareUserId = async () => {
    if (!resolvedUserId) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(resolvedUserId);
        setSnack({ visible: true, msg: "User ID copied" });
      } else {
        await Share.share({ message: `My Slotly User ID: ${resolvedUserId}` });
        setSnack({ visible: true, msg: "User ID ready to share" });
      }
    } catch {
      setSnack({ visible: true, msg: "Could not copy/share User ID" });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <IconButton icon="cog" size={24} onPress={() => router.push("/settings" as any)} />
      </View>

      {/* Profile summary */}
      <UICard style={{ marginHorizontal: 16, marginBottom: 16, padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Avatar.Image size={80} source={{ uri: userData.profileImage }} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 2 }}>
              Hello,
            </Text>
            <Text variant="headlineSmall" style={{ fontWeight: "800", color: theme.colors.primary, marginBottom: 2 }}>
              {userData.name}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Member since {userData.joinDate}
            </Text>
          </View>
        </View>

        {/* ID row (prominent) */}
        <Card mode="contained" style={{ borderRadius: 12, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
            <View
              style={{
                backgroundColor: "rgba(245,124,0,0.15)",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontWeight: "800", color: theme.colors.secondary }}>USER ID</Text>
            </View>
            <Text
              selectable
              style={{
                fontSize: 16,
                fontWeight: "700",
                letterSpacing: 0.4,
                color: theme.colors.onSurface,
                flex: 1,
              }}
            >
              {resolvedUserId ?? "—"}
            </Text>
            {!!resolvedUserId && (
              <Chip icon={Platform.OS === "web" ? "content-copy" : "share-variant"} onPress={copyOrShareUserId} compact>
                {Platform.OS === "web" ? "Copy" : "Share"}
              </Chip>
            )}
          </View>
        </Card>

        {/* Contact stats */}
        <Card mode="outlined" style={{ marginTop: 12 }}>
          <Card.Content>
            <ListRow label="Email" value={userData.email} />
            <Divider />
            <ListRow label="Phone" value={userData.phone} />
            <Divider />
            <ListRow label="Total Bookings" value={String(userData.totalBookings)} />
          </Card.Content>
        </Card>
      </UICard>

      {/* Favourites */}
      <Section title="Favourites">
        <HScroller
          items={[
            { id: 1, name: "Hair Cut", image: "https://via.placeholder.com/60x60.png?text=Hair" },
            { id: 2, name: "Manicure", image: "https://via.placeholder.com/60x60.png?text=Nails" },
            { id: 3, name: "Massage", image: "https://via.placeholder.com/60x60.png?text=Spa" },
            { id: 4, name: "Barber", image: "https://via.placeholder.com/60x60.png?text=Cut" },
            { id: 5, name: "Facial", image: "https://via.placeholder.com/60x60.png?text=Face" },
            { id: 6, name: "Makeup", image: "https://via.placeholder.com/60x60.png?text=MU" },
          ]}
        />
      </Section>

      {/* Frequently visited */}
      <Section title="Frequently visited">
        <HScroller
          items={[
            { id: 1, name: "Bella Salon", image: "https://via.placeholder.com/60x60.png?text=BS" },
            { id: 2, name: "Gents Barber", image: "https://via.placeholder.com/60x60.png?text=GB" },
            { id: 3, name: "Spa Relax", image: "https://via.placeholder.com/60x60.png?text=SR" },
            { id: 4, name: "Nail Studio", image: "https://via.placeholder.com/60x60.png?text=NS" },
            { id: 5, name: "Hair Plus", image: "https://via.placeholder.com/60x60.png?text=HP" },
            { id: 6, name: "Beauty Hub", image: "https://via.placeholder.com/60x60.png?text=BH" },
          ]}
        />
      </Section>

      {/* Quick actions */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 20 }}>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.push("/(tabs)/history" as any)}>
          Booking History
        </Button>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.push("/favorites" as any)}>
          My Favorites
        </Button>
      </View>

      {/* Edit Profile CTA */}
      <View style={{ paddingHorizontal: 16 }}>
        <Button mode="contained" onPress={() => router.push("/edit-profile" as any)}>
          Edit Profile
        </Button>
      </View>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: "" })}
        duration={2200}
        style={{ marginHorizontal: 16, marginTop: 10 }}
      >
        {snack.msg}
      </Snackbar>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 18 }}>
      <Text variant="titleMedium" style={{ fontWeight: "800", color: theme.colors.primary, marginBottom: 8 }}>
        {title}
      </Text>
      <UICard>
        {children}
      </UICard>
    </View>
  );
}

function HScroller({ items }: { items: { id: number; name: string; image: string }[] }) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 12 }}
    >
      {items.map((x) => (
        <View key={x.id} style={{ alignItems: "center", width: 84 }}>
          <Avatar.Image size={60} source={{ uri: x.image }} style={{ backgroundColor: theme.colors.surface }} />
          <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 6, color: theme.colors.onSurface, fontWeight: "600" }}>
            {x.name}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
