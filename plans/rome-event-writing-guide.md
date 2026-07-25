# Rome: Res Publica — Event Writing Guide

**Audience:** AI agent assisting with content creation
**Purpose:** Write new events that fit the existing data schema and meet the game's narrative and mechanical standards.
**Read before writing any event. Do not rely on intuition about the schema — follow this guide exactly.**

> **Revision note (2026-07-16, Phase 5 Chunk P5-A):** Refreshed against the actual codebase after Phases 0–4, the military overhaul, and the Mediterranean-provinces plan. Every table below (§2.4's conditions, §6.1's tokens) was verified against `models/event.ts` and `engine/resourceEngine.ts` directly, not carried over from the previous draft. Specific corrections from the prior version: the condition union was missing `crisisTrack`/`multiCrisis`/`asset`/`campaigning`/`governing`; the token table listed `gold` as the primary currency token (it's a deprecated alias for `denarii`) and an `addFamilyMember` token that was never actually implemented; §11 (Era discipline) is new.

---

## 1. What You Are Writing

Events are the primary narrative layer of the game. They fire once per season, presented to the player as full-screen modal cards. Each event is a small story — a real situation involving real people — that asks the player to make a meaningful choice. The player's choice has mechanical consequences (resources, flags, follow-up events) and narrative consequences (outcome text that closes the scene).

A well-written event feels like a chapter in a historical novel. A poorly written event feels like a resource transaction with a brief preamble. Always aim for the former.

---

## 2. The Data Schema

All events for Phase 5's batches live in `src/data/events.ts` as entries in the `EVENT_DEFS` array (this is the file CLAUDE.md flags as edit-surgically-only at ~1150+ lines — make targeted additions, don't regenerate it). The TypeScript interfaces are in `src/models/event.ts`. You must fit every event you write exactly into these interfaces. Do not invent new fields — and per Phase 5's invariant 1, do not invent new `EventCondition` types or effect tokens either. If a brief can't be expressed with what's below, the fix is a *flag*, a rewritten brief, or a stop-and-ask — never a schema change.

### 2.1 `EventDef` — the top-level event object

```ts
interface EventDef {
  id: string;             // unique, kebab-case, prefix 'evt-'
  title: string;          // 2–5 words, shown as card heading. Evocative, not descriptive.
  bodyText: string;       // the scene prose. See Section 4.
  imageKey: string;       // see the imageKey note below.
  conditions: EventCondition[];  // when this event is eligible to fire. See Section 5.
  weight: number;         // relative probability. Use 0 for follow-up scenes. See Section 5.
  choices: EventChoice[]; // player options. See Section 3.
  seasons?: number[];     // OPTIONAL soft seasonal weighting — see below. Do not confuse with a season condition.
}
```

**`imageKey` — current reality:** only two keys resolve to a real portrait today (`'portrait-paterfamilias'`, `'marius-plumber')`; every other key silently renders the card with no image (a `try/catch` around the asset `require` falls back to `null`). This is expected and fine — more art is planned separately, on its own schedule. **Pick a natural, descriptive `imageKey` for the event's central figure or scene** (e.g. `'centurion-veteran'`, `'tribune-portico'`, `'widow-at-the-door'`) rather than defaulting everything to `'portrait-paterfamilias'` — it costs nothing today and lets art be matched to the right events later. Don't invent a key expecting it to resolve now; it won't, and that's fine.

**`seasons` vs. a season `condition` — these are different mechanisms:**
- `conditions: [{ type: 'season', index: n }]` is a **hard gate** — the event is only *eligible* to fire in that season at all.
- `seasons: [n, ...]` is a **soft weighting** applied inside `pickRandomEvent`: the event's effective weight is ×2.5 when the current season is in the list, ×0.4 otherwise. No `seasons` field = season-neutral (×1.0 always).

For most of Phase 5's seasonal briefs (§11 below), `seasons` (soft) is the right tool — it lets an event still occasionally surface slightly off-season rather than vanishing entirely, which reads more naturally than a hard gate for flavor content. Reserve the hard `season` condition for events that would be nonsensical outside one season (a specific festival's date).

