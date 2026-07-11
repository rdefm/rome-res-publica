# Rome: Res Publica — Phase 4 Implementation Plan: The Thriller

## 0. How to use this document

This plan specifies **Phase 4 of the design roadmap** (`rome-design-review-and-plan.md`, Part 3): the **Secrets system** (gather / leverage / extort / burn, with counterplay and symmetric NPC-held secrets), the **trials overhaul** (a unified prosecution/defense pipeline, a multi-season preparation screen — the *Basilica* — an interactive trial-day event, and a full-screen verdict scene), and the **Claudius arc** that wires the existing starting-blackmail flag into the new system as the game's scripted opening thriller beat. It supersedes the roadmap's one-line Phase 4 items with the fleshed-out design agreed in design review (2026-07): trials are now a cross-season "project" with a 70/30 prep-vs-performance split, player-initiated prosecutions gated by criminal Secrets or public corruption, calumnia risk, and Logos/Pathos/Ethos preparation sections.

It is written in the exact style of `rome-phase1-implementation-plan.md`, `rome-phase2-implementation-plan.md`, and `rome-phase3-implementation-plan.md`, and is meant to be handed to a fresh implementation chat **together with the actual source files named in each chunk**.

**You are expected to implement ONE chunk per chat session.** When the user says "implement chunk P4-C of the Phase 4 plan", your workflow is:

