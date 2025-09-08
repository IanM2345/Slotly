import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  useTheme,
  ActivityIndicator,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { getMyReviews } from '../../lib/api/modules/users';
import { useSession } from '../../context/SessionContext';

type Review = {
  id: string;
  rating: number;
  comment?: string;
  imageUrl?: string;
  createdAt: string;
  business: {
    id: string;
    name: string;
  };
};

export default function ReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

  useEffect(() => {
    const loadReviews = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await getMyReviews(token);
        setReviews(Array.isArray(data) ? data : []);
      } catch (error: any) {
        console.error('Error loading reviews:', error);
        setSnack({ visible: true, msg: error?.message || 'Failed to load reviews' });
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [token]);

  const handleBack = () => {
    router.back();
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, { color: i <= rating ? '#FFD700' : '#DDD' }]}>
          ★
        </Text>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={handleBack} style={styles.backButton} />
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>My Reviews</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>Loading your reviews...</Text>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>My Reviews</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                No reviews yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Complete a booking to leave your first review
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Your Reviews ({reviews.length})
              </Text>
              
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <View key={review.id} style={[styles.reviewCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                    <View style={styles.reviewHeader}>
                      <Text style={[styles.businessName, { color: theme.colors.onSurface }]}>
                        {review.business.name}
                      </Text>
                      <Text style={[styles.reviewDate, { color: theme.colors.onSurfaceVariant }]}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <View style={styles.ratingContainer}>
                      {renderStars(review.rating)}
                      <Text style={[styles.ratingText, { color: theme.colors.onSurfaceVariant }]}>
                        {review.rating}/5
                      </Text>
                    </View>
                    
                    {review.comment && (
                      <Text style={[styles.reviewComment, { color: theme.colors.onSurfaceVariant }]}>
                        "{review.comment}"
                      </Text>
                    )}
                    
                    {review.imageUrl && (
                      <View style={styles.reviewImageContainer}>
                        <Image 
                          source={{ uri: review.imageUrl }} 
                          style={styles.reviewImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      <Snackbar 
        visible={snack.visible} 
        onDismiss={() => setSnack({ visible: false, msg: '' })} 
        duration={2000}
      >
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    flex: 1, 
    textAlign: 'center', 
    marginRight: 48 
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 16 
  },
  reviewsList: {
    gap: 16,
  },
  reviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  reviewDate: {
    fontSize: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  star: {
    fontSize: 18,
    marginRight: 2,
  },
  ratingText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reviewImageContainer: {
    marginTop: 8,
  },
  reviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  bottomSpacing: {
    height: 32,
  },
});