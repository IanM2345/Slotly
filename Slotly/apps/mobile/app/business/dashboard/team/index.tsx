"use client";

import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { Text, Searchbar, List, Button, Surface, Chip, useTheme, Snackbar } from "react-native-paper";
import { Link } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "../../../../context/SessionContext";
import { listStaff, reviewStaffEnrollment } from "../../../../lib/api/modules/manager";

export default function TeamList() {
  const theme = useTheme();
  const { token, user } = useSession();
  const businessId = user?.business?.id;

  const [q, setQ] = useState("");
  const [approved, setApproved] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [limits, setLimits] = useState<{ remaining?: number; totalAllowed?: number; approvedCount?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string; type: 'success' | 'error' }>({
    visible: false,
    msg: "",
    type: 'success'
  });

  // Debug: Log acting user info
  console.log("👤 TeamList - Acting as:", user?.role, user?.id);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listStaff(businessId);
      const a = Array.isArray(data?.approvedStaff) ? data.approvedStaff : [];
      const p = Array.isArray(data?.pendingEnrollments) ? data.pendingEnrollments : [];
      setApproved(a);
      setPending(p);
      setLimits(data?.limits ?? null);
      
      // Debug: Log limits info
      console.log("📊 Staff limits:", data?.limits);
    } catch (error) {
      console.error("Failed to load staff:", error);
      setApproved([]);
      setPending([]);
      setLimits(null);
    } finally {
      setLoading(false);
    }
  }, [token, businessId]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleApproval = async (enrollmentId: string, status: "APPROVED" | "REJECTED") => {
    if (processingId) return; // Prevent multiple simultaneous requests
    
    setProcessingId(enrollmentId);
    
    try {
      await reviewStaffEnrollment({ enrollmentId, status });
      
      // Show success message
      setSnack({
        visible: true,
        msg: status === "APPROVED" ? "Staff member approved successfully!" : "Application rejected",
        type: 'success'
      });
      
      // Reload the list
      load();
    } catch (error: any) {
      console.error(`Failed to ${status.toLowerCase()} staff:`, {
        enrollmentId,
        status: error?.response?.status,
        error: error?.response?.data,
        fullError: error
      });
      
      // Extract detailed error information
      const serverError = error?.response?.data;
      let errorMessage = "Failed to process request";
      
      if (serverError?.code === 'LIMIT_REACHED') {
        const limits = serverError?.limits;
        errorMessage = `${serverError.error} (${limits?.approvedCount}/${limits?.totalAllowed} used)`;
        
        // Also update local limits state to reflect the current state
        if (limits) {
          setLimits(limits);
        }
      } else if (serverError?.error) {
        errorMessage = serverError.error;
        if (serverError?.suggestion) {
          errorMessage += ` ${serverError.suggestion}`;
        }
      } else if (error?.response?.status === 403) {
        if (user?.role !== 'BUSINESS_OWNER') {
          errorMessage = "Only business owners can approve staff";
        } else {
          errorMessage = "You don't have permission to approve this staff member";
        }
      }
      
      setSnack({
        visible: true,
        msg: errorMessage,
        type: 'error'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredApproved = approved.filter((m) =>
    `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );
  const filteredPending = pending.filter((e) =>
    `${e?.user?.name ?? ""} ${e?.user?.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  // Check if approvals should be disabled
  const canApprove = user?.role === 'BUSINESS_OWNER' && (limits?.remaining ?? 0) > 0;
  const isAtLimit = (limits?.remaining ?? 0) <= 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text variant="headlineSmall" style={{ fontWeight: "700" }}>Team</Text>
          {/* Debug info */}
          <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>
            Role: {user?.role} | Business: {businessId}
          </Text>
        </View>
        <Link href="/business/dashboard/team/new" asChild>
          <Button
            mode="contained"
            disabled={isAtLimit || user?.role !== 'BUSINESS_OWNER'}
          >
            {isAtLimit ? "Limit Reached" : "Add Staff"}
          </Button>
        </Link>
      </View>

      {limits && (
        <View style={{ backgroundColor: theme.colors.surfaceVariant, padding: 12, borderRadius: 8 }}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>
            Staff Usage: {limits.approvedCount ?? 0}/{limits.totalAllowed ?? 0}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
            {isAtLimit 
              ? "Upgrade your plan or purchase an Extra Staff add-on to approve more staff"
              : `${limits.remaining ?? 0} slots remaining`
            }
          </Text>
        </View>
      )}

      {user?.role !== 'BUSINESS_OWNER' && (
        <View style={{ backgroundColor: theme.colors.errorContainer, padding: 12, borderRadius: 8 }}>
          <Text style={{ color: theme.colors.onErrorContainer }}>
            Only business owners can approve staff members. Current role: {user?.role}
          </Text>
        </View>
      )}

      <Searchbar value={q} onChangeText={setQ} placeholder="Search staff" style={{ borderRadius: 12 }} />

      {/* Approved staff */}
      <Text style={{ fontWeight: "700", marginTop: 8 }}>Approved</Text>
      <Surface elevation={1} style={{ borderRadius: 16 }}>
        {filteredApproved.map((u) => (
          <Link key={u.id} href={`./${u.id}`} asChild>
            <List.Item
              title={u.name ?? "—"}
              description={u.email ?? "—"}
              right={() => <Chip compact style={{ alignSelf: "center" }}>approved</Chip>}
            />
          </Link>
        ))}
        {filteredApproved.length === 0 && (
          <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>No staff yet.</Text>
        )}
      </Surface>

      {/* Pending enrollments */}
      <Text style={{ fontWeight: "700", marginTop: 16 }}>Pending Approvals</Text>
      <Surface elevation={1} style={{ borderRadius: 16 }}>
        {filteredPending.map((e) => (
          <List.Item
            key={e.id}
            title={e?.user?.name ?? "—"}
            description={e?.user?.email ?? "—"}
            right={() => (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button 
                  compact 
                  mode="contained"
                  disabled={!canApprove || processingId === e.id}
                  loading={processingId === e.id}
                  onPress={() => handleApproval(e.id, "APPROVED")}
                  style={{ 
                    backgroundColor: canApprove ? theme.colors.primary : theme.colors.surfaceDisabled 
                  }}
                >
                  Approve
                </Button>
                <Button 
                  compact 
                  mode="outlined"
                  disabled={user?.role !== 'BUSINESS_OWNER' || processingId === e.id}
                  loading={processingId === e.id}
                  onPress={() => handleApproval(e.id, "REJECTED")}
                >
                  Reject
                </Button>
              </View>
            )}
          />
        ))}
        {filteredPending.length === 0 && (
          <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>No pending requests.</Text>
        )}
      </Surface>

      {/* Enhanced Snackbar for feedback */}
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: "", type: 'success' })}
        duration={snack.type === 'error' ? 6000 : 3000}
        style={{ 
          backgroundColor: snack.type === 'error' ? theme.colors.errorContainer : theme.colors.primaryContainer 
        }}
        action={snack.type === 'error' ? {
          label: 'Dismiss',
          onPress: () => setSnack({ visible: false, msg: "", type: 'success' }),
          textColor: theme.colors.onErrorContainer
        } : undefined}
      >
        <Text style={{ 
          color: snack.type === 'error' ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer 
        }}>
          {snack.msg}
        </Text>
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    justifyContent: "space-between",
    marginBottom: 8
  },
});