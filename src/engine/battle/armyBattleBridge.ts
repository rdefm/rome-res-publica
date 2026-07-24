// ─── Army Battle Bridge ──────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C8 — the Army-flavored
// analog of musterEngine.ts's M4/M8 write-back (applyBattleOutcome), for a
// REAL tactical battle whose Rome-side force is an `Army` (state.armies),
// not a Character's personal raisedLegions/veterans.
//
// BASELINE FINDING (verified before writing any of this, per the plan's own
// §0 instruction to re-check M4's write-back pathway against Army records
// rather than trust the plan's "just point it at Army" assumption): M4's
// real `applyBattleOutcome` is hard-wired to Character.raisedLegions/veterans
// via a single `troopOwnerCharacterId` — an Army's units live in
// state.armies, not on any Character, and an Army's commanderId can be null
// or (in the model's own forward-looking comment) a non-Character legate id.
// Reusing M4 directly isn't possible; this file is the parallel pipeline the
// plan's C8 spec actually needs. Confirmed with the user before building:
// full parity with M8's veterancy-promotion arc (ArmyUnit gained
// campaignsSurvived/wonCrushingVictory to match TroopUnit's own fields).
//
// SCOPE CUT (documented, not asked — smaller than the veterancy question):
// no Army-level "lastLoyaltyCommanderId" field was added, so a mid-campaign
// commander swap's loyalty penalty (M8, Character-side only) has no Army
// analog yet. Victory/defeat loyalty deltas still apply. Revisit if this
// matters in play — adding the field later is a small, additive change.
//
// SCOPE NOTE: in every reachable case today, a Rome-side (player/rome_state
// -owned) Army's commanderId is either a real family Character or null —
// never a legate id (assignArmyCommander only ever accepts a living
// state.family member; legates are declared in the model but never actually
// hired by any gameStore action yet, verified). This file's commander-fate
// handling is written for that reality: no legate-roster branch exists here
// the way musterEngine.applyBattleOutcome's does.

import type { Army, ArmyUnit } from '../../models/army';
import type { TroopUnit, TroopType } from '../../models/troop';
import type { Character, PendingSuccession, CadetBranch } from '../../models/character';
import type { EpilogueOutcome } from '../../models/epilogue';
import type { EventInstance } from '../../models/event';
import type { Command } from '../../models/command';
import type { BattleUnit, BattleOutcome, BattleState, BattleSide, LaneId, Veterancy } from '../../models/battle';
import type { AbstractCommanderFateResult } from './abstractResolver';
import { BALANCE } from '../../data/balance';
import { detectPaterfamiliasDeath } from '../inheritanceEngine';
import { resolveDeathNotice } from '../../data/cadetEvents';
import {
  buildWoundedNotice, buildRansomDemandNotice, buildBattleDeathNotice, buildCapturedElephantNotice,
  applyCharacterDeath, computeElephantLanes,
} from './musterEngine';

const LANES: LaneId[] = ['left', 'centre', 'right'];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ─── Army ↔ BattleUnit projection ───────────────────────────────────────────
// ArmyUnit was deliberately built (Chunk C2) to already carry every field
// BattleUnit needs — this is a projection, not a translation (unlike
// TroopUnit, which needed a ×10 strength rescale).

export function armyUnitToBattleUnit(unit: ArmyUnit): BattleUnit {
  return {
    id: unit.id,
    unitClass: unit.unitClass,
    strength: unit.strength,
    veterancy: unit.veterancy,
    loyalty: unit.loyalty,
    elephantSteady: unit.elephantSteady,
    sourceRef: unit.id,
  };
}

/** Returns null when the unit was destroyed (strength reached 0). */
export function battleUnitToArmyUnit(original: ArmyUnit, unit: BattleUnit): ArmyUnit | null {
  const newStrength = clamp(Math.round(unit.strength), 0, 100);
  if (newStrength <= 0) return null;
  return {
    ...original,
    strength: newStrength,
    unitClass: unit.unitClass,
    veterancy: unit.veterancy,
    loyalty: clamp(unit.loyalty, 0, 100),
    campaignsSurvived: original.campaignsSurvived + 1,
  };
}

