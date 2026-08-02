import React, { useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, ImageBackground, Dimensions, ViewStyle, TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ClanGridTile from '../components/forum/ClanGridTile';
import ClanDetailZone from '../components/forum/ClanDetailZone';
import DossierPanel from '../components/forum/DossierPanel';
import { forumAssets } from '../utils/forumAssets';
import { COLORS, FONTS, SPACING, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT, RADIUS } from '../utils/theme';
import { OFFICES } from '../data/offices';
import {
  calcPlayerElectionScore,
  calcOfficeThreshold,
  CANVASS_FIDES_COST,
  CANVASS_MIN_RELATIONSHIP,
} from '../engine/electionEngine';
import { leaderPortraitSubject } from '../engine/portraitEngine';
import PortraitRoundel from '../components/shared/PortraitRoundel';
import type { CanvassingEvent } from '../data/canvassingEvents';
import { useTutorialTarget } from '../components/shared/useTutorialTarget';
import { remeasureAllTargets } from '../engine/tutorialTargets';

// Forum redesign, Chunk C1 (revised) — explicit pixel height computed once
// from screen width, not `aspectRatio` + `width: '100%'`. That combination
// rendered the header banner far taller than its 10:3 ratio (bleeding down
// behind the intro text and the whole clan grid) — the same "percentage-
// based sizing is unreliable inside a nested flex chain" class of bug
// components/shared/FrescoBackground.tsx's own header comment documents
// (it works around it by measuring and rendering at an explicit pixel
// size instead of a percentage/aspectRatio). Same fix here, simpler case:
// full device width is already known synchronously via Dimensions, so no
// onLayout measurement round-trip is needed — same idiom as
// TutorialCaption.tsx's SCREEN_W/CARD_W.
const { width: FORUM_SCREEN_W } = Dimensions.get('window');
// Deliberately taller than the source image's own ~10:3 ratio — resizeMode
// "cover" fills this box by cropping overflow, so a taller box crops more
// off the image's left/right edges, which both enlarges it on screen and
// tightens the crop onto its central focal point (the temple facade).
const HEADER_BANNER_HEIGHT = Math.round(FORUM_SCREEN_W / 2);

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
  // Tutorial redesign, T5b — called unconditionally (before the early return
  // below) so this stays a single, stable hook call; its ref/onLayout are
  // only ATTACHED to Flaccus's row below, not called conditionally per-leader.
  const flaccusCanvassTarget = useTutorialTarget('cursus.action.canvass');

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
            <View style={cp.leaderAvatar}>
              <PortraitRoundel
                subject={leaderPortraitSubject(leader, leader.clanId)}
                size={96}
                frame="plain"
              />
            </View>
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
                ref={leader.id === 'valerius-flaccus' ? flaccusCanvassTarget.ref : undefined}
                onLayout={leader.id === 'valerius-flaccus' ? flaccusCanvassTarget.onLayout : undefined}
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
  leaderAvatar: {
    marginRight: SPACING.sm,
    flexShrink: 0,
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
  const { clans, campaigning, activeCanvassingEvent, expandedClanId, expandClan } = useGameStore(s => ({
    clans: s.clans,
    campaigning: s.campaigning,
    activeCanvassingEvent: s.activeCanvassingEvent,
    expandedClanId: s.expandedClanId,
    expandClan: s.expandClan,
  }));

  // Forum redesign, Chunk C0 — expandedClanId already models "one clan
  // selected at a time" (plans/forum-redesign.md Finding 1); the grid+detail
  // split below is a pure layout change, no new store state.
  const selectedClan = clans.find(c => c.id === expandedClanId) ?? null;

  // Tutorial fix — passed down to ClanGridTile/ClanDetailZone/
  // LeaderDetailPanel so the Gens Valeria tile and the Invite to Dinner
  // button can scroll themselves into view once they become the tutorial's
  // active target (see useTutorialTarget.ts's scrollRef param).
  const scrollRef = useRef<ScrollView>(null);

  const screenContent = (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}
        onScrollEndDrag={remeasureAllTargets}
        onMomentumScrollEnd={remeasureAllTargets}
      >
        {/* Phase 4, Chunk P4-B — self-hides when there's nothing to show */}
        <DossierPanel />

        {/* Canvassing section — only visible during a campaign */}
        {campaigning && <CanvassingPanel />}

        <Text style={styles.sectionLabel}>GENTES — CLAN DIRECTORY</Text>
        <Text style={styles.intro}>
          Each clan is led by individual men of influence. Build relationships with them personally to
          shift their votes and allegiance.
        </Text>

        {/* Forum redesign, Chunk C0 — a fixed, always-visible clan grid
            replaces the old per-clan accordion. Selecting a tile swaps
            ClanDetailZone's content below; the grid itself never scrolls
            away, so switching clans costs zero scrolling past others'
            collapsed cards. */}
        <View style={styles.clanGrid}>
          {clans.map((clan) => (
            <ClanGridTile
              key={clan.id}
              clan={clan}
              isSelected={expandedClanId === clan.id}
              onPress={() => expandClan(clan.id)}
              scrollRef={scrollRef}
            />
          ))}
        </View>

        {selectedClan ? (
          <ClanDetailZone clan={selectedClan} scrollRef={scrollRef} />
        ) : (
          <Text style={styles.selectHint}>Select a clan above to see its leaders.</Text>
        )}
      </ScrollView>

      {/* Canvassing event modal — overlays everything when an event fires */}
      {activeCanvassingEvent && (
        <CanvassingEventModal event={activeCanvassingEvent} />
      )}

      <SeasonOverlay />
    </>
  );

  return (
    // Mobile QA fix (2026-07) — the header banner used to be a child of the
    // left/right-inset SafeAreaView below, which meant those insets ate into
    // its width on devices that report one, cropping it short of the true
    // right edge. Every other full-bleed image in the app (Domus/Cursus)
    // sits outside its screen's SafeAreaView for exactly this reason (see
    // FrescoBackground.tsx's own header comment); same fix here, done as a
    // split (banner-or-fallback outside, SafeAreaView around just the
    // scrollable content) rather than removing the SafeAreaView outright, so
    // styles.screen's existing paddingTop/marginTop relationship (see that
    // comment below) is untouched.
    <View style={styles.screen}>
      {forumAssets.headerBanner ? (
        <ImageBackground source={forumAssets.headerBanner} style={styles.headerBanner} resizeMode="cover" />
      ) : (
        <View style={styles.header} />
      )}
      {forumAssets.headerBackground ? (
        <ImageBackground source={forumAssets.headerBackground} style={styles.safeContent} resizeMode="cover">
          <SafeAreaView style={styles.safeContent} edges={['left', 'right']}>
            {screenContent}
          </SafeAreaView>
        </ImageBackground>
      ) : (
        <SafeAreaView style={styles.safeContent} edges={['left', 'right']}>
          {screenContent}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  safeContent: { flex: 1 },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  // Forum redesign, Chunk C1 (revised) — matches forumAssets.headerBanner's
  // asset. Explicit pixel height (HEADER_BANNER_HEIGHT, computed once
  // above) rather than `aspectRatio` — see that constant's comment for why.
  // marginTop: -RESOURCE_BAR_HEIGHT — `styles.screen`'s own paddingTop is
  // redundant (ResourceBar is a real sibling above the tab navigator in
  // App.tsx, already occupying that space in normal flow; every screen's
  // identical paddingTop double-counts it) but invisible everywhere else
  // since every other header/fallback is flat-colored and blends into the
  // gap. Scoped to only the image case rather than touching that
  // widely-shared convention — pulls just the banner up flush against the
  // resource bar without affecting the plain-header fallback or the rest
  // of the screen's layout.
  headerBanner: {
    width: '100%',
    height: HEADER_BANNER_HEIGHT,
    marginTop: -RESOURCE_BAR_HEIGHT,
    overflow: 'hidden',
  },
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
  clanGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectHint: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
});
