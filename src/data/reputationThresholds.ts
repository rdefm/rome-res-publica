export interface ReputationThreshold {
  score: number;
  label: string;
  unlockedActions: string[];
  passiveEffect?: string;
}

export const REPUTATION_THRESHOLDS: ReputationThreshold[] = [
  {
    score: -100,
    label: 'Blood Enemies',
    unlockedActions: [],
    passiveEffect: 'This clan will initiate prosecutions against your family unprompted.',
  },
  {
    score: -50,
    label: 'Rivals',
    unlockedActions: [],
    passiveEffect: 'This clan votes against your bills regardless of merit.',
  },
  {
    score: -10,
    label: 'Cold',
    unlockedActions: [],
  },
  {
    score: 10,
    label: 'Neutral',
    unlockedActions: [],
  },
  {
    score: 35,
    label: 'Cordial',
    unlockedActions: ['propose_alliance_marriage'],
  },
  {
    score: 60,
    label: 'Trusted Ally',
    unlockedActions: ['propose_alliance_marriage', 'receive_early_warning'],
    passiveEffect: 'This clan will warn you one turn before initiating a prosecution.',
  },
  {
    score: 85,
    label: 'Bound by Oath',
    unlockedActions: ['propose_alliance_marriage', 'receive_early_warning', 'secret_pact'],
    passiveEffect: 'This clan commits full voting bloc support on one bill per year.',
  },
];
