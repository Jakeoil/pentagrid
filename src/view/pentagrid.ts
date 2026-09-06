import type {
    Concurrency, Pentagrid, Rhomb, SmallRegion, Vec2, ViewRect,
} from "../geometry/types.js";
import {
    NUM_GRIDS, collectRhombs as geoCollectRhombs, computeKTuple as geoComputeKTuple,
    makeDirections, solveIntersection as geoSolveIntersection,
} from "../geometry/pentagrid.js";
import { scanRegions, singularTriples as geoSingularTriples } from "../geometry/regularity.js";
import { regionPoly as geoRegionPoly } from "../geometry/region.js";
import { rhombArcs } from "../geometry/decor.js";
import { LayerStack } from "./layers.js";
import { createGammaBank } from "../ui/dials.js";
import { createLoupe } from "../ui/loupe.js";
import type { LoupeTarget } from "../ui/loupe.js";
import type { Layer, LayerContext } from "./layers.js";

import { METHOD_STEPS } from "../app/method-steps.js";

// Grid line colors
const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];

// Rhomb fill colors
const THICK_FILL = "#e8c170";
const THIN_FILL = "#7eb8da";

// Unicode subscripts for K labels
const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄'];


export interface Features {
    /** The pentagrid itself. Separate from a family's userVisible, which also
     *  removes the rhombs that family generates. */
    gridLines: boolean;
    axes: boolean;
    kRegions: boolean;
    kLabels: boolean;
    intersectionDots: boolean;
    penroseTiles: boolean;
    penroseEdges: boolean;
    penroseVertices: boolean;
    penroseDecor: boolean;
    hoverVertex: boolean;   // region hover -> its Penrose vertex
    hoverTile: boolean;     // intersection hover -> its Penrose tile
}

export interface ViewState {
    scale: number;
    viewX: number; viewY: number;
    w: number; h: number;
    margin: number;
}

export interface StepSpec { title: string; html: string; }

export interface PentagridConfig {
    /** Where the canvases go. Also the source of implicit sizing. */
    container: HTMLElement;
    controls?: HTMLElement;
    stepNav?: HTMLElement;
    panel?: HTMLElement;
    explanation?: HTMLElement;
    /** Narration. Omit for a page with no steps. */
    steps?: StepSpec[];
    /** Which features each step turns on. Must match steps in length. */
    presets?: Partial<Features>[];
    /** Registered before the first draw, so an exploration gets its own layers
     *  without this file knowing anything about them. */
    layers?: (ctx: PentagridParts) => void;
    /** A stamp to show beside the step indicator. */
    buildId?: string;
    /** Starting feature set. Useful for a page with no steps to impose one. */
    features?: Partial<Features>;
    /** Starting offsets. Omitted means all zero, which the guard then moves off. */
    gamma?: readonly number[];
    /** Fired whenever the user pans or zooms this instance. Not fired by
     *  setView, so linking two instances does not loop. */
    onViewChange?: (v: View) => void;
    /** The magnifier that opens on tiny regions. Off unless asked for: it is a
     *  tool for inspecting near-singular configurations, and it gets in the way
     *  of simply looking at the picture. */
    loupe?: boolean;
}

/** What a registered layer callback is handed. */
export interface PentagridParts {
    stack: LayerStack;
    model: Pentagrid;
    currentRhombs: () => Rhomb[];
    /** The current pan and zoom. A layer drawing in world coordinates needs it,
     *  and cannot get it from the handle — layers draw before createPentagrid
     *  has returned one. */
    getView: () => View;
    withView: (v: ViewState, fn: () => void) => void;
    gridView: () => ViewState;
    redraw: () => void;
}

export interface View { scale: number; x: number; y: number; }

export interface PentagridHandle {
    redraw: () => void;
    setStep: (i: number) => void;
    /** Read the current pan and zoom. */
    getView: () => View;
    /** Drive the pan and zoom from outside. Does NOT fire onViewChange, so two
     *  linked instances cannot bounce updates off each other forever. */
    setView: (v: View) => void;
    setGamma: (g: readonly number[]) => void;
    stack: LayerStack;
}