function troopTypeForVeterancy(v: Veterancy): TroopType {
  switch (v) {
    case 'legendary': return 'seasoned_veteran';
    case 'veteran':   return 'veteran';
    default:          return 'raised'; // 'raw' | 'trained' — no exact TroopType match; these
                                        // troops have seen the theatre, so 'garrison' (never
                                        // fought) would be wrong.
  }
}

/** Campaign Map plan, Chunk C9 — Endless-mode entry's "retain" choice for a
 *  personal Army: folds its ArmyUnits back into the commanding character's
 *  `veterans` (TroopUnit). This is the one direction Army and TroopUnit have
 *  ever needed to convert between — they're deliberately parallel, never
 *  interchangeable elsewhere (see this file's header comment) — so there's
 *  no existing helper to reuse; rescales strength the same direction
 *  battle/musterEngine.battleUnitToTroop already does (0–100 → 1–10).
 *  `homeRegion` doubles as `musterProvinceId` (same RegionId string space
 *  raiseLevy already uses for that field — 'latium' included). */
export function armyUnitToTroop(unit: ArmyUnit): TroopUnit {
  return {
    id: unit.id,
    type: troopTypeForVeterancy(unit.veterancy),
    strength: clamp(Math.round(unit.strength / 10), 1, 10),
    campaignsSurvived: unit.campaignsSurvived,
    yearsInactive: 0,
    bondToCommander: clamp(unit.loyalty, 0, 100),
    musterProvinceId: unit.homeRegion,
    unitClass: unit.unitClass,
    veterancy: unit.veterancy,
    elephantSteady: unit.elephantSteady,
    wonCrushingVictory: unit.wonCrushingVictory,
  };
}

// ─── Army lifecycle (M8 parity — veterancy promotion, loyalty, elephants) ──

const VET_TIER_INDEX: Record<Veterancy, number> = { raw: 0, trained: 1, veteran: 2, legendary: 3 };
const VET_TIER_BY_INDEX: Veterancy[] = ['raw', 'trained', 'veteran', 'legendary'];

function clampVet(v: number): number {
  return Math.min(VET_TIER_BY_INDEX.length - 1, Math.max(0, v));
}

/** Mirrors musterEngine.promotedVeterancy exactly, typed on ArmyUnit —
 *  promotion only, never a downgrade. */
export function promotedArmyVeterancy(unit: ArmyUnit): Veterancy {
  const t = BALANCE.battle.lifecycle.veterancyThresholds;
  let computed = 0;
  if (unit.campaignsSurvived >= t.trained) computed = 1;
  if (unit.campaignsSurvived >= t.veteran) computed = 2;
  if (unit.campaignsSurvived >= t.legendary && unit.wonCrushingVictory) computed = 3;
  return VET_TIER_BY_INDEX[clampVet(Math.max(VET_TIER_INDEX[unit.veterancy], computed))];
}

export interface ArmyLifecycleUpdateOpts {
  loyaltyDelta: number;
  elephantSteady: boolean;
  crushingVictory: boolean;
}

/** Mirrors musterEngine.applyLifecycleUpdates exactly, typed on ArmyUnit. */
export function applyArmyLifecycleUpdates(unit: ArmyUnit, opts: ArmyLifecycleUpdateOpts): ArmyUnit {
  const wonCrushingVictory = unit.wonCrushingVictory || opts.crushingVictory;
  const elephantSteady = unit.elephantSteady || opts.elephantSteady;
  const withFlags: ArmyUnit = {
    ...unit,
    loyalty: clamp(unit.loyalty + opts.loyaltyDelta, 0, 100),
    elephantSteady,
    wonCrushingVictory,
  };
  return { ...withFlags, veterancy: promotedArmyVeterancy(withFlags) };
}

