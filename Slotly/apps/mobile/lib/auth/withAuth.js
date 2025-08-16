
import React from 'react';
import { useAuth } from './useAuth';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

export default function withAuth(Component, { allowRoles = null } = {}) {
  return function Guarded(props) {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
        </View>
      );
    }

    if (!user) return <Redirect href="/auth/login" />;

    if (allowRoles && !allowRoles.includes(user.role)) {
      // Not authorized for this screen
      return <Redirect href="/(tabs)/home" />;
    }

    return <Component {...props} />;
  };
}
