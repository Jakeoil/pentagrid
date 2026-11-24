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
import * as e2 from "../lib/e2.js";
import * as all from "../lib/discrete-directions.js";
import * as pentadiculum from "../lib/pentadiculum.js";

const SURFACE = {
    "wheels.js": [
        "ASYMMETRIC", "EVEN_PENTAD", "HANDLE_ORIGIN", "PENTA_UP", "PRESETS",
        "REAL_PENTA",
        "SEEDS", "SEED_GENERATION", "TENTHS",
        "centered", "centroidOf", "checkSeed", "comb", "deflate", "eWheel",
        "halfDown", "halfUp", "inflate", "integralCentroid",
        "ladderTo", "m10", "moveHandle", "nearestOrigin", "originFence",
        "pWheel", "pWheelFromFlake", "pair", "pentaflake", "pointsOf", "sWheel",
        "seedOf", "sharedEdge", "spokeSum", "spokesOf", "stride", "tWheel",
        "wheelFromPoints", "wheelOf", "wheelsAt", "wheelsOf",
    ],
    "tiles.js": [
        "BOAT", "DIAMOND", "PENTA", "STAR", "THICK", "THIN", "anchorFor", "closes",
        "pentagon", "reverse", "rhombGroup", "rhombus", "starOutline",
        "starPolygon", "starTips", "turn", "vertices",
    ],
    "patch.js": ["SEED_TYPES", "WALK_OF", "expand", "isSeedType", "outlineOf"],
    // The UI half: the Pentadiculum, the drawing primitives it is built on, and
    // Jake's numeral. It is the one entry that needs a DOM, which is why it is
    // not in the all-in-one -- see the test below.
    "pentadiculum.js": [
        "EDGE_INK", "EDGE_SHRINK", "FIB_CELLS", "GRID_FIFTHS", "GRID_LEVELS",
        "GRID_OVER", "GRID_OVER_ALPHA", "GRID_OVER_FIFTHS",
        "HOT", "INK", "PD_ORIGIN", "SNAPS", "TAU", "TONE",
        "centerMoves", "compact", "createPentadiculum", "drawNumeral", "fibCell",
        "fitStep", "gridBoxes", "gridLines", "mountFloatingPentadiculum",
        "mountPentadiculum",
        "numHTML", "numeralWidth", "paper", "poly", "ptHTML", "setBox",
        "snapForSeed", "snapStep", "snapped",
    ],
    "e2.js": [
        "PHI", "QUADRILLE", "SEED_GENERATION", "WHEELS", "deflate",
        "discreteDirections", "frameOperator", "generation", "halfStep",
        "inflate", "limitAngles", "limitSeed", "pentagon", "pentagonDown",
        "wheel", "wheelAt",
    ],
};

/**
 * The entry points the all-in-one gathers. `e2.js` is left out on purpose: it
 * is the other representation of the same geometry, and `inflate`, `deflate`
 * and `pentagon` mean different things in it. One namespace holding both would
 * put two different functions behind one name.
 */
const GATHERED = ["wheels.js", "tiles.js", "patch.js"];

const names = (mod) => Object.keys(mod).sort();

test("each entry point exports exactly its stated surface", () => {
    assert.deepEqual(names(wheels), [...SURFACE["wheels.js"]].sort());
    assert.deepEqual(names(tiles), [...SURFACE["tiles.js"]].sort());
    assert.deepEqual(names(patch), [...SURFACE["patch.js"]].sort());
    assert.deepEqual(names(e2), [...SURFACE["e2.js"]].sort());
    assert.deepEqual(names(pentadiculum), [...SURFACE["pentadiculum.js"]].sort());
});

test("every entry point has a golden surface, and every golden surface an entry", () => {
    const entries = entryFiles().sort();
    assert.deepEqual(entries, [...Object.keys(SURFACE), "discrete-directions.js"].sort(),
        "an entry was added or removed without its golden list");
});

test("the all-in-one is the union of the three it gathers, with no collisions", () => {
    const gathered = GATHERED.flatMap((f) => SURFACE[f]);
    assert.deepEqual(names(all), [...new Set(gathered)].sort());
    // A name exported by two of them would be silently dropped by `export *`,
    // so the three have to be disjoint.
    assert.equal(gathered.length, new Set(gathered).size, "two gathered entries share a name");
});

test("e2 is left out of the all-in-one because it would collide", () => {
    // Not a gap -- the reason the entry is separate. If these ever stop
    // colliding, the two representations have converged and that is worth
    // knowing; until then, importing both means importing them by name.
    const gathered = new Set(GATHERED.flatMap((f) => SURFACE[f]));
    const clash = SURFACE["e2.js"].filter((n) => gathered.has(n));
    assert.deepEqual(clash.sort(), ["SEED_GENERATION", "deflate", "inflate", "pentagon"]);
    // Three of the four are different functions wearing one name, which is the
    // whole reason for the separate entry.
    for (const n of ["deflate", "inflate", "pentagon"])
        assert.notEqual(e2[n], all[n], `${n} is the same function after all`);
    // The fourth is not a conflict at all: both projects count the stored seed
    // as generation 1, and penrose-mosaic is where both got it.
    assert.equal(e2.SEED_GENERATION, all.SEED_GENERATION);
    assert.equal(e2.SEED_GENERATION, 1);
});

test("the UI entry is left out of the all-in-one, because it needs a DOM", () => {
    // `lib/discrete-directions.js` is the one import for a consumer who wants
    // the mathematics, and the mathematics runs in node. Gathering the
    // Pentadiculum into it would make `import ... from "discrete-directions"`
    // reach for `document`, which is the sort of thing that is discovered in a
    // test runner. It is imported by name instead.
    const gathered = new Set(GATHERED.flatMap((f) => SURFACE[f]));
    for (const n of SURFACE["pentadiculum.js"])
        assert.ok(!gathered.has(n), `${n} is in the all-in-one after all`);
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
    const pdSrc = await import("../src/ui/pentadiculum.js");
    assert.equal(pentadiculum.createPentadiculum, pdSrc.createPentadiculum);
});

/** The entry points: `lib/css/` sits beside them and is not one. */
const entryFiles = () => readdirSync(`${HERE}lib`).filter((f) => f.endsWith(".js"));

test("the stylesheet the mounts need ships beside the entry it belongs to", () => {
    // `lib/pentadiculum.js` says the CSS is not optional, so it has to be here
    // to link. The bare `createPentadiculum` needs none of it.
    assert.ok(readdirSync(`${HERE}lib/css`).includes("pentadiculum.css"));
});

test("lib/ re-exports and nothing else", () => {
    // No logic in a facade: every statement is an import, an export or a
    // comment. If a default or a convenience is ever wanted here, it should be
    // a deliberate change to this test too.
    for (const file of entryFiles()) {
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

test("the math entry points cover every module under src/math/", () => {
    // A module nobody can reach through `lib/` is either private on purpose or
    // forgotten. There is nothing private here yet, so the count should match.
    const modules = readdirSync(`${HERE}src/math`).filter((f) => f.endsWith(".js"));
    assert.deepEqual(modules.sort(),
        ["e2.js", "flake.js", "patch.js", "seed.js", "star.js", "walk.js",
         "wheel.js"]);
    const sources = new Set();
    for (const file of entryFiles()) {
        if (file === "discrete-directions.js") continue;
        for (const m of readFileSync(`${HERE}lib/${file}`, "utf8").matchAll(/\.\.\/src\/math\/([\w.]+)/g))
            sources.add(m[1]);
    }
    assert.deepEqual([...sources].sort(), modules.sort());
});
