// The solid a singularity stands up into, and its readings.
//
// Where k lines meet, the surrounding regions are the 2^k corners of a k-cube
// and f projects it into the plane as a 2k-gon (see resolve.ts). The roof adds
// the dimension that projection loses. Every vertex takes z = RISE·ΣK and ΣK
// counts the chosen generators, so the k-cube's own main diagonal becomes the
// vertical and
//
//     K  ↦  Σ Kⱼ Eⱼ ,   Eⱼ = vⱼ + RISE·ẑ
//
// embeds it in the roof's 3-space as a zonohedron: k = 3 a golden rhombohedron,
// k = 4 Bilinski's rhombic dodecahedron, k = 5 the rhombic icosahedron. Every
// edge is √5/2 and every face is the roof's own golden rhombus, so a singularity
// is not a defect in the surface but a piece of its solid geometry.
//
// A READING of the 2k-gon is a monotone surface of that solid — one of the two
// halves you can see it as, Necker-fashion — and the rhombic tilings of the
// 2k-gon are exactly those surfaces. There are 2 for the hexagon, 8 for the
// octagon, 62 for the decagon. They are enumerated here the honest way: start at
// the true lower surface and walk every legal hexagon flip, where a flip is
// legal only when one cell's whole cap is exposed. Every state reached is a
// tiling by construction.
//
// Positions are carried as GENERATOR MASKS rather than points. A corner is the
// subset of generators summed to reach it, so a corner's plane position is
// start + Σ_{l ∈ mask} v_l and its height is RISE·(m₀ + popcount(mask)) — exact,
// and the same integers the K-tuples are made of. At n = 5 the decagon's mask 0
// and mask 31 land on the SAME plane point, which is the ghost center of §5.8:
// in space they are the icosahedron's two poles, 5·RISE apart.
//
// See PLAN §5.0.

import type { Vec2 } from "./types.js";
import { RISE } from "./roof.js";

/** A rhombohedral cell, as local generator indices. */
export type Cell = readonly [number, number, number];

export interface ZonoFlip {
    /** The cell being turned over. */
    cell: Cell;
    /** The reading it leads to, as a base mask per face. */
    to: readonly number[];
    /** The three faces that move, so a drawing can show just the cap. */
    changed: readonly { pair: number; from: number; to: number }[];
}

export interface Zonohedron {
    /** How many generators — the number of concurrent lines. */
    k: number;
    /** Local generator index to family. */
    fams: readonly number[];
    /** The C(k,2) faces, as local generator pairs. */
    pairs: readonly (readonly [number, number])[];
    /** The C(k,3) cells, as local generator triples. */
    cells: readonly Cell[];
    /** The lower surface: the base-corner mask of each face. */
    lower: readonly number[];
    /**
     * Every reading of the 2k-gon.
     *
     * Ordered by the line configuration that makes it: nudge the k lines apart
     * so no singularity is left, and the rhombs fall into a definite order.
     * Jake's enumeration, and the honest one, since that is what the grid does.
     * Every reading has such a configuration — the readings are not a superset
     * of what the lines can do — but the displacements have to be allowed to
     * differ. Equal single steps give a hexagon's 2 and an octagon's 8, and
     * exactly 32 of the decagon's 62; letting a line stay put reaches 42, and a
     * double step the remaining 20. Least disturbance first.
     *
     * Empty past ENUMERATE_UPTO, where the count runs away (908 at k = 6); the
     * lower surface and its flips are always available.
     */
    readings: readonly (readonly number[])[];
    /**
     * A line configuration that produces reading i: one small displacement per
     * generator, in units of NUDGE_STEP. Every reading of a hexagon, octagon or
     * decagon has one, so this is null only past what is enumerated.
     */
    nudgeOf(reading: number): readonly number[] | null;
    /**
     * Which reading a configuration of the lines produces — one displacement per
     * generator — or null if it leaves a singularity standing.
     */
    readingOf(displacements: readonly number[]): number | null;
    /** Which cells of this reading have their whole cap exposed. */
    flips(bases: readonly number[]): ZonoFlip[];
    /** A face's four corners, as generator masks, in order round it. */
    face(bases: readonly number[], pair: number): [number, number, number, number];
    /** The order one family's ribbon crosses the others, as local indices. */
    route(bases: readonly number[], fam: number): number[];
}

