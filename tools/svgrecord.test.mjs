// The recording context — PLAN section 5.99, step 1.
//
// Every layer draws through one CanvasRenderingContext2D and touches nothing
// else, so an object with the same members records instead of rasterizing and
// no layer's draw changes. These tests cover the 28 members the layers use --
// tools/ctxapi.test.mjs is what keeps that number honest -- with most of the
// care going to the four that do not map cleanly.
import test from "node:test";
import assert from "node:assert/strict";
import { SvgRecorder } from "../dist/svg/record.js";

const rec = (opts) => new SvgRecorder(opts);

test("a path becomes one <path>, with the fill it was given", () => {
    const r = rec();
    r.fillStyle = "#abc";
    r.beginPath();
    r.moveTo(1, 2);
    r.lineTo(3, 4);
    r.lineTo(5, 6);
    r.closePath();
    r.fill();
    assert.equal(r.out.body.length, 1);
    assert.equal(r.out.body[0], '<path d="M1 2 L3 4 L5 6 Z" fill="#abc"/>');
    assert.deepEqual(r.out.defs, []);
});

test("a stroke carries width, join, cap and dash; a fill carries none of them", () => {
    const r = rec();
    r.strokeStyle = "#111";
    r.lineWidth = 2.5;
    r.lineJoin = "round";
    r.lineCap = "round";
    r.setLineDash([4, 2]);
    r.beginPath();
    r.moveTo(0, 0);
    r.lineTo(10, 0);
    r.stroke();
    const out = r.out.body[0];
    assert.ok(out.includes('stroke="#111"'), out);
    assert.ok(out.includes('stroke-width="2.5"'), out);
    assert.ok(out.includes('stroke-linejoin="round"'), out);
    assert.ok(out.includes('stroke-linecap="round"'), out);
    assert.ok(out.includes('stroke-dasharray="4 2"'), out);
    assert.ok(out.includes('fill="none"'), "a stroked path must not fill");
    assert.deepEqual(r.getLineDash(), [4, 2]);
});

test("globalAlpha becomes an opacity, and only when it is not 1", () => {
    const r = rec();
    r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    assert.ok(!r.out.body[0].includes("opacity"), "an opaque path carries opacity");
    r.globalAlpha = 0.25;
    r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    assert.ok(r.out.body[1].includes('opacity="0.25"'), r.out.body[1]);
});

test("save and restore isolate the state, dash array included", () => {
    const r = rec();
    r.fillStyle = "#001";
    r.setLineDash([1, 1]);
    r.save();
    r.fillStyle = "#002";
    r.lineWidth = 9;
    r.setLineDash([5]);
    assert.equal(r.fillStyle, "#002");
    r.restore();
    assert.equal(r.fillStyle, "#001", "restore did not put the fill back");
    assert.equal(r.lineWidth, 1);
    assert.deepEqual(r.getLineDash(), [1, 1], "the dash array was shared, not copied");
});

test("an arc becomes A, and a full turn becomes two", () => {
    // SVG cannot draw a full circle with one arc -- the endpoints coincide and
    // the command does nothing -- so a sweep of 2pi is split. The dots and the
    // pool balls are drawn that way.
    const r = rec();
    r.beginPath();
    r.arc(10, 10, 5, 0, Math.PI / 2);
    r.stroke();
    const quarter = r.out.body[0];
    assert.equal((quarter.match(/A/g) ?? []).length, 1, quarter);
    assert.ok(quarter.includes("M15 10"), `the arc did not start at its start: ${quarter}`);
    assert.ok(/A5 5 0 0 1 10 15/.test(quarter), quarter);

    const c = rec();
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();
    assert.equal((c.out.body[0].match(/A/g) ?? []).length, 2,
                 `a full circle needs two arcs: ${c.out.body[0]}`);

    // A sweep past a half turn sets the large-arc flag.
    const big = rec();
    big.beginPath();
    big.arc(0, 0, 1, 0, Math.PI * 1.5);
    big.stroke();
    assert.ok(/A1 1 0 1 1 /.test(big.out.body[0]), big.out.body[0]);
});

