// The facade is a promise, so it gets a test.
//
// `lib/` exists to pin a public surface that does not track where the files
// happen to sit -- a consumer importing `lib/wheels.js` depends on a name this
// project keeps, one importing `src/math/wheel.js` depends on the layout. That
// promise is only worth anything if something notices when it changes, which is
// what this file is for. Adding a name here is a deliberate act; losing one
// silently is the thing to catch.
//
// It also checks the rule in the other direction: `lib/` re-exports and does
// nothing else. A facade that computed something would be a second
// implementation of it.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Resolved against this file, not the working directory: the parent repo runs
// these tests from its own root, where `lib/` is a different project's.
const HERE = fileURLToPath(new URL("..", import.meta.url));

import * as wheels from "../lib/wheels.js";
import * as tiles from "../lib/tiles.js";
import * as patch from "../lib/patch.js";
import * as all from "../lib/discrete-directions.js";

const SURFACE = {
    "wheels.js": [
        "PENTA_UP", "PRESETS", "REAL_PENTA", "SEED_GENERATION", "TENTHS",
        "comb", "deflate", "eWheel", "halfDown", "halfUp", "inflate", "ladderTo",
        "m10", "pWheel", "pWheelFromFlake", "pair", "pentaflake", "pointsOf",
        "sWheel", "sharedEdge", "stride", "tWheel", "wheelFromPoints", "wheelsAt",
    ],
    "tiles.js": [
        "BOAT", "DIAMOND", "PENTA", "STAR", "THICK", "THIN", "anchorFor", "closes",
        "pentagon", "reverse", "rhombGroup", "rhombus", "starOutline",
        "starPolygon", "starTips", "turn", "vertices",
    ],
    "patch.js": ["SEED_TYPES", "WALK_OF", "expand", "isSeedType", "outlineOf"],
};

const names = (mod) => Object.keys(mod).sort();

test("each entry point exports exactly its stated surface", () => {
    assert.deepEqual(names(wheels), [...SURFACE["wheels.js"]].sort());
    assert.deepEqual(names(tiles), [...SURFACE["tiles.js"]].sort());
    assert.deepEqual(names(patch), [...SURFACE["patch.js"]].sort());
});

test("the all-in-one is the union of the three, with no collisions", () => {
    const union = [...new Set(Object.values(SURFACE).flat())].sort();
    assert.deepEqual(names(all), union);
    // A name exported by two entry points would be silently dropped by
    // `export *`, so the three have to be disjoint.
    const flat = Object.values(SURFACE).flat();
    assert.equal(flat.length, new Set(flat).size, "two entry points share a name");
});

test("the facade is the same function, not a copy of it", async () => {
    const wheel = await import("../src/math/wheel.js");
    const walk = await import("../src/math/walk.js");
    const patchSrc = await import("../src/math/patch.js");
    assert.equal(wheels.inflate, wheel.inflate);
    assert.equal(wheels.wheelsAt, wheel.wheelsAt);
    assert.equal(tiles.rhombus, walk.rhombus);
    assert.equal(patch.expand, patchSrc.expand);
    assert.equal(all.expand, patchSrc.expand);
});

test("lib/ re-exports and nothing else", () => {
    // No logic in a facade: every statement is an import, an export or a
    // comment. If a default or a convenience is ever wanted here, it should be
    // a deliberate change to this test too.
    for (const file of readdirSync(`${HERE}lib`)) {
        const body = readFileSync(`${HERE}lib/${file}`, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")       // block comments and JSDoc
            .replace(/^\s*\/\/.*$/gm, "")           // line comments
            .trim();
        for (const stmt of body.split(/;\s*/)) {
            if (!stmt.trim()) continue;
            assert.match(stmt.trim(), /^export\s|^import\s/,
                `lib/${file} does more than re-export: ${stmt.trim().slice(0, 60)}`);
        }
    }
});

test("the three entry points cover every module under src/math/", () => {
    // A module nobody can reach through `lib/` is either private on purpose or
    // forgotten. There is nothing private here yet, so the count should match.
    const modules = readdirSync(`${HERE}src/math`).filter((f) => f.endsWith(".js"));
    assert.deepEqual(modules.sort(), ["flake.js", "patch.js", "star.js", "walk.js", "wheel.js"]);
    const sources = new Set();
    for (const file of readdirSync(`${HERE}lib`)) {
        if (file === "discrete-directions.js") continue;
        for (const m of readFileSync(`${HERE}lib/${file}`, "utf8").matchAll(/\.\.\/src\/math\/([\w.]+)/g))
            sources.add(m[1]);
    }
    assert.deepEqual([...sources].sort(), modules.sort());
});
