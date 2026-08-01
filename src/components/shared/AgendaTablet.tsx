// AgendaTablet — Philon's wax tablet (tabula cerata).
// Distinct from ScrollModal: dark wax surface inside a warm wooden frame.
// Auto-opened by App.tsx after each season resolves; also manually opened
// via AgendaBadge. Dispatches deep-link navigation when an item is tapped.
//
// Ambition rework (ticket 02) — gains a second leaf, "Ambitiones", reached
// by a tab switch inside this same modal (spec: no new modal). Leaf 1
// ("Hodierna") is the unchanged agenda list below.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { GameState } from '../../state/gameStore';
import { generateAgenda } from '../../engine/agendaEngine';
import { getProgress, getProgressFraction, projectDynasticAmbitions } from '../../engine/ambitionEngine';
import type { ActiveAmbition, AmbitionOffer, AmbitionScope } from '../../models/ambition';
import type { AgendaItem, AgendaSeverity } from '../../models/agenda';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import AmbitionBuilder from './AmbitionBuilder';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const TABLET_MAX_ITEMS = 6;

const { width: SCREEN_W } = Dimensions.get('window');
const TABLET_W = Math.round(SCREEN_W * 0.88);

type TabletLeaf = 'hodierna' | 'ambitiones';

// ─── Severity colours (dot glyphs) ───────────────────────────────────────────