// ─── Commander fate — shared by the tactical write-back below AND
// campaignResolver's abstract-delegate path (gameStore calls this directly
// for resolveEngagement's commanderFateRolls). Only ever called with a real
// family-member Character id — see this file's header scope note. ─────────

export interface CommanderFateSlice {
  family: Character[];
  flags: Record<string, boolean | number>;
  pendingEvents: EventInstance[];
  pendingSuccession: PendingSuccession | null;
  cadetBranch: CadetBranch | null;
  pendingEpilogue: EpilogueOutcome | null;
}

export interface CommanderFateContext {
  turnNumber: number;
  playerCharacterId: string;
  gensName: string;
}

export interface CommanderFateResult {
  slice: CommanderFateSlice;
  ledgerNotes: string[];
}

/** Applies one commander's battle-fate roll to the character-level state —
 *  wounded (cooldown flag + notice), captured (captivity + ransom-demand
 *  notice), killed (paterfamilias → the shared succession-detection path,
 *  same as natural/trial death; anyone else → applyCharacterDeath's plain
 *  removal). Mirrors musterEngine.applyBattleOutcome's own captainOutcomes
 *  branch for a real Character exactly (that function's legate branch is
 *  irrelevant here — see this file's header scope note). */
export function applyCommanderFate(
  characterId: string,
  result: AbstractCommanderFateResult,
  slice: CommanderFateSlice,
  ctx: CommanderFateContext,
): CommanderFateResult {
  const character = slice.family.find(c => c.id === characterId);
  if (!character || result === 'unharmed') return { slice, ledgerNotes: [] };

  const ledgerNotes: string[] = [];
  let { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue } = slice;

  if (result === 'wounded') {
    flags = { ...flags, [`wounded-cooldown-${character.id}`]: BALANCE.battle.wounds.durationTurns };
    pendingEvents = [...pendingEvents, buildWoundedNotice(ctx.playerCharacterId, ctx.turnNumber, character.name)];
    ledgerNotes.push(`${character.name} is wounded in battle.`);
  } else if (result === 'captured') {
    const demandDenarii = BALANCE.war.ransom.baseDenarii;
    family = family.map(c => c.id === character.id
      ? { ...c, captivity: { status: 'awaiting_ransom' as const, demandDenarii, capturedTurn: ctx.turnNumber } }
      : c);
    pendingEvents = [...pendingEvents, buildRansomDemandNotice(ctx.playerCharacterId, ctx.turnNumber, character.name, demandDenarii)];
    ledgerNotes.push(`${character.name} has been captured.`);
  } else if (result === 'killed') {
    if (character.isPlayer && !pendingSuccession) {
      const succ = detectPaterfamiliasDeath(family, character.id, []);
      family = succ.family;
      if (succ.pendingSuccession) {
        const p = succ.pendingSuccession;
        const resolution = resolveDeathNotice(p, cadetBranch, false, ctx.turnNumber, ctx.gensName);
        pendingSuccession = p;
        pendingEvents = [...pendingEvents, resolution.notice];
        if (resolution.cadetBranch) cadetBranch = resolution.cadetBranch;
        if (resolution.pendingEpilogue) pendingEpilogue = resolution.pendingEpilogue;
        ledgerNotes.push(`${character.name} has fallen in battle.`);
      }
    } else {
      const deathResult = applyCharacterDeath(family, character.id);
      family = deathResult.family;
      pendingEvents = [...pendingEvents, buildBattleDeathNotice(ctx.playerCharacterId, ctx.turnNumber, character.name)];
      ledgerNotes.push(
        `${character.name} has fallen in battle.`
        + (deathResult.successionOccurred ? ` ${deathResult.successorName} now leads the family.` : '')
      );
    }
  }

  return { slice: { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue }, ledgerNotes };
}

// ─── Full tactical write-back ───────────────────────────────────────────────

