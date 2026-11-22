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
    PENTA_UP, PRESETS, centroidOf, eWheel, inflate, ladderTo, m10,
    pentaflake, sharedEdge, spokesOf, wheelFromPoints, wheelsAt,
} from "../../lib/wheels.js";
import { pentagon, rhombGroup, rhombus } from "../../lib/tiles.js";
import { expand, isSeedType, outlineOf } from "../../lib/patch.js";
import { BUILD_ID } from "./build-id.js";

/** @typedef {import("../../lib/wheels.js").Pt} Pt */
/** @typedef {import("../../lib/wheels.js").Wheel} Wheel */
/** @typedef {import("../../lib/tiles.js").Spelling} Spelling */
/** @typedef {import("../../lib/patch.js").Placement} Placement */
/** @typedef {import("../../lib/patch.js").SeedType} SeedType */
/** @typedef {import("./pentadiculum.js").Seed} Seed */
/** @typedef {import("./pentadiculum.js").Snap} Snap */

import { EDGE_INK, HOT, INK, TAU, gridLines, paper, poly } from "./draw.js";
import { numHTML } from "./numerals.js";
// The input figure itself -- the five points, the origin and the pointer --
// lives in the Pentadiculum. See the section below.
import { SNAPS, createPentadiculum, snapForSeed } from "./pentadiculum.js";

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
 * One pair of controls, on the input panel, governs BOTH canvases: the input
 * pentagon is a face like any other, and having two sets that could disagree was
 * the kind of thing nobody would keep in step. `face: "none"` is what used to be
 * a separate "show pentas" checkbox.
 *
 * @typedef {"none" | "transparent" | "solid"} Face
 */
/** @typedef {"none" | "thin" | "thick"} Edge */
/** @type {Face} */
let face = "solid";
/** @type {Edge} */
let edge = "thin";
/** The rhomb overlay's own face and edge, same vocabulary. @type {Face} */
let rhombFace = "none";
/** @type {Edge} */
let rhombEdge = "thin";
/** @type {(k: number) => number} */
const edgeWidth = (k) =>
    edge === "thick" ? Math.max(1.4, k * 0.12) : Math.max(0.4, k * 0.06);
/** @type {readonly Face[]} */
const FACES = ["none", "transparent", "solid"];
/** @type {readonly Edge[]} */
const EDGES = ["none", "thin", "thick"];

/**
 * How far the input figure is extrapolated from the five points, in half
 * generations. 0 is the five themselves; the wheel ladder calls that rung 1.
 */
