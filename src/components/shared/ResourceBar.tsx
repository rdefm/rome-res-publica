import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getCrisisColour } from '../../engine/crisisEngine';
import { calcResourceIncome } from '../../engine/resourceEngine';
import { getCriticalItems } from '../../engine/agendaEngine';
import type { AgendaItem } from '../../models/agenda';
import SettingsModal from './SettingsModal';
import InfoTap from './InfoTap';
import ScrollModal, { PARCHMENT } from './ScrollModal';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../../utils/theme';

// Fides icon: reusing icon-gratia.png (clasped hands) until a dedicated
// icon-fides.png asset is provided.
const RESOURCE_ICONS = {
  fides:   require('../../assets/images/icon-gratia.png'),
  denarii: require('../../assets/images/icon-denarii.png'),
};

const RESOURCE_TINTS = {
  fides:   COLORS.fidesColor,
  denarii: COLORS.denariiColor,
};

function ResourceItem({ value, projectedIncome, tintColor, icon }: {
  value: number;
  projectedIncome: number;
  tintColor: string;
  icon: ReturnType<typeof require>;
}) {
  return (
    <View style={styles.resourceItem}>
      <Image source={icon} style={[styles.resourceIcon, { tintColor }]} />
      <Text style={[styles.resourceValue, { color: tintColor }]}>{value}</Text>
      <Text style={styles.resourceProjected}>
        {projectedIncome >= 0 ? '+' : ''}{projectedIncome}
      </Text>
    </View>
  );
}

export default function ResourceBar() {
  const state = useGameStore();
  const {
    fides, denarii,
    crisisLevel, year, seasonIndex,
    endSeason, seasonOverlayVisible, showAgenda,
  } = state;
  const { fidesIncome, denariiIncome } = calcResourceIncome(state);
  const insets = useSafeAreaInsets();
  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Philon warning state — mirrors EndSeasonButton pattern (F1 fix)
  const [warningVisible, setWarningVisible]   = useState(false);
  const [criticalItems, setCriticalItems]     = useState<AgendaItem[]>([]);

  function handleEndSeason() {
    const criticals = getCriticalItems(useGameStore.getState());
    if (criticals.length > 0) {
      setCriticalItems(criticals);
      setWarningVisible(true);
    } else {
      endSeason();
    }
  }

  function handleConfirmEnd() {
    setWarningVisible(false);
    endSeason();
  }

  function handleAttend() {
    setWarningVisible(false);
    showAgenda();
  }

  const shownCriticals  = criticalItems.slice(0, 3);
  const hiddenCount     = criticalItems.length - 3;

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>

        {/* Left — gear */}
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.gearBtn}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>

        {/* Centre — resources */}
        <View style={styles.resources}>
          <InfoTap termId="fides">
            <ResourceItem
              value={fides}
              projectedIncome={fidesIncome}
              icon={RESOURCE_ICONS.fides}
              tintColor={RESOURCE_TINTS.fides}
            />
          </InfoTap>
          <InfoTap termId="denarii">
            <ResourceItem
              value={denarii}
              projectedIncome={denariiIncome}
              icon={RESOURCE_ICONS.denarii}
              tintColor={RESOURCE_TINTS.denarii}
            />
          </InfoTap>
        </View>

        {/* Right — single unified box: date on left, divider, END SEASON on right */}
        <TouchableOpacity
          style={[styles.endBox, seasonOverlayVisible && styles.endBoxDisabled]}
          onPress={handleEndSeason}
          disabled={seasonOverlayVisible}
          activeOpacity={0.75}
        >
          {/* Date column */}
          <View style={styles.dateCol}>
            <Text style={styles.yearText}>{Math.abs(year)} BC</Text>
            <Text style={styles.seasonText}>{SEASON_NAMES[seasonIndex].toUpperCase()}</Text>
          </View>

          {/* Vertical divider */}
          <View style={styles.divider} />

          {/* End Season label */}
          <Text style={styles.endText}>END{'\n'}SEASON</Text>
        </TouchableOpacity>

      </View>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Philon warning — mirrors EndSeasonButton (F1 fix) */}
      <ScrollModal
        visible={warningVisible}
        onClose={() => setWarningVisible(false)}
        title="PHILON CLEARS HIS THROAT"
        animationType="fade"
      >
        <View style={warn.body}>
          <Text style={warn.intro}>"Domine, before the season closes —"</Text>
          {shownCriticals.map(item => (
            <Text key={item.id} style={warn.item}>· {item.title}</Text>
          ))}
          {hiddenCount > 0 && (
            <Text style={warn.more}>…and {hiddenCount} more {hiddenCount === 1 ? 'matter' : 'matters'}.</Text>
          )}
          <View style={warn.btnRow}>
            <TouchableOpacity style={[warn.btn, warn.btnAttend]} onPress={handleAttend} activeOpacity={0.75}>
              <Text style={warn.btnAttendTxt}>Let me attend to it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[warn.btn, warn.btnEnd]} onPress={handleConfirmEnd} activeOpacity={0.75}>
              <Text style={warn.btnEndTxt}>End the season anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollModal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(15, 10, 8, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    minHeight: RESOURCE_BAR_HEIGHT,
  },
  gearBtn: {
    marginRight: SPACING.sm,
  },
  gearIcon: {
    fontSize: 18,
  },
  resources: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  resourceItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  resourceIcon: {
    width: 20,
    height: 20,
    marginBottom: 1,
  },
  resourceValue: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: 'bold',
  },
  resourceProjected: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
  },

  // Single unified rectangle — date | divider | END SEASON
  endBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a2a0e',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
  },
  endBoxDisabled: {
    opacity: 0.4,
  },
  dateCol: {
    alignItems: 'center',
  },
  yearText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  seasonText: {
    fontFamily: FONTS.display,
    fontSize: 9,
    color: COLORS.marble,
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
  },
  endText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: COLORS.marble,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 14,
  },
});

const warn = StyleSheet.create({
  body: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.md },
  intro: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, color: PARCHMENT.body, textAlign: 'center', marginBottom: 12, lineHeight: 21 },
  item: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: PARCHMENT.body, lineHeight: 20, marginBottom: 4, paddingLeft: 8 },
  more: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT.muted, marginTop: 4, marginBottom: 8, paddingLeft: 8 },
  btnRow: { marginTop: 16, gap: 8 },
  btn: { borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1 },
  btnAttend: { backgroundColor: PARCHMENT.pillActive, borderColor: PARCHMENT.border },
  btnAttendTxt: { fontFamily: FONTS.display, fontSize: 13, color: PARCHMENT.heading },
  btnEnd: { backgroundColor: 'transparent', borderColor: PARCHMENT.border },
  btnEndTxt: { fontFamily: FONTS.ui, fontSize: 12, color: PARCHMENT.muted, letterSpacing: 0.5 },
});
