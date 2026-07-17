import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { TRAIT_DEFINITIONS } from '../../data/traits';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function BirthNamingModal() {
  const { pendingBirthNaming, confirmBirthNaming, dismissBirthNaming, family, gensPlural } = useGameStore();
  const [name, setName] = useState('');

  // Pre-fill with suggested name whenever a new birth arrives
  useEffect(() => {
    if (pendingBirthNaming) {
      setName(pendingBirthNaming.suggestedName);
    }
  }, [pendingBirthNaming?.suggestedName]);

  if (!pendingBirthNaming) return null;

  const { role, inheritedTraits } = pendingBirthNaming;
  const roleLabel = role === 'son' ? 'Son' : 'Daughter';
  const canConfirm = name.trim().length > 0;
  // Phase 5, Chunk P5-E — was hardcoded 'Livia'/'the Brutii', found during
  // the gens-neutrality sweep. Reads the actual mother's name rather than
  // assuming it, since a later marriage could change who she is.
  const motherName = family.find(c => c.role === 'spouse')?.name ?? 'Your wife';

  return (
    <Modal visible animationType="fade" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modal}>
          {/* Header */}
          <Text style={styles.heading}>A CHILD IS BORN</Text>
          <Text style={styles.sub}>
            {motherName} has delivered a healthy {roleLabel.toLowerCase()} to the {gensPlural}.{'\n'}
            Name this child and welcome them into the gens.
          </Text>

          {/* Name input */}
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={pendingBirthNaming.suggestedName}
            placeholderTextColor={COLORS.dust}
            selectionColor={COLORS.gold}
            autoFocus
            maxLength={40}
          />
          <Text style={styles.inputHint}>
            Suggested: {pendingBirthNaming.suggestedName}
          </Text>

          {/* Inherited traits */}
          {inheritedTraits.length > 0 && (
            <View style={styles.traitsSection}>
              <Text style={styles.fieldLabel}>INHERITED TRAITS</Text>
              <View style={styles.traitPills}>
                {inheritedTraits.map(id => {
                  const def = TRAIT_DEFINITIONS.find(t => t.id === id);
                  if (!def) return null;
                  return (
                    <View key={id} style={styles.traitPill}>
                      <Text style={styles.traitEmoji}>🧬</Text>
                      <Text style={styles.traitName}>{def.name}</Text>
                    </View>
                  );
                })}
              </View>
              {inheritedTraits.length === 0 && (
                <Text style={styles.noTraits}>No inherited traits this generation.</Text>
              )}
            </View>
          )}

          {/* Trait detail */}
          {inheritedTraits.length > 0 && (
            <ScrollView style={styles.traitDetail} showsVerticalScrollIndicator={false}>
              {inheritedTraits.map(id => {
                const def = TRAIT_DEFINITIONS.find(t => t.id === id);
                if (!def) return null;
                const modLines: string[] = [];
                const sm = def.skillModifiers;
                if (sm.rhetoric)   modLines.push(`${sm.rhetoric > 0 ? '+' : ''}${sm.rhetoric} Rhetoric`);
                if (sm.auctoritas) modLines.push(`${sm.auctoritas > 0 ? '+' : ''}${sm.auctoritas} Auctoritas`);
                if (sm.martial)    modLines.push(`${sm.martial > 0 ? '+' : ''}${sm.martial} Martial`);
                if (sm.intrigus)   modLines.push(`${sm.intrigus > 0 ? '+' : ''}${sm.intrigus} Intrigus`);
                const rb = def.resourceBonuses ?? {};
                if (rb.lifetimeDignitas) modLines.push(`+${rb.lifetimeDignitas} Dignitas/season`);
                if (rb.fides)            modLines.push(`+${rb.fides} Fides/season`);
                if (rb.imperium)         modLines.push(`+${rb.imperium} Imperium/season`);

                return (
                  <View key={id} style={styles.traitRow}>
                    <Text style={styles.traitRowName}>{def.name}</Text>
                    <Text style={styles.traitRowDesc}>{def.description}</Text>
                    {modLines.length > 0 && (
                      <Text style={styles.traitRowMods}>{modLines.join(' · ')}</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {inheritedTraits.length === 0 && (
            <Text style={styles.noTraits}>No inherited traits this generation.</Text>
          )}

          {/* Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={() => canConfirm && confirmBirthNaming(name.trim())}
              disabled={!canConfirm}
            >
              <Text style={styles.confirmText}>
                Welcome {name.trim() || '…'} to the {gensPlural}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={dismissBirthNaming}>
              <Text style={styles.dismissText}>Decide later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
    padding: SPACING.md,
    maxHeight: '90%',
  },
  heading: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  sub: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 16,
    minHeight: 44,
  },
  inputHint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  traitsSection: {
    marginBottom: SPACING.sm,
  },
  traitPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  traitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.laurel,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    gap: 4,
  },
  traitEmoji: {
    fontSize: 11,
  },
  traitName: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  traitDetail: {
    maxHeight: 140,
    marginBottom: SPACING.sm,
  },
  traitRow: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  traitRowName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  traitRowDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginBottom: 2,
  },
  traitRowMods: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  noTraits: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  footer: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  confirmBtn: {
    backgroundColor: COLORS.laurel + '22',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    color: COLORS.laurel,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
  },
  dismissBtn: {
    alignItems: 'center',
    padding: SPACING.xs,
  },
  dismissText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
});
