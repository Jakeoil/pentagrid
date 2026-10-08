// Tests for the canvas containers: createGrowthView and createRegionPanel.
//
// Both own their canvases and hand back a handle, the way createPentagrid does,
// so a page can stay a page. These drive them with no page anywhere.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handlers, makeStub } from "./domstub.mjs";
import { createGrowthView } from "../dist/view/growth.js";
import { createRegionPanel } from "../dist/view/region-panel.js";
import { polygonArea, pointInPolygon, convexBoundary } from "../dist/geometry/acceptance.js";
import { rhombDeflation } from "../dist/geometry/decor.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";

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

test("P1 on the roof: pentagon pieces ride the tiles, lifted or flat", () => {
    // The pieces are carried in each tile's own (a, b) frame, so they fold with
    // the roof. Blue first, then the pentagon colors, on every tile they reach.
    for (const lift of [false, true]) {
        const v = createGrowthView({ container: host(), lift });
        v.pentagrid.gamma.setLocked(-1);
        v.pentagrid.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);   // the sun
        v.set({ grow: 1, p1: true });
        const layer = v.pentagrid.stack.get("growth");
        const styles = [];
        layer.ctx.fill = function () { styles.push(String(this.fillStyle)); };
        v.redraw();
        // tinted rgb(...) strings; blue is rgb(0,0,b), yellow rgb(r,g,0) with r=g, orange has r>g>b
        const blue = styles.filter((c) => /^rgb\(0,0,\d+\)$/.test(c)).length;
        const yellow = styles.filter((c) => /^rgb\((\d+),\1,0\)$/.test(c) && c !== "rgb(0,0,0)").length;
        const orange = styles.filter((c) => { const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
            return m && +m[1] > +m[2] && +m[2] > +m[3]; }).length;
        assert.ok(blue > 100, `${lift ? "lifted" : "flat"}: tiles are painted blue first (${blue})`);
        assert.ok(yellow > 50 && orange > 50,
                  `${lift ? "lifted" : "flat"}: pentagon pieces ${yellow} yellow, ${orange} orange`);

        // And off is off.
        v.set({ p1: false });
        styles.length = 0;
        v.redraw();
        assert.equal(styles.filter((c) => /^rgb\(0,0,\d+\)$/.test(c)).length, 0, "p1 off should paint no blue");
    }
});

test("next-gen on the roof: gold tiles, gray thin' pieces, and the next generation's edges", () => {
    for (const lift of [false, true]) {
        const v = createGrowthView({ container: host(), lift });
        v.pentagrid.gamma.setLocked(-1);
        v.pentagrid.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);   // the sun
        v.set({ grow: 1, nextgen: true });
        const layer = v.pentagrid.stack.get("growth");
        const styles = [];
        let strokes = 0, segments = 0;
        layer.ctx.fill = function () { styles.push(String(this.fillStyle)); };
        layer.ctx.stroke = () => { strokes++; };
        layer.ctx.moveTo = () => { segments++; };
        v.redraw();
        // tinted rgb(...): gold has r>g>b with g well above b; gray has r=g=b
        const gold = styles.filter((c) => { const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c);
            return m && +m[1] > +m[2] && +m[2] > +m[3] + 60; }).length;
        const gray = styles.filter((c) => /^rgb\((\d+),\1,\1\)$/.test(c) && c !== "rgb(0,0,0)").length;
        assert.ok(gold > 100, `${lift ? "lifted" : "flat"}: tiles painted gold (${gold})`);
        assert.ok(gray > 100, `${lift ? "lifted" : "flat"}: gray thin' pieces (${gray})`);
        // one stroke per tile for the next-gen edges beyond the tile outline,
        // with seven or five segments each: on the sun about 5.5 per tile
        const tiles = v.pentagrid.stack.get("growth") && gold;
        assert.ok(segments > 5 * gray / 2, `${lift ? "lifted" : "flat"}: next-gen edges drawn (${segments} segments)`);
        assert.ok(strokes > tiles, "a stroke per tile for the edges, on top of the outline");

        // Off is off: the body fill per tile and nothing more (a lifted white
        // tile shades to a gray of its own, so count fills rather than colors).
        const withPieces = styles.length;
        v.set({ nextgen: false });
        styles.length = 0;
        v.redraw();
        assert.ok(styles.length < withPieces - 100, `next-gen off should paint no pieces (${styles.length} vs ${withPieces})`);
    }
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
    // appendChild, removeChild and replaceChildren all work on `el.children`:
    // the stub reads base.children at call time, so handing our own array in
    // above is enough and the three cannot disagree.
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

test("the two directions of the vertex hover are two switches, one way each", () => {
    // hoverVertex takes a Penrose vertex to the region that made it; hoverRegion
    // takes a region to the vertex it becomes. Separate switches, each one way,
    // and each needs its own object drawn — no regions on screen, no region to
    // point at. They were one two-way switch until Jake set it straight.
    const sweep = (features) => {
        const before = globalThis.document.body.children.length;
        const h = createPentagrid({ container: sizedHost(800, 800), features });
        const tip = globalThis.document.body.children[before];
        h.redraw();
        const move = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
        let answered = 0, tried = 0;
        for (let x = 120; x < 680; x += 11) {
            for (let y = 120; y < 680; y += 11) {
                tip.innerHTML = "";
                for (const f of move) f({ clientX: x, clientY: y, offsetX: x, offsetY: y,
                                          preventDefault() {} });
                tried++;
                if (String(tip.innerHTML || "")) answered++;
            }
        }
        return { answered, tried };
    };
    const base = { gridLines: true, kRegions: true, penroseVertices: true };

    // The Penrose side alone: a vertex is a definite thing under the pointer, so
    // it answers where there is one and nowhere else.
    const pen = sweep({ ...base, hoverVertex: true });
    assert.ok(pen.answered > 0, "the vertex hover never answered");
    assert.ok(pen.answered < pen.tried / 2,
              `a vertex is a point, not an area (${pen.answered} of ${pen.tried})`);

    // The grid side alone: a region is wherever you are, so it answers always.
    const grid = sweep({ ...base, hoverRegion: true });
    assert.equal(grid.answered, grid.tried, "every point of the plane is in a region");

    // And neither answers with its own switch off.
    const none = sweep(base);
    assert.equal(none.answered, 0, "both off should answer nothing");

    // Nor with the switch on but the object not drawn: nothing to point at.
    const unlit = sweep({ gridLines: true, kRegions: false, hoverRegion: true });
    assert.equal(unlit.answered, 0, "no regions on screen, no region hover");
});

test("hovering a gridline segment shows the Penrose edge it becomes", () => {
    // The third correspondence. `hoverEdge` sat in the feature list, in the panel
    // and in the table for months with nothing reading it, so the row was a
    // switch wired to nothing; this is the test that says it is wired now.
    const before = globalThis.document.body.children.length;
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { gridLines: true, penroseEdges: true, hoverSegment: true },
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
        features: { gridLines: true, kRegions: true, hoverRegion: true },
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
        features: { gridLines: true, kRegions: true, hoverRegion: true },
    });
    // Two boxes per instance now — the grid readout and the Penrose one — so
    // the grid box of the newest instance is the second from the end.
    const kids = globalThis.document.body.children;
    const tip2 = kids[kids.length - 2];
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

test("the group P1 has a shape, a face and a grid, and is drawn once over the patch", () => {
    // Jake: under "for groups", a rhomb-group P1 — a dropdown with pentaplex,
    // in 18, out 18 — and its own face and grid, the way penta has them for the
    // big-rhomb one. The blue ground is the tile, so it stays per tile; the
    // pentagons are one pass after every tile, because an outward bend leaves
    // its tile and an outline cut at a tile edge draws the tile edge.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { p1Face: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);      // the sun

    const layer = h.stack.get("penrose-tiles");
    let log = [];
    layer.ctx.clip = () => { log.push({ t: "clip" }); };
    layer.ctx.moveTo = (x, y) => { log.push({ t: "moveTo", x, y }); };
    layer.ctx.lineTo = (x, y) => { log.push({ t: "lineTo", x, y }); };
    layer.ctx.fill = function () { log.push({ t: "fill", style: String(this.fillStyle) }); };
    layer.ctx.stroke = () => { log.push({ t: "stroke" }); };
    const run = (style) => {
        h.setTileStyle({ p1Shape: "pentaplex", p1Face: false, p1Grid: false, ...style });
        log = [];
        h.redraw();
        const last = log.map((e) => e.t).lastIndexOf("clip");
        const parts = [];
        for (const e of log.slice(last + 1)) {
            if (e.t === "moveTo") parts.push([[e.x, e.y]]);
            else if (e.t === "lineTo" && parts.length) parts[parts.length - 1].push([e.x, e.y]);
        }
        return {
            fills: log.filter((e) => e.t === "fill"),
            strokes: log.filter((e) => e.t === "stroke").length,
            tiles: log.filter((e) => e.t === "clip").length,
            parts,
        };
    };

    const flat = run({ p1Face: true });
    const blue = flat.fills.filter((e) => e.style === "#0000ff").length;
    const yellow = flat.fills.filter((e) => e.style === "#ffff00").length;
    const orange = flat.fills.filter((e) => e.style === "#e46c0a").length;
    assert.ok(blue >= flat.tiles, `every tile is painted blue first (${blue} of ${flat.tiles})`);
    assert.ok(yellow > 20 && orange > 20, `pentagons: ${yellow} yellow, ${orange} orange`);
    assert.equal(flat.strokes, 0, "face alone draws no line");

    // Each pentagon ONCE, whole, and no two at the same center. Clipped to
    // tiles it used to be drawn in as many pieces as tiles it touched.
    const whole = flat.parts.filter((q) => q.length === 5);
    assert.ok(whole.length > 20, `only ${whole.length} whole pentagons`);
    const centers = new Set(whole.map((q) => {
        const cx = q.reduce((a, pt) => a + pt[0], 0) / 5;
        const cy = q.reduce((a, pt) => a + pt[1], 0) / 5;
        return `${cx.toFixed(2)},${cy.toFixed(2)}`;
    }));
    assert.equal(centers.size, whole.length, "a pentagon was drawn twice");

    // grid is the outlines alone: one stroke a pentagon, and nothing filled.
    const grid = run({ p1Grid: true });
    assert.equal(grid.strokes, whole.length, `${grid.strokes} strokes for ${whole.length}`);
    // The system still paints each tile; what grid adds is lines only.
    const P1_COLORS = ["#0000ff", "#ffff00", "#e46c0a"];
    assert.equal(grid.fills.filter((e) => P1_COLORS.includes(e.style)).length, 0,
                 "grid paints no P1 color — that is the point");

    // The bends break every boundary in two: ten corners where there were five,
    // the same pentagons, and the legs 18 degrees off the chord.
    for (const shape of ["in18", "out18"]) {
        const bent = run({ p1Shape: shape, p1Grid: true });
        const tens = bent.parts.filter((q) => q.length === 10);
        assert.equal(tens.length, whole.length, `${shape}: ${tens.length} bent pentagons`);
        assert.equal(bent.strokes, whole.length);
        let inward = 0;
        for (const q of tens) {
            let cx = 0, cy = 0;
            for (let i = 0; i < 10; i += 2) { cx += q[i][0] / 5; cy += q[i][1] / 5; }
            for (let i = 0; i < 10; i += 2) {
                const a = q[i], apex = q[i + 1], b = q[(i + 2) % 10];
                const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
                const half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
                const rise = Math.hypot(apex[0] - mx, apex[1] - my);
                assert.ok(Math.abs(rise - half * Math.tan(Math.PI / 10)) < 1e-6 * half + 1e-6,
                          `${shape}: a rise of ${rise.toFixed(3)} on a half of ${half.toFixed(3)}`);
                if ((apex[0] - mx) * (mx - cx) + (apex[1] - my) * (my - cy) < 0) inward++;
            }
        }
        assert.ok(inward > 0 && inward < tens.length * 5,
                  `${shape}: ${inward} of ${tens.length * 5} legs bend inward`);
    }

    // in 18 and out 18 are opposites: the same corners, every apex the other way.
    const inn = run({ p1Shape: "in18", p1Grid: true }).parts.filter((q) => q.length === 10);
    const out = run({ p1Shape: "out18", p1Grid: true }).parts.filter((q) => q.length === 10);
    assert.equal(inn.length, out.length);
    let apexMoved = 0, cornerMoved = 0;
    for (let k = 0; k < inn.length; k++) for (let i = 0; i < 10; i++) {
        const d = Math.hypot(inn[k][i][0] - out[k][i][0], inn[k][i][1] - out[k][i][1]);
        if (d > 1e-9) { if (i % 2) apexMoved++; else cornerMoved++; }
    }
    assert.equal(cornerMoved, 0, "the corners are the pentagon's and do not move");
    assert.equal(apexMoved, inn.length * 5, "every apex should flip");
});

