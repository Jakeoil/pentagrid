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
