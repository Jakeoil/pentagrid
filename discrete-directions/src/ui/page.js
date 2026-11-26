// @ts-check
// by-your-bootstraps: five ordered points in, a Penrose tiling out.
//
// The figure on the left is the input — five draggable lattice points and the
// pentagon they close. Everything on the right is derived from them: the four
// wheels, the tile outlines, and whichever patch is chosen. Move a point and
// the whole tiling follows, because nothing downstream holds a coordinate.
//
// This file is the page. The mathematics it draws comes in through `lib/`, and
// the rule is one way: nothing under `src/math/` knows a canvas exists.

import {
    PENTA_UP, PRESETS, centroidOf, eWheel, inflate, integralCentroid, ladderTo,
    m10, presetName,
    pentaflake, sharedEdge, spokesOf, walkSeed, wheelFromPoints, wheelsAt,
} from "../../lib/wheels.js";
import { rhombGroup, rhombus } from "../../lib/tiles.js";
import { expand, isSeedType, outlineOf } from "../../lib/patch.js";
import { BUILD_ID } from "./build-id.js";

/** @typedef {import("../../lib/wheels.js").Pt} Pt */
/** @typedef {import("../../lib/wheels.js").Wheel} Wheel */
/** @typedef {import("../../lib/wheels.js").WheelSet} WheelSet */
/** @typedef {import("../../lib/tiles.js").Spelling} Spelling */
/** @typedef {import("../../lib/patch.js").Placement} Placement */
/** @typedef {import("../../lib/patch.js").SeedType} SeedType */
/** @typedef {import("./pentadiculum.js").Seed} Seed */
/** @typedef {import("./pentadiculum.js").Snap} Snap */

import {
    EDGE_INK, GRID_FIFTHS, GRID_LEVELS, GRID_OVER, GRID_OVER_ALPHA,
    GRID_OVER_FIFTHS, HOT, INK, TAU, gridLines, paper, poly,
} from "./draw.js";
import { numHTML } from "./numerals.js";
// The input figure itself -- the five points, the origin and the pointer --
// lives in the Pentadiculum. See the section below.
import {
    PD_ORIGIN, bindDrops, bindScroll, createPentadiculum,
    mountFloatingPentadiculum, presetLabel, setBox, snapForSeed,
} from "./pentadiculum.js";

/** @type {(id: string) => HTMLElement | null} */
const byId = (id) => document.getElementById(id);

/**
 * penrose-mosaic has exactly three colors, and every blue is the same blue:
 * Pe5 and the whole star family share it. Three near-blues for St5/St3/St1 made
 * the output look as though the star types were different materials.
 */
const BLUE = "#3355cc", YELLOW = "#f2d13b", ORANGE = "#dd7722";
/** @type {Record<string, string>} */
const FILL = {
    Pe5: BLUE, Pe3: YELLOW, Pe1: ORANGE,
    St5: BLUE, St3: BLUE, St1: BLUE,
};

/** @type {Pt[]} */
let points = PENTA_UP.map((p) => /** @type {Pt} */ ([p[0], p[1]]));

/**
 * The point the five are measured FROM. Moving it is exactly translating the
 * five the other way — `{points, origin}` says nothing the five spokes do not —
 * so it adds no geometry. What it adds is the one motion the five handles
 * cannot make between them: sliding the pentagon over the lattice as a block.
 *
 * Which turns out to be sharply fenced. See `src/math/seed.js`: of all the
 * places the origin can sit, only a small pentagon's worth keep the ten spokes
 * in order, and on the integer lattice that is two positions for the classic
 * seed and six for the asymmetric one. `originFence` draws it so the limit is
 * visible rather than discovered by the figure falling apart.
 * @type {Pt}
 */
let origin = [0, 0];

/** The five as the wheels want them: positions seen from the origin. */
const spokes = () => spokesOf({ points, origin });

/**
 * Label the five point-to-point vectors with an arrow and their values. They
 * are the AFFINE part of the seed: a difference has the origin cancel out, so
 * these five are what dragging the origin leaves alone.
 */
let showVectors = false;

/**
 * The `fine` box: the fifths ruled across each unit square on the INPUT figure.
 *
 * This is the SETTING, not the answer. Jake, 2026-11-24: *fine off by default,
 * unchecked if possible, checked (grayed) if centroid is not on a unit. Must be
 * checked and active if user is moving centroid or moving a handle causes
 * centroid to move.* The Pentadiculum forces the grid on in those cases and
 * reports it back in `drawn.boxes.fine`, so what lives here is only what the
 * user last asked for -- remembered, so that when the center comes back to a
 * unit the box returns to the state they left it in rather than to a default.
 *
 * The output canvas has its own `5 space` box, `gridFifths`, because the two
 * figures are at different scales and wanting it on one is no reason to have it
 * on the other.
 */
let inputFifths = false;

/** The sweet spot: the origin at which all three rhomb spellings coincide. */
const centroid = () => centroidOf(points);
/** The spokes the RHOMBS are measured on. See the `centroid` spelling. */
const rhombSpokes = () => spelling === "centroid"
    ? spokesOf({ points, origin: centroid() }) : spokes();
/** @type {SeedType} */
let seed = "Sun";
/** The patch's angle, as penrose-mosaic splits it: fifths plus an up/down bit. */
let fifths = 0;
let isDown = false;
/** Convex or concave aspect of the seed. Decides a rhomb's ridges and valleys. */
let heads = true;
const seedTenth = () => m10(fifths * 2 + (isDown ? 5 : 0));
let gen = 2;
/**
 * How the rhombs are built. The three `Spelling`s walk the quadrilateral in
 * different wheels; `centroid` is not a spelling at all but an ORIGIN — it
 * measures the rhombs from the seed's centroid, where all three spellings
 * coincide and every one of them closes as an exact parallelogram.
 * @typedef {Spelling | "centroid"} RhombMode
 */
/** @type {RhombMode} */
let spelling = "classic";
/** @type {"none" | "little" | "big"} */
let rhombSize = "none";

/**
 * How a face is drawn — a face being one tile's polygon, pentagon or star.
 *
 * `face: "none"` is what used to be a separate "show pentas" checkbox.
 *
 * ONE PAIR OF CONTROLS USED TO GOVERN BOTH CANVASES, on the reasoning that the
 * input pentagon is a face like any other and two sets that could disagree
 * would not be kept in step. Jake, 2026-11-24: *put separate functionality for
 * faces and edges in output. […] functionality in penticulum will only affect
 * penticulum.* He is right, and the reason is that the two figures are doing
 * different jobs. The input figure is a thing you are **placing on a lattice**,
 * so you want the paper to read through it; the output is a **tiling**, where
 * the fills are how you tell a Pe5 from a Pe3. Wanting one transparent is no
 * argument at all for the other.
 *
 * @typedef {"none" | "transparent" | "solid"} Face
 */
/** @typedef {"none" | "thin" | "thick"} Edge */

// The input figure's own. Transparent by default now that it is nobody else's
// business: the fifths, the unit lines and the fence all run underneath it.
/** @type {Face} */
let seedFace = "transparent";
/** @type {Edge} */
let seedEdge = "thin";