test("a gradient's paint and placement are separate defs", () => {
    // The finding that made this work. A gradient has two identities -- its
    // stops and its geometry -- and a key over both deduplicates almost
    // nothing, because every tile's ramp runs along its own diagonal. Measured
    // over a shaded patch: 488 geometries, 4 stop sets. So the stops go in one
    // def and the placements inherit them through `href`, which SVG supports
    // exactly.
    const r = rec();
    for (let i = 0; i < 20; i++) {
        const g = r.createLinearGradient(i, 0, i + 1, 1);   // a new placement
        g.addColorStop(0, "#111");                          // the same paint
        g.addColorStop(1, "#222");
        r.fillStyle = g;
        r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    }
    const stops = r.out.defs.filter((d) => !d.includes("x1="));
    const geom = r.out.defs.filter((d) => d.includes("x1="));
    assert.equal(stops.length, 1, `${stops.length} stop defs for one paint`);
    assert.equal(geom.length, 20, "the placements were deduplicated away");
    // A placement def carries four numbers and a reference, and no stops.
    assert.ok(!geom[0].includes("<stop"), `a placement def carries stops: ${geom[0]}`);
    assert.ok(geom[0].includes('href="#'), geom[0]);
    // Both spellings, so every editor and both SVG versions read it.
    assert.ok(geom[0].includes('xlink:href="#'), geom[0]);

    // And the same placement with different paint is a different gradient,
    // which is irreducible: SVG cannot combine two defs at the point of use.
    const g2 = r.createLinearGradient(0, 0, 1, 1);
    g2.addColorStop(0, "#999");
    r.fillStyle = g2;
    r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    assert.equal(r.out.defs.filter((d) => !d.includes("x1=")).length, 2);
});

test("gradients go to defs and are deduplicated by their stops", () => {
    // The height ramp builds one per painted face -- 658 over bare tiles, 1974
    // over families2 -- and the index range is four or five levels, so the
    // distinct gradients are dozens, not thousands.
    const r = rec();
    const mk = () => {
        const g = r.createLinearGradient(0, 0, 10, 10);
        g.addColorStop(0, "#111");
        g.addColorStop(0.5, "#222");
        g.addColorStop(1, "#333");
        return g;
    };
    for (let i = 0; i < 50; i++) {
        r.fillStyle = mk();
        r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    }
    // Fifty identical gradients: one def for the paint, one for the placement.
    assert.equal(r.out.defs.length, 2,
                 `${r.out.defs.length} defs for fifty identical gradients`);
    assert.equal(r.out.body.length, 50);
    assert.ok(r.out.body[0].includes('fill="url(#'), r.out.body[0]);
    assert.ok(r.out.defs[0].includes("<linearGradient"), r.out.defs[0]);
    assert.ok(r.out.defs[0].includes('offset="0.5" stop-color="#222"'), r.out.defs[0]);

    // A different stop is a different paint, and so another pair.
    const g2 = r.createLinearGradient(0, 0, 10, 10);
    g2.addColorStop(0, "#999");
    r.fillStyle = g2;
    r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    assert.equal(r.out.defs.length, 4);
});

test("a radial gradient is a radialGradient", () => {
    const r = rec();
    const g = r.createRadialGradient(1, 2, 0, 3, 4, 5);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#000");
    r.fillStyle = g;
    r.beginPath(); r.arc(3, 4, 5, 0, Math.PI * 2); r.fill();
    assert.ok(r.out.defs[0].includes("<radialGradient"), r.out.defs[0]);
    const place = r.out.defs.find((d) => d.includes("cx="));
    assert.ok(place, "no radial placement def");
    assert.ok(place.includes('cx="3" cy="4" r="5"'), place);
});

