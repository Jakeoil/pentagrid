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
// THE GEOMETRY IT PRESENTS — Gaussean Pentadic Geometry, Jake's name for it:
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
    PENTA_UP, PRESETS, centroidOf, checkSeed, originFence, spokesOf, wheelsAt,
} from "../../lib/wheels.js";
import { pentagon } from "../../lib/tiles.js";
import { EDGE_INK, HOT, INK, TAU, paper, poly } from "./draw.js";
import { drawNumeral, numeralWidth } from "./numerals.js";
import { fibCell, fitStep } from "./fit.js";

/** @typedef {import("../../lib/wheels.js").Pt} Pt */

/**
 * A seed: five ordered positions and the point their spokes are measured from.
 * @typedef {{ points: readonly Pt[], origin: Pt }} Seed
 */

/**
 * What a dragged handle lands on.
 *
 * `fifths` is here because of the centroid: the sweet spot where all three
 * rhomb spellings agree is always in (1/5)Z², so "on the lattice or nowhere"
 * could not reach it. `none` still quantizes, at 1/256 — a pointer has pixels,
 * and a coordinate that reads to sixteen places is not a coordinate anyone can
 * use.
 * @typedef {"units" | "fifths" | "none"} Snap
 */
/** @type {readonly Snap[]} */
export const SNAPS = ["units", "fifths", "none"];

/** One coordinate, snapped. @type {(snap: Snap, v: number) => number} */
export const snapped = (snap, v) => snap === "units" ? Math.round(v)
    : snap === "fifths" ? Math.round(v * 5) / 5
    : Math.round(v * 256) / 256;

/**
 * The finest snap a seed is already on. Anything coarser would wreck it on the
 * first drag, which is why a preset or an adoption sets the control from the
 * figure rather than the other way about.
 * @param {Seed} seed
 * @returns {Snap}
 */
