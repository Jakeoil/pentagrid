// The two figures on the index: the wheel with its angles, and the quadrille
// pentagon with the real one laid over it.
//
// Both on quadrille paper — the discrete mode IS the quadrille one, and the
// whole point is that the quadrille figure has its corners on the lattice at
// every generation while the real one does not and never will (sin 36° is
// degree 4 over ℚ; the lattice reaches only ℚ(√5)).

import { WHEELS, wheelAt, wheel, pentagon, pentagonDown, limitSeed,
         limitAngles, discreteDirections, frameOperator } from "./wheels.js";
import type { WheelName } from "./wheels.js";

const GRID = "#c8d8ef";          // quadrille blue
const GRID_BOLD = "#9fbde4";
const QUAD = "#e63946";
const REAL = "#2a3b6b";
const TAU = 2 * Math.PI;
const fmt = (v: number, d = 4) => v.toFixed(d);
const byId = (id: string) => document.getElementById(id);

/** Square graph paper, `cell` pixels to the square, a heavier line every five. */
function paper(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, cell: number) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const [step, color] of [[1, GRID], [5, GRID_BOLD]] as const) {
        const gap = cell * step;
        if (gap < 3) continue;                       // too fine to read: leave it out
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let x = cx % gap; x < w; x += gap) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = cy % gap; y < h; y += gap) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
    }
}

/** The mirror axis both geometries share. */
function axis(ctx: CanvasRenderingContext2D, cx: number, h: number) {
    ctx.strokeStyle = "rgba(20,20,30,0.3)";
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx, h - 6);
    ctx.stroke();
    ctx.setLineDash([]);
}

/** Which wheel is on show. The scale differs; the limiting directions do not. */
let which: WheelName = "P";

/**
 * The wheel at a rung, in half generations — penrose-mosaic's numbering, so
 * rung 2 is the seed and rung 0 is the deflation below it, exactly as
 * measurements.html prints them.
 */
const rung = (v: number) => wheelAt(which, v);

// ── the wheel, with its angles ────────────────────────────────────

function drawWheel(canvas: HTMLCanvasElement, v: number, atLimit: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;
    const R = Math.min(w, h) * 0.40;
    const pts = wheel(atLimit ? limitSeed(WHEELS[which]) : rung(v));
    const reach = Math.max(...pts.map(([x, y]) => Math.hypot(x, y))) || 1;
    paper(ctx, w, h, cx, cy, atLimit ? 0 : R / reach);

    // the Euclidean ten, for comparison
    ctx.strokeStyle = "#b9bfcc";
    ctx.lineWidth = 1;
    for (let k = 0; k < 10; k++) {
        const a = (90 - k * 36) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    // the discrete ten
    ctx.lineWidth = 2;
    ctx.strokeStyle = QUAD;
    ctx.fillStyle = QUAD;
    for (const [x, y] of pts) {
        const px = cx + R * x / reach, py = cy - R * y / reach;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, TAU);
        ctx.fill();
    }
    axis(ctx, cx, h);

    // the two free angles, written where they are
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#1a1a1e";
    ctx.textAlign = "left";
    const from = pts.map(([x, y]) => (90 - Math.atan2(y, x) * 180 / Math.PI + 720) % 360);
    for (let i = 0; i < pts.length; i++) {
        const a = from[i];
        if (a > 90 || a === 0) continue;             // label the upper right quadrant only
        const [x, y] = pts[i];
        const px = cx + R * 1.06 * x / reach, py = cy - R * 1.06 * y / reach;
        ctx.fillText(`${fmt(a, 3)}°`, px + 4, py);
    }
}

// ── what the wheel measures ──────────────────────────────────────

/**
 * The right-hand figure: not the wheel over again, but the thing it is the
 * measure OF. Jake: *illustrate what's actually being measured.*
 *
 *   P  a pentaflake — one pentagon and the five that share its edges — with
 *      the five spokes running center to center. That length is 2r.
 *   D  one pentagon with its five spokes running center to corner. That is R.
 *
 * The quadrille construction in red over the Euclidean one in dark blue, at
 * matched size, so the gap between the geometries is the gap between the two
 * outlines. The pentagon itself is always the D wheel's — D IS the pentagon's
 * radius — and the P spokes reach the neighbors' centers, which are the P
 * wheel's DOWN points: a neighbor sits across an edge, and the edge normals of
 * the point-up pentagon are the point-down directions.
 */
