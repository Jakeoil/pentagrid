// The composite — PLAN section 5.99, step 2.
//
// Jake: "It's a record of a canvas with all its layers. A single image that can
// be put into a pdf or web page. A single SVG file. For example in split, one
// for G and one for P." So the unit is the container, and these tests are the
// four things a composite needs that per-layer files would not.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { exportSvg } from "../dist/svg/export.js";

const host = (id) => {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
};
const method = (features = {}, style = {}) => {
    const h = createPentagrid({
        container: host("stage"), panel: host("p"),
        features: { penroseTiles: true, gridLines: true, ...features },
    });
    h.gamma.setGuard(true);
    h.setTileStyle(style);
    return h;
};
const split = (features = {}) => {
    const h = createPentagrid({
        container: host("split-grid"), containerP: host("split-tiles"),
        panel: host("pg"), panelP: host("pp"),
        features: { penroseTiles: true, gridLines: true, axes: true, ...features },
    });
    h.gamma.setGuard(true);
    return h;
};
const groupsOf = (svg) => [...svg.matchAll(/<g id="([^"]*)"/g)].map((m) => m[1]);

test("one file per container: method gives one, split gives two", () => {
    assert.equal(exportSvg(method()).length, 1);
    const two = exportSvg(split());
    assert.equal(two.length, 2);
    assert.deepEqual(two.map((f) => f.id), ["split-grid", "split-tiles"]);
});

test("a mirrored layer appears in both files", () => {
    // split's homes are { container, groups: { Penrose: containerP },
    // mirrored: ["Axes"] } -- so axes draws into both, and both files need it.
    const [g, p] = exportSvg(split());
    assert.ok(groupsOf(g.svg).includes("axes"), "G lost the axes");
    assert.ok(groupsOf(p.svg).includes("axes"), "P lost the axes");
    // And the Penrose group is only on the right.
    assert.ok(groupsOf(p.svg).includes("penrose-tiles"));
    assert.ok(!groupsOf(g.svg).includes("penrose-tiles"), "the tiles leaked into G");
});

test("document order is Z order, which is not draw order", () => {
    // The gotcha that would be silently wrong. drawAll iterates insertion
    // order; the picture stacks by z-index. On G those differ -- inserted
    // background@5 grid@10 axes@70 dots@29, stacked 5 10 29 70 -- so an SVG
    // that kept draw order would put the axes under the dots.
    const h = split({ intersectionDots: true });
    const [g] = exportSvg(h);
    const order = groupsOf(g.svg);
    const z = new Map(h.stack.all().map((l) => [l.id, l.z]));
    for (let i = 1; i < order.length; i++) {
        assert.ok(z.get(order[i - 1]) <= z.get(order[i]),
                  `${order[i - 1]}@${z.get(order[i - 1])} before `
                  + `${order[i]}@${z.get(order[i])}`);
    }
    // And it really differs from the order drawAll walks.
    const drawn = h.stack.all().map((l) => l.id).filter((id) => order.includes(id));
    assert.notDeepEqual(order, drawn,
                        "draw order and z order coincide here, so this proves nothing");
});

test("a layer's opacity rides on its <g>, since it is not in the drawing", () => {
    const h = method();
    h.setGridAlpha(0.35);
    const [f] = exportSvg(h);
    const grid = /<g id="grid"([^>]*)>/.exec(f.svg);
    assert.ok(grid, "no grid group");
    assert.ok(grid[1].includes('opacity="0.35"'), grid[1]);
    // An opaque layer says nothing.
    const tiles = /<g id="penrose-tiles"([^>]*)>/.exec(f.svg);
    assert.ok(!tiles[1].includes("opacity="), tiles[1]);
});

test("hidden layers are left out, because display:none is not an empty canvas", () => {
    const h = method({ intersectionDots: true });
    assert.ok(groupsOf(exportSvg(h)[0].svg).includes("dots"));
    h.stack.setVisibility({ dots: false });
    assert.ok(!groupsOf(exportSvg(h)[0].svg).includes("dots"),
              "a layer switched off by hand was exported");
    // And one whose feature is off.
    h.setFeatures({ penroseTiles: true }, { merge: false });
    assert.ok(!groupsOf(exportSvg(h)[0].svg).includes("klabels"));
});

test("the raw overlays are not in the record", () => {
    // addRaw canvases are the hover marker, the highlight and the input
    // surface -- four on G, two on P. Transient scope, no part of a record.
    const h = method();
    assert.ok(h.stack.rawLayers.length > 0, "there are no raw layers to exclude");
    const svg = exportSvg(h)[0].svg;
    const ids = new Set(h.stack.all().map((l) => l.id));
    for (const g of groupsOf(svg)) {
        assert.ok(ids.has(g), `${g} is in the file and is not a drawn layer`);
    }
});

