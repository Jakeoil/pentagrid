// The arrow bench's geometry. The page itself is a bench — buttons and a
// sidebar — but the path it generates is what will move into the view, so that
// part is tested here rather than looked at.

import test from "node:test";
import assert from "node:assert/strict";
import { outlinePath, strokeParts } from "../ui-test/arrows.js";

const P = { SW: 5, HL: 24, HW: 8, ND: 2.5, MARGIN: 12 };
const A = [0, 0], B = [200, 0];

/** Every coordinate pair in a path string. */
function points(d) {
    return [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)]
        .map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
}

test("the outline stays inside the edge's strip, between the two margins", () => {
    const d = outlinePath(A, B, P);
    assert.ok(d, "no path");
    assert.ok(d.endsWith("Z"), "the outline must close");
    for (const [x, y] of points(d)) {
        // The arc's radius pair is the one point that is not a position.
        if (Math.abs(x - P.SW) < 1e-9 && Math.abs(y - P.SW) < 1e-9) continue;
        assert.ok(x >= P.MARGIN - 1e-6 && x <= 200 - P.MARGIN + 1e-6,
                  `x ${x} outside the margins`);
        assert.ok(Math.abs(y) <= P.HW + 1e-6, `y ${y} wider than the head`);
    }
});

test("one head, at the far end, and a capped tail at the near one", () => {
    // Jake: the arrows are unidirectional. "Double" and "single" are the names
    // of the two markings, not a count of heads — the color is the distinction.
    const pts = points(outlinePath(A, B, P));
    const tipAt = (x) => pts.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1]) < 1e-6);
    assert.ok(tipAt(200 - P.MARGIN), "the tip is at the far margin");
    assert.ok(!tipAt(P.MARGIN), "and the tail is a cap, not a second tip");
    assert.equal(outlinePath(A, B, P).length, outlinePath(A, B, P).length);
    assert.equal(outlinePath.length, 3, "no doubleHeaded argument to pass");
});

test("the tip lands on the vertex mark when the margin is its radius", () => {
    // Which is the whole of "stop at the mark": the point ends at the circle
    // round the index, and the tail's cap gets the same treatment.
    for (const markR of [3, 9, 12]) {
        const pts = points(outlinePath(A, B, { ...P, MARGIN: markR }));
        const tip = pts.find((q) => Math.abs(q[1]) < 1e-6 && q[0] > 100);
        assert.ok(tip, `no tip at mark radius ${markR}`);
        assert.equal(+tip[0].toFixed(2), 200 - markR, "the tip is the mark away from the corner");
    }
});

test("it works at any angle, because it is built in the edge's own frame", () => {
    const len = 200;
    for (const deg of [0, 36, 72, 144, 216, 300]) {
        const a = (deg * Math.PI) / 180;
        const end = [len * Math.cos(a), len * Math.sin(a)];
        const pts = points(outlinePath(A, end, P));
        const ux = Math.cos(a), uy = Math.sin(a);
        for (const [x, y] of pts) {
            if (Math.abs(x - P.SW) < 1e-9 && Math.abs(y - P.SW) < 1e-9) continue;
            const t = x * ux + y * uy, s = -x * uy + y * ux;
            // The path is written to two decimals, so a coordinate can land
            // half a hundredth outside what it was computed as.
            const eps = 0.01;
            assert.ok(t >= P.MARGIN - eps && t <= len - P.MARGIN + eps, `t ${t} at ${deg}`);
            assert.ok(Math.abs(s) <= P.HW + eps, `s ${s} at ${deg}`);
        }
    }
});

test("no room, no arrow: a head that will not fit returns null", () => {
    const tiny = [0, 0], near = [30, 0];
    assert.equal(outlinePath(tiny, near, { ...P, HL: 40 }), null,
                 "a 40px head cannot fit in 30px of edge");
    assert.ok(outlinePath(tiny, near, { ...P, HL: 4, MARGIN: 2 }), "but a small one can");
});

test("the stroke shape pulls its shaft under the head, so the cap never shows", () => {
    const s = strokeParts(A, B, P);
    assert.equal(s.width, 2 * P.SW);
    assert.ok(s.shaft[1][0] < 200 - P.MARGIN, "the shaft stops short of the tip");
    assert.equal(s.heads.length, 1, "one head here too: the comparison has to be fair");
});

// ── the bench itself ──────────────────────────────────────────────────

import "./domstub.mjs";
import { init } from "../ui-test/arrows.js";

test("the bench builds, draws, and survives every control", () => {
    const gallery = globalThis.document.getElementById("gallery");
    const out = globalThis.document.getElementById("json-out");
    const cards = globalThis.document.getElementById("preset-controls");
    init();

    assert.ok(gallery.children.length > 0, "nothing drawn");
    assert.equal(cards.children.length, 4, "four presets");
    assert.ok(String(out.textContent).includes("ofEdge"),
              "the export leads with the fractions, which is what the view wants");

    // Every button and every number, in turn. The host and shape toggles change
    // what is drawn, so the gallery has to be rebuilt each time and not grow.
    const first = gallery.children.length;
    for (const id of ["host-thin", "host-both", "host-edge", "host-thick",
                      "form-single", "form-double", "form-pattern",
                      "shape-stroke", "shape-outline", "shape-both",
                      "mark-dot", "mark-index"]) {
        const b = globalThis.document.getElementById(id);
        for (const fn of b.on?.click ?? []) fn({});
        if (b.onclick) b.onclick({});
        assert.ok(gallery.children.length > 0, `${id} emptied the stage`);
    }
    assert.ok(gallery.children.length === first, "the stage is rebuilt, not appended to");

    for (const id of ["edge", "dot", "indexR", "col-double", "col-single"]) {
        const inp = globalThis.document.getElementById(id);
        inp.value = id === "edge" ? "90" : id === "dot" ? "4"
            : id === "indexR" ? "9" : "#123456";
        for (const fn of inp.on?.input ?? []) fn({});
    }
    assert.ok(String(out.textContent).includes("#123456"), "the colors go into the export");

    // A preset's own fields, and the clear-the-dot button.
    const card = cards.children[1];
    // A label holds its text node and then its input, so the input is last.
    const fieldInput = (label) => label.children.at(-1);
    const inputs = card.children[1].children.map(fieldInput);
    assert.equal(inputs.length, 5, "SW HL HW ND MARGIN");
    inputs[0].value = "0.05";
    for (const fn of inputs[0].on?.input ?? []) fn({});
    const clear = card.children[2];
    for (const fn of clear.on?.click ?? []) fn({});
    // Stop at the mark: the margin IS the mark's radius, in edge fractions, so
    // the point ends on the circle round the index.
    assert.equal(+inputs[4].value, +(9 / 90).toFixed(4),
                 "stop at the mark = the index circle's radius over the edge");

    // And reset puts the seeds back.
    const reset = globalThis.document.getElementById("reset");
    if (reset.onclick) reset.onclick({});
    const back = cards.children[1].children[1].children.map(fieldInput);
    assert.equal(+back[0].value, 0.034, "Current seeds SW from what the view draws now");
});
