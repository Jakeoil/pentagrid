// Circular cut lines — PLAN §11.16.
//
// An alternative way of drawing the outline fold's edges, from Figure 6 of the
// starfish / ivy-leaf / hexagon paper. Jake, 2026-11-28: *"An edge will
// actually be a shape consisting of two opposing arcs, each centered on a
// respective circle of a radius of the obvious decagon."*
//
// THE CIRCLES ARE THE TILING'S, NOT THE EDGE'S. Every selected edge is a unit
// chord, and a unit chord is a side of a decagon of edge 1 — so it lies on two
// circles of circumradius φ, centered at the decagon centers, one each side at
// the apothem. Measured on a Penrose patch (±9, 623 edges):
//
//   a chord subtends exactly 36° at its own center      (ten tile a circle)
//   its center is exactly φ from both of its endpoints
//   794 of 804 neighbor pairs at 144° SHARE a circle
//   0 of 449 neighbor pairs at 72° share one
//   40 of 339 centers carry a full ten chords           (a drawn decagon)
//
// That is the figure's whole behavior, and it is the tiling's, not a choice.
// The one free parameter is the radius, and the shape it gives has a name at
// each end of its range:
//
//   R < a            the circles are disjoint   → a NEGATIVE lens, width 2(a−R)
//   R = a  (inscribed, 1.538842)                → tangent, pinched to a point
//   a < R ≤ φ        the circles overlap        → a POSITIVE lens, width 2(R−a)
//   R = φ  (circumscribed)                      → the arc tips reach the vertices
//
// And the sign change is the same number from two directions: an edge's own two
// centers are 2a apart, so its two circles begin to overlap at exactly R > a.
import type { Rhomb } from "./types.js";

/** The unit-edge decagon's apothem: center to the middle of a side. */
export const CUT_APOTHEM = 0.5 / Math.tan(Math.PI / 10);      // 1.538842
/** Its circumradius, which is the largest useful radius. */
export const CUT_RMAX = (1 + Math.sqrt(5)) / 2;               // φ
/** The widest positive lens: the arc tips land exactly on the two vertices. */
export const CUT_WIDTH_MAX = 2 * (CUT_RMAX - CUT_APOTHEM);    // 0.158384
/** The other end, where the radius reaches zero. */
export const CUT_WIDTH_MIN = -2 * CUT_APOTHEM;                // −3.077684

/**
 * The radius a signed width asks for — §11.16's control.
 *
 * R is a bad thing to scroll: the whole positive-lens range is the top 4.8% of
 * it, so the sign change would be a sliver at one end of the box. The width is
 * the thing on screen, and it is signed through the pinch.
 */
export function cutRadius(width: number): number {
    const w = Math.max(CUT_WIDTH_MIN, Math.min(CUT_WIDTH_MAX, width));
    return Math.max(0, CUT_APOTHEM + w / 2);
}

export type CutPoint = readonly [number, number];
export interface CutChord { a: CutPoint; b: CutPoint }
export interface CutArc {
    /** Which circle, by index into `circles`. */
    ci: number;
    /** Math angles; a0 → a1 is the direction the arc is drawn. */
    a0: number;
    a1: number;
}
/** One edge's shape: the two arcs that bound it, left and right of A→B. */
export interface CutBand { left: CutArc; right: CutArc }

export interface CutGeometry {
    /** The radius every circle is drawn at. */
    r: number;
    /** Every distinct decagon center in play. */
    circles: CutPoint[];
    /** The chords, deduplicated — the rhomb loop finds most of them twice. */
    chords: CutChord[];
    /** One band per chord, in the same order. */
    bands: CutBand[];
}

const TAU = 2 * Math.PI;
/** What one chord claims on its circle: 36°, exactly ten to a turn. */
export const CUT_SECTOR = TAU / 10;

/** θ wrapped into [0, 2π). */
function norm(t: number): number {
    const x = t % TAU;
    return x < 0 ? x + TAU : x;
}


/**
 * Points identified within a tolerance.
 *
 * Not a rounded string key, which is what the first measurement used: eight
 * pairs of centers came out 0.0000 apart under a 1e-5 key and were counted as
 * two circles, because the rounding fell between them. A circle split in two is
 * a seam down the middle of an arc that should be continuous.
 */
