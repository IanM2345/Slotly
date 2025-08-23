import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TextInput,
  Button,
  useTheme,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { createReview, listReviews } from '../../lib/settings/api';
import type { Review } from '../../lib/settings/types';

export default function ReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => { listReviews().then(setReviews).catch(() => {}); }, []);

  const handleBack = () => {
    router.back();
  };

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex);
  };

  const handleAddPhoto = () => {
    // Handle photo selection logic here
    console.log('Add photo pressed');
    // You can integrate with expo-image-picker or similar
  };

  const handleSaveReview = async () => {
    if (rating === 0) {
      // Show error - rating is required
      return;
    }

    setLoading(true);
    try {
      await createReview({ id: Date.now().toString(), serviceName: 'Hair Styling & Cut', rating: rating as any, comment: reviewText.trim() });
      setReviewText('');
      setRating(0);
      setSnack({ visible: true, msg: 'Review saved' });
      const refreshed = await listReviews();
      setReviews(refreshed);
    } catch (error) {
      console.error('Error saving review:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          style={styles.starButton}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.star,
            { color: i <= rating ? '#FFD700' : '#DDD' }
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Reviews</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Service Name Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Service Name</Text>
            <Text style={[styles.serviceName, { color: theme.colors.onSurfaceVariant }]}>Hair Styling & Cut</Text>
          </View>

          {/* Rating Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Rate your experience</Text>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
          </View>

          {/* Review Text Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Describe your experience</Text>
            <TextInput
              mode="outlined"
              value={reviewText}
              onChangeText={setReviewText}
              style={styles.reviewInput}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.primary}
              textColor={theme.colors.onSurface}
              multiline
              numberOfLines={6}
              placeholder="Share your thoughts about the service..."
              textAlignVertical="top"
            />
          </View>

          {/* Add Photo Button */}
          <View style={styles.section}>
            <Button
              mode="outlined"
              onPress={handleAddPhoto}
              style={styles.addPhotoButton}
              labelStyle={styles.addPhotoButtonText}
              contentStyle={styles.addPhotoButtonContent}
              icon="camera"
            >
              Add photo
            </Button>
          </View>
        </View>

        {/* Save Review Button */}
        <View style={styles.saveButtonContainer}>
          <Button
            mode="contained"
            onPress={handleSaveReview}
            loading={loading}
            disabled={loading || rating === 0}
            style={styles.saveButton}
            labelStyle={styles.saveButtonText}
            contentStyle={styles.saveButtonContent}
          >
            Save Review
          </Button>
        </View>

        {/* Your Reviews */}
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>Your Reviews</Text>
          {reviews.map(r => (
            <View key={r.id} style={{ borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 12, padding: 12, marginBottom: 8 }}>
              <Text style={{ fontWeight: '700' }}>{r.serviceName}</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Rating: {r.rating}/5</Text>
              {!!r.comment && <Text style={{ color: theme.colors.onSurfaceVariant }}>{r.comment}</Text>}
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2000}>{snack.msg}</Snackbar>
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
  headerTitle: { fontSize: 28, fontWeight: 'bold', flex: 1, textAlign: 'center', marginRight: 48 },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    paddingTop: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  serviceName: { fontSize: 16, fontStyle: 'italic' },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  reviewInput: { backgroundColor: 'transparent', minHeight: 120 },
  addPhotoButton: { borderRadius: 25 },
  addPhotoButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  addPhotoButtonContent: {
    paddingVertical: 8,
  },
  saveButtonContainer: {
    marginTop: 20,
    marginBottom: 24,
  },
  saveButton: { borderRadius: 25 },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonText: { fontSize: 18, fontWeight: 'bold' },
  bottomSpacing: {
    height: 32,
  },
});