export type LegacyObjectiveStatus = 'active' | 'completed' | 'failed';

export interface LegacyObjective {
  id: string;
  title: string;
  description: string;
  status: LegacyObjectiveStatus;
  turnActivated: number;
  turnCompleted?: number;
}
