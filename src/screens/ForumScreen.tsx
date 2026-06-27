import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import ClanCard from '../components/forum/ClanCard';
import PatronLadderPanel from '../components/forum/PatronLadderPanel';
import { COLORS, FONTS, SPACING, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

export default function ForumScreen() {
  const { clans, campaigning } = useGameStore();

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>FORUM</Text>
        <Text style={styles.subtitle}>
          {campaigning ? `Campaign Active — Canvass for Votes` : 'Clans & Political Alliances'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        {/* Patron Ladder — family standing in Roman social hierarchy */}
        <PatronLadderPanel />

        <Text style={styles.sectionLabel}>GENTES — CLAN DIRECTORY</Text>
        <Text style={styles.intro}>
          Each clan is led by individual men of influence. Build relationships with them personally to
          shift their votes and allegiance.
        </Text>
        {clans.map((clan) => (
          <ClanCard key={clan.id} clan={clan} />
        ))}
      </ScrollView>

      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
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
});
