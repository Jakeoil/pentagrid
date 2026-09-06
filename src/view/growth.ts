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
import { NUM_GRIDS } from "../geometry/pentagrid.js";
import { RISE, vertexIndex } from "../geometry/roof.js";
import type { Rhomb, Vec2 } from "../geometry/types.js";

export const FAMILY_COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];

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
    /** Stand the surface up into golden rhombi. Needs the camera to be visible. */
    lift?: boolean;
    /**
     * How the grid lines are drawn.
     *  "stroke" — one continuous polyline per line, thickening as it grows. Reads
     *             as the pentagrid being dragged into shape, but cannot be depth
     *             sorted, so it is the flat choice.
     *  "quads"  — the in-tile band as a filled quad per tile, with strokes only
     *             across the gaps. Sorts correctly in 3D.
     */
    ribbons?: "stroke" | "quads";
    /** Lambert shading off the true face normal, so creases read. */
    shaded?: boolean;
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
    const style = config.ribbons ?? (config.lift ? "quads" : "stroke");
    const shaded = config.shaded ?? !!config.lift;

    let handle: PentagridHandle | null = null;

    /** A tile's local (a,b), at the current grow and fold, in world space. */
    function world(r: Rhomb, dirs: readonly Vec2[], a: number, b: number): Vec3 {
        const { grow, fold } = state;
        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
        const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
        const x = (1 - grow) * 2.5 * r.x0 + grow * cx
            + grow * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]);
        const y = (1 - grow) * 2.5 * r.y0 + grow * cy
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

    /** Tiles grouped by the grid line they sit on, ordered along it. */
    function ribbonsOf(rhombs: readonly Rhomb[], dirs: readonly Vec2[]) {
        const out: { fam: number; px: number; py: number; tiles: Rhomb[] }[] = [];
        for (let fam = 0; fam < NUM_GRIDS; fam++) {
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

    const pentagrid = createPentagrid({
        container: config.container,
        gamma: config.gamma,
        steps: [],
        features: { gridLines: false, axes: false },
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
                        if (style === "quads" && band > 0.001 && grow > 0.02) {
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

                    // The grid lines, still attached. In "stroke" mode one polyline
                    // carries a whole line; in "quads" mode the in-tile part is
                    // already drawn above and only the gaps remain.
                    const gaps = style === "quads";
                    if (!gaps || grow < 0.995) {
                        ctx.lineWidth = gaps
                            ? Math.max(1, band * grow * v.scale * 0.5)
                            : Math.max(1, band * grow * v.scale);
                        ctx.lineCap = "butt";
                        ctx.lineJoin = "round";
                        for (const rib of ribbonsOf(rhombs, dirs)) {
                            ctx.strokeStyle = FAMILY_COLORS[rib.fam];
                            ctx.beginPath();
                            let started = false;
                            for (const r of rib.tiles) {
                                const pr: number[][] = r.j === rib.fam
                                    ? [[0.5, 0], [0.5, 1]] : [[0, 0.5], [1, 0.5]];
                                const w0 = world(r, dirs, pr[0][0], pr[0][1]);
                                const w1 = world(r, dirs, pr[1][0], pr[1][1]);
                                const ord = (w0[0] * rib.px + w0[1] * rib.py)
                                    <= (w1[0] * rib.px + w1[1] * rib.py) ? [w0, w1] : [w1, w0];
                                const a = S(ord[0]), b = S(ord[1]);
                                if (!started) { ctx.moveTo(a.x, a.y); started = true; }
                                else ctx.lineTo(a.x, a.y);
                                if (gaps) ctx.moveTo(b.x, b.y); else ctx.lineTo(b.x, b.y);
                            }
                            ctx.stroke();
                        }
                    }

                    // The crossing itself: the two families mixed. A dot while the
                    // tiles are still points, the centre patch once they are not.
                    if (style === "stroke") {
                        for (const r of rhombs) {
                            ctx.fillStyle = tint(MIX[r.j][r.k], 1);
                            if (grow < 0.04) {
                                const c = S(world(r, dirs, 0.5, 0.5));
                                ctx.beginPath();
                                ctx.arc(c.x, c.y, 2.5, 0, 2 * Math.PI);
                                ctx.fill();
                            } else if (band > 0.001) {
                                trace(r, [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]);
                                ctx.fill();
                            }
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
