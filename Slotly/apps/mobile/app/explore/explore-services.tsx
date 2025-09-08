import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Image, TouchableOpacity, RefreshControl, Linking, Alert } from "react-native";
import { Text, useTheme, ActivityIndicator, Button, Divider } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";

import UICard from "../components/ui/Card";
import { getBusiness } from "../../lib/api/modules/business";
import { listServicesForBusiness } from "../../lib/api/modules/services";
import { getBusinessReviews } from "../../lib/api/modules/business";

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type Business = {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  logoUrl?: string | null;
  description?: string | null;
};

type ReviewsData = {
  averageRating: number;
  reviewCount: number;
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    imageUrl?: string;
    createdAt: string;
    user: {
      id: string;
      name?: string;
      avatarUrl?: string;
    };
  }>;
};

export default function BusinessServicesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { businessId, name, address, logoUrl, lat, lon } =
    useLocalSearchParams<{ businessId?: string; name?: string; address?: string; logoUrl?: string; lat?: string; lon?: string }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [business, setBusiness] = useState<Business | null>(() => {
    // Seed from params for instant paint
    if (!businessId) return null;
    return {
      id: String(businessId),
      name: name || "Business",
      address: address || undefined,
      latitude: lat ? Number(lat) : undefined,
      longitude: lon ? Number(lon) : undefined,
      logoUrl: logoUrl || undefined,
      description: undefined,
    };
  });
  const [services, setServices] = useState<Service[]>([]);
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!businessId) {
      setError("Missing businessId");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      
      // From cache if prefetched; otherwise fetch now
      const [biz, svc, rev] = await Promise.all([
        getBusiness(String(businessId)),
        listServicesForBusiness({ businessId: String(businessId) }),
        getBusinessReviews(String(businessId), { limit: 3 }),
      ]);

      setBusiness(biz);
      setServices(Array.isArray(svc) ? svc : []);
      setReviewsData(rev);
    } catch (e: any) {
      console.log("Failed loading business/services", e);
      setError(e?.message || "Failed to load");
      // Don't clear business state if we had optimistic data
      setServices([]);
      setReviewsData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const onServicePress = useCallback((svc: Service) => {
    if (!business) return;
    router.push({
      pathname: "/booking/service",
      params: {
        serviceId: String(svc.id),
        businessId: String(business.id),
        serviceName: svc.name,
        servicePrice: String(svc.price ?? ""),
        businessName: business.name ?? "Business",
      },
    } as any);
  }, [router, business]);

  const openInMaps = useCallback(async () => {
    if (!business?.latitude || !business?.longitude) return;

    const coordinates = `${business.latitude},${business.longitude}`;
    const label = encodeURIComponent(business.name || 'Business Location');
    
    // Try Google Maps first (most common)
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates}&query_place_id=${label}`;
    
    // Fallback URLs for different platforms
    const appleMapsUrl = `http://maps.apple.com/?q=${label}&ll=${coordinates}`;
    const fallbackUrl = `https://maps.google.com/maps?q=${coordinates}`;

    try {
      // Check if Google Maps URL can be opened
      const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogle) {
        await Linking.openURL(googleMapsUrl);
        return;
      }

      // Try Apple Maps (iOS)
      const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
      if (canOpenApple) {
        await Linking.openURL(appleMapsUrl);
        return;
      }

      // Fallback to web version
      await Linking.openURL(fallbackUrl);
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert(
        "Error",
        "Unable to open maps. Please check if you have a maps app installed.",
        [{ text: "OK", style: "default" }]
      );
    }
  }, [business]);

  const loadAllReviews = useCallback(async () => {
    if (!business?.id || !reviewsData) return;
    
    setLoadingMoreReviews(true);
    try {
      const allReviews = await getBusinessReviews(String(business.id), { 
        limit: Math.max(25, reviewsData.reviewCount), 
        page: 1 
      });
      setReviewsData(allReviews);
    } catch (error) {
      console.error('Failed to load all reviews:', error);
      Alert.alert("Error", "Failed to load all reviews. Please try again.");
    } finally {
      setLoadingMoreReviews(false);
    }
  }, [business?.id, reviewsData]);

  const mapsAvailable = useMemo(() => {
    return !!(business?.latitude && business?.longitude);
  }, [business]);

  const hasMoreReviews = useMemo(() => {
    return reviewsData && reviewsData.reviewCount > (reviewsData.reviews?.length || 0);
  }, [reviewsData]);

  // Show global loader only if we can't paint header yet
  if (loading && !refreshing && !business) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Loading business…</Text>
      </View>
    );
  }

  if (error && !business) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: theme.colors.error, textAlign: "center" }}>{error}</Text>
        <Button mode="contained" style={{ marginTop: 12 }} onPress={fetchAll}>Retry</Button>
      </View>
    );
  }

  if (!business) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header / hero */}
      <Image
        source={{ uri: business.logoUrl || "https://via.placeholder.com/1200x300.png?text=Business" }}
        style={{ width: "100%", height: 180 }}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text variant="headlineSmall" style={{ fontWeight: "800", color: theme.colors.primary }}>
          {business.name}
        </Text>
        {!!business.address && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            📍 {business.address}
          </Text>
        )}
        {!!business.description && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
            {business.description}
          </Text>
        )}
        {mapsAvailable && (
          <TouchableOpacity onPress={openInMaps}>
            <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: 8 }}>
              View on Maps →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Divider style={{ marginTop: 16 }} />

      {/* Services list */}
      <Text style={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 16, fontWeight: "800", fontSize: 18 }}>
        Services
      </Text>
      
      {/* Show loading indicator only for services if we have business data */}
      {loading && !refreshing && services.length === 0 && (
        <View style={{ alignItems: "center", paddingVertical: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>Loading services…</Text>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {services.length === 0 && !loading ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>No services published yet.</Text>
        ) : services.map((svc) => (
          <TouchableOpacity key={svc.id} onPress={() => onServicePress(svc)}>
            <UICard>
              <View style={{ padding: 12 }}>
                <Text variant="titleSmall" style={{ fontWeight: "700" }}>{svc.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  {typeof svc.price === "number" ? `KSh ${svc.price.toLocaleString()}` : "—"}
                  {typeof svc.duration === "number" ? ` · ${svc.duration} mins` : ""}
                </Text>
              </View>
            </UICard>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reviews section */}
      {reviewsData && (
        <>
          <Text style={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 16, fontWeight: "800", fontSize: 18 }}>
            Reviews{reviewsData.reviewCount > 0 
              ? ` · ⭐ ${reviewsData.averageRating.toFixed(1)} (${reviewsData.reviewCount})` 
              : " · No rating"}
          </Text>
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {reviewsData.reviews.length === 0 ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>No reviews yet. Be the first to review!</Text>
            ) : (
              <>
                {reviewsData.reviews.map((r) => (
                  <UICard key={r.id}>
                    <View style={{ padding: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Image 
                          source={{ uri: r.user?.avatarUrl || "https://via.placeholder.com/40" }} 
                          style={{ width: 32, height: 32, borderRadius: 16 }} 
                        />
                        <Text style={{ fontWeight: "700", flex: 1 }}>{r.user?.name || "Customer"}</Text>
                        <Text style={{ color: theme.colors.primary }}>⭐ {r.rating}/5</Text>
                      </View>
                      {!!r.comment && <Text style={{ marginTop: 8, lineHeight: 20 }}>{r.comment}</Text>}
                      {!!r.imageUrl && (
                        <Image 
                          source={{ uri: r.imageUrl }} 
                          style={{ width: "100%", height: 140, marginTop: 8, borderRadius: 8 }} 
                        />
                      )}
                      <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </UICard>
                ))}
                
                {hasMoreReviews && (
                  <Button
                    mode="text"
                    onPress={loadAllReviews}
                    loading={loadingMoreReviews}
                    disabled={loadingMoreReviews}
                    style={{ marginTop: 8 }}
                  >
                    {loadingMoreReviews ? "Loading..." : `View all ${reviewsData.reviewCount} reviews →`}
                  </Button>
                )}
              </>
            )}
          </View>
        </>
      )}

      <View style={{ height: 24 }} />
      <View style={{ paddingHorizontal: 16 }}>
        <Button mode="outlined" onPress={() => router.back()} icon="arrow-left">
          Back
        </Button>
      </View>
    </ScrollView>
  );
}