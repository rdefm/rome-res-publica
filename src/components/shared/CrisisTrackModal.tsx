import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import type { CrisisTrackId, CrisisTrack, CrisisState, CrisisTier } from '../../models/crisis';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Track colour ─────────────────────────────────────────────────────────────

const TRACK_COLOR: Record<CrisisTrackId, string> = {
  war:          '#C04010',
  unrest:       '#C03030',
  constitution: COLORS.purple,
  economy:      '#1A8888',
};

const TRACK_DISPLAY: Record<CrisisTrackId, string> = {
  war:          'WAR',
  unrest:       'UNREST',
  constitution: 'CONSTITUTION',
  economy:      'ECONOMY',
};

// ─── Static content per track ─────────────────────────────────────────────────

interface TierDef {
  range: string;
  effects: string;
}

interface TrackContent {
  raises: string;
  lowers: string;
  tiers: [TierDef, TierDef, TierDef, TierDef, TierDef]; // exactly 5, indexed by tier 0–4
  getCascadeNote: ((crisisState: CrisisState) => string | null) | null;
}

const TRACK_CONTENT: Record<CrisisTrackId, TrackContent> = {

  war: {
    raises:
      'Hostile or restless provinces, campaigns ending in defeat, military funding lapses, ' +
      'and Senate paralysis from constitutional breakdown. Critical military situations that ' +
      'go unaddressed compound over time.',
    lowers:
      'Successful campaigns, war funding legislation, stable and cooperative provinces, ' +
      'diplomatic investment in troubled regions, and Triumphs ratified by the Senate.',
    getCascadeNote: null, // War receives cascades but does not send them
    tiers: [
      {
        range: '0–19',
        effects: 'Pax Externa — Rome\'s borders are secure. No penalty.',
      },
      {
        range: '20–39',
        effects: 'Border tensions demand attention. Fides −1/season as the Senate turns outward.',
      },
      {
        range: '40–59',
        effects: 'Active conflict. Fides −2/season. The Senate now expects military funding bills.',
      },
      {
        range: '60–79',
        effects: 'War crisis. Fides −3/season · Denarii −5/season. Mandatory military funding is enforced. Senate response capability degraded.',
      },
      {
        range: '80–100',
        effects: 'Existential threat. Fides −5/season · Denarii −10/season. Emergency levy costs are reduced — all resources turn to survival.',
      },
    ],
  },

  unrest: {
    raises:
      'Grain shortages, unpopular or extortionate provincial taxation, long gaps between ' +
      'public games and grain distributions, prolonged economic hardship, and the exile or ' +
      'execution of prominent figures.',
    lowers:
      'Grain legislation, public games and spectacles, popular reforms, grain distributions, ' +
      'and maintaining strong popular sentiment in Latium through good governance.',
    getCascadeNote: (cs) => {
      if (cs.unrest.level < 60) return null;
      return (
        'Civil disorder at this level is feeding constitutional pressure — ' +
        'politicians exploit unrest to undermine institutions. ' +
        'Currently adding +2/season to the Constitution track.'
      );
    },
    tiers: [
      {
        range: '0–19',
        effects: 'Content populace — the city is calm. No penalty.',
      },
      {
        range: '20–39',
        effects: 'Murmurs in the streets. Fides −1/season.',
      },
      {
        range: '40–59',
        effects: 'Growing anger. Fides −2/season. Popular sentiment decays more quickly each season.',
      },
      {
        range: '60–79',
        effects: 'Street violence. Fides −3/season. Tribune actions carry extra weight. Grain riots are possible each season.',
      },
      {
        range: '80–100',
        effects: 'Open revolt. Fides −5/season. Senate sessions may be suspended — the Forum is unsafe.',
      },
    ],
  },

  constitution: {
    raises:
      'Prolonged Senate deadlock without legislation, deep faction polarisation between ' +
      'Optimates and Populares, extreme political actions, sustained opposition from a hostile ' +
      'co-consul, and elections left contested and unresolved.',
    lowers:
      'Consistent legislation passed each season, constitutional reform bills, broad ' +
      'cooperation between the major factions, and a stable political environment ' +
      'maintained through careful governance.',
    getCascadeNote: (cs) => {
      if (cs.constitution.level < 60) return null;
      const compound = cs.war.level >= 60
        ? ' With the military situation also critical, this effect is doubled — the Republic cannot coordinate on two fronts simultaneously.'
        : '';
      return (
        'Constitutional breakdown is hampering Rome\'s ability to respond to external threats — ' +
        `adding +2/season to the War track.${compound}`
      );
    },
    tiers: [
      {
        range: '0–19',
        effects: 'Institutional stability — the Republic functions as designed. No penalty.',
      },
      {
        range: '20–39',
        effects: 'Political tension. Clan relationships decay slightly faster each season.',
      },
      {
        range: '40–59',
        effects: 'Senate dysfunction. Bills require additional support to pass. Political manoeuvring is more costly.',
      },
      {
        range: '60–79',
        effects: 'Constitutional crisis. Fides −1/season · Bills require significantly greater support. Elections may be contested.',
      },
      {
        range: '80–100',
        effects: 'Republic in peril. Fides −2/season · Only legislation with exceptional support passes. All elections are contested.',
      },
    ],
  },

  economy: {
    raises:
      'Stagnating provincial infrastructure across multiple regions, a depleted or bankrupt ' +
      'treasury, neglected provincial development, and failure to pass trade or tax legislation ' +
      'when the Republic needs it.',
    lowers:
      'Active provincial infrastructure investment, treasury replenishment bills, ' +
      'strong development policies in governed provinces, and tax reform legislation ' +
      'that puts the treasury on stable footing.',
    getCascadeNote: (cs) => {
      if (cs.economy.level < 60) return null;
      return (
        'Economic hardship at this level is feeding civil unrest — ' +
        'poverty and scarcity breed anger in the streets. ' +
        'Currently adding +2/season to the Unrest track.'
      );
    },
    tiers: [
      {
        range: '0–19',
        effects: 'Prosperous Republic — trade flows freely, coffers are full. No penalty.',
      },
      {
        range: '20–39',
        effects: 'Tightening budgets. Denarii −2/season.',
      },
      {
        range: '40–59',
        effects: 'Economic strain. Denarii −5/season. Action costs increase. Tax reform bills are automatically triggered.',
      },
      {
        range: '60–79',
        effects: 'Scarcity crisis. Denarii −8/season. Action costs rise further. Spending bills face additional resistance in the Senate.',
      },
      {
        range: '80–100',
        effects: 'Economic collapse. Denarii −12/season · Fides −3/season. Creditors demand payment once each year.',
      },
    ],
  },
};