class PointIndex {
    private cells = new Map<string, number[]>();
    readonly pts: CutPoint[] = [];
    private static readonly CELL = 1e-3;
    private static readonly EPS2 = 1e-12;
    /** The index of this point, reusing one already here if it coincides. */
    add(x: number, y: number): number {
        const cx = Math.round(x / PointIndex.CELL);
        const cy = Math.round(y / PointIndex.CELL);
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                for (const k of this.cells.get(`${cx + i},${cy + j}`) ?? []) {
                    const p = this.pts[k];
                    const dx = p[0] - x, dy = p[1] - y;
                    if (dx * dx + dy * dy < PointIndex.EPS2) return k;
                }
            }
        }
        const k = this.pts.length;
        this.pts.push([x, y]);
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(k); else this.cells.set(key, [k]);
        return k;
    }
}

/**
 * The chords and the circles they lie on.
 *
 * `edges` may repeat: a shared edge is reached from both of its rhombs, and 557
 * of 623 were on the measured patch. Harmless for a stroke and fatal for a
 * fill, so the deduplication is here rather than left to the caller.
 */
export function buildCuts(
    edges: readonly CutChord[], width: number,
): CutGeometry {
    const r = cutRadius(width);
    const verts = new PointIndex();
    const centers = new PointIndex();
    const seen = new Set<string>();
    const chords: CutChord[] = [];
    /** Per chord: its two end vertices, and its left/right circle. */
    const meta: { va: number; vb: number; left: number; right: number }[] = [];

    for (const { a, b } of edges) {
        const ia = verts.add(a[0], a[1]), ib = verts.add(b[0], b[1]);
        if (ia === ib) continue;
        const key = ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const A = verts.pts[ia], B = verts.pts[ib];
        chords.push({ a: A, b: B });
        // The two centers: along the edge's normal, at the apothem. Two edges
        // meeting at 144° land on the SAME point here, which is what makes
        // their arcs one arc instead of two that happen to meet.
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;          // left of A→B
        meta.push({
            va: ia, vb: ib,
            left: centers.add(mx + CUT_APOTHEM * nx, my + CUT_APOTHEM * ny),
            right: centers.add(mx - CUT_APOTHEM * nx, my - CUT_APOTHEM * ny),
        });
    }

    // ── where each arc ends ───────────────────────────────────────────
    //
    // An arc's natural extent is its 36° sector, which ends at the radial
    // projection of the vertex onto its circle. That is the right answer at a
    // 144° joint, where the neighbor is a chord of the SAME circle and the two
    // sectors are adjacent — there is no joint to draw, the arc simply
    // continues. At any other joint the neighbor's circle cuts in first, and
    // the arc has to stop there: Jake, 2026-11-28, "the other side's edge must
    // end when it reaches its neighbor's circle."
    //
    // Both arcs of a cut joint stop at the SAME point, so the two bands abut
    // exactly rather than leaving a notch or overlapping into a blob.
    const ends = new Map<string, number>();           // "chord|side|vertex" → angle
    const endKey = (ci: number, side: "l" | "r", v: number) => `${ci}|${side}|${v}`;
    const angleAt = (c: CutPoint, p: CutPoint) => Math.atan2(p[1] - c[1], p[0] - c[0]);

    /** Incident (chord, which end) at every vertex. */
    const around = new Map<number, { ci: number; at: number; dir: number }[]>();
    for (let ci = 0; ci < chords.length; ci++) {
        const { va, vb } = meta[ci];
        const A = verts.pts[va], B = verts.pts[vb];
        (around.get(va) ?? around.set(va, []).get(va)!)
            .push({ ci, at: va, dir: Math.atan2(B[1] - A[1], B[0] - A[0]) });
        (around.get(vb) ?? around.set(vb, []).get(vb)!)
            .push({ ci, at: vb, dir: Math.atan2(A[1] - B[1], A[0] - B[0]) });
    }

    for (const [v, list] of around) {
        const V = verts.pts[v];
        list.sort((x, y) => norm(x.dir) - norm(y.dir));
        for (let i = 0; i < list.length; i++) {
            const e = list[i], f = list[(i + 1) % list.length];
            if (list.length === 1) {
                // A loose end at the edge of the patch: nothing to meet, so
                // both of its arcs stop at the sector boundary.
                for (const side of ["l", "r"] as const) {
                    const ci = side === "l" ? meta[e.ci].left : meta[e.ci].right;
                    ends.set(endKey(e.ci, side, v), angleAt(centers.pts[ci], V));
                }
                continue;
            }
            // Going counterclockwise, the gap between e and f is on e's LEFT
            // and on f's RIGHT — so those are the two circles that face it.
            const eSide = e.at === meta[e.ci].va ? "l" : "r";
            const fSide = f.at === meta[f.ci].va ? "r" : "l";
            const eC = eSide === "l" ? meta[e.ci].left : meta[e.ci].right;
            const fC = fSide === "l" ? meta[f.ci].left : meta[f.ci].right;
            if (eC === fC) {
                // The same circle: adjacent sectors, one continuous arc.
                const t = angleAt(centers.pts[eC], V);
                ends.set(endKey(e.ci, eSide, v), t);
                ends.set(endKey(f.ci, fSide, v), t);
                continue;
            }
            const P = meetNearest(centers.pts[eC], centers.pts[fC], r, V);
            ends.set(endKey(e.ci, eSide, v),
                     P ? angleAt(centers.pts[eC], P) : angleAt(centers.pts[eC], V));
            ends.set(endKey(f.ci, fSide, v),
                     P ? angleAt(centers.pts[fC], P) : angleAt(centers.pts[fC], V));
        }
    }

    // ── the positive lens is its own case ─────────────────────────────
    //
    // Past the apothem an edge's own two circles overlap, and the band is the
    // overlap: a lens whose tips are where they cross, at ±√(R² − a²) along
    // the edge from its middle. That is 0.358 at R = 1.58 and exactly 0.5 — the
    // vertices themselves — at R = φ, which is what makes the circumscribed
    // circle the maximum. The lens is strictly inside its own edge, so nothing
    // trims it: no neighbor is reached. Jake: "circumscribed circle. This is
    // the maximum size R. Edge shape is a positive lens. Maximum overlap."
    const lens = r > CUT_APOTHEM;
    const half = lens ? Math.sqrt(Math.max(0, r * r - CUT_APOTHEM * CUT_APOTHEM)) : 0;

    const bands: CutBand[] = chords.map((_, ci) => {
        const { va, vb, left, right } = meta[ci];
        if (lens) {
            const A = verts.pts[va], B = verts.pts[vb];
            const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
            const dx = B[0] - A[0], dy = B[1] - A[1];
            const len = Math.hypot(dx, dy) || 1;
            const tipA: CutPoint = [mx - half * dx / len, my - half * dy / len];
            const tipB: CutPoint = [mx + half * dx / len, my + half * dy / len];
            const tipArc = (c: number): CutArc => {
                const C = centers.pts[c];
                const t0 = Math.atan2(tipA[1] - C[1], tipA[0] - C[0]);
                const t1 = Math.atan2(tipB[1] - C[1], tipB[0] - C[0]);
                let d = norm(t1 - t0);
                if (d > Math.PI) d -= TAU;
                return { ci: c, a0: t0, a1: t0 + d };
            };
            return { left: tipArc(left), right: tipArc(right) };
        }
        const arc = (c: number, side: "l" | "r"): CutArc => {
            const t0 = ends.get(endKey(ci, side, va))
                ?? angleAt(centers.pts[c], verts.pts[va]);
            const t1 = ends.get(endKey(ci, side, vb))
                ?? angleAt(centers.pts[c], verts.pts[vb]);
            // The short way round: a sector is 36°, never the other 324°.
            let d = norm(t1 - t0);
            if (d > Math.PI) d -= TAU;
            return { ci: c, a0: t0, a1: t0 + d };
        };
        return { left: arc(left, "l"), right: arc(right, "r") };
    });

    return { r, circles: centers.pts, chords, bands };
}

