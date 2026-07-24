// ─── Event Audit Script — Phase 5, Chunk P5-A ───────────────────────────────
// Ground-truth report for the event pass (P5-B/C/D write against this, not
// vibes). Run with `npm run audit:events`.
//
// Counting rule (per the phase 5 plan's P5-A instruction): "the 80–120
// target counts the random-draw pool only." The random-draw pool is exactly
// what turnSequencer.ts step 12 spreads into eventEngine.pickRandomEvent:
// [...EVENT_DEFS, ...WAR_EVENT_DEFS, ...CADET_EVENT_DEFS, ...COMPROMISING_EVENT_DEFS].
// Within those four arrays, only weight > 0 entries are ever actually
// eligible to be picked (eventEngine.isEventEligible short-circuits weight
// 0 to false) — weight-0 entries in those same files are follow-up/notice
// scenes reached only via nextEventId or force-injection, not the random
// draw. Scripted/queued-only pools (tutorial, succession, secret, Claudius
// arc) never enter pickRandomEvent at all and are reported separately for
// completeness, not folded into the 80–120 count.

import { EVENT_DEFS } from '../src/data/events';
import { WAR_EVENT_DEFS } from '../src/data/warEvents';
import { CADET_EVENT_DEFS } from '../src/data/cadetEvents';
import { COMPROMISING_EVENT_DEFS } from '../src/data/compromisingEvents';
import { TUTORIAL_EVENT_DEFS } from '../src/data/tutorialEvents';
import { SUCCESSION_EVENT_DEFS } from '../src/data/successionEvents';
import { SECRET_EVENT_DEFS } from '../src/data/secretEvents';
import { CLAUDIUS_ARC_EVENT_DEFS } from '../src/data/claudiusArc';
import type { EventDef, EventCondition, EventChoice } from '../src/models/event';

interface Pool {
  name: string;
  defs: EventDef[];
}

const RANDOM_POOLS: Pool[] = [
  { name: 'EVENT_DEFS', defs: EVENT_DEFS },
  { name: 'WAR_EVENT_DEFS', defs: WAR_EVENT_DEFS },
  { name: 'CADET_EVENT_DEFS', defs: CADET_EVENT_DEFS },
  { name: 'COMPROMISING_EVENT_DEFS', defs: COMPROMISING_EVENT_DEFS },
];

const SCRIPTED_POOLS: Pool[] = [
  { name: 'TUTORIAL_EVENT_DEFS', defs: TUTORIAL_EVENT_DEFS },
  { name: 'SUCCESSION_EVENT_DEFS', defs: SUCCESSION_EVENT_DEFS },
  { name: 'SECRET_EVENT_DEFS', defs: SECRET_EVENT_DEFS },
  { name: 'CLAUDIUS_ARC_EVENT_DEFS', defs: CLAUDIUS_ARC_EVENT_DEFS },
];

// An event is "in the random draw" iff it's in one of RANDOM_POOLS AND has
// weight > 0 AND isn't isTutorial (none of these 4 pools set isTutorial
// today, but the check mirrors eventEngine.isEventEligible exactly).
function isRandomDrawEligible(def: EventDef): boolean {
  return def.weight > 0 && !def.isTutorial;
}

const randomPoolDefs = RANDOM_POOLS.flatMap(p => p.defs.filter(isRandomDrawEligible));

// ─── Season breakdown ────────────────────────────────────────────────────────

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function hasHardSeasonCondition(def: EventDef): number[] {
  return def.conditions
    .filter((c): c is Extract<EventCondition, { type: 'season' }> => c.type === 'season')
    .map(c => c.index);
}

// ─── Condition-family tally ──────────────────────────────────────────────────

function tallyConditionFamilies(defs: EventDef[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const def of defs) {
    for (const cond of def.conditions) {
      tally[cond.type] = (tally[cond.type] ?? 0) + 1;
    }
    if (def.conditions.length === 0) tally['(unconditioned)'] = (tally['(unconditioned)'] ?? 0) + 1;
  }
  return tally;
}

// ─── Weight histogram ────────────────────────────────────────────────────────

function weightBand(w: number): string {
  if (w <= 0) return '0 (follow-up/notice)';
  if (w <= 2) return '1–2';
  if (w <= 4) return '3–4';
  if (w <= 6) return '5–6';
  if (w <= 8) return '7–8';
  if (w <= 10) return '9–10';
  return '11+';
}

function histogram(values: string[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const v of values) h[v] = (h[v] ?? 0) + 1;
  return h;
}

// ─── Effect-magnitude fingerprint ────────────────────────────────────────────
// A crude but sufficient economy fingerprint (per the phase plan's own
// framing) — NOT a re-implementation of resourceEngine.applyEffectString
// (that needs a live GameState to apply against; this only extracts
// token→delta pairs for reporting). Only the core numeric key±N tokens are
// tracked — colon-tokens (setFlag, addClient, etc.) aren't resource
// magnitudes and are out of scope for this fingerprint.
//
// "Success-weighted where a skill check exists": a skill-checked choice's
// deterministic pass/fail depends on a stat vs. difficulty comparison, not
// a stored probability — there's no real % to weight by. As a crude proxy,
// a skill-checked choice contributes HALF of its successEffect's magnitudes
// and HALF of its failureEffect's (a rough stand-in for "sometimes you
// succeed, sometimes you don't"); a guaranteed (no skill check) choice
// contributes its full successEffect. This is intentionally approximate —
// good enough to catch an outlier event, not a precise EV calculator.

const NUMERIC_TOKEN_RE = /^(fides|lifetimeDignitas|denarii|gold|crisisLevel|crisis|stability|plebs|treasury|corruption|popularesRel|optimatesRel|imperium|rhetoric|martial|intrigus|martialBonus|cadetStanding)([+-]\d+)$/;
const CRISIS_TRACK_RE = /^crisis-(war|unrest|constitution|economy)([+-]\d+)$/;

