import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, INITIAL_STATE } from '../state/gameStore';
import { saveProvider, importSave } from '../state/saveLoad';
import { COLORS, FONTS, SPACING } from '../utils/theme';

const BG = (() => {
  try { return require('../assets/images/menu-bg.png'); } catch { return null; }
})();

type StartOption = {
  id: string;
  label: string;
  subtitle: string;
  available: boolean;
};

const START_OPTIONS: StartOption[] = [
  { id: 'senator',   label: 'Senator',               subtitle: 'The Brutii — 264 BC',           available: true  },
  { id: 'debug',     label: 'Debug',                  subtitle: 'All tools unlocked',            available: true  },
  { id: 'noble',     label: 'Noble House on Hard Times', subtitle: 'Coming soon',                available: false },
  { id: 'soldier',   label: 'Equestrian Soldier',     subtitle: 'Coming soon',                   available: false },
  { id: 'merchant',  label: 'Merchant',               subtitle: 'Coming soon',                   available: false },
];

interface Props {
  onStart: (mode: 'senator' | 'debug') => void;
}

export default function StartMenuScreen({ onStart }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setLoading(true);
    try {
      const saved = await saveProvider.load();
      if (saved) {
        useGameStore.setState({ ...saved, gameStarted: true, debugMode: false });
      } else {
        Alert.alert('No save found', 'No saved game was found on this device.');
      }
    } catch (e) {
      Alert.alert('Load failed', 'Could not load save file.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const saved = await importSave();
      if (saved) {
        useGameStore.setState({ ...saved, gameStarted: true, debugMode: false });
      }
    } catch (e) {
      Alert.alert('Import failed', 'Could not import save file.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(opt: StartOption) {
    if (!opt.available) return;
    if (opt.id === 'senator' || opt.id === 'debug') {
      onStart(opt.id);
    }
  }

  return (
    <ImageBackground
      source={BG ?? undefined}
      style={styles.bg}
      resizeMode="cover"
      imageStyle={{ backgroundColor: COLORS.terracotta }}
    >
      <SafeAreaView style={styles.safe}>
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>ROME</Text>
          <Text style={styles.subtitle}>RES PUBLICA</Text>
          <View style={styles.titleRule} />
        </View>

        {/* Start options */}
        <View style={styles.optionsBlock}>
          <Text style={styles.sectionLabel}>BEGIN</Text>
          {START_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optionBtn, !opt.available && styles.optionBtnDisabled]}
              onPress={() => handleSelect(opt)}
              activeOpacity={opt.available ? 0.75 : 1}
            >
              <Text style={[styles.optionLabel, !opt.available && styles.optionLabelDisabled]}>
                {opt.label}
              </Text>
              <Text style={styles.optionSub}>{opt.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Load / Import */}
        <View style={styles.loadBlock}>
          <Text style={styles.sectionLabel}>CONTINUE</Text>
          <TouchableOpacity style={styles.loadBtn} onPress={handleLoad} activeOpacity={0.75}>
            {loading
              ? <ActivityIndicator color={COLORS.gold} />
              : <Text style={styles.loadLabel}>Load Game</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.loadBtn} onPress={handleImport} activeOpacity={0.75}>
            <Text style={styles.loadLabel}>Import Save File</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
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
    width: 120,
    height: 1,
    backgroundColor: COLORS.gold,
    marginTop: SPACING.md,
    opacity: 0.6,
  },
  sectionLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 10,
    letterSpacing: 4,
    color: COLORS.goldDim,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  optionsBlock: {
    gap: SPACING.xs,
  },
  optionBtn: {
    backgroundColor: 'rgba(26,23,20,0.82)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
  },
  optionBtnDisabled: {
    opacity: 0.4,
  },
  optionLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 17,
    color: COLORS.marble,
    fontWeight: '700',
  },
  optionLabelDisabled: {
    color: COLORS.dust,
  },
  optionSub: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    marginTop: 2,
  },
  loadBlock: {
    gap: SPACING.xs,
  },
  loadBtn: {
    backgroundColor: 'rgba(26,23,20,0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  loadLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 14,
    color: COLORS.dust,
    letterSpacing: 1,
  },
});
