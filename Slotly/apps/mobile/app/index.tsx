// app/index.tsx
import { Redirect, usePathname, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useSession } from '../context/SessionContext';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

// Slotly Logo Component
const SlotlyLogo = ({ size = 120 }: { size?: number }) => {
  return (
    <View style={styles.logoContainer}>
      <Svg width={size * 2.5} height={size * 0.6} viewBox="0 0 300 120">
        {/* Main "O" shape with rounded rectangle */}
        <Rect
          x="10"
          y="20"
          width="80"
          height="80"
          rx="25"
          ry="25"
          fill="#1e3a8a"
        />
        {/* Inner rounded rectangle for the "O" hole */}
        <Rect
          x="30"
          y="45"
          width="40"
          height="30"
          rx="15"
          ry="15"
          fill="#8b7355"
        />
        
        {/* SLOTLY Text */}
        <SvgText
          x="110"
          y="75"
          fontSize="48"
          fontWeight="bold"
          fill="#1e3a8a"
          fontFamily="System"
        >
          SLOTLY
        </SvgText>
      </Svg>
    </View>
  );
};

// Custom Loading Component
const SlotlyLoader = () => {
  return (
    <View style={styles.loadingContainer}>
      <SlotlyLogo size={150} />
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

export default function IndexPage() {
  const { token, user, ready } = useSession();
  const pathname = usePathname();
  const navState = useRootNavigationState();
          
  // Wait for router to be ready
  const isRouterReady = !!navState?.key;

  if (!ready || !isRouterReady) {
    return <SlotlyLoader />;
  }

  const role = String(user?.role || '').toUpperCase();
  const verification = String(user?.business?.verificationStatus || '').toLowerCase();

  const dest =
    !token ? '/auth/login'
    : ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(role) ? '/admin'
    : role === 'STAFF' ? '/business/dashboard/staff'
    : role === 'BUSINESS_OWNER'
      ? (['approved', 'active', 'verified', 'pending'].includes(verification)
          ? '/business/dashboard'
          : user?.business?.verificationStatus === 'rejected'
            ? '/(tabs)/profile'
            : '/business/onboarding')
      : '/(tabs)';

  // No-op if we're already where we want to be
  if (pathname === dest || pathname?.startsWith(dest)) {
    return <SlotlyLoader />;
  }

  return <Redirect href={dest as any} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8b7355', // Brown background like in your image
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  spinnerContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#1e3a8a', // Blue color matching the logo
    fontWeight: '500',
    letterSpacing: 1,
  },
});