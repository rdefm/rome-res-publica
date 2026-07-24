// ─── ArmyCard ────────────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C2. Renders one Army: name/owner/commander, its
// units (class, strength bar, veterancy pips, loyalty bar — mirrors
// MilitaryTab.tsx's TroopRow design, per the plan's own "reuse/anticipate
// M8's row design" instruction), upkeep/season, a stance toggle (player
// armies only), and Combine/Divide/Assign Commander controls where legal.
// Divide opens a whole-unit picker modal; Assign Commander opens a simple
// character picker. Combine is a callback only — picking a partner army
// needs cross-army visibility only the parent (RegionSheet) has.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { Army, ArmyUnit } from '../../models/army';
import type { Character } from '../../models/character';
import type { TheatreState } from '../../models/theatre';
import type { CityState } from '../../models/city';
import { armyStrength, upkeepFor } from '../../engine/armyEngine';
import { trueIntentFor, type CampaignIntent } from '../../engine/campaignAi';
import InfoTap from '../shared/InfoTap';

const VET_TIER_INDEX: Record<ArmyUnit['veterancy'], number> = { raw: 1, trained: 2, veteran: 3, legendary: 4 };

// Chunk C6 — enemy/rival army cards show the AI's intent for the season.
// This is the TRUE intent (see trueIntentFor's own comment on why: the
// telegraphed, sometimes-lying version is meant to be computed once by
// C7's resolution for the FOLLOWING season, which doesn't exist yet).
const INTENT_ICON: Record<CampaignIntent, string> = { entrenched: '🛡', advancing: '➔', raiding: '🔥' };
const INTENT_LABEL: Record<CampaignIntent, string> = { entrenched: 'Entrenched', advancing: 'Advancing', raiding: 'Raiding' };

const OWNER_LABEL: Record<Army['owner'], string> = {
  player: 'Your Command',
  rome_state: 'Rome (State)',
  rome_rival: 'Rival Commander',
  carthage: 'Carthage',
};

const OWNER_COLOR: Record<Army['owner'], string> = {
  player: COLORS.gold,
  rome_state: '#6b8a4a',
  rome_rival: '#c47a4a',
  carthage: '#7a4a9a',
};

interface ArmyCardProps {
  army: Army;
  family: Character[];
  theatre: TheatreState;
  cities: CityState[];
  /** True when this card was opened by tapping the army marker on the map
   *  (vs. found in a region sheet's army list) — a light highlight only. */
  focused?: boolean;
  combineEligible: boolean;
  onCombinePress: () => void;
  onDivide: (unitIds: string[]) => void;
  onAssignCommander: (characterId: string | null) => void;
  onSetStance: (stance: Army['stance']) => void;
  /** Chunk C5 — the map itself owns order-mode UI (reachability highlights,
   *  destination taps), so this only signals "start ordering this army" up
   *  to the parent, same shape as onCombinePress. */
  onOrderPress: () => void;
  onClearOrder: () => void;
}

