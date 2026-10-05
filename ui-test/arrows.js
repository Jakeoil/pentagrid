// A bench for the edge arrows: shape, size and color, on the tiles they sit on.
//
// Ported from coylean-map's arrows-test-page.js, which tuned an arrow against a
// diamond by four numbers — SW the shaft half-width, HL the head length, HW the
// head half-width, ND the notch where the head meets the shaft — plus a MARGIN
// pulling both ends in. That parameterization is the useful part and it is kept.
// What changes is the host and the question: here the arrow lies along a rhomb
// EDGE, between two vertex dots, in de Bruijn's two colors, and the point is to
// find a shape and a pair of colors worth moving into drawColoredArrows.
//
// Two shapes are drawn side by side on purpose. `outline` is one filled path,
// arrow.svg's shape: a round-capped shaft with a notched triangular head.
// `stroke + head` is what the page draws today, a stroked line with a separate
// filled triangle — which is why its shaft and head never quite agree.
//
// The AR pattern is not invented here: rhombArrows is imported, so the doubles
// and singles fall where the tiling actually puts them. `extAt` is passed
// explicitly, which is the one thing a synthetic tile cannot derive.

import { rhombArrows } from "../dist/geometry/decor.js";

const SVG = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}) => {
    const n = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
};

// ── The arrow ─────────────────────────────────────────────────────────

/**
 * One filled outline along A -> B, arrow.svg's shape.
 *
 * UNIDIRECTIONAL, always. "Double" and "single" are the names of de Bruijn's
 * two markings, not a count of heads: an edge carries one arrow either way and
 * the color is the whole distinction. Jake, with the diagram: the arrows are
 * unidirectional.
 *
 * Built in the edge's own frame — t along it, s across — so it works at any
 * angle, which the original's separate down/right paths did not need to. Both
 * ends are pulled in by MARGIN: the tail's round cap and the head's tip, which
 * is the treatment the page already gives them, and at MARGIN = the vertex
 * mark's radius the tip lands exactly on the circle round the index.
 */
export function outlinePath(A, B, p) {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const P = (t, s) => `${(A[0] + ux * t + nx * s).toFixed(2)},${(A[1] + uy * t + ny * s).toFixed(2)}`;
    const { MARGIN: m, SW, HL, HW, ND } = p;
    const l = m, r = len - m;
    if (r - l < HL + 1) return null;                         // no room for the head
    // The tail is a half-round cap, which is what keeps a thin arrow from
    // looking cut off. Sweep flag 0: the arc bulges backwards, away from the head.
    return `M${P(l, -SW)} A${SW},${SW} 0 0 0 ${P(l, SW)} L${P(r - HL + ND, SW)} `
        + `${P(r - HL, HW)} ${P(r, 0)} ${P(r - HL, -HW)} ${P(r - HL + ND, -SW)}Z`;
}

/** Today's drawing, for comparison: a stroked shaft and a separate head. */
export function strokeParts(A, B, p) {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const { MARGIN: m, SW, HL, HW } = p;
    const l = m, r = len - m;
    const at = (t, s) => [A[0] + ux * t + nx * s, A[1] + uy * t + ny * s];
    const heads = [[r, 1]];
    return {
        shaft: [at(l, 0), at(r - HL * 0.8, 0)],
        width: 2 * SW,
        heads: heads.map(([t, dir]) => [
            at(t, 0), at(t - dir * HL, HW), at(t - dir * HL, -HW),
        ]),
    };
}

// ── The hosts ─────────────────────────────────────────────────────────

/** A rhomb of unit edge `e`, its first vertex at the origin, centered after. */
function rhomb(e, deg) {
    const a = (deg * Math.PI) / 180;
    const u = [e, 0], v = [e * Math.cos(a), e * Math.sin(a)];
    const pts = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v];
    const cx = (pts[0][0] + pts[2][0]) / 2, cy = (pts[0][1] + pts[2][1]) / 2;
    return pts.map(([x, y]) => [x - cx, y - cy]);
}

/** A bare edge, horizontal, as its own two-point "tile". */
function bareEdge(e) {
    return [[-e / 2, 0], [e / 2, 0]];
}

// ── Presets ───────────────────────────────────────────────────────────
//
// Seeded from what drawColoredArrows draws now, read back as fractions of a
// unit edge: HEAD 0.163, HALF 0.054, SHAFT 0.034, and an inset of 6 px which at
// a typical scale is about 0.08 of the edge. ND has no counterpart there — the
// notch is the thing today's shape is missing — so it is seeded at half of SW.

