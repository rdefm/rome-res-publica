import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { OFFICES } from '../data/offices';
import type { OfficeId } from '../models/office';
import { calcClanVotesForPlayer } from '../engine/electionEngine';
import { generateRivals } from '../engine/electionEngine';
import EndSeasonButton from '../components/shared/EndSeasonButton';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function OfficeRung({ officeId }: { officeId: OfficeId }) {
  const state = useGameStore();
  const {
    currentOffice, heldOffices, campaigning, family,
    declareCampaign, useOfficeAction,
  } = state;

  const office = OFFICES.find((o) => o.id === officeId)!;
  const player = family.find((c) => c.isPlayer);
  const age = player?.age ?? 0;

  const isCurrent = currentOffice === officeId;
  const isHeld = heldOffices.includes(officeId);
  const isCampaigning = campaigning === officeId;
  const prereqMet = !office.prerequisite || heldOffices.includes(office.prerequisite) || currentOffice === office.prerequisite;
  const ageOk = age >= office.minAge;
  const isEligible = !currentOffice && !campaigning && !isHeld && prereqMet && ageOk;

  const rungColor = isCurrent ? COLORS.gold
    : isCampaigning ? COLORS.denariiColor
    : isHeld ? COLORS.laurel
    : isEligible ? '#a07840'
    : COLORS.border;

  return (
    <View style={[rung.container, { borderColor: rungColor }]}>
      <View style={rung.row}>
        <Text style={rung.icon}>{office.icon}</Text>
        <View style={rung.info}>
          <Text style={rung.name}>{office.name}</Text>
          <Text style={rung.latin}>{office.latin}</Text>
          <Text style={rung.meta}>Min age {office.minAge} · {office.termSeasons} seasons</Text>
        </View>
        {isEligible && !isCampaigning && (
          <TouchableOpacity style={rung.applyBtn} onPress={() => declareCampaign(officeId)}>
            <Text style={rung.applyText}>Apply</Text>
          </TouchableOpacity>
        )}
        {isCurrent && <View style={rung.badge}><Text style={rung.badgeText}>IN OFFICE</Text></View>}
        {isHeld && !isCurrent && <View style={[rung.badge, rung.badgeHeld]}><Text style={rung.badgeText}>HELD</Text></View>}
        {isCampaigning && <View style={[rung.badge, rung.badgeCamp]}><Text style={rung.badgeText}>CAMPAIGN</Text></View>}
      </View>
      {!isEligible && !isCurrent && !isHeld && !isCampaigning && (
        <Text style={rung.desc}>{office.desc}</Text>
      )}
      {(isCurrent || isEligible) && <Text style={rung.desc}>{office.desc}</Text>}

      {/* In-office actions */}
      {isCurrent && office.active && office.inOfficeActions && (
        <View style={rung.actions}>
          {office.inOfficeActions.map((action) => {
            const resource = action.resource;
            const canAfford = !resource || state[resource] >= action.costVal;
            return (
              <TouchableOpacity
                key={action.id}
                style={[rung.actionBtn, !canAfford && rung.actionBtnDisabled]}
                disabled={!canAfford}
                onPress={() => useOfficeAction(action.id)}
              >
                <View style={rung.actionRow}>
                  <Text style={rung.actionLabel}>{action.name}</Text>
                  <Text style={rung.actionCost}>{action.cost}</Text>
                </View>
                <Text style={rung.actionDesc}>{action.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isCurrent && !office.active && (
        <Text style={rung.comingSoon}>{office.inOfficeDesc}</Text>
      )}
    </View>
  );
}

const rung = StyleSheet.create({
  container: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: SPACING.sm },
  info: { flex: 1 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  latin: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11 },
  meta: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2 },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  applyBtn: { backgroundColor: '#a07840' + '22', borderWidth: 1, borderColor: '#a07840', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  applyText: { color: '#c9a84c', fontFamily: FONTS.display, fontSize: 13, fontWeight: '700' },
  badge: { backgroundColor: COLORS.gold + '22', borderWidth: 1, borderColor: COLORS.gold, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  badgeHeld: { backgroundColor: COLORS.laurel + '22', borderColor: COLORS.laurel },
  badgeCamp: { backgroundColor: COLORS.denariiColor + '22', borderColor: COLORS.denariiColor },
  badgeText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  actionBtn: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm, minHeight: 44 },
  actionBtnDisabled: { opacity: 0.4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  actionCost: { color: COLORS.gravitasColor, fontFamily: FONTS.ui, fontSize: 11 },
  actionDesc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
  comingSoon: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6 },
});

function ElectionPanel() {
  const state = useGameStore();
  const { campaigning, electionRivals, seasonIndex, clans } = state;
  if (!campaigning) return null;

  const office = OFFICES.find((o) => o.id === campaigning);
  const seasonsToWinter = (3 - seasonIndex + 4) % 4;

  // Calculate projected player votes
  const { forPlayer: totalFor, total: totalVotes } = clans.reduce(
    (acc, c) => {
      const { forPlayer, total } = calcClanVotesForPlayer(c.id, state);
      return { forPlayer: acc.forPlayer + forPlayer, total: acc.total + total };
    },
    { forPlayer: 0, total: 0 }
  );

  const candidates = [
    { name: 'Marcus Brutus', votes: totalFor, isPlayer: true },
    ...electionRivals.map((r) => ({ name: r.name, votes: Math.round(r.strength * 0.5 + Math.random() * 10), isPlayer: false })),
  ].sort((a, b) => b.votes - a.votes);

  const maxVotes = Math.max(...candidates.map((c) => c.votes), 1);

  return (
    <View style={ep.container}>
      <Text style={ep.title}>Campaign: {office?.name}</Text>
      {seasonsToWinter === 0 ? (
        <Text style={ep.urgent}>Election resolves this season — End Season to vote.</Text>
      ) : (
        <Text style={ep.countdown}>{seasonsToWinter} season{seasonsToWinter !== 1 ? 's' : ''} until election (Winter)</Text>
      )}

      {candidates.map((c) => (
        <View key={c.name} style={ep.candidateRow}>
          <Text style={[ep.candidateName, c.isPlayer && { color: COLORS.gold }]} numberOfLines={1}>{c.name}</Text>
          <View style={ep.voteBarTrack}>
            <View style={[ep.voteBarFill, {
              width: `${(c.votes / maxVotes) * 100}%`,
              backgroundColor: c.isPlayer ? COLORS.gold : COLORS.crimson,
            }]} />
          </View>
          <Text style={ep.voteCount}>{c.votes}</Text>
        </View>
      ))}
    </View>
  );
}

const ep = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.gold, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  countdown: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginBottom: SPACING.sm },
  urgent: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 12, fontWeight: '700', marginBottom: SPACING.sm },
  candidateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  candidateName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 12, width: 110 },
  voteBarTrack: { flex: 1, height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  voteBarFill: { height: '100%', borderRadius: 4 },
  voteCount: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, width: 30, textAlign: 'right' },
});