export default function ArmyCard({
  army,
  family,
  theatre,
  cities,
  focused,
  combineEligible,
  onCombinePress,
  onDivide,
  onAssignCommander,
  onSetStance,
  onOrderPress,
  onClearOrder,
}: ArmyCardProps) {
  const [dividePickerOpen, setDividePickerOpen] = useState(false);
  const [commanderPickerOpen, setCommanderPickerOpen] = useState(false);
  const [pickedUnitIds, setPickedUnitIds] = useState<string[]>([]);

  const commander = army.commanderId ? family.find(c => c.id === army.commanderId) : null;
  const isLeaderless = !army.commanderId;
  const strength = Math.round(armyStrength(army));
  const upkeep = upkeepFor(army, theatre, cities);
  const canManage = army.owner === 'player' || army.owner === 'rome_state';
  const intent = trueIntentFor(army.ordersThisSeason);

  function toggleUnit(unitId: string) {
    setPickedUnitIds(ids => ids.includes(unitId) ? ids.filter(id => id !== unitId) : [...ids, unitId]);
  }

  function confirmDivide() {
    onDivide(pickedUnitIds);
    setPickedUnitIds([]);
    setDividePickerOpen(false);
  }

  return (
    <View style={[styles.card, focused && styles.cardFocused]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{army.name}</Text>
          <View style={styles.ownerRow}>
            <View style={[styles.ownerDot, { backgroundColor: OWNER_COLOR[army.owner] }]} />
            <Text style={styles.ownerLabel}>{OWNER_LABEL[army.owner]}</Text>
            {army.fatigued && <Text style={styles.fatiguedTag}>FATIGUED</Text>}
          </View>
        </View>
        <View style={styles.strengthBadge}>
          <Text style={styles.strengthValue}>{strength}</Text>
          <Text style={styles.strengthLabel}>POWER</Text>
        </View>
      </View>

      {/* Chunk C6 — campaign AI intent, enemy/rival armies only. */}
      {!canManage && (
        <InfoTap termId="campaign-intent" style={{ alignSelf: 'flex-start', marginBottom: SPACING.sm }}>
          <View style={styles.intentRow}>
            <Text style={styles.intentIcon}>{INTENT_ICON[intent]}</Text>
            <Text style={styles.intentLabel}>{INTENT_LABEL[intent]}</Text>
          </View>
        </InfoTap>
      )}

      {/* Commander */}
      <TouchableOpacity
        style={styles.commanderRow}
        onPress={() => canManage && setCommanderPickerOpen(true)}
        activeOpacity={canManage ? 0.7 : 1}
      >
        <Text style={styles.commanderIcon}>{isLeaderless ? '—' : '★'}</Text>
        <Text style={[styles.commanderText, isLeaderless && styles.commanderTextEmpty]}>
          {commander ? `${commander.name} · Martial ${commander.skills.martial}/10` : 'No commander — cannot attack'}
        </Text>
        {canManage && <Text style={styles.commanderChange}>{isLeaderless ? 'Assign' : 'Change'}</Text>}
      </TouchableOpacity>

      {/* Units */}
      {army.units.map(unit => <UnitRow key={unit.id} unit={unit} />)}

      {/* Upkeep */}
      <View style={styles.upkeepRow}>
        <Text style={styles.upkeepLabel}>Upkeep</Text>
        <Text style={styles.upkeepValue}>{upkeep} denarii / season</Text>
      </View>

      {/* Stance toggle — player-manageable armies only */}
      {canManage && (
        <View style={styles.stanceRow}>
          <InfoTap termId="army-stance">
            <Text style={styles.stanceLabel}>STANCE</Text>
          </InfoTap>
          <View style={styles.stancePillRow}>
            {(['give_battle', 'avoid_battle'] as const).map(stance => (
              <TouchableOpacity
                key={stance}
                style={[styles.stancePill, army.stance === stance && styles.stancePillActive]}
                onPress={() => onSetStance(stance)}
                activeOpacity={0.75}
              >
                <Text style={[styles.stancePillText, army.stance === stance && styles.stancePillTextActive]}>
                  {stance === 'give_battle' ? 'Give Battle' : 'Avoid Battle'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Orders — Chunk C5. A queued order is shown as a status line with a
          Clear action; nothing here resolves it (C7 does, at End Season). */}
      {canManage && army.ordersThisSeason && (
        <View style={styles.orderRow}>
          <Text style={styles.orderText}>
            {army.ordersThisSeason.intent === 'attack' ? '⚔ Attack → ' : '→ '}
            {army.ordersThisSeason.path[army.ordersThisSeason.path.length - 1]}
            {army.ordersThisSeason.forcedMarch ? ' (forced march)' : ''}
          </Text>
          <TouchableOpacity onPress={onClearOrder} activeOpacity={0.7}>
            <Text style={styles.orderClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions */}
      {canManage && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onOrderPress}
            activeOpacity={0.75}
          >
            <Text style={styles.actionBtnText}>{army.ordersThisSeason ? 'Change Order' : 'Move'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, !combineEligible && styles.actionBtnDisabled]}
            onPress={onCombinePress}
            disabled={!combineEligible}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, !combineEligible && styles.actionBtnTextDisabled]}>Combine</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, army.units.length < 2 && styles.actionBtnDisabled]}
            onPress={() => setDividePickerOpen(true)}
            disabled={army.units.length < 2}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, army.units.length < 2 && styles.actionBtnTextDisabled]}>Divide</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Divide modal — whole-unit picker, nothing fancier (per the plan's own spec) */}
      <Modal visible={dividePickerOpen} transparent animationType="fade" onRequestClose={() => setDividePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>DIVIDE {army.name.toUpperCase()}</Text>
            <Text style={styles.modalHint}>Pick whole units to split into a new detachment. At least one unit must stay behind.</Text>
            <ScrollView style={styles.modalList}>
              {army.units.map(unit => (
                <TouchableOpacity
                  key={unit.id}
                  style={styles.pickRow}
                  onPress={() => toggleUnit(unit.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, pickedUnitIds.includes(unit.id) && styles.checkboxChecked]}>
                    {pickedUnitIds.includes(unit.id) && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <Text style={styles.pickRowText}>
                    {unit.unitClass.replace('_', ' ')} · {unit.veterancy} · STR {unit.strength}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => { setDividePickerOpen(false); setPickedUnitIds([]); }} activeOpacity={0.75}>
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, pickedUnitIds.length === 0 && styles.actionBtnDisabled]}
                onPress={confirmDivide}
                disabled={pickedUnitIds.length === 0}
                activeOpacity={0.75}
              >
                <Text style={styles.modalBtnPrimaryText}>Divide ({pickedUnitIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign commander modal */}
      <Modal visible={commanderPickerOpen} transparent animationType="fade" onRequestClose={() => setCommanderPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ASSIGN COMMANDER</Text>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.pickRow}
                onPress={() => { onAssignCommander(null); setCommanderPickerOpen(false); }}
                activeOpacity={0.75}
              >
                <Text style={styles.pickRowText}>— Leave leaderless —</Text>
              </TouchableOpacity>
              {family.map(character => (
                <TouchableOpacity
                  key={character.id}
                  style={styles.pickRow}
                  onPress={() => { onAssignCommander(character.id); setCommanderPickerOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.pickRowText}>{character.name} · Martial {character.skills.martial}/10</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setCommanderPickerOpen(false)} activeOpacity={0.75}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function UnitRow({ unit }: { unit: ArmyUnit }) {
  const tier = VET_TIER_INDEX[unit.veterancy];
  const pips = '●'.repeat(tier) + '○'.repeat(4 - tier);
  return (
    <View style={styles.unitRow}>
      <View style={styles.unitInfo}>
        <Text style={styles.unitClass}>
          {unit.unitClass.replace('_', ' ')}
          {unit.elephantSteady ? ' 🛡' : ''}
        </Text>
        <Text style={styles.unitPips}>{pips} {unit.veterancy}</Text>
      </View>
      <View style={styles.unitBars}>
        <MiniBar label="STR" value={unit.strength} color={COLORS.denariiColor} />
        <MiniBar label="LOY" value={unit.loyalty} color={COLORS.laurel} />
      </View>
    </View>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.miniBarWrap}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2a2218',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  cardFocused: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  } as ViewStyle,

  name: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 } as ViewStyle,
  ownerDot: { width: 7, height: 7, borderRadius: 3.5 } as ViewStyle,
  ownerLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 0.4 } as TextStyle,
  fatiguedTag: {
    color: COLORS.crimson,
    fontFamily: FONTS.ui,
    fontSize: 8,
    letterSpacing: 0.5,
    marginLeft: 4,
  } as TextStyle,

  strengthBadge: { alignItems: 'center' } as ViewStyle,
  strengthValue: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 16, fontWeight: '700' } as TextStyle,
  strengthLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 7, letterSpacing: 0.6 } as TextStyle,

  intentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1a1410', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  } as ViewStyle,
  intentIcon: { fontSize: 11 } as TextStyle,
  intentLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 0.5 } as TextStyle,

  commanderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1410',
    borderRadius: 6,
    padding: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  commanderIcon: { color: COLORS.gold, fontSize: 12, width: 14, textAlign: 'center' } as TextStyle,
  commanderText: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 11, flex: 1 } as TextStyle,
  commanderTextEmpty: { color: COLORS.crimson, fontStyle: 'italic' } as TextStyle,
  commanderChange: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 0.4 } as TextStyle,

  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1f1a12',
  } as ViewStyle,

  unitInfo: { flex: 1 } as ViewStyle,
  unitClass: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 11, textTransform: 'capitalize', fontWeight: '600' } as TextStyle,
  unitPips: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 9, marginTop: 2 } as TextStyle,

  unitBars: { width: 110, gap: 3 } as ViewStyle,
  miniBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 } as ViewStyle,
  miniBarLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 8, width: 22 } as TextStyle,
  miniBarTrack: { flex: 1, height: 4, backgroundColor: '#1a1410', borderRadius: 2, overflow: 'hidden' } as ViewStyle,
  miniBarFill: { height: '100%', borderRadius: 2 } as ViewStyle,

  upkeepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  } as ViewStyle,
  upkeepLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 0.4 } as TextStyle,
  upkeepValue: { color: COLORS.denariiColor, fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700' } as TextStyle,

  stanceRow: { marginTop: SPACING.sm },
  stanceLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1, marginBottom: 5 } as TextStyle,
  stancePillRow: { flexDirection: 'row', gap: 6 } as ViewStyle,
  stancePill: {
    flex: 1,
    backgroundColor: '#1a1410',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 5,
    alignItems: 'center',
  } as ViewStyle,
  stancePillActive: { backgroundColor: '#1a2818', borderColor: COLORS.laurel } as ViewStyle,
  stancePillText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9.5 } as TextStyle,
  stancePillTextActive: { color: '#8fc98f', fontWeight: '700' } as TextStyle,

  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  } as ViewStyle,
  orderText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' } as TextStyle,
  orderClear: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10 } as TextStyle,

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm } as ViewStyle,
  actionBtn: {
    flex: 1,
    backgroundColor: '#1a3018',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  } as ViewStyle,
  actionBtnDisabled: { backgroundColor: '#1a1a18', borderColor: COLORS.border, opacity: 0.5 } as ViewStyle,
  actionBtnText: { color: '#8fc98f', fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700' } as TextStyle,
  actionBtnTextDisabled: { color: COLORS.dust } as TextStyle,

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: '#2e2a24',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    padding: SPACING.md,
  } as ViewStyle,
  modalTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 6,
  } as TextStyle,
  modalHint: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
    lineHeight: 15,
  } as TextStyle,
  modalList: { maxHeight: 260 } as ViewStyle,
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1a12',
  } as ViewStyle,
  pickRowText: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 11, textTransform: 'capitalize' } as TextStyle,
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  checkboxChecked: { backgroundColor: COLORS.laurel, borderColor: COLORS.laurel } as ViewStyle,
  checkboxMark: { color: '#fff', fontSize: 11, fontWeight: '700' } as TextStyle,
  modalActions: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm } as ViewStyle,
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  } as ViewStyle,
  modalBtnSecondaryText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 } as TextStyle,
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#1a3018',
    borderWidth: 1,
    borderColor: COLORS.laurel,
  } as ViewStyle,
  modalBtnPrimaryText: { color: '#8fc98f', fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700' } as TextStyle,
});
