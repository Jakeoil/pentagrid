// Tests for the canvas containers: createGrowthView and createRegionPanel.
//
// Both own their canvases and hand back a handle, the way createPentagrid does,
// so a page can stay a page. These drive them with no page anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createGrowthView } from "../dist/view/growth.js";
import { createRegionPanel } from "../dist/view/region-panel.js";
import { polygonArea, pointInPolygon, convexBoundary } from "../dist/geometry/acceptance.js";

function host(w = 800, h = 600) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: () => null,
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}

// ── the growth view ───────────────────────────────────────────────

test("growth view builds a pentagrid and its own layer", () => {
    const v = createGrowthView({ container: host() });
    assert.ok(v.pentagrid, "no pentagrid underneath");
    assert.ok(v.pentagrid.stack.get("growth"), "growth layer not registered");
    assert.ok(v.pentagrid.stack.groups().has("Exploration"));
});

test("flat and lifted are the same container, differing by config", () => {
    const flat = createGrowthView({ container: host(), lift: false });
    const roof = createGrowthView({ container: host(), lift: true });
    assert.equal(flat.get().fold, 0, "flat should start unfolded");
    assert.equal(roof.get().fold, 1, "lifted should start folded up");
    assert.equal(flat.get().elevation, Math.PI / 2, "flat should look straight down");
    assert.ok(roof.get().elevation < Math.PI / 2, "lifted should be tilted");
});

test("set patches state and leaves the rest alone", () => {
    const v = createGrowthView({ container: host() });
    v.set({ grow: 0.4 });
    v.set({ band: 0.9 });
    const s = v.get();
    assert.equal(s.grow, 0.4);
    assert.equal(s.band, 0.9);
    assert.equal(s.fold, 0, "set clobbered an untouched field");
});

test("get returns a copy, not the live state", () => {
    const v = createGrowthView({ container: host() });
    const s = v.get();
    s.grow = 99;
    assert.notEqual(v.get().grow, 99, "handed out its own state object");
});

test("redraw over the whole range of every control does not throw", () => {
    const v = createGrowthView({ container: host(), lift: true });
    for (const grow of [0, 0.01, 0.5, 0.995, 1])
        for (const fold of [0, 1])
            for (const band of [0, 0.5, 1.5]) {
                v.set({ grow, fold, band });
            }
    for (const elevation of [0.05, 0.8, Math.PI / 2])
        for (const azimuth of [0, 3.1, 6.28]) v.set({ elevation, azimuth });
    assert.ok(true);
});

// ── the region panel ──────────────────────────────────────────────

const SQUARE = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

test("region panel makes its own canvas in the container", () => {
    const c = host();
    const p = createRegionPanel({ container: c, size: 300 });
    assert.equal(c.children.length, 1);
    assert.equal(p.element.width, 300);
    assert.equal(p.element.height, 300);
});

test("inside tracks the point against the region", () => {
    const p = createRegionPanel({ container: host() });
    p.setRegion(SQUARE);
    p.setPoint(0, 0);
    assert.equal(p.inside(), true);
    p.setPoint(2, 2);
    assert.equal(p.inside(), false);
});

test("dragging reports world coordinates, not canvas pixels", () => {
    const seen = [];
    const p = createRegionPanel({
        container: host(), size: 400, span: 4,       // 100 px per unit
        onMove: (x, y) => seen.push([x, y]),
    });
    p.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 });
    p.element.on.mousedown[0]({ clientX: 200, clientY: 200 });   // dead centre
    // === rather than deepEqual: negating zero gives -0, which is
    // strictly-deep-unequal to 0 and identical to it everywhere that matters.
    const [cx0, cy0] = seen.at(-1);
    assert.ok(cx0 === 0 && cy0 === 0, `centre gave ${cx0},${cy0}`);
    p.element.on.mousemove[0]({ clientX: 300, clientY: 200 });   // 100 px right
    const [x, y] = seen.at(-1);
    assert.ok(Math.abs(x - 1) < 1e-9 && Math.abs(y) < 1e-9, `got ${x},${y}`);
});

