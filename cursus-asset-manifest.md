# Cursus Redesign — Asset Manifest

Exact file names the code is already wired to look for (every `require()` line
in `src/utils/cursusAssets.ts` and `src/utils/portraitAssets.ts` ships
commented out until the file exists — drop a file in with this exact name
and path, uncomment its line, done; no other code change needed).

The app runs fine with **none** of these present — everything below has a
code fallback (flat background, plain wax-seal circle, emoji office icons,
initials-in-a-circle portraits). Add assets whenever they're ready, in any
order.

**Two target folders:**
- `assets/cursus/` — Cursus-tab-only assets (background, seal, office icons)
- `assets/portraits/` — shared portrait pool (used by Cursus now; Domus is a
  planned future consumer)

---

## 1. Fresco background (1 file) → `assets/cursus/`

| File | Size | Format | Notes |
|---|---|---|---|
| `fresco-bg.jpg` | ~1080×2400 (or 1024×2048) | JPG, ≤ 400KB | Generate at **natural brightness** — the app darkens it with a gradient scrim in code, so don't bake in darkness yourself. No text. No faces in the top ~30% (the screen title sits there). |

**Style prompt:** *"Roman fresco, Pompeiian Fourth Style, view of the Curia and Forum with togate figures, muted terracotta / ochre / umber / faded verdigris palette, aged cracked plaster texture, soft edges, no text, no modern elements."*

---

## 2. Wax seal (1 file) → `assets/cursus/`

| File | Size | Format | Notes |
|---|---|---|---|
| `seal-wax.png` | 160×160 | PNG, transparent | Grey/silver wax, embossed check mark or laurel. One asset, reused everywhere an office shows "SERVED". |

---

## 3. Office icons (8 files) → `assets/cursus/`

| File | Subject suggestion |
|---|---|
| `icon-vigintivirate.png` | Scroll / tabula |
| `icon-quaestor.png` | Coin stack or money bag |
| `icon-tribune.png` | Bench / veto hand |
| `icon-aedile.png` | Amphitheatre arch or grain modius |
| `icon-praetor.png` | Curule chair |
| `icon-consul.png` | Fasces |
| `icon-censor.png` | Census scroll + stylus |
| `icon-dictator.png` | Fasces with axe |

All 8: **192×192, PNG, transparent.**

**Style prompt:** *"Bronze bas-relief icon of a single object, engraved line style, dark transparent background, no text."* (Monochrome bronze reads well at the 32–44px it's actually displayed at, and won't clash with the parchment/wood-panel card backgrounds.)

---

## 4. Portrait pool (60 files) → `assets/portraits/`

Every character's face ages through 6 life stages and resembles their own
family — this is a **lineage × gender × age-band** matrix, not a flat list.
This is the v1 size actually wired into the code today (1 variant per
lineage/gender — see the "optional expansion" note at the bottom).

**Naming:** `portrait-{lineage}-1-{gender}-{ageBand}.png`
**Size:** 256×256, PNG or JPG.

**Style prompt:** *"Roman-Egyptian Fayum mummy portrait style, encaustic on wood, head and shoulders, dark neutral background, muted earth palette."* Vary age/gender per file, but keep one shared style/seed reference across **all 60** so they read as one coherent set. For each lineage: generate the `adult` band first as the reference face (per gender), then generate the other 5 bands as explicit age-progressions/regressions *of that same reference face* — this is what actually produces "looks related," not just "same art style."

### `house` (the player's own family — used regardless of which starting gens is picked)
```
portrait-house-1-m-baby.png
portrait-house-1-m-child.png
portrait-house-1-m-youth.png
portrait-house-1-m-adult.png
portrait-house-1-m-midage.png
portrait-house-1-m-elder.png
portrait-house-1-f-baby.png
portrait-house-1-f-child.png
portrait-house-1-f-youth.png
portrait-house-1-f-adult.png
portrait-house-1-f-midage.png
portrait-house-1-f-elder.png
```

