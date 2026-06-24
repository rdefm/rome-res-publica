import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import type { Character } from '../../models/character';
import { useGameStore } from '../../state/gameStore';
import { getAmbitionDefinition } from '../../engine/ambitionEngine';
import { TRAIT_DEFINITIONS } from '../../data/traits';
import type { ActiveAmbition } from '../../models/ambition';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

interface Props {
  character: Character;
  visible: boolean;
  onClose: () => void;
}

const SKILL_LABELS: Record<string, string> = {
  rhetoric:   'Rhetoric',
  auctoritas: 'Auctoritas',
  martial:    'Martial',
  intrigus:   'Intrigus',
};

// ─── Ambition tracker (player) ────────────────────────────────────────────────

function PlayerAmbitionTracker({ characterId }: { characterId: string }) {
  const { ambitions } = useGameStore();

  const active = ambitions.filter(
    a => a.status === 'active' &&
      (a.scope === 'family' || a.assignedCharacterId === characterId)
  );
  const completed = ambitions.filter(a => a.status === 'completed');
  const expired = ambitions.filter(a => a.status === 'expired');

  if (active.length === 0 && completed.length === 0) {
    return (
      <View style={at.container}>
        <Text style={at.heading}>AMBITIONS</Text>
        <Text style={at.empty}>No active ambitions. End the season to select one.</Text>
      </View>
    );
  }

  return (
    <View style={at.container}>
      <Text style={at.heading}>AMBITIONS</Text>

      {active.map(a => <ActiveAmbitionRow key={a.definitionId} ambition={a} />)}

      {completed.length > 0 && (
        <>
          <Text style={at.subheading}>COMPLETED</Text>
          {completed.map(a => <CompletedAmbitionRow key={a.definitionId} ambition={a} />)}
        </>
      )}

      {expired.length > 0 && (
        <>
          <Text style={[at.subheading, { color: COLORS.crimson }]}>EXPIRED</Text>
          {expired.map(a => <ExpiredAmbitionRow key={a.definitionId} ambition={a} />)}
        </>
      )}
    </View>
  );
}

function ActiveAmbitionRow({ ambition }: { ambition: ActiveAmbition }) {
  const def = getAmbitionDefinition(ambition.definitionId);
  if (!def) return null;

  const isExpiring = ambition.turnsRemaining !== undefined && ambition.turnsRemaining <= 5;

  return (
    <View style={at.row}>
      <View style={at.rowHeader}>
        <Text style={at.scopeBadge}>{ambition.scope === 'family' ? '🏛️' : '👤'}</Text>
        <Text style={at.rowTitle}>{def.title}</Text>
        {ambition.turnsRemaining !== undefined && (
          <Text style={[at.turns, isExpiring && at.turnsUrgent]}>
            {ambition.turnsRemaining}t
          </Text>
        )}
      </View>
      <Text style={at.rowDesc}>{def.description}</Text>
    </View>
  );
}

function CompletedAmbitionRow({ ambition: a }: { ambition: ActiveAmbition }) {
  const def = getAmbitionDefinition(a.definitionId);
  if (!def) return null;
  return (
    <View style={[at.row, at.rowDone]}>
      <Text style={at.rowTitleDone}>✓ {def.title}</Text>
    </View>
  );
}

function ExpiredAmbitionRow({ ambition: a }: { ambition: ActiveAmbition }) {
  const def = getAmbitionDefinition(a.definitionId);
  if (!def) return null;
  return (
    <View style={[at.row, at.rowExpired]}>
      <Text style={at.rowTitleExpired}>✗ {def.title}</Text>
    </View>
  );
}

const at = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  heading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  subheading: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  empty: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
  },
  row: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  rowDone: {
    opacity: 0.5,
    borderColor: COLORS.laurel,
  },
  rowExpired: {
    opacity: 0.4,
    borderColor: COLORS.crimson,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  scopeBadge: {
    fontSize: 12,
  },
  rowTitle: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  rowTitleDone: {
    color: COLORS.laurel,
    fontFamily: FONTS.display,
    fontSize: 12,
  },
  rowTitleExpired: {
    color: COLORS.crimson,
    fontFamily: FONTS.display,
    fontSize: 12,
  },
  rowDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
  },
  turns: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  turnsUrgent: {
    color: COLORS.denariiColor,
    fontWeight: '700',
  },
});

