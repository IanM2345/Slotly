// apps/mobile/app/admin/index.tsx
import * as React from "react";
import { View, FlatList, Alert, Linking, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { 
  useTheme, 
  Text, 
  Button, 
  Card, 
  ActivityIndicator, 
  TextInput, 
  Banner, 
  Divider, 
  IconButton,
  Chip,
  Surface
} from "react-native-paper";
import { useSession } from "../../context/SessionContext";
import { listPending, getBusinessDetail, approveBusiness, rejectBusiness } from "../../lib/api/modules/admin";

type PendingItem = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  suspended?: boolean;
  owner?: { 
    id: string; 
    email: string; 
    name?: string;
    phone?: string;
  };
  verification?: { 
    status: string; 
    createdAt?: string;
    updatedAt?: string;
  };
  stats?: {
    attachmentsCount?: number;
    totalCampaigns?: number;
    totalStaff?: number;
    totalCustomers?: number;
  };
};

type BusinessDetail = {
  id: string;
  name: string;
  description?: string;
  owner?: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
  };
  verification?: {
    status: string;
    createdAt?: string;
    payload?: any;
    reviewNotes?: string;
  };
  attachments?: Array<{
    id: string;
    label?: string;
    url: string;
    mimeType?: string;
    fileSize?: number;
  }>;
  subscription?: any;
  staff?: any[];
  adCampaigns?: any[];
};

