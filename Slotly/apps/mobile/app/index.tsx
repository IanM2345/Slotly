// app/index.tsx
import { Redirect, usePathname, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useSession } from '../context/SessionContext';

export default function IndexPage() {
  const { token, user, ready } = useSession();
  const pathname = usePathname();
  const navState = useRootNavigationState();           // wait for router to be ready
  const isRouterReady = !!navState?.key;

  if (!ready || !isRouterReady) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading...</Text>
      </View>
    );
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

  // No-op if we’re already where we want to be.
  if (pathname === dest || pathname?.startsWith(dest)) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading…</Text>
      </View>
    );
  }

  return <Redirect href={dest as any} />;
}
