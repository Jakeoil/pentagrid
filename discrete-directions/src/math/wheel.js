// @ts-check
// Step 0: five ordered points, and everything else.
//
// penrose-mosaic stores four wheels and eight tile primitives, all found by hand
// on quadrille paper in the 1990s. This module takes only the five corners of
// the pentagon and derives the rest. Nothing here is transcribed from that
// project; the tests check every result against it.
//
// The design rule is Jake's: the list is ORDERED, and the order is the rotation
// operator. A rotation is an index shift and nothing else. There is no `vr`, no
// `hr`, no `neg`, and no table of stored rotations — a mirror, if it is ever
// wanted, is index reversal: available, never required. That matters because the
// five points are not assumed symmetric, and the moment you take a second
// pentagon out of the tiling they are not.

/**
 * A point. Screen convention: y grows downward.
 *
 * Not "lattice point": the quadrille's are integers, the real pentagon's are
 * not, and nothing here cares which.
 * @typedef {readonly [number, number]} Pt
 */

/**
 * Ten directions, indexed by tenth. `W[t + 5] === −W[t]` always.
 * @typedef {readonly Pt[]} Wheel
 */

/** @typedef {{ d: Wheel, p: Wheel, s: Wheel, t: Wheel, e: Wheel }} WheelSet */

export const TENTHS = 10;

/**
 * Index arithmetic on the ten. The only "symmetry" this module knows.
 * @param {number} n
 * @returns {number}
 */
export const m10 = (n) => ((n % TENTHS) + TENTHS) % TENTHS;

/** @type {(a: Pt, b: Pt) => Pt} */
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
/** @type {(a: Pt, b: Pt) => Pt} */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

/**
 * The five ordered corners of the quadrille pentagon — penrose-mosaic's
 * `pentaUp`, and the only input this module has. Any five points will do; these
 * are the ones whose tiling is already drawn somewhere else to check against.
 * @type {readonly Pt[]}
 */
export const PENTA_UP = [
    [0, -3],
    [3, -1],
    [2, 3],
    [-2, 3],
    [-3, -1],
];

/**
 * The **real** pentagon: regular, centered on the origin, side 4.
 *
 * Side 4 is the normalization that makes it comparable to the quadrille seed,
 * whose three edge lengths are 4, √13 and √17 — this is the regular pentagon
 * those are approximating. Its circumradius is `4 / (2 sin 36°) = 3.402603`
 * against the quadrille's 3.
 *
 * Nothing in this module cares that its coordinates are irrational. The wheels,
 * the walks, the substitution and the rhombs are arithmetic on pairs of numbers;
 * the lattice was never a requirement, only what the quadrille happens to use.
 *
 * Fed through, it lands on Euclidean Penrose exactly and at once: thick 72°,
 * thin 36°, at every generation, with no convergence, because a regular pentagon
 * is already the substitution's fixed point. The quadrille has to climb to
 * 69.287628° and 37.724519° and never reaches 72 at all.
 * @type {readonly Pt[]}
 */
export const REAL_PENTA = (() => {
    const side = 4, r = side / (2 * Math.sin(Math.PI / 5));
    return [0, 1, 2, 3, 4].map((k) => /** @type {Pt} */ ([
        r * Math.sin(2 * Math.PI * k / 5),
        -r * Math.cos(2 * Math.PI * k / 5),
    ]));
})();

/**
 * An **asymmetric** lattice seed, Jake 2026-11-21. Positive y is down, as
 * everywhere in this module.
 *
 * The point of having one is that nothing here leans on symmetry. The odd tenths
 * are *negations* of the even ones, never reflections, so five points with no
 * symmetry at all go through the wheels, the walks, the substitution and the
 * rhombs unchanged. Neither of the other two presets can show that: `PENTA_UP`
 * has a vertical mirror and `REAL_PENTA` has five, so a reflection bug would
 * hide in both. This one has **no mirror on any axis**, and it still tiles.
 *
 *     point      0        1       2       3       4
 *              (-2,-4)  (3,-3)  (3,2)  (-1,4)  (-5,0)
 *     bearing   333.4    45.0   123.7   194.0   270.0   clockwise from up
 *     gap        71.6    78.7    70.3    76.0    63.4   ideal 72
 *     radius     4.47    4.24    3.61    4.12    5.00
 *
 * Lopsided, and squarely inside the range that works: the ten spokes interleave
 * in strict angular order, and over five generations not one pentagon, star,
 * boat or diamond outline crosses itself. Its D wheel runs 1.39 longest to
 * shortest, against the quadrille's 1.20.
 *
 * That range is narrower than "any five points", which is worth stating because
 * the first draft of this constant fell outside it. What a seed must satisfy is
 * a condition on the **ten spokes**, not on the five points: the five and their
 * negatives have to interleave, each step forward by more than nothing and less
 * than a half turn, closing at exactly one full turn. Two ways to fail it are
 * winding twice round instead of once, and aiming any two spokes the same way —
 * which happens as soon as two of the five points are parallel or antiparallel.
 * `tests/wheel.test.mjs` names the condition and checks it.
 * @type {readonly Pt[]}
 */
