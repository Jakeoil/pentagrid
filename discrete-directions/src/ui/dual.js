// @ts-check
// dual.html: dualize the discrete directions.
//
// Split's arrangement — grid on the left, its dual on the right, one γ, one
// view — because the question is what the dual DOES, and the differences from
// the pentagrid show up as differences between two pictures you can pan
// together.
//
// Two switches, which de Bruijn's construction conflates and the pentagrid
// never notices:
//
//   spacing   λⱼ, how far apart family j's lines are. All 1 isolates the
//             effect of DIRECTION alone; the wheel's own lengths (1.0462, 1,
//             1.0288, 1.0288, 1) are what the lattice actually supplies.
//   edges     eⱼ, the vector the dual builds each tile edge from. Unit is de
//             Bruijn's and gives rhombs; the wheel vectors themselves give
//             parallelograms with unequal sides, which is the reading that
//             could reproduce the quadrille tiles (edges 4, √13, √17).
//
// What the readout reports is the experiment: how many tile shapes there are,
// and how far the dual map is from a similarity.

// WHAT THIS IMPORTS, AND WHY IT LOOKS LIKE THAT.
//
// This page is the one place discrete directions needs the pentagrid, and it
// takes it the way any other project would: through `lib/`, the published
// facade, not by reaching into `src/` or `dist/`. Jake, 2026-11-18: *it will
// use pentagrid's external library as if it were in another project.* So the
// specifiers below are exactly what a sibling checkout writes, one `../` fewer:
//
//     a sibling    ../pentagrid/lib/pentagrid.js
//     from here    ../../../lib/pentagrid.js
//
// Nothing else in this project imports pentagrid at all. If that ever changes,
// it should change here and go through `lib/` too.
import { createPentagrid } from "../../../lib/pentagrid.js";
import { mountFloatingReticulum } from "../../../lib/reticulum.js";
import { WHEELS, wheelAt, pentagon, limitSeed } from "../../lib/e2.js";

/** @typedef {import("../../../lib/pentagrid.js").PentagridHandle} PentagridHandle */
/** @typedef {import("../../../lib/pentagrid.js").Vec2} Vec2 */

/** @typedef {{ dirs: Vec2[], lengths: number[], raw: Vec2[] }} Frame */

const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];
/** @type {(id: string) => HTMLElement | undefined} */
const byId = (id) => document.getElementById(id) ?? undefined;

/**
 * The five directions at a generation, as unit normals, with their own lengths.
 *
 * `halves < 0` means the limit. At any FINITE generation the wheel's points are
 * lattice vectors, so the slopes are rational and the grid — hence the tiling —
 * is periodic; the period grows with the generation and only the limit is
 * aperiodic. Generation 1 is (0,6), (5,2), (3,−4) and mirrors: 3-4-5 slopes,
 * and its rhombs are 31.33°, 36.87°, 43.60° rather than the limit's 34.64°,
 * 36.49°, 37.72°.
 * @param {number} halves
 * @returns {Frame}
 */
function discreteFrame(halves) {
    const pts = pentagon(halves < 0 ? limitSeed(WHEELS.P) : wheelAt("P", halves));
    const mags = pts.map(([x, y]) => Math.hypot(x, y));
    const min = Math.min(...mags);
    const order = pts
        .map((p, i) => ({ p, i, a: Math.atan2(p[1], p[0]) }))
        .sort((u, w) => u.a - w.a);
    return {
        dirs: order.map(({ p, i }) => /** @type {Vec2} */ ([p[0] / mags[i], p[1] / mags[i]])),
        lengths: order.map(({ i }) => mags[i] / min),
        raw: order.map(({ p }) => /** @type {Vec2} */ ([p[0], p[1]])),
    };
}

/** The Euclidean five, for the comparison. @returns {Frame} */
function realFrame() {
    /** @type {Vec2[]} */
    const dirs = [];
    for (let j = 0; j < 5; j++) {
        const a = (2 * Math.PI * j) / 5 + Math.PI / 2;
        dirs.push([Math.cos(a), Math.sin(a)]);
    }
    return { dirs, lengths: [1, 1, 1, 1, 1], raw: dirs };
}

/**
 * Σ v vᵀ, as [xx, xy, yy] — (n/2)·I exactly when the frame is tight.
 * @param {readonly Vec2[]} dirs
 * @returns {[number, number, number]}
 */
function frame(dirs) {
    let xx = 0, xy = 0, yy = 0;
    for (const [x, y] of dirs) { xx += x * x; xy += x * y; yy += y * y; }
    return [xx, xy, yy];
}

