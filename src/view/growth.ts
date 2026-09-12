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
import type { Rhomb, Vec2 } from "../geometry/types.js";

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
    /** Band width as a fraction of the tile. Past 1 the ribbons overlap. */
    band: number;
    /** Camera spin about the vertical, radians. */
    azimuth: number;
    /** Camera tilt from the horizon, radians. π/2 looks straight down. */
    elevation: number;
    /** Draw tile edges as real lines rather than the default hairline ghost. */
    boldEdges: boolean;
}

export interface GrowthHandle {
    set: (patch: Partial<GrowthState>) => void;
    get: () => GrowthState;
    redraw: () => void;
    /** The pentagrid underneath, for pan/zoom, γ and the layer stack. */
    pentagrid: PentagridHandle;
}

const DEFAULTS: GrowthState = {
    grow: 0, fold: 0, band: 0.5, azimuth: 0, elevation: Math.PI / 2,
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

    /** Tiles grouped by the grid line they sit on, ordered along it. */
    function ribbonsOf(rhombs: readonly Rhomb[], dirs: readonly Vec2[]) {
        const out: { fam: number; px: number; py: number; tiles: Rhomb[] }[] = [];
        for (let fam = 0; fam < dirs.length; fam++) {
            const [vx, vy] = dirs[fam];
            const px = -vy, py = vx;
            const byLine = new Map<number, Rhomb[]>();
            for (const r of rhombs) {
                // collectRhombs emits j < k, so a family shows up as either index
                const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
                if (n === null) continue;
                const l = byLine.get(n);
                if (l) l.push(r); else byLine.set(n, [r]);
            }
            for (const tiles of byLine.values()) {
                if (tiles.length < 2) continue;
                tiles.sort((a, b) => (a.x0 * px + a.y0 * py) - (b.x0 * px + b.y0 * py));
                out.push({ fam, px, py, tiles });
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
                            ctx.fillStyle = tint([255, 255, 255], k);
                            ctx.fill();
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
                    if (grow > 0.02 && band > 0.001 && grow < 0.999) {
                        for (const rib of ribbonsOf(rhombs, dirs)) {
                            ctx.fillStyle = FAMILY_COLORS[rib.fam];
                            for (let i = 1; i < rib.tiles.length; i++) {
                                const a = finalSeam(rib.tiles[i - 1], rib.fam, dirs, rib);
                                const b = finalSeam(rib.tiles[i], rib.fam, dirs, rib);
                                // only seal a seam these two actually share
                                if (Math.hypot(a.exit[0] - b.entry[0], a.exit[1] - b.entry[1]) > 1e-6) continue;
                                const prev = bandEdge(rib.tiles[i - 1], rib.fam, dirs, lo, hi, rib, true);
                                const next = bandEdge(rib.tiles[i], rib.fam, dirs, lo, hi, rib, false);
                                const q = [prev[0], prev[1], next[1], next[0]].map(S);
                                ctx.beginPath();
                                ctx.moveTo(q[0].x, q[0].y);
                                for (let n = 1; n < 4; n++) ctx.lineTo(q[n].x, q[n].y);
                                ctx.closePath();
                                ctx.fill();
                            }
                        }
                    }

                    // The crossing itself: the two families mixed. A dot while
                    // the tiles are still points, the centre patch once they are not.
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
