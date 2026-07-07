// InfoTap — wraps its children and appends a subtle ⓘ glyph.
// Tapping the ⓘ opens GlossaryPopup for the given term.
// The ⓘ is its own TouchableOpacity, independent of children's press handlers —
// safe to use inside existing touchable containers.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import GlossaryPopup from './GlossaryPopup';
import { COLORS, FONTS } from '../../utils/theme';

interface InfoTapProps {
  termId: string;
  children: React.ReactNode;
  /** Extra style applied to the row wrapper. Use to override alignment for specific contexts. */
  style?: ViewStyle;
}

export default function InfoTap({ termId, children, style }: InfoTapProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <View style={[styles.wrapper, style]}>
        {children}
        <TouchableOpacity
          style={styles.glyph}
          onPress={() => setVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.glyphText}>ⓘ</Text>
        </TouchableOpacity>
      </View>

      <GlossaryPopup
        termId={termId}
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glyph: {
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glyphText: {
    fontSize: 13,
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    opacity: 0.7,
    lineHeight: 16,
  },
});
