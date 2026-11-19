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
    PENTA_UP, REAL_PENTA, PRESETS, TENTHS, SEED_GENERATION,
    wheelFromPoints, pointsOf, m10,
    // the operator family
    comb, stride, pair, inflate, deflate, halfUp, halfDown,
    // the four wheels, and the edge wheel
    pWheel, sWheel, tWheel, eWheel,
    // the ladder
    wheelsAt, ladderTo,
} from "../src/math/wheel.js";

export { pentaflake, pWheelFromFlake, sharedEdge } from "../src/math/flake.js";

/** @typedef {import("../src/math/wheel.js").Pt} Pt */
/** @typedef {import("../src/math/wheel.js").Wheel} Wheel */
/** @typedef {import("../src/math/wheel.js").WheelSet} WheelSet */
/** @typedef {import("../src/math/flake.js").Leaf} Leaf */
