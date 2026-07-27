import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, StyleSheet, View, AppState, Alert } from 'react-native';

import DomusScreen from './src/screens/DomusScreen';
import ForumScreen from './src/screens/ForumScreen';
import CursusScreen from './src/screens/CursusScreen';
import CuriaScreen from './src/screens/CuriaScreen';
import ProvinciaeScreen from './src/screens/ProvinciaeScreen';
import ResourceBar from './src/components/shared/ResourceBar';
import EventModal from './src/components/shared/EventModal';
import CityEventModal from './src/components/provinciae/CityEventModal';
import AmbitionSelectionModal from './src/components/shared/AmbitionSelectionModal';
import BirthNamingModal from './src/components/domus/BirthNamingModal';
import AgendaTablet from './src/components/shared/AgendaTablet';
import WelcomeBackModal from './src/components/shared/WelcomeBackModal';
import BattleScreen from './src/screens/BattleScreen';
import EpilogueScreen from './src/screens/EpilogueScreen';
import TrialSessionModal from './src/components/cursus/TrialSessionModal';
import EngagementInterstitial from './src/components/provinciae/EngagementInterstitial';
import AchievementToast from './src/components/shared/AchievementToast';
import TutorialOverlay, { getCaptionDock } from './src/components/shared/TutorialOverlay';
import TutorialCaption from './src/components/shared/TutorialCaption';
import TutorialDeflectionToast, { pingSealedTabDeflection } from './src/components/shared/TutorialDeflectionToast';
import { getTarget, subscribeTargets } from './src/engine/tutorialTargets';
import {
  getStep as getTutorialStep,
  isStepSatisfied as isTutorialStepSatisfied,
  isTabSealed,
  validateTutorialScript,
  getEligibleLesson,
} from './src/engine/tutorialEngine';
import type { TabName } from './src/models/agenda';
import { generateAgenda } from './src/engine/agendaEngine';
import { renderTabIcon, renderTabLabel, TabBarBackground, tabBarStyle, SEAL_CEREMONY_MS } from './src/components/shared/TabBar';
import StartMenuScreen from './src/screens/StartMenuScreen';
import { COLORS } from './src/utils/theme';
import { useGameStore } from './src/state/gameStore';
import { loadEarnedAchievements } from './src/state/achievementStore';

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

// Campaign Map plan, Chunk C7 — Provinciae's tab-icon badge (unseen campaign
// activity) needs a live store subscription; the plain renderTabIcon
// function screenOptions otherwise calls has no React context to read from.
// Tutorial redesign, Chunk T3 — generalised to every tab: also computes the
// sealed/ceremony treatment from tutorial.unlockedTabs, so this one component
// now covers what ProvinciaeTabIcon used to plus the seal.
function TabIcon({ tab, focused }: { tab: TabName; focused: boolean }) {
  const hasCampaignActivity = useGameStore(s => tab === 'Provinciae' && s.campaignLog !== null);
  const unlockedTabs = useGameStore(s => s.tutorial.unlockedTabs);
  const isUnlocked = unlockedTabs.includes(tab);
  const sealed = !isUnlocked;

  // Detects the sealed→unsealed transition to fire the ceremony exactly
  // once, without adding a transient field to persisted TutorialState.
  const wasUnlockedRef = useRef(isUnlocked);
  const [ceremonyActive, setCeremonyActive] = useState(false);

  useEffect(() => {
    if (isUnlocked && !wasUnlockedRef.current) {
      setCeremonyActive(true);
      const timer = setTimeout(() => setCeremonyActive(false), SEAL_CEREMONY_MS);
      wasUnlockedRef.current = true;
      return () => clearTimeout(timer);
    }
    wasUnlockedRef.current = isUnlocked;
  }, [isUnlocked]);

  return renderTabIcon(tab, focused, hasCampaignActivity, sealed, ceremonyActive);
}

