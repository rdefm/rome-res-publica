import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import type { CrisisTrackId } from '../models/crisis';
import type { WarState, WarScale } from '../models/war';
import type { Bill } from '../models/bill';
import { parseEffect } from '../models/bill';
import { generateClientName } from '../data/clientNames';
import { computeTotalAssetBonuses } from './assetEngine';
import { computeHouseBonuses } from './houseEngine';
import { calcAssetGoldOutput, calcAssetFidesOutput } from './provinceEngine';
import { buildClient, computeTotalClientBonuses } from './clientEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';
import {
  getCrisisStatusEffects,
  applyTrackDelta,
} from './crisisEngine';
import { getTierFromLevel } from '../models/crisis';
import { BALANCE } from '../data/balance';
import { applySuccession, promoteCadetToParterfamilias } from './inheritanceEngine';
import { generateLatentSecret } from './secretEngine';
import type { SecretType } from '../models/secret';

export interface ApplyEffectOptions {
  previewClientName?: string;
  instance?: EventInstance | null;
}

// ─── Rome stat modifiers ──────────────────────────────────────────────────────

export interface RomeStatModifiers {
  fidesDelta: number;
  denariDelta: number;
  crisisEscalationMultiplier: number;
  crisisAbsorption: number;
  plebsCrisisBonus: number;
  patronFavourWaived: boolean;
  stabilityLabel: string;
  plebsLabel: string;
  treasuryLabel: string;
}

/**
 * Compute all passive modifiers from the three Rome stats.
 * Called once per season in calcResourceIncome and turnSequencer.
 */
export function calcRomeStatModifiers(rome: GameState['rome']): RomeStatModifiers {
  const { stability, plebs, treasury } = rome;

  // ── Stability → Fides contribution ────────────────────────────────────────
  let fidesFromStability = 0;
  let crisisMultiplier = 1.0;
  let stabilityLabel = 'Stable';
  if (stability < 20) {
    fidesFromStability = -2;
    crisisMultiplier = 1.5;
    stabilityLabel = 'Instability';
  } else if (stability < 40) {
    fidesFromStability = -1;
    crisisMultiplier = 1.25;
    stabilityLabel = 'Fragile';
  } else if (stability < 70) {
    stabilityLabel = 'Stable';
  } else if (stability < 85) {
    fidesFromStability = +1;
    stabilityLabel = 'Cohesive';
  } else {
    fidesFromStability = +2;
    crisisMultiplier = 0.85;
    stabilityLabel = 'Pax Interna';
  }

  // ── Plebs → Fides contribution ─────────────────────────────────────────────
  let fidesFromPlebs = 0;
  let plebsCrisisBonus = 0;
  let plebsLabel = 'Content';
  if (plebs < 20) {
    fidesFromPlebs = -3;
    plebsCrisisBonus = 3;
    plebsLabel = 'Rioting';
  } else if (plebs < 40) {
    fidesFromPlebs = -1;
    plebsLabel = 'Restless';
  } else if (plebs < 70) {
    plebsLabel = 'Content';
  } else if (plebs < 85) {
    fidesFromPlebs = +1;
    plebsLabel = 'Supportive';
  } else {
    fidesFromPlebs = +2;
    plebsLabel = 'Euphoric';
  }

  // ── Treasury ───────────────────────────────────────────────────────────────
  let denariFromTreasury = 0;
  let crisisAbsorption = 0;
  let treasuryLabel = 'Adequate';
  if (treasury < 10) {
    denariFromTreasury = -3;
    treasuryLabel = 'Bankrupt';
  } else if (treasury < 25) {
    denariFromTreasury = -1;
    treasuryLabel = 'Depleted';
  } else if (treasury < 65) {
    treasuryLabel = 'Adequate';
  } else if (treasury < 85) {
    crisisAbsorption = 1;
    treasuryLabel = 'Flush';
  } else {
    crisisAbsorption = 2;
    treasuryLabel = 'Overflowing';
  }

  return {
    fidesDelta: fidesFromStability + fidesFromPlebs,
    denariDelta: denariFromTreasury,
    crisisEscalationMultiplier: crisisMultiplier,
    crisisAbsorption,
    plebsCrisisBonus,
    patronFavourWaived: plebs >= 85,
    stabilityLabel,
    plebsLabel,
    treasuryLabel,
  };
}

