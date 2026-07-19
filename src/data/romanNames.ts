// ─── Roman Family First-Name Pools ──────────────────────────────────────────
// Extracted from engine/inheritanceEngine.ts (Chunk C0 of
// cursus-visual-redesign-plan.md) so engine/portraitEngine.ts can reuse
// ROMAN_NAMES_FEMALE as a gender signal without duplicating the list —
// inheritanceEngine.suggestChildName's behaviour is unchanged, it just
// imports these instead of declaring them locally.

export const ROMAN_NAMES_MALE = [
  'Lucius', 'Marcus', 'Quintus', 'Titus', 'Gaius', 'Publius', 'Gnaeus',
  'Sextus', 'Aulus', 'Decimus', 'Spurius', 'Manius', 'Servius', 'Appius',
];

export const ROMAN_NAMES_FEMALE = [
  'Livia', 'Julia', 'Claudia', 'Aemilia', 'Valeria', 'Cornelia', 'Porcia',
  'Caecilia', 'Marcia', 'Tullia', 'Sempronia', 'Hortensia', 'Fulvia', 'Licinia',
];