export interface ArmyBattleOutcomeInput extends CommanderFateSlice {
  army: Army;
  battleState: BattleState;
  /** Which battle-side slot the Army was deployed into — always 'attacker'
   *  in every caller today (gameStore always stages the Rome-side army as
   *  the UI-attacker slot regardless of the campaign engagement's true
   *  attacker/defender direction; DeploymentBoard only ever lets the player
   *  edit the attacker slot). Kept explicit rather than hardcoded so a
   *  future caller isn't silently wrong if that convention ever changes. */
  romeSide: BattleSide;
  outcome: BattleOutcome;
  turnNumber: number;
  playerCharacterId: string;
  gensName: string;
  /** Did the ENEMY side field elephants at deployment? Same M8 convention
   *  as BattleBridgeContext.enemyFieldedElephants. */
  enemyFieldedElephants?: boolean;
  /** For the battlesWon/battlesLost tick below — null if no command is
   *  currently held, or the army's commander doesn't hold it. */
  activeCommand: Command | null;
}

export interface ArmyBattleOutcomeResult {
  /** null = every unit in the Army was destroyed. */
  army: Army | null;
  family: Character[];
  flags: Record<string, boolean | number>;
  pendingEvents: EventInstance[];
  pendingSuccession: PendingSuccession | null;
  cadetBranch: CadetBranch | null;
  pendingEpilogue: EpilogueOutcome | null;
  activeCommand: Command | null;
  /** True when the army's commander IS the current command holder and this
   *  was a crushing win — the caller (gameStore) queues a Triumph bill off
   *  this (buildTriumphBill, turnSequencer.ts), since no `activeCampaign`-
   *  shaped marker exists for a theatre battle to hang the OLD trigger off. */
  crushingWinByCommandHolder: boolean;
  ledgerNotes: string[];
}

function battleHeadline(outcome: BattleOutcome, armyName: string): string {
  if (outcome.victor === 'withdrawal') return `${armyName} withdraws from the field in good order.`;
  const tierWord = outcome.tier === 'crushing' ? 'a crushing' : outcome.tier === 'clear' ? 'a clear' : 'a marginal';
  const isVictory = outcome.warScoreDelta >= 0;
  return `${armyName} ${isVictory ? 'wins' : 'suffers'} ${tierWord} ${isVictory ? 'victory' : 'defeat'}.`;
}

/**
 * The Army-flavored analog of musterEngine.applyBattleOutcome — casualties
 * onto ArmyUnits (via battleUnitToArmyUnit + applyArmyLifecycleUpdates),
 * every captainOutcome's character fate (via applyCommanderFate above),
 * Command.battlesWon/battlesLost (declared since Chunk C4, "ticked by the
 * future battle bridge (C8)" — this is that), and a captured-elephant roll
 * (M8 parity). Triumph-bill construction itself stays the CALLER's job
 * (gameStore) — this file has no reason to import Bill-building machinery.
 */
