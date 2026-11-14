# Spec 11 — Audio and haptics

**Source:** `plans/go-live-review-and-plan.md` workstream F · **Priority:** P1 · **Phase:** 2 — Polish
**Triage:** **blocked on decision §6.12** (audio scope: licensed, commissioned, or minimal UI sounds only) for the asset list · the audio *layer* and haptics are `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **There's no audio at all.** No audio package (`expo-av` / `expo-audio`) is in `package.json`, and `src/assets/` has no sound files. Confirmed.
2. **Haptics are used in one component.** `expo-haptics` is a dependency, but only `components/curia/ActionCluster.tsx` calls it (`:29-31`, `:65`, `:76`), through a local `hapticImpact` wrapper.
3. **There's no settings plumbing for sound.** `SettingsModal` exists (it's also one of the unselected store subscribers in §4.5), but there's no sound or haptics preference field in the store or the save schema.
4. **Season-end events already flow through one place.** `processSeason` and the `SeasonLedger`, plus the presentation queue (spec 03), give a natural single hook for stings (election results, verdicts, births, deaths).

## Problem Statement

The game is silent. Big moments (winning the Consulship, a trial verdict, an heir's birth, a death in the family, a battle won) land with the same weight as tapping a menu. Only one screen gives any physical feedback. A premium game on a phone feels unfinished without sound and touch feedback, and the player has no control over either.

## Solution

Add a small **audio layer**: an ambient bed, UI sounds, and stings for key moments, all behind a mute setting and respecting the device's silent mode. Add a shared **haptics helper** used consistently across the app, with its own toggle. The sound assets follow §6.12. The layer is built so that "minimal UI sounds only" and "full score" are the same code with different asset lists.

## User Stories

1. As a player, I want a quiet ambient bed while I play, so that Rome feels alive.
2. As a player, I want a subtle sound when I tap buttons and switch tabs, so that the interface feels responsive.
3. As a player, I want a distinctive sting when I win or lose an election, so that the result lands.
4. As a player, I want a sting for trial verdicts, so that the courtroom moment has weight.
5. As a player, I want a sting for a birth and a different one for a death, so that family moments feel personal.
6. As a player, I want a sting at the end of a battle and at the epilogue, so that climaxes feel like climaxes.
7. As a player, I want to mute music and effects separately, so that I can keep effects while listening to my own music.
8. As a player, I want the game to respect my phone's silent switch and not interrupt other audio apps unless I unmute, so that it behaves like a polite app.
9. As a player, I want audio to pause when the app goes to the background and resume when I return, so that it never plays from my pocket.
10. As a player, I want my sound and haptics settings to persist across sessions, so that I set them once.
11. As a player, I want light haptic feedback on key confirmations (End Season, casting a vote, confirming a choice), so that important taps feel distinct.
12. As a player, I want stronger haptics for big outcomes (verdicts, elections, battle results), so that I feel the stakes.
13. As a player who dislikes vibration, I want to turn haptics off, so that I'm not bothered.
14. As a player who needs reduced motion or sensory input, I want audio and haptics to stay off by default if the system's reduce-motion or accessibility settings suggest so (design-lead call), so that the game is comfortable.
15. As a developer, I want one audio API (`play('election-win')`) and one haptics API (`feedback('confirm')`) keyed by semantic ids, so that components never import audio or haptics libraries directly.
16. As a developer, I want audio ids defined in one data table mapped to assets, so that swapping minimal sounds for commissioned ones is a data change.
17. As a developer, I want the engines kept silent (no audio calls), so that layer separation holds and tests stay pure.
18. As a release manager, I want the total audio asset size inside the install-size budget set in spec 12, so that sound doesn't bloat the download.
19. As a release manager, I want every sound asset's licence recorded next to it, so that store review and credits are covered.

## Implementation Decisions

- **Dependency:** add the Expo audio module that matches the SDK chosen in spec 01. This is a tooling change, done explicitly in this spec.
- **Audio service** (a UI-layer module, not an engine): it preloads a small set of short sounds, streams the ambient bed, and exposes `play(id)`, `setMusicEnabled`, `setSfxEnabled`, and `pause`/`resume` hooked to the app-state listener. It configures the audio session to respect silent mode and to mix with others when music is off.
- **Haptics service:** replaces `ActionCluster`'s local wrapper with a shared `feedback(kind)` where `kind` is `'tap' | 'confirm' | 'success' | 'warning' | 'failure'`. No-op when disabled or on unsupported platforms.
- **Semantic id table (data):** a const map of `SoundId` to `{ asset, category: 'music' | 'sfx', licence }`, plus a const map of moment to `SoundId` and haptic kind. Moments: election won or lost, verdict, birth, death, succession, battle won or lost, epilogue, End Season, bill passed or failed.
- **Triggering:** stings fire from the presentation layer when the relevant surface becomes active in the presentation queue (spec 03), for example when the season recap shows an election result. Engines never trigger sound.
- **Settings (persisted):** add `settings: { musicEnabled: boolean; sfxEnabled: boolean; hapticsEnabled: boolean }`. This is a player preference, not run state, so store it **outside** the run save (its own key), so that starting a new game or importing a save doesn't reset it. If kept in `GameState` instead, it's a schema change and a migration (design-lead and engineering call; default is the separate key).
- **Assets (§6.12):** minimal option is about 10 short UI sounds and stings plus one ambient loop. Compress to AAC/M4A at modest bitrates.

## Testing Decisions

- **Seam: the moment-to-sound mapping (pure).** Every moment maps to an existing `SoundId`, every `SoundId` has an asset and a licence, and every music or sfx category is valid. This is a table-integrity test, like the existing `portraitAssets.test.ts` (prior art for asserting asset tables resolve).
- **Seam: the audio and haptics services, with the native module mocked.** `play` is a no-op when sfx is disabled; `pause` is called on background; `feedback` is a no-op when haptics are disabled.
- **Seam: settings persistence.** Settings survive a new game and an import (they're under a separate key).
- Audio feel, levels and timing are verified on device. Record it in the release checklist.

## Out of Scope

- Voice-over.
- Adaptive or dynamic music systems.
- Sound for the tutorial captions (could follow later).

## Further Notes

- If §6.12 picks "minimal UI sounds only", stories 1 and 6 reduce to optional, and the ambient bed can be omitted. The layer is unchanged.
