// LedgerBlock — compact season-delta display.
// Renders non-zero resource, crisis, and Rome deltas from a SeasonLedger.
// Used by SeasonOverlay (end-of-season) and WelcomeBackModal (return-from-absence).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SeasonLedger } from '../../models/ledger';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

// ─── Sign formatting ──────────────────────────────────────────────────────────

function sign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function deltaColor(n: number): string {
  if (n > 0) return COLORS.laurel;
  if (n < 0) return COLORS.crimson;
  return COLORS.dust;
}

// ─── Single delta row ─────────────────────────────────────────────────────────

function DeltaRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: deltaColor(value) }]}>{sign(value)}</Text>
    </View>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  // Only render if at least one child is non-null (i.e. has a non-zero delta)
  const hasContent = React.Children.toArray(children).some(c => c !== null && c !== false);
  if (!hasContent) return null;
  return <View style={styles.section}>{children}</View>;
}

// ─── Main component ──────────────────────────────────────────────────────────

interface LedgerBlockProps {
  ledger: SeasonLedger;
}

export default function LedgerBlock({ ledger }: LedgerBlockProps) {
  const { resourceDeltas: r, crisisDeltas: c, romeDeltas: ro } = ledger;

  const hasAnyDelta =
    r.fides !== 0 || r.denarii !== 0 || r.imperium !== 0 || r.lifetimeDignitas !== 0 ||
    c.war   !== 0 || c.unrest  !== 0 || c.constitution !== 0 || c.economy !== 0 ||
    ro.stability !== 0 || ro.plebs !== 0 || ro.treasury !== 0;

  if (!hasAnyDelta) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Philon records the season.</Text>

      {/* Resources */}
      <Section>
        <DeltaRow label="Fides"    value={r.fides} />
        <DeltaRow label="Denarii"  value={r.denarii} />
        <DeltaRow label="Imperium" value={r.imperium} />
        <DeltaRow label="Dignitas" value={r.lifetimeDignitas} />
      </Section>

      {/* Crisis tracks — positive delta is bad, so colour is inverted */}
      <Section>
        <DeltaRow label="War"          value={c.war} />
        <DeltaRow label="Unrest"       value={c.unrest} />
        <DeltaRow label="Constitution" value={c.constitution} />
        <DeltaRow label="Economy"      value={c.economy} />
      </Section>

      {/* Rome stats */}
      <Section>
        <DeltaRow label="Stability" value={ro.stability} />
        <DeltaRow label="Plebs"     value={ro.plebs} />
        <DeltaRow label="Treasury"  value={ro.treasury} />
      </Section>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: SPACING.sm,
  },
  header: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  label: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.dust,
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
});
