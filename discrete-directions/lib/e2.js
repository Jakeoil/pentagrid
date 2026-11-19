// @ts-check
/**
 * The E2 wheels: penrose-mosaic's own representation, and the limiting
 * directions measured off it.
 *
 * **Deliberately not in `discrete-directions.js`.** This entry is the OTHER
 * representation of the same geometry, and several of its names mean something
 * different from the ones beside them:
 *
 *     lib/wheels.js   ten tenths, five ordered points, SCREEN coordinates
 *     lib/e2.js       three seeds and their reflections, MATH coordinates
 *
 * so `inflate` here takes three seeds and `inflate` there takes a wheel of ten;
 * `pentagon` here is a seed's up-set and `pentagon` in `lib/tiles.js` is a tile
 * at a tenth; and y runs the other way. Folding both into one namespace would
 * put two different functions behind one name, which is the mistake this file
 * exists to make impossible. Import it by name when you want E2, and the
 * collision becomes a choice rather than an accident.
 *
 * What is only here: `limitAngles`, `discreteDirections` and `frameOperator` —
 * the measurements that say the discrete limit is not a rotation of the
 * Euclidean wheel.
 */

export {
    // the stored seeds, and the ladder over them
    WHEELS, QUADRILLE, SEED_GENERATION, PHI,
    wheelAt, inflate, deflate, halfStep, generation,
    // a seed's ten points, and its two pentagons
    wheel, pentagon, pentagonDown,
    // the limit, and what a multigrid on it would be
    limitSeed, limitAngles, discreteDirections, frameOperator,
} from "../src/math/e2.js";

/** @typedef {import("../src/math/e2.js").Seed} Seed */
/** @typedef {import("../src/math/e2.js").WheelName} WheelName */
