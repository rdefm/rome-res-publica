// ─── Epilogue Text ────────────────────────────────────────────────────────────
// Phase 3, Chunk P3-E — the "what the historians wrote" paragraph. A
// template-slot assembler (no AI): a handful of outcome-keyed opening
// phrases, filled from the AncestorRecord, with fallback phrasing for a
// sparse run (no office ever held, no notable beats) so the sentence never
// reads as broken or empty.

import type { AncestorRecord } from '../models/epilogue';
import { OFFICES } from './offices';

type RecordDraft = Omit<AncestorRecord, 'historianParagraph'>;

function officeLabel(officeId: string | null): string | null {
  if (!officeId) return null;
  return OFFICES.find(o => o.id === officeId)?.name ?? null;
}

// 3-4 opening phrases per outcome — picked deterministically from the
// record itself (endedYear parity) rather than Math.random(), so the same
// finished run always reads the same way if the epilogue is ever re-viewed
// (the Hall of Ancestors is read-only, re-derived from the stored record's
// own historianParagraph field in practice, but determinism costs nothing).
const OPENERS: Record<AncestorRecord['outcome'], string[]> = {
  victory: [
    'Rome remembers this as a war well won, and the Gens {gensName} among those who won it.',
    'History records a clean victory — and the Gens {gensName} standing in its light.',
    'The war ended as Rome hoped it would, with the Gens {gensName} among the families it hoped it would.',
  ],
  exhaustion: [
    'No triumph crowned this war\'s end — only the quiet of two sides too worn to fight on. The Gens {gensName} endured it.',
    'The historians write of exhaustion, not glory — a peace both sides needed more than either wanted. The Gens {gensName} was there for all of it.',
    'This was not the war Rome remembers fondly. The Gens {gensName} outlasted it regardless.',
  ],
  humbled: [
    'Rome was humbled in this war, and the Gens {gensName} shared the humbling.',
    'History is not kind to this chapter of the Republic — nor, in it, to the Gens {gensName}.',
    'The terms were dictated, not negotiated. The Gens {gensName} lived to see it.',
  ],
  republic_falls: [
    'The Republic itself did not survive what came for it — and the Gens {gensName} watched it happen.',
    'Historians mark this as the year the Republic broke. The Gens {gensName} was among the last to hold on.',
    'What the Gens {gensName} built, it built inside a Republic that did not outlast it.',
  ],
  gens_ends: [
    // Phase 5, Chunk P5-E — was hardcoded 'Brutia', not interpolated, found
    // during the gens-neutrality sweep.
    'The name {gensName} is, from this point, spoken only in the past tense.',
    'The Gens {gensName} ends here — not with the Republic, which endures without it.',
    'History continues. The Gens {gensName} does not.',
  ],
};

function fillOffice(record: RecordDraft): string {
  const label = officeLabel(record.highestOffice);
  if (label) return `rose as high as ${label}`;
  return record.generations > 1
    ? 'never reached the offices its ambitions aimed at'
    : 'had barely begun before its story ended';
}

function fillBeats(record: RecordDraft): string {
  if (record.notableBeats.length === 0) return 'a quiet run, by the standards of the age';
  if (record.notableBeats.length === 1) return record.notableBeats[0];
  const [first, ...rest] = record.notableBeats;
  return `${first}, and ${rest.join(', ')}`;
}

function fillGenerations(record: RecordDraft): string {
  return record.generations === 1
    ? 'in a single generation'
    : `across ${record.generations} generations`;
}

export function assembleHistorianParagraph(record: RecordDraft): string {
  const openers = OPENERS[record.outcome];
  const opener = openers[Math.abs(record.endedYear) % openers.length].replace('{gensName}', record.gensName);

  const middle = record.outcome === 'gens_ends'
    ? `Across the years it held, the household ${fillOffice(record)}, and men remembered ${fillBeats(record)}.`
    : `The household ${fillOffice(record)} ${fillGenerations(record)}, and men remembered ${fillBeats(record)}.`;

  // Phase 4, Chunk P4-F — the famous-trial sentence slot. A dedicated
  // sentence rather than folding into fillBeats, so the run's single Cicero
  // moment (if any) always reads as its own beat regardless of how crowded
  // notableBeats already is.
  const famousTrialSentence = record.famousTrial ? ` Rome still speaks of ${record.famousTrial}.` : '';

  return `${opener} ${middle}${famousTrialSentence}`;
}
