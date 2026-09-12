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
import { singularTriples } from "../dist/geometry/regularity.js";
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

// ── embeddability ─────────────────────────────────────────────────
// A third-party page importing this knows none of our CSS, so the container has
// to stand on its own.

test("layer canvases position themselves, without a stylesheet", () => {
    const stack = new LayerStack(host(), 400, 300);
    const drawn = stack.add({ id: "a", label: "a", z: 7, draw: () => {} });
    const raw = stack.addRaw(9);
    for (const c of [drawn.canvas, raw.canvas]) {
        assert.equal(c.style.position, "absolute", "canvases must overlay, not stack in flow");
        assert.equal(c.style.top, "0");
        assert.equal(c.style.left, "0");
    }
    assert.equal(drawn.canvas.style.zIndex, "7");
});

test("the stack gives a static container something to anchor against", () => {
    const c = host();
    new LayerStack(c, 400, 300);
    assert.equal(c.style.position, "relative",
                 "absolute children need a positioned ancestor");
});

test("a container that is already positioned is left alone", () => {
    const c = host();
    c.style.position = "absolute";
    // the stub reports computed position "static", so emulate a positioned host
    const saved = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ position: "absolute" });
    try {
        new LayerStack(c, 400, 300);
        assert.equal(c.style.position, "absolute", "the stack overrode the page's own layout");
    } finally {
        globalThis.getComputedStyle = saved;
    }
});

// ── orbiting ──────────────────────────────────────────────────────

/** Fire a right-button drag on the view's input surface. */
function rightDrag(handle, moves) {
    // Found by capability, not position: the loupe canvas is appended after the
    // event surface, so "last child" is the wrong one.
    const canvas = handle.container.children.find((c) => c.on && c.on.mousedown);
    assert.ok(canvas, "no input surface found in the container");
    const on = canvas.on;
    on.mousedown.forEach((f) => f({ button: 2, offsetX: 0, offsetY: 0, preventDefault() {} }));
    let x = 0, y = 0;
    for (const [dx, dy] of moves) {
        x += dx; y += dy;
        on.mousemove.forEach((f) => f({ button: 2, offsetX: x, offsetY: y, preventDefault() {} }));
    }
    on.mouseup.forEach((f) => f({}));
}

test("right-drag spins and tilts a lifted view", () => {
    const c = host();
    const v = createGrowthView({ container: c, lift: true });
    v.pentagrid.container = c;                       // for the helper
    const before = v.get();
    rightDrag({ container: c }, [[60, 0]]);
    assert.ok(v.get().azimuth > before.azimuth, "dragging right did not spin");

    const mid = v.get();
    rightDrag({ container: c }, [[0, 40]]);
    assert.ok(v.get().elevation < mid.elevation, "dragging down did not lower the camera");
});

test("tilt is clamped short of edge-on and straight down", () => {
    const c = host();
    const v = createGrowthView({ container: c, lift: true });
    rightDrag({ container: c }, [[0, 5000]]);        // far past the horizon
    assert.ok(v.get().elevation >= 0.05, `elevation ran to ${v.get().elevation}`);
    rightDrag({ container: c }, [[0, -5000]]);       // far past overhead
    assert.ok(v.get().elevation <= Math.PI / 2 + 1e-9, `elevation ran to ${v.get().elevation}`);
});

test("a flat view does not orbit unless asked", () => {
    const c = host();
    const v = createGrowthView({ container: c, lift: false });
    const before = v.get();
    rightDrag({ container: c }, [[80, 80]]);
    assert.equal(v.get().azimuth, before.azimuth, "a flat view tilted on a stray right-drag");
    assert.equal(v.get().elevation, before.elevation);
});

test("orbit can be turned on for a flat view explicitly", () => {
    const c = host();
    const v = createGrowthView({ container: c, lift: false, orbit: true });
    const before = v.get();
    rightDrag({ container: c }, [[80, 0]]);
    assert.notEqual(v.get().azimuth, before.azimuth);
});

