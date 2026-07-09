import type { ClientType, Client } from '../models/client';

export const CLIENT_NAMES: Record<ClientType, string[]> = {
  muscle: [
    'Corvus', 'Maro', 'Sextus', 'Bulla', 'Casca', 'Lurco', 'Dama',
    'Gratus', 'Scaeva', 'Pulmo', 'Verres', 'Rufio', 'Glaber',
  ],
  publicSupport: [
    'Philemon', 'Agrippa', 'Piso', 'Labeo', 'Naevius', 'Cilo',
    'Gallus', 'Balbus', 'Scaurus', 'Lentulus', 'Figulus', 'Strabo',
  ],
  votingSway: [
    'Fadius', 'Canidius', 'Seius', 'Nonius', 'Vibius', 'Atilius',
    'Maelius', 'Aufidius', 'Tadius', 'Plotius', 'Quinctius', 'Marcius',
  ],
};

// ─── Leader succession (P2-D) ────────────────────────────────────────────────
// Abbreviated Roman praenomina, matching the convention already used in
// startingClans.ts leader names ("P. Cornelius Scipio", "Cn. Cornelius Rufus").
// A procedurally generated successor's full name is `${praenomen} ${clan.gensName}`
// (cognomen omitted — fully procedural, no authored content).

export const LEADER_PRAENOMINA: string[] = [
  'P.', 'Cn.', 'L.', 'M.', 'Q.', 'Ap.', 'Ti.', 'C.', 'Sex.', 'T.', 'D.', 'A.', 'Ser.',
];

export function generateClientName(type: ClientType, existingClients: Client[]): string {
  const used = new Set(
    existingClients.filter(c => c.type === type).map(c => c.name)
  );
  const available = CLIENT_NAMES[type].filter(n => !used.has(n));
  if (available.length === 0) {
    // Pool exhausted — reuse with suffix rather than crash
    const base = CLIENT_NAMES[type][Math.floor(Math.random() * CLIENT_NAMES[type].length)];
    return `${base} (the Younger)`;
  }
  return available[Math.floor(Math.random() * available.length)];
}
