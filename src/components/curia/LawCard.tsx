// Curia Tab Redesign, Chunk C3 — bronze plaque for an active law. Reuses
// GildedPanel outright for the corner-rivet treatment (its rivet colour is
// already the exact bronzeRivet value — see theme.ts's C0 reference-token
// comment) rather than rebuilding rivets, per the plan's explicit "check
// whether GildedPanel can be reused outright" instruction — only the panel
// field itself is overridden to bronzePlaque.
//
// Post-launch fix — bronzeTile was registered in C0 but never actually
// wired here; the plaque used the flat bronzePlaque colour unconditionally.
// When the tile is present it renders behind GildedPanel (whose own
// background goes transparent so the tile shows through); bronzePlaque
// stays the flat-colour fallback.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { FONTS, SPACING, RADIUS, bronzePlaque, sealPass } from '../../utils/theme';
import { curiaAssets } from '../../utils/curiaAssets';
import { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import GildedPanel from '../shared/GildedPanel';
import { useGameStore } from '../../state/gameStore';
import { formatEffectString } from '../../utils/billEffectText';
import LawDetailModal from './LawDetailModal';
import type { ActiveLaw } from '../../models/bill';

export default function LawCard({ law }: { law: ActiveLaw }) {
  const proposeRepeal = useGameStore(s => s.proposeRepeal);
  const fides = useGameStore(s => s.fides);
  const bills = useGameStore(s => s.bills);
  const turnNumber = useGameStore(s => s.turnNumber);

  const repealAlreadyActive = bills.some(b => b.type === 'repeal' && b.repeals === law.billId);
  const canRepeal = law.repealable && !repealAlreadyActive && fides >= 10;
  const seasonsLeft = law.expiresOnTurn !== undefined ? law.expiresOnTurn - turnNumber : null;
  const ongoingEffects = formatEffectString(law.ongoingEffect);
  const [detailVisible, setDetailVisible] = useState(false);
  const tile = curiaAssets.bronzeTile;

  const card = (
    <GildedPanel style={{ backgroundColor: tile ? 'transparent' : bronzePlaque }}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => setDetailVisible(true)}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{law.name}</Text>
          <Text style={styles.expiry}>
            {seasonsLeft !== null ? `Expires in ${seasonsLeft} season${seasonsLeft !== 1 ? 's' : ''}` : 'Permanent'}
          </Text>
        </View>
        {ongoingEffects.length > 0 && (
          <View style={styles.effects}>
            {ongoingEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)}
          </View>
        )}
      </TouchableOpacity>

      <LawDetailModal law={law} visible={detailVisible} onClose={() => setDetailVisible(false)} />

      {law.repealable && (
        <TouchableOpacity
          style={[styles.repealBtn, !canRepeal && styles.repealBtnDisabled]}
          onPress={() => proposeRepeal(law.billId)}
          disabled={!canRepeal}
        >
          <Text style={styles.repealLabel}>
            {repealAlreadyActive ? 'Repeal pending' : 'Propose Repeal (−10 🤝)'}
          </Text>
        </TouchableOpacity>
      )}
    </GildedPanel>
  );

  if (tile) {
    return (
      <ImageBackground source={tile} resizeMode="repeat" style={styles.tileWrap}>
        {card}
      </ImageBackground>
    );
  }

  return <View style={styles.plaque}>{card}</View>;
}

const styles = StyleSheet.create({
  plaque: {
    marginBottom: SPACING.sm,
  },
  tileWrap: {
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', color: PARCHMENT_TEXT.heading, flex: 1, marginRight: SPACING.sm },
  expiry: { fontFamily: FONTS.ui, fontSize: 10, color: PARCHMENT_TEXT.muted },
  effects: { marginTop: SPACING.xs },
  effectLine: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT_TEXT.body, marginTop: 2 },
  repealBtn: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: sealPass,
    borderRadius: RADIUS.sm,
    padding: 6,
    alignItems: 'center',
  },
  repealBtnDisabled: { opacity: 0.4 },
  repealLabel: { fontFamily: FONTS.ui, fontSize: 11, color: sealPass },
});