function AppNavigator() {
  const insets = useSafeAreaInsets();
  const barHeight = tabBarStyle.height + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon tab={route.name as TabName} focused={focused} />,
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
      screenListeners={({ route }) => ({
        // Tutorial redesign, Chunk T3 — block the tap, not the screen: all
        // five Tab.Screens stay registered (uiNavRequest deep-linking and
        // navigation state both depend on that), only the bottom-bar gesture
        // is intercepted for a sealed tab.
        tabPress: (e) => {
          if (isTabSealed(route.name as TabName, useGameStore.getState())) {
            e.preventDefault();
            pingSealedTabDeflection();
          }
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

// ─── Tutorial layer ───────────────────────────────────────────────────────────
// Renders the spotlight overlay + Philon caption for the tutorial's current
// step, if any. Self-gated on tutorial.stepId — a Free Start or a
// fully-skipped guided start renders nothing.

function confirmSkipTutorialArc() {
  Alert.alert(
    'Skip this lesson?',
    "Philon will stop guiding you — this arc, and everything after it, completes immediately. You can't come back to it.",
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', style: 'destructive', onPress: () => useGameStore.getState().skipTutorialArc() },
    ],
  );
}

function TutorialLayer() {
  const tutorial = useGameStore(s => s.tutorial);
  const currentStep = tutorial.stepId ? getTutorialStep(tutorial.stepId) : null;

  const rect = useSyncExternalStore(
    subscribeTargets,
    () => (currentStep?.target ? getTarget(currentStep.target) : null),
  );

  if (!currentStep) return null;

  return (
    <>
      <TutorialOverlay targetId={currentStep.target} rail={currentStep.rail} />
      <TutorialCaption
        narration={currentStep.narration}
        actLabel={currentStep.actLabel}
        dock={getCaptionDock(rect)}
        onTapAdvance={
          currentStep.advance.kind === 'tap'
            ? () => useGameStore.getState().advanceTutorialStep()
            : undefined
        }
        onSkipPress={confirmSkipTutorialArc}
      />
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function GameRoot() {
  const gameStarted = useGameStore(s => s.gameStarted);

  // ── Navigation ref — used by the uiNavRequest deep-link handler ─────────────
  const navRef = useNavigationContainerRef();

  // ── Welcome-back recap (local state — not in store) ────────────────────────
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // ── Laurels — warm the cross-run earned-achievements cache once, well
  //    before a player can realistically reach a season end (P5-F). ────────
  useEffect(() => {
    loadEarnedAchievements();
  }, []);

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
  const selectTrialForBasilica = useGameStore(s => s.selectTrialForBasilica);
  const setBasilicaReturnTab = useGameStore(s => s.setBasilicaReturnTab);
  const requestCuriaSubTab = useGameStore(s => s.requestCuriaSubTab);
  const requestCuriaBillTarget = useGameStore(s => s.requestCuriaBillTarget);

  useEffect(() => {
    if (!uiNavRequest) return;
    if (!navRef.isReady()) return;

    // Basilica deep-link (trialId payload) — remember whichever tab the
    // player was actually on before this switches them to Cursus, so
    // CursusScreen's closeBasilica can send them back instead of stranding
    // them on Cursus once the sheet is dismissed (e.g. CuriaScreen's "Open
    // the Basilica" button). null when they were already on Cursus.
    if (uiNavRequest.trialId) {
      const currentTab = navRef.getCurrentRoute()?.name ?? null;
      setBasilicaReturnTab(currentTab && currentTab !== uiNavRequest.tab ? (currentTab as any) : null);
    }

    // Navigate to the target tab
    navRef.navigate(uiNavRequest.tab as never);

    // Apply payload — selectedCharacterId and trialId (Phase 4, P4-D) are the
    // only confirmed store fields so far. provinceId / billId: tab landing
    // only per plan §P1-C v1 scope.
    // TODO (P1-C+): add selectedLeaderId, expandedClanId, provinceId deep-links
    //               once the relevant screen store fields are confirmed.
    if (uiNavRequest.selectedCharacterId) {
      selectCharacter(uiNavRequest.selectedCharacterId);
    }
    if (uiNavRequest.trialId) {
      selectTrialForBasilica(uiNavRequest.trialId);
    }

    // Curia Tab Redesign, Chunk C2 — a Curia deep-link also picks the right
    // sub-tab. billId also carries a specific bill to scroll to/highlight
    // (Chunk C3's real LegesView reads and clears curiaBillTargetRequest;
    // C2's stub just clears it — see that field's gameStore.ts comment).
    // trialId's Basilica open above still fires unchanged: until Chunk C4
    // moves the Basilica's content into NEGOTIA, the only place a trial can
    // actually be seen is Cursus, so it opens there in the background while
    // this navigates the player to Curia's (stub, for now) NEGOTIA tab.
    if (uiNavRequest.tab === 'Curia') {
      if (uiNavRequest.billId)  requestCuriaSubTab('leges');
      if (uiNavRequest.trialId) requestCuriaSubTab('negotia');
      if (uiNavRequest.billId)  requestCuriaBillTarget(uiNavRequest.billId);
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
      if (s.trials.some(t => t.status === 'in_session')) return; // Phase 4, P4-E — trial day
      if (s.agendaViewedTurn >= s.turnNumber)          return;

      const items = generateAgenda(s);
      if (items.length > 0 || s.turnNumber <= 8) {
        s.showAgenda();
      }
    };

    const unsub = useGameStore.subscribe(checkAndMaybeOpen);
    return unsub; // clean up on unmount
  }, []); // intentionally empty — subscription lives for component lifetime

  // ── Tutorial director ────────────────────────────────────────────────────────
  // Same subscription idiom as AgendaTablet auto-open above, for the same
  // reason (finding 30 / tutorial-redesign-plan.md §2.6): a deps-array effect
  // fires once per render batch and can miss a same-batch state change, a
  // subscription fires after every store commit and always reads current
  // state. Only advances predicate-kind steps — tap/eventResolved steps
  // advance via TutorialCaption's onTapAdvance or the event-resolution path.
  useEffect(() => {
    if (__DEV__) {
      validateTutorialScript();
    }

    const checkAndMaybeAdvance = () => {
      const s = useGameStore.getState();
      if (!s.gameStarted)                                return;
      if (s.activeEvent)                                 return;
      if (s.seasonOverlayVisible)                        return;
      if (s.pendingBirthNaming)                          return;
      if ((s.pendingAmbitionScopes ?? []).length > 0)    return;
      if (s.trials.some(t => t.status === 'in_session')) return;
      if (s.activeBattle)                                return;

      // T10 — just-in-time lessons. Only ever considered while no arc/lesson
      // is already active (getEligibleLesson's own guard); same blocking
      // conditions above apply so a lesson never starts on top of a modal.
      if (!s.tutorial.activeArc) {
        const lesson = getEligibleLesson(s);
        if (lesson) s.startTutorialArc(lesson);
        return;
      }
      if (!s.tutorial.stepId) return;

      const currentStep = getTutorialStep(s.tutorial.stepId);
      if (currentStep && isTutorialStepSatisfied(currentStep, s)) {
        s.advanceTutorialStep();
      }
    };

    const unsub = useGameStore.subscribe(checkAndMaybeAdvance);
    return unsub;
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
        {/* TutorialLayer sits above the navigator but below every modal listed
            next — a real story event, birth, ambition choice, trial day, or
            battle must always win over a spotlight/caption (tutorial-redesign
            -plan.md §2.6). It is a plain absolutely-positioned overlay, not a
            native Modal, but EventModal etc. are native Modals and therefore
            paint above it regardless of this ordering anyway; ordered here to
            keep the JSX itself legible as a priority list. */}
        <TutorialLayer />
        <TutorialDeflectionToast />
        {/* Modal priority: EventModal → AmbitionSelectionModal → BirthNamingModal → AgendaTablet → WelcomeBackModal.
            BirthNamingModal was imported but never mounted here until this fix — pendingBirthNaming
            was being set correctly by turnSequencer's passive birth check, but with no modal ever
            rendering, confirmBirthNaming (which actually appends the child to `family`) could never
            fire, and the stuck pendingBirthNaming silently blocked every future birth roll too
            (turnSequencer's `s.pendingBirthNaming === null` gate). Self-gated on pendingBirthNaming,
            same idiom as AmbitionSelectionModal, so its position here is order-of-priority only.
            BattleScreen is its own full-screen native Modal (Military Overhaul M5) — it takes
            over the whole screen whenever a battle is staging/active, regardless of DOM order.
            TrialSessionModal (Phase 4, P4-E) is the same idiom — a full-screen native Modal
            self-gated on a trial with status 'in_session'; turnSequencer only ever puts one
            trial in session at a time (fileProsecution/shouldTriggerTrial both enforce a single
            active trial system-wide), so it never stacks with itself, though it can in principle
            coincide with a same-season random event (both are native Modals; no explicit
            deferral was added for this rare overlap, same looseness this codebase already
            tolerates elsewhere). EpilogueScreen (Phase 3, P3-E)
            self-gates on runFinished — takes over the whole screen once a run ends, same idiom,
            outranking everything else here since nothing is actionable once a run is finished.
            EngagementInterstitial (Campaign Map plan, Chunk C7) is the same full-screen-Modal
            idiom, self-gated on pendingEngagements[0] — TEMPORARY (see that component's own
            header comment): C8 replaces its single "Trust the Legate" button with a real
            tactical-vs-abstract choice, not this component's mounting or gating. */}
        <EventModal />
        <CityEventModal />
        <AmbitionSelectionModal />
        <BirthNamingModal />
        <AgendaTablet />
        <WelcomeBackModal
          visible={showWelcomeBack}
          onDismiss={() => setShowWelcomeBack(false)}
        />
        <TrialSessionModal />
        <EngagementInterstitial />
        <BattleScreen />
        <EpilogueScreen />
        <AchievementToast />
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
