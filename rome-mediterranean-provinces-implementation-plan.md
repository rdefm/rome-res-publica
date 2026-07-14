# Rome: Res Publica — Mediterranean Provinces Implementation Plan

## 0. How to use this document / why this plan exists

**Background.** This repo had two branches that diverged from a common ancestor and were developed independently for a while: `main` (on GitHub) and `military-overhaul` (also on GitHub, containing the M1–M11 military overhaul chunks plus Phase 3's P3-A/P3-B war-arc work). `main` independently added a real Mediterranean/Punic-War province system — ten named foreign provinces (Messana, Syracuse, Agrigentum, Lilybaeum, Alalia, Olbia, Sulci, Carthage, Numidia, Tripolitania), a `foreign`/`owner` model, a conquest-flip mechanic, and the Mamertine-appeal scripted event. Independently, `military-overhaul`'s M10 chunk (peace negotiation) needed *some* notion of a cedable Sicily and invented its own two-region placeholder (`SICILY_PROVINCES`: `sicily_west`/`sicily_east`) purely to have something for its treaty-cession mechanic to point at — its own header comment says as much (*"no Mediterranean-map province existed anywhere before M10"*).

A merge of `main` into `military-overhaul` was attempted. The province/treaty conflict was worked through successfully (see §8 below — that work is preserved and ready to reuse), but the merge as a whole surfaced ~50 unrelated TypeScript errors across 14 files where the two branches had independently, silently diverged on shared code (`Bill.playerProposed` vs `playerSubmitted`, duplicate fields in `gameStore.ts`, a tightened `CrisisTrack` type not matching test fixtures, etc.) — real design decisions, not this plan's concern, and too much unrelated work to untangle inside a provinces task.

**Decision:** `military-overhaul` is the definitive branch going forward. `main`'s branch and its 2 unique commits are left untouched (nothing was lost — they're still there if ever needed for reference), but they are **not merged**. This plan instead **rebuilds `main`'s province work fresh, directly on `military-overhaul`**, chunk by chunk — and, critically, reconciles it with M10's treaty system *from the start* instead of bolting it on afterward, which is exactly what a plain merge would have failed to do cleanly anyway.

**Baseline assumption:** `military-overhaul` (all of M1–M11, plus Phase 3 P3-A/P3-B) is fully built, including M10's peace-negotiation system: `src/data/treatyTerms.ts`, the peace-logic section of `src/engine/warEngine.ts`, `src/components/war/NegotiationScreen.tsx` — **currently still containing the placeholder `SICILY_PROVINCES`/`sicily_west`/`sicily_all` stub**. §8 of this plan retires that stub. If it's already gone or looks different than described here, stop and reconcile before proceeding — someone already touched this area.

**Ground rules for the implementing session:**
- Read the file(s) a chunk touches before editing — line numbers/exact surrounding code will have drifted since this plan was written.
- Engines stay pure (no store/React imports); UI stays logic-free; content lives in `src/data/`; tunable numbers go in `BALANCE` — matching every other chunk in this codebase.
- Run `npx tsc --noEmit` and the relevant test file(s) after each chunk. Fix what you broke before moving to the next chunk.
- Where this plan gives literal code, it's been written, exercised, and (for §8) actually implemented and manually type-reviewed once already — treat it as a strong default, not a rough sketch, but still verify it still fits the current state of the file before pasting it in.

---

## 1. Chunk order & dependencies

| Chunk | What | Depends on |
|---|---|---|
| **MP-A** | Models — `ProvinceStatus: 'foreign'`, `ProvinceOwner`, `ProvinceDefinition.owner`/`clientOf`/`conquestFlag`, `ProvinceState.owner` | — |
| **MP-B** | Data — `MEDITERRANEAN_PROVINCES` (10 real provinces), `ALL_PROVINCES`, retire `SICILY_PROVINCES` | MP-A |
| **MP-C** | Engine — `provinceEngine.ts`: foreign-province guards, `applyProvinceFlips`, `tickAllProvinces` wiring | MP-B |
| **MP-D** | UI — `MapView.tsx`, `ProvinceSheet.tsx` (`ForeignTerritoryView`), `ProvinciaeScreen.tsx` legend | MP-B, MP-C |
| **MP-E** | Content — `evt-messana-appeal` event, `turnSequencer.ts` foreign-aware tweaks | MP-C |
| **MP-F** | Treaty reconciliation — retire `sicily_west`/`sicily_all`, per-province cession terms, insert-or-update cession fix, live-owner term eligibility | MP-B, MP-C |
| **MP-G** | Tests — `provinceEngine.test.ts` (new), `eventEngine.test.ts` additions, `warEngine.test.ts` fixes | MP-B, MP-C, MP-F |
| **MP-H** | Docs — `SITEMAP.md` | all of the above |

Each chunk should leave the build compiling and its own tests green before the next one starts.

---

## 2. Design invariants

