// The construction itself: directions, crossings, K-tuples, rhombs.

import type { Pentagrid, Rhomb, Vec2, ViewRect } from "./types.js";

/** The pentagrid's n. Grids of other orders pass their own; this is the default. */
export const NUM_GRIDS = 5;

/** The tie-break in the ceiling, so a point exactly on a line resolves to one
 *  side consistently everywhere it is asked. */
export const K_EPS = 1e-9;

/**
 * n unit vectors at 2*pi/n — five at 72 degrees for the pentagrid.
 *
 * With verticalSymmetry the star is turned a quarter turn, so v0 points up and
 * family 0's LINES are horizontal. For odd n the bare direction set is mirror
 * symmetric about the x-axis (j and n-j reflect onto each other), so the quarter
 * turn moves that symmetry onto the vertical axis — at n = 5, angles 90, 162,
 * 234, 306, 18. It cannot disturb regularity: that depends only on angle
 * differences, which a common rotation preserves.
 */
export function makeDirections(verticalSymmetry: boolean, n: number = NUM_GRIDS): Vec2[] {
    const offset = verticalSymmetry ? Math.PI / 2 : 0;
    const out: Vec2[] = [];
    for (let j = 0; j < n; j++) {
        const a = (2 * Math.PI * j) / n + offset;
        out.push([Math.cos(a), Math.sin(a)]);
    }
    return out;
}

/** Where line nj of family j meets line nk of family k. Null if parallel. */
export function solveIntersection(
    pg: Pentagrid, j: number, k: number, nj: number, nk: number,
): Vec2 | null {
    const [cj, sj] = pg.directions[j];
    const [ck, sk] = pg.directions[k];
    const det = cj * sk - sj * ck;
    if (Math.abs(det) < 1e-10) return null;
    const rj = nj - pg.gamma[j];
    const rk = nk - pg.gamma[k];
    return [(sk * rj - sj * rk) / det, (cj * rk - ck * rj) / det];
}

/** K_j(x) = ceil(x·v_j + γ_j), the pentagrid coordinates of a point. */
export function computeKTuple(pg: Pentagrid, x: number, y: number): number[] {
    const K: number[] = [];
    for (let j = 0; j < pg.n; j++) {
        const dot = pg.directions[j][0] * x + pg.directions[j][1] * y;
        K.push(Math.ceil(dot + pg.gamma[j] - K_EPS));
    }
    return K;
}

/** The dual vertex f(x) = Σ K_j·v_j for a K-tuple. */
export function dualVertex(pg: Pentagrid, K: readonly number[]): Vec2 {
    let fx = 0, fy = 0;
    for (let j = 0; j < pg.n; j++) {
        fx += K[j] * pg.directions[j][0];
        fy += K[j] * pg.directions[j][1];
    }
    return [fx, fy];
}

/** The rhomb dual to one crossing. x0,y0 is that crossing, in grid coordinates. */
export function computeRhomb(
    pg: Pentagrid, j: number, k: number, nj: number, nk: number,
    x0: number, y0: number,
): Rhomb {
    const baseK: number[] = [];
    let fx = 0, fy = 0;
    for (let i = 0; i < pg.n; i++) {
        let Ki: number;
        if (i === j) Ki = nj;
        else if (i === k) Ki = nk;
        else {
            const dot = pg.directions[i][0] * x0 + pg.directions[i][1] * y0;
            Ki = Math.ceil(dot + pg.gamma[i] - K_EPS);
        }
        baseK.push(Ki);
        fx += Ki * pg.directions[i][0];
        fy += Ki * pg.directions[i][1];
    }

    const [vjx, vjy] = pg.directions[j];
    const [vkx, vky] = pg.directions[k];

    const vertices: Vec2[] = [
        [fx, fy],
        [fx + vjx, fy + vjy],
        [fx + vjx + vkx, fy + vjy + vky],
        [fx + vkx, fy + vky],
    ];

    // base, base+e_j, base+e_j+e_k, base+e_k
    const kTuples: number[][] = [
        baseK,
        baseK.map((v, i) => (i === j ? v + 1 : v)),
        baseK.map((v, i) => (i === j || i === k ? v + 1 : v)),
        baseK.map((v, i) => (i === k ? v + 1 : v)),
    ];

    const d = Math.min(k - j, pg.n - (k - j));
    return { vertices, kTuples, cls: d, thick: d === 1, j, k, nj, nk, x0, y0 };
}

