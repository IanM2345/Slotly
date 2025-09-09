"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, Surface, useTheme, Card } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRouter } from "expo-router";

import { useOnboarding } from "../../../context/OnboardingContext";
import { useSession } from "../../../context/SessionContext";
import { clearSession } from "../../../lib/api/modules/auth";
import { getMe } from "../../../lib/api/modules/users";
import { newPlacesSessionToken, placesAutocomplete, geocode } from "../../../lib/api/map";
import { useBusinessGate } from "../../../lib/hooks/businessGate";

type Coords = { lat: number; lng: number } | null;

export default function BusinessInformation() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();

  const { token, ready, updateBusiness } = useSession();
  const { setData, goNext } = useOnboarding();

  // ✅ use the gate
  const gate = useBusinessGate({ autoRedirect: true });

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    email: "",
    phone: "",
    address: "",
  });

  const [coords, setCoords] = useState<Coords>(null);
  const [loading, setLoading] = useState(false);

  // address autocomplete
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [addrQuery, setAddrQuery] = useState(formData.address);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocomplete
  useEffect(() => {
    if (!addrQuery.trim()) {
      setSuggestions([]);
      setSessionToken(null);
      return;
    }
    if (!sessionToken) setSessionToken(newPlacesSessionToken());

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const predictions = await placesAutocomplete(addrQuery, {
          sessiontoken: sessionToken || undefined,
        });
        setSuggestions(predictions);
      } catch {
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addrQuery, sessionToken]);

  const onPickSuggestion = async (prediction: any) => {
    try {
      setFetching(true);
      const g = await geocode({ place_id: prediction.place_id });
      const finalAddress = g.address || prediction.description;

      setFormData((p) => ({ ...p, address: finalAddress }));
      setAddrQuery(finalAddress);
      setSuggestions([]);

      if (g.location?.lat != null && g.location?.lng != null) {
        setCoords({ lat: g.location.lat, lng: g.location.lng });
      } else {
        setCoords(null);
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (addrQuery !== formData.address) setCoords(null);
  }, [addrQuery, formData.address]);

  const handleInputChange = (field: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleNext = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!token) throw new Error("No token available");
      await getMe(token); // quick sanity

      updateBusiness({
        businessName: formData.businessName,
        businessType: formData.businessType,
      });

      setData({
        businessName: formData.businessName,
        businessType: formData.businessType,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        latitude: coords?.lat as number,
        longitude: coords?.lng as number,
      });

      goNext("step1");
    } catch (e) {
      await clearSession();
      router.replace("/auth/login?next=/business/onboarding");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = useMemo(() => {
    const hasName = !!formData.businessName.trim();
    const hasAddress = !!formData.address.trim();
    const hasCoords = !!(coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng));
    return hasName && hasAddress && hasCoords;
  }, [formData.businessName, formData.address, coords]);

  const disabled =
    !ready || gate.loading || gate.status === "pending_verification" || gate.status === "active_business";

  const keyboardVerticalOffset = Platform.OS === "ios" ? headerHeight : 0;

  // Loading / gate checking
  if (!ready || gate.loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge">{!ready ? "Loading session..." : "Checking your account..."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Unauthed banner (let user sign in)
  const authError =
    gate.status === "unauthenticated"
      ? "You're not signed in. Please sign in to register a business."
      : gate.status === "error"
      ? gate.error
      : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>1</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 1: Business Information
            </Text>
          </View>

          {/* Optional auth/gate error */}
          {authError && (
            <Card mode="contained" style={{ marginBottom: 12, borderRadius: 12, backgroundColor: "#FDECEA" }}>
              <Card.Content>
                <Text style={{ color: "#B00020", fontWeight: "600", marginBottom: 8 }}>{authError}</Text>
                <Button
                  mode="contained"
                  onPress={() => router.replace("/auth/login?next=/business/onboarding")}
                  style={{ borderRadius: 20, backgroundColor: theme.colors.primary }}
                >
                  Go to Sign In
                </Button>
              </Card.Content>
            </Card>
          )}

          <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.formHeader}>
              <View style={styles.menuIcon}>
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              </View>
              <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
                Business Registration
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.primary }]} />

            {/* Form */}
            <View pointerEvents={disabled ? "none" : "auto"} style={{ opacity: disabled ? 0.5 : 1 }}>
              <View className="field">
                <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                  Business Name *
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g., Nairobi Hair Studio"
                  value={formData.businessName}
                  onChangeText={(v) => handleInputChange("businessName", v)}
                  style={styles.input}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                />
              </View>

              <View className="field">
                <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                  Business Type
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="e.g., Salon, Law Firm, College"
                  value={formData.businessType}
                  onChangeText={(v) => handleInputChange("businessType", v)}
                  style={styles.input}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                />
              </View>

              <View className="field">
                <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                  Email
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="business@example.com"
                  value={formData.email}
                  onChangeText={(v) => handleInputChange("email", v)}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                />
              </View>

              <View className="field">
                <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                  Phone
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChangeText={(v) => handleInputChange("phone", v)}
                  style={styles.input}
                  keyboardType="phone-pad"
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                />
              </View>

              <View className="field">
                <Text variant="titleMedium" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
                  Address *
                </Text>
                <TextInput
                  mode="outlined"
                  placeholder="Westlands, Nairobi"
                  value={addrQuery}
                  onChangeText={(v) => {
                    setAddrQuery(v);
                    setFormData((prev) => ({ ...prev, address: v }));
                  }}
                  style={styles.input}
                  autoCapitalize="none"
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  right={<TextInput.Affix text={fetching ? "…" : ""} />}
                />
                {!!suggestions.length && (
                  <Surface style={styles.suggestionsContainer} elevation={2}>
                    {suggestions.slice(0, 6).map((prediction: any, i: number) => (
                      <View
                        key={prediction.place_id}
                        style={[
                          styles.suggestionItem,
                          { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: "#eee" },
                        ]}
                      >
                        <Button
                          mode="text"
                          onPress={() => onPickSuggestion(prediction)}
                          contentStyle={styles.suggestionButtonContent}
                          style={styles.suggestionButton}
                          labelStyle={styles.suggestionButtonLabel}
                          disabled={fetching}
                        >
                          {prediction.structured_formatting?.main_text || prediction.description}
                        </Button>
                      </View>
                    ))}
                  </Surface>
                )}
              </View>
            </View>

            <Button
              mode="contained"
              onPress={handleNext}
              loading={loading}
              disabled={disabled || !canProceed}
              style={[
                styles.nextButton,
                { backgroundColor: !disabled && canProceed ? "#FBC02D" : theme.colors.surfaceDisabled },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
            >
              Next: Choose Plan
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  phoneBar: { height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: "600" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, marginBottom: 24 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontWeight: "600", marginBottom: 8 },
  input: { backgroundColor: "transparent" },
  suggestionsContainer: { borderRadius: 12, marginTop: 6, maxHeight: 240 },
  suggestionItem: {},
  suggestionButtonContent: { justifyContent: "flex-start" },
  suggestionButton: { paddingVertical: 6 },
  suggestionButtonLabel: { textAlign: "left" },
  nextButton: { borderRadius: 25, marginTop: 16 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
});
