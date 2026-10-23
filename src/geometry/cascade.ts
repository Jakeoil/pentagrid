/**
 * Which reading each singularity takes, so that the borders between them are
 * legal — the cascade.
 *
 * Jake, 2026-10-17: *"Every reading is wrong, not legal penrose... All reading
 * showing identically oriented tiles at border between big purple and pink."*
 * And then the design: *"My understanding is that the decagon combinations
 * drive the reading. As you go through the combinations, ensure that connected
 * pentagons agree."*
 *
 * The rule being broken is Socolar's: in the dual of a pentagrid two **adjacent
 * cells can never have both the same shape and the same orientation**. A
 * rhomb's (j, k) is exactly shape-and-orientation, so the test is that no edge
 * is shared by two rhombs with the same pair.
 *
 * Measured before this was written (PLAN §5.-1a, `tools/border.mjs`): the
 * unresolved patch obeys the rule and every reading obeys it inside its own
 * 2k-gon, so a violation can only be at a border between two of them. Every
 * position of the old control left exactly two, zero of ten clean — because
 * one slider drove every solid, wrapped against its own count, and nothing
 * coupled them. And it was never forced: for each of the decagon's ten
 * readings, every neighboring hexagon had a reading that avoided the clash.
 *
 * So: **choose instead of wrap.** The biggest singularity goes first and takes
 * the control's value — the decagon drives, as Jake says — and the rest are
 * visited outward from it, each taking the first reading in its own pool that
 * clashes with nothing already placed. Ties are broken by staying near the
 * control's value, so the picture still moves when the slider does rather than
 * freezing on one answer.
 *
 * Greedy with no backtracking, which is honest about what it is: the result is
 * reported, so a caller can say how many borders are still wrong rather than
 * implying none ever are.
 */
import type { Pentagrid, Vec2 } from "./types.js";
import { zonohedronOf, zonogonAnchor } from "./zonohedron.js";
import type { Zonohedron } from "./zonohedron.js";

/** One singularity, as the cascade needs it: where it is and what it spans. */
export interface CascadeSite {
    /** The families that meet, ascending. */
    families: readonly number[];
    /** The 2k-gon's corners, and their K-tuples — what `zonogonAnchor` wants. */
    outline: readonly Vec2[];
    outlineK: readonly (readonly number[])[];
}

/** A placed rhomb of some reading: its pair, and its four corners. */
interface Placed { j: number; k: number; pts: Vec2[] }

