import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, FlatList, RefreshControl, Image } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  Text, Button, IconButton, TextInput, Chip, useTheme, Divider, Card,
} from "react-native-paper";
import { favoritesApi } from "../lib/favorites/api";
import type { FavoriteItem, FavoriteKind } from "../lib/favorites/types";

export default function FavoritesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [all, setAll] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FavoriteKind | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const items = await favoritesApi.list();
    setAll(items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(x => 
      (filter === "all" || x.kind === filter) &&
      (!q || x.name.toLowerCase().includes(q) || x.location?.toLowerCase().includes(q))
    );
  }, [all, filter, query]);

  const onRemove = async (item: FavoriteItem) => {
    await favoritesApi.remove(item.id, item.kind);
    await load();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const Empty = (
    <View style={{ padding: 24, alignItems: "center" }}>
      <Image
        source={{ uri: "https://dummyimage.com/240x160/e9eef6/7a8ca4&text=No+favorites+yet" }}
        style={{ width: 240, height: 160, borderRadius: 12, marginBottom: 16 }}
      />
      <Text style={{ marginBottom: 8, color: theme.colors.onSurface, fontWeight: "600" }}>
        You don’t have any favorites yet
      </Text>
      <Text style={{ marginBottom: 16, color: theme.colors.onSurfaceVariant }}>
        Explore services or institutions and tap the heart to save them.
      </Text>
      <Button mode="contained" onPress={() => router.push("/explore" as any)}>
        Explore now
      </Button>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "My Favorites" }} />

      <View style={{ flex: 1, padding: 12 }}>
        {/* Search + filter row */}
        <View style={{ gap: 8, marginBottom: 8 }}>
          <TextInput
            mode="outlined"
            placeholder="Search favorites"
            left={<TextInput.Icon icon="magnify" />}
            value={query}
            onChangeText={setQuery}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["all", "service", "institution"] as const).map(k => (
              <Chip
                key={k}
                selected={filter === k}
                onPress={() => setFilter(k)}
                icon={k === "service" ? "scissors-cutting" : k === "institution" ? "office-building" : "star-outline"}
              >
                {k === "all" ? "All" : k === "service" ? "Services" : "Institutions"}
              </Chip>
            ))}
          </View>
        </View>

        <Divider style={{ marginBottom: 8 }} />

        <FlatList
          data={filtered}
          keyExtractor={(it) => `${it.kind}:${it.id}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={!loading ? Empty : null}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 12, elevation: 0, borderRadius: 14 }}>
              <Card.Title
                title={item.name}
                subtitle={[item.location, item.rating ? `★ ${item.rating.toFixed(1)}` : null]
                  .filter(Boolean)
                  .join("  •  ")}
                left={(props) =>
                  item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={{ width: 48, height: 48, borderRadius: 8 }}
                    />
                  ) : (
                    <IconButton {...props} icon={item.kind === "service" ? "scissors-cutting" : "office-building"} />
                  )
                }
                right={() => (
                  <IconButton icon="heart" iconColor={theme.colors.error} onPress={() => onRemove(item)} />
                )}
              />
              <Card.Actions style={{ justifyContent: "flex-end" }}>
                {item.kind === "service" ? (
                  <Button
                    mode="contained"
                    onPress={() => router.push(`/booking?serviceId=${item.id}` as any)}
                  >
                    Book
                  </Button>
                ) : (
                  <Button
                    mode="outlined"
                    onPress={() => router.push(`/explore/details?id=${item.id}` as any)}
                  >
                    View
                  </Button>
                )}
              </Card.Actions>
            </Card>
          )}
        />
      </View>
    </>
  );
}
