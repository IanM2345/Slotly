// app/index.tsx - Fixed routing logic without global lock
import { useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { ActivityIndicator, View, Text } from 'react-native';
import { useSession } from '../context/SessionContext';

export default function IndexPage() {
  const { token, user, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;

    console.log("🔄 Index routing check:", { 
      ready, 
      hasToken: !!token, 
      role: user?.role,
      verificationStatus: user?.business?.verificationStatus,
      pathname
    });

    const role = String(user?.role || '').toUpperCase();
    
    // Determine destination based on auth state and role
    const dest =
      !token
        ? '/auth/login'
        : ['ADMIN', 'SUPER_ADMIN', 'CREATOR'].includes(role)
        ? '/admin'
        : role === 'STAFF'
        ? '/business/dashboard/staff'
        : role === 'BUSINESS_OWNER'
        ? (['approved', 'active', 'verified', 'pending'].includes(String(user?.business?.verificationStatus || '').toLowerCase())
           ? '/business/dashboard'
           : user?.business?.verificationStatus === 'rejected'
           ? '/(tabs)/profile'
           : '/business/onboarding')
        : '/(tabs)';

    console.log(`→ Should route ${role || 'CUSTOMER'} to: ${dest}`);

    // Only redirect if we're not already at the destination
    if (pathname !== dest) {
      router.replace(dest as any);
    }
  }, [ready, token, user?.role, user?.business?.verificationStatus, pathname, router]);

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fff'
    }}>
      <ActivityIndicator size="large" color="#0066CC" />
      <Text style={{
        marginTop: 16,
        fontSize: 16,
        color: '#666'
      }}>
        Loading...
      </Text>
    </View>
  );
}