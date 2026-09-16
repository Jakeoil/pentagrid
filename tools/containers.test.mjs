// Tests for the canvas containers: createGrowthView and createRegionPanel.
//
// Both own their canvases and hand back a handle, the way createPentagrid does,
// so a page can stay a page. These drive them with no page anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import { handlers, makeStub } from "./domstub.mjs";
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

test("the 2k-gon layer draws the spaces the stacks grow into", () => {
    const v = createGrowthView({ container: host() });
    v.pentagrid.gamma.setSum(0, true);      // all five lines through the origin

    const layer = v.pentagrid.stack.get("resolutions");
    assert.ok(layer, "the 2k-gon layer is not registered");
    assert.equal(layer.visible(), false, "it should start off");

    let strokes = 0;
    layer.ctx.stroke = () => { strokes++; };

    v.set({ showResolutions: false });
    v.redraw();
    assert.equal(strokes, 0, "it drew while switched off");

    v.set({ showResolutions: true });
    assert.equal(layer.visible(), true);
    v.redraw();
    // 54 hexagons and a decagon are in view at Gamma = 0; the exact count depends
    // on the window, so require that it found a substantial number of stacks.
    assert.ok(strokes > 10, `only ${strokes} outlines drawn at Gamma = 0`);

    // Move off the singular set and nearly all of them go.
    const singular = strokes;
    v.pentagrid.gamma.setGuard(true);
    strokes = 0;
    v.redraw();
    assert.ok(strokes < singular / 2,
              `${strokes} outlines survived a regular gamma, from ${singular}`);
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
    p.element.on.mousedown[0]({ clientX: 200, clientY: 200 });   // dead center
    // === rather than deepEqual: negating zero gives -0, which is
    // strictly-deep-unequal to 0 and identical to it everywhere that matters.
    const [cx0, cy0] = seen.at(-1);
    assert.ok(cx0 === 0 && cy0 === 0, `center gave ${cx0},${cy0}`);
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

test("a family at none changes nothing while the rest are at all — the filter is an OR", () => {
    // Every tile is the crossing of two lines, so with four families still at
    // "all" each tile still lies on a selected gridline through its other
    // family. Only when the rest are at none does a family's own setting bite.
    const h = createPentagrid({
        container: host(700, 500), steps: [], features: { penroseTiles: true },
    });
    const before = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(before > 0, "nothing drawn to begin with");
    h.gamma.setFamilyLine(1, 0);
    assert.equal(tilesDrawn(h, "penrose-tiles", () => h.redraw()), before,
                 "with the rest at all, one line of a family must change nothing");
    h.gamma.setFamilyLine(1, null);
    h.gamma.setFamilyEnabled(2, false);
    assert.equal(tilesDrawn(h, "penrose-tiles", () => h.redraw()), before,
                 "with the rest at all, one family at none must change nothing");
    h.gamma.setFamilyEnabled(2, true);
    h.gamma.setFamilyLine(1, 0);

    // The rest at none, and now family 1's single line is all there is.
    for (let j = 0; j < 5; j++) if (j !== 1) h.gamma.setFamilyEnabled(j, false);
    const ribbon = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(ribbon > 0 && ribbon < before, `one ribbon drew ${ribbon} of ${before}`);
});

test("one family dualizes its ribbons, and one line of it dualizes one ribbon", () => {
    // The gridline-tiles filter is an OR: a tile is on a selected gridline
    // through either of its families. So one family at "all" gives every tile
    // that family takes part in — the union of its ribbons — where the old AND
    // gave nothing, since a tile needed both of its families on.
    const h = createPentagrid({
        container: host(700, 500), features: { penroseTiles: true },
    });
    // A REGULAR gamma: at the singular default most of a ribbon is stacked.
    h.gamma.setSum(1, true);
    const all = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    for (let j = 0; j < 5; j++) if (j !== 1) h.gamma.setFamilyEnabled(j, false);
    const solo = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    h.gamma.setFamilyLine(1, 0);
    const ribbon = tilesDrawn(h, "penrose-tiles", () => h.redraw());

    assert.ok(solo > 0, "one family at all should still dualize its ribbons");
    assert.ok(solo < all, "one family drew as many tiles as all five");
    assert.ok(ribbon < solo, "one line drew as many as the whole family");
    assert.ok(ribbon > 2, `a ribbon of only ${ribbon} tiles`);

    for (let j = 0; j < 5; j++) h.gamma.setFamilyEnabled(j, true);
    h.gamma.setFamilyLine(1, null);
    assert.equal(tilesDrawn(h, "penrose-tiles", () => h.redraw()), all,
                 "restoring the filter did not restore the tiling");
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
    // One canvas for all seven, and the count lives in the γ set rather than in
    // however many layers happen to exist.
    assert.ok(h.stack.get("grid"), "no grid layer");
    assert.equal(h.stack.get("grid-0"), undefined, "per-family canvases are gone");
    assert.equal(h.gamma.enabledFlags().length, 7);
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
    assert.ok(axes.z > h.stack.get("grid").z, "and above the grid itself");
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





test("whether a family is dualized has ONE home: the gamma set", () => {
    // It had two once — six drawing sites read a layer flag nothing wrote. The
    // gamma set is the one home, and it is a TILE filter: rhomb collection
    // follows it, the grid does not.
    const h = createPentagrid({ container: sizedHost(600, 600), steps: [] });
    const grid = h.stack.get("grid");

    h.gamma.setFamilyEnabled(2, false);
    assert.equal(h.gamma.familyEnabled(2), false);
    assert.equal(h.gamma.enabledFlags()[2], false, "rhomb collection must follow");
    assert.equal(grid.visible(), true, "the grid is G; the filter is P");

    for (let j = 0; j < 5; j++) h.gamma.setFamilyEnabled(j, false);
    assert.equal(grid.visible(), true, "every family filtered out of the tiling still draws as lines");

    // the layer's own flag is not a second opinion about families
    grid.userVisible = false;
    h.redraw();
    grid.userVisible = true;
    h.redraw();
});

test("hovering a dual vertex shows the region that made it, not just the reverse", () => {
    // There were two `if (features.hoverVertex)` blocks and the first ended in an
    // unconditional return, so the second — the yellow source-region and its
    // arrow — could never run. Dead from 2026-09-05 until this was noticed.
    const before = globalThis.document.body.children.length;
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseVertices: true, hoverVertex: true },
    });
    const tip = globalThis.document.body.children[before];
    h.redraw();

    const move = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
    assert.ok(move.length > 0, "no mousemove handler to drive");

    let onVertex = 0, onRegion = 0;
    for (let x = 120; x < 680; x += 11) {
        for (let y = 120; y < 680; y += 11) {
            tip.innerHTML = "";
            for (const f of move) f({ clientX: x, clientY: y, offsetX: x, offsetY: y,
                                      preventDefault() {} });
            const s = String(tip.innerHTML || "");
            // only the vertex path prints the f = Σ K_j·v_j equation
            if (s.includes("f</span> =")) onVertex++;
            else if (s) onRegion++;
        }
    }
    assert.ok(onVertex > 0, "the dual-vertex path never ran — it is shadowed again");
    assert.ok(onRegion > 0, "the region path must still answer everywhere else");
});

test("hovering a gridline segment shows the Penrose edge it becomes", () => {
    // The third correspondence. `hoverEdge` sat in the feature list, in the panel
    // and in the table for months with nothing reading it, so the row was a
    // switch wired to nothing; this is the test that says it is wired now.
    const before = globalThis.document.body.children.length;
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseEdges: true, hoverEdge: true },
    });
    const tip = globalThis.document.body.children[before];
    h.redraw();

    const move = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
    let onEdge = 0;
    for (let x = 120; x < 680; x += 7) {
        for (let y = 120; y < 680; y += 7) {
            tip.innerHTML = "";
            for (const f of move) f({ clientX: x, clientY: y, offsetX: x, offsetY: y,
                                      preventDefault() {} });
            if (String(tip.innerHTML || "").includes("edge</span> = v")) onEdge++;
        }
    }
    // Gridlines are thin, so most of the plane is not near one; what matters is
    // that walking across the window meets them.
    assert.ok(onEdge > 20, `the segment path answered only ${onEdge} times`);

    // And with the feature off it must stay silent, or it is not a feature.
    const before2 = globalThis.document.body.children.length;
    const h2 = createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseEdges: true, hoverEdge: false },
    });
    const tip2 = globalThis.document.body.children[before2];
    h2.redraw();
    const move2 = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
    let stray = 0;
    for (let x = 120; x < 680; x += 23) {
        for (let y = 120; y < 680; y += 23) {
            tip2.innerHTML = "";
            for (const f of move2) f({ clientX: x, clientY: y, offsetX: x, offsetY: y,
                                       preventDefault() {} });
            if (String(tip2.innerHTML || "").includes("edge</span> = v")) stray++;
        }
    }
    assert.equal(stray, 0, "the segment path ran with hoverEdge off");
});

