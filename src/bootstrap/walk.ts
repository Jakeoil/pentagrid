// Tiles as closed walks, so a rotation is an index shift.
//
// penrose-mosaic stores each tile as a list of lattice points, and stores it
// again for every rotation it needs — `boatUp`, `boatWon`, `boatToo`, and the
// seven more that `shapeWheel` fills in by reflection. Eight arrays for four
// tiles. The reason is that on the integer lattice a rotated tile is not
// congruent to the original, so you cannot rotate the coordinates.
//
// You can rotate the INDICES. A tile outline is a closed walk in the edge wheel
// E, written as the tenth of each step, and turning the tile by one tenth is
// adding one to every step. The walk is rotation-invariant; the coordinates it
// lands on are not, and that is the quadrille's whole character: the combinatorics
// are exact and the metric is whatever the lattice can manage at that angle.

import { m10, type Pt, type Wheel, type WheelSet } from "./wheel.js";

/** A closed outline: the tenth of each edge, in order. Sums to zero in E. */
export type Walk = readonly number[];

/** Turn a walk by `n` tenths. This is the only rotation primitive in the module. */
export const turn = (walk: Walk, n: number): Walk => walk.map((t) => m10(t + n));

/** Reverse the winding. Kept because penrose-mosaic's diamond is wound the other way. */
export const reverse = (walk: Walk): Walk => [...walk].reverse();

/**
 * Walk it out in a wheel, from `origin`. Returns one vertex per step, the first
 * being `origin`; the last step closes back onto it and is not emitted.
 */
export function vertices(walk: Walk, e: Wheel, origin: Pt = [0, 0]): Pt[] {
    const out: Pt[] = [origin];
    let cur = origin;
    for (const t of walk.slice(0, -1)) {
        cur = [cur[0] + e[m10(t)][0], cur[1] + e[m10(t)][1]];
        out.push(cur);
    }
    return out;
}

/** Does the walk close? A tile whose steps do not sum to zero is not a tile. */
export function closes(walk: Walk, e: Wheel): boolean {
    let x = 0, y = 0;
    for (const t of walk) { x += e[m10(t)][0]; y += e[m10(t)][1]; }
    return x === 0 && y === 0;
}

/**
 * The four P1 tiles, as walks in E. Read off penrose-mosaic's `Quadrille` shape
 * data once and checked to reproduce it exactly, including every rotation it
 * stores separately (`tools/bootstrap.test.mjs`).
 *
 * Deriving these from the pentagon rather than reading them off is step 0
 * proper, and is not done yet — see discrete-directions/NOTES.md. What IS
 * settled is that four walks replace the eight stored arrays, because:
 *
 *     boatWon    = turn(BOAT, 1)
 *     boatToo    = turn(BOAT, 2)
 *     diamondWon = turn(DIAMOND, 1)      (wound the other way in the original)
 *     diamondToo = turn(DIAMOND, 2)
 *
 * and penta and star need no second array at all, being invariant under a fifth.
 */

/**
 * Where a tile's reference point sits, and why the walk alone is not enough.
 *
 * penrose-mosaic stores each outline as offsets from the tile's `loc`, and `loc`
 * is NOT a corner: for a pentagon it is the center, for the star family it is the
 * star's center — which for a diamond is one of its two tips, "hence the name
 * St1" (NOTES). A walk knows the shape and not where it hangs, so placing one by
 * its first vertex displaces it, and by a different amount at each tenth.
 *
 * The anchors are not stored either. Measured against all eight of
 * penrose-mosaic's arrays, they are exactly:
 *
 *     pentagon       D[t]
 *     star, boat, diamond    P[t]
 *
 * which is uniform, derived, and the reason the pentagon needs no walk at all —
 * see `pentagon()` below.
 */
export function anchorFor(type: "penta" | "star", w: WheelSet, tenth: number): Pt {
    return type === "penta" ? w.d[m10(tenth)] : w.p[m10(tenth)];
}

/**
 * A pentagon at tenth `t`, as offsets from its center: the D wheel at stride 2.
 *
 * No walk, no stored array, no anchor question. The ten tenths give exactly two
 * polygons — the five points and their negatives — which is what a pentagon must
 * do, and it generalizes to five points with no symmetry because the second
 * polygon is the 180° copy rather than a mirror image.
 */
