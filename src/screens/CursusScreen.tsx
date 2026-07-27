import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import type { GameState } from '../state/gameStore';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import type { Character } from '../models/character';
import { calcPlayerElectionScore, calcNpcElectionScore, PLAYER_BASE_SCORE } from '../engine/electionEngine';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import CandidateHeader from '../components/cursus/CandidateHeader';
import OfficeCard from '../components/cursus/OfficeCard';
import OfficeActionsModal from '../components/cursus/OfficeActionsModal';
import ActionButton from '../components/cursus/ActionButton';
import StatusSeal from '../components/shared/StatusSeal';
import type { OfficeStatus } from '../engine/officeStatus';
import FrescoBackground from '../components/shared/FrescoBackground';
import GildedPanel from '../components/shared/GildedPanel';
import PortraitRoundel from '../components/shared/PortraitRoundel';
import { characterPortraitSubject, leaderPortraitSubject } from '../engine/portraitEngine';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import InfoTap from '../components/shared/InfoTap';
import { remeasureAllTargets } from '../engine/tutorialTargets';

// ─── Action button + Office card ───────────────────────────────────────────────
// Chunk C4 of cursus-visual-redesign-plan.md — both extracted to
// components/cursus/ (ActionButton.tsx, OfficeCard.tsx). ActionButton is
// still used directly below by TribunePanel; OfficeCard replaces the old
// inline OfficeRung (per-character status via engine/officeStatus.ts, a
// StatusSeal, and a whole-card tap that opens OfficeActionsModal instead of
// the old always-inline action list).

// ─── Tribune panel ─────────────────────────────────────────────────────────────
// Separate from the Cursus ladder — Tribune is a parallel path.

function TribunePanel({ character }: { character: Character }) {
  const state = useGameStore();
  const { tribuneHolder, tribuneImmunity, tribuneSeasonsServed, tribuneCandidateId, family, declareTribuneCandidate, currentOffice } = state as any;
  const [modalOpen, setModalOpen] = useState(false);

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

  // Chunk G of cursustabuifixesplan.md — TribuneStatus equivalent to
  // engine/officeStatus.ts's OfficeStatus (Tribune isn't on the ladder that
  // engine tracks, so there's no getOfficeStatus() call to reuse here; this
  // mirrors its {status, reason} shape from the eligibility booleans above).
  let tribuneStatus: OfficeStatus;
  let tribuneReason: string | undefined;
  if (isHolder) {
    tribuneStatus = 'held';
  } else if (isCandidate) {
    tribuneStatus = 'active';
  } else if (isEligible) {
    tribuneStatus = 'eligible';
  } else {
    tribuneStatus = 'locked';
    tribuneReason = someoneElseHolds
      ? `Held by ${holderName}`
      : someoneElseRunning
        ? `${candidateName} running`
        : !ageOk
          ? 'Min age 30'
          : !noOtherOffice
            ? 'Already holds an office'
            : undefined;
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setModalOpen(true)}>
        <ParchmentCard style={tp.container} contentStyle={tp.inner}>
          <View style={tp.header}>
            <Text style={tp.icon}>✊</Text>
            <View style={tp.info}>
              <InfoTap termId="tribune">
                <Text style={tp.name}>Tribune of the Plebs</Text>
              </InfoTap>
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

          {/* Chunk G — same tapHint-left/StatusSeal-right layout as OfficeCard
              (Chunk F), bringing Tribune to parity with the ladder offices. */}
          <View style={tp.sealRow}>
            <Text style={tp.tapHint}>Tap for powers ›</Text>
            <StatusSeal status={tribuneStatus} reason={tribuneReason} />
          </View>

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
      </TouchableOpacity>

      <OfficeActionsModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        office={TRIBUNE_OFFICE}
        character={character}
        status={tribuneStatus}
      />
    </>
  );
}