// ─── Resource income ──────────────────────────────────────────────────────────

/**
 * Returns per-season resource income.
 * plebsDelta: additional Plebs change from active unrest status effects.
 *   Wired into state in turnSequencer Chunk 2C. Declared here so the return
 *   type is stable; adding it now doesn't break existing destructuring callers.
 */
export function calcResourceIncome(state: GameState): {
  fidesIncome: number;
  denariiIncome: number;
  plebsDelta: number;
} {
  const paterfamilias = state.family.find((c) => c.isPlayer);

  // Step 1: Base skill income — paterfamilias rhetoric, plus a "household
  // voices" term (P2-C): the highest rhetoric among other family members age
  // ≥ bestOtherRhetoricMinAge. Makes training an heir's rhetoric economically
  // meaningful, not just paterfamilias's.
  const bestOtherRhetoric = state.family
    .filter(c => !c.isPlayer && c.age >= BALANCE.income.bestOtherRhetoricMinAge)
    .reduce((best, c) => Math.max(best, c.skills.rhetoric), 0);
  const baseIncome =
    (paterfamilias?.skills.rhetoric ?? 0) * BALANCE.income.paterfamiliasRhetoricMultiplier
    + bestOtherRhetoric * BALANCE.income.bestOtherRhetoricMultiplier;

  // Step 2: Patron tier multiplier
  const patronMultiplier =
    PATRON_TIER_DEFINITIONS[state.patronTier]?.passiveBonus.fidesMultiplier ?? 1.0;

  // Step 3: Office income
  const officeIncome = state.family
    .filter(c => c.isPlayer && c.officeId)
    .reduce((sum, c) => sum + (BALANCE.income.officeFidesBonus[c.officeId!] ?? 0), 0);

  // Step 4: Clan leader relationship income
  let clanFidesIncome = 0;
  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if (leader.relationship >= 60)      clanFidesIncome += 2;
      else if (leader.relationship >= 30) clanFidesIncome += 1;
      else if (leader.relationship < 0)   clanFidesIncome -= 1;
    }
  }

  // Step 5: Client bonuses
  const clientBonuses = computeTotalClientBonuses(state.clients);
  const clientFides = clientBonuses.fides ?? 0;

  // Step 6: Asset bonuses
  const assetBonuses = computeTotalAssetBonuses(state.ownedAssets);
  const assetFides = assetBonuses.fides ?? 0;

  // Step 6a: Family House bonuses (Library's recurring Fides, rented businesses'
  // Fides/gold — dignitas/season and faction relationship drift are NOT part of
  // this Fides/Denarii income calc; turnSequencer applies those directly).
  const houseBonuses = computeHouseBonuses(state.house);

  // Step 6b: Province asset Fides bonus (former Gratia/Dignitas asset bonuses, now Fides)
  const provinceFidesBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetFidesOutput(p), 0
  );

  // Step 6c: Munificence endowments (P2-F) — permanent Fides/season per built endowment
  const endowmentFides = (state.endowments?.length ?? 0) * BALANCE.munificence.publicEndowment.endowmentFidesPerSeason;

  // Step 7: Rome stat modifier
  const romeMods = calcRomeStatModifiers(state.rome);
  const romeStatFides = romeMods.fidesDelta;

  // Step 8: Four-track crisis status effects (replaces old single crisisLevel penalty)
  const statusEffects = getCrisisStatusEffects(state.crisis);
  let crisisFidesDelta = 0;
  let crisisDenariiDelta = 0;
  for (const effect of statusEffects) {
    crisisFidesDelta += effect.fidesDelta;
    crisisDenariiDelta += effect.denariDelta;
  }

  // Step 9: Unrest tier ≥ 2 causes passive Plebs decay (design doc section 2.3)
  // plebsDelta is applied by turnSequencer in Chunk 2C once it reads this field.
  const unrestTier = getTierFromLevel(state.crisis.unrest.level);
  const plebsDelta = unrestTier >= 2 ? -3 : 0;

  // Phase 3, Chunk P3-C — a regent governing in a minor heir's name is
  // less effective than the true paterfamilias would be. Applied to the
  // WHOLE total (not just baseIncome) — the plan's "×0.75 Fides" framing.
  const regencyMult = state.regency ? BALANCE.succession.regencyIncomeMult : 1;

  // Final Fides income
  const fidesIncome = Math.max(0, Math.round(
    (
      Math.round(baseIncome * patronMultiplier)
      + officeIncome
      + clanFidesIncome
      + clientFides
      + assetFides
      + houseBonuses.fides
      + provinceFidesBonus
      + endowmentFides
      + romeStatFides
      + crisisFidesDelta   // negative at higher crisis tiers
    ) * regencyMult
  ));

  // Denarii income — assets + house + province gold output + client gold + treasury mod + crisis penalty
  const provinceDenariiBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGoldOutput(p), 0
  );
  const denariiIncome =
    (assetBonuses.gold ?? 0)
    + houseBonuses.gold
    + provinceDenariiBonus
    + (clientBonuses.gold ?? 0)
    + romeMods.denariDelta
    + crisisDenariiDelta;  // negative at higher War/Economy tiers

  return { fidesIncome, denariiIncome, plebsDelta };
}

