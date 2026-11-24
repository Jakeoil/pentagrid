// @ts-check
// The PENTADICULUM: the five points, the origin they are measured from, and the
// instrument you move them with.
//
// Named by Jake, after the pentagrid's Reticulum and on the same terms — it can
// sit in the page or float over it, it is one object with its own math and its
// own UI, and it is meant to be mounted on pages that have never heard of
// `by-your-bootstraps`. A moiré page showing four seeds side by side wants four
// of these and no global state anywhere.
//
// WHICH IS WHY NOTHING HERE IS A MODULE-LEVEL LET. Everything a Pentadiculum
// knows lives in the closure `createPentadiculum` returns. Two on one page
// share the drawing primitives and nothing else.
//
// THE GEOMETRY IT PRESENTS — Gaussean Pentadic Geometry, Jake's name for it,
// written up in `GEOMETRY.md`:
// five ordered Gaussian integers and the lattice point they radiate from. The
// seed is `(points, origin)` and the wheels are built on the differences, so
// `(p, o)` and `(p − o, 0)` are the same seed; the origin adds no geometry, it
// adds the one motion the five handles cannot make between them, which is
// sliding the whole pentagon over the lattice. See `src/math/seed.js` for what
// that motion is allowed to do — it is fenced, and the fence is drawn.
//
// TWO LAYERS, as `lib/reticulum.js` has it, and the second is the useful one:
//
//     const pd = createPentadiculum({ canvas, onChange: (seed) => redraw() });
//     pd.sync(seed, { vectors: true, extrapolate: 0 });
//
// is the pure view — it owns a canvas, a viewport and the pointer, and it holds
// no seed of its own; you hand it one every draw and it tells you when a drag
// has made a new one. While
//
//     const pd = mountPentadiculum(host, { onChange: (seed) => redraw() });
//     const pd = mountFloatingPentadiculum({ onChange: (seed) => redraw() });
//
// bind that view to a seed they keep, build the control row, and give you the
// whole instrument. The floating one appends its own panel to `document.body`.
//
// THE STYLESHEET IS NOT OPTIONAL for the mounts, exactly as it is not for the
// Reticulum: structure is inline, the look is `lib/css/pentadiculum.css`, and
// an unstyled Pentadiculum works and looks like unstyled HTML. The bare
// `createPentadiculum` needs no CSS at all — it is a canvas.

import {
    HANDLE_ORIGIN, PENTA_UP, PRESETS, centroidOf, checkSeed, moveHandle,
    originFence, spokeSum, spokesOf, wheelsAt,
} from "../../lib/wheels.js";
import { pentagon } from "../../lib/tiles.js";
import { EDGE_INK, GRID_FIFTHS, GRID_LEVELS, HOT, INK, TAU, paper, poly } from "./draw.js";
import { drawNumeral, numeralWidth } from "./numerals.js";
import { fitStep } from "./fit.js";

/** @typedef {import("../../lib/wheels.js").Pt} Pt */

/**
 * A seed: five ordered positions and the point their spokes are measured from.
 * @typedef {{ points: readonly Pt[], origin: Pt }} Seed
 */

/**
 * What a dragged handle lands on.
 *
 * THERE IS NO `fifths` MODE, and there was one for a day. Jake, 2026-11-23: *I
 * made a mistake with that 1/5 thing. We don't need it. In snap mode only the
 * centroid need snap at 1/5. [...] Moving centroid moves 1/5, moving points
 * moves 5/5.* He is right, and it is the better rule because the two handles
 * are not the same kind of thing:
 *
 *  - the **five** are Gaussian integers. That is the whole definition (see
 *    `GEOMETRY.md` §1), and a corner on a fifth is not a point of this geometry
 *    at all.
 *  - the **center** has to reach the sweet spot, which is always in (1/5)Z² and
 *    is an integer only by accident. A whole-unit center cannot get there.
 *
 * So one setting covers both, each handle on the grid it belongs to, and the
 * menu is down to the honest two. `none` still quantizes, at 1/256 — a pointer
 * has pixels, and a coordinate that reads to sixteen places is not a coordinate
 * anyone can use.
 * @typedef {"units" | "none"} Snap
 */
/** @type {readonly Snap[]} */
export const SNAPS = ["units", "none"];

/**
 * The step a handle lands on, in lattice units: a fifth for the center, a whole
 * unit for a corner, 1/256 for either when snap is off.
 * @type {(snap: Snap, handle?: number) => number}
 */
export const snapStep = (snap, handle = -1) => snap === "none" ? 1 / 256
    : handle === PD_ORIGIN ? 1 / 5 : 1;

/**
 * One coordinate, snapped for the handle that is moving.
 * @type {(snap: Snap, v: number, handle?: number) => number}
 */
export const snapped = (snap, v, handle = -1) => {
    const step = snapStep(snap, handle);
    return Math.round(v / step) * step;
};

/**
 * The finest snap a seed is already on. Anything coarser would wreck it on the
 * first drag, which is why a preset or an adoption sets the control from the
 * figure rather than the other way about.
 * @param {Seed} seed
 * @returns {Snap}
 */