/** Where the solid's all-zero corner sits, and the height it sits at. */
export interface ZonoAnchor {
    /** The plane point of corner mask 0, in tiling coordinates. */
    origin: Vec2;
    /** Its de Bruijn index, so a corner's height is RISE*(index + popcount). */
    index: number;
}

/**
 * Anchor the solid to the polygon resolve.ts already drew.
 *
 * Across one singularity each participating K_j takes exactly two values, so a
 * corner's mask is just K minus the componentwise minimum — which fixes both the
 * origin and its index without assuming anything about where the zonogon's
 * corners lie. That last point matters at k = 5: the five directions sum to
 * zero, so mask 0 is not a corner of the decagon at all but its CENTER, sharing
 * its shadow with mask 31. Guessing the origin from the outline's least index
 * puts the whole solid half a decagon out of place.
 */
export function zonogonAnchor(
    z: Zonohedron,
    outline: readonly Vec2[],
    outlineK: readonly (readonly number[])[],
    dirs: readonly Vec2[],
): ZonoAnchor {
    const n = outlineK[0].length;
    const kmin: number[] = [];
    for (let j = 0; j < n; j++) {
        let m = Infinity;
        for (const K of outlineK) if (K[j] < m) m = K[j];
        kmin.push(m);
    }
    let index = 0;
    for (const m of kmin) index += m;
    let mask = 0;
    for (let l = 0; l < z.k; l++) {
        if (outlineK[0][z.fams[l]] - kmin[z.fams[l]]) mask |= 1 << l;
    }
    let x = outline[0][0], y = outline[0][1];
    for (let l = 0; l < z.k; l++) {
        if (!(mask >> l & 1)) continue;
        x -= dirs[z.fams[l]][0];
        y -= dirs[z.fams[l]][1];
    }
    return { origin: [x, y], index };
}

/** Past five generators the reading count runs away, so it is not enumerated. */
export const ENUMERATE_UPTO = 5;

/**
 * How far a line may be nudged when the readings are enumerated, in steps.
 *
 * Two is enough for every reading of a hexagon, octagon or decagon, and it has
 * to be two: a single step, even allowing a line to stay put, leaves 20 of the
 * decagon's 62 unreachable.
 */
export const NUDGE_REACH = 2;

/** How many generators a mask names — a corner's height above the base corner. */
export function popcount(m: number): number {
    let n = 0;
    for (let x = m; x; x &= x - 1) n++;
    return n;
}

const combinations = (k: number, r: number): number[][] => {
    const out: number[][] = [];
    const walk = (start: number, cur: number[]) => {
        if (cur.length === r) { out.push([...cur]); return; }
        for (let i = start; i < k; i++) { cur.push(i); walk(i + 1, cur); cur.pop(); }
    };
    walk(0, []);
    return out;
};

const cache = new Map<string, Zonohedron>();

/**
 * The zonohedron of a concurrency, cached by which families meet.
 *
 * The combinatorics survive a rotation of the whole star — N = Eᵢ × Eⱼ turns
 * with the generators and N·E_l is unchanged — so vertical-axis symmetry does
 * not invalidate the cache.
 */