function extractTokenDeltas(effectStr: string): { token: string; delta: number }[] {
  if (!effectStr) return [];
  const out: { token: string; delta: number }[] = [];
  for (const raw of effectStr.split('|').map(s => s.trim()).filter(Boolean)) {
    const trackMatch = raw.match(CRISIS_TRACK_RE);
    if (trackMatch) {
      out.push({ token: `crisis-${trackMatch[1]}`, delta: parseInt(trackMatch[2], 10) });
      continue;
    }
    const match = raw.match(NUMERIC_TOKEN_RE);
    if (match) {
      const token = match[1] === 'gold' ? 'denarii' : match[1] === 'martialBonus' ? 'martial' : match[1];
      out.push({ token, delta: parseInt(match[2], 10) });
    }
  }
  return out;
}

function choiceContribution(choice: EventChoice): { token: string; delta: number }[] {
  const successDeltas = extractTokenDeltas(choice.successEffect);
  if (!choice.skillCheck) return successDeltas;
  const failureDeltas = extractTokenDeltas(choice.failureEffect);
  const half = (d: { token: string; delta: number }[]) => d.map(x => ({ token: x.token, delta: x.delta * 0.5 }));
  return [...half(successDeltas), ...half(failureDeltas)];
}

interface TokenStats {
  sum: number;
  count: number;
}

function magnitudeFingerprint(defs: EventDef[]): Record<string, TokenStats> {
  const stats: Record<string, TokenStats> = {};
  for (const def of defs) {
    for (const choice of def.choices) {
      for (const { token, delta } of choiceContribution(choice)) {
        if (!stats[token]) stats[token] = { sum: 0, count: 0 };
        stats[token].sum += delta;
        stats[token].count += 1;
      }
    }
  }
  return stats;
}

// ─── Report ───────────────────────────────────────────────────────────────

function printReport() {
  console.log('═══ Event Audit — Phase 5, Chunk P5-A ═══\n');

  console.log('── Pool sizes (raw array length) ──');
  for (const pool of [...RANDOM_POOLS, ...SCRIPTED_POOLS]) {
    console.log(`  ${pool.name}: ${pool.defs.length}`);
  }

  console.log('\n── Random-draw pool (the 80–120 target) ──');
  console.log(`  Total random-draw-eligible events: ${randomPoolDefs.length}`);
  for (const pool of RANDOM_POOLS) {
    const eligible = pool.defs.filter(isRandomDrawEligible).length;
    console.log(`    from ${pool.name}: ${eligible} (of ${pool.defs.length} total in file)`);
  }

  console.log('\n── By season (random-draw pool only) ──');
  const hardGated: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let softWeighted = 0;
  let neutral = 0;
  for (const def of randomPoolDefs) {
    const hard = hasHardSeasonCondition(def);
    if (hard.length > 0) {
      for (const idx of hard) hardGated[idx]++;
    } else if (def.seasons && def.seasons.length > 0) {
      softWeighted++;
    } else {
      neutral++;
    }
  }
  for (let i = 0; i < 4; i++) console.log(`  Hard-gated to ${SEASON_NAMES[i]}: ${hardGated[i]}`);
  console.log(`  Soft-weighted (seasons field): ${softWeighted}`);
  console.log(`  Season-neutral (unconditioned by season): ${neutral}`);

  console.log('\n── By office gate ──');
  const officeGated = randomPoolDefs.filter(d => d.conditions.some(c => c.type === 'office'));
  console.log(`  Office-gated: ${officeGated.length}`);
  for (const def of officeGated) {
    const held = def.conditions.find((c): c is Extract<EventCondition, { type: 'office' }> => c.type === 'office')!.held;
    console.log(`    ${def.id} → ${held}`);
  }

  console.log('\n── By condition family (random-draw pool) ──');
  const familyTally = tallyConditionFamilies(randomPoolDefs);
  for (const [family, count] of Object.entries(familyTally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${family}: ${count}`);
  }

  console.log('\n── By weight band (random-draw pool) ──');
  const weightHist = histogram(randomPoolDefs.map(d => weightBand(d.weight)));
  for (const [band, count] of Object.entries(weightHist).sort()) {
    console.log(`  ${band}: ${count}`);
  }
  const weights = randomPoolDefs.map(d => d.weight).sort((a, b) => a - b);
  const median = weights.length > 0 ? weights[Math.floor(weights.length / 2)] : 0;
  console.log(`  Median weight: ${median}`);

  console.log('\n── Effect magnitude fingerprint (random-draw pool, success-weighted) ──');
  const fingerprint = magnitudeFingerprint(randomPoolDefs);
  for (const [token, { sum, count }] of Object.entries(fingerprint).sort((a, b) => b[1].count - a[1].count)) {
    const mean = count > 0 ? sum / count : 0;
    console.log(`  ${token}: sum=${sum.toFixed(1)} mean=${mean.toFixed(2)} (n=${count})`);
  }
  const netExpectedValue = Object.values(fingerprint).reduce((s, t) => s + t.sum, 0);
  console.log(`\n  Net expected-value-ish sum across all tracked tokens: ${netExpectedValue.toFixed(1)} (rough neutrality check, not a real EV calc — different tokens aren't fungible)`);

  console.log('\n── Gap matrix: season × domain (random-draw pool) ──');
  console.log('  (domain inferred from imageKey/id prefix is unreliable — hand-classify in docs/content-audit.md instead; this script reports the raw season/office/condition counts above as its input.)');

  console.log('\n═══ End of report ═══');
}

printReport();