// The output's pentas and stars. Solid, which is what the page has always
// looked like and what a tiling wants.
/** @type {Face} */
let tileFace = "solid";
/** @type {Edge} */
let tileEdge = "thin";

/** The rhomb overlay's own face and edge, same vocabulary. @type {Face} */
let rhombFace = "none";
/** @type {Edge} */
let rhombEdge = "thin";
/** @type {(k: number) => number} */
const edgeWidth = (k) =>
    tileEdge === "thick" ? Math.max(1.4, k * 0.12) : Math.max(0.4, k * 0.06);
/** @type {readonly Face[]} */
const FACES = ["none", "transparent", "solid"];
/** @type {readonly Edge[]} */
const EDGES = ["none", "thin", "thick"];

/**
 * How far the five have been WALKED, in half generations.
 *
 * Jake, 2026-11-25: *we don't need the use button. Just move the handles to
 * their appointed area.* So this is no longer a rung the figure is derived at --
 * `walkSeed` moves the five themselves and they are always what is drawn. It is
 * a count, kept because it says where you have got to, and it goes back to 0
 * whenever the five arrive some other way: a drag, a preset, the panel.
 */
let extrapolate = 0;
/**
 * What the input's handles snap to.
 *
 * Two settings, and it had three for a day. Jake, 2026-11-23: *I made a mistake
 * with that 1/5 thing. We don't need it. In snap mode only the centroid need
 * snap at 1/5.* So `units` now means each handle on the grid it belongs to --
 * the five corners on whole units, because they are Gaussian integers and that
 * is the definition, and the center on fifths, because the sweet spot is in
 * (1/5)Z^2 and a whole-unit center could never reach it. `none` is for the real
 * preset, whose corners are irrational and would be wrecked by rounding; it
 * still quantizes, at 1/256, because a pointer has pixels and a coordinate that
 * reads to sixteen places is not a coordinate anyone can use. The rounding
 * itself is the Pentadiculum's -- it owns the pointer -- and this is only
 * whether the `snap` box is ticked.
 */
/** @type {Snap} */
let snap = "units";

/**
 * How tiles are filled.
 *
 * Tiles are filled **even-odd**, not nonzero — the rule that gives a
 * self-intersecting outline the figure it actually is, rather than flooding the
 * crossing.
 *
 * As built, no tile outline self-intersects: checked over both presets and a
 * skew one, five generations and all ten tenths, every outline is simple, so the
 * two rules agree on everything this module currently draws. Even-odd is here
 * because it costs nothing and stays correct if a walk is ever changed — a star
 * written as a {5/2} pentagram instead of a rim walk would need it.
 */

/**
 * The output's viewport: a zoom and a pan on top of the automatic fit.
 *
 * Kept as a multiplier on the fit rather than replacing it, so changing seed or
 * generation still frames the figure sensibly and the viewport rides along.
 */
const view = { zoom: 1, panX: 0, panY: 0 };
/**
 * Draw the output's lattice OVER the tiles as well as under them.
 *
 * Under the tiles the paper is decoration; over them it is a measurement — it
 * is how you see which tile corners land on lattice points and which do not,
 * which is the whole question the discrete geometry asks. Kept to a veil so the
 * tiling still reads as the figure.
 */
let gridOver = false;
/**
 * Divide the output's unit squares into fifths, as the input's are.
 *
 * Jake, 2026-11-23: *use light 5 space grid on units in output grid too.* It is
 * a checkbox rather than always on because the output's lattice is where the
 * TILES live, and a tile corner either is on a lattice point or is not -- the
 * fifths are the center's business, not theirs, and are worth seeing only when
 * you are asking where the figure sits against them.
 */
let gridFifths = false;

/** The output's paper, and the same lattice laid over the tiles. */
const outLevels = () => (gridFifths ? GRID_FIFTHS : GRID_LEVELS);
const overLevels = () => (gridFifths ? GRID_OVER_FIFTHS : GRID_OVER);
let panning = false;
/** @type {[number, number]} */
let panFrom = [0, 0];
/** The last automatic fit, so zoom can be anchored on the pointer. */
let fit = { k0: 1, mx: 0, my: 0, w: 1, h: 1 };

// ── the input figure: the Pentadiculum ─────────────────────────
//
// The figure, its viewport, its handles and the pointer all live in
// `src/ui/pentadiculum.js` now. What is left here is the BINDING: this page's
// seed, the view its own controls add to it, and the readouts underneath.
//
// Which is the whole reason for the extraction. The instrument is wanted on
// pages that have never heard of this one -- a moire page showing four seeds
// side by side is four Pentadicula and no global state -- and that is only
// possible if none of it is written as a module-level `let` in a page.

const inputCanvas = /** @type {HTMLCanvasElement | null} */ (byId("boot-input"));
const CELL = 26;

/** The seed, as the component takes it. @type {() => Seed} */
const seedNow = () => ({ points, origin });
/**
 * The view this page's own controls add. Face, edges and the ladder are not the
 * seed's business -- they are how this page draws it -- so they ride in here
 * rather than living in the component.
 * @type {() => import("./pentadiculum.js").View}
 */
// `extrapolate` is NOT in here. It is a count of walks, not a rung to derive a
// figure at, and handing it to the instrument as one would extrapolate a
// pentagon that has already been walked.
const viewNow = () =>
    ({ face: seedFace, edge: seedEdge, order: gen,
        vectors: showVectors, snap, fifths: inputFifths });

const pd = createPentadiculum({
    canvas: inputCanvas ?? undefined,
    cell: CELL,
    // A drag has made a new seed, and the component has already drawn it. Take
    // it, keep the preset picker honest, and bring the rest of the page along.
    onChange: (next) => {
        points = next.points.map((p) => /** @type {Pt} */ ([p[0], p[1]]));
        origin = next.origin;
        // The five are where the hand put them now, so a count of half
        // generations from the figure they were walked out of means nothing.
        extrapolate = 0;
        showExtrapolate();
        syncPreset();
        readouts(pd.drawn());
        drawFlake();
        drawTiling();
    },
    // A double-click on a handle changes the FLOATER, and the rung readout
    // names it. The component has already drawn; without this the readout
    // lagged the canvas by a redraw and said the wrong handle was floating.
    //
    // Guarded on the floater, because `onView` also fires on every scroll
    // click, and a zoom changes nothing this readout shows -- `readouts`
    // rebuilds the whole wheel table, which is not work to do sixty times a
    // second for a number that did not move.
    onView: (v) => {
        if (v.floater === floaterShown) return;
        floaterShown = v.floater;
        readouts(pd.drawn());
    },
});

/** The floater the readout is currently naming, so a zoom can be ignored. */
let floaterShown = PD_ORIGIN;

/**
 * Which handle the others drive, in words, for the rung readout.
 *
 * Double-click assigns it; the component owns it, so this reads it back rather
 * than keeping a copy that could disagree with the canvas.
 * @type {(f: number) => string}
 */
