"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  Pressable,
} from "react-native";
import {
  Text,
  Surface,
  ActivityIndicator,
  IconButton,
  Button,
  Avatar,
  Banner,
  useTheme,
  Chip,
} from "react-native-paper";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { useSession } from "../../../context/SessionContext";
import { Section } from "../../../components/Section";
import { LockedFeature } from "../../../components/LockedFeature";
import { VerificationGate } from "../../../components/VerificationGate";

// API
import { listReviews, flagReview } from "../../../lib/api/modules/manager";

type ReviewUser = {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
};

type ReviewRow = {
  id: string;
  userId: string;
  user?: ReviewUser;
  businessId: string;
  rating: number;
  comment?: string | null;
  imageUrl?: string | null;
  flagged: boolean;
  createdAt: string; // ISO
};

export default function ReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedMsg, setLockedMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  // Access control - can be expanded based on business plan requirements
  const canAccess = useMemo(() => true, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLockedMsg(null);
    try {
      const data = await listReviews();
      const arr = Array.isArray(data) ? data : (data?.reviews ?? []);
      setRows(arr);
    } catch (e: any) {
      const status = Number(e?.response?.status || e?.status || 0);
      if (status === 403) {
        setLockedMsg("Your plan does not include Reviews. Upgrade to unlock.");
      } else {
        setError(e?.message || "Failed to load reviews");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    if (canAccess) load();
    else setLoading(false);
  }, [canAccess, load]);

  const doFlag = useCallback(
    async (rev: ReviewRow) => {
      if (rev.flagged) return;
      
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Flag review?",
          "This will mark the review for moderation.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Flag", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      });
      
      if (!proceed) return;

      try {
        await flagReview(rev.id);
        setRows((prev) =>
          prev.map((r) => (r.id === rev.id ? { ...r, flagged: true } : r))
        );
      } catch (e: any) {
        Alert.alert("Failed to flag", e?.message || "Please try again.");
      }
    },
    []
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const renderStars = (rating: number) => {
    const stars = [];
    const r = Math.max(0, Math.min(5, Math.round(rating)));
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <IconButton
          key={i}
          icon={i <= r ? "star" : "star-outline"}
          size={18}
          style={{ margin: 0 }}
          onPress={() => {}}
          disabled
        />
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  if (!canAccess) {
    return (
      <VerificationGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={() => router.back()}
            />
            <Text style={styles.title}>Reviews</Text>
          </View>

          <View style={styles.lockedContainer}>
            <LockedFeature
              title="Reviews"
              description="Upgrade your plan to view and manage reviews."
              onPressUpgrade={() => router.push("/business/dashboard/billing")}
            />
          </View>
        </View>
      </VerificationGate>
    );
  }

  return (
    <VerificationGate>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor={theme.colors.onSurface}
            onPress={() => router.back()}
          />
          <Text style={styles.title}>Reviews</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Working…</Text>
          </View>
        ) : error && !lockedMsg ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
            <Button onPress={load} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            {lockedMsg && (
              <View style={styles.bannerContainer}>
                <Banner visible icon="lock" style={styles.banner}>
                  {lockedMsg}{" "}
                  <Text
                    onPress={() => router.push("/business/dashboard/billing")}
                    style={{ color: theme.colors.primary }}
                  >
                    Upgrade
                  </Text>
                </Banner>
              </View>
            )}

            <Section title="Recent Reviews">
              <View style={styles.listWrap}>
                {rows.length === 0 ? (
                  <Surface style={styles.emptyState} elevation={1}>
                    <Text style={styles.emptyText}>
                      No reviews yet for your business.
                    </Text>
                  </Surface>
                ) : (
                  rows.map((r) => {
                    const initials = (r.user?.name || "U")
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                      
                    return (
                      <Surface key={r.id} style={styles.card} elevation={2}>
                        <View style={styles.topRow}>
                          {r.user?.avatarUrl ? (
                            <Avatar.Image
                              size={44}
                              source={{ uri: r.user.avatarUrl }}
                            />
                          ) : (
                            <Avatar.Text size={44} label={initials} />
                          )}
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.nameText}>
                              {r.user?.name || "Unknown user"}
                            </Text>
                            <Text style={styles.dateText}>
                              {formatDate(r.createdAt)}
                            </Text>
                          </View>
                          <Chip
                            compact
                            selectedColor={theme.colors.onPrimary}
                            style={[
                              styles.flagChip,
                              r.flagged
                                ? { backgroundColor: "#F97316" }
                                : { backgroundColor: "#E5E7EB" },
                            ]}
                            onPress={() => (!r.flagged ? doFlag(r) : undefined)}
                            icon={r.flagged ? "flag" : "flag-outline"}
                          >
                            {r.flagged ? "Flagged" : "Flag"}
                          </Chip>
                        </View>

                        <View style={styles.ratingRow}>
                          {renderStars(r.rating)}
                          <Text style={styles.ratingText}>{r.rating}/5</Text>
                        </View>

                        {r.comment ? (
                          <Text style={styles.commentText}>{r.comment}</Text>
                        ) : null}

                        {r.imageUrl ? (
                          <Pressable
                            onPress={() => WebBrowser.openBrowserAsync(r.imageUrl!)}
                            style={{ marginTop: 12 }}
                          >
                            <Image
                              source={{ uri: r.imageUrl }}
                              style={styles.reviewImage}
                              resizeMode="cover"
                            />
                          </Pressable>
                        ) : null}
                      </Surface>
                    );
                  })
                )}
              </View>
            </Section>
          </>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </VerificationGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 12,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  banner: { 
    marginBottom: 12 
  },
  listWrap: {
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameText: {
    fontWeight: "600",
    color: "#1F2937",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    color: "#6B7280",
  },
  commentText: {
    marginTop: 10,
    color: "#1F2937",
    lineHeight: 20,
  },
  reviewImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  flagChip: {
    borderRadius: 999,
  },
  lockedContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  bottomSpacing: { 
    height: 40 
  },
});