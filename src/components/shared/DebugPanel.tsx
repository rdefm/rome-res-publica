import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { EVENT_DEFS } from '../../data/events';
import { WAR_EVENT_DEFS } from '../../data/warEvents';
import { SUCCESSION_EVENT_DEFS } from '../../data/successionEvents';
import { CADET_EVENT_DEFS } from '../../data/cadetEvents';
import { SECRET_EVENT_DEFS } from '../../data/secretEvents';
import { TUTORIAL_EVENT_DEFS } from '../../data/tutorialEvents';
import { CLAUDIUS_ARC_EVENT_DEFS } from '../../data/claudiusArc';
import { COMPROMISING_EVENT_DEFS } from '../../data/compromisingEvents';
import { BALANCE } from '../../data/balance';
import { DIFFICULTY_DEFINITIONS } from '../../data/startDefinitions';
import { computeAllStagePace, type ActionEconomyStage, type StagePaceSummary } from '../../engine/actionEconomyEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
// Military Overhaul M11 — sandbox army builder + headless harness runner.
import type { BattleUnit, UnitClass, Veterancy } from '../../models/battle';
import { ENEMY_GENERAL_LIST } from '../../data/enemyGenerals';
import { simulateBattles, type BattleSimConfig, type BattleSimAggregate } from '../../engine/battle/battleSim';
// Campaign Map plan, Chunk C1 — theatre map debug listing.
import { REGIONS } from '../../data/theatreMap';
import { getAdjacent, getRegionRelationship } from '../../engine/theatreEngine';
import type { Army } from '../../models/army';
import type { RegionId } from '../../models/theatre';

// ─── Types ────────────────────────────────────────────────────────────────────

type Resource = 'fides' | 'lifetimeDignitas' | 'denarii' | 'crisisLevel';

const RESOURCES: { key: Resource; label: string; color: string }[] = [
  { key: 'fides',            label: 'Fides',              color: COLORS.fidesColor        },
  { key: 'lifetimeDignitas', label: 'Dignitas (Legacy)',  color: COLORS.lifetimeDignColor },
  { key: 'denarii',          label: 'Denarii',            color: COLORS.denariiColor      },
  { key: 'crisisLevel',      label: 'Crisis',             color: COLORS.crimson           },
];

