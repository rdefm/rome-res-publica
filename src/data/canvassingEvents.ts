// ─── Canvassing Events ────────────────────────────────────────────────────────
// Events that can fire during vote canvassing. Each option either costs a
// resource, makes a skill roll (adjusting the pending canvass roll), or grants
// immediate success in exchange for Fides.

export interface CanvassingEventOption {
  id: string;
  label: string;
  /** Resource cost paid before the effect resolves. */
  cost?: { resource: 'fides' | 'denarii'; amount: number };
  /** Rhetoric skill check: roll 0–100 + rhetoric×5 vs difficulty. */
  skillCheck?: {
    skill: 'rhetoric';
    difficulty: number;
    bonusOnSuccess: number;  // added to pending canvass roll
    penaltyOnFail: number;   // added (negative) to pending canvass roll
  };
  /** If true, bypasses the pending roll entirely — vote is locked 'for'. */
  immediateSuccess?: boolean;
  flavorSuccess: string;
  flavorFail?: string;
}

export interface CanvassingEvent {
  id: string;
  title: string;
  description: string;
  options: CanvassingEventOption[];
}

export const CANVASSING_EVENTS: CanvassingEvent[] = [
  {
    id: 'tribune_demand',
    title: "A Tribune's Demand",
    description:
      'As you approach the senator, a Tribune intercepts you. "Word of your canvassing has reached my ears," he says with a measured smile. "I may be persuaded to help — or to hinder." He waits for your response.',
    options: [
      {
        id: 'pay',
        label: 'Pay his price (−40 Denarii)',
        cost: { resource: 'denarii', amount: 40 },
        flavorSuccess:
          'You settle his immediate demand. He steps aside without another word.',
      },
      {
        id: 'rhetoric',
        label: 'Argue your case (Rhetoric check)',
        skillCheck: {
          skill: 'rhetoric',
          difficulty: 50,
          bonusOnSuccess: 20,
          penaltyOnFail: -20,
        },
        flavorSuccess:
          'Your eloquence gives him pause. He departs, chastened, and your target is free to hear you out.',
        flavorFail:
          'He is unmoved. Your words land poorly and your canvass will be harder than expected.',
      },
      {
        id: 'favour',
        label: 'Call in a favour (−5 Fides)',
        cost: { resource: 'fides', amount: 5 },
        immediateSuccess: true,
        flavorSuccess:
          'Your network of obligations proves its worth. He steps aside — and quietly puts in a word on your behalf.',
      },
    ],
  },
];