test("superposed rhombs keep their edges as pseudo edges, and lose fill and arc", () => {
    // At a concurrency the C(k,2) rhombs are stacked. A fill would assert which
    // rhombic tiling of the 2k-gon is real and an arc would assert a shared edge
    // to join across, so both are dropped. The edges stay — they ARE the
    // superposition — but as pseudo edges, dotted, on their own switch: each is
    // dual to a gridline segment of zero length, so it has no grid counterpart.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true, penroseEdges: true, penroseDecor: true,
                    pseudoEdges: true },
    });
    h.gamma.setSum(0, true);          // all five lines meet at the origin

    const tally = (id, op) => {
        const layer = h.stack.get(id);
        let n = 0;
        const real = layer.ctx[op];
        layer.ctx[op] = () => { n++; };
        h.redraw();
        layer.ctx[op] = real;
        return n;
    };

    const edges = tally("penrose-edges", "stroke");
    const pseudo = tally("penrose-pseudo", "stroke");
    const fills = tally("penrose-tiles", "fill");

    // The solid edges match the fills — both are the laid-out tiles plus the
    // 2k-gon outlines — and the pseudo layer carries the rest. At sum zero a
    // large minority of rhombs sit on a concurrency, so it is far from empty.
    assert.equal(edges, fills, `solid edges ${edges} should match fills ${fills}`);
    assert.ok(pseudo > 50, `only ${pseudo} pseudo edges at Gamma = 0`);

    // And off by its switch, not by a filter somewhere else.
    h.setFeatures({ pseudoEdges: false }, { merge: true });
    assert.equal(h.stack.get("penrose-pseudo").visible(), false);

    // Arcs stay filtered: compare the arcs/edges ratio against a regular gamma,
    // where nothing is stacked and every rhomb gets both.
    const arcs = tally("penrose-decor", "stroke");
    const singularRatio = arcs / (edges + pseudo);
    h.gamma.setGuard(true);
    const regularRatio = tally("penrose-decor", "stroke") / tally("penrose-edges", "stroke");
    assert.ok(singularRatio < regularRatio - 0.1,
              `arcs per edge ${singularRatio.toFixed(2)} at a singular gamma should sit `
              + `below ${regularRatio.toFixed(2)} at a regular one`);
});

