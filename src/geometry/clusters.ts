// Recognising P1 clusters in a rhomb tiling.
//
// P1 is the ground truth and the rhombs are the derived view, so a patch of
// rhombs ought to be readable back as pentagons. It is, and the rule is local and
// exact — but only for Penrose.
//
// THE RULE. Lift every vertex to its Wieringa index m = sum K. A rhomb's four
// corners carry indices m, m+1, m+2, m+1 (opposite edges of a parallelogram are
// the same vector, so a circuit steps +1,+1,-1,-1), and for Penrose the whole
// tiling uses exactly four levels. A rhomb therefore spans either the bottom
// three levels or the top three, which means it touches EXACTLY ONE extreme —
// the minimum or the maximum — and never both. Grouping the rhombs by that
// vertex partitions the patch with nothing left over, and each group is one of
// three shapes:
//
//     5 thick + 0 thin   star rhomb group    centre of a  Pe5   (the SUN)
//     3 thick + 1 thin   boat rhomb group    centre of a  Pe3
//     1 thick + 2 thin   diamond rhomb group centre of a  Pe1
//
// Measured on a patch of 1958 rhombs: no rhomb without an extreme, none with
// two, and 100% of the groups away from the patch edge are one of those three.
//
// WHY ONLY PENROSE. The four-level span is exactly the condition sum-gamma is an
// integer; off it the index takes five values, a rhomb can span the middle three
// and touch no extreme at all, and the partition collapses — 1451 of 1952 rhombs
// were left unassigned at sum-gamma = 1/2. That is not a gap in this code. The
// P1 pentagons are a Penrose structure, so a generalised tiling has no clusters
// to find, and `defined` says so rather than returning nonsense.
//
// Note the naming trap: a Pe5 is the SUN, and the *star rhomb group* is what sits
// at its centre. The patch name and the rhomb-group name are different
// vocabularies. See PLAN.md.

import type { Rhomb } from "./types.js";
import { vertexIndex } from "./roof.js";

/** Which P1 pentagon a rhomb group centres on. */
export type ClusterKind = "Pe5" | "Pe3" | "Pe1";

export interface Cluster {
    /** null when the group is cut by the edge of the patch, so incomplete. */
    kind: ClusterKind | null;
    /** The pentagon centre: the group's extreme-index vertex. */
    x: number;
    y: number;
    /** Its Wieringa index — always the patch minimum or maximum. */
    index: number;
    /** Positions in the array handed in. */
    rhombs: number[];
    thick: number;
    thin: number;
}

export interface ClusterResult {
    clusters: Cluster[];
    /** How many index levels the patch uses. Clusters exist only at four. */
    levels: number;
    /** Whether clusters are defined at all. */
    defined: boolean;
    /** Why not, when they are not. */
    reason?: string;
    /** Rhombs touching no extreme. Always zero when `defined`. */
    unassigned: number;
}

/** Integer key. `toFixed` would split the origin, since -1e-16 prints "-0.000000". */
const key = (x: number, y: number) => {
    const a = Math.round(x * 1e6), b = Math.round(y * 1e6);
    return `${a === 0 ? 0 : a},${b === 0 ? 0 : b}`;
};

function classify(thick: number, thin: number): ClusterKind | null {
    if (thick === 5 && thin === 0) return "Pe5";
    if (thick === 3 && thin === 1) return "Pe3";
    if (thick === 1 && thin === 2) return "Pe1";
    return null;
}

/**
 * Partition a patch of rhombs into its P1 clusters.
 *
 * Needs a patch big enough to show all four index levels — a handful of rhombs
 * can span only three, which is reported as undefined rather than guessed at.
 */
export function findClusters(rhombs: readonly Rhomb[]): ClusterResult {
    if (rhombs.length === 0)
        return { clusters: [], levels: 0, defined: false, reason: "empty patch", unassigned: 0 };

    let lo = Infinity, hi = -Infinity;
    const idx: number[][] = rhombs.map((r) => {
        const m = r.kTuples.map(vertexIndex);
        for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
        return m;
    });

    const levels = hi - lo + 1;
    if (levels !== 4) {
        return {
            clusters: [], levels, defined: false, unassigned: rhombs.length,
            reason: levels < 4
                ? `patch spans only ${levels} index levels, too small to place the extremes`
                : `index spans ${levels} levels, so Σγ is not an integer and the tiling is not Penrose`,
        };
    }

    const byCentre = new Map<string, Cluster>();
    let unassigned = 0;

    rhombs.forEach((r, n) => {
        let at = -1;
        for (let i = 0; i < 4; i++) {
            if (idx[n][i] === lo || idx[n][i] === hi) { at = i; break; }
        }
        if (at < 0) { unassigned++; return; }

        const [x, y] = r.vertices[at];
        const k = key(x, y);
        let c = byCentre.get(k);
        if (!c) {
            c = { kind: null, x, y, index: idx[n][at], rhombs: [], thick: 0, thin: 0 };
            byCentre.set(k, c);
        }
        c.rhombs.push(n);
        if (r.thick) c.thick++; else c.thin++;
    });

    const clusters = [...byCentre.values()];
    for (const c of clusters) c.kind = classify(c.thick, c.thin);
    return { clusters, levels, defined: true, unassigned };
}

/** Only the clusters the patch actually contains whole. */
export function completeClusters(result: ClusterResult): Cluster[] {
    return result.clusters.filter((c) => c.kind !== null);
}

/** How many of each kind, counting complete clusters only. */
export function clusterCounts(result: ClusterResult): Record<ClusterKind, number> {
    const out: Record<ClusterKind, number> = { Pe5: 0, Pe3: 0, Pe1: 0 };
    for (const c of result.clusters) if (c.kind) out[c.kind]++;
    return out;
}
