// apps/mobile/app/(tabs)/explore.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { View, ScrollView, Image, StyleSheet, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { Text, SegmentedButtons, useTheme, ActivityIndicator } from "react-native-paper";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import SearchBar from "../components/ui/SearchBar";
import Chip from "../components/ui/Chip";
import UICard from "../components/ui/Card";

import { searchNearby } from "../../lib/api/modules/search";
import { search as searchBusinesses } from "../../lib/api/modules/business";

type Mode = "institutions" | "services";

type ServiceItem = {
  id: string;
  name: string;
  price?: number;
  duration?: number;
  business?: { id: string; name: string; address?: string; latitude?: number; longitude?: number };
  distanceMeters?: number;
  imageUrl?: string;
};

type BusinessItem = {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  logoUrl?: string;
};

type LocationState = {
  coords: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
};

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
const FALLBACK_LIMIT = 5;

// --- Normalization helpers ---
const uniqById = <T extends { id: string }>(arr: T[]) =>
  Array.from(new Map(arr.map(x => [x.id, x])).values());

const normalizeServiceResults = (arr: any[]): ServiceItem[] =>
  arr.map((s: any, i: number) => {
    const bizRaw = s.business ?? {};
    const bizId = String(
      bizRaw.id ??
      bizRaw._id ??
      s.businessId ??
      `biz-${s.name ?? "unknown"}-${i}`
    );

    return {
      id: String(
        s.id ??
        s._id ??
        s.serviceId ??
        `${bizId}-svc-${i}`
      ),
      name: s.name ?? "Service",
      price: typeof s.price === "number" ? s.price : undefined,
      duration: typeof s.duration === "number" ? s.duration : undefined,
      business: s.business
        ? {
            id: bizId,
            name: s.business.name ?? "Business",
            address: s.business.address,
            latitude: s.business.latitude,
            longitude: s.business.longitude,
          }
        : undefined,
      distanceMeters: typeof s.distanceMeters === "number" ? s.distanceMeters : undefined,
      imageUrl: s.imageUrl,
    };
  });

