# Curia Redesign — Asset Manifest

All 15 assets are optional at the code level — `src/utils/curiaAssets.ts` falls back gracefully
(flat theme color / emoji / plain View) for every one of these if the file doesn't exist. Nothing
here blocks a build.

**Wiring status:** all 15 assets are now wired to a real consumer. `porphyryTile` (pinned header
field), `bronzeTile` (`LawCard`'s plaque), `stoneTile` (`SubTabBar`'s tabs), and all 3 `coinFace`
entries (`ActionCluster`'s VOTE/SPEECH/FILIBUSTER buttons) were registered in Chunk C0 but never
actually consumed by any component through C1–C6 — that gap was closed in a post-launch fix.
Every asset below will render the moment the file exists at the given path; every one also has a
tested, graceful fallback (flat colour or plain View) if it never arrives.

File paths below are all relative to `src/assets/curia/` (create this folder — it doesn't exist yet).

---

## 1. Seamless tiles (4 files)

Seamless, tileable, flat/even lighting — **no vignette, no directional shadow, no baked-in focal
detail**. These render behind content of *varying* height via `resizeMode="repeat"`, so a
non-tileable image or one with a vignette will look obviously stretched/repeated. Verify tiling by
viewing the file at 3× its own height before accepting it.

| Asset | Filename | Proportion | Status | AI generator prompt |
|---|---|---|---|---|
| Porphyry tile | `tile-porphyry.png` | 1:1 square, 256×256px | ✅ wired | `Seamless tileable texture of polished imperial porphyry stone, deep purple-red surface with small white and grey mineral flecks, flat even studio lighting, no vignette, no directional shadow, no visible seam at the edges, square crop, high micro-detail, no text, no objects, no color gradient across the frame` |
| Bronze tile | `tile-bronze.png` | 1:1 square, 256×256px | ✅ wired | `Seamless tileable texture of aged bronze metal, subtle hammered surface, warm brown-gold patina with faint verdigris flecks, flat even studio lighting, no vignette, no directional shadow, no visible seam at the edges, square crop, no text, no objects, no color gradient across the frame` |
| Stone tile | `tile-stone.png` | 1:1 square, 256×256px | ✅ wired | `Seamless tileable texture of pale grey travertine limestone, subtle natural veining, flat even studio lighting, no vignette, no directional shadow, no visible seam at the edges, square crop, no text, no objects, no color gradient across the frame` |
| Terracotta tile | `tile-terracotta.png` | 1:1 square, 256×256px | ✅ wired | `Seamless tileable texture of unglazed terracotta clay, warm orange-brown surface, faint throwing-ring and fingerprint texture, flat even studio lighting, no vignette, no directional shadow, no visible seam at the edges, square crop, no text, no objects, no color gradient across the frame` |

---

## 2. Crisis track icons (4 files)

**Generate all four in one session with the same prompt scaffold.** Identical canvas, identical
lighting direction, matched optical weight, transparent background, pristine/undamaged, centred
with consistent margin. These four sit side by side in a fixed grid — inconsistency between them
is maximally visible there, more so than the quality of any single one.

Style matches the game's existing office-icon convention (`cursusAssets.ts`): bronze bas-relief,
engraved line style.

| Asset | Filename | Proportion | Status | AI generator prompt |
|---|---|---|---|---|
| War icon | `icon-crisis-war.png` | 1:1 square, 1024×1024px master (export @1x/@2x/@3x at 24/48/72px) | ✅ wired | `Bronze bas-relief icon of a Roman shield (scutum) crossed behind a gladius sword, engraved line style, centered with a 15% margin, pristine and undamaged, transparent background, warm dark bronze tone only, soft single-direction studio lighting from upper-left, no text, no color other than bronze and dark brown, no cast shadow beyond the object itself` |
| Unrest icon | `icon-crisis-unrest.png` | 1:1 square, 1024×1024px master | ✅ wired | `Bronze bas-relief icon of a single lit torch, engraved line style, centered with a 15% margin, pristine and undamaged, transparent background, warm dark bronze tone only, soft single-direction studio lighting from upper-left, no text, no color other than bronze and dark brown, no cast shadow beyond the object itself` |
| Constitution icon (MOS) | `icon-crisis-constitution.png` | 1:1 square, 1024×1024px master | ✅ wired | `Bronze bas-relief icon of a fasces — a bundle of wooden rods bound around a protruding axe blade — engraved line style, centered with a 15% margin, pristine and undamaged, transparent background, warm dark bronze tone only, soft single-direction studio lighting from upper-left, no text, no color other than bronze and dark brown, no cast shadow beyond the object itself` |
| Economy icon | `icon-crisis-economy.png` | 1:1 square, 1024×1024px master | ✅ wired | `Bronze bas-relief icon of a two-handled Roman amphora jar, engraved line style, centered with a 15% margin, pristine and undamaged, transparent background, warm dark bronze tone only, soft single-direction studio lighting from upper-left, no text, no color other than bronze and dark brown, no cast shadow beyond the object itself` |

---

## 3. Damage overlays (4 files)

Transparent layers composited **over** all four icons above, one damage tier at a time (tier 0 —
pristine — has no overlay at all; these cover tiers 1–4). **Same canvas and margins as the icon
series.** Must be neutral/greyscale — the game tints them per-track at runtime
(`CRISIS_TIER_VISUAL`), so any color baked into the overlay itself will fight that tinting.

| Asset | Filename | Proportion | Status | AI generator prompt |
|---|---|---|---|---|
| Damage overlay, tier 1 | `damage-overlay-1.png` | 1:1 square, 1024×1024px, same crop as icons | ✅ wired | `Transparent PNG overlay of fine hairline cracks radiating outward, minimal and barely visible, greyscale tone only with no color, centered on a 1024×1024 canvas with the same margins as a bronze bas-relief icon, subtle and semi-transparent, no background, no text, no other objects` |
| Damage overlay, tier 2 | `damage-overlay-2.png` | 1:1 square, 1024×1024px, same crop as icons | ✅ wired | `Transparent PNG overlay of heavier visible cracks with small chipped edges, greyscale tone only with no color, centered on a 1024×1024 canvas with the same margins as a bronze bas-relief icon, semi-transparent, no background, no text, no other objects` |
| Damage overlay, tier 3 | `damage-overlay-3.png` | 1:1 square, 1024×1024px, same crop as icons | ✅ wired | `Transparent PNG overlay of heavy cracks, chipped edges, and dark soot or scorch discolouration patches, greyscale tone only with no color, centered on a 1024×1024 canvas with the same margins as a bronze bas-relief icon, semi-transparent, no background, no text, no other objects` |
| Damage overlay, tier 4 | `damage-overlay-4.png` | 1:1 square, 1024×1024px, same crop as icons | ✅ wired | `Transparent PNG overlay of broken and crumbling edges, deep fissures, and glowing ember hotspots inside the cracks, greyscale tone only with no color (the ember glow itself is added separately by the app), centered on a 1024×1024 canvas with the same margins as a bronze bas-relief icon, semi-transparent, no background, no text, no other objects` |

---

## 4. Vote coin faces (3 files, optional)

`ActionCluster.tsx`'s VOTE/SPEECH/FILIBUSTER buttons stay rectangular panels with text — the coin
face renders as a small (18×18pt) circular image *above* the label when present, not a full
circular-button redesign. When absent, the button looks exactly as it always has, no placeholder
circle. A styled circular View with an embossed border remains an acceptable fallback per the
original plan — these are the lowest-priority of the 15, purely a nice-to-have accent.

| Asset | Filename | Proportion | Status | AI generator prompt |
|---|---|---|---|---|
| Vote coin face | `coin-vote.png` | 1:1 square, 256×256px | ✅ wired | `A circular Roman denarius coin face, embossed metal relief, transparent background, centered, a hand dropping a voting tablet into a tall urn, aged silver-bronze tone, no text, no modern elements` |
| Speech coin face | `coin-speech.png` | 1:1 square, 256×256px | ✅ wired | `A circular Roman denarius coin face, embossed metal relief, transparent background, centered, a robed orator standing with one arm raised mid-speech, aged silver-bronze tone, no text, no modern elements` |
| Filibuster coin face | `coin-filibuster.png` | 1:1 square, 256×256px | ✅ wired | `A circular Roman denarius coin face, embossed metal relief, transparent background, centered, a standing robed figure blocking a doorway with one arm outstretched, aged silver-bronze tone, no text, no modern elements` |

---

## Not needed — already covered without new art

- **Wax seals** — reuses the existing `cursusAssets.waxSeal`, tinted three ways at runtime (pass/close/fail). Do not generate a separate Curia seal.
- **Voting tablets (tabellae)** — shaped `View`s with text, no image.
- **Panel rivets** — `GildedPanel` draws them as plain `View`s, no image.

---

## Production notes

- Ship `@2x`/`@3x` variants per the existing `src/assets/images/` convention (e.g. `tile-porphyry.png`, `tile-porphyry@2x.png`, `tile-porphyry@3x.png`).
- Keep tiles small — `cursusAssets.ts`'s fresco background shipped at ~1010KB against a ≤400KB guidance; tiles repeat across the screen, so oversized files cost more relative to their visual contribution.
- Total: 15 files (12 load-bearing — 4 tiles + 4 icons + 4 overlays, all wired; 3 coin faces are the "nice to have" optional set).
