// Generic target picker for office actions carrying a PLAYER_CHOSEN_*
// consequence (or, for Audit a Rival, an effect closure reading
// targetContext directly). tutorial-redesign-plan.md T6. Same inline-modal
// idiom as LeaderDetailPanel.tsx's IntelPickerModal — a plain native Modal,
// not ScrollModal.
//
// Renders one of three lists depending on `kind`:
//   'leader'   — every clan leader. Audit a Rival specifically (actionId
//                'audit-rival') also shows the computed chance per leader
//                and disables one the player already holds a Secret on,
//                with the reason stated (finding 17's requirement).
//   'clan'     — every clan.
//   'province' — every city/province.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { OfficeActionTargetContext } from '../../engine/officeActionEngine';
import { calcAuditChance } from '../../engine/secretEngine';
import { getCityDefinition } from '../../data/cityDefinitions';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

interface OfficeTargetPickerModalProps {
  visible: boolean;
  kind: 'leader' | 'clan' | 'province';
  actionId: string;
  actingCharacterId: string;
  onClose: () => void;
  onPick: (targetContext: OfficeActionTargetContext) => void;
}

export default function OfficeTargetPickerModal({
  visible,
  kind,
  actionId,
  actingCharacterId,
  onClose,
  onPick,
}: OfficeTargetPickerModalProps) {
  const clans = useGameStore(s => s.clans);
  const cities = useGameStore(s => s.cities);
  const secrets = useGameStore(s => s.secrets);
  const family = useGameStore(s => s.family);

  const isAudit = actionId === 'audit-rival';
  const actingCharacter = family.find(c => c.id === actingCharacterId);

  const title =
    kind === 'leader' ? 'CHOOSE A TARGET LEADER'
    : kind === 'clan' ? 'CHOOSE A TARGET CLAN'
    : 'CHOOSE A TARGET PROVINCE';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        {/* Swallow taps on the card itself so they don't fall through to the overlay's onClose */}
        <TouchableOpacity style={pk.modal} activeOpacity={1} onPress={() => {}}>
          <Text style={pk.title}>{title}</Text>
          <ScrollView style={pk.scroll}>
            {kind === 'leader' && clans.flatMap(clan => clan.leaders.map(leader => {
              const alreadyHeld = secrets.some(
                s => s.holder === 'player' && s.subject.kind === 'leader' &&
                  (s.subject as { kind: 'leader'; leaderId: string }).leaderId === leader.id,
              );
              const disabled = isAudit && alreadyHeld;
              const chance = isAudit
                ? calcAuditChance(actingCharacter?.skills.intrigus ?? 0, leader.corruptionScore)
                : null;

              return (
                <TouchableOpacity
                  key={leader.id}
                  style={[pk.row, disabled && pk.rowDisabled]}
                  disabled={disabled}
                  onPress={() => { onPick({ leaderId: leader.id }); onClose(); }}
                >
                  <View style={pk.rowInner}>
                    <Text style={pk.rowName}>{leader.name}</Text>
                    <Text style={pk.rowSub}>
                      {clan.name}
                      {disabled ? ' — you already hold a Secret on him' : ''}
                    </Text>
                  </View>
                  {chance !== null && !disabled && (
                    <Text style={pk.rowChance}>{Math.round(chance * 100)}%</Text>
                  )}
                </TouchableOpacity>
              );
            }))}

            {kind === 'clan' && clans.map(clan => (
              <TouchableOpacity
                key={clan.id}
                style={pk.row}
                onPress={() => { onPick({ clanId: clan.id }); onClose(); }}
              >
                <View style={pk.rowInner}>
                  <Text style={pk.rowName}>{clan.name}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {kind === 'province' && cities.map(city => (
              <TouchableOpacity
                key={city.id}
                style={pk.row}
                onPress={() => { onPick({ provinceId: city.id }); onClose(); }}
              >
                <View style={pk.rowInner}>
                  <Text style={pk.rowName}>{getCityDefinition(city.id)?.name ?? city.id}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const pk = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modal: {
    maxHeight: '70%',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  title: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowInner: { flex: 1 },
  rowName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14 },
  rowSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  rowChance: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 13, fontWeight: '700' },
});
