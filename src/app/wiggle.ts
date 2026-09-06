// Wiggle room: how much freedom γ has while a patch survives.
//
// PLAN.md, E1 reading (b). The pattern depends on only TWO numbers — γ's
// component in E⊥ — because shifting γ within E∥ slides the pentagrid and leaves
// the tiling exactly where it was. So the set of γ that keep a given patch is a
// region of a plane, and it is convex: each vertex's existence is "these five
// strips have a common point", a projection of a polyhedron.
//
// Left: the tiling, patch marked. Right: that region, with γ as a draggable dot.
// Drag inside it and the patch survives; leave it and something flips.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle } from "../view/pentagrid.js";
import { NUM_GRIDS, computeKTuple, dualVertex, makeDirections } from "../geometry/pentagrid.js";
import { regionPoly } from "../geometry/region.js";
import type { Vec2 } from "../geometry/types.js";

const dirs = makeDirections(true);

// ── the perpendicular plane ───────────────────────────────────────
// E∥ is spanned by the direction components; E⊥ by the same angles doubled.
// Together with the all-ones line (killed by Σγ = 0) they span R^5.
const unit = (u: number[]) => { const n = Math.hypot(...u); return u.map((x) => x / n); };
const ang = (j: number) => Math.atan2(dirs[j][1], dirs[j][0]);
const E3 = unit([0, 1, 2, 3, 4].map((j) => Math.cos(2 * ang(j))));
const E4 = unit([0, 1, 2, 3, 4].map((j) => Math.sin(2 * ang(j))));

/** A γ with the given perpendicular coordinates and no E∥ part. */
function gammaOf(p: number, q: number): number[] {
    return [0, 1, 2, 3, 4].map((j) => p * E3[j] + q * E4[j]);
}

const FEASIBLE_BOX = { xMin: -80, xMax: 80, yMin: -80, yMax: 80 };

/** Is this K-tuple realised? Five strips with a common point. */
function realised(gamma: number[], K: readonly number[]): boolean {
    return regionPoly({ directions: dirs, gamma }, K, FEASIBLE_BOX).length >= 3;
}

// ── state ─────────────────────────────────────────────────────────

let p = 0.31, q = -0.17;
let radius = 2.5;
let patch: number[][] = [];
let poly: Vec2[] = [];
let area = 0;

const gridHost = document.getElementById("wiggle-tiling");
const perpCanvas = document.getElementById("wiggle-perp") as HTMLCanvasElement | null;
const radiusInput = document.getElementById("wiggle-radius") as HTMLInputElement | null;
const readout = document.getElementById("wiggle-readout");

/** Every realised vertex within `radius` of the origin, at the current γ. */
function capturePatch() {
    const gamma = gammaOf(p, q);
    const pg = { directions: dirs, gamma };
    const seen = new Set<string>();
    const out: number[][] = [];
    const step = 0.06;
    for (let x = -radius - 1; x <= radius + 1; x += step) {
        for (let y = -radius - 1; y <= radius + 1; y += step) {
            const K = computeKTuple(pg, x, y);
            const key = K.join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            const f = dualVertex(pg, K);
            if (Math.hypot(f[0], f[1]) <= radius) out.push(K);
        }
    }
    patch = out;
}

/**
 * The acceptance region, by ray casting from the current γ — which is inside by
 * construction, since the patch was read off it. Convexity is what makes one
 * boundary crossing per ray the whole story.
 */
function computeRegion() {
    const holds = (pp: number, qq: number) => {
        const g = gammaOf(pp, qq);
        for (const K of patch) if (!realised(g, K)) return false;
        return true;
    };
    const RAYS = 120, REACH = 2.5, BISECT = 18;
    const pts: Vec2[] = [];
    for (let i = 0; i < RAYS; i++) {
        const a = (2 * Math.PI * i) / RAYS;
        const dx = Math.cos(a), dy = Math.sin(a);
        let lo = 0, hi = REACH;
        if (holds(p + hi * dx, q + hi * dy)) lo = hi;
        else for (let s = 0; s < BISECT; s++) {
            const m = (lo + hi) / 2;
            if (holds(p + m * dx, q + m * dy)) lo = m; else hi = m;
        }
        pts.push([p + lo * dx, q + lo * dy]);
    }
    poly = pts;
    area = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        area += (x1 * y2 - x2 * y1) / 2;
    }
    area = Math.abs(area);
}

