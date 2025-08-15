import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Button,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function FeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedRating, setSelectedRating] = useState(0);

  const handleBack = () => {
    router.back();
  };

  const handleStarPress = (rating: number) => {
    setSelectedRating(rating);
  };

  const handleAskLater = () => {
    router.back();
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
            { opacity: i <= selectedRating ? 1 : 0.3 }
          ]}>
            ⭐
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
        <Text style={styles.headerTitle}>Feedback</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Question */}
          <Text style={styles.questionText}>
            How has your experience on Slotly been?
          </Text>

          {/* Stars Rating */}
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          {/* Rating Text */}
          {selectedRating > 0 && (
            <Text style={styles.ratingText}>
              {selectedRating === 1 && "We're sorry to hear that. We'll work to improve!"}
              {selectedRating === 2 && "We appreciate your feedback and will do better."}
              {selectedRating === 3 && "Thank you for your feedback!"}
              {selectedRating === 4 && "Great! We're glad you had a good experience."}
              {selectedRating === 5 && "Excellent! Thank you for the amazing feedback!"}
            </Text>
          )}

          {/* Ask Later Button */}
          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={handleAskLater}
              style={styles.askLaterButton}
              labelStyle={styles.askLaterButtonText}
              contentStyle={styles.askLaterButtonContent}
            >
              Ask Later
            </Button>
          </View>
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
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
    paddingHorizontal: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    gap: 8,
  },
  starButton: {
    padding: 8,
  },
  star: {
    fontSize: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  ratingText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  askLaterButton: {
    borderColor: '#333',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 25,
  },
  askLaterButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  askLaterButtonContent: {
    paddingVertical: 12,
  },
  bottomSpacing: {
    height: 40,
  },
});
