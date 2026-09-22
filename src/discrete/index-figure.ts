// The two figures on the index: the wheel with its angles, and the quadrille
// pentagon with the real one laid over it.
//
// Both on quadrille paper — the discrete mode IS the quadrille one, and the
// whole point is that the quadrille figure has its corners on the lattice at
// every generation while the real one does not and never will (sin 36° is
// degree 4 over ℚ; the lattice reaches only ℚ(√5)).

import { WHEELS, PHI, wheelAt, wheel, pentagon, pentagonDown, limitSeed,
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
 * measure OF — and each wheel measures between a DIFFERENT pair of figures,
 * which is what Jake's outline of T made plain.
 *
 *   P  pentagon → pentagon.  A pentaflake, spokes center to center. That is 2r.
 *   S  pentagon → diamond.   The five near diamonds, long axis pointing in.
 *   T  star → star.          Feet touching, a boat between each pair.
 *   D  pentagon → its own corners. That is R.
 *
 * Quadrille in red over the real construction in dark blue, at matched size,
 * so the gap between the geometries is the gap between the outlines. The
 * spokes and their directions are the wheel data; the outlines at their ends
 * are drawn from those same directions at the size the measurement forces —
 * a star whose feet touch at T is T/2 across, a diamond is the tiling's thin
 * rhomb — so the figure says what is being measured without pretending to be
 * a tiling.
 */
type Shape = "pentagon" | "star" | "diamond";
const FAR: Record<WheelName, Shape> = { P: "pentagon", S: "diamond", T: "star", D: "pentagon" };

/** A point-up pentagon of circumradius R about (0,0), from five directions. */
function pentaOutline(dirs: readonly (readonly [number, number])[], R: number): [number, number][] {
    return dirs.map(([x, y]) => [x * R, y * R] as [number, number]);
}

/**
 * A five-pointed star, built as penrose-mosaic builds it: tips along `up` at
 * `pgram.rho`, dimples along `down` at `pgram.R` (shape-modes.js, `starTips`
 * and `starDimples`). Those two are in the ratio
 *
 *     pgram.R / pgram.rho = √((25−11√5)/10) / √((5−√5)/10) = 1/φ²
 *
 * so it is the {5/2} star polygon after all, and in the pentagon's own terms
 * the tip radius is φ·R — which is why T, the star-to-star distance, is φ·P.
 */
function starOutline(up: readonly (readonly [number, number])[],
                     down: readonly (readonly [number, number])[], R: number): [number, number][] {
    const out: [number, number][] = [];
    const inner = R / (PHI * PHI);
    for (let k = 0; k < 5; k++) {
        out.push([up[k][0] * R, up[k][1] * R]);
        out.push([down[k][0] * inner, down[k][1] * inner]);
    }
    return out;
}

/**
 * P1's diamond — the thin rhomb — with its ACUTE VERTEX at the origin and the
 * long axis running out along `u`.
 *
 * Jake: *the center of the diamond is not in the center. It is where the center
 * of its star would be. Hence the name St1.* The diamond is a star with one
 * point — St1 to the star's St5 and the boat's St3 — so the point it is
 * measured from is its star's center, which is a corner of the tile and not its
 * middle. S therefore ends ON that corner: pgon.R out to a pentagon corner,
 * then pgram.R further, and the diamond hangs off the end.
 */
function diamondOutline(u: readonly [number, number], a: number): [number, number][] {
    const rot = (deg: number): [number, number] => {
        const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
        return [u[0] * c - u[1] * s, u[0] * s + u[1] * c];
    };
    const far = 2 * a * Math.cos(Math.PI / 10);      // the long diagonal
    const l = rot(18), r = rot(-18);
    return [[0, 0], [l[0] * a, l[1] * a], [u[0] * far, u[1] * far], [r[0] * a, r[1] * a]];
}

const unit = (p: readonly [number, number]): [number, number] => {
    const m = Math.hypot(p[0], p[1]) || 1;
    return [p[0] / m, p[1] / m];
};

function drawMeasured(canvas: HTMLCanvasElement, v: number, atLimit: boolean) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const cx = Math.round(w / 2) + 0.5, cy = Math.round(h / 2) + 0.5;

    // The spokes: this wheel's own vectors. Only P crosses an EDGE to the next
    // pentagon, which is a down direction; D runs to its own corners, S out past
    // a corner to the near diamond's star center, T to the stars its feet point
    // at — all up directions. (Jake's outline of T measures 90, 18, 306, the up
    // set, which is what settled T.)
    const seed = atLimit ? limitSeed(WHEELS[which]) : wheelAt(which, v);
    const spokeEnds = which === "P" ? pentagonDown(seed) : pentagon(seed);
    const reachSpoke = Math.max(...spokeEnds.map(([x, y]) => Math.hypot(x, y))) || 1;

    // The figure at the center, sized by what the spoke means.
    const dSeed = atLimit ? limitSeed(WHEELS.D) : wheelAt("D", v);
    const upQ = pentagon(dSeed).map(unit), downQ = pentagonDown(dSeed).map(unit);
    const Rq = Math.max(...pentagon(dSeed).map(([x, y]) => Math.hypot(x, y))) || 1;
    // A star's tips reach φ·R, the pentagon's R times φ — so two of them at T =
    // φ·P mesh tip into dimple, which is what "feet touching" means and what
    // Jake's outline shows. A diamond is the tiling's thin rhomb, side a = 2R sin36°.
    const centerR = which === "T" ? PHI * Rq : Rq;
    const farR = which === "T" ? PHI * Rq : which === "S" ? 2 * Rq * Math.sin(Math.PI / 5) : Rq;

    const reach = which === "D" ? Rq
        : reachSpoke + (which === "S" ? 2 * farR * Math.cos(Math.PI / 10) : centerR);
    const S = Math.min(w, h) * 0.44 / reach;
    paper(ctx, w, h, cx, cy, atLimit ? 0 : S * (Rq / (Math.max(...pentagon(dSeed).map(([x, y]) => Math.hypot(x, y))) || 1)));

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
        for (const [x, y] of ends) { const [px, py] = at(x, y); ctx.moveTo(cx, cy); ctx.lineTo(px, py); }
        ctx.stroke();
        if (!dots) return;
        for (const [x, y] of ends) {
            const [px, py] = at(x, y);
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, TAU);
            ctx.fill();
        }
    };

    // The same construction in real geometry, at the same center size.
    const dir = (deg: number): [number, number] => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
    const upR = [0, 1, 2, 3, 4].map((k) => dir(90 - k * 72));
    const downR = [0, 1, 2, 3, 4].map((k) => dir(90 - 36 - k * 72));
    // D stops at R; P is 2r = φR; S is R + R/φ, which is φR again; T is φP = φ²R.
    const realSpoke = which === "D" ? Rq : which === "T" ? PHI * PHI * Rq : PHI * Rq;
    const realEnds = (which === "P" ? downR : upR)
        .map(([x, y]) => [x * realSpoke, y * realSpoke] as [number, number]);

    const centerQ = which === "T" ? starOutline(upQ, downQ, centerR) : pentaOutline(upQ, centerR);
    const centerRl = which === "T" ? starOutline(upR, downR, centerR) : pentaOutline(upR, centerR);
    poly(centerRl, REAL, 1.5);
    poly(centerQ, QUAD, 1.5);

    if (which !== "D") {
        for (let k = 0; k < 5; k++) {
            const [qx, qy] = spokeEnds[k], [rx, ry] = realEnds[k];
            if (FAR[which] === "diamond") {
                // hung off the spoke's end, pointing on outward
                poly(diamondOutline(unit(realEnds[k]), farR), REAL, 1, rx, ry);
                poly(diamondOutline(unit(spokeEnds[k]), farR), QUAD, 1, qx, qy);
            } else if (FAR[which] === "star") {
                poly(starOutline(upR, downR, farR), REAL, 1, rx, ry, true);
                poly(starOutline(upQ, downQ, farR), QUAD, 1, qx, qy, true);
            } else {
                poly(pentaOutline(upR, farR), REAL, 1, rx, ry, true);
                poly(pentaOutline(upQ, farR), QUAD, 1, qx, qy, true);
            }
        }
    }
    spokes(realEnds, REAL, false);
    spokes(spokeEnds, QUAD, true);
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
        which = (pick.value in WHEELS ? pick.value : "P") as WheelName;
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
