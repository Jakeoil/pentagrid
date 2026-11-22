// @ts-check
// The few drawing primitives every canvas on these pages shares.
//
// Pulled out of `page.js` when the input figure became the Pentadiculum: both
// still draw graph paper and both still outline a polygon, and two copies of
// `paper()` would have drifted the first time one of them learned something.
//
// Nothing here knows about wheels, seeds or tilings. It is a pen and a sheet of
// paper.

/** @typedef {import("../../lib/wheels.js").Pt} Pt */

export const TAU = 2 * Math.PI;

/** The ink the figures are drawn in. */
export const INK = "#2a3b6b";
/** The accent: the pentagon being fed in, and its handles. */
export const HOT = "#e63946";
/** Tile edges are black and the same weight everywhere, input and output alike. */
export const EDGE_INK = "#111418";

/**
 * Square graph paper, emphasized every 4th line, then every 20th (5x4), then
 * every 100th (20x5) — and the 100s include the axes through 0, so the origin
 * always reads.
 *
 * Each level is drawn over the last, so a line that is a multiple of 20 gets the
 * 20 color and a multiple of 100 the 100 color. The emphases stay subtle: the
 * grid is there to be counted on, not looked at.
 *
 * @type {readonly (readonly [number, string])[]}
 */
export const GRID_LEVELS = [
    [1, "#dce7f6"],
    [4, "#c2d6ef"],
    [20, "#9dbde4"],
    [100, "#6f9bd4"],
];

/**
 * The lattice itself, without the sheet under it. Split out from `paper` so the
 * output canvas can wear its grid ON TOP of the tiles — which is how you see
 * whether a tile corner is on a lattice point, and underneath the tiles you
 * cannot see it at all.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} cell
 * @param {number} [alpha] drawn over tiles it wants to be a veil, not a wall
 */
export function gridLines(ctx, w, h, cx, cy, cell, alpha = 1) {
    const was = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    for (const [step, color] of GRID_LEVELS) {
        const gap = cell * step;
        if (gap < 4) continue;                  // too fine to read: leave it out
        ctx.strokeStyle = color;
        ctx.beginPath();
        // Anchored on the origin rather than on the canvas edge, so the emphasis
        // lands on multiples of the step and not wherever the pan happens to be.
        const firstX = cx - Math.ceil(cx / gap) * gap;
        const firstY = cy - Math.ceil(cy / gap) * gap;
        for (let x = firstX; x < w; x += gap) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = firstY; y < h; y += gap) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
    }
    ctx.globalAlpha = was;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} cell
 */
export function paper(ctx, w, h, cx, cy, cell) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    gridLines(ctx, w, h, cx, cy, cell);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {readonly Pt[]} pts
 * @param {number} cx
 * @param {number} cy
 * @param {number} k
 */
export const poly = (ctx, pts, cx, cy, k) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
        const x = cx + p[0] * k, y = cy + p[1] * k;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
};
