import { useEffect, useMemo, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Chip,
  Dialog,
  Portal,
  TextInput,
  Checkbox,
  Divider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { VerificationGate } from "../../../../components/VerificationGate";
import { Section } from "../../../../components/Section";
import { FilterChipsRow } from "../../../../components/FilterChipsRow";
import { useSession } from "../../../../context/SessionContext";

// Import Sentry conditionally to avoid the __extends error
let Sentry: any = null;
try {
  Sentry = require("sentry-expo");
} catch (error) {
  console.warn("Sentry import failed:", error);
}

// API (new module)
import {
  listServices,
  listBundles,
  createService,
  updateService,
  deleteService,
  listStaff,
  assignStaffToService,
  unassignStaffFromService,
} from "../../../../lib/api/modules/manager";

type Category = "hair" | "spa" | "nails";
type StaffLite = { id: string; name: string };
type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration: number;           // minutes (backend)
  category: Category;
  available: boolean;
  businessId?: string;        // for client-side filtering
  staff?: StaffLite[];        // included by GET
  description?: string | null;
};

type BundleRow = {
  id: string;
  name: string;
  price: number;
  duration: number;
  businessId?: string;        // for client-side filtering
  services: { service: { id: string; name: string } }[]; // backend include
  description?: string | null;
};

