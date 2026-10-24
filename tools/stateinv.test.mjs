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

test("the widget's first three attributes are shipped, and the raster is its own layer", () => {
    // PLAN 9.8, decided 2026-10-24: a setup serializes as HTML ATTRIBUTES on
    // the container, and the pattern already exists -- readCanvasSpec reads
    // three of them today, so the widget's first three attributes are done and
    // the rest of 9.2's inventory joins them.
    assert.ok(view.includes('intAttr(el, "data-width")'), "data-width is gone");
    assert.ok(view.includes('intAttr(el, "data-height")'), "data-height is gone");
    assert.ok(view.includes('intAttr(el, "data-margin")'), "data-margin is gone");

    // PLAN 5.99, decided the same day: one SVG per CANVAS, and a canvas is a
    // layer here. That quarantines the one thing which cannot be vector --
    // drawKRegions is the ENTIRE draw of the `background` layer, so it becomes
    // one file that can be skipped. If anything else moves into that layer the
    // quarantine is gone and 5.99 needs revisiting.
    const at = view.indexOf('id: "background"');
    assert.ok(at >= 0, "the background layer is gone");
    // Its draw, which is one line and has to stay one thing.
    const line = view.slice(view.indexOf("draw:", at),
                            view.indexOf("\n", view.indexOf("draw:", at)));
    assert.ok(line.includes("drawKRegions"), `the background layer draws ${line}`);
    assert.equal((line.match(/draw[A-Z][a-zA-Z]*\(/g) ?? []).length, 1,
                 `the background layer draws more than the raster: ${line}`);
});