1. **Foreign provinces exist from turn 1.** Every Mediterranean province — including ones Carthage or an independent power holds — is a real `ProvinceState` in `state.provinces` from game start (`status: 'foreign'`), not something inserted later on cession. This is the opposite of M10's placeholder, which stayed entirely absent from `state.provinces` until ceded.
2. **Ownership is tracked separately from status.** `owner: 'rome' | 'carthage' | 'independent'`. Only `status: 'foreign'` provinces ever have a non-`'rome'` owner. The Governor/Ambassador system (and everything gated on it — income, ticking, revolt, incorporation) simply does not apply to `'foreign'` provinces.
3. **Two paths flip a foreign province to Rome; both must converge on identical resulting state** (`owner: 'rome'`, `status: 'unincorporated'`):
   - A scripted event's `successEffect` sets the province's `conquestFlag` → `provinceEngine.applyProvinceFlips` catches it at the next season tick.
   - A ratified peace treaty's cession term → `warEngine.applyTreatyEffects`.

   Both must be **idempotent** — flipping an already-Roman province a second time is a no-op, not a duplicate/crash. This matters because Messana specifically is reachable both ways (see MP-E and MP-F).
4. **No region bundling.** Every province — city-state (Messana, Syracuse, Agrigentum) or territorial outpost (Alalia, Olbia, Sulci, Tripolitania) — is modeled as its own atomic unit. There is no "all of Sicily" as a single game object; this is a deliberate reversal of M10's `sicily_west`/`sicily_all` two-region placeholder.
5. **Numidia is explicitly out of scope for treaty cession.** `clientOf: 'carthage'` marks it as a Carthaginian *client*, not Carthaginian *territory* — `provinceTransferToRome` would model "ceding" it as ordinary conquest, which is wrong. A future patron/client mechanic (tribute, protection, war-approval gating) needs its own term shape; don't improvise one here. `clientOf` stays purely descriptive in this plan, exactly as it already is on `main`.
6. **Carthage itself is a normal (if extremely expensive) cedable province.** No special-casing to exclude the enemy capital from the cession-term list — just price it so it's realistically unaffordable most of the time (§8 already does this).

---

## 3. Chunk MP-A — Models

**Goal:** extend the province model to support foreign-held territory. No behavior changes yet — nothing reads these fields until MP-B/MP-C.

**File:** `src/models/province.ts`

**Verify first:** confirm current `ProvinceStatus` is `'incorporated' | 'unincorporated' | 'heartland'` (no `'foreign'` yet) and `ProvinceState`/`ProvinceDefinition` have no `owner` field. If they already do, someone's ahead of this plan — stop and reconcile.

**Spec** (exact additions, verified working on `main`):

```ts
export type ProvinceStatus =
  | 'incorporated'       // Full Roman province — Governor system applies
  | 'unincorporated'     // Foreign/frontier — Ambassador system applies
  | 'heartland'          // Latium + permanent Rome core — never governable
  | 'foreign';           // Held by a rival power or independent — no Governor/Ambassador system until it flips to Rome (see ProvinceDefinition.conquestFlag)

// Who currently holds a province. 'rome' covers incorporated/unincorporated/heartland;
// 'carthage' and 'independent' are only meaningful for status: 'foreign'.
export type ProvinceOwner = 'rome' | 'carthage' | 'independent';
```

On `ProvinceState`:
```ts
  status: ProvinceStatus; // mirrors ProvinceDefinition.status, but is the mutable copy — this is
                           // what engines should branch on, since it is the field that actually
                           // changes at runtime (e.g. a 'foreign' province flipping to Rome)
  owner: ProvinceOwner;    // mirrors ProvinceDefinition.owner at start; flips with status on conquest
```

On `ProvinceDefinition`:
```ts
  owner: ProvinceOwner;
  // Set only for status: 'foreign' independent states that are diplomatically bound to a
  // stronger power without being that power's own territory (e.g. Numidia is a Carthaginian
  // client, not Carthaginian soil). Purely descriptive — no engine reads it yet.
  clientOf?: ProvinceOwner;
  // Set only on status: 'foreign' provinces with a scripted path into Roman hands. When
  // state.flags[conquestFlag] becomes truthy, provinceEngine.applyProvinceFlips flips this
  // province's ProvinceState to owner: 'rome', status: 'unincorporated' at the next season tick.
  conquestFlag?: string;
```

**Done when:** `npx tsc --noEmit` still clean (new fields are unused so far — every existing `ProvinceState`/`ProvinceDefinition` literal in the codebase will now be missing required `owner`, which *will* cause errors at every construction site; those sites all get fixed in MP-B, so some red is expected until this chunk and MP-B land together).

---

## 4. Chunk MP-B — Data: `MEDITERRANEAN_PROVINCES`

**Goal:** add the real 10-province Mediterranean/Punic War theatre; retire M10's `SICILY_PROVINCES` stub.

**File:** `src/data/provinceDefinitions.ts`

