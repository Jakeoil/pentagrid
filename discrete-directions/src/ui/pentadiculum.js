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
    integralCentroid, originFence, presetName, spokeSum, spokesOf, walkSeed,
    wheelsAt,
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

/**
 * One checkbox: whether it reads checked, and whether it is the user's to
 * change.
 *
 * `locked` is drawn by the browser's own `disabled`, which grays an empty box
 * and grays a check inside a full one. Jake, 2026-11-24: *if check can't be
 * unchecked show a grayed out check. If box can't be checked, show a grayed out
 * box.* So a locked box is its own no-op as well as its own explanation -- a
 * disabled input fires no event, and clicking a state the figure is already in
 * does nothing, because there is nothing for it to do.
 * @typedef {{ on: boolean, locked: boolean }} Box
 */

/**
 * The boxes of the `grid` and `centroid` sections, worked out from the figure.
 *
 * Only `snap` and `fine` are settings at all. `actual` and `closest` are
 * *questions about the seed* that happen to be answerable by clicking them, so
 * they are never stored anywhere: the figure is the state, and the boxes read
 * it back.
 * @typedef {{ snap: Box, fine: Box, actual: Box, closest: Box }} GridBoxes
 */

/** Is a point a whole lattice unit? @type {(p: Pt) => boolean} */
const onUnit = (p) => Number.isInteger(p[0]) && Number.isInteger(p[1]);

/** The same point, give or take the float. @type {(a: Pt, b: Pt) => boolean} */
const samePt = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/**
 * Does the handle now held drag the CENTER along with it?
 *
 * Two ways, and they are the two the fifths have to be visible for. The center
 * itself is held -- it snaps at a fifth, so a drag of it lands between the unit
 * lines nine times in ten. Or a corner is held while the center is the floater,
 * which is the default: the floater keeps the spoke sum, so the center follows
 * a corner at a fifth of its step (`moveHandle`, `src/math/seed.js`).
 *
 * A corner held while some other CORNER floats moves neither, and the fifths
 * stay out of the way.
 * @type {(dragging: number, floater: number) => boolean}
 */
export const centerMoves = (dragging, floater) =>
    dragging !== -1 && (dragging === PD_ORIGIN || floater === PD_ORIGIN);

/**
 * What Jake calls a preset, which is not always its key: the `quadrille` is
 * **classic** everywhere a person reads it, and has been since the first
 * version of this page. `presetName` in `src/math/seed.js` answers which preset
 * a seed IS; this is what to call it, and the preset picker and the floating
 * panel's title bar both go through here so they cannot disagree.
 * @type {(name: string) => string}
 */
export const presetLabel = (name) => (name === "quadrille" ? "classic" : name);

/**
 * Make an element a scrollable value box -- the Reticulum's `.exp-box`.
 *
 * Jake, 2026-11-25: *two fields with scrollable values... much like the I,
 * lambda and phi fields of the reticulum.* Which means three gestures, because
 * a box you can only scroll is a box a trackpad user can only fight: the wheel,
 * a click for one step up, and the arrows or w/s when it has focus.
 *
 * `preventDefault` is the load-bearing one. Without it the wheel scrolls the
 * page (or the floating panel) out from under the pointer while the value
 * changes, which reads as the control being broken.
 *
 * Exported because the anchored row and the panel both need it, and because a
 * test can call `step` without a browser.
 * @param {HTMLElement} box
 * @param {(by: number) => void} step called with +1 or -1
 */
export function bindScroll(box, step) {
    box.addEventListener("wheel", (ev) => {
        /** @type {WheelEvent} */ (ev).preventDefault?.();
        step(/** @type {WheelEvent} */ (ev).deltaY < 0 ? 1 : -1);
    }, { passive: false });
    box.addEventListener("click", () => step(1));
    box.addEventListener("keydown", (ev) => {
        const k = /** @type {KeyboardEvent} */ (ev).key;
        const by = k === "ArrowUp" || k === "w" || k === "W" ? 1
            : k === "ArrowDown" || k === "s" || k === "S" ? -1 : 0;
        if (!by) return;
        ev.preventDefault?.();
        step(by);
    });
}

/**
 * Wire button-and-drop pairs so that pressing one unfolds it and folds the
 * others.
 *
 * Jake, 2026-11-25: *when you press either of them dropdown unfolds from the
 * bottom... push presets or settings again to hide them, or another dropdown
 * button.* So: a toggle, and at most one open. The Reticulum does exactly this
 * with two lines per button; this is those two lines for n buttons, so the page
 * and the panel cannot grow different ideas about it.
 *
 * The open button is marked `on`, which the Reticulum's is not -- see the
 * stylesheet for why.
 * @param {readonly (readonly [HTMLElement, HTMLElement])[]} pairs
 */
export function bindDrops(pairs) {
    const mark = () => {
        for (const [btn, drop] of pairs)
            btn.className = drop.hidden ? "pd-bump" : "pd-bump on";
    };
    for (const [btn, drop] of pairs) {
        drop.hidden = true;
        btn.addEventListener("click", () => {
            const show = drop.hidden;
            for (const [, d] of pairs) d.hidden = true;
            drop.hidden = !show;
            mark();
        });
    }
    mark();
}

