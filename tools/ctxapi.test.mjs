// The context surface the layers use — PLAN section 5.99.
//
// Jake, 2026-10-24: "I am toying with the idea of rendering the canvases in
// method and split in svg alternativily. Not a replacement."
//
// The whole argument for a recording context is that the surface is small and
// closed: every layer draws through one CanvasRenderingContext2D and touches
// nothing else, so a shim with the same members emits SVG with no change to
// any layer's draw. This test is that claim, kept honest -- it fails when a
// layer reaches for something new, which is the moment the estimate in section
// 5.99 stops being true.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (p.endsWith(".ts")) out.push(p);
    }
    return out;
};

/** Every `ctx.x` / `tc.x` the source names. */
function members() {
    const seen = new Map();
    for (const file of walk("src")) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(/\b(?:ctx|tc)\.([a-zA-Z]+)/g)) {
            seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
        }
    }
    return seen;
}

// What section 5.99 counted, by what a recording context would have to do
// with each.
const MAPS_DIRECTLY = [
    "beginPath", "lineTo", "moveTo", "closePath", "arc", "quadraticCurveTo",
    "fillStyle", "stroke", "fill", "strokeStyle", "lineWidth", "globalAlpha",
    "lineJoin", "lineCap", "setLineDash", "fillText", "textAlign",
    "textBaseline", "font", "save", "restore", "clip", "fillRect", "clearRect",
];
const NEEDS_A_DECISION = [
    "createLinearGradient",      // one <linearGradient> per call, 658 / 1974
    "createRadialGradient",
    "measureText",               // no layout in a recorder
    "createImageData",           // drawKRegions is a true per-pixel raster
    "putImageData",
];

test("the layers use a closed set of context members, and section 5.99 lists them", () => {
    const used = members();
    const known = new Set([...MAPS_DIRECTLY, ...NEEDS_A_DECISION]);
    const surprises = [...used.keys()].filter((m) => !known.has(m)).sort();
    assert.deepEqual(surprises, [],
                     "a layer reached for context members PLAN 5.99 does not "
                     + `account for: ${surprises.join(", ")}. Either the SVG `
                     + "estimate needs revisiting or the list needs extending.");
    assert.equal(used.size, known.size,
                 `5.99 lists ${known.size} members, the source uses ${used.size}`);
});

test("the four awkward members are exactly where 5.99 says they are", () => {
    // Each of these is a paragraph in 5.99, and the paragraph is only worth
    // anything if the call site has not moved.
    const where = (needle) => walk("src")
        .filter((f) => readFileSync(f, "utf8").includes(needle))
        .sort();
    assert.deepEqual(where("putImageData"), ["src/view/pentagrid.ts"],
                     "the raster layer moved");
    assert.deepEqual(where("createImageData"), ["src/view/pentagrid.ts"]);
    // measureText: the loupe and the view, for label backing boxes only.
    assert.deepEqual(where("measureText"),
                     ["src/ui/loupe.ts", "src/view/pentagrid.ts"]);
    // The gradients are the height ramp and the pool balls.
    assert.deepEqual(where("createRadialGradient"), ["src/view/growth.ts"]);
    assert.ok(where("createLinearGradient").includes("src/view/pentagrid.ts"));
});

test("no layer reaches past its context into the DOM", () => {
    // The other half of the argument: a recording context is enough only if
    // the drawing code has no other output. `canvas` and `document` belong to
    // the stack and the panel, not to a draw.
    const src = readFileSync("src/view/pentagrid.ts", "utf8");
    // Inside a draw callback, the only sink is the context it was handed.
    for (const m of src.matchAll(/draw:\s*\(\{([^}]*)\}\)\s*=>\s*\{/g)) {
        const args = m[1];
        assert.ok(/\bctx\b/.test(args),
                  `a layer's draw takes ${args.trim()} and no ctx`);
    }
});