export function snapForSeed(seed) {
    const all = [...seed.points, seed.origin].flat();
    return all.every((v) => Number.isInteger(v)) ? "units"
        : all.every((v) => Number.isInteger(v * 5)) ? "fifths"
        : "none";
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
 * @typedef {object} View
 * @property {number} [extrapolate]
 * @property {Face} [face]
 * @property {Edge} [edge]
 * @property {boolean} [vectors] the five point-to-point arrows, with values
 * @property {boolean} [fence] the legal origins, at the base rung
 * @property {boolean} [spokes] origin-to-corner rays
 * @property {Snap} [snap]
 */

/** @type {Required<View>} */
const VIEW = {
    extrapolate: 0, face: "solid", edge: "thin",
    vectors: false, fence: true, spokes: true, snap: "units",
};

/**
 * What one draw worked out, handed back so a page can put it in a readout
 * without recomputing any of it.
 * @typedef {object} Drawn
 * @property {number} cell pixels per lattice unit, the Fibonacci one
 * @property {ReturnType<typeof checkSeed>} verdict
 * @property {readonly Pt[]} shown the figure at the chosen rung, in spoke space
 * @property {readonly Pt[]} fence the legal origins, empty off the base rung
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
 * @property {(view: { zoom: number }) => void} [onView]
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
    const opts = { size: 340, cell: 26, margin: 0.40, ...options };
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
    let overflow = false;
    let settling = 0;
    let scale = opts.cell;       // what `pick` divides by; frozen while dragging
    const ZOOM = { min: 0.1, max: 12 };

    /** A point index, PD_ORIGIN for the origin, or -1 for nothing. */
    let dragging = -1;

    const atBase = () => view.extrapolate === 0;

    /** Coordinates under the pointer, snapped. @type {(ev: { clientX: number, clientY: number }) => Pt} */
    function pick(ev) {
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / (r.width || canvas.width);
        const sy = canvas.height / (r.height || canvas.height);
        const x = ((ev.clientX - r.left) * sx - canvas.width / 2) / scale;
        const y = ((ev.clientY - r.top) * sy - canvas.height / 2) / scale;
        return [snapped(view.snap, x), snapped(view.snap, y)];
    }

    /** @type {Drawn} */
    let last = { cell: opts.cell, verdict: { ok: true, why: "" }, shown: [], fence: [] };

    /**
     * Draw the seed as the view says, and report what that took.
     * @param {Seed} [next] the seed to draw; the last one again when left out
     * @param {View} [nextView] only the keys given are changed
     * @returns {Drawn}
     */
    function sync(next, nextView) {
        if (next) seed = next;
        if (nextView) view = { ...view, ...nextView };
        const ctx = canvas.getContext("2d");
        if (!ctx) return last;
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const spk = spokesOf(seed);
        const base = atBase();

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
        // Fibonacci cell sizes, and the ladder runs below 1 as well as above:
        // rounded DOWN from the fit, so a figure that fitted still fits.
        const k = fibCell(fit * zoom);
        if (dragging < 0) scale = k;

        // The paper hangs off the ORIGIN, not off the canvas, so its 0,0 axes
        // run through the origin wherever it has been dragged to.
        const ox = cx + seed.origin[0] * k, oy = cy + seed.origin[1] * k;
        paper(ctx, w, h, ox, oy, k);

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
        ctx.beginPath();
        ctx.arc(ox, oy, base ? 6.5 : 3, 0, TAU);
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

        last = { cell: k, verdict, shown, fence };
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
        if (settling || dragging >= 0 || !overflow) return;
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

    on("pointerdown", (ev) => {
        if (!atBase()) return;        // only the five themselves are editable
        const at = pick(ev);
        let best = -1, bestD = 2.5;
        seed.points.forEach((p, i) => {
            const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
            if (d < bestD) { bestD = d; best = i; }
        });
        // The origin wins a tie: a pentagon dragged in small can bury it, and
        // then there would be no way to get it back.
        const dOrigin = Math.hypot(seed.origin[0] - at[0], seed.origin[1] - at[1]);
        if (dOrigin <= bestD) { bestD = dOrigin; best = PD_ORIGIN; }
        dragging = best;
        if (best >= 0) {
            if (typeof canvas.setPointerCapture === "function")
                canvas.setPointerCapture(ev.pointerId);
            sync();
        }
    });
    on("pointermove", (ev) => {
        if (dragging < 0) return;
        const at = pick(ev);
        const was = dragging === PD_ORIGIN ? seed.origin : seed.points[dragging];
        if (at[0] === was[0] && at[1] === was[1]) return;
        const next = dragging === PD_ORIGIN
            ? { points: seed.points, origin: at }
            : { points: seed.points.map((p, i) => (i === dragging ? at : p)), origin: seed.origin };
        seed = next;
        // Drawn FIRST, then announced: a consumer's `onChange` usually wants to
        // put the new verdict in a readout, and `drawn()` should already be the
        // seed it was handed rather than the one before it.
        sync();
        opts.onChange?.(next, dragging === PD_ORIGIN ? "origin" : "point");
    });
    const drop = () => {
        if (dragging < 0) return;
        dragging = -1;
        sync();
        settle();
    };
    on("pointerup", drop);
    on("pointercancel", drop);

    // Scroll to zoom, about the CENTER rather than the pointer. The origin is a
    // real thing on this figure — the spokes run from it and the wheel is
    // measured about it — so it stays put and there is no pan to go with the
    // zoom. Double-click puts it back and refits.
    on("wheel", (ev) => {
        ev.preventDefault?.();
        const by = Math.exp(-(ev.deltaY ?? 0) * 0.0015);
        zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom * by));
        sync();
        opts.onView?.({ zoom });
    }, { passive: false });
    on("dblclick", () => {
        zoom = 1;
        fit = 0;
        sync();
        opts.onView?.({ zoom });
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
        /** Zoom and the auto-fit, back to where they started. */
        reset: () => { zoom = 1; fit = 0; },
        zoom: () => zoom,
        /** Which handle is under the pointer, or -1. */
        dragging: () => dragging,
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

/** `dragging` is a point index, or this for the origin. */
export const PD_ORIGIN = 5;

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
            + (drawn.verdict.ok ? "" : ` &mdash; ${drawn.verdict.why}`);
        opts.onChange?.(seed);
    }
    /** @type {(v: number) => string} */
    const fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");

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
            o.textContent = name === "fifths" ? "⅕" : name;
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

        // The centroid: the one origin where all three rhomb spellings agree
        // and each closes as an exact parallelogram. It is in fifths, so snap
        // follows it down rather than being switched off.
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
