// Chunk I of cursustabuifixesplan.md — pulled out to a standalone const so
// tabInactive below can reference it directly (CLAUDE.md's token rule: a
// new token that's semantically-the-same-value as an existing one must
// reference it, not restate the literal).
const waxFrame = '#5a3c1a';

// QA Audit Fix Plan, Chunk A — same reasoning as waxFrame above: gildFrame/
// panelWood/lockedText (Cursus Tab Visual Redesign, Chunk C1) need to
// reference dust/goldBorder/crimsonBlack directly rather than restating
// their literals (a documented-but-unenforced equivalence until now — a
// future retune of one could silently desync the other).
const dust = '#9c8e7e';
const goldBorder = '#8B6914';
const crimsonBlack = '#2a0a0a';

export const COLORS = {
  bg:            '#1a1714',
  panelSurface:  '#2e2a24',
  panelElevated: '#342e26',
  border:        '#4a3f2f',
  gold:          '#c9a84c',
  goldDim:       '#7a6230',
  marble:        '#f0ebe0',
  dust,
  laurel:        '#3d6b4f',
  crimson:       '#8b1a1a',
  senatBlue:     '#a8c4d4',   // original (typo preserved — do not rename, breaks other files)
  senateBlue:    '#a8c4d4',   // alias used by redesign plan
  purple:        '#6a3d8f',
  amber:         '#d4a017',
  // Resource colours
  denariiColor:  '#d4a017',
  fidesColor:        '#c9a84c',   // gold — the Fides resource colour
  lifetimeDignColor: '#a8c4d4',   // blue — Dignitas display in Domus
  // Chunk 7 tokens (previously hardcoded in EndSeasonButton / OfficeRung)
  goldBronze:    '#a07840',
  crimsonDark:   '#6b1414',
  crimsonMuted:  '#c09090',
  // Wax tablet palette (P1-C — AgendaTablet)
  // The tabula cerata: wooden frame around a dark wax writing surface.
  waxSurface:        '#141210',  // near-black warm umber — the wax field
  waxFrame,                      // warm wood brown — the tablet surround
  waxInscription:    '#d4c8a0',  // pale scratched text — primary item text
  waxInscriptionDim: '#7a6e50',  // dimmer secondary — detail lines, subheaders
  // Chunk I of cursustabuifixesplan.md — TabBar.tsx's inactive icon/label
  // tint was a hardcoded '#9a8060' (light tan), too low-contrast against the
  // light marble tab-bar background. waxFrame is already a dark, warm brown
  // built for exactly this kind of "readable against a light surface" case.
  tabInactive: waxFrame,
  // Redesign tokens (domus-visual-redesign-plan-v2)
  parchment:       '#e8dcc8',
  parchmentBorder: '#b8a070',
  parchmentText:   '#2a1f0e',
  parchmentMid:    '#5a4a30',
  parchmentDark:   '#4a3a22',
  portraitPlaceholder: '#c8b890',
  terracotta:      '#8B3A2A',
  goldBorder,
  crimsonDeep:     '#4a1a1a',
  crimsonBlack,
  // Cursus Tab Visual Redesign plan, Chunk C1 — gilded-panel tokens.
  // Finding 5 audit: gildFrame/panelWood/lockedText reuse existing Domus
  // tokens (goldBorder/crimsonBlack/dust) rather than minting near-dupes;
  // rivet/gildFrameDark/sealWaxGrey/scrim* have no existing equivalent.
  gildFrame:       goldBorder,
  gildFrameDark:   '#6E5426',
  rivet:           '#D9B45C',
  panelWood:       crimsonBlack,
  sealWaxGrey:     '#8E8A82',
  lockedText:      dust,
  // Retuned post-launch — the original 0.35 top alpha read as "a dark
  // filter over the whole image" rather than "clearly visible behind the
  // title" (design delta 6's actual intent); 0.1 keeps gold title text
  // legible without visibly darkening the fresco right where it should
  // read clearest.
  scrimTop:        'rgba(20,14,8,0.1)',
  // Chunk A of cursustabuifixesplan.md — 0.88 read as a near-opaque
  // "dark filter" blotting out the fresco under the office list once the
  // sizing bug (image not covering its full container) was fixed; 0.58
  // keeps office-list text legible while leaving the image visible.
  scrimBottom:     'rgba(20,14,8,0.58)',
};

// QA Audit Fix Plan, Chunk A — a `#rrggbb` COLORS token at an alpha other
// than 1, computed from the token rather than a hand-typed `rgba(r,g,b,a)`
// literal with a comment merely claiming the equivalence (GildedPanel.tsx's
// prior background-color value, since fixed to call this).
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Typography ───────────────────────────────────────────────────────────────
// Cinzel loaded via useFonts in App.tsx.
// FONTS.display / FONTS.displayLight resolve to Cinzel once loaded.

export const FONTS = {
  display:      'Cinzel-Bold',      // Roman display caps — headings, names, button labels
  displayLight: 'Cinzel-Regular',   // lighter weight for subtitles, secondary headings
  body:         'Georgia-Italic',   // italic narrative text — descriptions, log, ambition
  bodyRegular:  'Georgia',          // non-italic body
  ui:           'System',           // numbers, stat values, resource counts, badges
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 2,
  md: 4,
  lg: 12,
};

export const RESOURCE_BAR_HEIGHT = 60;
export const TAB_BAR_HEIGHT = 60;
export const END_SEASON_BAR_HEIGHT = 92;   // 949x263 image at 85% screen width ~330px
export const CONTENT_PADDING_BOTTOM = 180;  // TAB_BAR(60) + gap(70) + slab(~92) + margin(16)
