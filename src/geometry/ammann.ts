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

// ── The bars as their own object ──────────────────────────────────────
//
// A chord is a bar's piece inside one tile. A BAR is the whole line, and until
// now nothing held one: a chord knew its family but not which bar of that
// family it belonged to, where a rhomb has known its (j, nj) all along. This is
// that provenance.
//
// What a family's bar set IS, measured (PLAN §7.4): take any one bar as the
// reference and every bar of every family sits at c + S·(a + bφ) for small
// integers a, b — one module for all five, not five offsets — and a family is
// the members whose CONJUGATE a + b(1−φ) lies in an interval of width exactly
// φ. A Fibonacci chain, in other words, which is what two gaps in the ratio φ
// arranged in the Fibonacci word has to be. Zero exceptions over four gammas
// including a non-Penrose one.
//
// So a family is three numbers: the module offset c, the window position w, and
// the width, which is always φ. `ammannFit` reads them off an assembled family
// and `ammannChain` generates the family from them, which is the round trip
// that proves the characterization — and the generator a grid of bars needs,
// since it extends a family beyond the tiles it was read from.

/** The window's width in the conjugate coordinate. Measured, and exactly φ. */
export const AMMANN_WINDOW = PHI;
/** The conjugate of φ: the other root of x² = x + 1. */
const PHI_BAR = 1 - PHI;
const ROOT5 = Math.sqrt(5);

export interface AmmannBar {
    family: number;
    /** Where it sits along its family's normal: x·v[family] = at. */
    at: number;
    /** Its place in the family, ascending, counted from the lowest in view. */
    index: number;
}

/**
 * The bars of a patch, assembled from the chords: every chord of a family that
 * reports the same offset is the same bar.
 *
 * Takes the rhombs the caller has already collected rather than collecting its
 * own, so a view pays for the patch once.
 */
export function ammannBars(
    pg: Pentagrid, rhombs: readonly Rhomb[], lo: number, levels = 4,
): AmmannBar[] {
    const byFamily = new Map<number, Set<number>>();
    for (const r of rhombs) {
        for (const c of rhombAmmann(pg, r, lo, levels)) {
            const at = Number(ammannOffset(pg, c).toFixed(9));
            const set = byFamily.get(c.family);
            if (set) set.add(at); else byFamily.set(c.family, new Set([at]));
        }
    }
    const out: AmmannBar[] = [];
    for (const [family, set] of [...byFamily].sort((a, b) => a[0] - b[0])) {
        [...set].sort((a, b) => a - b)
            .forEach((at, index) => out.push({ family, at, index }));
    }
    return out;
}

/**
 * Write x as a + bφ over the integers, or null if it is not in ℤ[φ].
 *
 * Searched rather than solved: the conjugate would give b directly, but we only
 * have the real embedding, and the coefficients that occur are small — eleven
 * at most over a patch.
 */
function asZphi(x: number, reach = 2000): [number, number] | null {
    for (let b = -reach; b <= reach; b++) {
        const a = x - b * PHI;
        if (Math.abs(a - Math.round(a)) < 1e-7) return [Math.round(a), b];
    }
    return null;
}

export interface AmmannCut {
    /** The module offset: every bar is at c + S·(a + bφ). */
    c: number;
    /** The window is [w, w + φ) in the conjugate. Bracketed, not exact. */
    wLo: number;
    wHi: number;
    /** How many of the positions were in the module at all. Should be all. */
    fitted: number;
    outside: number;
    /**
     * Whether the family IS a Fibonacci chain of window φ — which holds exactly
     * when the bracket is a bracket, `wLo <= wHi`.
     *
     * It fails off Penrose, and that is the matching rule in a number. The
     * conjugates of a chain of window φ span less than φ in any finite stretch;
     * off a Penrose patch they span MORE, because the bars there are not quite
     * straight and the extra ones have nowhere in the window to sit. So "the
     * bars come out straight iff the tiling is Penrose" is testable from the
     * bars alone, with no reference to γ.
     */
    chain: boolean;
}

