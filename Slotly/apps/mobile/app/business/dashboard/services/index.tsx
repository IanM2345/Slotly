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
  Chip,
  Dialog,
  Portal,
  TextInput,
  Checkbox,
  Divider,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { VerificationGate } from "../../../../components/VerificationGate";
import { Section } from "../../../../components/Section";
import { FilterChipsRow } from "../../../../components/FilterChipsRow";

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
} from "../../../../lib/api/modules/manager"; // wired module :contentReference[oaicite:8]{index=8}

type Category = "hair" | "spa" | "nails";
type StaffLite = { id: string; name: string };
type ServiceRow = {
  id: string;
  name: string;
  price: number;
  duration: number;           // minutes (backend)
  category: Category;
  available: boolean;
  staff?: StaffLite[];        // included by GET
  description?: string | null;
};

type BundleRow = {
  id: string;
  name: string;
  price: number;
  duration: number;
  services: { service: { id: string; name: string } }[]; // backend include
  description?: string | null;
};

export default function ServicesIndexScreen() {
  const router = useRouter();
  const theme = useTheme();

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

  // manage staff dialog
  const [manageSelected, setManageSelected] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  async function loadData() {
    setLoading(true);
    try {
      const category =
        selectedCategory[0] === "All Services" || selectedCategory[0] === "Bundles"
          ? undefined
          : (selectedCategory[0].toLowerCase() as Category);

      const [svc, bun] = await Promise.all([
        listServices(category ? { category } : undefined),
        listBundles(),
      ]);
      setServices(Array.isArray(svc) ? svc : []);
      setBundles(Array.isArray(bun) ? bun : []);
    } catch (err: any) {
      console.error("Error loading services:", err?.message || err);
      Alert.alert("Failed to load", err?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // categories
  const categoryOptions = [
    { key: "All Services", label: "All Services" },
    { key: "Hair", label: "Hair" },
    { key: "Spa", label: "Spa" },
    { key: "Nails", label: "Nails" },
    { key: "Bundles", label: "Bundles" },
  ];

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
      // load approved staff list for selection
      const staffResp = await listStaff(); // { approvedStaff, pendingEnrollments } :contentReference[oaicite:9]{index=9}
      setAllStaff(staffResp?.approvedStaff || []);
    } catch (e: any) {
      console.error(e);
    }
  }

  function toggleCreateStaff(id: string) {
    setCreateSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    try {
      if (!cName || !cPrice || !cDuration) {
        return Alert.alert("Missing fields", "Name, price and duration are required.");
      }
      const payload = {
        name: cName.trim(),
        price: Number(cPrice),
        duration: Number(cDuration),
        category: cCategory,
        available: true,
      };
      const created = await createService(payload); // POST /manager/services :contentReference[oaicite:10]{index=10}

      // pre-assign selected staff
      for (const staffId of createSelected) {
        await assignStaffToService({ serviceId: created.id, staffId }); // :contentReference[oaicite:11]{index=11}
      }

      setCreateOpen(false);
      setCName(""); setCPrice(""); setCDuration(""); setCCategory("hair"); setCreateSelected([]);
      await loadData();
    } catch (e: any) {
      Alert.alert("Create failed", e?.message || "Could not create service");
    }
  }

  /* ----------------------- Manage staff for a service ---------------------- */

  async function openManage(svc: ServiceRow) {
    try {
      setManageOpen(svc);
      const staffResp = await listStaff();
      setAllStaff(staffResp?.approvedStaff || []);
      setManageSelected((svc.staff || []).map((s) => s.id));
    } catch (e: any) {
      console.error(e);
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
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Could not update assignments");
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
      await updateService({
        id: editOpen.id,
        name: cName.trim(),
        price: Number(cPrice),
        duration: Number(cDuration),
        category: cCategory,
      }); // PUT /manager/services :contentReference[oaicite:12]{index=12}
      setEditOpen(null);
      setCName(""); setCPrice(""); setCDuration("");
      await loadData();
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Could not update service");
    }
  }

  /* --------------------------------- UI ---------------------------------- */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading services…</Text>
      </View>
    );
  }

  return (
    <VerificationGate>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={() => router.back()} />
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
          <Button mode="outlined" onPress={openCreate} style={styles.actionButton} icon="plus">
            Add Service
          </Button>
          <Button
            mode="contained"
            onPress={() => router.push({ pathname: "/business/dashboard/services" })}
            style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            icon="package-variant"
          >
            Create Bundle
          </Button>
        </View>

        {/* Services */}
        {filteredServices.length > 0 && (
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
                    <Button mode="outlined" compact style={styles.serviceActionBtn} onPress={() => openEdit(service)}>
                      Edit
                    </Button>
                    <Button mode="contained" compact style={styles.serviceActionBtn} onPress={() => openManage(service)}>
                      Manage
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          </Section>
        )}

        {/* Bundles */}
        {showBundles && bundles.length > 0 && (
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
                          pathname: "/business/dashboard/services",
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
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Create dialog */}
      <Portal>
        <Dialog visible={createOpen} onDismiss={() => setCreateOpen(false)}>
          <Dialog.Title>Add Service</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={cName} onChangeText={setCName} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput style={{ flex: 1 }} label="Price (KES)" keyboardType="numeric" value={cPrice} onChangeText={setCPrice} />
              <TextInput style={{ flex: 1 }} label="Duration (min)" keyboardType="numeric" value={cDuration} onChangeText={setCDuration} />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {(["hair", "spa", "nails"] as Category[]).map((cat) => (
                <Chip key={cat} selected={cCategory === cat} onPress={() => setCCategory(cat)} compact>
                  {cat.toUpperCase()}
                </Chip>
              ))}
            </View>

            <Divider style={{ marginVertical: 12 }} />
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>Assign Staff (optional)</Text>
            {allStaff.length === 0 ? (
              <Text style={{ color: "#6B7280" }}>No approved staff yet.</Text>
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
            <Button onPress={() => setCreateOpen(false)}>Cancel</Button>
            <Button onPress={handleCreate}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Manage staff dialog */}
      <Portal>
        <Dialog visible={!!manageOpen} onDismiss={() => setManageOpen(null)}>
          <Dialog.Title>Manage Staff</Dialog.Title>
          <Dialog.Content>
            {allStaff.length === 0 ? (
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
            <Button onPress={() => setManageOpen(null)}>Close</Button>
            <Button onPress={saveManage}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit dialog */}
      <Portal>
        <Dialog visible={!!editOpen} onDismiss={() => setEditOpen(null)}>
          <Dialog.Title>Edit Service</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Name" value={cName} onChangeText={setCName} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput style={{ flex: 1 }} label="Price (KES)" keyboardType="numeric" value={cPrice} onChangeText={setCPrice} />
              <TextInput style={{ flex: 1 }} label="Duration (min)" keyboardType="numeric" value={cDuration} onChangeText={setCDuration} />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {(["hair", "spa", "nails"] as Category[]).map((cat) => (
                <Chip key={cat} selected={cCategory === cat} onPress={() => setCCategory(cat)} compact>
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
  serviceEmoji: {
    fontSize: 32,
    marginRight: 12,
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
  serviceDescription: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 16,
    lineHeight: 20,
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
  bundleEmoji: {
    fontSize: 32,
    marginRight: 12,
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
  savingsChip: {
    backgroundColor: "#FFF6EE",
    alignSelf: "flex-start",
  },
  savingsText: {
    color: "#E66400",
    fontSize: 10,
    fontWeight: "bold",
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
})