1. **Read this entire document** (at minimum §0, §1, §2, the chunk itself, its dependencies' "Done when" criteria, and §Cross-Chunk Notes).
2. **Request the files** listed in the chunk's *Files to request* line. Do not guess at file contents you have not seen.
3. **Run the chunk's *Verify* list** against those files. If anything doesn't match this plan's assumptions — a missing field, a different function signature, an earlier chunk apparently not implemented — **stop and ask before writing code.** Also flag any ambiguity you find in the spec itself.
4. Implement the chunk. Engines are pure functions (no store access); UI contains no game logic; all tunable numbers go in `BALANCE` (never inline literals); content/data lives in `src/data/`.
5. Run `npx tsc --noEmit` and the test suite. Fix what you broke.
6. **Share every created or modified file in full** as output files, plus a short changelog note: files touched, deviations from this plan (with reasons), and any `BALANCE` values you added or adjusted.

### Baseline assumption

Phases 0, 1, 2, and 3 are fully implemented. This plan builds on, without re-deriving:

- Four-track `crisis` + `crisisEngine.ts`; `flags: Record<string, boolean | number>` on `GameState`.
- The **agenda engine** (`agendaEngine.ts`) + `AgendaTablet`/`AgendaBadge`; the **Season Ledger** (`models/ledger.ts`, `SeasonOverlay`, `LedgerBlock`); autosave; the guided start and tutorial queue (`tutorialEvents.ts`, incl. `evt-tut-04` "The Claudian Smile", which marks intel gathered on Ap. Claudius).
- `src/data/balance.ts` — the `BALANCE` registry. **Every tunable number in this plan goes here.**
- The **`injectNoticeEvent(defId, interpolations)` helper** (Philon-voiced weight-0 interstitials) and the **branching multi-scene event pattern** via `nextEventId` (used by Phase 3's succession sequence — the Claudius arc and trial-day beats reuse both patterns).
- Phase 2's relationship anchors, leader aging/succession, and Munificence; Phase 3's `war`, epilogue screen, `AncestorRecord` / Hall of Ancestors, succession/regency, cadet branch, Endless mode.
- The **existing base-game trial system**: `engine/trialEngine.ts`, `models/trial.ts`, `data/trialActions.ts` — hostile-clan accusations queue a trial with `prosecutionStrength`, the player buys `defenseStrength` via one-shot (some asset-gated) actions over a countdown, outcomes Dismissed → Acquitted → Fined → Exiled → Executed. **Phase 4 rebuilds this pipeline but keeps its concepts**; the old defense actions migrate into the new prep catalog.
- The existing **Gather Intelligence** Forum action (8 Fides, marks an intel flag per leader) and the **Quaestor "Audit a Rival"** office action (60% to gain blackmail). Both are rewired here.
- Corruption scores on characters (accrued by office/governorship), clan standings, faction alignment, `electionEngine`.

If any of these are absent, **stop and reconcile** before proceeding. The military overhaul (`rome-military-implementation-plan.md`) remains **not built**; Phase 4 has no dependency on it.

### Ground rules for the implementing chat

- Before writing anything in a chunk, read the files it names — especially `src/state/gameStore.ts`, `src/engine/turnSequencer.ts` (verify current step list — Phases 0–3 have grown it), `src/engine/trialEngine.ts`, and `src/data/balance.ts`.
- **Verify, don't assume:** how the intel flag is stored and consumed today (per-leader boolean? on `ClanLeader` or in `flags`?); the exact shape of `Trial` / `TrialCharge` / `TrialOutcome`; how corruption-triggered trials fire in the turn sequencer; how `evt-tut-04`'s special-case store handler marks intel; the current agenda generator numbering (Phase 3 ended at **#22**); which effect tokens exist (the event-writing guide's list may be stale — Phases 0–3 added tokens; grep the effect parser).
- Engines pure, UI logic-free, content in `src/data/`, **no new spendable resources** (valid: `fides`, `denarii`, `imperium`, `lifetimeDignitas`). A Secret is an inventory object, never a currency; case strength is trial state, never shown in the ResourceBar.
- Event content follows `rome-event-writing-guide.md` exactly (schema, tone, effect budgets). Where this plan gives full copy, use it verbatim; where it gives a brief, write to the guide. **Do not invent new `EventDef` fields** — trial beats get their own data shape (P4-E) precisely so the event schema stays untouched.
- Philon's voice (dry, precise, "Domine") narrates agenda/ledger/notice strings. Courtroom copy — accusations, beat complications, verdicts — is **formal forensic register**, never Philon.

### Chunk order

**P4-A → P4-B → P4-C → P4-D → P4-E → P4-F → P4-G.** Each chunk ends with a compiling, playable, testable build. Dependencies:

- **P4-A** (Secret model + generation) → **P4-B** (spend/counterplay/NPC behavior + Forum UI) — B needs A's objects.
- **P4-C** (unified trial pipeline) needs **A** (criminal Secrets gate prosecution) but not B; it replaces the trial internals while keeping the old defense-action UI temporarily functional.
- **P4-D** (Basilica prep screen) needs **C**. **P4-E** (trial-day beats) needs **C + D**. **P4-F** (verdict scene + rewards) needs **E**.
- **P4-G** (Claudius arc + tutorial rewiring + docs) needs **B** (counterplay verbs) and **C** (his prosecution threat must be real); sequenced last so the arc exercises the finished system end-to-end.

---

## 1. Design invariants (apply to every chunk)

1. **70/30, and it's a constant.** Preparation determines ~70% of a trial's outcome; the trial-day event can swing at most ±30% of the verdict scale. Both shares live in `BALANCE.trials` and nothing may bypass the clamp.
2. **RNG picks complications, never verdicts.** Dice decide *which* obstacles appear (which beats draw, whether a bribe is discovered, whether intelligence-gathering succeeds). The verdict itself is a **deterministic threshold** on final accumulated score. No trial, ever, resolves on a hidden roll.
3. **One pipeline, two seats.** NPC accusations, corruption-trigger trials, secret-exposure trials, and player-filed prosecutions all create the **same `TrialState`**; the player just sits in the `defense` or `prosecution` seat. There is exactly one prep screen, one beat engine, one verdict scene.
4. **Offense is gated and priced.** Filing a prosecution requires a *criminal* Secret on the target **or** target corruption ≥ threshold. Losing a prosecution triggers **calumnia**: Dignitas loss, clan-relation collapse, counter-suit risk. High risk, high reward, self-limiting.
5. **Leverage against the player is always defiable.** An NPC using a Secret on your family presents a *comply-or-be-exposed* choice; no vote button is ever silently locked. Agency is preserved; consequences are not.
6. **Mutual deterrence is automatic.** While you hold an unspent Secret on a leader, any Secret that leader holds on your family is frozen (no leverage, extortion, or burning) — and vice versa. A Cold War standoff, visible in the UI, no action required.
7. **The fast path always exists.** Every interactive trial can be resolved via "let [speaker] argue it" — an expected-value auto-resolution using prep score and stats, with **neutral EV** (respect for the burst player's time, not a tax). The beats are optional depth.
8. **Approach is a setting, not a spend.** The trial approach (Ferocity / Procedure / Sympathy) is a free selector the player may change **any time until the trial begins**, at which point it locks. It re-weights section contributions and beat draws; it never costs resources.
9. **Old saves must not break.** New fields default-spread on load. An in-flight old-style trial converts on load to a defense-seat `TrialState` (P4-C specifies the mapping); spent old defense actions convert to equivalent prep progress so no purchased strength is lost.
10. **Everything tunable lives in `BALANCE.secrets` and `BALANCE.trials`.** A magic number in engine/store code is a defect.

---

## 2. System overview (read once, then trust the chunks)

**Secrets.** A `Secret` is an inventory object: a typed piece of compromising knowledge (affair, impiety, embezzlement, electoral fraud, provincial plunder) about a named clan leader — or, symmetrically, about a member of *your* family — with a potency (1–3) and a class (`social` / `criminal`). The player acquires them by sending a **chosen family member** (picker shows each candidate's Intrigus and computed success %) to Gather Intelligence on a leader; failures accumulate "groundwork" that raises later odds, so persistence pays deterministically. The Quaestor's Audit a Rival now yields a criminal Secret directly on success. Hostile leaders run the same loop in reverse each season, with odds fed by your characters' corruption. A held Secret has three spends — **Leverage** (consume it to force one vote/abstention/canvass-lock), **Extort** (recurring Denarii with a per-season exposure risk), **Burn** (public scandal: the leader permanently loses half their votes, their clan turns hostile) — and criminal Secrets have a fourth destination: **evidence** in a prosecution. Secrets held *against* you have three counterplays — **Pay Off** (permanent, expensive), **Discredit** (an Intrigus operation that can backfire), and **Deterrence** (automatic freeze while you hold one on the holder). Exposure of a criminal family Secret feeds the trial pipeline ("they knew about Sicilia"); social exposure hits Dignitas and relationships.

**Trials.** One `TrialState` with two seats. It is created by: a hostile-clan accusation (the old trigger), corruption crossing the trial threshold (the old trigger), an NPC burning/prosecuting a criminal Secret on your family, or **the player filing a prosecution** (new — requires a criminal Secret on the target or target corruption ≥ threshold; the player picks a start delay of 2–4 seasons at filing). Between filing and trial day, **both sides prepare**: the player through the **Basilica** screen (three sections — **Logos**: Gather Evidence, Present a Secret as Evidence; **Pathos**: Secure Witnesses, Prepare Oration; **Ethos**: Invoke the Ancestors, Bribe Jurors, Bribe the Praetor — plus the free, adjustable Approach setting and a speaker picker), the NPC side through a per-season strength accrual scaled by their intrigue, wealth, and clan power. Filing early means a weak case against an unready opponent; filing late, a strong case against a fortified one — a real decision every time, and identical in reverse when you are the defendant (the old countdown *is* your prep window). **Jury lean** is computed from clan standings and faction alignment, so years of Forum diplomacy silently show up in court. On trial day an interactive **3-beat event** fires: complications drawn from a library by charge type, approach, opponent traits, and witness presence; the player answers each with choices keyed to stats and prep artifacts; total swing is clamped to the ±30% share; discovered bribes surface here as hostile beats. The verdict is a deterministic threshold on the final score differential, presented in a **full-screen verdict scene** (accusation → strength bars filling → verdict stamp), used for both seats. Winning a prosecution against a big target is the **Cicero moment**: Dignitas scaled by the target's standing, a Legacy milestone for convicting a sitting magistrate, and a line in the run's epilogue. Losing one is **calumnia**.

**The Claudius arc.** Ap. Claudius Pulcher's "holds blackmail on you" flag becomes a real potency-2 criminal Secret held against your family from game start (deterrence-frozen if the tutorial's counter-intelligence path succeeded). Early in year 2–3 he *uses* it — a leverage demand on a named bill — opening a scripted mini-arc where every escape route is one of the general system's verbs: comply, pay off, discredit, deter with a counter-Secret, or defy and face the game's first defensive trial through the full new pipeline, soft-tuned to be survivable. The tutorial's intel-gathering beat (`evt-tut-04`) is rewired to grant groundwork in the new system, so the guided start feeds the arc naturally.

---

## Chunk P4-A — The Secret: Model, Generation, State

**Goal:** `Secret` objects exist, are generated by the (rewired) Gather Intelligence and Audit a Rival actions with the family-member picker math, are held in two store collections (yours / against you), tick correctly at season end (groundwork, NPC gather rolls), and persist. No spend options, no counterplay, no new UI beyond the picker changes and DebugPanel visibility — those are P4-B. Compiles, tests green, game plays as before except that gathering intelligence now yields visible objects.

**Files to request:** `src/state/gameStore.ts`, `src/engine/turnSequencer.ts`, `src/models/clan.ts`, `src/data/startingClans.ts`, `src/components/forum/LeaderDetailPanel.tsx` (where Gather Intelligence lives), `src/data/offices.ts` + `src/engine/officeActionEngine.ts` (Audit a Rival), `src/models/character.ts` (corruption field), `src/state/saveLoad.ts`, `src/data/balance.ts`, `src/components/shared/DebugPanel.tsx`.

**Verify before coding:**
- How intel-gathered is currently stored (per-leader field vs `flags` key) and every consumer of it — including `evt-tut-04`'s special-case handler (leave that handler working; it is rewired in P4-G, but it must not crash in the interim; if it writes the old flag, keep the old flag as a shadow until P4-G).
- Exactly how Audit a Rival applies its 60% "gain blackmail" today (it may currently be flavor/flag only).
- Where character corruption lives and its numeric range.
- The Forum action-cost pattern (so Gather Intelligence keeps its cost/cooldown conventions).

**Files to create:** `src/models/secret.ts`, `src/engine/secretEngine.ts`, `src/data/secretDefinitions.ts`

**Files to modify:** `src/state/gameStore.ts`, `src/engine/turnSequencer.ts`, `src/data/balance.ts`, `src/state/saveLoad.ts`, `src/components/forum/LeaderDetailPanel.tsx`, `src/data/offices.ts` / `officeActionEngine.ts`, `DebugPanel.tsx`

### `src/models/secret.ts` — types (no logic)

| Type | Shape |
|---|---|
| `SecretType` | `'affair' \| 'impiety' \| 'embezzlement' \| 'electoral_fraud' \| 'provincial_plunder'` |
| `SecretClass` | `'social' \| 'criminal'` (affair, impiety → social; the rest → criminal). Derive via a lookup, don't store redundantly unless the Zod schema is simpler with it stored — implementer's call, note it. |
| `SecretHolder` | `'player' \| leaderId` |
| `SecretSubject` | `{ kind: 'leader'; leaderId } \| { kind: 'family'; characterId }` |
| `SecretStatus` | `'held' \| 'extorting' \| 'spent' \| 'exposed' \| 'neutralized'` |
| `Secret` | `{ id; type: SecretType; subject: SecretSubject; holder: SecretHolder; potency: 1 \| 2 \| 3; status: SecretStatus; acquiredSeason: number; flavorText: string }` |

Store shape: a single `secrets: Secret[]` on `GameState` (filter by `holder` for the two views) **or** two arrays — pick whichever the existing store conventions favor; one array is recommended (deterrence checks are a two-way scan). Add per-leader `intelGroundwork: number` (0–0.3) wherever leader-scoped scalars already live.

### `src/data/secretDefinitions.ts`

Per `SecretType`: display name, class, 4–6 flavor-text templates with `{leader}` / `{character}` slots (used at generation so every Secret reads as a specific scandal, not a category), an icon key, and the charge type it maps to for prosecutions (P4-C table). Provincial plunder should only generate against leaders/characters who have held a governorship or office — condition hook in the generator.

### `secretEngine.ts` — pure functions

| Function | Behavior |
|---|---|
| `gatherChance(agent, groundwork)` | `BALANCE.secrets.gatherBaseChance + agent.intrigus × gatherPerIntrigus + groundwork`, clamped to `gatherChanceCap`. This is the number the picker UI shows per family member. |
| `attemptGather(state, leaderId, agentId, roll)` | Success → generate a Secret (type weighted by leader bias/history; potency 1–3 weighted low), reset groundwork. Failure → groundwork `+= groundworkPerFailure` (cap). Returns new Secret or updated groundwork; store action applies it. |
| `npcGatherTick(state, rolls)` | Each leader with standing < `hostileStandingMax` rolls once per season per plan below; success generates a family-subject Secret held by that leader. Respect `maxHeldAgainstFamily`. |
| `generateSecret(...)` | Shared generator (type, potency, flavor interpolation). |

NPC gather chance per hostile leader per season: `npcGatherBase + npcGatherPerCorruption × (highest family corruption)`, capped `npcGatherCap`. Corruption is the fuel — a clean family is nearly un-blackmailable; a corrupt governor is a magnet. Zero UI notification yet (P4-B adds discovery/agenda surfacing); generated NPC-held Secrets sit latent this chunk.

### Rewiring the acquisition actions

- **Gather Intelligence (Forum):** now opens a small family-member picker (reuse the candidate-picker pattern from Cursus/Basilica conventions; a simple inline list is fine this chunk) showing each living adult family member's Intrigus and `gatherChance` as a percentage. Cost unchanged (`BALANCE.secrets.gatherCostFides`, seed 8). Resolves immediately via `attemptGather`.
- **Audit a Rival (Quaestor):** success (existing 60%, move the number to `BALANCE.secrets.auditRivalChance`) now yields a **criminal** Secret (embezzlement or electoral_fraud) on the audited leader, potency-weighted 1–2.

### `BALANCE.secrets` (seed values — first-pass)

| Key | Seed |
|---|---|
| `gatherCostFides` | 8 |
| `gatherBaseChance` / `gatherPerIntrigus` / `gatherChanceCap` | 0.25 / 0.06 / 0.90 |
| `groundworkPerFailure` / `groundworkCap` | 0.10 / 0.30 |
| `auditRivalChance` | 0.60 |
| `npcGatherBase` / `npcGatherPerCorruption` / `npcGatherCap` | 0.03 / 0.0015 / 0.15 |
| `hostileStandingMax` | 30 |
| `maxHeldAgainstFamily` | 3 |
| `potencyWeights` | [0.55, 0.35, 0.10] |

### Turn sequencer

One new step, `processSecretsSeason` (near the existing relationship/clan drift step): groundwork persistence (no decay v1), `npcGatherTick`. Ledger: no lines yet (latent by design).

### Tests

Picker math (chance per Intrigus level, groundwork accumulation and reset); generation respects type conditions and potency weights; NPC gather respects standing gate, corruption scaling, and the cap; save round-trips; old saves load with empty `secrets` and zero groundwork.

### Chunk P4-A — Done when

`npx tsc --noEmit` passes; Gather Intelligence uses the picker and can yield a visible Secret (DebugPanel lists all Secrets both directions); Audit a Rival yields criminal Secrets; hostile leaders accumulate latent Secrets on corrupt characters over debug-run seasons; nothing else about the game changes.

---

## Chunk P4-B — Spend, Counterplay, Symmetry & the Dossier

**Goal:** Every Secret verb works in both directions. Player: Leverage / Extort / Burn on held Secrets via a new **Dossier** panel in the Forum. NPC: leverage demands, extortion, and burns against your family, surfaced as events and agenda items, with exposure of criminal family Secrets queuing a trial (via the *existing* trial trigger this chunk; P4-C swaps the internals). Counterplay: Pay Off, Discredit, automatic Deterrence. Agenda generators #23–#25. Glossary entries.

**Files to request:** P4-A outputs, `src/engine/agendaEngine.ts` (catalog + numbering), `src/screens/ForumScreen.tsx` + `components/forum/*`, `src/engine/eventEngine.ts` + `injectNoticeEvent` helper, `src/engine/trialEngine.ts` (the current accusation-trigger entry point), `src/engine/aiScoring.ts` (NPC action-choice conventions), `src/models/ledger.ts`, `src/data/glossaryTerms.ts`, `src/engine/electionEngine.ts` (canvass-lock mechanism, for Leverage's forced vote).

**Verify before coding:** how canvass-locking marks a leader's election votes (Leverage-for-election reuses it exactly); how bill votes tally per leader (Leverage-for-bill forces that leader's vote/abstention on one named live bill — find the least invasive hook); the injected-event pattern for NPC demands (weight-0 event fired from the sequencer, per Phase 3's notices).

**Files to create:** `src/components/forum/DossierPanel.tsx`, `src/data/secretEvents.ts` (NPC demand/exposure/scandal event defs)

**Files to modify:** `secretEngine.ts`, `gameStore.ts`, `turnSequencer.ts`, `agendaEngine.ts`, `ForumScreen.tsx`, `LeaderDetailPanel.tsx` (per-leader secret indicators, held and held-against), `models/ledger.ts`, `glossaryTerms.ts`, `balance.ts`

### Player verbs (on a `held` Secret you hold)

| Verb | Effect | Notes |
|---|---|---|
| **Leverage** | Consume the Secret → force the leader's vote **for/against/abstain** on one named live bill, or canvass-lock their election votes for you | Free (the Secret is the price). UI: pick the Secret, pick the target context from live bills / your active campaign. |
| **Extort** | Status → `extorting`; +`extortIncomePerPotency × potency` Denarii/season; each season `extortExposureChance` roll → exposure: Secret spent, relationship → `extortExposureRelationship` (nosedive), and that leader immediately gains `extortRetaliationGroundwork` toward a counter-Secret on you | Stoppable any season (status back to `held`? **No** — once used, reverting is free money; on stop the Secret is `spent`. Note this in UI copy.) |
| **Burn** | Consume → public scandal event; leader permanently loses `burnVoteLossFraction` of votes; their whole clan → hostile floor | If the Secret is criminal, the UI also offers "file prosecution instead" once P4-C lands (stub the button disabled with a "the courts await" tooltip until then). |

### Counterplay (on a Secret held against your family)

Discovery: the player learns a Secret is held against them when the holder first *uses* it (demand event) — or earlier via successful Gather Intelligence on that holder (a gather success against a leader who holds one reveals it instead of/in addition to yielding one; implementer picks the cleaner rule and notes it — recommended: reveal *and* yield groundwork, not a full Secret, so counter-espionage feels distinct).

| Verb | Cost / math | Outcome |
|---|---|---|
| **Pay Off** | `payOffCostPerPotency × potency` Denarii | Secret `neutralized`, permanently. Expensive by design. |
| **Discredit** | `discreditCostFides`; agent picker (same as gather); chance `discreditBase + agent.intrigus × discreditPerIntrigus` | Success: `neutralized`. Failure: potency +1 (max 3) — the cover-up made it worse. |
| **Deterrence** | Automatic | While you hold ≥1 `held` Secret on leader L, all L-held family Secrets are frozen (no demands, extortion ticks, or burns), and vice versa. Dossier shows the standoff explicitly ("stayed by your hand on his own affairs"). |

### NPC behavior (in `secretEngine` decision functions, invoked from the sequencer; cadence + weights in `BALANCE.secrets.npcAi`)

A leader holding a usable (unfrozen) family Secret acts on a cooldown (`npcUseCooldownSeasons`, seed 4), choosing by disposition and situation: **Leverage** when a bill they care about is live or your campaign threatens them (demand event: comply → forced vote applied, Secret retained for `leverageReuseLimit` uses, seed 2; **defy** → immediate exposure: social = scandal event with `socialExposureDignitas` / clan-relation hits; criminal = they file/queue a trial); **Extort** (recurring demand, Denarii drain, same defy branch); **Burn** rarely, only at standing ≤ `npcBurnStandingMax` (seed 5) and if they hold nothing better. All demands arrive as injected events with explicit choices — invariant 5.

### Agenda + ledger + glossary

Generators (register in the catalog comment; Phase 3 ended at #22): **#23 Leverage/extortion demand pending** (critical — a demand event awaits an answer or a forced vote lands this season), **#24 Secret held against [character]** (warning; info if frozen by deterrence — "stalemate"), **#25 Extortion income/drain active** (info; shows the per-season number both directions). Ledger lines: extortion income, extortion payments, exposure scandals. Glossary: *Secret, Leverage, Extortion, Burn (scandal), Deterrence, Dossier, Groundwork*.

### Tests

Each verb's state transitions and math; deterrence freezes both directions and thaws when the freezing Secret is spent; NPC demand → comply and defy branches; criminal exposure queues a trial through the existing trigger; extortion exposure math; agenda generators fire and clear.

### Chunk P4-B — Done when

A debug run can: steal a Secret, leverage a bill vote, extort a leader until exposure blows up, burn a leader and watch his clan turn; get blackmailed by a corrupt-governor storyline in reverse, defy it into a trial, pay one off, discredit one (and fail one), and hold a deterrence standoff — all visible in the Dossier and the agenda.

---

## Chunk P4-C — One Pipeline, Two Seats: the Trial Rework

**Goal:** Replace the trial internals with the unified `TrialState`: prosecution filing (Secret- or corruption-gated, player-chosen start delay), opponent per-season prep growth, jury lean, deterministic verdict thresholds, calumnia, and conversion of all existing trial triggers (clan accusation, corruption threshold, P4-B criminal exposure) into the new pipeline. **No new UI this chunk**: the old trial panel keeps working by mapping its legacy defense actions onto the new prep model (they become a temporary flat list; the Basilica replaces it in P4-D). Filing a prosecution is exposed via the Dossier's criminal-Secret "file prosecution" button and a leader-detail button when corruption qualifies.

**Files to request:** `src/engine/trialEngine.ts`, `src/models/trial.ts`, `src/data/trialActions.ts`, `src/state/gameStore.ts` (trial actions section), `src/engine/turnSequencer.ts` (trial countdown/resolution step), whatever UI renders trials today (locate via sitemap/grep — likely in CursusScreen), `src/engine/electionEngine.ts` or wherever clan power is computed (opponent prep scaling), `saveLoad.ts`, `balance.ts`, P4-A/B outputs.

**Verify before coding:** every field of the current `Trial` and every consumer; how prosecutionStrength was seeded from clan power (reuse the formula as the NPC-side *initial* strength); how outcomes apply consequences (Exiled/Executed remove characters — keep exactly); whether any Phase 1 agenda generator (#1, trial pending) reads trial fields by name — update it to the new shape in this chunk, same numbering.

**Files to create:** `src/data/trialCharges.ts`

**Files to modify:** `models/trial.ts` (rework), `engine/trialEngine.ts` (rework), `data/trialActions.ts` → superseded by P4-D's `trialPrep.ts` but keep a legacy-mapping shim this chunk, `gameStore.ts`, `turnSequencer.ts`, `agendaEngine.ts` (#1 update + **#26 filed prosecution pending**), `saveLoad.ts`, `balance.ts`, Dossier/LeaderDetail (file buttons)

### `TrialState` (reworked `models/trial.ts`)

```
{ id; seat: 'defense' | 'prosecution';           // the PLAYER's seat
  charge: ChargeId; chargeSource: 'secret' | 'corruption' | 'accusation';
  prosecutor: { kind: 'player'; speakerId } | { kind: 'leader'; leaderId };
  defendant: { kind: 'family'; characterId } | { kind: 'leader'; leaderId };
  filedSeason; startsSeason;                     // startsSeason − filedSeason = prep window
  playerPrep: PrepRecord;                        // per-verb usage + accumulated strength by section
  approach: 'ferocity' | 'procedure' | 'sympathy';  // adjustable until startsSeason (invariant 8)
  speakerId;                                     // family member who argues; default paterfamilias
  npcStrength: number;                           // grows per season
  juryLean: number;                              // recomputed each season from clan standings/factions
  consumedSecretIds: string[]; status: 'preparing' | 'in_session' | 'resolved'; outcome?: TrialOutcome }
```

### `trialCharges.ts`

| ChargeId | Roman name | Fed by | Notes |
|---|---|---|---|
| `repetundae` | De repetundis | provincial_plunder secret, corruption path | The Verres charge; governors' bane |
| `peculatus` | Peculatus | embezzlement secret | |
| `ambitus` | De ambitu | electoral_fraud secret | |
| `maiestas` | Perduellio | accusation-only (clan-sourced treason) | Severest outcome table |

Each entry: display name, accusation-text template, outcome-severity table reference, beat-pool tags (consumed in P4-E).

### Filing, delay, and opponent growth

- **File Prosecution** (cost `fileCostFides`, seed 15): requires a criminal Secret on the target (consumed into `consumedSecretIds` as base evidence, granting `secretEvidenceBase × potency` initial strength) **or** target corruption ≥ `corruptionChargeThreshold` (seed 60; grants a smaller `corruptionEvidenceBase`). Player picks `startsSeason` = filed + 2..4 (`startDelayBand`). NPC-initiated trials use delay 3.
- **Opponent prep/season:** `npcPrepBase + npcPrepPerIntrigue × intrigue + npcPrepClanFactor × clanPower`, with a wealthy-trait multiplier if traits expose one. Runs for NPC defendant *and* NPC prosecutor alike. This is the file-early-vs-late tension — surface the opponent's strength as an **estimate band** (±20%, narrowed to exact if you hold a Secret on them or Local-Support-style intel applies; implementer picks the cleanest existing intel signal and notes it).
- **Jury lean:** `Σ over clans of (standing − 50) × juryLeanPerStanding × clanVoteWeight`, clamped ±`juryLeanCap` (seed ±10), recomputed each season, applied to the player's side of the differential.

### Verdict math (deterministic — invariant 2)

`finalPlayer = playerPrepScore × prepShare + performance` (performance from P4-E, 0 this chunk / fast-resolve EV), `finalNpc = npcStrength × prepShare + npcPerformance`. `differential = (finalPlayer − finalNpc) + juryLean` from the player's seat. Thresholds (per charge's severity table, seeds in `BALANCE.trials.verdictThresholds`) map differential bands → the five outcomes for the *defendant*; when the player prosecutes, the same bands read from the other side, and a losing player-prosecution (differential below `calumniaThreshold`) triggers **calumnia**: `calumniaDignitas` (seed −15), target-clan relations `calumniaClanRelations` (seed −25), and `counterSuitChance` (seed 0.35) that the target files against your speaker within 2 seasons. Until P4-E, resolution uses prep-only (performance = both sides' EV = 0) so the game stays playable each chunk.

### Save migration

An in-flight legacy trial converts to: `seat: 'defense'`, charge mapped from its `TrialCharge`, `npcStrength = prosecutionStrength`, `playerPrep` seeded so total strength equals accumulated `defenseStrength`, `startsSeason` = legacy resolution season, approach `procedure`, speaker = paterfamilias. Purchased strength is never lost (invariant 9).

### Tests

Filing gates (secret path, corruption path, neither → blocked); delay band respected; opponent growth math incl. estimate band; jury lean; verdict thresholds hit all five outcomes both seats; calumnia consequences + counter-suit; legacy-trial conversion preserves strength; corruption/accusation/exposure triggers all create the new shape.

### Chunk P4-C — Done when

All four trial origins create `TrialState`; the player can file and win/lose a prosecution numerically (prep via legacy-mapped actions, verdict prep-only); calumnia bites; defense trials play as before but on the new engine; agenda #1/#26 reflect the new shape; old saves convert cleanly.

---

## Chunk P4-D — The Basilica (Preparation Screen)

**Goal:** The full prep experience: a full-screen sheet in the **Cursus tab** (opened from any active trial's card and from agenda deep-links) with three collapsible sections — **Logos / Pathos / Ethos** — the Approach selector, the speaker picker, both strength bars (yours exact, theirs the estimate band), seasons-until-trial, and the prep-verb catalog below replacing the legacy action list entirely. **Not a sixth tab.**

**Files to request:** P4-C outputs, `src/screens/CursusScreen.tsx`, `components/cursus/ElectionPanel.tsx` (visual conventions), `ScrollModal.tsx` / `ParchmentCard.tsx` / `StatBar.tsx` / `InfoTap.tsx`, `utils/theme.ts`, `data/trialActions.ts` (to fold in asset-gated legacy actions), `assetEngine.ts` (asset ownership checks), `balance.ts`.

**Verify before coding:** the full-screen-sheet pattern used by `ProvinceSheet`/`LatiumSheet` (reuse it); how asset gating is checked today for `intimidate_witness`; End Season warning integration point (a trial starting next season with prep below opponent estimate must warn — extend agenda #24/#1 severity rather than new plumbing).

**Files to create:** `src/components/cursus/BasilicaSheet.tsx`, `src/data/trialPrep.ts` (the catalog; delete/absorb `trialActions.ts`)

**Files to modify:** `CursusScreen.tsx`, `gameStore.ts` (prep actions), `glossaryTerms.ts` (*Basilica, Logos, Pathos, Ethos, Calumnia, Quaestio, Approach*), `balance.ts`

### The prep catalog (`trialPrep.ts`; costs/values in `BALANCE.trials.prep`)

| Section | Verb | Cost (seed) | Effect (seed) | Rules |
|---|---|---|---|---|
| **Logos** | Gather Evidence | Fides `8 + 4×uses` | +`6 + agent.intrigus` strength | Repeatable, cap 5 uses; agent picker (Intrigus shown, same pattern as P4-A) |
| **Logos** | Present a Secret as Evidence | consumes a criminal Secret on the opponent | +`12 × potency` | Only matching/compatible charge types (mapping in `secretDefinitions`) |
| **Pathos** | Secure Witness | 20 Denarii | +8, creates a named `Witness` object | 2 slots; witnesses are attackable at trial (P4-E) — named via existing name pools |
| **Pathos** | Prepare Oration | 8 Fides | +`4 + speaker.rhetoric` | Repeatable, cap 3; re-runs if the speaker changes? No — uses are speaker-agnostic, value locks at purchase (simplest; note in UI) |
| **Ethos** | Invoke the Ancestors | free, one-time | +`floor(lifetimeDignitas / 25)`, cap +12 | Lead the section with this — bribery reads as its corrupt shadow |
| **Ethos** | Bribe Jurors | 30 Denarii per clan bloc | +6 per bloc | Per-clan; each carries `juryBribeDiscovery` (0.15) rolled at trial start → discovered bribes become hostile beats (P4-E) and void their bonus |
| **Ethos** | Bribe the Praetor | 80 Denarii, one-time | +15 | `praetorBribeDiscovery` 0.25, same discovery pipeline, worse beat |
| **Pathos** (legacy) | Intimidate Witness | as legacy | opponent −strength / removes one opponent witness | Asset-gated (Gladiator School) — port the legacy gate verbatim |

**Approach selector** (free, adjustable until `startsSeason` — invariant 8): **Ferocity** (Logos ×1.2, Ethos ×0.9; draws aggressive beats; small bonus vs low-Rhetoric opponents), **Procedure** (Logos ×1.1, halves the chance of opponent *surprise* beats), **Sympathy** (Pathos ×1.25, Logos ×0.9; doubles juryLean's weight). Multipliers apply at verdict computation, so switching re-previews live in the bars.

All resource spends go through normal wallet checks — there is **no separate trial action budget**; a trial crowding out your other ambitions through the wallet is the intended drama.

### Chunk P4-D — Done when

A trial (either seat) is prepared end-to-end in the Basilica; bars/estimate band/season countdown live-update; approach switching re-previews and locks at trial start; asset gating works; the legacy trial action UI is gone; a below-estimate case at T-1 season triggers the End Season warning.

---

## Chunk P4-E — Trial Day: the Beat Engine

**Goal:** On `startsSeason`, the trial enters session as a **3-beat interactive sequence** plus the fast-resolve path, producing the clamped performance score that completes P4-C's verdict math.

**Files to request:** P4-C/D outputs, `EventModal.tsx`/`EventCard.tsx` (presentation conventions — beats render through a dedicated but visually kindred UI, **not** through `EventDef`), `eventEngine.ts` (skill-check roll conventions, reuse the roll math), `data/traits.ts` (opponent trait hooks), `balance.ts`.

**Verify before coding:** the skill-check success formula used by events (beat responses reuse it exactly, no second RNG idiom); how the sequencer pauses for modal sequences (Phase 3's succession sequence established the pattern — reuse).

**Files to create:** `src/engine/trialBeatEngine.ts`, `src/data/trialBeats.ts`, `src/components/cursus/TrialSessionModal.tsx`

**Files to modify:** `trialEngine.ts` (session state machine), `gameStore.ts`, `turnSequencer.ts` (session trigger), `balance.ts`

### Beat model & draw

A `TrialBeat` (own shape in `trialBeats.ts`, ~co-designed with the event card's look): `{ id; tags: (ChargeId | approach | 'surprise' | 'witness_attack' | 'bribe_discovered' | trait-tags)[]; complication: string; responses: BeatResponse[] }` where `BeatResponse = { label; kind: 'stat' (rhetoric|intrigus roll, reuse event check math) | 'prep' (requires a prep artifact: a witness, a consumed Secret, evidence uses ≥ n) | 'plain'; swing: { success; failure } }`.

**Draw rules (pure, in `trialBeatEngine`):** exactly `beatsPerTrial` (seed 3). Slot 1 always charge-tagged; slot 2 from approach + opponent-trait pool; slot 3 from the general pool — **preempted** by mandatory beats: each discovered bribe forces its `bribe_discovered` beat (worst case: bribes eat your beats *and* their bonuses — the anti-bribery risk made legible); an opponent with a surviving witness-attack option forces `witness_attack` against a named witness of yours (a `prep`-kind response using your other prep can save the witness). No beat repeats within a trial; the library ships ≥ 5 beats per tag pool (~24–30 beats total, written to the event guide's prose standard, forensic register).

**Swing clamp (invariant 1):** per-beat swing `±beatSwingMax` (seed 10); total performance clamped to `±performanceCap` (seed 30) = the 30% share on a 100-point prep scale. NPC performance = `npcPerformanceEV` (seed 0) ± a trait nudge, also clamped.

**Fast-resolve** ("Let [speaker] argue it", available at session start and between beats): auto-answers remaining beats by expected value given stats/prep — **neutral EV** (invariant 7). One tap, straight to verdict.

### Tests

Draw determinism given a seeded RNG (tags, mandatory preemption, no repeats); clamp enforcement; prep-kind responses correctly check artifacts; fast-resolve EV equals the analytic expectation; the session pauses/resumes the sequencer like succession does.

### Chunk P4-E — Done when

Trial day plays 3 authored beats with meaningful, stat- and prep-keyed choices; discovered bribes and witness attacks preempt correctly; fast-resolve works from any point; the performance score feeds the deterministic verdict; both seats play.

---

## Chunk P4-F — The Verdict Scene & the Cicero Rewards

**Goal:** The full-screen verdict presentation (the roadmap's original Phase 4 item 2) and the prosecution reward/record layer.

**Files to request:** P4-E outputs, `SeasonOverlay.tsx` (full-screen overlay conventions), Phase 3's `EpilogueScreen.tsx` + `epilogueText.ts` + `AncestorRecord` (for the historians'-paragraph hook), `legacyDefinitions.ts`, `theme.ts`.

**Files to create:** `src/components/cursus/VerdictScene.tsx`

**Files to modify:** `trialEngine.ts` (reward math), `legacyDefinitions.ts` (milestone), `epilogueText.ts` + `AncestorRecord` (famous-trials slot), `models/ledger.ts` (verdict line), `gameStore.ts`, `balance.ts`

### The scene

Sequence: charge card (accusation text from `trialCharges` template, defendant portrait) → both strength bars **fill in real time** to their final values (jury lean shown as a nudge on the marker) → beat one-line recaps stamp in → the **verdict stamp** (per-outcome Latin: *ABSOLVO / CONDEMNO* etc.) with a themed slam animation → consequence summary card. Used identically for both seats. This is the game's screenshot; spend the polish here — parchment, wax-seal stamp, restrained motion. No choices inside the scene.

### Rewards & records

- **Prosecution victory:** `prosecutionWinDignitasBase (10) + target's Senate votes`, `+sittingMagistrateBonus (10)` if the target holds office; the convicted leader suffers the charge's outcome (vote loss / removal per severity — reuse burn/exposure consequence code where identical); Legacy milestone **"Accusator"** (first conviction) and **"Vox Populi"** (convict a sitting magistrate — the Cicero moment).
- **Defense victory** at the Dismissed tier: a small *vindicated* beat (+`vindicatedDignitas`, seed 5).
- Every resolved trial appends a compact record (charge, seats, outcome, year) to run stats; the epilogue's historians' paragraph gains a famous-trial sentence slot; `AncestorRecord` gains an optional `famousTrial` field (default-spread — Phase 3 Hall records without it must still render).

### Chunk P4-F — Done when

Every trial resolution routes through the scene both seats; rewards, milestones, ledger lines, and the epilogue/Hall hooks land; a Hall record from Phase 3 still renders.

---

## Chunk P4-G — The Claudian Arc, Tutorial Rewiring & Docs

**Goal:** Ap. Claudius Pulcher's narrative blackmail becomes the system's authored opening: a real starting Secret, a scripted leverage demand, every counterplay live as an escape route, and defiance flowing into the player's first defensive trial through the full pipeline. Tutorial `evt-tut-04` rewired. Documentation updated.

**Files to request:** all prior chunk outputs as needed, `data/tutorialEvents.ts` + the tut-04 special-case store handler, `data/startingClans.ts`, `data/startingFamily.ts`, `startDefinitions.ts` (guided vs free start), `billTemplates.ts` (a suitable named bill for the demand), `eventEngine.ts`.

**Verify before coding:** exactly what `evt-tut-04`'s handler writes today; which bills are reliably live in years 2–3 (pick or lightly script one — an auto-injected or high-weight bill — as the demand's target; do not add a bespoke bill unless nothing fits); that the arc's gating can't collide with the Mamertine ignition or succession sequences (queue priority per Phase 3's conventions).

**Files to create:** `src/data/claudiusArc.ts` (or a clearly-fenced section of `secretEvents.ts` — implementer's call, note it)

**Files to modify:** `startingClans.ts`/`gameStore.ts` init (the starting Secret), `tutorialEvents.ts` + handler, `agendaEngine.ts` (arc surfaces through #23/#24 — no new generator), `glossaryTerms.ts`, `balance.ts` (`BALANCE.secrets.claudius` — demand season window, soft-tuned trial numbers)

### The arc (write to the event guide; briefs, not final copy)

1. **Init:** a potency-2 **embezzlement** Secret (`subject: family/paterfamilias`, "a certain irregularity in your father's accounts", `holder: Claudius`) exists from game start. It obeys every general rule — including deterrence: if the player took tut-04's counter-espionage path and later completes a gather on Claudius, the standoff freezes it, which **is** a valid, complete resolution of the arc.
2. **`evt-claud-01` — the demand** (condition-gated: year 2–3, post-tutorial-completion flag, Secret still unfrozen/held, no higher-priority sequence active): Claudius names his price — your Senate vote on the named bill. Choices: *Comply* (forced vote; he retains the Secret — one reuse per the general limit, so this can recur once), *Play for time* (defers one season, `claudiusPatience` counter; at 0 he treats it as defiance), *Defy him* (→ scene 2).
3. **`evt-claud-02` — defiance:** he files `peculatus` against the paterfamilias through the standard pipeline, `npcStrength` seeded from `BALANCE.secrets.claudius.trialSeed` — deliberately **soft-tuned**: a player who does 3–4 prep actions should comfortably reach Acquitted+; an idle player risks Fined, not Exiled. This is the tutorialized trial the whole phase points at.
4. **Ambient outs**, all standard verbs, no bespoke code: Pay Off (Philon notice acknowledging the ledger's wound), Discredit (success closes the arc with a scene of Claudius's discomfiture; failure escalates potency per the general rule), Deterrence (scene: two men smiling at a banquet, each holding the other's ruin).
5. **Rewire `evt-tut-04`:** its investigate choice now grants `intelGroundwork` on Claudius = `groundworkCap` (0.30) — a strong head start toward the counter-Secret, teaching the gather loop. Remove the legacy flag write once nothing consumes it (grep first).

### Documentation updates (after all chunks)

`game-manual.md`: new **Secrets & the Dossier** section under Forum (gather with the family picker, the three spends, the three counterplays, deterrence, symmetry — "your corruption is their ammunition"); **rewrite the Trials section** under Cursus (the Basilica, Logos/Pathos/Ethos, approach, filing prosecutions, opponent preparation and the file-early-vs-late tension, jury lean, trial day beats + fast-resolve, calumnia, the verdict scene); update Quaestor's Audit a Rival and the Gather Intelligence row; add *calumnia* and the Cicero framing to Key Strategic Principles ("the courts are a ladder — and a cliff"). Refresh `SITEMAP.md`: new files (`models/secret.ts`, `engine/secretEngine.ts`, `engine/trialBeatEngine.ts`, `data/secretDefinitions.ts`, `data/secretEvents.ts`, `data/trialCharges.ts`, `data/trialPrep.ts`, `data/trialBeats.ts`, `data/claudiusArc.ts`, `components/forum/DossierPanel.tsx`, `components/cursus/BasilicaSheet.tsx`, `components/cursus/TrialSessionModal.tsx`, `components/cursus/VerdictScene.tsx`), removed `trialActions.ts`, new sequencer steps, agenda #23–#26.

### Chunk P4-G — Done when

A guided-start run meets the threat in year 1, receives the demand in year 2–3, and can resolve the arc via **each** of: compliance, pay-off, discredit, deterrence, and defiance-into-a-winnable-first-trial; the tutorial path feeds the arc; the manual and sitemap are current.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched in every chunk — additive, in chunk order: `secrets` + groundwork + gather actions (A), verb/counterplay actions + demand responses (B), `TrialState` rework + filing/prep actions (C), Basilica prep actions + approach/speaker setters (D), session/beat actions (E), verdict consumption + records (F), Claudius init + tut-04 handler change (G). Keep actions thin wrappers over pure engine functions.
- **`turnSequencer.ts`** gains: `processSecretsSeason` (A: groundwork/NPC gather; B: extortion ticks, exposure rolls, NPC demand scheduling, deterrence checks — one step, grown in place) and the trial-side changes (C: opponent prep growth + jury-lean recompute inside the existing trial step; E: session trigger). Document exact step indices; do not add a third secrets-adjacent step.
- **Agenda numbering:** Phase 2 used #15/#16/#19, military reserves #17/#18, Phase 3 used #20–#22. Phase 4 uses **#23 (demand pending), #24 (secret held against family / standoff), #25 (extortion active), #26 (filed prosecution status)** and updates #1's field reads. Register all in the catalog comment.
- **The trial-day beats are NOT `EventDef`s.** They have their own shape and renderer so the event schema stays frozen (event-guide invariant). Only the *arc* content (P4-G) and demand/scandal/notice events (P4-B) are real events. Reuse the event skill-check roll math for beat responses — one RNG idiom.
- **Consequence-code reuse:** burn, criminal exposure, and prosecution-conviction all end in "a leader loses votes / a character suffers an outcome" — route them through shared functions in `secretEngine`/`trialEngine`, not three copies.
- **New effect tokens:** likely needed — grant-secret and groundwork tokens for event effects (P4-B/G). Add at most those two; log them where the earlier phases logged token changes. Everything else routes through store special-case handlers only if the token budget would otherwise grow.
- **Balance discipline:** every tunable lives in `BALANCE.secrets` / `BALANCE.trials` (with `prep`, `verdictThresholds`, `npcAi`, `claudius` sub-groups). Record final numbers in a tuning note per chunk.
- **Old saves:** A/B (empty collections, zero groundwork — default-spread), C (legacy trial conversion — the only real migration; specified there), F (`AncestorRecord.famousTrial` optional), G (the starting Secret is injected on load for saves that predate it **only if** no Claudius flag was already resolved — check the legacy flag before injecting).
- **Do not build in Phase 4:** hireable named advocates (v1: the speaker is a family member — dynasty hook, zero new UI); exile as a playable state (Exiled keeps its current consequence); multi-defendant trials; NPC-vs-NPC secrets/prosecutions visible to the player; secret trading/selling; the Phase 5 items (event-count pass, alt families, difficulty presets, store prep).

## Phase 4 — Done when (integration criteria)

1. Secrets flow both directions end-to-end: a chosen family member (Intrigus-odds visible) steals them; leverage, extortion (with blow-ups), and burns work on NPCs; NPC demands against you are always defiable choices; pay-off, discredit, and automatic deterrence all function; corruption demonstrably drives how blackmailable your family is.
2. All four trial origins produce one `TrialState`; the player can prosecute (Secret- or corruption-gated, delay chosen at filing) and defend through the same Basilica, with the opponent's case visibly growing each season and jury lean reflecting Forum standing.
3. Preparation drives ~70% and trial day at most ±30% of every verdict; no verdict ever resolves on a roll; the fast-resolve path is one tap and EV-neutral.
4. Losing a prosecution costs real Dignitas and relations and risks a counter-suit; convicting a sitting magistrate awards the Cicero milestone and enters the run's epilogue paragraph.
5. Every trial ends in the full-screen verdict scene — the game's shareable moment.
6. The Claudius arc plays from tutorial threat to any of its five resolutions using only the general system's verbs, and a defied Claudius delivers a winnable, fully-piped first defensive trial.
7. Pre-Phase-4 saves load, convert any in-flight trial without losing purchased strength, and play on.
