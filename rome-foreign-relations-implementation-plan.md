# Rome: Res Publica — Foreign Relations & War Declaration Implementation Plan

## 0. Why this plan exists

Chunk MP-E of `rome-mediterranean-provinces-implementation-plan.md` (the Messana/Mamertine event) surfaced a real problem: `military-overhaul` already had a force-injected, unconditional war-ignition event (`evt-war-mamertines`) where every choice started a Carthage war. The Mediterranean plan wanted a genuine "Refuse" option — but 9 of the 10 Mediterranean provinces are only reachable via a treaty ending a Carthage war (`rome-mediterranean-provinces-implementation-plan.md` §8), so a refusal that *permanently* prevented war would softlock most of that content.

Resolution (decided in session): `evt-messana-appeal` replaces `evt-war-mamertines`; "Refuse" tables a hard-to-pass Senate bill rather than resolving instantly, and — the subject of this plan — a **general foreign-relations-driven war mechanic** means peace with Carthage (or any foreign power) was never permanent in the first place. That mechanic, plus two other gaps it exposed along the way, is what this plan builds.

**Ground rules** (same as the Mediterranean plan): read each file before editing — line numbers drift. Run `npx tsc --noEmit` and the relevant test file(s) after each chunk. Numbers below are first-pass/unverified, same convention as every other chunk in this codebase — tune later.

---

## 1. Chunk order & dependencies

| Chunk | What | Depends on |
|---|---|---|
| **WD-A** | Engine — foreign provinces get a minimal per-season relationship drift (currently a full no-op) | — |
| **WD-B** | Engine — AI war declaration: once a foreign power is hostile, a per-season chance it declares war on Rome | WD-A |
| **WD-C** | Content/UI — player-initiated "Declare War" bill against a hostile foreign power | WD-A |
| **WD-D** | Engine/UI — Ambassador posting system, fixed end-to-end (bill-based appointment, real term limits, works on both Roman unincorporated *and* foreign provinces) | — |
| **WD-E** | Tests | WD-A, WD-B, WD-C, WD-D |

---

## 2. Design decisions (resolved this session — do not re-litigate)