test("a fresh view opens on the sun, not the singular point", () => {
    // Jake: "the default preset is decagon. Not a good one, make it sun."
    const h = createPentagrid({ container: sizedHost(600, 600) });
    for (const v of h.gamma.values()) assert.ok(Math.abs(v - 0.2) < 1e-12, `gamma = ${h.gamma.values()}`);
    assert.equal(h.gamma.singular().length, 0, "the sun is regular");
    // A page can still ask for Gamma = 0, and a config gamma still wins.
    const z = createPentagrid({ container: sizedHost(600, 600), gamma: [0, 0, 0, 0, 0] });
    assert.equal(z.gamma.singular().length, 10);
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
    assert.ok(labels.includes("system"), `rows: ${labels.join(", ")}`);
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
    // Γ = 0 is the maximally singular pentagrid; the default is the sun now, so
    // ask for it.
    h.gamma.setSum(0, true);
    assert.ok(h.gamma.singular().length > 0, "expected a singular configuration");

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

/** Row name -> the switch labels on it. Keyed by data-row, since a row's
 *  visible label may be empty: the correspondence rows are named by the section
 *  heading above them. */
function panelRows(panel) {
    const rows = new Map();
    let current = null;
    const walk = (n) => {
        if (!n.children) return;
        for (const c of n.children) {
            const name = c.dataset?.row;
            if (typeof name === "string" && name) {
                current = name;
                if (!rows.has(current)) rows.set(current, []);
            }
            // The collapsed settings have unlabeled rows; they belong to no row.
            if (c.className === "settings") current = null;
            if (String(c.className).split(" ").includes("layer-toggle") && current) {
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

    // then the correspondence, three columns down each section: the grid
    // objects over their hovers, the Penrose objects over theirs.
    assert.deepEqual(rows.get("Pentagrid").map((c) => c.label),
                     ["regions", "segments", "intersections"]);
    assert.deepEqual(rows.get("Hover").map((c) => c.label), ["hover", "hover", "hover"]);
    assert.deepEqual(rows.get("Penrose").map((c) => c.label),
                     ["vertices", "edges", "faces"]);
    assert.deepEqual(rows.get("Penrose hover").map((c) => c.label),
                     ["hover", "hover", "hover"]);

    // the columns line up because each cell is its own fixed-width box
    for (const label of ["Pentagrid", "Hover", "Penrose", "Penrose hover"]) {
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
    for (const color of ["type", "pair", "bands", "groups", "p1", "curves", "pentagons", "nextgen", "kites"]) {
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

// ── split: one stack across two containers ────────────────────────

test("split: the Penrose group draws in the second container, the axes in both, one model", () => {
    const left = sizedHost(600, 600), right = sizedHost(600, 600);
    const gPanel = sizedHost(600, 100), pPanel = sizedHost(600, 100);
    const before = globalThis.document.body.children.length;
    const h = createPentagrid({
        container: left, containerP: right, panel: gPanel, panelP: pPanel,
        features: { gridLines: true, kRegions: true, intersectionDots: true,
                    penroseTiles: true, penroseEdges: true, penroseVertices: true,
                    hoverVertex: true, hoverEdge: true, hoverTile: true },
    });
    const tip = globalThis.document.body.children[before];
    h.redraw();

    // canvases: by group
    for (const l of h.stack.all()) {
        const home = l.group === "Penrose" ? right : left;
        assert.ok(home.children.includes(l.canvas), `${l.id} (${l.group}) is in the wrong container`);
        if (l.group === "Axes") {
            assert.equal(l.mirrors.length, 1, "axes are mirrored");
            assert.ok(right.children.includes(l.mirrors[0].canvas));
        } else {
            assert.equal(l.mirrors.length, 0, `${l.id} should not be mirrored`);
        }
    }
    assert.equal(h.stack.containers.length, 2);

    // the panel: G rows left, P rows right
    const gRows = [...panelRows(gPanel).keys()], pRows = [...panelRows(pPanel).keys()];
    for (const r of ["Pentagrid", "Hover", "style"]) assert.ok(gRows.includes(r), `${r} should be on the G side`);
    for (const r of ["Penrose", "Penrose hover", "system", "pentaplex", "penrose face",
                     "edge style"]) {
        assert.ok(pRows.includes(r), `${r} should be on the P side`);
    }
    for (const r of pRows) assert.ok(!gRows.includes(r), `${r} is on both sides`);

    // input surfaces on both sides, and a hover on the LEFT paints on the RIGHT:
    // the region under the pointer on the grid, and its vertex on the tiling
    const events = (host) => host.children.filter((c) => c.style && c.style.pointerEvents === "auto");
    assert.equal(events(left).length, 1);
    assert.equal(events(right).length, 1);
    const hl = (host) => h.stack.rawLayers.find((r) => r.z === 55 && r.host === host).layer.ctx;
    const painted = { left: 0, right: 0 };
    hl(left).fill = () => { painted.left++; };
    hl(right).fill = () => { painted.right++; };
    const move = handlers.filter((x) => x.type === "mousemove").map((x) => x.fn);
    let vertexHits = 0;
    for (let x = 100; x < 500; x += 11) {
        for (let y = 100; y < 500; y += 11) {
            tip.innerHTML = "";
            for (const f of move) f({ clientX: x, clientY: y, offsetX: x, offsetY: y, preventDefault() {} });
            if (String(tip.innerHTML || "").includes("K[")) vertexHits++;
        }
    }
    assert.ok(vertexHits > 100, `the hover answered only ${vertexHits} times`);
    assert.ok(painted.left > 0, "the grid half of the hover was never painted on the left");
    assert.ok(painted.right > 0, "the Penrose half of the hover was never painted on the right");
});

test("the index switch marks every dual vertex with a white circle", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800), panel: sizedHost(800, 100),
        features: { penroseTiles: true, penroseVertices: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
    const layer = h.stack.get("penrose-vertices");
    const texts = [], fills = [];
    layer.ctx.fillText = function (t) { texts.push([t, String(this.fillStyle)]); };
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };

    h.redraw();
    assert.equal(texts.length, 0, "the dot writes nothing");
    const dots = fills.length;
    assert.ok(dots > 100 && fills.every((c) => c === "#c0392b"), "red dots by default");

    h.setTileStyle({ vertexMark: "index" });
    texts.length = 0; fills.length = 0;
    h.redraw();
    assert.equal(texts.length, dots, "one index per vertex, in place of each dot");
    assert.deepEqual([...new Set(texts.map(([t]) => t))].sort(), ["1", "2", "3", "4"]);
    // White circles throughout, black digits — no black discs any more: the
    // number is the encoding, and a second one only competed with it.
    assert.ok(fills.every((c) => c === "#fff") && fills.length === dots, "white discs");
    assert.ok(texts.every(([, c]) => c === "#111"), "black digits");

    // Off Penrose the fifth level is just a 5 in the same white circle.
    h.gamma.setValues([0.1, 0.1, 0.1, 0.1, 0.1]);          // sum 1/2: five levels
    texts.length = 0; fills.length = 0;
    h.redraw();
    assert.ok(texts.some(([t]) => t === "5"), "a fifth level exists off Penrose");
    assert.ok(fills.every((c) => c === "#fff"), "still white");
    assert.ok(texts.every(([, c]) => c === "#111"), "still black digits");
});
test("deflate on the reticulum leaves the deflated tiling in the same screen frame", () => {
    const h = createPentagrid({ container: sizedHost(800, 800), features: { penroseTiles: true } });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.07, 0.11, 0.13, 0.17, -0.48]);
    const v0 = h.getView();
    h.setView({ scale: 40, x: 0.3, y: -0.2 });
    // the old tiling's vertices and its Robinson subdivision, in SCREEN pixels
    const before = new Map();
    const world = (p) => [400 + (p[0] - 0.3) * 40, 400 - (p[1] + 0.2) * 40];
    const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
    const R = collectRhombs(h.gamma.model, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 }, { gain: 2.5 });
    let lo = Infinity; for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    for (const r of R) for (const P of [...rhombDeflation(r, lo).gold, ...rhombDeflation(r, lo).gray]) for (const p of P) {
        const s = world(p); if (Math.hypot(s[0] - 400, s[1] - 400) < 300) before.set(key(s), s);
    }
    assert.ok(before.size > 300);

    h.gamma.deflate();
    const v1 = h.getView();
    const PHI = (1 + Math.sqrt(5)) / 2;
    assert.ok(Math.abs(v1.scale - 40 / PHI) < 1e-9, "the scale followed lambda");
    assert.ok(Math.abs(v1.x - 0.3 * PHI) < 1e-9 && Math.abs(v1.y + 0.2 * PHI) < 1e-9, "the pan kept the world frame");
    // the new tiling's vertices, mapped through the NEW view, are the old subdivision's points
    const R2 = collectRhombs(h.gamma.model, { xMin: -14, xMax: 14, yMin: -14, yMax: 14 }, { gain: 2.5 });
    const after = new Set();
    for (const r of R2) for (const p of r.vertices) {
        const s = [400 + (p[0] - v1.x) * v1.scale, 400 - (p[1] - v1.y) * v1.scale];
        if (Math.hypot(s[0] - 400, s[1] - 400) < 300) after.add(key(s));
    }
    let hit = 0; for (const k of before.keys()) if (after.has(k)) hit++;
    assert.equal(hit, before.size, `${before.size - hit} subdivision points are not vertices of the deflated tiling on screen`);
    void v0;
});

test("off Penrose is a switch: nothing dressed with it off, the extreme-level tiles with it on", () => {
    const h = createPentagrid({ container: sizedHost(800, 800), panel: sizedHost(800, 100),
                                features: { penroseTiles: true, arrows: true } });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.07, 0.11, 0.13, 0.17, 0.02]);       // sum 1/2
    const layer = h.stack.get("penrose-decor");
    let strokes = 0; layer.ctx.stroke = () => { strokes++; };
    h.redraw();
    assert.equal(strokes, 0, "off Penrose, off by default: no arrows");
    h.setTileStyle({ offPenrose: true });
    strokes = 0; h.redraw();
    assert.ok(strokes > 50, `with the switch on the extreme-level tiles carry arrows (${strokes})`);
    h.setTileStyle({ kitesFace: true });
    const tiles = h.stack.get("penrose-tiles");
    let fills = 0; tiles.ctx.fill = () => { fills++; };
    h.redraw();
    const withKites = fills;
    h.setTileStyle({ offPenrose: false });
    fills = 0; h.redraw();
    assert.ok(withKites > fills + 20, `kites' darts are drawn only with the switch on (${withKites} vs ${fills})`);
});

test("a gamma change draws the singular tiles right the first time — the scan runs before the layers", () => {
    // From the sun (regular) to Gamma = 0 (every triple singular): the tiles
    // layer must withhold the stacked rhombs and draw the 2k-gons for the NEW
    // gamma on the very first draw, not the second.
    const h = createPentagrid({ container: sizedHost(800, 800), features: { penroseTiles: true, penroseEdges: true } });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
    const layer = h.stack.get("penrose-tiles");
    const capture = (fn) => { const log = []; let cur = null; const om = layer.ctx.moveTo, of = layer.ctx.fill;
        layer.ctx.moveTo = (x, y) => { cur = [x, y]; }; layer.ctx.fill = () => { log.push(cur ? cur.map((v) => v.toFixed(1)).join(",") : "?"); };
        try { fn(); } finally { layer.ctx.moveTo = om; layer.ctx.fill = of; } return log.sort().join("|"); };
    // the first draw after the change, versus a second draw of the same state
    const first = capture(() => h.gamma.setValues([0, 0, 0, 0, 0]));
    const second = capture(() => h.redraw());
    assert.equal(first, second, "the first draw after a gamma change must equal a redraw of the same state");
    // and back
    const back1 = capture(() => h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]));
    const back2 = capture(() => h.redraw());
    assert.equal(back1, back2);
});

