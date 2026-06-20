import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, StyleSheet } from 'react-native';

import DomusScreen from './src/screens/DomusScreen';
import ForumScreen from './src/screens/ForumScreen';
import CursusScreen from './src/screens/CursusScreen';
import CuriaScreen from './src/screens/CuriaScreen';
import ProvinciaeScreen from './src/screens/ProvinciaeScreen';
import ResourceBar from './src/components/shared/ResourceBar';
import { COLORS } from './src/utils/theme';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Domus: '🏛',
    Forum: '🏺',
    Cursus: '📜',
    Provinciae: '🗺',
    Curia: '⚖️',
  };
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
      {icons[label] ?? '●'}
    </Text>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <ResourceBar />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon label={route.name} focused={focused} />
            ),
            tabBarLabel: ({ focused }) => (
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {route.name.toUpperCase()}
              </Text>
            ),
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: COLORS.gold,
            tabBarInactiveTintColor: COLORS.dust,
          })}
        >
          <Tab.Screen name="Domus" component={DomusScreen} />
          <Tab.Screen name="Forum" component={ForumScreen} />
          <Tab.Screen name="Cursus" component={CursusScreen} />
          <Tab.Screen name="Provinciae" component={ProvinciaeScreen} />
          <Tab.Screen name="Curia" component={CuriaScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.panelSurface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'System',
    letterSpacing: 1,
    color: COLORS.dust,
  },
  tabLabelActive: {
    color: COLORS.gold,
  },
});
