// The wheel, checked against penrose-mosaic.
//
// penrose-mosaic is the ORACLE for the symmetric case: its `penta()` and
// `star()` do what this does, `deca()` composes them, and all three deflate by
// φ². Its wheels are stored tables found by hand, so it answers only for
// symmetric pentagons — which is the whole of its remit, and why it is left
// alone rather than upgraded. See PLAN.md §1.
//
// The seeds below are transcribed from that project's `wheels.js`. They are the
// fixture, not the implementation: nothing in `src/math/` imports them, and this
// file is what would catch a derivation drifting away from the hand-built truth.

import test from "node:test";
import assert from "node:assert/strict";

import {
    PENTA_UP, PRESETS, REAL_PENTA, comb, deflate, eWheel, halfUp, inflate,
    ladderTo, m10, pWheel, pair, pointsOf, sWheel, stride, tWheel,
    wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";

// ── penrose-mosaic, transcribed: wheels.js, index 1 (the seed) ────────────
const SEEDS = {
    p: [[0, -6], [3, -4], [5, -2]],
    s: [[0, -5], [3, -5], [5, -1]],
    t: [[0, -8], [5, -8], [8, -2]],
    d: [[0, -3], [2, -3], [3, -1]],
};
const GEN0 = { d: [[0, -1], [1, -1], [1, -1]], p: [[0, -2], [1, -2], [2, 0]] };
const GEN2 = { p: [[0, -14], [8, -12], [13, -4]], t: [[0, -24], [13, -18], [21, -8]] };

const PHI = (1 + Math.sqrt(5)) / 2;
const show = (w) => w.map((q) => `(${q[0]},${q[1]})`).join(" ");
const eq = (a, b) =>
    a.length === b.length && a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1]);

/** Two wheels equal within a relative tolerance — the real preset is irrational. */
const close = (a, b, tol = 1e-9) => {
    const scale = Math.max(1, ...a.map((v) => Math.hypot(v[0], v[1])));
    return a.length === b.length
        && a.every((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1]) <= tol * scale);
};

const SKEW = [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]];

// ── the four wheels ───────────────────────────────────────────────────────
test("the four wheels come out of the five points", () => {
    const w = wheelsAt(PENTA_UP, 1);
    for (const name of ["d", "p", "s", "t"])
        assert.equal(show(w[name].slice(0, 3)), show(SEEDS[name]), name);
});

test("and at the generations above and below the seed", () => {
    const below = wheelsAt(PENTA_UP, 0), above = wheelsAt(PENTA_UP, 2);
    assert.equal(show(below.d.slice(0, 3)), show(GEN0.d));
    assert.equal(show(below.p.slice(0, 3)), show(GEN0.p));
    assert.equal(show(above.p.slice(0, 3)), show(GEN2.p));
    assert.equal(show(above.t.slice(0, 3)), show(GEN2.t));
});

// ── the operator family ───────────────────────────────────────────────────
test("the stride family is one operator", () => {
    const d = wheelFromPoints(PENTA_UP);
    assert.ok(eq(stride(d, 1), inflate(d)));
    assert.ok(eq(stride(d, 2), sWheel(d)));
    assert.ok(eq(stride(d, 3), deflate(d)));
    assert.ok(eq(inflate(deflate(d)), d), "stride 1 and 3 are inverse");
    assert.ok(eq(deflate(inflate(d)), d), "in both orders");
});

test("stride k scales by 1 + 2cos(36k), pair k by 2cos(36k)", () => {
    let far = wheelFromPoints(PENTA_UP);
    for (let i = 0; i < 10; i++) far = inflate(far);
    const mag = (w) => Math.hypot(...w[1]);
    for (let k = 1; k <= 4; k++) {
        const want3 = Math.abs(1 + 2 * Math.cos(k * 36 * Math.PI / 180));
        const want2 = Math.abs(2 * Math.cos(k * 36 * Math.PI / 180));
        assert.ok(Math.abs(mag(stride(far, k)) / mag(far) - want3) < 1e-3, `stride ${k}`);
        assert.ok(Math.abs(mag(pair(far, k)) / mag(far) - want2) < 1e-3, `pair ${k}`);
    }
});

