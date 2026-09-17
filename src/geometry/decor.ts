// The arc decoration, as geometry. Drawing is somebody else's problem.
//
// Every edge of every rhomb is +v_j from one of its endpoints, and that
// orientation is global, so putting the crossing point at the same fraction ARC_T
// along every edge makes the curves join across every shared edge automatically.
// No matching rules to enforce — they fall out of the construction.
//
// A rhomb f, f+v_j, f+v_j+v_k, f+v_k then carries exactly two arcs: one centered
// at f of radius ARC_T (both its edges leave f in a + direction), and one at the
// opposite corner of radius 1-ARC_T. The radii sum to 1, which is what makes them
// meet. 1/φ² and 1/φ are the golden choice.

import type { Pentagrid, Rhomb } from "./types.js";

export const PHI = (1 + Math.sqrt(5)) / 2;
export const ARC_T = 1 / (PHI * PHI);

export interface Arc {
    x: number; y: number;   // center, in tiling coordinates
    r: number;              // radius, in tiling units
    a1: number; a2: number; // from angle a1 to a2, the short way
    family: 0 | 1;          // which of the two loop families
}

/** The two arcs of one rhomb. */
export function rhombArcs(pg: Pentagrid, r: Rhomb): [Arc, Arc] {
    const [vjx, vjy] = pg.directions[r.j];
    const [vkx, vky] = pg.directions[r.k];
    const aj = Math.atan2(vjy, vjx);
    const ak = Math.atan2(vky, vkx);
    const [fx, fy] = r.vertices[0];
    const [gx, gy] = r.vertices[2];
    return [
        { x: fx, y: fy, r: ARC_T, a1: aj, a2: ak, family: 0 },
        { x: gx, y: gy, r: 1 - ARC_T, a1: aj + Math.PI, a2: ak + Math.PI, family: 1 },
    ];
}

/** Where the arcs cross one edge: the tail vertex plus ARC_T along it. Shared by
 *  both rhombs on that edge, which is why the curves join. */
export function edgeCrossing(pg: Pentagrid, tail: readonly [number, number], family: number) {
    const [vx, vy] = pg.directions[family];
    return [tail[0] + ARC_T * vx, tail[1] + ARC_T * vy] as [number, number];
}

/** Penrose's arrow on one edge: where, which way, and whether it is doubled. */
export interface EdgeArrow {
    /** The edge's midpoint. */
    x: number; y: number;
    /** Unit vector the arrow points along. */
    dx: number; dy: number;
    double: boolean;
}

/**
 * The AR-pattern — de Bruijn's Arrowed Rhombs, Penrose's matching rule — read
 * off the vertex indices.
 *
 * On a Penrose patch the index takes four values, 1..4 with `lo` as 1, and an
 * edge joins indices one apart. De Bruijn (1981) Fig. 1 gives the two prototiles:
 * green (double) arrows meet at one corner — a 72° corner of the thick rhomb, a
 * 144° corner of the thin — pointing INTO it; red (single) arrows sit on the two
 * edges at the opposite corner, and here the two tiles differ:
 *
 *     thick   singles point OUT of that corner
 *     thin    singles point INTO it
 *
 * In index terms the green corner is the extreme, 1 or 4, so the doubles are the
 * 1-2 and 3-4 edges pointing into the 1 and into the 4 — Jake's "the center of
 * the rhomb groups determine the AR pattern", the centers being the extremes.
 * The red corner is the other end of that diagonal, index 3 on a (1,2,3,2) tile
 * and 2 on a (2,3,4,3) tile, and the singles point out of it on a thick and into
 * it on a thin.
 *
 * The thick/thin difference is not decoration: most 2-3 edges are shared by a
 * thick and a thin of different m, and only the opposite senses make them agree.
 * Verified over 773 shared edges on three gammas: no disagreement, and exactly
 * two marked prototiles. Every rule that directed the singles by index alone
 * gave four.
 *
 * Off a Penrose patch the index spans five values and the rule does not apply.
 */
export function rhombArrows(pg: Pentagrid, r: Rhomb, lo: number): EdgeArrow[] {
    const idx = (K: readonly number[]) => K.reduce((a, b) => a + b, 0) - lo + 1;
    const out: EdgeArrow[] = [];
    for (let i = 0; i < 4; i++) {
        const A = r.vertices[i], B = r.vertices[(i + 1) % 4];
        const a = idx(r.kTuples[i]), b = idx(r.kTuples[(i + 1) % 4]);
        const [lowI, highI] = a < b ? [a, b] : [b, a];
        const dbl = lowI === 1 || highI === 4;
        let toward: number;
        if (dbl) {
            toward = lowI === 1 ? 1 : 4;                 // into the extreme
        } else {
            const m = idx(r.kTuples[0]);                 // 1 or 2 on a Penrose patch
            const red = m === 1 ? 3 : 2;                 // the corner opposite the green
            toward = r.thick ? (red === 3 ? 2 : 3) : red; // thick: out of it; thin: into it
        }
        const [from, to] = toward === a ? [B, A] : [A, B];
        const dx = to[0] - from[0], dy = to[1] - from[1];
        const len = Math.hypot(dx, dy) || 1;
        out.push({ x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2,
                   dx: dx / len, dy: dy / len, double: dbl });
    }
    return out;
}