test("at Gamma = 0 the index range is the tiling's 1..4, not the decagon's ghost 0..4", () => {
    const h = createPentagrid({ container: sizedHost(800, 800), panel: sizedHost(800, 100),
                                features: { penroseTiles: true, penroseVertices: true, arrows: true } });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0, 0, 0, 0, 0]);
    h.setTileStyle({ vertexMark: "index" });
    const layer = h.stack.get("penrose-vertices");
    const texts = [];
    layer.ctx.fillText = (t) => { texts.push(t); };
    h.redraw();
    const levels = [...new Set(texts)].sort();
    // the real vertices read 1..4; the decagon's ghost center, if marked, reads 0
    assert.deepEqual(levels.filter((t) => t !== "0"), ["1", "2", "3", "4"], `levels ${levels}`);
    assert.ok(!texts.includes("5"), "no fives: the ghost must not shift the range");
    // and the arrows, which need four levels, are drawn
    const decor = h.stack.get("penrose-decor");
    let strokes = 0; decor.ctx.stroke = () => { strokes++; };
    h.redraw();
    assert.ok(strokes > 100, `arrows at Gamma = 0 (${strokes})`);
});

test("the multigrid: createPentagrid at n = 8 builds, the reticulum has sixteen sides, and the Penrose dressings are not offered", () => {
    // makeStub's appendChild MOVES a re-appended child; sizedHost's duplicates it,
    // and the ribbons row is re-appended to land on the P side
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(800, 800), panel, n: 8, features: { gridLines: true, penroseTiles: true } });
    h.gamma.setLocked(-1);
    h.gamma.setValues(new Array(8).fill(0.5));
    assert.equal(h.gamma.model.n, 8);
    const tiles = h.stack.get("penrose-tiles");
    let fills = 0; tiles.ctx.fill = () => { fills++; };
    h.redraw();
    assert.ok(fills > 100, `tiles drawn at n = 8 (${fills})`);
    // the style dropdown: only the general three
    let sel = null;
    const walk = (node) => { if (!node || !node.children) return; for (const c of node.children) { if (c.tagName === "select" && c.className === "line-pick" && c.children.some((o) => o.value === "type")) sel = c; walk(c); } };
    walk(panel);
    assert.ok(sel, "the tile style select exists");
    assert.deepEqual(sel.children.map((o) => o.value), ["type", "pair", "bands"]);
    const rows = panelRows(panel);
    assert.ok(!rows.get("edge style").some((c) => c.label === "arrows"), "no arrows off the pentagrid");
    assert.ok(!rows.has("pentaplex"), "no penta off the pentagrid");
    assert.ok(!rows.has("penrose face"), "no index-placed dressings off the pentagrid");
    assert.ok(!rows.has("for groups"), "and no rhomb groups to place them on");
    assert.equal(rows.get("ribbons").length, 8, `eight family controls: ${rows.get("ribbons").map((c) => c.label)}`);
});

test("by shape: off the pentagrid the rhomb classes wear warm (odd) and cool (even) shades, all distinct; five is thick gold and thin blue", () => {
    const fillsAt = (n) => {
        const h = createPentagrid({ container: sizedHost(800, 800), n, features: { penroseTiles: true } });
        h.gamma.setLocked(-1); h.gamma.setValues(new Array(n).fill(n % 2 ? 1 / n : 0.5));
        const layer = h.stack.get("penrose-tiles");
        const seen = new Set();
        layer.ctx.fill = function () { seen.add(String(this.fillStyle)); };
        h.redraw();
        return [...seen];
    };
    assert.deepEqual(fillsAt(5).sort(), ["#7eb8da", "#e8c170"], "five: the two fills as ever");
    const seven = fillsAt(7);
    assert.equal(seven.length, 3, `seven: three classes, three fills (${seven})`);
    assert.ok(seven.includes("#e8c170") && seven.includes("#7eb8da"), "class 1 and 2 keep their colors");
    const twelve = fillsAt(12);
    assert.equal(twelve.length, 6, `twelve: six classes (${twelve})`);
    const warm = (c) => { const r = parseInt(c.slice(1, 3), 16), b = parseInt(c.slice(5, 7), 16); return r > b; };
    assert.equal(twelve.filter(warm).length, 3, "three warm, three cool");
});

test("a page that rebuilds in place must clear its panel hosts, not just its canvases", () => {
    // dual.html and multigrid.html rebuild the whole view when a switch moves.
    // createPentagrid APPENDS its rows to whatever host it is given, so a
    // rebuild that clears only the canvases leaves a second G and P cluster
    // behind — and a third, and a fourth. Jake saw it on dual.html.
    const panel = makeStub(), panelP = makeStub();
    const left = sizedHost(400, 400), right = sizedHost(400, 400);
    const build = () => {
        for (const el of [left, right, panel, panelP]) el.replaceChildren();
        return createPentagrid({
            container: left, containerP: right, panel, panelP,
            features: { gridLines: true, penroseTiles: true },
        });
    };
    const rows = (el) => [...panelRows(el).keys()].length;
    build();
    const g = rows(panel), p = rows(panelP);
    assert.ok(g > 0 && p > 0);
    for (let i = 0; i < 3; i++) build();
    assert.equal(rows(panel), g, "the G cluster must not multiply");
    assert.equal(rows(panelP), p, "nor the P cluster");
    // and the canvases likewise
    assert.ok(left.children.length < 20 && right.children.length < 20,
              `canvases: ${left.children.length}, ${right.children.length}`);
});

test("the solids layer draws a zonohedron per singularity, and the reading moves it", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.pentagrid.gamma.setSum(0, true);          // all five lines through the origin
    v.set({ grow: 1, fold: 1 });

    const layer = v.pentagrid.stack.get("solids");
    assert.ok(layer, "the solids layer is not registered");
    assert.equal(layer.visible(), false, "it should start off");

    // Capture the path, so a change of reading has to move real geometry.
    let path = [];
    let fills = 0;
    layer.ctx.moveTo = (x, y) => { path.push(`M${x.toFixed(3)},${y.toFixed(3)}`); };
    layer.ctx.lineTo = (x, y) => { path.push(`L${x.toFixed(3)},${y.toFixed(3)}`); };
    layer.ctx.fill = () => { fills++; };

    v.redraw();
    assert.equal(fills, 0, "it drew while switched off");

    v.set({ solids: true });
    v.redraw();
    const first = path.join("|");
    // Every face is four points; 54 hexagons and a decagon are in view at Σγ = 0.
    assert.ok(fills > 30, `only ${fills} faces drawn`);
    assert.equal(path.length % 4, 0, "a face is four points");

    for (const reading of [1, 2, 7]) {
        path = [];
        v.set({ reading });
        v.redraw();
        assert.notEqual(path.join("|"), first, `reading ${reading} drew the same thing`);
    }

    // The pair ghost adds three outlines per singularity — an outline now,
    // since the face itself is no longer filled.
    let strokes = 0;
    layer.ctx.stroke = () => { strokes++; };
    v.set({ reading: 0, pairGhost: false });
    strokes = 0;
    v.redraw();
    const plain = strokes;
    v.set({ pairGhost: true });
    strokes = 0;
    v.redraw();
    assert.ok(strokes > plain, `pair drew nothing extra (${strokes} vs ${plain})`);
});

test("a Penrose grid holds the decagon to its ten readings, with no switch", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.set({ grow: 1, fold: 1, solids: true });

    const layer = v.pentagrid.stack.get("solids");
    let path = [];
    layer.ctx.moveTo = (x, y) => { path.push(`M${x.toFixed(3)},${y.toFixed(3)}`); };
    layer.ctx.lineTo = (x, y) => { path.push(`L${x.toFixed(3)},${y.toFixed(3)}`); };

    const sweep = () => {
        const seen = new Set();
        for (let r = 0; r < 62; r++) {
            v.set({ reading: r });
            path = [];
            v.redraw();
            seen.add(path.join("|"));
        }
        return seen.size;
    };
    // The sun: every gamma an integer, so Penrose, so the decagon has ten
    // readings and the hexagons two — ten distinct pictures over a sweep of 62.
    v.pentagrid.gamma.setSum(0, true);
    assert.equal(sweep(), 10, "a Penrose grid should show ten");
});

test("the solid is its edges and the bands crossing on them", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.pentagrid.gamma.setSum(0, true);
    v.set({ grow: 1, fold: 1, solids: true, band: 0 });

    const layer = v.pentagrid.stack.get("solids");
    let fills = 0, strokes = 0;
    layer.ctx.fill = () => { fills++; };
    layer.ctx.stroke = () => { strokes++; };

    v.redraw();
    const faces = strokes;
    assert.ok(faces > 30, `only ${faces} faces outlined`);
    assert.equal(fills, 0, "with no band there is nothing to fill: the face is gone");

    v.set({ band: 0.5 });        // set redraws, so zero the counts after it
    fills = 0; strokes = 0;
    v.redraw();
    assert.equal(strokes, faces, "the edges stay");
    // Two strips per face and the patch where they cross — the crossing keeps
    // the mixed color the whole face used to carry.
    assert.equal(fills, faces * 3, `${fills} against ${faces} faces`);

    // And they follow the grow setting like everything else: at grow 0 the
    // solid is collapsed onto its crossing and the patch in view is a
    // different one, but the count per face is the same.
    v.set({ grow: 0, band: 0 });
    fills = 0; strokes = 0;
    v.redraw();
    const collapsed = strokes;
    assert.ok(collapsed > 0, "nothing drawn at grow 0");
    v.set({ band: 0.5 });
    fills = 0;
    v.redraw();
    assert.equal(fills, collapsed * 3, `${fills} against ${collapsed} faces at grow 0`);
});

test("2k-gon bands off leaves nothing of a band inside the polygon", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.pentagrid.gamma.setSum(0, true);       // stacks everywhere
    v.set({ grow: 0.6, fold: 1, band: 0.5, stackBands: true });

    const layer = v.pentagrid.stack.get("growth");
    let fills = 0;
    layer.ctx.fill = () => { fills++; };
    v.redraw();
    const withThem = fills;

    v.set({ stackBands: false });
    fills = 0;
    v.redraw();
    const without = fills;

    // Three fills per tile go with the in-tile strips — the two bands and the
    // patch where they cross — so the drop is 3 per superposed tile, on top of
    // the runs across each polygon. Nothing of a band is left inside one.
    assert.ok(without < withThem, `nothing was suppressed (${without} of ${withThem})`);
    assert.equal((withThem - without) % 3 === 0 || withThem - without > 3, true,
                 `an odd amount went: ${withThem - without}`);
    // The tiles outside the polygons keep theirs, so most of it survives.
    assert.ok(without > withThem * 0.4, `too much went: ${without} of ${withThem}`);
});