test("getPoint hands back a copy", () => {
    const p = createRegionPanel({ container: host() });
    p.setPoint(1, 2);
    const a = p.getPoint();
    a[0] = 99;
    assert.equal(p.getPoint()[0], 1);
});

// ── the acceptance helpers ────────────────────────────────────────

test("polygon area and point-in-polygon agree with the obvious cases", () => {
    assert.ok(Math.abs(polygonArea(SQUARE) - 4) < 1e-12);
    assert.equal(pointInPolygon(SQUARE, 0, 0), true);
    assert.equal(pointInPolygon(SQUARE, 1.5, 0), false);
    assert.equal(pointInPolygon([], 0, 0), false, "an empty region contains nothing");
});

test("convexBoundary recovers a disc it is given", () => {
    const inside = (x, y) => Math.hypot(x, y) < 0.8;
    const poly = convexBoundary(inside, [0, 0], { rays: 200, reach: 2, bisections: 24 });
    for (const [x, y] of poly)
        assert.ok(Math.abs(Math.hypot(x, y) - 0.8) < 1e-5, `radius ${Math.hypot(x, y)}`);
    assert.ok(Math.abs(polygonArea(poly) - Math.PI * 0.64) < 1e-3);
});

// ── the world-to-screen mapping ───────────────────────────────────
// grow.html and roof.html could not be panned vertically: the projection applied
// viewX and silently dropped viewY.

import { projectToScreen } from "../dist/view/growth.js";

const FLAT = { azimuth: 0, elevation: Math.PI / 2 };

test("panning moves the picture on BOTH axes", () => {
    const p = [1, 2, 0];
    const base = projectToScreen(FLAT, p, { scale: 60, x: 0, y: 0 }, 400, 300);
    const right = projectToScreen(FLAT, p, { scale: 60, x: 0.5, y: 0 }, 400, 300);
    const up = projectToScreen(FLAT, p, { scale: 60, x: 0, y: 0.5 }, 400, 300);

    assert.notEqual(right.x, base.x, "viewX had no effect");
    assert.equal(right.y, base.y, "viewX should not move y");
    assert.notEqual(up.y, base.y, "viewY had no effect — this was the bug");
    assert.equal(up.x, base.x, "viewY should not move x");
});

test("flat and unspun, it is exactly the pentagrid's own transform", () => {
    // mathToScreen: [cx + (mx - viewX)*scale, cy - (my - viewY)*scale]
    const view = { scale: 43, x: -1.25, y: 2.5 };
    for (const [mx, my] of [[0, 0], [3, -2], [-7.5, 4.25]]) {
        const got = projectToScreen(FLAT, [mx, my, 0], view, 400, 300);
        assert.ok(Math.abs(got.x - (400 + (mx - view.x) * view.scale)) < 1e-9, `x at ${mx},${my}`);
        assert.ok(Math.abs(got.y - (300 - (my - view.y) * view.scale)) < 1e-9, `y at ${mx},${my}`);
    }
});

test("a drag moves the picture 1:1 whatever the camera is doing", () => {
    // pentagrid's pan does viewX -= dx/scale, viewY += dy/scale for a drag of
    // (dx, dy) screen pixels, so the picture must follow by exactly (dx, dy).
    const p = [2, -1, 1.5];
    const scale = 55, dx = 17, dy = -23;
    for (const cam of [FLAT, { azimuth: 0.9, elevation: 0.6 }, { azimuth: 4.2, elevation: 0.2 }]) {
        const a = projectToScreen(cam, p, { scale, x: 0, y: 0 }, 400, 300);
        const b = projectToScreen(cam, p, { scale, x: -dx / scale, y: dy / scale }, 400, 300);
        assert.ok(Math.abs((b.x - a.x) - dx) < 1e-9, `dx under ${JSON.stringify(cam)}`);
        assert.ok(Math.abs((b.y - a.y) - dy) < 1e-9, `dy under ${JSON.stringify(cam)}`);
    }
});

