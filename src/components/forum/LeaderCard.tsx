import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ClanLeader } from '../../models/clan';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export function RelBar({ value }: { value: number }) {
  const pct = (value + 100) / 200;
  const color = value >= 20 ? COLORS.laurel : value <= -20 ? COLORS.crimson : COLORS.dust;
  return (
    <View style={rel.track}>
      <View style={[rel.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={rel.centre} />
    </View>
  );
}
const rel = StyleSheet.create({
  track: { height: 4, backgroundColor: COLORS.bg, borderRadius: 2, overflow: 'hidden', flex: 1, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  centre: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.border },
});

function LeaderCard({ leader, selected, onPress, campaigning }: {
  leader: ClanLeader; selected: boolean; onPress: () => void; campaigning: boolean;
}) {
  const borderColor = selected ? COLORS.gold
    : leader.relationship >= 20 ? COLORS.laurel
    : leader.relationship <= -20 ? COLORS.crimson
    : COLORS.border;

  return (
    <TouchableOpacity
      style={[lc.card, { borderColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {leader.blackmail && <View style={lc.blackmailDot} />}
      {leader.alliance && <View style={lc.allianceDot} />}
      <Text style={lc.emoji}>{leader.emoji}</Text>
      <Text style={lc.name} numberOfLines={1}>{leader.name.split(' ').slice(-1)[0]}</Text>
      <Text style={lc.title} numberOfLines={1}>{leader.title}</Text>
      <RelBar value={leader.relationship} />
      <View style={lc.favourRow}>
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={[lc.pip, i < leader.favour && lc.pipFull]} />
        ))}
      </View>
    </TouchableOpacity>
  );
}
const lc = StyleSheet.create({
  card: {
    width: 90, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: 'center', marginRight: SPACING.sm, position: 'relative',
  },
  blackmailDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.crimson },
  allianceDot: { position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.laurel },
  emoji: { fontSize: 28, marginBottom: 4 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  title: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, textAlign: 'center', marginBottom: 4 },
  favourRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  pipFull: { backgroundColor: COLORS.gold },
});

export default LeaderCard;