// ─── Training cost (P2-C) ─────────────────────────────────────────────────────
// Shared by gameStore.trainCharacter (validation + apply) and
// CharacterActionModal (cost/disabled-reason display) so the two never drift.

/** Fides cost to train a skill from currentLevel to currentLevel + 1. */
export function calcTrainingCost(currentLevel: number): number {
  return BALANCE.training.fidesCostPerTargetLevel * (currentLevel + 1);
}

// ─── Effect string ────────────────────────────────────────────────────────────

export function applyEffectString(
  effectStr: string,
  state: GameState,
  options?: ApplyEffectOptions
): Partial<GameState> & { _addClient?: Client; _removeClient?: string } {
  const { previewClientName, instance } = options ?? {};
  const segments = effectStr.split('|').map(s => s.trim()).filter(Boolean);
  const patch: Partial<GameState> & { _addClient?: Client; _removeClient?: string } = {};

  for (const segment of segments) {

    // ── Crisis track tokens: crisis-[trackId]±N ────────────────────────────
    // Must be checked before the generic parseEffect path, because the hyphen
    // in e.g. 'crisis-war-5' would confuse parseEffect's sign-split logic.
    const crisisTrackMatch = segment.match(
      /^crisis-(war|unrest|constitution|economy)([+-]\d+)$/
    );
    if (crisisTrackMatch) {
      const trackId = crisisTrackMatch[1] as CrisisTrackId;
      const delta = parseInt(crisisTrackMatch[2], 10);
      const currentCrisis = patch.crisis ?? state.crisis;
      const updatedTrack = applyTrackDelta(currentCrisis[trackId], delta);
      patch.crisis = { ...currentCrisis, [trackId]: updatedTrack };
      continue;
    }

    // ── Phase 3, P3-D — bare (no-colon, no-param) tokens ────────────────────
    // continueAsCadet/cadetVisited take no parameter, so they never match
    // the colon-gated block below (segment.includes(':') is false for
    // them) — matched here as whole-segment literals instead. See
    // cadetEvents.ts's evt-cadet-succession/evt-cadet-visit choices.
    if (segment === 'continueAsCadet') {
      const cadet = (patch as any).cadetBranch ?? state.cadetBranch;
      if (cadet) {
        Object.assign(patch, promoteCadetToParterfamilias(cadet, { ...state, ...patch } as GameState));
      }
      continue;
    }
    if (segment === 'cadetVisited') {
      const cadet = (patch as any).cadetBranch ?? state.cadetBranch;
      if (cadet) {
        const metCount = cadet.metCount + 1;
        patch.cadetBranch = { ...cadet, metCount };
        if (metCount >= BALANCE.cadet.maxVisits) {
          patch.flags = { ...(patch.flags ?? state.flags), 'cadet-visits-exhausted': true };
        }
      }
      continue;
    }

    // ── Colon-delimited special tokens ────────────────────────────────────
    if (segment.includes(':')) {
      const parts = segment.split(':');
      const key = parts[0];

      if (key === 'setFlag') {
        // setFlag:flagKey:value  — value can be true, false, or a number
        const flagKey = parts[1];
        const rawVal  = parts[2];
        const val: boolean | number =
          rawVal === 'true'  ? true  :
          rawVal === 'false' ? false :
          Number(rawVal);
        patch.flags = { ...(patch.flags ?? state.flags), [flagKey]: val };
        continue;
      }

      // ── tableRefuseMamertineBill ─────────────────────────────────────────
      // Fired by warEvents.ts's evt-messana-appeal 'refuse' choice. Tables a
      // low-support Senate motion against answering Messana's plea — hard,
      // not impossible, to pass (support: -20 is a first-pass/unverified
      // balance call, same convention as every other bill's numbers). If it
      // passes, Rome stays out of the war; if it fails or expires (the
      // likelier outcome), the Senate overrules the player and answers the
      // call anyway (see its own failEffect). Dedup follows
      // buildWarTriumphBill's id-prefix pattern (checks both queued and
      // already-resolved bills) since this can only ever fire once per
      // playthrough anyway (messanaResolved is set the same moment, gating
      // out any repeat firing of the event itself).
      if (key === 'tableRefuseMamertineBill') {
        const bills = patch.bills ?? state.bills;
        const alreadyQueued = bills.some(b => b.id.startsWith('refuse-mamertines'))
          || (state.passedBills ?? []).some(b => b.id.startsWith('refuse-mamertines'));
        if (!alreadyQueued) {
          const refuseBill: Bill = {
            id: `refuse-mamertines-${state.year}`,
            name: 'Do Not Answer the Mamertine Call',
            desc: 'A motion urging the Senate to leave Messana to its fate rather than risk war with Carthage over a strait none of Rome\'s neighbours will fight for.',
            type: 'military',
            support: -20,
            turnsLeft: 3,
            passEffect: 'fides+5',
            failEffect: 'setFlag:messanaJoinsRome:true|startWar:carthage:major:0|fides-5',
            playerSubmitted: true,
            repealable: false,
          };
          patch.bills = [...bills, refuseBill];
        }
        continue;
      }

      // ── incorporateProvince:<id> ─────────────────────────────────────────
      // Fired by a passed incorporation bill (see provinceEngine.
      // buildIncorporationBill). Flips status: 'unincorporated' →
      // 'incorporated' and clears incorporationBillAvailable so the bill
      // can't be re-tabled. Also recalls any player Ambassador posted there
      // — the Ambassador system stops applying once incorporated (see
      // ProvinceStatus's own type comments in models/province.ts); a
      // Governor is later assigned by lot through the existing,
      // unrelated governor-assignment system.
      if (key === 'incorporateProvince') {
        const provinceId = parts[1];
        const provinces = patch.provinces ?? state.provinces;
        patch.provinces = provinces.map(p =>
          p.id === provinceId
            ? { ...p, status: 'incorporated' as const, incorporationBillAvailable: false, playerAmbassador: null }
            : p
        );
        continue;
      }

      // ── assignAmbassador:<provinceId>:<characterId> ──────────────────────
      // Fired by a passed ambassador-posting bill (see provinceEngine.
      // buildAmbassadorPostingBill). Posts the named character as Ambassador
      // on the matching province — works on both unincorporated Roman
      // provinces and, per the foreign-relations plan's chunk WD-D, foreign
      // ones too (a deliberate reversal of the Mediterranean plan's "no
      // Ambassador system for foreign provinces" invariant, for Ambassadors
      // only). turnsServed starts at 0; provinceEngine.tickPlayerAmbassador
      // (called from both of tickProvince's relevant branches) increments it
      // each season and ends the posting at the 2-year (8-season) term limit.
      if (key === 'assignAmbassador') {
        const provinceId = parts[1];
        const characterId = parts[2];
        const provinces = patch.provinces ?? state.provinces;
        patch.provinces = provinces.map(p =>
          p.id === provinceId
            ? {
                ...p,
                playerAmbassador: {
                  characterId,
                  personalRapport: 0,
                  turnsServed: 0,
                  actionsUsedThisTurn: [],
                  intelRevealed: 0,
                },
              }
            : p
        );
        continue;
      }

      if (key === 'clearFlag') {
        // clearFlag:flagKey
        const flagKey = parts[1];
        const newFlags = { ...(patch.flags ?? state.flags) };
        delete newFlags[flagKey];
        patch.flags = newFlags;
        continue;
      }

      if (key === 'addClient') {
        if (parts.length >= 4) {
          const [, type, flavourTitle, name] = parts as [string, ClientType, string, string];
          patch._addClient = buildClient(`client-${Date.now()}`, name, type, flavourTitle, 'Joined your household after the events of this season.', state.turnNumber);
        } else {
          const clientType = parts[1] as ClientType;
          const name = previewClientName ?? generateClientName(clientType, state.clients);
          patch._addClient = buildClient(`client-${Date.now()}`, name, clientType, 'Client', 'Met through circumstance.', state.turnNumber);
        }
        continue;
      }

      if (key === 'removeClient') {
        const clientType = parts[1] as ClientType;
        const target = instance?.clientName
          ? state.clients.find(c => c.name === instance.clientName && c.type === clientType)
          : state.clients.filter(c => c.type === clientType).sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
        if (target) patch._removeClient = target.id;
        continue;
      }

      if (key === 'blackmail') {
        const leaderId = parts[1];
        patch.clans = (state.clans ?? []).map(clan => ({
          ...clan,
          leaders: clan.leaders.map(leader =>
            leader.id === leaderId ? { ...leader, blackmail: true } : leader
          ),
        }));
        continue;
      }

      if (key === 'npcDignitas') {
        console.log(`[npcDignitas] ${parts[1]} gains ${parts[2]} Dignitas (no-op)`);
        continue;
      }

      // ── P1-G: leaderRel:[leaderId]:[delta] ─────────────────────────────────
      // Updates relationship on the ClanLeader with the matching id across all clans.
      // Clamped to [−100, 100]. Only new effect token added in Phase 1 (plan §P1-G changelog).
      if (key === 'leaderRel') {
        const leaderId = parts[1];
        const delta    = parseInt(parts[2] ?? '0', 10);
        if (leaderId && !isNaN(delta)) {
          patch.clans = (patch.clans ?? state.clans).map((clan: any) => ({
            ...clan,
            leaders: clan.leaders.map((leader: any) =>
              leader.id === leaderId
                ? { ...leader, relationship: Math.min(100, Math.max(-100, (leader.relationship ?? 0) + delta)) }
                : leader
            ),
          })) as any;
        }
        continue;
      }

      // Phase 4, P4-G — grantGroundwork:leaderId:amount. Sets
      // ClanLeader.intelGroundwork to at least `amount` (never lowers an
      // existing higher value — a head start, not a reset) — used by
      // evt-tut-04's rewired investigate choice to grant a strong start
      // toward the counter-Secret on Ap. Claudius Pulcher. Generic by
      // leaderId, not Claudius-specific, so any future event can reuse it.
      if (key === 'grantGroundwork') {
        const leaderId = parts[1];
        const amount = parseFloat(parts[2] ?? '0');
        patch.clans = (patch.clans ?? state.clans).map((clan: any) => ({
          ...clan,
          leaders: clan.leaders.map((leader: any) =>
            leader.id === leaderId
              ? { ...leader, intelGroundwork: Math.max(leader.intelGroundwork ?? 0, amount) }
              : leader
          ),
        })) as any;
        continue;
      }

      // Phase 3, P3-B — startWar:enemyId:scale:openingWarScoreDelta
      // Scripted ignition events (evt-messana-appeal, warEvents.ts) trigger
      // war state through this token rather than a direct store-action call — keeps
      // event content routed through the same generic effect-string
      // vocabulary every other event uses, matching this file's existing
      // colon-token pattern (setFlag/addClient/blackmail/leaderRel above).
      // Mirrors gameStore.startWar's WarState construction — deliberately
      // NOT imported from there (this file has no store access, and
      // gameStore.ts already imports FROM warEngine.ts, which itself
      // imports FROM this file; importing gameStore.ts here would be
      // circular). Kept in sync by hand — small, stable shape, same
      // tradeoff warEngine.ts's buildWarTriumphBill already accepts for an
      // identical reason (see that function's header comment).
      if (key === 'startWar') {
        const enemyId = parts[1];
        const scale = (parts[2] ?? 'major') as WarScale;
        const openingDelta = parseInt(parts[3] ?? '0', 10);
        const wars = patch.wars ?? state.wars ?? [];
        const alreadyActive = wars.some((w: WarState) => w.active && w.enemyId === enemyId && w.scale === scale);
        if (!alreadyActive) {
          const newWar: WarState = {
            id: `war-${enemyId}-${state.turnNumber}`,
            active: true,
            enemyId,
            scale,
            provinceId: null,
            warScore: Math.min(100, Math.max(-100, openingDelta)),
            startedTurn: state.turnNumber,
            lastSetPieceTurn: state.turnNumber - BALANCE.war.setPieceOffer.minSpacingTurns,
            weariness: 0,
            pendingSetPiece: null,
            treaty: null,
            // Ignition always fires within the first few years (see
            // evt-messana-appeal's force-injection guard in turnSequencer.ts)
            // — always 'opening' under
            // phaseForYear's own logic for so little elapsed time, so this
            // avoids importing warEngine.ts here just to recompute it.
            phase: 'opening',
            ignitedYear: state.year,
            endedYear: null,
            terminalOutcome: null,
            peaceOffered: false,
            lastFundingOfferTurn: state.turnNumber - BALANCE.war.funding.recurTurns,
          };
          patch.wars = [...wars, newWar];
        }
        continue;
      }

      // Phase 3, P3-B — warScoreDelta:enemyId:±N. Periodic war events
      // (warEvents.ts) move a specific active war's score through this
      // token, same reasoning as startWar: above — warScore lives inside a
      // WarState, not a top-level GameState key, so the generic
      // key±N parser can't reach it.
      if (key === 'warScoreDelta') {
        const enemyId = parts[1];
        const delta = parseInt(parts[2] ?? '0', 10);
        const wars = patch.wars ?? state.wars ?? [];
        patch.wars = wars.map((w: WarState) =>
          w.active && w.enemyId === enemyId
            ? { ...w, warScore: Math.min(100, Math.max(-100, w.warScore + delta)) }
            : w
        );
        continue;
      }

      // Phase 3, P3-C — nextEvent:defId. Queues a follow-up event instance
      // onto pendingEvents. Exists because this codebase's built-in
      // EventChoice.nextEventId branching (resolveEventChoice in
      // eventEngine.ts) discards effectStr entirely whenever any
      // nextEventId variant is set — there is no way to BOTH apply an
      // effect (denarii/dignitas/etc.) AND advance to a new scene through
      // the built-in mechanism (verified before writing this). This token
      // sidesteps that: successionEvents.ts's funeral choices apply their
      // effects normally and chain via this token instead. Consumed by
      // gameStore.resolveEvent's merge (see that file — pendingEvents from
      // a resolved choice's patch must be merged with, not clobbered by,
      // the pre-existing queue; that fix shipped alongside this token).
      if (key === 'nextEvent') {
        const defId = parts[1];
        const queued: EventInstance = {
          defId,
          firedAtTurn: state.turnNumber,
          targetCharacterId: instance?.targetCharacterId ?? 'pc-1',
        };
        patch.pendingEvents = [...(patch.pendingEvents ?? state.pendingEvents), queued];
        continue;
      }

      // Phase 3, P3-C — succeedPaterfamilias:default|alt. Applies
      // inheritanceEngine.applySuccession using state.pendingSuccession's
      // eligibleHeirIds (index 0 = default heir, index 1 = the "name a
      // different heir" alternative). Gracefully falls back to the default
      // heir if no alternative exists (this codebase's EventChoice has no
      // per-choice conditional visibility, so "name a different heir" is
      // always shown — see successionEvents.ts's header comment) — never
      // soft-locks. A no-op (pendingSuccession stays set) only in the true
      // extinction case (no eligible heir at all), which this chunk
      // deliberately does not resolve — that is P3-D's cadet-branch scope;
      // see this file's header comment / detectPaterfamiliasDeath's caller
      // in turnSequencer.ts for the distinct no-heir notice shown instead.
      if (key === 'succeedPaterfamilias') {
        const which = parts[1];
        const pending = state.pendingSuccession;
        const heirId = which === 'alt'
          ? (pending?.eligibleHeirIds[1] ?? pending?.eligibleHeirIds[0])
          : pending?.eligibleHeirIds[0];
        if (pending && heirId) {
          const succPatch = applySuccession({ ...state, ...patch } as GameState, heirId, which === 'alt' && heirId === pending.eligibleHeirIds[1]);
          Object.assign(patch, succPatch);
        }
        continue;
      }

      // Phase 3, P3-D — setPendingEpilogue:value. A tiny, generic token
      // (rather than folding into continueAsCadet's sibling choice) since
      // "let the Gens end" needs to write pendingEpilogue directly —
      // there's no numeric key±N form for a string-enum top-level field.
      if (key === 'setPendingEpilogue') {
        patch.pendingEpilogue = parts[1] as GameState['pendingEpilogue'];
        continue;
      }

      // ── createLatentSecret:<type>:<potency> ─────────────────────────────
      // The general mechanism behind player-choice blackmail (data/
      // compromisingEvents.ts): any event choice can offer a real reward at
      // the risk of a compromising fact the player knowingly took on. Plants
      // a LatentSecret on the player character — nobody holds it yet; each
      // season secretEngine.latentSecretDiscoveryTick (turnSequencer step
      // 9b) rolls a chance for a hostile leader to notice it and turn it
      // into a real, demandable Secret via the existing pipeline.
      if (key === 'createLatentSecret') {
        const type = parts[1] as SecretType;
        const potency = (parseInt(parts[2] ?? '1', 10) || 1) as 1 | 2 | 3;
        const player = (patch.family ?? state.family).find(c => c.isPlayer);
        if (player) {
          const latent = generateLatentSecret(player.id, player.name, type, potency, state.turnNumber);
          patch.latentSecrets = [...(patch.latentSecrets ?? state.latentSecrets ?? []), latent];
        }
        continue;
      }

      // ── bribeVotes:<n> ───────────────────────────────────────────────────
      // Sets the n clan leaders with the highest votes (among those not
      // already pledged 'for') to campaignVotes 'for' — the same lever
      // secretEngine.resolveSecretDemand's leverage_election comply branch
      // already uses for a single named leader, generalized to N for a
      // flat "buy the tribes" event reward. Only meaningful mid-campaign;
      // the originating event is expected to gate on the 'campaigning'
      // condition, but this token is itself a no-op (sets nothing) if
      // called outside one, since campaignVotes is otherwise unused.
      if (key === 'bribeVotes') {
        const n = parseInt(parts[1] ?? '0', 10) || 0;
        const currentVotes = patch.campaignVotes ?? state.campaignVotes;
        const targets = state.clans
          .flatMap(c => c.leaders)
          .filter(l => currentVotes[l.id] !== 'for')
          .sort((a, b) => b.votes - a.votes)
          .slice(0, n);
        if (targets.length > 0) {
          const bribed = { ...currentVotes };
          for (const l of targets) bribed[l.id] = 'for';
          patch.campaignVotes = bribed;
        }
        continue;
      }

      continue;
    }

    // ── Phase 3, P3-D — cadetStanding±N ─────────────────────────────────────
    // key±N form (like the skill grants below), not a colon token — matches
    // cadetEvents.ts's evt-cadet-visit content (`cadetStanding+5`).
    const cadetStandingMatch = segment.match(/^cadetStanding([+-]\d+)$/);
    if (cadetStandingMatch) {
      const delta = parseInt(cadetStandingMatch[1], 10);
      const cadet = (patch as any).cadetBranch ?? state.cadetBranch;
      if (cadet) {
        patch.cadetBranch = { ...cadet, standing: Math.max(0, Math.min(100, cadet.standing + delta)) };
      }
      continue;
    }

    // ── Skill grants ──────────────────────────────────────────────────────
    const skillGrantMatch = segment.match(/^(rhetoric|martial|intrigus|martialBonus)([+-]\d+)$/);
    if (skillGrantMatch) {
      const [, skillKey, deltaStr] = skillGrantMatch;
      const delta = parseInt(deltaStr, 10);
      const resolvedKey = skillKey === 'martialBonus' ? 'martial' : skillKey;
      const updatedFamily = (patch.family ?? state.family).map(char => {
        if (skillKey === 'rhetoric') {
          const nonPlayers = (patch.family ?? state.family).filter(c => !c.isPlayer);
          const youngest = nonPlayers.sort((a, b) => a.age - b.age)[0];
          const targetId = youngest?.id ?? state.family.find(c => c.isPlayer)?.id;
          if (char.id !== targetId) return char;
        } else {
          if (!char.isPlayer) return char;
        }
        return {
          ...char,
          skills: {
            ...char.skills,
            [resolvedKey]: Math.max(0, (char.skills[resolvedKey as keyof typeof char.skills] ?? 0) + delta),
          },
        };
      });
      patch.family = updatedFamily;
      continue;
    }

    // ── Standard key±N tokens via parseEffect ─────────────────────────────
    const effects = parseEffect(segment);
    for (const { key, delta } of effects) {
      switch (key) {
        case 'fides':
          patch.fides = Math.max(0, (patch.fides ?? state.fides) + delta);
          break;
        case 'lifetimeDignitas':
          patch.lifetimeDignitas = Math.max(0, (patch.lifetimeDignitas ?? state.lifetimeDignitas) + delta);
          break;
        case 'denarii':
        case 'gold':
          patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) + delta);
          break;
        case 'crisis':
        case 'crisisLevel':
          // Legacy token — updates the backwards-compat scalar field.
          // Migrate callers to 'crisis-[trackId]±N' format in Chunk 2C.
          patch.crisisLevel = Math.min(100, Math.max(0, (patch.crisisLevel ?? state.crisisLevel) + delta));
          break;
        case 'corruption':
          patch.family = (patch.family ?? state.family).map(c =>
            c.isPlayer
              ? { ...c, corruptionScore: Math.min(100, Math.max(0, (c.corruptionScore ?? 0) + delta)) }
              : c
          );
          break;
        case 'popularesRel':
          patch.popularesRel = Math.min(100, Math.max(-100, (patch.popularesRel ?? state.popularesRel) + delta));
          break;
        case 'optimatesRel':
          patch.optimatesRel = Math.min(100, Math.max(-100, (patch.optimatesRel ?? state.optimatesRel) + delta));
          break;
        case 'stability':
          patch.rome = { ...state.rome, ...patch.rome, stability: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).stability) + delta)) };
          break;
        case 'plebs':
          patch.rome = { ...state.rome, ...patch.rome, plebs: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).plebs) + delta)) };
          break;
        case 'treasury':
          patch.rome = { ...state.rome, ...patch.rome, treasury: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).treasury) + delta)) };
          break;
        case 'imperium':
          patch.family = (patch.family ?? state.family).map(c =>
            c.isPlayer
              ? { ...c, imperium: Math.max(0, ((c as any).imperium ?? 0) + delta) }
              : c
          );
          break;
      }
    }
  }
  return patch;
}

