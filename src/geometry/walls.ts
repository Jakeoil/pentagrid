/**
 * The exceptional singularity's state space, factored the way Jake reads it.
 *
 * Jake, 2026-10-22: *"The exceptional singularity has 5 modes/directions.
 * Entering, it encounters two neker scubes/skewbs. It can take the thin-thick
 * thick-thin direction. and of that, the top or the bottom (or unresolved
 * both)... 5 anti gridlines. two configs (call it direction) on each and
 * high/low/both for paths."*
 *
 * A resolution of a singular pentagrid is ONE perturbation ε of the five
 * families (§5.-1), and Σε = 0 is the Penrose condition on it. So the state is
 * a direction in the sum-zero space, and §5.-1b's census says those sort into
 * a clean product. This computes it from the algebra, not by probing a patch:
 *
 *   **Which triples survive.** Three lines through a common point stay
 *   concurrent under ε exactly when the 3×3 determinant of their rows
 *   (v_a | ε_a) vanishes — two equations p·v = −ε have a solution the third
 *   agrees with. So resolution is a determinant, one per triple.
 *
 *   **axis** — a family j. A whole resolution on j moves every line but j. A
 *   wall on j leaves family j's own gridline standing: the two surviving
 *   triples share exactly j, and their spoke is perpendicular to v_j, which is
 *   to say the spoke IS that gridline. Jake's *"single wall of singularities
 *   which passes through the decagon"* is a gridline that never got pulled
 *   apart, and his *"anti gridline"* is the right name for it — the line is
 *   family j's, and it is the one direction j did not move in.
 *
 *   **sense** — the ±ε involution, one bit, flipped by negating ε and by
 *   nothing else. A whole resolution reads it as upper against lower surface;
 *   a wall reads it as thin-then-thick against thick-then-thin along the
 *   spoke. Jake's *"short long, long short."*
 *
 *   **branch** — `whole`, or where the two skewbs came to rest. Measured
 *   reach-invariant (§5.-1b): 10 whole readings and 40 walled states, at
 *   ε ∈ {−1,0,1}⁵, {−2..2}⁵ and {−3..3}⁵ alike.
 *
 * The two centered branches are exactly the 20 minimal nudges — one line up,
 * one down — which are the phason flips: a triple whose three families all
 * stand still keeps its concurrency point, so that skewb stays on the old
 * decagon's center while its partner steps off.
 */
import type { Vec2 } from "./types.js";
import { zonohedronOf, ENUMERATE_UPTO } from "./zonohedron.js";
import type { Zonohedron } from "./zonohedron.js";

/** Where the two standing skewbs ended up, or that neither did. */
export type Branch =
    | "whole" | "S at center" | "L at center" | "same side" | "straddling";

/** The branches in the order a control should step through them. */
export const BRANCHES: readonly Branch[] = [
    "whole", "S at center", "L at center", "same side", "straddling",
];

export interface NudgeState {
    /** The perturbation itself, one entry per family. */
    e: readonly number[];
    /** The family whose gridline is left standing, or left unmoved. */
    axis: number;
    /** +1 or −1: the ±ε involution. */
    sense: number;
    branch: Branch;
    /** The triples still concurrent, ascending. Empty for `whole`. */
    standing: readonly (readonly number[])[];
}

/** Every sum-zero ε in {−1,0,1}^n, bar the one that moves nothing. */
export function sumZeroNudges(n: number): number[][] {
    const out: number[][] = [];
    const v: number[] = [];
    const rec = (i: number, s: number) => {
        if (i === n) {
            if (s === 0 && v.some((x) => x)) out.push([...v]);
            return;
        }
        for (const d of [-1, 0, 1]) { v.push(d); rec(i + 1, s + d); v.pop(); }
    };
    rec(0, 0);
    return out;
}

/**
 * Does ε pull the triple apart?
 *
 * The three lines meet under ε iff det[(v_a, ε_a); (v_b, ε_b); (v_c, ε_c)] = 0.
 * Anything else and they form a small triangle instead — resolved.
 */
