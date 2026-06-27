import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Character } from '../../models/character';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const PLAYER_PORTRAIT = require('../../assets/images/portrait-paterfamilias.png');
const COIN = require('../../assets/images/ornament-coin.png');

const NPC_PORTRAITS: Record<string, ReturnType<typeof require>> = {
  'npc-wife':      require('../../assets/images/npc-wife.png'),
  'npc-son':       require('../../assets/images/npc-son.png'),
  'npc-daughter':  require('../../assets/images/npc-daughter.png'),
};

const SKILL_COLORS: Record<string, string> = {
  rhetoric:   COLORS.denariiColor,
  auctoritas: COLORS.dignitasColor,
  martial:    COLORS.crimson,
  intrigus:   COLORS.purple,
};

interface CharacterProfilePaneProps {
  character: Character;
}

export default function CharacterProfilePane({ character }: CharacterProfilePaneProps) {
  return (
    <View style={styles.profilePane}>
      {/* Corner coin ornaments — positioned absolute, overflow visible on parent */}
      <Image source={COIN} style={styles.coinTL} />
      <Image source={COIN} style={styles.coinTR} />
      <Image source={COIN} style={styles.coinBL} />
      <Image source={COIN} style={styles.coinBR} />

      {/* Inner dashed border wrapping all content */}
      <View style={styles.innerFrame}>
        <View style={styles.profileHeader}>
          {character.isPlayer ? (
            <Image source={PLAYER_PORTRAIT} style={styles.portrait} />
          ) : NPC_PORTRAITS[character.id] ? (
            <Image source={NPC_PORTRAITS[character.id]} style={styles.portrait} />
          ) : (
            <View style={styles.portraitPlaceholder}>
              <Text style={{ fontSize: 40 }}>
                {character.role === 'spouse' ? '👩' : character.role === 'son' ? '👦' : '👧'}
              </Text>
            </View>
          )}

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

        {/* Skill stat bars — rendered inline because StatBar has no trackColor prop */}
        <View style={styles.skillBars}>
          {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const).map((sk) => {
            const pct = Math.min(1, Math.max(0, character.skills[sk] / 10));
            const color = SKILL_COLORS[sk];
            return (
              <View key={sk} style={styles.statRow}>
                <Text style={styles.statLabel}>
                  {sk.charAt(0).toUpperCase() + sk.slice(1)}
                </Text>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      { width: `${pct * 100}%`, backgroundColor: color },
                    ]}
                  />
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
  },
  portrait: {
    width: 96,
    height: 96,
    borderWidth: 3,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.md,
  },
  portraitPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.portraitPlaceholder,
    marginRight: SPACING.md,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 17,
    fontWeight: '700',
  },
  profileRole: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 2,
  },
  profileAmbition: {
    color: COLORS.gold,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 3,
  },
  profileTrust: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 2,
  },
  skillBars: {
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.marble,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: 80,
  },
  statTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1a1714',
    borderRadius: 3,
    marginLeft: SPACING.sm,
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
