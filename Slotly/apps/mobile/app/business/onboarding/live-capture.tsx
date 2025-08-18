import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Button, Surface, useTheme, IconButton } from "react-native-paper";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = "selfie" | "idFront" | "idBack";

export default function LiveCapture() {
  const router = useRouter();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("selfie");
  const [capturedPhotos, setCapturedPhotos] = useState<Record<Step, boolean>>({
    selfie: false,
    idFront: false,
    idBack: false,
  });

  const handleCapture = () => {
    setCapturedPhotos((prev) => ({
      ...prev,
      [currentStep]: true,
    }));
  };

  const handleRetake = () => {
    setCapturedPhotos((prev) => ({
      ...prev,
      [currentStep]: false,
    }));
  };

  const handleNext = () => {
    if (currentStep === "selfie") setCurrentStep("idFront");
    else if (currentStep === "idFront") setCurrentStep("idBack");
    else handleContinue();
  };

  const handleContinue = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000)); // stub
    setLoading(false);
    // This is a sibling route inside /business/onboarding
    router.push("../payment-setup");
  };

  const handleBack = () => {
    if (currentStep === "idFront") setCurrentStep("selfie");
    else if (currentStep === "idBack") setCurrentStep("idFront");
    else router.back();
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "selfie":
        return "Capture Selfie";
      case "idFront":
        return "Capture ID Front";
      case "idBack":
        return "Capture ID Back";
    }
  };

  const getInstructions = () => {
    switch (currentStep) {
      case "selfie":
        return "Position your face in the circle";
      case "idFront":
        return "Position your ID front in the frame";
      case "idBack":
        return "Position your ID back in the frame";
    }
  };

  const getNextText = () =>
    currentStep === "idBack"
      ? "Continue to Payment"
      : `Next: ${currentStep === "selfie" ? "Capture ID front & back" : "Capture ID back"}`;

  const isCurrentStepCaptured = capturedPhotos[currentStep];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>4</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Step 4: Live Document Capture
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
              {getStepTitle()}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Camera View */}
          <View style={styles.cameraContainer}>
            <View
              style={[
                styles.cameraView,
                { backgroundColor: isCurrentStepCaptured ? "#2E7D32" : "#F57C00" },
              ]}
            >
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={[styles.cameraText, { color: theme.colors.onPrimary }]}>
                {isCurrentStepCaptured ? "PHOTO CAPTURED" : "CAMERA VIEW"}
              </Text>
              <Text style={[styles.instructionText, { color: theme.colors.onPrimary }]}>{getInstructions()}</Text>
            </View>
          </View>

          {/* Instructions */}
          <Text variant="bodyMedium" style={[styles.instructions, { color: theme.colors.primary }]}>
            Please look directly at the camera and ensure good lighting
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!isCurrentStepCaptured ? (
              <Button
                mode="contained"
                onPress={handleCapture}
                style={[styles.captureButton, { backgroundColor: "#FBC02D" }]}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
              >
                Capture Photo
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleRetake}
                style={[styles.retakeButton, { backgroundColor: "#F57C00" }]}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: theme.colors.onPrimary }]}
              >
                Retake
              </Button>
            )}
          </View>

          {/* Next Button */}
          {isCurrentStepCaptured && (
            <Button
              mode="contained"
              onPress={handleNext}
              loading={loading}
              disabled={loading}
              style={[styles.nextButton, { backgroundColor: "#FBC02D" }]}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
            >
              {getNextText()}
            </Button>
          )}

          {/* Progress Text */}
          <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.primary }]}>
            {getNextText()}
          </Text>
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
  cameraContainer: { alignItems: "center", marginBottom: 20 },
  cameraView: { width: 280, height: 200, borderRadius: 12, justifyContent: "center", alignItems: "center", padding: 20 },
  cameraIcon: { fontSize: 32, marginBottom: 8 },
  cameraText: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  instructionText: { fontSize: 14, textAlign: "center", lineHeight: 18 },
  instructions: { textAlign: "center", marginBottom: 24, lineHeight: 20 },
  actionButtons: { marginBottom: 20 },
  captureButton: { borderRadius: 25 },
  retakeButton: { borderRadius: 25 },
  nextButton: { borderRadius: 25, marginBottom: 16 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  progressText: { textAlign: "center", fontWeight: "600" },
});
