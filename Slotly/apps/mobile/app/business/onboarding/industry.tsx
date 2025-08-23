"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, TextInput, Button, useTheme, Surface, IconButton, Chip, HelperText } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";

const POPULAR_INDUSTRIES = [
  { id: "salon", label: "Beauty Salon", icon: "✂️" },
  { id: "restaurant", label: "Restaurant", icon: "🍽️" },
  { id: "clinic", label: "Medical Clinic", icon: "🏥" },
  { id: "spa", label: "Spa & Wellness", icon: "💆" },
  { id: "retail", label: "Retail Store", icon: "🛍️" },
  { id: "gym", label: "Gym & Fitness", icon: "💪" },
  { id: "law", label: "Law Firm", icon: "⚖️" },
  { id: "dental", label: "Dental Clinic", icon: "🦷" },
  { id: "automotive", label: "Auto Services", icon: "🚗" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "consulting", label: "Consulting", icon: "💼" },
  { id: "other", label: "Other", icon: "📋" },
];

export default function Industry() {
  const theme = useTheme();
  const router = useRouter();
  const { data, setData, updateKycSection } = useOnboarding();

  const [selectedIndustry, setSelectedIndustry] = useState(() => {
    // Try to match existing data with popular industries
    const existing = data.industry?.toLowerCase();
    const match = POPULAR_INDUSTRIES.find(ind => 
      existing?.includes(ind.label.toLowerCase()) || existing === ind.id
    );
    return match?.id || (data.industry ? "other" : "");
  });

  const [customIndustry, setCustomIndustry] = useState(() => {
    // If we have existing data and it's not in popular industries, use it as custom
    const existing = data.industry;
    const isPopular = POPULAR_INDUSTRIES.some(ind => 
      existing?.toLowerCase().includes(ind.label.toLowerCase()) || existing?.toLowerCase() === ind.id
    );
    return !isPopular && existing ? existing : "";
  });

  const [description, setDescription] = useState(data.industryDescription || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleIndustrySelect = (industryId: string) => {
    setSelectedIndustry(industryId);
    setError(null);
    
    // Clear custom industry if not selecting "other"
    if (industryId !== "other") {
      setCustomIndustry("");
    }
  };

  const validateForm = () => {
    if (!selectedIndustry) {
      setError("Please select an industry");
      return false;
    }

    if (selectedIndustry === "other" && !customIndustry.trim()) {
      setError("Please specify your industry");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const industryValue = selectedIndustry === "other" 
        ? customIndustry.trim()
        : POPULAR_INDUSTRIES.find(ind => ind.id === selectedIndustry)?.label || selectedIndustry;

      setData({
        industry: industryValue,
        industryDescription: description.trim(),
      });

      updateKycSection("industry", true);

      // Navigate back with a small delay for better UX
      setTimeout(() => {
        router.back();
      }, 300);

    } catch (err) {
      setError("Failed to save industry information");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return selectedIndustry && (selectedIndustry !== "other" || customIndustry.trim());
  };

  const getSelectedIndustryLabel = () => {
    if (selectedIndustry === "other") {
      return customIndustry || "Other";
    }
    return POPULAR_INDUSTRIES.find(ind => ind.id === selectedIndustry)?.label || "";
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={22} 
            iconColor={theme.colors.primary}
            onPress={() => router.back()} 
          />
          <View style={styles.headerContent}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>🏢</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Business Industry
            </Text>
          </View>
        </View>

        {/* Main Form Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.formHeader}>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              What industry is your business in?
            </Text>
            <Text variant="bodyMedium" style={[styles.formSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Select the category that best describes your business
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Popular Industries */}
          <View style={styles.industriesSection}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Popular Industries
            </Text>
            
            <View style={styles.industriesGrid}>
              {POPULAR_INDUSTRIES.map((industry) => (
                <Chip
                  key={industry.id}
                  mode={selectedIndustry === industry.id ? "flat" : "outlined"}
                  selected={selectedIndustry === industry.id}
                  onPress={() => handleIndustrySelect(industry.id)}
                  style={[
                    styles.industryChip,
                    selectedIndustry === industry.id && {
                      backgroundColor: theme.colors.primaryContainer,
                    }
                  ]}
                  textStyle={[
                    styles.chipText,
                    { color: selectedIndustry === industry.id ? theme.colors.primary : theme.colors.onSurface }
                  ]}
                  icon={() => (
                    <Text style={styles.chipIcon}>{industry.icon}</Text>
                  )}
                >
                  {industry.label}
                </Chip>
              ))}
            </View>
          </View>

          {/* Custom Industry Input */}
          {selectedIndustry === "other" && (
            <View style={styles.customSection}>
              <TextInput
                mode="outlined"
                label="Specify your industry *"
                value={customIndustry}
                onChangeText={(value) => {
                  setCustomIndustry(value);
                  setError(null);
                }}
                style={[styles.input, { backgroundColor: theme.colors.surface }]}
                placeholder="e.g., Photography Studio, Pet Grooming, etc."
                error={selectedIndustry === "other" && !customIndustry.trim() && !!error}
              />
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionSection}>
            <TextInput
              mode="outlined"
              label="Business Description (Optional)"
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.descriptionInput, { backgroundColor: theme.colors.surface }]}
              multiline
              numberOfLines={4}
              placeholder="Briefly describe what your business does..."
            />
            <HelperText type="info">
              This helps us better understand your business needs
            </HelperText>
          </View>

          {/* Error Message */}
          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          {/* Selected Industry Preview */}
          {isFormValid() && (
            <View style={styles.previewSection}>
              <Text variant="bodyMedium" style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
                Selected Industry:
              </Text>
              <Text variant="titleMedium" style={[styles.previewValue, { color: theme.colors.primary }]}>
                {getSelectedIndustryLabel()}
              </Text>
            </View>
          )}

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading || !isFormValid()}
            style={[
              styles.saveButton,
              {
                backgroundColor: isFormValid() ? "#FBC02D" : theme.colors.surfaceDisabled,
                opacity: isFormValid() ? 1 : 0.6
              }
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={[
              styles.buttonLabel,
              { color: isFormValid() ? theme.colors.primary : theme.colors.onSurfaceDisabled }
            ]}
          >
            {loading ? "Saving..." : "Save & Continue"}
          </Button>

          {/* Helper Text */}
          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
            This information helps us customize features for your business type
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1, 
    padding: 20 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 24 
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    marginLeft: -40
  },
  stepIndicator: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 8 
  },
  stepNumber: { 
    fontSize: 20
  },
  title: { 
    fontWeight: "700", 
    textAlign: "center" 
  },
  card: { 
    borderRadius: 20, 
    padding: 24 
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 20
  },
  formTitle: {
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center"
  },
  formSubtitle: {
    textAlign: "center",
    lineHeight: 20
  },
  divider: {
    height: 2,
    backgroundColor: "#1559C1",
    marginBottom: 24,
    borderRadius: 1
  },
  industriesSection: {
    marginBottom: 24
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 16
  },
  industriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  industryChip: {
    marginBottom: 8,
    marginRight: 4
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500"
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 4
  },
  customSection: {
    marginBottom: 24
  },
  descriptionSection: {
    marginBottom: 20
  },
  input: {
    backgroundColor: "transparent"
  },
  descriptionInput: {
    minHeight: 100
  },
  errorText: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14
  },
  previewSection: {
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center"
  },
  previewLabel: {
    fontSize: 12,
    marginBottom: 4
  },
  previewValue: {
    fontWeight: "600"
  },
  saveButton: {
    borderRadius: 26,
    marginBottom: 16
  },
  buttonContent: {
    paddingVertical: 8
  },
  buttonLabel: {
    fontWeight: "700",
    fontSize: 16
  },
  helperText: {
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
    fontSize: 12
  },
});