test("T = S + D, and the next D = D + P", () => {
    let d = wheelFromPoints(PENTA_UP);
    for (let g = 1; g <= 8; g++) {
        const s = sWheel(d), p = pWheel(d);
        assert.ok(eq(tWheel(d), s.map((v, i) => [v[0] + d[i][0], v[1] + d[i][1]])), `T ${g}`);
        assert.ok(eq(inflate(d), d.map((v, i) => [v[0] + p[i][0], v[1] + p[i][1]])), `D' ${g}`);
        d = inflate(d);
    }
});

test("T and the next D are different wheels on the same rung", () => {
    const d = wheelFromPoints(PENTA_UP);
    assert.ok(!eq(tWheel(d), inflate(d)));
    const gap = tWheel(d).map((v, i) => [v[0] - inflate(d)[i][0], v[1] - inflate(d)[i][1]]);
    assert.deepEqual(gap.slice(0, 3), [[0, 1], [0, -1], [0, 1]]);
});

test("every operator commutes with rotation", () => {
    const d = wheelFromPoints(PENTA_UP);
    const rot = (w, n) => w.map((_, t) => w[m10(t - 2 * n)]);
    for (const op of [inflate, deflate, pWheel, sWheel, tWheel, eWheel])
        for (let n = 1; n < 5; n++)
            assert.ok(eq(op(rot(d, n)), rot(op(d), n)), `${op.name} at ${n}`);
});

test("the edge wheel is the (4,0) (3,2) (1,4) basis", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    assert.deepEqual(e.slice(0, 3).map((p) => [...p]), [[4, 0], [3, 2], [1, 4]]);
    const lengths = new Set(e.map((p) => Math.hypot(p[0], p[1]).toFixed(6)));
    assert.deepEqual([...lengths].sort(), ["3.605551", "4.000000", "4.123106"]);
});

// ── the two ladders ───────────────────────────────────────────────────────
test("the half rung above D is P, exactly", () => {
    for (const pts of [PENTA_UP, SKEW])
        for (const g of [0, 1, 2, 3])
            assert.ok(eq(wheelsAt(pts, g + 0.5).d, wheelsAt(pts, g).p), `generation ${g}`);
});

test("whole rungs are unchanged by the half-rung index", () => {
    for (let g = 0; g <= 5; g++) {
        let d = wheelFromPoints(PENTA_UP);
        for (let i = 1; i < g; i++) d = inflate(d);
        for (let i = 1; i > g; i--) d = deflate(d);
        assert.ok(eq(wheelsAt(PENTA_UP, g).d, d), `generation ${g} moved`);
    }
});

test("odd and even are two ladders: halfUp twice is not inflate", () => {
    // penta() and star() deflate by phi^2, and a seed for the odd steps comes
    // from the original seed by them -- so the odd rungs are a ladder of their
    // own, not fractions of the even one. The alternating (0, +-1) is the offset
    // BETWEEN the two, which is why x agrees and only y carries it. PLAN.md 2a.
    const d = wheelFromPoints(PENTA_UP);
    assert.ok(!eq(halfUp(halfUp(d)), inflate(d)));
    const gap = halfUp(halfUp(d)).map((v, i) =>
        [v[0] - inflate(d)[i][0], v[1] - inflate(d)[i][1]]);
    assert.ok(gap.every(([x]) => x === 0), "the offset is in y alone");
    assert.deepEqual(gap.map(([, y]) => y), [1, -1, 1, -1, 1, -1, 1, -1, 1, -1]);
});

test("but on a REGULAR pentagon the two ladders coincide", () => {
    // 2cos72 + 2 = 1 + 2cos36 = phi^2, so halfUp^2 and inflate agree exactly on
    // a regular wheel. The split belongs to the discrete geometry, not to the
    // operators.
    const d = wheelFromPoints(REAL_PENTA);
    assert.ok(close(halfUp(halfUp(d)), inflate(d)));
    assert.ok(Math.abs((2 * Math.cos(2 * Math.PI / 5) + 2)
        - (1 + 2 * Math.cos(Math.PI / 5))) < 1e-12);
});

test("the ladder runs negative, exactly, into psi land", () => {
    const half = wheelsAt(PENTA_UP, 0.5).d;
    assert.ok(half.slice(0, 3).every(([x, y]) => x >= 0 && y <= 0),
        `generation 1/2 should still read as a figure: ${show(half.slice(0, 3))}`);
    const hinge = wheelsAt(PENTA_UP, -0.5).d;
    assert.ok(hinge.slice(0, 3).some(([x, y]) => x === 0 && y === 0),
        `generation -1/2 should put a seed on the origin: ${show(hinge.slice(0, 3))}`);
    for (const g of [-3, -2.5, -2, -1.5, -1])
        for (const v of wheelsAt(PENTA_UP, g).d)
            assert.ok(Number.isInteger(v[0]) && Number.isInteger(v[1]),
                `generation ${g} left the lattice`);
});