test("roof: the arcs and the index circles, and the dressings at a singular preset", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.pentagrid.gamma.setSum(0, true);          // the sun: singularities everywhere
    v.set({ grow: 1, fold: 1 });

    // The dressings are placed by the index, and a 2k-gon's corners carry
    // levels the tiling does not — the decagon's ghost runs 0..5. Counting
    // them took a Penrose patch out of its 1..4 and silenced every dressing.
    const growth = v.pentagrid.stack.get("growth");
    let fills = 0;
    growth.ctx.fill = () => { fills++; };
    v.set({ penta: false });
    fills = 0;
    v.redraw();
    const bare = fills;
    v.set({ penta: true });
    fills = 0;
    v.redraw();
    assert.ok(fills > bare, `penta drew nothing at the singular preset (${fills} of ${bare})`);

    // The arcs need no index at all, so they draw here and off Penrose alike.
    const arcs = v.pentagrid.stack.get("arcs");
    assert.ok(arcs, "no arcs layer");
    assert.equal(arcs.visible(), false);
    let strokes = 0;
    arcs.ctx.stroke = () => { strokes++; };
    v.set({ arcs: true });
    strokes = 0;
    v.redraw();
    assert.ok(strokes > 100, `only ${strokes} arcs`);
    const onPenrose = strokes;
    v.pentagrid.gamma.setSum(0.5, true);        // off Penrose: five levels
    strokes = 0;
    v.redraw();
    assert.ok(strokes > onPenrose * 0.5, `the arcs went quiet off Penrose (${strokes})`);

    // The index circles: one per vertex, white, numbered from the patch minimum.
    v.pentagrid.gamma.setSum(0, true);
    const idx = v.pentagrid.stack.get("vertex-index");
    assert.ok(idx, "no index layer");
    const texts = [];
    idx.ctx.fillText = (t) => { texts.push(t); };
    v.set({ index: true });
    texts.length = 0;
    v.redraw();
    assert.ok(texts.length > 100, `only ${texts.length} index circles`);
    const levels = [...new Set(texts)].sort();
    assert.deepEqual(levels.filter((t) => t !== "0"), ["1", "2", "3", "4"],
                     `a Penrose patch reads 1..4, got ${levels}`);
    // The one 0 is the decagon's ghost center, which carries index 0 and 5 at
    // once — the only place index 0 turns up anywhere (PLAN §5.8). The stacks
    // are out of the RANGE, so they cannot shift the other numbers, but the
    // ghost is still a vertex and still gets marked.
    assert.equal(texts.filter((t) => t === "0").length, 1, "one ghost, at the decagon");
});

test("roof: 2kgon-legacy off leaves the polygon to its own color", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.pentagrid.gamma.setSum(0, true);
    v.set({ grow: 1, fold: 1, band: 0.5, showResolutions: true, stackBands: true });

    const growth = v.pentagrid.stack.get("growth");
    let fills = 0, strokes = 0;
    growth.ctx.fill = () => { fills++; };
    growth.ctx.stroke = () => { strokes++; };
    fills = 0; strokes = 0;
    v.redraw();
    const withIt = { fills, strokes };

    v.set({ stackBands: false });
    fills = 0; strokes = 0;
    v.redraw();
    // Nothing of a superposed tile is drawn: no fill, no edge, no band.
    assert.ok(fills < withIt.fills, `no fills went (${fills} of ${withIt.fills})`);
    assert.ok(strokes < withIt.strokes, `no edges went (${strokes} of ${withIt.strokes})`);
    // and the tiles outside the polygons are untouched
    assert.ok(fills > withIt.fills * 0.4, `too much went: ${fills} of ${withIt.fills}`);
});

test("the panel reads in three sections, and split puts the third on the right", () => {
    // What you are looking at, then the grid, then its dual. One column on
    // method, two on split — same order either way, so the pages cannot drift.
    const read = (panel) => {
        const out = [];
        const walk = (el) => {
            for (const c of el.children ?? []) {
                if (c.className === "panel-section-title") out.push(`== ${c.textContent}`);
                else if (c.dataset?.row) out.push(c.dataset.row);
                walk(c);
            }
        };
        walk(panel);
        return out;
    };
    const GRID = ["== view", "View", "settings", "== grid",
                  "Pentagrid", "Hover", "style"];
    const PEN = ["== Penrose", "Penrose", "Penrose hover", "system", "face shade",
                 "pentaplex", "penrose face", "for groups", "edge style", "vertex style",
                 "ribbons", "singularities"];

    const panel = sizedHost(800, 200);
    createPentagrid({ container: sizedHost(800, 800), panel });
    assert.deepEqual(read(panel), [...GRID, ...PEN], "method: one column, three sections");

    const left = sizedHost(800, 200), right = sizedHost(800, 200);
    createPentagrid({
        container: sizedHost(800, 800), containerP: sizedHost(800, 800),
        panel: left, panelP: right,
    });
    assert.deepEqual(read(left), GRID, "split: view and the grid on the left");
    assert.deepEqual(read(right), PEN, "split: the Penrose rows on the right");
});

test("exposing a subset of rows takes its section heading with it", () => {
    const panel = sizedHost(800, 200);
    const h = createPentagrid({ container: sizedHost(800, 800), panel });
    const live = () => {
        const out = [];
        const walk = (el) => {
            for (const c of el.children ?? []) {
                if (c.className === "panel-section" && c.hidden !== true) {
                    out.push(c.children[0].textContent);
                }
                walk(c);
            }
        };
        walk(panel);
        return out;
    };
    h.exposeRows(["View"]);
    assert.deepEqual(live(), ["view"], "a heading over nothing is worse than no heading");
    h.exposeRows(null);
    assert.deepEqual(live(), ["view", "grid", "Penrose"]);
});

test("method shows the whole panel on every step", () => {
    // The per-step row lists never moved anything in a browser — an author
    // display rule beats the UA's [hidden] — so the page has always shown every
    // row, and the CSS saying it outright must not change that.
    const src = readFileSync(new URL("../src/app/method-steps.ts", import.meta.url), "utf8");
    const calls = src.match(/exposeRows\(([^)]*)\)/g) ?? [];
    assert.ok(calls.length > 4, `only ${calls.length} exposeRows calls found`);
    assert.deepEqual([...new Set(calls)], ["exposeRows(null)"],
                     "a step that prunes rows would hide the Penrose section");
});

test("big rhombs is the generation above: every vertex of it is a vertex of this one", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { bigRhombsFace: true, bigRhombsGrid: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("big-rhombs");
    assert.ok(layer, "no big-rhombs layer");
    assert.equal(layer.visible(), true);

    // Capture what it draws, and what the tiles draw, in screen coordinates.
    const big = [], tiles = [];
    layer.ctx.moveTo = (x, y) => { big.push(`${x.toFixed(2)},${y.toFixed(2)}`); };
    layer.ctx.lineTo = (x, y) => { big.push(`${x.toFixed(2)},${y.toFixed(2)}`); };
    const tl = h.stack.get("penrose-tiles");
    tl.ctx.moveTo = (x, y) => { tiles.push(`${x.toFixed(2)},${y.toFixed(2)}`); };
    tl.ctx.lineTo = (x, y) => { tiles.push(`${x.toFixed(2)},${y.toFixed(2)}`); };
    h.redraw();

    assert.ok(big.length > 40, `only ${big.length} big-rhomb corners`);
    // There are fewer of them, by about phi squared.
    assert.ok(big.length * 2 < tiles.length,
              `${big.length} big corners against ${tiles.length} tile corners`);
    // And they sit on the tiling's own vertices — the inflation is a pre-image,
    // not a figure laid on top. Only the ones well inside: a corner near the
    // edge has its counterpart outside what was collected.
    const have = new Set(tiles);
    const inside = big.filter((p) => {
        const [x, y] = p.split(",").map(Number);
        return x > 150 && x < 650 && y > 150 && y < 650;
    });
    assert.ok(inside.length > 20, `only ${inside.length} corners well inside`);
    const miss = inside.filter((p) => !have.has(p));
    assert.equal(miss.length, 0, `${miss.length} of ${inside.length} are not tiling vertices`);
});

test("Kowalewski: ten band-pair types to five colors, a thin with its opposite thick", () => {
    // c = 3(a+b) mod 5, which is a+b ≡ 2c: the thin {c-1, c+1} and the thick
    // {c-2, c+2} share c, and both are symmetric about family c's direction.
    const color = (a, b) => (3 * (a + b)) % 5;
    const byColor = new Map();
    for (let a = 0; a < 5; a++) {
        for (let b = a + 1; b < 5; b++) {
            const sep = Math.min(b - a, 5 - (b - a));
            const c = color(a, b);
            if (!byColor.has(c)) byColor.set(c, []);
            byColor.get(c).push({ a, b, thick: sep === 1 });
        }
    }
    assert.equal(byColor.size, 5, "five colors");
    for (const [c, pairs] of byColor) {
        assert.equal(pairs.length, 2, `color ${c} has ${pairs.length} orientations`);
        assert.equal(pairs.filter((p) => p.thick).length, 1, `color ${c}: one thick`);
        assert.equal(pairs.filter((p) => !p.thick).length, 1, `color ${c}: one thin`);
        // Jake's boxed identity, and the reason the two are each other's
        // opposite: neither pair touches family c, and both are symmetric
        // about it.
        for (const p of pairs) {
            assert.notEqual(p.a, c, `color ${c} touches its own family`);
            assert.notEqual(p.b, c, `color ${c} touches its own family`);
            assert.equal((p.a + p.b) % 5, (2 * c) % 5, "a + b = 2c");
        }
        const thin = pairs.find((p) => !p.thick), thick = pairs.find((p) => p.thick);
        assert.deepEqual([thin.a, thin.b].sort(), [(c + 4) % 5, (c + 1) % 5].sort());
        assert.deepEqual([thick.a, thick.b].sort(), [(c + 3) % 5, (c + 2) % 5].sort());
    }

    // And the view paints it in five colors of its own — not the family
    // palette, which belongs to the ribbons and is what `bands` composites.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { color: "kowalewski" },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun
    const layer = h.stack.get("penrose-tiles");
    const fills = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    h.redraw();
    const KOW = ["#e4a05c", "#7fbf9b", "#8e9bd4", "#d98ba8", "#b5b35c"];
    const FAMILY = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];
    const used = new Set(fills);
    assert.ok(fills.length > 100, `only ${fills.length} tiles`);
    for (const f of used) {
        assert.ok(KOW.includes(f) || f === "#b48ec4" || f === "#e3a0cb",
                  `${f} is neither a Kowalewski color nor a 2k-gon's`);
        assert.ok(!FAMILY.includes(f), `${f} is a family color: those are the ribbons'`);
    }
    assert.equal(KOW.filter((f) => used.has(f)).length, 5,
                 `all five colors appear: ${[...used]}`);
});

