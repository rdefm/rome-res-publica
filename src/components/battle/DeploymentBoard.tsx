/**
 * DeploymentBoard — the pre-battle staging UI. Purely local component state
 * until "Give Battle" is pressed (see gameStore.ts's activeBattleSetup /
 * commitDeployment header comments) — battleEngine.initBattle only runs on
 * commit.
 *
 * "Ugly-but-clear" per the M5 spec: tap a unit chip to select it, tap a
 * lane (or the reserve bucket) to move it there. No drag-and-drop, no
 * animation — that's M6.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type {
  Deployment, LaneAssignment, LaneId, FormationId, BattleUnit, UnitClass, TerrainMod,
} from '../../models/battle';
import { BALANCE } from '../../data/balance';
import {
  buildEffectiveSide, isFeintGated, NO_CAPTAIN_MODS,
} from '../../engine/battle/clashEngine';
import type { CaptainCandidate } from '../../engine/battle/musterEngine';
import type { DeploySideInput } from '../../engine/battle/battleEngine';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const LANE_LABEL: Record<LaneId, string> = { left: 'Left Wing', centre: 'Centre', right: 'Right Wing' };
const CLASS_LABEL: Record<UnitClass, string> = {
  legionary: 'Legionary', spear_foot: 'Spear', skirmisher: 'Skirmisher',
  cavalry_heavy: 'Heavy Cav', cavalry_light: 'Light Cav', elephant: 'Elephant',
};
const CAVALRY: UnitClass[] = ['cavalry_heavy', 'cavalry_light'];
const ALL_FORMATIONS: FormationId[] = ['line', 'shield_wall', 'open_ranks', 'wedge', 'feigned_retreat'];

interface DeploymentBoardProps {
  attackerInput: DeploySideInput;
  defenderInput: DeploySideInput;
  terrain: TerrainMod;
  captainOptions: CaptainCandidate[];
  commanderId: string | null;
  onGiveBattle: (attackerDeployment: Deployment, defenderDeployment: Deployment) => void;
  onCancel: () => void;
}

function moveUnit(deployment: Deployment, unitId: string, target: LaneId | 'reserve'): Deployment {
  let moving: BattleUnit | null = null;
  const lanes = { ...deployment.lanes };
  for (const laneId of LANES) {
    const found = lanes[laneId].units.find(u => u.id === unitId);
    if (found) {
      moving = found;
      lanes[laneId] = { ...lanes[laneId], units: lanes[laneId].units.filter(u => u.id !== unitId) };
    }
  }
  let reserve = deployment.reserve;
  if (!moving) {
    const found = reserve.find(u => u.id === unitId);
    if (found) {
      moving = found;
      reserve = reserve.filter(u => u.id !== unitId);
    }
  }
  if (!moving) return deployment;

  if (target === 'reserve') {
    return { ...deployment, lanes, reserve: [...reserve, moving] };
  }
  lanes[target] = { ...lanes[target], units: [...lanes[target].units, moving] };
  return { ...deployment, lanes, reserve };
}

function legalFormationsFor(assignment: LaneAssignment): FormationId[] {
  const hasCaptain = assignment.captainId != null;
  return ALL_FORMATIONS.filter(f => {
    if (f === 'wedge') return hasCaptain;
    if (f === 'feigned_retreat') return hasCaptain && assignment.units.length > 0 && isFeintGated(assignment.units);
    return true;
  });
}

function computeAdvantage(
  ownUnits: BattleUnit[], ownFormation: FormationId,
  enemyUnits: BattleUnit[], enemyFormation: FormationId,
  terrain: TerrainMod,
): { chevrons: number; favors: 'own' | 'enemy' | 'even'; reason: string } {
  if (ownUnits.length === 0 || enemyUnits.length === 0) return { chevrons: 0, favors: 'even', reason: '—' };
  const own = buildEffectiveSide({
    units: ownUnits, formation: ownFormation, opposingUnits: enemyUnits, mods: NO_CAPTAIN_MODS,
    terrain, terrainRole: 'attacker', engagedRounds: 0, flanked: false, overextended: false,
  });
  const enemy = buildEffectiveSide({
    units: enemyUnits, formation: enemyFormation, opposingUnits: ownUnits, mods: NO_CAPTAIN_MODS,
    terrain, terrainRole: 'defender', engagedRounds: 0, flanked: false, overextended: false,
  });
  const ownScore = own.totalAtk + own.totalDef;
  const enemyScore = enemy.totalAtk + enemy.totalDef;
  const ratio = enemyScore > 0 ? ownScore / enemyScore : 2;
  const diff = Math.abs(ratio - 1);
  const chevrons = diff > 0.5 ? 3 : diff > 0.25 ? 2 : diff > 0.08 ? 1 : 0;
  const favors: 'own' | 'enemy' | 'even' = ratio > 1.08 ? 'own' : ratio < 0.92 ? 'enemy' : 'even';
  const reason = Math.abs(ownUnits.length - enemyUnits.length) >= 2 ? 'numbers'
    : own.totalShock + enemy.totalShock > (own.totalAtk + enemy.totalAtk) * 0.6 ? 'shock'
    : 'ground';
  return { chevrons, favors, reason };
}

function riskPips(laneUnits: BattleUnit[], isCommanderHere: boolean): number {
  let pips = 1;
  const cavalryStrength = laneUnits.filter(u => CAVALRY.includes(u.unitClass)).reduce((s, u) => s + u.strength, 0);
  const total = laneUnits.reduce((s, u) => s + u.strength, 0);
  if (total > 0 && cavalryStrength > total / 2) pips += 1;
  if (isCommanderHere) pips += 1;
  return Math.min(3, pips);
}

export default function DeploymentBoard({
  attackerInput, defenderInput, terrain, captainOptions, commanderId, onGiveBattle, onCancel,
}: DeploymentBoardProps) {
  const [deployment, setDeployment] = useState<Deployment>(attackerInput.deployment);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defenderDeployment = defenderInput.deployment;

  const advantages = useMemo(() => {
    const result: Record<LaneId, ReturnType<typeof computeAdvantage>> = {} as any;
    for (const laneId of LANES) {
      result[laneId] = computeAdvantage(
        deployment.lanes[laneId].units, deployment.lanes[laneId].formation,
        defenderDeployment.lanes[laneId].units, defenderDeployment.lanes[laneId].formation,
        terrain,
      );
    }
    return result;
  }, [deployment, defenderDeployment, terrain]);

  function handlePlace(target: LaneId | 'reserve') {
    if (!selectedUnitId) return;
    if (target !== 'reserve') {
      const unit = [...LANES.flatMap(l => deployment.lanes[l].units), ...deployment.reserve]
        .find(u => u.id === selectedUnitId);
      if (unit && CAVALRY.includes(unit.unitClass) && target === 'centre') {
        setError('Cavalry cannot deploy to the centre.');
        return;
      }
    }
    setError(null);
    setDeployment(d => moveUnit(d, selectedUnitId, target));
    setSelectedUnitId(null);
  }

  function setFormation(laneId: LaneId, formation: FormationId) {
    setDeployment(d => ({ ...d, lanes: { ...d.lanes, [laneId]: { ...d.lanes[laneId], formation } } }));
  }

  function setCaptain(laneId: LaneId, captainId: string | null) {
    setDeployment(d => ({ ...d, lanes: { ...d.lanes, [laneId]: { ...d.lanes[laneId], captainId } } }));
  }

  function setCommanderStation(station: LaneId | 'reserve') {
    setDeployment(d => ({ ...d, commanderStation: station }));
  }

  const usedCaptainIds = new Set(LANES.map(l => deployment.lanes[l].captainId).filter((id): id is string => !!id));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>DEPLOYMENT — {attackerInput.label} vs {defenderInput.label}</Text>
        <Text style={styles.subtitle}>Terrain: {terrain.label}</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.laneRow}>
          {LANES.map(laneId => {
            const assignment = deployment.lanes[laneId];
            const adv = advantages[laneId];
            const legalFormations = legalFormationsFor(assignment);
            const isCommanderHere = commanderId != null && commanderId === (
              // commander station applies army-wide, but we only show "commander here" on the
              // lane that matches commanderStation
              deployment.commanderStation === laneId ? commanderId : null
            );
            return (
              <View key={laneId} style={styles.laneCol}>
                <TouchableOpacity style={styles.laneDropZone} onPress={() => handlePlace(laneId)}>
                  <Text style={styles.laneHeader}>{LANE_LABEL[laneId]}</Text>
                  {adv.chevrons > 0 && (
                    <Text style={[styles.advantage, adv.favors === 'own' ? styles.advantageGood : styles.advantageBad]}>
                      {'»'.repeat(adv.chevrons)} {adv.favors === 'own' ? 'your favour' : 'enemy favour'} ({adv.reason})
                    </Text>
                  )}
                  {assignment.units.length === 0 ? (
                    <Text style={styles.emptyLane}>Tap to place selected unit</Text>
                  ) : (
                    <View style={styles.chipWrap}>
                      {assignment.units.map(u => (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.chip, selectedUnitId === u.id && styles.chipSelected]}
                          onPress={() => setSelectedUnitId(u.id)}
                        >
                          <Text style={styles.chipText}>{CLASS_LABEL[u.unitClass]} {Math.round(u.strength)}%</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Formation</Text>
                <View style={styles.pillRow}>
                  {legalFormations.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.pill, assignment.formation === f && styles.pillActive]}
                      onPress={() => setFormation(laneId, f)}
                    >
                      <Text style={[styles.pillText, assignment.formation === f && styles.pillTextActive]}>
                        {f.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Captain</Text>
                <View style={styles.pillRow}>
                  <TouchableOpacity
                    style={[styles.pill, !assignment.captainId && styles.pillActive]}
                    onPress={() => setCaptain(laneId, null)}
                  >
                    <Text style={[styles.pillText, !assignment.captainId && styles.pillTextActive]}>None</Text>
                  </TouchableOpacity>
                  {captainOptions
                    .filter(c => !usedCaptainIds.has(c.characterId) || assignment.captainId === c.characterId)
                    .map(c => (
                      <TouchableOpacity
                        key={c.characterId}
                        style={[styles.pill, assignment.captainId === c.characterId && styles.pillActive]}
                        onPress={() => setCaptain(laneId, c.characterId)}
                      >
                        <Text style={[styles.pillText, assignment.captainId === c.characterId && styles.pillTextActive]}>
                          {c.name} (m{c.martial}) {'☠'.repeat(riskPips(assignment.units, false))}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.reserveZone} onPress={() => handlePlace('reserve')}>
          <Text style={styles.fieldLabel}>Reserve (tap to return selected unit here)</Text>
          <View style={styles.chipWrap}>
            {deployment.reserve.length === 0 ? (
              <Text style={styles.emptyLane}>— none —</Text>
            ) : deployment.reserve.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[styles.chip, selectedUnitId === u.id && styles.chipSelected]}
                onPress={() => setSelectedUnitId(u.id)}
              >
                <Text style={styles.chipText}>{CLASS_LABEL[u.unitClass]} {Math.round(u.strength)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Commander Station</Text>
        <Text style={styles.hint}>
          {deployment.commanderStation === 'reserve'
            ? 'Command from the rear: steadier everywhere, safer.'
            : `Lead the ${LANE_LABEL[deployment.commanderStation].toLowerCase()}: stronger there, greater risk.`}
        </Text>
        <View style={styles.pillRow}>
          {([...LANES, 'reserve'] as const).map(station => (
            <TouchableOpacity
              key={station}
              style={[styles.pill, deployment.commanderStation === station && styles.pillActive]}
              onPress={() => setCommanderStation(station)}
            >
              <Text style={[styles.pillText, deployment.commanderStation === station && styles.pillTextActive]}>
                {station === 'reserve' ? 'Reserve' : LANE_LABEL[station]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.giveBattleBtn} onPress={() => onGiveBattle(deployment, defenderDeployment)}>
          <Text style={styles.giveBattleText}>Give Battle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  title: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.gold, marginBottom: 2 },
  subtitle: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, color: COLORS.dust, marginBottom: SPACING.sm },
  error: { fontFamily: FONTS.ui, fontSize: 11, color: COLORS.crimson, marginBottom: SPACING.sm },
  laneRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  laneCol: { flex: 1 },
  laneDropZone: {
    backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, minHeight: 90, marginBottom: SPACING.xs,
  },
  laneHeader: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.gold, letterSpacing: 1 },
  advantage: { fontFamily: FONTS.ui, fontSize: 9, marginTop: 2 },
  advantageGood: { color: COLORS.laurel },
  advantageBad: { color: COLORS.crimson },
  emptyLane: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 10, color: COLORS.dust, marginTop: SPACING.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: SPACING.xs },
  chip: { backgroundColor: COLORS.panelElevated, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: 'transparent' },
  chipSelected: { borderColor: COLORS.gold },
  chipText: { fontFamily: FONTS.ui, fontSize: 9, color: COLORS.marble },
  fieldLabel: { fontFamily: FONTS.ui, fontSize: 9, color: COLORS.dust, letterSpacing: 1, marginTop: SPACING.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  pill: { backgroundColor: COLORS.panelElevated, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3 },
  pillActive: { backgroundColor: COLORS.gold },
  pillText: { fontFamily: FONTS.ui, fontSize: 9, color: COLORS.marble },
  pillTextActive: { color: COLORS.bg, fontWeight: '700' },
  reserveZone: {
    backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md,
  },
  hint: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 10, color: COLORS.dust, marginBottom: 2 },
  footer: {
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  cancelBtn: { flex: 1, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.panelElevated },
  cancelText: { fontFamily: FONTS.ui, fontSize: 12, color: COLORS.dust },
  giveBattleBtn: { flex: 2, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.crimson },
  giveBattleText: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.marble, letterSpacing: 1 },
});
