// The construction itself: directions, crossings, K-tuples, rhombs.

import type { Pentagrid, Rhomb, Vec2, ViewRect } from "./types.js";

/** The pentagrid's n. Grids of other orders pass their own; this is the default. */
export const NUM_GRIDS = 5;

/** The tie-break in the ceiling, so a point exactly on a line resolves to one
 *  side consistently everywhere it is asked. */
export const K_EPS = 1e-9;

/**
 * n unit vectors — five at 72 degrees for the pentagrid.
 *
 * Odd n: at 2*pi/n, a full turn. Even n: at pi/n, a HALF turn, because a full
 * turn would put v_{j+n/2} = -v_j, two families with the same lines, and no
 * crossings between them. The half-turn set is Lutfalla's G_n for even n, the
 * multigrid of an 2n-fold tiling (his Theorem 1.1: P_n(1/2) has global 2n-fold
 * symmetry). Either way the n normals are spread evenly over the undirected
 * directions, the frame is tight (sum v v^T = n/2 I, the registration gain),
 * and the rhomb from families j, k has corner angle pi*(k-j)/n at the
 * half-turn spacing or 2pi*(k-j)/n at the full — the same floor(n/2) shapes,
 * class min(k-j, n-(k-j)) in both. What even n loses is sum v_j = 0, so the
 * index arguments that lean on it (four levels at an integer total) are
 * pentagrid facts and do not carry over.
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
    const turn = n % 2 === 1 ? 2 * Math.PI : Math.PI;
    const out: Vec2[] = [];
    for (let j = 0; j < n; j++) {
        const a = (turn * j) / n + offset;
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
    /**
     * Dualize only the tiles ON the selected gridlines — the ribbons.
     *
     * One entry per family: "all" for every line of it, a number for that one
     * line, null for none. A tile is the crossing of two lines, so it is kept
     * when EITHER of them is selected: family j at "all" keeps every tile that
     * family takes part in (the union of its ribbons), and family j at n keeps
     * exactly line n's ribbon. This is an OR, where `active` is an AND — with
     * `active`, one family on and the rest off gives nothing, because a tile
     * needs both of its families; here it gives that family's ribbons. When
     * `ribbons` is given, `active`, `lines` and `only` are not consulted.
     *
     * Jake: "dualize the tiles only on the specified gridline(family) — the tiles
     * represented by the intersections along the gridline."
     */
    ribbons?: readonly ("all" | number | null)[];
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
    const ribbons = opts.ribbons ?? null;
    /** Is line n of family j one of the selected gridlines? */
    const onRibbon = (j: number, n: number) =>
        ribbons !== null && (ribbons[j] === "all" || ribbons[j] === n);

    const rhombs: Rhomb[] = [];
    for (let j = 0; j < pg.n; j++) {
        if (!ribbons && active && !active[j]) continue;
        const [jLo, jHi] = ribbons ? [-maxN, maxN] : range(j);
        for (let k = j + 1; k < pg.n; k++) {
            if (!ribbons && active && !active[k]) continue;
            if (!ribbons && only !== null && j !== only && k !== only) continue;
            const [kLo, kHi] = ribbons ? [-maxN, maxN] : range(k);
            for (let nj = jLo; nj <= jHi; nj++) {
                for (let nk = kLo; nk <= kHi; nk++) {
                    // On a selected gridline through either of its families.
                    if (ribbons && !onRibbon(j, nj) && !onRibbon(k, nk)) continue;
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

/** A piece of one gridline, between two consecutive crossings on it. */
export interface GridSegment {
    /** The line it lies on. */
    j: number;
    nj: number;
    /** Its ends, in GRID coordinates: the two crossings that bound it. */
    a: Vec2;
    b: Vec2;
    /**
     * The two regions it separates, low side first.
     *
     * They agree in every coordinate but j, where they differ by one — that is
     * what it means for a segment to be a segment. Cross it and only K_j moves.
     */
    K1: readonly number[];
    K2: readonly number[];
}

/**
 * The segment of line (j, nj) nearest to a point, and the regions either side.
 *
 * Same process as the region and the crossing, one dimension down. A region is
 * dual to the vertex f(K); a segment is dual to the EDGE joining the vertices of
 * the two regions it separates, which is f(K1) -> f(K1) + v_j since K2 = K1 + e_j;
 * a crossing is dual to the tile on the four regions around it. One map, read at
 * each dimension.
 *
 * `reach` bounds how far along the line to look for the bounding crossings, in
 * grid units. A segment running past it is returned clipped to it.
 */
export function segmentAt(
    pg: Pentagrid, j: number, nj: number, x: number, y: number, reach: number,
): GridSegment | null {
    const [vx, vy] = pg.directions[j];
    // Along the line, and the foot of the line from the origin.
    const ux = -vy, uy = vx;
    const r = nj - pg.gamma[j];
    const px = r * vx, py = r * vy;
    const at = (t: number): Vec2 => [px + t * ux, py + t * uy];

    // Where the pointer sits along the line.
    const t0 = (x - px) * ux + (y - py) * uy;

    // Every crossing on this line within reach, as parameters t.
    const cuts: number[] = [];
    for (let k = 0; k < pg.n; k++) {
        if (k === j) continue;
        const [wx, wy] = pg.directions[k];
        const e1 = at(-reach), e2 = at(reach);
        const d1 = e1[0] * wx + e1[1] * wy + pg.gamma[k];
        const d2 = e2[0] * wx + e2[1] * wy + pg.gamma[k];
        const lo = Math.ceil(Math.min(d1, d2)), hi = Math.floor(Math.max(d1, d2));
        for (let nk = lo; nk <= hi; nk++) {
            const pt = solveIntersection(pg, j, k, nj, nk);
            if (!pt) continue;
            cuts.push((pt[0] - px) * ux + (pt[1] - py) * uy);
        }
    }

    // The bracketing pair. Ends of the search window stand in where the line
    // leaves reach before it meets anything.
    let lo = -reach, hi = reach;
    for (const t of cuts) {
        if (t <= t0 + K_EPS && t > lo) lo = t;
        if (t >= t0 - K_EPS && t < hi) hi = t;
    }
    if (hi - lo < K_EPS) return null;

    // The regions either side, read at the midpoint: along the open segment the
    // other coordinates are constant, so the midpoint speaks for the whole of it.
    const [mx, my] = at((lo + hi) / 2);
    const K1 = computeKTuple(pg, mx - K_EPS * vx * 2, my - K_EPS * vy * 2);
    K1[j] = nj;
    const K2 = K1.map((v, i) => (i === j ? v + 1 : v));
    return { j, nj, a: at(lo), b: at(hi), K1, K2 };
}

/** The nearest gridline to a point: its family and index, and the distance. */
export function nearestLine(
    pg: Pentagrid, x: number, y: number, active?: readonly boolean[],
): { j: number; nj: number; dist: number } | null {
    let best: { j: number; nj: number; dist: number } | null = null;
    for (let j = 0; j < pg.n; j++) {
        if (active && !active[j]) continue;
        const d = pg.directions[j][0] * x + pg.directions[j][1] * y + pg.gamma[j];
        const nj = Math.round(d);
        const dist = Math.abs(d - nj);
        if (!best || dist < best.dist) best = { j, nj, dist };
    }
    return best;
}
