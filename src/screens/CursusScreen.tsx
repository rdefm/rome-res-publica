import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import type { OfficeId, OfficeAction } from '../models/office';
import type { Character } from '../models/character';
import { calcPlayerElectionScore, calcNpcElectionScore, PLAYER_BASE_SCORE } from '../engine/electionEngine';
import { evaluateGates } from '../engine/officeActionEngine';
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
  row: { gap: SPACING.sm },
  pill: { borderWidth: 1, borderColor: PARCHMENT_TEXT.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  pillActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldDim + '22' },
  pillText: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 12 },
  pillTextActive: { color: COLORS.gold },
});

// ─── Action button ─────────────────────────────────────────────────────────────
// Shared between OfficeRung and TribunePanel.
// Evaluates gates, handles extreme styling, routes to correct store action.

function ActionButton({
  action,
  character,
}: {
  action: OfficeAction;
  character: Character;
}) {
  const state = useGameStore();
  const { useOfficeAction, takeOfficeAction } = state;

  // Gate evaluation — structural requirements (skills, flags, assets, etc.)
  const gateResult = evaluateGates(action, character.id, state as any);

  // Affordability check — legacy cost fields used for display; actual deduction in engine
  const resource = action.resource;
  const canAfford = !resource || (state as any)[resource] >= action.costVal;

  const isLocked = !gateResult.allowed;
  const isDisabled = isLocked || !canAfford;
  const isExtreme = action.isExtreme === true;
  // New-style actions use successEffect; legacy actions use effect function
  const isNewStyle = action.successEffect !== undefined || action.failureEffect !== undefined;

  function handlePress() {
    if (isDisabled) return;
    if (isNewStyle) {
      // Target context (province/leader picker) not yet implemented — pass undefined.
      // Actions requiring PLAYER_CHOSEN_* targets will apply effects but skip
      // those consequences. Target selection UI is planned for a subsequent chunk.
      (takeOfficeAction as any)(action.id, character.id, undefined);
    } else {
      useOfficeAction(action.id);
    }
  }

  const blockedReason = !gateResult.allowed
    ? gateResult.blockedReason
    : !canAfford
      ? `Insufficient ${resource ?? 'resources'}`
      : undefined;

  return (
    <TouchableOpacity
      style={[
        ab.btn,
        isExtreme && ab.btnExtreme,
        isDisabled && ab.btnDisabled,
      ]}
      disabled={isDisabled}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={ab.row}>
        <Text style={[ab.label, isExtreme && ab.labelExtreme]}>
          {isExtreme ? '⚠ EXTREME  ' : ''}{action.name}
        </Text>
        <Text style={ab.cost}>{action.cost}</Text>
      </View>
      <Text style={ab.desc}>{action.desc}</Text>
      {blockedReason !== undefined && (
        <Text style={ab.blocked}>{blockedReason}</Text>
      )}
    </TouchableOpacity>
  );
}

