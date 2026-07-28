import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import FamilyTree from '../components/domus/FamilyTree';
import CharacterActionModal from '../components/domus/CharacterActionModal';
import DomesticDirectivesTray from '../components/domus/DomesticDirectivesTray';
import LegatumPanel from '../components/domus/LegatumPanel';
import ClientelaPanel from '../components/domus/ClientelaPanel';
import PatronLadderPanel from '../components/domus/PatronLadderPanel';
import FamilyHousePanel from '../components/domus/FamilyHousePanel';
import DebugPanel from '../components/shared/DebugPanel';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import { remeasureAllTargets } from '../engine/tutorialTargets';

const BG_DOMUS = require('../assets/images/bg-domus.png');

type DomusTab = 'familias' | 'clientela' | 'house';

const TABS: { key: DomusTab; label: string }[] = [
  { key: 'familias',  label: 'FAMILIAS' },
  { key: 'clientela', label: 'CLIENTELA' },
  { key: 'house',     label: 'FAMILY HOUSE' },
];

export default function DomusScreen() {
  const { family, selectedCharacterId, selectCharacter, debugMode } = useGameStore();
  const [modalChar, setModalChar] = useState<string | null>(null);
  // Domus redesign — three top tabs (mirroring Curia's SubTabBar pattern)
  // replace the old per-section accordion; only one tab's content shows at
  // a time instead of independently-collapsible sections.
  const [activeTab, setActiveTab] = useState<DomusTab>('familias');

  const modalCharObj = family.find((c) => c.id === modalChar) ?? null;

  function handlePress(id: string) {
    selectCharacter(id);
    setModalChar(id);
  }

  return (
    <ImageBackground
      source={BG_DOMUS}
      style={styles.screen}
      resizeMode="cover"
      imageStyle={{ backgroundColor: COLORS.terracotta }}
    >
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* Floating header — no panel behind it, floats over fresco */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>DOMUS BRUTIA</Text>
          <Text style={styles.headerSubtitle}>Family &amp; Heritage</Text>
        </View>

        <View style={styles.tabBar}>
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScrollEndDrag={remeasureAllTargets}
          onMomentumScrollEnd={remeasureAllTargets}
        >
          {activeTab === 'familias' && (
            <>
              <FamilyTree
                selectedCharacterId={selectedCharacterId}
                onPressCharacter={handlePress}
              />

              <DomesticDirectivesTray />

              <LegatumPanel />
            </>
          )}

          {activeTab === 'clientela' && (
            <>
              <PatronLadderPanel />
              <ClientelaPanel />
            </>
          )}

          {activeTab === 'house' && <FamilyHousePanel />}

          {debugMode && <DebugPanel />}
          <View style={{ height: CONTENT_PADDING_BOTTOM }} />
        </ScrollView>

        {modalCharObj && (
          <CharacterActionModal
            character={modalCharObj}
            visible={!!modalChar}
            onClose={() => setModalChar(null)}
          />
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: RESOURCE_BAR_HEIGHT,
  },
  safeArea: {
    flex: 1,
  },
  // Header floats over the fresco — no background panel
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 28,
    color: COLORS.gold,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    fontStyle: 'italic',
    fontSize: 14,
    color: COLORS.marble,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  // ── Top tab bar — mirrors Curia's SubTabBar pattern (fixed above the
  // scroll region, one tab's content shows at a time) using Domus's own
  // gold/dust palette instead of Curia's stone-tile tokens.
  tabBar: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panelSurface,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.panelElevated,
    borderColor: COLORS.gold,
  },
  tabLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.dust,
  },
  tabLabelActive: {
    color: COLORS.gold,
  },
});