export function snapForSeed(seed) {
    // Each handle against its OWN grid: the five on units, the center on
    // fifths. A seed at its sweet spot is on the snap -- which it had better be,
    // since the `centroid` button is how you get there.
    const onUnits = seed.points.flat().every((v) => Number.isInteger(v));
    const onFifths = seed.origin.every((v) => Math.abs(v * 5 - Math.round(v * 5)) < 1e-9);
    return onUnits && onFifths ? "units" : "none";
}

/**
 * `dragging` and `floater` are a point index, or this for the origin.
 *
 * It is `HANDLE_ORIGIN` from `src/math/seed.js` under this page's own name, and
 * the same number: the rule that drives the floater is arithmetic and lives
 * with the arithmetic, so there is one constant and the UI borrows it.
 */
export const PD_ORIGIN = HANDLE_ORIGIN;

/** @typedef {"none" | "transparent" | "solid"} Face */
/** @typedef {"none" | "thin" | "thick"} Edge */

/**
 * How the figure is drawn. All optional; what is left out keeps its default.
 *
 * `extrapolate` is in HALF generations, 0 being the five points themselves —
 * off the base rung the figure shown is derived, so its corners stop being
 * handles and the fence stops being drawn.
 *
 * @typedef {object} View
 * @property {number} [extrapolate]
 * @property {Face} [face]
 * @property {Edge} [edge]
 * @property {boolean} [vectors] the five point-to-point arrows, with values
 * @property {boolean} [fence] the legal origins, at the base rung
 * @property {boolean} [spokes] origin-to-corner rays
 * @property {Snap} [snap]
 * @property {boolean} [fifths] rule each unit square into fifths as well
 * @property {number} [floater] which handle is driven by the others: a point
 *   index, `PD_ORIGIN`, or -1 for none. See `moveHandle` in `src/math/seed.js`.
 */

/** @type {Required<View>} */
const VIEW = {
    extrapolate: 0, face: "solid", edge: "thin",
    vectors: false, fence: true, spokes: true, snap: "units",
    // The fifths are ON by default -- they are the grid the CENTER lands on --
    // but Jake, 2026-11-24: *the fine grid should be turned off and on easily.*
    // Close up they are a thicket, and the unit lattice is what you are reading
    // when you place a corner.
    fifths: true,
    // The origin floats by default, so it keeps its offset from the centroid
    // instead of being left behind by a corner drag. Jake asked for this one.
    floater: PD_ORIGIN,
};

/**
 * What one draw worked out, handed back so a page can put it in a readout
 * without recomputing any of it.
 * @typedef {object} Drawn
 * @property {number} cell pixels per lattice unit, the Fibonacci one
 * @property {ReturnType<typeof checkSeed>} verdict
 * @property {readonly Pt[]} shown the figure at the chosen rung, in spoke space
 * @property {readonly Pt[]} fence the legal origins, empty off the base rung
 * @property {boolean} sweet is the center on the sweet spot -- the centroid,
 *   where `GEOMETRY.md` §5 happens
 */

/**
 * @typedef {object} PentadiculumOptions
 * @property {HTMLCanvasElement} [canvas] an existing canvas to adopt; one is
 *   created when this is left out, which is what the mounts do
 * @property {number} [size] the created canvas's side, in CSS pixels
 * @property {number} [cell] the cap on pixels per lattice unit: a small figure
 *   is not blown up to fill the frame
 * @property {number} [margin] how much of the canvas the figure may fill
 * @property {(seed: Seed, what: "point" | "origin") => void} [onChange]
 * @property {(view: { zoom: number, floater: number }) => void} [onView]
 * @property {Document} [document]
 */

/** The largest cell the fit will use, as a multiple of `cell`. */
const CAP_CELLS = 3;

/**
 * @param {Document} doc
 * @param {number} size
 * @returns {HTMLCanvasElement}
 */
function makeCanvas(doc, size) {
    const c = /** @type {HTMLCanvasElement} */ (doc.createElement("canvas"));
    c.width = size;
    c.height = size;
    return c;
}

/**
 * The Pentadiculum as a pure view: a canvas, a viewport and the pointer.
 *
 * It holds NO seed. `sync` is given one and draws it; a drag reports the seed it
 * would make through `onChange` and nothing is changed here. That is what lets
 * four of them on a moiré page read one model, or four models, without any of
 * them owning the question.
 *
 * @param {PentadiculumOptions} [options]
 */