test("clip becomes a clipPath, deduplicated, and ends with restore", () => {
    // The inlay clips every pentagon to a tile, and a tile carries several --
    // so the clip is per tile and must not be emitted once per pentagon.
    const r = rec();
    r.save();
    r.beginPath();
    r.moveTo(0, 0); r.lineTo(10, 0); r.lineTo(10, 10); r.closePath();
    r.clip();
    r.beginPath(); r.moveTo(1, 1); r.lineTo(2, 2); r.fill();
    r.beginPath(); r.moveTo(3, 3); r.lineTo(4, 4); r.fill();
    r.restore();
    r.beginPath(); r.moveTo(5, 5); r.lineTo(6, 6); r.fill();

    assert.equal(r.out.defs.length, 1, "one clip path for one clip");
    assert.ok(r.out.defs[0].startsWith("<clipPath"), r.out.defs[0]);
    assert.ok(r.out.body[0].includes("clip-path="), "the first fill was not clipped");
    assert.ok(r.out.body[1].includes("clip-path="), "the second fill was not clipped");
    assert.ok(!r.out.body[2].includes("clip-path="),
              "the clip outlived its restore");

    // The same path clipped again is the same def.
    r.save();
    r.beginPath();
    r.moveTo(0, 0); r.lineTo(10, 0); r.lineTo(10, 10); r.closePath();
    r.clip();
    r.restore();
    assert.equal(r.out.defs.length, 1, "an identical clip was emitted twice");
});

test("text carries its anchor, baseline and size, and is escaped", () => {
    const r = rec();
    r.font = "12px ui-monospace, monospace";
    r.textAlign = "center";
    r.textBaseline = "middle";
    r.fillStyle = "#123";
    r.fillText("3 < 4 & \"5\"", 7, 8);
    const t = r.out.body[0];
    assert.ok(t.includes('text-anchor="middle"'), t);
    assert.ok(t.includes('dominant-baseline="central"'), t);
    assert.ok(t.includes('font-size="12"'), t);
    assert.ok(t.includes("ui-monospace"), t);
    assert.ok(t.includes("3 &lt; 4 &amp; &quot;5&quot;"), t);
    // An empty string draws nothing.
    r.fillText("", 0, 0);
    assert.equal(r.out.body.length, 1);
});

test("the export scale multiplies stroke width and font, and nothing else", () => {
    // Section 5.99: a zoomed export draws bigger tiles with the same pixel
    // strokes, so the recorder is the one place that can keep them in
    // proportion. Coordinates must NOT be touched -- the viewBox does that.
    const r = rec({ scale: 4 });
    r.lineWidth = 2;
    r.setLineDash([3]);
    r.beginPath(); r.moveTo(10, 10); r.lineTo(20, 20); r.stroke();
    const s = r.out.body[0];
    assert.ok(s.includes('stroke-width="8"'), s);
    assert.ok(s.includes('stroke-dasharray="12"'), s);
    assert.ok(s.includes("M10 10 L20 20"), `coordinates were scaled too: ${s}`);

    r.font = "10px sans-serif";
    r.fillText("x", 0, 0);
    assert.ok(r.out.body[1].includes('font-size="40"'), r.out.body[1]);
    // And measureText answers in the drawing's own units, unscaled.
    assert.ok(rec().measureText("xxxx").width > 0);
});

test("clearRect draws nothing, because a document starts empty", () => {
    const r = rec();
    r.clearRect(0, 0, 100, 100);
    assert.deepEqual(r.out.body, []);
});

test("the raster is recorded as a fact, not drawn", () => {
    // drawKRegions colors every pixel by its K-region. The layer writes into
    // the buffer and hands it back, so a stub that refused would throw.
    const r = rec();
    assert.equal(r.out.raster, false);
    const img = r.createImageData(4, 4);
    assert.equal(img.data.length, 64, "the layer cannot write into the buffer");
    img.data[0] = 255;
    r.putImageData(img, 0, 0);
    assert.equal(r.out.raster, true);
    assert.deepEqual(r.out.body, [], "the raster emitted an element");
});

test("ids do not collide between two recorders", () => {
    // One per layer, all landing in one document -- so the prefix matters.
    const a = rec({ idPrefix: "a" });
    const b = rec({ idPrefix: "b" });
    for (const r of [a, b]) {
        const g = r.createLinearGradient(0, 0, 1, 1);
        g.addColorStop(0, "#000");
        r.fillStyle = g;
        r.beginPath(); r.moveTo(0, 0); r.lineTo(1, 1); r.fill();
    }
    assert.ok(a.out.defs[0].includes('id="a1"'), a.out.defs[0]);
    assert.ok(b.out.defs[0].includes('id="b1"'), b.out.defs[0]);
});

