// The page coming back to someone who has been here before.
//
// Its own file because ESM caches a module: the session has to be in storage
// BEFORE moire.js is imported, and tools/moire.test.mjs imports it already.
//
// This is the case every other check missed. pagecheck and the tests run with
// nothing stored, so `restoreGamma` never reached `setGeneration`, which is
// what notifies the view from inside `createPentagrid` — and that is where A's
// relay fired while B was still undefined. Jake, from the console:
// "Uncaught TypeError: Cannot read properties of undefined (reading 'setView')
//  ... No reticulums. no control buttons."

import test from "node:test";
import assert from "node:assert/strict";

// A real enough localStorage, installed before the stub and the page.
const cells = new Map();
globalThis.localStorage = {
    getItem: (k) => (cells.has(k) ? cells.get(k) : null),
    setItem: (k, v) => { cells.set(k, String(v)); },
    removeItem: (k) => { cells.delete(k); },
};

// A side that was left at a generation other than 0, which is what makes
// restoreGamma call setGeneration -- and setGeneration is what notifies the
// view from inside createPentagrid, before the other side exists.
//
// The shape is captureGamma's, exactly: a guess at it is quietly ignored, and
// then the page comes up clean and the test proves nothing. The first draft of
// this file did exactly that.
const session = (gen) => JSON.stringify({
    v: 1,
    gamma: {
        exact: [817, 3391, -2234, 1109, -3083],
        den: 10000,
        locked: -1,
        symmetry: false,
        guard: true,
        generation: gen,
        enabled: [true, true, true, true, true],
        lines: [null, null, null, null, null],
        isolated: null,
    },
    view: { scale: 44, x: 0.5, y: -0.25 },
});
cells.set("pentagrid.session.moire-a", session(-1));
cells.set("pentagrid.session.moire-b", session(-2));

await import("./domstub.mjs");
const page = await import("../dist/app/moire.js");

test("a stored session does not kill the page on the way in", () => {
    // The throw happened during construction, so there was nothing afterwards:
    // no bar, no reticula, no sides. Their existence IS the assertion.
    assert.ok(page.sideA, "A was never built");
    assert.ok(page.sideB, "B was never built");
    const doc = globalThis.document;
    // The caption is a header now -- text plus the buttons that act on that
    // canvas -- so the words are in a span rather than on the element.
    const cap = (id) => {
        const el = doc.getElementById(id);
        const text = (el.children ?? []).find((c) => String(c.className) === "cap-text");
        return (text ?? el).textContent ?? "";
    };
    assert.match(cap("moire-a-caption"), /^A — class/);
    assert.match(cap("moire-b-caption"), /^B — class/);
    // and the controls got built, which is what "no control buttons" meant.
    // The link, the step count and the n box were retired 2026-11-15, the
    // reticula having carried that state all along; and `merge` moved out of
    // the bar on 2026-11-26, onto its own line above the canvases, since it is
    // the one control that acts on BOTH sides.
    const bar = doc.getElementById("moire-bar");
    const classesOf = (el) => (el?.children ?? []).flatMap(
        (c) => [c.className, ...(c.children ?? []).map((k) => k.className)]);
    const classes = classesOf(bar);
    assert.ok((bar.children ?? []).length >= 3, "the bar is missing its controls");
    for (const want of ["moire-find", "moire-reset"]) {
        assert.ok(classes.includes(want), `no ${want} in the bar`);
    }
    // And merge is on the canvases' own headers, not in the bar.
    const onHead = (id) => (doc.getElementById(id).children ?? [])
        .some((c) => String(c.className).includes("head-merge"));
    assert.ok(onHead("moire-a-caption") && onHead("moire-b-caption"),
              "the merge buttons are not on the headers");
    for (const gone of ["moire-link", "moire-steps", "moire-norm"]) {
        assert.ok(!classes.includes(gone), `${gone} is back in the bar`);
    }
});

test("and the two still come up in register", () => {
    // Each side restored its own view independently; the page puts them back
    // on the same rectangle of the plane once both exist.
    const lam = (h) => h.gamma.model.lambda ?? 1;
    const va = page.sideA.getView(), vb = page.sideB.getView();
    assert.ok(Math.abs(va.scale / lam(page.sideA) - vb.scale / lam(page.sideB)) < 1e-9,
              "scale/λ differs between the sides");
    assert.ok(Math.abs(va.x * lam(page.sideA) - vb.x * lam(page.sideB)) < 1e-9,
              "λ·view differs between the sides");
});
