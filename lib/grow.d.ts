// Types for lib/grow.js — see that file for what this entry is and why.
//
// Hand-written beside it, so a TypeScript consumer gets the real declarations
// from the same path it imports the code from, with no `paths` mapping. The
// declarations themselves are generated into `../dist/` by `npm run build`.
export {
    tileCorner,
    outlineCorner,
    crossingLerp,
    standHeight,
    registrationGain,
    projectToScreen,
} from "../dist/geometry/growth.js";
export type {
    GrowFold,
    Camera,
    SeatLike,
} from "../dist/geometry/growth.js";

export {
    RISE,
    ROOF_EDGE,
    vertexIndex,
    vertexHeight,
    generator,
    liftLocal,
    faceNormal,
    flatLocal,
} from "../dist/geometry/roof.js";
export type { Vec3 } from "../dist/geometry/roof.js";

export { makeDirections, collectRhombs } from "../dist/geometry/pentagrid.js";
export type { Pentagrid, Rhomb, Vec2, ViewRect } from "../dist/geometry/types.js";
