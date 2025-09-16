// apps/mobile/app/(tabs)/explore.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { View, ScrollView, Image, StyleSheet, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { Text, SegmentedButtons, useTheme, ActivityIndicator } from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";

import SearchBar from "../components/ui/SearchBar";
import Chip from "../components/ui/Chip";
import UICard from "../components/ui/Card";

import { searchNearby } from "../../lib/api/modules/search";
import { getBusinessReviewSummary } from "../../lib/api/modules/business";

type Mode = "institutions" | "services";

type ServiceItem = {
  id: string;
  name: string;
  price?: number;
  duration?: number;
  business?: { 
    id: string; 
    name: string; 
    address?: string; 
    latitude?: number; 
    longitude?: number; 
  };
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

type Filters = {
  lat?: number; 
  lon?: number;
  date?: string;
  time?: "anytime" | "morning" | "afternoon" | "evening";
  startAt?: string;
  category?: string;
  kind?: "both" | "services" | "businesses";
};

const NAIROBI_CENTER = { lat: -1.286389, lng: 36.817223 };
const FALLBACK_LIMIT = 5;
const SEARCH_THROTTLE_MS = 300;
const SEARCH_DEBOUNCE_MS = 500;
const API_TIMEOUT_MS = 2000;

// --- helpers to coerce numbers/distances/images safely ---
const toNum = (v: any) => (v === undefined || v === null ? undefined : Number(v));
const metersFrom = (v: any) => {
  const n = toNum(v);
  if (!Number.isFinite(n) || n === undefined) return undefined;
  // if the number is tiny, assume it was km and convert to meters
  return n > 100 ? n : Math.round(n * 1000);
};
const pick = (...candidates: any[]) => candidates.find(v => v !== undefined && v !== null);

// --- Utility functions ---
const uniqById = <T extends { id: string }>(arr: T[]): T[] =>
  Array.from(new Map(arr.map(x => [x.id, x])).values());

const normalizeServiceResults = (arr: any[]): ServiceItem[] =>
  arr.map((s: any, i: number) => {
    const b = s.business ?? {};
    const bizId = String(
      pick(b.id, b._id, s.businessId, `biz-${s.name ?? "unknown"}-${i}`)
    );

    return {
      id: String(pick(s.id, s._id, s.serviceId, `${bizId}-svc-${i}`)),
      name: s.name ?? "Service",
      price: toNum(pick(s.price, s.amount, s.cost)),
      duration: toNum(pick(s.duration, s.minutes, s.lengthMin)),
      business: s.business
        ? {
            id: bizId,
            name: s.business.name ?? "Business",
            address: pick(s.business.address, s.business.formattedAddress),
            latitude: toNum(pick(s.business.latitude, s.business.lat)),
            longitude: toNum(pick(s.business.longitude, s.business.lon, s.business.lng)),
          }
        : undefined,
      distanceMeters: metersFrom(pick(s.distanceMeters, s.distance_m, s.distanceKm, s.distance)),
      imageUrl: pick(s.imageUrl, s.image, s.photoUrl, s.coverUrl),
    };
  });

const normalizeBusinessResults = (arr: any[]): BusinessItem[] =>
  arr.map((b: any, i: number) => ({
    id: String(pick(b.id, b._id, `biz-${b.name ?? "unknown"}-${i}`)),
    name: b.name ?? "Business",
    address: pick(b.address, b.formattedAddress),
    latitude: toNum(pick(b.latitude, b.lat)),
    longitude: toNum(pick(b.longitude, b.lon, b.lng)),
    distanceMeters: metersFrom(pick(b.distanceMeters, b.distance_m, b.distanceKm, b.distance)),
    logoUrl: pick(b.logoUrl, b.logo, b.image, b.photoUrl, b.coverUrl),
  }));

const sortByDistance = <T extends { distanceMeters?: number }>(arr: T[]): T[] =>
  arr.sort((a, b) => {
    const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const searchTimeoutRef = useRef<number | null>(null);
  const lastSearchRef = useRef(0);

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
  });

  const [bizState, setBizState] = useState({
    loading: false,
    businesses: [] as BusinessItem[],
  });

  const [suggested, setSuggested] = useState<{ 
    businesses: BusinessItem[]; 
    services: ServiceItem[] 
  } | null>(null);

  // Rating map for businesses
  const [ratingMap, setRatingMap] = useState<Record<string, { avg: number; count: number }>>({});

  // Parse filters from URL params
  const filters = useMemo((): Filters => {
    const f: Filters = {};
    if (typeof params.lat === "string") f.lat = parseFloat(params.lat);
    if (typeof params.lon === "string") f.lon = parseFloat(params.lon);
    if (typeof params.date === "string") f.date = params.date;
    if (typeof params.time === "string") f.time = params.time as Filters["time"];
    if (typeof params.startAt === "string") f.startAt = params.startAt;
    if (typeof params.category === "string") f.category = params.category;
    if (typeof params.kind === "string") f.kind = params.kind as Filters["kind"];
    return f;
  }, [params.lat, params.lon, params.date, params.time, params.startAt, params.category, params.kind]);

  // Stable key for effects
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

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
      
      const loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100,
      });
      
      setLocation(prev => ({
        ...prev,
        coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
        loading: false,
        error: null,
        permissionDenied: false,
      }));
    } catch (error) {
      console.error("Location error:", error);
      setLocation(prev => ({ 
        ...prev, 
        loading: false, 
        error: "Failed to get location" 
      }));
    }
  }, []);

  // Main search function
  const runSearch = useCallback(async (opts?: {
    forceFallback?: boolean;
    isRefresh?: boolean;
    searchQuery?: string;
  }): Promise<void> => {
    const now = Date.now();
    if (!opts?.isRefresh && now - lastSearchRef.current < SEARCH_THROTTLE_MS) {
      return;
    }

    const isRefresh = opts?.isRefresh || false;
    const searchQuery = opts?.searchQuery ?? query;

    setSearchState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
    }));
    
    setBizState(prev => ({ ...prev, loading: true }));
    
    lastSearchRef.current = now;

    try {
      const canUseDevice = location.coords && !opts?.forceFallback;
      const searchCoords = canUseDevice ? location.coords! : NAIROBI_CENTER;

      // Prefer filter overrides over device location/time
      const useLat = Number.isFinite(filters.lat!) ? filters.lat! : searchCoords.lat;
      const useLon = Number.isFinite(filters.lon!) ? filters.lon! : searchCoords.lng;
      const useTime = filters.startAt ? "anytime" : (filters.time || "anytime");

      const res = await searchNearby({
        service: searchQuery || "",
        lat: useLat,
        lon: useLon,
        date: filters.date,
        time: useTime,
        startAt: filters.startAt,
        category: filters.category,
        kind: filters.kind || "both",
        limit: 24,
      }, { timeoutMs: API_TIMEOUT_MS });

      const rawServices = Array.isArray(res?.services) ? res.services : [];
      let rawBusinesses = Array.isArray(res?.businesses) ? res.businesses : [];

      // Fallback: if backend didn't send businesses, derive them from service.business
      if (rawBusinesses.length === 0 && rawServices.length > 0) {
        const bizMap = new Map<string, any>();
        for (const s of rawServices) {
          if (!s?.business) continue;
          const bid = String(pick(s.business.id, s.business._id));
          if (!bid || bizMap.has(bid)) continue;
          bizMap.set(bid, s.business);
        }
        rawBusinesses = Array.from(bizMap.values());
      }

      // Normalize + sort
      const services = sortByDistance(uniqById(normalizeServiceResults(rawServices)));
      const businesses = sortByDistance(uniqById(normalizeBusinessResults(rawBusinesses)));

      // limit if we're using fallback coords
      const usingFilteredLocation = Number.isFinite(filters.lat!);
      const shouldLimitResults = !canUseDevice && !usingFilteredLocation;
      const finalServices = shouldLimitResults ? services.slice(0, FALLBACK_LIMIT) : services;
      const finalBusinesses = shouldLimitResults ? businesses.slice(0, FALLBACK_LIMIT) : businesses;

      // Prefer rating info embedded from API if present
      const withApiRatings = finalBusinesses.map(b => ({
        ...b,
        _avgRating: toNum(((res as any).raw?.ratingByBusiness?.[b.id]?.avg) ?? (b as any).avgRating),
        _ratingCount: toNum(((res as any).raw?.ratingByBusiness?.[b.id]?.count) ?? (b as any).ratingCount),
      }));

      // set state
      setSearchState(prev => ({
        ...prev,
        services: finalServices,
        usedFallback: shouldLimitResults,
        loading: false,
        refreshing: false,
      }));

      setBizState(prev => ({
        ...prev,
        loading: false,
        businesses: withApiRatings,
      }));

      // suggestions
      if (!searchQuery && res?.suggested) {
        setSuggested({
          businesses: normalizeBusinessResults(res.suggested.businesses || []).slice(0, 5),
          services: normalizeServiceResults(res.suggested.services || []).slice(0, 5),
        });
      } else {
        setSuggested(null);
      }

      if (__DEV__) {
        console.log(`🔎 services=${services.length} businesses=${businesses.length}`);
        console.log("   first business:", businesses[0]);
      }
    } catch (error: any) {
      // Handle aborted fetches quietly
      if (error?.name === 'AbortError' || error?.message === 'ABORTED') {
        setSearchState(prev => ({ ...prev, loading: false, refreshing: false }));
        setBizState(prev => ({ ...prev, loading: false }));
        return;
      }
      
      console.error("Search error:", error);
      Alert.alert("Search Error", error?.message || "Failed to load services");
      
      setSearchState(prev => ({ 
        ...prev, 
        services: [], 
        loading: false, 
        refreshing: false 
      }));
      setBizState({ loading: false, businesses: [] });
      setSuggested(null);
    }
  }, [location.coords, query, filters]);

  // Event handlers
  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      runSearch({ searchQuery: text });
    }, SEARCH_DEBOUNCE_MS);
  }, [runSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    runSearch();
  }, [runSearch]);

  const handleRefresh = useCallback(() => {
    runSearch({ isRefresh: true });
  }, [runSearch]);

  const handleServicePress = useCallback((item: ServiceItem) => {
    console.log('Service pressed:', item);
    
    const businessId = item.business?.id || `biz-${item.id}`;
    
    console.log('Navigation params:', {
      serviceId: String(item.id),
      businessId: String(businessId),
      serviceName: item.name,
      servicePrice: item.price ? String(item.price) : "",
      businessName: item.business?.name ?? "Business",
    });
    
    router.push({
      pathname: "/booking/service",
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
    router.push({ 
      pathname: "/explore/explore-services", 
      params: { businessId: biz.id } 
    } as any);
  }, [router]);

  const handleChipPress = useCallback((action: string) => {
    switch (action) {
      case "location":
        if (location.permissionDenied) {
          requestLocation();
        } else {
          runSearch({ forceFallback: !location.coords });
        }
        break;
      case "time":
        router.push("/date-selector" as any);
        break;
      default:
        runSearch();
    }
  }, [location, runSearch, requestLocation, router]);

  const handleClearFilters = useCallback(() => {
    router.replace({ pathname: "/(tabs)/explore" } as any);
  }, [router]);

  // Effects
  useEffect(() => { 
    requestLocation(); 
  }, [requestLocation]);

  useEffect(() => { 
    runSearch(); 
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasFilters = Object.keys(filters).length > 0;
    if (location.coords || hasFilters) {
      runSearch({ isRefresh: true });
    }
  }, [location.coords, filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load rating summaries when businesses change
  useEffect(() => {
    (async () => {
      if (bizState.businesses.length === 0) return;

      // seed from API if present
      const seeded: Record<string, { avg: number; count: number }> = {};
      for (const b of bizState.businesses) {
        const avg = (b as any)._avgRating;
        const count = (b as any)._ratingCount;
        if (Number.isFinite(avg) || Number.isFinite(count)) {
          seeded[b.id] = { avg: Number(avg) || 0, count: Number(count) || 0 };
        }
      }

      const missing = bizState.businesses.filter(b => !(b.id in seeded)).slice(0, 10);
      const fetched = await Promise.all(
        missing.map(async (b) => {
          try {
            const s = await getBusinessReviewSummary(b.id);
            return [b.id, { avg: Math.round((s.averageRating || 0) * 10) / 10, count: s.reviewCount || 0 }];
          } catch {
            return [b.id, { avg: 0, count: 0 }];
          }
        })
      );

      setRatingMap({ ...seeded, ...Object.fromEntries(fetched) });
    })();
  }, [bizState.businesses]);

  useEffect(() => {
    return () => { 
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); 
    };
  }, []);

  // Computed values
  const headerNote = useMemo(() => {
    if (location.loading) return "Detecting your location...";
    
    if (Object.keys(filters).length > 0) {
      const parts = [];
      if (filters.category) parts.push(`${filters.category}`);
      if (filters.startAt) parts.push("exact time slot");
      else if (filters.time && filters.time !== "anytime") parts.push(`${filters.time}`);
      if (filters.kind && filters.kind !== "both") parts.push(`${filters.kind} only`);
      return parts.length > 0 ? `Filtered results: ${parts.join(", ")}` : "Using custom filters";
    }
    
    if (location.error && !location.permissionDenied) {
      return "Location unavailable, showing popular services";
    }
    if (searchState.usedFallback) return "Enable location for personalized results nearby";
    if (location.coords) return "Showing results near you";
    return "Showing popular results";
  }, [location, searchState.usedFallback, filters]);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={searchState.refreshing} onRefresh={handleRefresh} />}
    >
      <View style={{ height: 12 }} />

      <SearchBar
        placeholder="Search businesses & services"
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

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.hScroll}
      >
        <Chip onPress={() => handleChipPress("location")}>
          {location.loading 
            ? "Locating..." 
            : searchState.usedFallback 
            ? "Enable location" 
            : "Near me"}
        </Chip>
        <Chip onPress={() => handleChipPress("time")}>When?</Chip>
        <Chip onPress={() => runSearch()}>Open now</Chip>
        <Chip onPress={() => runSearch()}>Offers</Chip>
      </ScrollView>

      <Text style={[styles.headerNote, { color: theme.colors.onSurfaceVariant }]}>
        {headerNote}
      </Text>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleClearFilters}
            style={[styles.clearFiltersBtn, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <Text style={[styles.clearFiltersText, { color: theme.colors.onSurfaceVariant }]}>
              Clear filters
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Nearby businesses with ratings */}
      {!bizState.loading && bizState.businesses.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Nearby businesses</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.hScroll}
          >
            {bizState.businesses.slice(0, 10).map((b) => (
              <TouchableOpacity key={b.id} onPress={() => handleBusinessPress(b)}>
                <UICard style={styles.businessCard}>
                  <Image
                    source={{ 
                      uri: b.logoUrl || "https://via.placeholder.com/220x120.png?text=Business" 
                    }}
                    style={styles.businessCardImage}
                  />
                  <View style={styles.businessCardContent}>
                    <Text variant="titleSmall" style={styles.businessCardTitle} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, marginTop: 2 }}>
                      {ratingMap[b.id]?.count > 0
                        ? `★ ${ratingMap[b.id].avg} · ${ratingMap[b.id].count} reviews`
                        : "No rating"}
                    </Text>
                    <Text 
                      variant="bodySmall" 
                      style={{ color: theme.colors.onSurfaceVariant }} 
                      numberOfLines={1}
                    >
                      {b.address || "—"}
                    </Text>
                  </View>
                </UICard>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Suggestions (only when user hasn't typed) */}
      {query.length === 0 && suggested && (
        <>
          {suggested.businesses.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Suggested businesses</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.hScroll}
              >
                {suggested.businesses.map((b) => (
                  <TouchableOpacity key={`sugg-biz-${b.id}`} onPress={() => handleBusinessPress(b)}>
                    <UICard style={styles.suggestionCard}>
                      <Image
                        source={{ 
                          uri: b.logoUrl || "https://via.placeholder.com/220x120.png?text=Business" 
                        }}
                        style={styles.suggestionCardImage}
                      />
                      <View style={styles.suggestionCardContent}>
                        <Text variant="titleSmall" style={styles.suggestionCardTitle} numberOfLines={1}>
                          {b.name}
                        </Text>
                        <Text 
                          variant="bodySmall" 
                          style={{ color: theme.colors.onSurfaceVariant }} 
                          numberOfLines={1}
                        >
                          {b.address || "—"}
                        </Text>
                      </View>
                    </UICard>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {suggested.services.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Suggested services</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.hScroll}
              >
                {suggested.services.map((item) => (
                  <TouchableOpacity key={`sugg-svc-${item.id}`} onPress={() => handleServicePress(item)}>
                    <UICard style={styles.serviceCard}>
                      <Image
                        source={{ 
                          uri: item.imageUrl || "https://via.placeholder.com/200x120.png?text=Service" 
                        }}
                        style={styles.serviceCardImage}
                      />
                      <View style={styles.serviceCardContent}>
                        <Text variant="titleSmall" style={styles.serviceCardTitle} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text 
                          variant="bodySmall" 
                          style={{ color: theme.colors.onSurfaceVariant }} 
                          numberOfLines={1}
                        >
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

      {/* Main content based on mode */}
      {mode === "institutions" ? (
        <View style={styles.institutionsPlaceholder}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Institution browsing coming soon. Switch to "Services" to explore available services.
          </Text>
        </View>
      ) : (
        <>
          {searchState.loading && !searchState.refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                Finding services...
              </Text>
            </View>
          ) : (
            <View style={styles.servicesContainer}>
              {searchState.services.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => handleServicePress(item)}>
                  <UICard style={styles.serviceListCard}>
                    <Image
                      source={{ 
                        uri: item.imageUrl || "https://via.placeholder.com/600x160.png?text=Service" 
                      }}
                      style={styles.serviceListCardImage}
                    />
                    <View style={styles.serviceListCardContent}>
                      <Text variant="titleSmall" style={styles.serviceListCardTitle}>
                        {item.name}
                      </Text>
                      <Text 
                        variant="bodySmall" 
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {item.business?.name && `${item.business.name} · `}
                        {typeof item.price === "number" && `KSh ${item.price.toLocaleString()}`}
                        {typeof item.duration === "number" && ` · ${item.duration} mins`}
                        {typeof item.distanceMeters === "number" && 
                          ` · ${(item.distanceMeters / 1000).toFixed(1)} km`}
                      </Text>
                    </View>
                  </UICard>
                </TouchableOpacity>
              ))}
              
              {searchState.services.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsTitle, { color: theme.colors.onSurfaceVariant }]}>
                    No services found
                  </Text>
                  <Text style={[styles.noResultsSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Try adjusting your search or {location.permissionDenied 
                      ? "enable location access" 
                      : "check your connection"}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Popular in your area section */}
          {!searchState.loading && searchState.services.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Popular in your area ({searchState.services.length})
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.hScroll}
              >
                {searchState.services.slice(0, 6).map((item) => (
                  <TouchableOpacity key={`popular-${item.id}`} onPress={() => handleServicePress(item)}>
                    <UICard style={styles.popularCard}>
                      <Image
                        source={{ 
                          uri: item.imageUrl || "https://via.placeholder.com/200x120.png?text=Popular" 
                        }}
                        style={styles.popularCardImage}
                      />
                      <View style={styles.popularCardContent}>
                        <Text variant="titleSmall" style={styles.popularCardTitle} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text 
                          variant="bodySmall" 
                          style={{ color: theme.colors.onSurfaceVariant }} 
                          numberOfLines={1}
                        >
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
  hScroll: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    gap: 10 
  },
  headerNote: {
    marginTop: 4,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  clearFiltersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  clearFiltersText: {
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontWeight: "800",
    fontSize: 18,
  },
  businessCard: {
    width: 220,
    overflow: "hidden",
  },
  businessCardImage: {
    width: "100%",
    height: 120,
  },
  businessCardContent: {
    padding: 12,
  },
  businessCardTitle: {
    fontWeight: "700",
  },
  suggestionCard: {
    width: 220,
    overflow: "hidden",
  },
  suggestionCardImage: {
    width: "100%",
    height: 120,
  },
  suggestionCardContent: {
    padding: 12,
  },
  suggestionCardTitle: {
    fontWeight: "700",
  },
  serviceCard: {
    width: 200,
    overflow: "hidden",
  },
  serviceCardImage: {
    width: "100%",
    height: 120,
  },
  serviceCardContent: {
    padding: 12,
  },
  serviceCardTitle: {
    fontWeight: "700",
  },
  institutionsPlaceholder: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 16,
  },
  loadingContainer: {
    marginTop: 32,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
  },
  servicesContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  serviceListCard: {
    overflow: "hidden",
  },
  serviceListCardImage: {
    width: "100%",
    height: 140,
  },
  serviceListCardContent: {
    padding: 12,
  },
  serviceListCardTitle: {
    fontWeight: "700",
  },
  noResultsContainer: {
    marginTop: 32,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  noResultsTitle: {
    textAlign: "center",
    fontSize: 16,
  },
  noResultsSubtitle: {
    textAlign: "center",
    marginTop: 4,
    fontSize: 14,
  },
  popularCard: {
    width: 200,
    overflow: "hidden",
  },
  popularCardImage: {
    width: "100%",
    height: 120,
  },
  popularCardContent: {
    padding: 12,
  },
  popularCardTitle: {
    fontWeight: "700",
  },
});