export function resolvesTriple(
    dirs: readonly Vec2[], tri: readonly number[], e: readonly number[],
): boolean {
    const [a, b, c] = tri;
    const det =
        dirs[a][0] * (dirs[b][1] * e[c] - dirs[c][1] * e[b])
        - dirs[a][1] * (dirs[b][0] * e[c] - dirs[c][0] * e[b])
        + e[a] * (dirs[b][0] * dirs[c][1] - dirs[c][0] * dirs[b][1]);
    return Math.abs(det) > 1e-12;
}

/**
 * Where a surviving triple's concurrency point goes, per unit of ε.
 *
 * Two of its lines are enough: p·v_a = −ε_a and p·v_b = −ε_b. The third
 * agrees by construction, since the triple survived.
 */
function stillAt(
    dirs: readonly Vec2[], tri: readonly number[], e: readonly number[],
): Vec2 {
    const [a, b] = tri;
    const det = dirs[a][0] * dirs[b][1] - dirs[a][1] * dirs[b][0];
    return [(-e[a] * dirs[b][1] + e[b] * dirs[a][1]) / det,
            (-e[b] * dirs[a][0] + e[a] * dirs[b][0]) / det];
}

/** A triple's K-code: 113 is the thin skewb, 122 the thick. */
export function skewbCode(n: number, tri: readonly number[]): string {
    const f = [...tri].sort((p, q) => p - q);
    return [f[1] - f[0], f[2] - f[1], n - (f[2] - f[0])]
        .sort((p, q) => p - q).join("");
}

/** Every triple of n families, ascending. */
function triples(n: number): number[][] {
    const out: number[][] = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        for (let c = b + 1; c < n; c++) out.push([a, b, c]);
    }
    return out;
}

/** Which state ε names: its axis, its sense and its branch. */
export function factorNudge(
    dirs: readonly Vec2[], e: readonly number[],
): NudgeState | null {
    const n = dirs.length;
    const standing = triples(n).filter((t) => !resolvesTriple(dirs, t, e));
    if (!standing.length) {
        const axis = e.findIndex((v) => v === 0);
        if (axis < 0) return null;                   // not one of the ten
        return { e, axis, sense: Math.sign(e[(axis + 1) % n]),
                 branch: "whole", standing: [] };
    }
    if (standing.length !== 2) return null;          // not a simple wall
    const [t0, t1] = standing;
    const shared = t0.filter((j) => t1.includes(j));
    if (shared.length !== 1) return null;
    const axis = shared[0];
    // The spoke, oriented deterministically: v_axis turned a quarter turn. It
    // is perpendicular to v_axis, so this is the standing gridline's own line.
    const d: Vec2 = [-dirs[axis][1], dirs[axis][0]];
    let S = 0, L = 0;
    for (const t of standing) {
        const p = stillAt(dirs, t, e);
        const along = p[0] * d[0] + p[1] * d[1];
        if (skewbCode(n, t) === "113") S = along; else L = along;
    }
    const EPS = 1e-12;
    const branch: Branch = Math.abs(S) < EPS ? "S at center"
        : Math.abs(L) < EPS ? "L at center"
        : S * L > 0 ? "same side" : "straddling";
    return { e, axis, sense: S < L ? 1 : -1, branch, standing };
}

/**
 * The whole state space, in the order a control steps through it: branch,
 * then axis, then sense.
 *
 * Memoized on the direction set, because a view asks for it on every draw and
 * the answer only depends on the grid's geometry. Unmemoized this enumerated
 * 50 nudges times C(n,3) determinants per frame, and `completions` built a
 * zonohedron on top of that — the test suite went from seconds to minutes,
 * which is how it was caught.
 */
/**
 * One table per direction set, keyed by the array ITSELF.
 *
 * It was keyed by a string built from the coordinates, and that string cost
 * more than the lookup it guarded. A grid's `directions` array is a stable
 * object, so identity is the right key and the whole thing becomes one property
 * read: 30 cold `wallView`s went from 6044 ms to 115 ms, and 10000 warm ones
 * from seconds to 9 ms. Most of the cold cost was rebuilding the decagon's own
 * zonogon per call, which `wholeZono` now does once.
 */