test("height only moves things when the camera is tilted off vertical", () => {
    const view = { scale: 60, x: 0, y: 0 };
    const flatLow = projectToScreen(FLAT, [1, 1, 0], view, 0, 0);
    const flatHigh = projectToScreen(FLAT, [1, 1, 3], view, 0, 0);
    assert.ok(Math.abs(flatHigh.y - flatLow.y) < 1e-9, "looking straight down, height is invisible");

    const tilt = { azimuth: 0, elevation: 0.6 };
    const tLow = projectToScreen(tilt, [1, 1, 0], view, 0, 0);
    const tHigh = projectToScreen(tilt, [1, 1, 3], view, 0, 0);
    assert.ok(tHigh.y < tLow.y, "tilted, higher must draw further up the screen");
});

// ── resizing ──────────────────────────────────────────────────────

import { LayerStack } from "../dist/view/layers.js";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { fireResize } from "./domstub.mjs";

test("LayerStack.resize reaches drawn and raw canvases alike", () => {
    const stack = new LayerStack(host(), 400, 300);
    const drawn = stack.add({ id: "a", label: "a", z: 1, draw: () => {} });
    const raw = stack.addRaw(9);
    stack.resize(640, 480);
    assert.equal(stack.w, 640);
    assert.equal(drawn.canvas.width, 640);
    assert.equal(drawn.canvas.height, 480);
    assert.equal(raw.canvas.width, 640, "a raw layer was left behind");
    assert.equal(raw.canvas.height, 480);
});

test("resize ignores a collapsed or unchanged box", () => {
    const stack = new LayerStack(host(), 400, 300);
    const l = stack.add({ id: "a", label: "a", z: 1, draw: () => {} });
    stack.resize(0, 300);
    assert.equal(stack.w, 400, "a zero width should be ignored, not applied");
    stack.resize(-5, -5);
    assert.equal(stack.w, 400);
    l.canvas.width = 111;                       // would be reset by a real resize
    stack.resize(400, 300);
    assert.equal(l.canvas.width, 111, "resize to the same size should do nothing");
});

function sizedHost(w, h, attrs = null) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: el._w, height: el._h }),
        getAttribute: (n) => (attrs ? (attrs[n] ?? null) : null),
    });
    el._w = w; el._h = h;
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}

test("an implicitly sized view follows its container", () => {
    const el = sizedHost(700, 500);
    const h = createPentagrid({ container: el });
    assert.equal(h.stack.w, 700);
    assert.equal(h.stack.h, 500);

    el._w = 940; el._h = 620;
    fireResize(el);

    assert.equal(h.stack.w, 940, "the stack did not follow the container");
    assert.equal(h.stack.h, 620);
    for (const l of h.stack.all()) assert.equal(l.canvas.width, 940);
});

test("an implicitly sized container is not pinned with px", () => {
    // Writing px onto the container overrides its own CSS, which is what kept
    // width:100% viewports from ever reflowing.
    const el = sizedHost(700, 500);
    createPentagrid({ container: el });
    assert.ok(!el.style.width, `container was pinned to ${el.style.width}`);
    assert.ok(!el.style.height);
});

test("a page that names a size keeps it, and is pinned", () => {
    const el = sizedHost(700, 500, { "data-width": "340", "data-height": "340" });
    const h = createPentagrid({ container: el });
    assert.equal(h.stack.w, 340, "an explicit size was not honoured");
    assert.equal(el.style.width, "340px", "an explicit size should pin the box");

    el._w = 900; el._h = 900;
    fireResize(el);
    assert.equal(h.stack.w, 340, "an explicitly sized view must not reflow");
});

test("bold edges is off by default and switchable", () => {
    const v = createGrowthView({ container: host() });
    assert.equal(v.get().boldEdges, false, "edges should start faint");
    v.set({ boldEdges: true });
    assert.equal(v.get().boldEdges, true);
    v.set({ grow: 0.7 });
    assert.equal(v.get().boldEdges, true, "an unrelated set cleared the switch");
});

test("drawing survives both edge settings at every stage", () => {
    for (const lift of [false, true]) {
        const v = createGrowthView({ container: host(), lift });
        for (const boldEdges of [false, true])
            for (const grow of [0, 0.5, 1]) v.set({ boldEdges, grow });
    }
    assert.ok(true);
});
