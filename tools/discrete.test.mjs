// The discrete substitution, against penrose-mosaic's own claims.
//
// These are the facts docs/wheels.md states; if this module has drifted from
// the mosaic's arithmetic, one of these fails.

import test from "node:test";
import assert from "node:assert/strict";
import { QUADRILLE, PHI, inflate, deflate, halfStep, generation, wheel, pentagon, limitAngles, discreteDirections, frameOperator } from "../dist/discrete/wheels.js";

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

test("the half step: x is Fibonacci exactly, y up to the alternating +-2, and twice is one generation", () => {
    // The stored wheels hold only even powers of phi, so their x-components are
    // ALTERNATE Fibonacci numbers. Interleave the half steps and nothing is
    // missing: 3, 5, 8, 13, 21, 34, 55, 89.
    const xs = [];
    let g = QUADRILLE;
    for (let k = 0; k < 6; k++) { xs.push(g[1][0]); xs.push(halfStep(g)[1][0]); g = inflate(g); }
    assert.deepEqual(xs, [3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]);
    const fib = [1, 1];
    while (fib.length < 20) fib.push(fib.at(-1) + fib.at(-2));
    assert.ok(xs.every((x, i) => x === fib[i + 3]), "and they are the Fibonacci numbers, in order");

    // twice the half step is one generation on x exactly; on y it differs by the
    // alternating (0, +-2) — My's eigenvalue -1, the mosaic's "+-2 correction"
    g = QUADRILLE;
    for (let k = 0; k < 6; k++) {
        const twice = halfStep(halfStep(g)), once = inflate(g);
        assert.deepEqual(twice.map(([x]) => x), once.map(([x]) => x), `generation ${k}: x must agree`);
        const dy = twice.map(([, y], i) => y - once[i][1]);
        const s = k % 2 === 0 ? 2 : -2;
        assert.deepEqual(dy, [s, -s, s], `generation ${k}: the alternating correction`);
        g = once;
    }
});

test("below zero: one positive half generation, then psi land", () => {
    // Jake: "there is a funky half gen below gen 0 which is positive. After that
    // you get into psi land." Deflating, the phi^2 part runs out and the
    // conjugate — psi = -1/phi, the other root of lambda^2 - 3 lambda + 1 —
    // takes over, which shows up as coordinates going negative.
    const g0 = QUADRILLE;
    const gm1 = deflate(g0);
    assert.deepEqual(gm1.map(([x, y]) => [x, y]), [[0, 2], [1, 2], [2, 0]], "gen -1, still positive");
    const halfBelow = halfStep(gm1);
    assert.deepEqual(halfBelow.map(([x, y]) => [x, y]), [[0, 4], [2, 2], [3, 2]], "the half below gen 0: positive");
    assert.ok(halfBelow.flat().every((v) => v >= 0), "every coordinate");
    const gm2 = deflate(gm1);
    assert.deepEqual(gm2.map(([x, y]) => [x, y]), [[0, 2], [0, 0], [1, 0]], "gen -2 is degenerate: slot 1 is the origin");
    const gm3 = deflate(gm2);
    assert.ok(gm3.flat().some((v) => v < 0), "gen -3 and below: psi land");
});

test("the figure's ladder: even slider values are whole generations, odd ones the halves", () => {
    // What the index figure indexes. Slider v -> generation v/2, half steps at odd v.
    const at = (v) => (v % 2 === 0 ? generation(QUADRILLE, v / 2) : halfStep(generation(QUADRILLE, (v - 1) / 2)));
    assert.deepEqual(at(0).map(([x]) => x), [0, 3, 5]);
    assert.deepEqual(at(1).map(([x]) => x), [0, 5, 8]);
    assert.deepEqual(at(2).map(([x]) => x), [0, 8, 13]);
    assert.deepEqual(at(3).map(([x]) => x), [0, 13, 21]);
    // every rung is on the lattice
    for (let v = 0; v < 10; v++) for (const [x, y] of wheel(at(v))) {
        assert.equal(x, Math.round(x)); assert.equal(y, Math.round(y));
    }
});

test("the pentagon is the wheel's up set, and its corners are lattice points at every rung", () => {
    const p = pentagon(QUADRILLE);
    assert.equal(p.length, 5);
    assert.deepEqual(p.map(([x, y]) => [x, y]), [[0, 6], [5, 2], [3, -4], [-3, -4], [-5, 2]]);
    // five distinct directions, spread over the whole turn, mirror symmetric
    const ang = p.map(([x, y]) => (Math.atan2(y, x) * 180 / Math.PI + 360) % 360).sort((a, b) => a - b);
    assert.equal(new Set(ang.map((a) => a.toFixed(6))).size, 5);
    assert.ok(ang.at(-1) - ang[0] > 180, "spread over the turn, not a half");
    for (let v = 0; v < 10; v++) {
        const seed = v % 2 === 0 ? generation(QUADRILLE, v / 2) : halfStep(generation(QUADRILLE, (v - 1) / 2));
        for (const [x, y] of pentagon(seed)) { assert.equal(x, Math.round(x)); assert.equal(y, Math.round(y)); }
    }
    // the real pentagon it is compared against is NOT on the lattice, except the top
    const R = Math.hypot(...pentagon(QUADRILLE)[0]);
    const real = [...Array(5).keys()].map((k) => {
        const a = (90 - k * 72) * Math.PI / 180;
        return [R * Math.cos(a), R * Math.sin(a)];
    });
    const onLattice = real.filter(([x, y]) => Math.abs(x - Math.round(x)) < 1e-9 && Math.abs(y - Math.round(y)) < 1e-9);
    assert.equal(onLattice.length, 1, "only the top corner lands on a lattice point");
});
