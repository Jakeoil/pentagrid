// What a singularity resolves into: the 2k-gon, and the rhombs stacked in it.

import test from "node:test";
import assert from "node:assert/strict";

import { createGammaSet } from "../dist/geometry/gamma.js";
import { scanRegions } from "../dist/geometry/regularity.js";
import { resolveConcurrency, describeResolution, angleCode } from "../dist/geometry/resolve.js";

const VIS = { xMin: -3, xMax: 3, yMin: -3, yMax: 3 };

/** Every concurrency in a singular patch, resolved. */
function resolutions(sum = 0) {
    const g = createGammaSet({ guard: false });
    g.setSum(sum, true);
    const { concurrencies } = scanRegions(g.model, VIS, { scale: 1 });
    return { g, list: concurrencies.map((c) => resolveConcurrency(g.model, c)).filter(Boolean) };
}

const area = (p) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
        s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
};

test("k concurrent lines resolve to a 2k-gon with unit sides", () => {
    // Lutfalla states exactly this. The outline is not synthesised from the
    // directions — it is the 2k sectors around the point, each mapped through f —
    // so unit sides are a result rather than a construction.
    const { list } = resolutions(0);
    assert.ok(list.length > 0, "the all-zero pentagrid must be singular");
    for (const r of list) {
        const k = r.families.length;
        assert.equal(r.outline.length, 2 * k, `${k} lines should give a ${2 * k}-gon`);
        for (let i = 0; i < r.outline.length; i++) {
            const [x1, y1] = r.outline[i];
            const [x2, y2] = r.outline[(i + 1) % r.outline.length];
            assert.ok(Math.abs(Math.hypot(x2 - x1, y2 - y1) - 1) < 1e-9,
                      `${r.name}: side ${i} is not unit length`);
        }
    }
});

test("the rhombs tile the 2k-gon exactly, C(k,2) of them", () => {
    const { list } = resolutions(0);
    for (const r of list) {
        const k = r.families.length;
        assert.equal(r.rhombs.length, k * (k - 1) / 2, `${r.name}: wrong rhomb count`);
        const covered = r.rhombs.reduce((s, q) => s + area(q.corners), 0);
        assert.ok(Math.abs(covered - area(r.outline)) < 1e-9,
                  `${r.name}: rhombs cover ${covered}, outline is ${area(r.outline)}`);
        // one rhomb per PAIR of families, each pair once
        const pairs = new Set(r.rhombs.map((q) => `${Math.min(q.a, q.b)},${Math.max(q.a, q.b)}`));
        assert.equal(pairs.size, r.rhombs.length, "a pair of families appears twice");
    }
});

test("the combos are the ones the table predicts", () => {
    // hexagon in two flavours, decagon in one. Enumerated independently in
    // PLAN.md from every subset of families; this checks the geometry agrees.
    const { list } = resolutions(0);
    const seen = new Set(list.map(describeResolution));
    assert.ok(seen.has("K122 thick hexagon · 2 thick + 1 thin"), [...seen].join(" | "));
    assert.ok(seen.has("K113 thin hexagon · 1 thick + 2 thin"), [...seen].join(" | "));
    assert.ok(seen.has("K11111 decagon · 5 thick + 5 thin"), [...seen].join(" | "));
    for (const d of seen) {
        assert.match(d, /^K\d+ [a-z ]+ · \d+ thick \+ \d+ thin$/, d);
    }
});

test("thick and thin are counted by family separation, and add up", () => {
    const { list } = resolutions(0);
    for (const r of list) {
        assert.equal(r.thick + r.thin, r.rhombs.length);
        assert.equal(r.thick, r.rhombs.filter((q) => q.thick).length);
        for (const q of r.rhombs) {
            const sep = Math.abs(q.a - q.b);
            assert.equal(q.cls, Math.min(sep, 5 - sep), "cls is not the separation");
            assert.equal(q.thick, q.cls === 1);
        }
    }
});

test("the 2k-gon is centred on the point it stands for", () => {
    // Its corners are the dual vertices of the sectors, so the centroid is where
    // the superposed rhombs sit.
    const { list } = resolutions(0);
    for (const r of list) {
        let cx = 0, cy = 0;
        for (const [x, y] of r.outline) { cx += x; cy += y; }
        assert.ok(Math.abs(cx / r.outline.length - r.x) < 1e-9);
        assert.ok(Math.abs(cy / r.outline.length - r.y) < 1e-9);
    }
});

test("a regular pentagrid has nothing to resolve", () => {
    const g = createGammaSet({ guard: false });
    g.setSum(1, true);                       // uniform 1/5, regular everywhere
    assert.deepEqual(g.singular(), []);
    const { concurrencies } = scanRegions(g.model, VIS, { scale: 1 });
    assert.equal(concurrencies.length, 0, "a regular grid reported a concurrency");
});

test("fewer than two families is not a resolution", () => {
    const g = createGammaSet({ guard: false });
    assert.equal(resolveConcurrency(g.model, { x: 0, y: 0, lines: 1, families: [2] }), null);
    assert.equal(resolveConcurrency(g.model, { x: 0, y: 0, lines: 0, families: [] }), null);
});