// ─── CrisisTrackModal ─────────────────────────────────────────────────────────

export default function CrisisTrackModal({
  trackId,
  track,
  crisisState,
  visible,
  onClose,
}: {
  trackId: CrisisTrackId;
  track: CrisisTrack;
  crisisState: CrisisState;
  visible: boolean;
  onClose: () => void;
}) {
  const color   = TRACK_COLOR[trackId];
  const content = TRACK_CONTENT[trackId];
  const activeTier   = track.tier as CrisisTier;
  const tierDef      = content.tiers[activeTier];
  const cascadeNote  = content.getCascadeNote?.(crisisState) ?? null;

  const TIER_LABELS = [
    content.tiers[0],
    content.tiers[1],
    content.tiers[2],
    content.tiers[3],
    content.tiers[4],
  ];

  const TIER_NAMES: Record<CrisisTrackId, [string, string, string, string, string]> = {
    war:          ['Pax Externa',           'Border Tensions',    'Active Conflict',      'War Crisis',            'Existential Threat'],
    unrest:       ['Content Populace',      'Murmurs',            'Growing Anger',        'Street Violence',       'Open Revolt'],
    constitution: ['Institutional Stability','Political Tension',  'Senate Dysfunction',   'Constitutional Crisis', 'Republic in Peril'],
    economy:      ['Prosperous Republic',   'Tightening Budgets', 'Economic Strain',      'Scarcity Crisis',       'Economic Collapse'],
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={[s.header, { borderBottomColor: color + '55' }]}>
          <View style={s.headerLeft}>
            <Text style={[s.trackName, { color }]}>{TRACK_DISPLAY[trackId]}</Text>
            <Text style={[s.tierLabel, { color }]}>{TIER_NAMES[trackId][activeTier]}</Text>
            {track.namedCrisis && (
              <Text style={s.namedCrisis}>{track.namedCrisis}</Text>
            )}
          </View>
          <View style={s.headerRight}>
            <Text style={[s.levelBig, { color }]}>{Math.round(track.level)}</Text>
            <Text style={s.levelDenom}>/100</Text>
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

          {/* ── Current effects ─────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>CURRENT EFFECTS</Text>
            <Text style={s.effectsText}>{tierDef.effects}</Text>
            {cascadeNote && (
              <View style={s.cascadeBox}>
                <Text style={s.cascadeLabel}>CASCADE ACTIVE</Text>
                <Text style={s.cascadeText}>{cascadeNote}</Text>
              </View>
            )}
          </View>

          {/* ── Raises ──────────────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>WHAT RAISES THIS</Text>
            <Text style={s.bodyText}>{content.raises}</Text>
          </View>

          {/* ── Lowers ──────────────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>WHAT LOWERS THIS</Text>
            <Text style={s.bodyText}>{content.lowers}</Text>
          </View>

          {/* ── Tier reference ──────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>ALL TIERS</Text>
            {([0, 1, 2, 3, 4] as CrisisTier[]).map((tier) => {
              const isActive = tier === activeTier;
              return (
                <View
                  key={tier}
                  style={[s.tierRow, isActive && { borderColor: color, backgroundColor: color + '18' }]}
                >
                  <View style={s.tierRowHeader}>
                    <Text style={[s.tierRowName, isActive && { color }]}>
                      {TIER_NAMES[trackId][tier]}
                    </Text>
                    <Text style={s.tierRowRange}>{TIER_LABELS[tier].range}</Text>
                    {isActive && (
                      <View style={[s.activePip, { backgroundColor: color }]} />
                    )}
                  </View>
                  <Text style={[s.tierRowEffects, isActive && s.tierRowEffectsActive]}>
                    {TIER_LABELS[tier].effects}
                  </Text>
                </View>
              );
            })}
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.panelSurface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 2,
  },
  trackName: {
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tierLabel: {
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  namedCrisis: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: 2,
  },
  levelBig: {
    fontFamily: FONTS.ui,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  levelDenom: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  effectsText: {
    color: COLORS.marble,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  cascadeBox: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.amber + '18',
    borderWidth: 1,
    borderColor: COLORS.amber + '55',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  cascadeLabel: {
    color: COLORS.amber,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  cascadeText: {
    color: COLORS.marble,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 18,
  },
  bodyText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 19,
  },
  tierRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 3,
  },
  tierRowName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tierRowRange: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  activePip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tierRowEffects: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    lineHeight: 16,
  },
  tierRowEffectsActive: {
    color: COLORS.marble,
  },
});