test("split: a hover answers only on the canvas its target is drawn on", () => {
    // Grid elements are on the grid canvas and Penrose elements on the tiling's.
    // Hovering the wrong one detects nothing: one screen in, the other out.
    const left = sizedHost(600, 600), right = sizedHost(600, 600);
    const before = globalThis.document.body.children.length;
    const h = createPentagrid({
        container: left, containerP: right,
        features: {
            gridLines: true, kRegions: true, intersectionDots: true,
            penroseTiles: true, penroseEdges: true, penroseVertices: true,
            hoverRegion: true, hoverFace: true,
        },
    });
    const tipG = globalThis.document.body.children[before];
    const tipP = globalThis.document.body.children[before + 1];
    h.redraw();

    // Each container has its own input surface; the handler is told which.
    const surfaces = [left, right].map((host) =>
        host.children.filter((c) => c.style && c.style.pointerEvents === "auto").at(-1));
    assert.ok(surfaces[0] && surfaces[1], "both canvases need an input surface");
    assert.notEqual(surfaces[0], surfaces[1]);

    const hoverOn = (surface, x, y) => {
        tipG.innerHTML = ""; tipP.innerHTML = "";
        tipG.style.display = "none"; tipP.style.display = "none";
        for (const fn of surface.on?.mousemove ?? []) {
            fn({ clientX: x, clientY: y, offsetX: x, offsetY: y, preventDefault() {} });
        }
        return { g: String(tipG.innerHTML || ""), p: String(tipP.innerHTML || "") };
    };

    // The grid canvas: the region hover answers, and both halves land, each on
    // its own screen — the K-tuple on the grid, the dual vertex on the tiling.
    const onGrid = hoverOn(surfaces[0], 300, 300);
    assert.ok(onGrid.g, "the grid readout should carry what was detected");
    assert.ok(onGrid.p.includes("f</span> ="), "and the tiling readout what it becomes");

    // The same point on the tiling canvas: hoverRegion is a grid hover, so it
    // must not answer there. hoverFace may or may not find a face at this
    // point, but it can never print a K-tuple-only grid readout with no
    // Penrose half, which is the region hover's signature.
    const onPen = hoverOn(surfaces[1], 300, 300);
    assert.ok(!(onPen.g && !onPen.p),
              "a grid hover answered on the Penrose canvas");
});

test("the colored arrows are one filled outline each, and clear the vertex mark", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true, penroseVertices: true, arrows: true },
        tileStyle: { coloredArrows: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-decor");
    const fills = [], strokes = [];
    const arcs = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    layer.ctx.stroke = function () { strokes.push(String(this.strokeStyle)); };
    layer.ctx.arc = (x, y, r) => { arcs.push(r); };
    h.redraw();

    assert.ok(fills.length > 100, `only ${fills.length} arrows`);
    assert.equal(strokes.length, 0,
                 "one filled outline each: the stroked shaft and its separate head are gone");
    // Every arrow has a round tail cap, so there is one arc per fill.
    assert.equal(arcs.length, fills.length, "a cap for every arrow");
    const GREEN = "#3aa655", RED = "#e0423c";
    assert.deepEqual([...new Set(fills)].sort(), [GREEN, RED].sort(),
                     "the two markings keep their colors");
    // Both appear: the doubles meet at the extreme corner, the singles opposite.
    assert.ok(fills.filter((c) => c === GREEN).length > 20);
    assert.ok(fills.filter((c) => c === RED).length > 20);

    // The cap's radius is the shaft half-width, 0.028 of an edge, in pixels.
    const view = h.getView();
    const want = +(0.028 * view.scale).toFixed(4);
    for (const r of arcs) assert.equal(+r.toFixed(4), want, "every cap is the shaft's width");

    // And the margin tracks the vertex MARK, which is a fixed pixel size: with
    // the index circle up the arrows must pull in further than with the dot.
    // Measured per arrow — tail to tip — rather than across the patch, whose
    // extent says nothing about the inset.
    const arrowLength = () => {
        let tail = null;
        const lens = [];
        layer.ctx.arc = (x, y) => { tail = [x, y]; };
        layer.ctx.lineTo = (x, y) => {
            if (tail) lens.push(Math.hypot(x - tail[0], y - tail[1]));
        };
        layer.ctx.fill = () => {};
        lens.length = 0;
        h.redraw();
        // The tip is the farthest point of each arrow from its own tail, and
        // every arrow sits on a unit edge, so the longest is the whole length.
        return Math.max(...lens);
    };
    h.setTileStyle({ vertexMark: "dot" });
    const withDot = arrowLength();
    h.setTileStyle({ vertexMark: "index" });
    const withIndex = arrowLength();
    // An edge is `scale` pixels long, and each end loses the mark's radius plus
    // ARROW_GAP of air: the dot is 3, the index circle max(6, min(9, 0.12*scale)).
    const GAP = 1.5;
    const markR = Math.max(6, Math.min(9, view.scale * 0.12));
    assert.ok(Math.abs(withDot - (view.scale - 2 * (3 + GAP))) < 0.5,
              `with the dot the arrow is the edge less ${3 + GAP} px an end (${withDot.toFixed(1)})`);
    assert.ok(Math.abs((withDot - withIndex) - 2 * (markR - 3)) < 0.5,
              `the index circle costs ${(markR - 3).toFixed(1)} px an end `
              + `(${withDot.toFixed(1)} against ${withIndex.toFixed(1)})`);
});

test("next-penta is penta one generation down, and draws no next-gen edges", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
        tileStyle: { nextPenta: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const fills = [], strokes = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    layer.ctx.stroke = function () { strokes.push(String(this.strokeStyle)); };
    h.redraw();

    const BLUE = "#0000ff", ORANGE = "#e46c0a", YELLOW = "#ffff00";
    const seen = new Set(fills);
    assert.ok(seen.has(BLUE), "the blue ground, same as penta's");
    assert.ok(seen.has(ORANGE) && seen.has(YELLOW),
              `both pentagon kinds: ${[...seen].join(" ")}`);
    assert.equal(strokes.length, 0, "no next-gen rhomb edges — the pentagons alone");

    // One generation down means MORE pentagons than penta on the same patch:
    // the deflated tiling has about phi squared as many rhombs.
    const count = (style) => {
        fills.length = 0;
        h.setTileStyle(style);
        h.redraw();
        return fills.filter((c) => c === ORANGE || c === YELLOW).length;
    };
    const next = count({ nextPenta: true, pentaFace: false });
    const same = count({ nextPenta: false, pentaFace: true });
    assert.ok(next > same * 1.5,
              `next-penta should be the busier of the two (${next} against ${same})`);

    // It is placed by the DEFLATED tiling's index, and Σγ″ = −2Σγ — so a
    // half-integer sum, which is generalised and not Penrose, deflates to an
    // integer one. next-penta draws there and penta does not.
    const pentas = () => {
        fills.length = 0;
        h.redraw();
        return fills.filter((c) => c === ORANGE || c === YELLOW).length;
    };
    h.setTileStyle({ nextPenta: true, pentaFace: false, offPenrose: false });
    h.gamma.setValues([0.1, 0.1, 0.1, 0.1, 0.1]);          // sum 1/2: generalised
    assert.ok(pentas() > 0, "a half-integer sum deflates to Penrose, so this still places");
    h.setTileStyle({ nextPenta: false, pentaFace: true });
    assert.equal(pentas(), 0, "while penta itself has five levels and stays quiet");

    // A sum whose deflation is not integer either goes quiet, and off Penrose
    // brings it back at half strength.
    h.setTileStyle({ nextPenta: true, pentaFace: false });
    h.gamma.setValues([0.05, 0.05, 0.05, 0.05, 0.05]);     // sum 1/4
    assert.equal(pentas(), 0, "five levels down there too: nothing placed");
    h.setTileStyle({ offPenrose: true });
    assert.ok(pentas() > 0, "with the switch on, both readings at half strength");
});

test("penta splits in two: the faces fill, the edges only outline", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const fills = [], strokes = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    layer.ctx.stroke = function () { strokes.push(String(this.strokeStyle)); };
    const run = (style) => {
        h.setTileStyle(style);
        fills.length = 0; strokes.length = 0;
        h.redraw();
        return { fills: [...fills], strokes: [...strokes] };
    };

    const BLUE = "#0000ff", ORANGE = "#e46c0a", YELLOW = "#ffff00";
    const EDGE = "rgba(38, 28, 18, 0.85)";

    const face = run({ pentaFace: true, pentaEdge: false });
    assert.ok(new Set(face.fills).has(BLUE), "the face half keeps the blue ground");
    assert.ok(face.fills.includes(ORANGE) && face.fills.includes(YELLOW));
    assert.equal(face.strokes.filter((c) => c === EDGE).length, 0, "and outlines nothing");

    const edge = run({ pentaFace: false, pentaEdge: true });
    assert.ok(edge.strokes.filter((c) => c === EDGE).length > 50,
              `the edge half outlines them (${edge.strokes.length})`);
    assert.equal(edge.fills.filter((c) => c === BLUE || c === ORANGE || c === YELLOW).length, 0,
                 "and fills nothing — whatever is underneath has to stay visible");

    // One pentagon, one outline: the two halves draw the same shapes.
    const both = run({ pentaFace: true, pentaEdge: true });
    const shapes = face.fills.filter((c) => c === ORANGE || c === YELLOW).length;
    assert.equal(edge.strokes.filter((c) => c === EDGE).length, shapes);
    assert.equal(both.strokes.filter((c) => c === EDGE).length, shapes, "both: filled AND outlined");
    assert.ok(both.fills.filter((c) => c === ORANGE || c === YELLOW).length === shapes);

    // Which is the point: the outlines over next-gen, with the deflation showing.
    const over = run({ pentaFace: false, pentaEdge: true, nextgenFace: true });
    const GOLD = "#f7d058";
    assert.ok(over.fills.includes(GOLD), "next-gen's gold is still there to see");
    assert.ok(over.strokes.filter((c) => c === EDGE).length > 50, "with the pentagons over it");
});

test("a dressing draws with faces off, and next-penta does not bury penta", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const fills = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    const run = (style, feats) => {
        if (feats) h.setFeatures(feats, { merge: true });
        h.setTileStyle(style);
        fills.length = 0;
        h.redraw();
        return [...fills];
    };

    const BLUE = "#0000ff", ORANGE = "#e46c0a", YELLOW = "#ffff00";
    const THICK = "#e8c170", THIN = "#7eb8da";

    // Faces off and nothing dressed: the layer stays down.
    assert.equal(layer.visible(), false);
    assert.equal(run({}).length, 0);

    // Faces off, penta on: the layer comes up on its own, and there is no
    // thick/thin ground under the pentagons — that is what `faces` decides.
    const bare = run({ pentaFace: true });
    assert.equal(layer.visible(), true, "a dressing has to be able to raise its own layer");
    assert.ok(bare.includes(ORANGE) && bare.includes(YELLOW), "the pentagons draw");
    assert.ok(bare.includes(BLUE), "on their own blue ground");
    assert.equal(bare.filter((c) => c === THICK || c === THIN).length, 0,
                 "and no system fill behind them");

    // Faces on: the system goes down first, under the same pentagons.
    const over = run({ pentaFace: true }, { penroseTiles: true });
    assert.ok(over.filter((c) => c === THICK || c === THIN).length > 50,
              "with faces on the thick/thin ground is there");

    // next-penta over penta: both generations' pentagons, since the second
    // must not repaint the ground over the first.
    const pentaOnly = run({ pentaFace: true, nextPenta: false });
    const both = run({ pentaFace: true, nextPenta: true });
    const count = (list) => list.filter((c) => c === ORANGE || c === YELLOW).length;
    assert.ok(count(both) > count(pentaOnly),
              `next-penta adds to penta rather than burying it `
              + `(${count(both)} against ${count(pentaOnly)})`);
    assert.equal(both.filter((c) => c === BLUE).length,
                 pentaOnly.filter((c) => c === BLUE).length,
                 "and the ground is laid once, not twice");
});

