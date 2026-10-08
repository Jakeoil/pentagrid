/**
 * Ammann bars, per tile.
 *
 * Five families of parallel lines laid over a Penrose patch, parallel to the
 * gridlines but NOT evenly spaced: the gaps take two values in the ratio φ,
 * arranged in the Fibonacci word — Conway's musical sequence. They are the
 * matching rules made visible, in the sense that a tiling is Penrose exactly
 * when the bars come out straight.
 *
 * Read off penrose-mosaic's `ammannSegments`, and checked before being
 * believed, because one of its offsets is 1 − 1/(4φ) and a lone 4 in a φ-world
 * looks like a fudge. It is not one. What the measurements say (PLAN §7.1, and
 * `tools/ammann.test.mjs` holds each as an assertion):
 *
 *  - Every chord is EXACTLY parallel to a gridline family. On the thick rhomb
 *    the five run at 54°, 18°, 90°, 162° and 126° to its edges, which are the
 *    five gridline directions, each used once. So a rhomb is crossed by all
 *    five families, once each, and the mosaic's six-point polyline is five bars
 *    chained end to end — consecutive bars of different families meet on an
 *    edge of the rhomb, which is why drawing them as one path works.
 *  - The figure is oriented by the INDEX EXTREME corner, the same corner
 *    `rhombPentagons`, `rhombArrows` and `rhombDeflation` are placed from. With
 *    it, 1665 chords of a sun patch fall on 68 lines, 24.5 to a line; from the
 *    opposite corner they fall on 198, which is to say they do not assemble.
 *    The figure is its own mirror image, so the chirality is free.
 *  - The spacings are S = √5/2 = 1.118034 and L = φS = 1.809017 in units of the
 *    rhomb edge, and nothing else. A spacing wider than the edge is the same
 *    fact as one chord per family per tile.
 *  - The word is the Fibonacci word. Family 2 on the sun reads SLSLLSLLSLSLL,
 *    which is ⌊(n+1)/φ⌋ − ⌊n/φ⌋ at shift 5.
 *
 * And on every LI class, which is the point of them: the index extreme needs
 * four index levels and every Penrose patch has them. Only a singular patch
 * breaks, where superposed tiles carry no dressing at all and the bars they
 * would have carried leave gaps of L − S.
 */
import type { Pentagrid, Rhomb, Vec2 } from "./types.js";
import { extremeCorner, PHI } from "./decor.js";

/** The gap between neighboring bars of one family: these two and no others. */
export const AMMANN_SHORT = Math.sqrt(5) / 2;
export const AMMANN_LONG = AMMANN_SHORT * PHI;

export interface AmmannChord {
    a: Vec2;
    b: Vec2;
    /** The gridline family it is parallel to — its normal is `directions[family]`. */
    family: number;
}

/**
 * Which edge, and how far along it, each of the six points sits.
 *
 * `p0` is the index extreme and `p2` the corner opposite; `nl` = p0→p3 and
 * `nr` = p0→p1 are the edges at p0, `fl` = p3→p2 and `fr` = p1→p2 the two at
 * p2. The fraction is measured from the first of the pair, so an offset on `fl`
 * is read from p3 and not from p2.
 */
type Edge = "nl" | "nr" | "fl" | "fr";
const THICK_POINTS: [Edge, number][] = [
    ["fl", 1 - 1 / (4 * PHI)],
    ["fr", 1 / 2],
    ["nr", PHI / 2],
    ["nl", PHI / 2],
    ["fl", 1 / 2],
    ["fr", 1 - 1 / (4 * PHI)],
];
const THIN_POINTS: [Edge, number][] = [
    ["fl", 1 / (4 * PHI)],
    ["nl", PHI / 2],
    ["fl", 1 / 2],
    ["fr", 1 / 2],
    ["nr", PHI / 2],
    ["fr", 1 / (4 * PHI)],
];
/** The offsets, for a test that wants to read them rather than restate them. */
export const AMMANN_POINTS = { thick: THICK_POINTS, thin: THIN_POINTS } as const;

/**
 * The five bar chords crossing one tile, or none when the tile cannot be
 * placed — off a Penrose patch at the middle index, or superposed in a 2k-gon.
 *
 * `family` is found from the directions rather than from a table of which chord
 * is which: the chord is perpendicular to exactly one vⱼ, and a test asserts
 * that the fit is exact rather than nearest.
 */
export function rhombAmmann(
    pg: Pentagrid, r: Rhomb, lo: number, levels = 4, extAt?: 0 | 2,
): AmmannChord[] {
    const ext = extremeCorner(r, lo, levels, extAt);
    if (ext === null) return [];
    const V = r.vertices;
    const p = [V[ext], V[(ext + 1) % 4], V[(ext + 2) % 4], V[(ext + 3) % 4]];
    const edges: Record<Edge, [Vec2, Vec2]> = {
        nl: [p[0], p[3]], nr: [p[0], p[1]], fl: [p[3], p[2]], fr: [p[1], p[2]],
    };
    const pts = (r.thick ? THICK_POINTS : THIN_POINTS).map(([which, f]) => {
        const [s, e] = edges[which];
        return [s[0] + (e[0] - s[0]) * f, s[1] + (e[1] - s[1]) * f] as Vec2;
    });
    const out: AmmannChord[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push({ a, b, family: familyOf(pg, a, b) });
    }
    return out;
}

/** The family a chord runs with: the one direction it is perpendicular to. */
function familyOf(pg: Pentagrid, a: Vec2, b: Vec2): number {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    let best = 0, least = Infinity;
    for (let j = 0; j < pg.directions.length; j++) {
        const [vx, vy] = pg.directions[j];
        const d = Math.abs((dx * vx + dy * vy) / len);
        if (d < least) { least = d; best = j; }
    }
    return best;
}

/**
 * Where a chord sits along its family's normal — the bar it belongs to.
 *
 * Two chords of the same family are on the same bar when this agrees, which is
 * what "the bars come out straight" means and how the assembly is tested.
 */
export function ammannOffset(pg: Pentagrid, c: AmmannChord): number {
    const [vx, vy] = pg.directions[c.family];
    return c.a[0] * vx + c.a[1] * vy;
}
