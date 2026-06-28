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
import CharacterProfilePane from '../components/domus/CharacterProfilePane';
import FamilyTree from '../components/domus/FamilyTree';
import CharacterActionModal from '../components/domus/CharacterActionModal';
import DomesticDirectivesTray from '../components/domus/DomesticDirectivesTray';
import LegatumPanel from '../components/domus/LegatumPanel';
import ClientelaPanel from '../components/domus/ClientelaPanel';
import PatrimoniumPanel from '../components/domus/PatrimoniumPanel';
import DebugPanel from '../components/shared/DebugPanel';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

const BG_DOMUS = require('../assets/images/bg-domus.png');

type DomusSection = 'familias' | 'clientela' | 'patrimonium';

const SECTIONS: { key: DomusSection; label: string }[] = [
  { key: 'familias',    label: 'FAMILIAS' },
  { key: 'clientela',   label: 'CLIENTELA' },
  { key: 'patrimonium', label: 'PATRIMONIUM' },
];

export default function DomusScreen() {
  const { family, selectedCharacterId, selectCharacter, debugMode } = useGameStore();
  const [modalChar, setModalChar] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<DomusSection | null>('familias');

  const selected = family.find((c) => c.id === selectedCharacterId) ?? family[0];
  const modalCharObj = family.find((c) => c.id === modalChar) ?? null;

  function handlePress(id: string) {
    selectCharacter(id);
    setModalChar(id);
  }

  function toggleSection(key: DomusSection) {
    setOpenSection(prev => (prev === key ? null : key));
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

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {SECTIONS.map(({ key, label }) => {
            const isOpen = openSection === key;

            return (
              <View key={key} style={styles.section}>
                <TouchableOpacity
                  style={[styles.sectionHeader, isOpen && styles.sectionHeaderOpen]}
                  onPress={() => toggleSection(key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sectionLabel, isOpen && styles.sectionLabelOpen]}>
                    {label}
                  </Text>
                  <Text style={[styles.sectionChevron, isOpen && styles.sectionChevronOpen]}>
                    ›
                  </Text>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.sectionBody}>
                    {key === 'familias' && (
                      <>
                        <LegatumPanel />

                        {selected && (
                          <CharacterProfilePane character={selected} />
                        )}

                        <FamilyTree
                          selectedCharacterId={selectedCharacterId}
                          onPressCharacter={handlePress}
                        />

                        <DomesticDirectivesTray />
                      </>
                    )}

                    {key === 'clientela' && <ClientelaPanel />}

                    {key === 'patrimonium' && <PatrimoniumPanel />}
                  </View>
                )}
              </View>
            );
          })}

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
  // ── Collapsible sections ──────────────────────────────────────────────────
  section: {
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.panelSurface,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
  },
  sectionHeaderOpen: {
    backgroundColor: COLORS.panelElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold,
  },
  sectionLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.dust,
  },
  sectionLabelOpen: {
    color: COLORS.gold,
  },
  sectionChevron: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 20,
    transform: [{ rotate: '90deg' }],
  },
  sectionChevronOpen: {
    color: COLORS.gold,
    transform: [{ rotate: '270deg' }],
  },
  sectionBody: {
    backgroundColor: 'rgba(26, 23, 20, 0.82)',  // semi-transparent so fresco bleeds through
  },
});
