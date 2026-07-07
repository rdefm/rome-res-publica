// GlossaryPopup — shows a single glossary term in a ScrollModal.
// Opened by InfoTap. If relatedTab is set, a deep-link navigates there and closes the popup.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { GLOSSARY_TERMS } from '../../data/glossaryTerms';
import ScrollModal, { PARCHMENT } from './ScrollModal';
import { FONTS, SPACING } from '../../utils/theme';

interface Props {
  termId: string;
  visible: boolean;
  onClose: () => void;
}

export default function GlossaryPopup({ termId, visible, onClose }: Props) {
  const requestNavigation = useGameStore(s => s.requestNavigation);
  const dismissAgenda     = useGameStore(s => s.dismissAgenda);

  const term = GLOSSARY_TERMS.find(t => t.id === termId);
  if (!term) return null;

  function handleDeepLink() {
    if (!term?.relatedTab) return;
    requestNavigation({ tab: term.relatedTab });
    dismissAgenda();
    onClose();
  }

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={term.term.toUpperCase()}
      animationType="fade"
    >
      <View style={styles.body}>
        <Text style={styles.definition}>{term.definition}</Text>

        {term.relatedTab && (
          <TouchableOpacity style={styles.link} onPress={handleDeepLink} activeOpacity={0.75}>
            <Text style={styles.linkText}>See it in the {term.relatedTab} →</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
          <Text style={styles.closeTxt}>Dismiss</Text>
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
  definition: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    color: PARCHMENT.body,
    lineHeight: 22,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  link: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  linkText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: PARCHMENT.gold,
    letterSpacing: 0.5,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: 4,
  },
  closeTxt: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: PARCHMENT.muted,
    letterSpacing: 1,
  },
});
