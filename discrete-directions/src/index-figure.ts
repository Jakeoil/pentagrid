// The index figure: the quadrille pentagon beside the real one.
//
// Two geometries, drawn on the same blue graph paper because that is the point
// — the quadrille one has its corners ON the lattice at every generation, the
// real one does not and never will (sin 36° is degree 4 over ℚ; the lattice
// reaches only ℚ(√5)).

import { QUADRILLE, generation, halfStep, pentagon } from "./wheels.js";

const GRID = "#c8d8ef";          // quadrille blue
const GRID_BOLD = "#9fbde4";
const QUAD = "#e63946";
const REAL = "#2a3b6b";

/** Square graph paper, `cell` pixels to the square, a heavier line every five. */
function paper(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, cell: number) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    const lines = (step: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let x = cx % (cell * step); x < w; x += cell * step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = cy % (cell * step); y < h; y += cell * step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
    };
    lines(1, GRID);
    lines(5, GRID_BOLD);
}

function stroke(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[],
                cx: number, cy: number, s: number, color: string, dots: boolean) {
    if (!pts.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
        const px = cx + x * s, py = cy - y * s;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
    // the spokes, faintly
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (const [x, y] of pts) { ctx.moveTo(cx, cy); ctx.lineTo(cx + x * s, cy - y * s); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (!dots) return;
    ctx.fillStyle = color;
    for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(cx + x * s, cy - y * s, 3.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

/**
 * One panel. `kind` decides which geometry: the quadrille wheel at this
 * generation, corners on the lattice; or the real pentagon at the same
 * circumradius, corners at 36° multiples and on no lattice point but the top.
 */
function draw(canvas: HTMLCanvasElement, kind: "quadrille" | "real", gen: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;

    const seed = gen % 2 === 0
        ? generation(QUADRILLE, gen / 2)
        : halfStep(generation(QUADRILLE, (gen - 1) / 2));
    const pts = pentagon(seed);
    const reach = Math.max(...pts.map(([x, y]) => Math.hypot(x, y))) || 1;
    // One lattice square is `cell` pixels; the figure is scaled to fit either way.
    const cell = Math.max(3, Math.min(26, (Math.min(w, h) * 0.40) / reach));
    paper(ctx, w, h, cx, cy, cell);

    if (kind === "quadrille") {
        stroke(ctx, pts, cx, cy, cell, QUAD, cell > 6);
    } else {
        // The real pentagon on the same circumradius: 36° apart from the
        // vertical, the wheel this one is always mistaken for.
        const R = reach * cell;
        const real: [number, number][] = [];
        for (let k = 0; k < 5; k++) {
            const a = (90 - k * 72) * Math.PI / 180;
            real.push([Math.cos(a) * R / cell, Math.sin(a) * R / cell]);
        }
        stroke(ctx, real, cx, cy, cell, REAL, cell > 6);
    }
    // the mirror axis both share
    ctx.strokeStyle = "rgba(20,20,30,0.3)";
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx, h - 6);
    ctx.stroke();
    ctx.setLineDash([]);
}

const byId = (id: string) => document.getElementById(id);
const quad = byId("fig-quadrille") as HTMLCanvasElement | null;
const real = byId("fig-real") as HTMLCanvasElement | null;
const slider = byId("fig-gen") as HTMLInputElement | null;
const out = byId("fig-gen-value");

if (quad && real && slider) {
    const render = () => {
        // Half generations are odd values: 0, ½, 1, 1½, …
        const v = parseInt(slider.value, 10);
        if (out) out.textContent = v % 2 === 0 ? String(v / 2) : `${(v - 1) / 2}½`;
        draw(quad, "quadrille", v);
        draw(real, "real", v);
    };
    slider.addEventListener("input", render);
    render();
}
