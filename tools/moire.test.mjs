// moire.html: two pentagrids, one the other deflated, and the register
// between them. PLAN §12.

import test from "node:test";
import assert from "node:assert/strict";
import { handlers, inputs, makeStub } from "./domstub.mjs";
import { convertView } from "../dist/view/register.js";

const PHI = (1 + Math.sqrt(5)) / 2;

test("converting a view between generations keeps the same world rectangle", () => {
    // A view is in TILING units and a tiling unit is λ world units, so the two
    // sides do not share view numbers. What they must agree on is the world:
    // the rectangle on screen, and where it sits.
    const v = { scale: 60, x: 1.7, y: -0.4 };
    const W = 800, H = 600;
    // The world rectangle a canvas shows, from its own view and its own λ.
    const world = (view, lam) => ({
        xMin: (view.x - W / 2 / view.scale) * lam,
        xMax: (view.x + W / 2 / view.scale) * lam,
        yMin: (view.y - H / 2 / view.scale) * lam,
        yMax: (view.y + H / 2 / view.scale) * lam,
    });
    for (const m of [-3, -2, -1, 0, 1, 2, 3]) {
        const lamTo = PHI ** m;
        const got = convertView(v, 1, lamTo);
        const a = world(v, 1), b = world(got, lamTo);
        for (const k of ["xMin", "xMax", "yMin", "yMax"]) {
            assert.ok(Math.abs(a[k] - b[k]) < 1e-9,
                      `λ = φ^${m}: ${k} is ${b[k]}, not ${a[k]}`);
        }
    }
    // Same λ is the identity, which is what pair.ts relies on.
    assert.deepEqual(convertView(v, 2, 2), v);
    // And it round-trips.
    const there = convertView(v, 1, 1 / PHI);
    const back = convertView(there, 1 / PHI, 1);
    for (const k of ["scale", "x", "y"]) assert.ok(Math.abs(back[k] - v[k]) < 1e-12);
});

// The module builds the page on import, against the stub, and ESM caches it --
// so it is imported once here and the tests below drive what it built.
const page = await import("../dist/app/moire.js");
const doc = globalThis.document;
const cap = (id) => doc.getElementById(id).textContent ?? "";
const control = (cls) => inputs.find((i) => i.className === cls);
const fire = (el) => (el.on?.change ?? []).forEach((fn) => fn());
const click = (el) => (el.on?.click ?? []).forEach((fn) => fn());
/** A button in the bar, by class — buttons are not `inputs`. */
const button = (cls) => (doc.getElementById("moire-bar").children ?? [])
    .find((c) => c.className === cls);
/** Set A's offsets and let the page hear about it. */
const setA = (values) => {
    page.sideA.gamma.setLocked(-1);
    page.sideA.gamma.setValues(values);
};

test("the page builds two sides and names both classes", () => {
    assert.ok(page.sideA && page.sideB, "the page built no sides");
    // Both start Penrose: A is, and deflation fixes the class at 0.
    assert.match(cap("moire-a-caption"), /^A — class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /^B — class 0 · Penrose/);
    // B is one deflation down, and says so; A is at generation 0 and says nothing.
    assert.match(cap("moire-b-caption"), /λ = φ⁻¹/);
    assert.doesNotMatch(cap("moire-a-caption"), /λ/);
});

test("B is A deflated: the class follows s to -2s mod 1", () => {
    // 1/2 deflates INTO Penrose in one step -- the fact the page exists for.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.5]);
    assert.match(cap("moire-a-caption"), /class 1\/2/);
    assert.match(cap("moire-b-caption"), /class 0 · Penrose/);

    // 1/4 goes to 1/2, not to 0: one deflation is not enough.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.match(cap("moire-b-caption"), /class 1\/2/);

    // 1/5 runs a four-cycle and never reaches Penrose: 1/5 -> 3/5.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.2]);
    assert.match(cap("moire-b-caption"), /class 3\/5/);
});

test("the step count is how many deflations B is", () => {
    const steps = control("moire-steps");
    assert.ok(steps, "no step control");
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.125]);   // 1/8
    steps.value = "3";
    fire(steps);
    // 1/8 -> 3/4 -> 1/2 -> 0, and three deflations is λ = φ⁻³.
    assert.match(cap("moire-b-caption"), /class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /λ = φ⁻³/);
    // Negative inflates instead, and inflation is a right inverse: three back
    // up from 1/8 and three down again is 1/8.
    steps.value = "0";
    fire(steps);
    assert.match(cap("moire-b-caption"), /class 1\/8/);
    steps.value = "1";
    fire(steps);
});

test("unlinking leaves B where it was", () => {
    const link = control("moire-link");
    assert.ok(link, "no link control");
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083]);           // A back to Penrose
    const before = cap("moire-b-caption");
    assert.match(before, /class 0 · Penrose/);
    link.checked = false;
    fire(link);
    // A to 1/4, whose deflation is 1/2 -- so a B that followed would read
    // DIFFERENTLY from a B that did not. Moving A to 1/2 would not have tested
    // anything: 1/2 deflates to Penrose, which is where B already was.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.equal(cap("moire-b-caption"), before, "B followed A with the link off");
    link.checked = true;
    fire(link);
    assert.match(cap("moire-b-caption"), /class 1\/2/, "relinking did not catch B up");
});