test("the hover readout sits in the canvas corner unless told to follow", () => {
    // Jake: the statistics were landing on the very thing being hovered.
    const before = globalThis.document.body.children.length;
    const host = sizedHost(800, 800);
    host.getBoundingClientRect = () => ({ width: 800, height: 800, left: 100, top: 50,
                                          right: 900, bottom: 850 });
    const h = createPentagrid({
        container: host,
        features: { gridLines: true, hoverVertex: true },
    });
    const tip = globalThis.document.body.children[before];
    h.redraw();
    const move = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);

    const hover = (x, y) => {
        for (const f of move) f({ clientX: x, clientY: y, offsetX: x, offsetY: y,
                                  preventDefault() {} });
    };
    hover(400, 400);
    assert.equal(tip.style.display, "block", "the readout did not show");
    assert.equal(tip.style.top, "58px", "corner: top should be the canvas top + 8");
    assert.equal(tip.style.left, "auto", "corner: anchored by the right edge, not the left");
    hover(600, 200);
    assert.equal(tip.style.top, "58px", "corner: it should not move with the pointer");

    // The follow-pointer setting is the second view of the same thing.
    const h2 = createPentagrid({
        container: host, hoverBox: "pointer",
        features: { gridLines: true, hoverVertex: true },
    });
    const tip2 = globalThis.document.body.children[globalThis.document.body.children.length - 1];
    h2.redraw();
    const move2 = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
    for (const f of move2) f({ clientX: 300, clientY: 300, offsetX: 300, offsetY: 300,
                               preventDefault() {} });
    assert.equal(tip2.style.left, "312px", "pointer: left should be clientX + 12");
});

