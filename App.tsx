import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, StyleSheet, View, ImageBackground } from 'react-native';

import DomusScreen from './src/screens/DomusScreen';
import ForumScreen from './src/screens/ForumScreen';
import CursusScreen from './src/screens/CursusScreen';
import CuriaScreen from './src/screens/CuriaScreen';
import ProvinciaeScreen from './src/screens/ProvinciaeScreen';
import ResourceBar from './src/components/shared/ResourceBar';
import EventModal from './src/components/shared/EventModal';
import AmbitionSelectionModal from './src/components/shared/AmbitionSelectionModal';
import BirthNamingModal from './src/components/domus/BirthNamingModal';
import { renderTabIcon, renderTabLabel, tabBarStyle } from './src/components/shared/TabBar';
import { COLORS } from './src/utils/theme';

const Tab = createBottomTabNavigator();
const MARBLE_BG = require('./src/assets/images/marble_rectangle.png');

// ─── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message + '\n\n' + e.stack }; }
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
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingTop: 60 },
  heading:   { color: COLORS.gold, fontSize: 16, fontWeight: '700', marginBottom: 12, fontFamily: 'System' },
  body:      { color: COLORS.marble, fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
});

// ─── Tab bar marble background ────────────────────────────────────────────────

function TabBarBackground() {
  return (
    <ImageBackground
      source={MARBLE_BG}
      style={StyleSheet.absoluteFill}
      imageStyle={tabBarBg.image}
      resizeMode="cover"
    >
      {/* Top border drawn over the marble */}
      <View style={tabBarBg.topBorder} />
    </ImageBackground>
  );
}

const tabBarBg = StyleSheet.create({
  image: {
    // No borderRadius, no margin — must fill edge to edge
  },
  topBorder: {
    height: 2,
    backgroundColor: COLORS.border,
  },
});

// ─── Tab navigator ────────────────────────────────────────────────────────────

function AppNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => renderTabIcon(route.name, focused),
        tabBarLabel: () => null,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          ...tabBarStyle,
          paddingBottom: insets.bottom,
          height: tabBarStyle.height + insets.bottom,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 0,
          flex: 1,
        },
      })}
    >
      <Tab.Screen name="Domus"      component={DomusScreen} />
      <Tab.Screen name="Forum"      component={ForumScreen} />
      <Tab.Screen name="Cursus"     component={CursusScreen} />
      <Tab.Screen name="Provinciae" component={ProvinciaeScreen} />
      <Tab.Screen name="Curia"      component={CuriaScreen} />
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
            <EventModal />
            <AmbitionSelectionModal />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
