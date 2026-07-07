// WelcomeBackModal — shown on app foreground after 12+ hours away.
// Displays lastSeasonLedger with an adjusted "while you were away" header.
// Visible/dismiss state lives in App.tsx (local) — not in the store.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import LedgerBlock from './LedgerBlock';
import ScrollModal, { PARCHMENT } from './ScrollModal';
import { FONTS, SPACING } from '../../utils/theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function WelcomeBackModal({ visible, onDismiss }: Props) {
  const ledger = useGameStore(s => s.lastSeasonLedger);

  if (!ledger) return null;

  return (
    <ScrollModal
      visible={visible}
      onClose={onDismiss}
      title="WHILE YOU WERE AWAY"
      subtitle={ledger.seasonLabel}
      animationType="fade"
    >
      <View style={styles.body}>
        <Text style={styles.intro}>
          Philon has kept the records.
        </Text>

        <LedgerBlock ledger={ledger} />

        {/* Headlines */}
        {ledger.headlines.length > 0 && (
          <View style={styles.headlines}>
            {ledger.headlines.map((line, i) => (
              <Text key={i} style={styles.headline}>· {line}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>Resume</Text>
        </TouchableOpacity>
      </View>
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  intro: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: PARCHMENT.muted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  headlines: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: PARCHMENT.border,
    paddingTop: SPACING.sm,
  },
  headline: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PARCHMENT.body,
    lineHeight: 18,
    marginBottom: 4,
  },
  dismissBtn: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: 4,
  },
  dismissText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: PARCHMENT.heading,
    letterSpacing: 1,
  },
});
