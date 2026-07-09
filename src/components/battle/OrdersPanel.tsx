/**
 * OrdersPanel — per-round order controls during a battle's 'orders' phase.
 * Stages formation changes / a reserve commit / a withdraw order locally,
 * then submits them all together via onSubmit ("Resolve Round").
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { BattleState, BattleSide, LaneId, FormationId, SideOrders } from '../../models/battle';
import { getValidOrders } from '../../engine/battle/battleEngine';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const LANE_LABEL: Record<LaneId, string> = { left: 'Left', centre: 'Centre', right: 'Right' };

interface OrdersPanelProps {
  battleState: BattleState;
  side: BattleSide;
  onSubmit: (orders: SideOrders) => void;
}

export default function OrdersPanel({ battleState, side, onSubmit }: OrdersPanelProps) {
  const ownSide = battleState[side];
  const valid = getValidOrders(battleState, side);

  const [pendingFormations, setPendingFormations] = useState<Partial<Record<LaneId, FormationId>>>({});
  const [reserveLane, setReserveLane] = useState<LaneId | null>(null);
  const [reserveUnitIds, setReserveUnitIds] = useState<string[]>([]);
  const [withdraw, setWithdraw] = useState(false);

  function toggleReserveUnit(laneId: LaneId, unitId: string) {
    if (reserveLane && reserveLane !== laneId) {
      // Max one lane reinforced per round.
      setReserveLane(laneId);
      setReserveUnitIds([unitId]);
      return;
    }
    setReserveLane(laneId);
    setReserveUnitIds(ids => (ids.includes(unitId) ? ids.filter(id => id !== unitId) : [...ids, unitId]));
  }

  function handleResolve() {
    const orders: SideOrders = {
      laneOrders: Object.fromEntries(LANES.map(l => [l, pendingFormations[l] ? { formation: pendingFormations[l] } : {}])),
      ...(reserveLane && reserveUnitIds.length > 0 ? { commitReserves: { laneId: reserveLane, unitIds: reserveUnitIds } } : {}),
      ...(withdraw ? { withdraw: true } : {}),
    };
    onSubmit(orders);
    setPendingFormations({});
    setReserveLane(null);
    setReserveUnitIds([]);
    setWithdraw(false);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>ROUND {battleState.round} — ORDERS</Text>

      {LANES.map(laneId => {
        const wing = ownSide.wings[laneId];
        if (wing.broken || wing.units.length === 0) return null;
        const legal = valid.lanes[laneId].legalFormations;
        const current = pendingFormations[laneId] ?? wing.formation;
        return (
          <View key={laneId} style={styles.laneRow}>
            <Text style={styles.laneLabel}>{LANE_LABEL[laneId]}</Text>
            <View style={styles.pillRow}>
              {legal.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.pill, current === f && styles.pillActive]}
                  onPress={() => setPendingFormations(p => ({ ...p, [laneId]: f }))}
                >
                  <Text style={[styles.pillText, current === f && styles.pillTextActive]}>{f.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      {valid.reserveAvailable && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Commit Reserves (one lane only)</Text>
          <View style={styles.pillRow}>
            {ownSide.reserve.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[styles.pill, reserveUnitIds.includes(u.id) && styles.pillActive]}
                onPress={() => toggleReserveUnit(reserveLane ?? 'centre', u.id)}
              >
                <Text style={[styles.pillText, reserveUnitIds.includes(u.id) && styles.pillTextActive]}>
                  {u.unitClass} {Math.round(u.strength)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {reserveUnitIds.length > 0 && (
            <View style={styles.pillRow}>
              {LANES.map(l => (
                <TouchableOpacity
                  key={l}
                  style={[styles.pill, reserveLane === l && styles.pillActive]}
                  onPress={() => setReserveLane(l)}
                >
                  <Text style={[styles.pillText, reserveLane === l && styles.pillTextActive]}>→ {LANE_LABEL[l]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {valid.withdrawAvailable && (
        <TouchableOpacity style={[styles.withdrawBtn, withdraw && styles.withdrawBtnActive]} onPress={() => setWithdraw(w => !w)}>
          <Text style={styles.withdrawText}>{withdraw ? '✓ Withdrawing in good order' : 'Order a Withdrawal'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.resolveBtn} onPress={handleResolve}>
        <Text style={styles.resolveText}>Resolve Round</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.panelSurface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md },
  header: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 1, marginBottom: SPACING.sm },
  laneRow: { marginBottom: SPACING.xs },
  laneLabel: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.dust },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  pill: { backgroundColor: COLORS.panelElevated, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  pillActive: { backgroundColor: COLORS.gold },
  pillText: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.marble },
  pillTextActive: { color: COLORS.bg, fontWeight: '700' },
  section: { marginTop: SPACING.sm },
  sectionLabel: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.dust, letterSpacing: 1 },
  withdrawBtn: {
    marginTop: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.crimson, alignItems: 'center',
  },
  withdrawBtnActive: { backgroundColor: COLORS.crimson },
  withdrawText: { fontFamily: FONTS.ui, fontSize: 11, color: COLORS.marble },
  resolveBtn: { marginTop: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.gold, alignItems: 'center' },
  resolveText: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.bg, letterSpacing: 1 },
});