/**
 * The two gains: the eigenvalues of Σ v vᵀ. Equal when it is a similarity.
 * @param {readonly Vec2[]} dirs
 * @returns {[number, number]}
 */
function gains(dirs) {
    const [xx, xy, yy] = frame(dirs);
    const t = (xx + yy) / 2, d = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy);
    return [t + d, t - d];
}

/** Every pairwise angle between the directions, to the nearest ten-thousandth. * @param {readonly Vec2[]} dirs
 * @returns {number[]}
 */
function shapeAngles(dirs) {
    /** @type {number[]} */
    const out = [];
    for (let i = 0; i < dirs.length; i++) {
        for (let j = i + 1; j < dirs.length; j++) {
            let a = Math.abs(Math.atan2(dirs[i][1], dirs[i][0]) - Math.atan2(dirs[j][1], dirs[j][0])) * 180 / Math.PI;
            a %= 180;
            if (a > 90) a = 180 - a;
            out.push(+a.toFixed(4));
        }
    }
    return out.sort((a, b) => a - b);
}

const gridHost = byId("dual-grid");
const tileHost = byId("dual-tiles");

if (gridHost && tileHost) {
    /** @type {PentagridHandle | null} */
    let handle = null;
    /** @type {(() => void) | null} */
    let teardown = null;
    /** @type {(id: string) => HTMLInputElement | undefined} */
    const opt = (id) => /** @type {HTMLInputElement | undefined} */ (byId(id));

    const build = () => {
        const real = /** @type {HTMLSelectElement | undefined} */
            (byId("dual-geometry"))?.value === "real";
        const spaced = !!opt("dual-spacing")?.checked;
        const wheelEdges = !!opt("dual-edges")?.checked;
        const genSlider = /** @type {HTMLInputElement | undefined} */ (byId("dual-gen"));
        const rung = parseInt(genSlider?.value ?? "20", 10);
        const halves = rung > 16 ? -1 : rung;                 // past the end: the limit
        const { dirs, lengths, raw } = real ? realFrame() : discreteFrame(halves);
        const genOut = byId("dual-gen-value");
        if (genOut) {
            genOut.textContent = real ? "—"
                : halves < 0 ? "limit"
                : halves % 2 === 0 ? String(halves / 2) : `${(halves - 1) / 2}½`;
        }

        // Two independent choices, which one array used to conflate.
        //
        //   grid normals   scaled by 1/λⱼ, since x·(v/λ) = n − γ puts line n at
        //                  x·v = λ(n − γ): a longer vector is a tighter grid.
        //   edge vectors   what the dual adds up, f = Σ Kⱼ eⱼ.
        /** @type {Vec2[]} */
        const normals = spaced
            ? dirs.map(([x, y], j) => /** @type {Vec2} */ ([x / lengths[j], y / lengths[j]]))
            : dirs;
        /** @type {Vec2[]} */
        const edges = wheelEdges
            ? dirs.map(([x, y], j) => /** @type {Vec2} */ ([x * lengths[j], y * lengths[j]]))
            : dirs;

        // Clear the PANELS as well as the canvases: createPentagrid appends its
        // rows to whatever host it is given, so rebuilding without this left a
        // second G and P cluster behind on every toggle.
        teardown?.();
        for (const el of [gridHost, tileHost, byId("dual-grid-panel"), byId("dual-tiles-panel")]) {
            el?.replaceChildren();
        }
        // The real pentagrid, ghosted behind the grid, because five families of
        // evenly spaced lines look regular whatever their angles until there is
        // something to compare them with. Same γ, same spacing, 36° apart: where
        // the red lines leave the gray ones is the whole of the difference.
        /** @type {(parts: {
         *     stack: { add: (spec: unknown) => unknown },
         *     model: { gamma: readonly number[] },
         *     getView: () => { scale: number, x: number, y: number },
         * }) => void} */
        const ghostLayer = ({ stack, model, getView }) => {
            stack.add({
                id: "ghost", label: "real grid", z: 8, group: "Pentagrid",
                visible: () => !!opt("dual-ghost")?.checked,
                /** @type {(f: { ctx: CanvasRenderingContext2D, w: number, h: number,
                 *                cx: number, cy: number }) => void} */
                draw: ({ ctx, w, h, cx, cy }) => {
                    const v = getView();
                    const gain = 5 / 2;
                    const reach = Math.hypot(w, h) / v.scale;
                    // Dashed and pale: at the limit the two grids agree to about
                    // two degrees, so solid gray lines read as a doubled grid
                    // rather than as a reference. Jake: "I'm seeing double lines".
                    ctx.strokeStyle = "#aab0be";
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 6]);
                    ctx.beginPath();
                    for (let j = 0; j < 5; j++) {
                        const a = (2 * Math.PI * j) / 5 + Math.PI / 2;
                        const ux = Math.cos(a), uy = Math.sin(a);
                        const mid = (v.x * ux + v.y * uy) / gain;
                        const lo = Math.floor(mid - reach / gain), hi = Math.ceil(mid + reach / gain);
                        for (let n = lo; n <= hi; n++) {
                            const d = gain * (n - (model.gamma[j] ?? 0));
                            // the line x·u = d, drawn across the canvas
                            const px = d * ux, py = d * uy;
                            const tx = -uy * reach, ty = ux * reach;
                            const A = [cx + (px - tx - v.x) * v.scale, cy - (py - ty - v.y) * v.scale];
                            const B = [cx + (px + tx - v.x) * v.scale, cy - (py + ty - v.y) * v.scale];
                            ctx.moveTo(A[0], A[1]);
                            ctx.lineTo(B[0], B[1]);
                        }
                    }
                    ctx.stroke();
                    ctx.setLineDash([]);
                },
            });
        };

        handle = createPentagrid({
            container: gridHost,
            containerP: tileHost,
            panel: byId("dual-grid-panel"),
            panelP: byId("dual-tiles-panel"),
            directions: normals,
            edges,
            // The cast the TypeScript carried too: the layer hook's parameter
            // is the whole PentagridParts and this uses three of its fields.
            // Narrowing it properly is a change to the view's own types.
            layers: /** @type {never} */ (ghostLayer),
            features: {
                gridLines: true, intersectionDots: true, center: true, axes: false,
                penroseTiles: true, penroseEdges: true,
            },
        });
        // λ: the grid's line spacing, per family. The geometry is written for one
        // λ, so unequal spacing is expressed where it is equivalent — as a shift
        // of each family's own scale — and reported rather than faked.
        handle.gamma.setLocked(-1);
        handle.gamma.setValues(new Array(5).fill(0.2));
        const { panel } = mountFloatingReticulum(handle.gamma, {
            colors: COLORS, buttons: handle.panelRow("View") ?? document.body,
        });
        panel.setTitle(real ? "Reticulum · real" : "Reticulum · quadrille");
        teardown = () => { panel.element.remove(); };

        const [g1, g2] = gains(edges);
        const angles = shapeAngles(dirs);
        const distinct = [...new Set(angles)];
        /** @type {(id: string, text: string) => void} */
        const say = (id, text) => { const el = byId(id); if (el) el.textContent = text; };
        say("dual-shapes", `${distinct.length} — ${distinct.map((a) => a.toFixed(4) + "°").join(", ")}`);
        const lattice = !real && halves >= 0 && raw.every(([x, y]) => x === Math.round(x) && y === Math.round(y));
        say("dual-period", lattice
            ? `rational: ${raw.map(([x, y]) => `(${x},${y})`).join(" ")} — the tiling is PERIODIC`
            : real ? "irrational — aperiodic (the pentagrid)"
                   : "irrational — aperiodic (the limit)");
        const sum = dirs.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
        say("dual-sum", `(${sum[0].toFixed(4)}, ${sum[1].toFixed(4)})`
            + (Math.hypot(...sum) < 1e-9 ? "  — zero: ΣK is a height function"
                                         : "  — not zero: ΣK drifts, no lift"));
        say("dual-gains", `${g1.toFixed(4)} and ${g2.toFixed(4)}`
            + (Math.abs(g1 - g2) < 1e-9 ? "  (equal: a similarity, gain n/2)" : `  — ${(100 * (g1 / g2 - 1)).toFixed(2)}% apart, so the dual map shears`));
        say("dual-spacings", spaced ? lengths.map((v) => v.toFixed(4)).join("  ") : "1  1  1  1  1");
        say("dual-edges-out", wheelEdges
            ? lengths.map((v) => v.toFixed(4)).join("  ") + "  — parallelograms, unequal sides"
            : "1  1  1  1  1  — rhombs");
    };

    for (const id of ["dual-geometry", "dual-spacing", "dual-edges", "dual-ghost"]) {
        byId(id)?.addEventListener("change", build);
    }
    byId("dual-gen")?.addEventListener("input", build);
    build();
}
