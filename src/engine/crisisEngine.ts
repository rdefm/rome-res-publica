export interface CrisisInfo {
  title: string;
  narrative: string;
  gravitasPenalty: number;
  dignitasPenalty: number;
}

export function getCrisisInfo(crisisLevel: number): CrisisInfo {
  if (crisisLevel < 20) {
    return {
      title: 'Pax Romana',
      narrative: 'Rome is at peace. The legions hold the frontiers and the Senate deliberates in good order.',
      gravitasPenalty: 0,
      dignitasPenalty: 0,
    };
  }
  if (crisisLevel < 40) {
    return {
      title: 'The Punic Wars — Early Skirmishes',
      narrative: 'Carthaginian aggression tests Rome\'s resolve. Minor skirmishes along the western trade routes unsettle merchants and senators alike.',
      gravitasPenalty: 1,
      dignitasPenalty: 0,
    };
  }
  if (crisisLevel < 60) {
    return {
      title: 'The Punic Wars — Escalating',
      narrative: 'Hannibal\'s forces press deeper into allied territory. Fear grips the Forum. Resources are stretched thin across two theatres of war.',
      gravitasPenalty: 2,
      dignitasPenalty: 1,
    };
  }
  if (crisisLevel < 80) {
    return {
      title: 'The Punic Wars — Crisis Point',
      narrative: 'The legions have suffered a catastrophic defeat. Rome reels. Every senator knows that failure in the Curia now may doom the Republic itself.',
      gravitasPenalty: 3,
      dignitasPenalty: 2,
    };
  }
  return {
    title: 'EXISTENTIAL THREAT',
    narrative: 'Carthage stands at the gates. The Senate is paralysed by fear and faction. Rome\'s survival rests on what is decided in this chamber — and soon.',
    gravitasPenalty: 5,
    dignitasPenalty: 4,
  };
}

export function getCrisisColour(crisisLevel: number): string {
  if (crisisLevel < 20) return '#3d6b4f'; // laurel green
  if (crisisLevel < 40) return '#c9a84c'; // gold
  if (crisisLevel < 60) return '#d4791a'; // amber-orange
  if (crisisLevel < 80) return '#8b1a1a'; // crimson
  return '#ff0000';                        // red — existential
}
