// apps/mobile/app/business/onboarding/index.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Text, TextInput, Button, Surface, useTheme, Card } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useOnboarding } from "../../../context/OnboardingContext";
import { useSession } from "../../../context/SessionContext";
import { clearSession } from "../../../lib/api/modules/auth";
import { getMe } from "../../../lib/api/modules/users";
import { newPlacesSessionToken, placesAutocomplete, geocode } from "../../../lib/api/map";
import { useRouter } from "expo-router";

export default function BusinessInformation() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const { updateBusiness, token, user } = useSession(); // Also get user from session
  const { setData, goNext } = useOnboarding();

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    email: "",
    phone: "",
    address: "",
  });

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auth guard - simplified
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Autocomplete
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [addrQuery, setAddrQuery] = useState(formData.address);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<any>(null);

  // Simplified auth guard - fix the race condition
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        console.log("🔍 Auth check starting...");
        setAuthChecking(true);
        setAuthError(null);

        // Early exit if no token
        if (!token) {
          if (mounted) {
            setAuthError("You're not signed in. Please sign in to register a business.");
            setAuthChecking(false);
          }
          return;
        }

        console.log("🔍 Token exists, checking user data...");

        // Single call to getMe
        const me = await getMe(token);
        
        if (!mounted) return;

        console.log("🔍 User data received:", {
          hasUser: !!me,
          hasBusiness: !!me?.business,
          verificationStatus: me?.business?.verificationStatus,
          role: me?.role
        });

        // Check if user has business and is verified
        if (me?.business) {
          const status = String(me.business.verificationStatus || "").toLowerCase();
          console.log("🔍 Business verification status:", status);
          
          if (["approved", "active", "verified"].includes(status)) {
            console.log("→ Redirecting to dashboard (verified business)");
            router.replace("/business/dashboard");
            return;
          }
          
          if (["pending", "submitted"].includes(status)) {
            console.log("→ Redirecting to pending (business under review)");
            router.replace("/business/onboarding/pending");
            return;
          }
        }

        // If we get here, user can proceed with onboarding
        console.log("✅ Auth check passed - user can proceed with onboarding");
        
      } catch (error: any) {
        console.error("❌ Auth check failed:", error);
        
        if (!mounted) return;
        
        const errorMessage = error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Your session has expired. Please sign in again.";
          
        setAuthError(errorMessage);
        
        // Clear session on auth failure
        try {
          await clearSession();
        } catch (clearError) {
          console.error("Failed to clear session:", clearError);
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    };

    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, [token, router]); // Only depend on token and router

  // Watch address for autocomplete
  useEffect(() => {
    if (!addrQuery?.trim()) {
      setSuggestions([]);
      setSessionToken(null);
      return;
    }
    
    if (!sessionToken) {
      setSessionToken(newPlacesSessionToken());
    }
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const predictions = await placesAutocomplete(addrQuery, {
          sessiontoken: sessionToken || undefined,
        });
        setSuggestions(predictions);
      } catch (error) {
        console.warn("Autocomplete failed:", error);
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [addrQuery, sessionToken]);

  const handleInputChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

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
    } catch (error) {
      console.error("Geocoding failed:", error);
    } finally {
      setFetching(false);
    }
  };

  // Reset coords if user manually edits address
  useEffect(() => {
    if (addrQuery !== formData.address) {
      setCoords(null);
    }
  }, [addrQuery]);

  const handleNext = async () => {
    if (loading) return; // Prevent double-submission
    
    setLoading(true);

    try {
      // Quick auth re-check
      if (!token) {
        throw new Error("No token available");
      }
      
      await getMe(token);

      // Update session state
      updateBusiness({
        businessName: formData.businessName,
        businessType: formData.businessType,
      });

      // Push to onboarding context
      setData({
        businessName: formData.businessName,
        businessType: formData.businessType,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        latitude: coords!.lat,
        longitude: coords!.lng,
      });

      console.log("✅ Moving to next step");
      goNext("step1");
      
    } catch (error) {
      console.error("❌ Next step failed:", error);
      setAuthError("Your session has expired. Please sign in to continue.");
      await clearSession();
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

  const isDisabled = authChecking || !!authError;
  const keyboardVerticalOffset = Platform.OS === "ios" ? headerHeight : 0;

  // Show loading state
  if (authChecking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge">Checking authentication...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

          {/* Phone Status Bar Mockup */}
          <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
          </View>

          {/* Auth error banner */}
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
            {/* Form Header */}
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

            {/* Form Inputs */}
            <View pointerEvents={isDisabled ? "none" : "auto"} style={{ opacity: isDisabled ? 0.5 : 1 }}>
              <View style={styles.fieldGroup}>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
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
                  returnKeyType="done"
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
              disabled={isDisabled || loading || !canProceed}
              style={[
                styles.nextButton,
                { backgroundColor: !isDisabled && canProceed ? "#FBC02D" : theme.colors.surfaceDisabled },
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12,
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