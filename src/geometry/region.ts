// Recovering a pentagrid region from its K-tuple: the dual map, run backwards.

import type { Pentagrid, Vec2, ViewRect } from "./types.js";
import { K_EPS } from "./pentagrid.js";

/** Clip a polygon to the half-plane a·x + b·y + c ≥ 0 (Sutherland–Hodgman). */
export function clipPoly(poly: Vec2[], a: number, b: number, c: number): Vec2[] {
    if (poly.length === 0) return poly;
    const out: Vec2[] = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const next = poly[(i + 1) % poly.length];
        const dCur = a * cur[0] + b * cur[1] + c;
        const dNext = a * next[0] + b * next[1] + c;
        if (dCur >= 0) out.push(cur);
        if ((dCur >= 0) !== (dNext >= 0)) {
            const t = dCur / (dCur - dNext);
            out.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]);
        }
    }
    return out;
}

/**
 * The region with this K-tuple, as a polygon clipped to vis.
 *
 * The region is the intersection of the ten half-planes K_j - 1 < x·v_j + γ_j ≤
 * K_j, found by clipping against each strip in turn. This is the only place the
 * map is inverted — everywhere else runs region → vertex.
 */
export function regionPoly(pg: Pentagrid, K: readonly number[], vis: ViewRect): Vec2[] {
    let poly: Vec2[] = [
        [vis.xMin, vis.yMin], [vis.xMax, vis.yMin],
        [vis.xMax, vis.yMax], [vis.xMin, vis.yMax],
    ];
    for (let j = 0; j < pg.n; j++) {
        const [vx, vy] = pg.directions[j];
        const lo = K[j] - 1 + K_EPS; // x·v + γ > K_j - 1
        const hi = K[j] + K_EPS;     // x·v + γ ≤ K_j
        poly = clipPoly(poly, vx, vy, pg.gamma[j] - lo);
        poly = clipPoly(poly, -vx, -vy, -(pg.gamma[j] - hi));
        if (poly.length === 0) break;
    }
    return poly;
}
