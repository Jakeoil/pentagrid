// The perpendicular plane, and the region of it a patch survives in.
//
// R^5 splits under the cyclic symmetry into E∥ (the five directions), E⊥ (the
// same angles doubled) and the all-ones line, which Σγ = 0 kills. Shifting γ
// inside E∥ slides the pentagrid and leaves the tiling exactly where it was — so
// the pattern turns on only the two E⊥ coordinates.
//
// For a fixed set of vertices, each one's survival is a linear condition on γ,
// so the admissible set is convex. That is what lets a ray cast from any interior
// point find the whole boundary: one crossing per ray, no more.

import type { Pentagrid, Vec2 } from "./types.js";
import { regionPoly } from "./region.js";

const unit = (u: number[]) => { const n = Math.hypot(...u); return u.map((x) => x / n); };

/**
 * The two E⊥ basis vectors for a set of directions.
 *
 * PENTAGRID ONLY as a complete perpendicular space: R^5 splits as E-parallel,
 * one E-perp and the all-ones line, so two coordinates are the whole story. At
 * n = 7 there are two perpendicular planes (angles doubled and tripled) and this
 * returns only the first of them.
 */
export function perpBasis(dirs: readonly Vec2[]): [number[], number[]] {
    const ang = (j: number) => Math.atan2(dirs[j][1], dirs[j][0]);
    const idx = [...Array(dirs.length).keys()];
    return [
        unit(idx.map((j) => Math.cos(2 * ang(j)))),
        unit(idx.map((j) => Math.sin(2 * ang(j)))),
    ];
}

/** A γ with these perpendicular coordinates and no E∥ part. Sums to zero. */
export function gammaFromPerp(basis: [number[], number[]], p: number, q: number): number[] {
    const [e3, e4] = basis;
    return [...Array(e3.length).keys()].map((j) => p * e3[j] + q * e4[j]);
}

/** Where a γ sits in the perpendicular plane. */
export function perpOfGamma(basis: [number[], number[]], gamma: readonly number[]): Vec2 {
    const dot = (u: number[]) => u.reduce((s, x, i) => s + x * gamma[i], 0);
    return [dot(basis[0]), dot(basis[1])];
}

const FEASIBLE = { xMin: -80, xMax: 80, yMin: -80, yMax: 80 };

/**
 * Is this K-tuple realised? Its five strips must share a point — a 2D
 * feasibility question, not a closed form. (The tempting closed form, comparing
 * ‖P_⊥(s)‖_∞ against ½, is wrong: the ℓ²-orthogonal projection minimises the
 * Euclidean residual, not the max-norm one, and it over-rejects badly.)
 */
export function vertexRealised(pg: Pentagrid, K: readonly number[]): boolean {
    return regionPoly(pg, K, FEASIBLE).length >= 3;
}

export interface RayCastOptions {
    rays?: number;
    reach?: number;
    bisections?: number;
}

/**
 * Trace the boundary of a convex region by ray casting from a point known to be
 * inside it. Returns the boundary as a polygon.
 */
export function convexBoundary(
    inside: (x: number, y: number) => boolean,
    from: Vec2,
    opts: RayCastOptions = {},
): Vec2[] {
    const rays = opts.rays ?? 120;
    const reach = opts.reach ?? 2.5;
    const bisections = opts.bisections ?? 18;
    const pts: Vec2[] = [];
    for (let i = 0; i < rays; i++) {
        const a = (2 * Math.PI * i) / rays;
        const dx = Math.cos(a), dy = Math.sin(a);
        let lo = 0, hi = reach;
        if (inside(from[0] + hi * dx, from[1] + hi * dy)) lo = hi;
        else for (let s = 0; s < bisections; s++) {
            const m = (lo + hi) / 2;
            if (inside(from[0] + m * dx, from[1] + m * dy)) lo = m; else hi = m;
        }
        pts.push([from[0] + lo * dx, from[1] + lo * dy]);
    }
    return pts;
}

/** Signed area of a polygon, absolute. */
export function polygonArea(poly: readonly Vec2[]): number {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        a += (x1 * y2 - x2 * y1) / 2;
    }
    return Math.abs(a);
}

/** Even-odd point-in-polygon. */
export function pointInPolygon(poly: readonly Vec2[], x: number, y: number): boolean {
    if (poly.length < 3) return false;
    let hit = false;
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
        const [xi, yi] = poly[i], [xk, yk] = poly[k];
        if ((yi > y) !== (yk > y) && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) hit = !hit;
    }
    return hit;
}