test("the merge switch stacks the canvases, and only while it is on", () => {
    const grid = doc.getElementById("moire-grid");
    const merge = control("moire-merge");
    assert.ok(merge, "no merge control");
    assert.equal(grid.classList.contains("merged"), false, "merged before anything was clicked");
    merge.checked = true;
    fire(merge);
    assert.equal(grid.classList.contains("merged"), true, "the merge switch did not stack them");
    merge.checked = false;
    fire(merge);
    assert.equal(grid.classList.contains("merged"), false, "the canvases stayed stacked");
});

test("reset page puts the whole page back, switches included", () => {
    // The per-side `reset page` is in the settings row, which exposeRows trims
    // away here, so this button is the only way back. Jake: "Is there a clear
    // all button to go back to page defaults."
    const reset = button("moire-reset");
    assert.ok(reset, "no reset-page button in the bar");

    // Put everything out of its default state.
    const link = control("moire-link"), steps = control("moire-steps");
    const merge = control("moire-merge"), grid = doc.getElementById("moire-grid");
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);      // A off Penrose
    steps.value = "3"; fire(steps);
    link.checked = false; fire(link);
    merge.checked = true; fire(merge);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.equal(grid.classList.contains("merged"), true);

    click(reset);

    assert.equal(link.checked, true, "link did not come back on");
    assert.equal(steps.value, "1", "the step count did not come back to 1");
    assert.equal(merge.checked, false, "merge did not come back off");
    assert.equal(grid.classList.contains("merged"), false, "the canvases stayed stacked");
    // Both tilings back to the page's own γ, which is Penrose, and B one
    // deflation below it.
    assert.match(cap("moire-a-caption"), /^A — class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /^B — class 0 · Penrose, λ = φ⁻¹/);
});

// ── The two canvases stay on the same rectangle of the plane ──────────

const PHI_ = (1 + Math.sqrt(5)) / 2;
/** The first descendant of a host that listens for `type`. */
const listener = (hostId, type) => {
    let hit = null;
    const walk = (el) => {
        for (const c of el.children ?? []) {
            if (!hit && c.on?.[type]?.length) hit = c;
            walk(c);
        }
    };
    walk(doc.getElementById(hostId));
    return hit;
};
const fireOn = (hostId, type, ev) =>
    (listener(hostId, type).on[type] ?? []).forEach((fn) => fn(ev));
const lamOf = (h) => h.gamma.model.lambda ?? 1;
/** Center and span in WORLD units -- what the two must agree on, whatever
 *  their generations and so whatever their view numbers. */
const onScreen = (h) => {
    const v = h.getView(), L = lamOf(h);
    return [v.x * L, v.y * L, (800 / v.scale) * L];
};
const apart = () => {
    const a = onScreen(page.sideA), b = onScreen(page.sideB);
    return Math.max(...a.map((x, i) => Math.abs(x - b[i])));
};
const wheel = (hostId, dir, x = 400, y = 400) =>
    fireOn(hostId, "wheel", { preventDefault() {}, deltaY: dir * 120, offsetX: x, offsetY: y });

test("zooming OFF CENTER keeps the two on the same rectangle", () => {
    // The bug Jake hit: the view was relayed between writing x and writing y,
    // so every zoom handed the other canvas the new x and the PREVIOUS y.
    // Zooming at dead center hides it -- there the two y are equal -- which is
    // why it has to be tested off center.
    const reset = button("moire-reset");
    click(reset);
    assert.ok(apart() < 1e-9, "not in register to begin with");
    for (const [x, y] of [[300, 250], [520, 610], [120, 700]]) {
        wheel("moire-a", -1, x, y);
        assert.ok(apart() < 1e-9, `zoom at (${x}, ${y}) on A left them ${apart().toFixed(4)} apart`);
        wheel("moire-b", 1, x, y);
        assert.ok(apart() < 1e-9, `zoom at (${x}, ${y}) on B left them ${apart().toFixed(4)} apart`);
    }
    click(reset);
});

test("the double-click reset moves both, not one", () => {
    // Same shape: the scale was relayed before the center was written, and the
    // center was never relayed at all.
    const reset = button("moire-reset");
    click(reset);
    wheel("moire-a", -1, 300, 250);
    wheel("moire-a", -1, 300, 250);
    assert.ok(apart() < 1e-9);
    fireOn("moire-a", "dblclick", {});
    assert.ok(apart() < 1e-9, `after a double-click they are ${apart().toFixed(4)} apart`);
    const [x, y, span] = onScreen(page.sideA);
    assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9, "the reset did not center A");
    click(reset);
});

test("the two share one zoom limit, so crossing between them does not jump", () => {
    // The wheel's bounds are in pixels per TILING unit, and B's tiling unit is
    // smaller, so the same numbers stop the two at different world scales.
    // Whichever canvas the pointer was over then decided where zooming ended,
    // and moving to the other jumped by phi.
    const reset = button("moire-reset");
    click(reset);
    for (let i = 0; i < 14; i++) wheel("moire-a", -1);       // A to its limit
    const atLimit = onScreen(page.sideA)[2];
    for (let i = 0; i < 3; i++) wheel("moire-b", -1);        // keep going on B
    const past = onScreen(page.sideA)[2];
    assert.ok(Math.abs(past - atLimit) < 1e-9,
              `B zoomed ${(atLimit / past).toFixed(2)}x past A's limit`);
    wheel("moire-a", -1);                                     // and back to A
    assert.ok(Math.abs(onScreen(page.sideA)[2] - past) < 1e-9,
              "the zoom jumped when the pointer crossed over");
    assert.ok(apart() < 1e-9, "and they are out of register");
    click(reset);
});
