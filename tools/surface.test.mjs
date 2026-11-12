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
import { spawnSync } from "node:child_process";

/** Every name each entry promises, sorted. */
const SURFACE = {
    "gamma.js": [
        "COUPLES", "SINGULAR_PRESETS", "TRIPLES", "captureGamma",
        "classifySingularities", "createGammaSet", "describeSum", "isRegular",
        "noIntegerGamma", "penroseCondition", "restoreGamma", "singularTriples",
    ],
    "reticulum.js": [
        "addPresets", "bindRange", "bindSelects", "bindSliders", "bindToggles",
        "createFloatingPanel", "createGammaBank", "createLoupe", "createReticulum",
        "createSumStrip", "isFine", "lighten", "makeNotchGate",
        "mountFloatingReticulum", "mountGammaControls", "mountReticulum",
        "signedGamma", "snapStep", "snapStepWith", "wheelNotch", "wheelSteps",
    ],
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

// ── the stylesheets ───────────────────────────────────────────────

test("every class an instrument assigns is styled by the lib CSS it ships", () => {
    // The carve-out of LIBRARY.md Stage 3. A class the module sets and no
    // stylesheet mentions is an instrument that comes up bare in somebody
    // else's page and looks fine in ours, which is the one failure this
    // project cannot see from the inside.
    const css = ["reticulum", "panel", "dials", "loupe"]
        .map((f) => readFileSync(`lib/css/${f}.css`, "utf8")).join("\n");
    const mods = [
        "dist/ui/reticulum.js", "dist/ui/sumstrip.js", "dist/ui/dials.js",
        "dist/ui/floating.js", "dist/ui/loupe.js", "dist/ui/presets.js",
        "dist/view/controls.js",
    ];
    // Classes the page owns rather than the instrument: a consumer styles
    // these, or does not have them at all.
    const theirs = new Set([
        "controls", "fold-controls", "folded", "row", "note", "caption",
    ]);
    // And one that is deliberately unstyled: `ret-hit` is the invisible
    // rectangle that catches the pointer over the whole reticulum, with
    // `fill: transparent` set as an SVG attribute. It has never had a rule --
    // checked against the stylesheet before the carve-out -- and a rule is
    // exactly what it must not have. Its sibling `ss-hit` does have one, for
    // the cursor, which is why this is a name and not a pattern.
    theirs.add("ret-hit");
    const missing = new Set();
    for (const m of mods) {
        const src = readFileSync(m, "utf8");
        const names = [
            ...src.matchAll(/className\s*=\s*"([^"]+)"/g),
            ...src.matchAll(/class:\s*"([^"]+)"/g),
            ...src.matchAll(/setAttribute\("class",\s*"([^"]+)"/g),
        ].flatMap((x) => x[1].split(/\s+/)).filter(Boolean);
        for (const n of names) {
            if (theirs.has(n) || css.includes(`.${n}`)) continue;
            missing.add(`${n} (${m})`);
        }
    }
    assert.deepEqual([...missing], [], "classes with no rule in lib/css");
});

test("site.css imports the lib stylesheets rather than holding a copy", () => {
    // So our pages and a consumer's cannot drift. And the imports have to be
    // at the top: an @import is only honored before every other rule.
    const site = readFileSync("site.css", "utf8");
    const imports = [...site.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports, [
        "lib/css/reticulum.css", "lib/css/panel.css",
        "lib/css/dials.css", "lib/css/loupe.css",
    ]);
    const firstRule = site.search(/^[^@\s/][^{]*\{/m);
    const lastImport = site.lastIndexOf("@import");
    assert.ok(lastImport < firstRule,
              "an @import after the first rule is ignored by the browser");
    // And the instrument rules are gone from site.css, not duplicated.
    for (const cls of [".ret-axis", ".ss-bed", ".exp-box", ".float-bar", ".loupe"]) {
        assert.ok(!site.includes(cls), `${cls} is still in site.css as well`);
    }
});

test("lib/README.md's table of dist modules is current", () => {
    // Generated by tools/libdoc.mjs, because dist/ is built and gitignored:
    // nobody reading this repo or the deployed site can see what is in there.
    const out = spawnSync(process.execPath, ["tools/libdoc.mjs"], { encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr || out.stdout);
    const doc = readFileSync("lib/README.md", "utf8");
    for (const f of entries) assert.ok(doc.includes(`lib/${f}`), `${f} is not in the README`);
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