// ─── NPC ambition display ─────────────────────────────────────────────────────

function NpcAmbitionDisplay({ character }: { character: Character }) {
  const { ambitions } = useGameStore();

  const charAmbitions = ambitions.filter(
    a => a.assignedCharacterId === character.id && a.status === 'active'
  );

  if (charAmbitions.length === 0 && character.ambitionIds.length === 0) {
    return null;
  }

  return (
    <View style={npc.container}>
      <Text style={npc.heading}>AMBITION</Text>
      {charAmbitions.map(a => {
        const def = getAmbitionDefinition(a.definitionId);
        if (!def) return null;
        return (
          <View key={a.definitionId} style={npc.row}>
            <Text style={npc.title}>{def.title}</Text>
            <Text style={npc.desc}>{def.description}</Text>
          </View>
        );
      })}
      {charAmbitions.length === 0 && (
        <Text style={npc.desc}>
          {character.ambition
            ? `Aspires to: ${character.ambition.type.replace(/_/g, ' ')}`
            : 'No current ambition'}
        </Text>
      )}
    </View>
  );
}

const npc = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  heading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  row: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  title: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  desc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
  },
});


// ─── Trait badges with inline expansion ──────────────────────────────────────

function TraitBadges({ character }: { character: Character }) {
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);

  const allTraitIds = [
    ...character.traits,
    ...character.inheritedTraits,
  ];

  if (allTraitIds.length === 0) return null;

  return (
    <View style={tb.container}>
      <Text style={tb.heading}>TRAITS</Text>
      <View style={tb.pills}>
        {allTraitIds.map(id => {
          const def = TRAIT_DEFINITIONS.find(t => t.id === id);
          const isPersonality = character.traits.includes(id as any);
          const isInherited = character.inheritedTraits.includes(id);
          const isExpanded = expandedTrait === id;
          const label = def?.name ?? id;

          return (
            <View key={id}>
              <TouchableOpacity
                style={[
                  tb.pill,
                  isInherited && tb.pillInherited,
                  isExpanded && tb.pillExpanded,
                ]}
                onPress={() => setExpandedTrait(prev => (prev === id ? null : id))}
              >
                {isInherited && <Text style={tb.inheritIcon}>🧬 </Text>}
                <Text style={[tb.pillText, isInherited && tb.pillTextInherited]}>
                  {label}
                </Text>
              </TouchableOpacity>

              {isExpanded && def && (
                <View style={tb.detail}>
                  <Text style={tb.detailDesc}>{def.description}</Text>
                  {Object.keys(def.skillModifiers ?? {}).length > 0 && (
                    <Text style={tb.detailMods}>
                      {Object.entries(def.skillModifiers ?? {})
                        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k.charAt(0).toUpperCase() + k.slice(1)}`)
                        .join(' · ')}
                    </Text>
                  )}
                  {def.resourceBonuses && Object.keys(def.resourceBonuses).length > 0 && (
                    <Text style={tb.detailMods}>
                      {Object.entries(def.resourceBonuses)
                        .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase() + k.slice(1)}/season`)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  heading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  pillInherited: {
    borderColor: COLORS.laurel,
  },
  pillExpanded: {
    backgroundColor: COLORS.panelElevated,
  },
  inheritIcon: {
    fontSize: 10,
  },
  pillText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  pillTextInherited: {
    color: COLORS.laurel,
  },
  detail: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  detailDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: 4,
  },
  detailMods: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

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

        <ScrollView showsVerticalScrollIndicator={false}>
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
              <TraitBadges character={character} />
              <PlayerAmbitionTracker characterId={character.id} />
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
              <TraitBadges character={character} />
              <NpcAmbitionDisplay character={character} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    maxHeight: '80%',
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
