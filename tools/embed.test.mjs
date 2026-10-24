// A setup written out as markup — PLAN section 9.8, step 6 of 9.10.
//
// Jake: "The output would be a string that could be embedded in the apps page
// to build it." And: "Don't update the URL. Just a copy-to-clipboard button
// would be fine."
//
// The test that matters is the round trip: embed what is on screen, build a
// fresh instance from that string, and the drawing must be identical. That is
// section 9.8a's acceptance test -- the drawing is a function of the attributes
// -- and it needs no capture step to be complete.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { createGrowthView } from "../dist/view/growth.js";
import { embedString, writeSlices, readSlices, SLICE_ATTRS } from "../dist/state/embed.js";

function host(attrs = {}, w = 800, h = 800) {
    const el = makeStub({
        children: [], id: "stage",
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: (n) => (n in attrs ? attrs[n] : null),
        getAttributeNames: () => Object.keys(attrs),
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
/** The attributes of an embed string, back into a map — what a browser does. */
function parseEmbed(markup) {
    const open = markup.slice(0, markup.indexOf(">"));
    const attrs = {};
    for (const m of open.matchAll(/([a-zA-Z0-9-]+)(?:="([^"]*)")?/g)) {
        if (!m[1] || m[1] === "div" || m[1] === "id") continue;
        attrs[m[1]] = m[2] ?? "";
    }
    return attrs;
}
function recorder(layer) {
    const path = [];
    layer.ctx.moveTo = (x, y) => path.push(`M${x.toFixed(3)},${y.toFixed(3)}`);
    layer.ctx.lineTo = (x, y) => path.push(`L${x.toFixed(3)},${y.toFixed(3)}`);
    layer.ctx.arc = (x, y, r) => path.push(`A${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}`);
    layer.ctx.fill = function () { path.push(`F${this.fillStyle}`); };
    layer.ctx.stroke = function () { path.push(`S${this.strokeStyle}`); };
    return () => { path.length = 0; return path; };
}

test("an untouched page embeds as nothing at all", () => {
    // Section 9.5's omission rule: only what differs from home. A page at home
    // differs in nothing, so the embed is the bare element.
    const h = createPentagrid({ container: host(), panel: host(),
                                features: { penroseTiles: true } });
    assert.equal(h.embed(), '<div id="stage"></div>');
});

test("the embed carries what changed, and names it readably", () => {
    const h = createPentagrid({ container: host(), panel: host(),
                                features: { penroseTiles: true } });
    h.setTileStyle({ color: "bands", band: 0.25, pentaFace: true });
    h.setFeatures({ penroseTiles: true, penroseEdges: true }, { merge: true });
    const out = h.embed();
    for (const want of ['data-color="bands"', 'data-band="0.25"',
                         "data-penta-face", "data-penrose-edges"]) {
        assert.ok(out.includes(want), `the embed does not carry ${want}:\n${out}`);
    }
    // A boolean is bare, the way HTML means it.
    assert.ok(!out.includes('data-penta-face="'), "a boolean was written with a value");
    // And nothing that did not change.
    assert.ok(!out.includes("data-opacity"), `an unchanged field was written:\n${out}`);
});

test("the round trip: a fresh instance from the embed draws the same picture", () => {
    const h = createPentagrid({
        container: host(), panel: host(),
        features: { penroseTiles: true, penroseEdges: true },
    });
    h.gamma.setGuard(true);
    h.markBaseline();

    // Move a great deal: both objects, gamma, the view, a hidden layer.
    h.setTileStyle({ color: "groups", pentaFace: true, pentaShape: "outie",
                     pentaBoundary: "bend36", shading: true, ramp: 0.6,
                     band: 0.3, boldEdges: true });
    h.setFeatures({ penroseTiles: true, penroseEdges: true,
                    penroseVertices: true, intersectionDots: true }, { merge: true });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.11, 0.23, 0.31, 0.17, 0.18]);
    h.gamma.setLocked(0);
    h.setView({ scale: 71.5, x: 1.25, y: -0.5 });
    h.stack.setVisibility({ klabels: false });

    const markup = h.embed();
    const mine = recorder(h.stack.get("penrose-tiles"));
    const draw = (v) => { const p = recorder(v.stack.get("penrose-tiles"))(); v.redraw(); return p.join("|"); };
    mine();
    h.redraw();
    const before = draw(h);
    assert.ok(before.length > 2000, "nothing was drawn, so this proves nothing");

    // A fresh page, built from the string alone, with the same page config.
    const back = createPentagrid({
        container: host(parseEmbed(markup)), panel: host(),
        features: { penroseTiles: true, penroseEdges: true },
    });
    back.gamma.setGuard(true);
    assert.equal(draw(back), before,
                 `the embed did not reproduce the drawing:\n${markup}`);
});

test("gamma round-trips exactly, numerators and all", () => {
    const h = createPentagrid({ container: host(), panel: host() });
    h.gamma.setLocked(-1);
    h.gamma.setValues([0.11, 0.23, 0.31, 0.17, 0.18]);
    h.gamma.setLocked(2);
    h.gamma.setGeneration(-1);
    const exact = h.gamma.exact().join(",");

    const back = createPentagrid({
        container: host(parseEmbed(h.embed())), panel: host(),
    });
    assert.equal(back.gamma.exact().join(","), exact,
                 "gamma came back approximately, not exactly");
    assert.equal(back.gamma.getLocked(), 2, "the lock did not travel");
    assert.equal(back.gamma.getGeneration(), -1, "the generation did not travel");
});

test("the growth view adds its own slice to the same element", () => {
    const v = createGrowthView({ container: host(), lift: true });
    v.markBaseline();
    v.set({ paths: "high", axis: 2, penta: true, edgeStyle: "bold", grow: 0.6 });
    const out = v.embed();
    for (const want of ['data-paths="high"', 'data-axis="2"', "data-penta",
                         'data-edge-style="bold"', 'data-grow="0.6"']) {
        assert.ok(out.includes(want), `the growth embed lacks ${want}:\n${out}`);
    }
    // One element, not two.
    assert.equal((out.match(/<div/g) ?? []).length, 1);

    const back = createGrowthView({ container: host(parseEmbed(out)), lift: true });
    const s = back.get();
    assert.equal(s.paths, "high");
    assert.equal(s.axis, 2);
    assert.equal(s.penta, true);
    assert.equal(s.edgeStyle, "bold");
    assert.ok(Math.abs(s.grow - 0.6) < 1e-9);
});

test("a half-written gamma is refused, not guessed", () => {
    // Section 9.5: numerators with no denominator do not describe a grid, and
    // half a grid is worse than none.
    assert.equal(readSlices(host({ [SLICE_ATTRS.gamma]: "1,2,3,4,5" })).gamma,
                 undefined, "numerators with no denominator were accepted");
    assert.equal(readSlices(host({ [SLICE_ATTRS.gamma]: "1,x,3,4,5",
                                   [SLICE_ATTRS.den]: "100" })).gamma,
                 undefined, "a bad numerator was accepted");
    assert.ok(readSlices(host({ [SLICE_ATTRS.gamma]: "1,2,3,4,5",
                                [SLICE_ATTRS.den]: "100" })).gamma,
              "a complete gamma was refused");
});

test("the embed string wraps, and is stable", () => {
    // Sixty attributes on one line is not something anyone can read or paste
    // into a template with confidence.
    const many = {};
    for (let i = 0; i < 12; i++) many[`data-thing-${i}`] = `value${i}`;
    const out = embedString(many, { id: "stage" });
    assert.ok(out.split("\n").length > 1, "a long embed did not wrap");
    assert.ok(out.split("\n").every((l) => l.length < 90), "a line ran long");
    // Two copies of the same setup are the same string.
    assert.equal(embedString(many, { id: "stage" }), out);
});

test("writeSlices omits what matches home, and is all-or-nothing on gamma", () => {
    const g = { exact: [1, 2, 3, 4, 5], den: 100, locked: 0, symmetry: false,
                guard: false, generation: 0, enabled: [true, true, true, true, true],
                lines: [null, null, null, null, null], isolated: null };
    const home = { gamma: g, view: { scale: 60, x: 0, y: 0 }, visibility: { a: true } };
    assert.deepEqual(writeSlices(home, home), {}, "an unchanged setup wrote something");

    // One part of gamma differing writes the whole block, since half a grid is
    // not a grid.
    const moved = { ...home, gamma: { ...g, locked: 3 } };
    const out = writeSlices(moved, home);
    assert.equal(out[SLICE_ATTRS.gamma], "1,2,3,4,5");
    assert.equal(out[SLICE_ATTRS.den], "100");
    assert.equal(out[SLICE_ATTRS.locked], "3");

    // The view is independent, part by part.
    const panned = { ...home, view: { scale: 60, x: 2, y: 0 } };
    assert.deepEqual(writeSlices(panned, home), { [SLICE_ATTRS.viewX]: "2" });
});
