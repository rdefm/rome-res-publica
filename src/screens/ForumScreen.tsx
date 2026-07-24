import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, ViewStyle, TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ClanCard from '../components/forum/ClanCard';
import PatronLadderPanel from '../components/forum/PatronLadderPanel';
import DossierPanel from '../components/forum/DossierPanel';
import { COLORS, FONTS, SPACING, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT, RADIUS } from '../utils/theme';
import { OFFICES } from '../data/offices';
import {
  calcPlayerElectionScore,
  calcOfficeThreshold,
  CANVASS_FIDES_COST,
  CANVASS_MIN_RELATIONSHIP,
} from '../engine/electionEngine';
import type { CanvassingEvent } from '../data/canvassingEvents';

// ─── Canvassing Event Modal ───────────────────────────────────────────────────

function CanvassingEventModal({ event }: { event: CanvassingEvent }) {
  const { fides, denarii, resolveCanvassingEvent } = useGameStore(s => ({
    fides: s.fides,
    denarii: s.denarii,
    resolveCanvassingEvent: s.resolveCanvassingEvent,
  }));

  return (
    <Modal visible transparent animationType="fade">
      <View style={cev.overlay}>
        <View style={cev.card}>
          <Text style={cev.title}>{event.title}</Text>
          <Text style={cev.description}>{event.description}</Text>

          <View style={cev.divider} />

          {event.options.map(opt => {
            const cantAfford =
              (opt.cost?.resource === 'fides'   && fides   < opt.cost.amount) ||
              (opt.cost?.resource === 'denarii' && denarii < opt.cost.amount);

            let tagLine = '';
            if (opt.cost?.resource === 'denarii') tagLine = `−${opt.cost.amount} Denarii`;
            else if (opt.cost?.resource === 'fides') tagLine = `−${opt.cost.amount} Fides`;
            else if (opt.skillCheck) tagLine = 'Rhetoric check';
            if (opt.immediateSuccess) tagLine += tagLine ? ' · Immediate success' : 'Immediate success';

            return (
              <TouchableOpacity
                key={opt.id}
                style={[cev.optBtn, cantAfford && cev.optBtnDisabled]}
                onPress={() => resolveCanvassingEvent(opt.id)}
                disabled={cantAfford}
                activeOpacity={0.75}
              >
                <Text style={[cev.optLabel, cantAfford && cev.optLabelDisabled]}>
                  {opt.label}
                </Text>
                {tagLine !== '' && (
                  <Text style={cev.optTag}>{tagLine}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const cev = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,
  card: {
    backgroundColor: '#1e1a14',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  } as ViewStyle,
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  } as TextStyle,
  description: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
  } as TextStyle,
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  } as ViewStyle,
  optBtn: {
    backgroundColor: '#2a2318',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,
  optBtnDisabled: { opacity: 0.4 } as ViewStyle,
  optLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  optLabelDisabled: { color: COLORS.dust } as TextStyle,
  optTag: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.3,
  } as TextStyle,
});

// ─── Canvassing Panel ─────────────────────────────────────────────────────────

function CanvassingPanel() {
  const state = useGameStore();
  const {
    clans, campaigning, electionRivals, campaignVotes, fides, family, canvassLeader,
  } = state;

  if (!campaigning) return null;

  const office   = OFFICES.find(o => o.id === campaigning);
  const threshold = calcOfficeThreshold(campaigning);
  const playerScore = calcPlayerElectionScore(state);
  const playerChar  = family.find(c => c.isPlayer);
  const rhetoric    = playerChar?.skills.rhetoric ?? 0;

  // All individual leaders across all clans
  const allLeaders = clans.flatMap(clan =>
    clan.leaders.map(l => ({ ...l, clanId: clan.id, clanName: clan.name }))
  );

  return (
    <View style={cp.container}>
      {/* Header */}
      <Text style={cp.heading}>CANVASSING — {office?.name?.toUpperCase()}</Text>
      <View style={cp.statsRow}>
        <Text style={cp.stat}>Your score: <Text style={cp.statVal}>{playerScore}</Text></Text>
        <Text style={cp.stat}>Roll needed: <Text style={cp.statVal}>{threshold}</Text></Text>
        <Text style={cp.stat}>Rhetoric: <Text style={cp.statVal}>{rhetoric}</Text></Text>
      </View>
      <Text style={cp.hint}>
        Each canvass costs {CANVASS_FIDES_COST} Fides. Minimum standing with a senator: {CANVASS_MIN_RELATIONSHIP}.
        Senators whose gens fields a rival candidate require double the roll.
      </Text>

      {/* Leader list */}
      {allLeaders.map(leader => {
        const pledged      = campaignVotes[leader.id] === 'for';
        const tooLowRel    = leader.relationship < CANVASS_MIN_RELATIONSHIP;
        const noFides      = fides < CANVASS_FIDES_COST;
        const clanHasRival = electionRivals.some(r => r.clanId === leader.clanId);
        const canCanvass   = !pledged && !tooLowRel && !noFides;

        let btnLabel = `Canvass (${CANVASS_FIDES_COST} Fides)`;
        if (pledged)      btnLabel = '✓ Pledged';
        else if (tooLowRel) btnLabel = 'Insufficient standing';
        else if (noFides)   btnLabel = 'Not enough Fides';

        return (
          <View key={leader.id} style={cp.leaderRow}>
            <View style={cp.leaderInfo}>
              <Text style={cp.leaderName}>{leader.name}</Text>
              <Text style={cp.leaderMeta}>
                {leader.clanName} · {leader.title}
              </Text>
              {clanHasRival && (
                <Text style={cp.rivalWarning}>⚠ Rival candidate — needs {threshold * 2} roll</Text>
              )}
            </View>
            <View style={cp.leaderRight}>
              <Text style={[
                cp.relScore,
                leader.relationship >= CANVASS_MIN_RELATIONSHIP ? cp.relOk : cp.relLow,
              ]}>
                {leader.relationship >= 0 ? '+' : ''}{leader.relationship}
              </Text>
              <TouchableOpacity
                style={[cp.canvassBtn, (!canCanvass || pledged) && cp.canvassBtnDisabled]}
                onPress={() => canvassLeader(leader.id)}
                disabled={!canCanvass}
                activeOpacity={0.75}
              >
                <Text style={[
                  cp.canvassBtnText,
                  pledged && cp.canvassBtnTextPledged,
                  (!canCanvass && !pledged) && cp.canvassBtnTextDisabled,
                ]}>
                  {btnLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const cp = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(200,168,112,0.10)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  } as ViewStyle,
  heading: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  } as TextStyle,
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  } as ViewStyle,
  stat: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.3,
  } as TextStyle,
  statVal: {
    color: COLORS.marble,
    fontWeight: '700',
  } as TextStyle,
  hint: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xs,
  } as TextStyle,
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  } as ViewStyle,
  leaderInfo: { flex: 1 } as ViewStyle,
  leaderName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  leaderMeta: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.3,
    marginTop: 1,
  } as TextStyle,
  rivalWarning: {
    color: COLORS.amber,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  } as TextStyle,
  leaderRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  } as ViewStyle,
  relScore: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,
  relOk:  { color: COLORS.laurel } as TextStyle,
  relLow: { color: COLORS.crimson } as TextStyle,
  canvassBtn: {
    backgroundColor: '#2a2318',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  } as ViewStyle,
  canvassBtnDisabled: {
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  } as ViewStyle,
  canvassBtnText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,
  canvassBtnTextPledged: { color: COLORS.laurel } as TextStyle,
  canvassBtnTextDisabled: { color: COLORS.dust } as TextStyle,
});

