# Rome: Res Publica — Phase 5 Implementation Plan: Content & Release

## 0. How to use this document

This plan specifies **Phase 5 of the design roadmap** (`rome-design-review-and-plan.md`, Part 3): the **event pass** that brings the random pool to ~80–120 curated, season- and state-weighted events; the **two unlockable alternate starting families**; a light **cross-run achievements** system (reserved for this phase by Phase 3's persistence invariant); **three difficulty presets**; the **telemetry-driven balance pass** across the whole finished game; and **premium hygiene** (offline audit, autosave verification, OS-level backup + the existing export/import as the save-safety story, zero timers, zero IAP).

Three scope decisions were made in design review (2026-07) and are baked in — do not re-litigate them:

1. **Achievements are IN.** The roadmap's Phase 5 list omits them, but Phase 3's invariant 7 explicitly reserved "(Phase 5's) achievements" as the third cross-run persistence item alongside Hall records and the Endless flag. This plan builds them (P5-F).
2. **Cloud save is NOT built as a service.** "Cloud save if feasible" resolves to: OS-level backup (Android Auto Backup config; iOS device backup, which covers AsyncStorage by default) plus the existing manual JSON export/import, surfaced and documented honestly in Settings (P5-I). No accounts, no sync backend, no new native modules.
3. **Store positioning (roadmap item 5) is CUT from this plan entirely.** No store listing copy, no screenshot tooling, no marketing assets. The plan ends at a release-ready build; store submission is handled outside the implementation chats.

It is written in the style of `rome-phase1-implementation-plan.md` through `rome-phase4-implementation-plan.md` — but **adapted for a Claude Code chat with direct repository access**: instead of requesting files from the user, you read them yourself.

**You are expected to implement ONE chunk per chat session.** When the user says "implement chunk P5-C of the Phase 5 plan", your workflow is:

1. **Read this entire document** (at minimum §0, §1, §2, the chunk itself, its dependencies' "Done when" criteria, and §Cross-Chunk Notes).
2. **Read the files** listed in the chunk's *Files to read* line directly from the repo, plus anything they import that you need. `SITEMAP.md` at the repo root is the orientation map. Do not guess at file contents you have not opened.
3. **Run the chunk's *Verify* list** against the actual code. If anything doesn't match this plan's assumptions — a missing field, a different function signature, an earlier chunk apparently not implemented — **stop and ask before writing code.** Also flag any ambiguity you find in the spec itself.
4. Implement the chunk. Engines are pure functions (no store access); UI contains no game logic; all tunable numbers go in `BALANCE` (never inline literals); content/data lives in `src/data/`.
5. Run `npx tsc --noEmit` and the test suite. Fix what you broke.
6. **Commit the chunk as one commit (or PR)** whose message is a short changelog: files touched, deviations from this plan (with reasons), any `BALANCE` values added or adjusted, and — for content chunks — the list of event ids added.

### Baseline assumption

Phases 0, 1, 2, 3, and 4 are fully implemented. This plan builds on, without re-deriving:

- Four-track `crisis` + `crisisEngine.ts`; `flags: Record<string, boolean | number>` on `GameState`.
- The **agenda engine** (generators through **#26**, per Phase 4) + `AgendaTablet`/`AgendaBadge`; the **Season Ledger**; autosave; the guided start and tutorial queue; the `injectNoticeEvent` helper and the branching multi-scene event pattern.
- `src/data/balance.ts` — the `BALANCE` registry. **Every tunable number in this plan goes here.**
- Phase 2's **telemetry**: `SeasonStats`, `seasonStatsHistory` (ring buffer, cap 40), `actionsThisSeason` and the meaningful-action counter list, and the DebugPanel **Pace** section. Phase 5's balance pass runs on this instrumentation.
- Phase 3's **war** (`models/war.ts`, `warEngine.ts`, the 264→241 arc, five terminal outcomes), **Epilogue screen**, **`AncestorRecord` / Hall of Ancestors** (dedicated cross-run AsyncStorage key, `ancestorStore.ts`), **succession/regency**, **cadet branch**, **Endless mode**.
- Phase 4's **Secrets** (both directions, groundwork, deterrence), the **unified trial pipeline** (Basilica, beats, verdict scene, prosecution filing, calumnia), the **Claudius arc**, and the trial-record layer (compact per-trial records in run stats; `AncestorRecord.famousTrial`).
- The **military overhaul** (`rome-military-implementation-plan.md`) is assumed **not built**. Verify at P5-A; if it has been built in the interim, the only touchpoints are noted in §Cross-Chunk Notes.

If any of these are absent, **stop and reconcile** before proceeding.

### Ground rules for the implementing chat

- Before writing anything in a chunk, read the files it names — especially `src/state/gameStore.ts`, `src/engine/turnSequencer.ts` (verify the current step list — Phases 0–4 have grown it), `src/data/balance.ts`, and for content chunks `rome-event-writing-guide.md` **as refreshed by P5-A** (the pre-P5-A guide has stale token/condition tables).
- **Verify, don't assume:** the canonical effect-token vocabulary (grep the effect parser in `resourceEngine.ts` — Phases 0–4 added tokens beyond the guide's table); the canonical `EventCondition` union (Phases 3–4 likely added condition types beyond the guide's list — grep `models/event.ts` + `eventEngine.ts`); which data files feed the once-per-season random draw vs. scripted queues; the current event count; how the gens/family surname is stored and everywhere it is displayed.
- Engines pure, UI logic-free, content in `src/data/`, **no new spendable resources** (valid: `fides`, `denarii`, `imperium`, `lifetimeDignitas`).
- Event content follows `rome-event-writing-guide.md` exactly (schema, tone, length, effect budgets, checklist). Where this plan gives full copy, use it verbatim; where it gives a brief, write to the guide.
- Philon's voice (dry, precise, "Domine") narrates agenda/ledger/notice strings. Philon serves the *household*, whichever gens holds it — P5-E makes him gens-agnostic.

### Chunk order

**P5-A → P5-B → P5-C → P5-D → P5-E → P5-F → P5-G → P5-H → P5-I.** Each chunk ends with a compiling, playable, testable build. Dependencies:

- **P5-A** (audit, tooling, guide refresh, dead-code cleanup) gates **all** content chunks — B, C, and D write against A's refreshed guide and audit report.
- **P5-B / P5-C / P5-D** (the three event batches) are independent of each other and may be reordered; D additionally needs Phase 4's verdict/burn moments confirmed (it adds two tiny flag writes there).
- **P5-E** (alternate families), **P5-F** (achievements), **P5-G** (difficulty presets) are independent of the event batches and of each other; all three need only the Phase 0–4 baseline (+ A's cleanup). E and G both touch the new-game flow — implement in the listed order to avoid merge friction.
- **P5-H** (balance pass) comes after **B, C, D** (content shifts the economy) and **G** (presets must exist to be validated). 
- **P5-I** (premium hygiene, release QA, docs) is last.

---

## 1. Design invariants (apply to every chunk)

1. **Content rides existing rails.** The event batches use **only** the existing `EventDef` schema, the existing condition types, and the existing effect tokens. **Zero new effect tokens and zero new condition types this phase.** If an event brief cannot be expressed, the fix is a *flag* (the sanctioned mechanism — P5-D adds two small store flag-writes for exactly this) or a rewritten brief — never a schema change. An event that needs a new token is the wrong event.
2. **The pool stays curated.** Every new event passes the guide's full quality checklist, is force-fired in debug before merge, and carries a weight chosen against the audit's distribution table so no theme floods a season. The 80–120 target is a *ceiling as much as a floor* — do not pad.
3. **Meta persists trophies, never power.** Achievements grant nothing mechanical. Alternate families are *sidegrades* — different starts, not better ones. No meta-currency, no power creep (Phase 3 invariant 7 extended).
4. **Difficulty touches exactly two knob families:** income margins and crisis escalation rates (design review 2.9). Presets never hide, add, or remove mechanics, and every preset **displays its multipliers** to the player. A third knob family is a design change — stop and report.
5. **Alternate families are data, not mechanics.** Any `if (gensId === …)` in engine code is a defect. Family identity lives in start definitions, starting data, and (for achievements) meta predicates only.
6. **Balance changes are `BALANCE`-only.** P5-H adjusts constants; structural findings are written up and stopped on, never hot-fixed.
7. **Old saves must not break, and cross-run keys are sacred.** New fields default-spread on load (`difficulty` → `'aequus'`, `gensId` → `'brutii'`, `AncestorRecord.difficulty` → `'aequus'`). The Hall key and the new achievements key are **never** cleared by starting, finishing, or deleting a save.
8. **Zero network at runtime, zero timers, zero IAP — audited, not assumed.** P5-I proves it (dependency audit + airplane-mode run), it isn't just asserted.
9. **Gens-name neutrality.** After P5-E, no hardcoded "Brutus / Brutia / Brutii" survives outside the Brutii start definition and the guided-start tutorial content. The epilogue's historian paragraph, agenda strings, glossary, and notices all interpolate the run's gens.
10. **The three watch-numbers govern P5-H:** median minutes per season 3–6; meaningful actions 3–4 early / 4–6 mid / 5–8 late; seasons to the first "oh no" moment ≤ 8. Ship numbers, not vibes — the tuning log records the evidence.

---

## 2. System overview (read once, then trust the chunks)

**The event pass (A + B + C + D).** P5-A first establishes ground truth: how many events exist per pool, per season, per domain, per condition family; what the *real* token and condition vocabularies are after four phases of growth; and it refreshes the event-writing guide so the batches are written against reality, not a stale contract. It also builds the two QA tools the rest of the phase leans on (a Debug event browser with force-fire-by-id, and an auto-season runner) and clears the sitemap's known dead code. Then three authored batches land ~45–55 new events (exact delta set by the audit so the pool finishes inside 80–120): **B** gives the Roman year its texture (seasonal festivals and rhythms, domestic life, the aggregated client-favor event); **C** makes Rome *react* (crisis-track thresholds, Rome-stat extremes, office-gated scenes, standing-reactive beats); **D** plays the long game (post-trial and post-scandal aftermath keyed to Phase 4 flags, generational events, Endless-mode ambience, and two or three multi-scene showpiece chains).

**The meta layer (E + F).** Two unlockable starting families — **Gens Duilia** (new-money plebeian merchants: rich, undignified, connected to nobody) and **Gens Manlia** (disgraced patricians: capable, resented, *blackmailable* — an elevated starting corruption that the Phase 4 secrets symmetry converts into pressure) — selectable on the free start, unlocked by Hall of Ancestors records (any completed run → Duilia; a Victory → Manlia). And ~18 cross-run **achievements** ("Laurels"), persisted beside the Hall, awarded by a pure evaluator at season end and at epilogue, displayed in the Hall, celebrated by a small non-blocking toast. Trophies only.

**Difficulty (G).** Three presets — **Clemens / Aequus / Ferox** — chosen at new game, fixed for the run, recorded on the `AncestorRecord`. Each is a pair of multiplier sets in `BALANCE.difficulty` applied at exactly two seams: resource income calculation and crisis-track escalation input. The picker shows the numbers.

**The balance pass (H).** With all content and systems in, the Phase 2 telemetry plus P5-A's auto-season runner drive a whole-game tuning pass against the three watch-numbers, the Phase 2 stage bands and election summit curve, Phase 3's war pacing, Phase 4's 70/30 trial split, and a measurable spread between the three presets. `BALANCE`-only; results recorded in a tuning log appendix.

**Premium hygiene (I).** Prove offline (dependency + grep audit, airplane-mode run), verify autosave-every-season plus save-on-background, configure Android Auto Backup to cover the saves, verify export/import round-trips a full post-Phase-4 save, add save versioning with fixture-based migration tests, write the player-facing "Your saves" Settings copy, and bring `game-manual.md` and `SITEMAP.md` fully current. The build that exits P5-I is the release candidate.

---

## Chunk P5-A — Audit, Tooling, Guide Refresh & Repo Hygiene

**Goal:** Ground truth established and published; the QA tools exist; the event-writing guide tells the truth again; the sitemap's dead code is gone. **No gameplay change.**

**Files to read:** `SITEMAP.md`, `src/data/events.ts`, `src/data/provinceEvents.ts`, `src/data/campaignEvents.ts`, `src/data/canvassingEvents.ts`, `src/data/tutorialEvents.ts`, Phase 3/4 content files (`warEvents.ts`, `successionEvents.ts`, `cadetEvents.ts`, `secretEvents.ts`, `claudiusArc.ts` — names per the phase plans; confirm), `src/models/event.ts`, `src/engine/eventEngine.ts`, `src/engine/resourceEngine.ts` (the effect-string parser), `src/components/shared/DebugPanel.tsx`, `src/engine/turnSequencer.ts`, `rome-event-writing-guide.md`, and the four dead-code files flagged at the top of `SITEMAP.md`.

**Verify before coding:**
- Which pools feed the once-per-season random draw vs. scripted queues (`eventEngine` eligibility + `turnSequencer`'s event step). The 80–120 target counts **the random-draw pool only**; scripted/queued content (tutorial, succession, cadet, war script, Claudius arc, notices, trial beats) is excluded. Write the counting rule down in the audit report.
- Whether the design review's §2.8 client-call-in trim (per-client rolls → one aggregate ≤1/year event) was ever implemented in Phases 1–2. Record the finding — it decides one brief in P5-B.
- Whether the military overhaul was built (grep `src/engine/battle/`). Record the finding for later chunks.
- Whether `DebugPanel` already has force-fire (sitemap says "force-trigger events") and exactly what it can and cannot target.
- The full set of `imageKey` values that actually resolve to assets (grep the image lookup), so batch briefs only use real keys.

**Files to create:** `docs/content-audit.md`, `scripts/eventAudit.ts` (small node/ts-node script)

**Files to modify:** `rome-event-writing-guide.md`, `src/components/shared/DebugPanel.tsx`, `src/state/gameStore.ts` (only if the auto-season runner needs a thin store action), plus the dead-code deletions

### A1. The audit script and report

`scripts/eventAudit.ts` imports the event pools and prints: total per pool; random-pool counts by season condition (incl. unconditioned), by office gate, by other condition families, by weight band; a histogram of effect magnitudes per token (sum + mean of resource deltas across all choices, success-weighted where a skill check exists — a crude but sufficient economy fingerprint for P5-H). `docs/content-audit.md` captures the output plus hand-written analysis: the **gap matrix** (season × domain, marking thin cells), the counting rule, the current total vs. the 80–120 target, and the **recommended per-batch delta** for B/C/D (default assumption in this plan: ~45–55 new events total; the audit adjusts and its number wins).

### A2. Guide refresh (the contract for B–D)

Update `rome-event-writing-guide.md` in place: §2.4's `EventCondition` union replaced by the real one from `models/event.ts`; §6.1's token table replaced by the real parser vocabulary (grep, don't recall — Phases 0–4 added tokens and migrated resource names; the guide still shows `gold` and `crisis±N`); §6.3's magnitude table sanity-checked against `BALANCE` reality; a new short §11 "Era discipline" (see P5-B's anachronism note — festivals and institutions must exist in 264–241 BC). Mark the refresh with a dated revision note at the top.

### A3. Tooling

1. **Event browser:** DebugPanel gains a searchable list of every event id across all pools with a "force fire" button per row (routing through the real presentation path, conditions bypassed, so writers can proof any event in one tap). If force-fire exists, extend it to full coverage; don't build a second mechanism.
2. **Auto-season runner:** a DebugPanel action "Run N seasons idle" — ends seasons with **no player actions**, auto-answering any fired event with its **first guaranteed (no-skill-check) choice** for determinism, letting `seasonStatsHistory` and the crisis/economy state accumulate. This is P5-H's drift instrument and B–D's weight-sanity instrument. If `processSeason` cannot run without UI pauses (succession/trial sequences), auto-acknowledge through their default paths and note any sequence that cannot be auto-driven.

### A4. Dead-code cleanup (sitemap's flagged orphans)

Delete `src/screens/WelcomeBackModal.tsx` and `src/components/shared/PatronLadderPanel.tsx` (byte-identical/older orphans). **Diff before acting** on `src/components/shared/DiplomatDesk.tsx` and `PolicyBoard.tsx` vs. their live `components/provinciae/` counterparts: the shared copies are *newer* (InfoTap wiring) — port the InfoTap wiring into the live versions, then delete the shared copies. Update `SITEMAP.md`'s dead-code block.

### Tests

The audit script runs clean and its counts match a hand-check of at least one pool; the event browser can fire an event from every pool; the auto-season runner completes 20 seasons from a fresh start without a crash or a stuck modal; `tsc` clean; all tests pass; gameplay unchanged.

### Chunk P5-A — Done when

`docs/content-audit.md` exists with the gap matrix and per-batch deltas; the guide's schema/token/condition sections match the code; both debug tools work; the four orphans are resolved; nothing about gameplay changed.

---

## Chunk P5-B — Event Batch I: The Roman Year

**Goal:** Seasonal and domestic texture — the pool's "life goes on" layer. Target **~16–20 events** (audit's number wins), all single-scene or shallow-branch (guide patterns A–C), weighted mid-low so they colour seasons without dominating them.

**Files to read:** `docs/content-audit.md`, the refreshed `rome-event-writing-guide.md`, `src/data/events.ts` (format conventions + existing ids to avoid collisions/duplication), `src/models/event.ts`, `src/data/clientNames.ts` and `src/data/startingClans.ts` (name pools for incidental characters), `BALANCE` (magnitude sanity).

**Verify before coding:** the audit's finding on the client-call-in trim (below); which existing events already cover a brief (skip or replace, don't duplicate — replacing a weak existing event counts toward the target).

**Files to modify:** `src/data/events.ts` only (plus the audit report's running count).

### Briefs (write to the guide; ids `evt-yr-*` / `evt-dom-*`; adjust counts to the audit)

**Seasonal (~3 per season, gated `{ type: 'season', index: n }`):**
- **Spring (0):** the census-taker's visit (declare wealth honestly / understate it — intrigus check, denarii vs. flag risk); the **Parilia** festival (sponsor the neighbourhood rites / abstain); a spring flood on the Tiber threatening a family or client property.
- **Summer (1):** civic summer only — the campaign season's *military* face belongs to Phase 3's war events; here: the city empties and rivals' absence is opportunity; a heatwave and the water queue (plebs mood); the **Consualia** races invitation.
- **Autumn (2):** the vintage on a family or client estate (harvest windfall vs. labour dispute); grain-price anxiety before winter (treasury/plebs); the **Ludi Romani** — a seat-of-honour slight from a rival clan (rhetoric-check social duel).
- **Winter (3):** **Saturnalia** in the domus (the household's inverted day — generous / restrained, a Philon cameo is permitted here and only here); a client's hearth burnt out (help with denarii / send men / regret); pre-election whispering in the cold Forum porticoes.

**Era discipline (add to the guide as §11 if P5-A hasn't already):** the run is 264–241 BC. Safe anchors: Parilia, Lemuria, Consualia, Ludi Romani, Meditrinalia, Saturnalia, Compitalia, Lupercalia. **Do not use** Ludi Apollinares (212 BC), Megalesia (204), Floralia as *ludi* (c. 240/238 — borderline; avoid). No Greek-style theatre buildings, no denarius-coin references in prose (the *denarius* is a game abstraction — fine as UI, avoid minting it in fiction), no Hannibal.

**Domestic (~5–6, unconditioned or lightly gated):** a tutor for the children (denarii → a child's skill point via the existing training/effect route — verify a token exists; if not, the reward is flavor + fides, per invariant 1); a freedman's petition to trade under the family name; an illness scare in the household (non-lethal — mortality belongs to the aging engine); friction between the heir and a younger sibling (flag-based Pattern D follow-up next year); a marriage feeler *from* a minor family (below clan level — colour, not the Domus marriage system); the paterfamilias's old friend fallen on hard times.

**The aggregate client-favor event (conditional brief):** **if** P5-A found per-client call-in rolls still live, do **not** build the aggregate here — flag it to the user as an un-implemented §2.8 trim decision and skip (a store/engine change is out of a content batch's scope). **If** the trim was done (or call-ins are already rare), add one yearly-weighted "the clients come calling" omnibus event (3 choices: hear them all / delegate to the heir — teaches delegation / turn them away) gated `hasClient`.

### Batch rules (apply to B, C, and D)

- Every event passes the guide's §9 checklist; every event is force-fired via the P5-A browser and screenshotted mentally against the card layout (no overflow on a phone).
- Weight discipline: seasonal flavor 3–5, domestic 4–6, nothing above the audit's median weight without a stated reason in the commit message.
- Effect budgets per guide §6.3; the batch's **net expected resource value should be roughly neutral** (windfalls balanced by costs) — run `scripts/eventAudit.ts` before/after and record the delta in the commit.
- Run 8 auto-seasons (2 game years) twice and confirm the season flavour reads distinctly (Phase 1's criterion, extended).

### Chunk P5-B — Done when

The batch is merged at the audit's target count, every event force-fires cleanly, the audit script shows the pool's seasonal gap cells filled and near-neutral net EV, and two auto-played debug years feel seasonally distinct.

---

## Chunk P5-C — Event Batch II: The Republic Reacts

**Goal:** State-reactive Rome — events that make the simulation's dials *legible as fiction*. Target **~16–20 events**, mostly guide patterns A–B, gated on crisis tracks, Rome stats, offices, and standing.

**Files to read:** batch-B's merged `events.ts`, `src/models/crisis.ts` + `crisisEngine.ts` (track tier thresholds and how events can condition on them — **verify the real condition type**; the legacy `crisisLevel` resource condition may or may not still exist post-four-track split; the audit's condition list is authoritative), `src/data/offices.ts` (office ids for gates), `src/data/warEvents.ts` (to avoid duplicating Phase 3's scripted war beats), `reputationThresholds.ts` / patron-tier state (for standing gates — verify what conditions can express).

**Verify before coding:** exactly which crisis/standing states are expressible with existing condition types. **Where a brief below cannot be expressed, drop or re-gate it** (invariant 1) — do not add condition types. List any dropped briefs in the commit message.

**Files to modify:** `src/data/events.ts` only.

### Briefs (ids `evt-cri-*` / `evt-off-*` / `evt-rep-*`)

**Crisis-track-reactive (~2 per track, firing at elevated tiers):**
- **Unrest:** a bread queue turns ugly outside a family property (martial presence / denarii dole / stay away); a demagogue names your family from the Rostra (rhetoric answer / dignified silence / intrigus smear).
- **Economy:** a moneylender's collapse catches a client's debts; contractors abandon a public works site (aedile-flavoured if the office gate is available on top of the track gate).
- **Constitution:** a tribune's veto standoff paralyzes the courts (side with the tribune / the consuls / broker — fides plays); rumours of an extra-legal command.
- **War (civic face only — never duplicating `warEvents.ts` script beats):** war-widows' petition at your door; refugee families from the theatre seeking a patron; a war-profiteer offers a distasteful partnership.

**Rome-stat-reactive (~3):** plebs very low (a night of broken shop-shutters on the Vicus); treasury very low (the Senate floats a property levy — patriotic pay / lobby out / evade via intrigus); stability very high (complacency — a chance to quietly bank goodwill while nobody is watching).

**Office-gated (~4–5, driven by the audit's thinnest offices):** one working-day scene per under-covered office — e.g. the quaestor finds an account that doesn't balance (a whisper of someone *else's* peculatus — pure flavor here; Phase 4's systems already own real secrets, so the payoff is fides/dignitas, not a Secret object, per invariant 1); the aedile's market-weights fraud case; the praetor's impossible docket day; the tribune's doorstep supplicants at dawn; the consul's levy-day no-shows.

**Standing-reactive (~3):** high tier — parasites and flatterers at the morning salutatio (a CK3-audience wink, with a real cost/benefit); low fides — a creditor of *social* debts calls one in; a "new man" seeks your sponsorship (small fides bet with a delayed Pattern-D repayment either way).

### Chunk P5-C — Done when

The batch is merged at target count with every brief either implemented or explicitly dropped-with-reason; force-firing each track/stat event from a matching debug state reads coherently; the gap matrix's reactive cells are filled; net EV near-neutral.

---

## Chunk P5-D — Event Batch III: Consequences & the Long Game

**Goal:** The pool's memory — aftermath events keyed to Phase 4's dramas, generational texture, Endless-mode ambience, and 2–3 multi-scene showpieces. Target **~12–16 events**. This is the only content chunk that touches the store (two tiny flag writes).

**Files to read:** batches B/C merged, Phase 4's `trialEngine.ts` + verdict-consumption store code and `secretEngine.ts` burn-resolution code (to place the flag writes), `data/secretEvents.ts` (avoid duplication), Phase 3's succession/cadet events (tone reference for generational content), the Endless-mode flag (`endlessMode` per Phase 3 P3-F).

**Verify before coding:** what flags Phase 4 already sets at verdict/burn/exposure (grep `setFlag`/flag writes around those resolutions — the Claudius arc set some; generic ones may not exist); that `endlessMode` is condition-reachable via the existing flag condition (it's a store boolean, not a flag — **if** no condition can read it, mirror it into `flags` at Endless entry as a one-line store addition and note it).

**Files to modify:** `src/data/events.ts`; `src/state/gameStore.ts` and/or `trialEngine.ts`/`secretEngine.ts` consequence code (flag writes only); `src/data/glossaryTerms.ts` (only if a showpiece coins a term).

### D1. The two flag writes (the chunk's only non-content code)

At generic verdict consumption: set `trial-resolved-defense-won: true` / `trial-resolved-defense-lost: true` / `trial-resolved-prosecution-won: true` (whichever applies; booleans in `flags`). At burn resolution: `secret-burned-recently: true`. Follow the guide's flag hygiene: **every aftermath event's terminal choices clear the flag they consumed.** Keep the writes inside the existing consequence functions (shared per Phase 4's consequence-reuse note), not in UI.

### D2. Briefs (ids `evt-aft-*` / `evt-gen-*` / `evt-end-*`)

**Aftermath (~5, flag-gated, weight 3–5 so they land within a few seasons):** vindication's afterglow (defense won — well-wishers, and one man whose congratulations are a threat); the convicted clan's cold shoulder spreads (prosecution won — a third-party clan leader tests whether you'll do it again); a defense *lost* — the family's ordinary business gets harder for a season (choices about how to carry it publicly); after a burn — the scandal's collateral (someone adjacent to the ruined leader, innocent, at your door); the Forum's appetite for gossip turns toward *you* (post-burn, intrigus deflection).

**Generational (~4, condition on what's expressible — age/flag; where a "second-generation paterfamilias" state has no condition, gate on flags the succession sequence sets — verify):** the new paterfamilias measured against the old (a client says the wrong thing); the dowager's counsel (the widow of the last paterfamilias as a recurring named voice — one event, one Pattern-D follow-up); brothers' rivalry over the family's direction; the ancestor masks (imagines) — a quiet Winter beat that pays a small dignitas dividend for a family with ≥2 generations of Hall-worthy deeds (expressible via lifetimeDignitas threshold if nothing better).

**Endless-mode ambience (~3, gated on the endless condition per Verify):** veterans of the great war on every corner (what does Rome owe them); "what now?" — the Senate without its uniting enemy (constitution-track flavoured); a young hothead proposes new adventures abroad (a knowing nod toward the sequel, **no** Second Punic War content — invariant, and roadmap cut list).

**Showpieces (2–3 chains, guide Pattern E, 3–4 scenes, the batch's centrepieces):** e.g. *The Sibyl's Price* — a religious controversy that escalates from a household omen to a Senate floor question across three seasons (flags between scenes, one skill branch, one guaranteed exit at every scene); *The Grain Fleet* — an autumn shortage → a syndicate offer → a springtime reckoning (economy-track entangled). Write these last, at full quality; they are what reviewers quote.

### Chunk P5-D — Done when

Aftermath events demonstrably fire after a debug-driven verdict and burn and clear their flags; generational and Endless events fire in matching debug states; the showpiece chains play end-to-end via force-fire with correct flag hygiene; the random pool's total now lands **inside 80–120** (audit script re-run recorded in the commit).

---

## Chunk P5-E — The Alternate Starting Families

**Goal:** Two unlockable free-start families — **Gens Duilia** and **Gens Manlia** — as pure data sidegrades, unlocked by Hall records, selectable from the start menu with locked-state visibility; and the **gens-name-neutrality sweep** that makes the whole game stop assuming Brutii.

**Files to read:** `src/data/startDefinitions.ts` + `models/gameStart.ts` (guided vs free start shape), `src/data/startingFamily.ts` (the Brutii data shape to mirror exactly), `src/screens/StartMenuScreen.tsx` (or wherever new-game flows live — verify), `src/state/ancestorStore.ts` (reading Hall records for unlock checks), `src/data/epilogueText.ts` (historian templates — verify gens interpolation), `src/data/tutorialEvents.ts` (Brutii-specific copy stays guided-start-only), `src/data/startingClans.ts` (starting relationship shape), `src/data/assetDefinitions.ts` (assets for Duilia's start), Phase 4's starting-Secret init (the Claudius arc applies to **all** families — verify its init is start-agnostic), `src/state/saveLoad.ts`.

**Verify before coding:**
- How the family/gens display name is derived everywhere (a constant? `startingFamily` surname? per-character surnames?). Design the `gensId`/`gensName` state addition around what exists.
- Whether **any** mechanic branches on patrician/plebeian class (grep offices for eligibility gates — the Tribune historically plebeian-only; if such a gate exists in data, both new families must be internally consistent with it; if none exists, class is flavor only — note which).
- That `assembleHistorianParagraph` and the `AncestorRecord` carry the gens name from state (Phase 3 specified "gens name" in the record — confirm the *templates* interpolate it rather than hardcoding "Gens Brutia").
- That the Claudius starting Secret's flavor text ("a certain irregularity in your father's accounts") is family-agnostic and its init path runs for any start.

**Files to create:** `src/data/altFamilies.ts` (the two family data sets, mirroring `startingFamily.ts`'s shape; or fold into a keyed `startingFamilies.ts` refactor — implementer's call, note it)

**Files to modify:** `startDefinitions.ts`, `startingFamily.ts` consumers / `gameStore.ts` init (`gensId` + name plumbing), `StartMenuScreen.tsx` (family cards + locked states), `epilogueText.ts` (interpolation fixes if needed), `saveLoad.ts` (default-spread `gensId: 'brutii'`), `glossaryTerms.ts`, `balance.ts` (`BALANCE.altFamilies` — the starting-number deltas), plus every file the neutrality sweep touches.

### E1. The two families (data design — tune numbers into `BALANCE.altFamilies`)

| | **Gens Duilia** — "Nova Pecunia" | **Gens Manlia** — "The Disgraced" |
|---|---|---|
| Fantasy | Buy your way into a Republic that sneers at you | Claw back a name the Forum still whispers about |
| Class | Plebeian (historical: the Duilii; C. Duilius wins Mylae in this very war — a nice resonance, do not script it) | Patrician (historical: the Manlii and their *Imperiosus* reputation) |
| Paterfamilias | Gaius Duilius, ~38 — modest rhetoric, good intrigus, poor martial | Titus Manlius, ~45 — strong rhetoric and martial (the compensation) |
| Resources | Denarii ≈ ×3 Brutii start; lifetimeDignitas ≈ ×0.5; fides start slightly low | Denarii low; fides low; lifetimeDignitas moderate |
| Assets/clients | +2 starting assets from existing `assetDefinitions` (commerce-flavoured) | Baseline |
| Clan relations | All four clans start cool (~below default anchor) — nobody knows them | Two clans markedly hostile, one neutral, one sympathetic (pick from the four with historical plausibility; note the choice) |
| The hook | None mechanical — the money **is** the hook (Munificence path) | Paterfamilias starts with **elevated corruption** (value in `BALANCE.altFamilies.manliaCorruption`) — Phase 4's symmetric secret-generation converts disgrace into ongoing blackmail pressure, with zero new mechanics |
| Family spread | Spouse + 2 children + a high-intrigus brother | Spouse + adult heir + a daughter; smaller, older |
| Unlock | **Any** Hall of Ancestors record exists | A Hall record with outcome **`victory`** exists |

Both are **free-start only**; the guided/tutorial start remains Brutii (its copy is authored). Both get one Philon-voiced opening notice (he serves the household, not the gens — one adaptive line: "A new house, Domine, but ledgers are ledgers."). **No family-exclusive events, mechanics, offices, or engine branches** (invariant 5). Sidegrade discipline: if playtesting in P5-H shows either family strictly dominating Brutii, adjust `BALANCE.altFamilies` numbers, not systems.

### E2. Start menu & unlock UX

Family cards on the free start: Brutii always available; Duilia/Manlia shown **locked with their unlock condition in plain text** (never hidden — the whole game's no-hidden-mechanics ethos). Unlock state computed live from `ancestorStore` records — no separate unlock flag to migrate or lose. A dev override in DebugPanel.

### E3. The gens-neutrality sweep

Grep `Brutus|Brutia|Brutii` across `src/`. Legal survivors: `startingFamily.ts`/`startDefinitions.ts` (the Brutii data), `tutorialEvents.ts` and guided-start copy, historical flavor inside authored *Brutii-start* content, tests/fixtures. Everything else — historian templates, agenda/ledger/notice strings, glossary entries, epilogue framing, Hall list rendering — must interpolate `gensName`. Fix each; list the fixed sites in the commit.

### Tests

Unlock predicates against fabricated Hall records (none / dark-only / victory); both families boot, play 4 auto-seasons, and save/load; `gensId` default-spreads on an old save; the Claudius Secret exists at start for all three families; the historian paragraph renders each gens name; the neutrality grep comes back clean (assert it in a test if cheap).

### Chunk P5-E — Done when

A player with one completed run sees Duilia unlocked (and Manlia locked with its condition shown), starts a Duilia run, plays into year 2 with correct name rendering everywhere including a debug-forced epilogue; Manlia's corruption pressure demonstrably produces NPC secret-gathering attention in debug; old saves load as Brutii.

---

## Chunk P5-F — Achievements ("Laurels")

**Goal:** ~18 cross-run trophies persisted beside the Hall of Ancestors, awarded by a pure evaluator at season end and at epilogue, shown in the Hall, celebrated by a small non-blocking toast. **Nothing mechanical is granted** (invariant 3).

**Files to read:** `src/state/ancestorStore.ts` (cross-run persistence pattern + key discipline), `src/screens/HallOfAncestorsScreen.tsx`, `src/engine/turnSequencer.ts` (where a cheap end-of-season check slots), the epilogue write path (P3-E), Phase 4's trial-record layer and legacy milestones (`legacyDefinitions.ts`, "Accusator"/"Vox Populi"), `models/ledger.ts`, `theme.ts`.

**Verify before coding:** exactly which run facts are already queryable from `GameState`/run stats/`AncestorRecord` (trial records, war outcome, munificence acts, tier, generations, triumph flags, Endless entry, cadet use) — the achievement list below must be detectable from **existing** state; where one isn't, prefer re-specifying the achievement over adding counters (at most **2** new run-stat counters allowed; justify each).

**Files to create:** `src/models/achievement.ts`, `src/data/achievementDefinitions.ts`, `src/engine/achievementEngine.ts` (pure), `src/state/achievementStore.ts` (dedicated cross-run AsyncStorage key, sibling to the Hall key — same never-cleared discipline), `src/components/shared/AchievementToast.tsx`

**Files to modify:** `turnSequencer.ts` (one check call), the epilogue write path (second check call), `HallOfAncestorsScreen.tsx` (Laurels section), `models/ledger.ts` (an "earned laurels" line), `glossaryTerms.ts`, `App.tsx` (toast mount), `balance.ts` (only if any predicate threshold is tunable)

### F1. Model & engine

`AchievementDef = { id; name; latin: string; description (the exact condition, in plain words — all conditions visible, no hidden trophies); icon key }`. `evaluateAchievements(state, alreadyEarned: Set<id>, epilogueRecord?: AncestorRecord): id[]` — pure, returns newly earned only. Two call sites: end-of-season (cheap predicates on `GameState`) and epilogue-write (outcome predicates on the record). Earned set persists in `achievementStore` with earn dates; awarding is idempotent.

### F2. The list (seed set — adjust names freely, keep the *detection source* column honest against Verify findings)

| id | Laurel | Condition | Detected from |
|---|---|---|---|
| `primus-honos` | Primus Honos | Win any election | office history / election result |
| `consul-gentis` | Consul Gentis | A family member wins the consulship | office history |
| `triumphator` | Triumphator | Celebrate a triumph | triumph flag/record (Phase 0) |
| `patronus-maximus` | Patronus Maximus | Reach Patron Tier 5 | tier state |
| `accusator` | Accusator | Win a prosecution | trial records (mirrors legacy milestone) |
| `vox-populi` | Vox Populi | Convict a sitting magistrate | trial records (the Cicero moment) |
| `absolvo` | Absolvo | Win a defense at Dismissed | trial records |
| `flamma` | Flamma | Burn a Secret | secrets state/flag |
| `araneus` | Araneus | Hold 3 Secrets simultaneously | secrets collection |
| `munificus` | Munificus | Stage the Grand Games | munificence record (Phase 2) |
| `midas` | Midas | 2000 lifetime Denarii | legacy tracker |
| `gens-perennis` | Gens Perennis | Third paterfamilias generation in one run | generations count |
| `ramus-minor` | Ramus Minor | Continue through the cadet branch | `cadetBranchUsed` |
| `victoria-punica` | Victoria Punica | Victory over Carthage | epilogue outcome |
| `pax-fessa` | Pax Fessa | Peace of Exhaustion | epilogue outcome |
| `roma-humilis` | Roma Humilis | Endure Rome Humbled | epilogue outcome |
| `sine-fine` | Sine Fine | Enter Endless mode | `endlessMode` |
| `novus-homo` | Novus Homo | Win the consulship playing Gens Duilia | office history + `gensId` (meta predicate, not an engine branch — invariant 5 intact) |

Dark-ending runs earn their outcome laurels too (the Hall celebrates *told* endings — Phase 3 invariant 3 extended). If Verify shows any row undetectable within the 2-counter budget, cut or respec that row and log it.

### F3. Presentation

`AchievementToast`: a small laurel banner, top of screen, non-blocking, auto-dismiss ~3s, queued if several land at once; **never** interrupts an event/sequence modal (defer until the modal closes). Hall of Ancestors gains a **Laurels** section: full grid, earned in gold with date, unearned greyed **with condition text shown**. One ledger line the season a laurel lands. No Philon voice here — laurels are the game speaking, one register above the fiction.

### Tests

Evaluator returns each seed laurel from a fabricated matching state and never re-returns earned ones; epilogue-time laurels award on record write; the store key survives an active-save reset; toast queue ordering; old installs (no key) initialize empty.

### Chunk P5-F — Done when

Debug-driving the relevant states earns each laurel exactly once with a toast; the Hall lists earned and unearned with conditions; laurels survive save reset and new runs; nothing mechanical changed.

---

## Chunk P5-G — Difficulty Presets

**Goal:** Three presets — **Clemens / Aequus / Ferox** — chosen at new game, fixed for the run, applied at exactly two seams, displayed with their numbers, recorded in the Hall.

**Files to read:** `src/engine/resourceEngine.ts` (`calcResourceIncome` — the income seam), `src/engine/crisisEngine.ts` (the per-season track-escalation input — the crisis seam; verify the single function through which per-season track deltas flow, per Phase 0/3's structure), the new-game flow (`StartMenuScreen`/`startDefinitions`), `models/epilogue.ts` (`AncestorRecord`), `saveLoad.ts`, `balance.ts`, `glossaryTerms.ts`.

**Verify before coding:** that income and crisis escalation each have **one** pure choke-point to multiply at (if either is computed in several places, stop and report — consolidating is a small refactor this chunk may do *if* it's mechanical, but say so); how Endless mode's optional escalation term (P3-F) composes with a crisis multiplier (they should stack multiplicatively; note the order).

**Files to create:** none (a `DifficultyId` type slots into `models/gameStart.ts` or `models/resources.ts` — implementer's call)

**Files to modify:** `balance.ts` (`BALANCE.difficulty`), `resourceEngine.ts` + `crisisEngine.ts` (one multiplier read each), `gameStore.ts` (`difficulty: DifficultyId`), the new-game flow (picker step), `models/epilogue.ts` + `epilogueEngine.ts` + `HallOfAncestorsScreen.tsx` (record + badge), `saveLoad.ts` (default-spread), `glossaryTerms.ts`, `DebugPanel.tsx` (dev-only mid-run override)

### Spec

- `BALANCE.difficulty = { clemens: { incomeMult: 1.15, crisisMult: 0.85 }, aequus: { incomeMult: 1, crisisMult: 1 }, ferox: { incomeMult: 0.9, crisisMult: 1.2 } }` — seeds; P5-H tunes. `incomeMult` applies to computed Fides **and** Denarii season income (not to action costs, event effects, or one-off grants — margins, not prices); `crisisMult` applies to each track's per-season escalation *input* (not to event-driven crisis effects — the player's dramatic beats stay at authored magnitude). Exactly these two seams (invariant 4).
- **Picker:** a step in the new-game flow after family selection. Three cards, each showing name, one-line fiction ("Clemens — the Fates are kind"), and **the literal numbers** ("Income ×1.15 · Crisis pressure ×0.85"). Default highlighted: Aequus.
- **Fixed for the run** — a deliberate design call (honest Hall records, no mid-run bail-out lever); the DebugPanel override exists for testing only. If the user wants mid-run switching later, it's a Settings addition, not a redesign.
- `AncestorRecord.difficulty` (default-spread `'aequus'` for old records) + a small badge on Hall rows and the epilogue's scored block. **No score multiplier** — difficulty contextualizes the record, it does not inflate Legacy (that would be meta-power adjacent; invariant 3's spirit).
- Old saves: `difficulty` defaults `'aequus'`. Guided start: locked to Aequus (the tutorial's numbers are authored against it) — show the step greyed with a note, or skip it; note the choice.

### Tests

Multipliers applied at both seams and nowhere else (income snapshot ×3 presets; N auto-seasons of crisis drift ×3 presets shows monotonic ordering); event-driven crisis/resource effects identical across presets; record carries difficulty; old-save default; Endless escalation stacks as documented.

### Chunk P5-G — Done when

A new run can be started at each preset with the numbers shown at selection; Ferox demonstrably drifts hotter and pays leaner than Clemens over 12 auto-seasons; the epilogue and Hall show the badge; nothing but the two seams changed.

---

## Chunk P5-H — The Balance Pass (telemetry-driven, `BALANCE`-only)

**Goal:** The finished game tuned as a whole: the three watch-numbers hit, the Phase 2 stage bands and election summits re-validated after ~50 new events entered the economy, Phase 3's war pacing and Phase 4's trial split confirmed intact, and the three presets proven meaningfully distinct. **Constants only** (invariant 6).

**Files to read:** `balance.ts` (whole registry), `docs/content-audit.md` + a re-run of `scripts/eventAudit.ts` (post-batch net EV), DebugPanel's Pace panel + auto-season runner, the Phase 2 plan's E3/E4 tables and any existing `## Tuning log` appendices (Phase 2 / military), Phase 3's ripeness constants, Phase 4's `BALANCE.trials` / `BALANCE.secrets.claudius`.

**Verify before coding:** the auto-season runner still completes long runs post-E/F/G (families, laurels, difficulty in the loop); the Pace panel reads correctly.

**Files to modify:** `balance.ts` (numbers), event `weight`s in data files if distribution correction is needed, and a `## Tuning log` appendix appended to **this plan file**.

### Targets & method (dashboard first, then numbers)

| # | Target | Evidence method |
|---|---|---|
| 1 | Minutes/season median 3–6 (hand-played), never >8 at any stage | Pace panel over ≥12 hand-played seasons sampled early/mid/late (debug-state jumps allowed) |
| 2 | Meaningful actions 3–4 early / 4–6 mid / 5–8 late | Pace panel, same sessions |
| 3 | First "oh no" (trial, blackmail demand, lost election, crisis spike) ≤ 8 seasons on a fresh guided start | 3 fresh guided runs; the Claudius arc + tutorial should guarantee this — if not, adjust arc window constants |
| 4 | Election summit curve holds (Phase 2 E3 table) post-content | Re-run the election sim harness if Phase 2 built one; else logged debug runs, ≥10 per office band |
| 5 | Event economy near-neutral | `eventAudit` EV fingerprint pre/post Phase 5 within ±10%; correct outlier events' magnitudes/weights |
| 6 | War: each of the three outcomes reachable; resolution demonstrably harder early, easier near 241 (Phase 3 criterion re-checked at Aequus) | Auto-season + targeted debug pushes |
| 7 | Trials: 70/30 clamp intact; Claudius trial still "3–4 prep actions → comfortably Acquitted+" at every preset (Clemens' extra income must not trivialize it — if it does, that is *accepted* leniency; record it, don't add a trial knob) | Debug trial runs ×3 presets |
| 8 | Preset spread: over 12 auto-seasons from identical seeds, Ferox median aggregate crisis ≥ ~15 points above Clemens, and season income visibly leaner | Auto-season runner ×3, seeds fixed |
| 9 | Alt families are sidegrades: 12 auto-seasons per family lands within a sane band of Brutii on fides/dignitas trajectory (denarii may diverge by design) | Auto-season ×3 families |

**Levers, in order:** event weights/magnitudes (this phase's own content first) → munificence cooldowns/slots → small-action cooldowns → income constants → tier multipliers → preset multipliers. Structural findings (a system, not a number, is wrong) are written up in the tuning log and **stopped on** — the user decides.

### Chunk P5-H — Done when

Every target row has recorded evidence in the tuning log with final `BALANCE` values and a 10-line narrative of what moved and why; `tsc` and tests green; no engine/store logic changed.

---

## Chunk P5-I — Premium Hygiene, Release QA & Documentation (last)

**Goal:** The premium promises proven — offline, autosaving, backed-up, timer-free, IAP-free — plus save-versioning with migration tests, the player-facing save-safety story in Settings, and the manual/sitemap brought fully current. The build exiting this chunk is the release candidate.

**Files to read:** `package.json` (dependency audit), `app.json` / `eas.json`, `src/state/saveLoad.ts` (Zod schema, export/import), the autosave call sites (Phase 1), `App.tsx` (AppState handling, if any), `SettingsModal.tsx`, `proxy.mjs` (confirm dev-only), `SITEMAP.md`, `game-manual.md`.

**Verify before coding:**
- Grep `fetch(|axios|XMLHttpRequest|WebSocket` and audit dependencies for anything network- or IAP-touching (`expo-in-app-purchases`, analytics SDKs — Phase 2's telemetry was specified local-only; confirm it stayed that way).
- When autosave actually fires (every season end? on app background?) and whether an in-progress modal sequence (succession, trial day) can be lost to a process kill.
- What the current save schema versioning looks like (a version field may or may not exist).

**Files to create:** `__tests__/fixtures/` sample saves (see I3), `docs/release-checklist.md` (QA-only — no store/marketing content; that scope is cut)

**Files to modify:** `app.json` (Android Auto Backup config), `saveLoad.ts` (version stamp + normalisation consolidation), `App.tsx` (save-on-background if missing), `SettingsModal.tsx` ("Your saves" section), `game-manual.md`, `SITEMAP.md`, `glossaryTerms.ts`

### I1. The premium audit (prove, don't assert)

Offline: zero runtime network calls (dev tooling exempt); a full session — new game, 4 seasons, an event, a save/load — performed in airplane mode on a device/emulator. Zero timers: no wall-clock gating anywhere (grep `Date.now` uses for gameplay gating vs. legitimate telemetry/timestamps — classify each hit). Zero IAP: no purchase modules, no store SKU references. Findings tabled in `docs/release-checklist.md`.

### I2. Save safety (the "cloud save" resolution)

- **Autosave:** confirm every-season autosave; add **save-on-background** (AppState → background triggers a save) if absent — the burst player's phone-pocketing moment is the risk window.
- **Android Auto Backup:** enable via `app.json` expo config (`android.allowBackup: true` + backup rules including the AsyncStorage store; verify how Expo's AsyncStorage lands on disk for the backup rules). Document the limitation honestly (OS-scheduled, Google-account-dependent).
- **iOS:** AsyncStorage rides device backups by default — verify nothing opts the data out; document.
- **Export/import:** round-trip a **full post-Phase-5 save** (war mid-arc, secrets held both ways, a filed trial, laurels earned, Manlia gens, Ferox) through export → wipe → import. Fix any Zod schema drift found (schemas often lag the last few phases' fields — this is the likeliest real bug in the chunk).
- **Settings — "Your saves":** a short plain-language section: autosaves every season and when you leave the app; your device's backup covers it (one line per platform); Export creates a file you own; Import restores it. No overpromising the word "cloud."

### I3. Save versioning & migration fixtures

Add `saveVersion` to the schema (current = 5). Consolidate the phase-by-phase load-normalisation passes behind it (behaviour-preserving). Commit fixture saves — minimum: a Phase-2-era save, a Phase-3-era save, a Phase-4-era save (fabricate minimal-valid JSONs against each era's schema per the phase plans if real ones aren't at hand), plus a current full save — and a migration test that loads each and asserts the invariant fields (difficulty `aequus`, gens `brutii`, empty laurels, converted trials, caught-up war) without crashing.

### I4. Documentation (the phase's close-out)

`game-manual.md`: **Starting Families** (three houses, unlock conditions, the Manlia corruption hook in plain words); **Difficulty** (the three presets and exactly what they change — and don't); **Laurels** under Hall of Ancestors; **Saving & Backup** (the I2 story); refresh the **Events** section's count/seasonality language; add "Choose the fight you can win — Clemens is not a lesser Rome" or similar to Key Strategic Principles only if it earns its place. `SITEMAP.md`: new files (`data/altFamilies.ts`, `models/achievement.ts`, `engine/achievementEngine.ts`, `data/achievementDefinitions.ts`, `state/achievementStore.ts`, `components/shared/AchievementToast.tsx`, `scripts/eventAudit.ts`, `docs/*`), removed orphans (P5-A), the flag-write touchpoints (P5-D), the two difficulty seams, and the fixtures. `docs/release-checklist.md`: the audit findings + a repeatable pre-release QA list (fresh install, old-save load, airplane mode, each family boot, each preset boot, export/import).

### Chunk P5-I — Done when

The airplane-mode session passes; save-on-background works; a full modern save round-trips export/import; all fixture saves migrate green; Auto Backup config ships; Settings tells the honest save story; manual and sitemap current; the release checklist exists and passes end-to-end once.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched lightly and additively, in chunk order: P5-A (auto-season action, if needed), P5-D (verdict/burn flag writes — inside existing consequence functions), P5-E (`gensId` + init plumbing), P5-G (`difficulty`), P5-I (save-on-background wiring). P5-F's evaluator call lives in the sequencer, its persistence in `achievementStore` — the game store stays out of the cross-run layer.
- **`turnSequencer.ts`** gains exactly **one** new call: the P5-F end-of-season achievement check (place it after the ledger assembles, so a laurel's ledger line can ride the same season). P5-G's multipliers live inside the two engine seams, **not** as sequencer steps.
- **Agenda generators: none.** Phase 4 ended at **#26**; Phase 5 adds no generators (content, meta, and tuning don't create to-dos). Leave the catalog comment untouched except to note "Phase 5: none" if the comment tracks phases.
- **Effect tokens & condition types: zero new** (invariant 1). The sanctioned expressiveness mechanism is flags (P5-D adds two write-sites). If P5-A's audit reveals the *existing* vocabulary differs from any brief's assumption, the brief bends, not the schema.
- **Cross-run keys:** the Hall key (Phase 3) and the new laurels key (P5-F) are siblings with identical discipline — dedicated AsyncStorage keys, never cleared by active-save operations, each with its own tiny store module. Family unlocks deliberately have **no key of their own** (computed from Hall records — nothing to migrate, nothing to lose).
- **Old saves:** P5-D (missing flags = falsy — fine), P5-E (`gensId` → `'brutii'`), P5-F (no laurels key → empty), P5-G (`difficulty` → `'aequus'`; `AncestorRecord.difficulty` → `'aequus'` on read), P5-I (versioning consolidates all of the above behind `saveVersion`). Follow the established default-spread pattern.
- **If the military overhaul turns out to have been built** (P5-A's verify): P5-C's civic war-track events remain valid (they never touch battle state); P5-H adds the military plan's M11 targets to its table rather than re-deriving them; nothing else in this plan changes.
- **Voice registers:** new events follow the guide's domain registers; laurels speak in the system's own voice (no Philon); the difficulty picker and Settings save-story are plain UI copy; Philon appears in exactly one new-family opening notice per family and the sanctioned Saturnalia cameo.
- **Do not build in Phase 5:** anything from the v1 cut list (Censor/Dictator mechanics, adoption/defection, veteran depth, expanded ambassadors, per-client rolls, Second Punic War, multiplayer/social); a third starting family; achievement rewards of any kind; mid-run difficulty switching (dev override only); a cloud sync service or accounts; **any store-listing/marketing content** (cut by decision — the release checklist is QA-only); the military overhaul.

## Phase 5 — Done when (integration criteria)

1. The random event pool totals **80–120** curated events (audit script as witness), every season reads distinct across two auto-played years, state-reactive events demonstrably fire from their states, and the aftermath layer visibly remembers Phase 4's dramas.
2. Gens Duilia unlocks from any completed run and Gens Manlia from a Victory; both play from start into a rendered epilogue with correct gens naming everywhere; both are sidegrades by the P5-H evidence; the guided start remains Brutii and byte-compatible.
3. All ~18 laurels are earnable, toast once, persist across runs and save resets beside the Hall, display with visible conditions, and grant nothing.
4. Three difficulty presets apply at exactly two seams, show their numbers at selection, are recorded on Hall records, and produce the P5-H-measured spread.
5. The tuning log evidences all nine balance targets, with `BALANCE`-only changes.
6. The premium audit passes: a full airplane-mode session, zero timers, zero IAP, autosave + save-on-background, Android Auto Backup configured, a full modern save round-tripping export/import, and all era fixtures migrating green.
7. `npx tsc --noEmit` clean; all prior tests plus the new audit/laurel/difficulty/migration tests pass; `game-manual.md`, `SITEMAP.md`, and the refreshed event guide are current. The exiting build is the release candidate.

---

## Tuning log (Chunk P5-H)

**Status: 7 of 9 targets evidenced and resolved this pass. Targets #1 and #2 need real hand-played wall-clock data this environment cannot generate (no device/emulator access) — pending the user's own play sessions; this section will be updated once that data lands.**

### Environment note

Two things assumed by this plan's own text turned out not to exist in the repo when this chunk started, both confirmed before doing anything: no election simulation harness was ever built (`electionEngine.ts`'s own P2-E comment: "no sim harness was built this pass; the user chose first-pass-only tuning" — Phase 2 deferred exactly this), and the Phase 1–4 / military implementation-plan docs (which held the original E3/E4 target tables and any prior tuning-log appendices) no longer exist anywhere in the repo — only this Phase 5 plan and the foreign-relations plan remain. Targets referencing those docs are evidenced against what survives in code/tests/comments instead, noted per-target below.

### Target #1 — Minutes/season median 3–6, never >8

**Status: pending.** `BALANCE.actionEconomy.maxSeasonDurationSec` (8×60) and the Pace panel's `durationSec` tracking (`Date.now() - seasonStartedAt`) are already correctly wired and unchanged — nothing here has drifted. What's missing is real hand-played session data; `durationSec` from an auto-driven/scripted run is meaningless (near-zero, no real elapsed time). Needs the user's own device pass.

### Target #2 — Meaningful actions 3–4 early / 4–6 mid / 5–8 late

**Status: pending**, same reason as #1. `BALANCE.actionEconomy.actionBand` (`early: [3,4], mid: [4,6], late: [5,8]`) already matches the plan's own numbers exactly — confirmed unchanged, nothing to tune blind. Needs real hand-played `seasonStatsHistory` samples via the Pace panel.

### Target #3 — First "oh no" ≤ 8 seasons on a fresh guided start

**Resolved — one engine-logic fix, confirmed by the user before applying (a deviation from this chunk's normal `BALANCE`-only scope).** Traced why the target failed: `turnSequencer.ts`'s Claudius-arc demand trigger required `tutorialDone` (the guided `tutorialQueue` fully drained) before it could ever fire, and the guided script (`tut-00`…`tut-07`) realistically doesn't finish before season 8–9 — structurally later than the target window, not a number to tune. Removed the `tutorialDone` requirement (`turnSequencer.ts`, the Claudius-demand condition block); `yearsSinceStart >= 1` alone is still the pacing floor (earliest possible firing: turn 5, Spring Year 2 — after `tut-04`'s own "The Claudian Smile," the tutorial's existing narrative setup for this arc, has already had its season). The demand queues onto `pendingEvents` rather than interrupting anything active, so it can't collide with a tutorial event mid-display.

Evidence (`__tests__/p5h.test.ts`, "Target #3" block): the plan's literal target (any qualifying oh-no — trial/demand/election-loss/crisis-tier-≥2 — within 8 seasons) passes on every one of 3 fresh auto-driven guided runs, via a passive War-tier crossing at season 2 every time (War starts at tier 1 as the game's own historical premise, so this fires regardless of content — a real but not very informative signal on its own). The spirit-of-the-target check — the Claudius arc's *own* demand specifically — fires within 8 seasons in **8 of 10** runs post-fix (was 0/10 before, confirmed via a throwaway debug trace showing the demand simply couldn't reach its own trigger conditions before season 8–9 under the old gate). The remaining ~20% miss rate is genuine, not a bug: the arc still competes with the generic NPC secrets system for the single `pendingSecretDemand` slot, and an unlucky run can have that occupied by someone else for most of the window.

### Target #4 — Election summit curve holds

**Partially resolved; Consul logged as an honest evidence gap, not tuned.** Built `src/engine/electionSim.ts` (pure Monte Carlo harness, mirrors `engine/battle/battleSim.ts`'s existing idiom exactly) + `scripts/electionSim.ts` (`npm run sim:elections`). Found and fixed a real bug while building it: the harness's first version included Tribune as a contested office, producing nonsense (0 votes, 0% win rate always) — Tribune candidacy never goes through `resolveElection`/`state.campaigning` at all; it resolves through a wholly separate mechanism in `gameStore.endSeason` (a plebs-mood-scaled roll on `state.tribuneCandidateId`). Excluded it from the harness with a comment explaining why.

With that fixed, across Vigintivirate/Quaestor/Aedile/Praetor/Consul under three investment postures (none / light canvassing / heavy canvassing + clients + Grand Games), the curve's shape holds through Praetor: no investment wins nothing (Quaestor's 100% at zero investment is a pool-size artifact — my 6-rival test field is smaller than its 8 seats, not a real signal), light investment wins Vigintivirate, heavy investment wins everything through Praetor. Consul stayed at 0% even under heavy investment; traced this to the test's rival pool being unrealistically dense for that office specifically (6 rivals who *all* already hold Praetor as the Consul prerequisite — `tickNpcCareers`' slow, probabilistic per-season advancement chance makes that many simultaneously-qualified NPCs unlikely in a real run by the time a player reaches Consul eligibility). Not solid enough evidence to justify touching `RIVAL_STRENGTH_BY_OFFICE_RANK`/`CANVASS_FIDES_COST_BY_OFFICE_RANK` — logged as a gap needing either a real multi-season NPC-career simulation or hand-play data, not guessed at. No `BALANCE` changes this target.

### Target #5 — Event economy near-neutral

**Confirmed, no changes needed.** Re-ran `scripts/eventAudit.ts` (`npm run audit:events`): random-draw pool sits at 82 (inside the 80–120 target, unchanged since P5-D — nothing in P5-E/F/G/H touches event content). The denarii-negative skew (net tracked-token sum −311, mean −9.48/choice across 56 denarii-touching choices) is real but was already explicitly flagged and pre-authorized as accepted-by-design by the batches that produced it: P5-B's own audit entry ("spending denarii to buy fides/dignitas/plebs is the whole point of the domain, not an accident... P5-H's balance pass should treat this as a known, accepted skew") and P5-C's ("Flagged for P5-H, not corrected here per invariant 6"), both of which already confirmed no single event exceeds the guide's magnitude bands. Re-inflating event content to force the aggregate toward zero would fight the content's own intended fiction (crisis-reactive/domestic events cost more than they give; the game's other systems — offices, assets, provinces, patron tier — are the actual income engine). If future hand-play data (targets #1/#2) shows real economic strain, the intended lever is `BALANCE.income`, not event magnitudes — noted for whoever picks that up.

### Target #6 — War: all 3 outcomes reachable; harder early, easier near 241

**Confirmed, no changes needed.** `computeRipeness`/`terminalThresholds` (`warEngine.ts`) tested directly (`__tests__/p5h.test.ts`, "Target #6"): ripeness climbs monotonically from ~0 at 264 BC toward 1.0 near 241 BC, and the Victory/Humbled terminal thresholds interpolate correctly toward their easier (`easy`) bounds as ripeness rises — the "harder early, easier late" design is intact and unchanged. Outcome reachability (all three terminal outcomes) is already covered by the pre-existing `__tests__/warEngine.test.ts`, confirmed still green (part of the full-suite run below) — not re-derived from scratch.

### Target #7 — Trials: 70/30 clamp intact; Claudius trial pacing

**70/30 clamp confirmed intact** (`BALANCE.trials.prepShare` still exactly `0.70`, unchanged). **Claudius trial retuned** — a real, well-evidenced gap, fixed with the user's explicit sign-off on the lever (this is the other engine-adjacent deviation from pure `BALANCE`-only, though the actual change here is two numbers plus one new field, not new logic).

Simulated the trial directly (`__tests__/p5h.test.ts`, "Claudius trial" test) rather than relying on the fixture-math-only reasoning `BALANCE.secrets.claudius`'s own pre-P5-H comment flagged as insufficient ("needs a playtesting pass, not just a fixture-math check"). Old numbers (`trialSeed: 10`, the shared `BALANCE.trials.npcInitiatedDelay: 3`): Claudius's own stats (intrigus 9, clan influence 75) drive `computeOpponentPrepGrowth` to ~18.75/season; over the 3-season prep window that's +56.25, so `npcStrength` reaches 66.25 by trial day regardless of the seed. Four representative prep actions (2× Gather Evidence at intrigus 5, 2× Prepare an Oration at rhetoric 6 — Brutii's own starting stats) gave the player 30.94 after the 70% share — a differential of **−15.4**, landing on **Exiled**, nowhere near "comfortably Acquitted+."

`trialSeed` alone couldn't fix this (only worth up to 10 points against a 56+-point growth term), and the shared growth-rate constants (`npcPrepPerIntrigue`/`npcPrepClanFactor`) affect every NPC-initiated trial in the game, not just this arc — too broad a blast radius to touch for one narrative beat. Fix, confirmed with the user: `trialSeed` 10 → **0**, plus a new **Claudius-specific** `startsDelaySeasons: 1` (replacing the shared `npcInitiatedDelay` at this one call site in `secretEngine.ts`'s `resolveClaudiusDefiance` — every other NPC-initiated trial still uses the shared constant, unchanged). Re-simulated: `npcStrength` 18.75, differential **+17.8**, landing on **Dismissed** with real margin above the threshold (10). "Comfortably Acquitted+" is read here as "solidly cleared, not barely" rather than literally reaching the Acquitted band — four modest actions structurally can't clear that band against *any* meaningful opponent growth (the math: Acquitted needs the differential past +30, which would require `npcStrength` near zero, i.e. no growth window at all).

### Target #8 — Preset spread (Ferox vs. Clemens, 12 seasons, identical seed)

**Confirmed, comfortably exceeds target.** Aggregate crisis gap: **44 points** (target: ≥15) — Clemens 292, Ferox 336, from an identical pressured seed (`__tests__/p5h.test.ts`, "Target #8"). Income leanness was already proven exactly (not just observed) by P5-G's own seam tests — the multiplier math is deterministic by construction, not a simulation result.

### Target #9 — Alt families are sidegrades

**Confirmed, no changes needed.** 12-season fides *growth* (delta from each family's own documented starting point, not absolute end value — Duilia/Manlia intentionally start with different fides/denarii/dignitas than Brutii, already verified by `p5e.test.ts`, so comparing absolutes would flag that intentional offset as a false violation): Brutii +66 to +74 across runs, Duilia +43, Manlia +90 to +96 — same order of magnitude, no family showing a mechanical fides advantage. Denarii diverges sharply by design (Duilia +51 vs. Brutii −105 vs. Manlia −80 — "the money is the hook" is exactly the intended asymmetry). Lifetime Dignitas growth was 0 for all three families under passive play (dignitas requires active munificence/military/office actions an idle auto-run never takes) — not a divergence, just no signal either way from this method.

### Files touched this chunk

- `src/data/balance.ts` — `BALANCE.secrets.claudius.trialSeed` (10→0), new `startsDelaySeasons: 1`.
- `src/engine/turnSequencer.ts` — removed the Claudius-demand `tutorialDone` gate (target #3).
- `src/engine/secretEngine.ts` — `resolveClaudiusDefiance` reads the new `startsDelaySeasons` instead of the shared `npcInitiatedDelay`.
- `src/engine/electionSim.ts` (new), `scripts/electionSim.ts` (new), `package.json` (`sim:elections` script) — the election harness (target #4).
- `__tests__/p5h.test.ts` (new) — regression coverage for targets #3, #6, #7, #8, #9 so this evidence stays re-runnable, not just a one-time console transcript.
- `__tests__/secretEngine.test.ts` — updated one assertion (`trial.startsSeason`) to match the intentional `startsDelaySeasons` change.

`npx tsc --noEmit` and the full `npx jest` suite are clean of any failures beyond the same 3 pre-existing, unrelated `officeAction.test.ts` failures (a `--experimental-vm-modules` dynamic-import issue predating this chunk).
