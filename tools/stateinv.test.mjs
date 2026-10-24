// The state inventory of PLAN section 9.2, kept honest.
//
// Jake, 2026-10-24: "I also want a plan to parameterize these canvases...
// save setups for embedding... remember the reticulum so it can carry over to
// other pages... remember the current state of the page. And as always, a
// reset to defaults for a page."
//
// Section 9.2 counts the state field by field, and every number in section 9
// rests on that count: the scopes, the URL length, the omission rule. A field
// added to TileStyle and forgotten in the serializer is exactly the failure
// section 9.7 exists to prevent -- so the count is pinned here, and this test
// fails when the state grows. That is the reminder to extend the serializer
// and section 9.2 together.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** The fields of a defaults literal, by what a serializer has to do with them. */
function classify(src, start) {
    const i = src.indexOf(start);
    assert.ok(i >= 0, `${start} is gone from the source`);
    const j = src.indexOf("\n    };", i) >= 0
        ? src.indexOf("\n    };", i) : src.indexOf("\n};", i);
    const text = src.slice(i, j);
    const pick = (re) => [...text.matchAll(re)].map((m) => m[1]);
    return {
        bool: pick(/([a-zA-Z0-9]+):\s*(?:true|false)\b/g),
        enum: pick(/([a-zA-Z0-9]+):\s*"/g),
        num: pick(/([a-zA-Z0-9]+):\s*-?[0-9.]+/g),
    };
}

const view = readFileSync("src/view/pentagrid.ts", "utf8");
const growth = readFileSync("src/view/growth.ts", "utf8");

test("the state is the size PLAN 9.2 says it is", () => {
    const f = classify(view, "const NO_FEATURES: Features = {");
    const t = classify(view, "const tileStyle: TileStyle = {");
    const g = classify(growth, "const DEFAULTS: GrowthState = {");
    const say = (c) => `${c.bool.length} bool, ${c.enum.length} enum, ${c.num.length} number`;

    assert.equal(say(f), "19 bool, 0 enum, 0 number", `Features is now ${say(f)}`);
    assert.equal(say(t), "21 bool, 5 enum, 3 number", `TileStyle is now ${say(t)}`);
    assert.equal(say(g), "13 bool, 3 enum, 7 number", `GrowthState is now ${say(g)}`);

    // 53 booleans, nine base64url characters -- the figure 9.2 quotes.
    const bits = f.bool.length + t.bool.length + g.bool.length;
    assert.equal(bits, 53, `${bits} booleans, not 53`);
    assert.equal(Math.ceil(bits / 6), 9);
    assert.equal(f.enum.length + t.enum.length + g.enum.length, 8, "eight enums");
});

test("the read side PLAN 9.1 asks for is still missing, or has arrived whole", () => {
    // Section 9.1's first commit. While it is absent this test records WHY
    // nothing else in section 9 can be built; when it lands, it has to land
    // for both objects at once, since a serializer needs the pair.
    const at = view.indexOf("export interface PentagridHandle");
    assert.ok(at >= 0, "PentagridHandle is gone");
    const handle = view.slice(at, view.indexOf("\n}", at));
    const hasStyle = handle.includes("getTileStyle");
    const hasFeat = handle.includes("getFeatures");
    assert.equal(hasStyle, hasFeat,
                 "getTileStyle and getFeatures have to arrive together: a "
                 + "serializer needs both, and PLAN 9.1 asks for both");
    // The setters, which have always been there -- the asymmetry is the point.
    assert.ok(handle.includes("setTileStyle"), "setTileStyle is gone");
    assert.ok(handle.includes("setFeatures"), "setFeatures is gone");
    assert.ok(handle.includes("getView"), "getView is gone");
});

test("gamma is exactly serializable, which is what lets the reticulum travel", () => {
    // PLAN 9.2 and 9.3: the shared slice is byte-exact because gamma is held as
    // integer numerators over den, not as doubles. provenRegular and the whole
    // singularity catalog are decided on those rationals.
    const gamma = readFileSync("src/geometry/gamma.ts", "utf8");
    assert.ok(/exact:\s*\(\)\s*=>/.test(gamma) || gamma.includes("exact: ()"),
              "GammaSet.exact is gone, and the shared slice would have to "
              + "round-trip doubles");
    assert.ok(gamma.includes("options.denominator ?? 2000 * n"),
              "the denominator rule moved; PLAN 9.2 quotes den = 2000n");
});

test("the widget's first three attributes are shipped, and the raster is one layer", () => {
    // PLAN 9.8, decided 2026-10-24: a setup serializes as HTML ATTRIBUTES on
    // the container, and the pattern already exists -- readCanvasSpec reads
    // three of them today, so the widget's first three attributes are done and
    // the rest of 9.2's inventory joins them.
    assert.ok(view.includes('intAttr(el, "data-width")'), "data-width is gone");
    assert.ok(view.includes('intAttr(el, "data-height")'), "data-height is gone");
    assert.ok(view.includes('intAttr(el, "data-margin")'), "data-margin is gone");

    // PLAN 5.99: the export composites every layer into one file per
    // container, so the one thing which cannot be vector is not a file to skip
    // but a <g> inside the picture -- an embedded PNG when kRegions is on.
    // drawKRegions is the ENTIRE draw of the `background` layer, which keeps it
    // to one layer and one <g>. If anything else moves in there, the raster
    // stops being contained and 5.99 needs revisiting.
    const at = view.indexOf('id: "background"');
    assert.ok(at >= 0, "the background layer is gone");
    // Its draw, which is one line and has to stay one thing.
    const line = view.slice(view.indexOf("draw:", at),
                            view.indexOf("\n", view.indexOf("draw:", at)));
    assert.ok(line.includes("drawKRegions"), `the background layer draws ${line}`);
    assert.equal((line.match(/draw[A-Z][a-zA-Z]*\(/g) ?? []).length, 1,
                 `the background layer draws more than the raster: ${line}`);
});

test("the composite SVG export's four gotchas are still true of the stack", () => {
    // PLAN 5.99, decided 2026-10-24: "It's a record of a canvas with all its
    // layers... in split, one for G and one for P." One file per CONTAINER,
    // every layer composited. Four things a composite needs that a per-layer
    // export would not, each a property of LayerStack rather than of the
    // exporter -- so they are pinned here, where they can go stale.
    const layers = readFileSync("src/view/layers.ts", "utf8");

    // 1. Draw order is insertion order; the picture is stacked by z-index.
    //    SVG has no z-index, so the exporter must sort by z.
    assert.ok(/drawAll\(\)\s*\{[\s\S]*for \(const l of this\.order\)/.test(layers),
              "drawAll no longer iterates insertion order");
    assert.ok(layers.includes('c.style.zIndex = String(z)'),
              "the canvases no longer stack by z-index");

    // 2. A layer's opacity is on the element, not in the drawing.
    assert.ok(layers.includes("t.canvas.style.opacity = opacity"),
              "layer opacity is no longer a CSS opacity on the canvas");
    assert.ok(view.includes("opacity: () => gridAlpha"),
              "the grid layer no longer carries an element opacity");

    // 3. Hidden layers are display:none, not cleared -- so an empty recording
    //    cannot be trusted and the exporter must read visibility.
    assert.ok(layers.includes('t.canvas.style.display = "none"'),
              "hidden layers are no longer display:none");
    assert.ok(/l\.visible \? l\.visible\(\) : true\) && l\.userVisible/.test(layers),
              "the visibility predicate moved");

    // 4. The raw overlays are not drawn layers and must not be exported.
    assert.ok(/addRaw\(/.test(layers), "addRaw is gone");
    assert.ok(layers.includes("this.raw.push(canvas)"),
              "raw canvases are no longer kept apart from the drawn layers");

    // And the geometry that makes one viewBox per file possible: every canvas
    // in a stack is the same size.
    assert.ok(/l\.canvas\.width = w; l\.canvas\.height = h;/.test(layers),
              "resize no longer sizes every layer alike");
});
