import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import CharacterCard from '../components/domus/CharacterCard';
import CharacterActionModal from '../components/domus/CharacterActionModal';
import DomesticDirectivesTray from '../components/domus/DomesticDirectivesTray';
import LegatumPanel from '../components/domus/LegatumPanel';
import ClientelaPanel from '../components/domus/ClientelaPanel';
import PatrimoniumPanel from '../components/domus/PatrimoniumPanel';
import EndSeasonButton from '../components/shared/EndSeasonButton';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

const PLAYER_PORTRAIT = require('../assets/images/portrait-paterfamilias.png');

const SKILL_COLORS: Record<string, string> = {
  rhetoric:   COLORS.denariiColor,
  auctoritas: COLORS.dignitasColor,
  martial:    COLORS.crimson,
  intrigus:   COLORS.purple,
};

type DomusSection = 'familias' | 'clientela' | 'patrimonium';

const SECTIONS: { key: DomusSection; label: string }[] = [
  { key: 'familias',    label: 'FAMILIAS' },
  { key: 'clientela',   label: 'CLIENTELA' },
  { key: 'patrimonium', label: 'PATRIMONIUM' },
];


export default function DomusScreen() {
  const { family, selectedCharacterId, selectCharacter } = useGameStore();
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
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>DOMUS BRUTIA</Text>
        <Text style={styles.subtitle}>Family & Heritage</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {SECTIONS.map(({ key, label }) => {
          const isOpen = openSection === key;

          return (
            <View key={key} style={styles.section}>
              {/* Section header — tap to collapse/expand */}
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

              {/* Section body */}
              {isOpen && (
                <View style={styles.sectionBody}>
                  {key === 'familias' && (
                    <>
                      {/* Legacy tracker */}
                      <LegatumPanel />

                      {/* Selected character profile */}
                      {selected && (
                        <View style={styles.profilePane}>
                          <View style={styles.profileHeader}>
                            {selected.isPlayer ? (
                              <Image source={PLAYER_PORTRAIT} style={styles.profilePortrait} />
                            ) : (
                              <View style={styles.profilePortraitPlaceholder}>
                                <Text style={{ fontSize: 48 }}>
                                  {selected.role === 'spouse' ? '👩' : selected.role === 'son' ? '👦' : '👧'}
                                </Text>
                              </View>
                            )}
                            <View style={styles.profileInfo}>
                              <Text style={styles.profileName}>{selected.name}</Text>
                              <Text style={styles.profileRole}>
                                {selected.role.charAt(0).toUpperCase() + selected.role.slice(1)} · Age {selected.age}
                              </Text>
                              <Text style={styles.profileAmbition}>
                                {selected.ambition
                                  ? `Ambition: ${selected.ambition.type.replace(/_/g, ' ')}`
                                  : 'No ambition'}
                              </Text>
                              <Text style={styles.profileTrust}>
                                Family trust: {selected.familyTrust}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.skillBars}>
                            {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const).map((sk) => (
                              <StatBar
                                key={sk}
                                label={sk.charAt(0).toUpperCase() + sk.slice(1)}
                                value={selected.skills[sk]}
                                max={10}
                                color={SKILL_COLORS[sk]}
                              />
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Family members */}
                      <Text style={styles.subLabel}>FAMILY MEMBERS</Text>
                      {family.map((c) => (
                        <CharacterCard
                          key={c.id}
                          character={c}
                          selected={c.id === selectedCharacterId}
                          onPress={() => handlePress(c.id)}
                        />
                      ))}

                      {/* Directives */}
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

        <View style={{ height: CONTENT_PADDING_BOTTOM }} />
      </ScrollView>

      <EndSeasonButton />
      <SeasonOverlay />

      {modalCharObj && (
        <CharacterActionModal
          character={modalCharObj}
          visible={!!modalChar}
          onClose={() => setModalChar(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: RESOURCE_BAR_HEIGHT,
  },
  header: {
    padding: SPACING.md,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  subtitle: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },

  // ── Collapsible sections ───────────────────────────────────────────────────
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
    backgroundColor: COLORS.bg,
  },

  // ── Familias content ───────────────────────────────────────────────────────
  profilePane: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.md,
    marginBottom: SPACING.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  profilePortrait: {
    width: 80,
    height: 80,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: COLORS.gold,
    marginRight: SPACING.md,
  },
  profilePortraitPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: SPACING.md,
    backgroundColor: COLORS.panelElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 17,
    fontWeight: '700',
  },
  profileRole: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginTop: 2,
  },
  profileAmbition: {
    color: COLORS.gold,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 3,
  },
  profileTrust: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 2,
  },
  skillBars: {
    gap: 2,
  },
  subLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
});