// ── the tiling, on the left ───────────────────────────────────────

let view: PentagridHandle | null = null;

if (gridHost) {
    view = createPentagrid({
        container: gridHost,
        gamma: gammaOf(p, q),
        steps: [],
        features: { gridLines: false, axes: false, penroseEdges: true },
        layers: ({ stack }) => {
            stack.add({
                id: "patch", label: "Patch", z: 45, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = view;
                    if (!v) return;
                    const sc = v.getView();
                    const g = gammaOf(p, q);
                    const pg = { directions: dirs, gamma: g };
                    for (const K of patch) {
                        const f = dualVertex(pg, K);
                        const sx = cx + (f[0] - sc.x) * sc.scale;
                        const sy = cy - (f[1] - sc.y) * sc.scale;
                        const live = realised(g, K);
                        ctx.beginPath();
                        ctx.arc(sx, sy, live ? 4 : 5, 0, 2 * Math.PI);
                        ctx.fillStyle = live ? "#e63946" : "rgba(0,0,0,0)";
                        ctx.strokeStyle = live ? "#e63946" : "#999";
                        ctx.lineWidth = 1.5;
                        if (live) ctx.fill(); else ctx.stroke();
                    }
                },
            });
        },
    });
}

// ── the perpendicular plane, on the right ─────────────────────────

function drawPerp() {
    if (!perpCanvas) return;
    const ctx = perpCanvas.getContext("2d")!;
    const W = perpCanvas.width, H = perpCanvas.height;
    const S = Math.min(W, H) / 3.2;           // units -> px
    const toS = (u: number, v: number): Vec2 => [W / 2 + u * S, H / 2 - v * S];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.stroke();

    if (poly.length > 2) {
        ctx.beginPath();
        poly.forEach(([u, v], i) => {
            const [sx, sy] = toS(u, v);
            if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(69, 123, 157, 0.18)";
        ctx.fill();
        ctx.strokeStyle = "#457b9d";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    const inside = insidePoly(p, q);
    const [dx, dy] = toS(p, q);
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, 2 * Math.PI);
    ctx.fillStyle = inside ? "#e63946" : "#999";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (readout) {
        readout.innerHTML =
            `patch <b>${patch.length}</b> vertices &nbsp;·&nbsp; ` +
            `room <b>${area.toFixed(4)}</b> &nbsp;·&nbsp; ` +
            (inside ? "inside" : "<span style='color:#c1440e'>outside — the patch has changed</span>");
    }
}

function insidePoly(u: number, v: number): boolean {
    if (poly.length < 3) return false;
    let hit = false;
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
        const [xi, yi] = poly[i], [xk, yk] = poly[k];
        if ((yi > v) !== (yk > v) && u < ((xk - xi) * (v - yi)) / (yk - yi) + xi) hit = !hit;
    }
    return hit;
}

// ── wiring ────────────────────────────────────────────────────────

function reanchor() {
    capturePatch();
    computeRegion();
    redraw();
}

function redraw() {
    view?.setGamma(gammaOf(p, q));
    drawPerp();
}

if (radiusInput) {
    radiusInput.value = String(radius);
    radiusInput.addEventListener("input", () => {
        radius = parseFloat(radiusInput.value);
        reanchor();
    });
}

if (perpCanvas) {
    const S = () => Math.min(perpCanvas.width, perpCanvas.height) / 3.2;
    const fromEvent = (e: MouseEvent): [number, number] => {
        const r = perpCanvas.getBoundingClientRect();
        return [
            (e.clientX - r.left - perpCanvas.width / 2) / S(),
            -(e.clientY - r.top - perpCanvas.height / 2) / S(),
        ];
    };
    let dragging = false;
    const move = (e: MouseEvent) => { [p, q] = fromEvent(e); redraw(); };
    perpCanvas.addEventListener("mousedown", (e) => { dragging = true; move(e); });
    perpCanvas.addEventListener("mousemove", (e) => { if (dragging) move(e); });
    window.addEventListener("mouseup", () => { dragging = false; });
    perpCanvas.addEventListener("dblclick", reanchor);
}

if (gridHost && perpCanvas) reanchor();
