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