interface Table {
    states: NudgeState[];
    completions: Map<string, NudgeState[]>;
    views: Map<string, WallView | null>;
    heights: Map<string, number | null>;
    /** The whole grid's own zonogon, built once: it is not cheap. */
    z: Zonohedron | null;
}
const tables = new WeakMap<object, Table>();
function tableFor(dirs: readonly Vec2[]): Table {
    let t = tables.get(dirs as object);
    if (!t) {
        t = { states: [], completions: new Map(), views: new Map(),
              heights: new Map(), z: null };
        tables.set(dirs as object, t);
    }
    return t;
}

/**
 * The grid's own zonogon — every family at once — built at most once, and only
 * where building it terminates.
 *
 * `zonohedronOf` enumerates readings up to `ENUMERATE_UPTO` generators and
 * otherwise walks the flip graph, and the flip graph of a 14-gon is not
 * something to walk — which is what asking for the whole zonogon on the
 * heptagrid page would do. The factorization is about the PENTAGRID's
 * exceptional singularity, Jake's five anti-gridlines, so above the enumerable
 * range there is nothing here to say and the caller falls back to the cascade's
 * own search.
 */
function wholeZono(dirs: readonly Vec2[]): Zonohedron | null {
    if (dirs.length > ENUMERATE_UPTO) return null;
    const t = tableFor(dirs);
    if (!t.z) t.z = zonohedronOf(dirs, dirs.map((_, i) => i));
    return t.z;
}

export function nudgeStates(dirs: readonly Vec2[]): NudgeState[] {
    const t = tableFor(dirs);
    if (t.states.length) return t.states;
    const out: NudgeState[] = [];
    for (const e of sumZeroNudges(dirs.length)) {
        const s = factorNudge(dirs, e);
        if (s) out.push(s);
    }
    out.sort((a, b) =>
        BRANCHES.indexOf(a.branch) - BRANCHES.indexOf(b.branch)
        || a.axis - b.axis || b.sense - a.sense);
    t.states = out;
    return out;
}

/**
 * The state at one cell of the product, or null where the cell is empty.
 *
 * `sense` is taken as a sign; 0 is read as +1 so a boolean control can pass
 * 0 and 1 without knowing the convention.
 */
export function stateAt(
    dirs: readonly Vec2[], axis: number, sense: number, branch: Branch,
): NudgeState | null {
    const want = sense > 0 ? 1 : -1;
    return nudgeStates(dirs).find(
        (s) => s.axis === axis && s.sense === want && s.branch === branch) ?? null;
}

/**
 * Which whole resolutions lie either side of a wall — Jake's high and low.
 *
 * Jake, 2026-10-22: *"5 anti gridlines. two configs (call it direction) on
 * each and high/low/both for paths."* Measured, that is exactly the structure:
 * a wall completes to **two** readings and both are Penrose, and which two
 * depends only on (axis, sense) — every branch of the same cell gives the same
 * pair. So where the two skewbs came to rest along the spoke is a detail of
 * their placement, not a state of the tiling, and the control does not need
 * it. Jake: *"I don't see that many."* He was right.
 *
 * A completion is found the way it happens: hold the wall and add a SECOND,
 * smaller perturbation. The wall's own signs are kept, the two standing skewbs
 * are pulled apart one way or the other, and the decagon lands on a reading.
 * Over every secondary nudge there are exactly two, which is what makes high →
 * low across a wall a phason flip rather than a jump — everything but those
 * two skewbs is held.
 *
 * (A first version asked instead for whole states agreeing with the wall on
 * every triple of families, which returned one, not two. Too strong: the two
 * completions differ in the DECAGON's reading, and a different ray through the
 * same decagon reading need not match the wall anywhere else.)
 */
