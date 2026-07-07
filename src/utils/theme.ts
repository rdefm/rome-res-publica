export const COLORS = {
  bg:            '#1a1714',
  panelSurface:  '#2e2a24',
  panelElevated: '#342e26',
  border:        '#4a3f2f',
  gold:          '#c9a84c',
  goldDim:       '#7a6230',
  marble:        '#f0ebe0',
  dust:          '#9c8e7e',
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
  // Deprecated — kept for now, may still be referenced in untouched files.
  // Will be removed in the G5 verification pass once confirmed unused.
  dignitasColor: '#a8c4d4',
  gratiaColor:   '#6a3d8f',
  gravitasColor: '#c9a84c',
  // Chunk 7 tokens (previously hardcoded in EndSeasonButton / OfficeRung)
  goldBronze:    '#a07840',
  crimsonDark:   '#6b1414',
  crimsonMuted:  '#c09090',
  // Wax tablet palette (P1-C — AgendaTablet)
  // The tabula cerata: wooden frame around a dark wax writing surface.
  waxSurface:        '#141210',  // near-black warm umber — the wax field
  waxFrame:          '#5a3c1a',  // warm wood brown — the tablet surround
  waxInscription:    '#d4c8a0',  // pale scratched text — primary item text
  waxInscriptionDim: '#7a6e50',  // dimmer secondary — detail lines, subheaders
  // Redesign tokens (domus-visual-redesign-plan-v2)
  parchment:       '#e8dcc8',
  parchmentBorder: '#b8a070',
  parchmentText:   '#2a1f0e',
  parchmentMid:    '#5a4a30',
  parchmentDark:   '#4a3a22',
  portraitPlaceholder: '#c8b890',
  terracotta:      '#8B3A2A',
  goldBorder:      '#8B6914',
  crimsonDeep:     '#4a1a1a',
  crimsonBlack:    '#2a0a0a',
};

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
