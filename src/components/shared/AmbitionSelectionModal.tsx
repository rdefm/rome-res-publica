import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { drawAmbitions } from '../../engine/ambitionEngine';
import type { AmbitionDefinition } from '../../models/ambition';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Reward summary line ──────────────────────────────────────────────────────

function rewardSummary(def: AmbitionDefinition): string {
  const r = def.reward;
  const parts: string[] = [];
  if (r.gold)      parts.push(`+${r.gold} Denarii`);
  if (r.dignitas)  parts.push(`+${r.dignitas} Dignitas`);
  if (r.gravitas)  parts.push(`+${r.gravitas} Gravitas`);
  if (r.gratia)    parts.push(`+${r.gratia} Gratia`);
  if (r.imperium)  parts.push(`+${r.imperium} Imperium`);
  if (r.traitId)   parts.push(`Grants trait: ${r.traitId}`);
  if (r.assetId)   parts.push(`Grants asset: ${r.assetId}`);
  if (r.chainAmbitionId) parts.push('Chains to new ambition');
  return parts.join(' · ') || 'No direct reward';
}

// ─── Ambition card ────────────────────────────────────────────────────────────

function AmbitionCard({
  def,
  selected,
  onPress,
}: {
  def: AmbitionDefinition;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
          {def.title}
        </Text>
        {def.expiresInTurns && (
          <Text style={styles.expiry}>⏳ {def.expiresInTurns} seasons</Text>
        )}
      </View>
      <Text style={styles.cardDesc}>{def.description}</Text>
      <Text style={styles.cardFlavour}>"{def.flavourText}"</Text>
      <View style={styles.rewardRow}>
        <Text style={styles.rewardLabel}>REWARD: </Text>
        <Text style={styles.rewardValue}>{rewardSummary(def)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AmbitionSelectionModal() {
  const { pendingAmbitionScopes, ambitions, family, selectAmbition, dismissAmbitionSelection } = useGameStore();
  const player = family.find(c => c.isPlayer);

  const excludeIds = ambitions.map(a => a.definitionId);

  // Draw once on mount — useMemo so they don't shuffle on re-render
  const familyOptions = useMemo(() => drawAmbitions('family', 3, excludeIds), []);
  const characterOptions = useMemo(() => drawAmbitions('character', 3, excludeIds), []);

  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

  if (pendingAmbitionScopes.length === 0) return null;

  const needsFamily = pendingAmbitionScopes.includes('family');
  const needsCharacter = pendingAmbitionScopes.includes('character');

  function handleConfirm() {
    if (!selectedFamily) return; // family ambition required
    selectAmbition(selectedFamily, 'family');
    if (selectedCharacter && player) {
      selectAmbition(selectedCharacter, 'character', player.id);
    }
  }

  const canConfirm = (!needsFamily || !!selectedFamily) && (!needsCharacter || needsFamily || !!selectedCharacter);

  return (
    <Modal visible animationType="fade" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.heading}>CHOOSE YOUR AMBITIONS</Text>
          <Text style={styles.subheading}>
            Select one family ambition to pursue. A character ambition is optional.
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Family ambitions */}
            {needsFamily && (
              <>
                <Text style={styles.sectionLabel}>FAMILY AMBITION (required)</Text>
                {familyOptions.map(def => (
                  <AmbitionCard
                    key={def.id}
                    def={def}
                    selected={selectedFamily === def.id}
                    onPress={() => setSelectedFamily(def.id)}
                  />
                ))}
              </>
            )}

            {/* Character ambitions */}
            {needsCharacter && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: needsFamily ? SPACING.md : 0 }]}>
                  CHARACTER AMBITION — {player?.name ?? 'Player'}{needsFamily ? ' (optional)' : ' (required)'}
                </Text>
                {characterOptions.map(def => (
                  <AmbitionCard
                    key={def.id}
                    def={def}
                    selected={selectedCharacter === def.id}
                    onPress={() =>
                      setSelectedCharacter(prev => (prev === def.id ? null : def.id))
                    }
                  />
                ))}
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              <Text style={styles.confirmText}>
                {canConfirm
                  ? 'Set These Ambitions'
                  : needsFamily
                  ? 'Choose a family ambition first'
                  : 'Choose a character ambition'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={dismissAmbitionSelection}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,8,6,0.92)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modal: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    maxHeight: '90%',
  },
  heading: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    padding: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  subheading: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  scroll: {
    padding: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  // ── Ambition card ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.panelSurface,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardTitle: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  cardTitleSelected: {
    color: COLORS.gold,
  },
  expiry: {
    color: COLORS.denariiColor,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  cardDesc: {
    color: COLORS.marble,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginBottom: 3,
  },
  cardFlavour: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginBottom: SPACING.xs,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rewardLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  rewardValue: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
    flex: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  confirmBtn: {
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
    borderColor: COLORS.border,
  },
  confirmText: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    padding: SPACING.xs,
  },
  skipText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
});
