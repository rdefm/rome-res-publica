/**
 * ScrollModal — reusable modal shell that renders content on the parchment scroll asset.
 * Includes a fade-to-parchment gradient at the bottom to indicate scrollable content.
 */

import React, { useState } from 'react';
import {
  View, Text, Image, Modal, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../utils/theme';

const SCROLL_IMG = require('../../assets/images/scroll.png');

const ASSET_W = 343;
const ASSET_H = 728;

const SCREEN_W  = Dimensions.get('window').width;
const SCREEN_H  = Dimensions.get('window').height;

// Cap scroll height at 72% of screen height to avoid full-screen takeover
const MAX_SCROLL_H = Math.round(SCREEN_H * 0.72);
const NATURAL_W    = Math.round(SCREEN_W * 0.88);
const NATURAL_H    = Math.round(NATURAL_W * ASSET_H / ASSET_W);
const SCALE        = NATURAL_H > MAX_SCROLL_H ? MAX_SCROLL_H / NATURAL_H : 1;
const SCROLL_W     = Math.round(NATURAL_W * SCALE);
const SCROLL_H     = Math.round(NATURAL_H * SCALE);

const INSET_TOP    = Math.round(SCROLL_H * 0.13);
const INSET_BOTTOM = Math.round(SCROLL_H * 0.10);
const INSET_SIDE   = Math.round(SCROLL_W * 0.08);

// Height of the fade gradient — tall enough to be obvious, not so tall it hides content
const FADE_HEIGHT = 48;

// Parchment colour to fade into — matches the bottom of the scroll body
const PARCHMENT_FADE = 'rgba(224, 200, 155, 1)';
const PARCHMENT_FADE_CLEAR = 'rgba(224, 200, 155, 0)';

// ─── On-parchment colour palette ─────────────────────────────────────────────
export const PARCHMENT = {
  heading:    '#3a2810',
  body:       '#5a3e22',
  muted:      '#8a6a44',
  gold:       '#7a5a10',
  border:     '#c8a870',
  pill:       '#e8d8b0',
  pillActive: '#c8a050',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ScrollModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade' | 'none';
}

export default function ScrollModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  animationType = 'slide',
}: ScrollModalProps) {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  function handleContentSizeChange(_w: number, contentH: number) {
    const contentAreaH = SCROLL_H - INSET_TOP - INSET_BOTTOM;
    setIsScrollable(contentH > contentAreaH);
  }

  function handleScroll(e: any) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 8;
    setIsScrolledToBottom(atBottom);
  }

  const showFade = isScrollable && !isScrolledToBottom;

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent
      presentationStyle="overFullScreen"
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.positioner} pointerEvents="box-none">
        <View style={styles.scrollContainer}>
          <Image
            source={SCROLL_IMG}
            style={styles.scrollImage}
            resizeMode="stretch"
          />

          <View style={styles.contentArea}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {(title || subtitle) && <View style={styles.divider} />}

            {/* ScrollView with fade indicator */}
            <View style={styles.scrollWrapper}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                onContentSizeChange={handleContentSizeChange}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
              >
                {children}
                {/* Bottom padding so last item isn't hidden behind the fade */}
                {showFade && <View style={{ height: FADE_HEIGHT }} />}
              </ScrollView>

              {/* Parchment fade gradient — only shown when more content is below */}
              {showFade && (
                <LinearGradient
                  colors={[PARCHMENT_FADE_CLEAR, PARCHMENT_FADE]}
                  style={styles.fadeGradient}
                  pointerEvents="none"
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  positioner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    width: SCROLL_W,
    height: SCROLL_H,
  },
  scrollImage: {
    position: 'absolute',
    width: SCROLL_W,
    height: SCROLL_H,
  },
  contentArea: {
    position: 'absolute',
    top: INSET_TOP,
    bottom: INSET_BOTTOM,
    left: INSET_SIDE,
    right: INSET_SIDE,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 17,
    color: PARCHMENT.heading,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: PARCHMENT.muted,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: PARCHMENT.border,
    marginVertical: 10,
    marginHorizontal: 8,
    opacity: 0.6,
  },
  scrollWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 4,
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
    borderRadius: 4,
  },
});
