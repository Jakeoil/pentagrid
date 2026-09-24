// The solid a singularity stands up into, and the readings of its 2k-gon.

import test from "node:test";
import assert from "node:assert/strict";

import { createGammaSet } from "../dist/geometry/gamma.js";
import { zonohedronOf, zonogonAnchor, popcount } from "../dist/geometry/zonohedron.js";
import { RISE } from "../dist/geometry/roof.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const dirs = createGammaSet({ guard: false }).model.directions;

/** The lifted position of a corner mask, relative to the base corner. */
const at = (z, mask) => {
    let x = 0, y = 0;
    for (let l = 0; l < z.k; l++) {
        if (mask >> l & 1) { x += dirs[z.fams[l]][0]; y += dirs[z.fams[l]][1]; }
    }
    return [x, y, RISE * popcount(mask)];
};

/**
 * A reading is a tiling iff its edges match up: every edge inside the 2k-gon is
 * shared by exactly two faces, and exactly 2k lie on the boundary alone.
 */
function edgeCheck(z, bases) {
    const seen = new Map();
    for (let p = 0; p < z.pairs.length; p++) {
        const [i, j] = z.pairs[p];
        const m = bases[p];
        for (const [start, gen] of [[m, i], [m | 1 << j, i], [m, j], [m | 1 << i, j]]) {
            const key = `${start}|${gen}`;
            seen.set(key, (seen.get(key) ?? 0) + 1);
        }
    }
    const counts = [...seen.values()];
    return {
        boundary: counts.filter((c) => c === 1).length,
        interior: counts.filter((c) => c === 2).length,
        bad: counts.filter((c) => c > 2).length,
    };
}

const cases = [
    { fams: [0, 1, 2], name: "hexagon", readings: 2, flips: { 1: 2 } },
    { fams: [0, 1, 2, 3], name: "octagon", readings: 8, flips: { 2: 8 } },
    { fams: [0, 1, 2, 3, 4], name: "decagon", readings: 62, flips: { 3: 50, 4: 10, 5: 2 } },
];

test("a concurrency has one face per pair and one cell per triple", () => {
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        const k = c.fams.length;
        assert.equal(z.pairs.length, (k * (k - 1)) / 2, `${c.name} faces`);
        assert.equal(z.cells.length, (k * (k - 1) * (k - 2)) / 6, `${c.name} cells`);
    }
});

test("the readings are 2, 8 and 62, and every one of them tiles", () => {
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        assert.equal(z.readings.length, c.readings, `${c.name} readings`);
        assert.deepEqual(z.readings[0], z.lower, `${c.name} starts at the lower surface`);
        for (const bases of z.readings) {
            const e = edgeCheck(z, bases);
            assert.equal(e.bad, 0, `${c.name}: an edge used more than twice`);
            assert.equal(e.boundary, 2 * c.fams.length, `${c.name}: boundary edges`);
        }
        // and no two readings are the same surface
        assert.equal(new Set(z.readings.map((b) => b.join(","))).size, c.readings);
    }
});

test("every reading is a real configuration of the lines", () => {
    // Jake: the readings are not an abstraction over the grid — nudge the lines
    // apart so no singularity is left and each one shows up for real.
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        for (let i = 0; i < z.readings.length; i++) {
            const e = z.nudgeOf(i);
            assert.ok(e, `${c.name}: reading ${i} has no line configuration`);
            assert.equal(e.length, z.k);
            for (const v of e) assert.ok(Math.abs(v) <= 2, "within two steps");
        }
        // Least disturbance first, and an equal single step is the cheapest kind.
        const cost = (e) => Math.max(...e.map(Math.abs)) * 1000
            + e.reduce((s, v) => s + Math.abs(v), 0);
        const costs = z.readings.map((_, i) => cost(z.nudgeOf(i)));
        assert.deepEqual(costs, [...costs].sort((a, b) => a - b), `${c.name} order`);
        // One equal step for every line — the plainest nudge there is — covers
        // the hexagon and the octagon completely and 32 of the decagon's 62.
        const equal = new Set();
        for (let signs = 0; signs < (1 << z.k); signs++) {
            const e = [...Array(z.k).keys()].map((l) => (signs >> l & 1 ? 1 : -1));
            const r = z.readingOf(e);
            if (r !== null) equal.add(r);
        }
        assert.equal(equal.size, { hexagon: 2, octagon: 8, decagon: 32 }[c.name],
                     `${c.name}: readings from one equal step`);
        assert.equal(equal.size === z.readings.length, c.name !== "decagon");
    }
});

