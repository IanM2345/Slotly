import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  Button,
  useTheme,
  Snackbar,
  TextInput
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { sendFeedback } from '../../lib/settings/api';

export default function FeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [selectedRating, setSelectedRating] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });

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
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Feedback</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Question */}
          <Text style={[styles.questionText, { color: theme.colors.onSurface }] }>
            How has your experience on Slotly been?
          </Text>

          {/* Stars Rating */}
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          {/* Rating Text */}
          {selectedRating > 0 && (
            <Text style={[styles.ratingText, { color: theme.colors.onSurfaceVariant }]}>
              {selectedRating === 1 && "We're sorry to hear that. We'll work to improve!"}
              {selectedRating === 2 && "We appreciate your feedback and will do better."}
              {selectedRating === 3 && "Thank you for your feedback!"}
              {selectedRating === 4 && "Great! We're glad you had a good experience."}
              {selectedRating === 5 && "Excellent! Thank you for the amazing feedback!"}
            </Text>
          )}

          {/* Text */}
          <TextInput
            mode="outlined"
            multiline
            numberOfLines={5}
            value={text}
            onChangeText={setText}
            placeholder="Tell us more..."
            style={{ width: '100%' }}
          />

          {/* Ask Later Button */}
          <View style={styles.buttonContainer}>
            <Button mode="outlined" onPress={handleAskLater} style={styles.askLaterButton}>
              Ask Later
            </Button>
            <Button mode="contained" loading={loading} disabled={!selectedRating || loading} onPress={async () => { setLoading(true); try { await sendFeedback({ rating: selectedRating as any, text }); setSnack({ visible: true, msg: 'Thanks for your feedback!' }); setTimeout(() => router.back(), 800);} finally { setLoading(false);} }} style={{ borderRadius: 24 }}>
              Submit
            </Button>
          </View>
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
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  questionText: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 40, lineHeight: 28, paddingHorizontal: 20 },
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
  ratingText: { fontSize: 16, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20, fontStyle: 'italic' },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  askLaterButton: { borderRadius: 25 },
  bottomSpacing: {
    height: 40,
  },
});
