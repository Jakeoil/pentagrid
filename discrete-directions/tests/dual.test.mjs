// The dual map on the discrete directions — the one test that needs the
// pentagrid.
//
// This project consumes the pentagrid the way a sibling checkout would, through
// `lib/`: `collectRhombs` comes from `lib/grow.js`, exactly as `src/ui/dual.js`
// takes `createPentagrid` from `lib/pentagrid.js`. Nothing here reaches into
// `../../src/` or `../../dist/`.
//
// Which means this file, alone among the tests here, needs the pentagrid to
// have been BUILT. `lib/` re-exports `../dist/`, and `dist/` is generated. So
// it skips itself rather than failing when it is not there, and says so --
// `npm run build` in the parent is what makes it run.
//
// Ported from pentagrid's `tools/discrete.test.mjs` when `src/discrete/` was
// deleted. The wheel half of that file is `e2.test.mjs`.

import test from "node:test";
import assert from "node:assert/strict";

import { WHEELS, limitSeed, pentagon } from "../src/math/e2.js";

/** @type {{ collectRhombs: Function } | null} */
let grow = null;
try {
    grow = await import("../../lib/grow.js");
} catch {
    // the parent has not been built; the test below skips
}

test("the discrete dual: six rhomb shapes, a frame that is diagonal but not isotropic, and no height function", (t) => {
    if (!grow) return t.skip("the pentagrid is not built — run npm run build there");
    const { collectRhombs } = grow;
    const pts = pentagon(limitSeed(WHEELS.P));
    const mags = pts.map((p) => Math.hypot(...p));
    const order = pts.map((p, i) => ({ p, i, a: Math.atan2(p[1], p[0]) })).sort((u, w) => u.a - w.a);
    const dirs = order.map(({ p, i }) => [p[0] / mags[i], p[1] / mags[i]]);
    const lens = order.map(({ i }) => mags[i] / Math.min(...mags));

    // Six shapes, not two and not ten: the mirror symmetry pairs four of the
    // ten family pairs off. The pentagrid gives 72 and 144.
    const angles = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
        let a = Math.abs(Math.atan2(dirs[i][1], dirs[i][0]) - Math.atan2(dirs[j][1], dirs[j][0])) * 180 / Math.PI;
        a %= 180; if (a > 90) a = 180 - a;          // fold BEFORE comparing, or a reversed pair reads negative
        angles.push(+a.toFixed(4));
    }
    assert.deepEqual([...new Set(angles)].sort((a, b) => a - b),
                     [34.6438, 36.4939, 37.7245, 69.2876, 71.1377, 74.2184]);
    // and the tiles really do take those angles, folded the same way
    const pg = { n: 5, directions: dirs, gamma: [0.2, 0.2, 0.2, 0.2, 0.2] };
    const R = collectRhombs(pg, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, { gain: 2.5 });
    const seen = new Set();
    for (const r of R) {
        const u = [r.vertices[1][0] - r.vertices[0][0], r.vertices[1][1] - r.vertices[0][1]];
        const w = [r.vertices[3][0] - r.vertices[0][0], r.vertices[3][1] - r.vertices[0][1]];
        let a = Math.abs(Math.atan2(u[1], u[0]) - Math.atan2(w[1], w[0])) * 180 / Math.PI;
        a = Math.abs(a) % 180; if (a > 90) a = 180 - a;
        seen.add(+a.toFixed(4));
    }
    assert.equal(seen.size, 6, `tiles show ${[...seen].sort((a, b) => a - b)}`);

    // The frame: diagonal (the mirror survives) but not isotropic, so the dual
    // map has two gains and shears. The pentagrid's is exactly (5/2) I.
    let xx = 0, xy = 0, yy = 0;
    for (const [x, y] of dirs) { xx += x * x; xy += x * y; yy += y * y; }
    assert.ok(Math.abs(xy) < 1e-9, "diagonal");
    assert.ok(Math.abs(xx + yy - 5) < 1e-9, "trace is still n");
    assert.ok(Math.abs(xx - yy) > 0.1, `not isotropic: ${xx} vs ${yy}`);

    // The height function ALMOST survives. Sum v_j over the five directions of
    // the wheel is (0, 0.00118): zero along the mirror by symmetry, and only
    // just off it the other way — so Sum K drifts rather than being a height,
    // and it drifts slowly. (Taking all five normals in the upper half plane
    // instead gives (0, 3.29), but that is a choice of representative and says
    // nothing: each direction is a +- pair.)
    const sum = dirs.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    assert.ok(Math.abs(sum[0]) < 1e-9, "zero across the mirror, exactly");
    assert.ok(Math.abs(sum[1]) > 1e-4 && Math.abs(sum[1]) < 1e-2, `sum v = ${sum}`);

    // The two switches are independent: spacing scales the normals, edges the
    // dual's vectors, and only the second changes the tiles' side lengths.
    const normals = dirs.map(([x, y], j) => [x / lens[j], y / lens[j]]);
    const edges = dirs.map(([x, y], j) => [x * lens[j], y * lens[j]]);
    const sides = (P) => {
        const S = new Set();
        for (const r of collectRhombs(P, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, { gain: 2.5 })) {
            const a = r.vertices[1], b = r.vertices[0];
            S.add(+Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(4));
        }
        return S;
    };
    // With no `edges` supplied the dual builds from the normals themselves, so
    // changing the spacing changes the edges too — that is exactly the
    // conflation the page's two switches undo, and why `edges` had to become a
    // field of its own.
    assert.ok(sides({ ...pg, directions: normals }).size > 1, "one array does double duty");
    assert.equal(sides({ ...pg, directions: normals, edges: dirs }).size, 1,
                 "with edges given, spacing alone leaves unit edges");
    assert.ok(sides({ ...pg, edges }).size > 1, "wheel edges give unequal sides");
});
