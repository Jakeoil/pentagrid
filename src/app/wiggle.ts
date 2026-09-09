// wiggle.html: how much freedom γ has while a patch survives.
//
// The mathematics is in geometry/acceptance.ts and the right-hand canvas is
// view/region-panel.ts. This is the page: capture a patch, trace the region it
// lives in, and keep the two panels in step.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle } from "../view/pentagrid.js";
import { createRegionPanel } from "../view/region-panel.js";
import { computeKTuple, dualVertex, makeDirections } from "../geometry/pentagrid.js";
import {
    convexBoundary, gammaFromPerp, perpBasis, polygonArea, vertexRealised,
} from "../geometry/acceptance.js";
import type { Vec2 } from "../geometry/types.js";

const dirs = makeDirections(true);
const basis = perpBasis(dirs);
const gammaOf = (p: number, q: number) => gammaFromPerp(basis, p, q);

let p = 0.31, q = -0.17;
let radius = 2.5;
let patch: number[][] = [];
let area = 0;

const gridHost = document.getElementById("wiggle-tiling");
const perpHost = document.getElementById("wiggle-perp");
const radiusInput = document.getElementById("wiggle-radius") as HTMLInputElement | null;
const readout = document.getElementById("wiggle-readout");
const radiusOut = document.getElementById("wiggle-radius-value");

let view: PentagridHandle | null = null;
let panel: ReturnType<typeof createRegionPanel> | null = null;

/** Every realised vertex within `radius` of the origin, at the current γ. */
function capturePatch() {
    const pg = { n: dirs.length, directions: dirs, gamma: gammaOf(p, q) };
    const seen = new Set<string>();
    const out: number[][] = [];
    for (let x = -radius - 1; x <= radius + 1; x += 0.06) {
        for (let y = -radius - 1; y <= radius + 1; y += 0.06) {
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

const holds = (pp: number, qq: number) => {
    const pg = { n: dirs.length, directions: dirs, gamma: gammaOf(pp, qq) };
    for (const K of patch) if (!vertexRealised(pg, K)) return false;
    return true;
};

function reanchor() {
    capturePatch();
    // The anchoring γ is inside its own region by construction, which is what a
    // ray cast needs; convexity does the rest.
    const poly = convexBoundary(holds, [p, q]);
    area = polygonArea(poly);
    panel?.setRegion(poly);
    refresh();
}

function refresh() {
    panel?.setPoint(p, q);
    view?.setGamma(gammaOf(p, q));
    if (readout) {
        const inside = panel?.inside() ?? false;
        readout.innerHTML =
            `patch <b>${patch.length}</b> vertices &nbsp;·&nbsp; ` +
            `room <b>${area.toFixed(4)}</b> &nbsp;·&nbsp; ` +
            (inside ? "inside" : "<span style='color:#c1440e'>outside — the patch has changed</span>");
    }
}

if (gridHost && perpHost) {
    view = createPentagrid({
        container: gridHost,
        gamma: gammaOf(p, q),
        steps: [],
        features: { gridLines: false, axes: false, penroseEdges: true },
        layers: ({ stack, getView }) => {
            stack.add({
                id: "patch", label: "Patch", z: 45, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const pg = { n: dirs.length, directions: dirs, gamma: gammaOf(p, q) };
                    for (const K of patch) {
                        const f = dualVertex(pg, K);
                        const sx = cx + (f[0] - v.x) * v.scale;
                        const sy = cy - (f[1] - v.y) * v.scale;
                        const live = vertexRealised(pg, K);
                        ctx.beginPath();
                        ctx.arc(sx, sy, live ? 4 : 5, 0, 2 * Math.PI);
                        ctx.lineWidth = 1.5;
                        if (live) { ctx.fillStyle = "#e63946"; ctx.fill(); }
                        else { ctx.strokeStyle = "#999"; ctx.stroke(); }
                    }
                },
            });
        },
    });

    panel = createRegionPanel({
        container: perpHost,
        size: 460,
        onMove: (x, y) => { p = x; q = y; refresh(); },
    });
    perpHost.addEventListener("dblclick", reanchor);

    if (radiusInput) {
        radiusInput.value = String(radius);
        const onRadius = () => {
            radius = parseFloat(radiusInput.value);
            if (radiusOut) radiusOut.textContent = radius.toFixed(2);
            reanchor();
        };
        radiusInput.addEventListener("input", onRadius);
        onRadius();
    }
    reanchor();
}