const normalizeBusinessResults = (arr: any[]): BusinessItem[] =>
  arr.map((b: any, i: number) => ({
    id: String(b.id ?? b._id ?? `biz-${b.name ?? "unknown"}-${i}`),
    name: b.name ?? "Business",
    address: b.address,
    latitude: b.latitude,
    longitude: b.longitude,
    distanceMeters: typeof b.distanceMeters === "number" ? b.distanceMeters : undefined,
    logoUrl: b.logoUrl,
  }));

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const searchTimeoutRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("services");

  const [location, setLocation] = useState<LocationState>({
    coords: null,
    loading: false,
    error: null,
    permissionDenied: false,
  });

  const [searchState, setSearchState] = useState({
    loading: false,
    refreshing: false,
    services: [] as ServiceItem[],
    usedFallback: false,
    lastSearchTime: 0,
  });

  const [bizState, setBizState] = useState({
    loading: false,
    businesses: [] as BusinessItem[],
  });

  // Request location permission and get coordinates
  const requestLocation = useCallback(async () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocation(prev => ({
          ...prev,
          loading: false,
          permissionDenied: true,
          error: "Location permission denied",
        }));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(prev => ({
        ...prev,
        coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
        loading: false,
        error: null,
        permissionDenied: false,
      }));
    } catch (error) {
      console.error("Location error:", error);
      setLocation(prev => ({ ...prev, loading: false, error: "Failed to get location" }));
    }
  }, []);

  // Search for services (debounced) with normalization
  const runSearch = useCallback(async (opts?: {
    forceFallback?: boolean;
    isRefresh?: boolean;
    searchQuery?: string;
  }): Promise<void> => {
    const now = Date.now();
    if (!opts?.isRefresh && now - searchState.lastSearchTime < 300) return;

    const isRefresh = opts?.isRefresh || false;
    const searchQuery = opts?.searchQuery ?? query;

    setSearchState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      lastSearchTime: now,
    }));

    try {
      const canUseDevice = location.coords && !opts?.forceFallback;
      const searchCoords = canUseDevice ? location.coords! : NAIROBI_CENTER;

      const params = {
        service: searchQuery || "",
        lat: searchCoords.lat,
        lon: searchCoords.lng,
        time: "anytime" as const,
      };

      const res = await searchNearby(params);
      const raw = Array.isArray(res?.results) ? res.results : [];
      
      // ✅ Normalize and dedupe services
      const services = uniqById(normalizeServiceResults(raw)).sort((a, b) => {
        const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

      const finalList = canUseDevice ? services : services.slice(0, FALLBACK_LIMIT);

      setSearchState(prev => ({
        ...prev,
        services: finalList,
        usedFallback: !canUseDevice,
        loading: false,
        refreshing: false,
      }));
    } catch (error: any) {
      console.error("Search error:", error);
      Alert.alert("Search Error", error?.message || "Failed to load services");
      setSearchState(prev => ({ ...prev, services: [], loading: false, refreshing: false }));
    }
  }, [location.coords, query, searchState.lastSearchTime]);

  // Search for businesses (nearby) with normalization
  const runBusinessSearch = useCallback(async () => {
    setBizState(prev => ({ ...prev, loading: true }));
    try {
      const base = location.coords ?? NAIROBI_CENTER;
      const res = await searchBusinesses({ 
        q: "", 
        lat: base.lat, 
        lng: base.lng,
        date: "",
        dayPart: ""
      });
      
      const items = Array.isArray(res?.businesses)
        ? res.businesses
        : Array.isArray(res?.results)
        ? res.results
        : [];
      
      // ✅ Normalize and dedupe businesses
      const businesses = uniqById(normalizeBusinessResults(items)).sort((a, b) => {
        const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
        const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

      setBizState({
        loading: false,
        businesses: location.coords ? businesses : businesses.slice(0, FALLBACK_LIMIT),
      });
    } catch (e) {
      console.log("Business search error:", e);
      setBizState({ loading: false, businesses: [] });
    }
  }, [location.coords]);

  // Initial location request
  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Initial searches
  useEffect(() => { runSearch(); runBusinessSearch(); }, []); // on mount

  // Refresh when coordinates arrive
  useEffect(() => {
    if (location.coords) { runSearch(); runBusinessSearch(); }
  }, [location.coords, runSearch, runBusinessSearch]);

  // Debounced input
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      runSearch({ searchQuery: text });
    }, 500);
  }, [runSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    runSearch();
  }, [runSearch]);

  const handleRefresh = useCallback(() => {
    runSearch({ isRefresh: true });
    runBusinessSearch();
  }, [runSearch, runBusinessSearch]);

  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }, []);

  const headerNote = useMemo(() => {
    if (location.loading) return "Detecting your location…";
    if (location.error && !location.permissionDenied) return "Location unavailable, showing popular services";
    if (searchState.usedFallback) return "Enable location for personalized results nearby";
    if (location.coords) return "Showing results near you";
    return "Showing popular results";
  }, [location, searchState.usedFallback]);

  // ✅ Updated to navigate directly to booking flow
