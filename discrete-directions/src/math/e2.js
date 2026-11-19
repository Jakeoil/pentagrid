// @ts-check
// The E2 wheels, adapted from penrose-mosaic — the substitution itself,
// nothing of its drawing.
//
// This is the OTHER representation, and it is kept because it is the one the
// limiting directions were measured in. `wheel.js` takes five ordered points
// and ten tenths, assumes no symmetry, and rotates by shifting an index. This
// one is penrose-mosaic's own: three free seeds plus their reflections, hr
// (negate x) and vr (negate y), which is a smaller store and a mirror-symmetric
// one. Where they overlap they agree; where they differ, `wheel.js` is the one
// that generalizes and this one is the one with the E2 measurements on it —
// `limitAngles`, `discreteDirections`, `frameOperator`.
//
// A wheel is ten lattice points built from three free seeds and their
// reflections. Inflation replaces each seed with the sum of three consecutive
// wheel entries, and because hr and vr act on the two coordinates differently,
// x and y evolve under two DIFFERENT integer matrices — which is the whole
// reason the limit is not a rotation of the Euclidean wheel:
//
//         ⎡1 0 0⎤              ⎡1 2 0⎤
//   Mx =  ⎢1 1 1⎥        My =  ⎢1 1 1⎥
//         ⎣0 1 2⎦              ⎣0 1 0⎦
//
// char(Mx) = (1−λ)(λ²−3λ+1), char(My) = (1+λ)(λ²−3λ+1): both carry φ² and φ⁻²,
// Mx an extra 1 (x₀ is invariant — the first seed stays on the vertical) and My
// an extra −1 (an alternating component that neither grows nor decays).
//
// Integer arithmetic throughout; the limiting directions are computed from the
// recurrence rather than quoted. Source: penrose-mosaic/wheels.js,
// shape-modes.js (the quadrille seeds) and docs/wheels.md (the derivation).
//
// NOTE THE COORDINATES. Everything here is MATH coordinates, y up, because the
// limiting angles were derived that way. `wheel.js` and the rest of this
// library are SCREEN coordinates, y down. The two never meet in one expression,
// and this comment is the only thing keeping that true.

/**
 * Three free seeds, [x, y], in MATH coordinates: y up.
 * @typedef {readonly (readonly [number, number])[]} Seed
 */

/** @typedef {[number, number]} P */

/**
 * penrose-mosaic's quadrille seeds, negated in y (it draws with y down) so that
 * y runs up here. Slot 0 lies on the vertical, which is the axis the whole
 * wheel mirrors about.
 *
 * Which wheel you take sets the SCALE and nothing else: all four share the
 * substitution, so all four share its dominant eigenvector and therefore the
 * same limiting directions. Writing r for a pentagon's minor radius (its
 * inradius, center to edge) and R for the major (center to vertex):
 *
 *   P   2r    center to center of two pentagons — the one the tiling is laid on
 *   D   R     center to vertex, one pentagon's own radius
 *   S   R+R'  a pentagon's center to the near diamond's, its own R plus the
 *             diamond's (penrose-mosaic: "Pentagon, corner, star")
 *   T         two star centers with their feet touching ("Star to boat")
 *
 * Only three points are ever stored: a wheel is three seeds and their
 * reflections, so the other seven of its ten are hr, vr and negation of those
 * three and carry nothing new.
 *
 * THESE SEEDS ARE GENERATION 1, not 0. penrose-mosaic builds `wheels.p[1]`
 * from the seed and `wheels.p[0]` from ONE DEFLATION of it, so that the wheel
 * index matches the shape generation the drawing code asks for (`wheels.p[gen]`).
 * measurements.html prints rows 0..6 on that convention, and docs/wheels.md
 * states it: "makeWheels uses it once, to produce generation 0 from the seed at
 * generation 1." Anything here that speaks of a generation means the same
 * number that table does — see SEED_GENERATION and wheelAt.
 *
 * @type {{ P: Seed, S: Seed, T: Seed, D: Seed }}
 */
export const WHEELS = {
    P: [[0, 6], [3, 4], [5, 2]],
    S: [[0, 5], [3, 5], [5, 1]],
    T: [[0, 8], [5, 8], [8, 2]],
    D: [[0, 3], [2, 3], [3, 1]],
};

