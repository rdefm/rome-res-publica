/**
 * ParchmentCard — reusable parchment card for use across all tabs.
 * Place at: src/components/shared/ParchmentCard.tsx
 */
import React from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';

const PARCHMENT_IMG = require('../../assets/images/card-parchment-cropped.png');

export const PARCHMENT_TEXT = {
  heading: '#3a2810',
  body:    '#5a3e22',
  muted:   '#8a6a44',
  gold:    '#7a5a10',
  border:  '#c8a870',
};

interface ParchmentCardProps {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
  selected?: boolean;
}

export default function ParchmentCard({ children, contentStyle, style, selected }: ParchmentCardProps) {
  return (
    <ImageBackground
      source={PARCHMENT_IMG}
      resizeMode="cover"
      style={[styles.shell, selected && styles.selected, style]}
      imageStyle={styles.image}
    >
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  selected: {
    borderWidth: 2,
    borderColor: '#c9a84c',
  },
  // imageStyle targets the underlying <Image> inside ImageBackground.
  // top/left/right/bottom: 0 with width/height 100% forces it to fill
  // the entire shell rather than anchoring to top-left corner.
  image: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 10,
  },
});
