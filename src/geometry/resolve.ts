// What a singularity resolves into.
//
// A crossing of two lines dualises to one rhomb. When k lines meet at a point it
// dualises to a **2k-gon with unit sides** — Lutfalla states exactly this and his
// Figure 3 draws the rhomb, the hexagon and the octagon. So a concurrency is not
// a hole in the tiling: it is C(k,2) rhombs, one per pair of lines, stacked into a
// space that would hold them side by side if the lines were pulled apart.
//
//     3 lines -> hexagon,   3 rhombs
//     4 lines -> octagon,   6 rhombs
//     5 lines -> decagon,  10 rhombs
//
// The outline is not synthesised from the directions and hoped over: the 2k
// sectors around the point are sampled, each one's K-tuple taken, and each mapped
// through f to give a corner. The zonogon decomposition is then laid inside it, so
// the drawing and the construction cannot disagree.

import type { Concurrency, Pentagrid, Vec2 } from "./types.js";
import { computeKTuple, dualVertex } from "./pentagrid.js";

export interface ResolutionRhomb {
    corners: Vec2[];
    /** The two families whose lines make it. */
    a: number;
    b: number;
    /** Their separation, 1..floor(n/2) — the rhomb's shape. */
    cls: number;
    /** The n = 5 reading of cls. */
    thick: boolean;
}

export interface Resolution {
    /** Where it sits, in TILING coordinates. */
    x: number;
    y: number;
    /** The 2k-gon, in tiling coordinates. */
    outline: Vec2[];
    /** The C(k,2) rhombs superposed there. */
    rhombs: ResolutionRhomb[];
    /** hexagon, octagon, decagon, or "2k-gon" past that. */
    name: string;
    /** Which families meet. */
    families: number[];
    thick: number;
    thin: number;
}

const NAMES: Record<number, string> = {
    4: "rhomb", 6: "hexagon", 8: "octagon", 10: "decagon", 12: "dodecagon", 14: "tetradecagon",
};

/** How far into a sector to sample. Small against the line spacing of 1. */
const PROBE = 1e-4;

/**
 * The 2k-gon a concurrency stands for, and the rhombs stacked inside it.
 *
 * `c.families` says which lines meet; everything else follows from the pentagrid.
 */
export function resolveConcurrency(pg: Pentagrid, c: Concurrency): Resolution | null {
    const fams = [...c.families].sort((p, q) => p - q);
    const k = fams.length;
    if (k < 2) return null;

    // The k lines cut the neighbourhood into 2k sectors. Their boundaries run
    // along the lines, so the boundary directions are the normals turned a
    // quarter turn — 2k of them once both ways are counted.
    const TAU = 2 * Math.PI;
    // Normalised into one turn before sorting. atan2 returns negatives and the
    // opposite ray can land past 2pi, so an unnormalised sort interleaves the rays
    // wrongly and the "sectors" straddle the lines instead of lying between them.
    const norm = (a: number) => ((a % TAU) + TAU) % TAU;
    const bounds: number[] = [];
    for (const j of fams) {
        const [vx, vy] = pg.directions[j];
        const a = Math.atan2(vx, -vy);            // along the line
        bounds.push(norm(a), norm(a + Math.PI));
    }
    bounds.sort((p, q) => p - q);

    // One corner per sector: sample just inside it, read the K-tuple, map it.
    const outline: Vec2[] = [];
    for (let i = 0; i < bounds.length; i++) {
        const lo = bounds[i];
        const hi = i + 1 < bounds.length ? bounds[i + 1] : bounds[0] + TAU;
        const mid = (lo + hi) / 2;
        const px = c.x + PROBE * Math.cos(mid);
        const py = c.y + PROBE * Math.sin(mid);
        outline.push(dualVertex(pg, computeKTuple(pg, px, py)));
    }

    let cxs = 0, cys = 0;
    for (const [x, y] of outline) { cxs += x; cys += y; }
    const cx = cxs / outline.length, cy = cys / outline.length;

    // The zonogon tiling, laid inside that outline. Generators sorted by angle;
    // the tile for pair (i, j) sits at the sum of the generators before j other
    // than i, measured from the corner where the walk starts.
    const gens = fams
        .map((j) => ({ j, v: pg.directions[j] as Vec2 }))
        .sort((p, q) => Math.atan2(p.v[1], p.v[0]) - Math.atan2(q.v[1], q.v[0]));

    let sx = 0, sy = 0;
    for (const g of gens) { sx += g.v[0]; sy += g.v[1]; }
    const startX = cx - sx / 2, startY = cy - sy / 2;

    const rhombs: ResolutionRhomb[] = [];
    let thick = 0, thin = 0;
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            let bx = startX, by = startY;
            for (let m = 0; m < j; m++) {
                if (m === i) continue;
                bx += gens[m].v[0];
                by += gens[m].v[1];
            }
            const [ax, ay] = gens[i].v;
            const [dx, dy] = gens[j].v;
            const sep = Math.abs(gens[i].j - gens[j].j);
            const cls = Math.min(sep, pg.n - sep);
            const isThick = cls === 1;
            if (isThick) thick++; else thin++;
            rhombs.push({
                a: gens[i].j, b: gens[j].j, cls, thick: isThick,
                corners: [
                    [bx, by], [bx + ax, by + ay],
                    [bx + ax + dx, by + ay + dy], [bx + dx, by + dy],
                ],
            });
        }
    }

    return {
        x: cx, y: cy, outline, rhombs,
        name: NAMES[2 * k] ?? `${2 * k}-gon`,
        families: fams, thick, thin,
    };
}

/** "hexagon · 2 thick + 1 thin" — what to say instead of "3 lines concurrent". */
export function describeResolution(r: Resolution): string {
    return `${r.name} · ${r.thick} thick + ${r.thin} thin`;
}
