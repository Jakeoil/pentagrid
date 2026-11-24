// @ts-check
/**
 * The Pentadiculum: the five points, the origin they are measured from, and the
 * instrument you move them with. Jake's name for it, after the pentagrid's
 * Reticulum and on the same terms.
 *
 * A public entry point. Plain JavaScript, no build step on your side:
 *
 *     import { mountFloatingPentadiculum }
 *         from "../pentagrid/discrete-directions/lib/pentadiculum.js";
 *
 * THE STYLESHEET IS NOT OPTIONAL for the mounts — structure is inline, the look
 * is CSS, and an unstyled mount works and looks like unstyled HTML:
 *
 *     <link rel="stylesheet" href="discrete-directions/lib/css/pentadiculum.css">
 *
 * The bare `createPentadiculum` is a canvas and needs no CSS at all.
 *
 * TWO LAYERS, and the second is the useful one. `createPentadiculum` is a pure
 * view: it owns a canvas, a viewport and the pointer, holds no seed, and reports
 * what a drag would make. `mountPentadiculum` and
 * `mountFloatingPentadiculum` bind that view to a seed they keep and build the
 * controls. Nothing here is module-level state, so a page can mount four.
 *
 * This is the UI half. The geometry it presents is `lib/wheels.js` — `seedOf`,
 * `originFence`, `centroidOf`, and `moveHandle` for the floater — and nothing
 * under `src/math/` knows a canvas exists.
 */

export {
    createPentadiculum, mountPentadiculum, mountFloatingPentadiculum,
    SNAPS, snapped, snapStep, snapForSeed, PD_ORIGIN,
} from "../src/ui/pentadiculum.js";

// ── the drawing primitives it is built on, for a page drawing beside it ──
//
// A moiré page putting four outputs next to four seeds wants the same graph
// paper and the same cell ladder, or the figures will not read as one sheet.
export {
    INK, HOT, EDGE_INK, TAU, gridLines, paper, poly,
    GRID_LEVELS, GRID_FIFTHS, GRID_OVER, GRID_OVER_FIFTHS, GRID_OVER_ALPHA,
} from "../src/ui/draw.js";
export { FIB_CELLS, EDGE_SHRINK, fibCell, fitStep } from "../src/ui/fit.js";

// ── Jake's compact numeral: four cells, the sign carried by color ────────
export { compact, numHTML, ptHTML, drawNumeral, numeralWidth, TONE } from "../src/ui/numerals.js";

/** @typedef {import("../src/ui/pentadiculum.js").Seed} Seed */
/** @typedef {import("../src/ui/pentadiculum.js").Snap} Snap */
/** @typedef {import("../src/ui/pentadiculum.js").View} View */
/** @typedef {import("../src/ui/pentadiculum.js").Drawn} Drawn */
/** @typedef {import("../src/ui/pentadiculum.js").Pentadiculum} Pentadiculum */
