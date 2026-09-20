// A pentagrid assembling itself into its tiling, flat or folded.
//
// Both grow.html and roof.html are this one container: the same tiles growing
// out of the same crossings, with the grid lines still fastened to the edge
// midpoints they pass between. `lift` stands the surface up into golden rhombi,
// `camera` turns on the 3D projection and the depth sort. A flat top-down view
// is just lift = 0 with the camera looking straight down.
//
// It owns its canvases the way createPentagrid does — you hand it a container
// and get back a handle — because a renderer this involved should not be page
// code. See README, "Canvas containers".

import { createPentagrid } from "./pentagrid.js";
import type { PentagridHandle } from "./pentagrid.js";
import { RISE, vertexIndex } from "../geometry/roof.js";
import { resolveConcurrency } from "../geometry/resolve.js";
import type { Resolution } from "../geometry/resolve.js";
import { p1Pentagons, P1_FILL, P1_STAR } from "../geometry/clusters.js";
import { rhombPentagons, rhombDeflation, rhombKitesDarts, extremeCorner } from "../geometry/decor.js";
import { clipToConvex } from "../geometry/region.js";
import type { Concurrency, Pentagrid, Rhomb, Vec2 } from "../geometry/types.js";

// Five for the pentagrid, then two more for a heptagrid; the first five are
// unchanged so every existing page keeps its exact palette.
export const FAMILY_COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5",
                              "#e07a5f", "#3d5a80"];

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};
const MIX: RGB[][] = FAMILY_COLORS.map((a) => FAMILY_COLORS.map((b) => {
    const [r1, g1, b1] = rgbOf(a), [r2, g2, b2] = rgbOf(b);
    return [(r1 + r2) >> 1, (g1 + g2) >> 1, (b1 + b2) >> 1] as RGB;
}));
const tint = (c: RGB, k: number) =>
    `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

export type Vec3 = [number, number, number];

export interface GrowthConfig {
    container: HTMLElement;
    gamma?: readonly number[];
    /** How many line families. Five is the pentagrid, seven a heptagrid. */
    n?: number;
    /** Stand the surface up into golden rhombi. Needs the camera to be visible. */
    lift?: boolean;
    /**
     * Kept for callers that named it; there is only one mode now. The bands are
     * quads inside each tile and quads across the gaps, which is exact flat and
     * folded alike and sorts correctly in 3D.
     * @deprecated has no effect
     */
    ribbons?: "stroke" | "quads";
    /** Lambert shading off the true face normal, so creases read. */
    shaded?: boolean;
    /** Right-drag to spin and tilt. Defaults on wherever there is a lift to see. */
    orbit?: boolean;
}

export interface GrowthState {
    /** 0 = points on their crossings, 1 = the finished tiling. */
    grow: number;
    /** 0 = flat, 1 = the full Wieringa roof. */
    fold: number;
    /** Band width as a fraction of the tile, 0..1. The sliders stop at 1: past
     *  it the ribbons overlap, which looks wrong rather than interesting. */
    band: number;
    /** Camera spin about the vertical, radians. */
    azimuth: number;
    /** Camera tilt from the horizon, radians. π/2 looks straight down. */
    elevation: number;
    /** Draw tile edges as real lines rather than the default hairline ghost. */
    boldEdges: boolean;
    /**
     * Paint the P1 tiling on the tiles: blue, with each pentagon clipped to the
     * tiles it reaches. The pieces are carried in the tile's own (a, b)
     * coordinates, so they fold with it on the roof and grow with it on the
     * flat — a pentagon that spans three tiles creases along their edges.
     */
    p1: boolean;
    /**
     * Paint the P1 tiling at the big-rhomb scale instead — the `pentagons` tile
     * style: a whole Pe3 in every thick, the Pe1 straddling edges, blue
     * elsewhere. Per tile by construction (rhombPentagons), so the pieces are
     * clipped to the tile and carried in its (a, b) frame like P1's.
     */
    penta: boolean;
    /**
     * Paint the next generation — the `nextgen` tile style: each tile cut into
     * the deflated tiling's pieces at 1/φ, thick gold and thin gray, with the
     * next generation's edges as hairlines. Per tile by construction, so the
     * pieces ride the tile's (a, b) frame and fold with it on the roof.
     */
    nextgen: boolean;
    /** Paint P2 — the `kites` tile style: kites light, a dart in every thick,
     *  P2's edges as hairlines — per tile, in the tile's (a, b) frame. */
    kites: boolean;
    /** Draw penta, next-gen and kites off a Penrose patch too — the tiles at the
     *  top or bottom index level; the middle ones stay bare. */
    offPenrose: boolean;
    /**
     * Outline the 2k-gon each stack of tiles is growing into.
     *
     * A concurrency's C(k,2) rhombs all start on the same crossing, so at grow = 0
     * they are superposed and a stack is indistinguishable from a single tile.
     * The outline is the space they are heading for, and it grows by the same law
     * they do — so you can watch them separate and fill it.
     */
    showResolutions: boolean;
}

export interface GrowthHandle {
    set: (patch: Partial<GrowthState>) => void;
    get: () => GrowthState;
    redraw: () => void;
    /** The pentagrid underneath, for pan/zoom, γ and the layer stack. */
    pentagrid: PentagridHandle;
}

/** The next-gen palette, shared with the tile style. */
const NEXTGEN_THICK: [number, number, number] = [247, 208, 88];
const NEXTGEN_THIN: [number, number, number] = [182, 182, 182];
const KITE: [number, number, number] = [223, 233, 243];
const DART: [number, number, number] = [143, 168, 194];

const DEFAULTS: GrowthState = {
    grow: 0, fold: 0, band: 0.5, azimuth: 0, elevation: Math.PI / 2,
    showResolutions: false, p1: false, penta: false, nextgen: false, kites: false,
    offPenrose: false,
    boldEdges: false,
};

/**
 * The same world-to-screen mapping the renderer uses, exposed so it can be
 * checked without a canvas. Pan is applied in screen space; with elevation π/2
 * and azimuth 0 this is exactly the pentagrid's mathToScreen.
 */
export function projectToScreen(
    state: Pick<GrowthState, "azimuth" | "elevation">,
    p: Vec3,
    view: { scale: number; x: number; y: number },
    cx: number,
    cy: number,
) {
    const ca = Math.cos(state.azimuth), sa = Math.sin(state.azimuth);
    const xr = p[0] * ca - p[1] * sa;
    const yr = p[0] * sa + p[1] * ca;
    const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
    const sx = xr, sy = -(yr * se + p[2] * ce);
    return {
        x: cx + (sx - view.x) * view.scale,
        y: cy + (sy + view.y) * view.scale,
        depth: yr * ce - p[2] * se,
    };
}

export function createGrowthView(config: GrowthConfig): GrowthHandle {
    const state: GrowthState = { ...DEFAULTS };
    if (config.lift) { state.fold = 1; state.grow = 1; state.elevation = 0.95; state.azimuth = 0.35; }
    const shaded = config.shaded ?? !!config.lift;

    let handle: PentagridHandle | null = null;

    /** A tile's local (a,b), at the current grow and fold, in world space. */
    function world(r: Rhomb, dirs: readonly Vec2[], a: number, b: number): Vec3 {
        const { grow, fold } = state;
        // The registration gain, so a tile at grow = 0 sits on the crossing that
        // made it. It is n/2 because Sum_j v_j v_j^T = (n/2)I — 5/2 here for the
        // pentagrid, 7/2 for a heptagrid — and dirs already knows n.
        const gain = dirs.length / 2;
        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
        const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
        const x = (1 - grow) * gain * r.x0 + grow * cx
            + grow * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]);
        const y = (1 - grow) * gain * r.y0 + grow * cy
            + grow * ((a - 0.5) * vj[1] + (b - 0.5) * vk[1]);
        const m = vertexIndex(r.kTuples[0]);
        return [x, y, fold * grow * RISE * (m + a + b)];
    }

    /**
     * The concurrencies, read off the tiles themselves.
     *
     * Not scanned for: a stack IS a set of rhombs sharing a crossing, so grouping
     * what is being drawn cannot disagree with what is being drawn. Two rhombs on
     * a point is a pair of lines crossing twice over, which is nothing; three is
     * the first real concurrency.
     */
    function stacksOf(rhombs: readonly Rhomb[]): Concurrency[] {
        const byPoint = new Map<string, Rhomb[]>();
        for (const r of rhombs) {
            const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
            const at = byPoint.get(key);
            if (at) at.push(r); else byPoint.set(key, [r]);
        }
        const out: Concurrency[] = [];
        for (const group of byPoint.values()) {
            if (group.length < 2) continue;
            const fams = new Set<number>();
            for (const r of group) { fams.add(r.j); fams.add(r.k); }
            if (fams.size < 3) continue;
            const families = [...fams].sort((a, b) => a - b);
            out.push({ x: group[0].x0, y: group[0].y0, lines: families.length, families });
        }
        return out;
    }

    /**
     * A 2k-gon corner, growing by the same law its tiles do.
     *
     * At grow = 0 every corner sits on the crossing, scaled by the registration
     * gain — the same point the stack's tiles start from — so the polygon opens
     * out of the dot rather than appearing around it.
     */
    function outlineAt(
        c: Concurrency, K: readonly number[], p: Vec2, dirs: readonly Vec2[],
    ): Vec3 {
        const { grow, fold } = state;
        const gain = dirs.length / 2;
        return [
            (1 - grow) * gain * c.x + grow * p[0],
            (1 - grow) * gain * c.y + grow * p[1],
            fold * grow * RISE * vertexIndex(K),
        ];
    }

    /**
     * World point to screen.
     *
     * The pan is applied AFTER projection, in screen space, so a drag moves the
     * picture 1:1 whatever the camera is doing. Applying it in world space would
     * foreshorten a vertical drag under tilt and send it off at an angle under
     * spin. With the camera looking straight down and unspun this reduces exactly
     * to the pentagrid's own mathToScreen.
     */
    function toScreen(p: Vec3, v: { scale: number; x: number; y: number }, cx: number, cy: number) {
        const q = project(p);
        return {
            x: cx + (q.sx - v.x) * v.scale,
            y: cy + (q.sy + v.y) * v.scale,
            d: q.depth,
        };
    }

    /** Orthographic: spin about the vertical, then tilt. */
    function project(p: Vec3) {
        const ca = Math.cos(state.azimuth), sa = Math.sin(state.azimuth);
        const xr = p[0] * ca - p[1] * sa;
        const yr = p[0] * sa + p[1] * ca;
        const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
        return { sx: xr, sy: -(yr * se + p[2] * ce), depth: yr * ce - p[2] * se };
    }

    /**
     * Where a family's ribbon meets one edge of a tile, at full size — used to
     * decide whether two tiles are really edge-adjacent. Sorting a ribbon by
     * position along its line gives consecutive tiles, but consecutive is not
     * adjacent: collectRhombs culls tiles at the edge of the patch, so a pair can
     * straddle a missing one. Their final attachment points then differ, and a
     * gap quad drawn between them spans the hole instead of sealing a seam.
     */
    function finalSeam(r: Rhomb, fam: number, dirs: readonly Vec2[], rib: { px: number; py: number }) {
        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
        const at = (a: number, b: number): Vec2 =>
            [v0[0] + a * vj[0] + b * vk[0], v0[1] + a * vj[1] + b * vk[1]];
        const pair = fam === r.j ? [at(0.5, 0), at(0.5, 1)] : [at(0, 0.5), at(1, 0.5)];
        const proj = (p: Vec2) => p[0] * rib.px + p[1] * rib.py;
        return proj(pair[0]) <= proj(pair[1])
            ? { entry: pair[0], exit: pair[1] }
            : { entry: pair[1], exit: pair[0] };
    }

    /**
     * The two corners of a family's band where it meets one edge of a tile —
     * the leaving edge if `exit`, the entering one otherwise. Ordered along the
     * grid line so consecutive tiles pair corner-to-corner without crossing.
     */
    function bandEdge(
        r: Rhomb, fam: number, dirs: readonly Vec2[], lo: number, hi: number,
        rib: { px: number; py: number }, exit: boolean,
    ): [Vec3, Vec3] {
        const along = fam === r.j
            ? ([[lo, 0], [hi, 0]] as const)      // the b = 0 edge
            : ([[0, lo], [0, hi]] as const);     // the a = 0 edge
        const far = fam === r.j
            ? ([[lo, 1], [hi, 1]] as const)
            : ([[1, lo], [1, hi]] as const);
        const near = along.map(([a, b]) => world(r, dirs, a, b)) as [Vec3, Vec3];
        const away = far.map(([a, b]) => world(r, dirs, a, b)) as [Vec3, Vec3];
        const proj = (p: Vec3) => p[0] * rib.px + p[1] * rib.py;
        // which of the two edges is downstream along the line
        const pair = (proj(near[0]) + proj(near[1]) <= proj(away[0]) + proj(away[1]))
            ? (exit ? away : near)
            : (exit ? near : away);
        // and order the two corners consistently across the gap
        const dj = dirs[fam];
        return (pair[0][0] * dj[0] + pair[0][1] * dj[1])
            <= (pair[1][0] * dj[0] + pair[1][1] * dj[1]) ? pair : [pair[1], pair[0]];
    }

    /**
     * A concurrency, as one node on a ribbon.
     *
     * The k-1 tiles a family makes at a stack are superposed, not laid out, so
     * routing the band through them tile by tile zigzags and the seam checks
     * fail — the band stopped dead at every 2k-gon. But the family's ZONE across
     * the 2k-gon is well defined whatever tiling you imagine inside: it enters
     * through the side parallel to v_fam and leaves through the opposite one, the
     * parallel face. So the stack is one node with those two sides as its entry
     * and exit, and the band runs straight across. Nothing inside is asserted.
     */
    interface StackNode {
        kind: "stack"; c: Concurrency; res: Resolution;
        /** This family's superposed tiles on the stack — the pseudo edges. */
        tiles: Rhomb[];
    }
    interface TileNode { kind: "tile"; r: Rhomb; }
    type RibbonNode = TileNode | StackNode;

    /**
     * The two sides of a 2k-gon that carry a family's direction, each as its two
     * corners (with their K-tuples, for height), ordered along +v_fam so the
     * band's lo/hi corners pair up across a gap without crossing.
     */
    function stackSides(res: Resolution, fam: number, dirs: readonly Vec2[]) {
        const [vx, vy] = dirs[fam];
        const n = res.outline.length;
        const sides: { a: Vec2; b: Vec2; Ka: number[]; Kb: number[] }[] = [];
        for (let i = 0; i < n; i++) {
            const p = res.outline[i], q = res.outline[(i + 1) % n];
            const ex = q[0] - p[0], ey = q[1] - p[1];
            const along = Math.hypot(ex - vx, ey - vy) < 1e-6;
            const against = Math.hypot(ex + vx, ey + vy) < 1e-6;
            if (!along && !against) continue;
            sides.push(along
                ? { a: p, b: q, Ka: res.outlineK[i], Kb: res.outlineK[(i + 1) % n] }
                : { a: q, b: p, Ka: res.outlineK[(i + 1) % n], Kb: res.outlineK[i] });
        }
        return sides;   // two of them, for any family that meets here
    }

    /** The stack's seam points at full size: the midpoints of its two faces. */
    function stackSeam(node: StackNode, fam: number, dirs: readonly Vec2[],
                       rib: { px: number; py: number }) {
        const [s0, s1] = stackSides(node.res, fam, dirs);
        const mid = (sd: { a: Vec2; b: Vec2 }): Vec2 =>
            [(sd.a[0] + sd.b[0]) / 2, (sd.a[1] + sd.b[1]) / 2];
        const m0 = mid(s0), m1 = mid(s1);
        const proj = (p: Vec2) => p[0] * rib.px + p[1] * rib.py;
        return proj(m0) <= proj(m1) ? { entry: m0, exit: m1 } : { entry: m1, exit: m0 };
    }

    /** The band's two corners on one face of the stack, at the current grow. */
    function stackBandEdge(node: StackNode, fam: number, dirs: readonly Vec2[],
                           lo: number, hi: number, rib: { px: number; py: number },
                           exit: boolean): [Vec3, Vec3] {
        const [s0, s1] = stackSides(node.res, fam, dirs);
        const proj = (sd: { a: Vec2; b: Vec2 }) =>
            (sd.a[0] + sd.b[0]) * rib.px + (sd.a[1] + sd.b[1]) * rib.py;
        const near = proj(s0) <= proj(s1) ? s0 : s1;
        const far = near === s0 ? s1 : s0;
        const sd = exit ? far : near;
        // Linear along the side, so the grown corners interpolate exactly.
        const A = outlineAt(node.c, sd.Ka, sd.a, dirs);
        const B = outlineAt(node.c, sd.Kb, sd.b, dirs);
        const at = (f: number): Vec3 =>
            [A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1]), A[2] + f * (B[2] - A[2])];
        return [at(lo), at(hi)];
    }

    /**
     * The band's path THROUGH a stack, as a chain of parallel edges.
     *
     * Jake: use the pseudo edges. The family's superposed tiles each carry two
     * edges parallel to v_fam — the pseudo edges — and the tile loop has already
     * painted the band inside each of them. What links them is this: the entry
     * face, then every pseudo edge in order across the 2k-gon, then the exit
     * face, each a band-width slice of a unit edge. Consecutive pairs are sealed
     * with a quad, so the band visibly steps across on the pseudo structure
     * instead of leaping the polygon in one piece. Duplicates — the spoke every
     * tile shares — are folded to one.
     */
    function stackChain(node: StackNode, fam: number, dirs: readonly Vec2[],
                        lo: number, hi: number, rib: { px: number; py: number }): [Vec3, Vec3][] {
        const edges: { at: number; e: [Vec3, Vec3] }[] = [];
        const along = (e: [Vec3, Vec3]) =>
            ((e[0][0] + e[1][0]) / 2) * rib.px + ((e[0][1] + e[1][1]) / 2) * rib.py;
        const push = (e: [Vec3, Vec3]) => {
            const at = along(e);
            if (edges.some((x) => Math.abs(x.at - at) < 1e-6)) return;
            edges.push({ at, e });
        };
        push(stackBandEdge(node, fam, dirs, lo, hi, rib, false));
        push(stackBandEdge(node, fam, dirs, lo, hi, rib, true));
        for (const r of node.tiles) {
            push(bandEdge(r, fam, dirs, lo, hi, rib, false));
            push(bandEdge(r, fam, dirs, lo, hi, rib, true));
        }
        edges.sort((a, b) => a.at - b.at);
        return edges.map((x) => x.e);
    }

    /** Seam and band edge for either kind of node. */
    function nodeSeam(nd: RibbonNode, fam: number, dirs: readonly Vec2[],
                      rib: { px: number; py: number }) {
        return nd.kind === "tile" ? finalSeam(nd.r, fam, dirs, rib) : stackSeam(nd, fam, dirs, rib);
    }
    function nodeBandEdge(nd: RibbonNode, fam: number, dirs: readonly Vec2[],
                          lo: number, hi: number, rib: { px: number; py: number },
                          exit: boolean): [Vec3, Vec3] {
        return nd.kind === "tile"
            ? bandEdge(nd.r, fam, dirs, lo, hi, rib, exit)
            : stackBandEdge(nd, fam, dirs, lo, hi, rib, exit);
    }

    /** Ribbons as nodes: tiles, with each stack collapsed to one node. */
    function ribbonsOf(pg: Pentagrid, rhombs: readonly Rhomb[], dirs: readonly Vec2[]) {
        const out: { fam: number; px: number; py: number; nodes: RibbonNode[] }[] = [];
        // Every concurrency in the patch, keyed by its crossing, resolved once.
        const resolved = new Map<string, { c: Concurrency; res: Resolution }>();
        for (const c of stacksOf(rhombs)) {
            const res = resolveConcurrency(pg, c);
            if (res) resolved.set(`${c.x.toFixed(6)},${c.y.toFixed(6)}`, { c, res });
        }
        for (let fam = 0; fam < dirs.length; fam++) {
            // One node per stack per family, carrying that family's tiles there.
            const stacks = new Map<string, StackNode>();
            for (const r of rhombs) {
                if (r.j !== fam && r.k !== fam) continue;
                const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
                const rs = resolved.get(key);
                if (!rs) continue;
                const st = stacks.get(key) ?? { kind: "stack" as const, ...rs, tiles: [] };
                if (!stacks.has(key)) stacks.set(key, st);
                st.tiles.push(r);
            }
            const [vx, vy] = dirs[fam];
            const px = -vy, py = vx;
            const byLine = new Map<number, RibbonNode[]>();
            const seen = new Set<string>();
            for (const r of rhombs) {
                // collectRhombs emits j < k, so a family shows up as either index
                const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
                if (n === null) continue;
                const l = byLine.get(n) ?? [];
                if (!byLine.has(n)) byLine.set(n, l);
                // A tile on a stack is the stack, once, however many of the
                // family's tiles are superposed there.
                const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
                const st = stacks.get(key);
                if (st) {
                    const once = `${n}|${key}`;
                    if (!seen.has(once)) { seen.add(once); l.push(st); }
                } else {
                    l.push({ kind: "tile", r });
                }
            }
            for (const nodes of byLine.values()) {
                if (nodes.length < 2) continue;
                // Order along the line by where each node ENDS UP: a tile by its
                // final center, a stack by the 2k-gon's. Ordering by the crossing
                // x0 tied inside a stack and came out arbitrary.
                const key = (nd: RibbonNode) => {
                    if (nd.kind === "stack") return nd.res.x * px + nd.res.y * py;
                    const r = nd.r, vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
                    return (v0[0] + (vj[0] + vk[0]) / 2) * px
                        + (v0[1] + (vj[1] + vk[1]) / 2) * py;
                };
                nodes.sort((a, b) => key(a) - key(b));
                out.push({ fam, px, py, nodes });
            }
        }
        return out;
    }

    // Radians per pixel. A drag across a 700px view turns about a half turn,
    // which is enough to get round the roof without being twitchy.
    const SPIN_PER_PX = 0.008;
    const TILT_PER_PX = 0.006;
    const orbit = config.orbit ?? !!config.lift;

    const pentagrid = createPentagrid({
        container: config.container,
        gamma: config.gamma,
        n: config.n,
        features: { gridLines: false, axes: false },
        // What fills the canvas under a camera is not what fills it flat. Tilting
        // squashes world-y onto the screen by sin(elevation), so the same rect
        // covers less and less of the picture as the roof lies back; spinning
        // turns the region. Undo both, then take the axis-aligned bound.
        collectRect: (base) => {
            const { azimuth: az, elevation: el, fold, grow } = state;
            const se = Math.max(Math.sin(el), 0.08);
            const ce = Math.cos(el);
            const hw = (base.xMax - base.xMin) / 2;
            const hh = (base.yMax - base.yMin) / 2;
            const cx = (base.xMin + base.xMax) / 2;
            const cy = (base.yMin + base.yMax) / 2;
            // the roof's own relief lifts the far side up the screen
            const zMax = fold * grow * RISE * 6;
            // screen extents, back through the tilt
            const xr = hw;
            const yr = (hh + zMax * ce) / se;
            // and back through the spin: the rotated box's own bound
            const ca = Math.cos(az), sa = Math.sin(az);
            const bx = Math.abs(xr * ca) + Math.abs(yr * sa);
            const by = Math.abs(xr * sa) + Math.abs(yr * ca);
            // A grazing view wants an unbounded region; cap it, and accept that
            // the far edge thins out rather than paying for the whole plane.
            const capX = Math.min(bx, hw * 6);
            const capY = Math.min(by, hh * 6);
            return {
                xMin: cx - capX, xMax: cx + capX,
                yMin: cy - capY, yMax: cy + capY,
            };
        },
        onOrbit: orbit ? (dx, dy) => {
            state.azimuth += dx * SPIN_PER_PX;
            // Drag down to drop toward the horizon, up to rise overhead. Clamped
            // short of both, since edge-on is a line and straight down is flat.
            state.elevation = Math.max(0.05, Math.min(Math.PI / 2,
                state.elevation - dy * TILT_PER_PX));
            handle!.redraw();
        } : undefined,
        layers: ({ stack, model, currentRhombs, getView }) => {
            stack.add({
                // Over the tiles: it is the space they are growing into, so it has
                // to stay legible once they fill it.
                id: "resolutions", label: "2k-gons", z: 41, group: "Exploration",
                visible: () => state.showResolutions,
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    for (const c of stacksOf(currentRhombs())) {
                        const r = resolveConcurrency(model as Pentagrid, c);
                        if (!r) continue;
                        ctx.beginPath();
                        r.outline.forEach((p, i) => {
                            const q = S(outlineAt(c, r.outlineK[i], p, dirs));
                            if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
                        });
                        ctx.closePath();
                        ctx.fillStyle = "rgba(230, 57, 70, 0.10)";
                        ctx.fill();
                        ctx.strokeStyle = "rgba(230, 57, 70, 0.85)";
                        ctx.lineWidth = 1.4;
                        ctx.stroke();
                    }
                },
            });
            stack.add({
                id: "growth", label: "Growth", z: 40, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const rhombs = currentRhombs();
                    const { grow, band } = state;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    const lo = 0.5 - band / 2, hi = 0.5 + band / 2;

                    const order = rhombs
                        .map((r) => ({ r, d: S(world(r, dirs, 0.5, 0.5)).d }))
                        .sort((p, q) => q.d - p.d);   // far first

                    const trace = (r: Rhomb, corners: number[][]) => {
                        ctx.beginPath();
                        corners.forEach(([a, b], i) => {
                            const p = S(world(r, dirs, a, b));
                            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                        });
                        ctx.closePath();
                    };
                    const BODY = [[0, 0], [1, 0], [1, 1], [0, 1]];

                    // The P1 pentagons, once per draw. A piece is mapped into the
                    // tile's (a, b) frame by solving p = v0 + a*vj + b*vk, and
                    // `world` then puts it where the tile is, lifted or not.
                    const pents = state.p1 ? p1Pentagons(rhombs, dirs) : [];
                    let idxLo = Infinity, idxHi = -Infinity;
                    if (state.penta || state.nextgen || state.kites) {
                        for (const r of rhombs) for (const K of r.kTuples) {
                            let m = 0;
                            for (const k of K) m += k;
                            if (m < idxLo) idxLo = m;
                            if (m > idxHi) idxHi = m;
                        }
                    }
                    const levels = idxHi - idxLo + 1;
                    const placeable = levels === 4 || (levels === 5 && state.offPenrose);
                    // One reading on a tile with an extreme corner; both, at half
                    // strength, on an ambiguous one off Penrose (the view's rule).
                    const readings = (r: Rhomb): { extAt: 0 | 2; alpha: number }[] => {
                        const e = extremeCorner(r, idxLo, levels);
                        if (e !== null) return [{ extAt: e, alpha: 1 }];
                        const m = r.kTuples[0].reduce((a, b) => a + b, 0) - idxLo + 1;
                        if (m < 1 || m + 2 > levels) return [];
                        return [{ extAt: 0, alpha: 0.5 }, { extAt: 2, alpha: 0.5 }];
                    };
                    const pentaOn = state.penta && placeable;
                    const nextOn = state.nextgen && placeable;
                    const kitesOn = state.kites && placeable;
                    const toLocal = (r: Rhomb, p: Vec2): [number, number] => {
                        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
                        const det = vj[0] * vk[1] - vj[1] * vk[0];
                        const x = p[0] - v0[0], y = p[1] - v0[1];
                        return [(x * vk[1] - y * vk[0]) / det, (vj[0] * y - vj[1] * x) / det];
                    };

                    for (const { r } of order) {
                        let k = 1;
                        if (shaded) {
                            const A = world(r, dirs, 0, 0);
                            const B = world(r, dirs, 1, 0);
                            const C = world(r, dirs, 0, 1);
                            const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
                            const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
                            const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2],
                                       u[0] * w[1] - u[1] * w[0]];
                            const nl = Math.hypot(n[0], n[1], n[2]) || 1;
                            k = 0.62 + 0.38 * Math.abs((n[0] * 0.35 - n[1] * 0.30 + n[2] * 0.89) / nl);
                        }
                        if (grow > 0.02) {
                            trace(r, BODY);
                            ctx.fillStyle = tint(
                                kitesOn ? KITE : nextOn ? NEXTGEN_THICK
                                    : state.p1 || pentaOn ? rgbOf(P1_STAR) : [255, 255, 255], k);
                            ctx.fill();
                            if (kitesOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const d = rhombKitesDarts(r, idxLo, levels, extAt);
                                for (const poly of d.darts) {
                                    trace(r, poly.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(DART, k);
                                    ctx.fill();
                                }
                                ctx.strokeStyle = shaded
                                    ? `rgba(0,0,0,${(0.30 + 0.30 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.55)";
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                for (const [a, b] of d.edges) {
                                    const [pa, pb] = [a, b].map((p) => toLocal(r, p)).map(([x, y]) => S(world(r, dirs, x, y)));
                                    ctx.moveTo(pa.x, pa.y);
                                    ctx.lineTo(pb.x, pb.y);
                                }
                                ctx.stroke();
                                ctx.globalAlpha = 1;
                            }
                            if (nextOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const d = rhombDeflation(r, idxLo, levels, extAt);
                                for (const poly of d.gray) {
                                    trace(r, poly.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(NEXTGEN_THIN, k);
                                    ctx.fill();
                                }
                                ctx.strokeStyle = shaded
                                    ? `rgba(0,0,0,${(0.30 + 0.30 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.55)";
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                for (const [a, b] of d.edges) {
                                    const [pa, pb] = [a, b].map((p) => toLocal(r, p)).map(([x, y]) => S(world(r, dirs, x, y)));
                                    ctx.moveTo(pa.x, pa.y);
                                    ctx.lineTo(pb.x, pb.y);
                                }
                                ctx.stroke();
                                ctx.globalAlpha = 1;
                            }
                            if (pentaOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const parts = rhombPentagons(r, idxLo, levels, extAt);
                                const pieces: [number[][], string][] = parts.orange.map(
                                    (o) => [o, P1_FILL.Pe1] as [number[][], string]);
                                if (parts.yellow) pieces.push([parts.yellow, P1_FILL.Pe3]);
                                for (const [poly, fill] of pieces) {
                                    const piece = clipToConvex(poly as Vec2[], r.vertices);
                                    if (piece.length < 3) continue;
                                    trace(r, piece.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(rgbOf(fill), k);
                                    ctx.fill();
                                }
                                ctx.globalAlpha = 1;
                            }
                            if (state.p1) {
                                const mx = (r.vertices[0][0] + r.vertices[2][0]) / 2;
                                const my = (r.vertices[0][1] + r.vertices[2][1]) / 2;
                                for (const pent of pents) {
                                    if (Math.hypot(pent.x - mx, pent.y - my) > 2) continue;
                                    const piece = clipToConvex(pent.verts, r.vertices);
                                    if (piece.length < 3) continue;
                                    trace(r, piece.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(rgbOf(P1_FILL[pent.kind]), k);
                                    ctx.fill();
                                }
                            }
                        }
                        if (band > 0.001 && grow > 0.02) {
                            trace(r, [[lo, 0], [hi, 0], [hi, 1], [lo, 1]]);
                            ctx.fillStyle = tint(rgbOf(FAMILY_COLORS[r.j]), k);
                            ctx.fill();
                            trace(r, [[0, lo], [1, lo], [1, hi], [0, hi]]);
                            ctx.fillStyle = tint(rgbOf(FAMILY_COLORS[r.k]), k);
                            ctx.fill();
                            trace(r, [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]);
                            ctx.fillStyle = tint(MIX[r.j][r.k], k);
                            ctx.fill();
                        }
                        if (grow > 0.02) {
                            // Bold still tracks the shading, so creases keep
                            // reading on the roof; it just stops being a ghost.
                            ctx.strokeStyle = state.boldEdges
                                ? (shaded
                                    ? `rgba(0,0,0,${(0.55 + 0.35 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.85)")
                                : (shaded
                                    ? `rgba(0,0,0,${(0.10 + 0.18 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.28)");
                            ctx.lineWidth = state.boldEdges
                                ? Math.max(1.6, Math.min(4, v.scale * 0.03))
                                : 1;
                            trace(r, BODY);
                            ctx.stroke();
                        }
                    }

                    // The grid lines, still attached. Each tile's band is
                    // already drawn above; what remains is the gap to the next
                    // tile, and that is a quad rather than a stroke.
                    //
                    // A stroke cannot be right: the in-tile band spans `band`
                    // ALONG v_j, so its perpendicular width is band·sinθ — 0.951
                    // on a thick tile, 0.588 on a thin one. No constant width
                    // matches both. Joining the two bands' own corner points
                    // does, exactly, and it collapses to nothing at grow = 1.
                    if (grow > 0.02 && band > 0.001) {
                        const quad = (p: [Vec3, Vec3], q: [Vec3, Vec3]) => {
                            const c = [p[0], p[1], q[1], q[0]].map(S);
                            ctx.beginPath();
                            ctx.moveTo(c[0].x, c[0].y);
                            for (let n = 1; n < 4; n++) ctx.lineTo(c[n].x, c[n].y);
                            ctx.closePath();
                            ctx.fill();
                        };
                        for (const rib of ribbonsOf(model as Pentagrid, rhombs, dirs)) {
                            ctx.fillStyle = FAMILY_COLORS[rib.fam];
                            for (let i = 0; i < rib.nodes.length; i++) {
                                const nd = rib.nodes[i];
                                // Through a stack: entry face to exit face, the
                                // whole way, at every grow — this is the band's
                                // path across the 2k-gon and it does not close
                                // up at grow = 1 the way a gap does.
                                if (nd.kind === "stack") {
                                    const chain = stackChain(nd, rib.fam, dirs, lo, hi, rib);
                                    for (let m = 1; m < chain.length; m++) quad(chain[m - 1], chain[m]);
                                }
                                if (i === 0 || grow >= 0.999) continue;
                                const a = nodeSeam(rib.nodes[i - 1], rib.fam, dirs, rib);
                                const b = nodeSeam(nd, rib.fam, dirs, rib);
                                // only seal a seam these two actually share
                                if (Math.hypot(a.exit[0] - b.entry[0], a.exit[1] - b.entry[1]) > 1e-6) continue;
                                quad(nodeBandEdge(rib.nodes[i - 1], rib.fam, dirs, lo, hi, rib, true),
                                     nodeBandEdge(nd, rib.fam, dirs, lo, hi, rib, false));
                            }
                        }
                    }

                    // The crossing itself: the two families mixed. A dot while
                    // the tiles are still points, the center patch once they are not.
                    for (const r of rhombs) {
                        if (grow < 0.04) {
                            ctx.fillStyle = tint(MIX[r.j][r.k], 1);
                            const c = S(world(r, dirs, 0.5, 0.5));
                            ctx.beginPath();
                            ctx.arc(c.x, c.y, 2.5, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                },
            });
        },
    });
    handle = pentagrid;

    return {
        set: (patch) => { Object.assign(state, patch); handle!.redraw(); },
        get: () => ({ ...state }),
        redraw: () => handle!.redraw(),
        pentagrid,
    };
}