export function createPentadiculum(options = {}) {
    // Written out rather than spread over a defaults object, because
    // `{ ...{ size: 340 }, ...{ size: undefined } }` is `{ size: undefined }` --
    // and passing an option through that it was never given is exactly what a
    // mount does. That made `makeCanvas(doc, undefined)` a 0x0 canvas, which no
    // page had met only because the pages all adopt a canvas of their own.
    const opts = {
        ...options,
        size: options.size ?? 340,
        cell: options.cell ?? 26,
        margin: options.margin ?? 0.40,
    };
    const doc = opts.document ?? globalThis.document;
    /** The canvas it draws on: an adopted one, or one of its own. */
    const canvas = opts.canvas ?? makeCanvas(doc, opts.size);
    canvas.className = [canvas.className, "pentadiculum"].filter(Boolean).join(" ");

    /** @type {Seed} */
    let seed = { points: PENTA_UP.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin: [0, 0] };
    /** @type {Required<View>} */
    let view = { ...VIEW };

    // ── the viewport ──────────────────────────────────────────────────────
    //
    // A sticky auto-fit with the user's zoom on top. It used to refit exactly
    // every frame, which made dragging a point outward run away: `pick` divides
    // the pointer by the scale, so a smaller scale reads a larger coordinate,
    // which grows the figure, which shrinks the scale. See `src/ui/fit.js` —
    // the fit is held between frames, and the mapping is frozen for the length
    // of a drag. Both are needed.
    let fit = 0;                 // 0 means "refit exactly on the next draw"
    let zoom = 1;
    /**
     * Where the lattice origin sits, away from the middle of the canvas, in
     * LATTICE units. Jake, 2026-11-24: *doing close up work, I can't pan to
     * move individual points on the pentadiculum.* Zooming about the center was
     * fine while the whole figure was on screen and useless once it was not.
     *
     * Lattice units rather than pixels on purpose: a zoom then keeps whatever
     * you panned to in the middle instead of throwing it off the edge.
     * @type {Pt}
     */
    let pan = [0, 0];
    /**
     * A pan in progress: the pointer where it went down, and the pan it started
     * from. Null when the paper is not being dragged.
     * @type {{ x: number, y: number, from: Pt } | null}
     */
    let panning = null;
    let overflow = false;
    let settling = 0;
    let scale = opts.cell;       // what `pick` divides by; frozen while dragging
    const ZOOM = { min: 0.1, max: 12 };

    /** A point index, PD_ORIGIN for the origin, or -1 for nothing. */
    let dragging = -1;

    const atBase = () => view.extrapolate === 0;

    /**
     * The spoke sum the floater holds -- five times the offset from the origin
     * to the centroid. Adopted from whatever seed arrives through `sync`, so it
     * cannot go stale, and held for the length of a drag.
     * @type {Pt}
     */
    let target = spokeSum(seed);

    /**
     * Is the center FIXED? It is whenever one of the five floats instead, which
     * is the whole point of choosing another floater -- Jake's *you will be
     * able to fix the center by choosing another point as the floater*.
     */
    const pinned = () => view.floater >= 0 && view.floater !== PD_ORIGIN;

    /**
     * Coordinates under the pointer, unsnapped -- which is what a hit test
     * wants: rounding first could move the pointer half a unit before asking
     * what it is near.
     * @type {(ev: { clientX: number, clientY: number }) => Pt}
     */
    function at(ev) {
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / (r.width || canvas.width);
        const sy = canvas.height / (r.height || canvas.height);
        return [((ev.clientX - r.left) * sx - canvas.width / 2) / scale - pan[0],
                ((ev.clientY - r.top) * sy - canvas.height / 2) / scale - pan[1]];
    }

    /**
     * Where a handle being dragged should land: on its own grid, so the center
     * moves by a fifth and a corner by a whole unit.
     * @type {(ev: { clientX: number, clientY: number }, handle: number) => Pt}
     */
    const pick = (ev, handle) => {
        const p = at(ev);
        return [snapped(view.snap, p[0], handle), snapped(view.snap, p[1], handle)];
    };

    /** @type {Drawn} */
    let last = {
        cell: opts.cell, verdict: { ok: true, why: "" },
        shown: [], fence: [], sweet: false,
    };

    /**
     * Draw the seed as the view says, and report what that took.
     * @param {Seed} [next] the seed to draw; the last one again when left out
     * @param {View} [nextView] only the keys given are changed
     * @returns {Drawn}
     */
    function sync(next, nextView) {
        if (next) { seed = next; target = spokeSum(next); }
        if (nextView) view = { ...view, ...nextView };
        const ctx = canvas.getContext("2d");
        if (!ctx) return last;
        const w = canvas.width, h = canvas.height;
        const spk = spokesOf(seed);
        const base = atBase();
        // Is the center ON the sweet spot? There P = S, `inflate(D) = T`, and
        // all three rhomb spellings close as one exact parallelogram -- and
        // nothing about the figure's outline announces any of it, which is why
        // Jake asked for it to be said: *indicate when center is in sweet spot.*
        const mid = centroidOf(seed.points);
        const sweet = Math.hypot(seed.origin[0] - mid[0], seed.origin[1] - mid[1]) < 1e-9;

        const shown = pentagon(wheelsAt(spk, 1 + view.extrapolate).d, 0);
        const verdict = checkSeed(seed);

        // The paper is the lattice, so the frame has to hold everything in
        // LATTICE coordinates: the five where they sit, the shown figure where
        // the origin has put it, and the origin itself.
        const reach = Math.max(1,
            ...shown.map((v) => Math.hypot(v[0] + seed.origin[0], v[1] + seed.origin[1])),
            ...seed.points.map((v) => Math.hypot(v[0], v[1])),
            Math.hypot(seed.origin[0], seed.origin[1]));
        const margin = Math.min(w, h) * opts.margin;
        fit = fitStep(reach, fit, margin, opts.cell * CAP_CELLS);
        overflow = reach * fit > margin;
        // SMOOTH, not laddered. Jake, 2026-11-23: *I was wrong about grid size
        // of pentadiculum following fibonacci numbers. At least for manual
        // sizing. I want to be able to size it smoothly.* He is right, and the
        // ladder was worse than merely notchy: from cell 13 the next rung is
        // 21, so several scroll clicks did nothing and then the figure jumped
        // 1.6x. `fibCell` and its reasoning stay in `fit.js`, exported and
        // tested, and nothing calls them from here.
        //
        // Legibility was never the ladder's job either, which is the part I had
        // backwards. `gridLines` drops a level once its gap falls under 4px, so
        // at cell 0.29 the 1s and 4s vanish and the paper reads as 20-unit
        // squares. GRID_LEVELS is what keeps it readable, at any cell at all.
        //
        // And the frame is SAFER this way, not looser: `fitStep` returns
        // min(margin/reach, cap), so at zoom <= 1 the figure is inside the
        // margin by construction. `fibCell`'s rounding down was patching the
        // ladder's own ability to land far below the fit -- which is exactly
        // what the one-pixel floor bug was.
        const k = fit * zoom;
        if (dragging < 0) scale = k;
        // Where lattice (0,0) lands: the middle of the canvas, shifted by the
        // pan. Computed HERE and not with the width, because the pan is in
        // lattice units and needs `k` to become pixels.
        const cx = w / 2 + pan[0] * k, cy = h / 2 + pan[1] * k;

        // The paper hangs off the ORIGIN, not off the canvas, so its 0,0 axes
        // run through the origin wherever it has been dragged to.
        const ox = cx + seed.origin[0] * k, oy = cy + seed.origin[1] * k;
        // GRID_FIFTHS, not GRID_LEVELS: each unit square divided by five
        // lighter lines, because a fifth is where the center can land. The unit
        // lines are drawn over them and stay the ones the corners sit on, and
        // the fifths drop out of their own accord below a cell of 20px, where a
        // fifth would be the 4px `gridLines` refuses to draw.
        paper(ctx, w, h, ox, oy, k, view.fifths ? GRID_FIFTHS : GRID_LEVELS);

        if (!base) {
            // The five, as a reference, so the ladder step is visible. Dashed
            // and neutral on purpose: a faint tint of the fill color read as a
            // mysterious shadow rather than as a deliberate guide.
            ctx.strokeStyle = "rgba(60,70,90,0.35)";
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            poly(ctx, seed.points, cx, cy, k);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // The fence: every origin that keeps the ten spokes in order. Drawn
        // first, under everything, and only where there is a choice to make.
        const fence = (base && view.fence) ? originFence(seed.points) : [];
        if (fence.length) {
            poly(ctx, fence, cx, cy, k);
            ctx.fillStyle = "rgba(42,59,107,0.07)";
            ctx.fill();
            ctx.strokeStyle = "rgba(42,59,107,0.45)";
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        poly(ctx, shown, ox, oy, k);
        if (view.face !== "none") {
            ctx.globalAlpha = view.face === "transparent" ? 0.35 : 1;
            ctx.fillStyle = HOT;
            ctx.fill("evenodd");
            ctx.globalAlpha = 1;
        }
        if (view.edge !== "none") {
            ctx.strokeStyle = EDGE_INK;
            ctx.lineWidth = view.edge === "thick" ? 3 : 1.6;
            ctx.stroke();
        }

        if (view.spokes) {
            // origin to each corner, so the ordering is visible
            ctx.strokeStyle = "rgba(230,57,70,0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const p of shown) {
                ctx.moveTo(ox, oy);
                ctx.lineTo(ox + p[0] * k, oy + p[1] * k);
            }
            ctx.stroke();
        }

        if (view.vectors) drawVectors(ctx, shown, ox, oy, k);

        // Numbered and draggable only at the base rung, where the five
        // actually live. An extrapolated pentagon is a VIEW of them, not a
        // thing to edit — `use` is what turns one into the five.
        /**
         * The mark on the handle that FOLLOWS. A dashed ring, because dashed
         * already means derived on this canvas -- the fence is dashed, so is
         * the reference pentagon off the base rung -- so there is no new
         * vocabulary to learn.
         * @type {(x: number, y: number, r: number) => void}
         */
        const ring = (x, y, r) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.strokeStyle = "rgba(42,59,107,0.75)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 2.5]);
            ctx.stroke();
            ctx.setLineDash([]);
        };

        ctx.font = "600 11px ui-monospace, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        shown.forEach((p, i) => {
            const x = ox + p[0] * k, y = oy + p[1] * k;
            if (base) {
                ctx.fillStyle = i === dragging ? INK : HOT;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, TAU);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.fillText(String(i), x, y + 0.5);
                if (view.floater === i) ring(x, y, 11.5);
            } else {
                ctx.fillStyle = HOT;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, TAU);
                ctx.fill();
            }
        });

        // The origin. A handle at the base rung, where moving it means
        // something, and a small dot otherwise. Hollow when the seed it makes
        // is unusable, so the figure says so before it falls apart.
        // Handle-SIZE means draggable here, so the fixed center draws at the
        // size it already uses off the base rung, where it is not a handle
        // either. A refusal you can see before you pull on it.
        const originHandle = base && !pinned();
        ctx.beginPath();
        ctx.arc(ox, oy, originHandle ? 6.5 : 3, 0, TAU);
        if (verdict.ok) {
            ctx.fillStyle = dragging === PD_ORIGIN ? HOT : INK;
            ctx.fill();
        } else {
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.strokeStyle = HOT;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        // On the sweet spot the center becomes a bullseye: a white pupil inside
        // the dot. It composes with the other two things the center says --
        // hollow for an unusable seed, a dashed ring when it floats -- rather
        // than competing with either, and after the `centroid` button all three
        // are true at once, which is the state worth recognizing at a glance.
        if (verdict.ok && sweet) {
            ctx.beginPath();
            ctx.arc(ox, oy, originHandle ? 2.6 : 1.3, 0, TAU);
            ctx.fillStyle = "#fff";
            ctx.fill();
        }
        if (base && view.floater === PD_ORIGIN) ring(ox, oy, 10);

        last = { cell: k, verdict, shown, fence, sweet };
        return last;
    }

    /**
     * The affine vectors: 0→1, 1→2, … 4→0, along the figure's own edges,
     * clockwise, each labeled with the difference it is.
     *
     * AFFINE is the right word. A difference of two points has the origin
     * cancel out of it, so these five numbers are exactly what does not change
     * when the origin is dragged: everything the origin moves is the five
     * spokes, everything it leaves alone is here.
     *
     * Clockwise comes free. The seed is valid when consecutive spokes turn the
     * same way, and with y down the page that turn reads clockwise on screen,
     * so index order already points the arrows the right way round.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {readonly Pt[]} shown
     * @param {number} ox
     * @param {number} oy
     * @param {number} k
     */
    function drawVectors(ctx, shown, ox, oy, k) {
        ctx.font = "600 10px ui-monospace, Menlo, monospace";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(42,59,107,0.8)";
        const mid = shown.reduce((a, p) =>
            /** @type {Pt} */ ([a[0] + p[0] / shown.length, a[1] + p[1] / shown.length]),
            /** @type {Pt} */ ([0, 0]));
        const cxm = ox + mid[0] * k, cym = oy + mid[1] * k;
        shown.forEach((from, i) => {
            const to = shown[(i + 1) % shown.length];
            const ax = ox + from[0] * k, ay = oy + from[1] * k;
            const bx = ox + to[0] * k, by = oy + to[1] * k;
            const len = Math.hypot(bx - ax, by - ay);
            if (len < 10) return;
            const ux = (bx - ax) / len, uy = (by - ay) / len;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            // the arrowhead at the HEAD, pulled back off the corner handle
            const hx = bx - ux * 9, hy = by - uy * 9;
            const a = 8, b = 3.6;
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx - a * ux + b * uy, hy - a * uy - b * ux);
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx - a * ux - b * uy, hy - a * uy + b * ux);
            ctx.stroke();
            // The value, outside the edge: the normal that points away from the
            // figure's middle, so a label never lands on top of the pentagon.
            const mx = (ax + bx) / 2, my = (ay + by) / 2;
            let nx = -uy, ny = ux;
            if (nx * (mx - cxm) + ny * (my - cym) < 0) { nx = -nx; ny = -ny; }
            const dx = to[0] - from[0], dy = to[1] - from[1];
            const lx = mx + nx * 14, ly = my + ny * 14;
            ctx.textAlign = "left";
            drawNumeral(ctx, dx, lx - numeralWidth(ctx, dx) / 2, ly - 6);
            drawNumeral(ctx, dy, lx - numeralWidth(ctx, dy) / 2, ly + 6);
        });
        ctx.textAlign = "center";
    }

    /**
     * Keep easing the fit after the pointer has let go.
     *
     * `fitStep` eases a frame at a time, and a frame here is a redraw, and a
     * redraw comes from an event. So a drag that ended past the margin would
     * simply stop there with the figure too big for its frame. This carries it
     * the rest of the way, still a percent at a time — the alternative was to
     * snap on release, and a jump at the end of every drag is its own
     * complaint. It does nothing where there are no animation frames, which is
     * node.
     */
    function settle() {
        if (settling || dragging >= 0 || panning || !overflow) return;
        const raf = globalThis.requestAnimationFrame;
        if (typeof raf !== "function") return;
        settling = raf(() => { settling = 0; sync(); settle(); });
    }

    /** @type {[string, (ev: any) => void][]} */
    const wired = [];
    /** @type {(type: string, fn: (ev: any) => void, opt?: AddEventListenerOptions) => void} */
    const on = (type, fn, opt) => {
        canvas.addEventListener(type, fn, opt);
        wired.push([type, fn]);
    };

    /**
     * Which handle is at these coordinates, or -1. Split out because the
     * double-click needs the same answer the drag does.
     * @param {Pt} where
     * @returns {number}
     */
    function grab(where) {
        let best = -1, bestD = 2.5;
        seed.points.forEach((p, i) => {
            const d = Math.hypot(p[0] - where[0], p[1] - where[1]);
            if (d < bestD) { bestD = d; best = i; }
        });
        // The origin wins a tie: a pentagon dragged in small can bury it, and
        // then there would be no way to get it back.
        const dOrigin = Math.hypot(seed.origin[0] - where[0], seed.origin[1] - where[1]);
        if (dOrigin <= bestD) best = PD_ORIGIN;
        return best;
    }

    on("pointerdown", (ev) => {
        // Off the base rung the figure is derived, so nothing is a handle --
        // but the paper still pans, because looking is not editing.
        const best = atBase() ? grab(at(ev)) : -1;
        // A fixed center is not dragged. The double-click still reaches it --
        // that is how it is made the floater again -- so the refusal is here
        // and not in `grab`. Grabbing it pans instead: a handle that will not
        // move is nothing to hold on to.
        const holdable = best >= 0 && !(best === PD_ORIGIN && pinned());
        if (typeof canvas.setPointerCapture === "function")
            canvas.setPointerCapture(ev.pointerId);
        if (holdable) {
            dragging = best;
            sync();
            return;
        }
        panning = { x: ev.clientX, y: ev.clientY, from: [pan[0], pan[1]] };
    });
    on("pointermove", (ev) => {
        if (panning) {
            const r = canvas.getBoundingClientRect();
            const sx = canvas.width / (r.width || canvas.width);
            const sy = canvas.height / (r.height || canvas.height);
            pan = [panning.from[0] + (ev.clientX - panning.x) * sx / scale,
                   panning.from[1] + (ev.clientY - panning.y) * sy / scale];
            sync();
            return;
        }
        if (dragging < 0) return;
        const to = pick(ev, dragging);
        const was = dragging === PD_ORIGIN ? seed.origin : seed.points[dragging];
        if (to[0] === was[0] && to[1] === was[1]) return;
        // `moveHandle` is the whole rule, and it is arithmetic, so it lives in
        // `src/math/seed.js`. With no floater it is the plain move this used to
        // be; with one it drives that handle to hold `target`.
        const next = moveHandle(seed, dragging, to, view.floater, target);
        seed = next;
        // Dragging the floater is what RETARGETS -- the reticulum's sum strip,
        // not its locked dial -- so the held value follows the hand.
        if (dragging === view.floater) target = spokeSum(next);
        // Drawn FIRST, then announced: a consumer's `onChange` usually wants to
        // put the new verdict in a readout, and `drawn()` should already be the
        // seed it was handed rather than the one before it.
        sync();
        // `what` is the handle the HAND was on. With the origin floating a
        // corner drag moves the origin as well, and the seed says so; this only
        // ever said which handle was grabbed.
        opts.onChange?.(next, dragging === PD_ORIGIN ? "origin" : "point");
    });
    const drop = () => {
        if (panning) { panning = null; settle(); return; }
        if (dragging < 0) return;
        dragging = -1;
        sync();
        settle();
    };
    on("pointerup", drop);
    on("pointercancel", drop);

    // Scroll to zoom, about the middle of the CANVAS rather than the pointer.
    // Which is not the figure's own center any more: the pan moves the lattice
    // under the frame, and because the pan is kept in lattice units the thing
    // you panned to stays in the middle as you zoom into it. Double-click on
    // the paper puts both back and refits.
    on("wheel", (ev) => {
        ev.preventDefault?.();
        const by = Math.exp(-(ev.deltaY ?? 0) * 0.0015);
        zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom * by));
        sync();
        opts.onView?.({ zoom, floater: view.floater });
    }, { passive: false });

    // Double-click splits by WHERE it lands: on a handle it assigns the
    // floater, on empty paper it fits, which is what it has always done and
    // what the output canvas does. Jake, 2026-11-23: *I would like to be able
    // to assign a floater point by double clicking it.*
    on("dblclick", (ev) => {
        const hit = atBase() ? grab(at(ev)) : -1;
        if (hit >= 0) {
            // Double-clicking the one that already floats RELEASES it: the
            // reticulum's `locked = -1`, the state where the constraint has
            // been declined rather than disabled.
            view = { ...view, floater: view.floater === hit ? -1 : hit };
            target = spokeSum(seed);
            sync();
            opts.onView?.({ zoom, floater: view.floater });
            return;
        }
        zoom = 1;
        fit = 0;
        pan = [0, 0];
        sync();
        opts.onView?.({ zoom, floater: view.floater });
    });

    return {
        /** The canvas. Append it, or hand one in and this is the same element. */
        element: canvas,
        canvas,
        sync,
        /** What the last draw worked out. */
        drawn: () => last,
        /** Frame the figure afresh on the next draw: a preset, `use`, a rung. */
        refit: () => { fit = 0; },
        /** Zoom, the pan and the auto-fit, back to where they started. */
        reset: () => { zoom = 1; fit = 0; pan = [0, 0]; },
        zoom: () => zoom,
        /** Where lattice (0,0) sits, away from the middle, in lattice units. */
        pan: () => /** @type {Pt} */ ([pan[0], pan[1]]),
        /** Which handle is under the pointer, or -1. */
        dragging: () => dragging,
        /** The spoke sum the floater is holding: 5x (centroid - origin). */
        target: () => /** @type {Pt} */ ([target[0], target[1]]),
        /** The view, as it stands. */
        view: () => ({ ...view }),
        /** The seed it was last given — including a drag's own changes. */
        seed: () => seed,
        settle,
        destroy() {
            for (const [type, fn] of wired) canvas.removeEventListener(type, fn);
            wired.length = 0;
            if (settling && typeof globalThis.cancelAnimationFrame === "function")
                globalThis.cancelAnimationFrame(settling);
            settling = 0;
        },
    };
}

