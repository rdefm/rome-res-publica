// ─── Action Impact Text ──────────────────────────────────────────────────────
// Chunk C4 of cursus-visual-redesign-plan.md — pure formatter turning an
// OfficeAction's internal successEffect token string into a short list of
// human-readable delta lines for OfficeActionsModal's read-only preview rows
// (e.g. "+15 Gold", "+2 Corruption"). Scoped to the resource-key vocabulary
// actually used by data/offices.ts's successEffect strings (verified by grep
// against every `[a-zA-Z]+[+-]\d+` token in that file) — NOT a general
// parser for every effect-string dialect in the codebase (bills/events use a
// much larger vocabulary elsewhere; out of scope for this presentational
// chunk). setFlag:/crisis-/other colon- or hyphen-delimited special tokens
// are intentionally skipped — they're state plumbing, not player-facing
// deltas, and the action's own `desc` + `consequences[].description`
// already narrate the meaningful outcome.

import type { OfficeAction } from '../models/office';

const RESOURCE_LABELS: Record<string, string> = {
  gold: 'Gold',
  corruption: 'Corruption',
  fides: 'Fides',
  plebs: 'Plebs',
  martialBonus: 'Martial',
  treasury: 'Treasury',
  stability: 'Stability',
  lifetimeDignitas: 'Dignitas',
  imperium: 'Imperium',
};

const TOKEN_RE = /^([a-zA-Z]+)([+-]\d+)$/;

/** One line per recognised successEffect token, in the string's own order,
 *  followed by each consequences[] entry's existing human-readable
 *  description (already authored for exactly this purpose — see
 *  models/office.ts's CrossTabConsequence.description doc comment). */
export function describeActionImpact(action: OfficeAction): string[] {
  const lines: string[] = [];

  if (action.successEffect) {
    for (const segment of action.successEffect.split('|').map(s => s.trim()).filter(Boolean)) {
      const match = segment.match(TOKEN_RE);
      if (!match) continue; // setFlag:*, crisis-*, etc. — not a player-facing delta
      const [, key, deltaStr] = match;
      const label = RESOURCE_LABELS[key];
      if (!label) continue;
      const delta = parseInt(deltaStr, 10);
      lines.push(`${delta > 0 ? '+' : ''}${delta} ${label}`);
    }
  }

  for (const consequence of action.consequences ?? []) {
    lines.push(consequence.description);
  }

  return lines;
}