const BASE = { SW: 0.034, HL: 0.163, HW: 0.054, ND: 0.017, MARGIN: 0.08 };
const DEFAULTS = [
    { name: "hairline", label: "Hairline", k: 0.6 },
    { name: "current", label: "Current", k: 1 },
    { name: "fuller", label: "Fuller", k: 1.5 },
    { name: "bold", label: "Bold", k: 2.2 },
];

const PALETTES = [
    { name: "today", double: "#3aa655", single: "#e0423c" },
    { name: "deeper", double: "#1b7f4b", single: "#b3322c" },
    { name: "ink", double: "#2f6f4f", single: "#8c3b4a" },
    { name: "cool/warm", double: "#2a7f8f", single: "#d2691e" },
];

export function init() {
    const svg = document.getElementById("gallery");
    const presetHost = document.getElementById("preset-controls");
    const jsonOut = document.getElementById("json-out");
    const byId = (id) => document.getElementById(id);

    const state = {
        edge: +byId("edge").value,
        dot: +byId("dot").value,
        indexR: +byId("indexR").value,
        mark: "index",       // dot | index — what sits at a vertex
        host: "thick",       // thick | thin | both | edge
        form: "pattern",     // pattern | single | double
        shape: "both",       // outline | stroke | both
        double: PALETTES[0].double,
        single: PALETTES[0].single,
        presets: DEFAULTS.map((p) => ({ ...p, ...scaled(p.k) })),
    };

    /** A preset in pixels at the current edge length. */
    function px(p) {
        const e = state.edge;
        return { SW: p.SW * e, HL: p.HL * e, HW: p.HW * e, ND: p.ND * e, MARGIN: p.MARGIN * e };
    }

    /**
     * The margin that puts both ends exactly on the vertex mark.
     *
     * Jake: the arrow point should end at the circle around the circled index
     * number. So the margin IS the mark's radius — the tip touches the circle
     * — and the tail's round cap gets the same treatment at the other end.
     */
    function clearMargin() {
        return +(markRadius() / state.edge).toFixed(4);
    }

    /** The hint span of each card, kept rather than looked up. */
    const hintSpans = [];

    function buildPresetControls() {
        presetHost.replaceChildren();
        hintSpans.length = 0;
        state.presets.forEach((p, idx) => {
            const card = document.createElement("div");
            card.className = "preset-card";
            const head = document.createElement("h3");
            head.textContent = p.label;
            const hint = document.createElement("span");
            hint.className = "hint";
            head.appendChild(hint);
            hintSpans[idx] = hint;
            card.appendChild(head);

            const fields = document.createElement("div");
            fields.className = "fields";
            const inputs = {};
            for (const [key, step] of [["SW", 0.002], ["HL", 0.005], ["HW", 0.002],
                                       ["ND", 0.002], ["MARGIN", 0.005]]) {
                const label = document.createElement("label");
                label.appendChild(document.createTextNode(key));
                const inp = document.createElement("input");
                inp.type = "number";
                inp.step = String(step);
                inp.value = String(p[key]);
                inp.addEventListener("input", () => {
                    state.presets[idx][key] = +inp.value;
                    hints();
                    render();
                });
                label.appendChild(inp);
                fields.appendChild(label);
                inputs[key] = inp;
            }
            card.appendChild(fields);

            const clear = document.createElement("button");
            clear.className = "btn clear";
            clear.textContent = "\u2190 stop at the mark";
            clear.addEventListener("click", () => {
                const pp = state.presets[idx];
                pp.MARGIN = clearMargin();
                inputs.MARGIN.value = String(pp.MARGIN);
                hints();
                render();
            });
            card.appendChild(clear);
            presetHost.appendChild(card);
        });
        hints();
    }

    /** Whether each preset's tail clears the vertex dot, and by how much. */
    function hints() {
        hintSpans.forEach((span, idx) => {
            const p = state.presets[idx];
            const d = +((p.MARGIN - clearMargin()) * state.edge).toFixed(1);
            span.textContent = d === 0 ? " (on the mark)"
                : d < 0 ? ` (over the mark ${-d}px)` : ` (short by ${d}px)`;
            span.style.color = d === 0 ? "#16a34a" : d < 0 ? "#9a4a4a" : "#5a8aaa";
        });
    }

    /** Every arrow to draw on one host, as {A, B, double}. */
    function arrowsOn(host, verts) {
        if (host === "edge") {
            const [A, B] = verts;
            if (state.form === "double") return [{ A, B, double: true }];
            if (state.form === "single") return [{ A, B, double: false }];
            return [{ A, B, double: false }, { A, B, double: true, offset: true }];
        }
        if (state.form !== "pattern") {
            return verts.map((A, i) => ({
                A, B: verts[(i + 1) % 4], double: state.form === "double",
            }));
        }
        // The real pattern: rhombArrows places the doubles at the extreme
        // corner and the singles opposite, and returns each arrow as a midpoint
        // plus a direction, which is turned back into the two ends here.
        const thick = host === "thick";
        const list = rhombArrows({}, { vertices: verts, thick }, 1, 4, 0);
        return list.map((a, i) => {
            const A = verts[i], B = verts[(i + 1) % 4];
            const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
            const tail = [a.x - (a.dx * len) / 2, a.y - (a.dy * len) / 2];
            const tip = [a.x + (a.dx * len) / 2, a.y + (a.dy * len) / 2];
            return { A: tail, B: tip, double: a.double };
        });
    }

    /**
     * The mark at a vertex, and the radius the arrow must stop at.
     *
     * Two of them, matching the view: the red dot, or the de Bruijn index in a
     * white circle. The tip is supposed to land ON that circle, so the bench
     * draws the real thing rather than a stand-in — a rhomb's corners run
     * m, m+1, m+2, m+1, which is 1 2 3 2 with the extreme at corner 0.
     */
    function markRadius() {
        return state.mark === "index" ? state.indexR : state.dot;
    }
    function drawMarks(g, host, verts) {
        const LEVELS = [1, 2, 3, 2];
        verts.forEach(([x, y], i) => {
            if (state.mark === "dot" || host === "edge") {
                g.appendChild(el("circle", { cx: x, cy: y, r: state.dot, class: "dot" }));
                return;
            }
            g.appendChild(el("circle", { cx: x, cy: y, r: state.indexR, class: "indexmark" }));
            const t = el("text", { x, y: y + state.indexR * 0.36, class: "indexnum",
                                   "font-size": (state.indexR * 1.4).toFixed(1) });
            t.textContent = String(LEVELS[i % 4]);
            g.appendChild(t);
        });
    }

    function drawHost(g, host, verts, p, shape) {
        if (host === "edge") {
            g.appendChild(el("line", {
                x1: verts[0][0], y1: verts[0][1], x2: verts[1][0], y2: verts[1][1],
                class: "host-edge",
            }));
        } else {
            g.appendChild(el("polygon", {
                points: verts.map((v) => v.join(",")).join(" "),
                class: `host ${host}`,
            }));
        }
        for (const a of arrowsOn(host, verts)) {
            const color = a.double ? state.double : state.single;
            // On a bare edge the two markings are stacked rather than laid on
            // top of each other.
            const shift = a.offset ? 2.2 * p.SW + 6 : 0;
            const A = [a.A[0], a.A[1] + shift], B = [a.B[0], a.B[1] + shift];
            if (shape === "outline") {
                const d = outlinePath(A, B, p);
                if (d) g.appendChild(el("path", { d, fill: color }));
                continue;
            }
            const parts = strokeParts(A, B, p);
            g.appendChild(el("line", {
                x1: parts.shaft[0][0], y1: parts.shaft[0][1],
                x2: parts.shaft[1][0], y2: parts.shaft[1][1],
                stroke: color, "stroke-width": parts.width, "stroke-linecap": "round",
            }));
            for (const tri of parts.heads) {
                g.appendChild(el("polygon", {
                    points: tri.map((v) => v.map((n) => n.toFixed(2)).join(",")).join(" "),
                    fill: color,
                }));
            }
        }
        // The marks go on top: the question is whether the tip lands on one.
        drawMarks(g, host, verts);
    }

    const SHAPE_LABEL = { stroke: "before — stroke + head", outline: "after — one outline" };

    function render() {
        const hosts = state.host === "both" ? ["thick", "thin"] : [state.host];
        const shapes = state.shape === "both" ? ["stroke", "outline"] : [state.shape];
        const e = state.edge;
        const cellW = Math.max(2.3 * e, 190);
        const cellH = 1.9 * e + 56;
        const gutter = 118;                         // the row label's column
        const w = gutter + state.presets.length * cellW;
        const h = hosts.length * shapes.length * cellH;
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        svg.replaceChildren();

        let row = 0;
        for (const shape of shapes) {
            for (const host of hosts) {
                const top = row * cellH;
                const name = el("text", {
                    x: 10, y: top + cellH / 2, class: "rowlabel",
                });
                name.textContent = shapes.length > 1
                    ? `${SHAPE_LABEL[shape]}${hosts.length > 1 ? ` · ${host}` : ""}`
                    : host;
                svg.appendChild(name);
                state.presets.forEach((p, col) => {
                    const g = el("g", {
                        transform: `translate(${gutter + col * cellW + cellW / 2},`
                            + `${top + cellH / 2 - 14})`,
                    });
                    const verts = host === "edge" ? bareEdge(e)
                        : rhomb(e, host === "thick" ? 72 : 36);
                    drawHost(g, host, verts, px(p), shape);
                    const label = el("text", { x: 0, y: cellH / 2 - 6, class: "label" });
                    label.textContent = `${p.label} · SW ${(p.SW * e).toFixed(1)}px`;
                    g.appendChild(label);
                    svg.appendChild(g);
                });
                row++;
            }
        }
        writeJson();
    }

    /**
     * What to copy back into the view. Fractions of a unit edge are the real
     * answer — the canvas works in tiling units and scales — so those lead, and
     * the pixel values at the current edge come after as a sanity check.
     */
    function writeJson() {
        const e = state.edge;
        const out = { colors: { double: state.double, single: state.single }, presets: {} };
        for (const p of state.presets) {
            out.presets[p.name] = {
                ofEdge: { SW: p.SW, HL: p.HL, HW: p.HW, ND: p.ND, MARGIN: p.MARGIN },
                px: Object.fromEntries(Object.entries(px(p))
                    .map(([k, v]) => [k, +v.toFixed(2)])),
            };
        }
        jsonOut.textContent = JSON.stringify(out, null, 2);
    }

    // ── Controls ──────────────────────────────────────────────────────
    function group(ids, set) {
        const buttons = ids.map((id) => byId(id));
        buttons.forEach((b, i) => {
            b.onclick = () => {
                buttons.forEach((x) => x.classList.remove("active"));
                b.classList.add("active");
                set(ids[i].split("-").slice(1).join("-"));
                render();
            };
        });
    }
    group(["host-thick", "host-thin", "host-both", "host-edge"], (v) => { state.host = v; });
    group(["form-pattern", "form-single", "form-double"], (v) => { state.form = v; });
    group(["shape-both", "shape-stroke", "shape-outline"], (v) => { state.shape = v; });
    group(["mark-index", "mark-dot"], (v) => { state.mark = v; });

    for (const [id, key] of [["edge", "edge"], ["dot", "dot"], ["indexR", "indexR"]]) {
        byId(id).addEventListener("input", () => {
            state[key] = +byId(id).value;
            hints();
            render();
        });
    }
    for (const [id, key] of [["col-double", "double"], ["col-single", "single"]]) {
        byId(id).addEventListener("input", () => { state[key] = byId(id).value; render(); });
    }

    const palHost = byId("palettes");
    for (const pal of PALETTES) {
        const b = document.createElement("button");
        b.className = "btn swatch";
        for (const c of [pal.double, pal.single]) {
            const sw = document.createElement("span");
            sw.style.background = c;
            b.appendChild(sw);
        }
        b.appendChild(document.createTextNode(` ${pal.name}`));
        b.onclick = () => {
            state.double = pal.double;
            state.single = pal.single;
            byId("col-double").value = pal.double;
            byId("col-single").value = pal.single;
            render();
        };
        palHost.appendChild(b);
    }

    byId("copy").onclick = async () => {
        const btn = byId("copy");
        const orig = btn.textContent;
        try {
            await navigator.clipboard.writeText(jsonOut.textContent);
            btn.textContent = "Copied";
        } catch {
            btn.textContent = "Select it";
        }
        setTimeout(() => { btn.textContent = orig; }, 1200);
    };
    byId("reset").onclick = () => {
        state.presets = DEFAULTS.map((p) => ({ ...p, ...scaled(p.k) }));
        buildPresetControls();
        render();
    };

    buildPresetControls();
    render();
}

function scaled(k) {
    const r = (x) => +(x * k).toFixed(4);
    return { SW: r(BASE.SW), HL: r(BASE.HL), HW: r(BASE.HW), ND: r(BASE.ND), MARGIN: BASE.MARGIN };
}
