import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EndSeasonButton from '../components/shared/EndSeasonButton';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../utils/theme';

export default function ProvinciaeScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>PROVINCIAE</Text>
        <Text style={styles.subtitle}>The Executive View</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.icon}>🗺</Text>
        <Text style={styles.heading}>Coming in a Future Update</Text>
        <Text style={styles.body}>
          The Provinciae will bring an interactive map of Rome's territories, governorship
          assignments, the Squeeze Slider — balancing taxation against corruption — and the
          Imperium resource driven by your Martial skill.
        </Text>
        <View style={styles.divider} />
        <Text style={styles.teaser}>Features planned for v3:</Text>
        {[
          'Interactive province map with node network',
          'Governor assignment and term management',
          'Squeeze Slider — tax policy vs. corruption risk',
          'Imperium resource (Martial skill driver)',
          'Corruption Score and prosecution trials',
          'Provincial road and infrastructure building',
        ].map((f) => (
          <Text key={f} style={styles.feature}>· {f}</Text>
        ))}
      </View>

      <EndSeasonButton />
      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  icon: { fontSize: 48, marginBottom: SPACING.md },
  heading: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: SPACING.md },
  body: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.md },
  divider: { height: 1, backgroundColor: COLORS.border, width: '100%', marginBottom: SPACING.md },
  teaser: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: SPACING.sm },
  feature: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 13, alignSelf: 'flex-start', marginBottom: 4, lineHeight: 18 },
});