**Verify first:** `grep -rn "SICILY_PROVINCES" src/` — should only appear in `provinceDefinitions.ts` itself and `MapView.tsx` (per M10's SITEMAP §5c). If `treatyTerms.ts`/`warEngine.ts` already reference real province ids instead of `sicily_west`/`sicily_east`, someone's done MP-F's work already — check before overwriting.

**Spec:**

1. Delete the `SICILY_PROVINCES` export entirely (both its two entries and its header comment).
2. Add `MEDITERRANEAN_PROVINCES: ProvinceDefinition[]` — paste verbatim from `main`'s `src/data/provinceDefinitions.ts` (git history still has it: `git show <main-branch-or-commit>:src/data/provinceDefinitions.ts`, look for the `// ─── Mediterranean Province Definitions ───` block). Ten entries: `messana`, `syracuse`, `agrigentum`, `lilybaeum`, `alalia`, `olbia`, `sulci`, `carthage`, `numidia`, `tripolitania` — full flavor text, `startingRelationship`/`startingInfrastructure`/`baseGoldOutput`/`baseImperiumOutput`/`nodeX`/`nodeY`/`npcRoleHolder` per entry, `messana` carrying `conquestFlag: 'messanaJoinsRome'` and `namedWar: 'Mamertine Crisis'`, `lilybaeum` carrying `namedWar: 'Sicilian Standoff'`, `carthage` carrying `namedWar: 'Punic Rivalry'`, `numidia` carrying `clientOf: 'carthage'`.
3. `export const ALL_PROVINCES: ProvinceDefinition[] = [...ITALY_PROVINCES, ...MEDITERRANEAN_PROVINCES];`
4. `getProvinceDefinition(id)` reads `ALL_PROVINCES` (not a two-list search).
5. `buildInitialProvinceStates()` maps over `ALL_PROVINCES` — **every foreign province is present in `state.provinces` from turn 1**, unlike M10's stub which stayed absent until ceded. Keep `buildProvinceState(def)` as the single-definition builder M10 already extracted (its shape doesn't change — only its caller set widens from `ITALY_PROVINCES`-only to `ALL_PROVINCES`). If `buildProvinceState` was inlined back into `buildInitialProvinceStates` at some point, re-extract it — MP-F's treaty engine needs to call it directly for the (rare) case a listed province is somehow absent from `state.provinces`.
6. `isGovernable(provinceId)`: `false` for `latium` and any `status: 'foreign'` province; unchanged otherwise.

**Done when:** `npx tsc --noEmit` clean; `buildInitialProvinceStates()` returns Italy's provinces + all 10 Mediterranean ones (`14` total assuming `ITALY_PROVINCES` currently has `4`, adjust to actual count).

---

## 5. Chunk MP-C — Engine: `provinceEngine.ts`

**Goal:** foreign provinces are inert (no income, no Governor/Ambassador ticking, no revolt/incorporation checks) until flipped to Rome; the conquest-flip mechanic exists and runs every season.

**File:** `src/engine/provinceEngine.ts`

**Spec** (4 changes):

1. **`calcProvinceGoldOutput`** — early-return 0 for foreign provinces too:
   ```ts
   if (!def || province.status === 'heartland' || province.status === 'foreign') return 0;
   ```
   (branch on the live `province.status`, not the static `def.status` — this fix applies throughout this file, see point 3)

2. **`tickProvince`** — short-circuit entirely for foreign provinces, right after the existing heartland short-circuit:
   ```ts
   // Foreign territory (Carthaginian/independent, not yet Roman) — no Governor/Ambassador
   // system applies, so there is nothing to tick. See applyProvinceFlips for the conquest path.
   if (p.status === 'foreign') {
     return { updatedProvince: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, events };
   }
   ```

3. **Fix 3 pre-existing `def.status` reads that should be `p.status`/`province.status`** in `tickProvince` (NPC-governor-ticking gate, revolt-check gate, unincorporated-threshold checks) — `def` is the static definition and never changes; `p`/`province` is the live mutable state engines should actually branch on. This matters once a province can change status at runtime (conquest flip) — reading the static def would silently un-notice the flip.

4. **New function `applyProvinceFlips`**, called once per season from `tickAllProvinces` before the main per-province tick loop:
   ```ts
   /**
    * Conquest/defection flips — a 'foreign' province joins Rome when the flag named by
    * its ProvinceDefinition.conquestFlag becomes truthy (set by an event's successEffect,
    * e.g. 'setFlag:messanaJoinsRome:true'). Flips owner to 'rome' and status to
    * 'unincorporated' — a freshly-won territory Rome has not yet incorporated, so it falls
    * straight into the existing unincorporated/Ambassador pathway from the next tick on.
    * Idempotent: re-checks province.owner so a province already flipped is left alone.
    */
   export function applyProvinceFlips(
     provinces: ProvinceState[],
     flags: GameState['flags']
   ): { provinces: ProvinceState[]; events: string[] } {
     const events: string[] = [];
     const updated = provinces.map(province => {
       if (province.owner === 'rome') return province;
       const def = getProvinceDefinition(province.id);
       if (!def?.conquestFlag || !flags[def.conquestFlag]) return province;
       events.push(`${def.name} has joined Rome. It is now unincorporated territory, open to an Ambassador posting.`);
       return { ...province, owner: 'rome' as const, status: 'unincorporated' as const };
     });
     return { provinces: updated, events };
   }
   ```
   Wire it into `tickAllProvinces`: run it first, fold its `events` into the returned event list, and tick the *flipped* array (not the original) so a province that just joined this season is ticked as `unincorporated` immediately, not left one tick behind.

**Done when:** `npx tsc --noEmit` clean. (Unit tests for this land in MP-G.)

---

## 6. Chunk MP-D — UI

**Goal:** the map, province sheet, and legend all render foreign provinces correctly.

