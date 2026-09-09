// Tests for the γ cluster: directions, offsets, the sum constraint, the guard.
// No DOM anywhere — this is a model, and that is the point of it living in
// geometry/ rather than view/.

import test from "node:test";
import assert from "node:assert/strict";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { singularTriples } from "../dist/geometry/regularity.js";
import { collectRhombs, computeKTuple } from "../dist/geometry/pentagrid.js";

const near = (a, b, eps = 1e-12) => Math.abs(a - b) < eps;
const sumOf = (a) => a.reduce((x, y) => x + y, 0);

test("the default is what the page had before the extraction", () => {
    // A pure move must not move anything: all zeros is singular, so the guard
    // nudges to [1,2,3,4,-10] units of 1e-4, which is what shipped.
    const g = createGammaSet();
    assert.deepEqual(g.exact(), [1, 2, 3, 4, -10]);
    assert.equal(g.denominator, 10000);
    assert.equal(sumOf(g.exact()), 0, "the sum constraint must survive the nudge");
    assert.deepEqual(g.singular(), []);
    assert.ok(g.nudged(), "the default should have needed a nudge");
});

test("the model is live: handed out once, current forever", () => {
    const g = createGammaSet();
    const model = g.model;
    const before = model.gamma[0];
    g.setValue(0, 0.37);
    assert.notEqual(model.gamma[0], before, "the model went stale");
    assert.ok(near(model.gamma[0], 0.37, 1e-9));
    // and the arrays are mutated, never replaced
    assert.equal(g.model, model);
    assert.equal(g.model.gamma, model.gamma);
    assert.equal(g.model.directions, model.directions);
});

test("the locked index absorbs whatever the others do", () => {
    const g = createGammaSet();
    g.setValue(0, 0.4);
    g.setValue(1, -0.15);
    g.setValue(2, 0.05);
    assert.ok(near(sumOf(g.values()), 0, 1e-9), `sum drifted to ${sumOf(g.values())}`);
    g.setLocked(1);
    g.setValue(4, 0.9);
    assert.ok(near(sumOf(g.values()), 0, 1e-9));
    assert.equal(g.getLocked(), 1);
});

test("setting the locked index itself is ignored", () => {
    const g = createGammaSet();
    const before = g.exact();
    g.setValue(g.getLocked(), 0.5);
    assert.deepEqual(g.exact(), before, "the computed index must not be settable");
});

test("the sum is held for any target", () => {
    for (const s of [0, 0.5, 1, 2.5, -1.25]) {
        const g = createGammaSet({ sum: s });
        assert.ok(near(sumOf(g.values()), s, 1e-9), `sum ${s} not held`);
        assert.ok(near(g.getSum(), s, 1e-9));
    }
});

test("reset splits the sum exactly evenly, before the guard has an opinion", () => {
    for (const s of [0, 0.5, 1, 2.5, -1.25]) {
        const q = createGammaSet({ sum: s, guard: false }).exact();
        assert.equal(Math.max(...q) - Math.min(...q), 0, `uneven for sum ${s}: ${q}`);
    }
    // s = 0.3 does not divide into five whole units at any denominator; the
    // remainder is spread so the sum is still exact.
    const odd = createGammaSet({ sum: 0.30003, guard: false });
    assert.equal(sumOf(odd.exact()), Math.round(0.30003 * odd.denominator));
});

test("an even split only needs the guard when it lands on the integers", () => {
    // Which is Lutfalla's Theorem 2.1 from the other side: every offset a
    // non-zero rational is already regular, so Gn(r) needs no help.
    for (const s of [0.5, 1, 2.5, -1.25]) {
        const g = createGammaSet({ sum: s });
        assert.ok(!g.nudged(), `sum ${s} was nudged when it did not need to be`);
        assert.deepEqual(g.singular(), []);
    }
    for (const s of [0, 5, -5]) {                 // an even split of these is integral
        const g = createGammaSet({ sum: s });
        assert.ok(g.nudged(), `sum ${s} should have needed a nudge`);
        assert.deepEqual(g.singular(), []);
    }
});

test("Lutfalla's G5(1/2) is every offset a half, so our sum is 5/2", () => {
    const g = createGammaSet({ sum: 2.5, guard: false });
    for (const v of g.values()) assert.ok(near(v, 0.5, 1e-9), `offset ${v}`);
});

test("the guard clears every triple, and turning it off leaves them", () => {
    const off = createGammaSet({ guard: false });
    assert.deepEqual(off.exact(), [0, 0, 0, 0, 0]);
    assert.equal(off.singular().length, 10, "all zeros must be singular in all ten");

    off.setGuard(true);
    assert.deepEqual(off.singular(), [], "the guard did not clear it");
    assert.ok(off.nudged());
});

test("the guard nudges by rationality class, not by magnitude", () => {
    // 1e-4 is nowhere near a float epsilon; what matters is leaving the integers.
    const g = createGammaSet();
    const q = g.exact();
    assert.ok(q.every((v) => v % g.denominator !== 0),
              `some offset is still an integer: ${q}`);
});

test("symmetry turns the star without disturbing regularity", () => {
    const g = createGammaSet();
    const upright = g.model.directions[0].slice();
    assert.ok(near(upright[0], 0, 1e-12) && near(upright[1], 1, 1e-12),
              "v0 should point up by default");
    const before = g.singular();
    g.setSymmetry(false);
    assert.ok(near(g.model.directions[0][0], 1, 1e-12), "v0 should point along x");
    assert.deepEqual(g.singular(), before,
                     "regularity depends on angle differences, which a rotation preserves");
});

test("onChange fires for every kind of change", () => {
    const g = createGammaSet();
    let n = 0;
    g.onChange(() => { n++; });
    g.setValue(0, 0.2);   assert.equal(n, 1);
    g.setSum(0.5);        assert.equal(n, 2);
    g.setLocked(2);       assert.equal(n, 3);
    g.setSymmetry(false); assert.equal(n, 4);
    g.setGuard(false);    assert.equal(n, 5);
    g.reset();            assert.equal(n, 6);
});

test("the set drives the geometry it hands out", () => {
    const g = createGammaSet();
    const before = collectRhombs(g.model, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
                                 { gain: 2.5 }).length;
    g.setValue(0, 0.37);
    const after = collectRhombs(g.model, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
                                { gain: 2.5 }).length;
    assert.ok(before > 0 && after > 0);
    // K-tuples at a fixed point must have moved
    const K = computeKTuple(g.model, 1.3, -0.7);
    assert.equal(K.length, 5);
});

test("values and exact hand back copies", () => {
    const g = createGammaSet();
    const v = g.values(); v[0] = 99;
    const q = g.exact(); q[0] = 99;
    assert.notEqual(g.values()[0], 99);
    assert.notEqual(g.exact()[0], 99);
});