const tp = StyleSheet.create({
  container: { marginBottom: SPACING.sm },
  inner: { padding: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: SPACING.sm },
  info: { flex: 1 },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  latin: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 6, lineHeight: 16 },
  // Chunk G — same values as OfficeCard.tsx's rung.sealRow/rung.tapHint.
  sealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  tapHint: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.3, opacity: 0.8 },
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
  // QA Audit Fix Plan, Chunk A — was `const state = useGameStore();`, a
  // full-store subscription re-rendering this panel on every write anywhere
  // in the app. Field-level selectors instead; calcPlayerElectionScore only
  // ever reads clients/clans/campaignVotes off the state object it's given
  // (electionEngine.ts), so those three are selected separately and passed
  // as a minimal stand-in rather than widening the engine's own signature.
  const campaigning = useGameStore(s => s.campaigning);
  const campaigningCharacterId = useGameStore(s => s.campaigningCharacterId);
  const electionRivals = useGameStore(s => s.electionRivals);
  const seasonIndex = useGameStore(s => s.seasonIndex);
  const clans = useGameStore(s => s.clans);
  const clients = useGameStore(s => s.clients);
  const campaignVotes = useGameStore(s => s.campaignVotes);

  if (!campaigning || campaigningCharacterId !== character.id) return null;

  const office          = OFFICES.find((o) => o.id === campaigning);
  const seats           = office?.seats ?? 1;
  const seasonsToWinter = (3 - seasonIndex + 4) % 4;
  const playerScore     = calcPlayerElectionScore({ clients, clans, campaignVotes } as unknown as GameState);

  const leaderById = new Map(clans.flatMap(c => c.leaders.map(l => [l.id, l] as const)));

  const candidates = [
    {
      name:     character.name,
      subtitle: `Base ${PLAYER_BASE_SCORE} + clients + canvassed`,
      votes:    playerScore,
      isPlayer: true,
      subject:  characterPortraitSubject(character),
    },
    ...electionRivals.map((r) => ({
      name:     r.name,
      subtitle: r.highestOffice
        ? `Ex-${r.highestOffice.charAt(0).toUpperCase() + r.highestOffice.slice(1)} · ${r.clanName}`
        : r.clanName,
      votes:    r.strength,
      isPlayer: false,
      // electionRivals carries id+clanId back to the real ClanLeader (electionEngine.generateRivals) —
      // age isn't on ElectionRival itself, so look the leader up for the portrait's age band.
      subject:  leaderPortraitSubject(leaderById.get(r.id) ?? { id: r.id, name: r.name, age: 40 }, r.clanId),
    })),
  ].sort((a, b) => b.votes - a.votes);

  const maxVotes     = Math.max(...candidates.map((c) => c.votes), 1);
  const playerRank   = candidates.findIndex(c => c.isPlayer) + 1;
  const onTrackToWin = playerRank <= seats;

  return (
    <GildedPanel style={ep.panel}>
      <View style={ep.titleRow}>
        <Text style={ep.title} numberOfLines={1}>CAMPAIGN: {office?.name?.toUpperCase()}</Text>
        <Text style={[ep.rankBadge, onTrackToWin ? ep.rankBadgeWin : ep.rankBadgeLose]}>
          {onTrackToWin ? `✓ Est. #${playerRank}` : `✗ Est. #${playerRank}`}
        </Text>
      </View>

      <View style={ep.metaRow}>
        <Text style={ep.metaText}>
          {seasonsToWinter === 0 ? '⏳ Election resolves this season' : `⏳ ${seasonsToWinter} Season${seasonsToWinter !== 1 ? 's' : ''} Remaining`}
        </Text>
        <Text style={ep.metaDot}>·</Text>
        <Text style={ep.metaText}>{seats} Seat{seats !== 1 ? 's' : ''} Available</Text>
      </View>

      <Text style={ep.subheader}>Live Polling Standings</Text>

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
              <PortraitRoundel subject={c.subject} size={32} frame={c.isPlayer ? 'gold' : 'plain'} />
              <View style={ep.candidateInfo}>
                <Text style={[ep.candidateName, c.isPlayer && { color: COLORS.gold }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={ep.candidateClan} numberOfLines={1}>{c.subtitle}</Text>
              </View>
              <View style={ep.voteBarTrack}>
                <View style={[ep.voteBarFill, {
                  width: `${(c.votes / maxVotes) * 100}%`,
                  backgroundColor: barColor,
                }]} />
              </View>
              <Text style={ep.voteCount}>{c.votes}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </GildedPanel>
  );
}

const ep = StyleSheet.create({
  panel: { marginBottom: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  title: { flex: 1, color: COLORS.gold, fontFamily: FONTS.display, fontSize: 15, letterSpacing: 0.5, fontWeight: '700', marginRight: SPACING.sm },
  rankBadge: { fontFamily: FONTS.display, fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rankBadgeWin: { color: COLORS.laurel, backgroundColor: 'rgba(80,140,60,0.2)' },
  rankBadgeLose: { color: COLORS.crimson, backgroundColor: 'rgba(160,40,40,0.2)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  metaText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  metaDot: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginHorizontal: 5 },
  subheader: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.sm },
  candidateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: SPACING.sm },
  candidateInfo: { width: 100 },
  candidateName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 12 },
  candidateClan: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.3 },
  voteBarTrack: { flex: 1, height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  voteBarFill: { height: '100%', borderRadius: 3 },
  voteCount: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, width: 30, textAlign: 'right' },
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
    // FrescoBackground is the outermost element (mirrors DomusScreen's own
    // ImageBackground-then-SafeAreaView pattern) — padding for the resource
    // bar goes on ITS style prop, not on the SafeAreaView, so the image/scrim
    // still render edge-to-edge behind the resource bar while the actual
    // content (header/CandidateHeader/ScrollView) gets pushed down below it.
    <FrescoBackground style={styles.frescoRoot}>
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

        <CandidateHeader selected={selectedCharId} onSelect={setSelectedCharId} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}
          onScrollEndDrag={remeasureAllTargets}
          onMomentumScrollEnd={remeasureAllTargets}
        >
          {selectedChar && <ElectionPanel character={selectedChar} />}

          <Text style={styles.sectionLabel}>OFFICES</Text>
          {selectedChar && OFFICES.map((office) => (
            <OfficeCard key={office.id} officeId={office.id} character={selectedChar} />
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
    </FrescoBackground>
  );
}

const styles = StyleSheet.create({
  // Chunk C5 fix — paddingTop lives here (FrescoBackground's own root),
  // NOT on the SafeAreaView below: this is what lets the fresco image/scrim
  // render edge-to-edge behind the resource bar (absolute-fill is unaffected
  // by its own container's padding) while everything else still gets pushed
  // down below it. Matches DomusScreen's ImageBackground/SafeAreaView split.
  frescoRoot: { flex: 1, paddingTop: RESOURCE_BAR_HEIGHT },
  // No backgroundColor here (matches DomusScreen's own unstyled `safeArea`)
  // — an opaque fill here would paint over FrescoBackground's image/scrim
  // for this entire box, leaving only the thin strip above it (behind the
  // resource bar) actually showing the fresco. FrescoBackground already
  // supplies its own COLORS.bg fallback when no asset is present, so
  // nothing is lost in that case either.
  screen: { flex: 1 },
  // Chunk C5 — floats directly over FrescoBackground, no panel/border behind it
  // (matches DomusScreen's own "header floats over the fresco" precedent);
  // the scrim (FrescoBackground's own gradient) carries legibility instead.
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Chunk H of cursustabuifixesplan.md — flavor sits directly in the header,
  // over the fresco with no card behind it (same as title/subtitle above),
  // but never got their textShadow treatment; PARCHMENT_TEXT.heading is a
  // dark-brown token meant for use inside a light parchment card, so
  // without a shadow it's nearly unreadable against the fresco's darker
  // regions — same root cause as sectionLabel below.
  flavor: {
    color: PARCHMENT_TEXT.heading,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  scroll: { flex: 1, padding: SPACING.md },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logEntry: { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: SPACING.sm, marginBottom: SPACING.sm },
  // logEntry has no background — its border-strip rows sit directly on the
  // fresco (same as flavor/sectionLabel above), audited per Chunk H step 3.
  logTurn: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logText: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.body,
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
