"use client";

import { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { 
  Text, 
  TextInput, 
  Button, 
  useTheme, 
  Surface, 
  IconButton, 
  List 
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useOnboarding } from "../../../context/OnboardingContext";

type AdminEntry = { name: string; email: string; role?: string };

export default function AdminUsers() {
  const theme = useTheme();
  const router = useRouter();
  const { data, setData, updateKycSection } = useOnboarding();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [list, setList] = useState<AdminEntry[]>(data.adminUsers || []);
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    if (!name.trim() || !email.trim()) {
      setErr("Name and email are required.");
      return;
    }
    
    // Check for duplicate email
    if (list.some(user => user.email.toLowerCase() === email.trim().toLowerCase())) {
      setErr("Email already exists.");
      return;
    }
    
    setList((prev) => [...prev, { 
      name: name.trim(), 
      email: email.trim().toLowerCase(), 
      role: "MANAGER" 
    }]);
    setName("");
    setEmail("");
  };

  const remove = (i: number) => setList((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    setData({ adminUsers: list });
    updateKycSection("admin", list.length > 0);
    router.push("/business/onboarding/kyc");
  };

  const count = useMemo(() => list.length, [list.length]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Step Indicator */}
        <View style={styles.header}>
          <View style={[styles.stepIndicator, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.stepNumber, { color: theme.colors.onPrimary }]}>3</Text>
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
            Admin Users
          </Text>
        </View>

        {/* Phone Status Bar Mockup */}
        <View style={[styles.phoneBar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.timeText, { color: theme.colors.onPrimary }]}>9:41 AM</Text>
        </View>

        {/* Main Content */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.formHeader}>
            <IconButton 
              icon="arrow-left" 
              size={20} 
              iconColor={theme.colors.primary} 
              onPress={() => router.back()} 
            />
            <Text variant="titleLarge" style={[styles.formTitle, { color: theme.colors.primary }]}>
              Add Admin Users
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.colors.primary }]} />

          {/* Form Inputs */}
          <TextInput
            mode="outlined"
            label="Full Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {err && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {err}
            </Text>
          )}

          <Button 
            mode="outlined" 
            onPress={add} 
            style={styles.addButton}
            icon="plus"
          >
            Add User
          </Button>

          {/* Admin Users List */}
          {count > 0 && (
            <>
              <Text variant="titleSmall" style={[styles.listTitle, { color: theme.colors.onSurface }]}>
                Admin Users ({count})
              </Text>
              
              {list.map((user, index) => (
                <List.Item
                  key={`${user.email}-${index}`}
                  title={user.name}
                  description={user.email}
                  descriptionStyle={{ color: theme.colors.outline }}
                  left={(props) => (
                    <List.Icon 
                      {...props} 
                      icon="account-circle" 
                      color={theme.colors.primary} 
                    />
                  )}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="delete"
                      iconColor={theme.colors.error}
                      onPress={() => remove(index)}
                    />
                  )}
                  style={[
                    styles.listItem,
                    { 
                      borderBottomColor: theme.colors.outline,
                      backgroundColor: theme.colors.surfaceVariant 
                    }
                  ]}
                />
              ))}
            </>
          )}

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            style={[styles.saveButton, { backgroundColor: "#FBC02D" }]}
            labelStyle={[styles.saveButtonLabel, { color: theme.colors.primary }]}
            icon="content-save"
            disabled={list.length === 0}
          >
            Save & Continue to KYC
          </Button>
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
    paddingHorizontal: 20, 
    paddingTop: 20,
    paddingBottom: 20 
  },
  header: { 
    alignItems: "center", 
    marginBottom: 20 
  },
  stepIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  stepNumber: { 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  title: { 
    fontWeight: "bold", 
    textAlign: "center" 
  },
  phoneBar: { 
    height: 44, 
    borderRadius: 22, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 20 
  },
  timeText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  card: { 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 20 
  },
  formHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 16 
  },
  formTitle: { 
    fontWeight: "bold" 
  },
  divider: { 
    height: 2, 
    marginBottom: 24 
  },
  input: { 
    marginBottom: 12,
    backgroundColor: "transparent"
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14
  },
  addButton: {
    marginBottom: 16
  },
  listTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontWeight: "600"
  },
  listItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 12
  },
  saveButton: { 
    borderRadius: 25,
    marginTop: 16
  },
  saveButtonLabel: {
    fontWeight: "700",
    fontSize: 16
  }
});