### 2.2 `EventChoice` — a single player option

```ts
interface EventChoice {
  id: string;                    // short, kebab-case, unique within the event (e.g. 'pay', 'refuse', 'investigate')
  label: string;                 // the button text the player taps. See Section 4.3.
  skillCheck?: SkillCheck;       // optional. Makes this choice a dice roll. See Section 3.2.
  successEffect: string;         // pipe-separated effect string applied on success. See Section 6.
  failureEffect: string;         // applied on skill check failure. Empty string '' if no failure state.
  requiresClient?: ClientType;   // grey out this choice unless player has this client type.
  nextEventId?: string;          // branch immediately to this event regardless of skill check result.
  nextEventIdOnSuccess?: string; // branch here on skill check success instead of applying successEffect.
  nextEventIdOnFailure?: string; // branch here on skill check failure instead of applying failureEffect.
  successText?: string;          // narrative closing line shown to player after success. See Section 4.4.
  failureText?: string;          // narrative closing line shown to player after failure. See Section 4.4.
}
```

**Branching rule:** When any `nextEventId` field is set, the corresponding effect string is ignored by the engine entirely (`resolveEventChoice` returns before ever looking at `successEffect`/`failureEffect` when a branch field is set). Set the effect string to `''` on a branching choice. Do not put effects on a branching choice — put them on the follow-up scene's choices instead. (If you genuinely need both an immediate effect *and* a scene transition in one choice, that's what the `nextEvent:defId` token exists for — see §6.1's reserved-tokens note. Don't reach for it casually; it's there for a specific plumbing need.)

### 2.3 `SkillCheck`

```ts
interface SkillCheck {
  characterId: string;  // present on the type but IGNORED at runtime — see note below
  skill: 'rhetoric' | 'martial' | 'intrigus';  // never 'auctoritas' — that skill is retired
  difficulty: number;   // 1–10. See Section 3.2 for calibration guidance.
}
```

**`characterId` is currently inert.** `resolveEventChoice` (eventEngine.ts) always evaluates the skill check against `state.family.find(c => c.isPlayer)` — the player character — regardless of what `characterId` is set to. There is no mechanism today for a skill check against a non-player family member. Set `characterId: 'player'` for clarity, but know it has no effect on which character is actually checked.

### 2.4 `EventCondition` — controls when an event is eligible

```ts
type EventCondition =
  | { type: 'resource'; key: 'fides' | 'lifetimeDignitas' | 'denarii' | 'crisisLevel'; op: ConditionOperator; value: number }
  | { type: 'rome'; key: 'stability' | 'plebs' | 'treasury'; op: ConditionOperator; value: number }
  | { type: 'season'; index: 0 | 1 | 2 | 3 }   // 0=Spring 1=Summer 2=Autumn 3=Winter — hard gate, see §2.1
  | { type: 'office'; held: string }             // matches heldOffice id on the player character
  | { type: 'crisisTrack'; track: CrisisTrackId; op: ConditionOperator; value: number }
  | { type: 'multiCrisis'; conditions: Array<{ track: CrisisTrackId; op: ConditionOperator; value: number }> }
  | { type: 'clientCount'; clientType: ClientType; op: ConditionOperator; value: number }
  | { type: 'hasClient'; clientType: ClientType }
  | { type: 'flag'; key: string; equals: boolean }   // for follow-up events tied to player choices — see §5.3
  | { type: 'asset'; definitionId: string }          // true iff the player owns this asset
  | { type: 'campaigning' }                          // true iff state.campaigning !== null
  | { type: 'governing' };                           // true iff any province has a non-null playerGovernor

type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
```

All conditions in an array are AND-ed. For OR logic, create two separate `EventDef` entries with identical body and choices but different conditions.