export default function AdminIndex() {
  const { colors } = useTheme();
  const router = useRouter();
  const { token, user } = useSession();

  const [items, setItems] = React.useState<PendingItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState(""); // Actual search query
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ 
    visible: boolean; 
    message: string; 
    tone: "info" | "error" | "success";
  }>({
    visible: false,
    message: "",
    tone: "info",
  });

  // Check admin permissions
  const role = String(user?.role || "").toUpperCase();
  const isAdmin = ["ADMIN", "SUPER_ADMIN", "CREATOR"].includes(role);

  // Auto-hide banner after 5 seconds
  React.useEffect(() => {
    if (banner.visible) {
      const timer = setTimeout(() => {
        setBanner(prev => ({ ...prev, visible: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [banner.visible]);

  // Initial load
  React.useEffect(() => {
    if (!token) return;
    if (!isAdmin) {
      setBanner({ 
        visible: true, 
        message: "Access denied. Admin privileges required.", 
        tone: "error" 
      });
    } else {
      loadPendingBusinesses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  const loadPendingBusinesses = React.useCallback(async (search = searchQuery) => {
    if (!token || !isAdmin) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const res = await listPending(token, { 
        page: 1, 
        pageSize: 50, 
        query: search 
      });
      
      setItems(res.items || []);
    } catch (e: any) {
      console.error('Failed to load pending businesses:', e);
      setError(e.message);
      setBanner({ 
        visible: true, 
        message: `Failed to load: ${e.message}`, 
        tone: "error" 
      });
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, searchQuery]);

  const handleRefresh = React.useCallback(async () => {
    if (!token || !isAdmin) return;
    
    try {
      setRefreshing(true);
      await loadPendingBusinesses();
    } catch (e: any) {
      setBanner({ 
        visible: true, 
        message: `Refresh failed: ${e.message}`, 
        tone: "error" 
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadPendingBusinesses, token, isAdmin]);

  const handleSearch = React.useCallback(() => {
    setSearchQuery(query);
    loadPendingBusinesses(query);
  }, [query, loadPendingBusinesses]);

  // Handle search on text input submission
  const handleSearchSubmit = React.useCallback(() => {
    handleSearch();
  }, [handleSearch]);

  async function openDetail(id: string) {
    if (!token || busyId) return;
    
    try {
      setBusyId(id);
      const detail: BusinessDetail = await getBusinessDetail(id, token);
      
      // Format business details for display
      const info = [
        `Owner: ${detail.owner?.name || detail.owner?.email || "Unknown"}`,
        detail.owner?.phone ? `Phone: ${detail.owner.phone}` : null,
        `Email: ${detail.owner?.email || "n/a"}`,
        `Status: ${detail.verification?.status || "pending"}`,
        `Submitted: ${detail.verification?.createdAt ? new Date(detail.verification.createdAt).toLocaleString() : "n/a"}`,
        detail.attachments?.length ? `Attachments: ${detail.attachments.length}` : "No attachments",
        detail.description ? `Description: ${detail.description}` : null,
        detail.verification?.reviewNotes ? `Notes: ${detail.verification.reviewNotes}` : null,
      ].filter(Boolean).join("\n");

      // Create alert buttons for attachments
      const attachmentButtons = detail.attachments?.slice(0, 3).map((att, index) => ({
        text: `📎 ${att.label || `File ${index + 1}`}`,
        onPress: () => {
          if (att.url) {
            Linking.openURL(att.url).catch(() => {
              setBanner({ 
                visible: true, 
                message: "Failed to open attachment", 
                tone: "error" 
              });
            });
          }
        },
      })) || [];

      Alert.alert(
        detail.name || "Business Details",
        info,
        [
          ...attachmentButtons,
          ...(detail.attachments && detail.attachments.length > 3 ? 
            [{ text: `+${detail.attachments.length - 3} more files`, style: "default" as const }] : 
            []
          ),
          { text: "Close", style: "cancel" as const },
        ]
      );
    } catch (e: any) {
      console.error('Failed to load business detail:', e);
      setBanner({ 
        visible: true, 
        message: `Failed to load details: ${e.message}`, 
        tone: "error" 
      });
    } finally {
      setBusyId(null);
    }
  }

  async function approve(id: string) {
    if (!token || busyId) return;
    
    try {
      setBusyId(id);
      await approveBusiness(id, token, { 
        idempotencyKey: `approve:${id}:${Date.now()}` 
      });
      
      // Optimistically remove from list
      setItems(prev => prev.filter(x => x.id !== id));
      setBanner({ 
        visible: true, 
        message: "Business approved successfully!", 
        tone: "success" 
      });
    } catch (e: any) {
      console.error('Failed to approve business:', e);
      setBanner({ 
        visible: true, 
        message: `Approval failed: ${e.message}`, 
        tone: "error" 
      });
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!token || busyId) return;
    
    const businessName = items.find(item => item.id === id)?.name || "this business";
    
    Alert.alert(
      "Reject Application", 
      `Are you sure you want to reject "${businessName}"? This will permanently remove the business and all related data.`, 
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyId(id);
              await rejectBusiness(
                id, 
                { 
                  purge: true 
                }, 
                token, 
                { 
                  idempotencyKey: `reject:${id}:${Date.now()}` 
                }
              );
              
              // Optimistically remove from list
              setItems(prev => prev.filter(x => x.id !== id));
              setBanner({ 
                visible: true, 
                message: "Business rejected and removed.", 
                tone: "success" 
              });
            } catch (e: any) {
              console.error('Failed to reject business:', e);
              setBanner({ 
                visible: true, 
                message: `Rejection failed: ${e.message}`, 
                tone: "error" 
              });
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  // Show forbidden message for non-admin users
  if (!isAdmin) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text variant="titleLarge" style={{ color: colors.error }}>
          Access Denied
        </Text>
        <Text>
          You don't have permission to access the admin dashboard. 
          Your current role is "{role || "unknown"}".
        </Text>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 8 }}>
          Contact your administrator if you believe this is an error.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <Surface style={{ padding: 16, elevation: 1 }}>
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          justifyContent: "space-between", 
          marginBottom: 12 
        }}>
          <Text variant="titleLarge">Admin Dashboard</Text>
          <Chip icon="account-circle" compact>
            {user?.email?.split('@')[0] || 'Admin'}
          </Chip>
        </View>

        {/* Search Bar */}
        <TextInput
          mode="outlined"
          placeholder="Search pending businesses..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearchSubmit}
          right={
            <TextInput.Icon 
              icon="magnify" 
              onPress={handleSearch}
              disabled={loading}
            />
          }
          style={{ marginBottom: 8 }}
        />

        {/* Stats */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip icon="clock-outline" compact>
            {items.length} pending
          </Chip>
          {searchQuery && (
            <Chip 
              icon="magnify" 
              compact 
              onClose={() => {
                setQuery("");
                setSearchQuery("");
                loadPendingBusinesses("");
              }}
            >
              "{searchQuery}"
            </Chip>
          )}
        </View>
      </Surface>

      {/* Banner */}
      {banner.visible && (
        <Banner
          visible
          icon={
            banner.tone === "error" ? "alert" : 
            banner.tone === "success" ? "check-circle" : 
            "information"
          }
          actions={[
            { 
              label: "Dismiss", 
              onPress: () => setBanner(prev => ({ ...prev, visible: false }))
            }
          ]}
          style={{
            backgroundColor: 
              banner.tone === "error" ? colors.errorContainer :
              banner.tone === "success" ? colors.primaryContainer :
              colors.secondaryContainer
          }}
        >
          {banner.message}
        </Banner>
      )}

      {/* Content */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 16, color: colors.onSurfaceVariant }}>
            Loading pending businesses...
          </Text>
        </View>
      ) : error && !banner.visible ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text style={{ color: colors.error, textAlign: "center", marginBottom: 16 }}>
            {error}
          </Text>
          <Button mode="outlined" onPress={handleRefresh} icon="refresh">
            Try Again
          </Button>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 16 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <Card 
              style={{ margin: 8, marginVertical: 6 }} 
              onPress={() => openDetail(item.id)}
              disabled={busyId === item.id}
            >
              <Card.Title
                title={item.name}
                titleNumberOfLines={2}
                subtitle={[
                  item.owner?.name || item.owner?.email || "Unknown owner",
                  item.verification?.createdAt ? 
                    new Date(item.verification.createdAt).toLocaleDateString() : 
                    "No date"
                ].join(" • ")}
                right={(props) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {busyId === item.id && (
                      <ActivityIndicator size="small" style={{ marginRight: 8 }} />
                    )}
                    <IconButton
                      {...props}
                      icon="open-in-new"
                      onPress={() => openDetail(item.id)}
                      disabled={busyId === item.id}
                    />
                  </View>
                )}
              />
              
              <Card.Content style={{ paddingTop: 8 }}>
                {item.description && (
                  <Text 
                    numberOfLines={2} 
                    style={{ color: colors.onSurfaceVariant, marginBottom: 8 }}
                  >
                    {item.description}
                  </Text>
                )}
                
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Chip icon="paperclip" compact>
                    {item.stats?.attachmentsCount || 0} files
                  </Chip>
                  {item.suspended && (
                    <Chip icon="pause" compact textStyle={{ color: colors.error }}>
                      Suspended
                    </Chip>
                  )}
                  <Chip 
                    icon="check-circle-outline" 
                    compact 
                    style={{ backgroundColor: colors.secondaryContainer }}
                  >
                    {item.verification?.status || "pending"}
                  </Chip>
                </View>
              </Card.Content>
              
              <Card.Actions>
                <Button
                  mode="contained"
                  onPress={() => approve(item.id)}
                  disabled={busyId !== null}
                  loading={busyId === item.id}
                  icon="check"
                  style={{ marginRight: 8 }}
                >
                  Approve
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => reject(item.id)}
                  disabled={busyId !== null}
                  loading={busyId === item.id}
                  icon="close"
                  textColor={colors.error}
                  style={{ borderColor: colors.error }}
                >
                  Reject
                </Button>
              </Card.Actions>
            </Card>
          )}
          ListEmptyComponent={() => (
            <View style={{ alignItems: "center", padding: 32 }}>
              <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant, textAlign: "center" }}>
                {searchQuery ? 
                  `No businesses found matching "${searchQuery}"` : 
                  "No pending applications"
                }
              </Text>
              {searchQuery && (
                <Button 
                  mode="text" 
                  onPress={() => {
                    setQuery("");
                    setSearchQuery("");
                    loadPendingBusinesses("");
                  }}
                  style={{ marginTop: 8 }}
                >
                  Clear search
                </Button>
              )}
            </View>
          )}
          contentContainerStyle={{ 
            paddingBottom: 24,
            ...(items.length === 0 && { flex: 1, justifyContent: 'center' })
          }}
        />
      )}
    </View>
  );
}