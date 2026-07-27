// Curia Tab Redesign, Chunk C3 — moved out of CuriaScreen.tsx (formerly
// CuriaScreen.tsx:489-529) so both BillDetailModal and LawDetailModal can
// share it. Pure formatter, no React — same "shared string formatter" role
// engine/actionImpactText.ts plays for office actions, but this one belongs
// in utils/ since it isn't scoped to an engine area.
//
// Mirrors the token vocabulary applyEffectString (resourceEngine.ts) actually
// understands, so callers only ever show effects that really happen —
// colon tokens (setFlag, addClient, etc.) are internal bookkeeping and skipped.

import type { CrisisTrackId } from '../models/crisis';

const EFFECT_LABELS: Record<string, string> = {
  fides: 'Fides',
  denarii: 'Denarii',
  gold: 'Denarii',
  lifetimeDignitas: 'Dignitas',
  stability: 'Stability',
  plebs: 'Plebs Mood',
  treasury: 'Treasury',
  imperium: 'Imperium',
  corruption: 'Corruption',
  popularesRel: 'Populares Standing',
  optimatesRel: 'Optimates Standing',
};

const CRISIS_EFFECT_LABELS: Record<CrisisTrackId, string> = {
  war: 'War Crisis',
  unrest: 'Unrest',
  constitution: 'Constitution Crisis',
  economy: 'Economy Crisis',
};

export function formatEffectString(effectStr: string | undefined): string[] {
  if (!effectStr) return [];
  const parts: string[] = [];
  for (const raw of effectStr.split('|').map(s => s.trim()).filter(Boolean)) {
    const crisisMatch = raw.match(/^crisis-(war|unrest|constitution|economy)([+-]\d+)$/);
    if (crisisMatch) {
      const delta = parseInt(crisisMatch[2], 10);
      parts.push(`${delta > 0 ? '+' : ''}${delta} ${CRISIS_EFFECT_LABELS[crisisMatch[1] as CrisisTrackId]}`);
      continue;
    }
    if (raw.includes(':')) continue; // internal bookkeeping token — not player-facing
    const match = raw.match(/^([a-zA-Z]+)([+-]\d+)$/);
    if (!match) continue;
    const label = EFFECT_LABELS[match[1]];
    if (!label) continue; // unrecognized/legacy key
    const delta = parseInt(match[2], 10);
    parts.push(`${delta > 0 ? '+' : ''}${delta} ${label}`);
  }
  return parts;
}
