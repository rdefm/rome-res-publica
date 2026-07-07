import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS } from '../../utils/theme';
import { getCriticalItems } from '../../engine/agendaEngine';
import type { AgendaItem } from '../../models/agenda';
import ScrollModal, { PARCHMENT } from './ScrollModal';
import AgendaBadge from './AgendaBadge';

const MARBLE_BG = require('../../assets/images/btn-end-season-bg.png');

// Image is 949×263 — render at 70% screen width (down from 85%)
const SCREEN_WIDTH = Dimensions.get('window').width;
const BTN_WIDTH    = Math.round(SCREEN_WIDTH * 0.70);
const BTN_HEIGHT   = Math.round(BTN_WIDTH * (263 / 949));

export default function EndSeasonButton() {
  const { endSeason, seasonOverlayVisible, showAgenda } = useGameStore();

  const [warningVisible, setWarningVisible] = useState(false);
  const [criticalItems, setCriticalItems]   = useState<AgendaItem[]>([]);

  function handlePress() {
    // Check for critical items before processing the season
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

  // Items shown in the warning: up to 3, then "…and more"
  const shownItems  = criticalItems.slice(0, 3);
  const hiddenCount = criticalItems.length - 3;

  return (
    <View style={styles.floatWrapper}>
      <TouchableOpacity
        style={[styles.button, seasonOverlayVisible && styles.disabled]}
        onPress={handlePress}
        disabled={seasonOverlayVisible}
        activeOpacity={0.75}
      >
        <Image
          source={MARBLE_BG}
          style={styles.bgImage}
          resizeMode="stretch"
        />
        <View style={styles.content}>
          <Text style={styles.label}>END SEASON</Text>
          <Text style={styles.sub}>Process Year</Text>
        </View>
      </TouchableOpacity>

      {/* Agenda badge — docked to the right of the marble button */}
      <AgendaBadge />

      {/* ── Philon's warning dialog ───────────────────────────────────────── */}
      <ScrollModal
        visible={warningVisible}
        onClose={() => setWarningVisible(false)}
        title="PHILON CLEARS HIS THROAT"
        animationType="fade"
      >
        <Text style={warnStyles.intro}>
          "Domine, before the season closes —"
        </Text>

        {shownItems.map(item => (
          <Text key={item.id} style={warnStyles.item}>
            · {item.title}
          </Text>
        ))}

        {hiddenCount > 0 && (
          <Text style={warnStyles.more}>
            …and {hiddenCount} more {hiddenCount === 1 ? 'matter' : 'matters'}.
          </Text>
        )}

        {/* Action buttons */}
        <View style={warnStyles.buttonRow}>
          <TouchableOpacity
            style={[warnStyles.btn, warnStyles.btnAttend]}
            onPress={handleAttend}
            activeOpacity={0.75}
          >
            <Text style={warnStyles.btnAttendText}>Let me attend to it</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[warnStyles.btn, warnStyles.btnEnd]}
            onPress={handleConfirmEnd}
            activeOpacity={0.75}
          >
            <Text style={warnStyles.btnEndText}>End the season anyway</Text>
          </TouchableOpacity>
        </View>
      </ScrollModal>
    </View>
  );
}

// ─── Main button styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  floatWrapper: {
    position: 'absolute',
    bottom: 12,
    width: BTN_WIDTH,
    left: (SCREEN_WIDTH - BTN_WIDTH) / 2,
  },
  button: {
    width: BTN_WIDTH,
    height: BTN_HEIGHT,
  },
  disabled: {
    opacity: 0.4,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BTN_WIDTH,
    height: BTN_HEIGHT,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sub: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 10,
    color: COLORS.dust,
    letterSpacing: 1,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ─── Philon warning dialog styles (on-parchment) ─────────────────────────────

const warnStyles = StyleSheet.create({
  intro: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    color: PARCHMENT.body,
    lineHeight: 21,
    marginBottom: 12,
    textAlign: 'center',
  },
  item: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PARCHMENT.body,
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  more: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: PARCHMENT.muted,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 8,
  },
  buttonRow: {
    marginTop: 16,
    gap: 8,
  },
  btn: {
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  // Primary: "Let me attend to it" — prominent, acts on the warning
  btnAttend: {
    backgroundColor: PARCHMENT.pillActive,
    borderColor: PARCHMENT.border,
  },
  btnAttendText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: PARCHMENT.heading,
  },
  // Secondary: dismiss and proceed
  btnEnd: {
    backgroundColor: 'transparent',
    borderColor: PARCHMENT.border,
  },
  btnEndText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: PARCHMENT.muted,
    letterSpacing: 0.5,
  },
});