test("one viewBox, and no width or height", () => {
    // Route A: the file scales to whatever space it is given and the reader's
    // zoom is the zoom, which is the whole SVG advantage over a PNG here.
    const [f] = exportSvg(method());
    assert.ok(f.svg.includes('viewBox="0 0 800 800"'), f.svg.slice(0, 200));
    const open = f.svg.slice(0, f.svg.indexOf(">"));
    assert.ok(!/\swidth="/.test(open), `the root fixes a width: ${open}`);
    assert.ok(!/\sheight="/.test(open), "the root fixes a height");
    assert.equal((f.svg.match(/viewBox/g) ?? []).length, 1);
});

test("the namespaces the file needs are declared", () => {
    // xlink because the gradients' stop references are written in both
    // spellings, inkscape because the groups are marked as layers.
    const [f] = exportSvg(method({}, { shading: true, ramp: 1 }));
    assert.ok(f.svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(f.svg.includes('xmlns:xlink='), "no xlink namespace for the gradients");
    assert.ok(f.svg.includes("xlink:href="), "no gradient actually used it");
    assert.ok(f.svg.includes('xmlns:inkscape='));

    // Off, and the inkscape namespace goes with the attributes.
    const [plain] = exportSvg(method(), { editorLayers: false });
    assert.ok(!plain.svg.includes("xmlns:inkscape="));
    assert.ok(!plain.svg.includes("inkscape:groupmode"));
});

test("each <g> is a layer an editor can switch off", () => {
    // 5.99's happy medium: what separate files would have bought, without the
    // links. Inkscape and Illustrator both read this.
    const [f] = exportSvg(method());
    const g = /<g id="penrose-tiles"([^>]*)>/.exec(f.svg)[1];
    assert.ok(g.includes('inkscape:groupmode="layer"'), g);
    assert.ok(/inkscape:label="[^"]+"/.test(g), `no human label: ${g}`);
});

test("the raster is omitted with a reason, or embedded by the caller", () => {
    // drawKRegions colors every pixel. Composited it is a <g> inside the one
    // file rather than a file to skip, so it is a PNG or an omission -- and
    // this module has no PNG encoder and will not pretend otherwise.
    const h = method({ kRegions: true });
    const [out] = exportSvg(h);
    assert.equal(out.droppedRaster, true, "the raster was not reported");
    assert.ok(!groupsOf(out.svg).includes("background"));
    assert.ok(/<!-- layer background omitted: a raster/.test(out.svg),
              "the omission is silent");

    // A page with a live canvas can hand one back.
    const [embedded] = exportSvg(h, {
        raster: (l) => `<image id="${l.id}-png" href="data:image/png;base64,AAAA"/>`,
    });
    assert.equal(embedded.droppedRaster, false);
    assert.ok(groupsOf(embedded.svg).includes("background"));
    assert.ok(embedded.svg.includes("data:image/png;base64,AAAA"));
});

test("`only` narrows the file to the layers asked for", () => {
    const h = method({ penroseEdges: true, intersectionDots: true });
    const [f] = exportSvg(h, { only: ["penrose-tiles", "penrose-edges"] });
    assert.deepEqual(groupsOf(f.svg), ["penrose-tiles", "penrose-edges"]);
});

test("the page is exactly as it was afterwards, even if the redraw throws", () => {
    // The contexts are swapped for recorders and must go back, or the page is
    // dead after an export.
    const h = method();
    const before = h.stack.all().map((l) => l.ctx);
    exportSvg(h);
    assert.deepEqual(h.stack.all().map((l) => l.ctx), before,
                     "a recorder was left installed");
    h.redraw();        // still works

    // And on a failure part way through.
    const boom = { stack: h.stack, redraw: () => { throw new Error("boom"); } };
    assert.throws(() => exportSvg(boom), /boom/);
    assert.deepEqual(h.stack.all().map((l) => l.ctx), before,
                     "a thrown redraw left the recorders installed");
    h.redraw();
});

test("the export scale reaches the strokes in the file", () => {
    const h = method({ penroseEdges: true });
    const [one] = exportSvg(h);
    const [four] = exportSvg(h, { scale: 4 });
    const widths = (svg) => [...svg.matchAll(/stroke-width="([^"]*)"/g)]
        .map((m) => Number(m[1]));
    const a = widths(one.svg), b = widths(four.svg);
    assert.ok(a.length > 10, `only ${a.length} strokes`);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
        assert.ok(Math.abs(b[i] - a[i] * 4) < 1e-9,
                  `stroke ${i}: ${b[i]} is not four times ${a[i]}`);
    }
    // Coordinates are untouched -- the viewBox does that job.
    const coord = /d="M([-\d.]+) ([-\d.]+)/;
    assert.equal(coord.exec(one.svg)[1], coord.exec(four.svg)[1]);
});

test("a layer that drew nothing contributes no group", () => {
    const h = method();
    const [f] = exportSvg(h);
    for (const id of groupsOf(f.svg)) {
        const body = f.svg.slice(f.svg.indexOf(`<g id="${id}"`));
        assert.ok(/<(path|rect|text|image)/.test(body.slice(0, body.indexOf("</g>"))),
                  `${id} is an empty group`);
    }
});

/**
 * Well-formedness, by a tag stack.
 *
 * A serializer's one unforgivable failure is emitting something a parser will
 * not read, and it is the failure a string-assembly test cannot see — every
 * element can be individually correct and the document still unbalanced.
 * Quoted attribute values are skipped over, since a `>` inside one is text.
 */
function illFormed(svg) {
    const stack = [];
    let i = 0;
    while (i < svg.length) {
        const lt = svg.indexOf("<", i);
        if (lt < 0) break;
        if (svg.startsWith("<!--", lt)) {
            const end = svg.indexOf("-->", lt);
            if (end < 0) return "an unterminated comment";
            i = end + 3;
            continue;
        }
        // Find the matching '>', skipping quoted attribute values.
        let j = lt + 1, quote = "";
        for (; j < svg.length; j++) {
            const c = svg[j];
            if (quote) { if (c === quote) quote = ""; continue; }
            if (c === '"' || c === "'") { quote = c; continue; }
            if (c === ">") break;
        }
        if (j >= svg.length) return "an unterminated tag";
        const inner = svg.slice(lt + 1, j);
        i = j + 1;
        if (inner.startsWith("/")) {
            const name = inner.slice(1).trim();
            const open = stack.pop();
            if (open !== name) return `</${name}> closes <${open ?? "nothing"}>`;
            continue;
        }
        if (inner.endsWith("/")) continue;              // self closing
        const name = /^[^\s/>]+/.exec(inner)?.[0];
        if (!name) return "a tag with no name";
        stack.push(name);
    }
    return stack.length ? `<${stack[stack.length - 1]}> never closes` : null;
}

test("the whole document is well formed, over the loaded stack", () => {
    const h = createPentagrid({
        container: host("stage"), panel: host("p"),
        features: { penroseTiles: true, penroseEdges: true, penroseVertices: true,
                    gridLines: true, intersectionDots: true, kLabels: true },
    });
    h.gamma.setGuard(true);
    h.setTileStyle({ color: "bands", band: 0.5, shading: true, ramp: 1,
                     pentaFace: true, pentaEdge: true, vertexMark: "index" });
    const [f] = exportSvg(h);
    assert.equal(illFormed(f.svg), null, "the document does not parse");
    assert.ok(f.svg.length > 200000, `only ${f.svg.length} bytes drawn`);
    assert.equal(f.layers.length, 6, `${f.layers.join(" ")}`);
    // What is in it, which is also the shape 5.99 predicted.
    const count = (t) => (f.svg.match(new RegExp(`<${t}[\\s/>]`, "g")) ?? []).length;
    assert.ok(count("path") > 4000, `${count("path")} paths`);
    assert.ok(count("text") > 100, `${count("text")} texts`);
    assert.ok(count("clipPath") > 100, `${count("clipPath")} clips`);
    // Nothing numeric went wrong on the way out.
    assert.ok(!/NaN|Infinity|undefined|\[object/.test(f.svg), "the file carries junk");
});

test("the checker would catch an unbalanced document", () => {
    // The guard on the guard.
    assert.equal(illFormed('<svg><g id="a"><path d="M0 0"/></g></svg>'), null);
    assert.ok(illFormed("<svg><g></svg>"), "an unclosed g passed");
    assert.ok(illFormed("<svg></g></svg>"), "a mismatched close passed");
    assert.ok(illFormed("<svg>"), "an unclosed root passed");
    // A '>' inside an attribute is text, not a tag end.
    assert.equal(illFormed('<svg><text x="1">a &gt; b</text></svg>'), null);
    assert.equal(illFormed('<svg><path d="M0 0" data-x="a>b"/></svg>'), null);
});
