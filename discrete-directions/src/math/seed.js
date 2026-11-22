// @ts-check
// The seed: five ordered points AND the origin their spokes are measured from.
//
// `wheel.js` takes five VECTORS. A seed is five POSITIONS plus the point they
// radiate from, and the subtraction between the two lives here:
//
//     spokes = points − origin
//
// IT ADDS NO GEOMETRY, and Jake said so plainly (2026-11-22): moving the origin
// by δ gives the same ten spokes as translating the five points by −δ.
// `{points, origin}` is a redundant parameterization — the seed is the five
// spokes and nothing else, and (p, o) and (p − o, 0) are the same seed.
//
// What it adds is a HANDLE: the one motion the five corner handles cannot make
// between them, which is sliding the pentagon over the lattice as a block. With
// snap on, that is the question of which lattice point the pentagon is centered
// on, and the answer turns out to matter a great deal.
//
// THE ORIGIN IS FENCED, AND THE FENCE IS EXACT.
//
// It cannot go just anywhere: the ten spokes have to stay in angular order (see
// `checkSeed`), and that fails long before the origin leaves the pentagon. Read
// as translation — which is what it is — the statement is that **a pentagon's
// five points cannot be slid very far as a block**, which is worth knowing,
// because dragging them one at a time is comparatively free. For all
// three presets the legal region is about 14.4% of the pentagon's area, and
// φ⁻⁴ = 0.1459 — the area ratio of one deflation — which is not a coincidence.
// On a REGULAR pentagon the fence is exactly `pentagon(deflate(w), 1)`, the
// pentagon one generation down, inverted. On the quadrille it is a different
// pentagon of nearly the same area, which is the discrete geometry answering
// for itself again rather than approximating the real one.
//
// `originFence` does not approximate either. Each of the ten order conditions
//
//     cross(W[t], W[t+1]) > 0
//
// is, written out in the origin, AFFINE in it:
//
//     cross(p_a − o, p_b − o) = cross(p_a, p_b) + cross(p_b − p_a, o)
//
// because the o × o term cancels. So the legal set is an intersection of half
// planes — a convex polygon, computed exactly, for any five points.
//
// And of FIVE half planes, not ten, because `W[t+5] = −W[t]` makes
// `cross(W[t+5], W[t+6]) = cross(−W[t], −W[t+1]) = cross(W[t], W[t+1])`. The ten
// conditions are five, each stated twice. So **the fence has at most five
// sides**, always — the quadrille's and the asymmetric seed's are pentagons too,
// just not the deflated one.
//
// Its EDGES mean something: on `cross(W[t], W[t+1]) = 0` two adjacent spokes
// line up, so the boundary is exactly the origins at which two of the five
// points fall in line with it. `check` excludes that boundary, which is right —
// a wheel with two spokes in one direction has nine, not ten.

import { PRESETS, m10, wheelFromPoints, wheelsAt } from "./wheel.js";

/** @typedef {import("./wheel.js").Pt} Pt */
/** @typedef {import("./wheel.js").Wheel} Wheel */
/** @typedef {import("./wheel.js").WheelSet} WheelSet */

/**
 * Five ordered positions and the point their spokes are measured from.
 * @typedef {{ points: readonly Pt[], origin: Pt }} Seed
 */

/** @type {(a: Pt, b: Pt) => number} */
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

/**
 * A seed from five points, origin at (0, 0) unless given.
 * @param {readonly Pt[]} points
 * @param {Pt} [origin]
 * @returns {Seed}
 */
export function seedOf(points, origin = [0, 0]) {
    if (points.length !== 5) throw new Error(`need five points, got ${points.length}`);
    return { points: points.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin };
}

/**
 * The five vectors `wheel.js` wants: the points as seen from the origin.
 * @param {Seed} seed
 * @returns {readonly Pt[]}
 */
export const spokesOf = (seed) => seed.points.map((p) =>
    /** @type {Pt} */ ([p[0] - seed.origin[0], p[1] - seed.origin[1]]));

/**
 * The D wheel of a seed.
 * @param {Seed} seed
 * @returns {Wheel}
 */
export const wheelOf = (seed) => wheelFromPoints(spokesOf(seed));

/**
 * The four wheels at a rung, whole or half.
 * @param {Seed} seed
 * @param {number} gen
 * @returns {WheelSet}
 */
export const wheelsOf = (seed, gen) => wheelsAt(spokesOf(seed), gen);

