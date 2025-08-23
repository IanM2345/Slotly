"use client";

import { useState } from "react";
import { View, StyleSheet, ScrollView, Image, Alert } from "react-native";
import {
  Text,
  Button,
  Surface,
  useTheme,
  IconButton,
  ProgressBar,
  Card,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";
import { uploadToCloudinaryAdvanced } from "../../../lib/upload/cloudinary";

type Step = "selfie" | "idFront" | "idBack";

interface CapturedPhoto {
  uri: string;
  uploaded: boolean;
  uploadProgress: number;
}

export default function LiveCapture() {
  const theme = useTheme();
  const router = useRouter();
  const { data, addAttachment } = useOnboarding();

  // Selfie required only for FORMAL verification (tier >= 3 in your flow)
  const mustSelfie = (data.businessVerificationType || "INFORMAL") === "FORMAL";

  const [currentStep, setCurrentStep] = useState<Step>("selfie");
  const [loading, setLoading] = useState<Step | null>(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from existing attachments in context
  const getInitialPhoto = (step: Step): CapturedPhoto | null => {
    const attachments = data.attachments || [];
    let attachmentType: string;
    
    switch (step) {
      case "selfie":
        attachmentType = "SELFIE";
        break;
      case "idFront":
        attachmentType = "ID_FRONT";
        break;
      case "idBack":
        attachmentType = "ID_BACK";
        break;
    }
    
    const attachment = attachments.find(a => a.type === attachmentType);
    return attachment 
      ? { uri: attachment.url, uploaded: true, uploadProgress: 100 }
      : null;
  };

  const [capturedPhotos, setCapturedPhotos] = useState<Record<Step, CapturedPhoto | null>>({
    selfie: getInitialPhoto("selfie"),
    idFront: getInitialPhoto("idFront"), 
    idBack: getInitialPhoto("idBack"),
  });

  const stepConfig: Record<
    Step,
    { title: string; instructions: string; icon: string; bgColor: string }
  > = {
    selfie: {
      title: "Capture Selfie",
      instructions: "Position your face in the frame and look directly at the camera.",
      icon: "🤳",
      bgColor: "#E3F2FD",
    },
    idFront: {
      title: "Capture ID Front",
      instructions: "Position your ID front clearly in the frame.",
      icon: "🆔",
      bgColor: "#F3E5F5",
    },
    idBack: {
      title: "Capture ID Back",
      instructions: "Position your ID back clearly in the frame.",
      icon: "🔄",
      bgColor: "#E8F5E9",
    },
  };

  // Helper to add attachment to context after successful upload
  const afterUpload = (step: Step, url: string) => {
    if (step === "selfie") {
      addAttachment({ type: "SELFIE", url, step: 4, uploadedAt: Date.now() });
    }
    if (step === "idFront") {
      addAttachment({ type: "ID_FRONT", url, step: 4, uploadedAt: Date.now() });
    }
    if (step === "idBack") {
      addAttachment({ type: "ID_BACK", url, step: 4, uploadedAt: Date.now() });
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Camera permission is needed to capture photos for verification.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Photo library permission is needed to pick photos for verification.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  // source: "camera" | "library"
  const capturePhoto = async (step: Step, source: "camera" | "library" = "camera") => {
    setError(null);

    const allowed =
      source === "camera" ? await requestCameraPermission() : await requestLibraryPermission();
    if (!allowed) return;

    try {
      const pickerResult =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.85,
              aspect: step === "selfie" ? [1, 1] : [4, 3],
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              quality: 0.85,
              aspect: step === "selfie" ? [1, 1] : [4, 3],
            });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) return;

      const uri = pickerResult.assets[0].uri;

      // Set initial captured photo
      setCapturedPhotos((prev) => ({
        ...prev,
        [step]: { uri, uploaded: false, uploadProgress: 0 },
      }));

      // Start upload
      setLoading(step);

      const uploadResult = await uploadToCloudinaryAdvanced(uri, {
        folder: "slotly/kyc",
        tags: ["kyc", step],
        onProgress: (progress) => {
          setCapturedPhotos((prev) => ({
            ...prev,
            [step]: prev[step]
              ? { ...prev[step]!, uploadProgress: progress }
              : { uri, uploaded: false, uploadProgress: progress },
          }));
        },
      });

      const url = uploadResult.secure_url;

      // Update with uploaded URL
      setCapturedPhotos((prev) => ({
        ...prev,
        [step]: { uri: url, uploaded: true, uploadProgress: 100 },
      }));

      // Add to context attachments
      afterUpload(step, url);

    } catch (err: any) {
      setError(err?.message || "Failed to capture or upload photo");
      // Remove failed photo
      setCapturedPhotos((prev) => ({
        ...prev,
        [step]: null,
      }));
    } finally {
      setLoading(null);
    }
  };

  const retakePhoto = (step: Step) => {
    setCapturedPhotos((prev) => ({
      ...prev,
      [step]: null,
    }));
  };

  const handleNext = () => {
    if (currentStep === "selfie") setCurrentStep("idFront");
    else if (currentStep === "idFront") setCurrentStep("idBack");
    else handleContinue();
  };

  const handleBack = () => {
    if (currentStep === "idFront") setCurrentStep("selfie");
    else if (currentStep === "idBack") setCurrentStep("idFront");
    else router.back();
  };

  const handleContinue = async () => {
    const { selfie, idFront } = capturedPhotos;

    if (!idFront?.uploaded) {
      setError("Please capture the front of your ID before continuing");
      return;
    }
    if (mustSelfie && !selfie?.uploaded) {
      setError("Selfie with ID is required for your plan");
      return;
    }

    setFinalLoading(true);
    try {
      // Navigation only - attachments are already stored in context via addAttachment
      router.push("/business/onboarding/payment-setup");
    } catch (err: any) {
      setError(err?.message || "Failed to proceed");
    } finally {
      setFinalLoading(false);
    }
  };

  const canProceedToNext = () => {
    const currentPhoto = capturedPhotos[currentStep];
    if (currentStep === "selfie" && !mustSelfie) return true; // selfie optional
    return !!currentPhoto?.uploaded;
  };

  const canFinish = () => {
    const hasId = !!capturedPhotos.idFront?.uploaded;
    const hasSelfie = !!capturedPhotos.selfie?.uploaded;
    return mustSelfie ? hasId && hasSelfie : hasId;
  };

  const getNextButtonText = () => {
    switch (currentStep) {
      case "selfie":
        return "Next: Capture ID Front";
      case "idFront":
        return "Next: Capture ID Back";
      case "idBack":
        return "Continue to Payment Setup";
    }
  };

  const getProgressText = () => {
    const requiredTotal = mustSelfie ? 2 : 1; // ID front always required; selfie only for FORMAL
    const requiredCompleted =
      (capturedPhotos.idFront?.uploaded ? 1 : 0) +
      (mustSelfie && capturedPhotos.selfie?.uploaded ? 1 : 0);
    const optionalCompleted =
      (capturedPhotos.idBack?.uploaded ? 1 : 0) +
      (!mustSelfie && capturedPhotos.selfie?.uploaded ? 1 : 0);
    const optionalTotal = mustSelfie ? 1 : 2; // only ID back optional for FORMAL; selfie+back optional for INFORMAL
    return `Required ${requiredCompleted}/${requiredTotal} • Optional ${optionalCompleted}/${optionalTotal}`;
  };

  const currentConfig = stepConfig[currentStep];
  const currentPhoto = capturedPhotos[currentStep];
  const isCapturing = loading === currentStep;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={22}
            iconColor={theme.colors.primary}
            onPress={handleBack}
          />
          <View style={styles.headerContent}>
            <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>4</Text>
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
              Step 4: Live Document Capture
            </Text>
          </View>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.stepDots}>
            {(Object.keys(stepConfig) as Step[]).map((step, index) => {
              const cfg = stepConfig[step];
              const done = !!capturedPhotos[step]?.uploaded;
              const active = currentStep === step;
              return (
                <View key={step} style={styles.stepDotContainer}>
                  <View
                    style={[
                      styles.stepDot,
                      { backgroundColor: done ? "#4CAF50" : active ? theme.colors.primary : theme.colors.outline },
                    ]}
                  >
                    <Text style={styles.stepDotIcon}>{done ? "✓" : cfg.icon}</Text>
                  </View>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.stepLabel,
                      { color: active ? theme.colors.primary : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {cfg.title.split(" ")[1]}
                  </Text>
                  {index < (Object.keys(stepConfig).length - 1) && (
                    <View style={[styles.stepConnector, { backgroundColor: theme.colors.outline }]} />
                  )}
                </View>
              );
            })}
          </View>
          <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
            {getProgressText()}
          </Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
            {currentConfig.title}
          </Text>

          <Text variant="bodyMedium" style={[styles.instructions, { color: theme.colors.onSurfaceVariant }]}>
            {currentConfig.instructions}
          </Text>

          {/* Camera/Preview Area (tap to capture if not uploaded) */}
          <Card
            style={[styles.cameraContainer, { backgroundColor: currentConfig.bgColor }]}
            onPress={() => !currentPhoto?.uploaded && !isCapturing && capturePhoto(currentStep, "camera")}
          >
            <Card.Content style={styles.cameraContent}>
              {currentPhoto?.uri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: currentPhoto.uri }} style={styles.previewImage} />
                  {currentPhoto.uploaded && (
                    <View style={styles.uploadedBadge}>
                      <Text style={styles.uploadedText}>✓ Uploaded</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.placeholderContainer}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={[styles.placeholderText, { color: theme.colors.onSurfaceVariant }]}>
                    {isCapturing ? "Capturing..." : "Tap to capture"}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Upload Progress */}
          {isCapturing && (
            <View style={styles.uploadProgress}>
              <ProgressBar
                progress={currentPhoto?.uploadProgress ? currentPhoto.uploadProgress / 100 : 0}
                color={theme.colors.primary}
              />
              <Text variant="bodySmall" style={[styles.uploadText, { color: theme.colors.onSurfaceVariant }]}>
                Uploading... {currentPhoto?.uploadProgress || 0}%
              </Text>
            </View>
          )}

          {/* Error Message */}
          {error && <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!currentPhoto?.uploaded ? (
              <View style={{ gap: 8 }}>
                <Button
                  mode="contained"
                  onPress={() => capturePhoto(currentStep, "camera")}
                  loading={isCapturing}
                  disabled={isCapturing}
                  style={[styles.captureButton, { backgroundColor: "#FBC02D" }]}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
                >
                  {isCapturing ? "Capturing..." : `Capture ${currentConfig.title.split(" ")[1]}`}
                </Button>

                <Button
                  mode="outlined"
                  onPress={() => capturePhoto(currentStep, "library")}
                  disabled={isCapturing}
                  style={styles.retakeButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
                >
                  Pick from gallery
                </Button>

                {currentStep === "selfie" && !mustSelfie && (
                  <Button
                    mode="text"
                    onPress={handleNext}
                    style={{ marginTop: 4 }}
                    labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
                  >
                    Skip selfie (optional)
                  </Button>
                )}
              </View>
            ) : (
              <Button
                mode="outlined"
                onPress={() => retakePhoto(currentStep)}
                style={styles.retakeButton}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: theme.colors.primary }]}
              >
                Retake Photo
              </Button>
            )}
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            {currentStep !== "idBack" && canProceedToNext() && (
              <Button
                mode="contained"
                onPress={handleNext}
                style={[styles.nextButton, { backgroundColor: theme.colors.primary }]}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: theme.colors.onPrimary }]}
              >
                {getNextButtonText()}
              </Button>
            )}

            {currentStep === "idBack" && canFinish() && (
              <Button
                mode="contained"
                onPress={handleContinue}
                loading={finalLoading}
                disabled={finalLoading}
                style={[styles.continueButton, { backgroundColor: "#4CAF50" }]}
                contentStyle={styles.buttonContent}
                labelStyle={[styles.buttonLabel, { color: "#FFFFFF" }]}
              >
                Continue to Payment Setup
              </Button>
            )}
          </View>

          {/* Helper Text */}
          <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
            Ensure good lighting and hold your device steady for best results.
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerContent: { flex: 1, alignItems: "center", marginLeft: -40 },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stepNumber: { fontSize: 18, fontWeight: "bold" },
  title: { fontWeight: "700", textAlign: "center" },
  progressContainer: { alignItems: "center", marginBottom: 24 },
  stepDots: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  stepDotContainer: { alignItems: "center", position: "relative" },
  stepDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  stepDotIcon: { fontSize: 18 },
  stepLabel: { marginTop: 4, fontSize: 10, textAlign: "center" },
  stepConnector: { position: "absolute", top: 24, left: 56, width: 32, height: 2 },
  progressText: { fontSize: 12 },
  formContainer: { borderRadius: 20, padding: 24 },
  formTitle: { fontWeight: "700", textAlign: "center", marginBottom: 8 },
  instructions: { textAlign: "center", marginBottom: 24, lineHeight: 20 },
  cameraContainer: { marginBottom: 16, borderRadius: 16, overflow: "hidden" },
  cameraContent: { padding: 0 },
  previewContainer: { position: "relative" },
  previewImage: { width: "100%", height: 200, borderRadius: 12 },
  uploadedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  uploadedText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  placeholderContainer: { height: 200, justifyContent: "center", alignItems: "center" },
  placeholderIcon: { fontSize: 48, marginBottom: 12 },
  placeholderText: { fontSize: 16, fontWeight: "500" },
  uploadProgress: { marginBottom: 16 },
  uploadText: { textAlign: "center", marginTop: 8, fontSize: 12 },
  errorText: { textAlign: "center", marginBottom: 16, fontSize: 14 },
  actionButtons: { marginBottom: 16 },
  captureButton: { borderRadius: 25 },
  retakeButton: { borderRadius: 25 },
  navigationButtons: { marginBottom: 16 },
  nextButton: { borderRadius: 25 },
  continueButton: { borderRadius: 25 },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  helperText: { textAlign: "center", fontStyle: "italic", lineHeight: 18 },
});