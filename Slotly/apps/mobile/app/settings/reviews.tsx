import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  TextInput,
  Button,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function ReviewsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const reviewData = {
        rating,
        reviewText: reviewText.trim(),
        timestamp: new Date().toISOString()
      };
      
      console.log('Saving review:', reviewData);
      
      // Navigate back or show success message
      router.back();
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
    <Surface style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={handleBack}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Reviews</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Service Name Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Service Name</Text>
            <Text style={styles.serviceName}>Hair Styling & Cut</Text>
          </View>

          {/* Rating Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rate your experience</Text>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
          </View>

          {/* Review Text Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Describe your experience</Text>
            <TextInput
              mode="outlined"
              value={reviewText}
              onChangeText={setReviewText}
              style={styles.reviewInput}
              outlineColor="#333"
              activeOutlineColor="#333"
              textColor="#333"
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

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Slotly pink background
  },
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
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for back button width
  },
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
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    color: '#555',
    fontStyle: 'italic',
  },
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
  reviewInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    minHeight: 120,
  },
  addPhotoButton: {
    borderColor: '#333',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 25,
  },
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
  saveButton: {
    backgroundColor: '#ff69b4',
    borderRadius: 25,
  },
  saveButtonContent: {
    paddingVertical: 12,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomSpacing: {
    height: 32,
  },
});