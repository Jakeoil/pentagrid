// Step 0: five ordered lattice points, and everything else.
//
// penrose-mosaic stores four wheels and eight tile primitives, all found by hand
// on quadrille paper in the 1990s. This module takes only the five corners of
// the pentagon and derives the rest. Nothing here is transcribed from that
// project; `tools/bootstrap.test.mjs` checks every result against it.
//
// The design rule is Jake's: the list is ORDERED, and the order is the rotation
// operator. A rotation is an index shift and nothing else. There is no `vr`, no
// `hr`, no `neg`, and no table of stored rotations — a mirror, if it is ever
// wanted, is index reversal: available, never required. That matters because the
// five points are not assumed symmetric, and the moment you take a second
// pentagon out of the tiling they are not.

/** A lattice point. Screen convention: y grows downward. */
export type Pt = readonly [number, number];

/** Ten directions, indexed by tenth. `W[t + 5] === −W[t]` always. */
export type Wheel = readonly Pt[];

export const TENTHS = 10;

/** Index arithmetic on the ten. The only "symmetry" this module knows. */
export const m10 = (n: number): number => ((n % TENTHS) + TENTHS) % TENTHS;

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];

/**
 * The five ordered corners of the quadrille pentagon — penrose-mosaic's
 * `pentaUp`, and the only input this module has. Any five points will do; these
 * are the ones whose tiling is already drawn somewhere else to check against.
 */
export const PENTA_UP: readonly Pt[] = [
    [0, -3],
    [3, -1],
    [2, 3],
    [-2, 3],
    [-3, -1],
];

/**
 * Five ordered points become ten directions: the five given occupy the even
 * tenths, their negatives the odd ones, placed so index order is angular order.
 *
 * A negation, not a reflection — it needs no mirror axis, so it holds for five
 * points with no symmetry at all.
 */
export function wheelFromPoints(pts: readonly Pt[]): Wheel {
    if (pts.length !== 5) throw new Error(`need five points, got ${pts.length}`);
    const w: Pt[] = new Array(TENTHS);
    for (let k = 0; k < 5; k++) {
        w[2 * k] = pts[k];
        w[m10(2 * k + 5)] = [-pts[k][0], -pts[k][1]];
    }
    return w;
}

/** The five even tenths again — the inverse of `wheelFromPoints`. */
export function pointsOf(w: Wheel): readonly Pt[] {
    return [w[0], w[2], w[4], w[6], w[8]];
}

/**
 * Sum a wheel against shifted copies of itself: `out[t] = Σ W[t + k]`.
 *
 * Every operator below is one of these. They are polynomials in the cyclic
 * shift, so they all commute — with rotation, and with each other. That is why
 * the ladder can be climbed in any order and still agree, and it is the reason
 * the whole module needs no special cases.
 */
export function comb(w: Wheel, offsets: readonly number[]): Wheel {
    return w.map((_, t) =>
        offsets.reduce<Pt>((s, k) => add(s, w[m10(t + k)]), [0, 0] as Pt));
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
 * a separately stored wheel at all — it is the third stride of D. Everything
 * penrose-mosaic keeps in four hand-built arrays is this one line.
 */
export const stride = (w: Wheel, k: number): Wheel => comb(w, [-k, 0, k]);

/** One generation: ×φ². Two Penrose deflations. */
export const inflate = (w: Wheel): Wheel => stride(w, 1);

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
 */
export const pair = (w: Wheel, k: number): Wheel => comb(w, [-k, k]);

/** Half a generation up: ×φ. */
export const halfUp = (w: Wheel): Wheel => pair(w, 1);

/**
 * Half a generation down: ×φ⁻¹.
 *
 * NOT the inverse of `halfUp` — `halfDown(halfUp(w)) ≠ w`, and
 * `halfUp(halfUp(w)) ≠ inflate(w)` either. Both miss by My's λ = −1 term, the
 * alternating (0, ±1) that separates T from the next generation's D. A φ step is
 * exact in x and exact-up-to-that-parity in y, which is the structural reason
 * the wheels are stored at φ² — it is where the two coordinates agree.
 *
 * So a half-step ladder cannot be built by composing half steps; the gap would
 * compound. `wheelsAt` anchors every rung on the seed instead.
 */
export const halfDown = (w: Wheel): Wheel => pair(w, 2);

/** Its exact inverse: ×φ⁻². `inflate(deflate(w)) === w` on every wheel. */
export const deflate = (w: Wheel): Wheel => stride(w, 3);

/**
 * P — 2r, one pentagon's center to its neighbor's. ×φ.
 * The stride-1 pair with the middle term dropped: 2cos36° = φ.
 */
export const pWheel = (d: Wheel): Wheel => comb(d, [-1, 1]);

/** S — a pentagon's center to the near diamond's. Also ×φ, by the other stride. */
export const sWheel = (d: Wheel): Wheel => stride(d, 2);

/**
 * T — two star centers, feet touching. ×φ², and equal to `S + D`.
 *
 * T and the next generation of D are both ×φ² and are NOT the same wheel: they
 * differ by the alternating (0, ±1) that is My's λ = −1 eigenvalue. Two integer
 * representatives of one limiting vector. That difference is not noise — it is
 * exactly why the quadrille rhombs come out as parallelograms with unequal
 * sides rather than as rhombs. See discrete-directions/NOTES.md.
 */
export const tWheel = (d: Wheel): Wheel => comb(d, [-2, 0, 0, 2]);

/**
 * E — the tile edge wheel: the same stride-1 pair as P, differenced instead of
 * summed. These are the pentagon's own sides, and every P1 tile outline is a
 * closed walk in them. For the quadrille seed they come out as the (4,0), (3,2),
 * (1,4) basis the whole construction was doodled from in the first place.
 */
export const eWheel = (d: Wheel): Wheel =>
    d.map((_, t) => sub(d[m10(t + 1)], d[m10(t - 1)]));

/** The wheels at one generation. */
export interface WheelSet {
    readonly d: Wheel;
    readonly p: Wheel;
    readonly s: Wheel;
    readonly t: Wheel;
    readonly e: Wheel;
}

/** The seed sits at generation 1, matching penrose-mosaic and measurements.html. */
export const SEED_GENERATION = 1;

/**
 * Every wheel at generation `gen`, from the five points and nothing else.
 *
 * `gen` counts P1 generations, the seed at 1, and it may be a **half** and may
 * be **negative**. Halves are rounded to the nearest 0.5; anything finer has no
 * meaning, since φ is the smallest step the lattice can take exactly.
 *
 * A whole rung is reached by inflating or deflating from the seed, and a half
 * rung is one `halfUp` from the whole rung below it. Never by composing half
 * steps: `halfUp` twice is not one generation, and the error would accumulate.
 *
 * Downward the ladder is two-sided but not symmetric. Generation ½ is the last
 * rung that reads as a figure — every coordinate still positive — and at
 * generation −1 one seed collapses onto the origin, which is the deflation
 * running out of wheel rather than a numerical accident. Below that the
 * conjugate root ψ = −1/φ takes over, coordinates alternate in sign and the
 * wheel turns inside out. It stays arithmetically exact the whole way; it just
 * stops being a pentagon.
 */
export function wheelsAt(pts: readonly Pt[], gen: number): WheelSet {
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
 */
export function ladderTo(pts: readonly Pt[], gen: number): readonly WheelSet[] {
    const out: WheelSet[] = [];
    for (let g = 0; g <= gen; g++) out.push(wheelsAt(pts, g));
    return out;
}