export const ASYMMETRIC = [
    [-2, -4],
    [3, -3],
    [3, 2],
    [-1, 4],
    [-5, 0],
];

/**
 * The seeds the page offers, by name. Two symmetric and one not, which is the
 * point: the asymmetric one is the only one that can show the construction does
 * not reach for a mirror.
 * @type {Record<string, readonly Pt[]>}
 */
export const PRESETS = {
    quadrille: PENTA_UP,
    asymmetric: ASYMMETRIC,
    real: REAL_PENTA,
};

/**
 * Five ordered points become ten directions: the five given occupy the even
 * tenths, their negatives the odd ones, placed so index order is angular order.
 *
 * A negation, not a reflection — it needs no mirror axis, so it holds for five
 * points with no symmetry at all.
 * @param {readonly Pt[]} pts
 * @returns {Wheel}
 */
export function wheelFromPoints(pts) {
    if (pts.length !== 5) throw new Error(`need five points, got ${pts.length}`);
    /** @type {Pt[]} */
    const w = new Array(TENTHS);
    for (let k = 0; k < 5; k++) {
        w[2 * k] = pts[k];
        w[m10(2 * k + 5)] = [-pts[k][0], -pts[k][1]];
    }
    return w;
}

/**
 * The five even tenths again — the inverse of `wheelFromPoints`.
 * @param {Wheel} w
 * @returns {readonly Pt[]}
 */
export function pointsOf(w) {
    return [w[0], w[2], w[4], w[6], w[8]];
}

/**
 * Sum a wheel against shifted copies of itself: `out[t] = Σ W[t + k]`.
 *
 * Every operator below is one of these. They are polynomials in the cyclic
 * shift, so they all commute — with rotation, and with each other. That is why
 * the ladder can be climbed in any order and still agree, and it is the reason
 * the whole module needs no special cases.
 * @param {Wheel} w
 * @param {readonly number[]} offsets
 * @returns {Wheel}
 */
export function comb(w, offsets) {
    return w.map((_, t) => offsets.reduce(
        (s, k) => add(s, w[m10(t + k)]), /** @type {Pt} */ ([0, 0])));
}

/**
 * The stride family, which is the heart of the whole thing.
 *
 * Three unit vectors a turn apart sum to `(1 + 2cos turn)` times the middle one,
 * and on a ten-wheel the turn is the stride:
 *
 *     stride 1   1 + 2cos36°  =  φ²        inflate, one generation
 *     stride 2   1 + 2cos72°  =  φ         the S wheel
 *     stride 3   1 + 2cos108° =  φ⁻²       deflate, exactly inverse to stride 1
 *     stride 4   1 + 2cos144° = −φ⁻¹       the conjugate root, ψ
 *
 * So inflation and deflation are the same operator at two strides, and S is not
 * a separately stored wheel at all — it is the second stride of D. Everything
 * penrose-mosaic keeps in four hand-built arrays is this one line.
 * @type {(w: Wheel, k: number) => Wheel}
 */
export const stride = (w, k) => comb(w, [-k, 0, k]);

/**
 * One generation: ×φ². Two Penrose deflations.
 *
 * This is the step `penta()` and `star()` take, and the only one they know.
 * @type {(w: Wheel) => Wheel}
 */
export const inflate = (w) => stride(w, 1);

/**
 * The two-term members of the same family: `W[t−k] + W[t+k]` is `2cos(36k°)`.
 *
 *     k = 1    2cos36°  =  φ         half a generation up
 *     k = 2    2cos72°  =  φ⁻¹       half a generation down
 *     k = 3    2cos108° = −φ⁻¹
 *     k = 4    2cos144° = −φ
 *
 * so the stride picks the scale here exactly as it does for the three-term sums,
 * and between them the eight operators cover ±φ^{±1} and ±φ^{±2}.
 * @type {(w: Wheel, k: number) => Wheel}
 */
export const pair = (w, k) => comb(w, [-k, k]);

/**
 * Half a generation up: ×φ.
 * @type {(w: Wheel) => Wheel}
 */
export const halfUp = (w) => pair(w, 1);

