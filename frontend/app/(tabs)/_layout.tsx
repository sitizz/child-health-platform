import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2F6BFF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 84,
          paddingTop: 10,
          paddingBottom: 18,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E6EBF2',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="location.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="intelligence"
        options={{
          title: 'Intelligence',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="sparkles" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
