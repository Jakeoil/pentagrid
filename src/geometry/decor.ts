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

import type { Pentagrid, Rhomb, Vec2 } from "./types.js";

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

// ── P1 at the big-rhomb scale ────────────────────────────────────────

/** A pentagon's five corners, in tiling coordinates. */
export type Pentagon = Vec2[];

export interface RhombPentagons {
    /** The whole Pe3 pentagon a thick rhomb carries; null on a thin. */
    yellow: Pentagon | null;
    /** The two Pe1 pentagons that cross into this tile, unclipped. */
    orange: Pentagon[];
}

/** Circumradius of a P1 pentagon against a unit rhomb edge: 1/φ². */
export const PENTA_R = 1 / (PHI * PHI);

function regularPentagon(cx: number, cy: number, ang: number): Pentagon {
    const out: Pentagon = [];
    for (let k = 0; k < 5; k++) {
        const t = ang + k * 2 * Math.PI / 5;
        out.push([cx + PENTA_R * Math.cos(t), cy + PENTA_R * Math.sin(t)]);
    }
    return out;
}

/**
 * The P1 tiling drawn on the rhombs it is MLD with at the SAME scale — Jake's
 * "big rhombs" overlay in penrose-mosaic, where every thick rhomb contains a
 * whole pentagon. Read off jake/pentas-bigrhombs.png (99.9% pixel agreement on
 * the thick, 99% on the thin) and then checked to assemble: on three gammas
 * every orange pentagon is emitted, identically, by both tiles it overlaps.
 *
 * In units of the rhomb edge, with R = 1/φ² the pentagon's circumradius:
 *
 *   thick, corner C the index extreme (where the double arrows meet), edges
 *   e1, e2 from C, d their bisector:
 *     yellow  a Pe3 centered at C + (e1 + e2)/φ², one corner along +d, so its
 *             rear corners sit on the two edges at e1/φ² and e2/φ² exactly
 *     orange  the two Pe1 across the yellow's front edges, centers
 *             Yc + (2R cos 36°)·(d ± 36°), corners along −d
 *     blue    the rest — the triangle C, e1/φ², e2/φ² is a fifth of the Pe5
 *             or star at C, and the flanks are star family
 *
 *   thin, corner V the 144° corner at the OTHER end from the extreme:
 *     orange  two Pe1 centered on its edges at V + e1/φ² and V + e2/φ², corners
 *             along the short diagonal into the tile; they touch at a point
 *     blue    the rest, the extreme corner included
 *
 * The thin's two 144° corners differ by two in index (the short diagonal is
 * e1 + e2), which is what lets the tile tell them apart; nothing else does.
 * The other three corner rules fail to assemble on 350–490 tile overlaps.
 *
 * Off a Penrose patch the index spans five values and nothing is emitted.
 */
export function rhombPentagons(r: Rhomb, lo: number): RhombPentagons {
    const none: RhombPentagons = { yellow: null, orange: [] };
    const idx = (K: readonly number[]) => K.reduce((a, b) => a + b, 0) - lo + 1;
    const ids = r.kTuples.map(idx);
    let ext = ids.findIndex((v) => v === 1 || v === 4);
    if (ext < 0 || ids.some((v) => v < 1 || v > 4)) return none;
    const V = r.vertices;
    const c = r.thick ? ext : (ext + 2) % 4;
    const C = V[c], A = V[(c + 1) % 4], B = V[(c + 3) % 4];
    const e1: Vec2 = [A[0] - C[0], A[1] - C[1]];
    const e2: Vec2 = [B[0] - C[0], B[1] - C[1]];
    const d = Math.atan2(e1[1] + e2[1], e1[0] + e2[0]);
    if (!r.thick) {
        return {
            yellow: null,
            orange: [e1, e2].map((e) =>
                regularPentagon(C[0] + PENTA_R * e[0], C[1] + PENTA_R * e[1], d)),
        };
    }
    const yx = C[0] + (e1[0] + e2[0]) * PENTA_R;
    const yy = C[1] + (e1[1] + e2[1]) * PENTA_R;
    const across = 2 * PENTA_R * Math.cos(Math.PI / 5);
    return {
        yellow: regularPentagon(yx, yy, d),
        orange: [1, -1].map((sg) => regularPentagon(
            yx + across * Math.cos(d + sg * Math.PI / 5),
            yy + across * Math.sin(d + sg * Math.PI / 5), d + Math.PI)),
    };
}