const floaterLine = (f) => f < 0
    ? "nothing floats &mdash; all six handles are free"
    : f === PD_ORIGIN
        ? "the center floats: it keeps its offset from the centroid"
        : `point ${f} floats and the center is fixed: the centroid is pinned`;

/**
 * The same thing in four words, for the panel's status line, which is 328px
 * wide and elides rather than wraps. The long form above is the readout's,
 * under the rig, where there is a column to say it in.
 * @type {(f: number) => string}
 */
const floaterShort = (f) => f < 0 ? "nothing floats"
    : f === PD_ORIGIN ? "<b>the center floats</b>"
    : `<b>point ${f} floats</b>, the center is fixed`;

/** Ask for an exact fit on the next draw. */
const refitInput = () => pd.refit();

function drawInput() {
    readouts(pd.sync(seedNow(), viewNow()));
}

/**
 * The two readouts under the rig: the wheel table, and the rung line with the
 * origin, the centroid and the seed's verdict.
 * @param {import("./pentadiculum.js").Drawn} drawn
 */
function readouts(drawn) {
    syncBoxes(drawn);
    report(eWheel(wheelFromPoints(spokes())));
    seedStat(drawn);

    const rungOut = byId("boot-rung-read");
    if (!rungOut) return;
    // Generation 1, always: a step moves the five, so the five on the paper are
    // the figure and there is no derived copy to print beside them.
    const d = wheelsAt(spokes(), 1).d;
    rungOut.innerHTML = `<b>extrapolate ${extrapolate > 0 ? "+" : ""}${extrapolate}`
        + ` &middot; the five are the figure</b>`
        + `<span>${d.slice(0, 3).map((v) => `(${numHTML(v[0])}, ${numHTML(v[1])})`).join("  ")}</span>`
        + `<b>origin (${numHTML(origin[0])}, ${numHTML(origin[1])})`
            + ` &middot; centroid (${numHTML(centroid()[0])}, ${numHTML(centroid()[1])})`
            + (drawn.sweet ? " &middot; on the sweet spot" : "") + `</b>`
        + `<span>${drawn.verdict.ok ? "the ten spokes are in order"
            : `&#9888; ${drawn.verdict.why}`}</span>`
        // The floater is a MODE, and an unnamed mode that moves a handle you
        // never touched is a bug report waiting to be filed.
        + `<b>floater</b><span>${floaterLine(pd.view().floater)}</span>`;
}


/**
 * The panel's own status, under its bar: three lines, one thing each.
 *
 * Jake, 2026-11-26: *the "origin, centroid" status should not be in the
 * floating part. It can be moved below the panel button, but it must be fixed
 * size so the output controls dont jump.* It was the first thing in the
 * floating panel, where a decimal in the origin or a verdict pushed every
 * control under it down a line; the panel has none now and this is where it
 * went. One line per fact, each elided rather than wrapped, so the box is 51px
 * tall no matter what it says and the output's controls below cannot move.
 *
 * It is OUTSIDE `#boot-seed-inline`, so it stays on the page while the
 * instrument floats -- and it is the same seed either way.
 * @param {import("./pentadiculum.js").Drawn} drawn
 */
function seedStat(drawn) {
    const stat = byId("boot-stat");
    if (!stat) return;
    const c = centroid();
    stat.innerHTML =
        `<span><b>origin</b> (${numHTML(origin[0])}, ${numHTML(origin[1])})`
            + `${drawn.verdict.ok ? "" : ` &#9888; ${drawn.verdict.why}`}</span>`
        + `<span><b>centroid</b> (${numHTML(c[0])}, ${numHTML(c[1])})`
            + `${drawn.sweet ? " &middot; <b>on the sweet spot</b>" : ""}</span>`
        + `<span>${floaterShort(pd.view().floater)}</span>`;
}

/**
 * The bar over the panel: the fold marker, the instrument's name, and the
 * seed's -- which is exactly what the floating panel's title bar says, because
 * Jake, 2026-11-26: *the pentadiculum button should behave like the header line
 * on the anchor. Same display.*
 *
 * `byId` each time rather than the `seedBtn` below it: this is called from
 * `syncPreset`, which runs while the module is still being set up, and a
 * `const` declared further down is in its temporal dead zone until then.
 */
function showSeedBar() {
    const bar = byId("boot-float");
    if (!bar) return;
    const open = seedFloat?.isOpen() ?? false;
    bar.innerHTML = `${open ? "&#9656;" : "&#9662;"}&nbsp;pentadiculum`
        + ` &mdash; ${presetLabel(presetName(seedNow()))}`;
    bar.title = open
        ? "put the seed instrument back in the left column"
        : "float the seed instrument over the output";
}


// ── step 1: the pentaflake ────────────────────────────────────────────────

const flakeCanvas = /** @type {HTMLCanvasElement | null} */ (byId("boot-flake"));

/**
 * The figure the P wheel is measured off: the middle pentagon and the five
 * 180° copies placed edge to edge. The spokes are the P vectors.
 */
function drawFlake() {
    if (!flakeCanvas) return;
    const ctx = flakeCanvas.getContext("2d");
    if (!ctx) return;
    const w = flakeCanvas.width, h = flakeCanvas.height;

    const leaves = pentaflake(spokes());
    /** @type {Pt} */
    let lo = [Infinity, Infinity];
    /** @type {Pt} */
    let hi = [-Infinity, -Infinity];
    for (const leaf of leaves)
        for (const c of leaf.corners) {
            lo = [Math.min(lo[0], c[0]), Math.min(lo[1], c[1])];
            hi = [Math.max(hi[0], c[0]), Math.max(hi[1], c[1])];
        }
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) || 1;
    const k = (Math.min(w, h) - 42) / span;
    const cx = w / 2 - ((lo[0] + hi[0]) / 2) * k;
    const cy = h / 2 - ((lo[1] + hi[1]) / 2) * k;
    paper(ctx, w, h, cx, cy, k);

    // the leaves first, so the middle draws over their shared edges
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.2;
    for (const leaf of leaves) {
        poly(ctx, leaf.corners, cx, cy, k);
        ctx.fillStyle = leaf.edge < 0 ? FILL.Pe5 : FILL.Pe3;
        ctx.fill();
        ctx.strokeStyle = "rgba(20,20,30,0.55)";
        ctx.stroke();
    }

    // the shared edges, which are the point of the construction
    ctx.strokeStyle = HOT;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const [a, b] = sharedEdge(spokes(), i);
        ctx.moveTo(cx + a[0] * k, cy + a[1] * k);
        ctx.lineTo(cx + b[0] * k, cy + b[1] * k);
    }
    ctx.stroke();

    // O to O_k: the P wheel, measured
    ctx.strokeStyle = "rgba(20,20,30,0.8)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (const leaf of leaves.slice(1)) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + leaf.center[0] * k, cy + leaf.center[1] * k);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "600 11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // the five corners of the middle, numbered 1..5 as Jake numbers them
    spokes().forEach((pt, i) => {
        const x = cx + pt[0] * k, y = cy + pt[1] * k;
        ctx.fillStyle = HOT;
        ctx.beginPath();
        ctx.arc(x, y, 7.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(String(i + 1), x, y + 0.5);
    });

    // and each leaf center, labeled with the sum it is
    for (const leaf of leaves.slice(1)) {
        const x = cx + leaf.center[0] * k, y = cy + leaf.center[1] * k;
        ctx.fillStyle = "rgba(20,20,30,0.85)";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.fillText(`O${leaf.edge}`, x, y - 13);
    }

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillText("O", cx, cy - 13);

    const out = byId("boot-flake-read");
    if (out) out.innerHTML = leaves.slice(1).map((l) =>
        `<b>O${l.edge} = pts[${l.edge}] + pts[${(l.edge + 1) % 5}] = P[${l.tenth}]</b>`
        + `<span>(${num(l.center[0])}, ${num(l.center[1])})</span>`).join("");
}

