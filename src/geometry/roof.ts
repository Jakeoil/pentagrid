// The Wieringa lift: the tiling stood up into golden rhombi.
//
// Take the five planar directions and give each a common vertical component:
//
//     E_j = v_j + RISE·ẑ,    RISE = 1/2
//
// Then E_j·E_k / |E_j|² = ±1/√5 for BOTH |j−k| = 1 and 2, so every face — thick
// and thin alike — becomes the same golden rhombus: edge √5/2, diagonals in
// ratio φ, angles 63.4349° and 116.5651°. Thick and thin stop being different
// shapes; they are the same shape, and which you see depends only on which
// corner sits at the shared vertex.
//
// Because all five E_j share the same z, a vertex's height is just its de Bruijn
// index scaled: z = RISE·ΣK. Every edge therefore rises or falls by exactly RISE,
// and since the index only takes the values 1..4 the roof stands on four levels.
//
// Agrees with wieringa-roof's independently verified numbers, including the fold
// angles: thick|thick 36°, thick|thin 36° or 72°, thin|thin 108°, never flat.

import type { Pentagrid, Rhomb, Vec2 } from "./types.js";

/** Vertical component shared by all five generators. */
export const RISE = 0.5;

/** Golden rhombus edge, for the unit-edge planar tiling. */
export const ROOF_EDGE = Math.sqrt(5) / 2;

export type Vec3 = [number, number, number];

/** The de Bruijn index of a vertex: the sum of its K-tuple. Always 1..4. */
export function vertexIndex(K: readonly number[]): number {
    let s = 0;
    for (const k of K) s += k;
    return s;
}

/** Height of a vertex with this K-tuple. */
export function vertexHeight(K: readonly number[]): number {
    return RISE * vertexIndex(K);
}

/** The lifted generator for family j. */
export function generator(pg: Pentagrid, j: number): Vec3 {
    return [pg.directions[j][0], pg.directions[j][1], RISE];
}

/**
 * A point of a rhomb in its own (a,b) frame, lifted.
 *
 * z is affine in (a,b) — z = RISE·(m + a + b) with m the base corner's index —
 * which is why each face stays exactly planar, and why the surface is a height
 * field that a depth sort renders correctly.
 */
export function liftLocal(pg: Pentagrid, r: Rhomb, a: number, b: number): Vec3 {
    const vj = pg.directions[r.j], vk = pg.directions[r.k];
    const v0 = r.vertices[0];
    const m = vertexIndex(r.kTuples[0]);
    return [
        v0[0] + a * vj[0] + b * vk[0],
        v0[1] + a * vj[1] + b * vk[1],
        RISE * (m + a + b),
    ];
}

/** Unit normal of a lifted face, oriented upward. */
export function faceNormal(pg: Pentagrid, r: Rhomb): Vec3 {
    const A = liftLocal(pg, r, 0, 0);
    const B = liftLocal(pg, r, 1, 0);
    const C = liftLocal(pg, r, 0, 1);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n: Vec3 = [
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
    ];
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    const s = (n[2] < 0 ? -1 : 1) / L;
    return [n[0] * s, n[1] * s, n[2] * s];
}

/** Planar vertex, for callers that want the flat position too. */
export function flatLocal(pg: Pentagrid, r: Rhomb, a: number, b: number): Vec2 {
    const vj = pg.directions[r.j], vk = pg.directions[r.k], v0 = r.vertices[0];
    return [v0[0] + a * vj[0] + b * vk[0], v0[1] + a * vj[1] + b * vk[1]];
}
