import type {
    Concurrency, Pentagrid, Rhomb, SmallRegion, Vec2, ViewRect,
} from "../geometry/types.js";
import {
    NUM_GRIDS, K_EPS, collectRhombs as geoCollectRhombs, computeKTuple as geoComputeKTuple,
    solveIntersection as geoSolveIntersection, segmentAt, nearestLine, dualVertex,
} from "../geometry/pentagrid.js";
import type { GridSegment } from "../geometry/pentagrid.js";
import { scanRegions } from "../geometry/regularity.js";
import { resolveConcurrency, describeResolution } from "../geometry/resolve.js";
import { findClusters, CLUSTER_FILL, p1Pentagons as geoP1, P1_FILL, P1_STAR } from "../geometry/clusters.js";
import type { ClusterKind, P1Pentagon } from "../geometry/clusters.js";
import { vertexIndex } from "../geometry/roof.js";
import type { Resolution } from "../geometry/resolve.js";
import { regionPoly as geoRegionPoly, clipToConvex } from "../geometry/region.js";
import { createGammaSet, penroseCondition } from "../geometry/gamma.js";
import type { GammaSet } from "../geometry/gamma.js";
import { rhombArcs, rhombArrows, rhombPentagons, rhombDeflation, rhombKitesDarts, dressingReadings } from "../geometry/decor.js";
import { lighten } from "../ui/reticulum.js";
import { LayerStack } from "./layers.js";
import { mountGammaControls } from "./controls.js";
import { createLoupe } from "../ui/loupe.js";
import type { LoupeTarget } from "../ui/loupe.js";


// Grid line colors
// Five for the pentagrid, then two more so a heptagrid has one per family. The
// first five are unchanged, so every existing page keeps its exact palette.
const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5",
                "#e07a5f", "#3d5a80", "#8ac926", "#ff6b35", "#6a4c93",
                "#118ab2", "#b5838d", "#2b9348", "#c9184a", "#f4a261",
                "#7209b7", "#588157"];   // seventeen: twelve, and five more for Jake's 17

// Rhomb fill colors
const THICK_FILL = "#e8c170";
const THIN_FILL = "#7eb8da";
/**
 * Off the pentagrid a grid of order n makes floor(n/2) rhomb shapes, class 1
 * the fattest. The odd classes wear warm shades and the even ones cool, so
 * neighboring classes contrast the way thick and thin do — class 1 IS the
 * thick gold and class 2 the thin blue, so five is untouched — and each class
 * within a parity darkens as it narrows. Jake: "different and contrasting
 * (odd vs even) colors".
 */
const WARM_FILLS = [THICK_FILL, "#d98e5a", "#bd6a48", "#9e4f3c", "#7a3a30"];
const COOL_FILLS = [THIN_FILL, "#6d9fc6", "#5a86ad", "#476d93", "#355577"];
function classFill(cls: number): string {
    const i = Math.floor((cls - 1) / 2);
    const pal = cls % 2 === 1 ? WARM_FILLS : COOL_FILLS;
    return pal[Math.min(i, pal.length - 1)];
}
/** A 2k-gon is neither thick nor thin — it is a stack of both — so it gets its own. */
const SINGULAR_FILL = "#b48ec4";
/** One per Wieringa level. Penrose uses four; the index is taken modulo. */
/**
 * The height ramp's strength: wieringa-roof's `shadeColor` moves a color by
 * amount * |t| * 0.55 towards white above the middle and black below it.
 */
const RAMP = 0.55;

/** Mix a color towards white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    const to = t >= 0 ? 255 : 0;
    const a = Math.abs(t);
    const mix = (c: number) => Math.round(c + (to - c) * a);
    const r = mix((v >> 16) & 255), g = mix((v >> 8) & 255), b = mix(v & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * How the tiles are dressed. Not feature flags: `color` is a choice of three and
 * `opacity` is a number, and neither is the sort of thing a step turns on.
 */
export interface TileStyle {
    /**
     * thick/thin, the two families that made it, its rhomb group (Pe5, Pe3, Pe1
     * in sun-star's palette; bare when it belongs to none, or when the patch is
     * not Penrose and groups are undefined), the P1 tiling it carries, the
     * matching curves as filled regions (Wikipedia's rhombus-with-arcs), the P1
     * pentagons at the scale where every thick rhomb holds one whole, the next
     * generation (the deflation: thick gold, thin gray, at scale 1/φ), the
     * kites and darts (P2 at the same scale, per de Bruijn's Fig. 4) — or
     * `bands`: the two families as CROSSED BANDS, exactly as grow.html draws
     * them. Each band runs across the tile in its family's color, `band` wide as
     * a fraction of the edge, and the square where they cross is the composite.
     * At 100% the crossing covers the whole tile and it looks like `pair`;
     * below that the tile reads as two gridlines passing through. A 2k-gon takes
     * no color under it.
     */
    color: "type" | "pair" | "bands" | "groups" | "p1" | "curves" | "pentagons" | "nextgen" | "kites";
    /** Band width for `bands`, 0..1 of the edge. */
    band: number;
    /** Contour lines across each tile. */
    isogloss: boolean;
    /**
     * The AR-pattern drawn de Bruijn's way: a solid arrow along each edge from
     * just short of one vertex to just short of the other, shaft and filled
     * head as in jake/arrow.svg, one head each — green for the doubles and red
     * for the singles, the color being the whole distinction. Off, the arrows are the plain
     * chevron markings at the edge midpoints.
     */
    coloredArrows: boolean;
    /**
     * What marks a Penrose vertex: the red dot, or its index in a circle — ❶
     * white on black, ① black on white — once per vertex, in place of the dot.
     * The index on the tile face (the `vertexIndex` feature) is the other way
     * to see it, four times per vertex.
     */
    vertexMark: "dot" | "filled" | "open";
    /**
     * Decorate off a Penrose patch too. The index-placed dressings — arrows,
     * curves, pentagons, next-gen, kites — need a corner at the patch's extreme
     * level; on Penrose every tile has one. Off it the index spans five
     * levels: the tiles touching the top or bottom still get their decoration
     * and the middle ones stay bare, and the matching across edges no longer
     * holds everywhere — which is the picture. Off by default. Jake's idea.
     */
    offPenrose: boolean;
    /**
     * The height ramp, over whatever color is chosen — wieringa-roof's shading.
     * Lighter towards the top of the patch, darker towards the bottom, each tile
     * a gradient from its low corner to its high. See heightGradient.
     */
    shading: boolean;
    /** Strength of the ramp, 0..1. wieringa-roof's `shade` slider. */
    ramp: number;
    /** Tile edges as real lines rather than a hairline, as grow.html's setting. */
    boldEdges: boolean;
    /** Fill alpha. Edges and decoration stay solid. */
    opacity: number;
}

// Unicode subscripts for K labels
const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀', '₁₁', '₁₂', '₁₃', '₁₄', '₁₅', '₁₆'];


export interface Features {
    /** The pentagrid itself. Separate from a family being enabled, which also
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
    /**
     * Penrose's arrows on the edges — single and double, the matching rule as
     * he first marked it — read off the vertex indices as de Bruijn does. Drawn
     * only on a Penrose patch, where the index has the four values the rule
     * needs.
     */
    arrows: boolean;
    /**
     * The edges inside a 2k-gon, dotted.
     *
     * They are the edges of the C(k,2) rhombs the coincident crossings produce.
     * An ordinary edge is dual to a gridline SEGMENT, the piece of line j between
     * two consecutive crossings; at a concurrency those crossings coincide and the
     * segment has zero length, so the edge exists on the Penrose side with no
     * counterpart on the grid. Likewise the vertices inside: each is f(K) for a
     * region squeezed to a point. Dotted, because they are real edges of tiles
     * that are only superposed, not laid out — and they line up, per family, into
     * a strip of parallel rhombs across the 2k-gon, which is the grid line's path
     * through it.
     */
    pseudoEdges: boolean;
    /**
     * De Bruijn's index of every tile corner, written on the tile face just
     * inside that corner. Every dual vertex has one — it is f(K) for a K-tuple,
     * and ΣK is the height the roof lifts it to. Shown normalized, ΣK − min + 1,
     * so a Penrose patch reads 1..4 whatever the total (the raw sum is 2..5 on
     * the sun, whose origin is K = (1,1,1,1,1)); the rhomb groups, the arrows,
     * the curves, the P1 pentagons and the deflation are all placed by it. Off
     * Penrose it runs 1..5.
     */
    vertexIndex: boolean;
    /** A small circle on the origin, as sunstar draws it — the point γ is about. */
    center: boolean;
    // The three hover helpers, one per grid/Penrose correspondence. Each works
    // both ways and each overrides an "off" on the thing it is helping with —
    // the point of a helper is to show you the object, not to respect a switch.
    hoverVertex: boolean;   // K-region  <-> Penrose vertex
    hoverEdge: boolean;     // gridline segment <-> Penrose edge
    hoverTile: boolean;     // intersection <-> Penrose tile
}

export interface ViewState {
    scale: number;
    viewX: number; viewY: number;
    w: number; h: number;
    margin: number;
    /** True while the view is in GRID units, i.e. inside withView(gridView()). */
    gridUnits?: boolean;
}

export interface PentagridConfig {
    /** Where the canvases go. Also the source of implicit sizing. */
    container: HTMLElement;
    /**
     * A second container for the Penrose group, so one model draws its grid in
     * `container` and its dual here — split.html. One view, one gamma, one
     * rhomb cache; the axes are drawn in both; hover crosses over because it is
     * the same handler. The two must be the same size: the stack has one view.
     */
    containerP?: HTMLElement;
    controls?: HTMLElement;
    panel?: HTMLElement;
    /** With `containerP`: the Penrose rows of the panel go here instead. */
    panelP?: HTMLElement;
    /** Registered before the first draw, so an exploration gets its own layers
     *  without this file knowing anything about them. */
    layers?: (ctx: PentagridParts) => void;
    /** Starting feature set. Useful for a page with no steps to impose one. */
    features?: Partial<Features>;
    /** How the tiles are dressed. See TileStyle. */
    tileStyle?: Partial<TileStyle>;
    /** Starting offsets. Omitted means all zero, which the guard then moves off. */
    gamma?: readonly number[];
    /**
     * How many line families. Five is the pentagrid, and everything the method
     * page shows is written for it; seven gives Lutfalla's heptagrid.
     */
    n?: number;
    /**
     * Directions of your own instead of the evenly spread ones — the
     * discrete-directions experiment. Length sets n. Off the even spread the
     * gain is a matrix rather than n/2, so registration is approximate; the
     * view scales by the frame's mean and says so on the page rather than
     * pretending otherwise.
     */
    directions?: readonly Vec2[];
    /**
     * What the dual builds tile edges from, if not the directions. De Bruijn
     * uses one array for both; separating them is the discrete experiment's
     * second switch — the grid's spacing and the tiling's edge lengths are not
     * the same choice once the directions are unequal.
     */
    edges?: readonly Vec2[];
    /** Fired whenever the user pans or zooms this instance. Not fired by
     *  setView, so linking two instances does not loop. */
    onViewChange?: (v: View) => void;
    /** The magnifier that opens on tiny regions. Off unless asked for: it is a
     *  tool for inspecting near-singular configurations, and it gets in the way
     *  of simply looking at the picture. */
    loupe?: boolean;
    /**
     * Right-button drag, in pixels since the last move. A view with a camera uses
     * it to orbit; the pentagrid itself has no camera and does not interpret it.
     * Supplying this also suppresses the context menu over the canvas.
     */
    onOrbit?: (dx: number, dy: number) => void;
    /**
     * Widen the region tiles are collected from. The pentagrid works out what is
     * visible for a flat, straight-down view; a host with a camera sees a
     * different region and says so here. Returning the rect unchanged is the
     * default.
     */
    collectRect?: (base: ViewRect) => ViewRect;
    /**
     * How far beyond the canvas edge to COMPUTE, in tiling units. Default 1.
     *
     * A dual vertex on screen has its source region within a bounded wobble of
     * it — about a rhomb edge — so a region can lie partly or wholly outside the
     * canvas while its vertex is well inside. Computing over a wider rect than
     * is shown is what keeps every source present; the canvas clips the rest.
     * The wobble is bounded by about one rhomb edge, and measured over a 12x12
     * window half a unit already recovered every lost source; 1 is that with
     * room, at 1.36x the scan area.
     */
    computePad?: number;
    /** Where the hover readout sits. Default "corner": off the pointer. */
    hoverBox?: "corner" | "pointer";
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

    /**
     * Impose a feature set. This is how a narrative page configures the view —
     * the view no longer knows what a page is, so it cannot configure itself.
     *
     * By default it REPLACES: every feature not named goes off, which is what a
     * page wants when you arrive at it. Pass `{ merge: true }` to change a few
     * and leave the rest alone.
     */
    setFeatures: (features: Partial<Features>, opts?: { merge?: boolean }) => void;
    /** How strongly the grid shows. Pages fade it as the tiling takes over. */
    setGridAlpha: (alpha: number) => void;
    /** Change how the tiles are dressed. Merges; omitted fields stay. */
    setTileStyle: (style: Partial<TileStyle>) => void;
    /**
     * Which panel rows to show, by their label, or null for all of them. A page
     * decides what is worth exposing on it.
     */
    exposeRows: (labels: readonly string[] | null) => void;
    /** A panel row by its label, for a page that wants to add a control to it. */
    panelRow: (label: string) => HTMLElement | undefined;
    /**
     * Fires when a panel switch turns a feature on. A narrative can use it to go
     * to the page where that feature is the subject, instead of leaving the
     * switch on with nothing to see.
     */
    onFeatureOn: (cb: (key: keyof Features) => void) => void;
    /** Read the current pan and zoom. */
    getView: () => View;
    /** Drive the pan and zoom from outside. Does NOT fire onViewChange, so two
     *  linked instances cannot bounce updates off each other forever. */
    setView: (v: View) => void;
    setGamma: (g: readonly number[]) => void;
    /** The γ cluster: offsets, the sum, the guard, and which lines are in play. */
    gamma: GammaSet;
    stack: LayerStack;
}