/**
 * Put a box's state on a real checkbox: checked, and grayed when it is locked.
 *
 * `disabled` is the whole mechanism -- it grays the box, grays a check inside
 * it, and stops the event -- so there is no "can I click this" branch anywhere
 * in either mount's handlers.
 * @type {(input: HTMLInputElement, box: Box) => void}
 */
export const setBox = (input, box) => {
    input.checked = box.on;
    input.disabled = box.locked;
};

/**
 * The four boxes, from the seed and the two settings.
 *
 * Pure, and exported, because both mounts draw the same row and a rule about
 * when a box grays is not a thing to write twice.
 *
 * @param {Seed} seed
 * @param {{ snap?: Snap, fine?: boolean, moving?: boolean }} state the two
 *   settings as the page holds them, and whether a drag is moving the center
 * @returns {GridBoxes}
 */
export function gridBoxes(seed, state = {}) {
    const atCentroid = samePt(seed.origin, centroidOf(seed.points));
    const atIntegral = samePt(seed.origin, integralCentroid(seed.points));
    // The fifths are FORCED wherever only the fifths can say where the center
    // is: off a unit, or on its way off one. The box then reads checked and
    // grayed, because turning them off there would be turning off the only
    // grid the center is on.
    const forced = !onUnit(seed.origin) || state.moving === true;
    return {
        // Never locked. `real` comes up unchecked because `snapForSeed` reads
        // the figure, not because the box is unavailable -- Jake: *except for
        // real preset, can be checked.*
        snap: { on: state.snap !== "none", locked: false },
        fine: { on: forced || state.fine === true, locked: forced },
        actual: { on: atCentroid, locked: atCentroid },
        closest: { on: atIntegral, locked: atIntegral },
    };
}

/** @typedef {"none" | "transparent" | "solid"} Face */
/** @typedef {"none" | "thin" | "thick"} Edge */

/**
 * How the figure is drawn. All optional; what is left out keeps its default.
 *
 * `extrapolate` is in HALF generations, 0 being the five points themselves —
 * off the base rung the figure shown is derived, so its corners stop being
 * handles and the fence stops being drawn.
 *
 * **Neither control row sets it any more.** Jake, 2026-11-25: *we don't need
 * the use button. Just move the handles to their appointed area.* So the
 * `extrapolate` row walks the SEED (`walkSeed`) and leaves this at 0, which is
 * why the handles are always live. Deriving a figure without moving the five is
 * still what this field does, and `sync` still honors it, for a page that wants
 * to look at a rung without taking it.
 *
 * `order` is the OUTPUT's generation, which is not the instrument's business
 * to draw and is the instrument's business to hold. Jake, 2026-11-25: *we're
 * going to move the gen functionality to the pentadiculum from the output.* It
 * rides in the view so the anchored row and the floating panel cannot disagree
 * about it, and the page reads it back through `onViewChange`.
 *
 * @typedef {object} View
 * @property {number} [extrapolate]
 * @property {number} [order] the output's generation, for the page to draw at
 * @property {Face} [face]
 * @property {Edge} [edge]
 * @property {boolean} [vectors] the five point-to-point arrows, with values
 * @property {boolean} [fence] the legal origins, at the base rung
 * @property {boolean} [spokes] origin-to-corner rays
 * @property {Snap} [snap]
 * @property {boolean} [fifths] rule each unit square into fifths as well --
 *   the `fine` box, and only its SETTING: the grid is forced on regardless
 *   whenever the center is off a unit. See `gridBoxes`.
 * @property {number} [floater] which handle is driven by the others: a point
 *   index, `PD_ORIGIN`, or -1 for none. See `moveHandle` in `src/math/seed.js`.
 */

/**
 * What a Pentadiculum looks like before anybody says otherwise.
 *
 * The face is TRANSPARENT. Jake, 2026-11-24, splitting the input figure's
 * face and edge controls off from the output's: *default it to thin and
 * transparent.* The instrument's job is to show you five points **on a
 * lattice** -- the fifths, the unit lines, the fence and the sweet spot all run
 * underneath the figure, and a solid fill hides every one of them. A tiling
 * wants solid fills; this is not a tiling.
 * @type {Required<View>}
 */