test("one dressing does not clip the next: the tile is clipped once", () => {
    // A dressing leaves the current path as the last shape it drew, so a second
    // dressing doing its own clip() clipped itself to one of the first's
    // pentagons. Jake: set penta-edge, set next-penta, most of them blank.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let clips = 0, fills = 0;
    layer.ctx.clip = () => { clips++; };
    layer.ctx.fill = function () {
        if (String(this.fillStyle) === "#e46c0a" || String(this.fillStyle) === "#ffff00") fills++;
    };
    const run = (style) => {
        h.setTileStyle(style);
        clips = 0; fills = 0;
        h.redraw();
        return { clips, fills };
    };

    const alone = run({ pentaEdge: false, pentaFace: false, nextPenta: true });
    const withEdge = run({ pentaEdge: true, pentaFace: false, nextPenta: true });
    assert.ok(alone.fills > 100, `next-penta alone draws (${alone.fills})`);
    assert.equal(withEdge.fills, alone.fills,
                 `penta-edge must not cost next-penta a single pentagon `
                 + `(${withEdge.fills} against ${alone.fills})`);

    // One clip per tile, whatever is on — not one per dressing.
    const two = run({ pentaFace: true, pentaEdge: true, nextPenta: true, kitesFace: false });
    const one = run({ pentaFace: true, pentaEdge: false, nextPenta: false });
    assert.equal(two.clips, one.clips, "the tile is clipped once however many dressings");
});

test("every dressing starts from the tile's own path, not the last one's", () => {
    // A dressing fills its ground with fill(), which takes the CURRENT path —
    // and the one before it left that as the last shape it drew. So with
    // penta-edge on, next-penta's blue ground came out as a pentagon of penta's
    // rather than the tile. Jake: penta-edge is still screwing up next-penta.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    // Record the path each fill was made with: four points is the tile.
    let path = [], grounds = [];
    layer.ctx.beginPath = () => { path = []; };
    layer.ctx.moveTo = (x, y) => path.push([x, y]);
    layer.ctx.lineTo = (x, y) => path.push([x, y]);
    layer.ctx.fill = function () {
        if (String(this.fillStyle) === "#0000ff") grounds.push(path.length);
    };
    const run = (style) => {
        h.setTileStyle(style);
        grounds = [];
        h.redraw();
        return grounds;
    };

    const alone = run({ pentaEdge: false, pentaFace: false, nextPenta: true });
    assert.ok(alone.length > 50, `next-penta lays a ground per tile (${alone.length})`);
    assert.deepEqual([...new Set(alone)], [4], "and the ground is the tile: four corners");

    // The SHAPE is the point: a ground drawn on the path penta-edge left behind
    // would have five corners, not four.
    const withEdge = run({ pentaEdge: true, pentaFace: false, nextPenta: true });
    assert.ok(withEdge.length > 50, "and it is still laid");
    assert.deepEqual([...new Set(withEdge)], [4],
                     "still the tile, not a pentagon left over from penta-edge");
});

test("penta is drawn last: over next-penta, and over next-gen", () => {
    // Jake: penta-edge should be drawn over/after next-penta. The outlines are
    // there to read the generation below through, so they go on top of it.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const order = [];
    layer.ctx.fill = function () { order.push(`fill ${this.fillStyle}`); };
    layer.ctx.stroke = function () { order.push(`stroke ${this.strokeStyle}`); };
    const run = (style) => {
        h.setTileStyle(style);
        order.length = 0;
        h.redraw();
        return [...order];
    };

    const EDGE = "rgba(38, 28, 18, 0.85)";
    const BLUE = "fill #0000ff";
    const GOLD = "fill #f7d058";

    // The ground first, then this generation's pentagons, then penta's outlines.
    const withNext = run({ nextPenta: true, pentaEdge: true, pentaFace: false });
    const firstEdge = withNext.findIndex((o) => o === `stroke ${EDGE}`);
    const lastPent = withNext.map((o, i) => [o, i])
        .filter(([o]) => o === "fill #e46c0a" || o === "fill #ffff00")
        .map(([, i]) => i).pop();
    assert.ok(firstEdge >= 0 && lastPent !== undefined, "both are drawn");
    assert.ok(lastPent < withNext.lastIndexOf(`stroke ${EDGE}`),
              "the last pentagon of the generation below comes before the last outline");
    // And the ground is laid once, before either.
    assert.ok(withNext.indexOf(BLUE) >= 0 && withNext.indexOf(BLUE) < firstEdge,
              "the ground goes down first");

    // Same over next-gen: the deflation, then the outlines on top of it.
    const overGen = run({ nextgenFace: true, pentaEdge: true, pentaFace: false });
    assert.ok(overGen.lastIndexOf(GOLD) < overGen.lastIndexOf(`stroke ${EDGE}`),
              "next-gen's gold is laid before penta's outlines, not over them");
});

test("method's page is one column: the text above the instrument", () => {
    // Jake: move the text above the controls and canvas, centered, right below
    // the step indicator; the canvas as wide as the text and golden-ratio tall.
    const html = readFileSync(new URL("../method.html", import.meta.url), "utf8");
    const order = ["step-nav", "explanation", "controls", "layer-panel", "canvas-container"]
        .map((id) => ({ id, at: html.indexOf(`id="${id}"`) }));
    for (const o of order) assert.ok(o.at > 0, `${o.id} is missing`);
    for (let i = 1; i < order.length; i++) {
        assert.ok(order[i - 1].at < order[i].at,
                  `${order[i - 1].id} must come before ${order[i].id}`);
    }
    // The column IS split's: method loads site.css now and uses .wrap, rather
    // than carrying its own copy of the shell and drifting from it.
    assert.match(html, /<link[^>]+href="\.\/site\.css"/, "method should load site.css");
    assert.match(html, /<div class="wrap">/, "and use the same wrap split does");
    const style = /<style>(.*?)<\/style>/s.exec(html)[1];
    for (const shared of ["nav.site", ".reticulum", ".dial", ".panel-row", ".float-panel",
                          "button.preset", ".sumstrip"]) {
        assert.ok(!new RegExp(`^\\s*\\${shared.startsWith(".") ? "" : ""}${shared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,{]`, "m").test(style),
                  `${shared} is site.css's — method must not keep its own copy`);
    }
    // Two panel columns, as split has.
    assert.ok(html.indexOf('id="layer-panel-p"') > 0, "the second panel column is missing");
    // The two control columns are ONE layout, in site.css, used by both pages:
    // split puts a viewport in each, method puts its single canvas below them.
    const site2 = readFileSync(new URL("../site.css", import.meta.url), "utf8");
    assert.match(site2, /\.duo \{[^}]*grid-template-columns: repeat\(2, var\(--duo-col\)\)/s,
                 "the columns belong to site.css, not to either page");
    const splitHtml2 = readFileSync(new URL("../split.html", import.meta.url), "utf8");
    assert.match(html, /<div class="duo">/, "method uses the shared columns");
    assert.match(splitHtml2, /<div class="duo split">/, "and so does split");
    // Neither page may set its own column tracks any more.
    for (const [name, page] of [["method", html], ["split", splitHtml2]]) {
        const style = /<style>(.*?)<\/style>/s.exec(page)[1];
        assert.ok(!/grid-template-columns/.test(style),
                  `${name} should take its columns from site.css`);
    }
    // The breakpoint is shared too, so they collapse together by construction.
    assert.equal((site2.match(/@media \(max-width: 1240px\)/g) ?? []).length >= 1, true,
                 "the collapse is site.css's");

    // And the controls row is a row, not site.css's white panel: here it holds
    // the gamma bank folded, so the panel was an empty rectangle.
    assert.match(html, /\.controls \{[^}]*background: none/s,
                 "the controls box should not be a panel on this page");
    // The old two-column layout is gone, and so is the height arithmetic.
    const src = readFileSync(new URL("../src/method.ts", import.meta.url), "utf8");
    assert.ok(!src.includes("fitStage"), "the ratio is CSS's now, not the page's");
});

test("the afterimage switch swaps the whole P1 palette at once", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let fills = [];
    layer.ctx.fill = function () { fills.push(String(this.fillStyle)); };
    const run = (style) => {
        h.setTileStyle(style);
        fills = [];
        h.redraw();
        return new Set(fills);
    };

    const BLUE = "#0000ff", ORANGE = "#e46c0a", YELLOW = "#ffff00";
    const PALE_YELLOW = "#f1e07b", PALE_BLUE = "#b6e6ff", PALE_PURPLE = "#d9dbfe";

    const plain = run({ pentaFace: true, afterimage: false });
    assert.ok(plain.has(BLUE) && plain.has(ORANGE) && plain.has(YELLOW));

    const after = run({ pentaFace: true, afterimage: true });
    for (const c of [BLUE, ORANGE, YELLOW]) {
        assert.ok(!after.has(c), `${c} should be gone under the afterimage`);
    }
    assert.ok(after.has(PALE_YELLOW) && after.has(PALE_BLUE) && after.has(PALE_PURPLE),
              `got ${[...after].join(" ")}`);

    // One palette: next-penta takes it too, rather than half the page in each
    // scheme — and its cache has to be cleared, since the pentagons carry it.
    const next = run({ pentaFace: false, nextPenta: true, afterimage: true });
    assert.ok(next.has(PALE_YELLOW) && next.has(PALE_BLUE) && next.has(PALE_PURPLE),
              `next-penta should follow: ${[...next].join(" ")}`);
    const nextPlain = run({ pentaFace: false, nextPenta: true, afterimage: false });
    assert.ok(nextPlain.has(BLUE) && nextPlain.has(ORANGE) && nextPlain.has(YELLOW),
              "and switch back");
});

