// A pentagrid turning into its tiling, with the grid still attached.
//
// At t = 0 every tile is a point sitting on the crossing that made it, so what
// you see is the pentagrid with a coloured dot at each intersection. As t rises
// the tiles grow and slide to their dual positions — and the grid lines are not
// redrawn or faded, they are *dragged*, because each line stays fastened to the
// midpoints of the two tile edges it passes between.
//
// So a grid line is one polyline: enter tile, cross it, leave, span the gap to
// the next tile. At t = 0 every attachment point is exactly on the straight line
// (verified: deviation 0). At t = 1 each tile's exit meets the next tile's entry
// exactly (verified: gap 0.000000), and the straight line has become the
// wandering ribbon of the finished tiling.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle } from "../view/pentagrid.js";
import { NUM_GRIDS } from "../geometry/pentagrid.js";
import type { Rhomb, Vec2 } from "../geometry/types.js";

const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];

function rgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
/** The colour of a crossing: the two families mixed. */
const MIX: string[][] = COLORS.map((a) => COLORS.map((b) => {
    const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
    return `rgb(${(r1 + r2) >> 1},${(g1 + g2) >> 1},${(b1 + b2) >> 1})`;
}));

let t = 0;
// Fraction of the tile the coloured band spans. At 0.5 it is Jake's original
// 25 % white / 50 % colour / 25 % white; at 1 it fills the tile edge to edge;
// past 1 the bands overrun their tiles and the ribbons start to overlap.
let thickness = 0.5;
let handle: PentagridHandle | null = null;

const host = document.getElementById("grow-view");
const tInput = document.getElementById("grow-t") as HTMLInputElement | null;
const tOut = document.getElementById("grow-t-value");
const wInput = document.getElementById("grow-w") as HTMLInputElement | null;
const wOut = document.getElementById("grow-w-value");

// ── tile geometry at time t ───────────────────────────────────────
//
// Local (a,b) in the unit square maps to  c(t) + t·((a−½)v_j + (b−½)v_k),
// with c(t) sliding from the crossing (scaled by the registration gain) to the
// tile's final centre.

interface Frame { dirs: readonly Vec2[]; }

function local(r: Rhomb, f: Frame, a: number, b: number, tt: number): Vec2 {
    const vj = f.dirs[r.j], vk = f.dirs[r.k];
    const v0 = r.vertices[0];
    const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
    const x = (1 - tt) * 2.5 * r.x0 + tt * cx;
    const y = (1 - tt) * 2.5 * r.y0 + tt * cy;
    return [
        x + tt * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]),
        y + tt * ((a - 0.5) * vj[1] + (b - 0.5) * vk[1]),
    ];
}

/** Where grid line `fam` enters and leaves this tile: the midpoints of the two
 *  edges parallel to v_fam, ordered along the line. */
function attachments(r: Rhomb, fam: number, f: Frame, tt: number, px: number, py: number): [Vec2, Vec2] {
    const pair: [Vec2, Vec2] = fam === r.j
        ? [local(r, f, 0.5, 0, tt), local(r, f, 0.5, 1, tt)]
        : [local(r, f, 0, 0.5, tt), local(r, f, 1, 0.5, tt)];
    return (pair[0][0] * px + pair[0][1] * py) <= (pair[1][0] * px + pair[1][1] * py)
        ? pair : [pair[1], pair[0]];
}

/** Tiles grouped by the grid line they sit on, ordered along it. */
function ribbons(rhombs: readonly Rhomb[], f: Frame) {
    const out: { fam: number; px: number; py: number; tiles: Rhomb[] }[] = [];
    for (let fam = 0; fam < NUM_GRIDS; fam++) {
        const [vx, vy] = f.dirs[fam];
        const px = -vy, py = vx;
        const byLine = new Map<number, Rhomb[]>();
        for (const r of rhombs) {
            // collectRhombs emits j < k, so a family shows up as either index
            const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
            if (n === null) continue;
            const list = byLine.get(n);
            if (list) list.push(r); else byLine.set(n, [r]);
        }
        for (const tiles of byLine.values()) {
            if (tiles.length < 2) continue;
            tiles.sort((a, b) => (a.x0 * px + a.y0 * py) - (b.x0 * px + b.y0 * py));
            out.push({ fam, px, py, tiles });
        }
    }
    return out;
}

// ── the page ──────────────────────────────────────────────────────

if (host) {
    handle = createPentagrid({
        container: host,
        steps: [],
        features: { gridLines: false, axes: false },
        layers: ({ stack, model, currentRhombs, getView }) => {
            stack.add({
                id: "grow", label: "Growing tiles", z: 40, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const f: Frame = { dirs: model.directions };
                    const rhombs = currentRhombs();
                    const S = (p: Vec2): Vec2 =>
                        [cx + (p[0] - v.x) * v.scale, cy - (p[1] - v.y) * v.scale];

                    // the tiles themselves, under everything
                    if (t > 0.02) {
                        ctx.strokeStyle = "rgba(0,0,0,0.28)";
                        ctx.lineWidth = 1;
                        for (const r of rhombs) {
                            const pts = [[0, 0], [1, 0], [1, 1], [0, 1]]
                                .map(([a, b]) => S(local(r, f, a, b, t)));
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.closePath();
                            ctx.fillStyle = "#fff";
                            ctx.fill();
                            ctx.stroke();
                        }
                    }

                    // the grid lines, still attached. One stroked polyline each,
                    // thickening from a hairline to half a tile.
                    const width = Math.max(1, thickness * t * v.scale);
                    ctx.lineCap = "butt";
                    ctx.lineJoin = "round";
                    ctx.lineWidth = width;
                    for (const rib of ribbons(rhombs, f)) {
                        ctx.strokeStyle = COLORS[rib.fam];
                        ctx.beginPath();
                        let started = false;
                        for (const r of rib.tiles) {
                            const [e0, e1] = attachments(r, rib.fam, f, t, rib.px, rib.py);
                            const a = S(e0), b = S(e1);
                            if (!started) { ctx.moveTo(a[0], a[1]); started = true; }
                            else ctx.lineTo(a[0], a[1]);
                            ctx.lineTo(b[0], b[1]);
                        }
                        ctx.stroke();
                    }

                    // the crossing itself: the two colours mixed. At t = 0 this is
                    // the dot on the intersection; at t = 1 it is the tile's centre.
                    for (const r of rhombs) {
                        ctx.fillStyle = MIX[r.j][r.k];
                        if (t < 0.04) {
                            const c = S(local(r, f, 0.5, 0.5, t));
                            ctx.beginPath();
                            ctx.arc(c[0], c[1], 2.5, 0, 2 * Math.PI);
                            ctx.fill();
                        } else {
                            // the centre is where the two bands overlap, so it
                            // follows the thickness
                            const lo = 0.5 - thickness / 2, hi = 0.5 + thickness / 2;
                            const pts = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]
                                .map(([a, b]) => S(local(r, f, a, b, t)));
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                },
            });
        },
    });
}

function applyControls() {
    if (tInput) {
        t = parseFloat(tInput.value);
        if (tOut) tOut.textContent = t.toFixed(2);
    }
    if (wInput) {
        thickness = parseFloat(wInput.value);
        if (wOut) wOut.textContent = `${Math.round(thickness * 100)}%`;
    }
    handle?.redraw();
}

tInput?.addEventListener("input", applyControls);
wInput?.addEventListener("input", applyControls);
applyControls();