/** @typedef {keyof typeof WHEELS} WheelName */

/**
 * The P wheel, the default everywhere: 2r, pentagon center to pentagon center.
 * @type {Seed}
 */
export const QUADRILLE = WHEELS.P;

/** The stored seeds are penrose-mosaic's generation 1. */
export const SEED_GENERATION = 1;

/**
 * A wheel at a given generation, counted penrose-mosaic's way, in HALF steps:
 * `halves` = 2·generation, so 0 is generation 0 (one deflation below the seed),
 * 2 is the seed itself, 3 is generation 1½, and negatives go below. Odd values
 * are the half steps — see halfStep.
 *
 * @param {WheelName} name
 * @param {number} halves
 * @returns {Seed}
 */
export function wheelAt(name, halves) {
    let s = WHEELS[name];
    const whole = Math.floor(halves / 2) - SEED_GENERATION;
    for (let i = 0; i < Math.abs(whole); i++) s = whole > 0 ? inflate(s) : deflate(s);
    return halves % 2 === 0 ? s : halfStep(s);
}

/**
 * One inflation.
 * @param {Seed} seed
 * @returns {Seed}
 */
export function inflate(seed) {
    const [[x0, y0], [x1, y1], [x2, y2]] = seed;
    return [
        [x0, y0 + 2 * y1],
        [x0 + x1 + x2, y0 + y1 + y2],
        [x1 + 2 * x2, y1],
    ];
}

/**
 * Its exact inverse — penrose-mosaic's interpolateWheel / predecessorPoint.
 * @param {Seed} seed
 * @returns {Seed}
 */
export function deflate(seed) {
    const [[a0, b0], [a1, b1], [a2, b2]] = seed;
    return [
        [a0, b0 - 2 * b2],
        [-2 * a0 + 2 * a1 - a2, b2],
        [a0 - a1 + a2, b1 - b0 + b2],
    ];
}

/**
 * The HALF step: drop the middle term of the three-term sum.
 *
 *     inflate   s_k = w[k−1] + w[k] + w[k+1]      (×φ², the stored generation)
 *     halfStep  s_k = w[k−1] + w[k+1]             (×φ)
 *
 * The stored wheels only ever hold even powers of φ — that is why their
 * x-components are ALTERNATE Fibonacci numbers, 3, 8, 21, 55, … Interleave the
 * half steps and the sequence is Fibonacci exactly: 3, 5, 8, 13, 21, 34, 55, 89.
 * In the real geometry the same drop is w[k−1] + w[k+1] = 2cos36°·w[k] = φ·w[k];
 * here it is that identity's integer shadow.
 *
 * It is a half step on x exactly. On y it is a half step plus the alternating
 * (0, ±2), (0, ∓2), (0, ±2) — `halfStep(halfStep(s)) − inflate(s)`, flipping
 * sign each generation. That is My's λ = −1 eigenvalue: the ±2 correction
 * recorded in penrose-mosaic as an empirical oddity, which is not an anomaly
 * but an eigenvalue sitting on the unit circle beside the growth. So φ is
 * reachable in x and reachable-up-to-that-parity in y, and the wheels store
 * φ² because that is where the two agree.
 *
 * @param {Seed} seed
 * @returns {Seed}
 */
export function halfStep(seed) {
    const w = wheel(seed);
    /** @type {(a: readonly [number, number], b: readonly [number, number]) => P} */
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    return [add(w[9], w[1]), add(w[0], w[2]), add(w[1], w[3])];
}

/**
 * Generation g, by repeated inflation. Exact while it fits in a double.
 * @param {Seed} seed
 * @param {number} g
 * @returns {Seed}
 */
export function generation(seed, g) {
    let s = seed;
    for (let i = 0; i < g; i++) s = inflate(s);
    return s;
}

/** @type {(p: readonly [number, number]) => P} */
const hr = ([x, y]) => [-x, y];
/** @type {(p: readonly [number, number]) => P} */
const vr = ([x, y]) => [x, -y];
/** @type {(p: readonly [number, number]) => P} */
const neg = ([x, y]) => [-x, -y];

