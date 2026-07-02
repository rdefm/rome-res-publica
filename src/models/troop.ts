export type TroopType = 'garrison' | 'raised' | 'veteran' | 'seasoned_veteran';

export interface TroopUnit {
  id: string;
  type: TroopType;
  strength: number;           // 1–10. Combat effectiveness.
  campaignsSurvived: number;  // Increments on each campaign survived.
  yearsInactive: number;      // Seasons without campaign. Attrition starts at 10 years (40 seasons).
  bondToCommander: number;    // 0–100. raised: starts at 50; veterans: start at 80+.
  musterProvinceId: string;   // Province where this unit is stationed. Latium is forbidden.
}