export function applyArmyBattleOutcome(input: ArmyBattleOutcomeInput): ArmyBattleOutcomeResult {
  const { army, battleState, romeSide, outcome, turnNumber, playerCharacterId, gensName, enemyFieldedElephants, activeCommand } = input;
  const rome = battleState[romeSide];
  const ledgerNotes: string[] = [];

  type FinalUnitInfo = { unit: BattleUnit; laneId: LaneId | 'reserve' };
  const finalUnitInfos: FinalUnitInfo[] = [
    ...LANES.flatMap(l => rome.wings[l].units.map(unit => ({ unit, laneId: l as LaneId }))),
    ...rome.reserve.map(unit => ({ unit, laneId: 'reserve' as const })),
  ];
  const finalBySourceRef = new Map(
    finalUnitInfos.filter(i => i.unit.sourceRef).map(i => [i.unit.sourceRef as string, i]),
  );
  const elephantLanes = computeElephantLanes(battleState);

  const isVictory = outcome.victor === romeSide;
  const isDefeat = outcome.victor !== romeSide && outcome.victor !== 'withdrawal';
  const lc = BALANCE.battle.lifecycle;
  const loyaltyDelta = isVictory ? lc.loyaltyGainPerVictoryShared : isDefeat ? lc.loyaltyLossPerDefeat : 0;

  // 1. Casualty + lifecycle write-back onto the Army's own units.
  const updatedUnits: ArmyUnit[] = army.units
    .map(unit => {
      const info = finalBySourceRef.get(unit.id);
      if (!info) return null; // destroyed — no final-state entry at all
      const mapped = battleUnitToArmyUnit(unit, info.unit);
      if (!mapped) return null;
      return applyArmyLifecycleUpdates(mapped, {
        loyaltyDelta,
        elephantSteady: info.laneId !== 'reserve' && elephantLanes.has(info.laneId),
        crushingVictory: outcome.tier === 'crushing' && isVictory,
      });
    })
    .filter((u): u is ArmyUnit => u !== null);

  let { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue } = input;

  // 2. Character fates — every captainOutcome that resolves to a real
  // family Character (the army's commander, or a lane captain drawn from
  // family via getEligibleFamilyCaptains — same roster source the sandbox
  // battle flow already uses).
  for (const co of outcome.captainOutcomes) {
    const fate = applyCommanderFate(
      co.characterId,
      co.result,
      { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue },
      { turnNumber, playerCharacterId, gensName },
    );
    family = fate.slice.family;
    flags = fate.slice.flags;
    pendingEvents = fate.slice.pendingEvents;
    pendingSuccession = fate.slice.pendingSuccession;
    cadetBranch = fate.slice.cadetBranch;
    pendingEpilogue = fate.slice.pendingEpilogue;
    ledgerNotes.push(...fate.ledgerNotes);
  }

  // 3. Captured elephants (M8 parity) — crushing victory over an
  // elephant-fielding enemy, once per battle.
  let finalUnits = updatedUnits;
  if (outcome.tier === 'crushing' && isVictory && enemyFieldedElephants && Math.random() < BALANCE.battle.elephant.capturedElephantChance) {
    finalUnits = [...finalUnits, {
      id: `captured-elephant-${turnNumber}-${Math.floor(Math.random() * 1e9)}`,
      unitClass: 'elephant',
      strength: 100,
      veterancy: 'raw',
      loyalty: BALANCE.battle.elephant.capturedElephantStartingLoyalty,
      elephantSteady: false,
      homeRegion: army.location,
      raisedBy: army.owner === 'player' ? 'player' : army.owner === 'carthage' ? 'npc' : 'state',
      raisedSeason: turnNumber,
      campaignsSurvived: 0,
      wonCrushingVictory: false,
    } as ArmyUnit];
    pendingEvents = [...pendingEvents, buildCapturedElephantNotice(playerCharacterId, turnNumber)];
    ledgerNotes.push('The beasts of Carthage now eat from Roman hands.');
  }

  // 4. Command battlesWon/battlesLost (declared since Chunk C4 — "ticked by
  // the future battle bridge (C8)"). Only when this army's commander IS the
  // current holder — a family member commanding an army outside any command
  // (no imperium-granted state army, no command held at all) doesn't feed it.
  let newActiveCommand = activeCommand;
  let crushingWinByCommandHolder = false;
  if (activeCommand && army.commanderId && activeCommand.holderId === army.commanderId) {
    if (isVictory) {
      newActiveCommand = { ...activeCommand, battlesWon: activeCommand.battlesWon + 1 };
      crushingWinByCommandHolder = outcome.tier === 'crushing';
    } else if (isDefeat) {
      newActiveCommand = { ...activeCommand, battlesLost: activeCommand.battlesLost + 1 };
    }
  }

  ledgerNotes.unshift(battleHeadline(outcome, army.name));

  const survivingArmy: Army | null = finalUnits.length > 0 ? { ...army, units: finalUnits } : null;

  return {
    army: survivingArmy,
    family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue,
    activeCommand: newActiveCommand,
    crushingWinByCommandHolder,
    ledgerNotes,
  };
}
