"use client";

import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, TextInput as RNTextInput, NativeSyntheticEvent, TextInputKeyPressEventData } from "react-native";
import { Text, Button, useTheme, Surface, IconButton } from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { signupVerify } from "../../lib/api/modules/auth";
import { storage } from "../../lib/utilis/storage";

type SessionData = {
  email?: string | null;
  phone?: string | null;
  name: string;
  password: string;   // hashed
  otp: string;        // hashed
  otpExpires: string; // ISO
  referralCode?: string;
  __dev_hint?: string;
};

export default function OTPScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState("");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const inputRefs = useRef<(RNTextInput | null)[]>([]);

  // Load session bundle saved by signupInitiate
  useEffect(() => {
    const loadSessionData = async () => {
      try {
        console.log('=== LOADING SESSION DATA ===');
        const parsed = await storage.getJSON("signupSessionData") as SessionData | null;
        console.log('Raw session data:', {
          ...parsed,
          password: parsed?.password ? '[HIDDEN]' : 'undefined',
          otp: parsed?.otp ? '[HIDDEN]' : 'undefined'
        });
        
        if (!parsed) {
          console.error('No session data found');
          setError("Your signup session is missing. Please start again.");
          return;
        }

        // Check required fields
        if (!parsed.name || !parsed.password || !parsed.otp || !parsed.otpExpires) {
          console.error('Missing required fields in session data');
          setError("Session data incomplete. Please start again.");
          return;
        }
        
        if (!parsed.otpExpires || Date.now() > new Date(parsed.otpExpires).getTime()) {
          console.error('OTP expired:', { 
            expires: parsed.otpExpires, 
            now: new Date().toISOString(),
            expired: Date.now() > new Date(parsed.otpExpires).getTime()
          });
          setError("Your verification code has expired. Please sign up again.");
          return;
        }
        
        console.log('Session data loaded successfully');
        setSessionData(parsed);
      } catch (error) {
        console.error('Error loading session data:', error);
        setError("Could not load signup session. Please start again.");
      }
    };
    
    loadSessionData();
  }, []);

  // Countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError("");
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    const key = event.nativeEvent.key;
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }
    if (!sessionData) {
      setError("Your signup session is missing. Please start again.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      console.log('=== STARTING OTP VERIFICATION ===');
      
      // Prepare the complete payload with all required fields
      const verifyPayload = {
        // All the session data from initiate
        name: sessionData.name,
        email: sessionData.email || (email ? String(email) : null),
        phone: sessionData.phone || null,
        password: sessionData.password, // Already hashed from initiate
        otp: sessionData.otp, // Already hashed from initiate
        otpExpires: sessionData.otpExpires,
        referralCode: sessionData.referralCode || null,
        // The user's entered OTP
        otpEntered: otpCode,
      };

      console.log('Verify payload prepared:', {
        ...verifyPayload,
        password: verifyPayload.password ? '[HIDDEN]' : 'undefined',
        otp: verifyPayload.otp ? '[HIDDEN]' : 'undefined'
      });

      // Check all required fields are present
      if (!verifyPayload.name || !verifyPayload.password || !verifyPayload.otp || 
          !verifyPayload.otpExpires || !verifyPayload.otpEntered) {
        console.error('Missing required fields in verify payload');
        setError("Missing required data. Please start signup again.");
        return;
      }

      const res = await signupVerify(verifyPayload);
      
      console.log('Verification response:', res);

      if (res?.error) {
        setError(res.error || "Invalid verification code. Please try again.");
        return;
      }

      if (!res?.success && !res?.token) {
        setError("Verification failed. Please try again.");
        return;
      }

      // Clean up local session bundle on success
      console.log('Verification successful, cleaning up session');
      await storage.removeItem("signupSessionData");
      
      // Navigate to dashboard
      router.replace("/(tabs)");
      
    } catch (e: any) {
      console.error('OTP verification error:', e);
      
      const errorMessage = 
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Invalid verification code. Please try again.";
        
      setError(errorMessage);
      
      // If it's a 400 error with missing fields, suggest restarting
      if (e?.response?.status === 400 && errorMessage.includes('Missing')) {
        setError(errorMessage + " Please restart the signup process.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      // TODO: Call your resend endpoint here if you add one
      // For now, just reset the UI
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      setError("");
      inputRefs.current[0]?.focus();
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => router.back();
  const isOtpComplete = otp.every((digit) => digit !== "");

  // Show loading state while session data is loading
  if (sessionData === null && !error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <View style={styles.form}>
            <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
              Loading verification data...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onBackground}
            onPress={handleBack}
            style={styles.backButton}
          />
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Verify Email
          </Text>
        </View>

        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.form}>
            <View style={styles.iconContainer}>
              <Surface style={[styles.iconBackground, { backgroundColor: theme.colors.primaryContainer }]} elevation={1}>
                <Text style={[styles.iconText, { color: theme.colors.primary }]}>📧</Text>
              </Surface>
            </View>

            <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.onSurface }]}>
              Enter Verification Code
            </Text>
            <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
              We've sent a 6-digit verification code to{"\n"}
              <Text style={[styles.emailText, { color: theme.colors.primary }]}>
                {String(email || sessionData?.email || "")}
              </Text>
            </Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    {
                      borderColor: digit ? theme.colors.primary : theme.colors.outline,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.onSurface,
                    },
                    error ? [styles.otpInputError, { borderColor: theme.colors.error }] : null,
                  ]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(v, index)}
                  onKeyPress={(event) => handleKeyPress(event, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {!!error && (
              <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            )}

            <Button
              mode="contained"
              onPress={handleVerify}
              loading={loading}
              disabled={loading || !isOtpComplete}
              style={[
                styles.verifyButton,
                {
                  backgroundColor: isOtpComplete ? theme.colors.primary : theme.colors.surfaceDisabled,
                  opacity: isOtpComplete ? 1 : 0.6,
                },
              ]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Verify Code
            </Button>

            <View style={styles.resendContainer}>
              {countdown > 0 ? (
                <Text variant="bodyMedium" style={[styles.countdownText, { color: theme.colors.onSurfaceVariant }]}>
                  Resend code in {countdown}s
                </Text>
              ) : (
                <Button
                  mode="text"
                  onPress={handleResendCode}
                  loading={resendLoading}
                  disabled={resendLoading}
                  labelStyle={[styles.resendButtonText, { color: theme.colors.primary }]}
                >
                  Resend Code
                </Button>
              )}
            </View>
          </View>
        </Surface>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginLeft: -8,
    marginRight: 8,
  },
  title: {
    fontWeight: "bold",
  },
  formContainer: {
    borderRadius: 16,
    flex: 1,
  },
  form: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 24,
  },
  subtitle: {
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  emailText: {
    fontWeight: "600",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "bold",
  },
  otpInputError: {
    // borderColor will be set dynamically using theme.colors.error
  },
  errorText: {
    textAlign: "center",
    marginBottom: 24,
  },
  verifyButton: {
    borderRadius: 28,
    width: "100%",
    marginBottom: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  resendContainer: {
    alignItems: "center",
  },
  countdownText: {
    textAlign: "center",
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});