import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGameStore } from '../state/gameStore';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import type { Character } from '../models/character';
import { calcPlayerElectionScore, calcNpcElectionScore, PLAYER_BASE_SCORE } from '../engine/electionEngine';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import BasilicaSheet from '../components/cursus/BasilicaSheet';
import CandidateHeader from '../components/cursus/CandidateHeader';
import OfficeCard from '../components/cursus/OfficeCard';
import ActionButton from '../components/cursus/ActionButton';
import GildedPanel from '../components/shared/GildedPanel';
import PortraitRoundel from '../components/shared/PortraitRoundel';
import { characterPortraitSubject, leaderPortraitSubject } from '../engine/portraitEngine';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import InfoTap from '../components/shared/InfoTap';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const BASILICA_SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

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
                  width: `${(c.votes / maxVotes) * 100}%` as any,
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

  // ── The Basilica (Phase 4, Chunk P4-D) — full-screen sheet, opened from
  // CuriaScreen's TrialBanner (requestNavigation) or an agenda deep-link.
  // Mirrors ProvinciaeScreen's Animated/PanResponder drag-sheet shell.
  const navigation = useNavigation();
  const selectedTrialId = useGameStore(s => s.selectedTrialId);
  const selectTrialForBasilica = useGameStore(s => s.selectTrialForBasilica);
  const basilicaReturnTab = useGameStore(s => s.basilicaReturnTab);
  const setBasilicaReturnTab = useGameStore(s => s.setBasilicaReturnTab);
  const [basilicaTrialId, setBasilicaTrialId] = useState<string | null>(null);
  const basilicaAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const basilicaVisible = basilicaTrialId !== null;

  function openBasilica(trialId: string) {
    setBasilicaTrialId(trialId);
    Animated.spring(basilicaAnim, {
      toValue: SCREEN_HEIGHT - BASILICA_SHEET_HEIGHT,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closeBasilica() {
    Animated.timing(basilicaAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      setBasilicaTrialId(null);
      // Send the player back to whichever tab they were actually on before
      // a deep-link (e.g. CuriaScreen's "Open the Basilica" button) switched
      // them to Cursus — otherwise closing the sheet just stranded them
      // here. null (they were already on Cursus) means stay put.
      if (basilicaReturnTab) {
        navigation.navigate(basilicaReturnTab as never);
        setBasilicaReturnTab(null);
      }
    });
  }

  useEffect(() => {
    if (selectedTrialId) {
      openBasilica(selectedTrialId);
      selectTrialForBasilica(null);
    }
  }, [selectedTrialId]);

  const basilicaPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          basilicaAnim.setValue(SCREEN_HEIGHT - BASILICA_SHEET_HEIGHT + gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeBasilica();
        } else {
          Animated.spring(basilicaAnim, {
            toValue: SCREEN_HEIGHT - BASILICA_SHEET_HEIGHT,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

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

      <CandidateHeader selected={selectedCharId} onSelect={setSelectedCharId} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
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

      {basilicaVisible && basilicaTrialId && (
        <>
          <Animated.View
            style={[
              cs.scrim,
              {
                opacity: basilicaAnim.interpolate({
                  inputRange: [SCREEN_HEIGHT - BASILICA_SHEET_HEIGHT, SCREEN_HEIGHT],
                  outputRange: [0.5, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
            // @ts-ignore
            pointerEvents="none"
          />
          <Animated.View
            style={[cs.sheetContainer, { top: basilicaAnim }]}
            {...basilicaPanResponder.panHandlers}
          >
            <BasilicaSheet trialId={basilicaTrialId} onClose={closeBasilica} />
          </Animated.View>
        </>
      )}

      <SeasonOverlay />
      <OfficeActionResultModal />
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  sheetContainer: { position: 'absolute', left: 0, right: 0, height: BASILICA_SHEET_HEIGHT },
});

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
