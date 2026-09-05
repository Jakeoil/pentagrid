// Tests for the layer stack — in particular that a layer can be registered from
// outside the code that built the stack, which is the whole point of stage 4.
// Without that an exploration page cannot have its own content layer without
// importing the method page.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";                      // installs globalThis.document
import { LayerStack } from "../dist/view/layers.js";

function makeContainer() {
    return { children: [], appendChild(c) { this.children.push(c); return c; } };
}
const spec = (id, over = {}) => ({
    id, label: id, z: 10, draw: () => {}, ...over,
});

test("add registers a canvas of the stack's size at the requested z", () => {
    const container = makeContainer();
    const stack = new LayerStack(container, 640, 480);
    const l = stack.add(spec("a", { z: 42 }));
    assert.equal(container.children.length, 1);
    assert.equal(l.canvas.width, 640);
    assert.equal(l.canvas.height, 480);
    assert.equal(l.canvas.style.zIndex, "42");
    assert.equal(stack.get("a"), l);
    assert.equal(stack.get("nope"), undefined);
});

test("groups section by group, keep declaration order, and skip the ungrouped", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    stack.add(spec("g0", { group: "Grid" }));
    stack.add(spec("p0", { group: "Penrose" }));
    stack.add(spec("g1", { group: "Grid" }));
    stack.add(spec("plain"));                       // no group: no toggle
    const groups = stack.groups();
    assert.deepEqual([...groups.keys()], ["Grid", "Penrose"]);
    assert.deepEqual(groups.get("Grid").map((l) => l.id), ["g0", "g1"]);
    assert.deepEqual(groups.get("Penrose").map((l) => l.id), ["p0"]);
    assert.ok(![...groups.values()].flat().some((l) => l.id === "plain"));
});

test("drawAll honours the visible predicate, re-read every time", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    let want = false;
    let drawn = 0;
    stack.add(spec("x", { visible: () => want, draw: () => { drawn++; } }));

    stack.drawAll();
    assert.equal(drawn, 0, "drew a layer that did not want to be drawn");

    want = true;
    stack.drawAll();
    assert.equal(drawn, 1, "predicate is evaluated at draw time, not at add time");
});

test("userVisible overrides a layer that otherwise wants to be drawn", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    let drawn = 0;
    const l = stack.add(spec("x", { visible: () => true, draw: () => { drawn++; } }));
    stack.drawAll();
    assert.equal(drawn, 1);
    l.userVisible = false;
    stack.drawAll();
    assert.equal(drawn, 1, "userVisible did not veto");
    assert.equal(l.canvas.style.display, "none");
});

test("a hidden layer is hidden, not cleared and redrawn", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    let cleared = 0;
    const l = stack.add(spec("x", { visible: () => false }));
    l.ctx.clearRect = () => { cleared++; };
    stack.drawAll();
    assert.equal(cleared, 0, "hiding should cost nothing");
});

test("the canvas is cleared before each draw, so layers need not remember to", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    const events = [];
    const l = stack.add(spec("x", { draw: () => events.push("draw") }));
    l.ctx.clearRect = () => events.push("clear");
    stack.drawAll();
    assert.deepEqual(events, ["clear", "draw"]);
});

test("opacity is a predicate too, and lands on the canvas", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    let alpha = 0.25;
    const l = stack.add(spec("x", { opacity: () => alpha }));
    stack.drawAll();
    assert.equal(l.canvas.style.opacity, "0.25");
    alpha = 1;
    stack.drawAll();
    assert.equal(l.canvas.style.opacity, "1");
});

test("setGroupZ moves a whole group, keeping its internal order", () => {
    const stack = new LayerStack(makeContainer(), 100, 100);
    stack.add(spec("grid", { z: 10, group: "Grid" }));
    const a = stack.add(spec("pa", { z: 30, group: "Penrose" }));
    const b = stack.add(spec("pb", { z: 31, group: "Penrose" }));

    stack.setGroupZ("Penrose", 6);               // behind the grid
    assert.deepEqual([a.z, b.z], [6, 7]);
    assert.equal(a.canvas.style.zIndex, "6");
    assert.ok(a.z < stack.get("grid").z, "group did not move behind");

    stack.setGroupZ("Penrose", 30);              // and back in front
    assert.deepEqual([a.z, b.z], [30, 31]);
    assert.ok(a.z > stack.get("grid").z);
});

test("addRaw makes a canvas the stack sizes but never draws", () => {
    const container = makeContainer();
    const stack = new LayerStack(container, 100, 100);
    const raw = stack.addRaw(55);
    assert.equal(container.children.length, 1);
    assert.equal(raw.canvas.style.zIndex, "55");
    assert.equal(stack.all().length, 0, "raw layers are not part of the draw order");
});

// ── the reason stage 4 exists ─────────────────────────────────────

test("an exploration can register its own layer after the fact", () => {
    const container = makeContainer();
    const stack = new LayerStack(container, 800, 800);

    // what a page builds for itself
    stack.add(spec("grid-0", { z: 10, group: "Pentagrid" }));
    stack.add(spec("penrose-tiles", { z: 30, group: "Penrose" }));

    // what an exploration adds, knowing nothing about the above
    let ribbonsDrawn = 0;
    let showRibbons = true;
    const ribbons = stack.add({
        id: "ribbons", label: "Ribbons", z: 40, group: "Exploration",
        visible: () => showRibbons,
        draw: (c) => {
            ribbonsDrawn++;
            // it gets the context it needs and nothing it does not
            assert.equal(c.w, 800);
            assert.equal(c.cx, 400);
            assert.ok(typeof c.ctx.beginPath === "function");
        },
    });

    stack.drawAll();
    assert.equal(ribbonsDrawn, 1);

    // and it gets a panel section for free — nobody edited the panel code
    const groups = stack.groups();
    assert.deepEqual([...groups.keys()], ["Pentagrid", "Penrose", "Exploration"]);
    assert.deepEqual(groups.get("Exploration").map((l) => l.label), ["Ribbons"]);

    // the toggle the panel would wire up behaves like any other layer's
    ribbons.userVisible = false;
    stack.drawAll();
    assert.equal(ribbonsDrawn, 1, "the generated toggle does not actually gate it");
});