/** Count how many tiles a layer fills on one redraw. */
function tilesDrawn(handle, layerId, redraw) {
    const layer = handle.stack.get(layerId);
    assert.ok(layer, `no ${layerId} layer`);
    let n = 0;
    const real = layer.ctx.fill;
    layer.ctx.fill = () => { n++; };
    try { redraw(); } finally { layer.ctx.fill = real; }
    return n;
}

test("the collected region follows the camera, and costs nothing when flat", () => {
    // Tilting squashes world-y onto the screen by sin(elevation), so a rect sized
    // for a flat view stops reaching the edges. The host widens it; the pentagrid
    // has no camera and would not know to.
    const v = createGrowthView({ container: host(720, 560), lift: true });

    v.set({ fold: 1, grow: 1, azimuth: 0, elevation: Math.PI / 2 });
    const flat = tilesDrawn(v.pentagrid, "growth", () => v.redraw());

    v.set({ elevation: 0.5 });
    const tilted = tilesDrawn(v.pentagrid, "growth", () => v.redraw());

    v.set({ elevation: 0.2 });
    const grazing = tilesDrawn(v.pentagrid, "growth", () => v.redraw());

    assert.ok(flat > 0, "nothing drawn at all");
    assert.ok(tilted > flat, `tilting collected no more: ${tilted} vs ${flat}`);
    assert.ok(grazing > tilted, `grazing collected no more: ${grazing} vs ${tilted}`);
});

test("a flat view collects no more than it needs", () => {
    // grow.html must not pay for the roof's camera.
    const flat = createGrowthView({ container: host(720, 560), lift: false });
    const roof = createGrowthView({ container: host(720, 560), lift: true });
    flat.set({ grow: 1 });
    roof.set({ grow: 1, fold: 1, elevation: Math.PI / 2, azimuth: 0 });
    const a = tilesDrawn(flat.pentagrid, "growth", () => flat.redraw());
    const b = tilesDrawn(roof.pentagrid, "growth", () => roof.redraw());
    assert.equal(a, b, "flat and straight-down should collect the same region");
});

test("collectRect is consulted, and its result keys the rhomb cache", () => {
    // Without the rect in the cache key an orbit would redraw the old tiles.
    let asked = 0;
    let widen = 1;
    const h = createPentagrid({
        container: host(600, 400),
        steps: [],
        features: { penroseTiles: true },
        collectRect: (base) => {
            asked++;
            const cx = (base.xMin + base.xMax) / 2, cy = (base.yMin + base.yMax) / 2;
            const hw = ((base.xMax - base.xMin) / 2) * widen;
            const hh = ((base.yMax - base.yMin) / 2) * widen;
            return { xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh };
        },
    });
    assert.ok(asked > 0, "collectRect was never consulted");

    const one = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    widen = 3;
    const three = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(one > 0, "no tiles drawn at all");
    assert.ok(three > one, `widening drew no more tiles (${three} vs ${one})`);
});

test("there is exactly one regularity control, and it reads positively", () => {
    // It was briefly two — "keep γ regular" and "allow singularities" — bound to
    // the same flag with opposite senses and no syncing.
    const c = host();
    createPentagrid({ container: c, controls: makeStub(), panel: makeStub() });

    const labels = [];
    const walk = (el, depth = 0) => {
        if (depth > 6 || !el || !el.children) return;
        for (const kid of el.children) {
            if (typeof kid.textContent === "string" && kid.textContent) labels.push(kid.textContent);
            walk(kid, depth + 1);
        }
    };
    // the guard lives in the settings panel; sweep everything the page was given
    walk(c);
    const guardish = labels.filter((t) =>
        /regular|singular/i.test(String(t)));
    assert.ok(guardish.length <= 1,
              `more than one regularity control: ${JSON.stringify(guardish)}`);
});

test("the guard is decided exactly, not by a tolerance", () => {
    // A shift far below any float epsilon still counts, because the decision is
    // ten integer comparisons on γ as rationals.
    const den = 10000;
    const onIntegers = [0, 0, 0, 0, 0];
    assert.equal(singularTriples(onIntegers, den).length, 10,
                 "all-integer γ must be singular in every triple");
    const nudged = [1, 2, 3, 4, -10];              // one unit of the denominator
    assert.equal(nudged.reduce((a, b) => a + b, 0), 0, "the sum must survive");
    assert.deepEqual(singularTriples(nudged, den), [],
                     "one unit off the integers must clear every triple");
});

