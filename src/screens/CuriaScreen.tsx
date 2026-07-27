import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import type { CuriaSubTab } from '../models/curia';
import StateOfRepublicPanel from '../components/curia/StateOfRepublicPanel';
import SubTabBar from '../components/curia/SubTabBar';
import LegesView from '../components/curia/LegesView';
import NegotiaView from '../components/curia/NegotiaView';
import MunificentiaView from '../components/curia/MunificentiaView';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, SPACING, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import { getDesperationTier } from '../engine/warEngine';
import { isWarActiveForCommand } from '../engine/commandEngine';
import DragSheet from '../components/shared/DragSheet';
import BasilicaSheet from '../components/curia/BasilicaSheet';
import AlertStrip from '../components/curia/AlertStrip';

// ─── CuriaScreen ──────────────────────────────────────────────────────────────

export default function CuriaScreen() {
  // Curia Tab Redesign, Chunk C2 — active sub-tab and header-collapse are
  // local state, matching the CitySheet/LatiumSheet precedent (no
  // persistence, no save-schema change).
  const [activeSubTab, setActiveSubTab] = useState<CuriaSubTab>('leges');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // App.tsx's uiNavRequest effect sets curiaSubTabRequest from a
  // billId/trialId deep-link; read-then-clear, same shape as CursusScreen's
  // selectedTrialId effect.
  const curiaSubTabRequest = useGameStore(s => s.curiaSubTabRequest);
  const requestCuriaSubTab = useGameStore(s => s.requestCuriaSubTab);
  useEffect(() => {
    if (curiaSubTabRequest) {
      setActiveSubTab(curiaSubTabRequest);
      requestCuriaSubTab(null);
    }
  }, [curiaSubTabRequest]);

  // Curia Tab Redesign, Chunk C3 — owned here (not by LegesView) so
  // scroll-to-bill doesn't require nesting a second ScrollView inside this
  // shell's own scroll region.
  const scrollRef = useRef<ScrollView>(null);

  // Curia Tab Redesign, Chunk C4 — the Basilica sheet now opens in place,
  // over Curia, instead of navigating to Cursus (Finding 13). Same
  // split visible/content-id state DragSheet requires; selectedTrialId is
  // set either by an agenda deep-link or by TrialBanner's own button
  // (both call selectTrialForBasilica directly).
  const selectedTrialId = useGameStore(s => s.selectedTrialId);
  const selectTrialForBasilica = useGameStore(s => s.selectTrialForBasilica);
  const [basilicaTrialId, setBasilicaTrialId] = useState<string | null>(null);
  const [basilicaVisible, setBasilicaVisible] = useState(false);

  function closeBasilica() {
    setBasilicaVisible(false);
  }

  function handleBasilicaClosed() {
    setBasilicaVisible(false);
    setBasilicaTrialId(null);
  }

  useEffect(() => {
    if (selectedTrialId) {
      setBasilicaTrialId(selectedTrialId);
      setBasilicaVisible(true);
      selectTrialForBasilica(null);
    }
  }, [selectedTrialId]);

  // Chunk C4, Delta 12 — badge/alert-strip criticality. Selectors return
  // primitives (AgendaBadge.tsx's pattern) so Zustand's Object.is suppresses
  // unnecessary renders.
  const negotiaCount = useGameStore(s => {
    const trialCount = s.trials.some(t => t.status !== 'resolved') ? 1 : 0;
    const warCount = (s.wars ?? []).filter(w => w.active && getDesperationTier(w.warScore) !== 'none').length;
    const commandCount = (s.activeCommand || s.commandElection?.active || isWarActiveForCommand(s.wars ?? [])) ? 1 : 0;
    return trialCount + warCount + commandCount;
  });
  const negotiaCritical = useGameStore(s => {
    const trialInSession = s.trials.some(t => t.status === 'in_session');
    const treatyAwaitingResponse = (s.wars ?? []).some(w => w.treaty?.stage === 'ai_offer');
    const commandResolvesThisSeason = !!s.commandElection?.active;
    return trialInSession || treatyAwaitingResponse || commandResolvesThisSeason;
  });

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <StateOfRepublicPanel
        collapsed={headerCollapsed}
        onToggleCollapse={() => setHeaderCollapsed(c => !c)}
      />
      {negotiaCritical && activeSubTab !== 'negotia' && (
        <AlertStrip onPress={() => setActiveSubTab('negotia')} />
      )}
      <SubTabBar
        active={activeSubTab}
        onChange={setActiveSubTab}
        negotiaCount={negotiaCount}
        negotiaCritical={negotiaCritical}
      />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        {activeSubTab === 'leges' && <LegesView scrollRef={scrollRef} />}
        {activeSubTab === 'negotia' && <NegotiaView />}
        {activeSubTab === 'munificentia' && <MunificentiaView />}
      </ScrollView>

      <DragSheet visible={basilicaVisible} onClose={handleBasilicaClosed}>
        {basilicaTrialId && <BasilicaSheet trialId={basilicaTrialId} onClose={closeBasilica} />}
      </DragSheet>

      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  scroll: { flex: 1, padding: SPACING.md },
});