export function zonohedronOf(dirs: readonly Vec2[], fams: readonly number[]): Zonohedron {
    const key = `${dirs.length}|${[...fams].join(",")}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const built = build(dirs, fams);
    cache.set(key, built);
    return built;
}

function build(dirs: readonly Vec2[], families: readonly number[]): Zonohedron {
    const fams = [...families].sort((a, b) => a - b);
    const k = fams.length;
    const E = fams.map((j) => [dirs[j][0], dirs[j][1], RISE] as [number, number, number]);
    const pairs = combinations(k, 2) as unknown as (readonly [number, number])[];
    const cells = combinations(k, 3) as unknown as Cell[];
    const pairAt = new Map<string, number>();
    pairs.forEach(([a, b], i) => pairAt.set(`${a},${b}`, i));
    const idx = (a: number, b: number) => pairAt.get(`${Math.min(a, b)},${Math.max(a, b)}`)!;

    // Face (i, j) either sits at the base corner or one generator along it. It
    // sits at the base when the body lies on the +z side of its plane — that is
    // the LOWER surface — and is pushed along E_l otherwise.
    const upNormal = (i: number, j: number) => {
        const [ax, ay, az] = E[i], [bx, by, bz] = E[j];
        const n: [number, number, number] =
            [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
        return n[2] < 0 ? [-n[0], -n[1], -n[2]] as [number, number, number] : n;
    };
    const offsets: number[][][] = [];
    for (let i = 0; i < k; i++) {
        offsets.push([]);
        for (let j = 0; j < k; j++) {
            const row: number[] = [];
            if (i !== j) {
                const n = upNormal(i, j);
                for (let l = 0; l < k; l++) {
                    const d = n[0] * E[l][0] + n[1] * E[l][1] + n[2] * E[l][2];
                    row.push(l !== i && l !== j && d < 0 ? 1 << l : 0);
                }
            }
            offsets[i].push(row);
        }
    }
    const off = (i: number, j: number, l: number) => offsets[i][j][l];

    const lower: number[] = pairs.map(([i, j]) => {
        let m = 0;
        for (let l = 0; l < k; l++) m |= off(i, j, l);
        return m;
    });

    /** The three faces of a cell, as they stand on each of its two caps. */
    const caps = (cell: Cell, bases: readonly number[]) => {
        const [a, b, c] = cell;
        const iab = idx(a, b), iac = idx(a, c), ibc = idx(b, c);
        const p = bases[iab] & ~(1 << c);
        const lo = [
            { pair: iab, mask: p | off(a, b, c) },
            { pair: iac, mask: p | off(a, c, b) },
            { pair: ibc, mask: p | off(b, c, a) },
        ];
        const hi = [
            { pair: iab, mask: lo[0].mask ^ (1 << c) },
            { pair: iac, mask: lo[1].mask ^ (1 << b) },
            { pair: ibc, mask: lo[2].mask ^ (1 << a) },
        ];
        return { lo, hi };
    };

    const flips = (bases: readonly number[]): ZonoFlip[] => {
        const out: ZonoFlip[] = [];
        for (const cell of cells) {
            const { lo, hi } = caps(cell, bases);
            for (const [from, to] of [[lo, hi], [hi, lo]] as const) {
                if (!from.every((f) => bases[f.pair] === f.mask)) continue;
                const next = [...bases];
                to.forEach((t) => { next[t.pair] = t.mask; });
                out.push({
                    cell, to: next,
                    changed: to.map((t, i) => ({ pair: t.pair, from: from[i].mask, to: t.mask })),
                });
                break;                                  // a cap is exposed one way
            }
        }
        return out;
    };

    /**
     * The tiling you get by pulling the k lines apart.
     *
     * No singularity is left, so each pair of lines crosses at a point of its
     * own, and the rhomb there sits at the corner whose K-tuple the crossing
     * reads off: generator l is added exactly when the crossing lands on the far
     * side of line l. Nothing is assumed about the tiling — it is measured off
     * the perturbed grid, which is where it comes from.
     */
    const nudge = (e: readonly number[]): number[] | null => {
        const out: number[] = [];
        for (const [i, j] of pairs) {
            const a = dirs[fams[i]], b = dirs[fams[j]];
            const det = a[0] * b[1] - a[1] * b[0];
            if (Math.abs(det) < 1e-12) return null;
            const px = (-e[i] * b[1] + e[j] * a[1]) / det;
            const py = (b[0] * e[i] - a[0] * e[j]) / det;
            let m = 0;
            for (let l = 0; l < k; l++) {
                if (l === i || l === j) continue;
                const v = dirs[fams[l]];
                const side = px * v[0] + py * v[1] + e[l];
                if (Math.abs(side) < 1e-9) return null;      // still concurrent
                if (side > 0) m |= 1 << l;
            }
            out.push(m);
        }
        return out;
    };

    const readings: number[][] = [];
    const nudges: (number[] | null)[] = [];
    if (k <= ENUMERATE_UPTO) {
        // Every configuration of the k lines within two steps either way. That
        // is enough to reach every reading at k <= 5, and the search is small:
        // 5^k, which is 3125 at its worst.
        const found = new Map<string, number[]>();
        const rank = (e: readonly number[]) => {
            let hi = 0, sum = 0;
            for (const v of e) { hi = Math.max(hi, Math.abs(v)); sum += Math.abs(v); }
            return hi * 1000 + sum;                          // least disturbance first
        };
        const e = new Array<number>(k).fill(0);
        const walk = (l: number) => {
            if (l === k) {
                const bases = nudge(e);
                if (!bases) return;
                const key = bases.join(",");
                const had = found.get(key);
                if (!had || rank(e) < rank(had)) found.set(key, [...e]);
                return;
            }
            for (let v = -NUDGE_REACH; v <= NUDGE_REACH; v++) { e[l] = v; walk(l + 1); }
            e[l] = 0;
        };
        walk(0);
        const seen = new Set<string>();
        for (const [key, e] of [...found].sort((p, q) => rank(p[1]) - rank(q[1]))) {
            seen.add(key);
            readings.push(key.split(",").map(Number));
            nudges.push(e);
        }
        // Anything the search missed, breadth-first, so the list stays complete.
        const queue: number[][] = [lower];
        const walked = new Set<string>([lower.join(",")]);
        for (let head = 0; head < queue.length; head++) {
            const bases = queue[head];
            const key = bases.join(",");
            if (!seen.has(key)) { seen.add(key); readings.push(bases); nudges.push(null); }
            for (const f of flips(bases)) {
                const kk = f.to.join(",");
                if (walked.has(kk)) continue;
                walked.add(kk);
                queue.push([...f.to]);
            }
        }
    }
    const nudgeOf = (reading: number) => nudges[reading] ?? null;
    const byBases = new Map(readings.map((b, i) => [b.join(","), i]));
    const readingOf = (e: readonly number[]) => {
        const bases = nudge(e);
        return bases ? byBases.get(bases.join(",")) ?? null : null;
    };

    const face = (bases: readonly number[], pair: number) => {
        const [i, j] = pairs[pair];
        const m = bases[pair];
        return [m, m | (1 << i), m | (1 << i) | (1 << j), m | (1 << j)] as
            [number, number, number, number];
    };

    /**
     * A family's ribbon, read off its own rhombs.
     *
     * The k−1 faces carrying generator f each have two edges parallel to it, at
     * masks m and m | bit(l); consecutive rhombs of the ribbon share one. So the
     * chain is found by matching those edges, and the route is the order of the
     * families it crosses. Oriented by which end lies on the +perpendicular side,
     * so the same route reads the same way at every concurrency.
     */
    const route = (bases: readonly number[], f: number): number[] => {
        const others = [...Array(k).keys()].filter((l) => l !== f);
        const rh = others.map((l) => {
            const m = bases[idx(f, l)];
            return { l, ends: [m, m | (1 << l)] as [number, number] };
        });
        const owner = new Map<number, [number, number][]>();
        rh.forEach((r, ri) => r.ends.forEach((e, ei) => {
            const at = owner.get(e) ?? [];
            if (!owner.has(e)) owner.set(e, at);
            at.push([ri, ei]);
        }));
        const free: [number, number][] = [];
        rh.forEach((r, ri) => r.ends.forEach((e, ei) => {
            if (owner.get(e)!.length === 1) free.push([ri, ei]);
        }));
        if (free.length !== 2) return [];
        const px = -dirs[fams[f]][1], py = dirs[fams[f]][0];
        const along = ([ri, ei]: [number, number]) => {
            let x = 0, y = 0;
            for (let l = 0; l < k; l++) {
                if (rh[ri].ends[ei] >> l & 1) { x += dirs[fams[l]][0]; y += dirs[fams[l]][1]; }
            }
            return x * px + y * py;
        };
        let cur = along(free[0]) > along(free[1]) ? free[0] : free[1];
        const order: number[] = [];
        const used = new Set<number>();
        for (;;) {
            const [ri, ei] = cur;
            order.push(rh[ri].l);
            used.add(ri);
            const next = (owner.get(rh[ri].ends[1 - ei]) ?? []).find(([x]) => x !== ri);
            if (!next || used.has(next[0])) break;
            cur = next;
        }
        return order;
    };

    return { k, fams, pairs, cells, lower, readings, nudgeOf, readingOf, flips, face, route };
}