**Files:** `src/components/provinciae/MapView.tsx`, `src/components/provinciae/ProvinceSheet.tsx`, `src/screens/ProvinciaeScreen.tsx`

**MapView.tsx:**
- Import `ALL_PROVINCES` from `provinceDefinitions.ts` (replacing whatever M10-era Sicily overlay list is there — see MP-B).
- `getNodeColour`: foreign provinces get owner-based color instead of the Governor/Ambassador/revolt palette:
  ```ts
  if (province.status === 'foreign') {
    if (province.owner === 'carthage') return { fill: '#4a2a5a', border: '#7a4a8a' };
    return { fill: '#3a5a5a', border: '#5a8a8a' }; // independent
  }
  ```
  (this check must come before the revolt/governor/ambassador checks, after the heartland check)

**ProvinceSheet.tsx:**
- Add `isForeign = province.status === 'foreign'` alongside the existing `isHeartland`.
- Skip the tab strip for foreign provinces too: `{!isHeartland && !isForeign && (...)}`.
- Render a new `ForeignTerritoryView` component (mirrors the existing `HeartlandView` pattern — read-only flavor text + Rome's diplomatic standing, no tabs):
  ```tsx
  function ForeignTerritoryView({
    def,
    province,
  }: {
    def: NonNullable<ReturnType<typeof getProvinceDefinition>>;
    province: ProvinceState;
  }) {
    const relLabel = getRelationshipLabel(province.relationshipScore);
    const relColour = getRelColour(province.relationshipScore);
    return (
      <View style={styles.heartlandView}>
        <Text style={styles.heartlandIcon}>{province.owner === 'carthage' ? '⚓' : '🛡'}</Text>
        <Text style={styles.heartlandTitle}>{def.latinName}</Text>
        <Text style={styles.heartlandDesc}>{def.flavorDescription}</Text>
        <View style={styles.divider} />
        <Text style={[milStyles.statValue, { color: relColour }]}>
          Rome's standing: {relLabel} ({Math.round(province.relationshipScore)})
        </Text>
      </View>
    );
  }
  ```
- Status label/dot: branch on `isForeign` before the incorporated/unincorporated check, using a new `getForeignLabel` helper:
  ```ts
  function getForeignLabel(
    def: NonNullable<ReturnType<typeof getProvinceDefinition>>,
    province: ProvinceState,
  ): string {
    if (province.owner === 'carthage') return 'Carthaginian Territory';
    if (def.clientOf) return `Independent — Client of ${def.clientOf === 'carthage' ? 'Carthage' : def.clientOf}`;
    return 'Independent Power';
  }
  ```
  and extend `getStatusColour` with a `status === 'foreign'` branch (owner-based, same colors as MapView's).
- Fix the same "read live `province.status`, not static `def.status`" issue MP-C fixed in the engine — this file had the identical latent bug in its Governor-info-box and Ambassador-posting-button gates.

**ProvinciaeScreen.tsx:** add two legend entries:
```ts
{ colour: '#4a2a5a', label: 'Carthaginian' },
{ colour: '#3a5a5a', label: 'Independent' },
```

**Done when:** manual playtest — Provinciae tab shows all 10 Mediterranean nodes on the map (positioned per MP-B's `nodeX`/`nodeY`), tapping one opens a read-only foreign-territory sheet with no tab strip and no crash, legend shows the two new colors.

---

## 7. Chunk MP-E — Content: the Messana event + `turnSequencer.ts` tweaks

**Goal:** the historical flashpoint — Rome's actual casus belli for the whole Mediterranean theatre — exists as a real event, reachable from turn 1.

**File:** `src/data/events.ts` — add (Class F, Sicily/Mediterranean theatre):

```ts
{
  id: 'evt-messana-appeal',
  title: 'The Mamertine Envoys',
  bodyText:
    'A delegation from Messana stands in the Forum, dust of the Sicilian roads still on their ' +
    'boots. The Mamertines who hold the city are caught between Hiero of Syracuse and a Carthaginian ' +
    'garrison already inside their walls, and they have come to Rome for help none of their neighbours ' +
    'will give. Everyone in the Curia understands what answering them means: a fleet across the ' +
    'strait, and very likely a war with Carthage that no one alive has yet had to fight.',
  imageKey: 'portrait-paterfamilias',
  conditions: [{ type: 'flag', key: 'messanaResolved', equals: false }],
  weight: 5,
  seasons: [0],
  choices: [
    {
      id: 'answer-the-call',
      label: 'Answer the Mamertine call — send the fleet',
      successEffect: 'setFlag:messanaResolved:true|setFlag:messanaJoinsRome:true|crisis-war+15|fides+5',
      failureEffect: '',
      successText:
        'The vote carries. Legions embark for the strait before Carthage\'s garrison in Messana ' +
        'can be reinforced — the Republic has chosen its first war beyond Italy, and there is no ' +
        'talking its way back out of one now.',
    },
    {
      id: 'refuse',
      label: 'Refuse — Sicily is not worth a war with Carthage',
      successEffect: 'setFlag:messanaResolved:true|fides-5',
      failureEffect: '',
      successText:
        'The envoys are sent home empty-handed. Messana will make its peace with Syracuse or ' +
        'Carthage as it must, and Rome keeps its legions on this side of the strait — for now.',
    },
  ],
},
```

Note this sets `messanaJoinsRome` — the exact `conquestFlag` MP-B put on the `messana` `ProvinceDefinition` — closing the loop with MP-C's `applyProvinceFlips`. It does **not** itself start a war (`military-overhaul` already has its own war-ignition sequencing via `warEvents.ts`/P3-B — check whether that pool needs a hook off `messanaResolved`/`messanaJoinsRome` too, since on `main` there was no war system yet for this event to kick off; on `military-overhaul` there is, and it's reasonable for this event to be the trigger the Mamertine Crisis war-arc content already narratively assumes. Verify against `data/warEvents.ts`'s ignition event before assuming this is a no-op integration point.)

**File:** `src/engine/turnSequencer.ts` — two small tweaks:
- Income event message: drop the `"...from Italy."` qualifier now that income can come from anywhere (`Provincial income: +${totalGoldDelta} Gold, +${totalImperiumDelta} Imperium.`).
- Lex de Viis infrastructure boost: exclude foreign provinces from the "every non-heartland province" set (`p.status !== 'heartland' && p.status !== 'foreign'`) — Rome doesn't build roads in Carthaginian territory.

**Done when:** firing `evt-messana-appeal` via `DebugPanel` and choosing "answer-the-call" flips Messana to Rome at the next season tick (owner `'rome'`, status `'unincorporated'`).

---

## 8. Chunk MP-F — Treaty reconciliation (the real integration point)

This chunk has **no precedent on `main`** — `main` never had a treaty system to integrate with. It retires M10's placeholder Sicily-cession stub and rebuilds it against MP-B's real province data. **This exact work was already designed and implemented once**, in a since-abandoned merge attempt, and type-reviewed by hand (automated `tsc`/`jest` verification was not available in that session — re-run both here). It's reproduced below verbatim, ready to paste in with only path/context adjustments as needed.

**File:** `src/data/treatyTerms.ts` — replace the `sicily_west`/`sicily_all` two entries with one atomic cession term per province:

```ts
  // ─── Mediterranean province cession (one term per province) ────────────────
  // Each of MEDITERRANEAN_PROVINCES (src/data/provinceDefinitions.ts) gets its
  // own atomic cession term — city-states (Messana, Syracuse, Agrigentum) are
  // treated identically to the coastal/mining outposts (Alalia, Olbia, Sulci,
  // Tripolitania), no west/east region bundling. Numidia is deliberately
  // excluded: it's a Carthaginian CLIENT, not Carthaginian territory
  // (`clientOf: 'carthage'`), and "ceding" it via provinceTransferToRome would
  // model it as ordinary conquered soil — a patron/client mechanic (tribute,
  // protection, war-approval gating) is planned separately and Numidia's
  // treaty term should be built against that system, not this one.
  // `getEligibleTreatyTerms` (warEngine.ts) gates all of these on the
  // CURRENT/live owner of the listed province(s) matching the war's enemyId,
  // so e.g. a Gaul war never offers Carthaginian Sicily even though the term
  // exists in this flat list.
  {
    id: 'messana',
    label: 'Carthage Cedes Messana',
    description: 'The Mamertine flashpoint itself, ceded outright — the war\'s original casus belli, formally Roman.',
    warScorePrice: 16,
    effectsAsWinner: 'lifetimeDignitas+8|imperium+5',
    effectsAsLoser: 'lifetimeDignitas-5|crisis-war+3',
    warEndFlags: { provinceTransferToRome: ['messana'] },
    factionReaction: { optimates: 3, populares: 1 },
  },
  {
    id: 'syracuse',
    label: 'Syracuse Submits',
    description: "Hiero II's wealthy Greek kingdom accepts Roman authority — Sicily's richest city.",
    warScorePrice: 20,
    effectsAsWinner: 'lifetimeDignitas+12|imperium+6',
    effectsAsLoser: 'lifetimeDignitas-7|crisis-war+4',
    warEndFlags: { provinceTransferToRome: ['syracuse'] },
    factionReaction: { optimates: 4, populares: 1 },
  },
  {
    id: 'agrigentum',
    label: 'Agrigentum Cedes',
    description: 'The exposed southern Greek polis changes hands again, this time to Rome.',
    warScorePrice: 12,
    effectsAsWinner: 'lifetimeDignitas+6|imperium+3',
    effectsAsLoser: 'lifetimeDignitas-4|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['agrigentum'] },
    factionReaction: { optimates: 2, populares: 1 },
  },
  {
    id: 'lilybaeum',
    label: 'Carthage Quits Lilybaeum',
    description: "Carthage's principal Sicilian fortress-port, gateway to Africa, surrendered to Rome.",
    warScorePrice: 20,
    effectsAsWinner: 'lifetimeDignitas+12|imperium+8',
    effectsAsLoser: 'lifetimeDignitas-8|crisis-war+4',
    warEndFlags: { provinceTransferToRome: ['lilybaeum'] },
    factionReaction: { optimates: 4, populares: 1 },
  },
  {
    id: 'alalia',
    label: 'Carthage Quits Alalia',
    description: 'A modest Corsican timber-and-iron outpost, ceded for its harbour.',
    warScorePrice: 8,
    effectsAsWinner: 'lifetimeDignitas+4|imperium+2',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+1',
    warEndFlags: { provinceTransferToRome: ['alalia'] },
    factionReaction: { optimates: 1, populares: 0 },
  },
  {
    id: 'olbia',
    label: 'Carthage Quits Olbia',
    description: "Sardinia's northern grain port and fleet anchorage, handed to Rome.",
    warScorePrice: 10,
    effectsAsWinner: 'lifetimeDignitas+5|imperium+2',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['olbia'] },
    factionReaction: { optimates: 1, populares: 1 },
  },
  {
    id: 'sulci',
    label: 'Carthage Quits Sulci',
    description: "Sardinia's southern silver-and-lead port, ceded along with its mines.",
    warScorePrice: 10,
    effectsAsWinner: 'lifetimeDignitas+5|imperium+3',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['sulci'] },
    factionReaction: { optimates: 2, populares: 0 },
  },
  {
    id: 'tripolitania',
    label: 'Carthage Quits Tripolitania',
    description: 'A distant, arid coastal holding — of little interest to Rome yet, but ceded all the same.',
    warScorePrice: 6,
    effectsAsWinner: 'lifetimeDignitas+3|imperium+1',
    effectsAsLoser: 'lifetimeDignitas-2|crisis-war+1',
    warEndFlags: { provinceTransferToRome: ['tripolitania'] },
    factionReaction: { optimates: 1, populares: 0 },
  },
  {
    id: 'carthage_cedes_capital',
    label: 'Carthage Itself',
    description: "The rival's own capital, offered at the negotiating table rather than taken by siege — a demand so extreme most wars will never afford it, and the hawks call anything less a betrayal of the men who could have taken it by the sword.",
    warScorePrice: 40,
    effectsAsWinner: 'lifetimeDignitas+30|imperium+20',
    effectsAsLoser: 'lifetimeDignitas-20|crisis-war+8',
    warEndFlags: { provinceTransferToRome: ['carthage'] },
    factionReaction: { optimates: 8, populares: 3 },
  },
```

All prices/effects are first-pass/unverified, same convention as every other M-chunk's numbers — revisit in a future tuning pass. No `mutuallyExclusiveWith` on any of these (each province is atomic; nothing overlaps).

**File:** `src/engine/warEngine.ts` — three changes:

1. **`applyTreatyEffects`'s province-cession block** — change from insert-only to insert-or-update, since MP-B's provinces are pre-populated at game start (unlike M10's original assumption that a cedable province starts absent from `state.provinces`):
   ```ts
   if (winner === 'rome') {
     const provinceIds = [...new Set(terms.flatMap(t => t.warEndFlags?.provinceTransferToRome ?? []))];
     if (provinceIds.length > 0) {
       const basePatchProvinces = patch.provinces ?? working.provinces;
       const flippedProvinces = basePatchProvinces.map(p => {
         if (!provinceIds.includes(p.id) || p.owner === 'rome') return p;
         return { ...p, owner: 'rome' as const, status: 'unincorporated' as const };
       });
       const missingIds = provinceIds.filter(id => !basePatchProvinces.some(p => p.id === id));
       const newProvinces = missingIds
         .map(getProvinceDefinition)
         .filter((d): d is NonNullable<typeof d> => !!d)
         .map(buildProvinceState);
       patch.provinces = [...flippedProvinces, ...newProvinces];
     }
   }
   ```
   The flip semantics (`owner: 'rome'`, `status: 'unincorporated'`) exactly match `provinceEngine.applyProvinceFlips` (MP-C) — this is what makes Messana idempotently reachable via both the scripted event and a treaty (design invariant §2.3).

2. **New exported helper, `getEligibleTreatyTerms`** — single source of truth for "what's actually negotiable in this war," gating any province-cession term on the *live* owner matching the war's enemy:
   ```ts
   export function getEligibleTreatyTerms(
     terms: TreatyTerm[],
     enemyId: string,
     provinces: ProvinceState[],
   ): TreatyTerm[] {
     return terms.filter(t => {
       const provinceIds = t.warEndFlags?.provinceTransferToRome;
       if (!provinceIds || provinceIds.length === 0) return true;
       return provinceIds.every(id => provinces.find(p => p.id === id)?.owner === enemyId);
     });
   }
   ```
   (needs `import type { ProvinceState } from '../models/province';`)

3. **Thread it through both AI composers** — add `enemyId: string, provinces: ProvinceState[]` params, filter through `getEligibleTreatyTerms` before their existing logic:
   ```ts
   export function composeAiOffer(
     general: GeneralProfile,
     enemyId: string,
     provinces: ProvinceState[],
     rng: () => number = Math.random,
   ): string[] {
     const count = BALANCE.war.treaty.aiOfferTermCount;
     const affordable = getEligibleTreatyTerms(TREATY_TERMS, enemyId, provinces)
       .filter(t => t.warScorePrice >= 0 && t.warScorePrice <= 6)
       .sort(() => rng() - 0.5);
     const take = general.aggression >= 0.5 ? Math.max(1, count - 1) : count;
     return affordable.slice(0, take).map(t => t.id);
   }

   export function composeAiTreaty(
     budget: number,
     general: GeneralProfile,
     enemyId: string,
     provinces: ProvinceState[],
     rng: () => number = Math.random,
   ): string[] {
     const shuffled = getEligibleTreatyTerms(TREATY_TERMS, enemyId, provinces).sort(() => rng() - 0.5);
     const spendCap = general.aggression >= 0.5 ? budget : Math.round(budget * 0.7);
     const picked: string[] = [];
     let spent = 0;
     for (const term of shuffled) {
       if (term.mutuallyExclusiveWith?.some(id => picked.includes(id))) continue;
       if (spent + term.warScorePrice > spendCap) continue;
       picked.push(term.id);
       spent += term.warScorePrice;
     }
     return picked;
   }
   ```
   Update both call sites in `processWarSeason` to pass `next.enemyId, state.provinces` (or `statePatch.provinces ?? state.provinces` if a cession already happened earlier in the same tick).

**File:** `src/components/war/NegotiationScreen.tsx` — the player-facing term picker:
- Destructure `provinces` from `useGameStore()` alongside the existing `wars`/`currentOffice`/etc.
- Compute `const eligibleTerms = useMemo(() => (war ? getEligibleTreatyTerms(TREATY_TERMS, war.enemyId, provinces) : []), [war, provinces]);`
- Use `eligibleTerms` (not the raw `TREATY_TERMS`) both in `toggleTerm`'s lookup and the picker's `.map()`.

**File:** `src/models/war.ts` — update `TreatyTermWarEndFlags.provinceTransferToRome`'s doc comment (it currently references `SICILY_PROVINCES` and insert-only semantics — both wrong post-MP-F) and `TreatyTerm.mutuallyExclusiveWith`'s doc comment (currently gives `sicily_all supersedes sicily_west` as its example, which no longer exists).

**Done when:** `npx tsc --noEmit` clean; a treaty negotiated in a Carthage war can cede Lilybaeum (flips the existing `foreign` `ProvinceState` in place, doesn't duplicate it); the term never appears in a non-Carthage war's picker or AI offer.

---

## 9. Chunk MP-G — Tests

**New file, `__tests__/provinceEngine.test.ts`:**

```ts
import {
  calcProvinceGoldOutput,
  tickProvince,
  applyProvinceFlips,
} from '../src/engine/provinceEngine';
import { buildInitialProvinceStates, getProvinceDefinition, isGovernable } from '../src/data/provinceDefinitions';
import type { GovernorPolicy, ProvinceState } from '../src/models/province';

const STANDARD_POLICY: GovernorPolicy = {
  taxation: 'standard',
  security: 'standard_garrison',
  development: 'maintain',
};

function findState(id: string): ProvinceState {
  const found = buildInitialProvinceStates().find(p => p.id === id);
  if (!found) throw new Error(`no province state for ${id}`);
  return found;
}

describe('provinceEngine — foreign province handling', () => {
  test('foreign provinces start with owner set from their definition', () => {
    const carthage = findState('carthage');
    const messana = findState('messana');
    const numidia = findState('numidia');
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
    expect(messana.owner).toBe('independent');
    expect(numidia.owner).toBe('independent');
    expect(getProvinceDefinition('numidia')?.clientOf).toBe('carthage');
  });

  test('isGovernable is false for foreign provinces and latium, true for a normal province', () => {
    expect(isGovernable('carthage')).toBe(false);
    expect(isGovernable('lilybaeum')).toBe(false);
    expect(isGovernable('latium')).toBe(false);
    expect(isGovernable('campania')).toBe(true); // swap for any real Italy province id if this one doesn't exist
  });

  test('calcProvinceGoldOutput returns 0 for a foreign province regardless of policy', () => {
    const lilybaeum = findState('lilybaeum');
    expect(calcProvinceGoldOutput(lilybaeum, STANDARD_POLICY, 5)).toBe(0);
  });

  test('tickProvince no-ops entirely for a foreign province', () => {
    const carthage = findState('carthage');
    const result = tickProvince(carthage, 0, 0);
    expect(result.updatedProvince).toEqual(carthage);
    expect(result.goldDelta).toBe(0);
    expect(result.imperiumDelta).toBe(0);
    expect(result.corruptionDelta).toBe(0);
    expect(result.events).toEqual([]);
  });
});

describe('provinceEngine — applyProvinceFlips (conquest/defection)', () => {
  test('leaves provinces alone when their conquestFlag is not set', () => {
    const provinces = buildInitialProvinceStates();
    const { provinces: result, events } = applyProvinceFlips(provinces, {});
    expect(events).toEqual([]);
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('independent');
    expect(messana.status).toBe('foreign');
  });

  test('flips Messana to Rome when messanaJoinsRome flag is truthy', () => {
    const provinces = buildInitialProvinceStates();
    const { provinces: result, events } = applyProvinceFlips(provinces, { messanaJoinsRome: true });
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('rome');
    expect(messana.status).toBe('unincorporated');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatch(/Messana/);

    const carthage = result.find(p => p.id === 'carthage')!;
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
  });

  test('is idempotent — a province already owned by Rome is left alone even if its flag is still set', () => {
    const provinces = buildInitialProvinceStates();
    const first = applyProvinceFlips(provinces, { messanaJoinsRome: true }).provinces;
    const { provinces: second, events } = applyProvinceFlips(first, { messanaJoinsRome: true });
    expect(events).toEqual([]);
    const messana = second.find(p => p.id === 'messana')!;
    expect(messana.status).toBe('unincorporated');
  });

  test('a flipped province ticks normally afterward (falls into the unincorporated pathway)', () => {
    const provinces = buildInitialProvinceStates();
    const flipped = applyProvinceFlips(provinces, { messanaJoinsRome: true }).provinces;
    const messana = flipped.find(p => p.id === 'messana')!;
    const result = tickProvince(messana, 0, 0);
    expect(result.updatedProvince.status).toBe('unincorporated');
  });
});
```

**`__tests__/eventEngine.test.ts` additions:**

```ts
describe('evt-messana-appeal — Sicily/Mediterranean province flip trigger', () => {
  const def = getEventDef('evt-messana-appeal')!;

  test('exists with the two expected choices', () => {
    expect(def).toBeDefined();
    expect(def.choices.map(c => c.id).sort()).toEqual(['answer-the-call', 'refuse']);
  });

  test('is eligible while messanaResolved is unset, ineligible once it is set true', () => {
    expect(evalCondition(def.conditions[0], makeState({ flags: {} }) as any)).toBe(true);
    expect(evalCondition(def.conditions[0], makeState({ flags: { messanaResolved: true } }) as any)).toBe(false);
  });

  test('answering the call sets both the resolved and conquest flags plus a war-track bump', () => {
    const choice = def.choices.find(c => c.id === 'answer-the-call')!;
    const { effectStr } = resolveEventChoice(choice, makeState({ flags: {} }) as any);
    expect(effectStr).toContain('setFlag:messanaResolved:true');
    expect(effectStr).toContain('setFlag:messanaJoinsRome:true');
    expect(effectStr).toContain('crisis-war+15');
  });

  test('refusing sets only the resolved flag, not the conquest flag', () => {
    const choice = def.choices.find(c => c.id === 'refuse')!;
    const { effectStr } = resolveEventChoice(choice, makeState({ flags: {} }) as any);
    expect(effectStr).toContain('setFlag:messanaResolved:true');
    expect(effectStr).not.toContain('messanaJoinsRome');
  });
});
```

**`__tests__/warEngine.test.ts` fixes** (MP-F retires `sicily_west`/`sicily_all` — find-and-replace, or write fresh depending on how much else has drifted by the time this chunk lands):
- Anywhere a test uses `'sicily_west'`/`'sicily_all'` as a treaty term id, swap to `'lilybaeum'` (or another real Carthaginian-owned province id) — same shape, different label.
- `composeAiOffer(general, rng)` / `composeAiTreaty(budget, general, rng)` calls need the new `enemyId, provinces` params — use `'carthage'` and `buildInitialProvinceStates()` (import from `provinceDefinitions.ts`) as realistic fixtures.
- The old "`composeAiTreaty` never selects mutually exclusive terms together" test (built around `sicily_west`/`sicily_all`) has no real mutex pair to test anymore — replace with an eligibility test instead: assert `composeAiOffer`/`composeAiTreaty` never include a province-cession term whose province isn't live-owned by the passed `enemyId`.
- `applyTreatyEffects` tests: add a case for the new insert-or-update flip behavior — ceding an already-present `foreign` province flips it in place (not a duplicate), and ceding an already-Roman province is a no-op.

**Done when:** `npx jest` green.

---

## 10. Chunk MP-H — Docs

Update `SITEMAP.md`:
- §4 (Provinciae): `MapView.tsx`/`ProvinceSheet.tsx` row descriptions — mention foreign-province rendering/`ForeignTerritoryView`.
- §4's Data line: `provinceDefinitions.ts` — describe `MEDITERRANEAN_PROVINCES`/`ALL_PROVINCES`, not `SICILY_PROVINCES`.
- §5c (M10 treaty system): retire every reference to `sicily_west`/`sicily_all`/`SICILY_PROVINCES`; describe the real per-province term list and `getEligibleTreatyTerms`.
- Add an `events.ts` mention of `evt-messana-appeal`.
- `grep -rn "sicily_west\|sicily_all\|sicily_east\|SICILY_PROVINCES" SITEMAP.md` should return nothing when done.

---

## Appendix — where to pull exact source if this plan's inline copies have drifted

Everything MP-A through MP-E specifies verbatim was pulled from `main`'s tip at the time this plan was written. If `main` still exists as a branch/ref, the exact original files are:
- `src/models/province.ts`
- `src/data/provinceDefinitions.ts`
- `src/engine/provinceEngine.ts`
- `src/components/provinciae/MapView.tsx`
- `src/components/provinciae/ProvinceSheet.tsx`
- `src/screens/ProvinciaeScreen.tsx`
- `src/data/events.ts` (the `evt-messana-appeal` entry only — everything else in that file is `military-overhaul`'s own content and must not be overwritten)
- `src/engine/turnSequencer.ts` (two small tweaks only — same caveat)
- `__tests__/provinceEngine.test.ts` (new file on `main`)
- `__tests__/eventEngine.test.ts` (the `evt-messana-appeal` describe block only)

MP-F's treaty content has no `main`-branch source — it was designed fresh against `military-overhaul`'s M10 system and is reproduced in full in §8 above.