test("the readings use every rhomb of the dissection", () => {
    // Jake: all the faces of the solid are in play. They are — and not only the
    // 2*C(k,2) on its boundary: a reading cuts through the interior, so each of
    // the C(k,2) face directions turns up at all 2^(k-2) of its positions.
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        const faces = new Set();
        for (let p = 0; p < z.pairs.length; p++) {
            const seen = new Set(z.readings.map((b) => b[p]));
            assert.equal(seen.size, 1 << (z.k - 2),
                         `${c.name}: face ${p} misses a position`);
            for (const m of seen) faces.add(`${p}:${m}`);
        }
        assert.equal(faces.size, z.pairs.length * (1 << (z.k - 2)));
        assert.ok(faces.size >= 2 * z.pairs.length, "at least the boundary");
    }
});

test("only the extreme readings offer five flips", () => {
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        const tally = {};
        for (const bases of z.readings) {
            const d = z.flips(bases).length;
            tally[d] = (tally[d] ?? 0) + 1;
        }
        assert.deepEqual(tally, c.flips, `${c.name} flip degrees`);
    }
});

test("a flip moves exactly one cell's cap, and is its own undo", () => {
    const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
    for (const bases of z.readings) {
        for (const f of z.flips(bases)) {
            assert.equal(f.changed.length, 3);
            const moved = f.to.filter((m, i) => m !== bases[i]).length;
            assert.equal(moved, 3, "a flip moves three faces");
            const back = z.flips(f.to).find((g) => g.cell.join() === f.cell.join());
            assert.ok(back, "the partner can be flipped back");
            assert.deepEqual([...back.to], [...bases]);
        }
    }
});

test("every face is the roof's golden rhombus, edge sqrt5/2", () => {
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        for (const bases of z.readings) {
            for (let p = 0; p < z.pairs.length; p++) {
                const [a, b, cc, d] = z.face(bases, p).map((m) => at(z, m));
                const len = (u, v) => Math.hypot(v[0] - u[0], v[1] - u[1], v[2] - u[2]);
                for (const [u, v] of [[a, b], [b, cc], [cc, d], [d, a]]) {
                    assert.ok(Math.abs(len(u, v) - Math.sqrt(5) / 2) < 1e-12, "edge");
                }
                const p1 = len(a, cc), p2 = len(b, d);
                const ratio = Math.max(p1, p2) / Math.min(p1, p2);
                assert.ok(Math.abs(ratio - PHI) < 1e-12, `diagonals ${ratio}`);
            }
        }
    }
});

test("one family has (k-1)! routes, the same count for every family", () => {
    const want = { 3: 2, 4: 6, 5: 24 };
    for (const c of cases) {
        const z = zonohedronOf(dirs, c.fams);
        const counts = [];
        for (let f = 0; f < z.k; f++) {
            const seen = new Set();
            for (const bases of z.readings) {
                const r = z.route(bases, f);
                assert.equal(r.length, z.k - 1, "a ribbon crosses each other family once");
                seen.add(r.join(""));
            }
            counts.push(seen.size);
        }
        assert.deepEqual(counts, counts.map(() => want[z.k]), `${c.name} routes`);
    }
});

