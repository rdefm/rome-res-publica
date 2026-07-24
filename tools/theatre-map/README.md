# Theatre map tools

Two standalone, self-contained HTML files — no build step, no server, just
open in a browser. Built during the Campaign Map plan's Chunk C2 to position
city nodes and (optionally) trace region borders on the theatre map art.
Not part of the app itself; kept here for reuse whenever the map art changes.

## `city-node-positioning-tool.html`

Drag each city pin onto its correct spot on the map image; a live panel
reads out `nodeX`/`nodeY` fractions per city (grouped by region) and a
"Copy as TS" button exports a paste-ready block matching
`src/data/cityDefinitions.ts`'s literal field shape.

## `region-border-tracer-tool.html`

Pick a region tab, click around the map to trace its rough border (auto-
closes at 3+ points, drag any point to adjust), and export all 8 regions'
traced points as a paste-ready object. This is **not** wired into the app —
`models/theatre.ts`'s `Region` type has no border-points field yet; if the
traced output is ever used for real, that field needs adding first.

## Regenerating for a new map image

Both files have the current map image and the two Cinzel font weights
embedded as base64 `data:` URIs — that's what makes them work fully offline
as a single file. If the map art changes again:

1. Base64-encode the new image: `base64 -w 0 path/to/new-map.png > map.b64`
   (fonts only need re-encoding if they change too — unlikely).
2. Open either tool's HTML source and find the `src="data:image/png;base64,..."`
   attribute on the `<img class="basemap">` element; replace the base64
   payload with the new one.
3. If the new image's pixel dimensions differ from the current map
   (1024×1536, "italy-mosaic.png"), update the `aspect-ratio: 1024 / 1536`
   value in the `<style>` block's `.map-wrap` rule to match.
4. Every existing city pin's starting position (and any traced region
   borders) will be wrong on the new art and need re-placing/re-tracing —
   that's the whole point of keeping these tools around.

There's no build script for this — it was done by hand with a small Python
one-liner substituting `{{PLACEHOLDER}}` tokens in a template. Ask Claude to
redo that step if regenerating; it's mechanical.
