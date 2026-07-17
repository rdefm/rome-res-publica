// StartMenuScreen — P1-G redesign.
// Replaced the old START_OPTIONS list with a two-card picker driven by
// START_DEFINITIONS (src/data/startDefinitions.ts). Debug bypass retained.
// onStart prop removed; startGame is called directly from the store.
//
// Phase 5, Chunk P5-E — START_DEFINITIONS grew two more entries (Gens
// Duilia/Manlia); this screen just maps over whatever's in the array, so no
// structural change was needed beyond computing each card's lock state from
// the Hall of Ancestors and adding the "preview locked families" debug
// toggle (DebugPanel itself only mounts after a game starts, per
// DomusScreen.tsx — this toggle is the pre-game equivalent for a screen no
// running game exists yet to attach a real debug panel to).

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { saveProvider, hasSave, importSave } from '../state/saveLoad';
import { START_DEFINITIONS } from '../data/startDefinitions';
import { loadHall } from '../state/ancestorStore';
import type { AncestorRecord } from '../models/epilogue';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import HallOfAncestorsScreen from './HallOfAncestorsScreen';

const BG = (() => {
  try { return require('../assets/images/menu-bg.png'); } catch { return null; }
})();

export default function StartMenuScreen() {
  const startGame                   = useGameStore(s => s.startGame);
  const [loading, setLoading]       = useState(false);
  const [saveExists, setSaveExists] = useState(false);
  // Phase 3, Chunk P3-E — Hall of Ancestors entry point.
  const [showHall, setShowHall]     = useState(false);
  // Phase 5, Chunk P5-E — unlock state for Gens Duilia/Manlia, computed live
  // from the Hall (no separate unlock flag to migrate or lose, per E2).
  const [hallRecords, setHallRecords] = useState<AncestorRecord[]>([]);
  const [debugUnlockAll, setDebugUnlockAll] = useState(false);

  useEffect(() => {
    hasSave().then(setSaveExists).catch(() => setSaveExists(false));
    loadHall().then(setHallRecords).catch(() => setHallRecords([]));
  }, []);

  if (showHall) {
    return <HallOfAncestorsScreen onBack={() => setShowHall(false)} />;
  }

  async function handleLoad() {
    setLoading(true);
    try {
      const saved = await saveProvider.load();
      if (saved) {
        useGameStore.getState().loadGame(saved);
      } else {
        Alert.alert('No save found', 'No saved game was found on this device.');
      }
    } catch {
      Alert.alert('Load failed', 'Could not load save file.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const saved = await importSave();
      if (saved) useGameStore.getState().loadGame(saved);
    } catch {
      Alert.alert('Import failed', 'Could not import save file.');
    } finally {
      setLoading(false);
    }
  }

  function handleStartPress(def: typeof START_DEFINITIONS[number], unlocked: boolean) {
    if (!unlocked) return; // locked cards are inert without the debug toggle
    startGame(def.id, debugUnlockAll ? 'debug' : 'senator');
  }

  return (
    <ImageBackground
      source={BG ?? undefined}
      style={styles.bg}
      resizeMode="cover"
      imageStyle={{ backgroundColor: COLORS.terracotta }}
    >
      <SafeAreaView style={styles.safe}>

        {/* ── Title ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>ROME</Text>
          <Text style={styles.subtitle}>RES PUBLICA</Text>
          <View style={styles.titleRule} />
        </View>

        {/* ── Start picker ── */}
        <ScrollView style={styles.cardsScroll} contentContainerStyle={styles.cardsBlock}>
          <Text style={styles.sectionLabel}>BEGIN</Text>

          {START_DEFINITIONS.map(def => {
            const unlocked = debugUnlockAll || !def.isUnlocked || def.isUnlocked(hallRecords);
            return (
              <TouchableOpacity
                key={def.id}
                style={[
                  styles.startCard,
                  def.recommended && styles.startCardRecommended,
                  !unlocked && styles.startCardLocked,
                ]}
                onPress={() => handleStartPress(def, unlocked)}
                activeOpacity={unlocked ? 0.82 : 1}
              >
                {def.recommended && (
                  <View style={styles.laurel}>
                    <Text style={styles.laurelText}>RECOMMENDED</Text>
                  </View>
                )}
                <Text style={[styles.cardName, !unlocked && styles.cardTextLocked]}>{def.name}</Text>
                <Text style={[styles.cardSubtitle, !unlocked && styles.cardTextLocked]}>{def.subtitle}</Text>
                {unlocked ? (
                  <Text style={styles.cardDesc}>{def.description}</Text>
                ) : (
                  <Text style={styles.cardLockedCondition}>🔒 {def.unlockCondition}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Debug bypasses — small, below the main cards */}
          <TouchableOpacity
            style={styles.debugBtn}
            onPress={() => startGame('standard', 'debug')}
            activeOpacity={0.7}
          >
            <Text style={styles.debugText}>⚙ Debug Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.debugBtn}
            onPress={() => setDebugUnlockAll(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.debugText}>
              {debugUnlockAll ? '🔓 Previewing locked families (tap to hide)' : '🔒 Preview locked families'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Continue / Load section ── */}
        <View style={styles.loadBlock}>
          <Text style={styles.sectionLabel}>CONTINUE</Text>
          <TouchableOpacity
            style={[styles.loadBtn, saveExists && styles.loadBtnActive]}
            onPress={handleLoad}
            activeOpacity={0.75}
          >
            {loading
              ? <ActivityIndicator color={COLORS.gold} />
              : <Text style={[styles.loadLabel, saveExists && styles.loadLabelActive]}>
                  {saveExists ? 'Continue' : 'Load Game'}
                </Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.loadBtn} onPress={handleImport} activeOpacity={0.75}>
            <Text style={styles.loadLabel}>Import Save File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loadBtn} onPress={() => setShowHall(true)} activeOpacity={0.75}>
            <Text style={styles.loadLabel}>Hall of Ancestors</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg:   { flex: 1 },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },

  // ── Title ────────────────────────────────────────────────────────────────
  titleBlock: { alignItems: 'center', marginTop: SPACING.xl },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 52,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    fontStyle: 'italic',
    fontSize: 16,
    color: COLORS.marble,
    letterSpacing: 6,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleRule: {
    width: 120, height: 1,
    backgroundColor: COLORS.gold,
    marginTop: SPACING.md,
    opacity: 0.6,
  },

  // ── Shared section label ──────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 10,
    letterSpacing: 4,
    color: COLORS.goldDim,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  // ── Start cards ───────────────────────────────────────────────────────────
  // Phase 5, Chunk P5-E — wrapped in a ScrollView (cardsScroll) now that
  // there are 4 cards instead of 2; cardsBlock becomes its contentContainerStyle.
  cardsScroll: { flexGrow: 0 },
  cardsBlock: { gap: SPACING.sm, paddingBottom: SPACING.sm },

  startCard: {
    backgroundColor: 'rgba(26,23,20,0.88)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  startCardRecommended: {
    borderColor: COLORS.goldDim,
    borderWidth: 1.5,
  },
  // Phase 5, Chunk P5-E — locked Duilia/Manlia cards.
  startCardLocked: {
    opacity: 0.55,
  },

  // "Recommended" laurel badge
  laurel: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.goldDim + '33',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  laurelText: {
    color: COLORS.gold,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 8,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  cardName: {
    fontFamily: FONTS.display,
    fontSize: 17,
    color: COLORS.marble,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    marginBottom: 6,
  },
  cardDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.dust,
    lineHeight: 17,
  },
  // Phase 5, Chunk P5-E
  cardTextLocked: {
    color: COLORS.dust,
  },
  cardLockedCondition: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.goldDim,
    lineHeight: 17,
  },

  // Debug bypass
  debugBtn: { alignItems: 'center', paddingVertical: SPACING.xs, marginTop: 2 },
  debugText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 11,
    color: COLORS.goldDim,
    letterSpacing: 0.5,
  },

  // ── Load / Import ─────────────────────────────────────────────────────────
  loadBlock: { gap: SPACING.xs },

  loadBtn: {
    backgroundColor: 'rgba(26,23,20,0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  loadBtnActive: {
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(26,23,20,0.85)',
  },
  loadLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 14,
    color: COLORS.dust,
    letterSpacing: 1,
  },
  loadLabelActive: {
    color: COLORS.gold,
    fontWeight: '600',
  },
});