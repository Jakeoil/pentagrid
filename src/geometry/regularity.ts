// Regularity: decided exactly, and the float scan for how small things get.
//
// Three lines x·v_j = n - γ_j =: c_j are concurrent iff the 3x3 determinant
// vanishes, which expands to
//
//     c_a·sin(θ_c-θ_b) + c_b·sin(θ_a-θ_c) + c_c·sin(θ_b-θ_a) = 0
//
// For the pentagrid the θ are multiples of 72°, so dividing by sin 144° leaves
// every coefficient in {±1, ±φ} — and for all ten triples the split has the same
// shape: one c_j alone on one side, the other two together. Each condition is
// therefore u + φ·v = 0 with u, v rational, and since φ is irrational BOTH must
// vanish. The lone term gives γ_L ∈ Z, the pair gives γ_P + γ_Q ∈ Z. Hence
//
//     triple is singular  <=>  γ_L ∈ Z  AND  γ_P + γ_Q ∈ Z
//
// and therefore: if no γ_j is an integer, the pentagrid is regular EVERYWHERE.
// Ten integer comparisons, no tolerance and no window. This decides regularity,
// it does not test it — which is why γ has to be carried as exact rationals.

import type { Concurrency, Pentagrid, SmallRegion, Vec2, ViewRect } from "./types.js";
import { NUM_GRIDS, lineRange, solveIntersection } from "./pentagrid.js";

/** [key, lone family, the other two] for each triple, from the coefficients. */
export const TRIPLES: readonly [string, number, [number, number]][] = [
    ["012", 1, [0, 2]], ["013", 3, [0, 1]], ["014", 0, [1, 4]], ["023", 0, [2, 3]],
    ["024", 2, [0, 4]], ["034", 4, [0, 3]], ["123", 2, [1, 3]], ["124", 4, [1, 2]],
    ["134", 1, [3, 4]], ["234", 3, [2, 4]],
];

/**
 * Exactly which triples are singular. Empty means provably regular, everywhere.
 *
 * gammaQ holds integer numerators over den, so "is an integer" is an exact
 * comparison rather than a tolerance. Negative numerators are fine: JS keeps the
 * sign on %, and only equality with zero is asked.
 */
export function singularTriples(gammaQ: readonly number[], den: number): string[] {
    const out: string[] = [];
    for (const [key, L, [P, Q]] of TRIPLES) {
        if (gammaQ[L] % den === 0 && (gammaQ[P] + gammaQ[Q]) % den === 0) out.push(key);
    }
    return out;
}

/** True when no γ is an integer, the sufficient condition for regularity. */
export function noIntegerGamma(gammaQ: readonly number[], den: number): boolean {
    return gammaQ.every((q) => q % den !== 0);
}

export interface ScanOptions {
    /** Only triples this close to concurrent get measured exactly. In the same
     *  units as `scale` multiplies into. */
    candidate?: number;
    /** Below this inradius (in MATH units) it is not a small triangle, it is a
     *  concurrency. No zoom makes a degenerate region hoverable. */
    concurrentTol?: number;
    /** Multiplies reported sizes. Pass the pixels-per-unit to get pixels. */
    scale?: number;
    /** Positions within this distance are the same concurrency. */
    cluster?: number;
}

export interface ScanResult {
    small: SmallRegion[];
    concurrencies: Concurrency[];
}

/**
 * Every region in vis small enough to be hard to hit, plus the concurrencies.
 *
 * The candidate filter is exact because the direction vectors are unit: the
 * perpendicular distance from a crossing P to the nearest line of family c is
 * exactly |d - round(d)| for d = P·v_c + γ_c. No square roots, and it is a real
 * distance rather than an estimate. Only survivors get a triangle measured.
 *
 * Caveat worth knowing: a fourth line can cut the triangle, in which case the
 * true region is smaller than reported. Rare at the sizes that matter — the lines
 * are one unit apart and these triangles are tiny — but the result is optimistic,
 * not conservative, when it happens.
 *
 * vis is in GRID coordinates.
 */
export function scanRegions(pg: Pentagrid, vis: ViewRect, opts: ScanOptions = {}): ScanResult {
    const candidate = opts.candidate ?? 24;
    const tol = opts.concurrentTol ?? 1e-9;
    const scale = opts.scale ?? 1;
    const cluster = opts.cluster ?? 1e-7;

    const small: SmallRegion[] = [];
    const degenerate: Vec2[] = [];
    const ranges: [number, number][] = [];
    for (let j = 0; j < NUM_GRIDS; j++) ranges.push(lineRange(pg, j, vis));

    for (let a = 0; a < NUM_GRIDS; a++) {
        for (let b = a + 1; b < NUM_GRIDS; b++) {
            for (let c = b + 1; c < NUM_GRIDS; c++) {
                for (let na = ranges[a][0]; na <= ranges[a][1]; na++) {
                    for (let nb = ranges[b][0]; nb <= ranges[b][1]; nb++) {
                        const P = solveIntersection(pg, a, b, na, nb);
                        if (!P) continue;
                        if (P[0] < vis.xMin || P[0] > vis.xMax ||
                            P[1] < vis.yMin || P[1] > vis.yMax) continue;

                        const d = pg.directions[c][0] * P[0] + pg.directions[c][1] * P[1] + pg.gamma[c];
                        const nc = Math.round(d);
                        if (Math.abs(d - nc) * scale > candidate) continue;

                        const Q = solveIntersection(pg, b, c, nb, nc);
                        const R = solveIntersection(pg, a, c, na, nc);
                        if (!Q || !R) continue;

                        const area = Math.abs(
                            (Q[0] - P[0]) * (R[1] - P[1]) - (Q[1] - P[1]) * (R[0] - P[0])
                        ) / 2;
                        const sP = Math.hypot(R[0] - Q[0], R[1] - Q[1]); // opposite P
                        const sQ = Math.hypot(R[0] - P[0], R[1] - P[1]); // opposite Q
                        const sR = Math.hypot(Q[0] - P[0], Q[1] - P[1]); // opposite R
                        const perim = sP + sQ + sR;
                        if (perim < 1e-15) { degenerate.push([P[0], P[1]]); continue; }

                        const inradius = 2 * area / perim;
                        if (inradius < tol) {
                            // The triangle has collapsed: concurrent, not close.
                            degenerate.push([P[0], P[1]]);
                            continue;
                        }
                        // The incenter, not the centroid: on a sliver the centroid
                        // can sit hard against an edge, while the incenter is
                        // furthest from all three.
                        small.push({
                            size: 2 * inradius * scale,
                            x: (sP * P[0] + sQ * Q[0] + sR * R[0]) / perim,
                            y: (sP * P[1] + sQ * Q[1] + sR * R[1]) / perim,
                        });
                    }
                }
            }
        }
    }

    // Every triple through the same point reports it, so dedupe by position and
    // then count how many families actually pass through — that count, not the
    // number of triples, is the multiplicity worth reporting.
    const concurrencies: Concurrency[] = [];
    for (const [x, y] of degenerate) {
        if (concurrencies.some((p) => Math.hypot(p.x - x, p.y - y) < cluster)) continue;
        let lines = 0;
        for (let j = 0; j < NUM_GRIDS; j++) {
            const d = pg.directions[j][0] * x + pg.directions[j][1] * y + pg.gamma[j];
            if (Math.abs(d - Math.round(d)) < cluster) lines++;
        }
        concurrencies.push({ x, y, lines });
    }

    return { small, concurrencies };
}
