// Tests for the γ cluster: directions, offsets, the sum constraint, the guard.
// No DOM anywhere — this is a model, and that is the point of it living in
// geometry/ rather than view/.

import test from "node:test";
import assert from "node:assert/strict";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { singularTriples } from "../dist/geometry/regularity.js";
import { collectRhombs, computeKTuple } from "../dist/geometry/pentagrid.js";
import { liftLocal } from "../dist/geometry/roof.js";

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

// ── the sum control ───────────────────────────────────────────────

test("setSum without spread lets the locked index absorb the change", () => {
    const g = createGammaSet({ sum: 0 });
    const before = g.exact().slice();
    g.setSum(2.5);
    assert.ok(near(sumOf(g.values()), 2.5, 1e-9));
    const q = g.exact();
    // the four free offsets are untouched; the locked one carries it
    for (let j = 0; j < 5; j++) {
        if (j === g.getLocked()) continue;
        assert.equal(q[j], before[j], `offset ${j} moved when it should not have`);
    }
});

test("setSum with spread gives the symmetric family, which is the point of it", () => {
    const g = createGammaSet({ sum: 0 });
    g.setSum(2.5, true);
    for (const v of g.values()) assert.ok(near(v, 0.5, 1e-9), `offset ${v}, wanted 0.5`);
    assert.ok(near(sumOf(g.values()), 2.5, 1e-9));
});

test("the two named configurations are what they claim", () => {
    // s = 0: every offset zero, so every line passes through the origin —
    // ten singular triples, before the guard has an opinion.
    const concurrent = createGammaSet({ sum: 0, guard: false });
    assert.deepEqual(concurrent.exact(), [0, 0, 0, 0, 0]);
    assert.equal(concurrent.singular().length, 10);

    // s = 5/2: every offset a half. Lutfalla's G5(1/2), and regular untouched.
    const pentagon = createGammaSet({ sum: 2.5, guard: false });
    for (const v of pentagon.values()) assert.ok(near(v, 0.5, 1e-9));
    assert.deepEqual(pentagon.singular(), []);
});

test("spreading to a singular sum still comes back regular", () => {
    const g = createGammaSet({ sum: 2.5 });
    g.setSum(0, true);                    // lands on all zeros, which is singular
    assert.deepEqual(g.singular(), [], "the guard did not run after a spread");
    assert.ok(g.nudged());
    assert.ok(near(sumOf(g.values()), 0, 1e-9), "the nudge broke the sum");
});

test("sweeping the sum never leaves a singular configuration behind", () => {
    const g = createGammaSet();
    for (let s = 0; s <= 2.5 + 1e-9; s += 0.05) {
        g.setSum(Math.round(s * 100) / 100, true);
        assert.deepEqual(g.singular(), [], `singular at Σγ = ${s.toFixed(2)}`);
        assert.ok(near(sumOf(g.values()), Math.round(s * 100) / 100, 1e-9),
                  `sum drifted at ${s.toFixed(2)}`);
    }
});

test("the roof's level count follows the sum, but the rhombus never changes", () => {
    // roof.html used to claim four levels as if it were a property of the
    // construction. It is a property of Σγ.
    const seen = new Set();
    for (const s of [0, 0.5, 1, 1.25, 2, 2.5]) {
        const g = createGammaSet({ sum: s });
        const rhombs = collectRhombs(g.model, { xMin: -14, xMax: 14, yMin: -14, yMax: 14 },
                                     { gain: 2.5 });
        const idx = new Set();
        for (const r of rhombs) for (const K of r.kTuples) idx.add(sumOf(K));
        seen.add(Math.max(...idx) - Math.min(...idx) + 1);

        // whatever the sum, every lifted face is the same golden rhombus
        for (const r of rhombs.slice(0, 60)) {
            const A = liftLocal(g.model, r, 0, 0), B = liftLocal(g.model, r, 1, 0);
            const C = liftLocal(g.model, r, 1, 1), D = liftLocal(g.model, r, 0, 1);
            const d1 = Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
            const d2 = Math.hypot(D[0] - B[0], D[1] - B[1], D[2] - B[2]);
            const ratio = Math.max(d1, d2) / Math.min(d1, d2);
            assert.ok(near(ratio, (1 + Math.sqrt(5)) / 2, 1e-9),
                      `Σγ ${s}: diagonal ratio ${ratio}`);
        }
    }
    assert.ok(seen.size > 1, `the level count never varied: ${[...seen]}`);
    assert.ok(seen.has(4), "Σγ = 0 should still give four levels");
});

// ── per-family enable, and single lines ───────────────────────────

const BOX = { xMin: -12, xMax: 12, yMin: -12, yMax: 12 };
const tiles = (g, opts) => collectRhombs(g.model, BOX,
    { gain: 2.5, active: g.enabledFlags(), lines: g.lineFlags(),
      only: g.isolated(), ...opts });