function drawMeasured(canvas: HTMLCanvasElement, v: number, atLimit: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;
    const seed = atLimit ? limitSeed(WHEELS.D) : wheelAt("D", v);
    const corners = pentagon(seed);                        // the pentagon, in lattice units
    const Rq = Math.max(...corners.map(([x, y]) => Math.hypot(x, y))) || 1;

    // P reaches the neighbors' centers; D stops at the corners. Scale so the
    // whole construction fits either way.
    const pSeed = atLimit ? limitSeed(WHEELS.P) : wheelAt("P", v);
    const centers = pentagonDown(pSeed);
    const reach = which === "P"
        ? Math.max(...centers.map(([x, y]) => Math.hypot(x, y))) + Rq
        : Rq;
    const S = Math.min(w, h) * 0.44 / reach;               // pixels per lattice unit
    paper(ctx, w, h, cx, cy, atLimit ? 0 : S);

    const at = (x: number, y: number): [number, number] => [cx + x * S, cy - y * S];
    const poly = (pts: readonly (readonly [number, number])[], color: string, width: number,
                  ox = 0, oy = 0, flip = false) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
            const [px, py] = at(ox + (flip ? -x : x), oy + (flip ? -y : y));
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();
    };
    const spokes = (ends: readonly (readonly [number, number])[], color: string, dots: boolean) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [x, y] of ends) {
            const [px, py] = at(x, y);
            ctx.moveTo(cx, cy);
            ctx.lineTo(px, py);
        }
        ctx.stroke();
        if (!dots) return;
        for (const [x, y] of ends) {
            const [px, py] = at(x, y);
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, TAU);
            ctx.fill();
        }
    };

    // The real construction underneath: same circumradius, corners at 72°.
    const realCorners: [number, number][] = [];
    for (let k = 0; k < 5; k++) {
        const a = (90 - k * 72) * Math.PI / 180;
        realCorners.push([Rq * Math.cos(a), Rq * Math.sin(a)]);
    }
    const realCenters: [number, number][] = [];      // 2r, along the edge normals
    const rReal = Rq * Math.cos(Math.PI / 5);
    for (let k = 0; k < 5; k++) {
        const a = (90 - 36 - k * 72) * Math.PI / 180;
        realCenters.push([2 * rReal * Math.cos(a), 2 * rReal * Math.sin(a)]);
    }

    if (which === "P") {
        for (let k = 0; k < 5; k++) {
            poly(realCorners, REAL, 1, realCenters[k][0], realCenters[k][1], true);
            poly(corners, QUAD, 1, centers[k][0], centers[k][1], true);
        }
        poly(realCorners, REAL, 1.5);
        poly(corners, QUAD, 1.5);
        spokes(realCenters, REAL, false);
        spokes(centers, QUAD, true);
    } else {
        poly(realCorners, REAL, 1.5);
        poly(corners, QUAD, 1.5);
        spokes(realCorners, REAL, false);
        spokes(corners, QUAD, true);
    }
    axis(ctx, cx, h);
}

// ── the readouts ──────────────────────────────────────────────────

function report(v: number, atLimit: boolean) {
    const seed = atLimit ? limitSeed(WHEELS[which]) : rung(v);
    const set = (id: string, text: string) => { const el = byId(id); if (el) el.textContent = text; };
    set("fig-seed", atLimit ? "the limit"
        : seed.map(([x, y]) => `(${x}, ${y})`).join("  "));
    const from = wheel(seed)
        .map(([x, y]) => (90 - Math.atan2(y, x) * 180 / Math.PI + 720) % 360)
        .sort((a, b) => a - b);
    set("fig-angles", from.map((a) => fmt(a, 4)).join("  "));
    set("fig-gaps", from.slice(1, 6).map((a, i) => fmt(a - from[i], 4)).join("  ")
        + "   (real: 36 36 36 36 36)");
    const [xx, xy, yy] = frameOperator(discreteDirections(WHEELS[which]));
    set("fig-frame", atLimit
        ? `Σ v vᵀ = [${fmt(xx)}, ${fmt(xy)}; ${fmt(xy)}, ${fmt(yy)}]   — the pentagrid's is [2.5, 0; 0, 2.5]`
        : "");
}

const wheelCanvas = byId("fig-wheel") as HTMLCanvasElement | null;
const pentCanvas = byId("fig-pentagons") as HTMLCanvasElement | null;
const slider = byId("fig-gen") as HTMLInputElement | null;
const genOut = byId("fig-gen-value");
const pick = byId("fig-wheel-pick") as HTMLSelectElement | null;

if (wheelCanvas && pentCanvas && slider) {
    const render = () => {
        const v = parseInt(slider.value, 10);
        const atLimit = v > 9;
        if (genOut) genOut.textContent = atLimit ? "limit"
            : v % 2 === 0 ? String(v / 2) : `${(v - 1) / 2}½`;
        drawWheel(wheelCanvas, v, atLimit);
        drawMeasured(pentCanvas, v, atLimit);
        report(v, atLimit);
    };
    slider.addEventListener("input", render);
    pick?.addEventListener("change", () => {
        which = (pick.value === "D" ? "D" : "P");
        render();
    });
    // The wheel scrolls the generations, over either canvas. A notch a rung, so
    // one flick is one step of the ladder rather than a run down it.
    let last = -Infinity;
    const scroll = (e: WheelEvent) => {
        e.preventDefault();
        const d = e.deltaY || e.deltaX;
        if (!d) return;
        const t = e.timeStamp;
        if (t > 0 && t - last < 90) return;
        last = t;
        const next = parseInt(slider.value, 10) + (d > 0 ? -1 : 1);
        const lo = parseInt(slider.min, 10), hi = parseInt(slider.max, 10);
        slider.value = String(Math.max(lo, Math.min(hi, next)));
        render();
    };
    for (const c of [wheelCanvas, pentCanvas]) c.addEventListener("wheel", scroll, { passive: false });
    render();
}

const exact = byId("fig-exact");
if (exact) {
    const t1 = (5 - Math.sqrt(5)) / 4, t2 = (5 + 3 * Math.sqrt(5)) / 4;
    exact.textContent =
        `tan θ₁ = (5−√5)/4 = ${fmt(t1, 9)} → ${fmt(Math.atan(t1) * 180 / Math.PI, 6)}°   ·   `
        + `tan θ₂ = (5+3√5)/4 = ${fmt(t2, 9)} → ${fmt(Math.atan(t2) * 180 / Math.PI, 6)}°   ·   `
        + `measured: ${limitAngles().slice(1, 3).map((a) => fmt(a, 6)).join("°, ")}°`;
}