const ab = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
  },
  btnExtreme: {
    backgroundColor: 'rgba(180,60,40,0.18)',
    borderColor: COLORS.crimson + 'aa',
  },
  btnDisabled: { opacity: 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  labelExtreme: { color: COLORS.crimson },
  cost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 11 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
  blocked: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3, fontStyle: 'italic' },
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
    declareCampaign, declareFamilyCampaign, npcConsul, tribuneHolder,
  } = state as any;

  const office = OFFICES.find((o) => o.id === officeId)!;
  const isPlayer = character.isPlayer;

  const isCurrent = isPlayer ? currentOffice === officeId : character.officeId === officeId;
  const isHeld    = isPlayer ? heldOffices.includes(officeId) : character.officeId === officeId;
  const isCampaigning = campaigning === officeId && campaigningCharacterId === character.id;

  const prereqMet = !office.prerequisite ||
    (isPlayer
      ? (heldOffices.includes(office.prerequisite) || currentOffice === office.prerequisite)
      : character.officeId === office.prerequisite);
  const ageOk           = character.age >= office.minAge;
  const noCampaignActive = !campaigning;
  const isEligible = !isCurrent && !isCampaigning && !isHeld && prereqMet && ageOk && noCampaignActive;

  const rungColor = isCurrent ? COLORS.gold
    : isCampaigning ? COLORS.denariiColor
    : isHeld        ? COLORS.laurel
    : isEligible    ? COLORS.amber
    : COLORS.border;

  function handleDeclare() {
    if (isPlayer) declareCampaign(officeId);
    else declareFamilyCampaign(character.id, officeId);
  }

  // Co-consul indicator: shown inside the Consul rung when player holds it
  const showCoConsul = officeId === 'consul' && isCurrent && isPlayer && npcConsul;
  const npcConsulName = npcConsul
    ? (state.clans?.find((c: any) => c.id === npcConsul.clanId)
        ?.leaders?.find((l: any) => l.id === npcConsul.leaderId)?.name
        ?? 'Unknown')
    : '';
  const npcConsulClan = npcConsul
    ? (state.clans?.find((c: any) => c.id === npcConsul.clanId)?.name ?? npcConsul.clanId)
    : '';
  const antagonismLabels = ['cooperative', 'mildly opposed', 'actively hostile', 'openly antagonistic'];

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

      <Text style={rung.desc}>{office.desc}</Text>

      {/* Co-consul indicator (Consul office only) */}
      {showCoConsul && (
        <View style={rung.coConsul}>
          <Text style={rung.coConsulLabel}>CO-CONSUL</Text>
          <Text style={rung.coConsulName}>
            {npcConsulName} ({npcConsulClan})
          </Text>
          <Text style={[
            rung.coConsulAntagonism,
            npcConsul.antagonismLevel >= 2 && rung.coConsulHostile,
          ]}>
            Antagonism: {npcConsul.antagonismLevel}/3
            {' — '}{antagonismLabels[npcConsul.antagonismLevel]}
          </Text>
        </View>
      )}

      {/* In-office actions — only for player character */}
      {isCurrent && isPlayer && office.active && office.inOfficeActions && (
        <View style={rung.actions}>
          {office.inOfficeActions.map((action) => (
            <ActionButton key={action.id} action={action} character={character} />
          ))}
        </View>
      )}
      {isCurrent && isPlayer && !office.active && (
        <Text style={rung.comingSoon}>{office.inOfficeDesc}</Text>
      )}

      {/* Tribune immunity indicator when this character holds Tribune */}
      {character.id === tribuneHolder && (
        <View style={rung.immunityBadge}>
          <Text style={rung.immunityText}>🛡 Sacrosanct — trial immunity active</Text>
        </View>
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
  comingSoon: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6 },
  coConsul: { marginTop: SPACING.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, backgroundColor: 'rgba(200,168,112,0.08)' },
  coConsulLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  coConsulName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  coConsulAntagonism: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  coConsulHostile: { color: COLORS.crimson },
  immunityBadge: { marginTop: SPACING.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5, backgroundColor: 'rgba(80,140,60,0.15)', borderWidth: 1, borderColor: COLORS.laurel + '88', borderRadius: RADIUS.sm },
  immunityText: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.3 },
});

// ─── Tribune panel ─────────────────────────────────────────────────────────────
// Separate from the Cursus ladder — Tribune is a parallel path.

function TribunePanel({ character }: { character: Character }) {
  const state = useGameStore();
  const { tribuneHolder, tribuneImmunity, tribuneSeasonsServed, tribuneCandidateId, family, declareTribuneCandidate, currentOffice } = state as any;

  const isHolder      = tribuneHolder === character.id;
  const isCandidate   = tribuneCandidateId === character.id;
  const someoneElseHolds    = tribuneHolder !== null && tribuneHolder !== character.id;
  const someoneElseRunning  = tribuneCandidateId !== null && tribuneCandidateId !== character.id;
  const holderName    = someoneElseHolds
    ? (family.find((c: Character) => c.id === tribuneHolder)?.name ?? 'Another family member')
    : null;
  const candidateName = someoneElseRunning
    ? (family.find((c: Character) => c.id === tribuneCandidateId)?.name ?? 'Another family member')
    : null;

  // Eligibility: age ok, not already in any office (player uses currentOffice; others use officeId)
  const ageOk         = character.age >= 30;
  const noOtherOffice = character.officeId === null &&
    !(character.isPlayer && currentOffice !== null);
  const tribuneFree   = tribuneHolder === null && tribuneCandidateId === null;
  const isEligible    = ageOk && noOtherOffice && tribuneFree && !isHolder && !isCandidate;

  const seasonsLeft = isHolder ? Math.max(0, 4 - (tribuneSeasonsServed ?? 0)) : 0;

  return (
    <ParchmentCard style={[tp.container]} contentStyle={tp.inner}>
      <View style={tp.header}>
        <Text style={tp.icon}>✊</Text>
        <View style={tp.info}>
          <Text style={tp.name}>Tribune of the Plebs</Text>
          <Text style={tp.latin}>Tribunus Plebis · Parallel Path</Text>
        </View>
        {isHolder && (
          <View style={tp.badge}><Text style={tp.badgeText}>IN OFFICE</Text></View>
        )}
        {isCandidate && (
          <View style={[tp.badge, tp.badgePending]}><Text style={tp.badgeText}>CANDIDACY</Text></View>
        )}
      </View>

      <Text style={tp.desc}>
        Sacred defender of the plebeian people. Not a rung on the Cursus Honorum —
        a separate office that can be held alongside (or instead of) the normal ladder.
      </Text>

      {/* Current holder view */}
      {isHolder && (
        <>
          <View style={tp.immunity}>
            <Text style={tp.immunityText}>🛡 Sacrosanct — trial immunity active</Text>
            <Text style={tp.seasonsLeft}>{seasonsLeft} season{seasonsLeft !== 1 ? 's' : ''} remaining</Text>
          </View>
          <View style={tp.actions}>
            {TRIBUNE_OFFICE.inOfficeActions?.map(action => (
              <ActionButton key={action.id} action={action} character={character} />
            ))}
          </View>
        </>
      )}

      {/* Pending candidacy view — this character is waiting on the election */}
      {isCandidate && (
        <View style={tp.pending}>
          <Text style={tp.pendingText}>
            ⏳ Candidacy declared — the Concilium Plebis votes at next season end.
          </Text>
          <Text style={tp.pendingSub}>
            Success chance increases with Plebs mood and Populares standing.
          </Text>
        </View>
      )}

      {/* Another family member already holds Tribune */}
      {someoneElseHolds && (
        <Text style={tp.occupied}>{holderName} is serving as Tribune this term.</Text>
      )}

      {/* Another family member is running */}
      {someoneElseRunning && !someoneElseHolds && (
        <Text style={tp.occupied}>{candidateName} has declared candidacy for Tribune.</Text>
      )}

      {/* Eligible to declare */}
      {isEligible && (
        <TouchableOpacity
          style={tp.declareBtn}
          onPress={() => declareTribuneCandidate(character.id)}
        >
          <Text style={tp.declareBtnText}>Declare Candidacy</Text>
          <Text style={tp.declareBtnSub}>Min age 30 · Election resolves next season end</Text>
        </TouchableOpacity>
      )}

      {/* Not eligible — show reason */}
      {!isHolder && !isCandidate && !someoneElseHolds && !someoneElseRunning && !isEligible && (
        <Text style={tp.ineligible}>
          {!ageOk
            ? `Minimum age 30 (current: ${character.age})`
            : !noOtherOffice
              ? `${character.name} already holds an office`
              : 'Not currently available'}
        </Text>
      )}
    </ParchmentCard>
  );
}