test("innie and outie bow every penta boundary, each pushing into the next", () => {
    // Jake's cycle: yellow convex to blue, blue convex to orange, orange convex
    // to yellow. The two arcs through one edge have the same radius and the
    // same 72 degrees and differ only in their center — the pentagon's own, or
    // its mirror across that edge, which is where the neighbor's center is.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        // The OUTLINE traces the boundary and nothing else. With the face on,
        // the lens pass would add two arcs an almond to the count — a different
        // figure, with its own test.
        tileStyle: { pentaFace: false, pentaEdge: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let arcs = [], lines = 0;
    layer.ctx.arc = (x, y, r, a0, a1) => { arcs.push({ x, y, r, sweep: a1 - a0 }); };
    layer.ctx.lineTo = () => { lines++; };
    const run = (shape) => {
        h.setTileStyle({ pentaShape: shape });
        arcs = []; lines = 0;
        h.redraw();
        return { arcs: [...arcs], lines };
    };

    const flat = run("penta");
    assert.equal(flat.arcs.length, 0, "the straight tiling draws no arcs");
    assert.ok(flat.lines > 100);

    for (const shape of ["innie", "outie"]) {
        const bowed = run(shape);
        assert.ok(bowed.arcs.length > 100, `${shape}: only ${bowed.arcs.length} arcs`);
        // Five edges a pentagon, every one an arc: no straight edge survives.
        assert.equal(bowed.arcs.length % 5, 0, `${shape}: not whole pentagons`);
        // The layer draws tile outlines with lineTo as well, so the test is
        // that the pentagons stopped using it: four straight edges a pentagon
        // traded for five arcs.
        const traded = flat.lines - bowed.lines;
        assert.ok(Math.abs(traded - bowed.arcs.length * 4 / 5) < 5,
                  `${shape}: ${traded} straight edges went for ${bowed.arcs.length} arcs`);
        // Every arc is the pentagon's own radius, and every sweep is 72 degrees.
        const R = bowed.arcs[0].r;
        for (const a of bowed.arcs) {
            assert.ok(Math.abs(a.r - R) < 1e-6, `${shape}: radius ${a.r} against ${R}`);
            assert.ok(Math.abs(Math.abs(a.sweep) - (2 * Math.PI / 5)) < 1e-6,
                      `${shape}: a sweep of ${(a.sweep * 180 / Math.PI).toFixed(1)} degrees`);
        }
    }

    // innie and outie are opposites: the same edges, bowed the other way, so
    // every arc of one is centered where the other's is not.
    const inn = run("innie").arcs.map((a) => `${a.x.toFixed(2)},${a.y.toFixed(2)}`);
    const out = run("outie").arcs.map((a) => `${a.x.toFixed(2)},${a.y.toFixed(2)}`);
    assert.equal(inn.length, out.length);
    const same = inn.filter((c, i) => c === out[i]).length;
    assert.equal(same, 0, `${same} arcs did not move when the cycle reversed`);
});

test("the boundary dropdown is one family: circles, bisectors, two bends", () => {
    // Jake: w = 1, build it, but add a checkbox — "I still love the circles very
    // much" — and then make it a dropdown with circles the default and two
    // bends beside them. The edges are the same edges in all four; what changes
    // is what each one IS.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        tileStyle: { pentaFace: false, pentaEdge: true },   // the boundary alone
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let arcs = 0, quads = 0, lines = 0, pts = [];
    layer.ctx.arc = () => { arcs++; };
    layer.ctx.quadraticCurveTo = () => { quads++; };
    layer.ctx.lineTo = (x, y) => { lines++; pts.push([x, y]); };
    const run = (style) => {
        h.setTileStyle(style);
        arcs = 0; quads = 0; lines = 0; pts = [];
        h.redraw();
        return { arcs, quads, lines, pts: [...pts] };
    };

    const circles = run({ pentaShape: "innie", pentaBoundary: "circle" });
    assert.ok(circles.arcs > 1000, `only ${circles.arcs} arcs`);
    assert.equal(circles.quads, 0, "on circles every edge is an arc");

    const conics = run({ pentaShape: "innie", pentaBoundary: "bisector" });
    assert.ok(conics.quads > conics.arcs, "most edges should take the conic");
    // Every edge still gets exactly one curve: the dropdown moves them between
    // the two calls, it does not add or drop any.
    assert.equal(conics.arcs + conics.quads, circles.arcs,
                 `${conics.arcs} + ${conics.quads} against ${circles.arcs}`);

    // The fallback is not a failure: an edge whose blue wedge is the 252°
    // reflex at a lone-Pe1 corner has a bisector pointing backwards, and the
    // circle is the right thing to draw there.
    assert.ok(conics.arcs > 0, "some edges must fall back, and the probe says a third do");

    // outie trades the same edges — the cycle decides the side, not the form.
    const other = run({ pentaShape: "outie", pentaBoundary: "bisector" });
    assert.equal(other.arcs, conics.arcs);
    assert.equal(other.quads, conics.quads);

    // Neither bend draws a curve at all: every edge becomes two straight legs,
    // and the angle is the only difference between the two of them.
    const flat = run({ pentaShape: "penta" });
    const pentagons = circles.arcs / 5;
    assert.ok(Number.isInteger(pentagons), `${circles.arcs} arcs is not whole pentagons`);
    for (const form of ["bend18", "bend36"]) {
        const bend = run({ pentaShape: "innie", pentaBoundary: form });
        assert.equal(bend.arcs, 0, `${form} should hold no curve`);
        assert.equal(bend.quads, 0);
        // Ten lineTo a pentagon — corner, apex, corner — against the straight
        // tiling's four, which closePath finishes. Both counts also carry the
        // tile outlines, three a tile, so the difference is what to measure.
        assert.equal(bend.lines - flat.lines, pentagons * 6,
                     `${form}: ${bend.lines - flat.lines} legs over ${pentagons} pentagons`);
    }
    // The shallow one is shallower everywhere: tan 18° against tan 36°, on the
    // same chords, so every apex is nearer its edge and none of them moved.
    const shallow = run({ pentaShape: "innie", pentaBoundary: "bend18" });
    const deep = run({ pentaShape: "innie", pentaBoundary: "bend36" });
    assert.equal(shallow.pts.length, deep.pts.length);
    let moved = 0;
    for (let i = 0; i < shallow.pts.length; i++) {
        const [sx, sy] = shallow.pts[i], [dx, dy] = deep.pts[i];
        if (Math.hypot(sx - dx, sy - dy) > 1e-9) moved++;
    }
    // Half the points are corners, shared; half are apexes, and every one of
    // those is further out at 36°.
    assert.ok(moved > 0, "the two bends drew the same figure");
    assert.ok(moved < shallow.pts.length,
              "the corners should not move when only the angle does");
});

test("a bend's legs lean 36 or 18 degrees off the chord, the arc's tangents", () => {
    // The tangent-chord angle on a 72° arc is half of it. So a 36° apex sits
    // tan 36° of the half chord off the middle — the crossing of the arc's two
    // tangents, which is where a Bézier control point would go. 18° is the same
    // reading of half the arc.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        tileStyle: { pentaFace: true, pentaShape: "innie", pentaBoundary: "bend36" },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let log = [];
    layer.ctx.clip = () => { log.push({ t: "clip" }); };
    layer.ctx.moveTo = (x, y) => { log.push({ t: "moveTo", x, y }); };
    layer.ctx.lineTo = (x, y) => { log.push({ t: "lineTo", x, y }); };
    for (const [form, ang] of [["bend36", Math.PI / 5], ["bend18", Math.PI / 10]]) {
        h.setTileStyle({ pentaBoundary: form });
        log = [];
        h.redraw();

        // The pentagons are the one pass after the last tile clip; a bent one is
        // ten lineTo off its moveTo, apex and corner alternating.
        const last = log.map((e) => e.t).lastIndexOf("clip");
        const shapes = [];
        for (const e of log.slice(last + 1)) {
            if (e.t === "moveTo") shapes.push([[e.x, e.y]]);
            else if (shapes.length) shapes[shapes.length - 1].push([e.x, e.y]);
        }
        const bent = shapes.filter((s) => s.length === 11);
        assert.ok(bent.length > 500, `only ${bent.length} bent pentagons`);

        let inward = 0;
        for (const s of bent) {
            let cx = 0, cy = 0;                     // the center, from the corners
            for (let i = 0; i < 10; i += 2) { cx += s[i][0] / 5; cy += s[i][1] / 5; }
            for (let i = 0; i < 10; i += 2) {
                const a = s[i], apex = s[i + 1], b = s[(i + 2) % 10];
                const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
                const half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
                const rise = Math.hypot(apex[0] - mx, apex[1] - my);
                // Over the middle of the chord, at its tangent of the half.
                assert.ok(Math.abs(rise - half * Math.tan(ang)) < 1e-6 * half + 1e-6,
                          `${form}: a rise of ${rise.toFixed(3)} on a half chord `
                          + `of ${half.toFixed(3)}`);
                const dot = (apex[0] - mx) * (mx - cx) + (apex[1] - my) * (my - cy);
                if (dot < 0) inward++;
            }
        }
        // Both ways are used: the cycle bends some edges in and some out, and a
        // boundary that went one way everywhere would mean the cycle was dropped.
        assert.ok(inward > 0 && inward < bent.length * 5,
                  `${form}: ${inward} of ${bent.length * 5} legs bend inward`);
    }
});

test("the pentagons are one unclipped pass over the patch, not one per tile", () => {
    // Jake: "really nice, especially the innies. The outies...bleed between
    // tiles." Per-tile was fine while the boundaries were straight — a pentagon
    // across a tile edge is proposed by both tiles, each drew its half clipped
    // to itself, and the halves met on the edge. An `outie` bows OUTWARD: the
    // overhang lands in a tile that may not propose that pentagon at all, and
    // so clips it away; and where that tile does propose it, its own ground is
    // laid afterward and paints the overhang over.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        // The face alone: face and edge are separate passes now, so with both
        // on every pentagon is traced twice and the count below would double.
        tileStyle: { pentaFace: true, pentaEdge: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let log = [];
    layer.ctx.clip = () => { log.push({ t: "clip" }); };
    layer.ctx.moveTo = (x, y) => { log.push({ t: "moveTo", x, y }); };
    layer.ctx.lineTo = (x, y) => { log.push({ t: "lineTo", x, y }); };
    layer.ctx.arc = () => { log.push({ t: "arc" }); };
    layer.ctx.quadraticCurveTo = () => { log.push({ t: "quad" }); };
    const run = (shape) => {
        h.setTileStyle({ pentaShape: shape });
        log = [];
        h.redraw();
        const last = log.map((e) => e.t).lastIndexOf("clip");
        assert.ok(last > 0, `${shape}: the tiles never clipped, so nothing is proved`);
        const parts = [];
        for (const e of log.slice(last + 1)) {
            if (e.t === "moveTo") parts.push({ pts: [[e.x, e.y]], curves: 0 });
            else if (!parts.length) continue;
            else if (e.t === "lineTo") parts[parts.length - 1].pts.push([e.x, e.y]);
            else parts[parts.length - 1].curves++;
        }
        return {
            // The last tile to clip still traces its own four-corner outline
            // afterward; a pentagon is the five-cornered shape.
            shapes: parts.filter((s) => s.pts.length === 5 || s.curves === 5),
            curved: log.slice(0, last).filter((e) => e.t === "arc" || e.t === "quad").length,
        };
    };
    const centers = (shapes) => new Set(shapes.map((s) => {
        const n = s.pts.length;
        return `${(s.pts.reduce((a, p) => a + p[0], 0) / n).toFixed(2)},`
             + `${(s.pts.reduce((a, p) => a + p[1], 0) / n).toFixed(2)}`;
    }));

    // Straight first, where every corner is on the wire and the pentagons can
    // be told apart by their centers.
    const flat = run("penta");
    assert.ok(flat.shapes.length > 500, `only ${flat.shapes.length} pentagons on the sun`);
    // The pass draws each pentagon ONCE: the two tiles sharing one both propose
    // it, and drawn twice a half-strength reading would come out at full.
    assert.equal(centers(flat.shapes).size, flat.shapes.length,
                 `${flat.shapes.length - centers(flat.shapes).size} drawn twice`);

    for (const shape of ["penta", "innie", "outie"]) {
        const r = run(shape);
        // Nothing bowed is drawn while a tile's clip is in force: every
        // pentagon comes after the last of them, in the pass, uncut.
        assert.equal(r.curved, 0, `${shape}: ${r.curved} curves drawn under a clip`);
        // The cycle bows the boundaries. It does not change which pentagons
        // there are, or how many.
        assert.equal(r.shapes.length, flat.shapes.length, `${shape}: a different count`);
        if (shape !== "penta")
            for (const s of r.shapes) assert.equal(s.curves, 5, "five bowed edges");
    }
});

test("next-gen and kites split into a face and an edge, and the edges go on top", () => {
    // Jake: take next-gen and separate IT into faces and edges, the same with
    // kites, and in both cases make sure edges is on top. Each face begins by
    // filling the whole tile, so a face drawn after an edge set would bury it —
    // every face first, then every edge set.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    let log = [];
    layer.ctx.clip = () => { log.push("clip"); };
    layer.ctx.fill = () => { log.push("fill"); };
    layer.ctx.stroke = () => { log.push("stroke"); };
    const run = (style) => {
        h.setTileStyle({
            pentaFace: false, pentaEdge: false, nextPenta: false, curves: false, p1: false,
            nextgenFace: false, nextgenEdge: false, kitesFace: false, kitesEdge: false,
            ...style,
        });
        log = [];
        h.redraw();
        return { fills: log.filter((e) => e === "fill").length,
                 strokes: log.filter((e) => e === "stroke").length, log: [...log] };
    };

    for (const half of ["nextgen", "kites"]) {
        const face = run({ [`${half}Face`]: true });
        assert.ok(face.fills > 500, `${half}-face: only ${face.fills} fills`);
        assert.equal(face.strokes, 0, `${half}-face draws no line of its own`);

        const edge = run({ [`${half}Edge`]: true });
        assert.ok(edge.strokes > 200, `${half}-edge: only ${edge.strokes} strokes`);
        assert.equal(edge.fills, 0, `${half}-edge fills nothing — that is the point`);

        // Either half alone still raises the layer, as the dressings do.
        const both = run({ [`${half}Face`]: true, [`${half}Edge`]: true });
        assert.equal(both.fills, face.fills, `${half}: the halves should not interfere`);
        assert.equal(both.strokes, edge.strokes);
    }

    // And the order, with all four on: a tile's clip opens its block, and
    // inside it no fill may come after a stroke.
    const all = run({ nextgenFace: true, nextgenEdge: true, kitesFace: true, kitesEdge: true });
    let blocks = 0, late = 0;
    let seenStroke = false;
    for (const e of all.log) {
        if (e === "clip") { blocks++; seenStroke = false; continue; }
        if (e === "stroke") seenStroke = true;
        else if (e === "fill" && seenStroke) late++;
    }
    assert.ok(blocks > 400, `only ${blocks} tiles`);
    assert.equal(late, 0, `${late} faces were laid over an edge set`);
});

test("every outline is drawn over every face, the passes included", () => {
    // Jake: next-gen edge should write over any face, namely the group faces
    // (pentaplex, in 18, out 18). Those are passes over the whole patch, so an
    // edge set drawn inside the tile loop came out underneath them. Order now:
    // tile faces, the two face passes, then the outlines coarse to fine.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        tileStyle: { p1Face: true, nextgenEdge: true, kitesEdge: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const log = [];
    layer.ctx.fill = function () { log.push({ t: "fill", style: String(this.fillStyle) }); };
    layer.ctx.stroke = function () { log.push({ t: "stroke", style: String(this.strokeStyle) }); };
    const run = (style) => {
        h.setTileStyle(style);
        log.length = 0;
        h.redraw();
        const at = (p) => log.map((e, i) => [e, i]).filter(([e]) => p(e)).map(([, i]) => i);
        return {
            faces: at((e) => e.t === "fill" && ["#0000ff", "#ffff00", "#e46c0a"].includes(e.style)),
            gen: at((e) => e.t === "stroke" && e.style === "#777"),
            p2: at((e) => e.t === "stroke" && e.style === "#556"),
        };
    };

    for (const shape of ["pentaplex", "in18", "out18"]) {
        const r = run({ p1Shape: shape });
        assert.ok(r.faces.length > 100, `${shape}: only ${r.faces.length} group faces`);
        assert.ok(r.gen.length > 100, `${shape}: only ${r.gen.length} next-gen strokes`);
        assert.ok(r.p2.length > 100, `${shape}: only ${r.p2.length} kites strokes`);
        // Not one face after the first outline.
        assert.ok(Math.max(...r.faces) < Math.min(...r.gen),
                  `${shape}: a group face at ${Math.max(...r.faces)} is over `
                  + `a next-gen edge at ${Math.min(...r.gen)}`);
        assert.ok(Math.max(...r.faces) < Math.min(...r.p2), `${shape}: and over kites`);
    }

    // And penta's own outline stays above those, which is what Jake asked for
    // when next-penta went in: the generation below read THROUGH the pentagons.
    const over = run({ p1Shape: "pentaplex", pentaEdge: true });
    const pentaEdges = log.map((e, i) => [e, i])
        .filter(([e]) => e.t === "stroke" && e.style.startsWith("rgba(38"))
        .map(([, i]) => i);
    assert.ok(pentaEdges.length > 100, `only ${pentaEdges.length} penta outlines`);
    assert.ok(Math.min(...pentaEdges) > Math.max(...over.gen), "penta-edge over next-gen-edge");
});

test("big rhombs splits into a face and a grid", () => {
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        tileStyle: { bigRhombsFace: true, bigRhombsGrid: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("big-rhombs");
    let fills = 0, strokes = 0;
    layer.ctx.fill = () => { fills++; };
    layer.ctx.stroke = () => { strokes++; };
    const run = (style) => {
        h.setTileStyle(style);
        fills = 0; strokes = 0;
        h.redraw();
        return { fills, strokes, on: layer.visible() };
    };

    const both = run({ bigRhombsFace: true, bigRhombsGrid: true });
    assert.ok(both.fills > 50 && both.strokes > 50, `${both.fills} fills, ${both.strokes} strokes`);
    assert.equal(both.fills, both.strokes, "one of each per inflated tile");

    const face = run({ bigRhombsFace: true, bigRhombsGrid: false });
    assert.equal(face.fills, both.fills);
    assert.equal(face.strokes, 0, "the face half draws no outline");

    const grid = run({ bigRhombsFace: false, bigRhombsGrid: true });
    assert.equal(grid.strokes, both.strokes);
    assert.equal(grid.fills, 0, "the grid half fills nothing");

    // Either half raises the layer; neither leaves it dark.
    assert.ok(face.on && grid.on);
    assert.equal(run({ bigRhombsFace: false, bigRhombsGrid: false }).on, false);
});

test("the circles' overlaps are painted blue, and only the circles have any", () => {
    // Jake: for innie and outie circle, color the intersecting part of the
    // circle blue, to match stars and Pe5. A bulge and the dent across the same
    // edge ARE the same arc, so edge neighbors meet exactly; two pentagons
    // sharing a lone CORNER have circles that cross there and again at its
    // mirror in the line of centers, and the almond between was painted twice.
    const h = createPentagrid({
        container: sizedHost(800, 800),
        features: { penroseTiles: false },
        tileStyle: { pentaFace: true },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    const layer = h.stack.get("penrose-tiles");
    const log = [];
    layer.ctx.arc = (x, y, r, a0, a1) => { log.push({ t: "arc", sweep: a1 - a0 }); };
    layer.ctx.fill = function () { log.push({ t: "fill", style: String(this.fillStyle) }); };
    const run = (style) => {
        h.setTileStyle({ pentaShape: "innie", pentaBoundary: "circle",
                         pentaFace: true, pentaEdge: false, ...style });
        log.length = 0;
        h.redraw();
        const deg = (e) => Math.abs(e.sweep) * 180 / Math.PI;
        return {
            // A pentagon boundary sweeps 72 degrees an arc; a lens 36.
            wide: log.filter((e) => e.t === "arc" && Math.abs(deg(e) - 72) < 1e-6).length,
            lens: log.filter((e) => e.t === "arc" && Math.abs(deg(e) - 36) < 1e-6).length,
            other: log.filter((e) => e.t === "arc" && Math.abs(deg(e) - 72) > 1e-6
                                                   && Math.abs(deg(e) - 36) > 1e-6).length,
            blues: log.map((e, i) => [e, i]).filter(([e]) => e.t === "fill" && e.style === "#0000ff"),
            pents: log.map((e, i) => [e, i])
                .filter(([e]) => e.t === "fill" && ["#ffff00", "#e46c0a"].includes(e.style)),
        };
    };

    const inn = run({});
    assert.equal(inn.other, 0, "every arc is a boundary or a lens");
    assert.ok(inn.wide > 1000, `only ${inn.wide} boundary arcs`);
    assert.equal(inn.lens % 2, 0, "a lens is two arcs");
    const innLenses = inn.lens / 2;
    assert.ok(innLenses > 50, `only ${innLenses} lenses in innie`);
    // One blue fill per lens, and all of them AFTER the pentagons — a lens has
    // to go over the two faces that painted it twice. The blues before them are
    // the P1 ground, one a tile, which is the same color.
    const lastPent = Math.max(...inn.pents.map(([, i]) => i));
    const late = inn.blues.filter(([, i]) => i > lastPent);
    assert.equal(late.length, innLenses, `${late.length} late blues for ${innLenses} lenses`);
    assert.ok(inn.blues.length > late.length, "the ground is blue too, and comes first");

    // outie overlaps far more — the probe counts 582 against innie's 178.
    const out = run({ pentaShape: "outie" });
    const outLenses = out.lens / 2;
    assert.ok(outLenses > innLenses * 2,
              `outie should overlap much more (${outLenses} against ${innLenses})`);

    // Nothing else overlaps itself: the straight tiling has no arc at all, and
    // the bends and the bisectors are not circles.
    for (const style of [{ pentaShape: "penta" },
                         { pentaBoundary: "bend18" }, { pentaBoundary: "bend36" },
                         { pentaBoundary: "bisector" }]) {
        const r = run(style);
        assert.equal(r.lens, 0, `${JSON.stringify(style)} drew ${r.lens / 2} lenses`);
    }
    // And a lens is a fill, so it waits for the face.
    assert.equal(run({ pentaFace: false, pentaEdge: true }).lens, 0,
                 "no face, nothing painted twice, no lens");
});

test("the ammann switch sits before curves, and draws red bars over the faces", () => {
    // Jake: Ammann bars in classic red, before curves. They can be put on all
    // LI rhombs. The geometry and the four facts behind it are tested in
    // tools/ammann.test.mjs; this is the switch, the color and the height.
    const panel = sizedHost(800, 200);
    const h = createPentagrid({
        container: sizedHost(800, 800),
        panel,
        features: { penroseTiles: false },
    });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);          // the sun

    // In the penrose face row's misc group, immediately before curves.
    const row = panelSwitches(panel).filter((s) => s.row === "penrose face").map((s) => s.label);
    assert.deepEqual(row, ["edge", "face", "edge", "face", "ammann", "curves",
                           "face edges", "off Penrose"],
                     `the row reads ${row.join(" ")}`);

    const layer = h.stack.get("penrose-tiles");
    const log = [];
    layer.ctx.fill = function () { log.push({ t: "fill", style: String(this.fillStyle) }); };
    layer.ctx.stroke = function () { log.push({ t: "stroke", style: String(this.strokeStyle) }); };
    layer.ctx.lineTo = () => { log.push({ t: "line" }); };
    const run = (style) => {
        h.setTileStyle({ ammann: false, kitesEdge: false, nextgenEdge: false,
                         p1Face: false, kitesFace: false, ...style });
        log.length = 0;
        h.redraw();
        const at = (p) => log.map((e, i) => [e, i]).filter(([e]) => p(e)).map(([, i]) => i);
        return {
            red: at((e) => e.t === "stroke" && e.style === "#d40000"),
            gen: at((e) => e.t === "stroke" && e.style === "#777"),
            p2: at((e) => e.t === "stroke" && e.style === "#556"),
            faces: at((e) => e.t === "fill" && ["#0000ff", "#ffff00", "#e46c0a"].includes(e.style)),
            lines: log.filter((e) => e.t === "line").length,
            on: layer.visible(),
        };
    };

    // Off by default, and either way the layer only lights up for a reason.
    assert.equal(run({}).red.length, 0, "nothing red with the switch off");
    assert.equal(run({}).on, false, "and nothing to draw at all");

    const bars = run({ ammann: true });
    assert.ok(bars.on, "the bars raise the layer, as the dressings do");
    assert.ok(bars.red.length > 100, `only ${bars.red.length} red strokes`);
    // Five chords a tile, drawn as one path: two lineTo-free moveTos each, so
    // the line count is five a tile and the stroke count one.
    assert.ok(bars.lines > bars.red.length * 4,
              `${bars.lines} legs for ${bars.red.length} strokes`);

    // Over the faces, and under the other outline sets, being the coarsest.
    const all = run({ ammann: true, p1Face: true, kitesFace: true,
                      kitesEdge: true, nextgenEdge: true });
    assert.ok(Math.max(...all.faces) < Math.min(...all.red),
              "a bar must go over every face");
    assert.ok(Math.max(...all.red) < Math.min(...all.gen),
              "and under next-rhomb's edges");
    assert.ok(Math.max(...all.red) < Math.min(...all.p2), "and under kites'");
});
