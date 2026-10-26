// Asking for the export — PLAN section 5.99, step 3.
//
// Steps 1 and 2 built the document and nothing could ask for one, which is the
// same shape of gap reset() had before 9.4 gave it a button. A feature nobody
// can invoke is not a feature.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { downloadText, svgFilename } from "../dist/svg/download.js";
import { readFileSync } from "node:fs";

const host = (id) => {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
};

test("the filename is safe, and only disambiguates when it needs to", () => {
    assert.equal(svgFilename("method", "stage"), "method-stage.svg");
    assert.equal(svgFilename("method", "method"), "method.svg",
                 "a single canvas got a redundant suffix");
    assert.equal(svgFilename("split", "split-grid"), "split-split-grid.svg");
    // Anything a path or a page id can carry, made safe.
    assert.equal(svgFilename("a b/c", "x:y"), "a-b-c-x-y.svg");
    assert.equal(svgFilename("", ""), "canvas.svg");
    for (const n of [svgFilename("ünïcode", "✓"), svgFilename("..", "..")]) {
        assert.ok(/^[a-z0-9._-]+\.svg$/.test(n), `${n} is not a safe filename`);
    }
});

test("the download takes the blob route, and reports which route it took", () => {
    // A download that silently does not happen is the worst of the outcomes,
    // so the caller is told rather than left to guess.
    const clicks = [];
    const made = [];
    const realDoc = globalThis.document;
    const realURL = globalThis.URL;
    const realBlob = globalThis.Blob;
    try {
        globalThis.document = {
            createElement: () => ({
                set href(v) { this._href = v; },
                get href() { return this._href; },
                download: "",
                click() { clicks.push({ href: this._href, name: this.download }); },
            }),
        };
        globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
        globalThis.URL = {
            createObjectURL: (b) => { made.push(b); return "blob:x1"; },
            revokeObjectURL: () => {},
        };
        assert.equal(downloadText("a.svg", "<svg/>"), "blob");
        assert.equal(clicks.length, 1);
        assert.equal(clicks[0].name, "a.svg");
        assert.equal(clicks[0].href, "blob:x1");
        assert.deepEqual(made[0].parts, ["<svg/>"]);

        // No blob support: the data: fallback, which works at this size.
        globalThis.URL = {};
        assert.equal(downloadText("b.svg", "<svg/>"), "data");
        assert.ok(clicks[1].href.startsWith("data:image/svg+xml"), clicks[1].href);
        assert.ok(clicks[1].href.includes(encodeURIComponent("<svg/>")));

        // No anchor at all: say so rather than throw.
        globalThis.document = { createElement: () => ({}) };
        assert.equal(downloadText("c.svg", "<svg/>"), "unavailable");
    } finally {
        globalThis.document = realDoc;
        globalThis.URL = realURL;
        globalThis.Blob = realBlob;
    }
});

test("nothing throws where there is no document at all", () => {
    const real = globalThis.document;
    try {
        globalThis.document = undefined;
        assert.equal(downloadText("a.svg", "x"), "unavailable");
    } finally {
        globalThis.document = real;
    }
});

test("handle.svg() is the export, one file per container", () => {
    const one = createPentagrid({
        container: host("stage"), panel: host("p"),
        features: { penroseTiles: true },
    });
    one.gamma.setGuard(true);
    const files = one.svg();
    assert.equal(files.length, 1);
    assert.ok(files[0].svg.startsWith("<svg "), files[0].svg.slice(0, 40));
    assert.ok(files[0].layers.includes("penrose-tiles"));

    const two = createPentagrid({
        container: host("g"), containerP: host("p2"),
        panel: host("pg"), panelP: host("pp"),
        features: { penroseTiles: true, gridLines: true },
    });
    assert.equal(two.svg().length, 2);

    // And the options reach through.
    const scaled = one.svg({ scale: 3 });
    assert.ok(scaled[0].svg.length > 0);
    assert.ok(one.svg({ only: ["penrose-tiles"] })[0].layers.length === 1);
});

test("the page closes the raster gap, because it has the live canvas", () => {
    // exportSvg has no PNG encoder; a page does, through toDataURL on the
    // canvas that still holds the last real draw. This is the one place in the
    // program that can embed drawKRegions, which is why the exporter takes a
    // callback rather than guessing.
    const h = createPentagrid({
        container: host("stage"), panel: host("p"),
        features: { kRegions: true, penroseTiles: true },
    });
    h.gamma.setGuard(true);
    // The stub's canvas has no toDataURL, so the raster is honestly dropped.
    let [f] = h.svg();
    assert.equal(f.droppedRaster, true);
    assert.ok(/<!-- layer background omitted/.test(f.svg));

    // Give it one, as a browser does.
    for (const l of h.stack.all()) {
        if (l.id === "background") l.canvas.toDataURL = () => "data:image/png;base64,QQ==";
    }
    [f] = h.svg();
    assert.equal(f.droppedRaster, false, "a usable toDataURL was ignored");
    assert.ok(f.svg.includes('href="data:image/png;base64,QQ=="'), "no embedded image");
    assert.ok(f.svg.includes("xlink:href=\"data:image/png"), "no 1.1 spelling");
    assert.ok(f.layers.includes("background"));

    // A toDataURL that throws, or returns junk, is refused rather than embedded.
    for (const l of h.stack.all()) {
        if (l.id === "background") l.canvas.toDataURL = () => { throw new Error("tainted"); };
    }
    assert.equal(h.svg()[0].droppedRaster, true, "a throwing toDataURL was trusted");
    for (const l of h.stack.all()) {
        if (l.id === "background") l.canvas.toDataURL = () => "not-a-url";
    }
    assert.equal(h.svg()[0].droppedRaster, true, "a junk data URL was embedded");
});

test("the button is in the panel, beside the other three", () => {
    const src = readFileSync("src/view/pentagrid.ts", "utf8");
    assert.ok(src.includes('svgBtn.textContent = "export svg"'), "no export button");
    assert.ok(src.includes("svgBtn.addEventListener"), "the export button is inert");
    // It reports like the others, and falls back to the console.
    const at = src.indexOf('svgBtn.addEventListener');
    const body = src.slice(at, src.indexOf("copyRow.appendChild(svgBtn)", at));
    assert.ok(body.includes("say("), "the export button says nothing");
    assert.ok(body.includes("console.log"), "no fallback when a save is refused");
    assert.ok(body.includes("svgFilename"), "the file is not named");
});