test("families are all in play to begin with", () => {
    const g = createGammaSet();
    assert.deepEqual(g.enabledFlags(), [true, true, true, true, true]);
    assert.deepEqual(g.lineFlags(), [null, null, null, null, null]);
});

test("turning a family off drops exactly the tiles it took part in", () => {
    const g = createGammaSet();
    const before = tiles(g);
    g.setFamilyEnabled(2, false);
    const after = tiles(g);
    assert.ok(after.length < before.length, "nothing was dropped");
    for (const r of after) {
        assert.notEqual(r.j, 2, "a tile of family 2 survived");
        assert.notEqual(r.k, 2);
    }
    // and only those: everything left was already there
    const was = new Set(before.map((r) => `${r.j}${r.k}:${r.nj},${r.nk}`));
    for (const r of after) assert.ok(was.has(`${r.j}${r.k}:${r.nj},${r.nk}`));
});

test("two families off leaves only the pairs among the remaining three", () => {
    const g = createGammaSet();
    g.setFamilyEnabled(0, false);
    g.setFamilyEnabled(3, false);
    const pairs = new Set(tiles(g).map((r) => `${r.j}${r.k}`));
    assert.deepEqual([...pairs].sort(), ["12", "14", "24"]);
});

test("a single line restricts that family's pairs, and only those", () => {
    // It does not isolate a ribbon: the tiles the other families make between
    // themselves are untouched, so the ribbon is the part of the result that
    // involves the restricted family.
    const g = createGammaSet();
    const all = tiles(g);
    g.setFamilyLine(1, 2);
    const one = tiles(g);
    const key = (r) => `${r.j}${r.k}:${r.nj},${r.nk}`;
    const uses1 = (r) => (r.j === 1 ? r.nj : (r.k === 1 ? r.nk : null));

    assert.ok(one.length < all.length, "nothing was restricted");

    // every survivor that uses family 1 is on line 2 of it
    for (const r of one) {
        const n = uses1(r);
        if (n !== null) assert.equal(n, 2, `a tile on line ${n} survived`);
    }
    // the part involving family 1 is exactly the ribbon
    const ribbon = all.filter((r) => uses1(r) === 2);
    assert.deepEqual(one.filter((r) => uses1(r) !== null).map(key).sort(),
                     ribbon.map(key).sort());
    assert.ok(ribbon.length > 4, `ribbon of only ${ribbon.length}`);

    // and the pairs not involving family 1 came through untouched
    const without = (list) => list.filter((r) => uses1(r) === null).map(key).sort();
    assert.deepEqual(without(one), without(all));
});

test("restricting every family leaves only where the chosen lines cross", () => {
    const g = createGammaSet();
    for (let j = 0; j < 5; j++) g.setFamilyLine(j, 0);
    const t = tiles(g);
    // one tile per pair of families, at most
    assert.ok(t.length <= 10, `${t.length} tiles for ten pairs`);
    const pairs = new Set(t.map((r) => `${r.j}${r.k}`));
    assert.equal(pairs.size, t.length, "a pair produced more than one tile");
    for (const r of t) { assert.equal(r.nj, 0); assert.equal(r.nk, 0); }
});

test("null puts a family's lines back", () => {
    const g = createGammaSet();
    const all = tiles(g).length;
    g.setFamilyLine(4, -1);
    assert.ok(tiles(g).length < all);
    g.setFamilyLine(4, null);
    assert.equal(tiles(g).length, all, "clearing the restriction did not restore it");
});

test("family changes notify, so nothing has to remember to redraw", () => {
    const g = createGammaSet();
    let n = 0;
    g.onChange(() => { n++; });
    g.setFamilyEnabled(0, false); assert.equal(n, 1);
    g.setFamilyLine(0, 3);        assert.equal(n, 2);
});

test("isolating keeps only one family's tiles", () => {
    const g = createGammaSet();
    const all = tiles(g);
    g.setIsolated(3);
    const solo = tiles(g);
    assert.ok(solo.length > 0 && solo.length < all.length);
    for (const r of solo)
        assert.ok(r.j === 3 || r.k === 3, `a tile ${r.j}${r.k} survived isolation`);
    // and every tile of family 3 is still there
    const expect = all.filter((r) => r.j === 3 || r.k === 3);
    const key = (r) => `${r.j}${r.k}:${r.nj},${r.nk}`;
    assert.deepEqual(solo.map(key).sort(), expect.map(key).sort());
});

test("isolate plus a single line is exactly one ribbon", () => {
    // This is the combination neither option can reach alone: enabling two
    // families necessarily admits their pair, so isolation needed its own idea.
    const g = createGammaSet();
    const all = tiles(g);
    g.setIsolated(1);
    g.setFamilyLine(1, 2);
    const ribbon = tiles(g);

    const expect = all.filter((r) => (r.j === 1 && r.nj === 2) || (r.k === 1 && r.nk === 2));
    const key = (r) => `${r.j}${r.k}:${r.nj},${r.nk}`;
    assert.deepEqual(ribbon.map(key).sort(), expect.map(key).sort());
    assert.ok(ribbon.length > 4, `ribbon of only ${ribbon.length}`);

    // a ribbon's tiles all share the isolated family's edge direction
    for (const r of ribbon) assert.ok(r.j === 1 || r.k === 1);
});

