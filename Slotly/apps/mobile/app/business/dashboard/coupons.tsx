"use client";

import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Menu,
  Dialog,
  Portal,
  TextInput,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useTier } from "../../../context/TierContext";
import { VerificationGate } from "../../../components/VerificationGate";
import { LockedFeature } from "../../../components/LockedFeature";
import { Section } from "../../../components/Section";
import { FilterChipsRow } from "../../../components/FilterChipsRow";
import { StatusPill } from "../../../components/StatusPill";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { listCoupons, createCoupon, deleteCoupon } from "../../../lib/api/modules/manager"; // ← real endpoints :contentReference[oaicite:5]{index=5}

type CouponRow = {
  id: string;
  code: string;
  description?: string | null;
  discount: number;          // numeric amount or percent
  isPercentage: boolean;
  expiresAt: string;         // ISO string
  createdAt?: string;
  userCoupons?: Array<{ usedAt: string | null }>;
  usageCount?: number;       // backend GET adds this
  redeemedUsers?: number;    // backend GET adds this
};

type FilterKey = "All" | "Active" | "Expired" | "Expiring Soon";

export default function CouponsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { features } = useTier();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CouponRow[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey[]>(["All"]);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [discount, setDiscount] = useState<string>("10");
  const [isPct, setIsPct] = useState(true);
  const [expires, setExpires] = useState<string>(""); // YYYY-MM-DD

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (features.canUseCoupons) {
      load();
    }
  }, [features.canUseCoupons, selectedFilter]);

  async function load() {
    setLoading(true);
    try {
      // Server can filter active/expired/used; we also do a client filter for "Expiring Soon"
      const f = selectedFilter[0];
      const params: any = {};
      if (f === "Active") params.active = true;
      if (f === "Expired") params.expired = true;
      // "Expiring Soon" is client-side (<= 7 days)
      const res = await listCoupons(params); // returns { coupons } on backend; module returns data.coupons array :contentReference[oaicite:6]{index=6}:contentReference[oaicite:7]{index=7}

      let list = Array.isArray(res) ? res : [];
      if (f === "Expiring Soon") {
        const now = new Date();
        const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        list = list.filter((c) => {
          const d = new Date(c.expiresAt);
          return d > now && d <= soon;
        });
      }
      setItems(list);
    } catch (e: any) {
      console.error("Error loading coupons:", e?.message || e);
      Alert.alert("Error", e?.message || "Failed to load coupons");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filterOptions = [
    { key: "All", label: "All" },
    { key: "Active", label: "Active" },
    { key: "Expired", label: "Expired" },
    { key: "Expiring Soon", label: "Expiring Soon" },
  ];

  function deriveStatus(c: CouponRow): "ACTIVE" | "EXPIRED" | "EXPIRING" {
    const now = new Date();
    const end = new Date(c.expiresAt);
    if (end < now) return "EXPIRED";
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return end <= soon ? "EXPIRING" : "ACTIVE";
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  const usageText = (c: CouponRow) => {
    const used = Number(c.usageCount ?? 0);
    const users = Number(c.redeemedUsers ?? c.userCoupons?.length ?? 0);
    return `${used} uses • ${users} customers`;
  };

  function handleUpgrade() {
    router.push("/business/dashboard/billing");
  }

  function handleCouponAction(coupon: CouponRow, action: string) {
    setMenuVisible(null);
    switch (action) {
      case "edit":
        Alert.alert("Not implemented", "Editing coupons is not available yet.");
        break;
      case "deactivate":
        // No PATCH route yet; you could implement by setting expiresAt=now on backend
        Alert.alert("Not available", "Deactivation requires an update route.");
        break;
      case "extend":
        Alert.alert("Not available", "Extending requires an update route.");
        break;
      case "clone":
        setShowCreate(true);
        setCode(`${coupon.code}-COPY`);
        setDesc(coupon.description || "");
        setDiscount(String(coupon.discount));
        setIsPct(Boolean(coupon.isPercentage));
        setExpires("");
        break;
      case "archive":
        setConfirmDialog({
          visible: true,
          title: "Archive Coupon",
          message: `Are you sure you want to archive "${coupon.code}"?`,
          onConfirm: async () => {
            try {
              await deleteCoupon(coupon.id); // backend forbids deleting used coupons :contentReference[oaicite:8]{index=8}
              await load();
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message || "Could not delete coupon");
            } finally {
              setConfirmDialog((p) => ({ ...p, visible: false }));
            }
          },
        });
        break;
    }
  }

  async function handleCreate() {
    try {
      if (!code.trim() || !discount || !expires) {
        return Alert.alert("Missing fields", "Code, discount and expiry date are required.");
      }
      const payload = {
        code: code.trim(),
        description: desc || undefined,
        discount: Number(discount),
        isPercentage: Boolean(isPct),
        expiresAt: new Date(expires).toISOString(),
      };
      await createCoupon(payload); // POST /api/manager/coupons :contentReference[oaicite:9]{index=9}
      setShowCreate(false);
      setCode(""); setDesc(""); setDiscount("10"); setIsPct(true); setExpires("");
      await load();
    } catch (e: any) {
      Alert.alert("Create failed", e?.message || "Could not create coupon");
    }
  }

  if (!features.canUseCoupons) {
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
              description="Coupons are available on plans that include marketing features."
              onPressUpgrade={handleUpgrade}
            />
          </View>
        </View>
      </VerificationGate>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading coupons...</Text>
      </View>
    );
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
            onSelectionChange={(v) => setSelectedFilter(v as FilterKey[])}
            multiSelect={false}
          />
        </Section>

        {/* Create Coupon */}
        <View style={styles.actionContainer}>
          <Button
            mode="contained"
            onPress={() => setShowCreate(true)}
            style={[styles.createButton, { backgroundColor: theme.colors.secondary }]}
            icon="plus"
          >
            Create New Coupon
          </Button>
        </View>

        {/* Coupons */}
        <Section title={`Coupons (${items.length})`}>
          <View style={styles.couponsContainer}>
            {items.length === 0 ? (
              <Surface style={styles.emptyState} elevation={1}>
                <Text style={styles.emptyText}>No coupons found</Text>
                <Text style={styles.emptySubtext}>Create your first coupon to start promoting your services</Text>
              </Surface>
            ) : (
              items.map((coupon) => {
                const status = deriveStatus(coupon);
                return (
                  <Surface key={coupon.id} style={styles.couponCard} elevation={2}>
                    <View style={styles.couponHeader}>
                      <View style={styles.couponInfo}>
                        <Text style={styles.couponName}>{coupon.code}</Text>
                        {!!coupon.description && <Text style={styles.couponDescription}>{coupon.description}</Text>}
                      </View>
                      <View style={styles.couponStatus}>
                        <StatusPill status={status} size="small" />
                        <Menu
                          visible={menuVisible === coupon.id}
                          onDismiss={() => setMenuVisible(null)}
                          anchor={
                            <IconButton icon="dots-vertical" size={20} onPress={() => setMenuVisible(coupon.id)} />
                          }
                        >
                          <Menu.Item onPress={() => handleCouponAction(coupon, "edit")} title="Edit" />
                          <Menu.Item onPress={() => handleCouponAction(coupon, "extend")} title="Extend" />
                          <Menu.Item onPress={() => handleCouponAction(coupon, "clone")} title="Clone" />
                          <Menu.Item onPress={() => handleCouponAction(coupon, "archive")} title="Archive" />
                        </Menu>
                      </View>
                    </View>

                    <View style={styles.couponMetrics}>
                      <View style={styles.metric}>
                        <Text style={styles.metricValue}>
                          {coupon.isPercentage ? `${coupon.discount}% off` : `KSh ${Number(coupon.discount).toLocaleString()}`}
                        </Text>
                        <Text style={styles.metricLabel}>Discount</Text>
                      </View>
                      <View style={styles.metric}>
                        <Text style={styles.metricValue}>{usageText(coupon)}</Text>
                        <Text style={styles.metricLabel}>Usage</Text>
                      </View>
                      <View style={styles.metric}>
                        <Text style={styles.metricValue}>{formatDate(coupon.expiresAt)}</Text>
                        <Text style={styles.metricLabel}>Expires</Text>
                      </View>
                    </View>
                  </Surface>
                );
              })
            )}
          </View>
        </Section>

        <ConfirmDialog
          visible={confirmDialog.visible}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog((prev) => ({ ...prev, visible: false }))}
          destructive
        />

        {/* Create dialog */}
        <Portal>
          <Dialog visible={showCreate} onDismiss={() => setShowCreate(false)}>
            <Dialog.Title>Create Coupon</Dialog.Title>
            <Dialog.Content>
              <TextInput label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
              <TextInput label="Description" value={desc} onChangeText={setDesc} style={{ marginTop: 8 }} />
              <TextInput
                label={isPct ? "Discount (%)" : "Discount (KES)"}
                keyboardType="numeric"
                value={discount}
                onChangeText={setDiscount}
                style={{ marginTop: 8 }}
              />
              <TextInput
                label="Expires (YYYY-MM-DD)"
                placeholder="YYYY-MM-DD"
                value={expires}
                onChangeText={setExpires}
                style={{ marginTop: 8 }}
              />
              <Button
                mode="text"
                onPress={() => setIsPct((v) => !v)}
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              >
                {isPct ? "Use fixed amount" : "Use percentage"}
              </Button>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowCreate(false)}>Cancel</Button>
              <Button onPress={handleCreate}>Create</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  );
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