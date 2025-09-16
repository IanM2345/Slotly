import React from 'react';
import { FontAwesome } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable, Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { slotlyTheme } from "../theme/paper";

import Colors from '../../constants/Colors';
import { useColorScheme } from '../../components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayoutWrapper() {
  const shouldShowHeader = useClientOnlyValue(false, true); // ✅ now inside function
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={slotlyTheme}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: slotlyTheme.colors.primary,
          headerShown: shouldShowHeader, // ✅ hook value is now legal
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            headerRight: () => (
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <FontAwesome
                      name="info-circle"
                      size={24}
                      color={Colors[colorScheme ?? 'light'].text}
                      style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="search" color={color} />
            ),
          }}
        />
        {/* Appointments tab as per spec (history route) */}
        <Tabs.Screen
          name="history"
          options={{
            title: 'Appointments',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="history" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <TabBarIcon name="user" color={color} />
            ),
          }}
        />
      </Tabs>
    </PaperProvider>
  );
}