export function completions(
    dirs: readonly Vec2[], axis: number, sense: number,
): NudgeState[] {
    const g = sense > 0 ? 1 : -1;
    const t = tableFor(dirs);
    const ck = `${axis}|${g}`;
    const cached = t.completions.get(ck);
    if (cached) return cached;
    const states = nudgeStates(dirs);
    const wall = states.find(
        (s) => s.axis === axis && s.sense === g && s.branch === "S at center");
    if (!wall) return [];
    const z = wholeZono(dirs);
    if (!z) return [];
    const want = new Set<number>();
    for (const e2 of sumZeroNudges(dirs.length)) {
        const r = z.readingOf(wall.e.map((v, i) => v + SECOND * e2[i]));
        if (r !== null) want.add(r);
    }
    const found = states.filter((u) => {
        if (u.branch !== "whole") return false;
        const r = z.readingOf(u.e);
        return r !== null && want.has(r);
    });
    t.completions.set(ck, found);
    return found;
}

/** How far the secondary perturbation reaches: enough to resolve, not to reorder. */
const SECOND = 1e-4;

/**
 * How high a reading's surface stands: the total popcount of its base masks.
 *
 * Which is what makes `high` and `low` mean something. A reading IS a monotone
 * surface over the zonogon, and this is the sum of its corners' levels — so
 * the larger number is the upper surface. Jake: *"the top or the bottom."*
 */
export function surfaceHeight(
    dirs: readonly Vec2[], e: readonly number[],
): number | null {
    const t = tableFor(dirs);
    const hk = e.join(",");
    if (t.heights.has(hk)) return t.heights.get(hk)!;
    const got = surfaceHeightOf(dirs, e);
    t.heights.set(hk, got);
    return got;
}

function surfaceHeightOf(
    dirs: readonly Vec2[], e: readonly number[],
): number | null {
    const z = wholeZono(dirs);
    if (!z) return null;
    const r = z.readingOf(e);
    if (r === null) return null;
    let sum = 0;
    for (const m of z.readings[r]) {
        for (let b = m; b; b >>= 1) sum += b & 1;
    }
    return sum;
}

/** What the three-state path control resolves to. */
export type Paths = "high" | "low" | "both";

export interface WallView {
    axis: number;
    sense: number;
    paths: Paths;
    /** The perturbation to resolve the patch with. */
    e: readonly number[];
    /** Triples left standing: the two skewbs at `both`, nothing otherwise. */
    standing: readonly (readonly number[])[];
}

/**
 * The state one cell of Jake's control names: 5 axes x 2 senses x 3 paths.
 *
 * `high` and `low` are the wall's two completions, ordered by their own axis
 * so the pairing is stable as the control moves. `both` is the wall itself,
 * with its spoke left standing — every concurrency of those two family triples
 * across the whole patch, which is the line of singularities, not just the two
 * at the center.
 */
export function wallView(
    dirs: readonly Vec2[], axis: number, sense: number, paths: Paths,
): WallView | null {
    const t = tableFor(dirs);
    const vk = `${axis}|${sense > 0 ? 1 : -1}|${paths}`;
    if (t.views.has(vk)) return t.views.get(vk)!;
    const got = wallViewOf(dirs, axis, sense, paths);
    t.views.set(vk, got);
    return got;
}

function wallViewOf(
    dirs: readonly Vec2[], axis: number, sense: number, paths: Paths,
): WallView | null {
    if (dirs.length > ENUMERATE_UPTO) return null;
    const g = sense > 0 ? 1 : -1;
    if (paths === "both") {
        const wall = nudgeStates(dirs).find(
            (s) => s.axis === axis && s.sense === g && s.branch === "S at center");
        return wall ? { axis, sense: g, paths, e: wall.e, standing: wall.standing }
                    : null;
    }
    const two = completions(dirs, axis, g)
        .sort((a, b) => (surfaceHeight(dirs, a.e) ?? 0) - (surfaceHeight(dirs, b.e) ?? 0));
    if (two.length !== 2) return null;
    const u = two[paths === "high" ? 1 : 0];
    return { axis, sense: g, paths, e: u.e, standing: [] };
}
