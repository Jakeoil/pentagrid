// The Beyond Wieringa page is wired: every id the app reaches for exists, the
// importmap points at files that are there, and the script it loads was built.
//
// This is the pagecheck guard in the one form that works for a WebGL page.
// `tools/pagecheck.mjs` imports a page against a stub DOM and fires its
// handlers, which cannot be done here — there is no WebGL in node, and
// `createZono3d` builds a renderer on the first line. What it was catching is
// still worth catching: a renamed id, a moved script, a vendor file that never
// got copied. All three are blank pages that compile clean.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const HTML = readFileSync("beyond-wieringa/index.html", "utf8");
const APP = readFileSync("src/app/beyond.ts", "utf8");

test("every id the page script looks up is in the html", () => {
    // Both ways the app names one: directly, and through the slider helper.
    const wanted = [
        ...[...APP.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]),
        ...[...APP.matchAll(/slider\("([^"]+)"/g)].map((m) => m[1]),
        ...[...APP.matchAll(/\["([a-z]+)", "[a-z]+"\]/g)].map((m) => m[1]),
    ];
    assert.ok(wanted.length >= 7, `only ${wanted.length} ids found in the app: ${wanted}`);
    for (const id of wanted) {
        assert.ok(HTML.includes(`id="${id}"`), `#${id} is reached for but not in the page`);
    }
});

test("the importmap and the script point at files that exist", () => {
    const map = HTML.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    assert.ok(map, "no importmap — the bare 'three' specifier would not resolve");
    const imports = JSON.parse(map[1]).imports;
    assert.ok(imports.three, "three is not mapped");
    for (const [name, path] of Object.entries(imports)) {
        const onDisk = path.replace(/^\.\.\//, "");
        assert.ok(existsSync(onDisk), `${name} maps to ${path}, which is not there`);
    }
    const src = HTML.match(/<script type="module" src="([^"]+)"/);
    assert.ok(src, "no module script");
    assert.ok(existsSync(src[1].replace(/^\.\.\//, "")),
              `${src[1]} is not built — run npm run build`);
});

test("every bare specifier the view imports is in the map", () => {
    const view = readFileSync("src/view/zono3d.ts", "utf8");
    const bare = [...view.matchAll(/from "([^".][^"]*)"/g)].map((m) => m[1])
        .filter((s) => !s.startsWith(".") && !s.startsWith("/"));
    const imports = JSON.parse(HTML.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
    for (const s of bare) {
        assert.ok(s in imports, `the view imports "${s}" and the page does not map it`);
    }
    assert.ok(bare.length >= 2, "expected three and at least one addon");
});

test("the mathematics does not import the renderer", () => {
    // geometry/ stays DOM-free and WebGL-free, so npm test never loads three.
    const geo = readFileSync("src/geometry/zono3.ts", "utf8");
    assert.ok(!/from "three/.test(geo), "geometry must not import three");
    assert.ok(!/document|window|canvas/i.test(geo.replace(/\/\*[\s\S]*?\*\//g, "")),
              "geometry must not touch the DOM");
});