test("the decagon's two poles are one plane point, five levels apart", () => {
    const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
    const bottom = at(z, 0), top = at(z, 31);
    assert.ok(Math.hypot(top[0] - bottom[0], top[1] - bottom[1]) < 1e-12,
              "sum of the five directions is zero, so they share a shadow");
    assert.ok(Math.abs(top[2] - bottom[2] - 5 * RISE) < 1e-12, "five levels apart");
    // 32 corners of the cube, 31 points in the plane
    const flat = new Set();
    for (let m = 0; m < 32; m++) {
        const [x, y] = at(z, m);
        flat.add(`${Math.round(x * 1e9)},${Math.round(y * 1e9)}`);
    }
    assert.equal(flat.size, 31);
});

// ---------------------------------------------------------------------------
// Against resolve.ts: the solid has to stand inside the polygon the page draws.

import { scanRegions } from "../dist/geometry/regularity.js";
import { resolveConcurrency } from "../dist/geometry/resolve.js";
import { vertexIndex } from "../dist/geometry/roof.js";

const polyArea = (p) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
        s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
};
const inside = (p, [x, y]) => {
    // convex, and the outline runs one way round; allow the boundary
    let sign = 0;
    for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
        const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
        if (Math.abs(c) < 1e-9) continue;
        if (sign === 0) sign = Math.sign(c);
        else if (Math.sign(c) !== sign) return false;
    }
    return true;
};

test("every reading stands inside the 2k-gon and fills it", () => {
    const g = createGammaSet({ guard: false });
    g.setSum(0, true);                      // the singular patch: hexagons and the decagon
    const { concurrencies } = scanRegions(g.model, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
                                          { scale: 1 });
    const seen = new Set();
    let checked = 0;
    for (const c of concurrencies) {
        const res = resolveConcurrency(g.model, c);
        if (!res) continue;
        seen.add(res.name);
        const z = zonohedronOf(g.model.directions, res.families);
        const anchor = zonogonAnchor(z, res.outline, res.outlineK, g.model.directions);
        const start = anchor.origin;
        const outArea = polyArea(res.outline);
        for (const bases of z.readings) {
            let area = 0;
            for (let p = 0; p < z.pairs.length; p++) {
                const quad = z.face(bases, p).map((mask) => {
                    let x = start[0], y = start[1];
                    for (let l = 0; l < z.k; l++) {
                        if (!(mask >> l & 1)) continue;
                        x += g.model.directions[z.fams[l]][0];
                        y += g.model.directions[z.fams[l]][1];
                    }
                    return [x, y];
                });
                for (const q of quad) {
                    assert.ok(inside(res.outline, q),
                              `${res.name}: a corner fell outside the outline`);
                }
                area += polyArea(quad);
            }
            assert.ok(Math.abs(area - outArea) < 1e-9,
                      `${res.name}: the reading does not fill the polygon`);
            checked++;
        }
    }
    assert.ok(seen.has("decagon"), "the Σγ = 0 patch has its decagon");
    assert.ok(checked > 60, `only ${checked} readings checked`);
});

test("a corner's height is the de Bruijn index the tiling gives it", () => {
    const g = createGammaSet({ guard: false });
    g.setSum(0, true);
    const { concurrencies } = scanRegions(g.model, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 },
                                          { scale: 1 });
    let checked = 0;
    for (const c of concurrencies) {
        const res = resolveConcurrency(g.model, c);
        if (!res) continue;
        const z = zonohedronOf(g.model.directions, res.families);
        const anchor = zonogonAnchor(z, res.outline, res.outlineK, g.model.directions);
        // Every outline corner is some mask; its height must agree both ways.
        res.outlineK.forEach((K) => {
            let mask = 0;
            for (let l = 0; l < z.k; l++) {
                const j = z.fams[l];
                let lo = Infinity;
                for (const Q of res.outlineK) if (Q[j] < lo) lo = Q[j];
                if (K[j] - lo) mask |= 1 << l;
            }
            assert.equal(anchor.index + popcount(mask), vertexIndex(K),
                         `${res.name}: a corner's height disagrees with its K-tuple`);
            checked++;
        });
    }
    assert.ok(checked > 20, `only ${checked} corners checked`);
});
