// @ts-check
// The seed: five ordered points AND the origin their spokes are measured from.
//
// The geometry this file implements is written up in `GEOMETRY.md` -- Gaussean
// Pentadic Geometry, Jake's name for it. What is here is the arithmetic and the
// reasons for it; what is there is the object, with every number measured.
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
import { pentagon } from "./walk.js";

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
 * The five, walked `by` half generations along the wheel ladder.
 *
 * Jake, 2026-11-25: *we don't need the use button. Just move the handles to
 * their appointed area.* So a rung is not a view of a derived figure any more
 * -- it is a MOVE, and this is the move. The origin stays where it is and the
 * five land on the rung, which is why the handles stay live and a page's output
 * follows without a second click.
 *
 * **Pinned on the integral centroid, and that is the whole trick.**
 * `pentagon(d, 0)` places a figure by its own first spoke, and a half rung's
 * wheel starts somewhere else, so taking it at face value slides the pentagon a
 * little on every half step -- (0, -1) for the quadrille, (2, 1) for the
 * asymmetric, nothing at all for the even pentad (evenness again: the half-step
 * wheel closes integrally only when the five sum to a multiple of five). Those
 * slides compound: eight halves up and eight back left the quadrille 13107
 * units away from where it started. Pinning the centroid instead makes the walk
 *
 *   - **exact at rung 0**, so stepping nowhere moves nothing;
 *   - **reversible**, up and back to the point;
 *   - **composable** -- k steps of a half equal one step of k halves, at every
 *     rung and on every preset, which is what lets the control just count.
 *
 * That last one supersedes a caveat this page used to carry, that composing two
 * half rungs is not one generation on an irregular pentagon. The discrepancy was
 * the placement, not the shape; with the centroid pinned, `halfUp` twice and
 * `inflate` once land on the same five. Measured in `tests/seed.test.mjs`.
 *
 * The centroid is ROUNDED (`integralCentroid`), so a lattice seed stays on the
 * lattice: the shift is a difference of two lattice points. On an irrational
 * figure both centroids round the same way and the shift is zero, which is what
 * the unpinned take already did there.
 *
 * @param {Seed} seed
 * @param {number} by half generations, positive up
 * @returns {Seed}
 */
export function walkSeed(seed, by) {
    const spk = spokesOf(seed);
    const taken = pentagon(wheelsAt(spk, 1 + by).d, 0);
    const was = integralCentroid(spk);
    const now = integralCentroid(taken);
    const dx = was[0] - now[0] + seed.origin[0];
    const dy = was[1] - now[1] + seed.origin[1];
    return {
        points: taken.map((q) => /** @type {Pt} */ ([q[0] + dx, q[1] + dy])),
        origin: seed.origin,
    };
}

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
 * Which preset this seed is, or `"custom"`.
 *
 * Compared on the **spokes**, not the points. A preset is five vectors from an
 * origin, so a pentagon slid away from its origin is no longer that preset even
 * though its five corners still trace the same shape -- and the five corners
 * alone cannot tell you where it is being measured from, which is the whole
 * subject of this file.
 *
 * Used twice over: the page's preset picker stays honest without the user
 * having to toggle away and back to reload one, and the floating panel's title
 * bar names the seed, so folding the panel to its bar loses nothing.
 *
 * @param {Seed} seed
 * @returns {string} a key of `PRESETS`, or `"custom"`
 */
export function presetName(seed) {
    const now = spokesOf(seed);
    for (const [name, preset] of Object.entries(PRESETS))
        if (preset.length === now.length
            && preset.every((v, i) => Math.abs(v[0] - now[i][0]) < 1e-9
                                   && Math.abs(v[1] - now[i][1]) < 1e-9))
            return name;
    return "custom";
}

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
 * The centroid rounded to the nearest lattice point: the best **integral**
 * stand-in for the sweet spot, and what the `closest` box on the page assigns.
 *
 * The centroid of five lattice points is in (1/5)Z² and an integer only when
 * the five sum to a multiple of five -- an EVEN pentad, `GEOMETRY.md` §8 -- so
 * for everything else the two are different points and you have to choose:
 *
 *  - the centroid itself is where the rhomb spellings agree and every rhomb
 *    closes as an exact parallelogram (§5). It costs a non-integral origin, so
 *    the spokes stop being Gaussian integers and the whole derived figure comes
 *    off the unit lattice onto the fifths.
 *  - this point keeps the origin integral, so the spokes stay integers and
 *    every wheel above stays on the lattice. It costs the exactness: the origin
 *    is up to (1/2, 1/2) off the centroid, and §5's offset is that much.
 *
 * On an even pentad there is nothing to choose and this IS the centroid, which
 * is the cleanest way to see what evenness buys.
 *
 * @param {readonly Pt[]} points
 * @returns {Pt}
 */
export function integralCentroid(points) {
    const c = centroidOf(points);
    // `+ 0` is not noise: `Math.round(-0.4)` is NEGATIVE zero, which is a
    // lattice point that formats as "-0" in a readout and fails a deep-equal
    // against 0. -0 + 0 is +0, and the sign is gone.
    return [Math.round(c[0]) + 0, Math.round(c[1]) + 0];
}

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

