// The discrete substitution, against penrose-mosaic's own claims.
//
// These are the facts docs/wheels.md states; if this module has drifted from
// the mosaic's arithmetic, one of these fails.

import test from "node:test";
import assert from "node:assert/strict";
import { QUADRILLE, PHI, inflate, deflate, wheel, limitAngles, discreteDirections, frameOperator } from "../dist/wheels.js";

test("inflate and deflate are exact inverses on integer seeds", () => {
    let s = QUADRILLE;
    for (let g = 0; g < 12; g++) {
        assert.deepEqual(deflate(inflate(s)), s.map(([x, y]) => [x, y]), `generation ${g}`);
        s = inflate(s);
    }
    // and on a thousand random triples, as the mosaic verified over 20,000
    for (let i = 0; i < 1000; i++) {
        const r = () => Math.floor(Math.random() * 2001) - 1000;
        const v = [[r(), r()], [r(), r()], [r(), r()]];
        assert.deepEqual(deflate(inflate(v)), v);
    }
});

test("the growth ratio is phi squared, not phi", () => {
    let s = QUADRILLE;
    const size = (v) => Math.hypot(...v[1]);
    const ratios = [];
    for (let g = 0; g < 20; g++) { const before = size(s); s = inflate(s); ratios.push(size(s) / before); }
    const last = ratios.at(-1);
    assert.ok(Math.abs(last - PHI * PHI) < 1e-7, `ratio ${last}, phi^2 = ${PHI * PHI}`);
});

test("x0 is invariant and the wheel stays on the lattice", () => {
    let s = QUADRILLE;
    for (let g = 0; g < 10; g++) {
        assert.equal(s[0][0], 0, "Mx has eigenvalue 1: x0 never moves, and the first seed is on the vertical");
        for (const [x, y] of wheel(s)) { assert.equal(x, Math.round(x)); assert.equal(y, Math.round(y)); }
        s = inflate(s);
    }
});

test("the limiting slopes are (5-sqrt5)/4 and (5+3sqrt5)/4 — degree 2 over Q, and not 36 and 72 degrees", () => {
    const deg = limitAngles(QUADRILLE);
    const t1 = (5 - Math.sqrt(5)) / 4, t2 = (5 + 3 * Math.sqrt(5)) / 4;
    const a1 = Math.atan(t1) * 180 / Math.PI, a2 = Math.atan(t2) * 180 / Math.PI;
    assert.ok(Math.abs(a1 - 34.643814023) < 1e-8, `${a1}`);
    assert.ok(Math.abs(a2 - 71.137740275) < 1e-8, `${a2}`);
    // the iterated wheel lands on them, measured from the vertical
    assert.equal(deg[0], 0, "slot 0 is the mirror axis");
    assert.ok(Math.abs(deg[1] - a1) < 1e-9, `wheel index 1 at ${deg[1]}`);
    assert.ok(Math.abs(deg[2] - a2) < 1e-9, `wheel index 2 at ${deg[2]}`);
    // and they are NOT the Euclidean ones
    assert.ok(Math.abs(a1 - 36) > 1, "34.64 is not 36");
    assert.ok(Math.abs(a2 - 72) > 0.8, "71.14 is not 72");
    // mirror symmetric about the vertical, gaps 34.64, 36.50, 37.71, 36.50, 34.64
    const gaps = deg.slice(0, 6).map((a, i, all) => (i ? +(a - all[i - 1]).toFixed(4) : null)).slice(1);
    assert.deepEqual(gaps, [34.6438, 36.4939, 37.7245, 36.4939, 34.6438]);
    // and the whole wheel is mirror symmetric about the vertical
    for (const a of deg) assert.ok(deg.some((b) => Math.abs(((360 - a) % 360) - b) < 1e-9), `${a} has no mirror`);
});

test("five directions for a multigrid, unequally spaced and not a rotation of the pentagrid's", () => {
    const d = discreteDirections();
    assert.equal(d.length, 5);
    for (const [x, y] of d) assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-12, "unit");
    // the frame operator is NOT isotropic: sum v v^T is not (5/2) I, so the dual
    // map is a linear map rather than a similarity — the first thing E2 has to face
    const [xx, xy, yy] = frameOperator(d);
    assert.ok(Math.abs(xx - 2.5) > 0.05 || Math.abs(yy - 2.5) > 0.05,
              `the discrete frame should not be tight: ${xx}, ${xy}, ${yy}`);
    assert.ok(Math.abs(xy) < 1e-9, "but it stays diagonal: the mirror symmetry survives");
    assert.ok(Math.abs(xx + yy - 5) < 1e-9, "and the trace is still n");
});