// ── the tiling ────────────────────────────────────────────────────────────

const outCanvas = /** @type {HTMLCanvasElement | null} */ (byId("boot-out"));

function drawTiling() {
    if (!outCanvas) return;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;
    const w = outCanvas.width, h = outCanvas.height;

    const ladder = ladderTo(spokes(), Math.min(gen, MAX_GEN) + 1);
    /** @type {Placement[]} */
    let tiles = [];
    let drawnGen = Math.min(gen, MAX_GEN);
    try {
        // Find the generation to DRAW before building it. The clamp used to
        // expand at the asked-for generation and throw the result away if it
        // was too big, which at order 6 is a 289,991-tile Sun built and
        // discarded, then 42,376, then 6,201 -- 404ms for a picture identical
        // to order 4's, on every redraw. `countAt` remembers the count instead,
        // so the clamp costs nothing the second time and the walk and the patch
        // can share a control without the page stalling.
        while (drawnGen > 1 && countAt(drawnGen, ladder) > TILE_LIMIT) drawnGen -= 1;
        tiles = expand(seed, seedTenth(), [0, 0], drawnGen, ladder, heads);
    } catch {
        tiles = [];
    }
    // one pass to measure, so the patch fills the canvas whatever the seed
    /** @type {Pt} */
    let lo = [Infinity, Infinity];
    /** @type {Pt} */
    let hi = [-Infinity, -Infinity];
    const outlines = tiles.map((t) => {
        const pts = outlineOf(t, ladder[1]);
        for (const p of pts) {
            lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])];
            hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])];
        }
        return { type: t.type, pts };
    });
    if (!outlines.length) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#fbfcfe";
        ctx.fillRect(0, 0, w, h);
        note("nothing to draw");
        return;
    }

    // Fit the figure, then apply the viewport on top of it.
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) || 1;
    const k0 = (Math.min(w, h) - 24) / span;
    const mx = (lo[0] + hi[0]) / 2, my = (lo[1] + hi[1]) / 2;
    fit = { k0, mx, my, w, h };
    const k = k0 * view.zoom;
    const cx = w / 2 - mx * k + view.panX;
    const cy = h / 2 - my * k + view.panY;

    // The same graph paper as the input, at the viewport's scale, so the two
    // canvases read as the same sheet -- fifths and all, when they are asked
    // for, since reading as one sheet is the whole point of matching them.
    paper(ctx, w, h, cx, cy, k, outLevels());

    ctx.lineJoin = "round";
    ctx.lineWidth = edgeWidth(k);
    for (const o of (tileFace === "none" && tileEdge === "none") ? [] : outlines) {
        const color = FILL[o.type] ?? "#999";
        poly(ctx, o.pts, cx, cy, k);
        if (tileFace !== "none") {
            ctx.globalAlpha = tileFace === "transparent" ? 0.42 : 1;
            ctx.fillStyle = color;
            ctx.fill("evenodd");          // NOT nonzero -- see Face
            ctx.globalAlpha = 1;
        }
        if (tileEdge !== "none") {
            ctx.strokeStyle = EDGE_INK;
            ctx.stroke();
        }
    }

    let hostCount = 0;
    if (rhombSize !== "none") {
        // Big and small rhombs are one WHOLE generation apart, phi^2, and the
        // ladder reaches the half rungs between them -- the level the phi^2 P1
        // construction skips.
        // Big rhombs are NOT a bigger group on every leaf tile. penrose-mosaic
        // draws them where the recursion SHORT-CIRCUITS at generation 1 --
        // replacing a whole flake rather than decorating a tile -- so there is
        // one group per gen-1 figure, phi^4 fewer of them. Hanging the big group
        // on every leaf drew that many times too many lines.
        // Stop the SAME expansion one level early rather than expanding one
        // generation less: same area, phi^4 fewer and larger figures.
        const big = rhombSize === "big";
        const hosts = big
            ? expand(seed, seedTenth(), [0, 0], drawnGen, ladder, heads, 1)
            : tiles;
        const { d, t } = wheelsAt(rhombSpokes(), big ? 1 : 0);
        hostCount = hosts.length;
        const inflated = inflate(d);
        const wide = Math.max(0.7, k * 0.05);
        for (const tile of hosts) {
            if (tile.type !== "Pe5" && tile.type !== "Pe3" && tile.type !== "Pe1") continue;
            for (const { spec, turn } of rhombGroup(tile.type, tile.tenth)) {
                const quad = rhombus(spec, t, inflated, turn,
                        spelling === "centroid" ? "classic" : spelling)
                    .map((p) => /** @type {Pt} */ ([p[0] + tile.loc[0], p[1] + tile.loc[1]]));
                if (rhombFace !== "none") {
                    // Colored by rhomb GROUP, which is to say by the pentagon
                    // the group centers on: star on a Pe5 is blue, boat on a
                    // Pe3 yellow, diamond on a Pe1 orange. The group's
                    // membership says the same thing -- star 5 thick, boat
                    // 3 thick and 1 thin, diamond 1 thick and 2 thin -- so the
                    // host's own color is the group's color.
                    poly(ctx, quad, cx, cy, k);
                    ctx.globalAlpha = rhombFace === "transparent" ? 0.45 : 1;
                    ctx.fillStyle = FILL[tile.type] ?? "#999";
                    ctx.fill("evenodd");
                    ctx.globalAlpha = 1;
                }
                if (rhombEdge === "none") continue;
                // Ridge and valley, penrose-mosaic's drawDihedralStroke rule:
                // heads makes edges 0-1 and 3-0 the ridges, tails the other two.
                // This is the only thing `heads` is for, and it is why the
                // heads/tails control is not cosmetic.
                const ridge = tile.heads ? [0, 3] : [1, 2];
                const base = rhombEdge === "thick" ? wide * 1.8 : wide;
                for (let i = 0; i < 4; i++) {
                    const a = quad[i], b = quad[(i + 1) % 4];
                    ctx.beginPath();
                    ctx.moveTo(cx + a[0] * k, cy + a[1] * k);
                    ctx.lineTo(cx + b[0] * k, cy + b[1] * k);
                    ctx.strokeStyle = EDGE_INK;
                    ctx.lineWidth = ridge.includes(i) ? base : base * 0.55;
                    ctx.stroke();
                }
            }
        }
    }

    // Last of all, so it is over everything: the same lattice the paper drew,
    // at the same scale and the same origin. In its own dark palette, because
    // the pale one is made to be read THROUGH and over a blue tile it was not
    // there at all. See GRID_OVER in `src/ui/draw.js`.
    if (gridOver) gridLines(ctx, w, h, cx, cy, k, GRID_OVER_ALPHA, overLevels());

    note(`${tiles.length} tiles · generation ${drawnGen}`
        + (drawnGen === gen ? "" : ` (${gen} asked, capped at ${TILE_LIMIT} tiles)`)
        + ` · ${seed}`
        + (rhombSize === "none" ? "" : ` · ${rhombSize} rhombs on ${hostCount}`)
        + (view.zoom === 1 ? "" : ` · ${view.zoom.toFixed(1)}×`)
        + (gridOver ? " · grid on top" : "")
        + (gridFifths ? " · 5 space" : ""));
}