test("how many lines can meet is decided by how many phases are integral", () => {
    // 3-fold needs one gamma integral AND one pair summing to an integer — no
    // more, so it does not need integers at all. 4-fold needs four integral
    // phases, 5-fold all five. Which is why the octagon is real but rare.
    const shapes = (vals) => {
        const g = createGammaSet({ guard: false });
        g.setLocked(-1);
        g.setValues(vals);
        const { concurrencies } = scanRegions(g.model, { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
                                              { scale: 1 });
        const out = new Set();
        for (const c of concurrencies) out.add(resolveConcurrency(g.model, c).code);
        return out;
    };

    assert.ok(shapes([0, 0, 0, 0, 0]).has("11111"), "five integral phases -> decagon");
    const four = shapes([0, 0, 0, 0, 0.3]);
    assert.ok(four.has("1112"), "four integral phases -> octagon");
    assert.ok(!four.has("11111"), "but not a decagon");
    const three = shapes([0, 0, 0, 0.3, 0.7]);
    assert.ok(three.has("122") || three.has("113"), "three -> hexagons");
    assert.ok(!three.has("1112"), "and no octagon");

    // and a hexagon with only ONE integral phase: g1 in Z, g0 + g2 in Z
    const one = shapes([0.3, 0, 0.7, 0.11, 0.29]);
    assert.ok(one.has("122") || one.has("113"), "a 3-fold needs no other integral phase");
    assert.ok(!one.has("1112") && !one.has("11111"));
});

test("the concurrencies sit on Z[phi] shells", () => {
    // Jake's reading of the picture: lesser 2k-gons radiate out in a golden
    // series. They do — at m and m*phi times 1/cos18.
    const phi = (1 + Math.sqrt(5)) / 2, U = 1 / Math.cos(Math.PI / 10);
    const g = createGammaSet({ guard: false });
    g.setLocked(-1);
    g.setValues([0, 0, 0, 0, 0]);
    const { concurrencies } = scanRegions(g.model, { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
                                          { scale: 1 });
    const radii = [...new Set(concurrencies.map((c) => +Math.hypot(c.x, c.y).toFixed(6)))];
    assert.ok(radii.length > 8, "not enough shells to judge");

    let onLattice = 0;
    for (const r of radii) {
        const q = r / U;
        for (let a = -12; a <= 12 && !0; a++) {
            for (let b = -12; b <= 12; b++) {
                if (Math.abs(a + b * phi - q) < 1e-6) { onLattice++; a = 99; break; }
            }
        }
    }
    assert.equal(onLattice, radii.length,
                 `${radii.length - onLattice} radii are not a + b*phi in units of 1/cos18`);
});

test("the angle code names a shape, and its digits are a partition of n", () => {
    // Jake's scheme: a digit d is a vertex of interior angle 180 - d*(180/n), the
    // supplement of the gap between consecutive generators. The gaps span a half
    // turn, so the digits must sum to n — which makes the available shapes exactly
    // the partitions of n into two or more parts.
    const g = createGammaSet({ guard: false });
    g.setLocked(-1);
    g.setValues([0, 0, 0, 0, 0]);
    const { concurrencies } = scanRegions(g.model, { xMin: -4, xMax: 4, yMin: -4, yMax: 4 },
                                          { scale: 1 });
    const seen = new Map();
    for (const c of concurrencies) {
        const r = resolveConcurrency(g.model, c);
        seen.set(r.code, r);
        const sum = r.code.split("").reduce((s, d) => s + Number(d), 0);
        assert.equal(sum, 5, `${r.code} does not sum to n`);
        assert.equal(r.code.length, r.families.length, "one digit per generator");
    }
    assert.equal(seen.get("122").name, "thick hexagon");
    assert.equal(seen.get("113").name, "thin hexagon");
    assert.equal(seen.get("11111").name, "decagon");
    // the codes carry the thick/thin content, so the two hexagons differ
    assert.deepEqual([seen.get("122").thick, seen.get("122").thin], [2, 1]);
    assert.deepEqual([seen.get("113").thick, seen.get("113").thin], [1, 2]);
});

test("angleCode is the partition list, for n = 5 and n = 7 alike", () => {
    // The point of the scheme: nothing about it changes when n does, and it says
    // in advance how many distinct shapes there are.
    const partitions = (m, max) => {
        if (m === 0) return [[]];
        const out = [];
        for (let x = Math.min(m, max); x >= 1; x--) {
            for (const rest of partitions(m - x, x)) out.push([x, ...rest]);
        }
        return out;
    };
    for (const n of [5, 7]) {
        const g = createGammaSet({ n, guard: false });
        const subsets = (k) => {
            const out = [];
            const go = (s, i) => {
                if (s.length === k) { out.push([...s]); return; }
                for (let j = i; j < n; j++) { s.push(j); go(s, j + 1); s.pop(); }
            };
            go([], 0);
            return out;
        };
        const codes = new Set();
        for (let k = 2; k <= n; k++) {
            for (const S of subsets(k)) codes.add(angleCode(g.model, S));
        }
        const want = new Set(partitions(n, n).filter((p) => p.length >= 2)
            .map((p) => p.slice().sort((a, b) => a - b).join("")));
        assert.deepEqual([...codes].sort(), [...want].sort(),
                         `n = ${n}: codes are not the partitions of n`);
    }
    assert.equal(new Set(partitions(5, 5).filter((p) => p.length >= 2).map(String)).size, 6);
});