/**
 * The seeds the pages offer. The three presets at origin (0, 0), which is a
 * legal origin for all three — so nothing about the default changes by having
 * made the origin movable.
 * @type {Record<string, Seed>}
 */
export const SEEDS = Object.fromEntries(
    Object.entries(PRESETS).map(([name, pts]) => [name, seedOf(pts)]));

/**
 * Is this seed usable, and if not, why not?
 *
 * The condition is on the TEN spokes, not on the five points: the five and
 * their negatives must interleave, each step turning the same way by less than
 * a half turn, closing at exactly one full turn. Five points can be a perfectly
 * convex pentagon and fail it.
 *
 * `why` is written to be shown to somebody dragging a handle, so it names the
 * handle rather than the tenth wherever it can.
 *
 * @param {Seed} seed
 * @returns {{ ok: boolean, why: string }}
 */
export function checkSeed(seed) {
    const s = spokesOf(seed);
    for (let k = 0; k < 5; k++)
        if (s[k][0] === 0 && s[k][1] === 0)
            return { ok: false, why: `the origin is on point ${k}` };

    const w = wheelFromPoints(s);
    // Which point a tenth came from: `wheelFromPoints` puts point k at tenth 2k
    // and its negative at tenth 2k+5, so an odd tenth t carries point (t-5)/2.
    const from = (/** @type {number} */ t) =>
        t % 2 === 0 ? t / 2 : (((t - 5) / 2) % 5 + 5) % 5;

    let turn = 0;
    for (let t = 0; t < 10; t++) {
        const a = w[t], b = w[m10(t + 1)];
        const c = cross(a, b);
        if (c <= 0) {
            const i = from(t), j = from(m10(t + 1));
            // Two spokes in ONE LINE is worth saying separately: it is the
            // fence's boundary rather than its outside, so it is what somebody
            // dragging the origin meets first, and it is repaired by a nudge in
            // any direction rather than by going back where they came from.
            const span = Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]);
            return { ok: false, why: Math.abs(c) <= 1e-9 * span
                ? `points ${i} and ${j} are in line with the origin`
                : `points ${i} and ${j} are out of order around the origin` };
        }
        turn += Math.atan2(c, a[0] * b[0] + a[1] * b[1]);
    }
    if (Math.abs(turn - 2 * Math.PI) > 1e-9)
        return { ok: false, why: "the five wind more than once round the origin" };
    return { ok: true, why: "" };
}

/**
 * **The sweet spot**: the centroid of the five points, which is the origin at
 * which this geometry stops fighting itself.
 *
 * Found by Jake on the page, 2026-11-22 — "if I move the center to a sweet spot
 * the rhombs look beautiful" — and it is the centroid exactly. What happens
 * there, all of it the same fact:
 *
 *  - **P = S.** The two φ-wheels coincide. They differ by
 *
 *        P[t] − S[t] = −(−1)^t · Σ pₖ
 *
 *    exactly, at every tenth: the gap between them IS the sum of the five
 *    points, alternating in sign. Zero the sum and the gap closes.
 *  - **inflate(D) = T**, since `T = S + D` and `inflate(D) = P + D`. That is the
 *    condition the page has carried as an open question since the beginning —
 *    *"modes can be unified if the real of d + p == t"*. It unifies here.
 *  - **The three rhomb spellings become one quadrilateral**, and it is an exact
 *    parallelogram. The kite `walk.js` documents is not deliberate geometry; it
 *    is what measuring from a point that is not the centroid looks like.
 *
 * The regular pentagon never had the problem because its centroid is already
 * the origin, which is also why `REAL_PENTA` shows no skew at (0, 0).
 *
 * **It is rational, and better than rational: it is always in (1/5)ℤ².** The
 * five points are integers on the quadrille, so the centroid's denominator is
 * exactly 5 — the classic seed's is (0/5, 1/5), the asymmetric one's
 * (−2/5, −1/5). Scale a seed by five and its sweet spot is a lattice point,
 * which is what it would take to make these rhombs fit the grid.
 *
 * @param {readonly Pt[]} points
 * @returns {Pt}
 */
export function centroidOf(points) {
    const n = points.length;
    return [points.reduce((a, p) => a + p[0], 0) / n,
            points.reduce((a, p) => a + p[1], 0) / n];
}

/**
 * The seed re-centered on its centroid: same pentagon, origin on the sweet spot.
 * @param {Seed} seed
 * @returns {Seed}
 */
export const centered = (seed) => ({ points: seed.points, origin: centroidOf(seed.points) });

