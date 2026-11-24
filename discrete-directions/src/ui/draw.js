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
 * Each level is `[step, color, width]`. Under the figure, on white paper, the
 * weight is carried by color alone and every line is hairline; `GRID_OVER` is
 * where the widths earn their keep.
 *
 * @type {readonly (readonly [number, string, number])[]}
 */
export const GRID_LEVELS = [
    [1, "#dce7f6", 1],
    [4, "#c2d6ef", 1],
    [20, "#9dbde4", 1],
    [100, "#6f9bd4", 1],
];

/**
 * The same paper with each unit square divided into fifths.
 *
 * Jake, 2026-11-23: *divide unit square with 5 lighter lines. Leave unit lines
 * on vertices of handle points.* Which is why this is a separate level list and
 * not a line added to the one above: the fifths are the grid the CENTER lands
 * on, and the unit lines have to stay the ones the five corners sit on. Lighter
 * than the 1s, so the unit lattice still reads as the lattice.
 *
 * It is the input figure's paper. The output's lattice is where the tiles live
 * and has nothing to say about fifths, so it keeps `GRID_LEVELS`.
 *
 * Note the ORDER: `gridLines` draws each level over the last, so the fifths go
 * first and every unit line is redrawn in its own color on top.
 *
 * @type {readonly (readonly [number, string, number])[]}
 */
export const GRID_FIFTHS = [[1 / 5, "#edf2fa", 1], ...GRID_LEVELS];

/**
 * The lattice drawn OVER the tiles, which needs its own palette.
 *
 * Jake, 2026-11-23: *render output "on top" grid more contrasty.* The pale
 * blues above are chosen to be read through, on white paper, under the figure.
 * Over `#3355cc`, `#f2d13b` and `#dd7722` they all but vanish -- worst on the
 * blue tiles, where the grid and the fill are the same hue at nearly the same
 * value. These are dark and desaturated instead, which is the one family that
 * carries over all three fills AND over the white between them.
 *
 * HOW DARK is not a matter of taste. The three fills have luminances of about
 * 86 (blue), 135 (orange) and 205 (yellow), and white is 255 -- so the blue is
 * the floor to clear, and anything in the 60s to 90s disappears into it. A
 * first attempt at `#52627e` landed at 97 and repeated the bug it was fixing,
 * which is what the test in `tests/pentadiculum.test.mjs` is there to catch.
 * These run from 61 down, clear of the blue by 25 and of everything else by
 * more.
 *
 * AND NOT BLACK. Jake, 2026-11-23: *make it non black to contrast with existing
 * edges.* Tile edges are `EDGE_INK`, `#111418`, which is a NEUTRAL dark at
 * luminance 20 -- and the first dark ramp here was neutral too, so its 20s and
 * 100s landed at 24 and 13 and a grid line was indistinguishable from a tile
 * edge. These are teal: red below green below blue by a clear margin at every
 * rung, a hue the page uses nowhere else (the fills are blue, yellow and
 * orange; `HOT` is red; `INK` is navy), so a lattice line is never mistaken for
 * an outline even where their values are close.
 *
 * THE WEIGHT IS IN THE WIDTH, which is the other half of Jake's note: *the 4
 * unit spacing heavier.* Over tiles there is no room left to darken into -- the
 * ramp is already near the floor -- so the 4s, 20s and 100s get thicker strokes
 * instead, and the hierarchy reads at any luminance.
 *
 * @type {readonly (readonly [number, string, number])[]}
 */
export const GRID_OVER = [
    [1, "#22434f", 1],
    [4, "#1a3642", 1.75],
    [20, "#112833", 2.25],
    [100, "#0a1b24", 2.75],
];

/**
 * `GRID_OVER` with the fifths under it -- the output's `5 space` setting.
 *
 * Jake: *the five (4) space lines on the output should be lighter.* They were
 * at 64, a shade off the unit lines, and the finest division on the sheet
 * should be the faintest thing on it. At 166 it is lighter than every rung
 * above it and still clear of all three fills -- 80 from the blue, 31 from the
 * orange, 39 from the yellow -- which is as much room as that band has.
 *
 * @type {readonly (readonly [number, string, number])[]}
 */
export const GRID_OVER_FIFTHS = [[1 / 5, "#93aab6", 1], ...GRID_OVER];

/**
 * How strongly the over-grid is laid on. It was 0.75 with the pale palette and
 * read as nothing at all; with `GRID_OVER` it is a line you can follow without
 * the tiles becoming the background to it.
 */
export const GRID_OVER_ALPHA = 0.85;

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
 * @param {readonly (readonly [number, string, number])[]} [levels] `GRID_FIFTHS`
 *   for the input figure, where the center snaps to a fifth
 */
export function gridLines(ctx, w, h, cx, cy, cell, alpha = 1, levels = GRID_LEVELS) {
    const was = ctx.globalAlpha;
    const wasWidth = ctx.lineWidth;
    ctx.globalAlpha = alpha;
    for (const [step, color, width] of levels) {
        const gap = cell * step;
        if (gap < 4) continue;                  // too fine to read: leave it out
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
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
    ctx.lineWidth = wasWidth;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} cell
 * @param {readonly (readonly [number, string, number])[]} [levels]
 */
export function paper(ctx, w, h, cx, cy, cell, levels = GRID_LEVELS) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    gridLines(ctx, w, h, cx, cy, cell, 1, levels);
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
