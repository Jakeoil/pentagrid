// by-your-bootstraps: five ordered points in, a Penrose tiling out.
//
// The figure on the left is the input — five draggable lattice points and the
// pentagon they close. Everything on the right is derived from them: the four
// wheels, the tile outlines, and whichever patch is chosen. Move a point and
// the whole tiling follows, because nothing downstream holds a coordinate.

import { PENTA_UP, PRESETS, eWheel, inflate, ladderTo, m10, wheelFromPoints, wheelsAt,
         type Pt, type Wheel } from "./wheel.js";
import { pentagon, rhombGroup, rhombus, type Spelling } from "./walk.js";
import { expand, isSeedType, outlineOf, type Placement, type SeedType } from "./patch.js";
import { pentaflake, sharedEdge } from "./flake.js";
import { BUILD_ID } from "../build-id.js";

const GRID = "#c8d8ef";
const GRID_BOLD = "#9fbde4";
const INK = "#2a3b6b";
const HOT = "#e63946";
const TAU = 2 * Math.PI;
const byId = (id: string) => document.getElementById(id);

/** Tile colors, penrose-mosaic's: blue Pe5, yellow Pe3, orange Pe1, blue stars. */
/**
 * penrose-mosaic has exactly three colors, and every blue is the same blue:
 * Pe5 and the whole star family share it. Three near-blues for St5/St3/St1 made
 * the output look as though the star types were different materials.
 */
const BLUE = "#3355cc", YELLOW = "#f2d13b", ORANGE = "#dd7722";
const FILL: Record<string, string> = {
    Pe5: BLUE, Pe3: YELLOW, Pe1: ORANGE,
    St5: BLUE, St3: BLUE, St1: BLUE,
};
/** Edges are black and the same weight everywhere, input and output alike. */
const EDGE_INK = "#111418";

let points: Pt[] = PENTA_UP.map((p) => [p[0], p[1]] as Pt);
let seed: SeedType = "Sun";
/** The patch's angle, as penrose-mosaic splits it: fifths plus an up/down bit. */
let fifths = 0;
let isDown = false;
/** Convex or concave aspect of the seed. Decides a rhomb's ridges and valleys. */
let heads = true;
const seedTenth = (): number => m10(fifths * 2 + (isDown ? 5 : 0));
let gen = 2;
let spelling: Spelling = "mixed";
/** none | little (generation 0) | big (generation 1). */
let rhombSize: "none" | "little" | "big" = "none";

/**
 * How a face is drawn — a face being one tile's polygon, pentagon or star.
 *
 * One pair of controls, on the input panel, governs BOTH canvases: the input
 * pentagon is a face like any other, and having two sets that could disagree was
 * the kind of thing nobody would keep in step. `face: "none"` is what used to be
 * a separate "show pentas" checkbox.
 */
type Face = "none" | "transparent" | "solid";
type Edge = "none" | "thin" | "thick";
let face: Face = "solid";
let edge: Edge = "thin";
/** The rhomb overlay's own face and edge, same vocabulary. */
let rhombFace: Face = "none";
let rhombEdge: Edge = "thin";
const edgeWidth = (k: number): number =>
    edge === "thick" ? Math.max(1.4, k * 0.12) : Math.max(0.4, k * 0.06);
const FACES: readonly Face[] = ["none", "transparent", "solid"];
const EDGES: readonly Edge[] = ["none", "thin", "thick"];

let dragging = -1;
/** The input figure's current scale, so dragging lands where the handles are. */
let inputScale = 26;
/**
 * How far the input figure is extrapolated from the five points, in half
 * generations. 0 is the five themselves; the wheel ladder calls that rung 1.
 */
let extrapolate = 0;
const rungOf = (e: number): number => 1 + e;
/** Snap the input's handles to the lattice. Off for the real preset. */
let snapToLattice = true;

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
let panning = false;
let panFrom: [number, number] = [0, 0];
/** The last automatic fit, so zoom can be anchored on the pointer. */
let fit = { k0: 1, mx: 0, my: 0, w: 1, h: 1 };

/**
 * Square graph paper, emphasized every 4th line, then every 20th (5x4), then
 * every 100th (20x5) — and the 100s include the axes through 0, so the origin
 * always reads.
 *
 * Each level is drawn over the last, so a line that is a multiple of 20 gets the
 * 20 color and a multiple of 100 the 100 color. The emphases stay subtle: the
 * grid is there to be counted on, not looked at.
 */