export default function ServicesIndexScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useSession();
  const myBusinessId = user?.business?.id;

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>(["All Services"]);

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState<null | ServiceRow>(null);
  const [editOpen, setEditOpen] = useState<null | ServiceRow>(null);

  // create form
  const [cName, setCName] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cDuration, setCDuration] = useState("");
  const [cCategory, setCCategory] = useState<Category>("hair");
  const [allStaff, setAllStaff] = useState<StaffLite[]>([]);
  const [createSelected, setCreateSelected] = useState<string[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // manage staff dialog
  const [manageSelected, setManageSelected] = useState<string[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const category =
        selectedCategory[0] === "All Services" || selectedCategory[0] === "Bundles"
          ? undefined
          : (selectedCategory[0].toLowerCase() as Category);

      // Fetch independently to avoid all-or-nothing failures
      const [svcRes, bunRes] = await Promise.allSettled([
        listServices(category ? { category } : undefined),
        listBundles(),
      ]);

      // Handle service results
      if (svcRes.status === "fulfilled" && Array.isArray(svcRes.value)) {
        const filteredServices = myBusinessId 
          ? svcRes.value.filter(s => s.businessId === myBusinessId) 
          : svcRes.value;
        setServices(filteredServices);
      } else {
        console.error("Failed to load services:", svcRes.status === "rejected" ? svcRes.reason : "Invalid data");
        setServices([]);
      }

      // Handle bundle results
      if (bunRes.status === "fulfilled" && Array.isArray(bunRes.value)) {
        const filteredBundles = myBusinessId 
          ? bunRes.value.filter(b => b.businessId === myBusinessId) 
          : bunRes.value;
        setBundles(filteredBundles);
      } else {
        console.error("Failed to load bundles:", bunRes.status === "rejected" ? bunRes.reason : "Invalid data");
        setBundles([]);
      }
      
    } catch (err: any) {
      // Should rarely hit due to allSettled, but keep resilient
      setServices([]); 
      setBundles([]);
      console.error("Error loading services:", err?.message || err);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(err);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  // Refresh when screen comes into focus (after creating bundles)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedCategory])
  );

  const filteredServices =
    selectedCategory[0] === "Bundles"
      ? []
      : services;

  const showBundles =
    selectedCategory[0] === "Bundles" || selectedCategory[0] === "All Services";

  /* --------------------- Create Service (+ pre-assign) --------------------- */

  async function openCreate() {
    try {
      setCreateOpen(true);
      setLoadingStaff(true);
      // load approved staff list for selection
      const staffResp = await listStaff(myBusinessId);
      setAllStaff(staffResp?.approvedStaff || []);
    } catch (e: any) {
      console.error("Error loading staff for create dialog:", e);
      setAllStaff([]);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    } finally {
      setLoadingStaff(false);
    }
  }

  function toggleCreateStaff(id: string) {
    setCreateSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    try {
      if (!cName.trim() || !cPrice || !cDuration) {
        return Alert.alert("Missing fields", "Name, price and duration are required.");
      }

      const priceNum = Number(cPrice);
      const durationNum = Number(cDuration);

      if (priceNum <= 0 || durationNum <= 0) {
        return Alert.alert("Invalid values", "Price and duration must be greater than 0.");
      }

      const payload = {
        name: cName.trim(),
        price: priceNum,
        duration: durationNum,
        category: cCategory,
        available: true,
      };
      const created = await createService(payload);

      // pre-assign selected staff
      for (const staffId of createSelected) {
        try {
          await assignStaffToService({ serviceId: created.id, staffId });
        } catch (staffError) {
          console.warn("Failed to assign staff during create:", staffId, staffError);
        }
      }

      setCreateOpen(false);
      setCName(""); 
      setCPrice(""); 
      setCDuration(""); 
      setCCategory("hair"); 
      setCreateSelected([]);
      
      await loadData();
      
      Alert.alert("Success", "Service created successfully!");
      
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || e?.message || "Could not create service";
      Alert.alert("Create failed", errorMsg);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    }
  }

  /* ----------------------- Manage staff for a service ---------------------- */

  async function openManage(svc: ServiceRow) {
    try {
      setManageOpen(svc);
      setLoadingStaff(true);
      const staffResp = await listStaff(myBusinessId);
      setAllStaff(staffResp?.approvedStaff || []);
      setManageSelected((svc.staff || []).map((s) => s.id));
    } catch (e: any) {
      console.error("Error loading staff for manage dialog:", e);
      setAllStaff([]);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    } finally {
      setLoadingStaff(false);
    }
  }

  function toggleManageStaff(id: string) {
    setManageSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveManage() {
    try {
      if (!manageOpen) return;
      
      const original = new Set((manageOpen.staff || []).map((s) => s.id));
      const now = new Set(manageSelected);

      // to assign
      for (const id of now) {
        if (!original.has(id)) {
          await assignStaffToService({ serviceId: manageOpen.id, staffId: id });
        }
      }
      // to unassign
      for (const id of original) {
        if (!now.has(id)) {
          await unassignStaffFromService({ serviceId: manageOpen.id, staffId: id });
        }
      }

      setManageOpen(null);
      await loadData();
      
      Alert.alert("Success", "Staff assignments updated successfully!");
      
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || e?.message || "Could not update assignments";
      Alert.alert("Update failed", errorMsg);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    }
  }

  /* -------------------------- Edit basic service -------------------------- */

  async function openEdit(svc: ServiceRow) {
    setEditOpen(svc);
    setCName(svc.name);
    setCPrice(String(svc.price));
    setCDuration(String(svc.duration));
    setCCategory(svc.category);
  }

  async function saveEdit() {
    try {
      if (!editOpen) return;

      if (!cName.trim() || !cPrice || !cDuration) {
        return Alert.alert("Missing fields", "Name, price and duration are required.");
      }

      const priceNum = Number(cPrice);
      const durationNum = Number(cDuration);

      if (priceNum <= 0 || durationNum <= 0) {
        return Alert.alert("Invalid values", "Price and duration must be greater than 0.");
      }

      await updateService({
        id: editOpen.id,
        name: cName.trim(),
        price: priceNum,
        duration: durationNum,
        category: cCategory,
      });
      
      setEditOpen(null);
      setCName(""); 
      setCPrice(""); 
      setCDuration("");
      
      await loadData();
      
      Alert.alert("Success", "Service updated successfully!");
      
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || e?.message || "Could not update service";
      Alert.alert("Save failed", errorMsg);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    }
  }

  /* -------------------------- Delete service -------------------------- */

  async function deleteServiceHandler(serviceId: string) {
    try {
      await deleteService({ id: serviceId });
      await loadData();
      Alert.alert("Success", "Service deleted successfully");
    } catch (e: any) {
      const errorMsg = e?.response?.data?.error || e?.message || "Could not delete service";
      Alert.alert("Delete failed", errorMsg);
      if (Sentry?.Native?.captureException) {
        Sentry.Native.captureException(e);
      }
    }
  }

  const confirmDelete = (service: ServiceRow) => {
    Alert.alert(
      "Delete Service", 
      `Are you sure you want to delete "${service.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteServiceHandler(service.id) 
        }
      ]
    );
  };

  /* --------------------------------- UI ---------------------------------- */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={24} 
            iconColor={theme.colors.onSurface} 
            onPress={() => router.back()} 
          />
          <Text style={styles.title}>Services & Bundles</Text>
        </View>

        {/* Category Filters */}
        <Section title="Categories">
          <FilterChipsRow
            options={[
              { key: "All Services", label: "All Services" },
              { key: "Hair", label: "Hair" },
              { key: "Spa", label: "Spa" },
              { key: "Nails", label: "Nails" },
              { key: "Bundles", label: "Bundles" },
            ]}
            selectedKeys={selectedCategory}
            onSelectionChange={setSelectedCategory}
            multiSelect={false}
          />
        </Section>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <Button 
            mode="outlined" 
            onPress={openCreate} 
            style={styles.actionButton} 
            icon="plus"
          >
            Add Service
          </Button>
          <Button
            mode="contained"
            onPress={() => router.push("/business/dashboard/services/bundle/new-bundle")}
            style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            icon="package-variant"
          >
            Create Bundle
          </Button>
        </View>

        {/* Services */}
        {filteredServices.length > 0 ? (
          <Section title="Services">
            <View style={styles.servicesContainer}>
              {filteredServices.map((service) => (
                <Surface key={service.id} style={styles.serviceCard} elevation={2}>
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={styles.serviceCategory}>{service.category.toUpperCase()}</Text>
                    </View>
                    <View style={styles.servicePricing}>
                      <Text style={styles.servicePrice}>KSh {service.price.toLocaleString()}</Text>
                      <Text style={styles.serviceDuration}>{service.duration} min</Text>
                    </View>
                  </View>

                  {!!service.staff?.length && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {service.staff.map((s) => (
                        <Chip key={s.id} compact>{s.name || "Staff"}</Chip>
                      ))}
                    </View>
                  )}

                  <View style={styles.serviceActions}>
                    <Button 
                      mode="outlined" 
                      compact 
                      style={styles.serviceActionBtn} 
                      onPress={() => openEdit(service)}
                    >
                      Edit
                    </Button>
                    <Button 
                      mode="contained" 
                      compact 
                      style={styles.serviceActionBtn} 
                      onPress={() => openManage(service)}
                    >
                      Manage
                    </Button>
                    <Button 
                      mode="text" 
                      compact 
                      style={styles.serviceActionBtn} 
                      onPress={() => confirmDelete(service)}
                      textColor={theme.colors.error}
                    >
                      Delete
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          </Section>
        ) : (
          <Section title="Services">
            <Text style={{ color: "#6B7280", paddingHorizontal: 16 }}>
              {selectedCategory[0] === "All Services" 
                ? "No services yet. Create your first service above!" 
                : `No ${selectedCategory[0].toLowerCase()} services yet.`}
            </Text>
          </Section>
        )}

        {/* Bundles */}
        {showBundles && (bundles.length > 0 ? (
          <Section title="Service Bundles">
            <View style={styles.bundlesContainer}>
              {bundles.map((bundle) => (
                <Surface key={bundle.id} style={styles.bundleCard} elevation={2}>
                  <View style={styles.bundleHeader}>
                    <View style={styles.bundleInfo}>
                      <Text style={styles.bundleName}>{bundle.name}</Text>
                    </View>
                    <View style={styles.bundlePricing}>
                      <Text style={styles.bundlePrice}>KSh {bundle.price.toLocaleString()}</Text>
                      <Text style={styles.bundleDuration}>{bundle.duration} min</Text>
                    </View>
                  </View>

                  <View style={styles.bundleServices}>
                    <Text style={styles.bundleServicesTitle}>Included Services:</Text>
                    {bundle.services.map((s, i) => (
                      <Text key={i} style={styles.bundleServiceItem}>• {s.service.name}</Text>
                    ))}
                  </View>

                  <View style={styles.bundleActions}>
                    <Button
                      mode="outlined"
                      compact
                      style={styles.bundleActionBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/business/dashboard/services/bundle/new-bundle",
                          params: { id: bundle.id },
                        })
                      }
                    >
                      Edit Bundle
                    </Button>
                    <Button mode="contained" compact style={styles.bundleActionBtn}>
                      Manage
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          </Section>
        ) : (
          <Section title="Service Bundles">
            <Text style={{ color: "#6B7280", paddingHorizontal: 16 }}>
              No bundled services yet. Create service bundles to offer discounts!
            </Text>
          </Section>
        ))}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Create dialog */}
      <Portal>
        <Dialog 
          visible={createOpen} 
          onDismiss={() => setCreateOpen(false)}
          dismissable={!loadingStaff}
        >
          <Dialog.Title>Add Service</Dialog.Title>
          <Dialog.Content>
            <TextInput 
              label="Name *" 
              value={cName} 
              onChangeText={setCName}
              placeholder="e.g. Haircut & Style"
              disabled={loadingStaff}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput 
                style={{ flex: 1 }} 
                label="Price (KES) *" 
                keyboardType="numeric" 
                value={cPrice} 
                onChangeText={setCPrice}
                placeholder="0"
                disabled={loadingStaff}
              />
              <TextInput 
                style={{ flex: 1 }} 
                label="Duration (min) *" 
                keyboardType="numeric" 
                value={cDuration} 
                onChangeText={setCDuration}
                placeholder="0"
                disabled={loadingStaff}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {(["hair", "spa", "nails"] as Category[]).map((cat) => (
                <Chip 
                  key={cat} 
                  selected={cCategory === cat} 
                  onPress={() => setCCategory(cat)} 
                  compact
                  disabled={loadingStaff}
                >
                  {cat.toUpperCase()}
                </Chip>
              ))}
            </View>

            <Divider style={{ marginVertical: 12 }} />
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>Assign Staff (optional)</Text>
            {loadingStaff ? (
              <Text style={{ color: "#6B7280", fontStyle: "italic" }}>Loading staff...</Text>
            ) : allStaff.length === 0 ? (
              <Text style={{ color: "#6B7280" }}>No approved staff available to assign.</Text>
            ) : (
              allStaff.map((s) => (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Checkbox
                    status={createSelected.includes(s.id) ? "checked" : "unchecked"}
                    onPress={() => toggleCreateStaff(s.id)}
                  />
                  <Text>{s.name || "Staff"}</Text>
                </View>
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateOpen(false)} disabled={loadingStaff}>
              Cancel
            </Button>
            <Button onPress={handleCreate} disabled={loadingStaff}>
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Manage staff dialog */}
      <Portal>
        <Dialog 
          visible={!!manageOpen} 
          onDismiss={() => setManageOpen(null)}
          dismissable={!loadingStaff}
        >
          <Dialog.Title>Manage Staff - {manageOpen?.name}</Dialog.Title>
          <Dialog.Content>
            {loadingStaff ? (
              <Text style={{ color: "#6B7280", fontStyle: "italic" }}>Loading staff...</Text>
            ) : allStaff.length === 0 ? (
              <Text style={{ color: "#6B7280" }}>No approved staff to assign.</Text>
            ) : (
              allStaff.map((s) => (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Checkbox
                    status={manageSelected.includes(s.id) ? "checked" : "unchecked"}
                    onPress={() => toggleManageStaff(s.id)}
                  />
                  <Text>{s.name || "Staff"}</Text>
                </View>
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setManageOpen(null)} disabled={loadingStaff}>
              Close
            </Button>
            <Button onPress={saveManage} disabled={loadingStaff}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit dialog */}
      <Portal>
        <Dialog visible={!!editOpen} onDismiss={() => setEditOpen(null)}>
          <Dialog.Title>Edit Service - {editOpen?.name}</Dialog.Title>
          <Dialog.Content>
            <TextInput 
              label="Name *" 
              value={cName} 
              onChangeText={setCName}
              placeholder="e.g. Haircut & Style"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput 
                style={{ flex: 1 }} 
                label="Price (KES) *" 
                keyboardType="numeric" 
                value={cPrice} 
                onChangeText={setCPrice}
                placeholder="0"
              />
              <TextInput 
                style={{ flex: 1 }} 
                label="Duration (min) *" 
                keyboardType="numeric" 
                value={cDuration} 
                onChangeText={setCDuration}
                placeholder="0"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {(["hair", "spa", "nails"] as Category[]).map((cat) => (
                <Chip 
                  key={cat} 
                  selected={cCategory === cat} 
                  onPress={() => setCCategory(cat)} 
                  compact
                >
                  {cat.toUpperCase()}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditOpen(null)}>Cancel</Button>
            <Button onPress={saveEdit}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  actionContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
  },
  servicesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  serviceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  serviceCategory: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  servicePricing: {
    alignItems: "flex-end",
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  serviceDuration: {
    fontSize: 12,
    color: "#6B7280",
  },
  serviceActions: {
    flexDirection: "row",
    gap: 8,
  },
  serviceActionBtn: {
    flex: 1,
  },
  bundlesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bundleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F57C00",
  },
  bundleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bundleInfo: {
    flex: 1,
  },
  bundleName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  bundlePricing: {
    alignItems: "flex-end",
  },
  bundlePrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  bundleDuration: {
    fontSize: 12,
    color: "#6B7280",
  },
  bundleServices: {
    marginBottom: 16,
  },
  bundleServicesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  bundleServiceItem: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 2,
  },
  bundleActions: {
    flexDirection: "row",
    gap: 8,
  },
  bundleActionBtn: {
    flex: 1,
  },
  bottomSpacing: {
    height: 40,
  },
});