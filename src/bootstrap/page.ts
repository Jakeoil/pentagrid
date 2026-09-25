// by-your-bootstraps: five ordered points in, a Penrose tiling out.
//
// The figure on the left is the input — five draggable lattice points and the
// pentagon they close. Everything on the right is derived from them: the four
// wheels, the tile outlines, and whichever patch is chosen. Move a point and
// the whole tiling follows, because nothing downstream holds a coordinate.

import { PENTA_UP, eWheel, inflate, ladderTo, m10, wheelFromPoints, wheelsAt,
         type Pt, type Wheel } from "./wheel.js";
import { THICK, THIN, rhombus, type Spelling } from "./walk.js";
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
const FILL: Record<string, string> = {
    Pe5: "#4a6fc4", Pe3: "#e8c547", Pe1: "#e46c0a",
    St5: "#2f4a8f", St3: "#3b5ca8", St1: "#5478c9",
};

let points: Pt[] = PENTA_UP.map((p) => [p[0], p[1]] as Pt);
let seed: SeedType = "Sun";
let gen = 2;
let spelling: Spelling = "t";
let showRhombs = false;
let dragging = -1;

/** Square graph paper, matching the index figure. */
function paper(ctx: CanvasRenderingContext2D, w: number, h: number,
               cx: number, cy: number, cell: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const [step, color] of [[1, GRID], [5, GRID_BOLD]] as const) {
        const gap = cell * step;
        if (gap < 3) continue;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let x = cx % gap; x < w; x += gap) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = cy % gap; y < h; y += gap) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
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
    paper(ctx, w, h, cx, cy, CELL);

    // the pentagon the five points close, and the edge wheel it generates
    const e = eWheel(wheelFromPoints(points));
    ctx.strokeStyle = HOT;
    ctx.lineWidth = 2;
    poly(ctx, points, cx, cy, CELL);
    ctx.stroke();

    // spokes to each point, so the ordering is visible
    ctx.strokeStyle = "rgba(230,57,70,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of points) { ctx.moveTo(cx, cy); ctx.lineTo(cx + p[0] * CELL, cy + p[1] * CELL); }
    ctx.stroke();

    // the handles, numbered in order
    ctx.font = "600 11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    points.forEach((p, i) => {
        const x = cx + p[0] * CELL, y = cy + p[1] * CELL;
        ctx.fillStyle = i === dragging ? INK : HOT;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(String(i), x, y + 0.5);
    });

    // the origin
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, TAU);
    ctx.fill();

    report(e);
}

/** Lattice coordinates under the pointer. */
function pick(ev: { clientX: number; clientY: number }): Pt {
    const r = inputCanvas!.getBoundingClientRect();
    const sx = inputCanvas!.width / r.width, sy = inputCanvas!.height / r.height;
    const x = (ev.clientX - r.left) * sx - inputCanvas!.width / 2;
    const y = (ev.clientY - r.top) * sy - inputCanvas!.height / 2;
    return [Math.round(x / CELL), Math.round(y / CELL)];
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
        + `<span>(${l.center[0]}, ${l.center[1]})</span>`).join("");
}

// ── the tiling ────────────────────────────────────────────────────────────

const outCanvas = byId("boot-out") as HTMLCanvasElement | null;

function drawTiling(): void {
    if (!outCanvas) return;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return;
    const w = outCanvas.width, h = outCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);

    const ladder = ladderTo(points, gen + 1);
    let tiles: Placement[] = [];
    try {
        tiles = expand(seed, 0, [0, 0], gen, ladder);
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
    if (!outlines.length) { note("nothing to draw"); return; }

    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) || 1;
    const k = (Math.min(w, h) - 24) / span;
    const cx = w / 2 - ((lo[0] + hi[0]) / 2) * k;
    const cy = h / 2 - ((lo[1] + hi[1]) / 2) * k;

    ctx.lineJoin = "round";
    for (const o of outlines) {
        poly(ctx, o.pts, cx, cy, k);
        ctx.fillStyle = FILL[o.type] ?? "#999";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(0.4, k * 0.06);
        ctx.stroke();
    }

    if (showRhombs) {
        const { d, t } = wheelsAt(points, gen);
        const inflated = inflate(d);
        ctx.strokeStyle = "rgba(20,20,30,0.75)";
        ctx.lineWidth = Math.max(0.7, k * 0.05);
        for (const tile of tiles) {
            if (tile.type !== "Pe5" && tile.type !== "Pe3" && tile.type !== "Pe1") continue;
            const spec = tile.type === "Pe1" ? THIN : THICK;
            const quad = rhombus(spec, t, inflated, tile.tenth, spelling)
                .map((p) => [p[0] + tile.loc[0], p[1] + tile.loc[1]] as Pt);
            poly(ctx, quad, cx, cy, k);
            ctx.stroke();
        }
    }

    note(`${tiles.length} tiles · generation ${gen} · ${seed}`);
}

const note = (s: string): void => {
    const el = byId("boot-note");
    if (el) el.textContent = s;
};

// ── readouts ──────────────────────────────────────────────────────────────

const fmtW = (w: Wheel, n = 3) =>
    w.slice(0, n).map((p) => `(${p[0]}, ${p[1]})`).join("  ");

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
        redraw();
    });
    const drop = (): void => { if (dragging >= 0) { dragging = -1; redraw(); } };
    inputCanvas.addEventListener("pointerup", drop);
    inputCanvas.addEventListener("pointercancel", drop);
}

const genPick = byId("boot-gen") as HTMLInputElement | null;
const genOut = byId("boot-gen-value");
if (genPick) genPick.addEventListener("input", () => {
    gen = parseInt(genPick.value, 10);
    if (genOut) genOut.textContent = String(gen);
    drawTiling();
});

const seedPick = byId("boot-seed") as HTMLSelectElement | null;
if (seedPick) seedPick.addEventListener("change", () => {
    // A stub DOM, or a stale option, can hand back something that is not a seed.
    // Letting it through used to reach the tile walk as `undefined` and blank the
    // canvas with no error anywhere but the console.
    if (isSeedType(seedPick.value)) seed = seedPick.value;
    drawTiling();
});

const rhombBox = byId("boot-rhombs") as HTMLInputElement | null;
if (rhombBox) rhombBox.addEventListener("change", () => {
    showRhombs = rhombBox.checked;
    drawTiling();
});

const SPELLINGS: readonly Spelling[] = ["t", "inflated", "legacy"];
const spellPick = byId("boot-spelling") as HTMLSelectElement | null;
if (spellPick) spellPick.addEventListener("change", () => {
    const v = spellPick.value as Spelling;
    if (SPELLINGS.includes(v)) spelling = v;
    drawTiling();
});

const resetBtn = byId("boot-reset");
if (resetBtn) resetBtn.addEventListener("click", () => {
    points = PENTA_UP.map((p) => [p[0], p[1]] as Pt);
    redraw();
});

if (genOut) genOut.textContent = String(gen);
redraw();
console.log(`by-your-bootstraps — build id ${BUILD_ID}`);