/**
 * **The fence.** Every origin that keeps the ten spokes in order, as a convex
 * polygon, exactly — see this file's header for why it is a polygon at all.
 *
 * It depends on the five points alone, not on where the origin is now, so it
 * can be drawn once per pentagon and left up while the origin is dragged. It is
 * CLOSED, and `check` rejects its boundary: on an edge two spokes line up.
 *
 * Returned in the same coordinates as the points: these are origin POSITIONS,
 * not offsets from anywhere.
 *
 * @param {readonly Pt[]} points
 * @returns {Pt[]} the fence, counterclockwise in math terms; empty if no origin
 *     whatsoever works, which happens when the five points cannot be a pentagon
 *     about any center at all.
 */
export function originFence(points) {
    // The ten conditions, each affine in the origin: read off its value at
    // three origins rather than deriving the coefficients by hand, because the
    // indices are fiddly and this cannot get them wrong.
    const at = (/** @type {Pt} */ o) => {
        const w = wheelFromPoints(points.map((p) =>
            /** @type {Pt} */ ([p[0] - o[0], p[1] - o[1]])));
        return w.map((_, t) => cross(w[t], w[m10(t + 1)]));
    };
    const c = at([0, 0]), bx = at([1, 0]), by = at([0, 1]);

    // Start from a box big enough to hold any of it — far out, every spoke
    // points much the same way, so the region is bounded and nowhere near this
    // — and clip by the FIVE distinct conditions. Tenths t+5 repeat tenth t.
    const r = 4 * Math.max(1, ...points.map((p) => Math.hypot(p[0], p[1])));
    /** @type {Pt[]} */
    let poly = [[-r, -r], [r, -r], [r, r], [-r, r]];
    for (let t = 0; t < 5 && poly.length; t++) {
        const [c0, ax, ay] = [c[t], bx[t] - c[t], by[t] - c[t]];
        const f = (/** @type {Pt} */ p) => c0 + ax * p[0] + ay * p[1];
        /** @type {Pt[]} */
        const out = [];
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const fa = f(a), fb = f(b);
            if (fa > 0) out.push(a);
            if ((fa > 0) !== (fb > 0)) {
                const u = fa / (fa - fb);
                out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]);
            }
        }
        poly = out;
    }
    // Clipping a corner exactly leaves a repeated vertex, and a half plane that
    // lies along an edge leaves a collinear one. A consumer drawing this would
    // not care; one counting its sides would, and the regular pentagon's fence
    // is a pentagon only once both are gone.
    const tidy = poly.filter((p, i) => {
        const q = poly[(i + poly.length - 1) % poly.length];
        return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
    });
    const scale = Math.max(1, ...tidy.map((p) => Math.hypot(p[0], p[1])));
    return tidy.filter((p, i) => {
        const a = tidy[(i + tidy.length - 1) % tidy.length];
        const b = tidy[(i + 1) % tidy.length];
        return Math.abs(cross([p[0] - a[0], p[1] - a[1]],
                              [b[0] - p[0], b[1] - p[1]])) > 1e-9 * scale * scale;
    });
}

/**
 * Nearest legal origin to `want`, for dragging: the fence is convex, so the
 * closest point of it is the closest point on whichever edge, and a point
 * already inside is returned unchanged.
 *
 * Returns `null` when the fence is empty, where there is nothing to be near.
 *
 * @param {readonly Pt[]} points
 * @param {Pt} want
 * @returns {Pt | null}
 */
export function nearestOrigin(points, want) {
    const fence = originFence(points);
    if (!fence.length) return null;
    let inside = true;
    for (let i = 0; i < fence.length; i++) {
        const a = fence[i], b = fence[(i + 1) % fence.length];
        if (cross([b[0] - a[0], b[1] - a[1]],
                  [want[0] - a[0], want[1] - a[1]]) < 0) { inside = false; break; }
    }
    if (inside) return want;

    /** @type {Pt} */
    let best = fence[0];
    let bestD = Infinity;
    for (let i = 0; i < fence.length; i++) {
        const a = fence[i], b = fence[(i + 1) % fence.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = dx * dx + dy * dy;
        const u = len === 0 ? 0 : Math.max(0, Math.min(1,
            ((want[0] - a[0]) * dx + (want[1] - a[1]) * dy) / len));
        /** @type {Pt} */
        const q = [a[0] + u * dx, a[1] + u * dy];
        const d = Math.hypot(q[0] - want[0], q[1] - want[1]);
        if (d < bestD) { bestD = d; best = q; }
    }
    return best;
}