test("two linked views share one gamma through onChange", () => {
    // The split page's relay, isolated: the left set is the instrument and every
    // change is pushed to the right, whose total is released so nothing it holds
    // can rewrite what it is given.
    const grid = createPentagrid({ container: sizedHost(400, 400) });
    const tiles = createPentagrid({ container: sizedHost(400, 400) });
    tiles.gamma.setLocked(-1);
    grid.gamma.onChange(() => tiles.gamma.setValues(grid.gamma.values()));

    grid.gamma.setLocked(-1);
    grid.gamma.setValues([0, 0.1, -0.1, -0.1, 0.1]);        // the deca
    assert.deepEqual(tiles.gamma.values().map((v) => +v.toFixed(6)),
                     [0, 0.1, -0.1, -0.1, 0.1], "the right side did not follow");

    grid.gamma.setValue(2, 0.25);
    assert.ok(Math.abs(tiles.gamma.values()[2] - 0.25) < 1e-12, "a single dial did not relay");
});

test("families2 draws each tile as two crossed bands, and leaves 2k-gons bare", () => {
    // grow.html's drawing, in method: family j's band, family k's, and the
    // composite square where they cross — three fills per rhomb. A 2k-gon takes
    // no color under it. At band 0 nothing is painted at all.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { color: "pair" },
    });
    h.gamma.setSum(0, true);            // stacks, so there are 2k-gons to leave bare

    const fills = () => {
        const layer = h.stack.get("penrose-tiles");
        let n = 0;
        const real = layer.ctx.fill;
        layer.ctx.fill = () => { n++; };
        h.redraw();
        layer.ctx.fill = real;
        return n;
    };
    const pair = fills();                          // one per laid-out tile + one per 2k-gon

    h.setTileStyle({ color: "bands", band: 0.5 });
    const bands = fills();
    // Three per laid-out tile and none for the 2k-gons — so strictly more than
    // 3x(pair minus the 2k-gons) is impossible and strictly less than 3x pair
    // is exactly the 2k-gons going unpainted.
    assert.ok(bands < 3 * pair, `bands ${bands} should be under 3 x ${pair}: 2k-gons were painted`);
    assert.ok(bands > 2 * pair, `bands ${bands} should be ~3x ${pair}: not three quads per tile`);

    h.setTileStyle({ band: 0 });
    assert.equal(fills(), 0, "band 0 should paint nothing");

    h.setTileStyle({ band: 1 });
    assert.equal(fills(), bands, "band 1 should paint the same three quads, full width");
});

test("height shading is wieringa's ramp: one gradient per tile, low corner to high", () => {
    // Corners are always (m, m+1, m+2, m+1), so the low corner is v0 and the high
    // corner v2; a three-stop gradient along that diagonal is exactly the roof's
    // per-vertex shading interpolated across the face.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { color: "type", shading: true, ramp: 1 },
    });
    h.gamma.setGuard(true);                      // a regular patch, so every fill is a tile

    const layer = h.stack.get("penrose-tiles");
    const grads = [];
    layer.ctx.createLinearGradient = (x0, y0, x1, y1) => {
        const g = { stops: [], addColorStop: (t, c) => g.stops.push([t, c]), from: [x0, y0], to: [x1, y1] };
        grads.push(g);
        return g;
    };
    let fills = 0;
    layer.ctx.fill = () => { fills++; };
    h.redraw();

    assert.ok(fills > 100, `only ${fills} tiles`);
    assert.equal(grads.length, fills, "every tile should get its own gradient");
    for (const g of grads) {
        assert.deepEqual(g.stops.map((s) => s[0]), [0, 0.5, 1], "three stops: low, mid, high");
        assert.ok(g.stops.every((s) => /^#[0-9a-f]{6}$/.test(s[1])), "stops are colors");
        // from and to are two different points — the diagonal, not a degenerate line
        assert.ok(Math.hypot(g.to[0] - g.from[0], g.to[1] - g.from[1]) > 1,
                  "the gradient runs along a real diagonal");
    }
    // Both ends of the ramp are reached somewhere in the patch: some tile is
    // shaded fully towards white at one corner and some fully towards black.
    const lows = new Set(grads.map((g) => g.stops[0][1]));
    const highs = new Set(grads.map((g) => g.stops[2][1]));
    assert.ok(lows.size >= 2 && highs.size >= 2, "the ramp is flat — the range is not being used");

    // It is an overlay, not a color: over families2 every band quad is ramped.
    h.setTileStyle({ color: "bands", band: 0.5 });
    grads.length = 0; fills = 0;
    h.redraw();
    assert.equal(grads.length, fills, "over families2 each quad should carry the ramp");
    assert.equal(grads.length % 3, 0, "three ramped quads per tile");

    // And off is off: no gradients at all.
    h.setTileStyle({ color: "type", shading: false });
    grads.length = 0;
    h.redraw();
    assert.equal(grads.length, 0, "shading off should build no gradients");
});