test("x is Fibonacci at every rung; y only on the whole ones", () => {
    const rungs = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const xs = rungs.map((r) => wheelsAt(PENTA_UP, r).d[1][0]);
    assert.deepEqual(xs, [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
    const fib = (a) => a.every((v, i) => i < 2 || v === a[i - 1] + a[i - 2]);
    assert.ok(fib(xs), "x should be Fibonacci");
    assert.ok(!fib(rungs.map((r) => wheelsAt(PENTA_UP, r).d[1][1])), "y should not be");
});

// ── the real preset ───────────────────────────────────────────────────────
test("the real preset is regular, side 4, centered on the origin", () => {
    const side = (ps, i) =>
        Math.hypot(ps[(i + 1) % 5][0] - ps[i][0], ps[(i + 1) % 5][1] - ps[i][1]);
    const r = 4 / (2 * Math.sin(Math.PI / 5));
    for (let i = 0; i < 5; i++) assert.ok(Math.abs(side(REAL_PENTA, i) - 4) < 1e-12);
    for (const p of REAL_PENTA) assert.ok(Math.abs(Math.hypot(p[0], p[1]) - r) < 1e-12);
    assert.deepEqual(PRESETS.real, REAL_PENTA);
    assert.deepEqual(PRESETS.quadrille, PENTA_UP);
});

test("the real pentagon has one edge length, the quadrille three", () => {
    const lengths = (pts) =>
        new Set(eWheel(wheelFromPoints(pts)).map((p) => Math.hypot(p[0], p[1]).toFixed(6)));
    assert.deepEqual([...lengths(REAL_PENTA)], ["4.000000"]);
    assert.equal(lengths(PENTA_UP).size, 3);
});

// ── the plumbing ──────────────────────────────────────────────────────────
test("wheelFromPoints and pointsOf are inverse, and five is required", () => {
    for (const pts of [PENTA_UP, REAL_PENTA, SKEW])
        assert.ok(close(pointsOf(wheelFromPoints(pts)), pts));
    assert.throws(() => wheelFromPoints([[0, 0], [1, 1], [2, 2], [3, 3]]), /five points/);
});

test("comb is a polynomial in the shift, so order does not matter", () => {
    const d = wheelFromPoints(SKEW);
    assert.ok(eq(comb(comb(d, [-1, 1]), [-2, 0, 2]), comb(comb(d, [-2, 0, 2]), [-1, 1])));
});

test("ladderTo is wheelsAt at each generation", () => {
    const L = ladderTo(PENTA_UP, 5);
    assert.equal(L.length, 6);
    for (let g = 0; g <= 5; g++) assert.ok(eq(L[g].d, wheelsAt(PENTA_UP, g).d), `${g}`);
});

test("a spoke's growth converges on phi^2, and does so at phi^-2", () => {
    // The quadrille does not grow by phi^2 at once -- its wheel is not a scalar
    // multiple of itself, so an individual spoke only approaches the ratio. The
    // error falls by phi^-2 a generation, which is the subdominant eigenvalue
    // of the same substitution, and reaches machine precision by thirty:
    //
    //     5 inflations  err 3.83e-3      20  err 2.04e-9
    //    10 inflations  err 3.09e-5      30  err 1.35e-13
    //
    // Asserting the RATE says more than any single tolerance would, and it
    // would catch a wheel that converged to the right number the wrong way.
    let d = wheelFromPoints(PENTA_UP);
    /** @type {number[]} */
    const errs = [];
    for (let i = 1; i <= 30; i++) {
        const before = Math.hypot(...d[1]);
        d = inflate(d);
        if (i >= 10) errs.push(Math.abs(Math.hypot(...d[1]) / before - PHI ** 2));
    }
    assert.ok(errs[errs.length - 1] < 1e-12, `still ${errs[errs.length - 1]} by 30`);
    for (let i = 1; i < errs.length - 6; i++) {
        const fall = errs[i] / errs[i - 1];
        assert.ok(Math.abs(fall - PHI ** -2) < 0.02,
            `generation ${i + 10}: error fell by ${fall}, not phi^-2`);
    }
});
