import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Character } from '../../models/character';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const PLAYER_PORTRAIT = require('../../assets/images/portrait-paterfamilias.png');
const COIN            = require('../../assets/images/ornament-coin.png');
const MOSAIC_BORDER   = require('../../assets/images/border-mosaic.png');

const NPC_PORTRAITS: Record<string, ReturnType<typeof require>> = {
  'npc-wife':     require('../../assets/images/npc-wife.png'),
  'npc-son':      require('../../assets/images/npc-son.png'),
  'npc-daughter': require('../../assets/images/npc-daughter.png'),
};

const SKILL_COLORS: Record<string, string> = {
  rhetoric:   COLORS.denariiColor,
  auctoritas: COLORS.dignitasColor,
  martial:    COLORS.crimson,
  intrigus:   COLORS.purple,
};

// Portrait size and how much the mosaic border overlaps it on each side.
// The border image has its own internal padding (the decorative ring width),
// so we size the overlay larger than the portrait and centre it over it.
const PORTRAIT_SIZE   = 96;
const BORDER_OVERFLOW = 14;   // px each side the border frame extends beyond portrait
const BORDER_SIZE     = PORTRAIT_SIZE + BORDER_OVERFLOW * 2;

interface CharacterProfilePaneProps {
  character: Character;
}

export default function CharacterProfilePane({ character }: CharacterProfilePaneProps) {
  const portraitSource = character.isPlayer
    ? PLAYER_PORTRAIT
    : NPC_PORTRAITS[character.id] ?? null;

  return (
    <View style={styles.profilePane}>
      {/* Corner coin ornaments */}
      <Image source={COIN} style={styles.coinTL} />
      <Image source={COIN} style={styles.coinTR} />
      <Image source={COIN} style={styles.coinBL} />
      <Image source={COIN} style={styles.coinBR} />

      {/* Inner dashed border */}
      <View style={styles.innerFrame}>
        <View style={styles.profileHeader}>

          {/* Portrait + mosaic overlay */}
          <View style={styles.portraitContainer}>
            {portraitSource ? (
              <Image source={portraitSource} style={styles.portrait} />
            ) : (
              <View style={styles.portraitPlaceholder}>
                <Text style={{ fontSize: 36 }}>
                  {character.role === 'spouse' ? '👩' : character.role === 'son' ? '👦' : '👧'}
                </Text>
              </View>
            )}
            {/* Mosaic border overlaid on top, centred over the portrait */}
            <Image
              source={MOSAIC_BORDER}
              style={styles.mosaicOverlay}
              resizeMode="stretch"
            />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{character.name}</Text>
            <Text style={styles.profileRole}>
              {character.role.charAt(0).toUpperCase() + character.role.slice(1)} · Age {character.age}
            </Text>
            <Text style={styles.profileAmbition}>
              {character.ambition
                ? `Ambition: ${character.ambition.type.replace(/_/g, ' ')}`
                : 'No ambition'}
            </Text>
            <Text style={styles.profileTrust}>
              Family trust: {character.familyTrust}
            </Text>
          </View>
        </View>

        {/* Skill stat bars */}
        <View style={styles.skillBars}>
          {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const).map((sk) => {
            const pct = Math.min(1, Math.max(0, character.skills[sk] / 10));
            const color = SKILL_COLORS[sk];
            return (
              <View key={sk} style={styles.statRow}>
                <Text style={styles.statLabel}>{sk.toUpperCase()}</Text>
                <View style={styles.statTrack}>
                  <View style={[styles.statFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.statValue, { color }]}>{character.skills[sk]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profilePane: {
    position: 'relative',
    overflow: 'visible',
    backgroundColor: 'rgba(20, 15, 10, 0.85)',
    borderWidth: 3,
    borderColor: COLORS.goldBorder,
    borderRadius: RADIUS.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  coinTL: { position: 'absolute', width: 32, height: 32, top: -10, left: -10 },
  coinTR: { position: 'absolute', width: 32, height: 32, top: -10, right: -10 },
  coinBL: { position: 'absolute', width: 32, height: 32, bottom: -10, left: -10 },
  coinBR: { position: 'absolute', width: 32, height: 32, bottom: -10, right: -10 },
  innerFrame: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderStyle: 'dashed',
    margin: 6,
    padding: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'center',
  },

  // Portrait sits inside a container that is PORTRAIT_SIZE square.
  // The mosaic overlay is absolutely positioned, larger than the portrait,
  // centred via negative margins so it bleeds beyond all four edges equally.
  portraitContainer: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    marginRight: SPACING.md,
    // Extra space so the overflow border isn't clipped
    marginLeft: BORDER_OVERFLOW,
    marginTop: BORDER_OVERFLOW,
    marginBottom: BORDER_OVERFLOW,
  },
  portrait: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: RADIUS.sm,
  },
  portraitPlaceholder: {
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.portraitPlaceholder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mosaicOverlay: {
    position: 'absolute',
    width: BORDER_SIZE,
    height: BORDER_SIZE,
    top: -BORDER_OVERFLOW,
    left: -BORDER_OVERFLOW,
  },

  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.marble,
    letterSpacing: 0.5,
  },
  profileRole: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    marginTop: 3,
  },
  profileAmbition: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.gold,
    marginTop: 3,
  },
  profileTrust: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  },
  skillBars: {
    gap: 8,
    marginTop: SPACING.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: COLORS.marble,
    width: 84,
  },
  statTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1a1714',
    borderRadius: 3,
    overflow: 'hidden',
  },
  statFill: {
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: SPACING.sm,
    width: 16,
    textAlign: 'right',
  },
});