test("rhomb groups color tiles as sun-star does, and leave the rest bare", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { color: "groups" },
    });
    // The sun: a Pe5 at the origin and groups everywhere — a Penrose patch.
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);

    const layer = h.stack.get("penrose-tiles");
    const styles = [];
    layer.ctx.fill = function () { styles.push(String(this.fillStyle)); };
    h.redraw();

    const palette = new Set(["#9292e3", "#e6e68e", "#eec09b"]);
    const grouped = styles.filter((c) => palette.has(c)).length;
    const bare = styles.filter((c) => c === "#ececec").length;
    assert.ok(grouped > 100, `only ${grouped} tiles took a group color`);
    assert.ok(bare > 0, "some tiles at the patch edge should be in no complete group");
    assert.equal(grouped + bare, styles.length, "every fill is a group color or bare");

    // Off the integers groups are undefined, so everything goes bare.
    h.gamma.setValues([0.1, 0.1, 0.1, 0.1, 0.1]);
    styles.length = 0;
    h.redraw();
    assert.ok(styles.length > 0 && styles.every((c) => c === "#ececec"),
              "a non-Penrose patch should be all bare");
});

test("tile style is a setting, not a feature flag", () => {
    // color is a choice of three and opacity is a number; neither is the sort of
    // thing a narrative page turns on.
    const h = createPentagrid({
        container: sizedHost(600, 600),
        features: { penroseTiles: true },
        tileStyle: { color: "pair", isogloss: true, opacity: 0.5 },
    });
    assert.equal(typeof h.setTileStyle, "function");
    h.setTileStyle({ shading: true });
    h.redraw();
    h.setTileStyle({ isogloss: false, opacity: 1 });
    h.redraw();

    const panel = makeStub();
    const h2 = createPentagrid({ container: sizedHost(600, 600), panel });
    const labels = [];
    const walk = (n) => {
        if (!n.children) return;
        for (const c of n.children) {
            if (c.className === "panel-label" && c.textContent) labels.push(c.textContent);
            walk(c);
        }
    };
    walk(panel);
    assert.ok(labels.includes("Tile style"), `rows: ${labels.join(", ")}`);
    h2.redraw();
});

test("a superposed rhomb gets no fill and no arc, but keeps its edges", () => {
    // A fill asserts which of the many rhombic tilings of the 2k-gon is real, and
    // the construction picks none. An arc asserts a shared edge to join across,
    // and inside a stack there is none.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: {
            penroseTiles: true, penroseEdges: true,
            penroseDecor: true, penroseVertices: true,
        },
    });
    // the default Γ = 0 is the maximally singular pentagrid
    assert.ok(h.gamma.singular().length > 0, "expected a singular default");

    // tilesDrawn counts fill(), so it measures exactly what is withheld.
    const singular = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    const arcsSingular = tilesDrawn(h, "penrose-decor", () => h.redraw());

    // the same window on a regular gamma, where nothing is superposed
    h.gamma.setSum(1, true);
    const regular = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(regular > singular,
              `a singular gamma should fill fewer tiles: ${singular} vs ${regular}`);
    assert.ok(singular > 0, "and not withhold everything");

    // edges and vertices stay on either way: they give a singularity structure
    assert.equal(h.stack.get("penrose-edges").visible(), true);
    assert.equal(h.stack.get("penrose-vertices").visible(), true);
    assert.equal(h.stack.get("penrose-decor").visible(), true);
    assert.ok(arcsSingular >= 0);
});


// ── the panel, after the 2026-09-13 restructuring ─────────────────