/**
 * The cut behind one family: its module offset and its window.
 *
 * The window is BRACKETED rather than solved. A patch shows a finite stretch of
 * an infinite chain, so the conjugates seen fall inside the true window without
 * reaching its ends: w ∈ [max − φ, min]. Twenty-odd bars bracket it to about
 * 0.05, and more tiles narrow it. What w is in closed form from γ is the open
 * part of PLAN §7.4; until it is closed, a fit is how a chain gets extended.
 */
export function ammannFit(positions: readonly number[]): AmmannCut {
    const sorted = [...positions].sort((a, b) => a - b);
    const c = sorted[0];
    let min = Infinity, max = -Infinity, fitted = 0, outside = 0;
    for (const p of sorted) {
        const ab = asZphi((p - c) / AMMANN_SHORT);
        if (!ab) { outside++; continue; }
        const u = ab[0] + ab[1] * PHI_BAR;
        if (u < min) min = u;
        if (u > max) max = u;
        fitted++;
    }
    const wLo = max - AMMANN_WINDOW, wHi = min;
    return { c, wLo, wHi, fitted, outside, chain: wLo <= wHi + 1e-9 };
}

/**
 * One family's bars, from its cut: the generator.
 *
 * Every point of the module is c + S·(a + bφ); the window keeps those whose
 * conjugate a + b(1−φ) lies in [w, w+φ). Two linear conditions on (a, b) — one
 * from the position range, one from the window — so b runs over an interval and
 * a over another for each b, and the enumeration is exact with no searching.
 */
export function ammannChain(
    c: number, w: number, from: number, to: number,
): number[] {
    const x0 = (from - c) / AMMANN_SHORT, x1 = (to - c) / AMMANN_SHORT;
    // a + bφ = X and a + bφ̄ = U give b = (X − U)/√5.
    const bLo = Math.floor((x0 - (w + AMMANN_WINDOW)) / ROOT5) - 1;
    const bHi = Math.ceil((x1 - w) / ROOT5) + 1;
    const out: number[] = [];
    for (let b = bLo; b <= bHi; b++) {
        const aFrom = Math.max(x0 - b * PHI, w - b * PHI_BAR);
        const aTo = Math.min(x1 - b * PHI, w + AMMANN_WINDOW - b * PHI_BAR);
        for (let a = Math.ceil(aFrom - 1e-9); a <= aTo + 1e-9; a++) {
            const u = a + b * PHI_BAR;
            if (u < w - 1e-9 || u >= w + AMMANN_WINDOW - 1e-9) continue;
            const p = c + AMMANN_SHORT * (a + b * PHI);
            if (p < from - 1e-9 || p > to + 1e-9) continue;
            out.push(p);
        }
    }
    return out.sort((a, b) => a - b);
}

/**
 * The window's position, as a closed form in γ — PLAN §7.4, measured.
 *
 *     w_j = C − q_j / S,   q_j = Σᵢ γᵢ cos(4π(i−j)/5)
 *
 * q_j is γ's PERPENDICULAR-space component along direction j, which is why the
 * sun — every γ equal, so q_j = 0 for all j — puts all five windows at the same
 * place. One C for the whole tiling, not one per family: measured over eight
 * γ at a patch of 260, the five C agree to 0.003 against a bracket of 0.0025.
 *
 * C is fixed by Σγ, which is an integer on a Penrose patch and is the only
 * case where the chain exists at all. In units of 1/√5 it reads off as a
 * member of ℤ[φ]:
 *
 *     Σγ   −1    0    1    2    3
 *     C√5  −2    0   −φ   −1  −φ²
 *
 * This is Socolar and Steinhardt's Eq. (23) in our coordinates — see PLAN
 * §7.4a. Their relation is diagonal in n and ours is not, and the whole of the
 * difference is that their γₙ is OUR perp projection: matching the two gives
 * γₙ^SS = q_j/(S(φ²+1)) = 2q_j/(5φ), where 5/2 is the registration gain. The
 * coefficient comes out exactly, both ways.
 */
export function ammannPerp(pg: Pentagrid, family: number): number {
    let q = 0;
    for (let i = 0; i < pg.n; i++) {
        q += pg.gamma[i] * Math.cos(4 * Math.PI * (i - family) / pg.n);
    }
    return q;
}