// ── the floater: one handle driven by the others ──────────────────────────
//
// Jake, 2026-11-23: *I would like to be able to assign a floater point by
// double clicking it. By default, the center is a floater. But you will be able
// to fix the center by choosing another point as the floater. Analogous to the
// sums/gamma system in the reticulum.*
//
// The analogy is exact, and it is worth laying the two side by side:
//
//     reticulum                          pentadiculum
//     five offsets γⱼ                    six handles: five points and the origin
//     Σγ, a target you can retarget      Σ spokes, likewise
//     the LOCKED index                   the FLOATER
//     clicked on its γⱼ label            double-clicked on its handle
//     the dependent axis refuses a push  the floater is not pushed; it follows
//     locked = −1, the total floats      floater = −1, every handle is free
//
// `relock` in `src/geometry/gamma.ts` is the model this mirrors: the dependent
// value is re-derived from the rest after every move, and the view only reports
// intent. Same split here — this function is the whole of the rule, and nothing
// in the UI recomputes any of it.

/**
 * The handle that is the origin rather than one of the five. A floater is a
 * point index 0–4, this for the origin, or −1 for nothing.
 */
export const HANDLE_ORIGIN = 5;

/**
 * **Σ spokes**, the quantity a floater holds:
 *
 *     Σ(pₖ − o) = Σp − 5o = 5·(centroid − origin)
 *
 * So holding it fixed holds the origin's offset from the centroid — the origin
 * keeps its relationship to the figure instead of being left behind by it. At
 * zero the origin IS the centroid, and everything in `centroidOf` applies: P =
 * S, `inflate(D) = T`, all three rhomb spellings one exact parallelogram. Hold
 * zero and a drag can no longer leave that.
 *
 * @param {Seed} seed
 * @returns {Pt}
 */
export function spokeSum(seed) {
    const s = spokesOf(seed);
    return [s.reduce((a, v) => a + v[0], 0), s.reduce((a, v) => a + v[1], 0)];
}

/**
 * Float dust from the one division by five. 1/5 is not a dyadic rational, so
 * `(Σp − target) / 5` lands a few ulps off a coordinate that ought to read
 * 0.2 — and the center snaps in fifths precisely because these values are
 * fifths. This is not a snap: nothing is moved to a grid it was not on, only
 * the twelfth decimal of a number that was already there is swept up.
 * @type {(v: number) => number}
 */
const dust = (v) => Math.round(v * 1e12) / 1e12;

/**
 * Move one handle and let the floater absorb it, so that `spokeSum` stays at
 * `target`. The whole rule, in one place.
 *
 * Three cases, and each one is solving for a single unknown:
 *
 *  - **Nothing floats** (`floater < 0`), or the hand is ON the floater: a plain
 *    move. Dragging the floater is how the target is RETARGETED — the
 *    reticulum's sum strip, not its locked dial — so the caller re-reads
 *    `spokeSum` afterwards. Without this the origin could never be placed at
 *    all once it was floating, and the fence would stop meaning anything.
 *  - **The origin floats**: `o = (Σp − target) / 5`. Drag a point by δ and the
 *    origin follows by δ/5; the dragged spoke changes by 4δ/5 and the other
 *    four by −δ/5 each.
 *  - **A point floats**: Σp must stay at `target + 5o`, so that point takes
 *    whatever is left over. Drag another by δ and it answers with −δ, which
 *    pins the centroid and lets the pentagon flex about it. The origin is then
 *    NOT A HANDLE — Jake's *fix the center by choosing another point* — and is
 *    returned untouched if something asks to move it anyway. Absorbing an
 *    origin drag would cost the floating point five units per unit of origin,
 *    and a handle that flings another handle five times as far is not a handle
 *    anyone can use.
 *
 * @param {Seed} seed
 * @param {number} handle 0–4 for a point, `HANDLE_ORIGIN` for the origin
 * @param {Pt} to where that handle has been dragged
 * @param {number} floater which handle follows, or −1 for none
 * @param {Pt} target the spoke sum to hold
 * @returns {Seed} a new seed; the one given back unchanged where the move is
 *     refused
 */
export function moveHandle(seed, handle, to, floater = -1, target = [0, 0]) {
    /** @type {(i: number, v: Pt) => Pt[]} */
    const set = (i, v) => seed.points.map((p, k) =>
        /** @type {Pt} */ (k === i ? v : [p[0], p[1]]));

    if (floater < 0 || handle === floater)
        return handle === HANDLE_ORIGIN
            ? { points: seed.points.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin: to }
            : { points: set(handle, to), origin: [seed.origin[0], seed.origin[1]] };

    if (floater === HANDLE_ORIGIN) {
        if (handle === HANDLE_ORIGIN) return seed;     // unreachable: it floats
        const points = set(handle, to);
        const sx = points.reduce((a, p) => a + p[0], 0);
        const sy = points.reduce((a, p) => a + p[1], 0);
        return { points, origin: [dust((sx - target[0]) / 5), dust((sy - target[1]) / 5)] };
    }

    if (handle === HANDLE_ORIGIN) return seed;         // the center is fixed
    const points = set(handle, to);
    // Σp has to come to `target + 5o`, and the floating point is the one term
    // free to make it so.
    const rest = points.reduce((a, p, k) => k === floater
        ? a : /** @type {Pt} */ ([a[0] + p[0], a[1] + p[1]]), /** @type {Pt} */ ([0, 0]));
    points[floater] = [
        dust(target[0] + 5 * seed.origin[0] - rest[0]),
        dust(target[1] + 5 * seed.origin[1] - rest[1]),
    ];
    return { points, origin: [seed.origin[0], seed.origin[1]] };
}