/** @type {(s: string) => void} */
const note = (s) => {
    const el = byId("boot-note");
    if (el) el.textContent = s;
};

// ── readouts ──────────────────────────────────────────────────────────────

/** Integers print as integers; the real preset needs decimals. @type {(v: number) => string} */
const num = (v) => Number.isInteger(v) ? String(v) : v.toFixed(3);

/** @type {(w: Wheel, n?: number) => string} */
const fmtW = (w, n = 3) =>
    w.slice(0, n).map((p) => `(${numHTML(p[0])}, ${numHTML(p[1])})`).join("  ");

/** @param {Wheel} e */
function report(e) {
    const set = wheelsAt(spokes(), 1);
    /** @type {[string, string][]} */
    const rows = [
        ["D — the five points", fmtW(set.d)],
        ["P = D[t−1] + D[t+1]", fmtW(set.p)],
        ["S = D[t−2] + D[t] + D[t+2]", fmtW(set.s)],
        ["T = S + D", fmtW(set.t)],
        ["E = D[t+1] − D[t−1]", fmtW(e)],
    ];
    const out = byId("boot-wheels");
    if (out) out.innerHTML = rows
        .map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join("");

    const lens = byId("boot-lengths");
    if (lens) {
        const uniq = [...new Set(e.map((p) => Math.hypot(p[0], p[1])))]
            .sort((a, b) => a - b);
        lens.innerHTML = `tile edges: ${uniq.map(numHTML).join(", ")}`;
    }
}

// ── wiring ────────────────────────────────────────────────────────────────

const redraw = () => { drawInput(); drawFlake(); drawTiling(); };

const rungOutValue = byId("boot-index");
/** Show the current index, signed, so +0.5 and -0.5 read differently. */
function showExtrapolate() {
    if (rungOutValue)
        rungOutValue.textContent = extrapolate > 0 ? `+${extrapolate}` : String(extrapolate);
}
/**
 * Walk the five half a generation, because a generation is phi^2 and phi is the
 * half.
 *
 * The step MOVES the handles -- Jake, 2026-11-25: *we don't need the use button.
 * Just move the handles to their appointed area. Just change the output
 * dynamically for both.* `walkSeed` does the move and says why it is pinned on
 * the centroid; the short of it is that the walk is exact at 0, reversible, and
 * composable, so this control can just count.
 *
 * `redraw`, not `drawInput`: the five really changed, so the pentaflake and the
 * patch are both out of date. That is the whole point of dropping `use`.
 * @type {(by: number) => void} */
const stepExtrapolate = (by) => {
    const next = Math.min(6, Math.max(-4, extrapolate + by));
    if (next === extrapolate) return;
    const moved = walkSeed(seedNow(), by);
    points = moved.points.map((p) => /** @type {Pt} */ ([p[0], p[1]]));
    origin = moved.origin;
    extrapolate = next;
    showExtrapolate();
    // A rung is a different figure at a different size, so frame it afresh.
    refitInput();
    // Snapping a walked pentagon that is not on the lattice would wreck it on
    // the first drag, so follow what was actually taken.
    setSnapFromPoints();
    syncPreset();
    redraw();
};
// A scrollable box, not a pair of buttons. Jake, 2026-11-25: *the bottom line
// will contain the extrapolate and gen functionality... two fields with
// scrollable values. Again, much like the I, lambda and phi fields of the
// reticulum.* `bindScroll` is that gesture set, shared with the panel's row.
if (rungOutValue) bindScroll(rungOutValue, (by) => stepExtrapolate(by * 0.5));

// ── the output's viewport ─────────────────────────────────────────────────

/**
 * Where a canvas point sits, in the tiling's own coordinates.
 * @param {number} sx
 * @param {number} sy
 * @returns {[number, number]}
 */
function toWorld(sx, sy) {
    const k = fit.k0 * view.zoom;
    return [(sx - (fit.w / 2 - fit.mx * k + view.panX)) / k,
            (sy - (fit.h / 2 - fit.my * k + view.panY)) / k];
}

/**
 * Zoom about a canvas point, so whatever is under the pointer stays there.
 * @param {number} sx
 * @param {number} sy
 * @param {number} factor
 */
function zoomAt(sx, sy, factor) {
    const [wx, wy] = toWorld(sx, sy);
    view.zoom = Math.min(120, Math.max(0.2, view.zoom * factor));
    const k = fit.k0 * view.zoom;
    view.panX = sx - wx * k - fit.w / 2 + fit.mx * k;
    view.panY = sy - wy * k - fit.h / 2 + fit.my * k;
    drawTiling();
}

/**
 * Canvas coordinates of a pointer event.
 * @param {HTMLCanvasElement} c
 * @param {{ clientX: number, clientY: number }} ev
 * @returns {[number, number]}
 */
function atCanvas(c, ev) {
    const r = c.getBoundingClientRect();
    return [(ev.clientX - r.left) * (c.width / r.width),
            (ev.clientY - r.top) * (c.height / r.height)];
}

const resetView = () => {
    view.zoom = 1; view.panX = 0; view.panY = 0;
    drawTiling();
};

