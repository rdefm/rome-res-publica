// Curia Tab Redesign, Chunk C5 — lifted out of CuriaScreen.tsx's old inline
// MunificenceActRow (:1154-1205 pre-redesign), same logic exactly:
// checkMunificenceRequirements/getMunificenceCost/getMunificenceEffects and
// the `locked` derivation. That string-prefix test on check.reason is
// load-bearing — it's what distinguishes "locked by tier" (aspirational,
// requirement text shown) from "temporarily blocked" (cooldown/one-time-use)
// and drives two different visual states (Delta 11).
//
// checkMunificenceRequirements/getMunificenceCost/getMunificenceEffects read
// exactly six GameState fields (confirmed by reading munificenceEngine.ts):
// currentOffice, munificenceUsage, patronTier, turnNumber, denarii, fides.
// Field-level selectors for each, then a slice object for the three engine
// calls — `as unknown as GameState` is deliberate, not a papered-over
// mismatch: the slice is missing the rest of GameState on purpose, and
// these three functions are pure and read nothing else.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, bronzePlaque } from '../../utils/theme';
import { curiaAssets } from '../../utils/curiaAssets';
import { useGameStore } from '../../state/gameStore';
import type { GameState } from '../../state/gameStore';
import { checkMunificenceRequirements, getMunificenceCost, getMunificenceEffects } from '../../engine/munificenceEngine';
import type { MunificenceAct } from '../../data/munificence';

export default function PatronageCard({ act }: { act: MunificenceAct }) {
  const currentOffice = useGameStore(s => s.currentOffice);
  const munificenceUsage = useGameStore(s => s.munificenceUsage);
  const patronTier = useGameStore(s => s.patronTier);
  const turnNumber = useGameStore(s => s.turnNumber);
  const denarii = useGameStore(s => s.denarii);
  const fides = useGameStore(s => s.fides);
  const performMunificence = useGameStore(s => s.performMunificence);

  const stateSlice = {
    currentOffice, munificenceUsage, patronTier, turnNumber, denarii, fides,
  } as unknown as GameState;

  const check = checkMunificenceRequirements(stateSlice, act);
  const cost = getMunificenceCost(stateSlice, act);
  const effects = getMunificenceEffects(stateSlice, act);
  const aedileActive = !!act.aedileDiscount && currentOffice === 'aedile';

  const effectParts: string[] = [];
  if (effects.plebs)                            effectParts.push(`Plebs +${effects.plebs}`);
  if (effects.fides)                             effectParts.push(`Fides +${effects.fides}`);
  if (effects.lifetimeDignitas)                  effectParts.push(`Lifetime Dignitas +${effects.lifetimeDignitas}`);
  if (effects.stability)                         effectParts.push(`Stability +${effects.stability}`);
  if (effects.crisisDeltas?.unrest)              effectParts.push(`Unrest ${effects.crisisDeltas.unrest}`);
  if (effects.crisisDeltas?.constitution)        effectParts.push(`Constitution ${effects.crisisDeltas.constitution}`);
  if (effects.grantsEndowment)                   effectParts.push('+1 Fides/season, permanently');
  if (effects.electionVoteBonus !== undefined)   effectParts.push(`+${effects.electionVoteBonus} votes, fading over years`);

  const costParts = [`${cost.denarii} Denarii`];
  if (cost.fides > 0) costParts.push(`${cost.fides} Fides`);

  const locked = !check.ok && !!check.reason && check.reason.startsWith('Requires');
  const blocked = !check.ok && !locked;

  const tile = curiaAssets.terracottaTile;

  const content = (
    <View style={[styles.inner, act.isGrandAct && styles.grandInner, blocked && styles.blockedInner]}>
      <View style={styles.row}>
        <Text style={[styles.name, act.isGrandAct && styles.grandName]} numberOfLines={1}>
          {act.isGrandAct ? '🌿 ' : ''}{act.name}
        </Text>
        <Text style={styles.cost}>−{costParts.join(', −')}</Text>
      </View>
      <Text style={styles.flavor}>{act.flavor}</Text>
      {effectParts.length > 0 && (
        <View style={styles.pillRow}>
          {effectParts.map((part, i) => (
            <View key={i} style={styles.pill}>
              <Text style={styles.pillText}>{part}</Text>
            </View>
          ))}
        </View>
      )}
      {aedileActive && <Text style={styles.aedileNote}>Aedile discount applied (½ cost, ×1.5 effect)</Text>}
      {!check.ok && (
        <Text style={locked ? styles.lockedNote : styles.blockedNote}>{check.reason}</Text>
      )}
      <TouchableOpacity
        style={[styles.donateBtn, !check.ok && styles.donateBtnDisabled]}
        activeOpacity={0.75}
        disabled={!check.ok}
        onPress={() => performMunificence(act.id)}
      >
        <Text style={styles.donateBtnText}>Donate</Text>
      </TouchableOpacity>
    </View>
  );

  if (tile) {
    return (
      <ImageBackground source={tile} resizeMode="repeat" style={styles.card} imageStyle={styles.tileImage}>
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: COLORS.terracotta }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  tileImage: {
    borderRadius: RADIUS.md,
  },
  inner: {
    backgroundColor: 'rgba(20,14,8,0.45)',
    padding: SPACING.sm,
  },
  grandInner: {
    borderWidth: 2,
    borderColor: COLORS.laurel,
    borderRadius: RADIUS.md,
  },
  blockedInner: {
    opacity: 0.6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', flex: 1, marginRight: SPACING.sm },
  grandName: { color: COLORS.gold },
  cost: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  flavor: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 3 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pill: {
    backgroundColor: bronzePlaque,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 10 },
  aedileNote: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 10, marginTop: 4 },
  lockedNote: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  blockedNote: { color: '#e08060', fontFamily: FONTS.ui, fontSize: 10, marginTop: 4 },
  donateBtn: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  donateBtnDisabled: { opacity: 0.4 },
  donateBtnText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