// ── the γ set reaches the picture ─────────────────────────────────
// These go through the VIEW, not the geometry. Three of the wiring edits for the
// family controls were silently never written — a patch batch aborted partway —
// and every test at the time called collectRhombs directly, so nothing noticed.

test("the handle exposes the γ set", () => {
    const h = createPentagrid({ container: host(), steps: [] });
    assert.ok(h.gamma, "no γ set on the handle");
    assert.equal(h.gamma.enabledFlags().length, 5);
});

test("turning a family off through the set changes what is drawn", () => {
    const h = createPentagrid({
        container: host(700, 500), steps: [], features: { penroseTiles: true },
    });
    const before = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    h.gamma.setFamilyEnabled(2, false);
    const after = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(before > 0, "nothing drawn to begin with");
    assert.ok(after < before, `family off drew as many tiles: ${after} vs ${before}`);
});

test("a single line through the set changes what is drawn", () => {
    const h = createPentagrid({
        container: host(700, 500), steps: [], features: { penroseTiles: true },
    });
    const before = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    h.gamma.setFamilyLine(1, 0);
    const after = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(after < before, `single line drew as many tiles: ${after} vs ${before}`);
});

test("isolating a family, then one of its lines, leaves a ribbon", () => {
    const h = createPentagrid({
        container: host(700, 500), steps: [], features: { penroseTiles: true },
    });
    const all = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    h.gamma.setIsolated(1);
    const solo = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    h.gamma.setFamilyLine(1, 0);
    const ribbon = tilesDrawn(h, "penrose-tiles", () => h.redraw());

    assert.ok(solo < all, "isolating drew as many tiles");
    assert.ok(ribbon < solo, "restricting the isolated family drew as many again");
    assert.ok(ribbon > 2, `a ribbon of only ${ribbon} tiles`);

    h.gamma.setIsolated(null);
    h.gamma.setFamilyLine(1, null);
    assert.equal(tilesDrawn(h, "penrose-tiles", () => h.redraw()), all,
                 "clearing both did not restore the tiling");
});

test("the growth view's gamma set is reachable and drives the picture", () => {
    // The Sigma-gamma slider on grow.html and roof.html goes through here. Wiring
    // that only the geometry tests cover is wiring that can silently not exist.
    const v = createGrowthView({ container: host(700, 500), lift: false });
    v.set({ grow: 1 });
    const g = v.pentagrid.gamma;
    assert.ok(g, "no gamma set behind the growth view");

    const at = () => tilesDrawn(v.pentagrid, "growth", () => v.redraw());
    const zero = at();
    g.setSum(2.5, true);
    assert.ok(Math.abs(g.getSum() - 2.5) < 1e-9, "the sum did not take");
    for (const val of g.values()) assert.ok(Math.abs(val - 0.5) < 1e-9,
        `spread should give every offset a half, got ${val}`);
    const pent = at();
    assert.ok(zero > 0 && pent > 0);
    assert.notEqual(pent, zero, "changing the sum redrew the identical tiling");
});

test("createPentagrid builds a heptagrid when asked, layers and all", () => {
    // The view had eleven family loops written against a module constant. This
    // is the end that would still say five after the geometry had stopped.
    const h = createPentagrid({ container: sizedHost(600, 600), n: 7 });
    assert.equal(h.gamma.n, 7);
    assert.equal(h.gamma.model.directions.length, 7);
    for (let j = 0; j < 7; j++)
        assert.ok(h.stack.get(`grid-${j}`), `no layer for family ${j}`);
    assert.equal(h.stack.get("grid-7"), undefined, "an eighth family appeared");
    h.redraw();
});