/** @typedef {ReturnType<typeof createPentadiculum>} Pentadiculum */

// ── the mounts: the view bound to a seed, with controls ───────────────────

/**
 * @typedef {object} MountOptions
 * @property {Seed} [seed] what to start from; the classic preset otherwise
 * @property {View} [view]
 * @property {number} [size]
 * @property {(seed: Seed) => void} [onChange] called for every change, from a
 *   drag, a preset, the centroid button or `use`
 * @property {boolean} [controls] false mounts the canvas alone
 * @property {Document} [document]
 */

/**
 * The whole instrument, in the page: a canvas, a seed it keeps, and the row of
 * controls that drive both.
 *
 * The controls are the ones that belong to the SEED — preset, snap, vectors,
 * centroid, reset. Face, edges and the ladder belong to whatever the page is
 * drawing with the seed, so they stay the page's business; `pd.sync` takes them
 * as a view.
 *
 * The FLOATER has no control of its own on purpose: it is assigned by
 * double-clicking the handle, which is the gesture Jake asked for, and the
 * readout names whichever one it is.
 *
 * @param {HTMLElement} host
 * @param {MountOptions} [options]
 */
export function mountPentadiculum(host, options = {}) {
    const opts = options;
    const doc = opts.document ?? globalThis.document;
    /** @type {Seed} */
    let seed = opts.seed
        ?? { points: PENTA_UP.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin: [0, 0] };
    /** @type {View} */
    let view = { ...opts.view, snap: opts.view?.snap ?? snapForSeed(seed) };
    /** The floater the readout is naming, so a zoom costs nothing. */
    let floaterShown = view.floater ?? PD_ORIGIN;

    /** @type {(tag: string, className?: string, text?: string) => HTMLElement} */
    const el = (tag, className, text) => {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const wrap = el("div", "pentadiculum-wrap");
    const pd = createPentadiculum({
        size: opts.size, document: doc,
        onChange: (next) => { seed = next; announce(); },
        // A double-click can change the floater, and the readout names it, so
        // the view has to reach here as well as the seed. Only on a CHANGE of
        // floater: `onView` fires on every scroll click too, and `announce`
        // tells the page the seed has moved, which a zoom has not.
        onView: (v) => {
            if (v.floater === floaterShown) return;
            floaterShown = v.floater;
            announce();
        },
    });
    wrap.appendChild(pd.element);

    const read = el("p", "pentadiculum-read");

    /** Draw, update the readout, and tell the page. */
    function announce() {
        const drawn = pd.sync(seed, view);
        read.innerHTML = `<b>origin</b> (${drawn.verdict.ok ? "" : "&#9888; "}`
            + `${fmt(seed.origin[0])}, ${fmt(seed.origin[1])})`
            + ` &middot; <b>centroid</b> (${fmt(centroidOf(seed.points)[0])},`
            + ` ${fmt(centroidOf(seed.points)[1])})`
            + (drawn.sweet ? " &middot; <b>on the sweet spot</b>" : "")
            + ` &middot; ${floaterSays(pd.view().floater)}`
            + (drawn.verdict.ok ? "" : ` &mdash; ${drawn.verdict.why}`);
        opts.onChange?.(seed);
    }
    /** @type {(v: number) => string} */
    const fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");

    /** Which handle follows the others, in words. @type {(f: number) => string} */
    const floaterSays = (f) => f < 0 ? "nothing floats"
        : f === PD_ORIGIN ? "<b>the center floats</b>"
        : `<b>point ${f} floats</b>, the center is fixed`;

    /** @type {(next: Seed, refit?: boolean) => void} */
    const put = (next, refit = true) => {
        seed = next;
        view = { ...view, snap: snapForSeed(seed) };
        if (snapPick) snapPick.value = /** @type {string} */ (view.snap);
        if (refit) pd.refit();
        announce();
    };

    /** @type {HTMLSelectElement | null} */
    let snapPick = null;
    if (opts.controls !== false) {
        const row = el("div", "pentadiculum-ctl");

        const presetPick = /** @type {HTMLSelectElement} */ (el("select", "pentadiculum-preset"));
        for (const name of Object.keys(PRESETS)) {
            const o = /** @type {HTMLOptionElement} */ (doc.createElement("option"));
            o.value = name;
            o.textContent = name === "quadrille" ? "classic" : name;
            presetPick.appendChild(o);
        }
        presetPick.addEventListener("change", () => {
            const preset = PRESETS[presetPick.value];
            if (!preset) return;
            // A preset is five vectors FROM the origin, so loading one puts the
            // origin back where those vectors are measured from.
            put({ points: preset.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin: [0, 0] });
        });
        row.append(el("span", "grp", "preset"), presetPick);

        snapPick = /** @type {HTMLSelectElement} */ (el("select", "pentadiculum-snap"));
        for (const name of SNAPS) {
            const o = /** @type {HTMLOptionElement} */ (doc.createElement("option"));
            o.value = name;
            o.textContent = name;
            snapPick.appendChild(o);
        }
        snapPick.value = /** @type {string} */ (view.snap);
        snapPick.addEventListener("change", () => {
            const v = /** @type {Snap} */ (snapPick?.value);
            if (SNAPS.includes(v)) view = { ...view, snap: v };
        });
        row.append(el("span", "grp", "snap"), snapPick);

        const vectors = /** @type {HTMLInputElement} */ (el("input"));
        vectors.type = "checkbox";
        vectors.checked = view.vectors === true;
        vectors.addEventListener("change", () => {
            view = { ...view, vectors: vectors.checked };
            announce();
        });
        const vlabel = el("label");
        vlabel.append(vectors, doc.createTextNode(" vectors"));
        row.appendChild(vlabel);

        // The fifths, off and on. They are the grid the CENTER lands on and a
        // thicket when you are close in on a corner, so they get a switch of
        // their own rather than a rule about when to draw them.
        const fifths = /** @type {HTMLInputElement} */ (el("input"));
        fifths.type = "checkbox";
        fifths.checked = view.fifths !== false;
        fifths.addEventListener("change", () => {
            view = { ...view, fifths: fifths.checked };
            announce();
        });
        const flabel = el("label");
        flabel.append(fifths, doc.createTextNode(" 5 space"));
        row.appendChild(flabel);

        // The centroid: the one origin where all three rhomb spellings agree
        // and each closes as an exact parallelogram. It is in fifths, which is
        // the grid the center snaps to anyway, so pressing this leaves the
        // figure on its snap and the center draggable from there.
        const centroid = el("button", "", "centroid");
        centroid.addEventListener("click", () =>
            put({ points: seed.points, origin: centroidOf(seed.points) }));
        row.appendChild(centroid);

        const home = el("button", "", "origin");
        home.addEventListener("click", () => put({ points: seed.points, origin: [0, 0] }));
        row.appendChild(home);

        wrap.append(read, row);
    } else {
        wrap.appendChild(read);
    }

    host.appendChild(wrap);
    announce();

    return {
        element: wrap,
        pentadiculum: pd,
        /** The seed it is holding. */
        seed: () => seed,
        /** Put a seed in, as a preset does: refits and tells the page. */
        set: put,
        /** Change the view and redraw — what a page's own face/edge/rung do.
         *  @param {View} next */
        update(next) { view = { ...view, ...next }; announce(); },
        refit: () => { pd.refit(); announce(); },
        destroy() { pd.destroy(); wrap.remove?.(); },
    };
}

/**
 * The same instrument, in a panel that floats over the page and can be dragged
 * by its title bar — the Reticulum's trick, and for the same reason: on a page
 * whose subject is the OUTPUT, the seed wants to be at hand without taking a
 * column of layout.
 *
 * It appends its panel to `document.body` itself.
 *
 * @param {MountOptions & { title?: string, at?: [number, number] }} [options]
 */
export function mountFloatingPentadiculum(options = {}) {
    const doc = options.document ?? globalThis.document;
    const panel = doc.createElement("div");
    panel.className = "pentadiculum-panel";
    const bar = doc.createElement("div");
    bar.className = "pentadiculum-bar";
    bar.textContent = options.title ?? "pentadiculum";
    const shut = doc.createElement("button");
    shut.className = "pentadiculum-shut";
    shut.textContent = "×";
    bar.appendChild(shut);
    panel.appendChild(bar);
    const body = doc.createElement("div");
    body.className = "pentadiculum-body";
    panel.appendChild(body);

    /** Where the panel sits. Kept here rather than read back off the element:
     *  `offsetLeft` forces a layout on every pointermove, and it is the wrong
     *  number the moment a stylesheet transforms the panel. @type {[number, number]} */
    let place = [...(options.at ?? [24, 24])];
    const put = () => {
        panel.style.left = `${place[0]}px`;
        panel.style.top = `${place[1]}px`;
    };
    put();

    const mounted = mountPentadiculum(body, options);
    doc.body.appendChild(panel);

    // Dragged by the bar, and by the bar only: inside the body the pointer
    // belongs to the figure, where a drag means moving a point.
    let from = /** @type {[number, number] | null} */ (null);
    bar.addEventListener("pointerdown", (ev) => {
        if (ev.target === shut) return;
        from = [ev.clientX - place[0], ev.clientY - place[1]];
        if (typeof bar.setPointerCapture === "function") bar.setPointerCapture(ev.pointerId);
    });
    bar.addEventListener("pointermove", (ev) => {
        if (!from) return;
        place = [ev.clientX - from[0], ev.clientY - from[1]];
        put();
    });
    const letGo = () => { from = null; };
    bar.addEventListener("pointerup", letGo);
    bar.addEventListener("pointercancel", letGo);

    /** @type {(on: boolean) => void} */
    const show = (on) => { panel.style.display = on ? "" : "none"; };
    shut.addEventListener("click", () => show(false));

    return {
        ...mounted,
        panel,
        /** Where it sits, and how to move it from code. */
        at: () => /** @type {[number, number]} */ ([...place]),
        /** @type {(x: number, y: number) => void} */
        moveTo(x, y) { place = [x, y]; put(); },
        show,
        toggle: () => show(panel.style.display === "none"),
        destroy() { mounted.destroy(); panel.remove?.(); },
    };
}
