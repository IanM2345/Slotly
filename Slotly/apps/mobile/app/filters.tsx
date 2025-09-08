// apps/mobile/app/filters.tsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Keyboard, FlatList, Platform } from "react-native";
import { Text, TextInput, Button, SegmentedButtons, useTheme, Divider, Chip, HelperText, ActivityIndicator, Surface, Card } from "react-native-paper";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import dayjs from "dayjs";
import DateTimePicker from '@react-native-community/datetimepicker';

// Maps helpers (already in your project)
import { placesAutocomplete, geocode, reverseGeocode, createDebouncedSearch } from "../lib/api/map";

const QUICK_CATEGORIES = ["Haircut", "Spa", "Nails", "Barber", "Makeup"];

export default function FiltersScreen() {
  const theme = useTheme();
  const router = useRouter();

  // ---- Location ----
  const [locationQuery, setLocationQuery] = useState("");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [loadingPred, setLoadingPred] = useState(false);

  // device location state
  const [locLoading, setLocLoading] = useState(false);
  const [locPermissionDenied, setLocPermissionDenied] = useState(false);

  // debounced autocomplete
  const doAutocomplete = useRef(
    createDebouncedSearch(async (results: any[]) => {
      setPredictions(results);
      setLoadingPred(false);
    }, 300)
  ).current;

  const onChangeLocation = useCallback((text: string) => {
    setSelectedLocation(null);
    setLocationQuery(text);
    if (!text.trim()) {
      setPredictions([]);
      return;
    }
    setLoadingPred(true);
    doAutocomplete(text, { types: "geocode" });
  }, [doAutocomplete]);

  const choosePrediction = useCallback(async (p: any) => {
    Keyboard.dismiss();
    setLocationQuery(p.description);
    setPredictions([]);
    const det = await geocode({ place_id: p.place_id });
    if (det?.location) {
      setSelectedLocation({ lat: det.location.lat, lng: det.location.lng, label: det.address || p.description });
    }
  }, []);

  // 🔹 Auto-fill with device location on mount (permission prompt)
  useEffect(() => {
    (async () => {
      try {
        setLocLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocPermissionDenied(true);
          setLocLoading(false);
          return;
        }
        setLocPermissionDenied(false);
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // reverse geocode to a readable address via your backend
        const rev = await reverseGeocode(lat, lng);
        const label = rev?.address || "Current location";

        setSelectedLocation({ lat, lng, label });
        setLocationQuery(label);
      } catch (e) {
        console.warn("Auto location failed:", e);
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  // manual "Use current location" action (e.g., user changed mind)
  const useCurrentLocation = useCallback(async () => {
    try {
      setLocLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocPermissionDenied(true);
        return;
      }
      setLocPermissionDenied(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await reverseGeocode(lat, lng);
      const label = rev?.address || "Current location";
      setSelectedLocation({ lat, lng, label });
      setLocationQuery(label);
      setPredictions([]);
    } catch (e) {
      console.warn("Manual location failed:", e);
    } finally {
      setLocLoading(false);
    }
  }, []);

  // ---- What to show ----
  const [kind, setKind] = useState<"both" | "services" | "businesses">("both");

  // ---- Enhanced Date / Time with proper pickers ----
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeMode, setTimeMode] = useState<"anytime" | "morning" | "afternoon" | "evening" | "exact">("anytime");

  // ---- Category ----
  const [category, setCategory] = useState<string>("");

  // Format date as DD/MM/YYYY
  const formatDate = (date: Date) => {
    return dayjs(date).format("DD/MM/YYYY");
  };

  // Format time as HH:mm
  const formatTime = (date: Date) => {
    return dayjs(date).format("HH:mm");
  };

  // Handle date picker change
  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  // Handle time picker change
  const onTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      setSelectedTime(time);
    }
  };

  // Build ISO for exact slot (UTC-normalized)
  const exactTimeISO = useMemo(() => {
    if (timeMode !== "exact") return undefined;
    
    const combinedDateTime = new Date(selectedDate);
    combinedDateTime.setHours(selectedTime.getHours());
    combinedDateTime.setMinutes(selectedTime.getMinutes());
    combinedDateTime.setSeconds(0);
    combinedDateTime.setMilliseconds(0);
    
    return new Date(combinedDateTime.getTime() - combinedDateTime.getTimezoneOffset() * 60000).toISOString();
  }, [timeMode, selectedDate, selectedTime]);

  const apply = useCallback(() => {
    const params: Record<string, string> = {};
    if (selectedLocation) {
      params.lat = String(selectedLocation.lat);
      params.lon = String(selectedLocation.lng);
    }
    
    // Convert date back to YYYY-MM-DD format for backend
    params.date = dayjs(selectedDate).format("YYYY-MM-DD");
    
    if (timeMode === "exact" && exactTimeISO) {
      params.startAt = exactTimeISO;
    } else {
      params.time = timeMode;
    }
    
    if (category.trim()) params.category = category.trim();
    params.kind = kind;

    router.replace({ pathname: "/(tabs)/explore", params } as any);
  }, [selectedLocation, selectedDate, timeMode, exactTimeISO, category, kind, router]);

  const clearAll = useCallback(() => {
    setSelectedLocation(null);
    setLocationQuery("");
    setPredictions([]);
    setKind("both");
    setSelectedDate(today);
    setSelectedTime(new Date());
    setTimeMode("anytime");
    setCategory("");
  }, []);

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: theme.colors.background }} 
      contentContainerStyle={{ padding: 16, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Text variant="headlineSmall" style={{ fontWeight: "700", color: theme.colors.onSurface }}>
        Filters
      </Text>

      {/* Location Card */}
      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "600" }}>
              Location
            </Text>
            <Button 
              mode="text" 
              compact 
              onPress={useCurrentLocation} 
              disabled={locLoading} 
              icon="crosshairs-gps"
              buttonColor={theme.colors.primaryContainer}
            >
              Use current
            </Button>
          </View>

          <TextInput
            mode="outlined"
            placeholder="Search a place or address"
            value={locationQuery}
            onChangeText={onChangeLocation}
            style={{ backgroundColor: theme.colors.background }}
            right={
              locLoading
                ? <TextInput.Icon icon={() => <ActivityIndicator size="small" />} />
                : selectedLocation ? <TextInput.Icon icon="check" /> : undefined
            }
          />

          {locPermissionDenied && (
            <HelperText type="error">
              Location permission denied. You can still search by typing an address.
            </HelperText>
          )}

          {loadingPred && <HelperText type="info">Searching…</HelperText>}

          {predictions.length > 0 && (
            <Surface style={{ 
              borderRadius: 8, 
              marginTop: 8, 
              maxHeight: 200,
              elevation: 2,
              backgroundColor: theme.colors.background
            }}>
              <FlatList
                data={predictions}
                keyExtractor={(item) => item.place_id}
                ItemSeparatorComponent={() => <Divider />}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    onPress={() => choosePrediction(item)} 
                    style={{ padding: 16 }}
                  >
                    <Text numberOfLines={2} style={{ color: theme.colors.onSurface }}>
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </Surface>
          )}

          {selectedLocation && (
            <HelperText type="info">
              📍 Using: {selectedLocation.label}
            </HelperText>
          )}
        </Card.Content>
      </Card>

      {/* What to show Card */}
      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content style={{ padding: 16 }}>
          <Text variant="titleMedium" style={{ marginBottom: 12, color: theme.colors.onSurface, fontWeight: "600" }}>
            Show
          </Text>
          <SegmentedButtons
            value={kind}
            onValueChange={(v) => setKind(v as any)}
            buttons={[
              { value: "both", label: "Both", icon: "apps" },
              { value: "services", label: "Services", icon: "account-tie" },
              { value: "businesses", label: "Businesses", icon: "store" },
            ]}
          />
        </Card.Content>
      </Card>

      {/* Date & Time Card */}
      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content style={{ padding: 16 }}>
          <Text variant="titleMedium" style={{ marginBottom: 12, color: theme.colors.onSurface, fontWeight: "600" }}>
            Date & Time
          </Text>
          
          {/* Date Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
              Date
            </Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Surface style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: theme.colors.background,
                borderWidth: 1,
                borderColor: theme.colors.outline
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                    {formatDate(selectedDate)}
                  </Text>
                  <Text style={{ fontSize: 20 }}>📅</Text>
                </View>
              </Surface>
            </TouchableOpacity>
          </View>

          {/* Time Section */}
          <View>
            <Text style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
              Time
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[
                { value: "anytime", label: "Anytime" },
                { value: "morning", label: "AM" },
                { value: "afternoon", label: "PM" },
                { value: "evening", label: "Eve" },
                { value: "exact", label: "Exact" },
              ].map((button) => (
                <TouchableOpacity
                  key={button.value}
                  onPress={() => setTimeMode(button.value as any)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: timeMode === button.value ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: timeMode === button.value ? theme.colors.primaryContainer : theme.colors.surface,
                    minWidth: 70,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: timeMode === button.value ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
                    fontSize: 14,
                    fontWeight: timeMode === button.value ? '600' : '400',
                  }}>
                    {button.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {timeMode === "exact" && (
              <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                <Surface style={{ 
                  padding: 16, 
                  borderRadius: 8, 
                  backgroundColor: theme.colors.background,
                  borderWidth: 1,
                  borderColor: theme.colors.outline
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                      {formatTime(selectedTime)}
                    </Text>
                    <Text style={{ fontSize: 20 }}>🕐</Text>
                  </View>
                </Surface>
              </TouchableOpacity>
            )}
            
            {timeMode !== "anytime" && timeMode !== "exact" && (
              <HelperText type="info">
                {timeMode === "morning" && "🌅 6:00 AM - 12:00 PM"}
                {timeMode === "afternoon" && "☀️ 12:00 PM - 6:00 PM"}
                {timeMode === "evening" && "🌙 6:00 PM - 10:00 PM"}
              </HelperText>
            )}
            
            {timeMode === "exact" && (
              <HelperText type="info">
                ⏰ We'll show services available at this exact time
              </HelperText>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Category Card */}
      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content style={{ padding: 16 }}>
          <Text variant="titleMedium" style={{ marginBottom: 12, color: theme.colors.onSurface, fontWeight: "600" }}>
            Service Category
          </Text>
          
          <TextInput
            mode="outlined"
            placeholder="e.g., Haircut, Massage"
            value={category}
            onChangeText={setCategory}
            style={{ backgroundColor: theme.colors.background, marginBottom: 12 }}
            left={<TextInput.Icon icon="scissors-cutting" />}
          />
          
          <Text style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant, fontSize: 14 }}>
            Quick select:
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {QUICK_CATEGORIES.map((c, index) => (
              <Chip 
                key={c} 
                style={{ 
                  marginRight: 8,
                  backgroundColor: category.toLowerCase() === c.toLowerCase() 
                    ? theme.colors.primaryContainer 
                    : theme.colors.surface
                }} 
                onPress={() => setCategory(category.toLowerCase() === c.toLowerCase() ? "" : c)} 
                selected={category.toLowerCase() === c.toLowerCase()}
                showSelectedCheck={true}
              >
                {c}
              </Chip>
            ))}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 }}>
        <Button 
          mode="contained" 
          onPress={apply} 
          style={{ flex: 1 }}
          contentStyle={{ paddingVertical: 8 }}
          icon="filter-check"
        >
          Apply Filters
        </Button>
        <Button 
          mode="outlined" 
          onPress={clearAll}
          contentStyle={{ paddingVertical: 8 }}
          icon="filter-remove"
        >
          Clear
        </Button>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={today}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
    </ScrollView>
  );
}