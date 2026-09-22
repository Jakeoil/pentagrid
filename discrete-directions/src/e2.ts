// E2's figure: the discrete wheel against the Euclidean one, and the five
// directions a discrete multigrid would be built on.
//
// No pentagrid here — this page is about the directions themselves, which is
// the question that has to be settled before dualizing anything.

import { QUADRILLE, generation, wheel, limitSeed, limitAngles,
         discreteDirections, frameOperator } from "./wheels.js";

const byId = (id: string) => document.getElementById(id);

const TAU = 2 * Math.PI;
const fmt = (v: number, d = 4) => v.toFixed(d);

function drawWheels(canvas: HTMLCanvasElement, gen: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.42;
    ctx.clearRect(0, 0, w, h);

    // The Euclidean wheel: ten directions at 36 degrees, from the vertical.
    ctx.strokeStyle = "#c9ccd6";
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

    // The discrete wheel at this generation, normalized to the same radius.
    const pts = wheel(gen >= 0 ? generation(QUADRILLE, gen) : limitSeed(QUADRILLE));
    const mag = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e63946";
    ctx.fillStyle = "#e63946";
    for (const [x, y] of pts) {
        const px = cx + R * x / mag, py = cy - R * y / mag;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, TAU);
        ctx.fill();
    }
    // The mirror axis it never leaves.
    ctx.strokeStyle = "rgba(20,20,30,0.35)";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 12);
    ctx.lineTo(cx, cy + R + 12);
    ctx.stroke();
    ctx.setLineDash([]);
}

function report(gen: number) {
    const seed = gen >= 0 ? generation(QUADRILLE, gen) : limitSeed(QUADRILLE);
    const seedOut = byId("e2-seed");
    if (seedOut) {
        seedOut.textContent = gen >= 0
            ? seed.map(([x, y]) => `(${x}, ${y})`).join("  ")
            : "the limit";
    }
    const angOut = byId("e2-angles");
    if (angOut) {
        const from = wheel(seed)
            .map(([x, y]) => (90 - Math.atan2(y, x) * 180 / Math.PI + 720) % 360)
            .sort((a, b) => a - b);
        angOut.textContent = from.map((a) => fmt(a, 4)).join("  ");
    }
    const gapOut = byId("e2-gaps");
    if (gapOut) {
        const from = wheel(seed)
            .map(([x, y]) => (90 - Math.atan2(y, x) * 180 / Math.PI + 720) % 360)
            .sort((a, b) => a - b);
        const gaps = from.slice(1, 6).map((a, i) => a - from[i]);
        gapOut.textContent = gaps.map((g) => fmt(g, 4)).join("  ")
            + "   (Euclidean: 36 36 36 36 36)";
    }
    const frameOut = byId("e2-frame");
    if (frameOut && gen < 0) {
        const [xx, xy, yy] = frameOperator(discreteDirections());
        frameOut.textContent = `Σ v vᵀ = [${fmt(xx)}, ${fmt(xy)}; ${fmt(xy)}, ${fmt(yy)}]`
            + `   — the pentagrid's is [2.5, 0; 0, 2.5], gain ${fmt(2.5, 1)}`;
    } else if (frameOut) {
        frameOut.textContent = "";
    }
}

const canvas = byId("e2-wheel") as HTMLCanvasElement | null;
const genPick = byId("e2-gen") as HTMLInputElement | null;
const genOut = byId("e2-gen-value");
if (canvas && genPick) {
    const draw = () => {
        const v = parseInt(genPick.value, 10);
        const gen = v > 8 ? -1 : v;         // past the end of the slider: the limit
        if (genOut) genOut.textContent = gen < 0 ? "limit" : String(gen);
        drawWheels(canvas, gen);
        report(gen);
    };
    genPick.addEventListener("input", draw);
    draw();
}

// The exact limits, stated once on the page rather than in the markup.
const exact = byId("e2-exact");
if (exact) {
    const t1 = (5 - Math.sqrt(5)) / 4, t2 = (5 + 3 * Math.sqrt(5)) / 4;
    exact.textContent =
        `tan θ₁ = (5−√5)/4 = ${fmt(t1, 9)} → ${fmt(Math.atan(t1) * 180 / Math.PI, 6)}°   ·   `
        + `tan θ₂ = (5+3√5)/4 = ${fmt(t2, 9)} → ${fmt(Math.atan(t2) * 180 / Math.PI, 6)}°   ·   `
        + `measured: ${limitAngles().slice(1, 3).map((a) => fmt(a, 6)).join("°, ")}°`;
}
