import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import type { Character } from '../../models/character';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

interface Props {
  character: Character;
  visible: boolean;
  onClose: () => void;
}

const SKILL_LABELS: Record<string, string> = {
  rhetoric: 'Rhetoric',
  auctoritas: 'Auctoritas',
  martial: 'Martial',
  intrigus: 'Intrigus',
};

export default function CharacterActionModal({ character, visible, onClose }: Props) {
  const { gravitas, dignitas, trainCharacter } = useGameStore();
  const [selectedSkill, setSelectedSkill] = useState<keyof Character['skills']>('rhetoric');

  function doAction(skillKey: keyof Character['skills'], cost: number) {
    trainCharacter(character.id, skillKey, cost);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{character.name}</Text>
        <Text style={styles.subtitle}>{character.role} · Age {character.age}</Text>

        <ScrollView>
          {character.isPlayer ? (
            <>
              <ActionButton
                label="Study Rhetoric"
                cost="5 Gravitas"
                desc="70% chance: Rhetoric +1"
                disabled={gravitas < 5}
                onPress={() => doAction('rhetoric', 5)}
                resource="gravitas"
              />
              <ActionButton
                label="Attend Senate Sessions"
                cost="5 Gravitas"
                desc="70% chance: Auctoritas +1"
                disabled={gravitas < 5}
                onPress={() => doAction('auctoritas', 5)}
                resource="gravitas"
              />
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Choose skill to train:</Text>
              <View style={styles.skillPills}>
                {(Object.keys(SKILL_LABELS) as Array<keyof Character['skills']>).map((sk) => (
                  <TouchableOpacity
                    key={sk}
                    style={[styles.pill, selectedSkill === sk && styles.pillActive]}
                    onPress={() => setSelectedSkill(sk)}
                  >
                    <Text style={[styles.pillText, selectedSkill === sk && styles.pillTextActive]}>
                      {SKILL_LABELS[sk]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ActionButton
                label="Hire a Tutor"
                cost="8 Dignitas"
                desc={`60% chance: ${SKILL_LABELS[selectedSkill]} +1`}
                disabled={dignitas < 8}
                onPress={() => doAction(selectedSkill, 8)}
                resource="dignitas"
              />
              <ActionButton
                label="Military Training"
                cost="6 Dignitas"
                desc="65% chance: Martial +1. Relationship +5."
                disabled={dignitas < 6}
                onPress={() => doAction('martial', 6)}
                resource="dignitas"
              />
              <ActionButton
                label="Assign to Patron"
                cost="4 Dignitas"
                desc="50% chance: Rhetoric or Auctoritas +1 (random)"
                disabled={dignitas < 4}
                onPress={() => doAction(Math.random() < 0.5 ? 'rhetoric' : 'auctoritas', 4)}
                resource="dignitas"
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ActionButton({
  label, cost, desc, disabled, onPress, resource,
}: {
  label: string;
  cost: string;
  desc: string;
  disabled: boolean;
  onPress: () => void;
  resource: 'gravitas' | 'dignitas';
}) {
  const resColor = resource === 'gravitas' ? COLORS.gravitasColor : COLORS.dignitasColor;
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.actionRow}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={[styles.actionCost, { color: resColor }]}>{cost}</Text>
      </View>
      <Text style={styles.actionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: COLORS.panelSurface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  skillPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.md,
  },
  pill: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pillActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldDim + '33',
  },
  pillText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  pillTextActive: {
    color: COLORS.gold,
  },
  actionBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
  },
  actionCost: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  actionDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 2,
  },
});