const handleServicePress = useCallback((item: ServiceItem) => {
    console.log('Service pressed:', item);
    
    // Extract business ID with fallback logic
    const businessId = item.business?.id || `biz-${item.id}`;
    
    console.log('Navigation params:', {
      serviceId: String(item.id),
      businessId: String(businessId),
      serviceName: item.name,
      servicePrice: item.price ? String(item.price) : "",
      businessName: item.business?.name ?? "Business",
    });
    
    router.push({
      pathname: "/booking/service", // First go to service details screen
      params: {
        serviceId: String(item.id),
        businessId: String(businessId),
        serviceName: item.name,
        servicePrice: item.price ? String(item.price) : "",
        businessName: item.business?.name ?? "Business",
      },
    } as any);
  }, [router]);

  const handleBusinessPress = useCallback((biz: BusinessItem) => {
    router.push({ pathname: "/explore/explore-services", params: { businessId: biz.id } } as any);
  }, [router]);

  const handleChipPress = useCallback((action: string) => {
    switch (action) {
      case "location":
        if (location.permissionDenied) requestLocation();
        else runSearch({ forceFallback: !location.coords });
        break;
      case "time":
        router.push("/date-selector" as any);
        break;
      default:
        runSearch();
    }
  }, [location, runSearch, requestLocation, router]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={searchState.refreshing} onRefresh={handleRefresh} />}
    >
      <View style={{ height: 12 }} />

      <SearchBar
        placeholder="Search services (e.g., haircut, massage)"
        value={query}
        onChangeText={handleSearchChange}
        onPressFilters={() => router.push("/filters" as any)}
      />

      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: "institutions", label: "Institutions" },
            { value: "services", label: "Services" },
          ]}
          density="small"
          style={{ borderRadius: 12 }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
        <Chip onPress={() => handleChipPress("location")}>
          {location.loading ? "Locating..." : searchState.usedFallback ? "Enable location" : "Near me"}
        </Chip>
        <Chip onPress={() => handleChipPress("time")}>When?</Chip>
        <Chip onPress={() => runSearch()}>Open now</Chip>
        <Chip onPress={() => runSearch()}>Offers</Chip>
      </ScrollView>

      <Text style={{ marginTop: 4, paddingHorizontal: 16, color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
        {headerNote}
      </Text>

      {/* Nearby businesses (always show this row) */}
      {!bizState.loading && bizState.businesses.length > 0 && (
        <>
          <Text style={{ marginTop: 16, marginBottom: 8, paddingHorizontal: 16, fontWeight: "800", fontSize: 18 }}>
            Nearby businesses
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {bizState.businesses.slice(0, 10).map((b) => (
              <TouchableOpacity key={b.id} onPress={() => handleBusinessPress(b)}>
                <UICard style={{ width: 220, overflow: "hidden" }}>
                  <Image
                    source={{ uri: b.logoUrl || "https://via.placeholder.com/220x120.png?text=Business" }}
                    style={{ width: "100%", height: 120 }}
                  />
                  <View style={{ padding: 12 }}>
                    <Text variant="titleSmall" style={{ fontWeight: "700" }} numberOfLines={1}>{b.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                      {b.address || "—"}
                    </Text>
                  </View>
                </UICard>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {mode === "institutions" ? (
        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 16 }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Institution browsing coming soon. Switch to "Services" to explore available services.
          </Text>
        </View>
      ) : (
        <>
          {searchState.loading && !searchState.refreshing ? (
            <View style={{ marginTop: 32, alignItems: "center" }}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Finding services...</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 8 }}>
              {searchState.services.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => handleServicePress(item)}>
                  <UICard>
                    <Image
                      source={{ uri: item.imageUrl || "https://via.placeholder.com/600x160.png?text=Service" }}
                      style={{ width: "100%", height: 140 }}
                    />
                    <View style={{ padding: 12 }}>
                      <Text variant="titleSmall" style={{ fontWeight: "700" }}>{item.name}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {item.business?.name && `${item.business.name} · `}
                        {typeof item.price === "number" && `KSh ${item.price.toLocaleString()}`}
                        {typeof item.duration === "number" && ` · ${item.duration} mins`}
                        {typeof item.distanceMeters === "number" && ` · ${(item.distanceMeters / 1000).toFixed(1)} km`}
                      </Text>
                    </View>
                  </UICard>
                </TouchableOpacity>
              ))}
              {searchState.services.length === 0 && (
                <View style={{ marginTop: 32, alignItems: "center", paddingHorizontal: 16 }}>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", fontSize: 16 }}>
                    No services found
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 4, fontSize: 14 }}>
                    Try adjusting your search or {location.permissionDenied ? "enable location access" : "check your connection"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {!searchState.loading && searchState.services.length > 0 && (
            <>
              <Text style={{ marginTop: 24, marginBottom: 8, paddingHorizontal: 16, fontWeight: "800", fontSize: 18 }}>
                Popular in your area ({searchState.services.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                {searchState.services.slice(0, 6).map((item) => (
                  <TouchableOpacity key={`popular-${item.id}`} onPress={() => handleServicePress(item)}>
                    <UICard style={{ width: 200, overflow: "hidden" }}>
                      <Image
                        source={{ uri: item.imageUrl || "https://via.placeholder.com/200x120.png?text=Popular" }}
                        style={{ width: "100%", height: 120 }}
                      />
                      <View style={{ padding: 12 }}>
                        <Text variant="titleSmall" style={{ fontWeight: "700" }} numberOfLines={2}>{item.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                          {item.business?.name && `${item.business.name} · `}
                          {typeof item.price === "number" && `KSh ${item.price.toLocaleString()}`}
                        </Text>
                      </View>
                    </UICard>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
});