const tp = StyleSheet.create({
  container: { marginBottom: SPACING.sm },
  inner: { padding: 2 },
  header: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: SPACING.sm },
  info: { flex: 1 },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  latin: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  badge: { backgroundColor: COLORS.gold + '22', borderWidth: 1, borderColor: COLORS.gold, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  badgePending: { backgroundColor: COLORS.amber + '22', borderColor: COLORS.amber },
  badgeText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  immunity: { marginTop: SPACING.sm, padding: SPACING.sm, backgroundColor: 'rgba(80,140,60,0.12)', borderWidth: 1, borderColor: COLORS.laurel + '88', borderRadius: RADIUS.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  immunityText: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 11 },
  seasonsLeft: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10 },
  actions: { marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  pending: { marginTop: SPACING.sm, padding: SPACING.sm, backgroundColor: COLORS.amber + '18', borderWidth: 1, borderColor: COLORS.amber + '88', borderRadius: RADIUS.sm },
  pendingText: { color: COLORS.amber, fontFamily: FONTS.display, fontSize: 12, fontWeight: '600' },
  pendingSub: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3 },
  occupied: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: SPACING.sm },
  declareBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.amber + '22', borderWidth: 1, borderColor: COLORS.amber, borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center' },
  declareBtnText: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700' },
  declareBtnSub: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2 },
  ineligible: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: SPACING.sm, opacity: 0.7 },
});

// ─── Election panel ───────────────────────────────────────────────────────────