**`crisisTrack`/`multiCrisis` are the real crisis-gating mechanism** — the four-track model (`war`/`unrest`/`constitution`/`economy`, each with its own `level`) superseded the old flat `crisisLevel` scalar. `{ type: 'resource'; key: 'crisisLevel' }` still works (it's a real, still-live field) but only reads the legacy aggregate — for Phase 5's crisis-track-reactive briefs (P5-C), use `crisisTrack` against the specific track named in the brief, not the legacy scalar.

**`governing`** is a blunt "does the player hold *any* governorship" check — it cannot target a specific province. If a brief needs "governing *this particular* province," that's not expressible; drop or re-gate the brief (invariant 1) and say so.

---

## 3. Choices — Mechanical Design

### 3.1 How many choices to offer

- **Minimum:** 2. A single-choice event (acknowledge and move on) is only acceptable for follow-up scenes where the narrative is delivering a consequence, not asking for a decision.
- **Standard:** 2–3 choices per scene.
- **Maximum:** 3. More than three choices is overwhelming on a mobile card. Split the event into scenes instead.

Every choice must feel genuinely different in intent, not just in price. "Pay 30 gold" and "Pay 20 gold" are not two choices — they are one choice with a slider. The player should be choosing between meaningfully different approaches: pay, persuade, threaten, ignore, delegate, escalate.

### 3.2 Skill checks — when and how

Use a skill check when the outcome of an approach plausibly depends on the character's ability, not just their willingness. A skill check makes a repeated event feel different across playthroughs.

Which skill to use:
- **rhetoric** — persuasion, speeches, negotiation, public performance, managing social situations
- **martial** — physical authority, camp discipline, military judgment, intimidation by presence
- **intrigus** — deception, intelligence-gathering, operating through intermediaries, reading hidden motives

Difficulty calibration:

| Difficulty | Meaning | Use when |
|---|---|---|
| 3–4 | Modest challenge | A capable character should usually succeed |
| 5–6 | Real risk | Even a skilled character might fail; failure hurts |
| 7–8 | High stakes | Only specialists should attempt this with confidence |
| 9–10 | Reserved for crisis | Near-impossible; the attempt itself says something about the player |

Always show the skill and difficulty to the player (the UI renders this automatically from the `skillCheck` field). The player should be able to make an informed decision about whether to attempt the roll.

Always provide a meaningful `failureText` when a skill check has no `nextEventIdOnFailure` branch. The player needs to know what went wrong and why it hurt.

### 3.3 Guaranteed choices (no skill check)

Not every choice needs a roll. Paying gold, accepting something, or making a quiet decision that has certain costs and certain benefits should resolve immediately. These choices create a different kind of tension — you know exactly what you are giving up.

At least one choice in every opening scene should be a safe, guaranteed option, even if it is the least interesting one. Not every player wants to gamble.

---

## 4. Writing the Prose

### 4.1 The body text

The `bodyText` is the scene. It sets location, introduces the other person (always give them a name), establishes the tension, and ends with the decision facing the player. It should not explain what the player should do — it should make the player want to do something.

**Target length:** 3–5 sentences. Enough to feel like a real scene. Short enough to read in ten seconds on a phone screen.

**Voice:** Third-person, present tense, historical-fiction register. Think Colleen McCullough's *Masters of Rome* series, not a textbook. Specific details — a name, a location, a small physical observation — are worth more than general political context.

Do:
- Give the antagonist or other character a name, an attitude, a tell
- Ground the scene in a physical location (the Curia portico, the camp at dawn, your daughter's garden)
- End the body text on the tension, not the resolution

Do not:
- Open with "The Senate has..." or "Rome is..." — this is background, not a scene
- Summarise the player's options in the body text
- Use abstract political language where a specific human moment will do
- Resolve the tension in the body text — that is what the choices are for

### 4.2 The title

Two to five words. Evocative, not descriptive. A title names the thing at the heart of the scene, not what happens in it.

Good: *The Tribune's Ultimatum*, *Your Daughter's Suitor*, *The Mutinous Cohort*
Weak: *A Political Problem*, *Family Marriage Decision*, *Military Discipline Issue*

Follow-up scene titles should reference the original event clearly enough that a player who played three seasons ago can immediately place the callback. Use a character's name if you used one in the opening scene, or a phrase from the original that was memorable.

Good callback title: *Norbanus Remembers the Portico*, *The Legate's Account*
Weak callback title: *A Past Decision Returns*, *Consequences*

### 4.3 Choice labels

The choice label is what appears on the button the player taps. It should:
- Be a complete action phrase in active voice: "Send him away", not "Rejection"
- Give the player a sense of approach, not just outcome: "Talk him down in front of witnesses" not "Use rhetoric"
- Include the mechanical cost in brackets if there is one: "(−40 Denarii)", "(Rhetoric check)"
- Stay under 60 characters

Do not write the label as if the player already knows they will succeed. "Expose him and destroy his reputation" is the player's intention — the roll decides if they succeed.

### 4.4 Outcome text (`successText` / `failureText`)

Every terminal choice — any choice that does not branch to another scene — must have a `successText`. Failure paths with no follow-up scene must have a `failureText`.

The outcome text is the closing line of the scene. It shows the player what happened as a result of their choice. It is not a mechanical summary ("You gained 5 Fides") — it is a narrative beat.

**Target length:** 2–4 sentences.

Do:
- Show the consequence through human detail, not resource tallies
- End with something that lingers — a look, a silence, a small observation about what changed
- Make success feel earned, not free
- Make failure feel plausible, not punishing — the player should understand why it went wrong

Do not:
- Repeat what was already in the body text
- Explain what resource changed (the UI shows this)
- End on a cliffhanger (that is what follow-up events are for)
- Repeat phrases used in the body text — each scene section should add new texture

---

## 5. Conditions, Weight, and Follow-up Structure

### 5.1 Opening scene conditions

Conditions gate when an event is eligible to fire. Be specific enough that the event feels contextually appropriate, but not so narrow that it almost never fires.

Common patterns:
- Gate political events on `rome.stability` being in a relevant range
- Gate military events on `office.held` matching a military office id
- Gate domestic/family events with no conditions (they can fire any time)
- Gate opportunistic events on a `crisisTrack` being elevated (things happen in uncertain times)
- Gate seasonal events on `season.index` (hard) or `seasons` (soft, preferred for flavor — see §2.1)

Every opening scene should have `weight: 5–10`. Reserve weight 10 for high-priority events that should fire often. Reserve weight 3–4 for rare or flavour events. (Phase 5's batch rules tighten this further per pool — see the phase plan's batch rules; don't exceed the audit's reported median weight without a stated reason.)

### 5.2 Follow-up scenes — the weight-0 rule

Any scene that fires via a `nextEventId` from another scene must have `weight: 0` and `conditions: []`. This prevents it from ever firing as a standalone random event. It exists only as a branch destination.

### 5.3 Delayed follow-up events — the flag pattern

A delayed follow-up is an event that fires in a later season as a consequence of a specific earlier choice. It must:
- Have `weight: 3–6` (low, so it does not crowd out other events)
- Have a flag condition gating it: `{ type: 'flag', key: 'your-flag-name', equals: true }`
- Have a title that clearly references the original event (see §4.2)
- Open its `bodyText` by re-establishing what happened — do not assume the player remembers. Name the original character, the location, the original choice. One sentence of grounding is enough.
- After it resolves, clear its own flag with `setFlag:your-flag-name:false` in the `successEffect` of its terminal choices. This prevents the same sequel from firing repeatedly.

A delayed follow-up must be gated on the flag set by the specific choice that triggers it — not on ambient world state. "Gated on stability being low" means the event fires for everyone in that state. "Gated on a flag set by the player's specific choice" means only that player sees it.

---

## 6. Effect Strings

Effects are pipe-separated tokens in `successEffect` and `failureEffect`. The engine parses these in `resourceEngine.ts`'s `applyEffectString`. Separate multiple tokens with `|`. Example: `'denarii-40|martialBonus+1|lifetimeDignitas+5|setFlag:mutiny-resolved-pay:true'`.

### 6.1 Core tokens — free to use in new content

| Token | Effect |
|---|---|
| `fides+N` / `fides-N` | Adjust current Fides |
| `lifetimeDignitas+N` / `lifetimeDignitas-N` | Adjust lifetime Dignitas (permanent) |
| `denarii+N` / `denarii-N` | Adjust Denarii. (`gold±N` is a deprecated alias for the same field — new content should write `denarii`, not `gold`.) |
| `crisis-<track>+N` / `crisis-<track>-N` | Adjust one of the four crisis tracks directly — `<track>` is `war`, `unrest`, `constitution`, or `economy`. This is the real, current mechanism. |
| `crisis+N` / `crisisLevel+N` | Legacy scalar aggregate — still live, but prefer the per-track token above for anything Phase 5 writes, since it's what the actual crisis UI/thresholds read. |
| `stability+N` / `stability-N` | Adjust Rome stability |
| `plebs+N` / `plebs-N` | Adjust plebs satisfaction |
| `treasury+N` / `treasury-N` | Adjust Rome treasury |
| `popularesRel+N` / `popularesRel-N` | Adjust standing with the Populares faction |
| `optimatesRel+N` / `optimatesRel-N` | Adjust standing with the Optimates faction |
| `corruption+N` | Increase the player character's corruption score |
| `rhetoric+N` / `martial+N` / `intrigus+N` | Grant a skill point. `rhetoric+N` targets the youngest non-player family member (a training/mentorship framing); `martial`/`intrigus` target the player only. `martialBonus±N` is an alias for `martial±N`. |
| `imperium+N` | Adjust the player character's personal imperium stat |
| `setFlag:flag-key:true` / `setFlag:flag-key:false` | Set or clear a persistent story flag (see §6.2) |
| `clearFlag:flag-key` | Delete a flag entirely (distinct from setting it `false` — use `setFlag:...:false` for the standard "consumed" convention in §5.3; `clearFlag` is for the rarer case you want the key gone, not just falsy) |
| `addClient:type:FlavourTitle:Name` | Add a named client of the given type with a specific title/name |
| `addClient:type` | Add a client of the given type with an auto-generated name |
| `removeClient:type` | Remove the oldest client of the given type (or the client named in the firing instance, if one is attached) |
| `blackmail:leader-id` | Gain blackmail leverage on a clan leader |
| `leaderRel:leader-id:±N` | Adjust relationship with a specific clan leader, clamped ±100 |

### 6.2 Tokens that exist but are reserved for specific systems — do not reach for these in a fresh Phase 5 event unless the brief explicitly calls for it

These are real, working tokens, but each was built for one scripted system's specific plumbing need and isn't meant as general vocabulary:

- `startWar:enemyId:scale:openingWarScoreDelta`, `warScoreDelta:enemyId:±N` — the war-ignition/periodic-event system (`warEvents.ts`). P5-D's showpieces should not start or move a war through these without a specific reason.
- `nextEvent:defId` — chains an effect application *and* a scene transition in one choice (the built-in `nextEventId` branching discards effects entirely — see §2.2). Used by the succession sequence. Legitimate if a brief genuinely needs both at once, but the ordinary `nextEventId` field (§2.2) is the default tool for branching.
- `succeedPaterfamilias:default` / `succeedPaterfamilias:alt`, `setPendingEpilogue:value`, `continueAsCadet`, `cadetVisited`, `cadetStanding±N` — succession/cadet-branch plumbing (Phase 3). Not for Phase 5 content.
- `incorporateProvince:provinceId`, `assignAmbassador:provinceId:characterId` — province-bill plumbing (the Mediterranean-provinces plan). Not for Phase 5 content.
- `createLatentSecret:type:potency` — plants a compromising fact nobody holds yet (Phase 4's player-choice-blackmail system, `compromisingEvents.ts`). This one **is** legitimately general-purpose if a P5-C/D brief wants a real risk/reward "this could come back to bite you" choice — see `compromisingEvents.ts` for the existing pattern before reusing it.
- `bribeVotes:N` — sets the N highest-vote clan leaders to `campaignVotes: 'for'`. Only meaningful mid-campaign (gate on `{ type: 'campaigning' }` if you use it); a no-op otherwise.
- `grantGroundwork:leader-id:amount` — Claudius-arc-adjacent tutorial plumbing.
- `npcDignitas:clan-id:±N` — **currently a no-op.** It only `console.log`s; it does not change any state. Do not rely on it for a real mechanical effect until it's actually wired up — treat any brief that needs "adjust an NPC clan's standing" as unimplementable today and flag it, per invariant 1's "an event that needs a new token is the wrong event" (this one technically exists but doesn't do anything, which is worse than not existing if a writer doesn't know).

There is no `addFamilyMember` token — an earlier draft of this guide listed one; it was never implemented. Adding a family member is not currently expressible from event content.

### 6.3 Flag naming conventions

Flags are strings stored in `GameState.flags`. Name them:
- All lowercase, hyphenated
- Named after the event and the branch: `evt-id-shorthand:branch-shorthand`
- Example: `tribune-portico-threat`, `daughter-married-clerk`, `mutiny-mishandled`

Every flag set by a choice should be cleared by the follow-up event's terminal choices using `setFlag:flag-key:false`. A flag that is never cleared will persist and could gate unintended future events.

### 6.4 Effect magnitude guidelines

Sanity-checked against actual usage across `events.ts`/`warEvents.ts` (P5-A) — these hold up as accurate. Approximate guidelines for balance; check against existing events if in doubt.

| Effect | Small | Medium | Large |
|---|---|---|---|
| fides | ±2–4 | ±6–10 | ±12–18 |
| lifetimeDignitas | ±2–5 | ±6–10 | ±12–20 |
| denarii | ±5–15 | ±20–40 | ±50–80 |
| crisis (per-track) | ±2–3 | ±4–6 | ±8+ |
| stability | ±3–5 | ±6–10 | ±12+ |

---

## 7. Scene Architecture Patterns

Use these patterns as starting points. Combine or adapt — they are not rigid templates.

**Pattern A: Single scene, 2–3 choices, no branch**
Best for: flavour events, client events, ambient world moments. Each choice resolves to outcome text directly.
```
Scene A (weight: 5–8)
  ├── Choice 1 (guaranteed) → successText
  ├── Choice 2 (skill check) → successText / failureText
  └── Choice 3 (guaranteed, different cost) → successText
```

**Pattern B: Immediate branch on skill check failure**
Best for: events where failure opens a new problem rather than just a bad outcome.
```
Scene A (weight: 6–9)
  ├── Choice 1 (guaranteed) → successText
  └── Choice 2 (skill check)
        ├── success → successText
        └── failure → Scene B (weight: 0)
              ├── Choice 1 → successText
              └── Choice 2 (skill check) → successText / failureText
```

**Pattern C: Player chooses the branch**
Best for: decisions where the player's intent determines the next scene, not their skill.
```
Scene A (weight: 6–9)
  ├── Choice 1 (guaranteed) → successText
  ├── Choice 2 → nextEventId: Scene B (weight: 0)
  │     ├── Choice 1 → successText
  │     └── Choice 2 (skill check) → successText / failureText
  └── Choice 3 → nextEventId: Scene C (weight: 0)
        ├── Choice 1 → successText
        └── Choice 2 → successText
```

**Pattern D: Delayed follow-up (requires flags)**
Best for: consequences that emerge in a later season. Can be combined with any of the above.
```
Scene A (weight: 6–9)
  └── Choice X → setFlag:event-branch:true → successText

[Later season]
Scene D (weight: 3–5, conditions: [flag: event-branch = true])
  ├── Choice 1 → setFlag:event-branch:false → successText
  └── Choice 2 (skill check) → setFlag:event-branch:false → successText / failureText
```

**Pattern E: Full multi-scene story (combine B/C + D)**
Best for: major events with lasting impact. A 3–4 scene story is the ceiling — do not go deeper.

---

## 8. The Three Domains — Tone and Subject Guide

Events should feel like they belong to one of three domains. Each has its own register.

**Political / Curia domain**
Themes: Senate faction, legislation, tribunes, elections, public reputation, oratory
Tone: Tactical, public-facing. The stakes are visibility and precedent. Men smile when they mean to threaten.
Typical conditions: `rome.stability`, `crisisTrack`, `office.held` (magistrate offices)
Good anchors: a named senator, a specific location in the Forum or Curia, a public moment the player cannot control being private

**Family / Domus domain**
Themes: marriage, children, inheritance, household staff, patron obligations, freedmen
Tone: Intimate, slower. The stakes are loyalty and legacy. People say what they mean less often here than anywhere.
Typical conditions: unconditioned (family events can happen at any time), `season`/`seasons`, client flags
Good anchors: a family member by name, the player's home, a domestic relationship under pressure

**Military / Provincial domain**
Themes: camp life, discipline, campaign logistics, provincial governance, officer reputation
Tone: Blunt, physical, hierarchical. The stakes are respect and command.
Typical conditions: `office.held` matching a military or provincial office
Good anchors: a named centurion or legate, the camp at a specific time of day, the gap between the player's authority and their actual ability

---

## 9. Quality Checklist

Before submitting any event, verify every item on this list.

**Schema**
- [ ] Every `EventDef` has a unique id starting with `evt-`
- [ ] Every follow-up scene has `weight: 0` and `conditions: []`
- [ ] Every `EventChoice` has both `successEffect` and `failureEffect` set (use `''` if empty, not `undefined`)
- [ ] No choice has both a `nextEventId` field set AND a non-empty effect string on the same outcome
- [ ] Skill uses only `rhetoric`, `martial`, or `intrigus` — never `auctoritas`
- [ ] Every token used appears in §6.1 (or is a deliberately-justified §6.2 exception) — no invented tokens, no invented condition types

**Flags**
- [ ] Every flag set by a choice is cleared by the follow-up event's terminal choices
- [ ] Flag names are lowercase, hyphenated, and uniquely identify the event and branch
- [ ] Delayed follow-up events are gated on a flag, not only on ambient world state

**Narrative**
- [ ] Every terminal choice (no `nextEventId`) has a `successText`
- [ ] Every terminal failure path (skill check, no `nextEventIdOnFailure`) has a `failureText`
- [ ] The follow-up event's `bodyText` re-establishes context from the original event in its first sentence
- [ ] No character in the scene is unnamed
- [ ] The body text ends on the tension, not the resolution
- [ ] Choice labels are active-voice action phrases, not outcomes or skill names

**Balance**
- [ ] At least one choice in every opening scene is guaranteed (no skill check)
- [ ] Skill difficulties are in the 4–7 range for most events (see §3.2)
- [ ] Effect magnitudes are consistent with the guidelines in §6.4
- [ ] A player who always picks the safe/cautious option does not gain more than a player who takes risks and succeeds

**Era (Phase 5 addition — see §11)**
- [ ] Every named festival, institution, or reference is attested for 264–241 BC
- [ ] No anachronistic buildings, coinage-in-prose, or Second Punic War content

---

## 10. What to Ask the Owner Before Writing

If the brief for a new event does not specify these, ask before writing:
- **Domain** — political, family, or military/provincial?
- **Depth** — single scene, immediate branch, or delayed follow-up?
- **Office gate** — should this event require the player to hold a specific office?
- **Named characters** — should this involve an existing named NPC (a clan leader, a family member) or a new one?
- **Intended weight** — how often should this event appear? (Inform the weight value)

---

## 11. Era Discipline (Phase 5 addition)

The run is 264–241 BC (the First Punic War). Anachronism breaks the "historical novel" register §4.1 asks for.

**Safe anchors** (festivals/institutions attested for this window): Parilia, Lemuria, Consualia, Ludi Romani, Meditrinalia, Saturnalia, Compitalia, Lupercalia.

**Do not use:**
- Ludi Apollinares (instituted 212 BC — after this run's entire timespan)
- Megalesia (204 BC)
- Floralia as a *ludi* institution (c. 240/238 BC — borderline; avoid entirely rather than risk it)
- Greek-style permanent theatre buildings (Rome's first stone theatre is Pompey's, 55 BC — over two centuries out)
- The word "denarius" inside prose/flavor text — the *denarius* is this game's UI abstraction for the player's money, not necessarily the historical coin in circulation at this exact date; keep it out of `bodyText`/`successText`/`failureText`, it's fine as a UI label
- Hannibal, or anything that presupposes the Second Punic War (216 BC and later) — this run never reaches it (see the roadmap's cut list)

If a brief's flavor depends on something you can't verify is period-appropriate, either find a safe equivalent or flag it and ask rather than guess.
