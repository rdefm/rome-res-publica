import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { OFFICES } from '../data/offices';
import type { OfficeId } from '../models/office';
import type { Character } from '../models/character';
import { calcClanVotesForPlayer } from '../engine/electionEngine';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

// ─── Family member picker ─────────────────────────────────────────────────────

function FamilyMemberPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { family } = useGameStore();
  // Only show characters old enough to hold any office
  const eligible = family.filter(c => c.age >= 25);

  return (
    <View style={fp.container}>
      <Text style={fp.label}>VIEWING</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.row}>
        {eligible.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[fp.pill, selected === c.id && fp.pillActive]}
            onPress={() => onSelect(c.id)}
          >
            <Text style={[fp.pillText, selected === c.id && fp.pillTextActive]}>
              {c.isPlayer ? '⭐ ' : ''}{c.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const fp = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  row: {
    gap: SPACING.sm,
  },
  pill: {
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  pillActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldDim + '22',
  },
  pillText: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  pillTextActive: {
    color: COLORS.gold,
  },
});

// ─── Office rung ──────────────────────────────────────────────────────────────

function OfficeRung({
  officeId,
  character,
}: {
  officeId: OfficeId;
  character: Character;
}) {
  const state = useGameStore();
  const {
    currentOffice, heldOffices, campaigning, campaigningCharacterId,
    declareCampaign, declareFamilyCampaign, useOfficeAction,
  } = state;

  const office = OFFICES.find((o) => o.id === officeId)!;
  const isPlayer = character.isPlayer;

  // For the player, use existing currentOffice / heldOffices
  // For NPCs, use their officeId field
  const isCurrent = isPlayer
    ? currentOffice === officeId
    : character.officeId === officeId;
  const isHeld = isPlayer
    ? heldOffices.includes(officeId)
    : character.officeId === officeId;
  const isCampaigning = campaigning === officeId && campaigningCharacterId === character.id;

  const prereqMet = !office.prerequisite ||
    (isPlayer
      ? (heldOffices.includes(office.prerequisite) || currentOffice === office.prerequisite)
      : character.officeId === office.prerequisite);
  const ageOk = character.age >= office.minAge;
  const noCampaignActive = !campaigning;
  const isEligible = !isCurrent && !isCampaigning && !isHeld && prereqMet && ageOk && noCampaignActive;

  const rungColor = isCurrent ? COLORS.gold
    : isCampaigning ? COLORS.denariiColor
    : isHeld ? COLORS.laurel
    : isEligible ? COLORS.amber
    : COLORS.border;

  function handleDeclare() {
    if (isPlayer) {
      declareCampaign(officeId);
    } else {
      declareFamilyCampaign(character.id, officeId);
    }
  }

  return (
    <ParchmentCard style={[rung.container]} contentStyle={rung.inner}>
      <View style={rung.row}>
        <Text style={rung.icon}>{office.icon}</Text>
        <View style={rung.info}>
          <Text style={rung.name}>{office.name}</Text>
          <Text style={rung.latin}>{office.latin}</Text>
          <Text style={rung.meta}>Min age {office.minAge} · {office.termSeasons} seasons</Text>
        </View>
        {isEligible && (
          <TouchableOpacity style={rung.applyBtn} onPress={handleDeclare}>
            <Text style={rung.applyText}>Apply</Text>
          </TouchableOpacity>
        )}
        {isCurrent && <View style={rung.badge}><Text style={rung.badgeText}>IN OFFICE</Text></View>}
        {isHeld && !isCurrent && <View style={[rung.badge, rung.badgeHeld]}><Text style={rung.badgeText}>HELD</Text></View>}
        {isCampaigning && <View style={[rung.badge, rung.badgeCamp]}><Text style={rung.badgeText}>CAMPAIGN</Text></View>}
      </View>

      {(!isEligible || isCurrent) && <Text style={rung.desc}>{office.desc}</Text>}
      {isEligible && <Text style={rung.desc}>{office.desc}</Text>}

      {/* In-office actions — only for player character */}
      {isCurrent && isPlayer && office.active && office.inOfficeActions && (
        <View style={rung.actions}>
          {office.inOfficeActions.map((action) => {
            const resource = action.resource;
            const canAfford = !resource || (state as any)[resource] >= action.costVal;
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
      {isCurrent && isPlayer && !office.active && (
        <Text style={rung.comingSoon}>{office.inOfficeDesc}</Text>
      )}
    </ParchmentCard>
  );
}

const rung = StyleSheet.create({
  container: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: SPACING.sm },
  info: { flex: 1 },
  inner: { padding: 2 },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  latin: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11 },
  meta: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  applyBtn: { backgroundColor: COLORS.amber + '22', borderWidth: 1, borderColor: COLORS.amber, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  applyText: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 13, fontWeight: '700' },
  badge: { backgroundColor: COLORS.gold + '22', borderWidth: 1, borderColor: COLORS.gold, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  badgeHeld: { backgroundColor: COLORS.laurel + '22', borderColor: COLORS.laurel },
  badgeCamp: { backgroundColor: COLORS.denariiColor + '22', borderColor: COLORS.denariiColor },
  badgeText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  actionBtn: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: PARCHMENT_TEXT.border, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm, minHeight: 44 },
  actionBtnDisabled: { opacity: 0.4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionLabel: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  actionCost: { color: COLORS.gravitasColor, fontFamily: FONTS.ui, fontSize: 11 },
  actionDesc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
  comingSoon: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6 },
});

// ─── Election panel ───────────────────────────────────────────────────────────

function ElectionPanel({ character }: { character: Character }) {
  const state = useGameStore();
  const { campaigning, campaigningCharacterId, electionRivals, seasonIndex, clans } = state;

  if (!campaigning || campaigningCharacterId !== character.id) return null;

  const office = OFFICES.find((o) => o.id === campaigning);
  const seasonsToWinter = (3 - seasonIndex + 4) % 4;

  const { forPlayer: totalFor } = clans.reduce(
    (acc, c) => {
      const { forPlayer, total } = calcClanVotesForPlayer(c.id, state);
      return { forPlayer: acc.forPlayer + forPlayer, total: acc.total + total };
    },
    { forPlayer: 0, total: 0 }
  );

  const candidates = [
    { name: character.name, votes: totalFor, isPlayer: true },
    ...electionRivals.map((r) => ({
      name: r.name,
      votes: Math.round(r.strength * 0.5 + Math.random() * 10),
      isPlayer: false,
    })),
  ].sort((a, b) => b.votes - a.votes);

  const maxVotes = Math.max(...candidates.map((c) => c.votes), 1);

  return (
    <View style={ep.container}>
      <Text style={ep.title}>Campaign: {office?.name}</Text>
      <Text style={ep.candidate}>Candidate: {character.name}</Text>
      {seasonsToWinter === 0 ? (
        <Text style={ep.urgent}>Election resolves this season — End Season to vote.</Text>
      ) : (
        <Text style={ep.countdown}>{seasonsToWinter} season{seasonsToWinter !== 1 ? 's' : ''} until election</Text>
      )}
      {candidates.map((c) => (
        <View key={c.name} style={ep.candidateRow}>
          <Text style={[ep.candidateName, c.isPlayer && { color: COLORS.gold }]} numberOfLines={1}>
            {c.name}
          </Text>
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
  container: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: COLORS.gold, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  candidate: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginBottom: 4 },
  countdown: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginBottom: SPACING.sm },
  urgent: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 12, fontWeight: '700', marginBottom: SPACING.sm },
  candidateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  candidateName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 12, width: 110 },
  voteBarTrack: { flex: 1, height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  voteBarFill: { height: '100%', borderRadius: 4 },
  voteCount: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, width: 30, textAlign: 'right' },
});

// ─── CursusScreen ─────────────────────────────────────────────────────────────

export default function CursusScreen() {
  const { cursusLog, currentOffice, officeSeasons, family } = useGameStore();
  const currentOfficeDef = OFFICES.find((o) => o.id === currentOffice);

  const player = family.find(c => c.isPlayer);
  const [selectedCharId, setSelectedCharId] = useState(player?.id ?? '');
  const selectedChar = family.find(c => c.id === selectedCharId) ?? player;

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

      <FamilyMemberPicker selected={selectedCharId} onSelect={setSelectedCharId} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        {selectedChar && <ElectionPanel character={selectedChar} />}

        <Text style={styles.sectionLabel}>OFFICES</Text>
        {selectedChar && OFFICES.map((office) => (
          <OfficeRung key={office.id} officeId={office.id} character={selectedChar} />
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

      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  flavor: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, marginTop: 3 },
  scroll: { flex: 1, padding: SPACING.md },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm },
  logEntry: { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: SPACING.sm, marginBottom: SPACING.sm },
  logTurn: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10 },
  logText: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontSize: 12 },
});