export function pentagon(d: Wheel, tenth: number, loc: Pt = [0, 0]): Pt[] {
    return [0, 1, 2, 3, 4].map((i) => {
        const v = d[m10(tenth + 2 * i)];
        return [loc[0] + v[0], loc[1] + v[1]] as Pt;
    });
}

/** The star family, placed: walk it from `loc + P[t]`. */
export function starOutline(walk: Walk, w: WheelSet, tenth: number, loc: Pt): Pt[] {
    const a = anchorFor("star", w, tenth);
    return vertices(turn(walk, tenth), w.e, [loc[0] + a[0], loc[1] + a[1]]);
}

/** Pe — the pentagon. Five odd tenths: it is the pentagon's own five sides. */
export const PENTA: Walk = [1, 3, 5, 7, 9];

/** St5 — the star. Ten even tenths, tips and dimples alternating. */
export const STAR: Walk = [2, 0, 4, 2, 6, 4, 8, 6, 0, 8];

/** St3 — the boat. A star with two points missing. */
export const BOAT: Walk = [2, 0, 4, 5, 6, 0, 8];

/** St1 — the diamond. A star with one point: hence the name. */
export const DIAMOND: Walk = [2, 3, 7, 8];

/**
 * The rhombs — the P3 overlay, which walks in the wheels rather than in E,
 * because its edges are wheel vectors and not tile edges.
 *
 * penrose-mosaic builds them in `goThick`/`goThin` as three steps from a
 * corner, the fourth closing. In real geometry every step is a T vector and the
 * figure is a rhomb. In quadrille its first step is spelled `P + D` instead,
 * which is `inflate(D)` — also ×φ², but the OTHER integer representative of
 * that rung, differing by My's λ = −1 term.
 *
 * That mixture is visible in the result. Because `W[k + 5] = −W[k]`, a figure
 * spelled in ONE wheel has its first and third steps exactly opposite, and the
 * closing edge exactly opposite the second: an exact parallelogram, for any five
 * points. It is equilateral only where the wheel's spokes agree — the T wheel's
 * are 8.000, 9.434, 8.246, 8.246, 9.434 and repeat, so the thick rhomb is a true
 * rhomb at tenths 0 and 5 and a leaning parallelogram elsewhere. Mixing the two
 * spellings loses even that:
 *
 *     real, all four on T           1.000 1.000 1.000 1.000    rhomb
 *     quadrille, all four on T      9.434 9.434 9.434 9.434    rhomb at this tenth
 *     quadrille, all four on D+P    8.602 8.602 8.602 8.602    rhomb at this tenth
 *     quadrille, penrose-mosaic's   8.602 9.434 9.434 8.602    kite: not a parallelogram
 *
 * So the spelling is a choice, and it is made explicit here rather than
 * inherited. `Spelling.t` is the default; `Spelling.legacy` reproduces
 * penrose-mosaic exactly, which is what the test checks against. The source
 * there flags the line itself — the comment above `goThickReal` wonders whether
 * the modes can be unified "if the real of d + p == t". They cannot, and this
 * is what the difference does.
 */
export interface RhombSpec {
    /** Three tenth offsets; the fourth edge closes the figure. */
    readonly steps: readonly [number, number, number];
}

export const THICK: RhombSpec = { steps: [9, 1, 4] };
export const THIN: RhombSpec = { steps: [3, 7, 8] };

/** Which wheel each step is taken in. */
export type Spelling = "t" | "inflated" | "legacy";

/**
 * Walk a rhomb out. `t` is the T wheel, `inflated` is `inflate(D)` — both ×φ²,
 * and both needed because they are not the same integer wheel.
 */
export function rhombus(
    spec: RhombSpec, t: Wheel, inflated: Wheel, n: number,
    spelling: Spelling = "t",
): Pt[] {
    const wheelFor = (i: number): Wheel =>
        spelling === "t" ? t
        : spelling === "inflated" ? inflated
        : i === 0 ? inflated : t;          // legacy: first step only
    const out: Pt[] = [[0, 0]];
    spec.steps.forEach((k, i) => {
        const w = wheelFor(i)[m10(k + n)];
        const prev = out[out.length - 1];
        out.push([prev[0] + w[0], prev[1] + w[1]]);
    });
    return out;
}
