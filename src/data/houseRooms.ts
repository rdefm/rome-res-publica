import type { RoomDefinition } from '../models/house';

// ─── Family House — rooms ────────────────────────────────────────────────────
// 4 room types, binary built/not-built (no per-room tiers in v1 — the
// location's roomSlots count is the scarcity lever). Costs roughly match the
// old Patrimonium assets' tier-1 costs (60–100 denarii).

export const HOUSE_ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    type: 'study',
    name: 'Study',
    cost: 90,
    flavorText: 'Scrolls, wax tablets, and a good lamp. A quiet room turns effort into mastery.',
    bonus: { trainingRollBonus: 0.20 },
  },
  {
    type: 'hall',
    name: 'Larger Entry Hall',
    cost: 100,
    flavorText: "A wider atrium means more clients can wait their turn at the morning salutatio without spilling into the street.",
    bonus: { clientSlotBonus: 3 },
  },
  {
    type: 'kitchen',
    name: 'Kitchen & Dining Room',
    cost: 110,
    flavorText: 'A proper kitchen and a dining room worth the name — a dinner invitation here is one worth accepting.',
    bonus: { dinnerRelationshipMult: 1.5 },
  },
  {
    type: 'library',
    name: 'Library',
    cost: 150,
    flavorText: 'Scrolls of philosophy, rhetoric, and law, kept and read. Knowledge that pays for itself, and shapes the one who studies it.',
    bonus: { fidesPerSeason: 3, rhetoricGrant: 1 },
  },
];

export function getHouseRoomDefinition(type: string): RoomDefinition | undefined {
  return HOUSE_ROOM_DEFINITIONS.find(r => r.type === type);
}