// ─── Faction drift ────────────────────────────────────────────────────────────

export function applyFactionDrift(state: GameState): { popularesRel: number; optimatesRel: number } {
  return {
    popularesRel: Math.min(100, Math.max(-100, state.popularesRel - 1)),
    optimatesRel: Math.min(100, Math.max(-100, state.optimatesRel - 1)),
  };
}

// ─── Rome stats ───────────────────────────────────────────────────────────────

export function calcRomeStats(
  state: GameState,
  passedBillCount: number
): Partial<GameState['rome']> {
  const { stability, plebs, treasury } = state.rome;
  const stabilityDelta = passedBillCount > 0 ? 3 : -5;
  const plebsDelta = passedBillCount > 0 ? 2 : -3;
  const crisisDrain = Math.floor(state.crisisLevel / 15) - passedBillCount * 3;
  return {
    stability: Math.min(100, Math.max(0, stability + stabilityDelta - Math.floor(state.crisisLevel / 20))),
    plebs:     Math.min(100, Math.max(0, plebs + plebsDelta)),
    treasury:  Math.min(100, Math.max(0, treasury - crisisDrain)),
  };
}

// ─── Relationship drift ───────────────────────────────────────────────────────
// P2-D: relocated to reputationEngine.applyYearlyRelationshipDecay (anchor-based,
// yearly only — replaces the old per-season decay-toward-zero here).