if (outCanvas) {
    const c = outCanvas;
    c.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const [sx, sy] = atCanvas(c, ev);
        zoomAt(sx, sy, Math.exp(-(ev.deltaY ?? 0) * 0.0015));
    }, { passive: false });

    c.addEventListener("pointerdown", (ev) => {
        panning = true;
        panFrom = atCanvas(c, ev);
        c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener("pointermove", (ev) => {
        if (!panning) return;
        const [sx, sy] = atCanvas(c, ev);
        view.panX += sx - panFrom[0];
        view.panY += sy - panFrom[1];
        panFrom = [sx, sy];
        drawTiling();
    });
    const endPan = () => { panning = false; };
    c.addEventListener("pointerup", endPan);
    c.addEventListener("pointercancel", endPan);
    c.addEventListener("dblclick", resetView);
}

const fitBtn = byId("boot-fit");
if (fitBtn) fitBtn.addEventListener("click", resetView);

// ── face and edge style: one pair per canvas ────────────────────────────────
//
// Each pair redraws ITS OWN canvas and nothing else, which is the point of the
// split -- `redraw()` here would have kept the two coupled by the back door.

const facePick = /** @type {HTMLSelectElement | null} */ (byId("boot-face"));
if (facePick) facePick.addEventListener("change", () => {
    const v = /** @type {Face} */ (facePick.value);
    if (FACES.includes(v)) seedFace = v;
    drawInput();
});

const edgePick = /** @type {HTMLSelectElement | null} */ (byId("boot-edge"));
if (edgePick) edgePick.addEventListener("change", () => {
    const v = /** @type {Edge} */ (edgePick.value);
    if (EDGES.includes(v)) seedEdge = v;
    drawInput();
});

const tileFacePick = /** @type {HTMLSelectElement | null} */ (byId("boot-tile-face"));
if (tileFacePick) tileFacePick.addEventListener("change", () => {
    const v = /** @type {Face} */ (tileFacePick.value);
    if (FACES.includes(v)) tileFace = v;
    drawTiling();
});

const tileEdgePick = /** @type {HTMLSelectElement | null} */ (byId("boot-tile-edge"));
if (tileEdgePick) tileEdgePick.addEventListener("change", () => {
    const v = /** @type {Edge} */ (tileEdgePick.value);
    if (EDGES.includes(v)) tileEdge = v;
    drawTiling();
});

// heads/tails has no control: it decides a rhomb's ridges from its valleys, and
// there is nothing on this page that shows a fold. The parity is still carried
// on every Placement, so a page that wants it has it.

for (let f = 0; f < 5; f++)
    byId(`boot-fifths-${f}`)?.addEventListener("change", () => {
        fifths = f;
        drawTiling();
    });

/** @type {readonly [string, boolean][]} */
const UP_DOWN = [["boot-up", false], ["boot-down", true]];
for (const [id, v] of UP_DOWN)
    byId(id)?.addEventListener("change", () => { isDown = v; drawTiling(); });

/**
 * Keep the preset picker honest. Once the five have been dragged or adopted they
 * are usually no longer either preset, and leaving the old name selected meant
 * having to toggle away and back to reload one.
 *
 * `presetName` is the comparison, in `src/math/seed.js`, because the floating
 * panel's title bar needs the same answer and a seed's own name is the seed's
 * business.
 */
function syncPreset() {
    const now = presetName(seedNow());
    for (const [name, b] of presetBtns)
        b.className = name === now ? "pd-preset on" : "pd-preset";
    // Both title bars name the seed: the panel's, and the anchored one, which
    // is the same line in the same place.
    showSeedBar();
    // And a preset loaded from this page is a seed the panel has not heard
    // about yet.
    pushSeed();
}

/**
 * Follow the figure: snap to whatever the points are already on. Anything
 * coarser than they are would wreck them on the first drag, which is what makes
 * this worth doing automatically rather than leaving to the control.
 *
 * The box itself is set by `syncBoxes` off the next draw, so there is one place
 * that decides what it reads.
 */
function setSnapFromPoints() {
    snap = snapForSeed(seedNow());
}

// ── the grid, centroid and display boxes ──────────────────────────────
//
// Six checkboxes in three sections, to Jake's spec of 2026-11-24. Four of them
// are set from the figure on every draw rather than from a variable here --
// `syncBoxes`, below, and `gridBoxes` in the component, which is what decides.

const snapBox = /** @type {HTMLInputElement | null} */ (byId("boot-snap"));
if (snapBox) snapBox.addEventListener("change", () => {
    snap = snapBox.checked ? "units" : "none";
    // Pushed through to the component, which is what owns the pointer: the
    // view only reaches it on a `sync`, so without this the next drag would
    // still be snapping the way the last draw was told to.
    drawInput();
});

const fineBox = /** @type {HTMLInputElement | null} */ (byId("boot-fine"));
if (fineBox) fineBox.addEventListener("change", () => {
    inputFifths = fineBox.checked;
    drawInput();
});

/**
 * `centroid actual`: put the center on the centroid of the five, which is the
 * one place the three rhomb spellings agree and all of them close as exact
 * parallelograms. It is a fifth of a lattice unit, never an integer unless the
 * five sum to a multiple of five -- and `units` snap already moves the center
 * in fifths, so the figure stays on its snap and the center stays draggable
 * from there. The center draws as a bullseye once it is on it.
 *
 * The box grays itself once the center is there, which is both the readout and
 * the no-op: there is no "move the center OFF the centroid", because there is
 * nowhere in particular for that to mean.
 */
const actualBox = /** @type {HTMLInputElement | null} */ (byId("boot-actual"));
if (actualBox) actualBox.addEventListener("change", () => {
    origin = centroid();
    setSnapFromPoints();
    refitInput();
    syncPreset();
    redraw();
});

/**
 * `centroid closest`: the centroid rounded to the nearest whole unit.
 *
 * The other half of the choice §8 forces on an odd pentad. `actual` buys exact
 * parallelograms and pays with a non-integral origin, which takes every derived
 * wheel off the lattice; this buys integral spokes and pays with an origin up
 * to (1/2, 1/2) off the centroid. On an EVEN pentad the two are the same point,
 * both boxes gray out together, and there was nothing to choose.
 *
 * It also turns `fine` off -- Jake: *Fine checkbox will be reset* -- because
 * getting the center back onto a unit is the entire point of pressing it, and
 * the fifths have nothing left to say once it is.
 */
const closestBox = /** @type {HTMLInputElement | null} */ (byId("boot-closest"));
if (closestBox) closestBox.addEventListener("change", () => {
    origin = integralCentroid(points);
    inputFifths = false;
    setSnapFromPoints();
    refitInput();
    syncPreset();
    redraw();
});

/**
 * Set the six boxes from the draw that just happened.
 *
 * Four of them are facts about the figure, not settings: whether the center is
 * on the centroid, on the nearest unit to it, and whether the fine grid is
 * being forced on because the center is off a unit or on its way off one. The
 * component works all of that out in `gridBoxes` and hands it back with the
 * draw, so the row cannot disagree with the canvas above it.
 * @param {import("./pentadiculum.js").Drawn} drawn
 */
function syncBoxes(drawn) {
    if (snapBox) setBox(snapBox, drawn.boxes.snap);
    if (fineBox) setBox(fineBox, drawn.boxes.fine);
    if (actualBox) setBox(actualBox, drawn.boxes.actual);
    if (closestBox) setBox(closestBox, drawn.boxes.closest);
}

// ── the presets, as a row of buttons ─────────────────────────────────────
//
// Jake, 2026-11-24: *preset on pentadiculum can behave like reticulum: button
// with choices under.* One button per choice, built from `PRESETS` so the page
// cannot list a preset the library does not have -- which the hand-written
// `<option>` list could and did, since it also carried a `custom` that was
// never a preset at all. `custom` is now the absence of a current button.

/** The last preset actually chosen, which is what `reset` reloads. */
let chosen = "quadrille";
/** @type {Map<string, HTMLButtonElement>} */
const presetBtns = new Map();
const presetHost = byId("boot-presets");
if (presetHost) {
    for (const name of Object.keys(PRESETS)) {
        const b = document.createElement("button");
        b.className = "pd-preset";
        b.textContent = presetLabel(name);
        b.title = `load the ${presetLabel(name)} pentagon`;
        b.addEventListener("click", () => loadPreset(name));
        presetBtns.set(name, b);
        presetHost.appendChild(b);
    }
}

/** @type {(name: string) => void} */
const loadPreset = (name) => {
    const preset = PRESETS[name];
    if (!preset) return;
    chosen = name;
    points = preset.map((p) => /** @type {Pt} */ ([p[0], p[1]]));
    // A preset is five vectors from the origin, so loading one puts the origin
    // back where those vectors are measured from.
    origin = [0, 0];
    // A preset is a fresh start, so the extrapolation goes back to the five and
    // the figure is framed afresh.
    extrapolate = 0;
    refitInput();
    showExtrapolate();
    // Snap follows whether the points are actually on the lattice, not the
    // preset's name -- the box stays the user's to override afterwards.
    setSnapFromPoints();
    redraw();
};

const genOut = byId("boot-order");
/**
 * The slider stops at 6, but what actually matters is the tile COUNT, and that
 * depends on the seed as much as the generation: at generation 5 a Pe5 is 12,161
 * tiles and a Sun is 42,376. Capping the generation alone let the Sun through at
 * half a second a redraw, which locks the tab.
 *
 * So the generation is clamped down until the count is drawable, and the note
 * says when that has happened rather than silently ignoring the control.
 */
const MAX_GEN = 6;
const TILE_LIMIT = 15000;

/**
 * How many tiles a generation holds, remembered.
 *
 * The count is a property of the seed type and the generation alone -- the
 * tenth is a rotation and `heads` is a parity, and neither adds or removes a
 * tile -- so it is the same answer every redraw, and `tests/patch.test.mjs`
 * holds it to that. Worth remembering because the answer at order 6 costs
 * 313ms to work out and the page asks for it on every draw.
 * @type {Map<string, number>}
 */
const COUNTS = new Map();
/** @type {(g: number, ladder: readonly WheelSet[]) => number} */
const countAt = (g, ladder) => {
    const key = `${seed}:${g}`;
    let n = COUNTS.get(key);
    if (n === undefined) {
        n = expand(seed, 0, [0, 0], g, ladder, true).length;
        COUNTS.set(key, n);
    }
    return n;
};
/** @type {(by: number) => void} */
const stepGen = (by) => {
    const next = Math.min(MAX_GEN, Math.max(0, gen + by));
    if (next === gen) return;
    gen = next;
    showGen();
    drawTiling();
    // The panel's own `order` box is the same number, so it has to hear it.
    seedFloat?.update(viewNow());
};
/** Put the order on its box, wherever the instrument currently is. */
function showGen() {
    if (genOut) genOut.textContent = String(gen);
}
// `order`, on the instrument's bottom line rather than in the output's column.
// Jake, 2026-11-25: *we're going to move the gen functionality to the
// pentadiculum from the output.* The number still belongs to the patch; the
// control belongs beside the figure the patch is grown from.
if (genOut) bindScroll(genOut, stepGen);

// The two dropdown buttons, the Reticulum's pattern -- one open at a time, and
// pressing the open one folds it. The behavior is `bindDrops`, shared with the
// panel so the column and the panel cannot grow different ideas about it.
{
    const presetsBtn = byId("boot-presets-btn");
    const presetsDrop = byId("boot-presets-drop");
    const settingsBtn = byId("boot-settings-btn");
    const settingsDrop = byId("boot-settings-drop");
    if (presetsBtn && presetsDrop && settingsBtn && settingsDrop)
        bindDrops([[presetsBtn, presetsDrop], [settingsBtn, settingsDrop]]);
}

const seedPick = /** @type {HTMLSelectElement | null} */ (byId("boot-seed"));
if (seedPick) seedPick.addEventListener("change", () => {
    // A stub DOM, or a stale option, can hand back something that is not a seed.
    // Letting it through used to reach the tile walk as `undefined` and blank the
    // canvas with no error anywhere but the console.
    if (isSeedType(seedPick.value)) seed = seedPick.value;
    drawTiling();
});

/** @type {readonly ("none" | "little" | "big")[]} */
const RHOMB_SIZES = ["none", "little", "big"];
for (const size of RHOMB_SIZES) {
    byId(`boot-rhomb-${size}`)?.addEventListener("change", () => {
        rhombSize = size;
        drawTiling();
    });
}

/** @type {readonly RhombMode[]} */
const SPELLINGS = ["classic", "centroid", "t", "inflated"];
const rhombFacePick = /** @type {HTMLSelectElement | null} */ (byId("boot-rhomb-face"));
if (rhombFacePick) rhombFacePick.addEventListener("change", () => {
    const v = /** @type {Face} */ (rhombFacePick.value);
    if (FACES.includes(v)) rhombFace = v;
    drawTiling();
});

const rhombEdgePick = /** @type {HTMLSelectElement | null} */ (byId("boot-rhomb-edge"));
if (rhombEdgePick) rhombEdgePick.addEventListener("change", () => {
    const v = /** @type {Edge} */ (rhombEdgePick.value);
    if (EDGES.includes(v)) rhombEdge = v;
    drawTiling();
});

const spellPick = /** @type {HTMLSelectElement | null} */ (byId("boot-spelling"));
if (spellPick) spellPick.addEventListener("change", () => {
    const v = /** @type {RhombMode} */ (spellPick.value);
    if (SPELLINGS.includes(v)) spelling = v;
    drawTiling();
});

const gridFifthsBox = /** @type {HTMLInputElement | null} */ (byId("boot-grid-fifths"));
if (gridFifthsBox) gridFifthsBox.addEventListener("change", () => {
    gridFifths = gridFifthsBox.checked;
    drawTiling();
});

const gridOverBox = /** @type {HTMLInputElement | null} */ (byId("boot-grid-over"));
if (gridOverBox) gridOverBox.addEventListener("change", () => {
    gridOver = gridOverBox.checked;
    drawTiling();
});

const vectorBox = /** @type {HTMLInputElement | null} */ (byId("boot-vectors"));
if (vectorBox) vectorBox.addEventListener("change", () => {
    showVectors = vectorBox.checked;
    drawInput();
});

const resetBtn = byId("boot-reset");
if (resetBtn) resetBtn.addEventListener("click", () => loadPreset(chosen));

// ── the seed, floating ────────────────────────────────────────────────────
//
// Jake, 2026-11-24: *what is the plan you have to make the Pentadiculum float?
// Kind of like the reticulum I guess, on the right of the diagram? Preset name
// in the header.* An ALTERNATIVE and not a replacement: pressing `seed` folds
// this page's own seed column away, gives the output the whole width, and the
// instrument comes back as a panel over the output's top-right corner. Pressing
// it again, or closing the panel, puts the column back. The panel remembers
// that it was open, so it is a preference rather than a mode.
//
// The panel is a COMPLETE instrument -- its own preset, ladder, grid, centroid
// and display rows -- because the column it replaces had all of those. What it
// does not carry is the input figure's `face` and `edges`, which are this page's
// business rather than the seed's; they keep whatever they were set to and the
// fold that sets them comes back with the column.

/** The panel's width, needed before it exists to place it by its right edge. */
const SEED_PANEL_W = 372;

/** @type {ReturnType<typeof mountFloatingPentadiculum> | null} */
let seedFloat = null;
const rigEl = byId("boot-rig");

/** Are these the same seed? The guard that keeps the page and the panel from
 *  telling each other about a move neither of them made.
 *  @type {(a: Seed, b: Seed) => boolean} */
const sameSeed = (a, b) =>
    a.points.length === b.points.length
    && a.points.every((p, i) => Math.abs(p[0] - b.points[i][0]) < 1e-12
                             && Math.abs(p[1] - b.points[i][1]) < 1e-12)
    && Math.abs(a.origin[0] - b.origin[0]) < 1e-12
    && Math.abs(a.origin[1] - b.origin[1]) < 1e-12;

/**
 * Where the panel opens: the OUTPUT's top-right corner, inset, rather than the
 * viewport's.
 *
 * Jake's choice, and the right one -- the panel is `position: fixed`, so the
 * viewport's corner is wherever you have scrolled to, while the output is the
 * thing the panel is meant to sit beside. Measured when it opens, which is when
 * you are looking at the output. A remembered place wins over this.
 * @returns {[number, number]}
 */
function seedFloatAt() {
    const r = outCanvas?.getBoundingClientRect?.();
    // Its own width, once it has one: the grip may have made it wider than the
    // default, and the panel is being placed by its RIGHT edge.
    const w = seedFloat?.width() ?? SEED_PANEL_W;
    if (!r || !r.width) return [24, 24];
    return [Math.max(12, r.right - w - 14), Math.max(12, r.top + 14)];
}

/**
 * Take the panel's settings as the page's own.
 *
 * The page and the panel show the same six settings, and whichever row you
 * touched is the one that is right. `drawInput` then puts them back on the
 * column's controls, so flipping the instrument from one place to the other
 * carries everything with it.
 * @param {import("./pentadiculum.js").View} v
 */
function adoptView(v) {
    if (v.snap) snap = v.snap;
    if (typeof v.fifths === "boolean") inputFifths = v.fifths;
    if (typeof v.vectors === "boolean") showVectors = v.vectors;
    if (v.face) seedFace = v.face;
    if (v.edge) seedEdge = v.edge;
    // `order` is the output's generation, which the instrument now holds. It is
    // the one setting in here that the INPUT does not draw, so it gets its own
    // redraw rather than riding on `drawInput` below.
    let orderMoved = false;
    if (typeof v.order === "number" && v.order !== gen) {
        gen = Math.min(MAX_GEN, Math.max(0, v.order));
        showGen();
        orderMoved = true;
    }
    // The column's own controls are set from the draw, so this is also what
    // puts the checkboxes and the two dropdowns where the panel left them.
    if (facePick) facePick.value = seedFace;
    if (edgePick) edgePick.value = seedEdge;
    drawInput();
    if (orderMoved) drawTiling();
}

/** Hand the panel the seed the page is holding, if it is not already on it. */
function pushSeed() {
    if (!seedFloat || !seedFloat.isOpen()) return;
    if (sameSeed(seedFloat.seed(), seedNow())) { seedFloat.rename(); return; }
    seedFloat.set(seedNow());
}

/**
 * Two places for one instrument: the left column, or a floating panel.
 *
 * Jake, 2026-11-24: *I either want to see it in the left column, or floating.
 * The output column should remain on the left.* So this is a toggle between two
 * states and not a second copy of anything -- when it floats, the seed column
 * is gone from the grid entirely and the output starts at the left margin,
 * which is what `1fr` instead of `auto 1fr` is for.
 *
 * The button that drives it lives directly ABOVE the instrument, because that
 * is where you look for it. It was under the output, which is not: *I see no
 * way to make it float.*
 * @type {(on: boolean) => void}
 */
function floatSeed(on) {
    // The fold comes FIRST, and this is the whole reason the order matters: the
    // panel is placed against the output's right edge, and dropping the seed
    // column moves that edge. `getBoundingClientRect` below forces the layout,
    // so the measurement is of the page as it will be, not as it was.
    rigEl?.classList.toggle("solo", on);
    if (!on) {
        seedFloat?.hide();
        showSeedBar();
        drawInput();
        drawTiling();
        return;
    }
    if (seedFloat) {
        seedFloat.update(viewNow());
        seedFloat.set(seedNow());
        seedFloat.show(true);
    } else {
        seedFloat = mountFloatingPentadiculum({
            id: "boot-float",
            title: "pentadiculum",
            width: SEED_PANEL_W,
            at: seedFloatAt(),
            seed: seedNow(),
            // The page's whole view, so the panel opens showing exactly what
            // the column was showing.
            view: viewNow(),
            // A drag in the panel is a drag on the seed. The guard matters:
            // without it the push below would come straight back as a change
            // and the two would redraw each other.
            onChange: (next) => {
                if (sameSeed(next, seedNow())) return;
                points = next.points.map((q) => /** @type {Pt} */ ([q[0], q[1]]));
                origin = next.origin;
                // The panel's extrapolate row walks the seed, so a step there
                // arrives HERE, as a new figure of a different size: refit, and
                // let the column's own counter go back to 0, because the walk
                // was measured in the panel and not from this figure.
                extrapolate = 0;
                showExtrapolate();
                refitInput();
                setSnapFromPoints();
                syncPreset();
                redraw();
            },
            // Every setting in the panel's row is one this page also keeps,
            // so the page takes the panel's answer rather than holding a second
            // opinion. Jake, 2026-11-24: *floating settings don't match with
            // anchored when I flip back and forth.* They were two sets of
            // variables; now there is one, and the panel's row is a view onto
            // it exactly as the column's row is.
            onViewChange: (v) => adoptView(v),
            onClose: () => floatSeed(false),
        });
    }
    showSeedBar();
    // The folded-away input canvas still feeds the readouts under the rig and
    // the status under the bar, so it is drawn either way.
    drawInput();
    drawTiling();
}

// One button for two states, above the instrument, with the fold marker the
// `settings` fold already uses on this page: open is the column, folded is the
// panel.
//
// `boot-float`, and NOT `boot-seed`: that id was already the patch picker's, so
// `byId("boot-seed")` handed this the `<select>` and the button was never wired
// at all. Jake: *seed button does nothing.* It was two bugs wearing one coat --
// a cached module, and this.
const seedBtn = byId("boot-float");
if (seedBtn) seedBtn.addEventListener("click", () =>
    floatSeed(!(seedFloat?.isOpen() ?? false)));

if (genOut) genOut.textContent = String(gen);
showExtrapolate();
showSeedBar();
redraw();

// The build stamp goes ON THE PAGE, in the top nav, as well as to the console.
// Jake, 2026-11-24: *the whole idea is to write it on the page so we can
// eliminate this argument from day one.* A console line settles "am I looking
// at a stale script?" only for whoever has the console open, and the answer was
// a cached module both times it came up.
const buildTag = byId("boot-build");
if (buildTag) buildTag.textContent = `build ${BUILD_ID}`;
console.log(`by-your-bootstraps — build id ${BUILD_ID}`);
