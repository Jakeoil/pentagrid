// The three modes, and the even pentads. GEOMETRY.md section 8.
//
// A wheel obeys W[t+5] = -W[t], so only the odd Fourier modes of Z/10 survive,
// and `inflate` -- the circulant W[t-1] + W[t] + W[t+1] -- is diagonal on them
// with multiplier 1 + 2cos(36m). Three values, three fates:
//
//     m = +/-1   phi^2     the figure, and its counter-rotating twin
//     m = 3, 7   phi^-2    the wobble, which dies
//     m = 5      -1        the spoke sum, which does not
//
// Everything here is measured off the real wheels, not off the formula.

import test from "node:test";
import assert from "node:assert/strict";

import {
    ASYMMETRIC, PENTA_UP, REAL_PENTA, deflate, eWheel, halfDown, halfUp, inflate,
    pWheel, pointsOf, sWheel, tWheel, wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";
import { THICK, THIN, rhombus } from "../src/math/walk.js";
import { evenPentads, mode, settledRhombs } from "../tools/pentads.mjs";

const PHI = (1 + Math.sqrt(5)) / 2;
const sum = (pts) => pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
// -0 and 0 are the same lattice point; deepStrictEqual disagrees.
const zero = (v) => v.map((n) => (n === 0 ? 0 : n));
const QUADRILLE5 = [[0, -16], [15, -6], [10, 14], [-10, 14], [-15, -6]];
const BEST13 = [[3, 2], [0, 2], [-3, 2], [-2, -3], [2, -3]];

test("inflate is diagonal on the five odd modes, with three eigenvalues", () => {
    const w = wheelFromPoints(ASYMMETRIC);       // no symmetry: every mode is lit
    const want = { 1: PHI * PHI, 3: 1 / (PHI * PHI), 5: -1,
        7: 1 / (PHI * PHI), 9: PHI * PHI };
    for (const m of [1, 3, 5, 7, 9]) {
        const before = mode(w, m), after = mode(inflate(w), m);
        assert.ok(before > 1e-6, `mode ${m} is not lit on the asymmetric seed`);
        assert.ok(Math.abs(after / before - Math.abs(want[m])) < 1e-9,
            `mode ${m}: x${after / before}, wanted x${Math.abs(want[m])}`);
    }
    for (const m of [0, 2, 4, 6, 8])
        assert.ok(mode(w, m) < 1e-12, `even mode ${m} should be dead, got ${mode(w, m)}`);
});

test("mode 5 is the spoke sum, and section 4's c is its multiplier", () => {
    // A comb sum_j s_j D[t + k_j] multiplies mode 5 by sum_j s_j (-1)^k_j, which
    // is exactly the table in section 4. E is origin-invariant because its c is
    // zero -- that is, because E annihilates mode 5.
    const d = wheelFromPoints(ASYMMETRIC);
    const S = sum(ASYMMETRIC);
    assert.ok(Math.abs(mode(d, 5) * 5 - Math.hypot(...S)) < 1e-9,
        "mode 5's amplitude is |sum of spokes| / 5");
    for (const [name, fn, c] of [
        ["P", pWheel, -2], ["S", sWheel, 3], ["T", tWheel, 4], ["E", eWheel, 0],
        ["inflate", inflate, -1], ["deflate", deflate, -1],
        ["halfUp", halfUp, -2], ["halfDown", halfDown, 2],
    ]) {
        const got = mode(fn(d), 5) / mode(d, 5);
        assert.ok(Math.abs(got - Math.abs(c)) < 1e-9, `${name}: x${got}, wanted x${Math.abs(c)}`);
    }
    assert.ok(mode(eWheel(d), 5) < 1e-12, "E annihilates mode 5");
});

test("a generation negates the spoke sum, so it never shrinks", () => {
    for (const pts of [PENTA_UP, ASYMMETRIC]) {
        const S = sum(pts);
        let d = wheelFromPoints(pts);
        for (let g = 1; g <= 6; g++) {
            d = inflate(d);
            const want = g % 2 ? [-S[0], -S[1]] : S;
            assert.deepEqual(zero(sum(pointsOf(d))), zero(want), `generation ${g}`);
        }
        assert.deepEqual(zero(sum(pointsOf(deflate(wheelFromPoints(pts))))), zero([-S[0], -S[1]]));
        assert.deepEqual(zero(sum(pointsOf(halfUp(wheelFromPoints(pts))))), zero([-2 * S[0], -2 * S[1]]));
        assert.deepEqual(zero(sum(pointsOf(halfDown(wheelFromPoints(pts))))), zero([2 * S[0], 2 * S[1]]));
    }
});

test("the classic rhomb's failure to close IS the spoke sum, exactly", () => {
    // |e0 + e2| = |sum of spokes|, at every tenth, both specs, every generation,
    // because e0 + e2 = inflate(D)[n+9] - T[n+9] and those two phi^2 wheels
    // differ by a pure mode-5 term. Section 7's kite is this and nothing else.
    for (const pts of [PENTA_UP, ASYMMETRIC, QUADRILLE5, REAL_PENTA, BEST13]) {
        const want = Math.hypot(...sum(pts));
        for (const gen of [0, 1, 2, 5]) {
            const w = wheelsAt(pts, gen), inf = inflate(w.d);
            for (let t = 0; t < 10; t++)
                for (const spec of [THICK, THIN]) {
                    const q = rhombus(spec, w.t, inf, t, "classic");
                    const gap = Math.hypot(
                        q[1][0] - q[0][0] + q[3][0] - q[2][0],
                        q[1][1] - q[0][1] + q[3][1] - q[2][1]);
                    assert.ok(Math.abs(gap - want) < 1e-9,
                        `gen ${gen} tenth ${t}: gap ${gap}, sum ${want}`);
                }
        }
    }
});

test("the anisotropy m9/m1 is an exact invariant of the whole ladder", () => {
    // Both grow by phi^2, so the RATIO never moves -- it is the anisotropy of
    // the limiting affine map, and the one defect no generation can wash out.
    for (const [pts, want] of [[PENTA_UP, 0.025086], [QUADRILLE5, 0.025086],
                               [BEST13, 0.0020244]]) {
        let d = wheelFromPoints(pts);
        for (let g = 0; g <= 8; g++) {
            assert.ok(Math.abs(mode(d, 9) / mode(d, 1) - want) < 1e-5,
                `generation ${g}: ${mode(d, 9) / mode(d, 1)}`);
            d = inflate(d);
        }
    }
    // and the wobble does wash out, by phi^-4 a generation
    let d = wheelFromPoints(PENTA_UP);
    let last = mode(d, 3) / mode(d, 1);
    for (let g = 1; g <= 5; g++) {
        d = inflate(d);
        const now = mode(d, 3) / mode(d, 1);
        assert.ok(Math.abs(last / now - PHI ** 4) < 1e-6, `generation ${g}: x${last / now}`);
        last = now;
    }
});

test("an even pentad stays even at every generation, up the ladder and down", () => {
    for (const pts of [QUADRILLE5, BEST13, [[1, 0], [1, 2], [-1, 1], [-1, -1], [0, -2]]]) {
        assert.deepEqual(zero(sum(pts)), [0, 0], "the seed itself");
        let up = wheelFromPoints(pts), down = wheelFromPoints(pts);
        for (let g = 1; g <= 6; g++) {
            up = inflate(up); down = deflate(down);
            assert.deepEqual(zero(sum(pointsOf(up))), [0, 0], `inflated ${g}`);
            assert.deepEqual(zero(sum(pointsOf(down))), [0, 0], `deflated ${g}`);
        }
    }
});

test("the smallest even pentad has sum|v|^2 = 14, and there are four of it", () => {
    const found = [];
    evenPentads(5)((f) => found.push(f));
    const least = Math.min(...found.map((f) => f.square));
    assert.equal(least, 14);
    const smallest = found.filter((f) => f.square === least)
        .map((f) => JSON.stringify(f.spokes)).sort();
    assert.deepEqual(smallest, [
        JSON.stringify([[1, 0], [1, 2], [-1, 1], [-1, -1], [0, -2]]),
        JSON.stringify([[1, 0], [0, 2], [-1, 1], [-1, -1], [1, -2]]),
        JSON.stringify([[2, 0], [1, 1], [-1, 1], [-2, -1], [0, -1]]),
        JSON.stringify([[2, 0], [0, 1], [-2, 1], [-1, -1], [1, -1]]),
    ].sort());
    for (const f of found) assert.deepEqual(zero(sum(f.spokes)), [0, 0]);
});

test("smallest is not roundest: the sqrt-13 pentad beats the quadrille twelvefold", () => {
    const quad = settledRhombs(QUADRILLE5);
    const best = settledRhombs(BEST13);
    assert.ok(Math.abs(quad.spread - 1.046202) < 1e-5, `quadrille ${quad.spread}`);
    assert.ok(Math.abs(best.spread - 1.003668) < 1e-5, `sqrt 13 ${best.spread}`);
    assert.ok(best.acuteLo > 35.88 && best.acuteHi < 72.19,
        `sqrt 13 angles ${best.acuteLo}-${best.acuteHi}`);
    assert.ok(quad.acuteLo < 34.65 && quad.acuteHi > 74.21,
        `quadrille angles ${quad.acuteLo}-${quad.acuteHi}`);
    // and it is five times the smaller seed
    const reach = (v) => Math.max(...v.map((p) => Math.hypot(p[0], p[1])));
    assert.ok(reach(BEST13) * 4.7 < reach(QUADRILLE5));
});

test("the limiting spread is 1 + cos 36 times the anisotropy", () => {
    const want = 1 + Math.cos(36 * Math.PI / 180);
    let previous = Infinity;
    for (const pts of [QUADRILLE5, BEST13,
                       [[6, 4], [-2, 5], [-5, 2], [-4, -6], [5, -5]],
                       [[8, 3], [0, 6], [-8, 3], [-2, -6], [2, -6]]]) {
        const w = wheelFromPoints(pts);
        const r = mode(w, 9) / mode(w, 1);
        const got = (settledRhombs(pts).spread - 1) / r;
        assert.ok(Math.abs(got - want) < 0.04, `ratio ${got} against ${want}`);
        assert.ok(got < previous, "and it tightens as the anisotropy falls");
        previous = got;
    }
});
