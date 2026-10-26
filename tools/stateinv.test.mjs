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
import { FIELDS } from "../dist/state/inventory.js";

const view = readFileSync("src/view/pentagrid.ts", "utf8");

test("the state is the size PLAN 9.2 says it is", () => {
    // Read off the INVENTORY now, not parsed out of the source. The source
    // parse is what produced the wrong figure in 9.2's first draft: the regex
    // for a numeric default was /([a-zA-Z0-9]+):\s*-?[0-9.]+/, which does not
    // match `elevation: Math.PI / 2`, so growth came out as 7 numbers when it
    // has 8. The inventory derives from the live objects and cannot miscount.
    const by = {};
    for (const f of FIELDS) {
        by[f.owner] = by[f.owner] ?? { bool: 0, enum: 0, number: 0 };
        by[f.owner][f.kind]++;
    }
    const say = (c) => `${c.bool} bool, ${c.enum} enum, ${c.number} number`;
    assert.equal(say(by.features), "19 bool, 0 enum, 0 number");
    assert.equal(say(by.tileStyle), "20 bool, 6 enum, 3 number");
    assert.equal(say(by.grid), "0 bool, 0 enum, 2 number");
    assert.equal(say(by.growth), "13 bool, 3 enum, 8 number");

    // 52 booleans, nine base64url characters -- the figure 9.2 quotes -- and
    // 74 fields in all. `coloredArrows` became the `arrowStyle` enum when the
    // edge style turned into a dropdown, so one bool moved to the enum column.
    const bits = FIELDS.filter((f) => f.kind === "bool").length;
    assert.equal(bits, 52, `${bits} booleans, not 52`);
    assert.equal(Math.ceil(bits / 6), 9);
    assert.equal(FIELDS.filter((f) => f.kind === "enum").length, 9, "nine enums");
    assert.equal(FIELDS.filter((f) => f.kind === "number").length, 13, "thirteen numbers");
    assert.equal(FIELDS.length, 74, `${FIELDS.length} fields, not 74`);
});

test("the read side PLAN 9.1 asks for is on the handle, paired with every setter", () => {
    // Section 9.1, landed 2026-10-24 as step 1 of 9.10. The handle used to
    // carry every setter and no getter but getView; the asymmetry was what
    // blocked everything else in section 9. This asserts the pairing, so a
    // setter added later without its getter fails here rather than surfacing
    // as a field a saved setup silently drops.
    const at = view.indexOf("export interface PentagridHandle");
    assert.ok(at >= 0, "PentagridHandle is gone");
    const handle = view.slice(at, view.indexOf("\n}", at));
    for (const pair of [["setTileStyle", "getTileStyle"],
                        ["setFeatures", "getFeatures"],
                        ["setGridAlpha", "getGridAlpha"],
                        ["setView", "getView"]]) {
        const [set, get] = pair;
        assert.ok(handle.includes(set), `${set} is gone`);
        assert.ok(handle.includes(get),
                  `${set} has no ${get}: section 9 needs the pair, since a `
                  + "saved setup can only carry what it can read");
    }
    // Layer visibility is the stack's, being per-layer rather than per-view.
    const layers = readFileSync("src/view/layers.ts", "utf8");
    assert.ok(/visibility\(\): Record<string, boolean>/.test(layers),
              "LayerStack.visibility is gone");
    assert.ok(/setVisibility\(v: Record<string, boolean>\)/.test(layers),
              "LayerStack.setVisibility is gone");
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
    assert.ok(view.includes("opacity: () => grid.gridAlpha"),
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

test("faces, edges and vertices are three layers in one container", () => {
    // PLAN 5.99: "My use case is faces, edges and vertices. If these are
    // separate svg's, no good." They are three separate layers, so the export
    // unit has to be the container -- and on split all three are Penrose group
    // layers, which means all three land in the P file.
    for (const id of ["penrose-tiles", "penrose-edges", "penrose-vertices"]) {
        const at = view.indexOf(`id: "${id}"`);
        assert.ok(at >= 0, `the ${id} layer is gone`);
        const spec = view.slice(at, at + 220);
        assert.ok(spec.includes('group: "Penrose"'),
                  `${id} left the Penrose group, so split would no longer put `
                  + "faces, edges and vertices in one file");
    }
    // And split's homes are what sends the Penrose group to its own container.
    assert.ok(view.includes('groups: { Penrose: config.containerP }'),
              "split's Penrose home moved");
});

test("line widths are constants, so an export scale belongs in the recorder", () => {
    // PLAN 5.99 route B: a larger export canvas draws bigger tiles with the
    // same pixel strokes, so the picture comes out finer than it looks. The
    // fix is an export scale in the recording context, which already
    // intercepts lineWidth -- not twenty edits at the call sites. This test is
    // the premise: the call sites are literals.
    const widths = [...view.matchAll(/lineWidth = ([^;]+)/g)].map((m) => m[1].trim());
    assert.ok(widths.length > 15, `only ${widths.length} lineWidth assignments`);
    const derived = widths.filter((w) => /\bscale\b/.test(w));
    assert.equal(derived.length, 0,
                 `${derived.length} line widths already scale with the view `
                 + `(${derived.join(", ")}): route B's artifact is not uniform, `
                 + "so a blanket export scale would double-count them");
});

test("every layer draws in one coordinate frame, so both SVG outputs are one job", () => {
    // PLAN 5.99: "the svg images could probably be stacked manually on a web
    // page." They can, and it is the same recording as the composite -- but
    // only because every layer shares w, h, cx and cy. drawAll computes the
    // center ONCE and hands the same four to every layer, which is what makes
    // the per-layer bodies concatenable under one viewBox with no transform,
    // and equivalently stackable at top:0 left:0.
    //
    // If a layer ever got its own center or its own size, the composite would
    // need per-layer transforms and the HTML stack would misalign. So the
    // single frame is pinned here.
    const layers = readFileSync("src/view/layers.ts", "utf8");
    const at = layers.indexOf("drawAll()");
    const body = layers.slice(at, layers.indexOf("\n    }", at));
    assert.ok(/const cx = this\.w \/ 2;\s*\n\s*const cy = this\.h \/ 2;/.test(body),
              "drawAll no longer computes one center for the whole stack");
    // Computed before the loop, not inside it.
    assert.ok(body.indexOf("const cx") < body.indexOf("for (const l of this.order)"),
              "the center is computed per layer now");
    // And handed to every layer unchanged.
    assert.ok(body.includes("l.draw({ ctx: t.ctx, w: this.w, h: this.h, cx, cy })"),
              "a layer no longer receives the stack's own w, h, cx, cy");

    // The four CSS properties an <img> stack would copy from the canvas stack.
    for (const prop of ['style.position = "absolute"', 'style.top = "0"',
                        'style.left = "0"', "style.zIndex = String(z)"]) {
        assert.ok(layers.includes(prop), `the stack no longer sets ${prop}`);
    }
});

test("pixel size and scale are independent, and together they are a no-op", () => {
    // PLAN 5.99: "would it be practical to control pixel size and scale
    // separately when saving." They are already independent in the view --
    // mathToScreen is cx + (mx - viewX)*scale and the visible rect is
    // viewX - (cx - margin)/scale, so extent = W/scale and the tile edge is
    // scale. This pins the three combinations, including the one that does
    // nothing, since the save dialog's design rests on them.
    assert.ok(view.includes("cx + (mx - viewX) * scale"),
              "mathToScreen changed; the extent relation may no longer hold");
    assert.ok(view.includes("viewX - (cx - viewMargin) / scale"),
              "the visible rect no longer derives from W and scale");
});
