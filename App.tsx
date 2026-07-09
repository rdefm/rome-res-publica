import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, StyleSheet, View, AppState } from 'react-native';

import DomusScreen from './src/screens/DomusScreen';
import ForumScreen from './src/screens/ForumScreen';
import CursusScreen from './src/screens/CursusScreen';
import CuriaScreen from './src/screens/CuriaScreen';
import ProvinciaeScreen from './src/screens/ProvinciaeScreen';
import ResourceBar from './src/components/shared/ResourceBar';
import EventModal from './src/components/shared/EventModal';
import AmbitionSelectionModal from './src/components/shared/AmbitionSelectionModal';
import BirthNamingModal from './src/components/domus/BirthNamingModal';
import AgendaTablet from './src/components/shared/AgendaTablet';
import WelcomeBackModal from './src/components/shared/WelcomeBackModal';
import BattleScreen from './src/screens/BattleScreen';
import { generateAgenda } from './src/engine/agendaEngine';
import { renderTabIcon, renderTabLabel, TabBarBackground, tabBarStyle } from './src/components/shared/TabBar';
import StartMenuScreen from './src/screens/StartMenuScreen';
import { COLORS } from './src/utils/theme';
import { useGameStore } from './src/state/gameStore';

const Tab = createBottomTabNavigator();

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

// ─── Tab navigator ────────────────────────────────────────────────────────────

function AppNavigator() {
  const insets = useSafeAreaInsets();
  const barHeight = tabBarStyle.height + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => renderTabIcon(route.name, focused),
        tabBarLabel: () => null,
        // Single Image covers the full bar — no per-item background needed
        tabBarBackground: () => <TabBarBackground height={barHeight} />,
        tabBarStyle: {
          ...tabBarStyle,
          paddingBottom: insets.bottom,
          height: barHeight,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          paddingHorizontal: 0,
          flex: 1,
          backgroundColor: 'transparent',
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

function GameRoot() {
  const gameStarted = useGameStore(s => s.gameStarted);

  // ── Navigation ref — used by the uiNavRequest deep-link handler ─────────────
  const navRef = useNavigationContainerRef();

  // ── Welcome-back recap (local state — not in store) ────────────────────────
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // ── AppState listener — autosave on background, welcome-back on foreground ──
  useEffect(() => {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    const subscription = AppState.addEventListener('change', nextAppState => {
      const storeState = useGameStore.getState();
      const { saveProvider: sp } = require('./src/state/saveLoad');

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Save on background — UI fields are stripped inside saveLoad.save()
        sp.save(storeState).catch((e: Error) =>
          console.warn('[P1-D] Background save failed:', e)
        );
        storeState.tickLastActive();
      } else if (nextAppState === 'active') {
        const elapsed = Date.now() - storeState.lastActiveAt;
        if (
          storeState.gameStarted &&
          storeState.lastSeasonLedger &&
          elapsed > TWELVE_HOURS
        ) {
          setShowWelcomeBack(true);
        }
        storeState.tickLastActive();
      }
    });

    return () => subscription.remove();
  }, []);

  // ── uiNavRequest deep-link handler ──────────────────────────────────────────
  // When an agenda item is tapped, agendaEngine sets uiNavRequest via
  // requestNavigation(). We consume it here, switch tabs, apply payload,
  // then clear the request.
  const uiNavRequest  = useGameStore(s => s.uiNavRequest);
  const clearNavRequest = useGameStore(s => s.clearNavRequest);
  const selectCharacter = useGameStore(s => s.selectCharacter);

  useEffect(() => {
    if (!uiNavRequest) return;
    if (!navRef.isReady()) return;

    // Navigate to the target tab
    navRef.navigate(uiNavRequest.tab as never);

    // Apply payload — selectedCharacterId is the only confirmed store field (v1).
    // provinceId / billId / trialId: tab landing only per plan §P1-C v1 scope.
    // TODO (P1-C+): add selectedLeaderId, expandedClanId, provinceId deep-links
    //               once the relevant screen store fields are confirmed.
    if (uiNavRequest.selectedCharacterId) {
      selectCharacter(uiNavRequest.selectedCharacterId);
    }

    clearNavRequest();
  }, [uiNavRequest]);

  // ── AgendaTablet auto-open ──────────────────────────────────────────────────
  // Uses a Zustand subscription rather than a useEffect deps array.
  // A deps-array effect fires once per React render batch; if seasonOverlayVisible
  // clears in the same batch as turnNumber changes, the effect can miss the window.
  // A subscription fires after EVERY store commit, always reading current state.
  useEffect(() => {
    const checkAndMaybeOpen = () => {
      const s = useGameStore.getState();
      if (!s.gameStarted)                              return;
      if (s.agendaVisible)                             return;
      if (s.seasonOverlayVisible)                      return;
      if (s.activeEvent)                               return;
      if (s.pendingBirthNaming)                        return;
      if ((s.pendingAmbitionScopes ?? []).length > 0)  return;
      if (s.agendaViewedTurn >= s.turnNumber)          return;

      const items = generateAgenda(s);
      if (items.length > 0 || s.turnNumber <= 8) {
        s.showAgenda();
      }
    };

    const unsub = useGameStore.subscribe(checkAndMaybeOpen);
    return unsub; // clean up on unmount
  }, []); // intentionally empty — subscription lives for component lifetime

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!gameStarted) {
    return <StartMenuScreen />;
  }

  return (
    <NavigationContainer ref={navRef}>
      <View style={styles.root}>
        <StatusBar style="light" backgroundColor={COLORS.bg} />
        <ResourceBar />
        <AppNavigator />
        {/* Modal priority: EventModal → AmbitionSelectionModal → AgendaTablet → WelcomeBackModal.
            BattleScreen is its own full-screen native Modal (Military Overhaul M5) — it takes
            over the whole screen whenever a battle is staging/active, regardless of DOM order. */}
        <EventModal />
        <AmbitionSelectionModal />
        <AgendaTablet />
        <WelcomeBackModal
          visible={showWelcomeBack}
          onDismiss={() => setShowWelcomeBack(false)}
        />
        <BattleScreen />
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GameRoot />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
