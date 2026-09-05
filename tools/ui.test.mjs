// Tests for the two reusable clusters. "Reusable" is a claim, and the way to
// check it is to drive them with no pentagrid anywhere in sight.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";
import { createGammaBank } from "../dist/ui/dials.js";
import { createLoupe } from "../dist/ui/loupe.js";

const COLORS = ["#a", "#b", "#c", "#d", "#e"];

// ── the γ bank ────────────────────────────────────────────────────

function bank(over = {}) {
    const seen = { changes: [], locks: [] };
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => seen.changes.push([i, v]),
        onLock: (i) => seen.locks.push(i),
        ...over,
    });
    // element children are the five dials plus the sum readout
    const dials = b.element.children.slice(0, 5);
    const inputs = dials.map((d) => d.children[1]);
    const labels = dials.map((d) => d.children[0]);
    return { b, seen, dials, inputs, labels };
}

test("builds one dial per value, plus a sum readout", () => {
    const { b } = bank();
    assert.equal(b.element.children.length, 6);
});

test("reports which slider moved, and to what", () => {
    const { seen, inputs } = bank();
    inputs[2].value = "0.75";
    inputs[2].on.input[0]();
    assert.deepEqual(seen.changes, [[2, 0.75]]);
});

test("reports a lock request without acting on it", () => {
    const { b, seen, labels } = bank();
    labels[3].on.click[0]();
    assert.deepEqual(seen.locks, [3]);
    // it did not lock anything itself — that is the page's call
    assert.equal(b.element.children[3].className, "dial");
});

test("sync renders the state it is given", () => {
    const { b, dials, inputs } = bank();
    b.sync({ values: [0.1, -0.2, 0.3, -0.4, 0.2], locked: 4, sum: 0 });
    assert.equal(dials[0].children[2].textContent, "0.10");
    assert.equal(dials[4].className, "dial computed");
    assert.equal(dials[0].className, "dial");
    assert.equal(inputs[4].disabled, true);
    assert.equal(inputs[0].disabled, false);
});

test("sync writes back only to the computed slider", () => {
    const { b, inputs } = bank();
    inputs[0].value = "MIDDRAG";
    inputs[4].value = "stale";
    b.sync({ values: [1, 0, 0, 0, -1], locked: 4, sum: 0 });
    assert.equal(inputs[0].value, "MIDDRAG", "wrote back over a slider being dragged");
    assert.equal(inputs[4].value, "-1.00");
});

test("the bank knows nothing about what the constraint is", () => {
    // Σ is whatever the page says it is; the bank just prints it.
    const { b } = bank();
    b.sync({ values: [9, 9, 9, 9, 9], locked: 0, sum: 45 });
    assert.equal(b.element.children[5].textContent, "Σ = 45.0000");
});

// ── the loupe ─────────────────────────────────────────────────────

function loupe(over = {}) {
    const container = { children: [], appendChild(c) { this.children.push(c); return c; } };
    const seen = { renders: [], hovers: [] };
    const l = createLoupe({
        container,
        render: (ctx, view, size) => seen.renders.push({ view: { ...view }, size }),
        onHover: (x, y) => { seen.hovers.push([x, y]); return "hi"; },
        ...over,
    });
    return { l, seen, container };
}

test("starts closed and invisible", () => {
    const { l, seen } = loupe();
    assert.equal(l.view, null);
    assert.equal(l.element.style.display, "none");
    assert.equal(seen.renders.length, 0);
});

test("open scales the host's scale by the target's magnification", () => {
    const { l, seen } = loupe();
    l.open({ x: 2, y: -3, mag: 40, label: "region" }, 60);
    assert.deepEqual(l.view, { x: 2, y: -3, scale: 2400 });
    assert.equal(l.element.style.display, "block");
    assert.equal(seen.renders.at(-1).view.scale, 2400);
    assert.equal(seen.renders.at(-1).size, 220);
});

test("re-opening the same target does not re-latch the magnification", () => {
    const { l } = loupe();
    l.open({ x: 1, y: 1, mag: 10, label: "a" }, 60);
    l.open({ x: 1, y: 1, mag: 900, label: "a" }, 60);
    assert.equal(l.view.scale, 600, "magnification moved under the cursor");
    // a different target does retarget
    l.open({ x: 2, y: 1, mag: 900, label: "b" }, 60);
    assert.equal(l.view.scale, 54000);
});

test("close hides it and forgets the view", () => {
    const { l } = loupe();
    l.open({ x: 0, y: 0, mag: 10, label: "x" }, 60);
    l.close();
    assert.equal(l.view, null);
    assert.equal(l.element.style.display, "none");
});

test("entering freezes it; leaving releases", () => {
    const { l } = loupe();
    l.open({ x: 0, y: 0, mag: 10, label: "x" }, 60);
    assert.equal(l.frozen, false);
    l.element.on.mouseenter[0]();
    assert.equal(l.frozen, true, "entering must latch, or travelling to it retargets");
    l.element.on.mouseleave[0]();
    assert.equal(l.frozen, false);
});

test("hovering inside reports host coordinates, not panel pixels", () => {
    const { l, seen } = loupe();
    l.open({ x: 5, y: 5, mag: 1, label: "x" }, 100);   // scale 100, size 220
    l.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 220 });
    l.element.on.mousemove[0]({ clientX: 110, clientY: 110 });   // dead centre
    assert.deepEqual(seen.hovers.at(-1), [5, 5], "centre of the panel is the target");
    l.element.on.mousemove[0]({ clientX: 210, clientY: 110 });   // 100px right
    const [hx, hy] = seen.hovers.at(-1);
    assert.ok(Math.abs(hx - 6) < 1e-9, `x ${hx}`);   // 100px at scale 100 = 1 unit
    assert.ok(Math.abs(hy - 5) < 1e-9, `y ${hy}`);
});

test("it is not told what it is magnifying", () => {
    // the whole point: no pentagrid was imported by this file's loupe tests
    const { l, seen } = loupe({ render: (ctx, view, size) => seen.renders.push(size) });
    l.open({ x: 0, y: 0, mag: 3, label: "anything at all" }, 1);
    assert.equal(seen.renders.at(-1), 220);
});