const EDGE = (p: Vec2, q: Vec2) => {
    const a = `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
    const b = `${Math.round(q[0] * 1e6)},${Math.round(q[1] * 1e6)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
};

/** One reading of one site, as rhombs in the plane. */
function place(
    z: Zonohedron, anchor: Vec2, bases: readonly number[], dirs: readonly Vec2[],
): Placed[] {
    const pt = (mask: number): Vec2 => {
        let x = anchor[0], y = anchor[1];
        for (let l = 0; l < z.k; l++) {
            if (mask >> l & 1) { x += dirs[z.fams[l]][0]; y += dirs[z.fams[l]][1]; }
        }
        return [x, y];
    };
    return z.pairs.map((pr, i) => ({
        j: z.fams[pr[0]], k: z.fams[pr[1]],
        pts: z.face(bases, i).map(pt),
    }));
}

/**
 * An index of which (pair, edge) a placement occupies.
 *
 * A clash is two rhombs of the SAME pair sharing an edge, so the key is both,
 * and checking a candidate against everything already placed is a lookup
 * rather than a sweep.
 */
type Claimed = Map<string, number>;
const claimKeys = (p: Placed[]): string[] => {
    const out: string[] = [];
    for (const r of p) {
        for (let i = 0; i < 4; i++) {
            out.push(`${r.j},${r.k}|${EDGE(r.pts[i], r.pts[(i + 1) % 4])}`);
        }
    }
    return out;
};

/**
 * A tile that is already placed and cannot move — one of the ordinary rhombs
 * around a 2k-gon, which the greedy fallback must agree with.
 */
export interface FixedTile { j: number; k: number; pts: readonly Vec2[] }

export interface CascadeResult {
    /** Reading index per site, into that site's own pool. */
    readings: number[];
    /** The pool each site chose from — the Penrose-reachable set where there is one. */
    pools: number[][];
    /** How many borders are still illegal. Zero whenever the greedy walk succeeds. */
    clashes: number;
    /**
     * For a site the nudge left STANDING, its partial resolution: a base mask
     * per pair, null where that pair is still a stack. Absent for a site with
     * a whole reading, since `readings` already says it.
     */
    partials?: ((number | null)[] | null)[];
        /**
     * Sites whose choice was forced by a neighbor rather than free — or, when
     * a nudge was given outright, how many it left STANDING.
     */
    followed: number;
}

/**
 * Every nudge in {−1, 0, 1}^n, excluding the one that moves nothing.
 *
 * `sumZero` keeps Σε = 0, which is the Penrose condition on the perturbation:
 * a resolution that moves the total leaves the LI class.
 */
export function nudgeVectors(n: number, sumZero: boolean): number[][] {
    const out: number[][] = [];
    const v: number[] = [];
    const rec = (i: number, s: number) => {
        if (i === n) {
            if ((!sumZero || s === 0) && v.some((x) => x)) out.push([...v]);
            return;
        }
        for (const d of [-1, 0, 1]) { v.push(d); rec(i + 1, s + d); v.pop(); }
    };
    rec(0, 0);
    return out;
}

/**
 * Assign every site a reading — from ONE nudge, not one choice per site.
 *
 * This replaced a greedy walk that gave each 2k-gon the first reading clashing
 * with nothing already placed. That satisfied Socolar's adjacency rule — zero
 * clashes, measured — and still produced tilings Jake could see were wrong:
 * *"still seeing mismatch/discontinuity between thick and thin skewbs... it
 * looks upside down. A wrong superposition. Consistently wrong."*
 *
 * He was right, and the rule was too weak to catch it. A resolution of a
 * singular pentagrid is not a free choice per polygon: it is ONE perturbation
 * of the five families, ε, and every concurrency is resolved by the relative
 * signs of the εⱼ that meet there. Fifty-odd hexagons do not make fifty-odd
 * independent decisions — they all read the same five numbers. A greedy walk
 * can satisfy every pairwise constraint and still describe no perturbation at
 * all, which is exactly a tiling that is locally legal everywhere and globally
 * impossible.
 *
 * So: enumerate the nudges, keep the ones that resolve EVERY site, and let the
 * control pick among those. Measured at Γ = 0 with 39 sites: of the 50 nudges
 * in {−1,0,1}⁵ with Σε = 0, exactly **10** resolve everything, and they are
 * precisely the decagon's ten Penrose readings' own nudges. So the decagon
 * still drives, as Jake said — but now because it genuinely parametrizes the
 * whole patch, not because it is visited first. The other 40 leave some
 * singularity standing: those are the WALLS of §5.-1, where a couple survives.
 *
 * Off Penrose, or on a patch no single nudge resolves, it falls back to the
 * greedy walk and says so through `clashes`.
 */
export function cascade(
    pg: Pentagrid, sites: readonly CascadeSite[], reading: number, penrose: boolean,
    fixed: readonly FixedTile[] = [],
    nudge: readonly number[] | null = null,
): CascadeResult {
    const dirs = pg.directions;
    const n = sites.length;
    const zs = sites.map((s) => zonohedronOf(dirs, s.families));
    const pools = zs.map((z) => z.readings.map((_, i) => i));

    // ── a nudge given outright: apply it and say what it leaves standing
    //
    // The control used to be an index, and the enumeration below had to find
    // the nudges and wrap a number against however many it found. With the
    // state space factored (geometry/walls.ts, PLAN §5.-1b) the caller knows
    // which perturbation it wants, so it passes it. A site the nudge does not
    // resolve gets −1 and NO seat, which is the honest answer: at a wall the
    // singularity really is still standing, and Jake wants to see it.
    if (nudge) {
        const readings: number[] = [];
        const partials: ((number | null)[] | null)[] = [];
        for (let i = 0; i < n; i++) {
            const e = sites[i].families.map((j) => nudge[j]);
            const r = zs[i].readingOf(e);
            readings.push(r ?? -1);
            // A standing site is not nothing: the nudge settles some of its
            // cells and leaves the rest stacked. Those settled ones are real
            // tiles in real places and have to be drawn.
            partials.push(r === null ? zs[i].partialOf(e) : null);
        }
        return { readings, pools, partials, clashes: 0,
                 followed: readings.filter((r) => r < 0).length };
    }

    // ── the nudge-driven answer, when there is one
    if (n) {
        const seen = new Map<string, number[]>();
        for (const e of nudgeVectors(pg.directions.length, penrose)) {
            const out: number[] = [];
            let whole = true;
            for (let i = 0; i < n; i++) {
                const r = zs[i].readingOf(sites[i].families.map((j) => e[j]));
                if (r === null) { whole = false; break; }
                out.push(r);
            }
            if (whole && !seen.has(out.join(","))) seen.set(out.join(","), out);
        }
        const ways = [...seen.values()].sort((a, b) => {
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
            return 0;
        });
        if (ways.length) {
            const w = ((reading % ways.length) + ways.length) % ways.length;
            return { readings: ways[w], pools, clashes: 0, followed: ways.length };
        }
    }

    // ── no single nudge does it: the greedy walk, and an honest clash count
    const anchors: Vec2[] = sites.map((s, i) =>
        zonogonAnchor(zs[i], s.outline, s.outlineK, dirs).origin);
    const order = sites.map((_, i) => i).sort((a, b) => {
        const d = sites[b].families.length - sites[a].families.length;
        if (d) return d;
        const ca = anchors[a], cb = anchors[b];
        return (ca[0] * ca[0] + ca[1] * ca[1]) - (cb[0] * cb[0] + cb[1] * cb[1]);
    });
    const readings = new Array<number>(n).fill(0);
    const claimed: Claimed = new Map();
    for (const t of fixed) {
        for (let i = 0; i < 4; i++) {
            claimed.set(`${t.j},${t.k}|${EDGE(t.pts[i] as Vec2, t.pts[(i + 1) % 4] as Vec2)}`, -1);
        }
    }
    let clashes = 0, followed = 0, first = true;
    for (const i of order) {
        const z = zs[i], pool = pools[i].length ? pools[i] : [0];
        const wrapped = ((reading % pool.length) + pool.length) % pool.length;
        let chose = 0, best = Infinity, bestKeys: string[] = [];
        for (let t = 0; t < pool.length; t++) {
            const at = (wrapped + t) % pool.length;
            const bases = z.readings.length ? z.readings[pool[at]] : z.lower;
            const keys = claimKeys(place(z, anchors[i], bases, dirs));
            let bad = 0;
            for (const k of keys) if (claimed.has(k)) bad++;
            if (bad === 0) { chose = at; bestKeys = keys; best = 0; break; }
            if (bad < best) { best = bad; chose = at; bestKeys = keys; }
        }
        readings[i] = chose;
        if (!first && chose !== wrapped) followed++;
        clashes += best;
        for (const k of bestKeys) claimed.set(k, i);
        first = false;
    }
    return { readings, pools, clashes, followed };
}

/**
 * Where each of a site's rhombs sits under a chosen reading, by family pair.
 *
 * The C(k,2) rhombs superposed on a concurrency are exactly the faces of its
 * zonogon — one per pair — so a reading does not invent tiles, it says where
 * the ones already there go. This hands back the base corner of each, keyed
 * `"j,k"`, which is enough to move a rhomb that already knows its own shape
 * and its own K-tuples.
 *
 * Which is the point: the tiles placed this way are REAL tiles, with real
 * indices, so every dressing the page has works on them unchanged.
 */
export interface Seat {
    /** The base corner, in tiling coordinates. */
    at: Vec2;
    /**
     * Its de Bruijn index — anchor + popcount of the mask.
     *
     * Carried because the HEIGHT is index-driven, not position-driven: a
     * corner stands at RISE·(index + popcount) and a rhomb seated at a mask
     * its own K-tuple did not predict would be at the right place in the
     * plane and the wrong one in z. Which is invisible looking straight down
     * and wrong from any angle — Jake: "scrolling through reading looks fine
     * from straight on, but at angle rhombs do not have correct location."
     */
    index: number;
}

export function faceSeats(
    pg: Pentagrid, site: CascadeSite, reading: number,
    partial: readonly (number | null)[] | null = null,
): Map<string, Seat> {
    const dirs = pg.directions;
    const z = zonohedronOf(dirs, site.families);
    const anchor = zonogonAnchor(z, site.outline, site.outlineK, dirs);
    // A partial overrides the reading, and its nulls are the cells still
    // stacked: those get no seat and keep their superposition.
    const bases: readonly (number | null)[] = partial
        ?? (z.readings.length ? z.readings[reading] : z.lower);
    const out = new Map<string, Seat>();
    z.pairs.forEach((pr, i) => {
        let x = anchor.origin[0], y = anchor.origin[1], bits = 0;
        const m = bases[i];
        if (m === null) return;
        for (let l = 0; l < z.k; l++) {
            if (m >> l & 1) {
                x += dirs[z.fams[l]][0];
                y += dirs[z.fams[l]][1];
                bits++;
            }
        }
        const a = z.fams[pr[0]], b = z.fams[pr[1]];
        out.set(a < b ? `${a},${b}` : `${b},${a}`,
                { at: [x, y], index: anchor.index + bits });
    });
    return out;
}