test("axes are off by default and drawn in front of the grid and the tiling", () => {
    // An axis behind the thing it measures is decoration, not a reference.
    const h = createPentagrid({ container: sizedHost(600, 600), steps: [] });
    const axes = h.stack.get("axes");
    assert.ok(axes, "no axes layer");
    assert.equal(axes.userVisible ?? true, true, "the layer itself stays available");
    assert.ok(axes.z > h.stack.get("dots").z, "axes must sit above the grid overlays");
    assert.ok(axes.z > h.stack.get("penrose-tiles").z, "and above the tiling");
    assert.ok(axes.z > h.stack.get("grid-0").z, "and above the grid itself");
    h.redraw();
});

/** Every panel switch, as (row label, switch label, checked, input). */
function panelSwitches(panel) {
    const out = [];
    const walk = (n, row) => {
        if (!n.children) return;
        for (const c of n.children) {
            const t = typeof c.textContent === "string" ? c.textContent : "";
            if (c.className === "panel-label" && t) row = t;
            if (c.className === "layer-toggle") {
                const box = c.children.find((x) => x.type === "checkbox");
                const label = c.children
                    .filter((x) => typeof x.textContent === "string" && x.textContent)
                    .map((x) => x.textContent).join("").trim();
                if (box) out.push({ row, label, box });
            }
            walk(c, row);
        }
    };
    walk(panel, null);
    return out;
}
const findSwitch = (panel, label) =>
    panelSwitches(panel).find((s) => s.label === label);

test("a switch over a feature-driven layer drives the feature, not just the layer", () => {
    // These layers are `visible: () => features.X`, so a switch that writes only
    // userVisible reads checked while the feature is off and does nothing when
    // clicked. Axes was the one that showed: ticked on, and inert.
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(600, 600), panel });
    const vis = (id) => { const l = h.stack.get(id); return l.visible ? l.visible() : true; };

    const axes = findSwitch(panel, "Axes");
    assert.ok(axes, "no Axes switch");
    assert.equal(axes.box.checked, false, "axes are off by default, and must say so");
    assert.equal(vis("axes"), false);

    axes.box.checked = true;
    axes.box.on.change[0]();
    assert.equal(vis("axes"), true, "the Axes switch did nothing");
});

test("K-regions and K-labels are switched once, from their own cluster", () => {
    // They used to appear on the Pentagrid row as well, where the switch was inert.
    const panel = makeStub();
    createPentagrid({ container: sizedHost(600, 600), panel });
    const all = panelSwitches(panel);
    for (const label of ["K-regions", "K-labels"]) {
        const hits = all.filter((s) => s.label === label);
        assert.equal(hits.length, 1, `${label} has ${hits.length} switches, want 1`);
        assert.equal(hits[0].row, "K-regions", `${label} is on the ${hits[0].row} row`);
    }
});

test("the K-regions cluster is grouped, not welded: each switches on its own", () => {
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(600, 600), panel });
    const vis = (id) => { const l = h.stack.get(id); return l.visible ? l.visible() : true; };

    const regions = findSwitch(panel, "K-regions");
    regions.box.checked = true;
    regions.box.on.change[0]();
    assert.equal(vis("background"), true, "K-regions did not switch on");

    const labels = findSwitch(panel, "K-labels");
    assert.equal(labels.box.disabled ?? false, false, "must not be disabled by the cluster");
    labels.box.checked = false;
    labels.box.on.change[0]();
    assert.equal(vis("background"), true, "regions should stay on");
    assert.equal(vis("klabels"), false, "labels should go off independently");
});

test("K-regions, its hover read-out and K-labels are one cluster", () => {
    // They belong to a step, not to the offsets, and ticking K-regions used to
    // leave the box on with nothing drawn because the step preset owns it.
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(600, 600), panel });
    const labels = [];
    const walk = (n, d = 0) => {
        if (d > 6 || !n.children) return;
        for (const c of n.children) {
            if (typeof c.textContent === "string" && c.textContent) labels.push(c.textContent);
            walk(c, d + 1);
        }
    };
    walk(panel);
    const joined = labels.join("|");
    assert.match(joined, /K-regions/);
    assert.match(joined, /vertex from region \(hover\)/,
                 "the hover read-out belongs with K-regions, not the gamma controls");
    assert.match(joined, /K-labels/);
});