export default function CursusScreen() {
  const { cursusLog, currentOffice, officeSeasons, campaigning } = useGameStore();
  const currentOfficeDef = OFFICES.find((o) => o.id === currentOffice);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        {currentOffice ? (
          <>
            <Text style={styles.title}>{currentOfficeDef?.icon} {currentOfficeDef?.name.toUpperCase()}</Text>
            <Text style={styles.flavor}>{currentOfficeDef?.flavor}</Text>
            <Text style={styles.subtitle}>{officeSeasons} season{officeSeasons !== 1 ? 's' : ''} remaining</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>CURSUS HONORUM</Text>
            <Text style={styles.subtitle}>The Path of Honour</Text>
          </>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        {campaigning && <ElectionPanel />}

        <Text style={styles.sectionLabel}>OFFICES</Text>
        {OFFICES.map((office) => (
          <OfficeRung key={office.id} officeId={office.id} />
        ))}

        {cursusLog.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>POLITICAL RECORD</Text>
            {[...cursusLog].reverse().map((entry) => (
              <View key={entry.id} style={styles.logEntry}>
                <Text style={styles.logTurn}>{entry.turn}</Text>
                <Text style={styles.logText}>{entry.text}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <EndSeasonButton />
      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  flavor: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, marginTop: 3 },
  scroll: { flex: 1, padding: SPACING.md },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm },
  logEntry: { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: SPACING.sm, marginBottom: SPACING.sm },
  logTurn: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10 },
  logText: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 12 },
});