/**
 * The ten wheel points from three seeds, in penrose-mosaic's order.
 * @param {Seed} seed
 * @returns {P[]}
 */
export function wheel(seed) {
    const [p0, p1, p2] = seed;
    return [
        /** @type {P} */ ([p0[0], p0[1]]),
        /** @type {P} */ ([p1[0], p1[1]]),
        /** @type {P} */ ([p2[0], p2[1]]),
        vr(p2), vr(p1), vr(p0), neg(p1), neg(p2), hr(p2), hr(p1),
    ];
}

/**
 * The wheel's `up` set — every other point, which is the PENTAGON of that
 * wheel. penrose-mosaic's `Wheel.up`; `down` is the other five, point-down.
 *
 * @param {Seed} seed
 * @returns {P[]}
 */
export function pentagon(seed) {
    const w = wheel(seed);
    return [w[0], w[2], w[4], w[6], w[8]];
}

/**
 * The other five: the point-down set. penrose-mosaic's `Wheel.down`.
 * @param {Seed} seed
 * @returns {P[]}
 */
export function pentagonDown(seed) {
    const w = wheel(seed);
    return [w[5], w[7], w[9], w[1], w[3]];
}

export const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * The seed's limit, renormalized: the φ² eigenvalue dominates, and dividing by
 * the largest coordinate each step keeps it in range however far it is iterated.
 *
 * @param {Seed} seed
 * @param {number} [iterations]
 * @returns {Seed}
 */
export function limitSeed(seed, iterations = 80) {
    /** @type {Seed} */
    let s = seed.map(([x, y]) => /** @type {P} */ ([x, y]));
    for (let i = 0; i < iterations; i++) {
        s = inflate(s);
        const m = Math.max(...s.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])) || 1;
        s = s.map(([x, y]) => /** @type {P} */ ([x / m, y / m]));
    }
    return s;
}

/**
 * The ten limiting directions, in degrees FROM THE VERTICAL — the way
 * docs/wheels.md states them, since slot 0 is the mirror axis:
 *
 *     0, 34.6438, 71.1377, 108.8623, 145.3562, 180, 214.6438, 251.1377,
 *     288.8623, 325.3562
 *
 * still mirror symmetric about the vertical, as the reflection construction
 * forces, but with gaps 34.64, 36.49, 37.72, 36.49, 34.64 rather than five
 * equal 36s. The two free ones are algebraic of degree 2 over ℚ:
 * tan 34.643814° = (5−√5)/4 and tan 71.137740° = (5+3√5)/4 — a SIMPLER field
 * than the Euclidean tan 36° = √(5−2√5), which is degree 4.
 *
 * @param {Seed} [seed]
 * @returns {number[]}
 */
export function limitAngles(seed = QUADRILLE) {
    return wheel(limitSeed(seed))
        .map(([x, y]) => (90 - Math.atan2(y, x) * 180 / Math.PI + 720) % 360)
        .sort((a, b) => a - b);
}

/**
 * Five unit normals for a multigrid: one per pair of opposite wheel points.
 *
 * This is what a discrete pentagrid is built on. Unlike the Euclidean five they
 * are NOT evenly spread, so the frame Σ v vᵀ is not (5/2)·I — the dual map is a
 * linear map rather than a similarity, and the registration gain is a matrix.
 * `frameOperator` reports it.
 *
 * @param {Seed} [seed]
 * @returns {P[]}
 */
export function discreteDirections(seed = QUADRILLE) {
    return wheel(limitSeed(seed))
        .map(([x, y]) => (Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
        .filter((a) => a < 180)
        .sort((a, b) => a - b)
        .map((a) => /** @type {P} */ ([Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]));
}

/**
 * Σ v vᵀ for a set of directions, as [xx, xy, yy]. (n/2)·I exactly when tight.
 * @param {readonly (readonly [number, number])[]} dirs
 * @returns {[number, number, number]}
 */
export function frameOperator(dirs) {
    let xx = 0, xy = 0, yy = 0;
    for (const [x, y] of dirs) { xx += x * x; xy += x * y; yy += y * y; }
    return [xx, xy, yy];
}