export function createPentagrid(config: PentagridConfig): PentagridHandle {
    // Unit vectors at 72°.
    //
    // With verticalSymmetry the whole star is turned a quarter turn, so v0 points
    // up and family 0's LINES are horizontal; the five directions are then mirror
    // symmetric about the vertical axis. It cannot disturb the regularity
    // criterion, which depends only on angle differences.
    let verticalSymmetry = true;
    // "Sometimes you just have to see them."
    let gridLineWidth = 1;
    const directions: Vec2[] = [];

    function rebuildDirections() {
        const next = makeDirections(verticalSymmetry);
        for (let j = 0; j < NUM_GRIDS; j++) directions[j] = next[j];
    }
    rebuildDirections();

    // ── Canvas size ───────────────────────────────────────────────────
    //
    // The one place the page's canvas is decided. Everything downstream reads it
    // through the view, so a second view (the loupe already is one) or a page that
    // wants a different size costs nothing. PLAN.md, step 1 of parameterising.
    //
    // Explicit wins: data-width / data-height / data-margin on #canvas-container.
    // Implicit otherwise: the container's own laid-out size, then 800 as a floor.

    interface CanvasSpec { w: number; h: number; margin: number; }

    function intAttr(el: Element, name: string): number | null {
        const raw = parseInt(String(el.getAttribute(name) ?? ""), 10);
        return Number.isFinite(raw) && raw > 0 ? raw : null;
    }

    function readCanvasSpec(): CanvasSpec {
        const el = config.container;
        const rect = el.getBoundingClientRect();
        const w = intAttr(el, "data-width") ?? (Math.round(rect.width) || 800);
        const h = intAttr(el, "data-height") ?? (Math.round(rect.height) || 800);
        // 40 on an 800 canvas: keep the proportion rather than the number, so the
        // K-labels still have a gutter to live in at any size.
        const margin = intAttr(el, "data-margin") ?? Math.round(Math.min(w, h) * 0.05);
        return { w, h, margin };
    }

    const canvas = readCanvasSpec();

    // State.
    //
    // gamma is kept twice: as exact rationals in gammaQ (integer numerators over
    // GAMMA_DEN) and as floats in gamma for the drawing code. The exact copy is the
    // source of truth, because regularity is decidable exactly and only in exact
    // arithmetic — see singularTriples().
    const GAMMA_DEN = 10000;
    const gammaQ = [0, 0, 0, 0, 0];
    const gamma = [0, 0, 0, 0, 0];

    // ── Geometry adapters ─────────────────────────────────────────────
    //
    // The geometry layer takes the pentagrid explicitly, which is what makes it
    // testable; the page keeps it in module state. `model` is built once and stays
    // current because directions and gamma are const arrays mutated in place.

    const model: Pentagrid = { directions, gamma };

    function solveIntersection(j: number, k: number, nj: number, nk: number): Vec2 | null {
        return geoSolveIntersection(model, j, k, nj, nk);
    }

    function computeKTuple(x: number, y: number): number[] {
        return geoComputeKTuple(model, x, y);
    }

    function collectRhombs(vis: ViewRect): Rhomb[] {
        return geoCollectRhombs(model, vis, {
            gain: gridGain(),
            active: gridLayers.map((l) => l.userVisible),
        });
    }

    /** Clips to whatever view is active, which is how the loupe reuses it. */
    function regionPoly(K: readonly number[]): Vec2[] {
        return geoRegionPoly(model, K, getVisibleRect());
    }

    function singularTriples(): string[] {
        return geoSingularTriples(gammaQ, GAMMA_DEN);
    }

    /** The visible rect in GRID coordinates, whatever the current view is. */
    function gridVisibleRect(): ViewRect {
        let r!: ViewRect;
        withView(gridView(), () => { r = getVisibleRect(); });
        return r;
    }

    // The meter is the scan's other consumer, and it only exists if the page
    // gave us somewhere to put it.
    const showsMeter = !!config.controls;

    function scanSmallRegions() {
        if (!loupeEnabled && !showsMeter) {
            // Nothing would read the result, and this is the expensive call in
            // the file — it was running twice per frame on the paired views.
            smallRegions = [];
            concurrencies = [];
            return;
        }
        // The scan is grid-space, so it gets the grid rect. It had been handed the
        // tiling rect, which since registration became permanent meant scanning 6.25x
        // the area and counting regions that are not on screen toward the meter.
        const found = scanRegions(model, gridVisibleRect(), {
            candidate: CANDIDATE_PX,
            concurrentTol: CONCURRENT_TOL,
            scale,
        });
        smallRegions = found.small;
        concurrencies = found.concurrencies;
    }
    let currentStep = 0;
    // Narration and its presets are the page's, not this file's.
    const stepContent = config.steps ?? METHOD_STEPS;
    const STEP_COUNT = stepContent.length;
    let lockedIndex = 4;

    // View state. These are the "current view" the drawing functions read
    // implicitly. The loupe is a second view, so it swaps them via withView()
    // rather than threading a parameter through every draw function.
    let scale = 60;

    /** Tell the page the user moved. Never called by setView, so two linked
     *  instances cannot bounce updates back and forth. */
    function notifyView() {
        config.onViewChange?.({ scale, x: viewX, y: viewY });
    }

    let viewX = 0;
    let viewY = 0;
    let viewW = canvas.w;
    let viewH = canvas.h;
    let viewMargin = canvas.margin;

    // The dual map has gain 5/2: f(x) = (5/2)x + const + bounded wobble, because
    // Sum_j v_j v_j^T = (5/2)I. So the tiling is drawn 2.5x the pentagrid that makes
    // it, and the two do not register. Displaying the grid under x -> (5/2)x puts
    // every rhomb back on the crossing that generated it. It is not a fudge: the
    // projection R^5 -> E_par sends each basis vector to length sqrt(2/5), and with
    // that normalisation the gain is exactly 1 — the 5/2 is the price of unit
    // rhombs. See PLAN.md item 3.
    // Permanent, not a toggle. The grid and the tiling share one coordinate system;
    // showing or hiding the tiling is what the Penrose layers are for.
    const REGISTER_GAIN = 5 / 2;

    function gridGain(): number {
        return REGISTER_GAIN;
    }

    /** The view that grid-space objects (lines, K-regions, K-labels) draw under. */
    function gridView(): ViewState {
        const g = gridGain();
        return {
            scale: scale * g, viewX: viewX / g, viewY: viewY / g,
            w: viewW, h: viewH, margin: viewMargin,
        };
    }

    /** Cursor position in grid coordinates, undoing the registration gain. */
    function screenToGrid(sx: number, sy: number, cx: number, cy: number): [number, number] {
        const g = gridGain();
        const [mx, my] = screenToMath(sx, sy, cx, cy);
        return [mx / g, my / g];
    }

    /** Place a grid-space point on screen, applying the registration gain. */
    function gridToScreen(gx: number, gy: number, cx: number, cy: number): [number, number] {
        const g = gridGain();
        return mathToScreen(gx * g, gy * g, cx, cy);
    }

    // A setting rather than a feature, so a step preset cannot switch it back on.
    let loupeEnabled = config.loupe ?? false;

    // ── DOM elements ──────────────────────────────────────────────────

    const controlsDiv = config.controls ?? document.createElement("div");
    const stepNavDiv = config.stepNav ?? document.createElement("div");
    const explanationDiv = config.explanation ?? document.createElement("div");
    const layerPanelDiv = config.panel ?? document.createElement("div");
    const container = config.container;
    container.style.width = `${canvas.w}px`;
    container.style.height = `${canvas.h}px`;

    // Tooltip for K-tuple display
    const tooltip = document.createElement("div");
    tooltip.style.cssText = "position:fixed;padding:4px 8px;background:rgba(0,0,0,0.8);color:#fff;font:12px monospace;border-radius:3px;pointer-events:none;display:none;z-index:10;";
    document.body.appendChild(tooltip);

    // ── Layers ────────────────────────────────────────────────────────

    const stack = new LayerStack(container, canvas.w, canvas.h);

    // ── Features, and the steps as presets over them ──────────────────
    //
    // Capabilities used to be welded to the step that introduced them — eight
    // switches on currentStep, so intersection dots existed only at step 2 and
    // filled tiles only at step 6. They are flags now, and the steps set the flags.
    // Prev/Next still walks the narrative; it is no longer the only way to reach
    // anything. PLAN.md, "The method page, reorganised".

    const NO_FEATURES: Features = {
        gridLines: true, axes: true,
        kRegions: false, kLabels: false, intersectionDots: false,
        penroseTiles: false, penroseEdges: false, penroseVertices: false,
        penroseDecor: false, hoverVertex: false, hoverTile: false,
    };

    const STEP_PRESETS: Partial<Features>[] = config.presets ?? [
        {},                                                        // 1 the pentagrid
        { intersectionDots: true, hoverTile: true },               // 2 intersections
        { kRegions: true, kLabels: true, hoverVertex: true },      // 3 regions
        { penroseVertices: true, hoverVertex: true },              // 4 dual vertices
        { penroseEdges: true, hoverTile: true },                   // 5 building rhombs
        { penroseTiles: true },                                    // 6 the tiling
    ];

    let features: Features = { ...NO_FEATURES, ...STEP_PRESETS[0], ...config.features };

    function applyStepPreset() {
        // With no steps the page's own feature set stands, untouched.
        if (STEP_COUNT === 0) return;
        features = { ...NO_FEATURES, ...STEP_PRESETS[currentStep] };
    }

    // ── The rhomb cache ───────────────────────────────────────────────
    //
    // Four layers now want the same rhombs, and collectRhombs is the expensive call
    // in the file. It depends on γ, the view and the active families — never on which
    // layer is asking. PLAN.md item 5.

    let rhombCache: Rhomb[] | null = null;
    let rhombCacheKey = "";

    function currentRhombs(): Rhomb[] {
        const key = [
            scale, viewX, viewY, gammaQ.join(","), verticalSymmetry ? 1 : 0,
            gridLayers.map((l) => (l.userVisible ? 1 : 0)).join(""),
        ].join("|");
        if (rhombCache && key === rhombCacheKey) return rhombCache;
        rhombCache = collectRhombs(getVisibleRect());
        rhombCacheKey = key;
        return rhombCache;
    }

    // ── Register the layers ───────────────────────────────────────────
    //
    // Layers declare when they want to be drawn rather than being switched on by
    // draw(). A step preset changes what the predicates read, and the right things
    // appear — nothing has to remember to update a flag. Anything with a `group`
    // gets a panel toggle for free, which is what makes registering one from an
    // exploration page worth doing.

    const gridAlphas = [0.6, 0.6, 0.4, 0.28, 0.24, 0.18];

    const bgLayer = stack.add({
        id: "background", label: "K-regions", z: 5, group: "Pentagrid",
        visible: () => features.kRegions,
        draw: (c) => withView(gridView(), () => drawKRegions(c.ctx, c.cx, c.cy)),
    });

    const gridLayers: Layer[] = [];
    for (let j = 0; j < NUM_GRIDS; j++) {
        gridLayers.push(stack.add({
            id: `grid-${j}`, label: `${j}`, z: 10 + j, group: "Pentagrid",
            visible: () => features.gridLines,
            opacity: () => gridAlphas[Math.min(currentStep, gridAlphas.length - 1)],
            draw: (c) => withView(gridView(), () =>
                drawGridFamily(c.ctx, j, c.w, c.h, c.cx, c.cy)),
        }));
    }

    const axesLayer = stack.add({
        id: "axes", label: "Axes", z: 20, group: "Pentagrid",
        visible: () => features.axes,
        draw: (c) => drawAxes(c.ctx, c.w, c.h, c.cx, c.cy),
    });

    stack.add({
        id: "dots", label: "Dots", z: 50, group: "Pentagrid",
        visible: () => features.intersectionDots,
        draw: (c) => withView(gridView(), () =>
            drawIntersectionDots(c.ctx, c.cx, c.cy, getVisibleRect())),
    });

    stack.add({
        id: "klabels", label: "K-labels", z: 51, group: "Pentagrid",
        visible: () => features.kLabels,
        draw: (c) => withView(gridView(), () => drawKEdgeLabels(c.ctx, c.cx, c.cy)),
    });

    // The tiling. Its own group so the whole thing can move in front of the
    // pentagrid or behind it in one call.
    const PENROSE_Z_BACK = 6;    // above the K-regions, below the grid
    const PENROSE_Z_FRONT = 30;  // above the axes, below the overlays
    let penroseInFront = true;

    stack.add({
        id: "penrose-tiles", label: "Tiles", z: PENROSE_Z_FRONT, group: "Penrose",
        visible: () => features.penroseTiles,
        draw: (c) => drawRhombs(c.ctx, currentRhombs(), c.cx, c.cy, true),
    });
    stack.add({
        id: "penrose-edges", label: "Edges", z: PENROSE_Z_FRONT + 1, group: "Penrose",
        visible: () => features.penroseEdges,
        draw: (c) => drawRhombs(c.ctx, currentRhombs(), c.cx, c.cy, false),
    });
    stack.add({
        id: "penrose-decor", label: "Arcs", z: PENROSE_Z_FRONT + 2, group: "Penrose",
        visible: () => features.penroseDecor,
        draw: (c) => drawPenroseDecor(c.ctx, currentRhombs(), c.cx, c.cy),
    });
    stack.add({
        id: "penrose-vertices", label: "Vertices", z: PENROSE_Z_FRONT + 3, group: "Penrose",
        // Also runs when only the hover wants vertices, because it populates the
        // pick list; `show` decides whether anything is actually painted.
        visible: () => features.penroseVertices || features.hoverVertex,
        draw: (c) => drawDualVertices(c.ctx, currentRhombs(), c.cx, c.cy,
                                      features.penroseVertices),
    });

    function restackPenrose() {
        stack.setGroupZ("Penrose", penroseInFront ? PENROSE_Z_FRONT : PENROSE_Z_BACK);
    }

    // Overlays the stack sizes but does not draw, and the input surface.
    const highlight = stack.addRaw(55);
    const highlightCtx = highlight.ctx;
    const highlightCanvas = highlight.canvas;
    const footprint = stack.addRaw(60);
    const footprintCtx = footprint.ctx;

    const eventLayer = stack.addRaw(100, "auto");
    const eventCanvas = eventLayer.canvas;
    eventCanvas.style.cursor = "grab";

    // ── The γ bank ────────────────────────────────────────────────────
    //
    // A view over the values, nothing more: it reports which slider moved and
    // which label was clicked, and renders what it is told. The constraint —
    // that one index is computed from the others so Σγ = 0 — is ours, not its.

    const bank = createGammaBank({
        count: NUM_GRIDS,
        colors: COLORS,
        onChange: (j, value) => {
            if (j === lockedIndex) return;
            gammaQ[j] = Math.round(value * GAMMA_DEN);
            updateLockedGamma();
            draw();
        },
        onLock: (j) => {
            lockedIndex = j;
            updateLockedGamma();
            draw();
        },
    });
    controlsDiv.appendChild(bank.element);

    // ── Regularity meter ──────────────────────────────────────────────
    //
    // Regularity says no three grid lines are concurrent, so every region has
    // positive area. It does NOT bound that area below: as the line indices range
    // over Z the near-concurrency defects equidistribute, so for every gamma the
    // infimum of region size over the plane is zero. Enforcing a minimum is
    // therefore impossible, and undesirable besides — a region collapsing through
    // zero is the phason flip, which is the thing worth looking at. So we measure
    // rather than enforce, in pixels, over the visible window. See PLAN.md item 1.


    // A point where three or more lines actually meet. This is not a small region —
    // it has no interior at all — and no magnification will ever open it up. It is
    // where de Bruijn's construction is genuinely undefined, so it is reported
    // separately and far more loudly. The default γ = 0 puts one at the origin with
    // all five lines through it.

    // ── Regularity, decided exactly ───────────────────────────────────
    //
    // Three lines (j,n): x·v_j = n - γ_j =: c_j are concurrent iff
    //
    //     c_a·sin(θ_c-θ_b) + c_b·sin(θ_a-θ_c) + c_c·sin(θ_b-θ_a) = 0
    //
    // (the 3x3 determinant expanded along its last column). For the pentagrid the θ
    // are multiples of 72°, so dividing through by sin 144° leaves every coefficient
    // in {±1, ±φ} — and for all ten triples the split has the same shape: one c_j
    // alone on one side, the other two on the other. So each condition reads
    //
    //     u + φ·v = 0,   u and v rational
    //
    // and since φ is irrational, BOTH must vanish. The lone term gives c_L = 0, i.e.
    // γ_L ∈ Z; the pair gives c_P + c_Q = 0, i.e. γ_P + γ_Q ∈ Z. Hence
    //
    //     triple is singular  <=>  γ_L ∈ Z  AND  γ_P + γ_Q ∈ Z
    //
    // and therefore: if no γ_j is an integer, the pentagrid is regular EVERYWHERE.
    // No tolerance and no window — this decides regularity, it does not test it.
    //
    // It also explains why the old 5e-9 nudge failed. Magnitude was never the issue:
    // it left γ₀, γ₂, γ₃ at exactly 0, and being symmetric it kept γ₁ + γ₄ = 0, so
    // triples 014 and 023 stayed singular no matter how small the step.

    // [key, lone family, the other two] for each triple, read off the coefficients.

    /** Exactly which triples are singular. Empty means provably regular. */

    // Only triples at least this close to concurrent are worth measuring exactly.
    const CANDIDATE_PX = 24;
    // Below this a region is too small to aim at, and the loupe takes over.
    const HOVERABLE_PX = 5;
    // Below this an inradius is not a small triangle, it is a concurrency. In math
    // units, not pixels: no zoom level makes a degenerate region hoverable.
    const CONCURRENT_TOL = 1e-9;

    let smallRegions: SmallRegion[] = [];
    let concurrencies: Concurrency[] = [];

    let guardRegular = true;
    let guardActed = false;

    const meterDiv = document.createElement("div");
    meterDiv.className = "regularity-control";

    const guardLabel = document.createElement("label");
    guardLabel.className = "layer-toggle";
    guardLabel.title = "Keep γ off the singular set. Uncheck to sit on a singularity.";
    const guardCb = document.createElement("input");
    guardCb.type = "checkbox";
    guardCb.checked = guardRegular;
    guardCb.addEventListener("change", () => {
        guardRegular = guardCb.checked;
        updateLockedGamma();
        draw();
    });
    guardLabel.appendChild(guardCb);
    guardLabel.appendChild(document.createTextNode(" keep γ regular"));
    meterDiv.appendChild(guardLabel);

    const meterSpan = document.createElement("div");
    meterSpan.className = "regularity-meter";
    meterDiv.appendChild(meterSpan);
    controlsDiv.appendChild(meterDiv);

    /** Range of line indices of family j that cross the visible rect. */

    /**
     * Find every region small enough to be hard to hit, over the visible window.
     *
     * A small region means three lines close to concurrent. For each triple of
     * families a < b < c we take the intersection P of (a,na) and (b,nb) and ask how
     * far P is from the nearest line of family c. Because the direction vectors are
     * unit vectors, that distance is exactly |d - round(d)| for d = P.v_c + gamma_c
     * — no square roots, and it is an exact perpendicular distance, not an estimate.
     * Only the candidates that survive that filter get an exact triangle measured.
     *
     * Caveat: a fourth line can cut the triangle, in which case the true region is
     * smaller than what is reported here. It is rare at the sizes that matter — the
     * lines are one unit apart and these triangles are tiny — but the meter is
     * optimistic, not conservative, when it happens.
     */

    function updateMeter() {
        // The minimum alone is a poor readout: by equidistribution a generic window
        // already contains regions of ~0.04 px, so a bare minimum reads red always
        // and says nothing. The count of unhittable regions is the number that
        // actually responds — zoom in and it falls, because fewer triples are in
        // view and each renders larger.
        let min = Infinity;
        let under = 0;
        for (const r of smallRegions) {
            if (r.size < min) min = r.size;
            if (r.size < HOVERABLE_PX) under++;
        }
        const tail = under === 0
            ? `all regions ≥ ${HOVERABLE_PX} px`
            : `${under} region${under === 1 ? "" : "s"} under ${HOVERABLE_PX} px` +
              ` · smallest ${min < 0.01 ? min.toExponential(1) : min.toFixed(2)} px`;

        // The verdict is exact and global, so it leads. The float scan below only
        // says how big things are and where they are, never whether they are legal.
        const sing = singularTriples();
        if (sing.length > 0) {
            let worst = 0;
            for (const c of concurrencies) if (c.lines > worst) worst = c.lines;
            const where = concurrencies.length > 0
                ? ` — ${concurrencies.length} in view, up to ${worst} lines`
                : "";
            meterSpan.textContent = `SINGULAR: triples ${sing.join(" ")}${where} · ${tail}`;
            meterSpan.style.color = "#e63946";
            return;
        }
        const nudged = guardActed ? ` · γ nudged ${(1 / GAMMA_DEN).toExponential(0)}` : "";
        meterSpan.textContent = `regular, proved${nudged} · ${tail}`;
        meterSpan.style.color = under === 0 ? "#5a8f5a" : "#c07d00";
    }

    // ── Build step navigation ─────────────────────────────────────────

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "\u2190 Previous";

    const buildTag = document.createElement("span");
    buildTag.className = "build-tag";
    buildTag.textContent = config.buildId ? `build ${config.buildId}` : "";

    const stepIndicator = document.createElement("span");
    stepIndicator.className = "step-indicator";

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next \u2192";

    stepNavDiv.appendChild(prevBtn);
    stepNavDiv.appendChild(stepIndicator);
    stepNavDiv.appendChild(nextBtn);
    stepNavDiv.appendChild(buildTag);

    // ── Gamma / slider logic ──────────────────────────────────────────

    /** Re-derive the locked γ from the others, then the float copy from the exact. */
    function relock() {
        let sumQ = 0;
        for (let i = 0; i < NUM_GRIDS; i++) if (i !== lockedIndex) sumQ += gammaQ[i];
        gammaQ[lockedIndex] = -sumQ;
        for (let j = 0; j < NUM_GRIDS; j++) gamma[j] = gammaQ[j] / GAMMA_DEN;
    }

    /**
     * Move γ off the singular set, if it is on it.
     *
     * By the criterion above a triple can only be singular when its lone γ is an
     * integer, so taking every γ off the integers is enough to make the whole
     * pentagrid provably regular. One unit of GAMMA_DEN does it: correctness here is
     * about rationality class, not magnitude, which is exactly what the old 5e-9
     * nudge got wrong. The offsets differ per family so the pair sums cannot stay
     * integral either — being symmetric is how the old nudge preserved γ₁ + γ₄ = 0.
     */
    function guardRegularity() {
        guardActed = false;
        if (!guardRegular) return;
        for (let attempt = 0; attempt < 8; attempt++) {
            if (singularTriples().length === 0) return;
            guardActed = true;
            for (let j = 0; j < NUM_GRIDS; j++) {
                if (j === lockedIndex) continue;
                if (gammaQ[j] % GAMMA_DEN === 0) gammaQ[j] += j + 1;
            }
            relock();
            if (gammaQ[lockedIndex] % GAMMA_DEN === 0) {
                gammaQ[(lockedIndex + 1) % NUM_GRIDS] += 1;
                relock();
            }
        }
    }

    function updateLockedGamma() {
        relock();
        guardRegularity();
        bank.sync({
            values: gamma,
            locked: lockedIndex,
            sum: gamma.reduce((a, b) => a + b, 0),
        });
    }

    // ── Step navigation logic ─────────────────────────────────────────

    function updateStepUI() {
        applyStepPreset();
        syncPanel();
        if (STEP_COUNT === 0) return;
        stepIndicator.textContent = `Step ${currentStep + 1} of ${STEP_COUNT}`;
        prevBtn.disabled = currentStep === 0;
        nextBtn.disabled = currentStep === STEP_COUNT - 1;
        const step = stepContent[currentStep];
        explanationDiv.innerHTML = `<h3>${step.title}</h3>${step.html}`;
        tooltip.style.display = "none";
    }

    prevBtn.addEventListener("click", () => {
        if (currentStep > 0) { currentStep--; updateStepUI(); draw(); }
    });
    nextBtn.addEventListener("click", () => {
        if (currentStep < STEP_COUNT - 1) { currentStep++; updateStepUI(); draw(); }
    });

    // ── View transforms ───────────────────────────────────────────────

    function mathToScreen(mx: number, my: number, cx: number, cy: number): [number, number] {
        return [cx + (mx - viewX) * scale, cy - (my - viewY) * scale];
    }

    function screenToMath(sx: number, sy: number, cx: number, cy: number): [number, number] {
        return [viewX + (sx - cx) / scale, viewY - (sy - cy) / scale];
    }


    function getVisibleRect(): ViewRect {
        const cx = viewW / 2;
        const cy = viewH / 2;
        return {
            xMin: viewX - (cx - viewMargin) / scale,
            xMax: viewX + (viewW - cx - viewMargin) / scale,
            yMin: viewY - (cy - viewMargin) / scale,
            yMax: viewY + (viewH - cy - viewMargin) / scale,
        };
    }

    /** Run fn with the view globals temporarily swapped, then restore them. */
    function withView(v: ViewState, fn: () => void) {
        const s0 = scale, x0 = viewX, y0 = viewY;
        const w0 = viewW, h0 = viewH, m0 = viewMargin;
        scale = v.scale; viewX = v.viewX; viewY = v.viewY;
        viewW = v.w; viewH = v.h; viewMargin = v.margin;
        try {
            fn();
        } finally {
            scale = s0; viewX = x0; viewY = y0;
            viewW = w0; viewH = h0; viewMargin = m0;
        }
    }

    // ── Pan & zoom ────────────────────────────────────────────────────

    let isPanning = false;
    let panLastX = 0;
    let panLastY = 0;
    let lastPinchDist = 0;

    function zoomAtScreen(sx: number, sy: number, factor: number) {
        const cx = canvas.w / 2;
        const cy = canvas.h / 2;
        const [mx, my] = screenToMath(sx, sy, cx, cy);
        scale = Math.max(10, Math.min(400, scale * factor));
        viewX = mx - (sx - cx) / scale;
        notifyView();
        viewY = my + (sy - cy) / scale;
        draw();
    }

    // Mouse
    eventCanvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = Math.pow(2, -e.deltaY / 300);
        zoomAtScreen(e.offsetX, e.offsetY, factor);
    }, { passive: false });

    eventCanvas.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            isPanning = true;
            panLastX = e.offsetX;
            panLastY = e.offsetY;
            eventCanvas.style.cursor = "grabbing";
        }
    });

    eventCanvas.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        viewX -= (e.offsetX - panLastX) / scale;
        viewY += (e.offsetY - panLastY) / scale;
        notifyView();
        panLastX = e.offsetX;
        panLastY = e.offsetY;
        draw();
    });

    eventCanvas.addEventListener("mouseup", endPan);
    eventCanvas.addEventListener("mouseleave", endPan);

    function endPan() {
        if (isPanning) {
            isPanning = false;
            eventCanvas.style.cursor = "grab";
        }
    }

    // Double-click to reset view
    eventCanvas.addEventListener("dblclick", () => {
        scale = 60;
        notifyView();
        viewX = 0;
        viewY = 0;
        draw();
    });

    // Touch
    function touchDist(a: Touch, b: Touch): number {
        const dx = b.clientX - a.clientX;
        const dy = b.clientY - a.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    eventCanvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            isPanning = true;
            panLastX = e.touches[0].clientX;
            panLastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            lastPinchDist = touchDist(e.touches[0], e.touches[1]);
        }
    }, { passive: false });

    eventCanvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isPanning) {
            const dx = e.touches[0].clientX - panLastX;
            const dy = e.touches[0].clientY - panLastY;
            viewX -= dx / scale;
            viewY += dy / scale;
            notifyView();
            panLastX = e.touches[0].clientX;
            panLastY = e.touches[0].clientY;
            draw();
        } else if (e.touches.length === 2) {
            const dist = touchDist(e.touches[0], e.touches[1]);
            if (lastPinchDist > 0) {
                const rect = eventCanvas.getBoundingClientRect();
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                zoomAtScreen(midX, midY, dist / lastPinchDist);
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    eventCanvas.addEventListener("touchend", (e) => {
        if (e.touches.length === 0) {
            isPanning = false;
            lastPinchDist = 0;
        } else if (e.touches.length === 1) {
            isPanning = true;
            panLastX = e.touches[0].clientX;
            panLastY = e.touches[0].clientY;
            lastPinchDist = 0;
        }
    });

    // ── Math utilities ────────────────────────────────────────────────





    // ── Drawing ───────────────────────────────────────────────────────

    function drawAxes(tc: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number) {
        tc.save();

        const vis = getVisibleRect();
        const nxMin = Math.ceil(vis.xMin);
        const nxMax = Math.floor(vis.xMax);
        const nyMin = Math.ceil(vis.yMin);
        const nyMax = Math.floor(vis.yMax);

        tc.strokeStyle = "#999";
        tc.fillStyle = "#666";
        tc.lineWidth = 1;
        tc.font = "11px monospace";
        const tickLen = 5;

        // X axis ticks along bottom edge
        tc.textAlign = "center";
        tc.textBaseline = "top";
        const bottomY = h - canvas.margin + 10;
        for (let n = nxMin; n <= nxMax; n++) {
            const [sx] = mathToScreen(n, 0, cx, cy);
            if (sx < canvas.margin || sx > w - canvas.margin) continue;
            tc.beginPath();
            tc.moveTo(sx, h - canvas.margin);
            tc.lineTo(sx, h - canvas.margin + tickLen);
            tc.stroke();
            tc.fillText(`${n}`, sx, bottomY);
        }
        tc.textAlign = "right";
        tc.fillText("x", w - canvas.margin + 20, bottomY);

        // Y axis ticks along left edge
        tc.textAlign = "right";
        tc.textBaseline = "middle";
        for (let n = nyMin; n <= nyMax; n++) {
            const [, sy] = mathToScreen(0, n, cx, cy);
            if (sy < canvas.margin || sy > h - canvas.margin) continue;
            tc.beginPath();
            tc.moveTo(canvas.margin - tickLen, sy);
            tc.lineTo(canvas.margin, sy);
            tc.stroke();
            tc.fillText(`${n}`, canvas.margin - tickLen - 2, sy);
        }
        tc.textBaseline = "bottom";
        tc.textAlign = "center";
        tc.fillText("y", canvas.margin - tickLen - 2, canvas.margin - 8);

        // Axis lines at x=0 and y=0
        tc.strokeStyle = "#bbb";
        tc.lineWidth = 0.5;

        const [zeroX] = mathToScreen(0, 0, cx, cy);
        const [, zeroY] = mathToScreen(0, 0, cx, cy);

        if (zeroY > canvas.margin && zeroY < h - canvas.margin) {
            tc.beginPath();
            tc.moveTo(canvas.margin, zeroY);
            tc.lineTo(w - canvas.margin, zeroY);
            tc.stroke();
        }
        if (zeroX > canvas.margin && zeroX < w - canvas.margin) {
            tc.beginPath();
            tc.moveTo(zeroX, canvas.margin);
            tc.lineTo(zeroX, h - canvas.margin);
            tc.stroke();
        }

        tc.restore();
    }

    function drawGridFamily(
        tc: CanvasRenderingContext2D,
        j: number,
        w: number, h: number,
        cx: number, cy: number,
    ) {
        const [vx, vy] = directions[j];
        const px = -vy;
        const py = vx;
        const extent = Math.sqrt(w * w + h * h) / 2;
        const vis = getVisibleRect();

        const corners = [
            [vis.xMin, vis.yMin], [vis.xMax, vis.yMin],
            [vis.xMin, vis.yMax], [vis.xMax, vis.yMax],
        ];
        let minDot = Infinity, maxDot = -Infinity;
        for (const [x, y] of corners) {
            const d = vx * x + vy * y;
            if (d < minDot) minDot = d;
            if (d > maxDot) maxDot = d;
        }
        const nLo = Math.floor(minDot + gamma[j]) - 1;
        const nHi = Math.ceil(maxDot + gamma[j]) + 1;

        tc.strokeStyle = COLORS[j];
        tc.lineWidth = gridLineWidth;

        for (let n = nLo; n <= nHi; n++) {
            const c = n - gamma[j];
            const viewDot = vx * viewX + vy * viewY;
            const d = c - viewDot;
            const [ox, oy] = mathToScreen(viewX + d * vx, viewY + d * vy, cx, cy);

            const x1 = ox + px * extent;
            const y1 = oy - py * extent;
            const x2 = ox - px * extent;
            const y2 = oy + py * extent;

            tc.beginPath();
            tc.moveTo(x1, y1);
            tc.lineTo(x2, y2);
            tc.stroke();
        }
    }

    // Precompute blended colors for the 10 intersection pair types
    function hexToRgb(hex: string): [number, number, number] {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    }

    const pairColors: Map<string, string> = new Map();
    for (let j = 0; j < NUM_GRIDS; j++) {
        for (let k = j + 1; k < NUM_GRIDS; k++) {
            const [r1, g1, b1] = hexToRgb(COLORS[j]);
            const [r2, g2, b2] = hexToRgb(COLORS[k]);
            const r = Math.round((r1 + r2) / 2);
            const g = Math.round((g1 + g2) / 2);
            const b = Math.round((b1 + b2) / 2);
            pairColors.set(`${j},${k}`, `rgba(${r},${g},${b},0.55)`);
        }
    }

    function drawIntersectionDots(tc: CanvasRenderingContext2D, cx: number, cy: number, vis: ViewRect) {
        const maxCoord = Math.max(
            Math.abs(vis.xMin), Math.abs(vis.xMax),
            Math.abs(vis.yMin), Math.abs(vis.yMax),
        );
        const maxN = Math.min(Math.ceil(maxCoord) + 3, 50);

        for (let j = 0; j < NUM_GRIDS; j++) {
            const layerJ = stack.get(`grid-${j}`);
            if (layerJ && !layerJ.userVisible) continue;
            for (let k = j + 1; k < NUM_GRIDS; k++) {
                const layerK = stack.get(`grid-${k}`);
                if (layerK && !layerK.userVisible) continue;
                tc.fillStyle = pairColors.get(`${j},${k}`)!;
                for (let nj = -maxN; nj <= maxN; nj++) {
                    for (let nk = -maxN; nk <= maxN; nk++) {
                        const pt = solveIntersection(j, k, nj, nk);
                        if (!pt) continue;
                        const [px, py] = pt;
                        if (px < vis.xMin || px > vis.xMax ||
                            py < vis.yMin || py > vis.yMax) continue;
                        const [sx, sy] = mathToScreen(px, py, cx, cy);
                        tc.beginPath();
                        tc.arc(sx, sy, 3, 0, 2 * Math.PI);
                        tc.fill();
                    }
                }
            }
        }
    }

    /** Stored dual vertices for hover hit-testing on step 4 */
    interface DualVertex {
        sx: number; sy: number; // screen coords
        mx: number; my: number; // math coords (dual space)
        K: number[];            // K-tuple that produced this vertex
    }
    let dualVertices: DualVertex[] = [];

    /**
     * Draw the dual vertices f(x) = Σ Kⱼ(x)·vⱼ for each rhomb corner.
     * Deduplicates by rounding to avoid plotting the same vertex twice.
     *
     * @param tc - Target canvas rendering context
     * @param rhombs - Rhombs whose corners supply the dual vertices
     * @param cx - Screen x of the canvas center
     * @param cy - Screen y of the canvas center
     */
    function drawDualVertices(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number, show: boolean,
    ) {
        const seen = new Set<string>();
        dualVertices = [];
        tc.fillStyle = "#c0392b";
        for (const rhomb of rhombs) {
            for (let vi = 0; vi < rhomb.vertices.length; vi++) {
                const [vx, vy] = rhomb.vertices[vi];
                const key = `${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const [sx, sy] = mathToScreen(vx, vy, cx, cy);
                dualVertices.push({ sx, sy, mx: vx, my: vy, K: rhomb.kTuples[vi] });
                if (!show) continue;
                tc.beginPath();
                tc.arc(sx, sy, 3, 0, 2 * Math.PI);
                tc.fill();
            }
        }
    }

    // ── The arc decoration ────────────────────────────────────────────
    //
    // The classic marking whose curves close into loops across the tiling. Each edge
    // of every rhomb is +v_j from one of its endpoints, and that orientation is
    // global, so putting the crossing point at the same fraction ARC_T along every
    // edge makes the curves join across every shared edge automatically — no
    // matching rules to enforce, they come out of the construction.
    //
    // A rhomb f, f+v_j, f+v_j+v_k, f+v_k then carries exactly two arcs: one centred
    // at f of radius ARC_T (both its edges leave f in a + direction), and one at the
    // opposite corner of radius 1-ARC_T. The two radii sum to 1, which is what makes
    // them meet. 1/φ² and 1/φ are the golden choice.
    const ARC_COLORS = ["#c1440e", "#1b6ca8"];

    /** One arc in math coordinates, taking the short way round. */
    function arcBetween(
        tc: CanvasRenderingContext2D, mx: number, my: number, r: number,
        a1: number, a2: number, cx: number, cy: number,
    ) {
        const [sx, sy] = mathToScreen(mx, my, cx, cy);
        // Screen y is flipped, so a math angle θ is screen angle −θ.
        const s1 = -a1;
        let d = -a2 - s1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        tc.beginPath();
        tc.arc(sx, sy, r * scale, s1, s1 + d, d < 0);
        tc.stroke();
    }

    function drawPenroseDecor(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number,
    ) {
        tc.lineWidth = 1.6;
        tc.lineCap = "round";
        for (const r of rhombs) {
            for (const arc of rhombArcs(model, r)) {
                tc.strokeStyle = ARC_COLORS[arc.family];
                arcBetween(tc, arc.x, arc.y, arc.r, arc.a1, arc.a2, cx, cy);
            }
        }
    }

    function drawRhombs(tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number, fill: boolean) {
        for (const rhomb of rhombs) {
            const sv = rhomb.vertices.map(([vx, vy]) => mathToScreen(vx, vy, cx, cy));

            tc.beginPath();
            tc.moveTo(sv[0][0], sv[0][1]);
            tc.lineTo(sv[1][0], sv[1][1]);
            tc.lineTo(sv[2][0], sv[2][1]);
            tc.lineTo(sv[3][0], sv[3][1]);
            tc.closePath();

            if (fill) {
                tc.fillStyle = rhomb.thick ? THICK_FILL : THIN_FILL;
                tc.fill();
            }
            tc.strokeStyle = fill ? "#555" : "#999";
            tc.lineWidth = fill ? 1.5 : 1;
            tc.stroke();
        }
    }

    // ── K-region visualization ────────────────────────────────────────

    function hslToRgb(h: number, s: number, l: number): [number, number, number] {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
        ];
    }


    function drawKRegions(tc: CanvasRenderingContext2D, cx: number, cy: number) {
        const w = canvas.w;
        const h = canvas.h;
        const imgData = tc.createImageData(w, h);
        const data = imgData.data;

        for (let py = canvas.margin; py < h - canvas.margin; py++) {
            for (let px = canvas.margin; px < w - canvas.margin; px++) {
                const [mx, my] = screenToMath(px, py, cx, cy);
                const K = computeKTuple(mx, my);

                // Hash full K-tuple to a hue
                let hash = 0;
                for (let j = 0; j < NUM_GRIDS; j++) {
                    hash = ((hash << 5) - hash + K[j] + 50) | 0;
                }
                const hue = (((hash * 137) % 360) + 360) % 360;
                const [r, g, b] = hslToRgb(hue, 0.45, 0.82);

                const idx = (py * w + px) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        tc.putImageData(imgData, 0, 0);
    }

    // ── K edge labels ─────────────────────────────────────────────────

    function drawKEdgeLabels(tc: CanvasRenderingContext2D, cx: number, cy: number) {
        const w = canvas.w;
        const h = canvas.h;
        tc.font = "10px sans-serif";

        interface LabelInfo {
            x: number; y: number;
            text: string;
            color: string;
        }
        const labels: LabelInfo[] = [];

        // Pass 1: gradient-filled parallelograms, collect label positions
        for (let j = 0; j < NUM_GRIDS; j++) {
            const layer = stack.get(`grid-${j}`);
            if (layer && !layer.userVisible) continue;
            const [vx, vy] = directions[j];
            const [r, g, b] = hexToRgb(COLORS[j]);
            const colorStr = `rgba(${r},${g},${b},0.2)`;
            const clearStr = `rgba(${r},${g},${b},0)`;

            // --- Top & Bottom edges ---
            if (Math.abs(vx) > 1e-6) {
                for (const edge of [0, 1]) { // 0=top, 1=bottom
                    const edgeSy = edge === 0 ? canvas.margin : h - canvas.margin;
                    const outerY = edge === 0 ? 0 : h;
                    const [, myEdge] = screenToMath(0, edgeSy, cx, cy);

                    const [mxL] = screenToMath(canvas.margin, edgeSy, cx, cy);
                    const [mxR] = screenToMath(w - canvas.margin, edgeSy, cx, cy);
                    const dotL = vx * mxL + vy * myEdge + gamma[j];
                    const dotR = vx * mxR + vy * myEdge + gamma[j];
                    const nLo = Math.floor(Math.min(dotL, dotR)) - 1;
                    const nHi = Math.ceil(Math.max(dotL, dotR)) + 1;

                    const xs: number[] = [canvas.margin];
                    for (let n = nLo; n <= nHi; n++) {
                        const mx = (n - gamma[j] - vy * myEdge) / vx;
                        const sx = cx + (mx - viewX) * scale;
                        if (sx > canvas.margin + 1 && sx < w - canvas.margin - 1) xs.push(sx);
                    }
                    xs.push(w - canvas.margin);
                    xs.sort((a, b) => a - b);

                    // Screen-x shift from inner edge to outer border along grid line
                    const shift = edge === 0
                        ? -vy * canvas.margin / vx
                        : vy * canvas.margin / vx;

                    // Gradient perpendicular to border
                    const grad = edge === 0
                        ? tc.createLinearGradient(0, 0, 0, canvas.margin)
                        : tc.createLinearGradient(0, h - canvas.margin, 0, h);
                    if (edge === 0) {
                        grad.addColorStop(0, clearStr);
                        grad.addColorStop(0.5, colorStr);
                        grad.addColorStop(1, colorStr);
                    } else {
                        grad.addColorStop(0, colorStr);
                        grad.addColorStop(0.5, colorStr);
                        grad.addColorStop(1, clearStr);
                    }

                    const ly = edge === 0 ? canvas.margin / 2 : h - canvas.margin / 2;

                    for (let i = 0; i < xs.length - 1; i++) {
                        const midX = (xs[i] + xs[i + 1]) / 2;
                        const stripW = xs[i + 1] - xs[i];

                        const probeSy = edge === 0 ? canvas.margin + 2 : h - canvas.margin - 2;
                        const [pmx, pmy] = screenToMath(midX, probeSy, cx, cy);
                        const K = Math.ceil(vx * pmx + vy * pmy + gamma[j] - 1e-9);

                        if (K < -1 || K > 1) continue;

                        // Fill parallelogram following grid line slope
                        tc.beginPath();
                        tc.moveTo(xs[i], edgeSy);
                        tc.lineTo(xs[i + 1], edgeSy);
                        tc.lineTo(xs[i + 1] + shift, outerY);
                        tc.lineTo(xs[i] + shift, outerY);
                        tc.closePath();
                        tc.fillStyle = grad;
                        tc.fill();

                        const label = `K${SUBSCRIPTS[j]}=${K}`;
                        const tw = tc.measureText(label).width;
                        if (stripW >= tw + 4) {
                            labels.push({
                                x: midX + shift / 2,
                                y: ly,
                                text: label,
                                color: COLORS[j],
                            });
                        }
                    }
                }
            }

            // --- Left & Right edges ---
            if (Math.abs(vy) > 1e-6) {
                for (const edge of [0, 1]) { // 0=left, 1=right
                    const edgeSx = edge === 0 ? canvas.margin : w - canvas.margin;
                    const outerX = edge === 0 ? 0 : w;
                    const [mxEdge] = screenToMath(edgeSx, 0, cx, cy);

                    const [, myT] = screenToMath(edgeSx, canvas.margin, cx, cy);
                    const [, myB] = screenToMath(edgeSx, h - canvas.margin, cx, cy);
                    const dotT = vx * mxEdge + vy * myT + gamma[j];
                    const dotB = vx * mxEdge + vy * myB + gamma[j];
                    const nLo = Math.floor(Math.min(dotT, dotB)) - 1;
                    const nHi = Math.ceil(Math.max(dotT, dotB)) + 1;

                    const ys: number[] = [canvas.margin];
                    for (let n = nLo; n <= nHi; n++) {
                        const my = (n - gamma[j] - vx * mxEdge) / vy;
                        const sy = cy - (my - viewY) * scale;
                        if (sy > canvas.margin + 1 && sy < h - canvas.margin - 1) ys.push(sy);
                    }
                    ys.push(h - canvas.margin);
                    ys.sort((a, b) => a - b);

                    // Screen-y shift from inner edge to outer border along grid line
                    const shift = edge === 0
                        ? -vx * canvas.margin / vy
                        : vx * canvas.margin / vy;

                    // Gradient perpendicular to border
                    const grad = edge === 0
                        ? tc.createLinearGradient(0, 0, canvas.margin, 0)
                        : tc.createLinearGradient(w - canvas.margin, 0, w, 0);
                    if (edge === 0) {
                        grad.addColorStop(0, clearStr);
                        grad.addColorStop(0.5, colorStr);
                        grad.addColorStop(1, colorStr);
                    } else {
                        grad.addColorStop(0, colorStr);
                        grad.addColorStop(0.5, colorStr);
                        grad.addColorStop(1, clearStr);
                    }

                    const lx = edge === 0 ? canvas.margin / 2 : w - canvas.margin / 2;

                    for (let i = 0; i < ys.length - 1; i++) {
                        const midY = (ys[i] + ys[i + 1]) / 2;
                        const stripH = ys[i + 1] - ys[i];

                        const probeSx = edge === 0 ? canvas.margin + 2 : w - canvas.margin - 2;
                        const [pmx, pmy] = screenToMath(probeSx, midY, cx, cy);
                        const K = Math.ceil(vx * pmx + vy * pmy + gamma[j] - 1e-9);

                        if (K < -1 || K > 1) continue;

                        // Fill parallelogram following grid line slope
                        tc.beginPath();
                        tc.moveTo(edgeSx, ys[i]);
                        tc.lineTo(edgeSx, ys[i + 1]);
                        tc.lineTo(outerX, ys[i + 1] + shift);
                        tc.lineTo(outerX, ys[i] + shift);
                        tc.closePath();
                        tc.fillStyle = grad;
                        tc.fill();

                        const label = `K${SUBSCRIPTS[j]}=${K}`;
                        const th = 12;
                        if (stripH >= th + 2) {
                            labels.push({
                                x: lx,
                                y: midY + shift / 2,
                                text: label,
                                color: COLORS[j],
                            });
                        }
                    }
                }
            }
        }

        // Pass 2: draw all text labels on top of gradient fills
        tc.font = "10px sans-serif";
        tc.textAlign = "center";
        tc.textBaseline = "middle";
        for (const { x, y, text, color } of labels) {
            const tw = tc.measureText(text).width;
            tc.fillStyle = "rgba(255,255,255,0.7)";
            tc.fillRect(x - tw / 2 - 2, y - 6, tw + 4, 12);
            tc.fillStyle = color;
            tc.fillText(text, x, y);
        }
    }

    // ── Main draw ─────────────────────────────────────────────────────

    function draw() {
        // Every layer decides for itself whether it is wanted; see the specs above.
        stack.drawAll();

        // The scan depends on γ and the view, exactly like the rhomb set does.
        scanSmallRegions();
        updateMeter();
        if (loupe.view) { loupe.redraw(); drawFootprint(); }
    }

    // ── Panel ─────────────────────────────────────────────────────────

    const featureBoxes: { key: keyof Features; cb: HTMLInputElement }[] = [];

    function row(parent: HTMLElement, title: string): HTMLElement {
        const wrap = document.createElement("div");
        wrap.className = "panel-row";
        if (title) {
            const t = document.createElement("span");
            t.className = "panel-label";
            t.textContent = title;
            wrap.appendChild(t);
        }
        parent.appendChild(wrap);
        return wrap;
    }

    function checkbox(
        parent: HTMLElement, label: string, checked: boolean,
        onChange: (v: boolean) => void, swatch?: string,
    ): HTMLInputElement {
        const lbl = document.createElement("label");
        lbl.className = "layer-toggle";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.addEventListener("change", () => onChange(cb.checked));
        lbl.appendChild(cb);
        if (swatch) {
            const sw = document.createElement("span");
            sw.className = "layer-swatch";
            sw.style.background = swatch;
            lbl.appendChild(sw);
        }
        lbl.appendChild(document.createTextNode(label));
        parent.appendChild(lbl);
        return cb;
    }

    /** A checkbox bound to one feature flag, re-synced when a step preset lands. */
    function featureToggle(parent: HTMLElement, key: keyof Features, label: string) {
        const cb = checkbox(parent, label, features[key], (v) => {
            features[key] = v;
            draw();
        });
        featureBoxes.push({ key, cb });
    }

    function syncPanel() {
        for (const { key, cb } of featureBoxes) cb.checked = features[key];
    }

    function buildLayerPanel() {
        // Generated from the stack, not hand-written: a layer registered with a
        // group gets its switch here without anyone editing this function. That is
        // the point of registration, and an exploration page gets the same for free.
        for (const [group, group_layers] of stack.groups()) {
            const r = row(layerPanelDiv, group);
            for (const layer of group_layers) {
                const swatch = layer.id.startsWith("grid-")
                    ? COLORS[Number(layer.id.slice(5))]
                    : undefined;
                checkbox(r, layer.label, layer.userVisible, (v) => {
                    layer.userVisible = v;
                    // the rhomb set depends on which families are in play
                    if (layer.id.startsWith("grid-")) rhombCache = null;
                    draw();
                }, swatch);
            }
            if (group === "Penrose") {
                checkbox(r, "in front", penroseInFront, (v) => {
                    penroseInFront = v;
                    restackPenrose();
                });
            }
        }

        // Behaviours, which are not layers
        const hRow = row(layerPanelDiv, "On hover");
        featureToggle(hRow, "hoverVertex", "vertex from region");
        featureToggle(hRow, "hoverTile", "tile from intersection");

        // Collapsed settings — set once, then forgotten
        const det = document.createElement("details");
        det.className = "settings";
        const sum = document.createElement("summary");
        sum.textContent = "settings";
        det.appendChild(sum);

        const sRow = row(det, "");
        checkbox(sRow, "allow singularities", !guardRegular, (v) => {
            guardRegular = !v;
            updateLockedGamma();
            draw();
        });
        checkbox(sRow, "loupe on tiny regions", loupeEnabled, (v) => {
            loupeEnabled = v;
            if (!v) closeLoupe();
            draw();
        });
        checkbox(sRow, "vertical-axis symmetry", verticalSymmetry, (v) => {
            verticalSymmetry = v;
            rebuildDirections();
            rhombCache = null;
            draw();
        });

        const tRow = row(det, "gridline width");
        const thick = document.createElement("input");
        thick.type = "range";
        thick.min = "0.5";
        thick.max = "4";
        thick.step = "0.5";
        thick.value = String(gridLineWidth);
        thick.className = "thickness";
        thick.addEventListener("input", () => {
            gridLineWidth = parseFloat(thick.value);
            draw();
        });
        tRow.appendChild(thick);

        layerPanelDiv.appendChild(det);
    }

    // ── Loupe ─────────────────────────────────────────────────────────
    //
    // The panel itself is in ui/loupe.ts and knows nothing about pentagrids. What
    // stays here is what only this page can say: what counts as a target worth
    // magnifying, how to paint the magnified content, and what a point under the
    // cursor means.

    const LOUPE_TRIGGER_PX = 20;   // search radius around the cursor
    const LOUPE_TARGET_PX = 40;    // and present the target at about this size
    const LOUPE_MAX_MAG = 1e5;
    // A concurrency has no size to scale from. This is enough to show plainly
    // that the lines really do meet rather than bounding a sliver.
    const CONCURRENCY_MAG = 1000;

    let loupeHoverK: number[] | null = null;

    const loupe = createLoupe({
        container,
        onChange: () => drawFootprint(),
        tooltip,
        onHover: (mx, my) => {
            loupeHoverK = computeKTuple(mx, my);
            return formatKTooltip(loupeHoverK);
        },
        render: (lctx, lview, lsize) => {
            const lcx = lsize / 2, lcy = lsize / 2;
            withView({
                scale: lview.scale, viewX: lview.x, viewY: lview.y,
                w: lsize, h: lsize, margin: 0,
            }, () => {
                if (loupeHoverK) {
                    const poly = regionPoly(loupeHoverK);
                    if (poly.length >= 3) {
                        lctx.beginPath();
                        poly.forEach(([px, py], i) => {
                            const [sx, sy] = mathToScreen(px, py, lcx, lcy);
                            if (i === 0) lctx.moveTo(sx, sy); else lctx.lineTo(sx, sy);
                        });
                        lctx.closePath();
                        lctx.fillStyle = "rgba(255, 255, 100, 0.45)";
                        lctx.fill();
                        lctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
                        lctx.lineWidth = 2;
                        lctx.stroke();
                    }
                }
                for (let j = 0; j < NUM_GRIDS; j++) {
                    if (!gridLayers[j].userVisible) continue;
                    drawGridFamily(lctx, j, lsize, lsize, lcx, lcy);
                }
            });
        },
    });

    /**
     * The thing nearest the cursor worth magnifying: an unhittable region, or a
     * concurrency. Concurrencies win — they are the more important find, and
     * unlike a small region no magnification will ever open one up.
     */
    function nearestLoupeTarget(sx: number, sy: number, cx: number, cy: number): LoupeTarget | null {
        let best: LoupeTarget | null = null;
        let bestD = LOUPE_TRIGGER_PX;

        for (const c of concurrencies) {
            const [rx, ry] = gridToScreen(c.x, c.y, cx, cy);
            const d = Math.hypot(rx - sx, ry - sy);
            if (d < bestD) {
                bestD = d;
                best = { x: c.x, y: c.y, mag: CONCURRENCY_MAG, label: `${c.lines} lines concurrent` };
            }
        }
        if (best) return best;

        for (const r of smallRegions) {
            if (r.size >= HOVERABLE_PX) continue;
            const [rx, ry] = gridToScreen(r.x, r.y, cx, cy);
            const d = Math.hypot(rx - sx, ry - sy);
            if (d < bestD) {
                bestD = d;
                const mag = Math.min(LOUPE_MAX_MAG,
                    Math.max(2, LOUPE_TARGET_PX / Math.max(r.size, 1e-9)));
                best = {
                    x: r.x, y: r.y, mag,
                    label: `region ${r.size < 0.01 ? r.size.toExponential(1) : r.size.toFixed(2)} px`,
                };
            }
        }
        return best;
    }

    /** Where the panel is looking, drawn in the main view. */
    function drawFootprint() {
        footprintCtx.clearRect(0, 0, canvas.w, canvas.h);
        const v = loupe.view;
        if (!v) return;
        const cx = canvas.w / 2, cy = canvas.h / 2;
        const half = (220 / 2) / v.scale;
        const [x0, y0] = gridToScreen(v.x - half, v.y + half, cx, cy);
        const [x1, y1] = gridToScreen(v.x + half, v.y - half, cx, cy);
        // At high magnification the footprint is sub-pixel; show a minimum box.
        const w = Math.max(x1 - x0, 7), h = Math.max(y1 - y0, 7);
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        footprintCtx.strokeStyle = "rgba(220, 40, 70, 0.9)";
        footprintCtx.lineWidth = 1.5;
        footprintCtx.strokeRect(mx - w / 2, my - h / 2, w, h);
    }

    function closeLoupe() {
        loupeHoverK = null;
        loupe.close();
    }

    // ── Intersection picking ──────────────────────────────────────────

    /** The rhomb whose generating crossing is nearest the cursor, within a radius. */
    function nearestIntersection(sx: number, sy: number, cx: number, cy: number): Rhomb | null {
        let best: Rhomb | null = null;
        let bestD = 14;
        for (const r of currentRhombs()) {
            const [ix, iy] = gridToScreen(r.x0, r.y0, cx, cy);
            const d = Math.hypot(ix - sx, iy - sy);
            if (d < bestD) { bestD = d; best = r; }
        }
        return best;
    }

    /** Fill the tile a crossing produced, and join the two with an arrow. */
    function highlightTile(r: Rhomb, cx: number, cy: number) {
        const pts = r.vertices.map(([x, y]) => mathToScreen(x, y, cx, cy));
        highlightCtx.beginPath();
        highlightCtx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) highlightCtx.lineTo(pts[i][0], pts[i][1]);
        highlightCtx.closePath();
        highlightCtx.fillStyle = r.thick ? "rgba(232,193,112,0.75)" : "rgba(126,184,218,0.75)";
        highlightCtx.fill();
        highlightCtx.strokeStyle = "rgba(255,180,0,0.95)";
        highlightCtx.lineWidth = 2;
        highlightCtx.stroke();

        // The crossing itself, and a line to the tile it became
        const [ix, iy] = gridToScreen(r.x0, r.y0, cx, cy);
        let mx = 0, my = 0;
        for (const [px, py] of pts) { mx += px; my += py; }
        mx /= pts.length; my /= pts.length;

        highlightCtx.strokeStyle = "rgba(255,180,0,0.9)";
        highlightCtx.lineWidth = 1.5;
        highlightCtx.beginPath();
        highlightCtx.moveTo(ix, iy);
        highlightCtx.lineTo(mx, my);
        highlightCtx.stroke();

        highlightCtx.fillStyle = "#e63946";
        highlightCtx.beginPath();
        highlightCtx.arc(ix, iy, 4, 0, 2 * Math.PI);
        highlightCtx.fill();
    }

    // ── Tooltip / hover highlight ──────────────────────────────────────

    function clearHighlight() {
        highlightCtx.clearRect(0, 0, canvas.w, canvas.h);
    }

    function formatKTooltip(K: number[]): string {
        const parts = K.map((v, j) => {
            const layer = stack.get(`grid-${j}`);
            const active = !layer || layer.userVisible;
            const color = active ? "#fff" : "#999";
            return `<span style="color:${color}">${v}</span>`;
        });
        const index = K.reduce((a, b) => a + b, 0);
        return `K[${index}] = {${parts.join(", ")}}`;
    }

    /**
     * The pentagrid region with this K-tuple, as a polygon in math coordinates,
     * clipped to the visible rect. The region is the intersection of half-planes
     * K_j - 1 < x·v_j + γ_j ≤ K_j, found by clipping against each strip in turn.
     */

    function highlightRegion(K: number[], cx: number, cy: number, dotSx: number, dotSy: number) {
        const poly = regionPoly(K);
        if (poly.length < 3) return;

        // Convert to screen and compute centroid + bounding size
        const screenPts = poly.map(([px, py]) => mathToScreen(px, py, cx, cy));
        let centX = 0, centY = 0;
        let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity;
        for (const [sx, sy] of screenPts) {
            centX += sx; centY += sy;
            if (sx < sxMin) sxMin = sx;
            if (sx > sxMax) sxMax = sx;
            if (sy < syMin) syMin = sy;
            if (sy > syMax) syMax = sy;
        }
        centX /= screenPts.length;
        centY /= screenPts.length;

        // Draw the region
        highlightCtx.fillStyle = "rgba(255, 255, 100, 0.35)";
        highlightCtx.strokeStyle = "rgba(255, 200, 0, 0.8)";
        highlightCtx.lineWidth = 2;
        highlightCtx.beginPath();
        highlightCtx.moveTo(screenPts[0][0], screenPts[0][1]);
        for (let i = 1; i < screenPts.length; i++) {
            highlightCtx.lineTo(screenPts[i][0], screenPts[i][1]);
        }
        highlightCtx.closePath();
        highlightCtx.fill();
        highlightCtx.stroke();

        // If the region is small, draw an arrow from the dot to its centroid
        const regionSize = Math.max(sxMax - sxMin, syMax - syMin);
        if (regionSize < 20) {
            const dx = centX - dotSx;
            const dy = centY - dotSy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 10) {
                const ux = dx / dist;
                const uy = dy / dist;
                // Arrow line from near the dot to near the centroid
                const startX = dotSx + ux * 8;
                const startY = dotSy + uy * 8;
                const endX = centX - ux * 4;
                const endY = centY - uy * 4;

                highlightCtx.strokeStyle = "rgba(255, 200, 0, 0.8)";
                highlightCtx.lineWidth = 1.5;
                highlightCtx.beginPath();
                highlightCtx.moveTo(startX, startY);
                highlightCtx.lineTo(endX, endY);
                highlightCtx.stroke();

                // Arrowhead
                const headLen = 7;
                const angle = Math.atan2(uy, ux);
                highlightCtx.beginPath();
                highlightCtx.moveTo(endX, endY);
                highlightCtx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
                highlightCtx.moveTo(endX, endY);
                highlightCtx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
                highlightCtx.stroke();
            }
        }
    }

    /** Clip polygon to the half-plane a*x + b*y + c ≥ 0 (or > 0 if strict, but we use ≥ for robustness) */

    eventCanvas.addEventListener("mousemove", (e) => {
        if (isPanning) {
            tooltip.style.display = "none";
            clearHighlight();
            return;
        }

        const rect = eventCanvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        if (sx < canvas.margin || sx > canvas.w - canvas.margin ||
            sy < canvas.margin || sy > canvas.h - canvas.margin) {
            tooltip.style.display = "none";
            clearHighlight();
            return;
        }

        const cx = canvas.w / 2;
        const cy = canvas.h / 2;

        // Loupe trigger: the meter's quantity, evaluated near the cursor instead of
        // over the whole window. Skipped while frozen, i.e. while the cursor is
        // inside the loupe.
        // Retarget on approach, but never close on "nothing nearby": the cursor has
        // to travel off the target to reach the panel, and closing on distance meant
        // the loupe disappeared en route and could never be entered. Esc dismisses.
        if (loupeEnabled && !loupe.frozen) {
            const target = nearestLoupeTarget(sx, sy, cx, cy);
            if (target) loupe.open(target, scale);
        }

        // Intersection -> its tile. Only possible now that rhombs remember the
        // crossing that made them (PLAN.md item 4).
        if (features.hoverTile) {
            const hit = nearestIntersection(sx, sy, cx, cy);
            if (hit) {
                clearHighlight();
                highlightTile(hit, cx, cy);
                tooltip.innerHTML =
                    `families <span style="color:${COLORS[hit.j]}">${hit.j}</span>` +
                    `&times;<span style="color:${COLORS[hit.k]}">${hit.k}</span>` +
                    ` &nbsp;n = (${hit.nj}, ${hit.nk})` +
                    `<br><span style="color:#fc0">${hit.thick ? "thick" : "thin"}</span> rhomb`;
                tooltip.style.display = "block";
                tooltip.style.left = (e.clientX + 12) + "px";
                tooltip.style.top = (e.clientY - 34) + "px";
                return;
            }
        }

        if (features.hoverVertex) {
            // Region -> its dual vertex. The K-tuple is a fact about the pentagrid,
            // so it is read in grid coordinates; the vertex it points at stays in
            // tiling coordinates.
            const [mx, my] = screenToGrid(sx, sy, cx, cy);
            const K = computeKTuple(mx, my);
            tooltip.innerHTML = formatKTooltip(K);
            tooltip.style.display = "block";
            tooltip.style.left = (e.clientX + 12) + "px";
            tooltip.style.top = (e.clientY - 28) + "px";

            clearHighlight();

            // Derive dark version of the region's color
            let hash = 0;
            for (let j = 0; j < NUM_GRIDS; j++) {
                hash = ((hash << 5) - hash + K[j] + 50) | 0;
            }
            const hue = (((hash * 137) % 360) + 360) % 360;
            const [dr, dg, db] = hslToRgb(hue, 0.7, 0.35);
            const darkColor = `rgb(${dr},${dg},${db})`;

            // Compute dual vertex f = Σ K_j · v_j
            let fx = 0, fy = 0;
            for (let j = 0; j < NUM_GRIDS; j++) {
                fx += K[j] * directions[j][0];
                fy += K[j] * directions[j][1];
            }
            const [dsx, dsy] = mathToScreen(fx, fy, cx, cy);

            // Draw the dual point
            highlightCtx.fillStyle = darkColor;
            highlightCtx.beginPath();
            highlightCtx.arc(dsx, dsy, 3, 0, 2 * Math.PI);
            highlightCtx.fill();

            // Arrow from cursor to dual vertex
            const adx = dsx - sx;
            const ady = dsy - sy;
            const dist = Math.sqrt(adx * adx + ady * ady);
            if (dist > 15) {
                const ux = adx / dist;
                const uy = ady / dist;
                const startX = sx + ux * 6;
                const startY = sy + uy * 6;
                const endX = dsx - ux * 6;
                const endY = dsy - uy * 6;

                highlightCtx.strokeStyle = darkColor;
                highlightCtx.lineWidth = 1.5;
                highlightCtx.beginPath();
                highlightCtx.moveTo(startX, startY);
                highlightCtx.lineTo(endX, endY);
                highlightCtx.stroke();

                const headLen = 7;
                const angle = Math.atan2(uy, ux);
                highlightCtx.beginPath();
                highlightCtx.moveTo(endX, endY);
                highlightCtx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
                highlightCtx.moveTo(endX, endY);
                highlightCtx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
                highlightCtx.stroke();
            }
            return;
        }

        if (features.hoverVertex) {
            // and the reverse: nearest dual vertex -> the region that produced it
            let best: DualVertex | null = null;
            let bestDist = 12; // pixel threshold
            for (const dv of dualVertices) {
                const dx = dv.sx - sx;
                const dy = dv.sy - sy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < bestDist) {
                    bestDist = d;
                    best = dv;
                }
            }

            clearHighlight();

            if (best) {
                // Equation: f = Σ K_j · v_j
                const terms = best.K.map((v, j) => {
                    const layer = stack.get(`grid-${j}`);
                    const active = !layer || layer.userVisible;
                    const color = active ? "#fff" : "#999";
                    return `<span style="color:${color}">${v}</span>&middot;v${SUBSCRIPTS[j]}`;
                });
                tooltip.innerHTML =
                    formatKTooltip(best.K) +
                    `<br><span style="color:#fc0">f</span> = ${terms.join(" + ")}`;
                tooltip.style.display = "block";
                tooltip.style.left = (e.clientX + 12) + "px";
                tooltip.style.top = (e.clientY - 28) + "px";

                // Highlight the hovered dot
                highlightCtx.fillStyle = "#fc0";
                highlightCtx.beginPath();
                highlightCtx.arc(best.sx, best.sy, 5, 0, 2 * Math.PI);
                highlightCtx.fill();

                // Highlight the source region in the pentagrid
                withView(gridView(), () => highlightRegion(best!.K, cx, cy, best!.sx, best!.sy));
            } else {
                tooltip.style.display = "none";
            }
            return;
        }

        tooltip.style.display = "none";
        clearHighlight();
    });

    eventCanvas.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
        clearHighlight();
    });

    // ── Init ──────────────────────────────────────────────────────────

    if (config.buildId) console.log(`pentagrid build ${config.buildId}`);

    // An exploration's own layers go on before the panel is generated, so they
    // get their switches like anything else.
    config.layers?.({
        stack, model, currentRhombs, withView, gridView,
        getView: () => ({ scale, x: viewX, y: viewY }),
        redraw: () => draw(),
    });

    if (config.gamma) {
        for (let j = 0; j < NUM_GRIDS; j++) {
            gammaQ[j] = Math.round((config.gamma[j] ?? 0) * GAMMA_DEN);
        }
    }

    buildLayerPanel();
    restackPenrose();
    updateLockedGamma();
    updateStepUI();
    draw();

    return {
        redraw: draw,
        setStep: (i: number) => {
            if (STEP_COUNT === 0) return;
            currentStep = Math.max(0, Math.min(STEP_COUNT - 1, i));
            updateStepUI();
            draw();
        },
        getView: () => ({ scale, x: viewX, y: viewY }),
        setView: (v) => {
            scale = v.scale;
            viewX = v.x;
            viewY = v.y;
            draw();
        },
        setGamma: (g) => {
            for (let j = 0; j < NUM_GRIDS; j++) {
                gammaQ[j] = Math.round((g[j] ?? 0) * GAMMA_DEN);
            }
            updateLockedGamma();
            rhombCache = null;
            draw();
        },
        stack,
    };
}
