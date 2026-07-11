// ─── Phase 4, Chunk P4-A — The Secret ────────────────────────────────────────
// Types only, no logic (see secretEngine.ts for generation/gather math and
// secretDefinitions.ts for per-type content).

export type SecretType =
  | 'affair'
  | 'impiety'
  | 'embezzlement'
  | 'electoral_fraud'
  | 'provincial_plunder';

/** affair/impiety → 'social'; everything else → 'criminal'. Derived via a
 *  lookup in secretDefinitions.ts (SECRET_CLASS_BY_TYPE) rather than stored
 *  redundantly on Secret — the save schema treats `secrets` as z.any(), so
 *  there's no schema-simplicity argument for storing it, and a derived value
 *  can't drift out of sync with its type. */
export type SecretClass = 'social' | 'criminal';

/** Who currently holds this Secret and can spend it. 'player' or a ClanLeader id. */
export type SecretHolder = 'player' | string;

/** Who the Secret is compromising. A clan leader, or a member of the player's family. */
export type SecretSubject =
  | { kind: 'leader'; leaderId: string }
  | { kind: 'family'; characterId: string };

export type SecretStatus =
  | 'held'         // usable — not yet spent
  | 'extorting'    // player verb (P4-B): recurring income, exposure risk each season
  | 'spent'        // consumed via Leverage/Burn, or extortion stopped voluntarily
  | 'exposed'      // discovered/blown — no further spends
  | 'neutralized'; // countered via Pay Off / successful Discredit (P4-B)

export interface Secret {
  id: string;
  type: SecretType;
  subject: SecretSubject;
  holder: SecretHolder;
  potency: 1 | 2 | 3;
  status: SecretStatus;
  /** GameState.turnNumber at generation — for display/ordering, not gameplay math. */
  acquiredSeason: number;
  /** Interpolated flavor text, generated once so the Secret reads as a specific
   *  scandal (e.g. "a certain irregularity in Ap. Claudius Pulcher's accounts"),
   *  not a category label. See secretDefinitions.ts's {subject} templates. */
  flavorText: string;
}
