// Asking for the export — PLAN section 5.99, step 3.
//
// Steps 1 and 2 built the document and nothing could ask for one, which is the
// same shape of gap reset() had before 9.4 gave it a button. A feature nobody
// can invoke is not a feature.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { createGrowthView } from "../dist/view/growth.js";
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
    // Behavior, not source: the four buttons moved into `view/controls.ts`
    // on 2026-11-26 so roof and grow could have them too.
    const panel = makeStub({ children: [] });
    panel.appendChild = (c) => { panel.children.push(c); return c; };
    const stage = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    stage.appendChild = (c) => { stage.children.push(c); return c; };
    createPentagrid({ container: stage, panel, features: { penroseTiles: true } });
    let btn = null;
    const walk = (el) => {
        for (const c of el.children ?? []) {
            if (c.tagName === "button" && c.textContent === "export svg") btn = c;
            walk(c);
        }
    };
    walk(panel);
    assert.ok(btn, "no export button");
    assert.ok((btn.on?.click ?? []).length > 0, "the export button is inert");

    // It saves, and says so in the panel.
    const saved = [];
    globalThis.__downloads = saved;
    btn.on.click[0]();
    let said = null;
    const findSaid = (el) => {
        for (const c of el.children ?? []) {
            if (String(c.className) === "copy-said" && c.textContent) said = c.textContent;
            findSaid(c);
        }
    };
    findSaid(panel);
    assert.ok(said, "the export button said nothing");
});

test("roof and grow can export too, and copy their setup", () => {
    // Jake, 2026-11-26: "Add the export svg and copy setup buttons to roof and
    // grow." They had neither -- the buttons were the panel's and the growth
    // pages have no panel -- so the two pages that most want a vector file
    // were the two that could not ask for one.
    //
    // The growth layers draw into the pentagrid's own stack, which is what
    // makes the export one call: `view.svg()` is `pentagrid.svg()`, with
    // `growth` and `vertex-index` in it.
    const host = () => {
        const el = makeStub({
            children: [],
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
            getAttribute: () => null, getAttributeNames: () => [],
        });
        el.appendChild = (c) => { el.children.push(c); return c; };
        return el;
    };
    for (const lift of [true, false]) {
        const v = createGrowthView({ container: host(), lift });
        v.set({ grow: 1, fold: lift ? 1 : 0 });
        assert.equal(typeof v.svg, "function", "the growth handle cannot export");
        const files = v.svg();
        assert.equal(files.length, 1, "one file per viewport");
        const groups = [...files[0].svg.matchAll(/<g id="([^"]*)"/g)].map((m) => m[1]);
        assert.ok(groups.includes("growth"),
                  `the growth layer is not in the file: ${groups.join(" ")}`);
        assert.ok(files[0].svg.startsWith("<svg"), "not an SVG document");
        // And the markup the other button copies carries the growth slice.
        assert.match(v.embed(), /^<div/);
    }
});

test("the setup buttons are shared code, not a second copy", () => {
    // One `addSetupButtons` in view/controls.ts, used by the panel and by the
    // three growth pages. A second clipboard dance is exactly what this
    // project keeps deleting.
    const controls = readFileSync("src/view/controls.ts", "utf8");
    assert.ok(controls.includes("export function addSetupButtons"), "the helper moved");
    const pg = readFileSync("src/view/pentagrid.ts", "utf8");
    assert.ok(pg.includes("addSetupButtons("), "the panel builds its own buttons again");
    for (const page of ["roof", "grow", "grow7"]) {
        const src = readFileSync(`src/app/${page}.ts`, "utf8");
        assert.ok(src.includes("addSetupButtons("), `${page} has no setup buttons`);
        assert.ok(src.includes(`"${page}-setup"`), `${page} does not name its slot`);
        const html = readFileSync(`${page}.html`, "utf8");
        assert.ok(html.includes(`id="${page}-setup"`), `${page}.html has no slot for them`);
    }
});

test("a growth page's link carries the growth slice, not just the tiling", () => {
    // Jake, 2026-11-26: "I would like a copy url button on all those pages."
    // The point of it on roof and grow is that the URL has to reopen THE ROOF
    // -- the fold, the camera, the index marks -- and not the flat tiling
    // underneath, which is all the pentagrid's own `link` would know about.
    const host = () => {
        const el = makeStub({
            children: [],
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
            getAttribute: () => null, getAttributeNames: () => [],
        });
        el.appendChild = (c) => { el.children.push(c); return c; };
        return el;
    };
    const v = createGrowthView({ container: host(), lift: true });
    v.markBaseline();
    v.set({ grow: 0.5, fold: 0, indexStyle: "pool", paths: "high" });

    const url = v.link();
    assert.ok(url.includes("?"), `no query in ${url}`);
    for (const want of ["grow=0.5", "index-style=pool", "paths=high"]) {
        assert.ok(url.includes(want), `the link lacks ${want}: ${url}`);
    }
    assert.ok(!url.includes("data-"), "the link uses the long spelling");

    // And it says the same thing the markup does, which is the whole claim:
    // one idea in two spellings.
    const markup = v.embed();
    for (const want of ["data-grow=", "data-index-style=", "data-paths="]) {
        assert.ok(markup.includes(want), `the markup lacks ${want}: ${markup}`);
    }
    // A field at its baseline is in neither.
    assert.ok(!url.includes("azimuth"), `an unchanged field got into ${url}`);
});

test("moire shows the four buttons instead of building them hidden", () => {
    // `settings` was trimmed from moire's exposed rows, so each side BUILT
    // copy setup, reset page, copy link and export svg and then hid them --
    // the page had none of them but the bar's own reset, and asking for this
    // page as a link or a file was impossible.
    const src = readFileSync("src/app/moire.ts", "utf8");
    const rows = [...(src.match(/const ROWS = \[([\s\S]*?)\n\];/)?.[1] ?? "")
        .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n")
        .matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(rows.includes("settings"),
              `moire still hides its settings row: ${rows.join(", ")}`);
});
