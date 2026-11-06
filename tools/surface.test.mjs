// The public surface: what `lib/` promises.
//
// LIBRARY.md §7, Stage 0's test, which is this repo's answer to Jake's "add
// tests that capture its current behavior before refactoring it." The behavior
// is already pinned -- 720-odd tests do that. What nothing pinned is the
// SURFACE: which names a consumer can rely on. A facade whose exports can
// change silently is not a facade, it is a second set of paths.
//
// So: a golden list per entry. Adding an export is a one-line edit here;
// renaming or removing one fails, which is the signal a consumer needs and the
// only thing `lib/` exists to give them.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/** Every name each entry promises, sorted. */
const SURFACE = {
    "grow.js": [
        "RISE", "ROOF_EDGE", "collectRhombs", "crossingLerp", "faceNormal",
        "flatLocal", "generator", "liftLocal", "makeDirections", "outlineCorner",
        "projectToScreen", "registrationGain", "standHeight", "tileCorner",
        "vertexHeight", "vertexIndex",
    ],
};

const entries = readdirSync("lib").filter((f) => f.endsWith(".js")).sort();

test("every entry in lib/ has a golden surface, and keeps to it", async () => {
    assert.deepEqual(entries, Object.keys(SURFACE).sort(),
                     "an entry was added or removed without its golden list");
    for (const f of entries) {
        const mod = await import(`../lib/${f}`);
        assert.deepEqual(Object.keys(mod).sort(), SURFACE[f].slice().sort(),
                         `lib/${f}'s exports moved`);
    }
});

test("an entry re-exports only this repo's own dist", () => {
    // The rule from LIBRARY.md §5: a facade re-exports only its own repo's
    // code, never another project's lib/. That is what keeps peer facades from
    // becoming a cycle. And never ../src/, which is TypeScript a browser
    // cannot load.
    for (const f of entries) {
        // Comments first: the headers carry example imports, including the
        // published URL, and those are documentation rather than edges.
        const src = readFileSync(`lib/${f}`, "utf8")
            .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
        const froms = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
        assert.ok(froms.length > 0, `lib/${f} re-exports nothing`);
        for (const spec of froms) {
            assert.match(spec, /^\.\.\/dist\/[\w./-]+\.js$/,
                         `lib/${f} imports ${spec}`);
        }
    }
});

test("every entry has types beside it, declaring the same names", () => {
    // A sibling .d.ts is what lets a TypeScript consumer import the .js path
    // directly, with no paths mapping. Hand-written, so it can drift -- hence
    // this.
    // Every identifier inside an `export { ... }` block, however it is wrapped.
    const names = (src) => [...src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)]
        .flatMap((m) => m[1].split(",").map((x) => x.trim()).filter(Boolean));
    for (const f of entries) {
        const dts = readFileSync(`lib/${f.replace(/\.js$/, ".d.ts")}`, "utf8");
        const declared = new Set(names(dts));
        for (const n of SURFACE[f]) {
            assert.ok(declared.has(n), `lib/${f}: ${n} has no declaration`);
        }
    }
});

test("the entries say what they are, and where dist comes from", () => {
    // These files are the first thing an outside reader meets, and the one
    // thing they cannot guess is that `dist/` is built rather than committed.
    for (const f of entries) {
        const src = readFileSync(`lib/${f}`, "utf8");
        assert.ok(src.length > 400, `lib/${f} has no header worth reading`);
        assert.match(src, /jakeoil\.github\.io\/pentagrid\/lib\//,
                     `lib/${f} does not show the published import`);
        assert.match(src, /npm run build|not committed/,
                     `lib/${f} does not say where dist/ comes from`);
    }
});
