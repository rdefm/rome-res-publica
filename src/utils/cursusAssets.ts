// ─── Cursus Asset Registry ───────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md — Cursus-only assets (fresco
// background, wax seal, office icons). Portraits are NOT here — they're
// utils/portraitAssets.ts's shared registry (Chunk C0), consumed via
// components/shared/PortraitRoundel.tsx.
//
// Same graceful-degradation shape as portraitAssets.ts: Metro resolves
// require() at BUNDLE time, so every line below ships commented out until
// the file exists in assets/cursus/ (see Appendix A of the plan for the
// manifest). A missing/commented entry resolves to `undefined` — every
// consumer must render a fallback for that.

import type { OfficeId } from '../models/office';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // matches the untyped require() convention already used by ParchmentCard.tsx / portraitAssets.ts.

const FRESCO_BG: RequiredAsset | undefined = undefined;
// const FRESCO_BG = require('../assets/cursus/fresco-bg.jpg');

const WAX_SEAL: RequiredAsset | undefined = undefined;
// const WAX_SEAL = require('../assets/cursus/seal-wax.png');

const OFFICE_ICONS: Partial<Record<OfficeId, RequiredAsset>> = {
  // vigintivirate: require('../assets/cursus/icon-vigintivirate.png'),
  // quaestor: require('../assets/cursus/icon-quaestor.png'),
  // tribune: require('../assets/cursus/icon-tribune.png'),
  // aedile: require('../assets/cursus/icon-aedile.png'),
  // praetor: require('../assets/cursus/icon-praetor.png'),
  // consul: require('../assets/cursus/icon-consul.png'),
  // censor: require('../assets/cursus/icon-censor.png'),
  // dictator: require('../assets/cursus/icon-dictator.png'),
};

export const cursusAssets = {
  frescoBg: FRESCO_BG,
  waxSeal: WAX_SEAL,
  /** `id` is an OfficeId. Returns undefined until that office's icon line
   *  above is uncommented — callers fall back to the office's existing
   *  `icon` emoji field (data/offices.ts) or a plain roundel. */
  officeIcon: (id: OfficeId): RequiredAsset | undefined => OFFICE_ICONS[id],
};
