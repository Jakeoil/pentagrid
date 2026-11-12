// Types for lib/gamma.js — see that file for what this entry is and why.
export { createGammaSet, describeSum, penroseCondition } from "../dist/geometry/gamma.js";
export type { GammaSet, GammaSetOptions } from "../dist/geometry/gamma.js";

export { singularTriples, noIntegerGamma, TRIPLES } from "../dist/geometry/regularity.js";
export type { ScanOptions, ScanResult } from "../dist/geometry/regularity.js";

export {
    classifySingularities, isRegular, COUPLES, SINGULAR_PRESETS,
} from "../dist/geometry/hunt.js";
export type { SingularKind, SingularPreset } from "../dist/geometry/hunt.js";

export { captureGamma, restoreGamma } from "../dist/state/baseline.js";
export type { GammaSnapshot } from "../dist/state/baseline.js";

export type { Pentagrid, Rhomb, Vec2, LineSet, ViewRect } from "../dist/geometry/types.js";