function ElectionPanel({ character }: { character: Character }) {
  const state = useGameStore();
  const { campaigning, campaigningCharacterId, electionRivals, seasonIndex, clans } = state;

  if (!campaigning || campaigningCharacterId !== character.id) return null;

  const office          = OFFICES.find((o) => o.id === campaigning);
  const seats           = office?.seats ?? 1;
  const seasonsToWinter = (3 - seasonIndex + 4) % 4;
  const playerScore     = calcPlayerElectionScore(state);

  const clanInfluenceMap = Object.fromEntries(clans.map(c => [c.id, c.influence]));

  const candidates = [
    {
      name:          character.name,
      subtitle:      `Base ${PLAYER_BASE_SCORE} + clients + canvassed`,
      votes:         playerScore,
      isPlayer:      true,
      highestOffice: null as string | null,
    },
    ...electionRivals.map((r) => ({
      name:     r.name,
      subtitle: r.highestOffice
        ? `Ex-${r.highestOffice.charAt(0).toUpperCase() + r.highestOffice.slice(1)} · ${r.clanName}`
        : r.clanName,
      votes:    r.strength,
      isPlayer: false,
      highestOffice: r.highestOffice,
    })),
  ].sort((a, b) => b.votes - a.votes);

  const maxVotes     = Math.max(...candidates.map((c) => c.votes), 1);
  const playerRank   = candidates.findIndex(c => c.isPlayer) + 1;
  const onTrackToWin = playerRank <= seats;

  return (
    <View style={ep.container}>
      <Text style={ep.title}>Campaign: {office?.name}</Text>
      <Text style={ep.candidate}>Candidate: {character.name}</Text>

      <View style={ep.seatsRow}>
        <Text style={ep.seatsLabel}>{seats} seat{seats !== 1 ? 's' : ''} available</Text>
        <Text style={[ep.rankBadge, onTrackToWin ? ep.rankBadgeWin : ep.rankBadgeLose]}>
          {onTrackToWin ? `✓ Est. #${playerRank}` : `✗ Est. #${playerRank}`}
        </Text>
      </View>

      {seasonsToWinter === 0 ? (
        <Text style={ep.urgent}>Election resolves this season — End Season to vote.</Text>
      ) : (
        <Text style={ep.countdown}>{seasonsToWinter} season{seasonsToWinter !== 1 ? 's' : ''} until election</Text>
      )}

      {candidates.map((c, i) => {
        const inWinningZone = i < seats;
        const barColor = c.isPlayer
          ? (inWinningZone ? COLORS.gold : COLORS.amber)
          : (inWinningZone ? COLORS.laurel : COLORS.crimson);

        return (
          <React.Fragment key={c.name}>
            {i === seats && (
              <View style={ep.seatDivider}>
                <View style={ep.seatDividerLine} />
                <Text style={ep.seatDividerLabel}>— winning threshold —</Text>
                <View style={ep.seatDividerLine} />
              </View>
            )}
            <View style={ep.candidateRow}>
              <View style={ep.candidateInfo}>
                <Text style={[ep.candidateName, c.isPlayer && { color: COLORS.gold }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={ep.candidateClan} numberOfLines={1}>{c.subtitle}</Text>
              </View>
              <View style={ep.voteBarTrack}>
                <View style={[ep.voteBarFill, {
                  width: `${(c.votes / maxVotes) * 100}%` as any,
                  backgroundColor: barColor,
                }]} />
              </View>
              <Text style={ep.voteCount}>{c.votes}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const ep = StyleSheet.create({
  container: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: COLORS.gold, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  candidate: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginBottom: 4 },
  seatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  seatsLabel: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 0.3 },
  rankBadge: { fontFamily: FONTS.display, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rankBadgeWin: { color: COLORS.laurel, backgroundColor: 'rgba(80,140,60,0.2)' },
  rankBadgeLose: { color: COLORS.crimson, backgroundColor: 'rgba(160,40,40,0.2)' },
  countdown: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, marginBottom: SPACING.sm },
  urgent: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 12, fontWeight: '700', marginBottom: SPACING.sm },
  candidateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  candidateInfo: { width: 110 },
  candidateName: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 12 },
  candidateClan: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.3 },
  voteBarTrack: { flex: 1, height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  voteBarFill: { height: '100%', borderRadius: 4 },
  voteCount: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11, width: 30, textAlign: 'right' },
  seatDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  seatDividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  seatDividerLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 8, letterSpacing: 0.5, marginHorizontal: 4 },
});

// ─── Office action result modal ───────────────────────────────────────────────

function OfficeActionResultModal() {
  const { lastOfficeActionResult, clearOfficeActionResult } = useGameStore() as any;
  const result = lastOfficeActionResult as { actionName: string; text: string } | null;

  return (
    <Modal
      visible={result !== null}
      transparent
      animationType="fade"
      onRequestClose={clearOfficeActionResult}
    >
      <Pressable style={orm.backdrop} onPress={clearOfficeActionResult}>
        <Pressable style={orm.card} onPress={() => {}}>
          {/* Prevent backdrop tap from propagating through the card */}
          <Text style={orm.actionName}>{result?.actionName ?? ''}</Text>
          <View style={orm.divider} />
          <Text style={orm.text}>{result?.text ?? ''}</Text>
          <TouchableOpacity style={orm.btn} onPress={clearOfficeActionResult}>
            <Text style={orm.btnText}>Understood</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const orm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#1e1a12',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  },
  actionName: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  text: {
    color: PARCHMENT_TEXT.heading,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: SPACING.lg,
  },
  btn: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  btnText: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '700',
  },
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

        {/* Tribune section — parallel path, separate from the ladder */}
        <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>TRIBUNE OF THE PLEBS</Text>
        {selectedChar && <TribunePanel character={selectedChar} />}

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
      <OfficeActionResultModal />
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