// ─── ForumScreen ──────────────────────────────────────────────────────────────

export default function ForumScreen() {
  const { clans, campaigning, activeCanvassingEvent } = useGameStore(s => ({
    clans: s.clans,
    campaigning: s.campaigning,
    activeCanvassingEvent: s.activeCanvassingEvent,
  }));

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>FORUM</Text>
        <Text style={styles.subtitle}>
          {campaigning ? `Campaign Active — Canvass for Votes` : 'Clans & Political Alliances'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        <PatronLadderPanel />

        {/* Phase 4, Chunk P4-B — self-hides when there's nothing to show */}
        <DossierPanel />

        {/* Canvassing section — only visible during a campaign */}
        {campaigning && <CanvassingPanel />}

        <Text style={styles.sectionLabel}>GENTES — CLAN DIRECTORY</Text>
        <Text style={styles.intro}>
          Each clan is led by individual men of influence. Build relationships with them personally to
          shift their votes and allegiance.
        </Text>
        {clans.map((clan) => (
          <ClanCard key={clan.id} clan={clan} />
        ))}
      </ScrollView>

      {/* Canvassing event modal — overlays everything when an event fires */}
      {activeCanvassingEvent && (
        <CanvassingEventModal event={activeCanvassingEvent} />
      )}

      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  scroll: { flex: 1, padding: SPACING.md },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  intro: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
});
