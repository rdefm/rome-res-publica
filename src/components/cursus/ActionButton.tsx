// ─── Action button ─────────────────────────────────────────────────────────────
// Extracted from CursusScreen.tsx (Chunk C4 of cursus-visual-redesign-plan.md)
// so both TribunePanel (still inline in CursusScreen.tsx) and the new
// OfficeActionsModal can render it without a screen-into-component import.
// Logic unchanged from the original inline version — evaluates gates,
// handles extreme styling, routes to the correct store action.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { Character } from '../../models/character';
import type { OfficeAction } from '../../models/office';
import type { OfficeActionTargetContext } from '../../engine/officeActionEngine';
import { evaluateGates } from '../../engine/officeActionEngine';
import OfficeTargetPickerModal from './OfficeTargetPickerModal';
import { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';

export default function ActionButton({
  action,
  character,
}: {
  action: OfficeAction;
  character: Character;
}) {
  const state = useGameStore();
  const { useOfficeAction, takeOfficeAction } = state;
  const [pickerOpen, setPickerOpen] = useState(false);

  // Gate evaluation — structural requirements (skills, flags, assets, etc.)
  const gateResult = evaluateGates(action, character.id, state as any);

  // Affordability check — legacy cost fields used for display; actual deduction in engine
  const resource = action.resource;
  const canAfford = !resource || (state as any)[resource] >= action.costVal;

  const isLocked = !gateResult.allowed;
  const isDisabled = isLocked || !canAfford;
  const isExtreme = action.isExtreme === true;
  // New-style actions use successEffect; legacy actions use effect function
  const isNewStyle = action.successEffect !== undefined || action.failureEffect !== undefined;

  function handlePress() {
    if (isDisabled) return;
    // Tutorial redesign, Chunk T6 — an action needing a player-chosen
    // target always routes through takeOfficeAction via the picker, whether
    // it's new-style (successEffect + PLAYER_CHOSEN_* consequences) or
    // legacy-effect (Audit a Rival, whose effect closure reads
    // targetContext.leaderId directly) — the picker is what used to be
    // missing, not the routing.
    if (action.targetPicker) {
      setPickerOpen(true);
      return;
    }
    if (isNewStyle) {
      (takeOfficeAction as any)(action.id, character.id, undefined);
    } else {
      useOfficeAction(action.id);
    }
  }

  function handlePick(targetContext: OfficeActionTargetContext) {
    (takeOfficeAction as any)(action.id, character.id, targetContext);
  }

  const blockedReason = !gateResult.allowed
    ? gateResult.blockedReason
    : !canAfford
      ? `Insufficient ${resource ?? 'resources'}`
      : undefined;

  return (
    <>
      <TouchableOpacity
        style={[
          ab.btn,
          isExtreme && ab.btnExtreme,
          isDisabled && ab.btnDisabled,
        ]}
        disabled={isDisabled}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={ab.row}>
          <Text style={[ab.label, isExtreme && ab.labelExtreme]}>
            {isExtreme ? '⚠ EXTREME  ' : ''}{action.name}
          </Text>
          <Text style={ab.cost}>{action.cost}</Text>
        </View>
        <Text style={ab.desc}>{action.desc}</Text>
        {blockedReason !== undefined && (
          <Text style={ab.blocked}>{blockedReason}</Text>
        )}
      </TouchableOpacity>

      {action.targetPicker && (
        <OfficeTargetPickerModal
          visible={pickerOpen}
          kind={action.targetPicker}
          actionId={action.id}
          actingCharacterId={character.id}
          onClose={() => setPickerOpen(false)}
          onPick={handlePick}
        />
      )}
    </>
  );
}

const ab = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
  },
  btnExtreme: {
    backgroundColor: 'rgba(180,60,40,0.18)',
    borderColor: COLORS.crimson + 'aa',
  },
  btnDisabled: { opacity: 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  labelExtreme: { color: COLORS.crimson },
  cost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 11 },
  desc: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
  blocked: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3, fontStyle: 'italic' },
});
