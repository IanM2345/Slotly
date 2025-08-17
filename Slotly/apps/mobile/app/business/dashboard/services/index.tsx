"use client"

import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet } from "react-native"
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  useTheme,
  Chip,
} from "react-native-paper"
import { useRouter } from "expo-router"
import { VerificationGate } from "../../../../components/VerificationGate"
import { Section } from "../../../../components/Section"
import { FilterChipsRow } from "../../../../components/FilterChipsRow"
import { getServices, getBundles } from "../../../../lib/api/manager"
import type { Service, Bundle } from "../../../../lib/types"

export default function ServicesIndexScreen() {
  const router = useRouter()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [selectedCategory, setSelectedCategory] = useState(["All Services"])

  useEffect(() => {
    loadData()
  }, [selectedCategory])

  const loadData = async () => {
    setLoading(true)
    try {
      const category = selectedCategory[0] === "All Services" ? undefined : selectedCategory[0].toLowerCase() as Service["category"]
      const [servicesData, bundlesData] = await Promise.all([
        getServices("business-1", { category }),
        getBundles("business-1"),
      ])
      setServices(servicesData)
      setBundles(bundlesData)
    } catch (error) {
      console.error("Error loading services:", error)
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = [
    { key: "All Services", label: "All Services" },
    { key: "Hair", label: "Hair" },
    { key: "Spa", label: "Spa" },
    { key: "Nails", label: "Nails" },
    { key: "Bundles", label: "Bundles" },
  ]

  const filteredData = selectedCategory[0] === "Bundles" ? [] : services
  const showBundles = selectedCategory[0] === "Bundles" || selectedCategory[0] === "All Services"

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    )
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
            options={categoryOptions}
            selectedKeys={selectedCategory}
            onSelectionChange={setSelectedCategory}
            multiSelect={false}
          />
        </Section>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Button
            mode="outlined"
            onPress={() => console.log("Add Service")}
            style={styles.actionButton}
            icon="plus"
          >
            Add Service
          </Button>
          <Button
            mode="contained"
            onPress={() => console.log("Create Bundle")}
            style={[styles.actionButton, { backgroundColor: theme.colors.secondary }]}
            icon="package-variant"
          >
            Create Bundle
          </Button>
        </View>

        {/* Services */}
        {filteredData.length > 0 && (
          <Section title="Services">
            <View style={styles.servicesContainer}>
              {filteredData.map((service) => (
                <Surface key={service.id} style={styles.serviceCard} elevation={2}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceEmoji}>{service.emoji || "💼"}</Text>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={styles.serviceCategory}>{service.category.toUpperCase()}</Text>
                    </View>
                    <View style={styles.servicePricing}>
                      <Text style={styles.servicePrice}>KSh {service.price.toLocaleString()}</Text>
                      <Text style={styles.serviceDuration}>{service.durationMins}min</Text>
                    </View>
                  </View>

                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}

                  <View style={styles.serviceActions}>
                    <Button mode="outlined" compact style={styles.serviceActionBtn}>
                      Edit
                    </Button>
                    <Button mode="contained" compact style={styles.serviceActionBtn}>
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
                    <Text style={styles.bundleEmoji}>{bundle.emoji || "📦"}</Text>
                    <View style={styles.bundleInfo}>
                      <Text style={styles.bundleName}>{bundle.name}</Text>
                      {bundle.savingsPct && (
                        <Chip
                          style={styles.savingsChip}
                          textStyle={styles.savingsText}
                          compact
                        >
                          {bundle.savingsPct}% OFF
                        </Chip>
                      )}
                    </View>
                    <View style={styles.bundlePricing}>
                      <Text style={styles.bundlePrice}>KSh {bundle.price.toLocaleString()}</Text>
                      <Text style={styles.bundleDuration}>{bundle.durationMins}min</Text>
                    </View>
                  </View>

                  <View style={styles.bundleServices}>
                    <Text style={styles.bundleServicesTitle}>Included Services:</Text>
                    {bundle.services.map((service, index) => (
                      <Text key={index} style={styles.bundleServiceItem}>
                        • {service}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.bundleActions}>
                    <Button mode="outlined" compact style={styles.bundleActionBtn}>
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
    </VerificationGate>
  )
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