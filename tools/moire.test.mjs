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
