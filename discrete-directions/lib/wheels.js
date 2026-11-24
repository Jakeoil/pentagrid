// @ts-check
/**
 * The wheel algebra: ten directions from five ordered points, the operator
 * family that moves between generations, and the pentaflake the P wheel is
 * measured off.
 *
 * Start here. Everything else in this library takes a wheel or a wheel set.
 */

export {
    // the five points, in and out
    PENTA_UP, REAL_PENTA, ASYMMETRIC, EVEN_PENTAD, PRESETS, TENTHS, SEED_GENERATION,
    wheelFromPoints, pointsOf, m10,
    // the operator family
    comb, stride, pair, inflate, deflate, halfUp, halfDown,
    // the four wheels, and the edge wheel
    pWheel, sWheel, tWheel, eWheel,
    // the ladder
    wheelsAt, ladderTo,
} from "../src/math/wheel.js";

// ── the seed: five points AND the origin their spokes are measured from ──
//
// `wheel.js` takes five VECTORS; a seed is five POSITIONS plus the point they
// radiate from, and moving that point reshapes the wheel. `originFence` is
// where it is allowed to go, exactly -- a convex pentagon, about a seventh of
// the pentagon's area, and on a REGULAR pentagon exactly the pentagon one
// generation down.
// `moveHandle` is the floater rule: one handle driven by the others so that
// `spokeSum` -- five times the offset from the origin to the centroid -- holds
// at a target. The reticulum's locked gamma, for this geometry.
export {
    seedOf, spokesOf, wheelOf, wheelsOf, SEEDS,
    checkSeed, originFence, nearestOrigin, centroidOf, centered,
    HANDLE_ORIGIN, spokeSum, moveHandle,
} from "../src/math/seed.js";

export { pentaflake, pWheelFromFlake, sharedEdge } from "../src/math/flake.js";

/** @typedef {import("../src/math/wheel.js").Pt} Pt */
/** @typedef {import("../src/math/wheel.js").Wheel} Wheel */
/** @typedef {import("../src/math/wheel.js").WheelSet} WheelSet */
/** @typedef {import("../src/math/flake.js").Leaf} Leaf */
