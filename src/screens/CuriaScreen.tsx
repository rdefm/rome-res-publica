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
import { calcRomeStatModifiers } from '../engine/resourceEngine';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import CrisisTrackModal from '../components/shared/CrisisTrackModal';
import ScrollModal, { PARCHMENT } from '../components/shared/ScrollModal';
import type { CrisisTrackId, CrisisTrack } from '../models/crisis';
import { getTierFromLevel } from '../models/crisis';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import InfoTap from '../components/shared/InfoTap';
import { getDesperationTier } from '../engine/warEngine';
import { isWarActiveForCommand } from '../engine/commandEngine';
import { useTutorialTarget } from '../components/shared/useTutorialTarget';
import DragSheet from '../components/shared/DragSheet';
import BasilicaSheet from '../components/curia/BasilicaSheet';
import AlertStrip from '../components/curia/AlertStrip';

// ─── Crisis track configuration ───────────────────────────────────────────────

const CRISIS_TRACK_COLOR: Record<CrisisTrackId, string> = {
  war:          '#C04010',  // amber-red
  unrest:       '#C03030',  // red-coral
  constitution: COLORS.purple,
  economy:      '#1A8888',  // teal
};

const CRISIS_TRACK_LABEL: Record<CrisisTrackId, string> = {
  war:          'WAR',
  unrest:       'UNREST',
  constitution: 'CONSTITUTION',
  economy:      'ECONOMY',
};

const CRISIS_TIER_LABELS: Record<CrisisTrackId, [string, string, string, string, string]> = {
  war:          ['Pax Externa',           'Border Tensions',   'Active Conflict',     'War Crisis',            'Existential Threat'],
  unrest:       ['Content Populace',      'Murmurs',           'Growing Anger',       'Street Violence',       'Open Revolt'],
  constitution: ['Institutional Stability','Political Tension', 'Senate Dysfunction',  'Constitutional Crisis', 'Republic in Peril'],
  economy:      ['Prosperous Republic',   'Tightening Budgets','Economic Strain',     'Scarcity Crisis',       'Economic Collapse'],
};

// ─── Crisis track cell ────────────────────────────────────────────────────────

function CrisisTrackCell({
  trackId,
  track,
  onPress,
}: {
  trackId: CrisisTrackId;
  track: CrisisTrack;
  onPress?: () => void;
}) {
  const color = CRISIS_TRACK_COLOR[trackId];
  const tierLabel = CRISIS_TIER_LABELS[trackId][track.tier];
  // Tutorial redesign, T5 — only the War track is ever a spotlight target.
  const tutorialTarget = useTutorialTarget(trackId === 'war' ? 'curia.crisis-track.war' : undefined);

  const cell = (
    <View ref={tutorialTarget.ref} onLayout={tutorialTarget.onLayout} style={ctc.cell}>
      <View style={ctc.header}>
        <Text style={[ctc.trackName, { color }]}>{CRISIS_TRACK_LABEL[trackId]}</Text>
        <Text style={[ctc.levelNum, { color }]}>{Math.round(track.level)}</Text>
      </View>
      <Text style={ctc.tierLabel}>{tierLabel}</Text>
      {track.namedCrisis && (
        <Text style={ctc.namedCrisis}>{track.namedCrisis}</Text>
      )}
      <StatBar
        label=""
        value={track.level}
        color={color}
        thresholdMarks={[20, 40, 60, 80]}
      />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        {cell}
      </TouchableOpacity>
    );
  }
  return cell;
}

const ctc = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  trackName: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  levelNum: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  tierLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  namedCrisis: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 10,
    marginBottom: 4,
  },
});

// ─── Rome stat detail modal ───────────────────────────────────────────────────

// 'stability' and 'plebs' moved to Provinciae → Latium (LatiumSheet).
// Treasury remains here because it directly affects bill support calculations.
type RomeStat = 'treasury';

const ROME_STAT_CONFIG: Record<RomeStat, {
  label: string;
  color: string;
  thresholds: { range: string; label: string; effects: string }[];
  ticks: number[];
}> = {
  treasury: {
    label: 'Treasury',
    color: COLORS.denariiColor,
    ticks: [10, 25, 65, 85],
    thresholds: [
      { range: '0–9',    label: 'Bankrupt',     effects: 'Denarii −3/season · Spending bills −10 support · Lex de Vectigalibus auto-injected' },
      { range: '10–24',  label: 'Depleted',     effects: 'Denarii −1/season · Spending bills −5 support' },
      { range: '25–64',  label: 'Adequate',     effects: 'No modifier (baseline)' },
      { range: '65–84',  label: 'Flush',        effects: 'Spending bills +5 support · Crisis absorbs 1 point/season' },
      { range: '85–100', label: 'Overflowing',  effects: 'Spending bills +10 support · Crisis absorbs 2 points/season' },
    ],
  },
};

function RomeStatModal({
  stat,
  value,
  visible,
  onClose,
}: {
  stat: RomeStat;
  value: number;
  visible: boolean;
  onClose: () => void;
}) {
  const config = ROME_STAT_CONFIG[stat];

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={config.label}
      subtitle={`Current: ${value}`}
    >
      {config.thresholds.map((t, i) => {
        const [min, max] = t.range.split('–').map(Number);
        const isActive = value >= min && value <= max;
        return (
          <View key={i} style={[rsm.thresholdCard, isActive && rsm.thresholdCardActive]}>
            <View style={rsm.thresholdRow}>
              <Text style={[rsm.thresholdLabel, isActive && rsm.thresholdLabelActive]}>
                {t.label}
              </Text>
              <Text style={rsm.thresholdRange}>{t.range}</Text>
            </View>
            <Text style={rsm.thresholdEffects}>{t.effects}</Text>
            {isActive && <Text style={rsm.activeTag}>← CURRENT</Text>}
          </View>
        );
      })}
    </ScrollModal>
  );
}

const rsm = StyleSheet.create({
  thresholdCard: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  thresholdCardActive: { borderColor: PARCHMENT.gold, backgroundColor: 'transparent' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  thresholdLabel: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', color: PARCHMENT.heading },
  thresholdLabelActive: { color: PARCHMENT.gold },
  thresholdRange: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT.muted },
  thresholdEffects: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, color: PARCHMENT.body },
  activeTag: { fontFamily: FONTS.ui, fontSize: 9, color: PARCHMENT.gold, marginTop: 4, letterSpacing: 1 },
});

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

