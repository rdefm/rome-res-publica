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

  // ── Phase 4, Chunk P4-B — spend/counterplay bookkeeping ───────────────────
  // Not in the plan's literal P4-B file list (models/secret.ts isn't named),
  // but required by the mechanics it does specify (discovery, NPC reuse/
  // cooldown) — additive, optional, so P4-A-generated Secrets need no
  // migration. Only meaningful on holder !== 'player' (family-subject)
  // Secrets; player-held Secrets against a leader are always known to the
  // player and never consult these.
  /** Whether the player knows this NPC-held Secret exists yet — false at
   *  generation (npcGatherTick), flipped true by a demand event firing or a
   *  successful counter-gather against the holder (secretEngine.attemptGather's
   *  discovery branch — reveals, does not yield a full Secret). Gates Dossier
   *  "held against you" visibility and counterplay eligibility. */
  discovered?: boolean;
  /** Times the holder has leveraged/extorted-demanded with this Secret.
   *  Leverage retains the Secret up to BALANCE.secrets.npcAi.leverageReuseLimit
   *  uses before it's spent. */
  useCount?: number;
  /** GameState.turnNumber the holder last acted with this Secret (a demand
   *  firing) — gates BALANCE.secrets.npcAi.npcUseCooldownSeasons between uses. */
  lastActedSeason?: number;
}

/**
 * The GameState side-channel carrying an NPC demand's dynamic context — same
 * shape/purpose as the pre-existing pendingCanvassLeaderId/Roll/Threshold
 * fields (gameStore.ts): EventDef is static content, so per-instance data
 * (which leader, which Secret, which bill) can't live on the injected event
 * itself. Set when the demand notice is injected (turnSequencer step 9b),
 * read + cleared by secretEngine.resolveSecretDemand via gameStore's
 * resolveEvent special-case handler.
 */
export interface PendingSecretDemand {
  secretId: string;
  leaderId: string;
  clanId: string;
  kind: 'leverage_bill' | 'leverage_election' | 'extort';
  billId?: string;
  direction?: 'for' | 'against';
}