test("an empty path paints nothing", () => {
    const r = rec();
    r.beginPath();
    r.fill();
    r.stroke();
    r.clip();
    assert.deepEqual(r.out.body, []);
    assert.deepEqual(r.out.defs, []);
});

test("lineTo with no current point starts the path, as canvas does", () => {
    const r = rec();
    r.beginPath();
    r.lineTo(5, 6);
    r.lineTo(7, 8);
    r.stroke();
    assert.ok(r.out.body[0].includes('d="M5 6 L7 8"'), r.out.body[0]);
});

// ── against real layers ───────────────────────────────────────────────
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";

const host = (id) => {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
};
/** Record every layer of a configured view, once. */
function record(style = {}, features = {}) {
    const h = createPentagrid({
        container: host("stage"), panel: host("p"),
        features: { penroseTiles: true, ...features },
    });
    h.gamma.setGuard(true);
    h.setTileStyle(style);
    const recs = new Map();
    for (const l of h.stack.all()) {
        const r = new SvgRecorder({ idPrefix: `${l.id.replace(/[^a-z0-9]/g, "")}-` });
        recs.set(l.id, r);
        l.ctx = r;
    }
    h.redraw();
    return recs;
}

test("it records every layer of a real view, well formed and finite", () => {
    // The claim the whole approach rests on: the layers draw through this and
    // nothing changes in them. If a layer reached for a member the recorder
    // lacks it would throw here, which is the other half of what
    // tools/ctxapi.test.mjs asserts statically.
    const recs = record(
        { color: "bands", band: 0.5, shading: true, ramp: 1, pentaFace: true,
          pentaEdge: true, vertexMark: "index" },
        { penroseEdges: true, penroseVertices: true, gridLines: true,
          intersectionDots: true, kLabels: true });
    let elements = 0;
    for (const r of recs.values()) elements += r.out.body.length;
    assert.ok(elements > 2000, `only ${elements} elements over the whole stack`);

    const all = [...recs.values()].flatMap((r) => [...r.out.defs, ...r.out.body]);
    // Every element is a single closed tag.
    const bad = all.filter((s) => !/^<[a-zA-Z]+[\s\S]*(\/>|<\/[a-zA-Z]+>)$/.test(s));
    assert.deepEqual(bad.slice(0, 3), [], `${bad.length} malformed elements`);
    // Nothing numeric went wrong on the way.
    const junk = all.filter((s) => /NaN|Infinity|undefined|\[object/.test(s));
    assert.deepEqual(junk.slice(0, 3), [], `${junk.length} elements carry junk`);
});

test("the raster layer is the only one that cannot be drawn", () => {
    // drawKRegions colors every pixel. PLAN 5.99: it is the whole draw of the
    // `background` layer, which keeps the one unrepresentable thing to one
    // layer -- and the composite then decides between an embedded PNG and
    // leaving it out.
    const recs = record({}, { kRegions: true });
    const raster = [...recs].filter(([, r]) => r.out.raster).map(([id]) => id);
    assert.deepEqual(raster, ["background"],
                     `the raster layers are ${raster.join(", ")}`);
});

test("the shaded tile layer's gradients collapse to a handful of paints", () => {
    // The measurement PLAN 5.99 turns on: one placement per tile, and only a
    // few distinct paints, because the index range is four or five levels.
    const recs = record({ color: "type", shading: true, ramp: 1 });
    const r = recs.get("penrose-tiles");
    const stops = r.out.defs.filter((d) => !d.includes("x1="));
    const geom = r.out.defs.filter((d) => d.includes("x1="));
    assert.ok(r.out.body.length > 400, `only ${r.out.body.length} tiles`);
    assert.equal(geom.length, r.out.body.length,
                 "the placements are not one per painted face");
    assert.ok(stops.length <= 12,
              `${stops.length} distinct paints; 5.99 expects a handful`);
    // And the placements carry no stops, which is where the saving is.
    assert.ok(geom.every((d) => !d.includes("<stop")),
              "a placement def carries its own stops");
});
