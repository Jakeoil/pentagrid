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

export interface CascadeResult {
    /** Reading index per site, into that site's own pool. */
    readings: number[];
    /** The pool each site chose from — the Penrose-reachable set where there is one. */
    pools: number[][];
    /** How many borders are still illegal. Zero whenever the greedy walk succeeds. */
    clashes: number;
    /** Sites whose choice was forced by a neighbor rather than free. */
    followed: number;
}

/**
 * Assign every site a reading, largest first and outward.
 *
 * `reading` is the control's value: the biggest site takes it, wrapped against
 * its own pool, and everything else follows. `penrose` says whether to hold
 * the sites to the readings a Penrose grid can reach.
 */
export function cascade(
    pg: Pentagrid, sites: readonly CascadeSite[], reading: number, penrose: boolean,
): CascadeResult {
    const dirs = pg.directions;
    const n = sites.length;
    const zs: Zonohedron[] = [];
    const anchors: Vec2[] = [];
    const pools: number[][] = [];
    for (const s of sites) {
        const z = zonohedronOf(dirs, s.families);
        zs.push(z);
        anchors.push(zonogonAnchor(z, s.outline, s.outlineK, dirs).origin);
        const pool = penrose && z.penrose.length ? [...z.penrose]
            : z.readings.map((_, i) => i);
        pools.push(pool.length ? pool : [0]);
    }
    // Biggest first: the decagon drives, then the octagons, then the hexagons.
    // Within a size, nearest the origin first, so the order does not wander
    // with the window.
    const order = sites.map((_, i) => i).sort((a, b) => {
        const d = sites[b].families.length - sites[a].families.length;
        if (d) return d;
        const ca = anchors[a], cb = anchors[b];
        return (ca[0] * ca[0] + ca[1] * ca[1]) - (cb[0] * cb[0] + cb[1] * cb[1]);
    });

    const readings = new Array<number>(n).fill(0);
    const claimed: Claimed = new Map();
    let clashes = 0, followed = 0;
    let first = true;
    for (const i of order) {
        const z = zs[i], pool = pools[i];
        const wrapped = ((reading % pool.length) + pool.length) % pool.length;
        // The control's value for the first site; for the rest, start there and
        // walk, so a slider still moves the whole picture.
        const tries: number[] = [];
        for (let t = 0; t < pool.length; t++) tries.push((wrapped + t) % pool.length);

        let chose = -1, best = Infinity, bestKeys: string[] = [];
        for (const t of tries) {
            const bases = z.readings.length ? z.readings[pool[t]] : z.lower;
            const keys = claimKeys(place(z, anchors[i], bases, dirs));
            let bad = 0;
            for (const k of keys) if (claimed.has(k)) bad++;
            if (bad === 0) { chose = t; bestKeys = keys; best = 0; break; }
            if (bad < best) { best = bad; chose = t; bestKeys = keys; }
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
export function faceSeats(
    pg: Pentagrid, site: CascadeSite, reading: number,
): Map<string, Vec2> {
    const dirs = pg.directions;
    const z = zonohedronOf(dirs, site.families);
    const origin = zonogonAnchor(z, site.outline, site.outlineK, dirs).origin;
    const bases = z.readings.length ? z.readings[reading] : z.lower;
    const out = new Map<string, Vec2>();
    z.pairs.forEach((pr, i) => {
        let x = origin[0], y = origin[1];
        const m = bases[i];
        for (let l = 0; l < z.k; l++) {
            if (m >> l & 1) { x += dirs[z.fams[l]][0]; y += dirs[z.fams[l]][1]; }
        }
        const a = z.fams[pr[0]], b = z.fams[pr[1]];
        out.set(a < b ? `${a},${b}` : `${b},${a}`, [x, y]);
    });
    return out;
}
