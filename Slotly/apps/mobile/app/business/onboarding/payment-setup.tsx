"use client";

import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, IconButton, Card, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentMethod = "mpesa" | "bank";

export default function PaymentSetup() {
  const router = useRouter();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("mpesa");
  const [tillNumber, setTillNumber] = useState("");

  const handleMethodSelect = (method: PaymentMethod) => setSelectedMethod(method);

  const handleContinue = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    router.push("/business/onboarding/review");
  };

  const handleBack = () => router.back();

  const isFormValid = () => (selectedMethod === "mpesa" ? tillNumber.trim() !== "" : true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>5</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 5: Payment Setup
          </Text>
        </View>

        {/* Phone Status Bar Mockup */}
        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <IconButton
              icon="arrow-left"
              size={20}
              iconColor={theme.colors.primary}
              onPress={handleBack}
              style={styles.backIcon}
            />
            <View style={styles.menuIcon}>
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.menuLine, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Payment Setup
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Instructions */}
          <Text variant="bodyMedium" style={[styles.instructions, { color: theme.colors.onSurfaceVariant }]}>
            Choose how customers will pay you:
          </Text>

          {/* Payment Method Cards */}
          <View style={styles.methodsContainer}>
            <Card
              style={[
                styles.methodCard,
                selectedMethod === "mpesa" && styles.selectedCard,
                { backgroundColor: selectedMethod === "mpesa" ? "#FBC02D" : "#FFFFFF" },
              ]}
              onPress={() => handleMethodSelect("mpesa")}
            >
              <Card.Content style={styles.methodContent}>
                <Text variant="titleMedium" style={[styles.methodTitle, { color: theme.colors.primary }]}>
                  M-Pesa
                </Text>
                <Text variant="bodySmall" style={[styles.methodSubtitle, { color: "#F57C00" }]}>
                  Till/Paybill
                </Text>
              </Card.Content>
            </Card>

            <Card
              style={[
                styles.methodCard,
                selectedMethod === "bank" && styles.selectedCard,
                { backgroundColor: selectedMethod === "bank" ? "#1559C1" : "#FFFFFF" },
              ]}
              onPress={() => handleMethodSelect("bank")}
            >
              <Card.Content style={styles.methodContent}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.methodTitle,
                    { color: selectedMethod === "bank" ? theme.colors.onPrimary : theme.colors.primary },
                  ]}
                >
                  Bank/Card
                </Text>
                <Text
                  variant="bodySmall"
                  style={[styles.methodSubtitle, { color: selectedMethod === "bank" ? "#FBC02D" : "#F57C00" }]}
                >
                  Flutterwave
                </Text>
              </Card.Content>
            </Card>
          </View>

          {/* M-Pesa Till Number Input */}
          {selectedMethod === "mpesa" && (
            <View style={styles.inputSection}>
              <Text variant="titleMedium" style={[styles.inputLabel, { color: theme.colors.primary }]}>
                M-Pesa Till Number
              </Text>
              <TextInput
                mode="outlined"
                placeholder="123456"
                value={tillNumber}
                onChangeText={setTillNumber}
                style={styles.input}
                keyboardType="numeric"
                outlineColor={theme.colors.outline}
                activeOutlineColor={theme.colors.primary}
              />
            </View>
          )}

          {/* Warning Note */}
          <Card style={[styles.warningCard, { backgroundColor: "#FBC02D" }]}>
            <Card.Content>
              <Text variant="bodyMedium" style={[styles.warningText, { color: theme.colors.primary }]}>
                ⚠️ Even with M-Pesa, you need a Flutterwave subaccount for system integration
              </Text>
            </Card.Content>
          </Card>

          {/* Continue Button */}
          <Button
            mode="contained"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !isFormValid()}
            style={[styles.continueButton, { backgroundColor: isFormValid() ? "#FBC02D" : theme.colors.surfaceDisabled }]}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
          >
            Continue
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  stepIndicator: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "bold", textAlign: "center" },
  phoneBar: { height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: "600" },
  formContainer: { borderRadius: 20, padding: 24, marginBottom: 20 },
  formHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backIcon: { marginLeft: -8, marginRight: 4 },
  menuIcon: { marginRight: 12 },
  menuLine: { width: 20, height: 3, marginBottom: 3, borderRadius: 1.5 },
  formTitle: { fontWeight: "bold" },
  divider: { height: 2, backgroundColor: "#1559C1", marginBottom: 24 },
  instructions: { marginBottom: 20, lineHeight: 20 },
  methodsContainer: { flexDirection: "row", gap: 16, marginBottom: 24 },
  methodCard: { flex: 1, borderWidth: 2, borderColor: "transparent" },
  selectedCard: { borderColor: "#1559C1" },
  methodContent: { alignItems: "center", paddingVertical: 20 },
  methodTitle: { fontWeight: "bold", marginBottom: 4 },
  methodSubtitle: { fontWeight: "600" },
  inputSection: { marginBottom: 24 },
  inputLabel: { fontWeight: "600", marginBottom: 8 },
  input: { backgroundColor: "transparent" },
  warningCard: { marginBottom: 24 },
  warningText: { fontWeight: "600", textAlign: "center", lineHeight: 20 },
  continueButton: { borderRadius: 25 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
});