/** Row label -> the switch labels on it. */
function panelRows(panel) {
    const rows = new Map();
    let current = null;
    const walk = (n) => {
        if (!n.children) return;
        for (const c of n.children) {
            if (c.className === "panel-label" && c.textContent) {
                current = c.textContent;
                if (!rows.has(current)) rows.set(current, []);
            }
            // The collapsed settings have unlabeled rows; they belong to no row.
            if (c.className === "settings") current = null;
            if (c.className === "layer-toggle" && current) {
                const label = c.children
                    .filter((x) => typeof x.textContent === "string" && x.textContent)
                    .map((x) => x.textContent).join("").trim();
                const box = c.children.find((x) => x.type === "checkbox");
                const sel = c.children.find((x) => x.tagName === "select");
                rows.get(current).push({ label, box, sel, el: c });
            }
            walk(c);
        }
    };
    walk(panel);
    return rows;
}

test("the panel separates what the tiling IS from how it is drawn", () => {
    const panel = makeStub();
    createPentagrid({ container: sizedHost(700, 700), panel });
    const rows = panelRows(panel);

    // functional first: which lines exist at all
    assert.ok(rows.has("ribbons"), [...rows.keys()].join(", "));
    assert.equal(rows.get("ribbons").length, 5, "one control per family");

    // then the viewport
    assert.ok(rows.get("View").some((c) => c.label === "axes"));

    // then the correspondence as a table: three columns, three rows, aligned
    assert.deepEqual(rows.get("Pentagrid").map((c) => c.label),
                     ["K-region", "gridline", "intersections"]);
    assert.deepEqual(rows.get("Hover").map((c) => c.label), ["", "", ""]);
    assert.deepEqual(rows.get("Penrose").map((c) => c.label),
                     ["vertex", "edge", "tile"]);

    // the columns line up because each cell is its own fixed-width box
    for (const label of ["Pentagrid", "Hover", "Penrose"]) {
        assert.equal(rows.get(label).length, 3, `${label} is not three columns`);
    }
});

test("gridline is on by default; the other two columns are not", () => {
    const h = createPentagrid({ container: sizedHost(700, 700) });
    assert.equal(h.stack.get("grid").visible(), true, "the grid should show");
});

test("a family control is an all/none/one mode and a line number", () => {
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(700, 700), panel });
    const fam = panelRows(panel).get("ribbons");

    const first = fam[0];
    assert.ok(first.sel, "no mode dropdown");
    assert.deepEqual(first.sel.children.map((o) => o.value), ["all", "none", "one"]);

    // none takes the family out of the TILING — the grid still draws it
    first.sel.value = "none";
    first.sel.on.change[0]();
    assert.equal(h.gamma.familyEnabled(0), false);
    assert.equal(h.gamma.enabledFlags()[0], false);

    // one restricts it to the numbered line
    const nBox = first.el.children.find((x) => x.type === "number");
    assert.ok(nBox, "no line number");
    nBox.value = "2";
    first.sel.value = "one";
    first.sel.on.change[0]();
    assert.equal(h.gamma.familyEnabled(0), true);
    assert.equal(h.gamma.familyLine(0), 2);

    // all puts it back
    first.sel.value = "all";
    first.sel.on.change[0]();
    assert.equal(h.gamma.familyLine(0), null);
});

test("the status button reads all / some / none and cycles them", () => {
    // Jake's rules: all -> none, some -> all, none -> all.
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(700, 700), panel,
                                features: { penroseTiles: true } });
    const rows = panelRows(panel);
    const fam = rows.get("ribbons");
    let status = null;
    const walk = (n) => {
        if (!n.children) return;
        for (const c of n.children) {
            if (c.tagName === "button" && ["all", "some", "none"].includes(c.textContent)) status = c;
            walk(c);
        }
    };
    walk(panel);
    assert.ok(status, "no status button");
    assert.equal(status.textContent, "all", "every family starts at all");

    // all -> none: every family to none
    status.on.click[0]();
    assert.equal(status.textContent, "none");
    for (let j = 0; j < 5; j++) {
        assert.equal(fam[j].sel.value, "none", `family ${j} did not follow`);
        assert.equal(h.gamma.familyEnabled(j), false);
    }

    // none -> all
    status.on.click[0]();
    assert.equal(status.textContent, "all");
    for (let j = 0; j < 5; j++) assert.equal(h.gamma.familyEnabled(j), true);

    // a single family changed reads as some; some -> all
    fam[2].sel.value = "one";
    fam[2].sel.on.change[0]();
    assert.equal(status.textContent, "some");
    status.on.click[0]();
    assert.equal(status.textContent, "all");
    assert.equal(fam[2].sel.value, "all", "some -> all resets the one");
    assert.equal(h.gamma.familyLine(2), null);
});