export interface CollectOptions {
    /** Registration gain. vis is in tiling coordinates but the line indices are
     *  grid-space, so the search range is vis divided by this. Without it the
     *  loops over-generate by gain² and throw the excess away. */
    gain?: number;
    /** Which families participate. Omitted means all of them. */
    active?: readonly boolean[];
    /**
     * Restrict a family to one of its lines. `lines[j] = n` keeps only line n of
     * family j; null or omitted keeps all of them.
     *
     * This restricts the *pairs involving that family*, and nothing else: the
     * tiles the other families make between themselves are untouched. So it does
     * not isolate a ribbon on its own — the ribbon is the part of the result that
     * involves the restricted family. Restricting every family does leave only
     * the tiles where the chosen lines cross.
     */
    lines?: readonly (number | null | undefined)[];
    /**
     * Keep only tiles that family takes part in. No combination of `active` and
     * `lines` can do this — enabling two families necessarily admits their pair —
     * so isolating a ribbon needs its own idea.
     *
     * With `lines[j] = n` as well, what is left is exactly line n's ribbon.
     */
    only?: number | null;
    /** Hard cap on the index range, to bound the work when zoomed far out. */
    maxNCap?: number;
    /** How far outside vis a vertex may be and still count as visible. */
    pad?: number;
}

/** Every rhomb with a vertex in (or near) vis. vis is in TILING coordinates. */
export function collectRhombs(
    pg: Pentagrid, vis: ViewRect, opts: CollectOptions = {},
): Rhomb[] {
    const gain = opts.gain ?? 1;
    const cap = opts.maxNCap ?? 50;
    const pad = opts.pad ?? 1.5;
    const active = opts.active;

    const maxCoord = Math.max(
        Math.abs(vis.xMin), Math.abs(vis.xMax),
        Math.abs(vis.yMin), Math.abs(vis.yMax),
    ) / gain;
    const maxN = Math.min(Math.ceil(maxCoord) + 5, cap);

    const lines = opts.lines;
    /** The line indices family j contributes: all of them, or just the one. */
    const range = (j: number): [number, number] => {
        const fixed = lines?.[j];
        return (fixed === null || fixed === undefined)
            ? [-maxN, maxN] : [fixed, fixed];
    };

    const only = opts.only ?? null;

    const rhombs: Rhomb[] = [];
    for (let j = 0; j < pg.n; j++) {
        if (active && !active[j]) continue;
        const [jLo, jHi] = range(j);
        for (let k = j + 1; k < pg.n; k++) {
            if (active && !active[k]) continue;
            if (only !== null && j !== only && k !== only) continue;
            const [kLo, kHi] = range(k);
            for (let nj = jLo; nj <= jHi; nj++) {
                for (let nk = kLo; nk <= kHi; nk++) {
                    const pt = solveIntersection(pg, j, k, nj, nk);
                    if (!pt) continue;
                    const rhomb = computeRhomb(pg, j, k, nj, nk, pt[0], pt[1]);
                    for (const [vx, vy] of rhomb.vertices) {
                        if (vx >= vis.xMin - pad && vx <= vis.xMax + pad &&
                            vy >= vis.yMin - pad && vy <= vis.yMax + pad) {
                            rhombs.push(rhomb);
                            break;
                        }
                    }
                }
            }
        }
    }
    return rhombs;
}

/** Range of line indices of family j crossing vis (vis in GRID coordinates). */
export function lineRange(pg: Pentagrid, j: number, vis: ViewRect): [number, number] {
    const [vx, vy] = pg.directions[j];
    let lo = Infinity, hi = -Infinity;
    const corners: Vec2[] = [
        [vis.xMin, vis.yMin], [vis.xMax, vis.yMin],
        [vis.xMin, vis.yMax], [vis.xMax, vis.yMax],
    ];
    for (const [x, y] of corners) {
        const d = vx * x + vy * y + pg.gamma[j];
        if (d < lo) lo = d;
        if (d > hi) hi = d;
    }
    return [Math.ceil(lo) - 1, Math.floor(hi) + 1];
}