/**
 * Which feature flag actually decides a layer's visibility.
 *
 * These layers are `visible: () => features.X`, so a panel switch that writes
 * only `userVisible` is a switch that lies: the box reads checked while the
 * feature is off, and clicking it does nothing. Binding the switch to the
 * feature is the fix, and it is the same two-homes-for-one-fact mistake the
 * duplicate regularity checkbox was.
 *
 * Exported so tools/layerchart.mjs can say which switch drives which layer.
 */
export const LAYER_FEATURE: Record<string, keyof Features> = {
    background: "kRegions",
    axes: "axes",
    dots: "intersectionDots",
    klabels: "kLabels",
    "penrose-tiles": "penroseTiles",
    "penrose-edges": "penroseEdges",
    "penrose-decor": "penroseDecor",
    "penrose-pseudo": "pseudoEdges",
    "penrose-vertices": "penroseVertices",
};

export function createPentagrid(config: PentagridConfig): PentagridHandle {
    // The γ cluster owns the directions, the offsets, the sum constraint and the
    // regularity guard. See geometry/gamma.ts — this file is a view over it.
    // Singular configurations are allowed, detected and shown — not silently
    // corrected. Moving someone's offsets to keep a theorem tidy hides exactly
    // the cases worth looking at. The guard has no switch on the page; a host
    // that wants it calls gamma.setGuard(true).
    const gammaSet = createGammaSet({
        n: config.n ?? NUM_GRIDS, guard: false,
        directions: config.directions, edges: config.edges,
    });
    const directions = gammaSet.model.directions;
    const gamma = gammaSet.model.gamma;
    // "Sometimes you just have to see them."
    let gridLineWidth = 1;

    // ── Canvas size ───────────────────────────────────────────────────
    //
    // The one place the page's canvas is decided. Everything downstream reads it
    // through the view, so a second view (the loupe already is one) or a page that
    // wants a different size costs nothing. PLAN.md, step 1 of parameterizing.
    //
    // Explicit wins: data-width / data-height / data-margin on #canvas-container.
    // Implicit otherwise: the container's own laid-out size, then 800 as a floor.

    interface CanvasSpec {
    w: number; h: number; margin: number;
    /** The page named a size, so it is pinned and must not reflow. */
    explicit: boolean;
    /** A named margin overrides the proportional one on resize. */
    fixedMargin: number | null;
}

    function intAttr(el: Element, name: string): number | null {
        const raw = parseInt(String(el.getAttribute(name) ?? ""), 10);
        return Number.isFinite(raw) && raw > 0 ? raw : null;
    }

    function readCanvasSpec(): CanvasSpec {
        const el = config.container;
        const rect = el.getBoundingClientRect();
        const dw = intAttr(el, "data-width");
        const dh = intAttr(el, "data-height");
        const w = dw ?? (Math.round(rect.width) || 800);
        const h = dh ?? (Math.round(rect.height) || 800);
        // 40 on an 800 canvas: keep the proportion rather than the number, so the
        // K-labels still have a gutter to live in at any size.
        const fixedMargin = intAttr(el, "data-margin");
        const margin = fixedMargin ?? Math.round(Math.min(w, h) * 0.05);
        return { w, h, margin, explicit: dw !== null || dh !== null, fixedMargin };
    }

    const canvas = readCanvasSpec();

    // ── Geometry adapters ─────────────────────────────────────────────
    //
    // The geometry layer takes the pentagrid explicitly, which is what makes it
    // testable; the page keeps it in module state. `model` is built once and stays
    // current because directions and gamma are const arrays mutated in place.

    const model: Pentagrid = gammaSet.model;

    function solveIntersection(j: number, k: number, nj: number, nk: number): Vec2 | null {
        return geoSolveIntersection(model, j, k, nj, nk);
    }

    function computeKTuple(x: number, y: number): number[] {
        return geoComputeKTuple(model, x, y);
    }

    function collectRhombs(vis: ViewRect): Rhomb[] {
        return geoCollectRhombs(model, vis, {
            gain: gridGain(),
            // The gridline-tiles filter: per family, all of its lines, one of
            // them, or none. A tile is kept when either of its lines is selected.
            ribbons: gammaSet.enabledFlags().map((on, j) =>
                !on ? null : (gammaSet.lineFlags()[j] ?? "all")),
        });
    }

    /** Clips to whatever view is active, which is how the loupe reuses it. */
    function regionPoly(K: readonly number[]): Vec2[] {
        return geoRegionPoly(model, K, computeRect());
    }

    const singularTriples = () => gammaSet.singular();

    /** The visible rect in GRID coordinates, whatever the current view is. */
    function gridVisibleRect(): ViewRect {
        let r!: ViewRect;
        withView(gridView(), () => { r = computeRect(); });
        return r;
    }

    // The meter is the scan's other consumer, and it only exists if the page
    // gave us somewhere to put it.
    const showsMeter = !!config.controls;

    // The scan depends on γ, the frame, the rect and the scale — never on which
    // switch was flipped — so it is keyed like the rhomb cache. It was rerun on
    // every draw, and every panel checkbox is a draw. PLAN.md open item 1.
    let scanKey = "";
    function scanSmallRegions() {
        // The tiling reads it too: the 2k-gons ARE the concurrencies, and which
        // rhombs are stacked is decided from the same scan. Without this the
        // resolutions were drawn only on pages that happened to want the meter —
        // everywhere else a singularity silently fell back to superposed rhombs.
        const tilingNeedsIt = features.penroseTiles || features.penroseEdges;
        if (!loupeEnabled && !showsMeter && !tilingNeedsIt) {
            // Nothing would read the result, and this is the expensive call in
            // the file — it was running twice per frame on the paired views.
            smallRegions = [];
            concurrencies = [];
            resolutionCache = null;
            stackedCache = null;
            scanKey = "";
            return;
        }
        // The scan is grid-space, so it gets the grid rect. It had been handed the
        // tiling rect, which since registration became permanent meant scanning 6.25x
        // the area and counting regions that are not on screen toward the meter.
        const rect = gridVisibleRect();
        const key = [
            gammaSet.exact().join(","), String(gammaSet.getSymmetry()), scale.toFixed(6),
            rect.xMin.toFixed(4), rect.xMax.toFixed(4), rect.yMin.toFixed(4), rect.yMax.toFixed(4),
        ].join("|");
        if (key === scanKey) return;
        const found = scanRegions(model, rect, {
            candidate: CANDIDATE_PX,
            concurrentTol: CONCURRENT_TOL,
            scale,
        });
        smallRegions = found.small;
        concurrencies = found.concurrencies;
        resolutionCache = null;
        stackedCache = null;
        scanKey = key;
    }

    // Narration and its presets are the page's, not this file's.

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
    let viewGridUnits = false;
    let computePad = config.computePad ?? 1;

    // The dual map has gain n/2: f(x) = (n/2)x + const + bounded wobble, because
    // Sum_j v_j v_j^T = (n/2)I for n unit vectors equally spaced. At n = 5 that is
    // 5/2. So the tiling is drawn 2.5x the pentagrid that makes
    // it, and the two do not register. Displaying the grid under x -> (5/2)x puts
    // every rhomb back on the crossing that generated it. It is not a fudge: the
    // projection R^n -> E_par sends each basis vector to length sqrt(2/n), and with
    // that normalization the gain is exactly 1 — the n/2 is the price of unit
    // rhombs. See PLAN.md item 3.
    // Permanent, not a toggle. The grid and the tiling share one coordinate system;
    // showing or hiding the tiling is what the Penrose layers are for.
    //
    // Off the even spread there is no single gain: Σ v vᵀ is not (n/2)·I, so the
    // dual map is a linear map with a gain per axis. The view registers by the
    // MEAN of the two — tr/2n · n = tr/2 — which is exactly n/2 when the frame
    // is tight and an honest compromise when it is not. `frameGains` reports
    // both so a page can say how far from a similarity it is.
    const REGISTER_GAIN = (() => {
        let xx = 0, yy = 0;
        for (const [x, y] of model.directions) { xx += x * x; yy += y * y; }
        return (xx + yy) / 2;                           // tr/2; n/2 when tight
    })();

    function gridGain(): number {
        return REGISTER_GAIN;
    }

    /** The view that grid-space objects (lines, K-regions, K-labels) draw under. */
    function gridView(): ViewState {
        const g = gridGain();
        return {
            scale: scale * g, viewX: viewX / g, viewY: viewY / g,
            w: viewW, h: viewH, margin: viewMargin, gridUnits: true,
        };
    }

    /**
     * How many index levels the patch spans, for the index-placed dressings —
     * 4 on Penrose. Null when there is nothing to place by: five levels with
     * the off-Penrose switch off, or fewer than four (a patch too small to
     * show its extremes).
     */
    function dressingLevels(): number | null {
        const { lo, hi } = indexRange();
        const levels = hi - lo + 1;
        if (levels === 4) return 4;
        if (levels === 5 && tileStyle.offPenrose) return 5;
        return null;
    }

    /**
     * How to dress one tile: which corner is its extreme, and at what opacity.
     * One reading at full strength on a tile that has an extreme; on an
     * ambiguous tile — the (2,3,4,3) middle off Penrose, with the switch on —
     * BOTH readings at half strength, one over the other, so what is drawn is
     * the union of the two alternatives and the overlap reads as the blend.
     * Jake: "in those spots draw both".
     */
    const dressings = dressingReadings;

    /** A signed integer as a superscript, for λ = φᵐ. */
    function superscript(m: number): string {
        const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
        return (m < 0 ? "⁻" : "") + String(Math.abs(m)).split("").map((d) => digits[+d]).join("");
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
    const layerPanelDiv = config.panel ?? document.createElement("div");
    const container = config.container;
    // Only pin the box when the page asked for a size. Writing px here for an
    // implicitly sized container overrides its own CSS — which is exactly what
    // kept the viewports from ever reflowing.
    if (canvas.explicit) {
        for (const c of [container, config.containerP]) {
            if (!c) continue;
            c.style.width = `${canvas.w}px`;
            c.style.height = `${canvas.h}px`;
        }
        // The panel is a set of wrapping rows; let them wrap at the canvas edge
        // rather than run out past it.
        layerPanelDiv.style.maxWidth = `${canvas.w}px`;
        if (config.panelP) config.panelP.style.maxWidth = `${canvas.w}px`;
    }

    // Tooltip for K-tuple display
    const tooltip = document.createElement("div");
    // Opaque and light: the translucent black was unreadable over a dark canvas.
    // Solid and light, with dark text: the readout sits over the busiest part of
    // the picture and has to be legible against any of it. Jake: the equation
    // was not readable — the numbers were still styled for the old black box.
    tooltip.style.cssText = "position:fixed;padding:7px 11px;background:#fbfbfd;color:#111;"
        + "font:600 13.5px/1.45 ui-monospace,Menlo,Consolas,monospace;"
        + "border:1.5px solid #555;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.25);"
        + "pointer-events:none;display:none;z-index:10;";
    /** Readout accents: an enabled family's number, a disabled one's, a name. */
    const TIP_ON = "#111", TIP_OFF = "#9a9aa2", TIP_NAME = "#b3550f";

    /**
     * Where the hover readout goes: pinned in the canvas corner, or riding the
     * pointer. Pinned by default — Jake: the statistics were landing on the very
     * thing being hovered. Upper right: the bottom-left gutter was out of view.
     */
    let hoverBox: "corner" | "pointer" = config.hoverBox ?? "corner";
    function placeTooltip(e: { clientX: number; clientY: number }, lift = 28) {
        tooltip.style.display = "block";
        if (hoverBox === "pointer") {
            tooltip.style.bottom = "auto";
            tooltip.style.right = "auto";
            tooltip.style.left = (e.clientX + 12) + "px";
            tooltip.style.top = (e.clientY - lift) + "px";
            return;
        }
        const r = config.container.getBoundingClientRect();
        tooltip.style.bottom = "auto";
        tooltip.style.top = (r.top + 8) + "px";
        // Anchor by the right edge so a wider readout grows leftward, on-canvas.
        tooltip.style.left = "auto";
        tooltip.style.right = (window.innerWidth - r.right + 8) + "px";
    }
    document.body.appendChild(tooltip);

    // ── Layers ────────────────────────────────────────────────────────

    // Split: the Penrose group in its own container, the axes in both.
    const stack = new LayerStack(config.containerP
        ? { container, groups: { Penrose: config.containerP }, mirrored: ["Axes"] }
        : container, canvas.w, canvas.h);

    // ── Features ──────────────────────────────────────────────────────
    //
    // Capabilities used to be welded to the step that introduced them — eight
    // switches on a step index, so intersection dots existed only at step 2 and
    // filled tiles only at step 6. They are flags now.
    //
    // And the view no longer knows what a page IS. A narrative imposes a feature
    // set through `setFeatures`, which is the whole of what a preset table used to
    // do from in here, with the page rather than the view deciding.

    const NO_FEATURES: Features = {
        gridLines: true, axes: false,
        kRegions: false, kLabels: false, intersectionDots: false,
        penroseTiles: false, penroseEdges: false, penroseVertices: false,
        penroseDecor: false,
        arrows: false,
        pseudoEdges: false,
        vertexIndex: false, center: false,
        hoverVertex: false, hoverEdge: false, hoverTile: false,
    };

    let features: Features = { ...NO_FEATURES, ...config.features };

    /** How strongly the grid draws. A page fades it as the tiling takes over. */
    let gridAlpha = 0.6;

    const tileStyle: TileStyle = {
        color: "type", isogloss: false, shading: false, ramp: 1, opacity: 1, band: 0.5,
        boldEdges: false, coloredArrows: false, vertexMark: "dot", offPenrose: false,
        ...config.tileStyle,
    };

    /** Panel rows by label, so a page can choose which are worth exposing. */
    const panelRows = new Map<string, HTMLElement>();
    const featureOnListeners: ((key: keyof Features) => void)[] = [];

    // ── The rhomb cache ───────────────────────────────────────────────
    //
    // Four layers now want the same rhombs, and collectRhombs is the expensive call
    // in the file. It depends on γ, the view and the active families — never on which
    // layer is asking. PLAN.md item 5.

    let rhombCache: Rhomb[] | null = null;
    let rhombCacheKey = "";

    /**
     * The patch's index range, for the height ramp.
     *
     * Absolute across the patch rather than normalized per tile — wieringa-roof's
     * rule, and for the same reason: otherwise a rhomb rising 1->3 draws
     * identically to one rising 2->4, and the shading says only which way a face
     * tilts, never how high it sits. Four levels on a Penrose patch, five when
     * the total is off the integers; the ramp does not care which.
     */
    let indexRangeCache: { lo: number; hi: number } | null = null;
    function indexRange(): { lo: number; hi: number } {
        if (indexRangeCache) return indexRangeCache;
        let lo = Infinity, hi = -Infinity;
        // Over the tiling proper — the rhombs not stacked in a 2k-gon. A stack's
        // fan can carry a GHOST vertex, a tuple of a region with no area
        // (PLAN.md, the ghost lines): at Γ = 0 the decagon's center is f(K0)
        // with index 0, one below the tiling's real 1..4, so the whole patch
        // read 2..5 — index 5 everywhere, and the index-placed dressings gone —
        // until the smallest nudge dissolved the decagon. Jake: "the 5's
        // surprised me." The real tiling decides the range.
        const all = currentRhombs();
        const laid = all.filter((r) => !isStacked(r));
        for (const r of laid.length ? laid : all) {
            for (const K of r.kTuples) {
                const m = vertexIndex(K);
                if (m < lo) lo = m;
                if (m > hi) hi = m;
            }
        }
        if (!(lo < hi)) { lo = 0; hi = 1; }
        indexRangeCache = { lo, hi };
        return indexRangeCache;
    }

    /**
     * Which rhomb group each tile belongs to, by position in currentRhombs().
     * From findClusters, so it is exactly sun-star's reading; null for a tile in
     * no complete group, and for every tile when groups are undefined.
     */
    let groupCache: Map<Rhomb, ClusterKind> | null = null;
    function groupOf(rhomb: Rhomb): ClusterKind | null {
        if (!groupCache) {
            const rhombs = currentRhombs();
            const out = new Map<Rhomb, ClusterKind>();
            const res = findClusters(rhombs);
            if (res.defined) {
                for (const c of res.clusters) {
                    if (!c.kind) continue;
                    for (const k of c.rhombs) out.set(rhombs[k], c.kind);
                }
            }
            groupCache = out;
        }
        return groupCache.get(rhomb) ?? null;
    }

    /** The P1 pentagons on the current rhombs — see geometry/clusters.ts. */
    let p1Cache: P1Pentagon[] | null = null;
    function p1Pentagons(): P1Pentagon[] {
        if (!p1Cache) p1Cache = geoP1(currentRhombs(), directions);
        return p1Cache;
    }

    /** wieringa-roof's `t`: -1 at the patch's lowest vertex, +1 at its highest. */
    function rampT(index: number): number {
        const { lo, hi } = indexRange();
        return ((index - lo) / (hi - lo) - 0.5) * 2;
    }

    /** A color at height t: towards white above the middle, black below. */
    function rampColor(base: string, t: number): string {
        return shade(base, Math.sign(t) * Math.abs(t) * RAMP * tileStyle.ramp);
    }

    function currentRhombs(): Rhomb[] {
        const base = computeRect();
        const vis = config.collectRect ? config.collectRect(base) : base;
        // The rect is part of the key: a host that widens it for a camera must
        // recollect when the camera moves, and nothing else here would notice.
        const key = [
            scale, viewX, viewY, gammaSet.exact().join(","),
            gammaSet.enabledFlags().map((b) => (b ? 1 : 0)).join(""),
            gammaSet.lineFlags().map((n) => (n === null ? "*" : n)).join(","),
            String(gammaSet.isolated()),
            vis.xMin.toFixed(3), vis.xMax.toFixed(3),
            vis.yMin.toFixed(3), vis.yMax.toFixed(3),
        ].join("|");
        if (rhombCache && key === rhombCacheKey) return rhombCache;
        rhombCache = collectRhombs(vis);
        stackedCache = null;
        indexRangeCache = null;
        groupCache = null;
        p1Cache = null;
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


    stack.add({
        // No `group`: its switch is in the K-regions cluster, not on the
        // Pentagrid row. One fact, one switch.
        id: "background", label: "K-regions", z: 5, group: "Pentagrid",
        visible: () => features.kRegions,
        draw: (c) => withView(gridView(), () => drawKRegions(c.ctx, c.cx, c.cy)),
    });

    // ONE canvas for all n families, not one each.
    //
    // A canvas per family bought nothing measurable: `drawAll` redraws every
    // visible layer anyway, so there was no selective redraw to gain; all n shared
    // the same opacity expression; and they sat at contiguous z with nothing
    // interleaved. What they cost was real — a full-size canvas each, five of
    // thirteen at n = 5 and seven of fifteen at n = 7. Skipping a disabled family
    // is an `if` in the loop, which is all the separate canvases were doing.
    stack.add({
        id: "grid", label: "Grid", z: 10, group: "Pentagrid",
        visible: () => features.gridLines,
        opacity: () => gridAlpha,
        draw: (c) => withView(gridView(), () => {
            for (let j = 0; j < model.n; j++) {
                drawGridFamily(c.ctx, j, c.w, c.h, c.cx, c.cy);
            }
        }),
    });

    stack.add({
        // In FRONT of the grid and the tiling: an axis behind the thing it
        // measures is decoration, not a reference.
        id: "axes", label: "Axes", z: 70, group: "Axes",
        visible: () => features.axes || features.center,
        draw: (c) => {
            if (features.axes) drawAxes(c.ctx, c.w, c.h, c.cx, c.cy);
            if (features.center) drawCenter(c.ctx, c.cx, c.cy);
        },
    });

    stack.add({
        // Immediately under the tiling: a crossing is the tile's source, and
        // the dot should show through where the tile is transparent, not sit on top.
        id: "dots", label: "Dots", z: 29, group: "Pentagrid",
        visible: () => features.intersectionDots,
        draw: (c) => withView(gridView(), () =>
            drawIntersectionDots(c.ctx, c.cx, c.cy, computeRect())),
    });

    stack.add({
        // Switched from the K-regions cluster, like the regions themselves.
        id: "klabels", label: "K-labels", z: 28, group: "Pentagrid",
        visible: () => features.kLabels,
        draw: (c) => withView(gridView(), () => drawKEdgeLabels(c.ctx, c.cx, c.cy)),
    });

    // The tiling. Its own group so the whole thing can move in front of the
    // pentagrid or behind it in one call.
    const PENROSE_Z_BACK = 6;    // above the K-regions, below the grid
    const PENROSE_Z_FRONT = 30;  // above the grid, below the overlays and axes
    let penroseInFront = true;

    stack.add({
        id: "penrose-tiles", label: "Tiles", z: PENROSE_Z_FRONT, group: "Penrose",
        visible: () => features.penroseTiles,
        draw: (c) => {
            drawRhombs(c.ctx, currentRhombs().filter((r) => !isStacked(r)), c.cx, c.cy, true);
            drawResolutions(c.ctx, c.cx, c.cy, true);
        },
    });
    stack.add({
        id: "penrose-edges", label: "Edges", z: PENROSE_Z_FRONT + 1, group: "Penrose",
        visible: () => features.penroseEdges,
        draw: (c) => {
            // The laid-out tiles, solid. The superposed ones at a concurrency
            // have their edges too — they are the superposition itself — but as
            // pseudo edges, dotted, on the switch beside this one.
            drawRhombs(c.ctx, currentRhombs().filter((r) => !isStacked(r)), c.cx, c.cy, false);
            drawResolutions(c.ctx, c.cx, c.cy, false);
        },
    });
    stack.add({
        // The superposed tiles' edges, dotted, on their own switch. See Features.
        id: "penrose-pseudo", label: "Pseudo edges", z: PENROSE_Z_FRONT + 1, group: "Penrose",
        visible: () => features.pseudoEdges,
        draw: (c) => drawRhombs(
            c.ctx, currentRhombs().filter((r) => isStacked(r)), c.cx, c.cy, false, true),
    });
    stack.add({
        id: "penrose-decor", label: "Arcs", z: PENROSE_Z_FRONT + 2, group: "Penrose",
        visible: () => features.penroseDecor || features.arrows,
        draw: (c) => {
            const laid = currentRhombs().filter((r) => !isStacked(r));
            if (features.penroseDecor) drawPenroseDecor(c.ctx, laid, c.cx, c.cy);
            if (features.arrows) drawArrows(c.ctx, laid, c.cx, c.cy);
        },
    });
    stack.add({
        id: "penrose-vertices", label: "Vertices", z: PENROSE_Z_FRONT + 3, group: "Penrose",
        // Also runs when only the hover wants vertices, because it populates the
        // pick list; `show` decides whether anything is actually painted.
        visible: () => features.penroseVertices || features.hoverVertex || features.vertexIndex,
        draw: (c) => {
            drawDualVertices(c.ctx, currentRhombs(), c.cx, c.cy, features.penroseVertices);
            if (features.vertexIndex) drawVertexIndices(c.ctx, currentRhombs(), c.cx, c.cy);
        },
    });

    function restackPenrose() {
        stack.setGroupZ("Penrose", penroseInFront ? PENROSE_Z_FRONT : PENROSE_Z_BACK);
    }

    // Overlays the stack sizes but does not draw, and the input surface — one
    // set per container. A hover draws its grid half on hlG and its Penrose
    // half on hlP; with one container those are the same canvas.
    const highlights = stack.containers.map((c) => stack.addRaw(55, "none", c));
    const hlG = highlights[0].ctx;
    const hlP = (config.containerP ? highlights[stack.containers.indexOf(config.containerP)] : highlights[0]).ctx;
    const hlSame = hlG === hlP;
    const footprint = stack.addRaw(60);
    const footprintCtx = footprint.ctx;

    const eventCanvases = stack.containers.map((c) => stack.addRaw(100, "auto", c).canvas);
    /**
     * Bind an input handler on every container's input surface. The surface it
     * fired on comes as the second argument — not e.currentTarget, which a
     * synthetic event from the tests does not carry.
     */
    function onEvent<K extends keyof HTMLElementEventMap>(
        type: K, handler: (e: HTMLElementEventMap[K], surface: HTMLCanvasElement) => void,
        opts?: AddEventListenerOptions,
    ) {
        for (const c of eventCanvases) c.addEventListener(type, (e) => handler(e, c), opts);
    }
    function setCursor(cursor: string) {
        for (const c of eventCanvases) c.style.cursor = cursor;
    }
    setCursor("grab");

    // ── The γ bank ────────────────────────────────────────────────────
    //
    // A view over the values, nothing more: it reports which slider moved and
    // which label was clicked, and renders what it is told. The constraint —
    // that one index is computed from the others so Σγ = 0 — is ours, not its.

    mountGammaControls(gammaSet, controlsDiv, { colors: COLORS });

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
    let resolutionCache: Resolution[] | null = null;
    let stackedCache: Set<string> | null = null;

    /**
     * Rhombs that are superposed on a concurrency, by their own crossing.
     *
     * A tile fill and an arc both assert something a superposition does not have.
     * The fill asserts a layout — which of the many rhombic tilings of the 2k-gon
     * is the real one — and the construction picks none. The arc asserts a shared
     * edge to join across, and inside a stack there is no shared edge. Vertices
     * and edges are different: they give the thing structure, so they stay.
     */
    function stackedCrossings(): Set<string> {
        if (stackedCache) return stackedCache;
        const counts = new Map<string, number>();
        for (const r of currentRhombs()) {
            const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        stackedCache = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
        return stackedCache;
    }

    const isStacked = (r: Rhomb) =>
        stackedCrossings().has(`${r.x0.toFixed(6)},${r.y0.toFixed(6)}`);

    /**
     * The 2k-gons for the concurrencies in view.
     *
     * Derived, not stored: the scan finds the points, and this says what each one
     * stands for. Cleared whenever the scan reruns.
     */
    function currentResolutions(): Resolution[] {
        if (resolutionCache) return resolutionCache;
        const out: Resolution[] = [];
        for (const c of concurrencies) {
            const r = resolveConcurrency(model, c);
            if (r) out.push(r);
        }
        resolutionCache = out;
        return out;
    }


    const meterDiv = document.createElement("div");
    meterDiv.className = "regularity-control";

    const meterSpan = document.createElement("div");
    meterSpan.className = "regularity-meter";
    meterDiv.appendChild(meterSpan);

    // Conservative by design: it says the OFFSETS meet de Bruijn's condition, not
    // that the tiling is any particular representative of it.
    const penroseSpan = document.createElement("span");
    penroseSpan.className = "penrose-flag";
    meterDiv.appendChild(penroseSpan);
    controlsDiv.appendChild(meterDiv);

    function refreshPenroseFlag() {
        const ok = penroseCondition(gammaSet.getSum(), gammaSet.n);
        if (ok === null) {
            penroseSpan.textContent = `· Penrose condition n/a (n = ${gammaSet.n})`;
            penroseSpan.style.color = "#aaa";
            penroseSpan.title = "Σγ ≡ 0 (mod 1) is de Bruijn's condition for n = 5.";
            return;
        }
        penroseSpan.textContent = ok ? "· Penrose condition ✓" : "· Penrose condition ✗";
        penroseSpan.style.color = ok ? "#2a9d8f" : "#aaa";
        penroseSpan.title = "Σγ ≡ 0 (mod 1). Says the offsets satisfy the condition, "
            + "not which representative — Σγ = 0 and Σγ = 2 both pass.";
    }

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
        refreshPenroseFlag();
        const sing = singularTriples();
        if (sing.length > 0) {
            // Which families actually meet — what you need in order to do
            // something about it. The shape says how many lines without counting.
            const who = new Set<number>();
            for (const c of concurrencies) for (const j of c.families) who.add(j);
            // Name what each one resolves into rather than how many lines met.
            const tally = new Map<string, number>();
            for (const r of currentResolutions()) {
                const d = describeResolution(r);
                tally.set(d, (tally.get(d) ?? 0) + 1);
            }
            const shapes = [...tally.entries()]
                .map(([d, count]) => (count > 1 ? `${count}× ${d}` : d))
                .join(", ");
            const where = concurrencies.length > 0
                ? ` — ${shapes} (γ ${[...who].sort((a, b) => a - b).join(",")})`
                : "";
            meterSpan.textContent = `SINGULAR: triples ${sing.join(" ")}${where} · ${tail}`;
            meterSpan.style.color = "#e63946";
            return;
        }
        const nudged = gammaSet.nudged()
            ? ` · γ nudged ${(1 / gammaSet.denominator).toExponential(0)}` : "";
        // An empty triple list is a proof only where the criterion is exact. Off
        // the pentagrid it means "found nothing", and Lutfalla's Theorem 2 is
        // the only thing that can promise anything — when its hypothesis fails
        // the honest report is that neither verdict is established.
        if (!gammaSet.provenRegular()) {
            meterSpan.textContent = `regularity unproved (n = ${gammaSet.n}) · ${tail}`;
            meterSpan.style.color = "#d4a017";
            return;
        }
        meterSpan.textContent = `regular, proved${nudged} · ${tail}`;
        meterSpan.style.color = under === 0 ? "#5a8f5a" : "#c07d00";
    }

    // ── Narrative hooks ───────────────────────────────────────────────
    //
    // The view used to own Prev/Next, the step indicator and the explanation, and
    // took the pages as config. It owns none of that now: a narrative drives it
    // through these, which is why `steps` and `presets` are gone.

    function setFeatures(next: Partial<Features>, opts?: { merge?: boolean }) {
        const wasOn = features.penroseTiles;
        features = opts?.merge
            ? { ...features, ...next }
            : { ...NO_FEATURES, ...next };
        if (!wasOn && features.penroseTiles) tilesOn?.();
        syncPanel();
        draw();
    }

    function exposeRows(labels: readonly string[] | null) {
        for (const [label, el] of panelRows) {
            el.hidden = labels !== null && !labels.includes(label);
        }
    }

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

    /**
     * Where things are COMPUTED, as opposed to where they are shown.
     *
     * The visible rect is inset by the gutter and stops at the canvas, and every
     * computation used it — so nothing existed within 40 px of the edge, and a
     * source region just past that was clipped to nothing while its dual vertex
     * sat in plain view. This undoes the inset and adds `computePad` tiling units
     * beyond the canvas. The pad is in the rect's own units: under gridView the
     * same distance is a gain smaller in grid units, which is what registration
     * means. The canvas clips the drawing, so the extra costs nothing to look at.
     */
    function computeRect(): ViewRect {
        const v = getVisibleRect();
        const p = viewMargin / scale + computePad / (viewGridUnits ? gridGain() : 1);
        return { xMin: v.xMin - p, xMax: v.xMax + p, yMin: v.yMin - p, yMax: v.yMax + p };
    }

    /** Run fn with the view globals temporarily swapped, then restore them. */
    function withView(v: ViewState, fn: () => void) {
        const s0 = scale, x0 = viewX, y0 = viewY;
        const w0 = viewW, h0 = viewH, m0 = viewMargin, g0 = viewGridUnits;
        scale = v.scale; viewX = v.viewX; viewY = v.viewY;
        viewW = v.w; viewH = v.h; viewMargin = v.margin;
        viewGridUnits = v.gridUnits ?? false;
        try {
            fn();
        } finally {
            scale = s0; viewX = x0; viewY = y0;
            viewW = w0; viewH = h0; viewMargin = m0; viewGridUnits = g0;
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
    onEvent("wheel", (e) => {
        e.preventDefault();
        const factor = Math.pow(2, -e.deltaY / 300);
        zoomAtScreen(e.offsetX, e.offsetY, factor);
    }, { passive: false });

    // Right-drag orbits, left-drag pans, and they use the same gesture so the
    // camera is handled where the picture is rather than off in a slider.
    let isOrbiting = false;
    let orbitLastX = 0;
    let orbitLastY = 0;

    onEvent("mousedown", (e) => {
        if (e.button === 0) {
            isPanning = true;
            panLastX = e.offsetX;
            panLastY = e.offsetY;
            setCursor("grabbing");
        } else if (e.button === 2 && config.onOrbit) {
            isOrbiting = true;
            orbitLastX = e.offsetX;
            orbitLastY = e.offsetY;
            setCursor("move");
            e.preventDefault();
        }
    });

    if (config.onOrbit) {
        onEvent("contextmenu", (e) => e.preventDefault());
        onEvent("mousemove", (e) => {
            if (!isOrbiting) return;
            config.onOrbit!(e.offsetX - orbitLastX, e.offsetY - orbitLastY);
            orbitLastX = e.offsetX;
            orbitLastY = e.offsetY;
        });
        const stopOrbit = () => {
            if (!isOrbiting) return;
            isOrbiting = false;
            setCursor("grab");
        };
        onEvent("mouseup", stopOrbit);
        onEvent("mouseleave", stopOrbit);
    }

    onEvent("mousemove", (e) => {
        if (!isPanning) return;
        viewX -= (e.offsetX - panLastX) / scale;
        viewY += (e.offsetY - panLastY) / scale;
        notifyView();
        panLastX = e.offsetX;
        panLastY = e.offsetY;
        draw();
    });

    onEvent("mouseup", endPan);
    onEvent("mouseleave", endPan);

    function endPan() {
        if (isPanning) {
            isPanning = false;
            setCursor("grab");
        }
    }

    // Double-click to reset view
    onEvent("dblclick", () => {
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

    onEvent("touchstart", (e) => {
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

    onEvent("touchmove", (e, surface) => {
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
                const rect = surface.getBoundingClientRect();
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                zoomAtScreen(midX, midY, dist / lastPinchDist);
            }
            lastPinchDist = dist;
        }
    }, { passive: false });

    onEvent("touchend", (e) => {
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

    /** The circled index's radius: big enough to read, never bigger than a tile corner. */
    const markRadius = () => Math.max(6, Math.min(9, scale * 0.12));

    /**
     * The origin, ringed: sunstar's mark, since that is the point γ is about.
     * Sized to sit just outside the circled index, when the vertex mark is one,
     * so the two read as one badge rather than a ring cutting a digit.
     */
    function drawCenter(tc: CanvasRenderingContext2D, cx: number, cy: number) {
        const [ox, oy] = mathToScreen(0, 0, cx, cy);
        const inner = tileStyle.vertexMark === "dot" ? 3 : markRadius();
        tc.beginPath();
        tc.arc(ox, oy, inner + 3.5, 0, 2 * Math.PI);
        tc.lineWidth = 2;
        tc.strokeStyle = "#111";
        tc.stroke();
    }

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
        const vis = computeRect();

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
        // A family restricted to one line draws only that line. Its dual is that
        // line's ribbon — though the tiling still carries whatever the other
        // families make among themselves, which the restriction does not touch.
        const only = gammaSet.familyLine(j);
        const nLo = only !== null ? only : Math.floor(minDot + gamma[j]) - 1;
        const nHi = only !== null ? only : Math.ceil(maxDot + gamma[j]) + 1;

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
    for (let j = 0; j < model.n; j++) {
        for (let k = j + 1; k < model.n; k++) {
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

        // Every crossing: the family flags filter the tiles, not the grid.
        for (let j = 0; j < model.n; j++) {
            for (let k = j + 1; k < model.n; k++) {
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
        const mark = tileStyle.vertexMark;
        const { lo } = indexRange();
        const R = markRadius();
        if (mark !== "dot") {
            tc.font = `bold ${Math.round(R * 1.4)}px sans-serif`;
            tc.textAlign = "center";
            tc.textBaseline = "middle";
            tc.lineWidth = 1;
        }
        for (const rhomb of rhombs) {
            for (let vi = 0; vi < rhomb.vertices.length; vi++) {
                const [vx, vy] = rhomb.vertices[vi];
                const key = `${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const [sx, sy] = mathToScreen(vx, vy, cx, cy);
                dualVertices.push({ sx, sy, mx: vx, my: vy, K: rhomb.kTuples[vi] });
                if (!show) continue;
                if (mark === "dot") {
                    tc.fillStyle = "#c0392b";
                    tc.beginPath();
                    tc.arc(sx, sy, 3, 0, 2 * Math.PI);
                    tc.fill();
                    continue;
                }
                // ❶ or ①: the index once, on the vertex, in place of the dot.
                // Off Penrose the index runs to 5, and that fifth level wears the
                // complementary style — ① among the ❶ — so it stands out. Jake's
                // idea. (Which level is the fifth is the normalization's choice:
                // the top one.)
                const m = vertexIndex(rhomb.kTuples[vi]) - lo + 1;
                const filled = (mark === "filled") !== (m > 4);
                tc.beginPath();
                tc.arc(sx, sy, R, 0, 2 * Math.PI);
                tc.fillStyle = filled ? "#111" : "#fff";
                tc.fill();
                tc.strokeStyle = "#111";
                tc.stroke();
                tc.fillStyle = filled ? "#fff" : "#111";
                tc.fillText(String(m), sx, sy + 0.5);
            }
        }
    }

    /**
     * The index of every corner, on the tile face just inside it: each tile
     * writes its own four, pulled a little toward the tile's center so the
     * label sits on the face rather than on the vertex dot, and the same
     * vertex reads the same number from every tile around it. Normalized to
     * the patch minimum, so Penrose is 1..4 — Jake: "for Penrose the index is
     * always in {1,2,3,4}" — the same number the decorations are placed by.
     */
    function drawVertexIndices(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number,
    ) {
        const { lo, hi } = indexRange();
        const size = Math.max(8, Math.min(13, scale * 0.16));
        if (size < 8) return;
        tc.font = `${size}px sans-serif`;
        tc.textAlign = "center";
        tc.textBaseline = "middle";
        for (const rhomb of rhombs) {
            const V = rhomb.vertices;
            const mx = (V[0][0] + V[2][0]) / 2, my = (V[0][1] + V[2][1]) / 2;
            for (let vi = 0; vi < 4; vi++) {
                const m = vertexIndex(rhomb.kTuples[vi]) - lo + 1;
                // Toward the center by a fixed fraction of the diagonal, so it
                // stays inside a thin tile's acute corner too.
                const t = 0.22;
                const [sx, sy] = mathToScreen(V[vi][0] + (mx - V[vi][0]) * t,
                                              V[vi][1] + (my - V[vi][1]) * t, cx, cy);
                // Extremes dark, the middle levels lighter, so the rhomb-group
                // centers read at a glance.
                tc.fillStyle = m === 1 || m === hi - lo + 1 ? "#1a1a1e" : "#6a6a72";
                tc.fillText(String(m), sx, sy);
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
    // A rhomb f, f+v_j, f+v_j+v_k, f+v_k then carries exactly two arcs: one centered
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

    /**
     * The arrows, as chevrons on the edge: one for a single, two for a double.
     * Only on a Penrose patch — with five index levels the rule has no meaning
     * and nothing is drawn, the same silence as the rhomb groups.
     */
    function drawArrows(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number,
    ) {
        const { lo } = indexRange();
        const levels = dressingLevels();
        if (levels === null) return;
        if (tileStyle.coloredArrows) { drawColoredArrows(tc, rhombs, cx, cy, lo, levels); return; }
        const L = 0.11;          // chevron arm, tiling units
        const GAP = 0.09;        // between the two of a double
        tc.strokeStyle = "#222";
        tc.lineWidth = 1.4;
        tc.lineCap = "round";
        tc.lineJoin = "round";
        for (const r of rhombs) {
            for (const { extAt, alpha } of dressings(r, lo, levels)) {
            tc.globalAlpha = alpha;
            for (const a of rhombArrows(model, r, lo, levels, extAt)) {
                const nx = -a.dy, ny = a.dx;
                const chevron = (ox: number, oy: number) => {
                    // tip at (ox,oy), arms trailing back at 45 degrees
                    const tip = mathToScreen(ox, oy, cx, cy);
                    const l = mathToScreen(ox - a.dx * L + nx * L, oy - a.dy * L + ny * L, cx, cy);
                    const rr = mathToScreen(ox - a.dx * L - nx * L, oy - a.dy * L - ny * L, cx, cy);
                    tc.beginPath();
                    tc.moveTo(l[0], l[1]);
                    tc.lineTo(tip[0], tip[1]);
                    tc.lineTo(rr[0], rr[1]);
                    tc.stroke();
                };
                if (a.double) {
                    chevron(a.x + a.dx * GAP / 2, a.y + a.dy * GAP / 2);
                    chevron(a.x - a.dx * GAP / 2, a.y - a.dy * GAP / 2);
                } else {
                    chevron(a.x + a.dx * L / 2, a.y + a.dy * L / 2);
                }
            }
            }
        }
        tc.globalAlpha = 1;
    }

    /**
     * The arrows as de Bruijn draws them, in the shape of jake/arrow.svg: a
     * rounded shaft with a solid triangular head, the head a sixth of the
     * length and about a third as wide as long, the shaft a thirtieth. It runs
     * from just short of one vertex to just short of the other — clear of the
     * vertex dots — so the arrows at a vertex do not pile onto it. One head
     * each: the color carries the double/single distinction, green on the
     * doubles (the 1-2 and 3-4 edges), red on the singles (2-3), so a second
     * head would say it twice. Jake: "No doubles!" A shared edge is drawn
     * once per tile, identically, since the rule agrees across it.
     */
    function drawColoredArrows(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number, lo: number, levels: number,
    ) {
        const DOUBLE = "#3aa655", SINGLE = "#e0423c";
        const inset = 6 / scale;             // past the 3 px vertex dot, in tiling units
        const L = 1 - 2 * inset;             // the arrow's length, of a unit edge
        if (L <= 0.2) return;
        const HEAD = 0.163 * L, HALF = 0.054 * L, SHAFT = 0.034 * L;
        tc.lineWidth = Math.max(1.2, SHAFT * scale);
        tc.lineCap = "round";
        for (const r of rhombs) {
            for (const { extAt, alpha } of dressings(r, lo, levels)) {
            tc.globalAlpha = alpha;
            for (const a of rhombArrows(model, r, lo, levels, extAt)) {
                const nx = -a.dy, ny = a.dx;
                const color = a.double ? DOUBLE : SINGLE;
                const tx = a.x - a.dx * L / 2, ty = a.y - a.dy * L / 2;   // tail
                const hx = a.x + a.dx * L / 2, hy = a.y + a.dy * L / 2;   // tip
                // Shaft, stopping under the head so the round cap never shows.
                const tail = mathToScreen(tx, ty, cx, cy);
                const neck = mathToScreen(hx - a.dx * HEAD * 0.8, hy - a.dy * HEAD * 0.8, cx, cy);
                tc.strokeStyle = color;
                tc.beginPath();
                tc.moveTo(tail[0], tail[1]);
                tc.lineTo(neck[0], neck[1]);
                tc.stroke();
                // The head, one only.
                tc.fillStyle = color;
                const tip = mathToScreen(hx, hy, cx, cy);
                const l = mathToScreen(hx - a.dx * HEAD + nx * HALF, hy - a.dy * HEAD + ny * HALF, cx, cy);
                const rr = mathToScreen(hx - a.dx * HEAD - nx * HALF, hy - a.dy * HEAD - ny * HALF, cx, cy);
                tc.beginPath();
                tc.moveTo(tip[0], tip[1]);
                tc.lineTo(l[0], l[1]);
                tc.lineTo(rr[0], rr[1]);
                tc.closePath();
                tc.fill();
            }
            }
        }
        tc.globalAlpha = 1;
    }

    /**
     * Contour lines across a rhomb, perpendicular to its long diagonal.
     *
     * The same idea as penrose-mosaic's `drawIsogloss`: evenly spaced along the
     * v0→v2 axis, a touch heavier on a thick tile so the two read with the same
     * weight despite the thin one's tighter spacing.
     */
    function drawIsogloss(tc: CanvasRenderingContext2D, sv: [number, number][], thick: boolean) {
        const LINES = 7;
        tc.save();
        tc.beginPath();
        tc.moveTo(sv[0][0], sv[0][1]);
        for (let i = 1; i < 4; i++) tc.lineTo(sv[i][0], sv[i][1]);
        tc.closePath();
        tc.clip();
        // step along v0 -> v2, drawing the chord parallel to v1 -> v3
        const ax = sv[2][0] - sv[0][0], ay = sv[2][1] - sv[0][1];
        const bx = sv[3][0] - sv[1][0], by = sv[3][1] - sv[1][1];
        tc.strokeStyle = "rgba(60,60,60,0.45)";
        tc.lineWidth = thick ? 1.1 : 0.8;
        for (let i = 1; i < LINES; i++) {
            const t = i / LINES;
            const px = sv[0][0] + ax * t, py = sv[0][1] + ay * t;
            tc.beginPath();
            tc.moveTo(px - bx / 2, py - by / 2);
            tc.lineTo(px + bx / 2, py + by / 2);
            tc.stroke();
        }
        tc.restore();
    }

    /**
     * How a 2k-gon is filled, following whatever the tiles are doing.
     *
     *   thick/thin  a color of its own — it is neither, it is a stack of both
     *   families    the combination of the gridlines that meet there
     *   shading     the height ramp over any of those, flat at its mean height
     */
    function resolutionFill(r: Resolution): string | null {
        const base = resolutionBase(r);
        if (base === null || !tileStyle.shading) return base;
        // The ramp, flat at its mean height: its corners span more than one
        // diagonal, and a stack has no one surface to shade.
        let sum = 0;
        for (const K of r.outlineK) sum += vertexIndex(K);
        return rampColor(base, rampT(sum / r.outlineK.length));
    }
    function resolutionBase(r: Resolution): string | null {
        if (tileStyle.color === "bands") return null;      // Jake: not the 2k-gons
        if (tileStyle.color === "groups") return NO_GROUP;  // a stack is in no group
        if (tileStyle.color === "p1") return NO_GROUP;      // and carries no P1
        if (tileStyle.color === "curves") return CURVE_FACE; // a bare face
        if (tileStyle.color === "pentagons") return NO_GROUP; // no indices to place by
        if (tileStyle.color === "nextgen") return NO_GROUP;
        if (tileStyle.color === "kites") return NO_GROUP;
        if (tileStyle.color === "pair") {
            let rr = 0, gg = 0, bb = 0;
            for (const j of r.families) {
                const [x, y, z] = hexToRgb(COLORS[j % COLORS.length]);
                rr += x; gg += y; bb += z;
            }
            const k = r.families.length;
            return `rgb(${Math.round(rr / k)},${Math.round(gg / k)},${Math.round(bb / k)})`;
        }
        return SINGULAR_FILL;
    }

    /**
     * A concurrency drawn as what it is: a P-region.
     *
     * Not a layer of its own and not a warning. Where k lines meet, the tiling has
     * a hexagon, an octagon or a decagon there instead of rhombs — so the tile
     * layer fills it and the edge layer outlines it, exactly as they do any other
     * region. Its corners are already dual vertices, so the vertex layer has them
     * without being told.
     */
    function drawResolutions(
        tc: CanvasRenderingContext2D, cx: number, cy: number, fill: boolean,
    ) {
        for (const r of currentResolutions()) {
            tc.beginPath();
            r.outline.forEach((v, i) => {
                const [x, y] = mathToScreen(v[0], v[1], cx, cy);
                if (i === 0) tc.moveTo(x, y); else tc.lineTo(x, y);
            });
            tc.closePath();
            if (fill) {
                const style = resolutionFill(r);
                if (style) {
                    tc.save();
                    tc.globalAlpha = tileStyle.opacity;
                    tc.fillStyle = style;
                    tc.fill();
                    tc.restore();
                }
            } else {
                tc.strokeStyle = "#777";
                tc.lineWidth = 1;
                tc.stroke();
            }
        }
    }

    /**
     * The two gridlines through a tile, as bands — grow.html's drawing, here.
     *
     * In the tile's own coordinates a corner is v0 + a·vj + b·vk. Family j's
     * line enters through the b = 0 edge and leaves through b = 1, both parallel
     * to vj, so its band is a in [lo, hi] and b in [0, 1]; family k's is the
     * other way round; and where they cross is the composite square. Same three
     * quads, same lo/hi, as view/growth.ts.
     */
    function drawBands(
        tc: CanvasRenderingContext2D, r: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        const lo = 0.5 - tileStyle.band / 2, hi = 0.5 + tileStyle.band / 2;
        const vj = directions[r.j], vk = directions[r.k], v0 = r.vertices[0];
        const at = (a: number, b: number) =>
            mathToScreen(v0[0] + a * vj[0] + b * vk[0], v0[1] + a * vj[1] + b * vk[1], cx, cy);
        const quad = (corners: [number, number][], style: string) => {
            tc.beginPath();
            corners.forEach(([a, b], i) => {
                const [x, y] = at(a, b);
                if (i === 0) tc.moveTo(x, y); else tc.lineTo(x, y);
            });
            tc.closePath();
            // The ramp is a gradient in canvas space along the tile's diagonal,
            // so a quad inside the tile shades correctly under it too.
            tc.fillStyle = ramped(tc, r, sv, style);
            tc.fill();
        };
        if (tileStyle.band <= 0) return;
        quad([[lo, 0], [hi, 0], [hi, 1], [lo, 1]], COLORS[r.j % COLORS.length]);
        quad([[0, lo], [1, lo], [1, hi], [0, hi]], COLORS[r.k % COLORS.length]);
        quad([[lo, lo], [hi, lo], [hi, hi], [lo, hi]],
             pairColors.get(`${r.j},${r.k}`)?.replace(/,0\.55\)$/, ",1)") ?? "#888");
    }

    /** A bare tile: in no group, or on a patch where groups are undefined. */
    const NO_GROUP = "#ececec";

    /** What color a tile takes, under the current style. */
    function tileFill(rhomb: Rhomb): string {
        if (tileStyle.color === "groups") {
            const kind = groupOf(rhomb);
            return kind ? CLUSTER_FILL[kind] : NO_GROUP;
        }
        if (tileStyle.color === "pair") {
            // The two ribbons it belongs to, blended — so at full coverage the
            // tiling wears all n family colors at once.
            return pairColors.get(`${rhomb.j},${rhomb.k}`) ?? THICK_FILL;
        }
        return classFill(rhomb.cls);
    }

    /**
     * The P1 tiling on one rhomb: blue, then every pentagon that reaches it
     * clipped to it and filled by type. A pentagon reaches at most a couple of
     * edges from its center, so only the near ones are tried.
     */
    function drawP1(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        tc.fillStyle = ramped(tc, rhomb, sv, P1_STAR);
        tc.fill();
        const v0 = rhomb.vertices[0], v2 = rhomb.vertices[2];
        const mx = (v0[0] + v2[0]) / 2, my = (v0[1] + v2[1]) / 2;
        for (const pent of p1Pentagons()) {
            if (Math.hypot(pent.x - mx, pent.y - my) > 2) continue;
            const piece = clipToConvex(pent.verts, rhomb.vertices);
            if (piece.length < 3) continue;
            tc.beginPath();
            piece.forEach(([x, y], i) => {
                const [px, py] = mathToScreen(x, y, cx, cy);
                if (i === 0) tc.moveTo(px, py); else tc.lineTo(px, py);
            });
            tc.closePath();
            tc.fillStyle = ramped(tc, rhomb, sv, P1_FILL[pent.kind]);
            tc.fill();
        }
    }

    /**
     * The matching curves as filled regions — Wikipedia's "Rhombus Penrose
     * tiling with arcs", read exactly from its SVG and placed by the indices.
     *
     * The SVG's two prototiles: on the thick, a dark sector of radius 1/4 at one
     * 72° corner and a blue band of radii 3/4..1 at the other; on the thin, a
     * blue sector of radius 1/4 at one 144° corner and a dark sector of radius
     * 1/4 at the other. Which corner is which is de Bruijn's: the dark sector
     * sits at the corner where the double arrows meet — the index extreme — and
     * the blue at the red corner. Tested on 781 shared edges: every curve meets
     * its continuation at the same point in the same color; the other
     * assignment fails on 482 of them.
     */
    const CURVE_FACE = "#f2f2f2", CURVE_DARK = "#1a203b", CURVE_BLUE = "#47589c";
    function drawCurves(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        tc.fillStyle = ramped(tc, rhomb, sv, CURVE_FACE);
        tc.fill();
        const { lo } = indexRange();
        const levels = dressingLevels();
        if (levels === null) return;                     // no indices to place it by
        const V = rhomb.vertices;
        for (const { extAt, alpha } of dressings(rhomb, lo, levels)) {
        const X = extAt, Y = X === 0 ? 2 : 0;           // the extreme, and the red corner
        tc.globalAlpha = tileStyle.opacity * alpha;
        const sector = (c: number, rIn: number, rOut: number, style: string) => {
            const C = V[c], A = V[(c + 1) % 4], B = V[(c + 3) % 4];
            let a0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
            let a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
            // sweep the short way round, which is the corner's own angle
            let d = a1 - a0;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const N = 10;
            const pts: [number, number][] = [];
            for (let i = 0; i <= N; i++) {
                const t = a0 + d * i / N;
                pts.push([C[0] + rOut * Math.cos(t), C[1] + rOut * Math.sin(t)]);
            }
            if (rIn > 0) {
                for (let i = N; i >= 0; i--) {
                    const t = a0 + d * i / N;
                    pts.push([C[0] + rIn * Math.cos(t), C[1] + rIn * Math.sin(t)]);
                }
            } else {
                pts.push([C[0], C[1]]);
            }
            tc.beginPath();
            pts.forEach(([x, y], i) => {
                const [px, py] = mathToScreen(x, y, cx, cy);
                if (i === 0) tc.moveTo(px, py); else tc.lineTo(px, py);
            });
            tc.closePath();
            tc.fillStyle = ramped(tc, rhomb, sv, style);
            tc.fill();
        };
        sector(X, 0, 0.25, CURVE_DARK);
        if (rhomb.thick) sector(Y, 0.75, 1, CURVE_BLUE);
        else sector(Y, 0, 0.25, CURVE_BLUE);
        }
        tc.globalAlpha = tileStyle.opacity;
    }

    /**
     * The P1 tiling at the big-rhomb scale: every thick rhomb holds a whole Pe3
     * (yellow), the Pe1 (orange) straddle the edges, and everything else — the
     * Pe5 and the star family alike — is blue, as penrose-mosaic's "pentas and
     * stars" over "big rhombs" draws it. Geometry in rhombPentagons; here the
     * tile is filled blue, clipped, and the pentagons laid over it so the pieces
     * meet across the edges without any tile knowing its neighbor.
     */
    function drawPentagons(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        tc.fillStyle = ramped(tc, rhomb, sv, P1_STAR);
        tc.fill();
        const { lo } = indexRange();
        const levels = dressingLevels();
        if (levels === null) return;                     // no indices to place it by
        tc.clip();                                       // inside save/restore already
        for (const { extAt, alpha } of dressings(rhomb, lo, levels)) {
        tc.globalAlpha = tileStyle.opacity * alpha;
        const parts = rhombPentagons(rhomb, lo, levels, extAt);
        const poly = (pts: [number, number][], style: string) => {
            tc.beginPath();
            pts.forEach(([x, y], i) => {
                const [px, py] = mathToScreen(x, y, cx, cy);
                if (i === 0) tc.moveTo(px, py); else tc.lineTo(px, py);
            });
            tc.closePath();
            tc.fillStyle = ramped(tc, rhomb, sv, style);
            tc.fill();
        };
        for (const o of parts.orange) poly(o, P1_FILL.Pe1);
        if (parts.yellow) poly(parts.yellow, P1_FILL.Pe3);
        }
        tc.globalAlpha = tileStyle.opacity;
    }

    /**
     * The next generation: the tile filled gold (thick') and its thin' pieces
     * laid over in gray. Geometry in rhombDeflation. With the edges off, what
     * shows is the deflated tiling — the halves on every edge meet their other
     * halves in the neighbor.
     */
    const NEXTGEN_THICK = "#f7d058", NEXTGEN_THIN = "#b6b6b6";
    function drawNextGen(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        tc.fillStyle = ramped(tc, rhomb, sv, NEXTGEN_THICK);
        tc.fill();
        const { lo } = indexRange();
        const levels = dressingLevels();
        if (levels === null) return;                     // no indices to place it by
        for (const { extAt, alpha } of dressings(rhomb, lo, levels)) {
        tc.globalAlpha = tileStyle.opacity * alpha;
        const d = rhombDeflation(rhomb, lo, levels, extAt);
        for (const poly of d.gray) {
            tc.beginPath();
            poly.forEach(([x, y], i) => {
                const [px, py] = mathToScreen(x, y, cx, cy);
                if (i === 0) tc.moveTo(px, py); else tc.lineTo(px, py);
            });
            tc.closePath();
            tc.fillStyle = ramped(tc, rhomb, sv, NEXTGEN_THIN);
            tc.fill();
        }
        // The next generation's edges, as thin lines — the figure's arrows,
        // including the ones under the tile's own edges. The long diagonal is a
        // thick' diagonal and is not drawn. With the edges layer off this is
        // the deflated tiling, edges and all.
        tc.strokeStyle = "#777";
        tc.lineWidth = 1;
        tc.beginPath();
        for (const [a, b] of d.edges) {
            const [ax, ay] = mathToScreen(a[0], a[1], cx, cy);
            const [bx, by] = mathToScreen(b[0], b[1], cx, cy);
            tc.moveTo(ax, ay);
            tc.lineTo(bx, by);
        }
        tc.stroke();
        }
        tc.globalAlpha = tileStyle.opacity;
    }

    /**
     * Kites and darts: the tile filled kite, the dart laid over on a thick, and
     * P2's edges as hairlines — the halves on the rhomb edges meet their other
     * halves next door, so with the edges layer off the picture is P2.
     */
    const KITE = "#dfe9f3", DART = "#8fa8c2";
    function drawKites(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], cx: number, cy: number,
    ) {
        tc.fillStyle = ramped(tc, rhomb, sv, KITE);
        tc.fill();
        const { lo } = indexRange();
        const levels = dressingLevels();
        if (levels === null) return;                     // no indices to place it by
        for (const { extAt, alpha } of dressings(rhomb, lo, levels)) {
        tc.globalAlpha = tileStyle.opacity * alpha;
        const d = rhombKitesDarts(rhomb, lo, levels, extAt);
        for (const poly of d.darts) {
            tc.beginPath();
            poly.forEach(([x, y], i) => {
                const [px, py] = mathToScreen(x, y, cx, cy);
                if (i === 0) tc.moveTo(px, py); else tc.lineTo(px, py);
            });
            tc.closePath();
            tc.fillStyle = ramped(tc, rhomb, sv, DART);
            tc.fill();
        }
        tc.strokeStyle = "#556";
        tc.lineWidth = 1;
        tc.beginPath();
        for (const [a, b] of d.edges) {
            const [ax, ay] = mathToScreen(a[0], a[1], cx, cy);
            const [bx, by] = mathToScreen(b[0], b[1], cx, cy);
            tc.moveTo(ax, ay);
            tc.lineTo(bx, by);
        }
        tc.stroke();
        }
        tc.globalAlpha = tileStyle.opacity;
    }

    /** A tile's fill for a base color: the color, or the ramp over it. */
    function ramped(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], base: string,
    ): string | CanvasGradient {
        return tileStyle.shading ? heightGradient(tc, rhomb, sv, base) : base;
    }

    /**
     * The height ramp across one tile — wieringa-roof's shading, on the canvas.
     *
     * The roof shades per VERTEX and lets the mesh interpolate, so a face is a
     * gradient between its corner colors. That maps onto a rhomb exactly: its
     * corners are always (m, m+1, m+2, m+1) — `computeRhomb` emits base,
     * base+e_j, base+e_j+e_k, base+e_k — so the low corner is v0, the high corner
     * is v2, and the two side corners project onto the midpoint of that diagonal
     * by the symmetry of a rhombus. A linear gradient from v0 to v2 with three
     * stops — low, mid, high — reproduces the vertex interpolation precisely,
     * heads and tails included: which way the low corner points is which way
     * the face tilts.
     */
    function heightGradient(
        tc: CanvasRenderingContext2D, rhomb: Rhomb, sv: [number, number][], base: string,
    ): CanvasGradient {
        const m = vertexIndex(rhomb.kTuples[0]);
        const g = tc.createLinearGradient(sv[0][0], sv[0][1], sv[2][0], sv[2][1]);
        g.addColorStop(0, rampColor(base, rampT(m)));
        g.addColorStop(0.5, rampColor(base, rampT(m + 1)));
        g.addColorStop(1, rampColor(base, rampT(m + 2)));
        return g;
    }

    function drawRhombs(
        tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number,
        fill: boolean, dotted = false,
    ) {
        if (dotted) { tc.save(); tc.setLineDash([2, 3]); }
        for (const rhomb of rhombs) {
            const sv = rhomb.vertices.map(([vx, vy]) =>
                mathToScreen(vx, vy, cx, cy)) as [number, number][];

            tc.beginPath();
            tc.moveTo(sv[0][0], sv[0][1]);
            tc.lineTo(sv[1][0], sv[1][1]);
            tc.lineTo(sv[2][0], sv[2][1]);
            tc.lineTo(sv[3][0], sv[3][1]);
            tc.closePath();

            // Fill OR stroke, never both. The tile column owns the fill and the
            // edge column owns the outline — a call that did both meant ticking
            // `tile` silently gave you edges as well, which is the two columns
            // conflated in the one place the table is trying to keep apart.
            if (fill) {
                tc.save();
                tc.globalAlpha = tileStyle.opacity;
                if (tileStyle.color === "bands") {
                    drawBands(tc, rhomb, sv, cx, cy);
                } else if (tileStyle.color === "p1") {
                    drawP1(tc, rhomb, sv, cx, cy);
                } else if (tileStyle.color === "curves") {
                    drawCurves(tc, rhomb, sv, cx, cy);
                } else if (tileStyle.color === "pentagons") {
                    drawPentagons(tc, rhomb, sv, cx, cy);
                } else if (tileStyle.color === "nextgen") {
                    drawNextGen(tc, rhomb, sv, cx, cy);
                } else if (tileStyle.color === "kites") {
                    drawKites(tc, rhomb, sv, cx, cy);
                } else {
                    tc.fillStyle = ramped(tc, rhomb, sv, tileFill(rhomb));
                    tc.fill();
                }
                tc.restore();
                if (tileStyle.isogloss) drawIsogloss(tc, sv, rhomb.thick);
            } else {
                tc.strokeStyle = dotted ? "#999" : (tileStyle.boldEdges ? "#222" : "#777");
                tc.lineWidth = tileStyle.boldEdges && !dotted ? 2 : 1;
                tc.stroke();
            }
        }
        if (dotted) tc.restore();
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


    // The bitmap depends on γ, the frame and the view — never on a switch — so
    // it is cached on those (the old PLAN item 5), and the per-pixel loop is
    // written flat: no arrays, no calls, the hue palette computed once. It was
    // 83 ms a draw, on every checkbox; the tiles and edges together are 1 ms.
    let kBitmap: ImageData | null = null;
    let kBitmapKey = "";
    const K_PALETTE: [number, number, number][] = [];
    for (let hue = 0; hue < 360; hue++) K_PALETTE.push(hslToRgb(hue, 0.45, 0.82));
    function drawKRegions(tc: CanvasRenderingContext2D, cx: number, cy: number) {
        const w = canvas.w;
        const h = canvas.h;
        const key = [
            w, h, cx, cy, scale.toFixed(6), viewX.toFixed(6), viewY.toFixed(6),
            gammaSet.exact().join(","), String(gammaSet.getSymmetry()),
        ].join("|");
        if (!kBitmap || key !== kBitmapKey) {
            const imgData = tc.createImageData(w, h);
            const data = imgData.data;
            const n = model.n;
            const dirs = model.directions, gamma = model.gamma;
            const vx: number[] = [], vy: number[] = [], gj: number[] = [];
            for (let j = 0; j < n; j++) { vx.push(dirs[j][0]); vy.push(dirs[j][1]); gj.push(gamma[j] - K_EPS); }
            // The whole canvas, gutter included. Stopping at the margin left a
            // blank strip round the edge with source regions missing from it.
            let idx = 0;
            for (let py = 0; py < h; py++) {
                const my = viewY - (py - cy) / scale;
                for (let px = 0; px < w; px++) {
                    const mx = viewX + (px - cx) / scale;
                    // Hash the K-tuple to a hue, family by family.
                    let hash = 0;
                    for (let j = 0; j < n; j++) {
                        const K = Math.ceil(mx * vx[j] + my * vy[j] + gj[j]);
                        hash = ((hash << 5) - hash + K + 50) | 0;
                    }
                    const rgb = K_PALETTE[(((hash * 137) % 360) + 360) % 360];
                    data[idx] = rgb[0];
                    data[idx + 1] = rgb[1];
                    data[idx + 2] = rgb[2];
                    data[idx + 3] = 255;
                    idx += 4;
                }
            }
            kBitmap = imgData;
            kBitmapKey = key;
        }
        tc.putImageData(kBitmap, 0, 0);
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
        for (let j = 0; j < model.n; j++) {
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
        // The scan FIRST. The tiles layer reads it — which rhombs are stacked
        // in a 2k-gon, and the 2k-gons themselves — so it has to be current
        // for this γ and view before anything draws. It used to run after
        // drawAll, so every γ change drew the tiles against the previous
        // γ's concurrencies: the singular tiles went blank, and a second
        // redraw (toggling tiles) fixed it. Jake: "transitions leave many
        // blank tiles (from singularity); click tiles off and on, all okay."
        scanSmallRegions();
        // Every layer decides for itself whether it is wanted; see the specs above.
        stack.drawAll();
        viewStats?.();          // pan and zoom change it, not just the panel
        updateMeter();
        if (loupe.view) { loupe.redraw(); drawFootprint(); }
    }

    // ── Panel ─────────────────────────────────────────────────────────

    const featureBoxes: { key: keyof Features; cb: HTMLInputElement }[] = [];

    /**
     * Which panel a row belongs in. One panel is the usual case; with `panelP`
     * the Penrose rows — the P side of the G/P split — go there instead.
     */
    const P_ROWS = new Set(["Penrose", "Tile style", "Tile shade", "Tile edges", "Tile vertex", "ribbons"]);
    function panelFor(title: string): HTMLElement {
        return config.panelP && P_ROWS.has(title) ? config.panelP : layerPanelDiv;
    }

    function row(parent: HTMLElement, title: string): HTMLElement {
        const wrap = document.createElement("div");
        wrap.className = "panel-row";
        if (title) {
            const t = document.createElement("span");
            t.className = "panel-label";
            t.textContent = title;
            wrap.appendChild(t);
            panelRows.set(title, wrap);      // so a page can expose a subset
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
    /** Features whose switching-on the narrative wants to hear about. */
    const onFeatureOnKeys = new Set<keyof Features>();

    /**
     * A named slider with a fixed-width readout: name, slider, value.
     *
     * The value sits AFTER the slider in a span of fixed width, so "50%" becoming
     * "100%" cannot change the label's width — which reflowed the row and moved
     * the slider under the pointer, the jitter Jake saw. Tabular digits so the
     * text does not wobble either.
     */
    function slider(
        parent: HTMLElement, name: string, title: string,
        range: { min: number; max: number; step: number }, value: number,
        format: (v: number) => string, onInput: (v: number) => void,
    ): HTMLLabelElement {
        const wrap = document.createElement("label");
        wrap.className = "band-setting";
        wrap.title = title;
        const nm = document.createElement("span");
        nm.textContent = name;
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(range.min); input.max = String(range.max);
        input.step = String(range.step);
        input.value = String(value);
        input.style.width = "80px";
        const val = document.createElement("span");
        val.className = "slider-val";
        val.textContent = format(value);
        input.addEventListener("input", () => {
            const v = parseFloat(input.value);
            val.textContent = format(v);
            onInput(v);
        });
        wrap.append(nm, input, val);
        parent.appendChild(wrap);
        return wrap;
    }

    function featureToggle(
        parent: HTMLElement, key: keyof Features, label: string,
    ): HTMLInputElement {
        const cb = checkbox(parent, label, features[key], (v) => {
            const wasOn = features.penroseTiles;
            features[key] = v;
            if (key === "penroseTiles" && !wasOn && v) tilesOn?.();
            syncPanel();
            draw();
            if (v && onFeatureOnKeys.has(key)) {
                for (const listener of featureOnListeners) listener(key);
            }
        });
        featureBoxes.push({ key, cb });
        return cb;
    }


    /** Refreshes the viewport read-out. Set when the panel is built. */
    let viewStats: (() => void) | null = null;
    /** Runs when the tiles go from off to on. Set when the panel is built. */
    let tilesOn: (() => void) | null = null;

    function syncPanel() {
        for (const { key, cb } of featureBoxes) cb.checked = features[key];
        viewStats?.();
    }

    function buildLayerPanel() {
        // ── Gridline tiles: a filter on the tiling, P not G ────────────
        //
        // Which gridlines get dualized when `tile` is on. The grid itself draws
        // every family regardless; this row only decides which crossings become
        // tiles. Each family is all, none, or one line (the K number beside it);
        // the button in front reports the families as a whole — all, some or
        // none — and cycles them: all -> none, some -> all, none -> all. The
        // values are kept while the tiles are off, and none is not allowed when
        // they come back on: that is the one case where the row rewrites itself.
        const tilesRow = row(panelFor("ribbons"), "ribbons");

        const perFamily: { mode: HTMLSelectElement; n: HTMLInputElement }[] = [];
        const status = document.createElement("button");
        status.type = "button";
        status.className = "line-pick";
        status.style.width = "42px";
        status.title = "all, some or none of the families are dualized. Click to cycle: "
            + "all -> none, some -> all, none -> all.";

        /** all / some / none, read off the family modes. */
        const familyStatus = (): "all" | "some" | "none" => {
            const modes = perFamily.map((f) => f.mode.value);
            if (modes.every((m) => m === "all")) return "all";
            if (modes.every((m) => m === "none")) return "none";
            return "some";
        };
        /** Push one family's control into the set, which is what the tiles read. */
        const applyFamily = (j: number) => {
            const m = perFamily[j].mode.value;
            gammaSet.setFamilyEnabled(j, m !== "none");
            gammaSet.setFamilyLine(j, m === "one"
                ? parseInt(perFamily[j].n.value, 10) || 0 : null);
        };
        const setAll = (mode: "all" | "none") => {
            for (let j = 0; j < model.n; j++) {
                perFamily[j].mode.value = mode;
                applyFamily(j);
            }
        };
        const showStatus = () => { status.textContent = familyStatus(); };
        status.addEventListener("click", () => {
            setAll(familyStatus() === "all" ? "none" : "all");
            showStatus();
            draw();
        });
        tilesRow.appendChild(status);

        // Five families on one line, at the canvas width: no swatch — the two
        // fields wear the family's color instead, as a wash behind and a rule
        // around — and the fields are as narrow as their contents allow.
        for (let j = 0; j < model.n; j++) {
            const wrap = document.createElement("label");
            wrap.className = "layer-toggle ribbon-family";
            wrap.title = `Family ${j}: dualize all its lines, none, or the one numbered here.`;
            const color = COLORS[j % COLORS.length];
            const tint = (el: HTMLElement) => {
                el.style.background = lighten(color, 0.8);
                el.style.borderColor = color;
            };

            const mode = document.createElement("select");
            mode.className = "line-pick";
            mode.style.width = "48px";
            for (const v of ["all", "none", "one"]) {
                const o = document.createElement("option");
                o.value = v;
                o.textContent = v;
                mode.appendChild(o);
            }
            mode.value = "all";
            tint(mode);

            const nBox = document.createElement("input");
            nBox.type = "number";
            nBox.className = "line-pick";
            nBox.style.width = "34px";
            nBox.value = "0";
            nBox.title = "Which line, when the mode is `one`.";
            tint(nBox);

            perFamily.push({ mode, n: nBox });
            mode.addEventListener("change", () => { applyFamily(j); showStatus(); draw(); });
            nBox.addEventListener("input", () => {
                if (mode.value === "one") { applyFamily(j); draw(); }
            });

            wrap.appendChild(mode);
            wrap.appendChild(nBox);
            tilesRow.appendChild(wrap);
        }
        showStatus();

        // Tiles coming on with no family dualized would show nothing and say
        // nothing about why; that is the one transition that rewrites the row.
        tilesOn = () => {
            if (familyStatus() === "none") { setAll("all"); showStatus(); }
        };

        // ── View: the viewport itself, and what it is showing ─────────
        const viewRow = row(layerPanelDiv, "View");
        const axesLayer = stack.get("axes");
        if (axesLayer) {
            featureToggle(viewRow, "axes", "axes");
            featureToggle(viewRow, "center", "center").title = "Ring the origin.";
        }
        const stats = document.createElement("span");
        stats.className = "view-stats";
        viewRow.appendChild(stats);
        viewStats = () => {
            const vis = getVisibleRect();
            const m = gammaSet.getGeneration();
            stats.textContent = `×${scale.toFixed(0)} · `
                + `${(vis.xMax - vis.xMin).toFixed(1)}×${(vis.yMax - vis.yMin).toFixed(1)} `
                + `at (${viewX.toFixed(2)}, ${viewY.toFixed(2)})`
                + (m ? ` · λ = φ${superscript(m)}` : "");
        };
        viewStats();

        // ── Rendering: the correspondence, as a table ─────────────────
        //
        // Three columns, one per pairing, and three rows: the grid object, the
        // hover helper, the Penrose object. Read down a column and you have a
        // thing, its counterpart, and the helper that shows you one from the
        // other. Rendering only — none of it changes the tiling.
        const CORRESPONDENCE = [
            { grid: ["kRegions", "K-region"], hover: "hoverVertex", pen: ["penroseVertices", "vertex"] },
            { grid: ["gridLines", "gridline"], hover: "hoverEdge", pen: ["penroseEdges", "edge"] },
            { grid: ["intersectionDots", "intersections"], hover: "hoverTile", pen: ["penroseTiles", "tile"] },
        ] as const;

        const corrRow = (
            label: string,
            pick: (c: typeof CORRESPONDENCE[number]) => readonly [keyof Features, string],
        ) => {
            const r = row(panelFor(label), label);
            for (const c of CORRESPONDENCE) {
                const cell = document.createElement("span");
                cell.className = "corr-cell";     // fixed width, so columns line up
                r.appendChild(cell);
                const [key, text] = pick(c);
                featureToggle(cell, key, text);
            }
        };

        // Ticking K-region tells the narrative, which may take you to the page it
        // is about. The view reports; it does not decide.
        onFeatureOnKeys.add("kRegions");

        corrRow("Pentagrid", (c) => c.grid);
        corrRow("Hover", (c) => [c.hover, ""] as const);
        corrRow("Penrose", (c) => c.pen);

        // K-labels belong with the regions rather than on their own row.
        // G only — the counterpart of Tile style. The Penrose dressings are on
        // that row, and "Penrose in front" has no control any more: it is
        // always in front.
        const extras = row(layerPanelDiv, "Grid style");
        featureToggle(extras, "kLabels", "K-labels");
        slider(extras, "gridline width", "How thick the grid lines are drawn.",
            { min: 0.5, max: 4, step: 0.5 }, gridLineWidth, (v) => v.toFixed(1),
            (v) => { gridLineWidth = v; draw(); });

        // ── Tile style ────────────────────────────────────────────────
        {
            const sRow = row(panelFor("Tile style"), "Tile style");
            const sel = document.createElement("select");
            sel.className = "line-pick";
            sel.style.width = "84px";
            sel.title = "thick/thin · the families that made it · the two as crossed bands "
                + "· its rhomb group, Pe5/Pe3/Pe1 in sun-star's colors · the P1 tiling: "
                + "a pentagon on every group, blue between (the small rhombs) · the "
                + "matching curves as filled regions, dark at the arrow corner · "
                + "pentagons: P1 at the scale where every thick rhomb holds a whole "
                + "one (the big rhombs) · next-gen: the deflation, thick gold and thin "
                + "gray at 1/φ — switch the edges off and it is the next generation · "
                + "kites & darts: P2 on the rhombs, a dart in every thick. "
                + "A 2k-gon follows the same choice.";
            // The Penrose dressings are pentagrid facts — rhomb groups, P1, the
            // matching curves, the deflation, P2 — and are not offered off it.
            const general = [["type", model.n === 5 ? "thick/thin" : "by shape"], ["pair", "families"], ["bands", "families2"]] as const;
            const penrose = [
                ["groups", "rhomb groups"], ["p1", "P1"], ["curves", "curves"],
                ["pentagons", "pentagons"], ["nextgen", "next-gen"], ["kites", "kites & darts"],
            ] as const;
            for (const [value, text] of model.n === 5 ? [...general, ...penrose] : general) {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = text;
                sel.appendChild(opt);
            }
            sel.value = tileStyle.color;
            sel.addEventListener("change", () => {
                tileStyle.color = sel.value as TileStyle["color"];
                bandWrap.hidden = tileStyle.color !== "bands";
                draw();
            });

            // The band width, for families2 only — grow.html's slider, here.
            const bandWrap = slider(sRow, "band",
                "Width of each gridline's band across the tile, as a fraction of "
                + "the edge. 100% covers the tile; 0 leaves it bare.",
                { min: 0, max: 1, step: 0.02 }, tileStyle.band, (v) => `${Math.round(v * 100)}%`,
                (v) => { tileStyle.band = v; draw(); });
            bandWrap.hidden = tileStyle.color !== "bands";
            sRow.appendChild(sel);
            sRow.appendChild(bandWrap);   // re-append: it must follow the select
            const offP = checkbox(sRow, "off Penrose", tileStyle.offPenrose, (v) => {
                tileStyle.offPenrose = v;
                draw();
            });
            offP.title = "Draw the index-placed dressings — arrows, curves, pentagons, next-gen, "
                + "kites — off a Penrose patch too: the tiles touching the top or bottom index "
                + "level get theirs, and the middle ones, which could go either way, get both "
                + "readings at half strength.";

            // Second row: how the fill is shaded.
            const shadeRow = row(panelFor("Tile shade"), "Tile shade");
            const iso = checkbox(shadeRow, "isogloss", tileStyle.isogloss, (v) => {
                tileStyle.isogloss = v;
                draw();
            });
            iso.title = "Contour lines across each tile, perpendicular to its long diagonal.";

            // The height ramp — wieringa-roof's shading — over whatever color is
            // chosen, with the roof's strength slider beside it when it is on.
            const shadeBox = checkbox(shadeRow, "height", tileStyle.shading, (v) => {
                tileStyle.shading = v;
                rampWrap.hidden = !v;
                draw();
            });
            shadeBox.title = "Shade by Wieringa height: lighter towards the top of the "
                + "patch, darker towards the bottom, each tile a gradient from its low "
                + "corner to its high. Over any color, families2 included.";
            const rampWrap = slider(shadeRow, "ramp", "Strength of the height ramp.",
                { min: 0, max: 1, step: 0.05 }, tileStyle.ramp, (v) => `${Math.round(v * 100)}%`,
                (v) => { tileStyle.ramp = v; draw(); });
            rampWrap.hidden = !tileStyle.shading;

            slider(sRow, "opacity", "Tile transparency. Edges and decoration stay solid.",
                { min: 0.1, max: 1, step: 0.05 }, tileStyle.opacity, (v) => `${Math.round(v * 100)}%`,
                (v) => { tileStyle.opacity = v; draw(); });

            // Third row: the edge dressings — P, not G.
            const edgeRow = row(panelFor("Tile edges"), "Tile edges");
            const bold = checkbox(edgeRow, "bold edges", tileStyle.boldEdges, (v) => {
                tileStyle.boldEdges = v;
                draw();
            });
            bold.title = "Draw the tile edges as real lines, dark and two wide, rather than a gray hairline.";
            featureToggle(edgeRow, "penroseDecor", "arcs");
            if (model.n === 5) {
                featureToggle(edgeRow, "arrows", "arrows");
                const colored = checkbox(edgeRow, "colored arrows", tileStyle.coloredArrows, (v) => {
                    tileStyle.coloredArrows = v;
                    if (v && !features.arrows) setFeatures({ arrows: true }, { merge: true });
                    draw();
                });
                colored.title = "De Bruijn's arrows: solid, along the edge from dot to dot — "
                    + "green doubles, red singles.";
            }
            featureToggle(edgeRow, "pseudoEdges", "pseudo edges");
        }

        // ── Tile vertex ───────────────────────────────────────────────
        {
            const vRow = row(panelFor("Tile vertex"), "Tile vertex");
            // What marks the vertex: the dot, or the index in a circle, either way
            // round. Jake could not tell which reads better, so both are here.
            const mark = document.createElement("select");
            mark.className = "line-pick";
            mark.style.width = "62px";
            mark.title = "The vertex mark: a red dot, or its index in a circle — "
                + "white on black, or black on white. Off Penrose the fifth level "
                + "wears the other style.";
            for (const [value, text] of [["dot", "dot"], ["filled", "\u2776 index"], ["open", "\u2460 index"]] as const) {
                const o = document.createElement("option");
                o.value = value;
                o.textContent = text;
                mark.appendChild(o);
            }
            mark.value = tileStyle.vertexMark;
            mark.addEventListener("change", () => {
                tileStyle.vertexMark = mark.value as TileStyle["vertexMark"];
                if (mark.value !== "dot" && !features.penroseVertices) {
                    setFeatures({ penroseVertices: true }, { merge: true });
                }
                draw();
            });
            vRow.appendChild(mark);
            const idx = featureToggle(vRow, "vertexIndex", "index");
            idx.title = "Write each corner's de Bruijn index on the tile face beside it, "
                + "once per tile corner: 1 to 4 on a Penrose patch, 1 to 5 otherwise; "
                + "the extremes are the rhomb-group centers.";
        }

        // The gridline-tiles row was built first, for its hook; it belongs on
        // the P side, under Tile style. Re-appending moves it.
        panelFor("ribbons").appendChild(tilesRow);

        // Collapsed settings — set once, then forgotten
        const det = document.createElement("details");
        det.className = "settings";
        const sum = document.createElement("summary");
        sum.textContent = "settings";
        det.appendChild(sum);

        const sRow = row(det, "");
        // "force regular" used to be here. Off on every page since the presets
        // made singularities destinations rather than hazards, and the sun
        // default keeps the page off Γ = 0 by itself; the guard stays in the
        // γ set as an API (sunstar, the tests) with no switch. Jake, 2026-09-18.
        // How far past the canvas edge the grid is computed, so a tile at the
        // edge still has its source region. Shown nowhere; the canvas clips it.
        const padWrap = document.createElement("label");
        padWrap.className = "pad-setting";
        padWrap.title = "Compute this many tiling units beyond the canvas edge, so "
            + "every dual vertex on screen has its source region on the grid. "
            + "Not drawn; only the inside is shown.";
        padWrap.appendChild(document.createTextNode("compute beyond edge "));
        const padIn = document.createElement("input");
        padIn.type = "number";
        padIn.min = "0"; padIn.max = "10"; padIn.step = "0.5";
        padIn.value = String(computePad);
        padIn.style.width = "3.5em";
        padIn.addEventListener("input", () => {
            const v = parseFloat(padIn.value);
            if (Number.isFinite(v) && v >= 0) { computePad = v; rhombCache = null; draw(); }
        });
        padWrap.appendChild(padIn);
        sRow.appendChild(padWrap);

        const follow = checkbox(sRow, "readout follows pointer", hoverBox === "pointer", (v) => {
            hoverBox = v ? "pointer" : "corner";
        });
        follow.title = "Off: the hover statistics sit in the canvas corner, out of the "
            + "way of what you are pointing at. On: they ride the pointer.";

        // Vertical-axis symmetry moved to the reticulum's settings popup: it is
        // a fact about the frame, and the reticulum is where the frame is seen.

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
                for (let j = 0; j < model.n; j++) {
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
        hlP.beginPath();
        hlP.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) hlP.lineTo(pts[i][0], pts[i][1]);
        hlP.closePath();
        hlP.fillStyle = r.thick ? "rgba(232,193,112,0.75)" : "rgba(126,184,218,0.75)";
        hlP.fill();
        hlP.strokeStyle = "rgba(255,180,0,0.95)";
        hlP.lineWidth = 2;
        hlP.stroke();

        // The crossing itself, and — on one canvas — a line to the tile it became
        const [ix, iy] = gridToScreen(r.x0, r.y0, cx, cy);
        let mx = 0, my = 0;
        for (const [px, py] of pts) { mx += px; my += py; }
        mx /= pts.length; my /= pts.length;

        if (hlSame) {
            hlG.strokeStyle = "rgba(255,180,0,0.9)";
            hlG.lineWidth = 1.5;
            hlG.beginPath();
            hlG.moveTo(ix, iy);
            hlG.lineTo(mx, my);
            hlG.stroke();
        }

        hlG.fillStyle = "#e63946";
        hlG.beginPath();
        hlG.arc(ix, iy, 4, 0, 2 * Math.PI);
        hlG.fill();
    }

    /**
     * Draw a gridline segment and the Penrose edge it becomes, joined.
     *
     * The segment lives in grid coordinates and the edge in tiling coordinates,
     * which is the whole point of the picture: one object, read through the dual
     * map, landing in two different places on the same canvas.
     */
    function highlightSegment(seg: GridSegment, cx: number, cy: number) {
        const color = COLORS[seg.j % COLORS.length];
        const [ax, ay] = gridToScreen(seg.a[0], seg.a[1], cx, cy);
        const [bx, by] = gridToScreen(seg.b[0], seg.b[1], cx, cy);

        // The segment itself, laid over its gridline.
        hlG.strokeStyle = color;
        hlG.lineWidth = 4;
        hlG.lineCap = "round";
        hlG.beginPath();
        hlG.moveTo(ax, ay);
        hlG.lineTo(bx, by);
        hlG.stroke();
        hlG.lineCap = "butt";

        // Its ends are crossings, so they are the tiles next door.
        hlG.fillStyle = "#e63946";
        for (const [ex, ey] of [[ax, ay], [bx, by]]) {
            hlG.beginPath();
            hlG.arc(ex, ey, 3, 0, 2 * Math.PI);
            hlG.fill();
        }

        // The edge: f(K1) -> f(K2), which is f(K1) + v_j.
        const [ex1, ey1] = dualVertex(model, seg.K1);
        const [ex2, ey2] = dualVertex(model, seg.K2);
        const [px1, py1] = mathToScreen(ex1, ey1, cx, cy);
        const [px2, py2] = mathToScreen(ex2, ey2, cx, cy);
        hlP.strokeStyle = "rgba(255,180,0,0.95)";
        hlP.lineWidth = 4;
        hlP.lineCap = "round";
        hlP.beginPath();
        hlP.moveTo(px1, py1);
        hlP.lineTo(px2, py2);
        hlP.stroke();
        hlP.lineCap = "butt";

        // Its ends are the vertices the two regions became.
        hlP.fillStyle = "#fc0";
        for (const [vx2, vy2] of [[px1, py1], [px2, py2]]) {
            hlP.beginPath();
            hlP.arc(vx2, vy2, 4, 0, 2 * Math.PI);
            hlP.fill();
        }

        // And the tie between them, so the correspondence is visible as one —
        // when they share a canvas. Split, the two halves ARE the tie.
        if (!hlSame) return;
        const mid = (p: number, q: number) => (p + q) / 2;
        hlG.strokeStyle = "rgba(255,200,0,0.5)";
        hlG.lineWidth = 1.5;
        hlG.setLineDash([4, 4]);
        hlG.beginPath();
        hlG.moveTo(mid(ax, bx), mid(ay, by));
        hlG.lineTo(mid(px1, px2), mid(py1, py2));
        hlG.stroke();
        hlG.setLineDash([]);
    }

    // ── Tooltip / hover highlight ──────────────────────────────────────

    function clearHighlight() {
        for (const h of highlights) h.ctx.clearRect(0, 0, canvas.w, canvas.h);
    }

    function formatKTooltip(K: readonly number[]): string {
        const parts = K.map((v, j) => {
            const color = gammaSet.familyEnabled(j) ? TIP_ON : TIP_OFF;
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
        hlG.fillStyle = "rgba(255, 255, 100, 0.35)";
        hlG.strokeStyle = "rgba(255, 200, 0, 0.8)";
        hlG.lineWidth = 2;
        hlG.beginPath();
        hlG.moveTo(screenPts[0][0], screenPts[0][1]);
        for (let i = 1; i < screenPts.length; i++) {
            hlG.lineTo(screenPts[i][0], screenPts[i][1]);
        }
        hlG.closePath();
        hlG.fill();
        hlG.stroke();

        // If the region is small, draw an arrow from the dot to its centroid
        const regionSize = Math.max(sxMax - sxMin, syMax - syMin);
        if (regionSize < 20 && hlSame) {
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

                hlG.strokeStyle = "rgba(255, 200, 0, 0.8)";
                hlG.lineWidth = 1.5;
                hlG.beginPath();
                hlG.moveTo(startX, startY);
                hlG.lineTo(endX, endY);
                hlG.stroke();

                // Arrowhead
                const headLen = 7;
                const angle = Math.atan2(uy, ux);
                hlG.beginPath();
                hlG.moveTo(endX, endY);
                hlG.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
                hlG.moveTo(endX, endY);
                hlG.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
                hlG.stroke();
            }
        }
    }

    /** Clip polygon to the half-plane a*x + b*y + c ≥ 0 (or > 0 if strict, but we use ≥ for robustness) */

    onEvent("mousemove", (e, surface) => {
        if (isPanning) {
            tooltip.style.display = "none";
            clearHighlight();
            return;
        }

        const rect = surface.getBoundingClientRect();
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
                    `<br><span style="color:${TIP_NAME}">${hit.thick ? "thick" : "thin"}</span> rhomb`;
                placeTooltip(e, 34);
                return;
            }
        }

        // Gridline segment -> Penrose edge. Ordered between the two: a crossing
        // is a point and a region is an area, so the line belongs in the middle
        // or it would swallow every hover near a gridline.
        if (features.hoverEdge) {
            const [mx, my] = screenToGrid(sx, sy, cx, cy);
            const active = Array.from({ length: model.n },
                                      (_, j) => gammaSet.familyEnabled(j));
            const near = nearestLine(model, mx, my, active);
            // The tolerance is in pixels, so it holds at every zoom.
            const pxPerUnit = scale * gridGain();
            if (near && near.dist * pxPerUnit < 10) {
                const reach = Math.max(4, 40 / Math.max(pxPerUnit, 1e-6));
                const seg = segmentAt(model, near.j, near.nj, mx, my, reach);
                if (seg) {
                    clearHighlight();
                    highlightSegment(seg, cx, cy);
                    const sub = SUBSCRIPTS[seg.j] ?? `_${seg.j}`;
                    tooltip.innerHTML =
                        `line <span style="color:${COLORS[seg.j % COLORS.length]}">` +
                        `${seg.nj} of family ${seg.j}</span>` +
                        `<br>${formatKTooltip(seg.K1)}` +
                        `<br>${formatKTooltip(seg.K2)}` +
                        `<br><span style="color:${TIP_NAME}">edge</span> = v${sub}`;
                    placeTooltip(e, 40);
                    return;
                }
            }
        }

        if (features.hoverVertex) {
            // TWO readings of one hover, and the nearer thing wins.
            //
            // These were two separate `if (features.hoverVertex)` blocks and the
            // first ended in an unconditional `return`, so the second could never
            // run: the yellow source-region and its arrow had been dead since the
            // factory extraction on 2026-09-05, three months after they were
            // written. Ordered properly now — a dual vertex under the pointer
            // answers with the region that MADE it, and anywhere else answers with
            // the region you are in and the vertex it becomes.
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
                    const color = gammaSet.familyEnabled(j) ? TIP_ON : TIP_OFF;
                    return `<span style="color:${color}">${v}</span>&middot;v${SUBSCRIPTS[j]}`;
                });
                tooltip.innerHTML =
                    formatKTooltip(best.K) +
                    `<br><span style="color:${TIP_NAME}">f</span> = ${terms.join(" + ")}`;
                placeTooltip(e);

                // Highlight the hovered dot
                hlP.fillStyle = "#fc0";
                hlP.beginPath();
                hlP.arc(best.sx, best.sy, 5, 0, 2 * Math.PI);
                hlP.fill();

                // Highlight the source region in the pentagrid
                withView(gridView(), () => highlightRegion(best!.K, cx, cy, best!.sx, best!.sy));
                return;
            }
            // Nothing under the pointer is a vertex, so fall through to the region.

            // Region -> its dual vertex. The K-tuple is a fact about the pentagrid,
            // so it is read in grid coordinates; the vertex it points at stays in
            // tiling coordinates.
            const [mx, my] = screenToGrid(sx, sy, cx, cy);
            const K = computeKTuple(mx, my);
            tooltip.innerHTML = formatKTooltip(K);
            placeTooltip(e);

            clearHighlight();

            // Derive dark version of the region's color
            let hash = 0;
            for (let j = 0; j < model.n; j++) {
                hash = ((hash << 5) - hash + K[j] + 50) | 0;
            }
            const hue = (((hash * 137) % 360) + 360) % 360;
            const [dr, dg, db] = hslToRgb(hue, 0.7, 0.35);
            const darkColor = `rgb(${dr},${dg},${db})`;

            // Compute dual vertex f = Σ K_j · v_j
            let fx = 0, fy = 0;
            for (let j = 0; j < model.n; j++) {
                fx += K[j] * directions[j][0];
                fy += K[j] * directions[j][1];
            }
            const [dsx, dsy] = mathToScreen(fx, fy, cx, cy);

            // Draw the dual point
            hlP.fillStyle = darkColor;
            hlP.beginPath();
            hlP.arc(dsx, dsy, 3, 0, 2 * Math.PI);
            hlP.fill();

            // Arrow from cursor to dual vertex, when they share a canvas
            const adx = dsx - sx;
            const ady = dsy - sy;
            const dist = Math.sqrt(adx * adx + ady * ady);
            if (dist > 15 && hlSame) {
                const ux = adx / dist;
                const uy = ady / dist;
                const startX = sx + ux * 6;
                const startY = sy + uy * 6;
                const endX = dsx - ux * 6;
                const endY = dsy - uy * 6;

                hlG.strokeStyle = darkColor;
                hlG.lineWidth = 1.5;
                hlG.beginPath();
                hlG.moveTo(startX, startY);
                hlG.lineTo(endX, endY);
                hlG.stroke();

                const headLen = 7;
                const angle = Math.atan2(uy, ux);
                hlG.beginPath();
                hlG.moveTo(endX, endY);
                hlG.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
                hlG.moveTo(endX, endY);
                hlG.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
                hlG.stroke();
            }
            return;
        }

        tooltip.style.display = "none";
        clearHighlight();
    });

    onEvent("mouseleave", () => {
        tooltip.style.display = "none";
        clearHighlight();
    });

    // ── Init ──────────────────────────────────────────────────────────

    // An exploration's own layers go on before the panel is generated, so they
    // get their switches like anything else.
    config.layers?.({
        stack, model, currentRhombs, withView, gridView,
        getView: () => ({ scale, x: viewX, y: viewY }),
        redraw: () => draw(),
    });

    // Follow the container when the page did not name a size. Setting a canvas's
    // width clears it, so every resize is followed by a redraw.
    if (!canvas.explicit && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => {
            const r = container.getBoundingClientRect();
            const w = Math.round(r.width), h = Math.round(r.height);
            if (!(w > 0 && h > 0)) return;          // hidden, or not laid out yet
            if (w === canvas.w && h === canvas.h) return;
            canvas.w = w;
            canvas.h = h;
            canvas.margin = canvas.fixedMargin ?? Math.round(Math.min(w, h) * 0.05);
            viewW = w; viewH = h; viewMargin = canvas.margin;
            layerPanelDiv.style.maxWidth = `${w}px`;
            if (config.panelP) config.panelP.style.maxWidth = `${w}px`;
            stack.resize(w, h);
            rhombCache = null;                       // the visible rect moved
            draw();
        });
        ro.observe(container);
    }

    // The default is the sun — uniform 1/5, total 1 — not the singular Gamma = 0
    // the set starts on. Jake: "the default preset is decagon. Not a good one."
    // A page that wants the singular point asks for it (step 7 does).
    if (config.gamma) gammaSet.setValues(config.gamma);
    else gammaSet.setSum(1, true);

    // One subscription: any change to γ, the lock, the sum, the symmetry, the
    // guard or λ lands here rather than each call site remembering to redraw.
    //
    // λ is applied here and nowhere else: the geometry is in tiling units and a
    // tiling unit is λ world units, so a change of λ is a zoom about the origin
    // that keeps every WORLD point where it was on screen — the invariants are
    // scale/λ and λ·view. Deflate, and the finer tiling lands inside the old
    // one instead of the picture jumping.
    let lambdaShown = gammaSet.model.lambda ?? 1;
    gammaSet.onChange(() => {
        const lambda = gammaSet.model.lambda ?? 1;
        if (lambda !== lambdaShown) {
            const k = lambda / lambdaShown;
            scale *= k;
            viewX /= k;
            viewY /= k;
            lambdaShown = lambda;
            notifyView();
        }
        rhombCache = null;
        draw();
    });

    buildLayerPanel();
    restackPenrose();
    draw();

    return {
        redraw: draw,
        setFeatures,
        setGridAlpha: (a) => { gridAlpha = a; draw(); },
        setTileStyle: (st) => { Object.assign(tileStyle, st); draw(); },
        exposeRows,
        panelRow: (label) => panelRows.get(label),
        onFeatureOn: (cb) => { featureOnListeners.push(cb); },
        getView: () => ({ scale, x: viewX, y: viewY }),
        setView: (v) => {
            scale = v.scale;
            viewX = v.x;
            viewY = v.y;
            draw();
        },
        setGamma: (g) => gammaSet.setValues(g),
        gamma: gammaSet,
        stack,
    };
}
