import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, StyleSheet, View } from 'react-native';

import DomusScreen from './src/screens/DomusScreen';
import ForumScreen from './src/screens/ForumScreen';
import CursusScreen from './src/screens/CursusScreen';
import CuriaScreen from './src/screens/CuriaScreen';
import ProvinciaeScreen from './src/screens/ProvinciaeScreen';
import ResourceBar from './src/components/shared/ResourceBar';
import EventModal from './src/components/shared/EventModal';
import AmbitionSelectionModal from './src/components/shared/AmbitionSelectionModal';
import BirthNamingModal from './src/components/domus/BirthNamingModal';
import { COLORS } from './src/utils/theme';

const Tab = createBottomTabNavigator();

// ─── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null };

  static getDerivedStateFromError(e: Error) {
    return { error: e.message + '\n\n' + e.stack };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.heading}>RENDER ERROR</Text>
          <Text style={eb.body}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 20,
    paddingTop: 60,
  },
  heading: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    fontFamily: 'System',
  },
  body: {
    color: COLORS.marble,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

// ─── Tab navigator ────────────────────────────────────────────────────────────

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

function AppNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 52 + insets.bottom;

  return (
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
        tabBarStyle: {
          backgroundColor: COLORS.panelSurface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
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
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <View style={styles.root}>
            <StatusBar style="light" backgroundColor={COLORS.bg} />
            <ResourceBar />
            <AppNavigator />
            {/* EventModal sits above everything — renders only when activeEvent is set */}
            <EventModal />
            {/* AmbitionSelectionModal — fires when player needs to pick an ambition */}
            <AmbitionSelectionModal />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