const SEVERITY_DOT_COLOR: Record<AgendaSeverity, string> = {
  critical:    COLORS.crimson,
  warning:     COLORS.amber,
  opportunity: COLORS.laurel,
  info:        COLORS.dust,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSeasonLabel(seasonIndex: number, year: number): string {
  const season = SEASON_NAMES[seasonIndex] ?? 'Spring';
  const absYear = Math.abs(year);
  return `${season}, ${absYear} BC — your secretary's notes`;
}

// ─── Sub-components — Hodierna leaf ──────────────────────────────────────────

function SeverityDot({ severity }: { severity: AgendaSeverity }) {
  return (
    <View style={[styles.dot, { backgroundColor: SEVERITY_DOT_COLOR[severity] }]} />
  );
}

function AgendaItemRow({
  item,
  onPress,
}: {
  item: AgendaItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={onPress} activeOpacity={0.7}>
      <SeverityDot severity={item.severity} />
      <View style={styles.itemText}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.itemDetail} numberOfLines={2}>{item.detail}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Sub-components — Ambitiones leaf ────────────────────────────────────────

function ProgressBar({ fraction }: { fraction: number }) {
  const pct = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%` as const;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: pct }]} />
    </View>
  );
}

function AmbitionSlotCard({
  icon, label, ambition, offer, turnNumber, state, onSet, onAbandon,
}: {
  icon: string;
  label: string;
  ambition: ActiveAmbition | undefined;
  offer: AmbitionOffer | undefined;
  turnNumber: number;
  state: GameState;
  onSet: () => void;
  onAbandon: (id: string) => void;
}) {
  if (offer) {
    // Offer-pending state — fully wired (Accept/Refuse) by ticket 05's
    // acceptStoryAmbition/refuseStoryAmbition. No producer writes into
    // pendingAmbitionOffers yet, so this branch only needs to render without
    // crashing if reached early.
    return (
      <View style={styles.slotCard}>
        <Text style={styles.slotLabel}>{icon} {label}</Text>
        <Text style={styles.slotTitle}>{offer.title}</Text>
        <Text style={styles.slotMuted}>A pending offer — awaiting your decision.</Text>
      </View>
    );
  }

  if (!ambition) {
    return (
      <View style={styles.slotCard}>
        <Text style={styles.slotLabel}>{icon} {label}</Text>
        <TouchableOpacity style={styles.setBtn} onPress={onSet} activeOpacity={0.75}>
          <Text style={styles.setBtnText}>Set an ambition ›</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { current, target, label: progressLabel } = getProgress(ambition, state);
  const fraction = getProgressFraction(ambition, state);
  const seasonsRemaining = ambition.deadlineTurn !== undefined ? Math.max(0, ambition.deadlineTurn - turnNumber) : undefined;

  return (
    <View style={styles.slotCard}>
      <Text style={styles.slotLabel}>{icon} {label}</Text>
      <Text style={styles.slotTitle}>{ambition.title}</Text>
      <ProgressBar fraction={fraction} />
      <View style={styles.slotMetaRow}>
        <Text style={styles.slotMuted}>{Math.round(current)} / {Math.round(target)} {progressLabel}</Text>
        {seasonsRemaining !== undefined && (
          <Text style={styles.slotMuted}>{seasonsRemaining} {seasonsRemaining === 1 ? 'season' : 'seasons'} left</Text>
        )}
      </View>
      {ambition.refusable && (
        <TouchableOpacity style={styles.abandonBtn} onPress={() => onAbandon(ambition.id)} activeOpacity={0.75}>
          <Text style={styles.abandonBtnText}>Abandon</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DynasticRow({ ambition, state }: { ambition: ActiveAmbition; state: GameState }) {
  const { current, target, label } = getProgress(ambition, state);
  const fraction = getProgressFraction(ambition, state);
  return (
    <View style={styles.dynasticRow}>
      <Text style={styles.dynasticTitle}>{ambition.title}</Text>
      <ProgressBar fraction={fraction} />
      <Text style={styles.slotMuted}>{Math.round(current)} / {Math.round(target)} {label}</Text>
    </View>
  );
}

function AmbitionesLeaf({ onOpenBuilder }: { onOpenBuilder: (scope: AmbitionScope) => void }) {
  const ambitions = useGameStore(s => s.ambitions);
  const pendingAmbitionOffers = useGameStore(s => s.pendingAmbitionOffers);
  const turnNumber = useGameStore(s => s.turnNumber);
  const family = useGameStore(s => s.family);
  const abandonAmbition = useGameStore(s => s.abandonAmbition);
  const player = family.find(c => c.isPlayer);

  // Snapshot read for getProgress/projectDynasticAmbitions — this component
  // already re-renders off the selectors above whenever ambitions/turnNumber
  // change, so a second subscription to the whole state isn't needed.
  const state = useGameStore.getState();

  const familyAmbition = ambitions.find(a => a.status === 'active' && a.scope === 'family');
  const characterAmbition = ambitions.find(
    a => a.status === 'active' && a.scope === 'character' && a.assignedCharacterId === player?.id
  );
  const dynastic = projectDynasticAmbitions(state);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <AmbitionSlotCard
        icon="🏛️"
        label="FAMILY"
        ambition={familyAmbition}
        offer={pendingAmbitionOffers.family}
        turnNumber={turnNumber}
        state={state}
        onSet={() => onOpenBuilder('family')}
        onAbandon={abandonAmbition}
      />
      <AmbitionSlotCard
        icon="👤"
        label="CHARACTER"
        ambition={characterAmbition}
        offer={pendingAmbitionOffers.character}
        turnNumber={turnNumber}
        state={state}
        onSet={() => onOpenBuilder('character')}
        onAbandon={abandonAmbition}
      />
      <Text style={styles.dynasticHeading}>DYNASTIC LEGACY</Text>
      {dynastic.map(d => <DynasticRow key={d.id} ambition={d} state={state} />)}
    </ScrollView>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AgendaTablet() {
  const agendaVisible     = useGameStore(s => s.agendaVisible);
  const dismissAgenda     = useGameStore(s => s.dismissAgenda);
  const requestNavigation = useGameStore(s => s.requestNavigation);
  const seasonIndex       = useGameStore(s => s.seasonIndex);
  const year              = useGameStore(s => s.year);
  const agendaTabletLeafRequest = useGameStore(s => s.agendaTabletLeafRequest);
  const requestAgendaTabletLeaf = useGameStore(s => s.requestAgendaTabletLeaf);

  const [items, setItems]     = useState<AgendaItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [leaf, setLeaf] = useState<TabletLeaf>('hodierna');
  const [builderScope, setBuilderScope] = useState<AmbitionScope | null>(null);

  // Compute items once when the tablet opens; reset expansion/leaf state.
  // Items are not re-computed while open — no action can change state while
  // this modal is in front.
  useEffect(() => {
    if (agendaVisible) {
      setItems(generateAgenda(useGameStore.getState()));
      setExpanded(false);
      setLeaf('hodierna');
      setBuilderScope(null);
    }
  }, [agendaVisible]);

  // One-shot deep-link (CharacterActionModal's "Manage ambitions" affordance)
  // — same idiom as curiaSubTabRequest. Runs after the effect above so it
  // wins when both fire in the same commit (showAgenda + this request are
  // always called together).
  useEffect(() => {
    if (agendaTabletLeafRequest) {
      setLeaf(agendaTabletLeafRequest);
      requestAgendaTabletLeaf(null);
    }
  }, [agendaTabletLeafRequest]);

  function handleItemPress(item: AgendaItem) {
    if (item.target) {
      requestNavigation(item.target);
    }
    dismissAgenda();
  }

  const displayed = expanded ? items : items.slice(0, TABLET_MAX_ITEMS);
  const overflow  = items.length - TABLET_MAX_ITEMS;

  if (!agendaVisible) return null;

  return (
    <Modal
      visible={agendaVisible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={dismissAgenda}
      />

      {/* Tablet frame + wax surface */}
      <View style={styles.positioner} pointerEvents="box-none">
        <View style={styles.tablet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>EX TABULIS PHILONIS</Text>
            <Text style={styles.headerSub}>
              {makeSeasonLabel(seasonIndex, year)}
            </Text>
          </View>

          {/* Leaf tabs */}
          <View style={styles.leafTabs}>
            <TouchableOpacity
              style={[styles.leafTab, leaf === 'hodierna' && styles.leafTabActive]}
              onPress={() => setLeaf('hodierna')}
              activeOpacity={0.75}
            >
              <Text style={[styles.leafTabText, leaf === 'hodierna' && styles.leafTabTextActive]}>HODIERNA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.leafTab, leaf === 'ambitiones' && styles.leafTabActive]}
              onPress={() => setLeaf('ambitiones')}
              activeOpacity={0.75}
            >
              <Text style={[styles.leafTabText, leaf === 'ambitiones' && styles.leafTabTextActive]}>AMBITIONES</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {leaf === 'hodierna' ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {items.length === 0 ? (
                <Text style={styles.emptyText}>
                  Nothing demands your attention, Domine. A rare season.
                </Text>
              ) : (
                <>
                  {displayed.map(item => (
                    <AgendaItemRow
                      key={item.id}
                      item={item}
                      onPress={() => handleItemPress(item)}
                    />
                  ))}

                  {/* Expand affordance */}
                  {!expanded && overflow > 0 && (
                    <TouchableOpacity
                      style={styles.moreRow}
                      onPress={() => setExpanded(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.moreText}>
                        …and {overflow} more {overflow === 1 ? 'matter' : 'matters'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          ) : (
            <AmbitionesLeaf onOpenBuilder={setBuilderScope} />
          )}

          <View style={styles.divider} />

          {/* Dismiss button */}
          <TouchableOpacity style={styles.dismissBtn} onPress={dismissAgenda}>
            <Text style={styles.dismissText}>Set aside</Text>
          </TouchableOpacity>

        </View>
      </View>

      {builderScope && (
        <AmbitionBuilder
          visible
          scope={builderScope}
          onClose={() => setBuilderScope(null)}
        />
      )}
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  positioner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wooden frame → wax surface
  tablet: {
    width: TABLET_W,
    maxHeight: '80%',
    backgroundColor: COLORS.waxSurface,
    borderWidth: 8,
    borderColor: COLORS.waxFrame,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
    color: COLORS.waxInscription,
    textAlign: 'center',
  },
  headerSub: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    textAlign: 'center',
    marginTop: 3,
  },

  // Leaf tabs
  leafTabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  leafTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  leafTabActive: {
    borderColor: COLORS.waxFrame,
    backgroundColor: COLORS.waxHighlight,
  },
  leafTabText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.waxInscriptionDim,
  },
  leafTabTextActive: {
    color: COLORS.waxInscription,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.waxFrame,
    marginVertical: SPACING.sm,
    opacity: 0.7,
  },

  // Scroll area
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: SPACING.xs,
  },

  // Individual agenda item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.waxFrame,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: FONTS.displayLight,
    fontSize: 13,
    color: COLORS.waxInscription,
    lineHeight: 18,
  },
  itemDetail: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    lineHeight: 15,
    marginTop: 2,
  },

  // Expand row
  moreRow: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  moreText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: COLORS.waxInscriptionDim,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    lineHeight: 20,
  },

  // Dismiss button
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dismissText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.waxInscriptionDim,
    textTransform: 'uppercase',
  },

  // ── Ambitiones leaf ──────────────────────────────────────────────────────
  slotCard: {
    backgroundColor: COLORS.waxHighlight,
    borderWidth: 1,
    borderColor: COLORS.waxFrame,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  slotLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.waxInscriptionDim,
    marginBottom: 4,
  },
  slotTitle: {
    fontFamily: FONTS.displayLight,
    fontSize: 14,
    color: COLORS.waxInscription,
    marginBottom: 6,
  },
  slotMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  slotMuted: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.waxInscriptionDim,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.waxInscriptionDim + '40',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.laurel,
  },
  setBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  setBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.gold,
  },
  abandonBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.crimson,
  },
  abandonBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.crimson,
  },
  dynasticHeading: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.waxInscriptionDim,
    marginBottom: SPACING.xs,
  },
  dynasticRow: {
    marginBottom: SPACING.sm,
  },
  dynasticTitle: {
    fontFamily: FONTS.displayLight,
    fontSize: 12,
    color: COLORS.waxInscription,
    marginBottom: 4,
  },
});