const GRID_LEVELS = [
    [1, "#dce7f6"],
    [4, "#c2d6ef"],
    [20, "#9dbde4"],
    [100, "#6f9bd4"],
] as const;

function paper(ctx: CanvasRenderingContext2D, w: number, h: number,
               cx: number, cy: number, cell: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
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
}

const poly = (ctx: CanvasRenderingContext2D, pts: readonly Pt[],
              cx: number, cy: number, k: number): void => {
    ctx.beginPath();
    pts.forEach((p, i) => {
        const x = cx + p[0] * k, y = cy + p[1] * k;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
};

// ── the input figure ──────────────────────────────────────────────────────

const inputCanvas = byId("boot-input") as HTMLCanvasElement | null;
const CELL = 26;

function drawInput(): void {
    if (!inputCanvas) return;
    const ctx = inputCanvas.getContext("2d");
    if (!ctx) return;
    const w = inputCanvas.width, h = inputCanvas.height;
    const cx = w / 2, cy = h / 2;
    const e = eWheel(wheelFromPoints(points));

    // The pentagon at the chosen rung, scaled so it fills the same frame however
    // far up or down the ladder it sits. At rung 1 this IS the five points.
    const shown = pentagon(wheelsAt(points, rungOf(extrapolate)).d, 0);
    const reach = Math.max(1, ...shown.map((v) => Math.hypot(v[0], v[1])),
                           ...points.map((v) => Math.hypot(v[0], v[1])));
    // Always fit, at every rung, with the paper drawn at the same scale.
    //
    // It used to hold a fixed cell size at extrapolate 0 and fit only elsewhere,
    // so stepping the ladder — and `use`, which returns to 0 — made the figure
    // jump between two unrelated scales. That was the irregularity on `use`.
    const atBase = extrapolate === 0;
    const k = Math.min((Math.min(w, h) * 0.40) / reach, CELL * 3);

    paper(ctx, w, h, cx, cy, k);
    inputScale = k;

    if (!atBase) {
        // The five, as a reference, so the ladder step is visible. Dashed and
        // neutral on purpose: drawn as a faint tint of the fill color it read
        // as a mysterious orange shadow of the pentagon rather than as a
        // deliberate guide.
        ctx.strokeStyle = "rgba(60,70,90,0.35)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        poly(ctx, points, cx, cy, k);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // The input polygon's own style: edges on or off, fill solid, transparent
    // or none. Separate from the output's — this is the pentagon being fed in,
    // not the tiling coming out.
    poly(ctx, shown, cx, cy, k);
    if (face !== "none") {
        ctx.globalAlpha = face === "transparent" ? 0.35 : 1;
        ctx.fillStyle = HOT;
        ctx.fill("evenodd");
        ctx.globalAlpha = 1;
    }
    if (edge !== "none") {
        ctx.strokeStyle = EDGE_INK;
        ctx.lineWidth = edge === "thick" ? 3 : 1.6;
        ctx.stroke();
    }

    // spokes to each corner, so the ordering is visible
    ctx.strokeStyle = "rgba(230,57,70,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of shown) { ctx.moveTo(cx, cy); ctx.lineTo(cx + p[0] * k, cy + p[1] * k); }
    ctx.stroke();

    // Handles only at rung 1: that is the rung the points live on, and dragging
    // a derived pentagon would have nothing to write back to.
    ctx.font = "600 11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Numbered and draggable only at extrapolate 0, where the five actually
    // live. An extrapolated pentagon is a view of them, not a thing to edit --
    // `use` is what turns one into the five, and then it numbers and drags like
    // any other.
    shown.forEach((p, i) => {
        const x = cx + p[0] * k, y = cy + p[1] * k;
        if (atBase) {
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

    // the origin
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();

    report(e);

    const rungOut = byId("boot-rung-read");
    if (rungOut) {
        const d = wheelsAt(points, rungOf(extrapolate)).d;
        rungOut.innerHTML = `<b>extrapolate ${extrapolate > 0 ? "+" : ""}${extrapolate}`
            + ` &middot; wheel generation ${rungOf(extrapolate)}</b>`
            + `<span>${d.slice(0, 3).map((v) => `(${num(v[0])}, ${num(v[1])})`).join("  ")}</span>`
            + (atBaseRung() ? "" : "<b>the five, for reference</b>"
                + `<span>${points.map((v) => `(${num(v[0])}, ${num(v[1])})`).join("  ")}</span>`);
    }
}

/**
 * Coordinates under the pointer, snapped to the lattice when `snapToLattice` is
 * on. It goes off with the real preset: rounding an irrational pentagon's
 * corners onto the paper on the first drag would silently turn it back into a
 * quadrille, which is the kind of thing that goes unnoticed for a week.
 */
function pick(ev: { clientX: number; clientY: number }): Pt {
    const r = inputCanvas!.getBoundingClientRect();
    const sx = inputCanvas!.width / r.width, sy = inputCanvas!.height / r.height;
    const x = ((ev.clientX - r.left) * sx - inputCanvas!.width / 2) / inputScale;
    const y = ((ev.clientY - r.top) * sy - inputCanvas!.height / 2) / inputScale;
    return snapToLattice ? [Math.round(x), Math.round(y)]
                         : [Math.round(x * 256) / 256, Math.round(y * 256) / 256];
}

// ── step 1: the pentaflake ────────────────────────────────────────────────

const flakeCanvas = byId("boot-flake") as HTMLCanvasElement | null;

/**
 * The figure the P wheel is measured off: the middle pentagon and the five
 * 180° copies placed edge to edge. The spokes are the P vectors.
 */
function drawFlake(): void {
    if (!flakeCanvas) return;
    const ctx = flakeCanvas.getContext("2d");
    if (!ctx) return;
    const w = flakeCanvas.width, h = flakeCanvas.height;

    const leaves = pentaflake(points);
    let lo: Pt = [Infinity, Infinity], hi: Pt = [-Infinity, -Infinity];
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
        const [a, b] = sharedEdge(points, i);
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
    points.forEach((pt, i) => {
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

const outCanvas = byId("boot-out") as HTMLCanvasElement | null;

function drawTiling(): void {
    if (!outCanvas) return;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;
    const w = outCanvas.width, h = outCanvas.height;

    const ladder = ladderTo(points, Math.min(gen, MAX_GEN) + 1);
    let tiles: Placement[] = [];
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
    let lo: Pt = [Infinity, Infinity], hi: Pt = [-Infinity, -Infinity];
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
        const { d, t } = wheelsAt(points, big ? 1 : 0);
        hostCount = hosts.length;
        const inflated = inflate(d);
        const wide = Math.max(0.7, k * 0.05);
        for (const tile of hosts) {
            if (tile.type !== "Pe5" && tile.type !== "Pe3" && tile.type !== "Pe1") continue;
            for (const { spec, turn } of rhombGroup(tile.type, tile.tenth)) {
                const quad = rhombus(spec, t, inflated, turn, spelling)
                    .map((p) => [p[0] + tile.loc[0], p[1] + tile.loc[1]] as Pt);
                if (rhombFace !== "none") {
                    poly(ctx, quad, cx, cy, k);
                    ctx.globalAlpha = rhombFace === "transparent" ? 0.3 : 1;
                    ctx.fillStyle = "#ffffff";
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

    note(`${tiles.length} tiles · generation ${drawnGen}`
        + (drawnGen === gen ? "" : ` (${gen} asked, capped at ${TILE_LIMIT} tiles)`)
        + ` · ${seed}`
        + (rhombSize === "none" ? "" : ` · ${rhombSize} rhombs on ${hostCount}`)
        + (view.zoom === 1 ? "" : ` · ${view.zoom.toFixed(1)}×`));
}

const note = (s: string): void => {
    const el = byId("boot-note");
    if (el) el.textContent = s;
};

// ── readouts ──────────────────────────────────────────────────────────────

const atBaseRung = (): boolean => extrapolate === 0;

/** Integers print as integers; the real preset needs decimals. */
const num = (v: number): string => Number.isInteger(v) ? String(v) : v.toFixed(3);

const fmtW = (w: Wheel, n = 3) =>
    w.slice(0, n).map((p) => `(${num(p[0])}, ${num(p[1])})`).join("  ");

function report(e: Wheel): void {
    const set = wheelsAt(points, 1);
    const rows: Array<[string, string]> = [
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
        const uniq = [...new Set(e.map((p) => Math.hypot(p[0], p[1]).toFixed(4)))].sort();
        lens.textContent = `tile edges: ${uniq.join(", ")}`;
    }
}

// ── wiring ────────────────────────────────────────────────────────────────

const redraw = (): void => { drawInput(); drawFlake(); drawTiling(); };

if (inputCanvas) {
    inputCanvas.addEventListener("pointerdown", (ev) => {
        if (!atBaseRung()) return;       // only the five themselves are editable
        const at = pick(ev);
        let best = -1, bestD = 2.5;
        points.forEach((p, i) => {
            const dd = Math.hypot(p[0] - at[0], p[1] - at[1]);
            if (dd < bestD) { bestD = dd; best = i; }
        });
        dragging = best;
        if (best >= 0) { inputCanvas.setPointerCapture(ev.pointerId); redraw(); }
    });
    inputCanvas.addEventListener("pointermove", (ev) => {
        if (dragging < 0) return;
        const at = pick(ev);
        if (at[0] === points[dragging][0] && at[1] === points[dragging][1]) return;
        points = points.map((p, i) => (i === dragging ? at : p));
        syncPreset();
        redraw();
    });
    const drop = (): void => { if (dragging >= 0) { dragging = -1; redraw(); } };
    inputCanvas.addEventListener("pointerup", drop);
    inputCanvas.addEventListener("pointercancel", drop);
}

const rungOutValue = byId("boot-extrapolate-value");
/** Show the current extrapolation, signed, so +0.5 and -0.5 read differently. */
function showExtrapolate(): void {
    if (rungOutValue)
        rungOutValue.textContent = extrapolate > 0 ? `+${extrapolate}` : String(extrapolate);
}
/** Steps of a HALF generation, because a generation is phi^2 and phi is the half. */
const stepExtrapolate = (by: number): void => {
    extrapolate = Math.min(6, Math.max(-4, extrapolate + by));
    showExtrapolate();
    drawInput();
};
byId("boot-extrapolate-down")?.addEventListener("click", () => stepExtrapolate(-0.5));
byId("boot-extrapolate-up")?.addEventListener("click", () => stepExtrapolate(0.5));

// ── the output's viewport ─────────────────────────────────────────────────

/** Where a canvas point sits, in the tiling's own coordinates. */
function toWorld(sx: number, sy: number): [number, number] {
    const k = fit.k0 * view.zoom;
    return [(sx - (fit.w / 2 - fit.mx * k + view.panX)) / k,
            (sy - (fit.h / 2 - fit.my * k + view.panY)) / k];
}

/** Zoom about a canvas point, so whatever is under the pointer stays there. */
function zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = toWorld(sx, sy);
    view.zoom = Math.min(120, Math.max(0.2, view.zoom * factor));
    const k = fit.k0 * view.zoom;
    view.panX = sx - wx * k - fit.w / 2 + fit.mx * k;
    view.panY = sy - wy * k - fit.h / 2 + fit.my * k;
    drawTiling();
}

/** Canvas coordinates of a pointer event. */
function atCanvas(ev: { clientX: number; clientY: number }): [number, number] {
    const r = outCanvas!.getBoundingClientRect();
    return [(ev.clientX - r.left) * (outCanvas!.width / r.width),
            (ev.clientY - r.top) * (outCanvas!.height / r.height)];
}

const resetView = (): void => {
    view.zoom = 1; view.panX = 0; view.panY = 0;
    drawTiling();
};

if (outCanvas) {
    outCanvas.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const [sx, sy] = atCanvas(ev);
        zoomAt(sx, sy, Math.exp(-(ev.deltaY ?? 0) * 0.0015));
    }, { passive: false });

    outCanvas.addEventListener("pointerdown", (ev) => {
        panning = true;
        panFrom = atCanvas(ev);
        outCanvas.setPointerCapture(ev.pointerId);
    });
    outCanvas.addEventListener("pointermove", (ev) => {
        if (!panning) return;
        const [sx, sy] = atCanvas(ev);
        view.panX += sx - panFrom[0];
        view.panY += sy - panFrom[1];
        panFrom = [sx, sy];
        drawTiling();
    });
    const endPan = (): void => { panning = false; };
    outCanvas.addEventListener("pointerup", endPan);
    outCanvas.addEventListener("pointercancel", endPan);
    outCanvas.addEventListener("dblclick", resetView);
}

const fitBtn = byId("boot-fit");
if (fitBtn) fitBtn.addEventListener("click", resetView);

// ── face and edge style, which govern both canvases ───────────────────────

const facePick = byId("boot-face") as HTMLSelectElement | null;
if (facePick) facePick.addEventListener("change", () => {
    const v = facePick.value as Face;
    if (FACES.includes(v)) face = v;
    redraw();
});

const edgePick = byId("boot-edge") as HTMLSelectElement | null;
if (edgePick) edgePick.addEventListener("change", () => {
    const v = edgePick.value as Edge;
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

for (const [id, v] of [["boot-up", false], ["boot-down", true]] as const)
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
const useShown = (): void => {
    const taken = pentagon(wheelsAt(points, rungOf(extrapolate)).d, 0);
    points = taken.map((p) => [p[0], p[1]] as Pt);
    extrapolate = 0;
    showExtrapolate();
    // Snapping an adopted pentagon that is not on the lattice would wreck it on
    // the first drag, so follow what was actually taken.
    setSnapFromPoints();
    syncPreset();
    redraw();
};

const useBtn = byId("boot-use");
if (useBtn) useBtn.addEventListener("click", useShown);

const snapBox = byId("boot-snap") as HTMLInputElement | null;
/**
 * Keep the preset picker honest. Once the five have been dragged or adopted they
 * are usually no longer either preset, and leaving the old name selected meant
 * having to toggle away and back to reload one.
 */
function syncPreset(): void {
    if (!presetPick) return;
    const same = (a: readonly Pt[]): boolean =>
        a.length === points.length
        && a.every((v, i) => Math.abs(v[0] - points[i][0]) < 1e-9
                          && Math.abs(v[1] - points[i][1]) < 1e-9);
    for (const [name, preset] of Object.entries(PRESETS))
        if (same(preset)) { presetPick.value = name; return; }
    presetPick.value = "custom";
}

/** Snapping is only safe where the five are already integers. */
function setSnapFromPoints(): void {
    snapToLattice = points.every((p) => Number.isInteger(p[0]) && Number.isInteger(p[1]));
    if (snapBox) snapBox.checked = snapToLattice;
}
if (snapBox) snapBox.addEventListener("change", () => {
    snapToLattice = snapBox.checked;
});

const presetPick = byId("boot-preset") as HTMLSelectElement | null;
const loadPreset = (name: string): void => {
    const preset = PRESETS[name];
    if (!preset) return;                    // "custom" is a label, not a preset
    points = preset.map((p) => [p[0], p[1]] as Pt);
    // A preset is a fresh start, so the extrapolation goes back to the five.
    extrapolate = 0;
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
const stepGen = (by: number): void => {
    gen = Math.min(MAX_GEN, Math.max(0, gen + by));
    if (genOut) genOut.textContent = String(gen);
    drawTiling();
};
byId("boot-gen-down")?.addEventListener("click", () => stepGen(-1));
byId("boot-gen-up")?.addEventListener("click", () => stepGen(1));

const seedPick = byId("boot-seed") as HTMLSelectElement | null;
if (seedPick) seedPick.addEventListener("change", () => {
    // A stub DOM, or a stale option, can hand back something that is not a seed.
    // Letting it through used to reach the tile walk as `undefined` and blank the
    // canvas with no error anywhere but the console.
    if (isSeedType(seedPick.value)) seed = seedPick.value;
    drawTiling();
});

for (const size of ["none", "little", "big"] as const) {
    byId(`boot-rhomb-${size}`)?.addEventListener("change", () => {
        rhombSize = size;
        drawTiling();
    });
}

const SPELLINGS: readonly Spelling[] = ["mixed", "t", "inflated"];
const rhombFacePick = byId("boot-rhomb-face") as HTMLSelectElement | null;
if (rhombFacePick) rhombFacePick.addEventListener("change", () => {
    const v = rhombFacePick.value as Face;
    if (FACES.includes(v)) rhombFace = v;
    drawTiling();
});

const rhombEdgePick = byId("boot-rhomb-edge") as HTMLSelectElement | null;
if (rhombEdgePick) rhombEdgePick.addEventListener("change", () => {
    const v = rhombEdgePick.value as Edge;
    if (EDGES.includes(v)) rhombEdge = v;
    drawTiling();
});

const spellPick = byId("boot-spelling") as HTMLSelectElement | null;
if (spellPick) spellPick.addEventListener("change", () => {
    const v = spellPick.value as Spelling;
    if (SPELLINGS.includes(v)) spelling = v;
    drawTiling();
});

const resetBtn = byId("boot-reset");
if (resetBtn) resetBtn.addEventListener("click", () =>
    loadPreset(presetPick?.value ?? "quadrille"));

if (genOut) genOut.textContent = String(gen);
showExtrapolate();
redraw();
console.log(`by-your-bootstraps — build id ${BUILD_ID}`);