const VIEW = {
    extrapolate: 0, order: 2, face: "transparent", edge: "thin",
    vectors: false, fence: true, spokes: true, snap: "units",
    // The fifths are OFF by default. Jake, 2026-11-24: *fine off by default,
    // unchecked if possible, checked (grayed) if centroid is not on a unit.*
    // Which is the better rule than always-on, because it makes the fine grid
    // MEAN something: it is up exactly when the center is somewhere the unit
    // lattice cannot describe. Close up, with the center on a unit, the fifths
    // were only ever a thicket over the grid you were reading.
    fifths: false,
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
 * @property {GridBoxes} boxes the grid and centroid boxes, so a page's control
 *   row can be set from the same draw that moved the figure
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

/**
 * How far the ladder row will climb and fall, in half generations.
 *
 * The same bounds the page has always used. Up is further than down because
 * inflation grows by phi^2 and the frame keeps up, while deflation shrinks
 * toward a figure whose corners are a pixel apart.
 */
const LADDER_UP = 6;
const LADDER_DOWN = -4;

/**
 * How far the `order` field will climb and fall: the output's generation.
 *
 * The page's own bounds, moved here with the control. 6 is where the page's
 * slider always stopped, and it is a bound on the NUMBER rather than on the
 * work -- the page still clamps the generation down until the tile count is
 * drawable, because at generation 5 a Pe5 is 12,161 tiles and a Sun is 42,376.
 */
const ORDER_UP = 6;
const ORDER_DOWN = 0;

/** The largest cell the fit will use, as a multiple of `cell`. */
const CAP_CELLS = 3;

/**
 * How big a handle is drawn, in PIXELS, and therefore how big its target is.
 *
 * One pair of numbers for both jobs on purpose. The hit test used to be 2.5
 * LATTICE UNITS, which is a different size on every seed and at every zoom:
 * most of the `even` pentad at rest, and the whole canvas once you had zoomed
 * in to place a corner. So every press landed on a handle, the paper could
 * never be panned, and a press meant to miss did not. Jake, 2026-11-24: *it
 * seems to grab handles when the mouse is still on the grid. Make the target
 * within the handles.*
 */
const HANDLE_R = 8;          // a numbered corner
const ORIGIN_R = 6.5;        // the center, when it is a handle
/** How solid a handle is while it is being dragged. See `shown.forEach`. */
const HELD_ALPHA = 0.4;

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
        shown: [], fence: [], sweet: false, boxes: gridBoxes(seed, view),
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
        const boxes = gridBoxes(seed, {
            snap: view.snap, fine: view.fifths,
            moving: centerMoves(dragging, view.floater),
        });

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
        //
        // Which it is comes from the BOXES, not straight from `view.fifths`:
        // the fine grid is forced on while the center is off a unit or on its
        // way off one, and the control row grays itself from the same answer.
        paper(ctx, w, h, ox, oy, k, boxes.fine.on ? GRID_FIFTHS : GRID_LEVELS);

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
                // A HELD handle goes translucent, so the lattice it is being
                // placed on reads straight through the thing in the way of it.
                // Jake, 2026-11-24: *make handle transparent during movement so
                // user can see grid underneath.* The dashed floater ring stays
                // solid -- it is around the handle, not over the paper.
                const held = i === dragging;
                ctx.globalAlpha = held ? HELD_ALPHA : 1;
                ctx.fillStyle = held ? INK : HOT;
                ctx.beginPath();
                ctx.arc(x, y, HANDLE_R, 0, TAU);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.fillText(String(i), x, y + 0.5);
                ctx.globalAlpha = 1;
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
        if (dragging === PD_ORIGIN) ctx.globalAlpha = HELD_ALPHA;
        ctx.beginPath();
        ctx.arc(ox, oy, originHandle ? ORIGIN_R : 3, 0, TAU);
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
        ctx.globalAlpha = 1;
        if (base && view.floater === PD_ORIGIN) ring(ox, oy, 10);

        last = { cell: k, verdict, shown, fence, sweet, boxes };
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
     *
     * Measured in PIXELS against the radius each handle is actually drawn at,
     * so the target IS the handle you can see -- see `HANDLE_R`. Scored as a
     * fraction of that radius rather than as a raw distance, so a press at the
     * very edge of a corner does not beat one dead center on the origin.
     * @param {Pt} where
     * @returns {number}
     */
    function grab(where) {
        let best = -1, bestScore = Infinity;
        seed.points.forEach((p, i) => {
            const d = Math.hypot(p[0] - where[0], p[1] - where[1]) * scale / HANDLE_R;
            if (d <= 1 && d < bestScore) { bestScore = d; best = i; }
        });
        // The origin wins a tie: a pentagon dragged in small can bury it, and
        // then there would be no way to get it back.
        const dOrigin = Math.hypot(seed.origin[0] - where[0], seed.origin[1] - where[1])
            * scale / ORIGIN_R;
        if (dOrigin <= 1 && dOrigin <= bestScore) best = PD_ORIGIN;
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
 * @property {boolean} [read] false leaves the origin/centroid status line out.
 *   The floating panel passes it: Jake, 2026-11-26, *the "origin, centroid"
 *   status should not be in the floating part.* It was the first thing in the
 *   panel, so a decimal in the origin moved every control under it.
 * @property {() => void} [onClose] the floating panel's close button was
 *   pressed. The panel hides itself either way.
 * @property {(view: View) => void} [onViewChange] a control in the row changed
 *   the view: snap, fine, vectors, extrapolate, face or edges. A page that
 *   keeps any of those of its own has to follow, or the two disagree the moment
 *   you put the instrument back. Jake, 2026-11-24: *floating settings don't
 *   match with anchored when I flip back and forth.*
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
        // A drag re-anchors the walk: the five are where the hand put them now,
        // so "+2" would be measuring from a pentagon that no longer exists.
        onChange: (next) => { seed = next; setWalk?.(0); announce(); },
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
        // The row is read off the same draw that moved the figure, so a box
        // can never disagree with the canvas beside it.
        applyBoxes?.(drawn.boxes);
        // And the page hears the whole view, not just the seed. Every control
        // in the row goes through here, so one callback covers all of them --
        // which is why there is no longer an `onLadder` for the one that
        // happened to be noticed first.
        if (ready) opts.onViewChange?.({ ...view });
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

    /**
     * A new seed, drawn and announced.
     *
     * `walk` is where the extrapolate counter should read afterwards, and it
     * defaults to 0 because every OTHER way a seed arrives here -- a preset,
     * `reset`, the centroid buttons, the page handing one in -- is a fresh
     * figure, and a count of half generations from a figure that is gone would
     * be a count of nothing. Only `stepRung` passes a number.
     * @type {(next: Seed, refit?: boolean, walk?: number) => void}
     */
    const put = (next, refit = true, walk = 0) => {
        seed = next;
        // Snap follows the FIGURE, not the box: anything coarser than the five
        // already are would wreck them on the first drag. `announce` puts the
        // answer back on the box.
        view = { ...view, snap: snapForSeed(seed) };
        if (refit) pd.refit();
        setWalk?.(walk);
        announce();
    };

    /** Set the control row from a draw; null until there is a row to set.
     *  @type {((boxes: GridBoxes) => void) | null} */
    let applyBoxes = null;
    /** Put the extrapolate counter somewhere; null until the row exists.
     *  @type {((walk: number) => void) | null} */
    let setWalk = null;
    /**
     * Has the mount finished building?
     *
     * `announce` runs once during construction, and a page being told its view
     * changed before it has been handed the instrument is a page being told
     * about a change that did not happen. The seed's first `onChange` still
     * fires, because that one is the page's own seed coming back.
     */
    let ready = false;
    if (opts.controls !== false) {
        const row = el("div", "pentadiculum-ctl");

        // ── preset: a ROW OF BUTTONS, the Reticulum's way ──
        //
        // Jake, 2026-11-24: *preset on pentadiculum can behave like reticulum:
        // button with choices under.* `button.preset` in `site.css` is the
        // original -- 11px, 2px by 7px of padding, one per choice -- and it is
        // better than the dropdown for four reasons it is worth naming: the
        // choices are visible rather than hidden behind a click, switching is
        // one press instead of two, `custom` stops needing to be a fake choice
        // in the list (it is just *no button is current*), and the list comes
        // from `PRESETS` so it cannot fall out of step with the presets.
        //
        // `pd-preset` and not `preset`: `button.preset` in `site.css` is the
        // Reticulum's, and this project cannot import that stylesheet. Same
        // values, own name -- Jake, 2026-11-25: *use the same styles and
        // colors.*
        const presetRow = el("span", "pentadiculum-presets");
        /** @type {Map<string, HTMLElement>} */
        const presetBtns = new Map();
        /** The last preset actually chosen, which is what `reset` reloads. */
        let chosen = presetName(seed) === "custom" ? "quadrille" : presetName(seed);
        /** @type {(name: string) => void} */
        const loadPreset = (name) => {
            const preset = PRESETS[name];
            if (!preset) return;
            chosen = name;
            // A preset is five vectors FROM the origin, so loading one puts the
            // origin back where those vectors are measured from.
            put({ points: preset.map((p) => /** @type {Pt} */ ([p[0], p[1]])), origin: [0, 0] });
        };
        for (const name of Object.keys(PRESETS)) {
            const b = el("button", "pd-preset", presetLabel(name));
            b.title = `load the ${presetLabel(name)} pentagon`;
            b.addEventListener("click", () => loadPreset(name));
            presetBtns.set(name, b);
            presetRow.appendChild(b);
        }
        /** Mark whichever button the seed currently IS, or none of them. */
        const markPreset = () => {
            const now = presetName(seed);
            for (const [name, b] of presetBtns)
                b.className = name === now ? "pd-preset on" : "pd-preset";
        };

        // `reset` and not `origin`. Jake, 2026-11-24, on the two instruments
        // disagreeing: *some names like reset/origin, extrapolate/ladder.* The
        // page has always called this `reset` and it reloads the chosen preset,
        // which for every preset here also puts the origin back at (0, 0) --
        // so the old `origin` button was this one under another name and one
        // fewer thing it did.
        //
        // It sits IN the presets drop, dashed and italic, which is where the
        // Reticulum keeps `restore`: a verb among nouns, and the only thing in
        // that drop that does not name a figure.
        const reset = el("button", "pd-preset pd-verb", "reset");
        reset.title = "load the chosen preset again";
        reset.addEventListener("click", () => loadPreset(chosen));

        // ── presets and settings: two buttons, two drops ──────────────────
        //
        // Jake, 2026-11-25: *make presets and settings into buttons. When you
        // press either of them dropdown unfolds from the bottom... push presets
        // or settings again to hide them or another dropdown button.* Which is
        // the Reticulum's `presets`/`settings` pair exactly -- `.ret-bump` over
        // `.ret-presets` -- so `bindDrops` above is that behavior, shared.
        //
        // The drops are appended straight after the row that opens them, so one
        // unfolds downward and pushes the rest of the rows down rather than
        // floating over them. Nothing in a 372px panel wants to be covered.
        const presetsBtn = el("button", "pd-bump", "presets");
        presetsBtn.title = "the four seeds, and reset";
        const settingsBtn = el("button", "pd-bump", "settings");
        settingsBtn.title = "how the figure itself is drawn";
        row.append(presetsBtn, settingsBtn);

        const presetDrop = el("div", "pd-drop");
        presetDrop.append(reset, presetRow);
        const settingsDrop = el("div", "pd-drop pd-settings");
        bindDrops([[presetsBtn, presetDrop], [settingsBtn, settingsDrop]]);

        // ── extrapolate: a step MOVES the five ───────────────────────────
        //
        // Jake, 2026-11-25: *we don't need the use button. Just move the
        // handles to their appointed area. Just change the output dynamically
        // for both.* So a step is no longer a view of a derived figure that a
        // second click had to adopt -- it walks the seed itself, `walkSeed` in
        // `src/math/seed.js`. The handles stay live, the fence stays drawn, and
        // a page hears it as what it is: a new seed.
        //
        // `extrapolate`, not `ladder`: it is the page's name for the same
        // number and the two rows have to read alike. The number is how far
        // THIS instrument has walked the figure it holds, so it goes back to 0
        // whenever a seed arrives from anywhere else -- see `put`.
        //
        // `index`, not `extrapolate`: Jake, 2026-11-25, renaming both fields
        // when they became boxes -- *extrapolate is now `index` and gen is
        // `order`.*
        let walked = 0;
        setWalk = (walk) => { walked = walk; };
        /** @type {(by: number) => void} */
        const stepRung = (by) => {
            const next = Math.min(LADDER_UP, Math.max(LADDER_DOWN, walked + by));
            if (next === walked) return;
            // A rung is a different figure at a different size, so frame it
            // afresh rather than leaving it half out of the frame. `put` draws,
            // sets the row and tells the page.
            put(walkSeed(seed, by), true, next);
        };

        /** The output's generation, which this instrument holds for the page.
         *  @type {(by: number) => void} */
        const stepOrder = (by) => {
            const was = view.order ?? VIEW.order;
            const next = Math.min(ORDER_UP, Math.max(ORDER_DOWN, was + by));
            if (next === was) return;
            view = { ...view, order: next };
            // Nothing here draws a patch -- the page does, off `onViewChange`.
            announce();
        };

        // ── the bottom line: two scrollable fields ───────────────────────
        //
        // *The bottom line will contain the extrapolate and gen functionality.
        // It will be in the form of two fields with scrollable values... much
        // like the I, lambda and phi fields of the reticulum.* So: a word and a
        // fixed-width box each, scroll or click or arrow them. `index` walks the
        // five; `order` is the output's generation, moved off the output column
        // because this is the instrument that makes the figure it counts.
        const lineRow = el("div", "pentadiculum-ctl");
        /** A label and its box, the Reticulum's `.exp-term`.
         *  @type {(label: string, box: HTMLElement) => HTMLElement} */
        const term = (label, box) => {
            const t = el("span", "pd-term");
            t.append(el("span", "grp", label), box);
            return t;
        };
        const rungOut = el("button", "pd-box", "0");
        rungOut.title = "index: half generations the five have been walked. "
            + "Scroll it, click it, or use the arrows or w/s.";
        bindScroll(rungOut, (by) => stepRung(by * 0.5));
        const orderOut = el("button", "pd-box", String(view.order ?? VIEW.order));
        orderOut.title = "order: the generation the patch is expanded to. "
            + "Scroll it, click it, or use the arrows or w/s.";
        bindScroll(orderOut, stepOrder);
        lineRow.append(term("index", rungOut), term("order", orderOut));

        /** Each checkbox's label, so a section can append the pair.
         *  @type {Map<HTMLInputElement, HTMLElement>} */
        const labels = new Map();
        /** @type {(input: HTMLInputElement) => HTMLElement} */
        const labelOf = (input) => /** @type {HTMLElement} */ (labels.get(input));
        /**
         * A checkbox with its label, ready to append.
         * @type {(text: string, onToggle: () => void) => HTMLInputElement}
         */
        const check = (text, onToggle) => {
            const input = /** @type {HTMLInputElement} */ (el("input"));
            input.type = "checkbox";
            input.addEventListener("change", onToggle);
            const lab = el("label");
            lab.append(input, doc.createTextNode(` ${text}`));
            labels.set(input, lab);
            return input;
        };

        // ── grid: what a drag lands on, and which grid you see it land on ──
        //
        // Two boxes, not the old two-item menu, because they are two questions
        // and the menu could only answer one of them.
        const gridRow = el("div", "pentadiculum-ctl");
        const snapBox = check("snap", () => {
            view = { ...view, snap: snapBox.checked ? "units" : "none" };
            announce();
        });
        const fineBox = check("fine", () => {
            view = { ...view, fifths: fineBox.checked };
            announce();
        });
        gridRow.append(el("span", "grp", "grid"), labelOf(snapBox), labelOf(fineBox));

        // ── centroid: the two origins worth having, as two questions ──
        //
        // `actual` is the centroid itself -- the one origin where all three
        // rhomb spellings agree and each rhomb closes as an exact
        // parallelogram. `closest` is that point rounded to a lattice unit,
        // which keeps the spokes integral instead. On an EVEN pentad they are
        // the same point and both boxes come up checked, which is the quickest
        // way to see that a seed is even.
        const centroidRow = el("div", "pentadiculum-ctl");
        const actualBox = check("actual", () =>
            put({ points: seed.points, origin: centroidOf(seed.points) }));
        const closestBox = check("closest", () => {
            // Jake, 2026-11-24: *Fine checkbox will be reset.* The whole point
            // of this box is to get the center back onto a unit, where the
            // fifths have nothing left to say.
            view = { ...view, fifths: false };
            put({ points: seed.points, origin: integralCentroid(seed.points) });
        });
        centroidRow.append(el("span", "grp", "centroid"),
            labelOf(actualBox), labelOf(closestBox));

        // ── display ──
        const displayRow = el("div", "pentadiculum-ctl");
        const vectors = check("vectors", () => {
            view = { ...view, vectors: vectors.checked };
            announce();
        });
        displayRow.append(el("span", "grp", "display"), labelOf(vectors));

        // ── settings: the figure's own face and edges ──
        //
        // Jake, 2026-11-24: *settings and its unfold missing.* They were the
        // page's, on the reasoning that a face is how a page draws a thing
        // rather than anything about the thing -- and then the panel could not
        // reach them, which made the instrument less than the column it
        // replaces. They are the instrument's now, and the page follows through
        // `onViewChange`.
        //
        // In the drop rather than a `<details>` as of 2026-11-25: the fold was
        // a second idea about what a disclosure looks like, two rows above the
        // Reticulum's. One pattern, two buttons.
        /** @type {(label: string, values: readonly string[], now: string,
         *          set: (v: string) => void) => void} */
        const picker = (label, values, now, set) => {
            const line = el("div");
            const pick = /** @type {HTMLSelectElement} */ (el("select"));
            for (const v of values) {
                const o = /** @type {HTMLOptionElement} */ (doc.createElement("option"));
                o.value = v;
                o.textContent = v;
                pick.appendChild(o);
            }
            pick.value = now;
            pick.addEventListener("change", () => { set(pick.value); announce(); });
            line.append(el("span", "grp", label), pick);
            settingsDrop.appendChild(line);
        };
        picker("face", ["transparent", "solid", "none"],
            /** @type {string} */ (view.face ?? VIEW.face),
            (v) => { view = { ...view, face: /** @type {Face} */ (v) }; });
        picker("edges", ["thin", "thick", "none"],
            /** @type {string} */ (view.edge ?? VIEW.edge),
            (v) => { view = { ...view, edge: /** @type {Edge} */ (v) }; });

        applyBoxes = (boxes) => {
            setBox(snapBox, boxes.snap);
            setBox(fineBox, boxes.fine);
            setBox(actualBox, boxes.actual);
            setBox(closestBox, boxes.closest);
            vectors.checked = view.vectors === true;
            rungOut.textContent = walked > 0 ? `+${walked}` : String(walked);
            orderOut.textContent = String(view.order ?? VIEW.order);
            markPreset();
        };

        // The drops come straight after the buttons, so they unfold downward.
        //
        // The status goes FIRST or not at all. A host that keeps its own --
        // this project's page does, at a fixed height under the panel's bar --
        // passes `read: false`, and the controls then start at the top of the
        // body where nothing above them can move them.
        if (opts.read !== false) wrap.appendChild(read);
        wrap.append(row, presetDrop, settingsDrop,
            gridRow, centroidRow, displayRow, lineRow);
    } else if (opts.read !== false) {
        wrap.appendChild(read);
    }

    host.appendChild(wrap);
    announce();
    ready = true;

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

// ── the floating panel ────────────────────────────────────────────────────
//
// The Reticulum's panel, grown here rather than imported. `createFloatingPanel`
// in `src/ui/floating.ts` does all of this already and better, and this project
// cannot have it: that file compiles to `dist/`, `dist/` is gitignored and built
// in CI, and `tsconfig.json` here says *there is no build step and never will
// be: the browser loads the files as they are*. Importing it would give a
// plain-JS page that works on the deployed site and 404s on a fresh clone.
//
// So the behavior is duplicated on purpose, and the LOOK is matched on purpose
// too -- `lib/css/pentadiculum.css` holds its own copy of `lib/css/panel.css`'s
// values so the two read as one site while this project stays droppable onto a
// page that has never heard of it.

/**
 * Where a panel sits, how wide it is, and whether it is folded.
 * @typedef {{ x: number, y: number, w: number, collapsed: boolean }} Placed
 */

/** Narrowest and widest the grip will take a panel, in CSS pixels. */
const PANEL_MIN = 300;
const PANEL_MAX = 900;
/** The body's padding, both sides, from the stylesheet. */
const PANEL_PAD = 22;
/** How much of the title bar has to stay on screen to be grabbable again. */
const BAR_SHOW = 56;
/** The panel's own default width, which is the Reticulum's. */
const PANEL_W = 372;

/** @type {(id: string) => string} */
const storeKey = (id) => `pentadiculum:panel:${id}`;

/**
 * The stored place, or null.
 *
 * Every access is guarded: `localStorage` throws outright in a private window
 * and is absent in Node, and a panel that cannot remember where it was is a
 * panel in its default position, not a broken page.
 * @type {(id: string) => Placed | null}
 */
function readPlace(id) {
    try {
        const raw = globalThis.localStorage?.getItem(storeKey(id));
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
        return { x: p.x, y: p.y, w: typeof p.w === "number" ? p.w : PANEL_W,
                 collapsed: p.collapsed === true };
    } catch { return null; }
}

/** @type {(id: string, p: Placed) => void} */
function writePlace(id, p) {
    try { globalThis.localStorage?.setItem(storeKey(id), JSON.stringify(p)); }
    catch { /* nothing to do about it, and nothing to say */ }
}

/** @type {(id: string) => void} */
function forgetPlace(id) {
    try { globalThis.localStorage?.removeItem(storeKey(id)); }
    catch { /* as above */ }
}

/**
 * The same instrument, in a panel that floats over the page and can be dragged
 * by its title bar — the Reticulum's trick, and for the same reason: on a page
 * whose subject is the OUTPUT, the seed wants to be at hand without taking a
 * column of layout.
 *
 * It appends its panel to `document.body` itself.
 *
 * The bar names the SEED, not just the panel: `pentadiculum — even`, from
 * `presetName`, with the origin added when the panel is folded. Folding it to a
 * bar should not cost you the two things you were reading.
 *
 * @param {MountOptions & {
 *   title?: string, at?: [number, number], id?: string, width?: number,
 * }} [options] `id` keys the stored position, so two panels on one page keep
 *   their own places
 */
export function mountFloatingPentadiculum(options = {}) {
    const doc = options.document ?? globalThis.document;
    const id = options.id ?? "pentadiculum";
    const title = options.title ?? "pentadiculum";

    const panel = doc.createElement("div");
    panel.className = "pentadiculum-panel";
    const bar = doc.createElement("div");
    bar.className = "pentadiculum-bar";

    const titleEl = doc.createElement("span");
    titleEl.className = "pentadiculum-title";
    bar.appendChild(titleEl);

    // A slot for a control that belongs to the PANEL rather than to the
    // instrument inside it -- the Reticulum's `restore` being the case it was
    // added for there. Empty and invisible until a page puts something in it.
    const extras = doc.createElement("span");
    extras.className = "pentadiculum-extras";
    bar.appendChild(extras);

    const fold = doc.createElement("button");
    fold.className = "pentadiculum-fold";
    fold.title = "fold to the bar";
    bar.appendChild(fold);

    const shut = doc.createElement("button");
    shut.className = "pentadiculum-shut";
    shut.textContent = "×";
    shut.title = "close";
    bar.appendChild(shut);

    panel.appendChild(bar);
    const body = doc.createElement("div");
    body.className = "pentadiculum-body";
    panel.appendChild(body);

    // The resize grip, bottom right. It sizes the CANVAS, not just the box: a
    // wider panel with the same 340px figure in it would be a wider panel and
    // nothing else.
    const grip = doc.createElement("div");
    grip.className = "pentadiculum-grip";
    grip.title = "drag to resize";
    panel.appendChild(grip);

    /** Where the panel sits. Kept here rather than read back off the element:
     *  `offsetLeft` forces a layout on every pointermove, and it is the wrong
     *  number the moment a stylesheet transforms the panel. @type {Placed} */
    let place = readPlace(id) ?? {
        x: options.at?.[0] ?? 24, y: options.at?.[1] ?? 24,
        w: options.width ?? PANEL_W, collapsed: false,
    };

    /**
     * Keep it reachable. A panel dragged mostly off the right edge, or a window
     * that has since been made narrow, must still leave enough bar to grab --
     * otherwise the only way to move it is the thing that is out of reach.
     */
    function clamp() {
        const vw = globalThis.innerWidth || 1200;
        const vh = globalThis.innerHeight || 800;
        place.w = Math.min(PANEL_MAX, Math.max(PANEL_MIN, place.w));
        place.x = Math.min(Math.max(BAR_SHOW - place.w, place.x), Math.max(0, vw - BAR_SHOW));
        place.y = Math.min(Math.max(0, place.y), Math.max(0, vh - 28));
    }

    const put = () => {
        panel.style.left = `${place.x}px`;
        panel.style.top = `${place.y}px`;
        panel.style.width = `${place.w}px`;
        body.style.display = place.collapsed ? "none" : "";
        grip.style.display = place.collapsed ? "none" : "";
        fold.textContent = place.collapsed ? "▸" : "▾";
        fold.title = place.collapsed ? "unfold" : "fold to the bar";
    };

    // `mountPentadiculum` announces once while it is being built, so the
    // wrapper below would reach `mounted` before it is bound -- a TDZ throw,
    // and the panel would never appear at all. The page's own `onChange` still
    // gets that first call, which is what it has always got; only the bar waits
    // for the instrument to exist, and is written once below.
    let ready = false;
    const mounted = mountPentadiculum(body, {
        ...options,
        // The panel does not carry the status: it is the page's, under the
        // anchored bar, where it has a fixed height and cannot move the
        // controls. The bar here still shows the origin when folded, which is
        // the one moment the panel has no row to show it in.
        read: false,
        // The bar names the seed, so it has to hear about every change the
        // instrument makes -- and then pass it on, because the page asked
        // first.
        onChange: (seed) => { if (ready) name(); options.onChange?.(seed); },
    });
    ready = true;

    /** @type {(v: number) => string} */
    const num = (v) => Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");

    /** Write the bar: the panel's name, the seed's name, and when folded, the
     *  two numbers the readout would have been showing. */
    function name() {
        const seed = mounted.seed();
        let text = `${title} — ${presetLabel(presetName(seed))}`;
        if (place.collapsed) {
            text += `  (${num(seed.origin[0])}, ${num(seed.origin[1])})`;
            if (mounted.pentadiculum.drawn().sweet) text += " · sweet";
        }
        titleEl.textContent = text;
    }

    clamp();
    put();
    doc.body.appendChild(panel);

    /** Fit the canvas to the panel, and redraw at the new size. */
    function sizeCanvas() {
        const canvas = mounted.pentadiculum.canvas;
        const side = Math.round(Math.max(PANEL_MIN, place.w) - PANEL_PAD);
        if (!canvas || canvas.width === side) return;
        canvas.width = side;
        canvas.height = side;
        mounted.refit();
    }
    sizeCanvas();
    name();

    // Dragged by the bar, and by the bar only: inside the body the pointer
    // belongs to the figure, where a drag means moving a point. The buttons are
    // in the bar, so a press on one of them is not a drag either.
    let from = /** @type {[number, number] | null} */ (null);
    bar.addEventListener("pointerdown", (ev) => {
        if (ev.target === shut || ev.target === fold) return;
        from = [ev.clientX - place.x, ev.clientY - place.y];
        if (typeof bar.setPointerCapture === "function") bar.setPointerCapture(ev.pointerId);
    });
    bar.addEventListener("pointermove", (ev) => {
        if (!from) return;
        place.x = ev.clientX - from[0];
        place.y = ev.clientY - from[1];
        clamp();
        put();
    });
    const letGo = () => {
        if (!from) return;
        from = null;
        writePlace(id, place);
    };
    bar.addEventListener("pointerup", letGo);
    bar.addEventListener("pointercancel", letGo);

    // The grip. Width only: the figure is square and the body's height follows
    // it, so a separate height would only ever add whitespace.
    let grabbedAt = /** @type {number | null} */ (null);
    grip.addEventListener("pointerdown", (ev) => {
        grabbedAt = ev.clientX - place.w;
        if (typeof grip.setPointerCapture === "function") grip.setPointerCapture(ev.pointerId);
        ev.preventDefault?.();
    });
    grip.addEventListener("pointermove", (ev) => {
        if (grabbedAt === null) return;
        place.w = ev.clientX - grabbedAt;
        clamp();
        put();
        sizeCanvas();
    });
    const dropGrip = () => {
        if (grabbedAt === null) return;
        grabbedAt = null;
        writePlace(id, place);
    };
    grip.addEventListener("pointerup", dropGrip);
    grip.addEventListener("pointercancel", dropGrip);

    /** @type {(on: boolean) => void} */
    const show = (on) => {
        panel.hidden = !on;
        if (on) { clamp(); put(); }
    };

    /** @type {(on: boolean) => void} */
    const collapse = (on) => {
        place.collapsed = on;
        put();
        name();
        writePlace(id, place);
        if (!on) mounted.refit();
    };
    fold.addEventListener("click", () => collapse(!place.collapsed));
    shut.addEventListener("click", () => { show(false); options.onClose?.(); });

    // A window made smaller can leave a panel outside it, and the panel is the
    // only way to move the panel. So the clamp runs again when the viewport
    // changes, not only when something is dragged.
    const onResize = () => { clamp(); put(); };
    globalThis.addEventListener?.("resize", onResize);

    return {
        ...mounted,
        panel,
        /** The slot in the bar, left of fold and close, for the page's own control. */
        barExtras: extras,
        /** Where it sits, and how to move it from code. */
        at: () => /** @type {[number, number]} */ ([place.x, place.y]),
        /** @type {(x: number, y: number) => void} */
        moveTo(x, y) { place.x = x; place.y = y; clamp(); put(); writePlace(id, place); },
        width: () => place.w,
        show,
        hide: () => show(false),
        toggle: () => { show(panel.hidden !== false); },
        isOpen: () => panel.hidden === false,
        collapse,
        isCollapsed: () => place.collapsed,
        /**
         * Put it back where it started, open and unfolded, and forget the
         * stored place.
         *
         * A panel dragged somewhere unhelpful -- behind another one, or into a
         * corner of a window that is now a different size -- cannot be
         * recovered by anything on the panel itself, because the way to reach
         * it is the thing that is lost. So the rescue comes from outside.
         */
        resetPlace() {
            forgetPlace(id);
            place = {
                x: options.at?.[0] ?? 24, y: options.at?.[1] ?? 24,
                w: options.width ?? PANEL_W, collapsed: false,
            };
            clamp();
            put();
            sizeCanvas();
            name();
            show(true);
        },
        /** Name the bar again: for a page that changed the seed from outside. */
        rename: name,
        destroy() {
            globalThis.removeEventListener?.("resize", onResize);
            mounted.destroy();
            panel.remove?.();
        },
    };
}
