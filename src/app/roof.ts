// The Wieringa roof: the same growth, folded up.
//
// The lift costs nothing, because the height is already in the data. Give every
// vertex z = (Σ K)/2 — half its de Bruijn index — and each planar rhomb becomes
// a golden rhombus: edge √5/2, diagonals in ratio φ. Both types, the same shape.
// Verified here and agreeing with wieringa-roof's notes: the generators are
// E_j = v_j + ½ẑ, every edge rises or falls by ½, the index runs {1,2,3,4}, so
// the roof stands on four levels.
//
// In a tile's own (a,b) frame that makes z affine: z = m/2 + (a+b)/2, with m the
// base corner's index. Which is why height varies affinely along the diagonal.
//
// Rendering is Canvas 2D with a depth sort. The roof is a height field, so
// painter's algorithm is exact for the faces, and no 3D library is needed.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle } from "../view/pentagrid.js";
import { NUM_GRIDS } from "../geometry/pentagrid.js";
import { RISE, vertexIndex } from "../geometry/roof.js";
import type { Rhomb, Vec2 } from "../geometry/types.js";

const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];
type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};
const MIX: RGB[][] = COLORS.map((a) => COLORS.map((b) => {
    const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
    return [(r1 + r2) >> 1, (g1 + g2) >> 1, (b1 + b2) >> 1] as RGB;
}));
const shade = (c: RGB, k: number) =>
    `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

let t = 1, fold = 1, band = 0.5, az = 0.35, el = 0.95;
let handle: PentagridHandle | null = null;

const host = document.getElementById("roof-view");
type P3 = [number, number, number];

/** Local (a,b) of a tile, at the current grow and fold, in world space. */
function world(r: Rhomb, dirs: readonly Vec2[], a: number, b: number): P3 {
    const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
    const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
    const x = (1 - t) * 2.5 * r.x0 + t * cx + t * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]);
    const y = (1 - t) * 2.5 * r.y0 + t * cy + t * ((a - 0.5) * vj[1] + (b - 0.5) * vk[1]);
    const m = vertexIndex(r.kTuples[0]);
    return [x, y, fold * t * RISE * (m + a + b)];
}

/** Orthographic camera: spin about the vertical, then tilt. */
function project(p: P3) {
    const ca = Math.cos(az), sa = Math.sin(az);
    const xr = p[0] * ca - p[1] * sa;
    const yr = p[0] * sa + p[1] * ca;
    const ce = Math.cos(el), se = Math.sin(el);
    return { sx: xr, sy: -(yr * se + p[2] * ce), depth: yr * ce - p[2] * se };
}

if (host) {
    handle = createPentagrid({
        container: host,
        steps: [],
        features: { gridLines: false, axes: false },
        layers: ({ stack, model, currentRhombs, getView }) => {
            stack.add({
                id: "roof", label: "Roof", z: 40, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const rhombs = currentRhombs();
                    const S = (p: P3) => {
                        const q = project(p);
                        return { x: cx + (q.sx - v.x) * v.scale, y: cy + q.sy * v.scale, d: q.depth };
                    };
                    const lo = 0.5 - band / 2, hi = 0.5 + band / 2;

                    const order = rhombs
                        .map((r) => ({ r, d: S(world(r, dirs, 0.5, 0.5)).d }))
                        .sort((p, q) => q.d - p.d);   // far first

                    const face = (r: Rhomb, corners: number[][], fill: string | null) => {
                        ctx.beginPath();
                        corners.forEach(([a, b], i) => {
                            const p = S(world(r, dirs, a, b));
                            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                        });
                        ctx.closePath();
                        if (fill) { ctx.fillStyle = fill; ctx.fill(); } else ctx.stroke();
                    };

                    for (const { r } of order) {
                        const A = world(r, dirs, 0, 0);
                        const B = world(r, dirs, 1, 0);
                        const C = world(r, dirs, 0, 1);
                        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
                        const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
                        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
                        const nl = Math.hypot(n[0], n[1], n[2]) || 1;
                        const k = 0.62 + 0.38 * Math.abs((n[0] * 0.35 - n[1] * 0.30 + n[2] * 0.89) / nl);

                        face(r, [[0, 0], [1, 0], [1, 1], [0, 1]], shade([255, 255, 255], k));
                        if (band > 0.001 && t > 0.02) {
                            face(r, [[lo, 0], [hi, 0], [hi, 1], [lo, 1]], shade(rgb(COLORS[r.j]), k));
                            face(r, [[0, lo], [1, lo], [1, hi], [0, hi]], shade(rgb(COLORS[r.k]), k));
                            face(r, [[lo, lo], [hi, lo], [hi, hi], [lo, hi]], shade(MIX[r.j][r.k], k));
                        }
                        ctx.strokeStyle = `rgba(0,0,0,${(0.10 + 0.18 * k).toFixed(3)})`;
                        ctx.lineWidth = 1;
                        face(r, [[0, 0], [1, 0], [1, 1], [0, 1]], null);
                    }

                    // While the tiles are apart the ribbons span the gaps. Drawn
                    // after the faces without depth sorting: approximate at
                    // grazing angles, and moot at t = 1 where no gaps remain.
                    if (t < 0.995) {
                        ctx.lineWidth = Math.max(1, band * t * v.scale * 0.5);
                        for (let fam = 0; fam < NUM_GRIDS; fam++) {
                            const [vx, vy] = dirs[fam];
                            const px = -vy, py = vx;
                            const byLine = new Map<number, Rhomb[]>();
                            for (const r of rhombs) {
                                const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
                                if (n === null) continue;
                                const l = byLine.get(n);
                                if (l) l.push(r); else byLine.set(n, [r]);
                            }
                            ctx.strokeStyle = COLORS[fam];
                            for (const tiles of byLine.values()) {
                                if (tiles.length < 2) continue;
                                tiles.sort((a, b) => (a.x0 * px + a.y0 * py) - (b.x0 * px + b.y0 * py));
                                ctx.beginPath();
                                let started = false;
                                for (const r of tiles) {
                                    const pr: number[][] = r.j === fam
                                        ? [[0.5, 0], [0.5, 1]] : [[0, 0.5], [1, 0.5]];
                                    const w0 = world(r, dirs, pr[0][0], pr[0][1]);
                                    const w1 = world(r, dirs, pr[1][0], pr[1][1]);
                                    const ord = (w0[0] * px + w0[1] * py) <= (w1[0] * px + w1[1] * py)
                                        ? [w0, w1] : [w1, w0];
                                    for (const p of ord) {
                                        const s = S(p);
                                        if (!started) { ctx.moveTo(s.x, s.y); started = true; }
                                        else ctx.lineTo(s.x, s.y);
                                    }
                                }
                                ctx.stroke();
                            }
                        }
                    }
                },
            });
        },
    });
}

function bind(id: string, out: string, set: (v: number) => void, fmt: (v: number) => string) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    const label = document.getElementById(out);
    if (!input) return;
    const apply = () => {
        const v = parseFloat(input.value);
        set(v);
        if (label) label.textContent = fmt(v);
        handle?.redraw();
    };
    input.addEventListener("input", apply);
    apply();
}

bind("roof-t", "roof-t-value", (v) => { t = v; }, (v) => v.toFixed(2));
bind("roof-fold", "roof-fold-value", (v) => { fold = v; }, (v) => `${Math.round(v * 100)}%`);
bind("roof-band", "roof-band-value", (v) => { band = v; }, (v) => `${Math.round(v * 100)}%`);
bind("roof-az", "roof-az-value", (v) => { az = v; }, (v) => `${Math.round(v * 180 / Math.PI)}°`);
bind("roof-el", "roof-el-value", (v) => { el = v; }, (v) => `${Math.round(v * 180 / Math.PI)}°`);
