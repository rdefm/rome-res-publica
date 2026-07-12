import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS } from '../../utils/theme';
import type { ProvinceState, ProvinceDefinition } from '../../models/province';
import { getRelationshipTier } from '../../models/province';
import { ALL_PROVINCES } from '../../data/provinceDefinitions';

// ─── Layout ───────────────────────────────────────────────────────────────────
//
// Simple approach: render the image at full screen width, height derived from
// the PNG's natural aspect ratio (992×1072). No cropping. The transparent
// scroll border in the PNG will show the parchment background colour.
// Node positions are fractions of the rendered image dimensions.
//
// Mediterranean provinces (Sicily/Corsica/Sardinia/Africa) are pinned to this
// same Italia map — Corsica, Sardinia and the NE tip of Sicily are actually
// drawn on it; the rest are placeholder positions in the open sea/parchment
// margin until a dedicated Mediterranean map asset exists. See the note atop
// MEDITERRANEAN_PROVINCES in provinceDefinitions.ts.

const SCREEN_WIDTH = Dimensions.get('window').width;

const PNG_W = 992;
const PNG_H = 1072;

const MAP_WIDTH  = SCREEN_WIDTH;
const MAP_HEIGHT = SCREEN_WIDTH * (PNG_H / PNG_W); // maintains true aspect ratio

const NODE_SIZE = 28;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeColour(
  province: ProvinceState,
  def: ProvinceDefinition
): { fill: string; border: string } {
  if (def.status === 'heartland') return { fill: COLORS.gold,    border: '#a07828' };
  // Foreign territory is coloured by owner rather than by Rome's posting/revolt state —
  // Rome has no Governor/Ambassador there yet, so those signals don't apply.
  if (province.status === 'foreign') {
    if (province.owner === 'carthage') return { fill: '#4a2a5a', border: '#7a4a8a' };
    return { fill: '#3a5a5a', border: '#5a8a8a' }; // independent
  }
  if (province.revoltActive)     return { fill: '#8b1a1a',       border: '#cc2222' };
  if (province.playerGovernor)   return { fill: '#c47a4a',       border: '#e8963c' };
  if (province.playerAmbassador) return { fill: '#5a8aaa',       border: '#7ab0cc' };
  const tier = getRelationshipTier(province.relationshipScore);
  if (tier === 'hostile' || tier === 'restless') return { fill: '#6b3030', border: '#8b4444' };
  return { fill: '#5a6b3a', border: '#7a8a50' };
}

function getRelPillColour(score: number): string {
  if (score <= 15) return COLORS.crimson;
  if (score <= 30) return '#c07030';
  if (score <= 50) return COLORS.dust;
  if (score <= 70) return '#8aaa6a';
  return COLORS.laurel;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MapViewProps {
  provinces: ProvinceState[];
  onProvincePress: (provinceId: string) => void;
  selectedProvinceId: string | null;
}

export default function MapView({ provinces, onProvincePress, selectedProvinceId }: MapViewProps) {
  return (
    <View style={styles.container}>
      {/* Parchment background fills the transparent border areas in the PNG */}
      <View style={styles.parchmentBg} />

      <Image
        source={require('../../assets/images/map_italia.png')}
        style={styles.mapImage as ImageStyle}
        resizeMode="stretch"
      />

      {ALL_PROVINCES.map(def => {
        const province = provinces.find(p => p.id === def.id);
        if (!province) return null;

        // nodeX and nodeY are fractions of the full rendered image (MAP_WIDTH × MAP_HEIGHT)
        const left = def.nodeX * MAP_WIDTH  - NODE_SIZE / 2;
        const top  = def.nodeY * MAP_HEIGHT - NODE_SIZE / 2;

        const { fill, border } = getNodeColour(province, def);
        const isSelected  = selectedProvinceId === def.id;
        const isHeartland = def.status === 'heartland';
        const isForeign   = province.status === 'foreign';

        return (
          <TouchableOpacity
            key={def.id}
            onPress={() => onProvincePress(def.id)}
            style={[styles.nodeWrapper, { left, top }]}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {province.ownedAssets.length > 0 && !isHeartland && !isForeign && (
              <View style={[styles.assetRing, { borderColor: COLORS.denariiColor }]} />
            )}

            <View
              style={[
                styles.node,
                {
                  backgroundColor: fill,
                  borderColor:  isSelected ? '#ffffff' : border,
                  borderWidth:  isSelected ? 3 : 2,
                  shadowColor:  province.revoltActive ? '#cc2222' : fill,
                  shadowOpacity: province.revoltActive ? 0.9 : 0.6,
                  shadowRadius:  province.revoltActive ? 10 : 5,
                  elevation:     isSelected ? 10 : 5,
                },
              ]}
            >
              {province.revoltActive && <Text style={styles.nodeIcon}>⚔</Text>}
              {(province.playerGovernor || province.playerAmbassador) && !province.revoltActive && (
                <Text style={styles.nodeIcon}>★</Text>
              )}
            </View>

            <View style={styles.labelContainer}>
              <Text
                style={[
                  styles.nodeLabel,
                  isSelected  && styles.nodeLabelSelected,
                  isHeartland && styles.nodeLabelHeartland,
                ]}
                numberOfLines={2}
              >
                {def.name.toUpperCase()}
              </Text>
              {!isHeartland && (
                <Text style={[styles.relPill, { color: getRelPillColour(province.relationshipScore) }]}>
                  {Math.round(province.relationshipScore)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width:    MAP_WIDTH,
    height:   MAP_HEIGHT,
    position: 'relative',
  } as ViewStyle,

  parchmentBg: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#c8a86a',
  } as ViewStyle,

  mapImage: {
    position: 'absolute',
    top:    0,
    left:   0,
    width:  MAP_WIDTH,
    height: MAP_HEIGHT,
  } as ImageStyle,

  nodeWrapper: {
    position: 'absolute',
    width:    NODE_SIZE,
    height:   NODE_SIZE,
    alignItems: 'center',
  } as ViewStyle,

  assetRing: {
    position:     'absolute',
    width:        NODE_SIZE + 10,
    height:       NODE_SIZE + 10,
    borderRadius: (NODE_SIZE + 10) / 2,
    borderWidth:  2,
    top:  -5,
    left: -5,
  } as ViewStyle,

  node: {
    width:        NODE_SIZE,
    height:       NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems:   'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
  } as ViewStyle,

  nodeIcon: {
    fontSize:   12,
    color:      '#fff',
    lineHeight: 14,
  } as TextStyle,

  labelContainer: {
    position: 'absolute',
    top:   NODE_SIZE + 3,
    left:  -34,
    width: NODE_SIZE + 68,
    alignItems: 'center',
  } as ViewStyle,

  nodeLabel: {
    color:      '#fff',
    fontFamily: FONTS.ui,
    fontSize:   8,
    letterSpacing: 0.5,
    textAlign:  'center',
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    fontWeight: '700',
  } as TextStyle,

  nodeLabelSelected: {
    color: COLORS.gold,
  } as TextStyle,

  nodeLabelHeartland: {
    color:    COLORS.gold,
    fontSize: 9,
  } as TextStyle,

  relPill: {
    fontFamily:  FONTS.ui,
    fontSize:    8,
    marginTop:   1,
    textShadowColor:  '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    fontWeight:  '700',
  } as TextStyle,
});