// ── Next generation: the deflation, one step ─────────────────────────

export interface RhombDeflation {
    /** Half-rhombs of the next generation's THICK tiles, as triangles. */
    gold: Vec2[][];
    /**
     * Half-rhombs of the next generation's THIN tiles, as triangles: two on
     * either prototile. On a thin they share the side B–T, which is a thin'
     * EDGE — each belongs to a different thin', completed across a different
     * neighbor — so the pair is a kite, not a rhomb, and stays two pieces.
     */
    gray: Vec2[][];
    /**
     * Every edge of the next generation on this tile, each of length 1/φ: the
     * figure's thin arrows inside (five on a thick, three on a thin) plus the
     * ones hiding under the tile's own edges — the green heads peeking out at
     * the thick's red corner and the thin's acute corners: the 1/φ of each of
     * those edges nearest that corner. The rest of a tile's edge is a thin'
     * short diagonal, and its double edges are thick' long diagonals — not
     * next-gen edges at all. Seven on a thick, five on a thin, and together
     * over a patch they are exactly the deflated tiling's edge set.
     */
    edges: [Vec2, Vec2][];
}

/**
 * De Bruijn's deflation, drawn on the tile it came from: each rhomb cut into
 * the next generation's rhombs at scale 1/φ, thick (gold) and thin (gray), the
 * halves on a tile's edge meeting their other halves in the neighbor. Without
 * the edges layer the picture IS the next generation. Read off Jake's
 * jake/Inflation_1.png and derived from the Robinson triangles:
 *
 *   obtuse (half thick, apex 108°, base P–Q = φ)
 *       → obtuse'(M; O, Q) + obtuse'(N; P, M) + acute'(M; N, O)
 *         with M on the base at |PM| = 1 and N on the leg P–O at |PN| = 1/φ
 *   acute (half thin, apex 36°, base O–M = 1/φ)
 *       → obtuse'(N; P, M) + acute'(M; N, O),  N on P–O at |PN| = 1/φ
 *
 * so a thick makes 2 thick' + 1 thin' and a thin makes 1 + 1, which is the
 * substitution matrix. The arrows say which corner is which. Thick: A the red
 * corner (singles out of it), C the extreme (doubles into it), X on the long
 * diagonal at |AX| = 1; the two edges out of A split at 1/φ; the gray halves sit
 * against the obtuse corners. Thin: T the red corner (singles into it), B the
 * extreme; the two edges into T split at 1/φ from the acute corners; the gray
 * halves lean on T either side of the short diagonal T–B. Of a tile's own
 * edges only the 1/φ nearest the red corner (thick) or the acute corners (thin)
 * survives as a next-gen edge; the double edges become thick' diagonals. Assembly across every shared edge is
 * what the test checks; it holds because the split point of an edge is 1/φ
 * from the tail of its single arrow on either tile.
 *
 * Off a Penrose patch the index spans five values and nothing is emitted.
 */
export function rhombDeflation(r: Rhomb, lo: number): RhombDeflation {
    const none: RhombDeflation = { gold: [], gray: [], edges: [] };
    const idx = (K: readonly number[]) => K.reduce((a, b) => a + b, 0) - lo + 1;
    const ids = r.kTuples.map(idx);
    const ext = ids.findIndex((v) => v === 1 || v === 4);
    if (ext < 0 || ids.some((v) => v < 1 || v > 4)) return none;
    const V = r.vertices;
    const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const t = 1 / PHI;
    const E = V[ext], R = V[(ext + 2) % 4], S1 = V[(ext + 1) % 4], S2 = V[(ext + 3) % 4];
    if (r.thick) {
        const A = R, C = E, D = S1, B = S2;
        const X = lerp(A, C, t), L = lerp(A, D, t), Bp = lerp(A, B, t);
        return {
            gold: [[D, X, C], [A, L, X], [A, X, Bp], [X, B, C]],
            gray: [[D, L, X], [X, Bp, B]],
            edges: [[X, D], [C, X], [X, L], [X, Bp], [X, B], [A, L], [A, Bp]],
        };
    }
    const T = R, B = E, L = S1, Rt = S2;
    const P1 = lerp(L, T, t), P2 = lerp(Rt, T, t);
    return {
        gold: [[L, P1, B], [Rt, P2, B]],
        gray: [[P1, T, B], [P2, T, B]],
        edges: [[B, T], [B, P1], [B, P2], [L, P1], [Rt, P2]],
    };
}
