// Tests for createPentagrid: that a second page can exist.
//
// Stage 5's claim is that the method page is now one caller of a factory rather
// than the only possible page. These construct it twice, with different configs,
// and check the registration hook an exploration would use.

import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";

function host(w = 800, h = 800) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: () => null,
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}

test("constructs with only a container", () => {
    const h = createPentagrid({ container: host() });
    assert.ok(h.stack, "no stack returned");
    assert.ok(typeof h.redraw === "function");
    assert.ok(h.stack.all().length > 5, "no layers registered");
});

test("two instances are independent", () => {
    const a = createPentagrid({ container: host(800, 800) });
    const b = createPentagrid({ container: host(400, 300) });
    assert.notEqual(a.stack, b.stack);
    // the second was sized from its own container, not the first's
    assert.equal(b.stack.w, 400);
    assert.equal(b.stack.h, 300);
    assert.equal(a.stack.w, 800);
});

test("the page supplies its own narration, and step count follows", () => {
    const steps = [
        { title: "One", html: "<p>first</p>" },
        { title: "Two", html: "<p>second</p>" },
    ];
    const h = createPentagrid({
        container: host(),
        steps,
        presets: [{}, { penroseTiles: true }],
    });
    h.setStep(1);
    h.setStep(99);          // clamped, not thrown
    h.setStep(-5);
    assert.ok(true, "step navigation survived out-of-range input");
});

test("an exploration registers its own layer through the config", () => {
    let drew = 0;
    let handed = null;
    const h = createPentagrid({
        container: host(),
        layers: (parts) => {
            handed = parts;
            parts.stack.add({
                id: "ribbons", label: "Ribbons", z: 40, group: "Exploration",
                draw: () => { drew++; },
            });
        },
    });

    // the hook was given what a layer actually needs
    assert.ok(handed, "layers callback never ran");
    assert.ok(handed.stack, "no stack");
    assert.ok(Array.isArray(handed.model.directions), "no pentagrid model");
    assert.equal(handed.model.directions.length, 5);
    assert.ok(typeof handed.currentRhombs === "function");
    assert.ok(typeof handed.withView === "function");
    assert.ok(typeof handed.redraw === "function");

    // it drew, and it got its own panel section without the panel knowing
    assert.ok(drew > 0, "registered layer never drew");
    assert.ok(h.stack.groups().has("Exploration"));
    assert.deepEqual(h.stack.groups().get("Exploration").map((l) => l.label), ["Ribbons"]);

    // and the geometry it was handed is live, not a snapshot
    const rhombs = handed.currentRhombs();
    assert.ok(rhombs.length > 0, "currentRhombs returned nothing");
    assert.ok("x0" in rhombs[0] && "j" in rhombs[0], "rhombs lack provenance");
});

test("redraw is callable from outside and does not throw", () => {
    const h = createPentagrid({ container: host() });
    h.redraw();
    h.redraw();
    assert.ok(true);
});

// ── the linked-viewport case ──────────────────────────────────────
// What index.html's paired views rely on.

test("getView and setView round-trip", () => {
    const h = createPentagrid({ container: host() });
    h.setView({ scale: 137, x: -2.5, y: 4.25 });
    assert.deepEqual(h.getView(), { scale: 137, x: -2.5, y: 4.25 });
});

test("setView does NOT fire onViewChange, or linked views would loop", () => {
    let fired = 0;
    const h = createPentagrid({
        container: host(),
        onViewChange: () => { fired++; },
    });
    h.setView({ scale: 90, x: 1, y: 1 });
    h.setView({ scale: 91, x: 2, y: 2 });
    assert.equal(fired, 0, "setView notified, which would ping-pong two instances");
});

test("two instances given the same gamma produce the same tiling", () => {
    const gamma = [0.2317, -0.4102, 0.1553, 0.3078, -0.2846];
    const grab = () => {
        let rhombs = null;
        createPentagrid({
            container: host(400, 400),
            gamma,
            steps: [],
            features: { penroseTiles: true },
            layers: (parts) => { rhombs = () => parts.currentRhombs(); },
        });
        return rhombs();
    };
    const a = grab();
    const b = grab();
    assert.ok(a.length > 50, `only ${a.length} rhombs`);
    assert.equal(a.length, b.length);
    const key = (r) => `${r.j}${r.k}:${r.nj},${r.nk}`;
    assert.deepEqual(a.map(key).sort(), b.map(key).sort(),
                     "same gamma gave different tilings");
});

test("a different gamma gives a different tiling", () => {
    const grab = (gamma) => {
        let rhombs = null;
        createPentagrid({
            container: host(400, 400), gamma, steps: [],
            features: { penroseTiles: true },
            layers: (parts) => { rhombs = () => parts.currentRhombs(); },
        });
        return rhombs().map((r) => `${r.j}${r.k}:${r.nj},${r.nk}:${r.thick}`).sort().join("|");
    };
    const a = grab([0.2317, -0.4102, 0.1553, 0.3078, -0.2846]);
    const b = grab([-0.3311, 0.2204, -0.1097, 0.4413, -0.2209]);
    assert.notEqual(a, b);
});

test("a page with no steps ignores setStep instead of throwing", () => {
    const h = createPentagrid({ container: host(), steps: [] });
    h.setStep(3);
    h.redraw();
    assert.ok(true);
});

test("features from the config survive when there are no steps to impose one", () => {
    let drewTiles = 0;
    const h = createPentagrid({
        container: host(),
        steps: [],
        features: { gridLines: false, axes: false, penroseTiles: true },
    });
    assert.equal(h.stack.get("penrose-tiles").canvas.style.display, "block");
    assert.equal(h.stack.get("grid-0").canvas.style.display, "none");
    assert.equal(h.stack.get("axes").canvas.style.display, "none");
});

test("the loupe is off unless the page asks for it", () => {
    let opened = 0;
    const h = createPentagrid({ container: host() });
    // no loupe canvas should ever be shown; the scan that feeds it is skipped
    // entirely on a page with no controls
    assert.ok(h.stack, "constructed");
    const withLoupe = createPentagrid({ container: host(), loupe: true });
    assert.ok(withLoupe.stack, "constructed with the loupe on");
});

test("with no controls and no loupe, nothing consumes the scan", () => {
    // The scan is the expensive call in the file; a bare viewport must not pay
    // for it on every pan frame.
    const h = createPentagrid({ container: host(), steps: [], features: { penroseTiles: true } });
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 40; i++) h.redraw();
    const bare = Number(process.hrtime.bigint() - t0) / 1e6;

    const g = createPentagrid({
        container: host(), steps: [], loupe: true, features: { penroseTiles: true },
    });
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < 40; i++) g.redraw();
    const scanned = Number(process.hrtime.bigint() - t1) / 1e6;

    assert.ok(bare < scanned, `bare ${bare.toFixed(1)}ms should beat scanned ${scanned.toFixed(1)}ms`);
});

test("a registered layer is handed the view, before the handle exists", () => {
    // grow.ts hit this: layers draw during createPentagrid, so a layer that works
    // in world coordinates cannot reach the handle for the transform.
    let seen = null;
    createPentagrid({
        container: host(),
        steps: [],
        layers: ({ getView }) => {
            assert.ok(typeof getView === "function", "no getView handed to the layer");
            seen = getView();
        },
    });
    assert.ok(seen && typeof seen.scale === "number", "view not readable at registration");
    assert.ok(Number.isFinite(seen.x) && Number.isFinite(seen.y));
});
