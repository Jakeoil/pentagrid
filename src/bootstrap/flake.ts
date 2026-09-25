// Step 1: the pentaflake, and the P wheel as a measurement off it.
//
// Jake's construction, 2026-09-24, and it is the honest first step — the wheels
// are not given, they are measured off a figure you build by hand:
//
//     Copy 1 2 3 4 5. Rotate the copy 180° through O. Put it so that edge 12
//     touches edge 21; the next copy so 23 touches 32, then 34-43, 45-54, and
//     51 touches 15. That is a pentaflake. All the copies are yellow.
//
//     The first value of your P wheel (gen 1) will be O to O_1, O to O_2, etc.
//
// Rotating 180° through O sends corner j to −pts[j]. For the copy's edge
// (k+1 → k) to land on the original's edge (k → k+1) the copy must move by T:
//
//     −pts[k+1] + T = pts[k]        and        −pts[k] + T = pts[k+1]
//
// Both equations give the same T, which is what makes the edge coincide rather
// than merely touch, and that T is the leaf's center:
//
//     O_k = pts[k] + pts[k+1]
//
// So a P vector is just the two corners of the shared edge, added. This module
// derives it that way, by construction, rather than reading it off
// penrose-mosaic. The identity `P[t] = D[t−1] + D[t+1]` used in `wheel.ts` is
// the same statement at the odd tenths, and the pentaflake is its reason.

import { m10, type Pt, type Wheel } from "./wheel.js";

/** One pentagon of the flake: its corners, its center, and how far it is turned. */
export interface Leaf {
    /** The five corners, in the same order as the points they came from. */
    readonly corners: readonly Pt[];
    /** The center — O for the middle pentagon, O_k for a leaf. */
    readonly center: Pt;
    /**
     * Which tenth this pentagon faces. The middle keeps tenth 0; a leaf is the
     * 180° copy, so it faces the opposite way and takes an odd tenth.
     */
    readonly tenth: number;
    /**
     * The index of the center pentagon's edge this leaf was placed against,
     * so `edge` and `edge + 1` are the two corners they share. −1 for the middle.
     */
    readonly edge: number;
}

const neg = (p: Pt): Pt => [-p[0], -p[1]];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

/**
 * Build the flake: the middle pentagon and the five copies placed against its
 * edges. The middle is penrose-mosaic's blue Pe5 and the leaves its yellow Pe3.
 */
export function pentaflake(pts: readonly Pt[]): readonly Leaf[] {
    if (pts.length !== 5) throw new Error(`need five points, got ${pts.length}`);
    const middle: Leaf = { corners: pts, center: [0, 0], tenth: 0, edge: -1 };
    const leaves = pts.map((_, k) => {
        const center = add(pts[k], pts[(k + 1) % 5]);
        return {
            corners: pts.map((p) => add(neg(p), center)),
            center,
            tenth: m10(2 * k + 1),
            edge: k,
        };
    });
    return [middle, ...leaves];
}

/**
 * The P wheel, measured off the flake rather than stated.
 *
 * The five leaf centers are the five ODD tenths — the down half — because a
 * leaf is the 180° copy and faces the other way. The even tenths are the same
 * construction run on a leaf, which is the flake seen from one of its own
 * petals, so the ten come from the one figure.
 */
export function pWheelFromFlake(pts: readonly Pt[]): Wheel {
    const w: Pt[] = new Array(10);
    for (let k = 0; k < 5; k++) {
        const o = add(pts[k], pts[(k + 1) % 5]);
        w[m10(2 * k + 1)] = o;
        w[m10(2 * k + 1 + 5)] = neg(o);
    }
    return w;
}

/**
 * The edge each leaf shares with the middle, as the two points it runs between.
 * This is what "12 touches 21" means once it is built, and it is the check that
 * the placement is a coincidence of edges and not an approximate abutment.
 */
export function sharedEdge(pts: readonly Pt[], k: number): readonly [Pt, Pt] {
    return [pts[k], pts[(k + 1) % 5]];
}
