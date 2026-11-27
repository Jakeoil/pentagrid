// A two-sided link, arriving — PLAN §12.11.
//
// Its own file for the same reason tools/moire-session.test.mjs is: ESM caches
// a module, and `location.search` has to be in place BEFORE moire.js is
// imported. tools/moire.test.mjs imports it with no query at all, which is the
// plain visit; this is the shared link.
//
// What it proves is the thing Jake reported: "There's ambiguity in some of the
// moire saves." One URL has to dress two canvases differently, outrank what
// this browser remembers on BOTH of them, and bring back the layout.

import test from "node:test";
import assert from "node:assert/strict";

// A session for each side, at a class neither half of the link asks for, so
// anything of it that leaks through is visible as a wrong class.
const cells = new Map();
globalThis.localStorage = {
    getItem: (k) => (cells.has(k) ? cells.get(k) : null),
    setItem: (k, v) => { cells.set(k, String(v)); },
    removeItem: (k) => { cells.delete(k); },
};
const session = JSON.stringify({
    v: 1,
    gamma: {
        exact: [817, 3391, -2234, 1109, -583],      // Σγ = 0.25
        den: 10000, locked: -1, symmetry: false, guard: true, generation: -1,
        enabled: [true, true, true, true, true],
        lines: [null, null, null, null, null], isolated: null,
    },
    view: { scale: 44, x: 0.5, y: -0.25 },
});
cells.set("pentagrid.session.moire-a", session);
cells.set("pentagrid.session.moire-b", session);

// A at class 0, B at class 1/2 one generation down, merged, and a view of A's
// that is nobody's default. The numerators are over 10000 and the set runs on
// 30000, which `restoreGamma` converts exactly -- that is why the denominator
// travels in the link instead of being assumed.
const SEARCH = "?merge"
    + "&a-gamma=817,3391,-2234,1109,-3083&a-gamma-den=10000&a-gamma-locked=-1"
    + "&a-scale=55&a-view-x=0.25&a-view-y=-0.5"
    + "&b-gamma=817,3391,-2234,1109,1917&b-gamma-den=10000&b-gamma-locked=-1"
    + "&b-gamma-gen=-1&b-scale=34&b-view-x=0.25&b-view-y=-0.5";
globalThis.location = {
    search: SEARCH, origin: "https://jakeoil.github.io", pathname: "/pentagrid/moire.html",
    href: `https://jakeoil.github.io/pentagrid/moire.html${SEARCH}`,
};

await import("./domstub.mjs");
const page = await import("../dist/app/moire.js");
const doc = globalThis.document;
const cap = (id) => {
    const el = doc.getElementById(id);
    const text = (el.children ?? []).find((c) => String(c.className) === "cap-text");
    return (text ?? el).textContent ?? "";
};

test("one link, two different sides", () => {
    // The whole point. Before the prefixes, a flat `?gamma=…` reached both and
    // the two canvases came up identical however the link was written -- which
    // on a page about comparing two tilings is the one thing it must not do.
    assert.match(cap("moire-a-caption"), /^A × B/,
                 "merged, A's header is the composite's");
    assert.equal(page.sideA.gamma.getGeneration(), 0, "A took a generation");
    assert.equal(page.sideB.gamma.getGeneration(), -1,
                 "B did not take its own generation from the link");
    const cls = (h) => {
        const s = h.gamma.values().reduce((x, y) => x + y, 0);
        return s - Math.floor(s);
    };
    assert.ok(Math.abs(cls(page.sideA)) < 1e-9, `A is at class ${cls(page.sideA)}`);
    assert.ok(Math.abs(cls(page.sideB) - 0.5) < 1e-9, `B is at class ${cls(page.sideB)}`);
});

test("the link outranks the session on both sides, not one", () => {
    // A side whose query says nothing of ours falls back to what this browser
    // remembers -- so the link writes each side's view unconditionally, which
    // is what guarantees both sides see a query. Were either side to miss out,
    // its class would read 1/4 and its view would be the stored one.
    const cls = (h) => {
        const s = h.gamma.values().reduce((x, y) => x + y, 0);
        return s - Math.floor(s);
    };
    for (const [name, h] of [["A", page.sideA], ["B", page.sideB]]) {
        assert.ok(Math.abs(cls(h) - 0.25) > 1e-6,
                  `${name} came up at the session's class, so the link lost`);
        assert.notEqual(h.getView().scale, 44, `${name} took the session's zoom`);
    }
});

test("the layout and the view come back", () => {
    // Jake: "copy-link contents should restore the status: merge or split and
    // also restore the position and zoom of the viewports that were currently
    // displayed."
    assert.match(String(doc.getElementById("moire-grid").className), /\bmerged\b/,
                 "the link said merge and the page came up split");
    const v = page.sideA.getView();
    assert.equal(v.scale, 55, "A's zoom is not the link's");
    assert.equal(v.x, 0.25);
    assert.equal(v.y, -0.5);

    // B's view is NOT read back from the link, and is not meant to be: it is a
    // function of A's and the two λ, and the page puts the pair in register on
    // the way in. So the link carries it for the suppression above and for a
    // reader's eye, and the register is what decides it. One generation down,
    // λB = φ⁻¹, so B's scale is A's over φ.
    const PHI = (1 + Math.sqrt(5)) / 2;
    assert.ok(Math.abs(page.sideB.getView().scale - 55 / PHI) < 1e-9,
              `B came up at ${page.sideB.getView().scale}, not 55/φ`);
    const world = (h) => {
        const w = h.getView(), L = h.gamma.model.lambda ?? 1;
        return [w.x * L, w.y * L, w.scale / L];
    };
    const a = world(page.sideA), b = world(page.sideB);
    for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(a[i] - b[i]) < 1e-9,
                  "the pair did not arrive in register");
    }
});

test("the header's readout is the view the link asked for", () => {
    const readout = (id) => (doc.getElementById(id).children ?? [])
        .find((c) => String(c.className) === "cap-view")?.textContent ?? "";
    assert.equal(readout("moire-a-caption"), "55 px/u · (0.25, -0.50)");
});