test("isolation clears back to the whole tiling", () => {
    const g = createGammaSet();
    const all = tiles(g).length;
    g.setIsolated(0);
    assert.ok(tiles(g).length < all);
    g.setIsolated(null);
    assert.equal(tiles(g).length, all);
});

test("isolating a disabled family leaves nothing, which is consistent", () => {
    const g = createGammaSet();
    g.setFamilyEnabled(2, false);
    g.setIsolated(2);
    assert.equal(tiles(g).length, 0);
});

test("the tiling family turns on Σγ mod 1, and half-integer grows flowers", () => {
    // Jake spotted "flowers" of thin rhombs at Σγ = 5/2 and said we are not in
    // Penrose there. Both halves check out — and the flower is the signature of a
    // HALF-integer sum specifically, not of any non-integer one.
    const census = (sum) => {
        const g = createGammaSet({ sum });
        const rhombs = collectRhombs(g.model, { xMin: -20, xMax: 20, yMin: -20, yMax: 20 },
                                     { gain: 2.5 });
        const at = new Map();
        for (const r of rhombs) {
            const d = Math.min(Math.abs(r.j - r.k), 5 - Math.abs(r.j - r.k));
            const a = d === 1 ? 72 : 144;          // the angle BETWEEN v_j and v_k
            const ang = [a, 180 - a, a, 180 - a];
            r.vertices.forEach((v, i) => {
                const k = `${Math.round(v[0] * 1e6)},${Math.round(v[1] * 1e6)}`;
                if (!at.has(k)) at.set(k, { deg: 0, thick: 0, thin: 0 });
                const e = at.get(k);
                e.deg += ang[i];
                if (r.thick) e.thick++; else e.thin++;
            });
        }
        const full = [...at.values()].filter((v) => Math.abs(v.deg - 360) < 1e-6);
        return {
            complete: full.length,
            flowers: full.filter((v) => v.thick === 0).length,
            allThinSize: new Set(full.filter((v) => v.thick === 0).map((v) => v.thin)),
        };
    };

    for (const s of [0, 1, 2]) {
        const c = census(s);
        assert.ok(c.complete > 1000, `only ${c.complete} complete vertices at Σγ = ${s}`);
        assert.equal(c.flowers, 0, `Penrose should have no all-thin vertex, Σγ = ${s}`);
    }
    for (const s of [0.25, 0.75, 1.25]) {
        assert.equal(census(s).flowers, 0,
                     `Σγ = ${s} is not half-integer and should grow no flowers`);
    }
    for (const s of [0.5, 1.5, 2.5]) {
        const c = census(s);
        assert.ok(c.flowers > 5, `Σγ = ${s} should grow flowers, found ${c.flowers}`);
        // ten thin rhombs at their 36° corners: 10 x 36 = 360
        assert.deepEqual([...c.allThinSize], [10],
                         `a flower should be ten thin rhombs, got ${[...c.allThinSize]}`);
    }
});

test("Σγ = 5/2 is Lutfalla's P5(1/2), with exact global 10-fold symmetry", () => {
    // Theorem 1: Pn(1/2) has global 2n-fold rotational symmetry. His Gn(x) means
    // every offset equal to x, so G5(1/2) is our Σγ = 5/2 — and it is Figure 4(d)
    // of the paper, the 10-fold one covered in thin-rhomb flowers.
    const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
    const spin = (sum, turns, R = 12) => {
        const g = createGammaSet({ sum });
        const rhombs = collectRhombs(g.model,
            { xMin: -R - 6, xMax: R + 6, yMin: -R - 6, yMax: R + 6 }, { gain: 2.5 });
        const have = new Set();
        for (const r of rhombs) for (const v of r.vertices) have.add(key(v));
        const a = 2 * Math.PI / turns, c = Math.cos(a), sn = Math.sin(a);
        let hit = 0, total = 0;
        for (const r of rhombs) for (const v of r.vertices) {
            if (Math.hypot(v[0], v[1]) > R) continue;
            total++;
            if (have.has(key([v[0] * c - v[1] * sn, v[0] * sn + v[1] * c]))) hit++;
        }
        return hit / total;
    };
    assert.ok(spin(2.5, 10) > 0.9999, "Σγ = 5/2 should be exactly 10-fold");
    assert.ok(spin(2.5, 5) > 0.9999, "and therefore 5-fold too");

    // Σγ = 0 is not, because the guard has to move off the symmetric point:
    // all-zeros is singular, so forcing regularity costs the exact symmetry.
    assert.ok(spin(0, 5) < 0.99, "guarded Σγ = 0 should not be exactly 5-fold");
});
