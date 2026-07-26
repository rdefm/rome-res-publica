/**
 * GovernorshipPickerModal — governor-assignment gap fix.
 *
 * Full-screen native Modal (same self-gating idiom as EngagementInterstitial/
 * BattleScreen, mounted once at the App root), self-gated on
 * pendingGovernorAssignment. Only ever visible while rigSucceeded is true and
 * assignedProvinceId is still null — an unrigged term-end resolves
 * immediately in turnSequencer.ts instead (drawGovernorLot, no player choice
 * to make), so this modal never appears for that path.
 */
import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getCityDefinition } from '../../data/cityDefinitions';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function GovernorshipPickerModal() {
  const assignment = useGameStore(s => s.pendingGovernorAssignment);
  const cities = useGameStore(s => s.cities);
  const chooseGovernorship = useGameStore(s => s.chooseGovernorship);

  if (!assignment || assignment.assignedProvinceId !== null) return null;

  const eligible = cities.filter(c => c.status === 'incorporated' && c.playerGovernor === null);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>A GOVERNORSHIP AWAITS</Text>
          <Text style={styles.title}>{assignment.characterName}</Text>
          <Text style={styles.sub}>
            Your influence secured the choice of province. Name where {assignment.characterName} governs.
          </Text>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {eligible.length === 0 ? (
            <Text style={styles.empty}>No incorporated province currently lacks a governor.</Text>
          ) : (
            eligible.map(city => {
              const def = getCityDefinition(city.id);
              return (
                <TouchableOpacity
                  key={city.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => chooseGovernorship(city.id)}
                >
                  <Text style={styles.cardName}>{def?.name ?? city.id}</Text>
                  <Text style={styles.cardSub}>
                    Relationship {Math.round(city.relationshipScore)} · Infrastructure {Math.round(city.infrastructureRating)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.lg, alignItems: 'center' },
  eyebrow: {
    color: COLORS.crimson,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  sub: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  list: { flex: 1, paddingHorizontal: SPACING.lg },
  listContent: { paddingBottom: SPACING.lg },
  card: {
    backgroundColor: '#1a1714',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  cardSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  empty: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