const CHARACTER_FIELDS: { key: string; label: string }[] = [
  { key: 'age',             label: 'Age'             },
  { key: 'familyTrust',     label: 'Family Trust'    },
  { key: 'corruptionScore', label: 'Corruption'      },
  { key: 'relationship',    label: 'Relationship'    },
  { key: 'skills.rhetoric',   label: 'Skill: Rhetoric'   },
  { key: 'skills.martial',    label: 'Skill: Martial'    },
  { key: 'skills.intrigus',   label: 'Skill: Intrigus'   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCharacterField(char: any, key: string): number {
  if (key.startsWith('skills.')) {
    return char.skills?.[key.split('.')[1]] ?? 0;
  }
  return char[key] ?? 0;
}

function setCharacterField(char: any, key: string, value: number): any {
  if (key.startsWith('skills.')) {
    const skill = key.split('.')[1];
    return { ...char, skills: { ...char.skills, [skill]: value } };
  }
  return { ...char, [key]: value };
}

// ─── Difficulty dev override (Phase 5, Chunk P5-G) ──────────────────────────
// Mid-run switching is otherwise deliberately impossible (design call — the
// picker's choice is fixed for the run, so Hall records stay honest); this
// exists for testing only, reading BALANCE.difficulty live off state.difficulty
// same as calcResourceIncome/calcIndividualEscalation, so a tap here changes
// next season's numbers immediately.

function DifficultyOverrideRow() {
  const difficulty = useGameStore(s => s.difficulty);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Difficulty (dev)</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {DIFFICULTY_DEFINITIONS.map(d => (
          <Chip
            key={d.id}
            label={d.name}
            selected={difficulty === d.id}
            onPress={() => useGameStore.setState({ difficulty: d.id })}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Section: Resources ───────────────────────────────────────────────────────

function ResourceSection() {
  const state = useGameStore();
  const [inputs, setInputs] = useState<Record<string, string>>({});

  function apply(key: Resource) {
    const raw = inputs[key] ?? '';
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    if (key === 'crisisLevel') {
      useGameStore.setState({ crisisLevel: Math.min(100, Math.max(0, val)) });
    } else {
      useGameStore.setState({ [key]: Math.max(0, val) } as any);
    }
    setInputs(prev => ({ ...prev, [key]: '' }));
  }

  return (
    <View style={styles.section}>
      <DifficultyOverrideRow />
      <Text style={styles.sectionTitle}>RESOURCES</Text>
      {RESOURCES.map(({ key, label, color }) => (
        <View key={key} style={styles.row}>
          <Text style={[styles.rowLabel, { color }]}>{label}</Text>
          <Text style={styles.rowCurrent}>{(state as any)[key]}</Text>
          <TextInput
            style={styles.input}
            value={inputs[key] ?? ''}
            onChangeText={v => setInputs(prev => ({ ...prev, [key]: v }))}
            keyboardType="numeric"
            placeholder="set to…"
            placeholderTextColor={COLORS.dust}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={() => apply(key)}>
            <Text style={styles.applyBtnText}>SET</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Character Stats ─────────────────────────────────────────────────

function CharacterSection() {
  const family = useGameStore(s => s.family);
  const [selectedId, setSelectedId] = useState<string>(family[0]?.id ?? '');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = family.find(c => c.id === selectedId) ?? family[0];

  function apply(fieldKey: string) {
    const raw = inputs[fieldKey] ?? '';
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    const updatedFamily = family.map(c =>
      c.id === selected.id ? setCharacterField(c, fieldKey, val) : c
    );
    useGameStore.setState({ family: updatedFamily });
    setInputs(prev => ({ ...prev, [fieldKey]: '' }));
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>CHARACTER STATS</Text>

      {/* Character picker */}
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerOpen(true)}>
        <Text style={styles.pickerBtnText}>
          {selected?.name ?? 'Select character'} ▾
        </Text>
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <View style={styles.pickerModal}>
            {family.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickerItem, c.id === selectedId && styles.pickerItemActive]}
                onPress={() => { setSelectedId(c.id); setPickerOpen(false); }}
              >
                <Text style={styles.pickerItemText}>{c.name}</Text>
                <Text style={styles.pickerItemSub}>{c.role} · Age {c.age}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fields */}
      {CHARACTER_FIELDS.map(({ key, label }) => (
        <View key={key} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowCurrent}>{getCharacterField(selected, key)}</Text>
          <TextInput
            style={styles.input}
            value={inputs[key] ?? ''}
            onChangeText={v => setInputs(prev => ({ ...prev, [key]: v }))}
            keyboardType="numeric"
            placeholder="set to…"
            placeholderTextColor={COLORS.dust}
          />
          <TouchableOpacity style={styles.applyBtn} onPress={() => apply(key)}>
            <Text style={styles.applyBtnText}>SET</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Events ──────────────────────────────────────────────────────────

function EventsSection() {
  const [search, setSearch] = useState('');

  // Phase 5, P5-A — extended to full 8-pool coverage (was missing
  // TUTORIAL_EVENT_DEFS/CLAUDIUS_ARC_EVENT_DEFS/COMPROMISING_EVENT_DEFS),
  // matching eventEngine.getEventDef's combined lookup exactly.
  const filtered = [...EVENT_DEFS, ...WAR_EVENT_DEFS, ...SUCCESSION_EVENT_DEFS, ...CADET_EVENT_DEFS, ...SECRET_EVENT_DEFS, ...TUTORIAL_EVENT_DEFS, ...CLAUDIUS_ARC_EVENT_DEFS, ...COMPROMISING_EVENT_DEFS].filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.id.toLowerCase().includes(search.toLowerCase())
  );

  function fire(defId: string) {
    const instance = {
      defId,
      firedAtTurn: useGameStore.getState().turnNumber,
      targetCharacterId: 'pc-1',
    };
    useGameStore.setState({ activeEvent: instance });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>FIRE EVENT</Text>
      <TextInput
        style={[styles.input, styles.searchInput]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search events…"
        placeholderTextColor={COLORS.dust}
      />
      {filtered.map(def => (
        <TouchableOpacity key={def.id} style={styles.eventRow} onPress={() => fire(def.id)}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>{def.title}</Text>
            <Text style={styles.eventId}>{def.id}</Text>
          </View>
          <View style={[styles.weightBadge, def.weight === 0 && styles.weightBadgeZero]}>
            <Text style={styles.weightBadgeText}>w:{def.weight}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Section: Battle (Military Overhaul M5, army builder + harness M11) ────
// Entry point for the set-piece battle system. The quick button musters the
// player's own family/troops (synthesizing a small starting force if they
// have none) against a preset Carthaginian defender — unchanged from M5.
// Below it, M11 adds a full per-unit army builder for both sides (launches
// through the exact same DeploymentBoard/BattleScreen pipeline via
// gameStore.startCustomSandboxBattle) and a headless simulateBattles runner
// for aggregate tuning stats, reusing the SAME builder armies/generals.

const UNIT_CLASSES: UnitClass[] = ['legionary', 'spear_foot', 'skirmisher', 'cavalry_heavy', 'cavalry_light', 'elephant'];
const VETERANCIES: Veterancy[] = ['raw', 'trained', 'veteran', 'legendary'];
const TERRAIN_IDS = Object.keys(BALANCE.battle.terrains);

interface BuilderUnit { id: string; unitClass: UnitClass; veterancy: Veterancy; }

let _builderUnitId = 0;
function mkBuilderUnit(unitClass: UnitClass, veterancy: Veterancy): BuilderUnit {
  _builderUnitId += 1;
  return { id: `builder-${_builderUnitId}`, unitClass, veterancy };
}

function builderUnitsToBattleUnits(units: BuilderUnit[]): BattleUnit[] {
  return units.map(u => ({
    id: u.id, unitClass: u.unitClass, strength: 100, veterancy: u.veterancy,
    loyalty: 50, elephantSteady: false,
  }));
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[chipStyles.chip, selected && chipStyles.chipSelected]} onPress={onPress}>
      <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ArmyBuilderSide({
  label, units, onAdd, onRemove, generalId, onGeneralChange,
}: {
  label: string;
  units: BuilderUnit[];
  onAdd: (unitClass: UnitClass, veterancy: Veterancy) => void;
  onRemove: (id: string) => void;
  generalId: string;
  onGeneralChange: (id: string) => void;
}) {
  const [cls, setCls] = useState<UnitClass>('legionary');
  const [vet, setVet] = useState<Veterancy>('trained');

  return (
    <View style={builderStyles.side}>
      <Text style={styles.sectionTitle}>{label} ({units.length} units)</Text>

      <Text style={builderStyles.subLabel}>General (stock profile)</Text>
      <View style={chipStyles.chipRow}>
        {ENEMY_GENERAL_LIST.map(g => (
          <Chip key={g.id} label={`${g.name} (mar ${g.martial})`} selected={generalId === g.id} onPress={() => onGeneralChange(g.id)} />
        ))}
      </View>

      {units.length > 0 && (
        <View style={builderStyles.unitList}>
          {units.map(u => (
            <View key={u.id} style={builderStyles.unitRow}>
              <Text style={builderStyles.unitRowText}>{u.unitClass} · {u.veterancy}</Text>
              <TouchableOpacity onPress={() => onRemove(u.id)}>
                <Text style={styles.flagNote}>✕ remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={builderStyles.subLabel}>Add unit — class</Text>
      <View style={chipStyles.chipRow}>
        {UNIT_CLASSES.map(c => <Chip key={c} label={c} selected={cls === c} onPress={() => setCls(c)} />)}
      </View>
      <Text style={builderStyles.subLabel}>Add unit — veterancy</Text>
      <View style={chipStyles.chipRow}>
        {VETERANCIES.map(v => <Chip key={v} label={v} selected={vet === v} onPress={() => setVet(v)} />)}
      </View>
      <TouchableOpacity style={styles.applyBtn} onPress={() => onAdd(cls, vet)}>
        <Text style={styles.applyBtnText}>+ ADD UNIT</Text>
      </TouchableOpacity>
    </View>
  );
}

function ArmyBuilderAndHarnessSection() {
  const startCustomSandboxBattle = useGameStore(s => s.startCustomSandboxBattle);
  const activeBattle = useGameStore(s => s.activeBattle);
  const activeBattleSetup = useGameStore(s => s.activeBattleSetup);
  const inProgress = !!activeBattle || !!activeBattleSetup;

  const [attackerUnits, setAttackerUnits] = useState<BuilderUnit[]>([]);
  const [defenderUnits, setDefenderUnits] = useState<BuilderUnit[]>([]);
  const [attackerGeneralId, setAttackerGeneralId] = useState(ENEMY_GENERAL_LIST[0].id);
  const [defenderGeneralId, setDefenderGeneralId] = useState(ENEMY_GENERAL_LIST[1]?.id ?? ENEMY_GENERAL_LIST[0].id);
  const [terrainId, setTerrainId] = useState(TERRAIN_IDS[0]);
  const [seedText, setSeedText] = useState('');

  const [trialsText, setTrialsText] = useState('100');
  const [aiVsAi, setAiVsAi] = useState(true);
  const [harnessResult, setHarnessResult] = useState<BattleSimAggregate | null>(null);
  const [harnessError, setHarnessError] = useState<string | null>(null);

  function launch() {
    if (attackerUnits.length === 0 || defenderUnits.length === 0) return;
    const seed = seedText.trim() === '' ? undefined : parseInt(seedText, 10);
    startCustomSandboxBattle(
      builderUnitsToBattleUnits(attackerUnits), attackerGeneralId,
      builderUnitsToBattleUnits(defenderUnits), defenderGeneralId,
      terrainId, isNaN(seed as number) ? undefined : seed,
    );
  }

  function runHarness() {
    setHarnessError(null);
    setHarnessResult(null);
    if (attackerUnits.length === 0 || defenderUnits.length === 0) {
      setHarnessError('Add at least one unit to each side first.');
      return;
    }
    const n = clampInt(parseInt(trialsText, 10), 1, 2000, 100);
    const attackerProfile = ENEMY_GENERAL_LIST.find(g => g.id === attackerGeneralId)!;
    const defenderProfile = ENEMY_GENERAL_LIST.find(g => g.id === defenderGeneralId)!;
    const configA: BattleSimConfig = { label: 'A', generalProfile: attackerProfile, army: builderUnitsToBattleUnits(attackerUnits) };
    const configB: BattleSimConfig = { label: 'B', generalProfile: defenderProfile, army: builderUnitsToBattleUnits(defenderUnits) };
    try {
      const result = simulateBattles(configA, configB, n, aiVsAi, BALANCE.battle.terrains[terrainId]);
      setHarnessResult(result);
    } catch (e) {
      setHarnessError((e as Error).message);
    }
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ARMY BUILDER (M11)</Text>
        <Text style={styles.eventId}>
          Fully synthetic — decoupled from the player's real family/troops. Launches through the same
          DeploymentBoard/BattleScreen pipeline as every other sandbox entry point.
        </Text>

        <ArmyBuilderSide
          label="ATTACKER"
          units={attackerUnits}
          onAdd={(c, v) => setAttackerUnits(prev => [...prev, mkBuilderUnit(c, v)])}
          onRemove={id => setAttackerUnits(prev => prev.filter(u => u.id !== id))}
          generalId={attackerGeneralId}
          onGeneralChange={setAttackerGeneralId}
        />
        <ArmyBuilderSide
          label="DEFENDER"
          units={defenderUnits}
          onAdd={(c, v) => setDefenderUnits(prev => [...prev, mkBuilderUnit(c, v)])}
          onRemove={id => setDefenderUnits(prev => prev.filter(u => u.id !== id))}
          generalId={defenderGeneralId}
          onGeneralChange={setDefenderGeneralId}
        />

        <Text style={builderStyles.subLabel}>Terrain</Text>
        <View style={chipStyles.chipRow}>
          {TERRAIN_IDS.map(id => (
            <Chip key={id} label={BALANCE.battle.terrains[id].label} selected={terrainId === id} onPress={() => setTerrainId(id)} />
          ))}
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Seed (blank=random)</Text>
          <TextInput
            style={styles.input}
            value={seedText}
            onChangeText={setSeedText}
            keyboardType="numeric"
            placeholder="random"
            placeholderTextColor={COLORS.dust}
          />
        </View>

        <TouchableOpacity style={styles.eventRow} onPress={launch} disabled={inProgress || attackerUnits.length === 0 || defenderUnits.length === 0}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>⚔ Launch Custom Battle</Text>
            <Text style={styles.eventId}>
              {inProgress ? 'A battle is already in progress'
                : (attackerUnits.length === 0 || defenderUnits.length === 0) ? 'Add units to both sides first'
                : 'Opens the deployment screen'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HEADLESS HARNESS (M11)</Text>
        <Text style={styles.eventId}>
          Runs simulateBattles on the SAME builder armies/generals/terrain above, no UI — for tuning
          stats or reproducing a bug report's aggregate behaviour across many seeds.
        </Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Trials</Text>
          <TextInput
            style={styles.input}
            value={trialsText}
            onChangeText={setTrialsText}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={COLORS.dust}
          />
        </View>
        <View style={chipStyles.chipRow}>
          <Chip label="AI vs AI" selected={aiVsAi} onPress={() => setAiVsAi(true)} />
          <Chip label="Trivial (hold formation)" selected={!aiVsAi} onPress={() => setAiVsAi(false)} />
        </View>

        <TouchableOpacity style={styles.applyBtn} onPress={runHarness}>
          <Text style={styles.applyBtnText}>▶ RUN HARNESS</Text>
        </TouchableOpacity>

        {harnessError && <Text style={styles.flagNote}>{harnessError}</Text>}
        {harnessResult && (
          <Text style={styles.dump} selectable>
            {JSON.stringify(harnessResult, null, 2)}
          </Text>
        )}
      </View>
    </>
  );
}

function clampInt(v: number, min: number, max: number, fallback: number): number {
  if (isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function BattleSection() {
  const startSandboxBattle = useGameStore(s => s.startSandboxBattle);
  const activeBattle = useGameStore(s => s.activeBattle);
  const activeBattleSetup = useGameStore(s => s.activeBattleSetup);
  const inProgress = !!activeBattle || !!activeBattleSetup;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SANDBOX BATTLE</Text>
        <Text style={styles.eventId}>
          Launches a full set-piece battle: deployment, round-by-round orders, break decisions,
          and an outcome that writes back to real game state via musterEngine.applyBattleOutcome.
        </Text>
        <TouchableOpacity style={styles.eventRow} onPress={startSandboxBattle} disabled={inProgress}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>⚔ Launch Sandbox Battle</Text>
            <Text style={styles.eventId}>
              {inProgress ? 'A battle is already in progress' : 'Opens the deployment screen'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      <ArmyBuilderAndHarnessSection />
    </>
  );
}

// ─── Section: War (Military Overhaul M9) ───────────────────────────────────
// No real "declare war" trigger exists anywhere in the app yet (Phase 3A
// supplies one) — this is the only way to start/advance a war today.

function WarSection() {
  const wars = useGameStore(s => s.wars);
  const startWar = useGameStore(s => s.startWar);
  const endWar = useGameStore(s => s.endWar);
  const forceSetPieceOffer = useGameStore(s => s.forceSetPieceOffer);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WAR SCORE (M9)</Text>
      <Text style={styles.eventId}>
        processWarSeason runs every season end for each active war (skirmish drift, weariness,
        threshold notices, the provisional set-piece scheduler). No in-game "declare war" trigger
        exists yet — Phase 3A supplies one; this panel is the only entry point today.
      </Text>
      <TouchableOpacity
        style={styles.eventRow}
        onPress={() => startWar('carthage', 'major', null)}
      >
        <View style={styles.eventRowInner}>
          <Text style={styles.eventTitle}>⚔ Declare War on Carthage</Text>
          <Text style={styles.eventId}>No-ops if already at war with Carthage</Text>
        </View>
      </TouchableOpacity>

      {wars.length === 0 && <Text style={styles.emptyText}>No wars yet.</Text>}
      {wars.map(war => (
        <View key={war.id} style={styles.eventRow}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>
              {war.active ? '⚔' : '☮'} {war.enemyId} ({war.scale}) — score {war.warScore}, weariness {war.weariness}
            </Text>
            <Text style={styles.eventId}>
              {war.pendingSetPiece
                ? `Pending offer: ${war.pendingSetPiece.siteName} (expires turn ${war.pendingSetPiece.expiresTurn})`
                : 'No pending offer'}
            </Text>
            {war.active && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity onPress={() => forceSetPieceOffer(war.id)} disabled={!!war.pendingSetPiece}>
                  <Text style={[styles.flagNote, war.pendingSetPiece ? { opacity: 0.4 } : null]}>
                    Force Set-Piece Offer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => endWar(war.id)}>
                  <Text style={styles.flagNote}>End War</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Theatre Map (Campaign Map plan, Chunk C1) ────────────────────
// Read-only listing of the 8 launch regions — controller, live relationship
// (averaged from the region's cities), and adjacency. Nothing here is
// wired to gameplay yet (C1's own "Done when": zero gameplay change); this
// exists purely so the data model is visibly inspectable before C2+ builds
// armies/movement/AI on top of it.

function TheatreSection() {
  const cities = useGameStore(s => s.cities);
  const armies = useGameStore(s => s.armies);
  const spawnArmy = useGameStore(s => s.spawnArmy);

  const owners: Army['owner'][] = ['player', 'rome_state', 'rome_rival', 'carthage'];

  function spawnTestArmy(regionId: RegionId, owner: Army['owner']) {
    const region = REGIONS.find(r => r.id === regionId);
    const seatCityId = region?.cityIds[0] ?? null;
    const n = armies.filter(a => a.location === regionId).length + 1;
    const army: Army = {
      id: `debug-army-${Date.now()}`,
      name: `Legio ${n} (${region?.name ?? regionId})`,
      owner,
      commanderId: null,
      location: regionId,
      stationedCityId: seatCityId,
      units: [
        {
          id: `unit-${Date.now()}-a`,
          unitClass: 'legionary',
          strength: 85,
          veterancy: 'trained',
          loyalty: 55,
          elephantSteady: false,
          homeRegion: regionId,
          raisedBy: owner === 'player' ? 'player' : owner === 'carthage' ? 'npc' : 'state',
          raisedSeason: 1,
        },
        {
          id: `unit-${Date.now()}-b`,
          unitClass: 'cavalry_light',
          strength: 70,
          veterancy: 'raw',
          loyalty: 50,
          elephantSteady: false,
          homeRegion: regionId,
          raisedBy: owner === 'player' ? 'player' : owner === 'carthage' ? 'npc' : 'state',
          raisedSeason: 1,
        },
      ],
      stance: 'give_battle',
      ordersThisSeason: null,
      fatigued: false,
      unpaidSeasons: 0,
    };
    spawnArmy(army);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>THEATRE MAP — REGIONS ({REGIONS.length})</Text>
      <Text style={styles.eventId}>
        Static data only (data/theatreMap.ts) — controllers/contested tracking lands in a
        later chunk. Relationship is live-computed from each region's cities right now.
      </Text>
      {REGIONS.map(region => {
        const relationship = getRegionRelationship(cities, region.id);
        const adjacentLand = getAdjacent(region.id, 'land');
        const adjacentStrait = getAdjacent(region.id, 'strait');
        const adjacentSea = getAdjacent(region.id, 'sea');
        return (
          <View key={region.id} style={styles.eventRow}>
            <View style={styles.eventRowInner}>
              <Text style={styles.eventTitle}>
                {region.name} ({region.startingController}) — rel {relationship.toFixed(1)}
              </Text>
              <Text style={styles.eventId}>
                terrain: {region.terrainId} · coastal: {region.coastal ? 'yes' : 'no'} ·
                manpower: {region.baseManpower} · cities: {region.cityIds.join(', ')}
              </Text>
              <Text style={styles.eventId}>
                adjacent — land: {adjacentLand.join(', ') || 'none'} ·
                strait: {adjacentStrait.join(', ') || 'none'} ·
                sea: {adjacentSea.join(', ') || 'none'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {owners.map(owner => (
                  <TouchableOpacity key={owner} onPress={() => spawnTestArmy(region.id, owner)}>
                    <Text style={styles.flagNote}>+ {owner}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );
      })}

      <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
        ARMIES ({armies.length}) — Chunk C2
      </Text>
      <Text style={styles.eventId}>
        Spawned here or via the real Provinciae map (tap a region's army marker, or empty
        region ground). Combine/Divide/Assign Commander/Stance all live in the real UI
        (RegionSheet/ArmyCard) — this list is read-only, for a quick sanity check.
      </Text>
      {armies.length === 0 && <Text style={styles.emptyText}>No armies yet — spawn one above.</Text>}
      {armies.map(army => (
        <View key={army.id} style={styles.eventRow}>
          <View style={styles.eventRowInner}>
            <Text style={styles.eventTitle}>
              {army.name} — {army.owner} @ {army.location}
              {army.stationedCityId ? ` (${army.stationedCityId})` : ''}
            </Text>
            <Text style={styles.eventId}>
              {army.units.length} unit(s) · commander: {army.commanderId ?? 'none'} · stance: {army.stance}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Telemetry (P2-A) ─────────────────────────────────────────────
// Dumps BALANCE and seasonStatsHistory for tuning reference. Chunk P2-E adds
// a richer "Pace" view (rolling averages, band/time flags) on top of the same
// seasonStatsHistory data.

function TelemetrySection() {
  const seasonStatsHistory = useGameStore(s => s.seasonStatsHistory);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SEASON STATS HISTORY (last {seasonStatsHistory.length})</Text>
      <Text style={styles.dump} selectable>
        {JSON.stringify(seasonStatsHistory, null, 2)}
      </Text>
      <Text style={styles.sectionTitle}>BALANCE REGISTRY</Text>
      <Text style={styles.dump} selectable>
        {JSON.stringify(BALANCE, null, 2)}
      </Text>
    </View>
  );
}

// ─── Section: Secrets (Phase 4, P4-A) ──────────────────────────────────────
// No spend/counterplay UI yet (P4-B) — this dump is the only way to see
// generated Secrets and per-leader groundwork this chunk.

function SecretsSection() {
  const secrets = useGameStore(s => s.secrets);
  const clans = useGameStore(s => s.clans);

  const groundworkByLeader = clans
    .flatMap(c => c.leaders)
    .filter(l => (l.intelGroundwork ?? 0) > 0)
    .map(l => ({ id: l.id, name: l.name, groundwork: l.intelGroundwork }));

  const heldByPlayer = secrets.filter(s => s.holder === 'player');
  const heldAgainstFamily = secrets.filter(s => s.holder !== 'player');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>HELD BY YOU ({heldByPlayer.length})</Text>
      <Text style={styles.dump} selectable>
        {JSON.stringify(heldByPlayer, null, 2)}
      </Text>
      <Text style={styles.sectionTitle}>HELD AGAINST YOUR FAMILY ({heldAgainstFamily.length})</Text>
      <Text style={styles.dump} selectable>
        {JSON.stringify(heldAgainstFamily, null, 2)}
      </Text>
      <Text style={styles.sectionTitle}>INTEL GROUNDWORK (in progress)</Text>
      <Text style={styles.dump} selectable>
        {JSON.stringify(groundworkByLeader, null, 2)}
      </Text>
    </View>
  );
}

// ─── Section: Pace (P2-E) ───────────────────────────────────────────────────
// Last-10-per-stage averages read from seasonStatsHistory, bucketed by each
// season's own patronTierAtEnd snapshot (engine/actionEconomyEngine.ts).
// This is the tuning dashboard the plan asks be built before touching any
// BALANCE.actionEconomy / BALANCE.elections numbers.

const STAGE_LABEL: Record<ActionEconomyStage, string> = {
  early: 'EARLY (Tier 0–1)',
  mid:   'MID (Tier 2–3)',
  late:  'LATE (Tier 4–5)',
};

function StagePaceCard({ summary }: { summary: StagePaceSummary }) {
  return (
    <View style={[paceStyles.card, summary.actionsOutOfBand && paceStyles.cardFlagged]}>
      <View style={paceStyles.cardHeader}>
        <Text style={paceStyles.cardTitle}>{STAGE_LABEL[summary.stage]}</Text>
        <Text style={paceStyles.cardSample}>n={summary.sampleSize}</Text>
      </View>

      <View style={paceStyles.row}>
        <Text style={paceStyles.rowLabel}>Actions/season</Text>
        <Text style={[paceStyles.rowValue, summary.actionsOutOfBand && paceStyles.rowValueFlagged]}>
          {summary.avgActions.toFixed(1)} (target {summary.actionBand[0]}–{summary.actionBand[1]})
        </Text>
      </View>
      <View style={paceStyles.row}>
        <Text style={paceStyles.rowLabel}>Duration</Text>
        <Text style={[paceStyles.rowValue, summary.anyOverTimeBudget && paceStyles.rowValueFlagged]}>
          {Math.round(summary.avgDurationSec)}s avg{summary.anyOverTimeBudget ? ' — some over 8m' : ''}
        </Text>
      </View>
      <View style={paceStyles.row}>
        <Text style={paceStyles.rowLabel}>Fides income / spent</Text>
        <Text style={paceStyles.rowValue}>
          {summary.avgFidesIncome.toFixed(1)} / {summary.avgFidesSpent.toFixed(1)}
        </Text>
      </View>
      <View style={paceStyles.row}>
        <Text style={paceStyles.rowLabel}>Denarii income / spent</Text>
        <Text style={paceStyles.rowValue}>
          {summary.avgDenariiIncome.toFixed(1)} / {summary.avgDenariiSpent.toFixed(1)}
        </Text>
      </View>

      {summary.actionsOutOfBand && (
        <Text style={paceStyles.flagNote}>
          ⚠ Outside the {STAGE_LABEL[summary.stage].toLowerCase()} action band.
        </Text>
      )}
    </View>
  );
}

// ─── Section: Auto-season runner (Phase 5, Chunk P5-A) ───────────────────────
// "Run N seasons idle" — ends seasons with no player input, letting
// seasonStatsHistory and the crisis/economy state accumulate for P5-H's
// drift instrument and B–D's weight-sanity checks. Orchestration lives in
// gameStore.runIdleSeasons (UI stays logic-free) — this component is just
// the input/trigger/result display.
function AutoSeasonRunnerSection() {
  const [count, setCount] = useState('20');
  const [result, setResult] = useState<{ seasonsCompleted: number; stuckReason: string | null } | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    const n = parseInt(count, 10);
    if (!n || n <= 0) return;
    setRunning(true);
    // Synchronous — a debug-only tool, not meant to stay responsive mid-run.
    const r = useGameStore.getState().runIdleSeasons(n);
    setResult(r);
    setRunning(false);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AUTO-SEASON RUNNER</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <TextInput
          style={[styles.input, { width: 80 }]}
          value={count}
          onChangeText={setCount}
          keyboardType="number-pad"
          placeholder="20"
          placeholderTextColor={COLORS.dust}
        />
        <TouchableOpacity style={styles.applyBtn} onPress={run} disabled={running}>
          <Text style={styles.applyBtnText}>{running ? 'RUNNING…' : '▶ RUN SEASONS IDLE'}</Text>
        </TouchableOpacity>
      </View>
      {result && (
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={paceStyles.emptyText}>
            Completed {result.seasonsCompleted} season(s).
            {result.stuckReason ? ` Could not fully auto-drive: ${result.stuckReason}` : ' No sequence needed manual intervention.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function PaceSection() {
  const seasonStatsHistory = useGameStore(s => s.seasonStatsHistory);
  const summaries = computeAllStagePace(seasonStatsHistory);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PACE — LAST 10 SEASONS PER STAGE</Text>
      {summaries.length === 0 ? (
        <Text style={paceStyles.emptyText}>
          No season history yet. Play a season and check back.
        </Text>
      ) : (
        summaries.map(summary => <StagePaceCard key={summary.stage} summary={summary} />)
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  chip: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  chipSelected: {
    backgroundColor: COLORS.panelElevated,
    borderColor: COLORS.gold,
  },
  chipText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
  },
  chipTextSelected: {
    color: COLORS.gold,
  },
});

const builderStyles = StyleSheet.create({
  side: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 4,
  },
  subLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
    marginTop: SPACING.xs,
  },
  unitList: {
    gap: 4,
    marginVertical: SPACING.xs,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  unitRowText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.marble,
  },
});

const paceStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardFlagged: {
    borderColor: COLORS.crimson,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  cardSample: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rowLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
  },
  rowValue: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.marble,
  },
  rowValueFlagged: {
    color: COLORS.crimson,
  },
  flagNote: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.crimson,
    marginTop: SPACING.xs,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
  },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DebugPanel() {
  const [tab, setTab] = useState<'resources' | 'characters' | 'events' | 'battle' | 'war' | 'theatre' | 'secrets' | 'telemetry' | 'pace'>('resources');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙ DEBUG</Text>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['resources', 'characters', 'events', 'battle', 'war', 'theatre', 'secrets', 'telemetry', 'pace'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'resources'  && <ResourceSection />}
        {tab === 'characters' && <CharacterSection />}
        {tab === 'events'     && <EventsSection />}
        {tab === 'battle'     && <BattleSection />}
        {tab === 'war'        && <WarSection />}
        {tab === 'theatre'    && <TheatreSection />}
        {tab === 'secrets'    && <SecretsSection />}
        {tab === 'telemetry'  && <TelemetrySection />}
        {tab === 'pace'       && <><AutoSeasonRunnerSection /><PaceSection /></>}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.crimson,
  },
  header: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.crimson,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.crimson,
  },
  tabText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.dust,
  },
  tabTextActive: {
    color: COLORS.crimson,
  },
  scroll: {
    maxHeight: 420,
  },
  section: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.goldDim,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowLabel: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.marble,
    width: 110,
  },
  rowCurrent: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.gold,
    width: 36,
    textAlign: 'right',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
  searchInput: {
    flex: undefined,
    width: '100%',
    marginBottom: SPACING.xs,
  },
  applyBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  applyBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 1,
  },

  // Character picker
  pickerBtn: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pickerBtnText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  pickerModal: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  pickerItem: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemActive: {
    backgroundColor: COLORS.panelSurface,
  },
  pickerItemText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.marble,
  },
  pickerItemSub: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  },

  // Events
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  eventRowInner: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.marble,
  },
  eventId: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.dust,
    marginTop: 1,
  },
  weightBadge: {
    backgroundColor: COLORS.laurel,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  weightBadgeZero: {
    backgroundColor: COLORS.panelElevated,
  },
  weightBadgeText: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.marble,
  },

  // Telemetry
  dump: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: COLORS.dust,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
  },
  flagNote: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.crimson,
  },
});
