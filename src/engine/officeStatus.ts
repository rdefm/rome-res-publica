// ─── Office Status ───────────────────────────────────────────────────────────
// Chunk C4 of cursus-visual-redesign-plan.md — pure lift-and-extract of
// CursusScreen.tsx's OfficeRung isHeld/isCurrent/prereqMet/ageOk/isCampaigning
// computation (Finding 2), reshaped into a single status verdict so
// components/cursus/OfficeCard.tsx and StatusSeal don't each re-derive it.
//
// 'locked' reason scope (design decision, this chunk): broadened beyond the
// plan's literal "min-age or ladder-prerequisite" wording to also cover the
// case where the office is otherwise open but a different family member
// already has an active campaign running — the same full predicate
// OfficeRung's Apply-button already gated on (age && prereq && no-other-
// campaign), so every disabled Apply button now has a matching reason
// instead of a silently-greyed button.

import type { Character } from '../models/character';
import type { Office, OfficeId } from '../models/office';
import { OFFICES } from '../data/offices';

export type OfficeStatus = 'served' | 'active' | 'held' | 'eligible' | 'locked';

export interface OfficeStatusResult {
  status: OfficeStatus;
  /** Locked-only — human-phrased first failing gate, e.g. "Min age 36". */
  reason?: string;
}

/** The slice of GameState this needs — kept narrow so tests don't need a
 *  full GameState fixture. */
export interface OfficeStatusGameState {
  currentOffice: OfficeId | null;
  heldOffices: OfficeId[];
  campaigning: OfficeId | null;
  campaigningCharacterId: string | null;
}

export function getOfficeStatus(
  character: Character,
  office: Office,
  state: OfficeStatusGameState,
): OfficeStatusResult {
  const isPlayer = character.isPlayer;

  const isCurrent = isPlayer
    ? state.currentOffice === office.id
    : character.officeId === office.id;
  const isHeld = isPlayer
    ? state.heldOffices.includes(office.id)
    : (character.heldOffices ?? []).includes(office.id);
  const isCampaigning = state.campaigning === office.id && state.campaigningCharacterId === character.id;

  if (isCurrent) return { status: 'held' };
  if (isCampaigning) return { status: 'active' };
  if (isHeld) return { status: 'served' };

  const prereqMet = !office.prerequisite || (isPlayer
    ? (state.heldOffices.includes(office.prerequisite) || state.currentOffice === office.prerequisite)
    : (character.heldOffices ?? []).includes(office.prerequisite));
  const ageOk = character.age >= office.minAge;
  const noCampaignActive = !state.campaigning;

  if (!ageOk) {
    return { status: 'locked', reason: `Min age ${office.minAge}` };
  }
  if (!prereqMet) {
    const prereqOffice = OFFICES.find(o => o.id === office.prerequisite);
    return { status: 'locked', reason: `Requires ${prereqOffice?.name ?? office.prerequisite}` };
  }
  if (!noCampaignActive) {
    return { status: 'locked', reason: 'Another campaign in progress' };
  }

  return { status: 'eligible' };
}
