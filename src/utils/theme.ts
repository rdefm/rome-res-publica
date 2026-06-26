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
  dignitasColor: '#a8c4d4',
  gratiaColor:   '#6a3d8f',
  denariiColor:  '#d4a017',
  gravitasColor: '#c9a84c',
  // Chunk 7 tokens (previously hardcoded in EndSeasonButton / OfficeRung)
  goldBronze:    '#a07840',   // eligible office rung border/button
  crimsonDark:   '#6b1414',   // end season button top border highlight
  crimsonMuted:  '#c09090',   // end season button inactive text
  // Redesign tokens (domus-visual-redesign-plan-v2)
  parchment:       '#e8dcc8',  // family card backgrounds
  parchmentBorder: '#b8a070',  // family card borders
  parchmentText:   '#2a1f0e',  // dark text on parchment
  parchmentMid:    '#5a4a30',  // mid-tone text on parchment (role labels)
  parchmentDark:   '#4a3a22',  // darker text on parchment (stat text)
  portraitPlaceholder: '#c8b890', // portrait placeholder fill
  terracotta:      '#8B3A2A',  // fresco background fallback colour
  goldBorder:      '#8B6914',  // structural frame borders / coin ornaments (darker than gold)
  crimsonDeep:     '#4a1a1a',  // END SEASON button fill
  crimsonBlack:    '#2a0a0a',  // END SEASON button bottom border shadow
};

export const FONTS = {
  display: 'Georgia',        // headings, names, office titles
  body:    'Georgia',        // body / descriptions (italic in practice)
  ui:      'System',         // numbers, labels, costs
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
export const END_SEASON_BAR_HEIGHT = 56;
export const CONTENT_PADDING_BOTTOM = TAB_BAR_HEIGHT + END_SEASON_BAR_HEIGHT + SPACING.md;