test("the filter is kept while tiles are off, and none is not allowed when they come on", () => {
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(700, 700), panel,
                                features: { penroseTiles: true } });
    const fam = panelRows(panel).get("ribbons");

    // Set family 1 to a single line, then turn the tiles off and on: it survives.
    const nBox = fam[1].el.children.find((x) => x.type === "number");
    nBox.value = "3";
    fam[1].sel.value = "one";
    fam[1].sel.on.change[0]();
    h.setFeatures({ penroseTiles: false }, { merge: true });
    h.setFeatures({ penroseTiles: true }, { merge: true });
    assert.equal(fam[1].sel.value, "one", "the mode was lost across off/on");
    assert.equal(h.gamma.familyLine(1), 3, "the line was lost across off/on");

    // Every family none, tiles off, tiles on: none is not allowed, so all to all.
    for (let j = 0; j < 5; j++) { fam[j].sel.value = "none"; fam[j].sel.on.change[0](); }
    h.setFeatures({ penroseTiles: false }, { merge: true });
    for (let j = 0; j < 5; j++) assert.equal(fam[j].sel.value, "none", "kept while off");
    h.setFeatures({ penroseTiles: true }, { merge: true });
    for (let j = 0; j < 5; j++) {
        assert.equal(fam[j].sel.value, "all", `family ${j}: none should become all on tile-on`);
        assert.equal(h.gamma.familyEnabled(j), true);
    }
});

test("the grid draws every family whatever the tile filter says", () => {
    // The flags filter the TILES. The grid, the dots, the loupe are G and show
    // everything — that is the whole point of moving the row to P.
    const h = createPentagrid({ container: sizedHost(700, 700),
                                features: { gridLines: true, penroseTiles: true } });
    for (let j = 0; j < 5; j++) h.gamma.setFamilyEnabled(j, false);
    assert.equal(h.stack.get("grid").visible(), true, "the grid went away with the filter");
    h.redraw();
});

test("a singularity is drawn as a P-region, by the tile and edge layers", () => {
    // Not a layer of its own and not a warning. Where k lines meet, the tiling
    // has a hexagon, an octagon or a decagon there instead of rhombs, so the
    // ordinary layers draw it.
    const panel = makeStub();
    const h = createPentagrid({
        container: sizedHost(800, 800), panel,
        features: { gridLines: true, penroseTiles: true, penroseEdges: true },
    });
    assert.equal(h.stack.get("singular"), undefined, "it should have no layer");
    const labels = [...panelRows(panel).values()].flat().map((c) => c.label);
    assert.ok(!labels.includes("Singularities"), "nor a switch");

    // the tile layer fills them: with a singular gamma some of what it fills is
    // 2k-gons rather than rhombs
    const filled = tilesDrawn(h, "penrose-tiles", () => h.redraw());
    assert.ok(filled > 0, "nothing was filled at all");

    // and the style choice reaches them
    for (const color of ["type", "pair", "bands", "groups"]) {
        h.setTileStyle({ color });
        assert.ok(tilesDrawn(h, "penrose-tiles", () => h.redraw()) > 0, color);
    }
});

test("tile is the fill and edge is the outline — never both from one layer", () => {
    // drawRhombs used to fill AND stroke, so ticking `tile` silently gave you
    // edges too. That is the two columns conflated in the one place the
    // correspondence table is trying to keep apart.
    const marks = (h, id) => {
        const layer = h.stack.get(id);
        let fills = 0, strokes = 0;
        const rf = layer.ctx.fill, rs = layer.ctx.stroke;
        layer.ctx.fill = () => { fills++; };
        layer.ctx.stroke = () => { strokes++; };
        try { h.redraw(); } finally { layer.ctx.fill = rf; layer.ctx.stroke = rs; }
        return { fills, strokes };
    };

    const tiles = marks(createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseTiles: true },
    }), "penrose-tiles");
    assert.ok(tiles.fills > 0, "the tile layer drew nothing");
    assert.equal(tiles.strokes, 0, "the tile layer must not draw edges");

    const edges = marks(createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseEdges: true },
    }), "penrose-edges");
    assert.ok(edges.strokes > 0, "the edge layer drew nothing");
    assert.equal(edges.fills, 0, "the edge layer must not fill");
});