/**
 * Where two circles of the same radius meet, nearest to `V`.
 *
 * Null when they do not reach each other, which is the underlap Jake named:
 * the band then simply ends at its own sector boundary and there is a gap at
 * the joint, which is the honest picture rather than a papered-over one.
 */
function meetNearest(
    c1: CutPoint, c2: CutPoint, r: number, V: CutPoint,
): CutPoint | null {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
    const d = Math.hypot(dx, dy);
    if (d < 1e-12 || d > 2 * r) return null;
    const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));
    const mx = c1[0] + dx / 2, my = c1[1] + dy / 2;
    const ux = -dy / d, uy = dx / d;
    const p1: CutPoint = [mx + h * ux, my + h * uy];
    const p2: CutPoint = [mx - h * ux, my - h * uy];
    return Math.hypot(p1[0] - V[0], p1[1] - V[1])
         < Math.hypot(p2[0] - V[0], p2[1] - V[1]) ? p1 : p2;
}

/** Every edge of a rhomb whose two ends both pass `keep`, undeduplicated. */
export function outlineChords(
    rhombs: readonly Rhomb[], keep: (kTuple: readonly number[]) => boolean,
): CutChord[] {
    const out: CutChord[] = [];
    for (const r of rhombs) {
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            if (!keep(r.kTuples[i]) || !keep(r.kTuples[j])) continue;
            out.push({ a: r.vertices[i] as CutPoint, b: r.vertices[j] as CutPoint });
        }
    }
    return out;
}
