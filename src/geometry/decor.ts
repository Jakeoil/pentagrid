// The arc decoration, as geometry. Drawing is somebody else's problem.
//
// Every edge of every rhomb is +v_j from one of its endpoints, and that
// orientation is global, so putting the crossing point at the same fraction ARC_T
// along every edge makes the curves join across every shared edge automatically.
// No matching rules to enforce — they fall out of the construction.
//
// A rhomb f, f+v_j, f+v_j+v_k, f+v_k then carries exactly two arcs: one centred
// at f of radius ARC_T (both its edges leave f in a + direction), and one at the
// opposite corner of radius 1-ARC_T. The radii sum to 1, which is what makes them
// meet. 1/φ² and 1/φ are the golden choice.

import type { Pentagrid, Rhomb } from "./types.js";

export const PHI = (1 + Math.sqrt(5)) / 2;
export const ARC_T = 1 / (PHI * PHI);

export interface Arc {
    x: number; y: number;   // centre, in tiling coordinates
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