/**
 * Half a generation down: ×φ⁻¹.
 *
 * NOT the inverse of `halfUp` — `halfDown(halfUp(w)) ≠ w`, and
 * `halfUp(halfUp(w)) ≠ inflate(w)` either.
 *
 * That is the two-ladder fact, not a defect. `penta()` and `star()` deflate by
 * φ², and a seed for the odd steps is generated from the original seed by them,
 * so there is an **even ladder and an odd ladder**, each stepping by φ² within
 * itself. The alternating (0, ±1) between them is the offset BETWEEN the
 * ladders, not an error inside either — which is why x agrees everywhere and
 * only y carries it. See discrete-directions/PLAN.md §2a.
 *
 * So a rung is never reached by composing half steps. `wheelsAt` anchors every
 * one of them on the seed.
 * @type {(w: Wheel) => Wheel}
 */
export const halfDown = (w) => pair(w, 2);

/**
 * Its exact inverse: ×φ⁻². `inflate(deflate(w)) === w` on every wheel.
 * @type {(w: Wheel) => Wheel}
 */
export const deflate = (w) => stride(w, 3);

/**
 * P — 2r, one pentagon's center to its neighbor's. ×φ.
 * The stride-1 pair with the middle term dropped: 2cos36° = φ.
 * @type {(d: Wheel) => Wheel}
 */
export const pWheel = (d) => comb(d, [-1, 1]);

/**
 * S — a pentagon's center to the near diamond's. Also ×φ, by the other stride.
 * @type {(d: Wheel) => Wheel}
 */
export const sWheel = (d) => stride(d, 2);

/**
 * T — two star centers, feet touching. ×φ², and equal to `S + D`.
 *
 * T and the next generation of D are both ×φ² and are NOT the same wheel: they
 * differ by the alternating (0, ±1). Two integer representatives of one limiting
 * vector. That difference is not noise — it is exactly why the quadrille rhombs
 * come out as kites rather than rhombs. See NOTES.md.
 * @type {(d: Wheel) => Wheel}
 */
export const tWheel = (d) => comb(d, [-2, 0, 0, 2]);

/**
 * E — the tile edge wheel: the same stride-1 pair as P, differenced instead of
 * summed. These are the pentagon's own sides, and every P1 tile outline is a
 * closed walk in them. For the quadrille seed they come out as the (4,0), (3,2),
 * (1,4) basis the whole construction was doodled from in the first place.
 * @type {(d: Wheel) => Wheel}
 */
export const eWheel = (d) => d.map((_, t) => sub(d[m10(t + 1)], d[m10(t - 1)]));

/** The seed sits at generation 1, matching penrose-mosaic and measurements.html. */
export const SEED_GENERATION = 1;

/**
 * Every wheel at generation `gen`, from the five points and nothing else.
 *
 * `gen` counts P1 generations, the seed at 1, and it may be a **half** and may
 * be **negative**. Halves are rounded to the nearest 0.5; anything finer has no
 * meaning, since φ is the smallest step the geometry takes.
 *
 * A whole rung is reached by inflating or deflating from the seed, and a half
 * rung is one `halfUp` from the whole rung below it — never by composing half
 * steps, because the odd rungs are their own ladder and not fractions of the
 * even one.
 *
 * Downward the ladder is two-sided but not symmetric. Generation ½ is the last
 * rung that reads as a figure — every coordinate still positive — and at
 * generation −½ one seed collapses onto the origin, which is the deflation
 * running out of wheel rather than a numerical accident. Below that the
 * conjugate root ψ = −1/φ takes over, coordinates alternate in sign and the
 * wheel turns inside out. It stays arithmetically exact the whole way; it just
 * stops being a pentagon.
 * @param {readonly Pt[]} pts
 * @param {number} gen
 * @returns {WheelSet}
 */
export function wheelsAt(pts, gen) {
    const halves = Math.round(gen * 2);
    const whole = Math.floor(halves / 2);
    let d = wheelFromPoints(pts);
    for (let g = SEED_GENERATION; g < whole; g++) d = inflate(d);
    for (let g = SEED_GENERATION; g > whole; g--) d = deflate(d);
    if (halves % 2 !== 0) d = halfUp(d);
    return { d, p: pWheel(d), s: sWheel(d), t: tWheel(d), e: eWheel(d) };
}

/**
 * Wheels for generations 0..gen, so a recursion can index by generation the way
 * penrose-mosaic's `wheels.p[gen]` does.
 * @param {readonly Pt[]} pts
 * @param {number} gen
 * @returns {readonly WheelSet[]}
 */
export function ladderTo(pts, gen) {
    /** @type {WheelSet[]} */
    const out = [];
    for (let g = 0; g <= gen; g++) out.push(wheelsAt(pts, g));
    return out;
}
