/**
 * MusterPickerModal — Province picker for raising a personal legion.
 * Place at: src/components/provinciae/MusterPickerModal.tsx
 *
 * Allows a character to select a muster province for a new raised legion.
 * Eligible provinces: currently governor there, OR localSupport ≥ 20,
 * OR the character has previously raised troops there.
 * Latium is always shown but always disabled (pomerium rule).
 *
 * Note: calls `raiseLevy` store action added in Chunk M.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { calcLevyCost } from '../../engine/troopEngine';
import type { ProvinceState } from '../../models/province';

// ─── Props ────────────────────────────────────────────────────────────────────

interface MusterPickerModalProps {
  visible: boolean;
  onClose: () => void;
  characterId: string;
}

// ─── Internal: Stat Bar ───────────────────────────────────────────────────────

interface StatBarProps {
  label: string;
  value: number;   // 0–100
  color: string;
}

function StatBar({ label, value, color }: StatBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View style={statBarStyles.row}>
      <Text style={statBarStyles.label}>{label}</Text>
      <View style={statBarStyles.track}>
        <View style={[statBarStyles.fill, { width: `${clamped}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={statBarStyles.value}>{clamped}</Text>
    </View>
  );
}

const statBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  } as ViewStyle,
  label: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
    width: 90,
  } as TextStyle,
  track: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: 6,
  } as ViewStyle,
  fill: {
    height: '100%',
    borderRadius: 2,
  } as ViewStyle,
  value: {
    color: PARCHMENT_TEXT.body,
    fontFamily: FONTS.ui,
    fontSize: 9,
    width: 24,
    textAlign: 'right',
  } as TextStyle,
});

// ─── Internal: Province Row ───────────────────────────────────────────────────

interface ProvinceRowProps {
  province: ProvinceState;
  isLatium: boolean;
  isEligible: boolean;
  onSelect: () => void;
}

function ProvinceRow({ province, isLatium, isEligible, onSelect }: ProvinceRowProps) {
  const disabled = isLatium || !isEligible;

  return (
    <ParchmentCard style={disabled ? styles.cardDisabled : undefined}>
      <View style={styles.cardHeader}>
        <Text style={[styles.provinceName, disabled && styles.textDisabled]}>
          {province.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </Text>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: disabled ? '#bbb' : '#6a8a4a' }]}>
          <Text style={styles.statusText}>
            {isLatium ? 'SACRED' : isEligible ? 'ELIGIBLE' : 'INELIGIBLE'}
          </Text>
        </View>
      </View>

      {isLatium ? (
        <Text style={styles.latiumText}>
          🔒 {"No armed force may enter the sacred boundary of Rome."}
        </Text>
      ) : (
        <>
          <StatBar
            label="Local Support"
            value={province.localSupport}
            color={isEligible ? '#4a8a4a' : '#999'}
          />
          <StatBar
            label="Relationship"
            value={province.relationshipScore}
            color={isEligible ? '#4a6aaa' : '#999'}
          />

          <TouchableOpacity
            style={[styles.selectButton, disabled && styles.selectButtonDisabled]}
            onPress={onSelect}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text style={[styles.selectButtonText, disabled && styles.selectButtonTextDisabled]}>
              {isEligible ? 'Muster Here' : 'Insufficient Standing'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </ParchmentCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MusterPickerModal({
  visible,
  onClose,
  characterId,
}: MusterPickerModalProps) {
  const provinces   = useGameStore(s => s.provinces);
  const family      = useGameStore(s => s.family);
  const crisisLevel = useGameStore(s => s.crisisLevel);

  // @ts-ignore — raiseLevy is added to GameActions in Chunk M
  const raiseLevy = useGameStore(s => s.raiseLevy);

  const character = family.find(c => c.id === characterId);

  // Determine levy cost for display.
  // senateAuthorised = character currently holds a formal office.
  const senateAuthorised = !!(character?.officeId);
  const levyCost = calcLevyCost(60, crisisLevel, senateAuthorised);

  // Provinces the character has previously raised troops in.
  const priorMusterIds = useMemo(() => {
    if (!character) return new Set<string>();
    return new Set(character.raisedLegions.map(t => t.musterProvinceId));
  }, [character]);

  function isEligible(province: ProvinceState): boolean {
    if (province.id === 'latium') return false;
    if (province.playerGovernor?.characterId === characterId) return true;
    if (province.localSupport >= 20) return true;
    if (priorMusterIds.has(province.id)) return true;
    return false;
  }

  function handleSelect(provinceId: string) {
    if (raiseLevy) {
      raiseLevy(characterId, provinceId);
    }
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>

          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Raise a Legion</Text>
            <Text style={styles.headerSub}>Choose a muster province</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Cost</Text>
              <Text style={styles.costValue}>{levyCost} Denarii</Text>
              {!senateAuthorised && (
                <Text style={styles.costWarning}> (unsanctioned +50%)</Text>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Province list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {provinces.map(province => (
              <ProvinceRow
                key={province.id}
                province={province}
                isLatium={province.id === 'latium'}
                isEligible={isEligible(province)}
                onSelect={() => handleSelect(province.id)}
              />
            ))}
          </ScrollView>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  } as ViewStyle,

  sheet: {
    backgroundColor: '#1a1714',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '80%',
  } as ViewStyle,

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  headerTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  } as TextStyle,

  headerSub: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  } as TextStyle,

  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,

  costLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
  } as TextStyle,

  costValue: {
    color: '#c9a84c',
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  } as TextStyle,

  costWarning: {
    color: COLORS.crimson,
    fontFamily: FONTS.ui,
    fontSize: 10,
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  list: {
    flex: 1,
  } as ViewStyle,

  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  } as ViewStyle,

  cardDisabled: {
    opacity: 0.55,
  } as ViewStyle,

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  } as ViewStyle,

  provinceName: {
    color: PARCHMENT_TEXT.heading,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  } as TextStyle,

  textDisabled: {
    color: PARCHMENT_TEXT.muted,
  } as TextStyle,

  statusBadge: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 6,
  } as ViewStyle,

  statusText: {
    color: '#fff',
    fontFamily: FONTS.ui,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,

  latiumText: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  } as TextStyle,

  selectButton: {
    marginTop: SPACING.sm,
    backgroundColor: '#4a3010',
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7a5a20',
  } as ViewStyle,

  selectButtonDisabled: {
    backgroundColor: '#2a2520',
    borderColor: '#3a3530',
  } as ViewStyle,

  selectButtonText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,

  selectButtonTextDisabled: {
    color: COLORS.dust,
  } as TextStyle,

  cancelButton: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  cancelText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    letterSpacing: 0.5,
  } as TextStyle,
});