1. **Generic, not Carthage-only.** The mechanic applies to any `status: 'foreign'` province's owner, not just Carthage — even though today Carthage is the only power with real war-arc content (periodic events, terminal notices). Declaring/receiving war against an independent city-state (Syracuse, Agrigentum, Messana) is mechanically valid but narratively bare for now.
2. **War target resolution:** `enemyId` for a Carthage-owned province is `'carthage'`; for an independent province it's the province's own id (e.g. `'syracuse'`). **Clients are excluded** (`def.clientOf` set — i.e. Numidia) — matches the existing cession exclusion in the Mediterranean plan's design invariant #5. Fighting a client means fighting its patron, not the client itself; no mechanic for that exists and none is being added here.
3. **Relationship drift is a small, mean-zero random walk** (not a directional decay toward war, not event-only/frozen). Foreign provinces still do **not** get the Governor/Ambassador system or any income — this plan does not touch that invariant. Drift is the *only* new thing foreign provinces' per-season tick does.
4. **AI declaration is probabilistic**, not a deterministic threshold — mirrors `calcRevoltChance`'s existing precedent (chance-based risk, not telegraphed certainty).
5. **The player-initiated bill is gated on hostile relations** (not proposable anytime) — mirrors the incorporation bill's "earn the option via relations" pattern from the Mediterranean plan.
6. **Foreign provinces get diplomatic postings after all** — reverses the Mediterranean plan's original invariant #2 ("no Governor/Ambassador system for foreign provinces") *specifically for Ambassadors*. Governors still never apply to foreign territory. This was opened up because fixing "declare war" naturally raised "can I also make peace better," and Ambassador actions (`resolveAmbassadorAction`) already have relationship-moving effects sitting unused.
7. **Ambassador posting is bill-gated, not instant** — same shape as the incorporation bill and the new declare-war bill: a request builds a bill, the bill sits in the Senate queue, the player can `voteBill`/`speechBill` it like any other bill (this already works generically — no new "canvassing bridge" needed), and passage assigns the posting.
8. **Fixing the pre-existing "Seek Ambassador Posting" no-op is in scope**, for both Roman unincorporated and foreign provinces, via the same bill mechanism — this was found to be completely unwired (not just for foreign provinces) and directly blocks WD-D regardless.
9. **Ambassador term is 2 years (8 seasons)**, warn at 7, end at 8 — mirrors `GovernorState`'s existing 1-year (4-season) warn-at-3/end-at-4 pattern, scaled up. `AmbassadorState.turnsServed` is currently tracked but never incremented or read anywhere (confirmed by research) — this plan adds that wiring for the first time.
10. **Character selection defaults to the currently-selected/player character** (`selectedCharacterId ?? family.find(isPlayer)`, matching `ProvinciaeScreen.tsx`'s existing `activeCharacter` pattern) — no new character-picker UI.

---

## 3. Chunk WD-A — Engine: foreign relationship drift

**File:** `src/engine/provinceEngine.ts`

**Goal:** foreign provinces' `relationshipScore` can move over time instead of being frozen at its `startingRelationship` value forever.

**Spec:** in `tickProvince`'s existing foreign short-circuit —

```ts
if (p.status === 'foreign') {
  const drift = Math.round((Math.random() - 0.5) * 4); // −2..+2, first-pass/tunable
  const updated = { ...p, relationshipScore: Math.max(0, Math.min(100, p.relationshipScore + drift)) };
  return { updatedProvince: updated, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, treasuryDelta: 0, events: [] };
}
```

No Governor/Ambassador ticking, no income — those stay inert per the existing invariant. This is *only* a relationship walk.

**Done when:** `npx tsc --noEmit` clean; a foreign province's `relationshipScore` changes turn over turn in a manual playthrough/debug check.

---

## 4. Chunk WD-B — Engine: AI war declaration

**File:** `src/engine/provinceEngine.ts` (new function), wired from `src/engine/turnSequencer.ts`

**Goal:** once a foreign power's relationship reaches `'hostile'` tier, a per-season chance it declares war on Rome unprompted.

**Why not inside `tickProvince`:** that function is pure per-province and has no visibility into `state.wars` (needed to avoid double-declaring) or the ability to construct a `WarState`. This needs its own function, called once per season — same shape as `applyProvinceFlips`.

**Spec:**

```ts
/**
 * Per-season chance a hostile foreign power declares war on Rome unprompted.
 * Mirrors calcRevoltChance's existing probabilistic-risk precedent. Excludes
 * clients (def.clientOf set) — fighting a client means fighting its patron,
 * which this doesn't model. Idempotent: skips any power that already has an
 * active war against Rome.
 */
export function checkForeignWarDeclarations(
  provinces: ProvinceState[],
  wars: WarState[],
): { newWars: WarState[]; events: string[] } { ... }
```

- Iterate `status: 'foreign'` provinces, skip clients, skip if `wars.some(w => w.active && w.enemyId === targetEnemyId(def))`.
- Enemy-target resolution: same helper as WD-C (`def.owner === 'carthage' ? 'carthage' : def.id`) — de-duplicate multiple Carthage-owned provinces so only one roll happens per power per season, not once per province.
- If hostile tier and chance hits (first-pass ~8%/season, tunable): build a `WarState` (mirrors `resourceEngine.ts`'s `startWar` token construction) with a small negative opening `warScore`, push a notice event ("Carthage has declared war on Rome...").
- Called from `tickAllProvinces` (or directly in `turnSequencer.ts`'s province-tick step) — thread `newWars`/`events` through the same way `applyProvinceFlips`' output already is.

**Done when:** `npx tsc --noEmit` clean; a debug-forced hostile foreign province can be observed to occasionally auto-declare war over repeated season advances.

---

## 5. Chunk WD-C — Content/UI: player-initiated Declare War bill

**Files:** `src/engine/provinceEngine.ts` (builder), `src/state/gameStore.ts` (action), `src/components/provinciae/ProvinceSheet.tsx` (`ForeignTerritoryView` button)

**Goal:** the player can proactively table a war declaration against a hostile foreign power.

**Eligibility** (computed live, no new stored flag — unlike `incorporationBillAvailable`, this doesn't need a "just became available" notice moment):
`province.status === 'foreign' && !def.clientOf && getRelationshipTier(province.relationshipScore) === 'hostile'` and no active war already against that target.

**Spec:**

```ts
export function buildDeclareWarBill(province: ProvinceState, def: ProvinceDefinition): Omit<Bill, 'id'> {
  const enemyId = def.owner === 'carthage' ? 'carthage' : def.id;
  return {
    name: `Declare War on ${def.name}`,
    desc: `...`,
    type: 'military',
    support: -5,       // first-pass/tunable
    turnsLeft: 3,
    passEffect: `startWar:${enemyId}:major:5`,
    failEffect: 'fides-5',
    playerSubmitted: true,
    repealable: false,
  };
}
```

Reuses the existing `startWar` token verbatim — no new colon-token needed for this chunk.

**gameStore.ts:** `proposeDeclareWarBill(provinceId)` — mirrors `proposeIncorporationBill` exactly (dedup by bill name against `s.bills`, delegate to `submitBill`).

**UI:** add a "Declare War" button to `ForeignTerritoryView` (the foreign-province Overview equivalent), same disabled/pending styling convention as the incorporation banner.

**Done when:** `npx tsc --noEmit` clean; a debug-forced hostile Carthage-owned province can have a war bill tabled and, on passage, a real `'carthage'` `WarState` appears in `state.wars`.

---

## 6. Chunk WD-D — Ambassador posting, fixed end-to-end

**Files:** `src/engine/provinceEngine.ts`, `src/engine/resourceEngine.ts`, `src/state/gameStore.ts`, `src/components/provinciae/ProvinceSheet.tsx`, `src/components/provinciae/DiplomatDesk.tsx`, `src/screens/ProvinciaeScreen.tsx`

**Goal:** "Seek Ambassador Posting" actually does something, on both Roman unincorporated and foreign provinces, with a real enforced term.

**6a. Bill + assignment token**

```ts
// provinceEngine.ts
export function buildAmbassadorPostingBill(
  province: ProvinceState, def: ProvinceDefinition, characterId: string, characterName: string,
): Omit<Bill, 'id'> {
  return {
    name: `Ambassador Posting: ${characterName} to ${def.name}`,
    desc: `...`,
    type: 'constitutional',
    support: 10,        // first-pass/tunable
    turnsLeft: 3,
    passEffect: `assignAmbassador:${province.id}:${characterId}`,
    failEffect: 'fides-3',
    playerSubmitted: true,
    repealable: false,
  };
}
```

```ts
// resourceEngine.ts — applyEffectString, new colon-token, mirrors incorporateProvince's shape
if (key === 'assignAmbassador') {
  const provinceId = parts[1];
  const characterId = parts[2];
  const provinces = patch.provinces ?? state.provinces;
  patch.provinces = provinces.map(p =>
    p.id === provinceId
      ? { ...p, playerAmbassador: { characterId, personalRapport: 0, turnsServed: 0, actionsUsedThisTurn: [], intelRevealed: 0 } }
      : p
  );
  continue;
}
```

**6b. Term-limit tick (the actual missing piece)** — `tickProvince` currently only branches on `p.playerGovernor` or `p.npcRoleHolder`; there is no `p.playerAmbassador` branch at all, so `turnsServed` never increments. Add one, mirroring the Governor branch (lines ~172–227) at 2x the season count:

- Each season with a `playerAmbassador`: `turnsServed += 1`.
- At `turnsServed >= 7`: push a "reappointment needed soon" event (mirrors Governor's `>= 3` warning).
- At `turnsServed >= 8`: clear `playerAmbassador` to `null`, revert to `npcRoleHolder`, push a term-ended event (mirrors Governor's `>= 4` handling). No forced cooldown before a new posting bill can be proposed — matches the Governor precedent.

**6c. Store action**

`gameStore.seekAmbassadorPosting(provinceId)` — mirrors `proposeIncorporationBill`: resolve the acting character via `selectedCharacterId ?? family.find(isPlayer)`, dedup by bill name, build via `buildAmbassadorPostingBill`, delegate to `submitBill`.

**6d. UI wiring**

- `ProvinciaeScreen.tsx`: replace `onSeekPosting={() => {}}` with the real action.
- `ProvinceSheet.tsx`'s existing "Seek Ambassador Posting" button (Roman unincorporated provinces) now actually works once the action is wired — no new button needed there.
- `ForeignTerritoryView`: add the equivalent "Request Ambassador Posting" button (new — foreign provinces had no posting UI at all before).
- `DiplomatDesk.tsx:190`: fix the "Season X of 4" display — it currently always reads "Season 1" since `turnsServed` never moved. Update to reflect the real 8-season/2-year term.

**Done when:** `npx tsc --noEmit` clean; a posting bill can be tabled and, on passage, `playerAmbassador` is set; `DiplomatDesk` shows real season progress; after 8 seasons the posting ends and reverts to `npcRoleHolder`.

---

## 7. Chunk WD-E — Tests

- `provinceEngine.test.ts`: drift stays within bounds and clamps at 0/100; `checkForeignWarDeclarations` never fires against a client, never double-declares against an already-active war, only fires at hostile tier.
- `warEngine.test.ts` or new file: `buildDeclareWarBill`/`buildAmbassadorPostingBill` shape sanity; `assignAmbassador`/`startWar`-via-declare-war token resolution through `applyEffectString`.
- `tickProvince` Ambassador term-limit: increments, warns at 7, ends and reverts at 8.

**Done when:** `npx jest` green (modulo the pre-existing, already-documented `sicily_west`/dynamic-import failures unrelated to this work).

---

## 8. Non-goals (explicitly out of scope)

- No new UI for choosing *which* family member seeks a posting (defaults to selected/player character).
- No new "canvassing bridge" — `voteBill`/`speechBill` already work generically on any bill, including these new ones.
- No change to the Governor system for foreign provinces — still fully excluded, this plan only reverses the invariant for Ambassadors.
- No content (events, flavour) for non-Carthage foreign wars — mechanically generic, narratively bare, same as today's Carthage-only war-arc content.
