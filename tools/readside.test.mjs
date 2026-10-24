// The read side — PLAN section 9.1, step 1 of 9.10.
//
// Every setter on PentagridHandle had no getter, so the panel's own state was
// unreadable from outside. Nothing in section 9 can be built without this: a
// saved setup, an attribute writer, a reset to the page's baseline, or an SVG
// exporter deciding which layers are on all have to ask the view what it is.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { LayerStack } from "../dist/view/layers.js";

function host(w = 800, h = 800, attrs = null) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: (n) => (attrs ? (attrs[n] ?? null) : null),
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
const make = (cfg = {}) => createPentagrid({
    container: host(), panel: host(800, 300), ...cfg,
});

test("set then get returns what was set, for the tile style", () => {
    const h = make();
    // One of each kind in the inventory: boolean, enum, number.
    h.setTileStyle({ pentaFace: true, pentaShape: "innie", opacity: 0.4 });
    const got = h.getTileStyle();
    assert.equal(got.pentaFace, true);
    assert.equal(got.pentaShape, "innie");
    assert.equal(got.opacity, 0.4);
    // And it MERGES, as its doc says: the fields not named are untouched.
    assert.equal(got.color, "type", "setTileStyle replaced instead of merging");
    assert.equal(got.pentaOverlay, true, "the overlay default was lost");
});

test("set then get returns what was set, for the features", () => {
    const h = make();
    h.setFeatures({ penroseTiles: true, penroseEdges: true });
    const got = h.getFeatures();
    assert.equal(got.penroseTiles, true);
    assert.equal(got.penroseEdges, true);
    // setFeatures REPLACES by default, and "replaces" means back to
    // NO_FEATURES and then apply -- not all-off. So kRegions, false there, is
    // false; gridLines, TRUE there, comes back on. Worth pinning, because it is
    // why section 9.6 says a reset must go to the PAGE's baseline and not to
    // the view's: setFeatures({}) already resets to the view's.
    assert.equal(got.kRegions, false);
    assert.equal(got.gridLines, true,
                 "setFeatures no longer resets to NO_FEATURES");

    // And merge leaves the rest alone.
    h.setFeatures({ kRegions: true }, { merge: true });
    const merged = h.getFeatures();
    assert.equal(merged.kRegions, true);
    assert.equal(merged.penroseTiles, true, "merge dropped an earlier feature");
});

test("the getters hand back a copy, not the live object", () => {
    // The whole point: the panel mutates these in place, so a live reference
    // would change under a caller and would let one change the view without a
    // redraw -- the class of bug section 9 exists to remove.
    const h = make();
    h.setTileStyle({ pentaFace: false, opacity: 1 });
    const a = h.getTileStyle();
    a.pentaFace = true;
    a.opacity = 0.1;
    assert.equal(h.getTileStyle().pentaFace, false,
                 "mutating the result changed the view's own style");
    assert.equal(h.getTileStyle().opacity, 1);

    const f = h.getFeatures();
    f.penroseTiles = !f.penroseTiles;
    assert.notEqual(h.getFeatures().penroseTiles, f.penroseTiles,
                    "mutating the result changed the view's own features");

    // Two calls are two objects.
    assert.notEqual(h.getTileStyle(), h.getTileStyle());
    assert.notEqual(h.getFeatures(), h.getFeatures());
});

test("round tripping through the getters changes nothing", () => {
    // The identity that a reset and a saved setup both rest on: reading the
    // state and writing it straight back must be a no-op, including through
    // setFeatures' REPLACING behavior.
    const h = make({ features: { penroseTiles: true, penroseEdges: true } });
    h.setTileStyle({ pentaFace: true, pentaShape: "outie", band: 0.25 });
    h.gamma.setGuard(true);

    const layer = h.stack.get("penrose-tiles");
    const record = () => {
        const path = [];
        layer.ctx.moveTo = (x, y) => path.push(`M${x.toFixed(3)},${y.toFixed(3)}`);
        layer.ctx.lineTo = (x, y) => path.push(`L${x.toFixed(3)},${y.toFixed(3)}`);
        layer.ctx.fill = () => path.push("F");
        layer.ctx.stroke = () => path.push("S");
        path.length = 0;
        h.redraw();
        return path.join("|");
    };
    const before = record();
    assert.ok(before.length > 1000, "nothing was drawn, so the test proves nothing");

    h.setTileStyle(h.getTileStyle());
    h.setFeatures(h.getFeatures());
    h.setGridAlpha(h.getGridAlpha());
    h.stack.setVisibility(h.stack.visibility());
    assert.equal(record(), before, "a round trip through the getters moved the drawing");
});

test("the grid alpha reads back", () => {
    const h = make();
    const was = h.getGridAlpha();
    assert.equal(typeof was, "number");
    h.setGridAlpha(0.25);
    assert.equal(h.getGridAlpha(), 0.25);
    h.setGridAlpha(was);
    assert.equal(h.getGridAlpha(), was);
});

test("layer visibility reads and restores, and ignores what it does not know", () => {
    const h = make({ features: { penroseTiles: true } });
    const v = h.stack.visibility();
    const ids = Object.keys(v);
    assert.ok(ids.length > 5, `only ${ids.length} layers`);
    assert.ok(ids.includes("penrose-tiles"), "the tiles layer is not in the map");
    assert.ok(Object.values(v).every((x) => typeof x === "boolean"));

    // It is userVisible, the independent half -- not the computed visibility,
    // which is a function of the features and so already carried by them.
    assert.equal(v["penrose-tiles"], true);
    h.stack.setVisibility({ "penrose-tiles": false });
    assert.equal(h.stack.visibility()["penrose-tiles"], false);
    assert.equal(h.stack.get("penrose-tiles").userVisible, false);

    // Absent ids are left alone and unknown ids are ignored, which is section
    // 9.5's omission rule: an older setup applies to a stack that has since
    // gained a layer.
    h.stack.setVisibility({ "a-layer-that-never-existed": false });
    assert.equal(h.stack.visibility()["penrose-tiles"], false, "an absent id was reset");
    assert.equal(h.stack.visibility()["a-layer-that-never-existed"], undefined);
});

test("visibility is a copy too", () => {
    const stack = new LayerStack(host(), 100, 100);
    stack.add({ id: "one", label: "One", z: 1, draw: () => {} });
    const v = stack.visibility();
    v.one = false;
    assert.equal(stack.visibility().one, true, "the map is live");
});