let extrapolate = 0;
/** @type {(e: number) => number} */
const rungOf = (e) => 1 + e;
/**
 * What the input's handles snap to.
 *
 * It was a checkbox, and the centroid is what made it a dropdown: the sweet
 * spot lands in (1/5)Z^2 and never on an integer unless the five happen to sum
 * to a multiple of five, so "on the lattice or nowhere" could not express it.
 * With `fifths` the origin can be dragged ALONG the fence and landed exactly on
 * the centroid by hand. `none` is for the real preset, whose corners are
 * irrational and would be wrecked by rounding — it still quantizes, at 1/256,
 * because a pointer has pixels and a coordinate that reads to sixteen places is
 * not a coordinate anyone can use. The rounding itself is the Pentadiculum's --
 * it owns the pointer -- and this is only which mode the dropdown is on.
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
const viewNow = () => ({ extrapolate, face, edge, vectors: showVectors, snap });

const pd = createPentadiculum({
    canvas: inputCanvas ?? undefined,
    cell: CELL,
    // A drag has made a new seed, and the component has already drawn it. Take
    // it, keep the preset picker honest, and bring the rest of the page along.
    onChange: (next) => {
        points = next.points.map((p) => /** @type {Pt} */ ([p[0], p[1]]));
        origin = next.origin;
        syncPreset();
        readouts(pd.drawn());
        drawFlake();
        drawTiling();
    },
});

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
    report(eWheel(wheelFromPoints(spokes())));

    const rungOut = byId("boot-rung-read");
    if (!rungOut) return;
    const d = wheelsAt(spokes(), rungOf(extrapolate)).d;
    rungOut.innerHTML = `<b>extrapolate ${extrapolate > 0 ? "+" : ""}${extrapolate}`
        + ` &middot; wheel generation ${rungOf(extrapolate)}</b>`
        + `<span>${d.slice(0, 3).map((v) => `(${numHTML(v[0])}, ${numHTML(v[1])})`).join("  ")}</span>`
        + (atBaseRung() ? "" : "<b>the five, for reference</b>"
            + `<span>${points.map((v) => `(${numHTML(v[0])}, ${numHTML(v[1])})`).join("  ")}</span>`)
        + `<b>origin (${numHTML(origin[0])}, ${numHTML(origin[1])})`
            + ` &middot; centroid (${numHTML(centroid()[0])}, ${numHTML(centroid()[1])})</b>`
        + `<span>${drawn.verdict.ok ? "the ten spokes are in order"
            : `&#9888; ${drawn.verdict.why}`}</span>`;
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
    let drawnGen = gen;
    try {
        tiles = expand(seed, seedTenth(), [0, 0], gen, ladder, heads);
        while (tiles.length > TILE_LIMIT && drawnGen > 1) {
            drawnGen -= 1;
            tiles = expand(seed, seedTenth(), [0, 0], drawnGen, ladder, heads);
        }
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
    // canvases read as the same sheet.
    paper(ctx, w, h, cx, cy, k);

    ctx.lineJoin = "round";
    ctx.lineWidth = edgeWidth(k);
    for (const o of (face === "none" && edge === "none") ? [] : outlines) {
        const color = FILL[o.type] ?? "#999";
        poly(ctx, o.pts, cx, cy, k);
        if (face !== "none") {
            ctx.globalAlpha = face === "transparent" ? 0.42 : 1;
            ctx.fillStyle = color;
            ctx.fill("evenodd");          // NOT nonzero -- see Face
            ctx.globalAlpha = 1;
        }
        if (edge !== "none") {
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
    // at the same scale and the same origin, as a veil.
    if (gridOver) gridLines(ctx, w, h, cx, cy, k, 0.75);

    note(`${tiles.length} tiles · generation ${drawnGen}`
        + (drawnGen === gen ? "" : ` (${gen} asked, capped at ${TILE_LIMIT} tiles)`)
        + ` · ${seed}`
        + (rhombSize === "none" ? "" : ` · ${rhombSize} rhombs on ${hostCount}`)
        + (view.zoom === 1 ? "" : ` · ${view.zoom.toFixed(1)}×`)
        + (gridOver ? " · grid on top" : ""));
}

/** @type {(s: string) => void} */
const note = (s) => {
    const el = byId("boot-note");
    if (el) el.textContent = s;
};

// ── readouts ──────────────────────────────────────────────────────────────

const atBaseRung = () => extrapolate === 0;

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

const rungOutValue = byId("boot-extrapolate-value");
/** Show the current extrapolation, signed, so +0.5 and -0.5 read differently. */
function showExtrapolate() {
    if (rungOutValue)
        rungOutValue.textContent = extrapolate > 0 ? `+${extrapolate}` : String(extrapolate);
}
/** Steps of a HALF generation, because a generation is phi^2 and phi is the half.
 *  @type {(by: number) => void} */
const stepExtrapolate = (by) => {
    extrapolate = Math.min(6, Math.max(-4, extrapolate + by));
    showExtrapolate();
    // A rung is a different figure at a different size, so frame it afresh.
    refitInput();
    drawInput();
};
byId("boot-extrapolate-down")?.addEventListener("click", () => stepExtrapolate(-0.5));
byId("boot-extrapolate-up")?.addEventListener("click", () => stepExtrapolate(0.5));

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

// ── face and edge style, which govern both canvases ───────────────────────

const facePick = /** @type {HTMLSelectElement | null} */ (byId("boot-face"));
if (facePick) facePick.addEventListener("change", () => {
    const v = /** @type {Face} */ (facePick.value);
    if (FACES.includes(v)) face = v;
    redraw();
});

const edgePick = /** @type {HTMLSelectElement | null} */ (byId("boot-edge"));
if (edgePick) edgePick.addEventListener("change", () => {
    const v = /** @type {Edge} */ (edgePick.value);
    if (EDGES.includes(v)) edge = v;
    redraw();
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
 * Adopt the pentagon currently shown on the input figure as the new five.
 *
 * Derived rungs are real pentagons in their own right, so the ladder is a
 * generator and not only a view: walk to a rung, take it, and carry on from
 * there. Re-basing is exact — the adopted five read back at rung 1 give exactly
 * the wheel they were taken from, at every rung and on every preset.
 *
 * One caveat, recorded because it will look like a bug otherwise: stepping on
 * from an adopted pentagon lands on `taken + then − 1` of the original ladder
 * **unless both the adoption and the step are half rungs**, on an *irregular*
 * pentagon. Then it composes `halfUp` twice, which is not one generation.
 *
 * That it depends on regularity is the interesting part. `halfUp²` and `inflate`
 * are genuinely different operators, but `2cos72° + 2 = 1 + 2cos36° = φ²`, so on
 * a regular wheel both scale by φ² and agree exactly; on the quadrille they
 * cannot, and differ by My's λ = −1 term. The gap belongs to the geometry, not
 * to the operators — which is also why `wheelsAt` anchors every rung on the seed
 * rather than composing half steps.
 */
const useShown = () => {
    const taken = pentagon(wheelsAt(spokes(), rungOf(extrapolate)).d, 0);
    // `taken` is in spoke coordinates, so put it back on the paper where it is
    // being shown -- adopting it must not teleport the figure to the origin.
    points = taken.map((p) =>
        /** @type {Pt} */ ([p[0] + origin[0], p[1] + origin[1]]));
    extrapolate = 0;
    refitInput();
    showExtrapolate();
    // Snapping an adopted pentagon that is not on the lattice would wreck it on
    // the first drag, so follow what was actually taken.
    setSnapFromPoints();
    syncPreset();
    redraw();
};

const useBtn = byId("boot-use");
if (useBtn) useBtn.addEventListener("click", useShown);

const snapPick = /** @type {HTMLSelectElement | null} */ (byId("boot-snap"));
/**
 * Keep the preset picker honest. Once the five have been dragged or adopted they
 * are usually no longer either preset, and leaving the old name selected meant
 * having to toggle away and back to reload one.
 */
function syncPreset() {
    if (!presetPick) return;
    // Compared on the SPOKES, not the points: a preset is five vectors, and a
    // pentagon slid away from the origin is no longer that preset even though
    // its five corners still trace the same shape.
    const now = spokes();
    /** @type {(a: readonly Pt[]) => boolean} */
    const same = (a) =>
        a.length === now.length
        && a.every((v, i) => Math.abs(v[0] - now[i][0]) < 1e-9
                          && Math.abs(v[1] - now[i][1]) < 1e-9);
    for (const [name, preset] of Object.entries(PRESETS))
        if (same(preset)) { presetPick.value = name; return; }
    presetPick.value = "custom";
}

/**
 * Follow the figure: snap to whatever the points are already on. Anything
 * coarser than they are would wreck them on the first drag, which is what makes
 * this worth doing automatically rather than leaving to the control.
 */
function setSnapFromPoints() {
    snap = snapForSeed(seedNow());
    if (snapPick) snapPick.value = snap;
}
if (snapPick) snapPick.addEventListener("change", () => {
    const v = /** @type {Snap} */ (snapPick.value);
    if (SNAPS.includes(v)) snap = v;
    // Pushed through to the component, which is what owns the pointer: the
    // view only reaches it on a `sync`, so without this the next drag would
    // still be snapping the way the last draw was told to.
    drawInput();
});

const presetPick = /** @type {HTMLSelectElement | null} */ (byId("boot-preset"));
/** @type {(name: string) => void} */
const loadPreset = (name) => {
    const preset = PRESETS[name];
    if (!preset) return;                    // "custom" is a label, not a preset
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
if (presetPick) presetPick.addEventListener("change", () => loadPreset(presetPick.value));

const genOut = byId("boot-gen-value");
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
/** @type {(by: number) => void} */
const stepGen = (by) => {
    gen = Math.min(MAX_GEN, Math.max(0, gen + by));
    if (genOut) genOut.textContent = String(gen);
    drawTiling();
};
byId("boot-gen-down")?.addEventListener("click", () => stepGen(-1));
byId("boot-gen-up")?.addEventListener("click", () => stepGen(1));

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

/**
 * Put the origin on the centroid of the five, which is the one place the three
 * rhomb spellings agree and all of them close as exact parallelograms. It is a
 * fifth of a lattice unit, never an integer unless the five happen to sum to a
 * multiple of five — so snap drops to `fifths` with it, which is exactly the
 * grid the centroid lives on and leaves the origin draggable from there.
 */
const centroidBtn = byId("boot-centroid");
if (centroidBtn) centroidBtn.addEventListener("click", () => {
    origin = centroid();
    setSnapFromPoints();
    refitInput();
    syncPreset();
    redraw();
});

const resetBtn = byId("boot-reset");
if (resetBtn) resetBtn.addEventListener("click", () =>
    loadPreset(presetPick?.value ?? "quadrille"));

if (genOut) genOut.textContent = String(gen);
showExtrapolate();
redraw();
console.log(`by-your-bootstraps — build id ${BUILD_ID}`);