### `cornelii`
```
portrait-cornelii-1-m-baby.png
portrait-cornelii-1-m-child.png
portrait-cornelii-1-m-youth.png
portrait-cornelii-1-m-adult.png
portrait-cornelii-1-m-midage.png
portrait-cornelii-1-m-elder.png
portrait-cornelii-1-f-baby.png
portrait-cornelii-1-f-child.png
portrait-cornelii-1-f-youth.png
portrait-cornelii-1-f-adult.png
portrait-cornelii-1-f-midage.png
portrait-cornelii-1-f-elder.png
```

### `valerii`
```
portrait-valerii-1-m-baby.png
portrait-valerii-1-m-child.png
portrait-valerii-1-m-youth.png
portrait-valerii-1-m-adult.png
portrait-valerii-1-m-midage.png
portrait-valerii-1-m-elder.png
portrait-valerii-1-f-baby.png
portrait-valerii-1-f-child.png
portrait-valerii-1-f-youth.png
portrait-valerii-1-f-adult.png
portrait-valerii-1-f-midage.png
portrait-valerii-1-f-elder.png
```

### `fabii`
```
portrait-fabii-1-m-baby.png
portrait-fabii-1-m-child.png
portrait-fabii-1-m-youth.png
portrait-fabii-1-m-adult.png
portrait-fabii-1-m-midage.png
portrait-fabii-1-m-elder.png
portrait-fabii-1-f-baby.png
portrait-fabii-1-f-child.png
portrait-fabii-1-f-youth.png
portrait-fabii-1-f-adult.png
portrait-fabii-1-f-midage.png
portrait-fabii-1-f-elder.png
```

### `claudii`
```
portrait-claudii-1-m-baby.png
portrait-claudii-1-m-child.png
portrait-claudii-1-m-youth.png
portrait-claudii-1-m-adult.png
portrait-claudii-1-m-midage.png
portrait-claudii-1-m-elder.png
portrait-claudii-1-f-baby.png
portrait-claudii-1-f-child.png
portrait-claudii-1-f-youth.png
portrait-claudii-1-f-adult.png
portrait-claudii-1-f-midage.png
portrait-claudii-1-f-elder.png
```

---

## 5. Leader portrait overrides (13 files, optional) → `assets/portraits/`

Bespoke faces for the named rival-clan leaders. **Fully optional** — every
leader already gets a face via their clan's pooled portrait above; only add
these if you want specific named leaders to look distinct from their
clan-mates. Same size/format as the pool (256×256, PNG or JPG).

```
portrait-leader-cornelius-scipio.png
portrait-leader-cornelius-rufus.png
portrait-leader-cornelius-merula.png
portrait-leader-cornelius-scipio-minor.png
portrait-leader-valerius-flaccus.png
portrait-leader-valerius-antias.png
portrait-leader-valerius-messalla.png
portrait-leader-fabius-maximus.png
portrait-leader-fabius-buteo.png
portrait-leader-fabius-pictor.png
portrait-leader-claudius-pulcher.png
portrait-leader-claudius-marcellus.png
portrait-leader-claudius-nero.png
```

---

## Totals

| Group | Count | Required? |
|---|---|---|
| Fresco background | 1 | Optional (flat background fallback) |
| Wax seal | 1 | Optional (plain circle fallback) |
| Office icons | 8 | Optional (emoji fallback) |
| Portrait pool | 60 | Optional (initials-circle fallback) |
| Leader overrides | 13 | Optional, and only meaningful once the pool exists |
| **Total possible files** | **83** | |

## Optional future expansion (not required, no rush)

A **2nd portrait variant** per lineage/gender (so siblings within a family
don't all share one face) is supported by the code's hashing logic already,
but is **not** wired on by default — adding `portrait-{lineage}-2-{gender}-
{ageBand}.png` files alone won't be picked up until `DEFAULT_PORTRAIT_
VARIANT_COUNT` in `src/engine/portraitEngine.ts` is bumped from `1` to `2`
(a one-line code change, ask before generating 60 more images for this).
