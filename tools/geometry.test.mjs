// Tests for the geometry layer, against the same code the page runs.
//
// Everything here was verified once as a throwaway script during development and
// then thrown away — the scan, the regularity criterion, the 5/2 gain, the arc
// joins — which meant four separate re-derivations, any of which could have
// drifted from what shipped. These import the real modules instead.
//
// Where a test needs an oracle it is written out longhand here rather than
// imported. That is deliberate: the oracle has to be independent of the thing
// under test, or it proves nothing.

import test from "node:test";
import assert from "node:assert/strict";

import {
    NUM_GRIDS, collectRhombs, computeKTuple, dualVertex, makeDirections,
    solveIntersection,
} from "../dist/geometry/pentagrid.js";
import { TRIPLES, noIntegerGamma, scanRegions, singularTriples } from "../dist/geometry/regularity.js";
import { ARC_T, rhombArcs } from "../dist/geometry/decor.js";
import { regionPoly } from "../dist/geometry/region.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const dirs = makeDirections(true);
const pg = (gamma) => ({ directions: dirs, gamma });
const GENERIC = [0.13, -0.37, 0.51, -0.08, -0.19];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── the frame ─────────────────────────────────────────────────────

test("the five directions form a tight frame: Sum v_j v_j^T = (5/2) I", () => {
    let xx = 0, xy = 0, yy = 0, sx = 0, sy = 0;
    for (const [x, y] of dirs) { xx += x * x; xy += x * y; yy += y * y; sx += x; sy += y; }
    assert.ok(near(xx, 2.5, 1e-12), `xx = ${xx}`);
    assert.ok(near(yy, 2.5, 1e-12), `yy = ${yy}`);
    assert.ok(near(xy, 0, 1e-12), `xy = ${xy}`);
    // Sum v_j = 0 is what makes the wobble mean-zero rather than merely bounded.
    assert.ok(near(sx, 0, 1e-12) && near(sy, 0, 1e-12));
});

test("vertical symmetry puts v0 up and mirrors the star about the vertical", () => {
    assert.ok(near(dirs[0][0], 0, 1e-12), "v0 x-component");
    assert.ok(near(dirs[0][1], 1, 1e-12), "v0 y-component");
    // mirroring x -> -x must permute the direction set
    for (const [x, y] of dirs) {
        assert.ok(dirs.some(([u, v]) => near(u, -x, 1e-12) && near(v, y, 1e-12)),
                  `no mirror partner for ${x},${y}`);
    }
});

// ── the dual map ──────────────────────────────────────────────────

test("f(x) = (5/2)x + const + bounded wobble", () => {
    const g = [1e-4, 2e-4, 3e-4, 4e-4, -1e-3];
    let sxx = 0, sxf = 0, maxDev = 0;
    for (let t = 0; t < 20000; t++) {
        const r = 60 * Math.sqrt(Math.random()), th = 2 * Math.PI * Math.random();
        const x = r * Math.cos(th), y = r * Math.sin(th);
        const [fx, fy] = dualVertex(pg(g), computeKTuple(pg(g), x, y));
        sxx += x * x + y * y;
        sxf += x * fx + y * fy;
        maxDev = Math.max(maxDev, Math.hypot(fx - 2.5 * x, fy - 2.5 * y));
    }
    const gain = sxf / sxx;
    assert.ok(Math.abs(gain - 2.5) < 0.01, `gain ${gain}`);
    // bounded, and nowhere near growing with the radius it was sampled over
    assert.ok(maxDev < 4, `wobble ${maxDev}`);
});

test("rhombs carry provenance that actually locates them", () => {
    const g = GENERIC;
    const rhombs = collectRhombs(pg(g), { xMin: -12, xMax: 12, yMin: -12, yMax: 12 },
                                 { gain: 2.5 });
    assert.ok(rhombs.length > 200, `only ${rhombs.length} rhombs`);
    for (const r of rhombs) {
        // x0 lies on both lines that made it
        const da = dirs[r.j][0] * r.x0 + dirs[r.j][1] * r.y0 + g[r.j];
        const db = dirs[r.k][0] * r.x0 + dirs[r.k][1] * r.y0 + g[r.k];
        assert.ok(near(da, r.nj, 1e-9), `x0 off line j: ${da} vs ${r.nj}`);
        assert.ok(near(db, r.nk, 1e-9), `x0 off line k: ${db} vs ${r.nk}`);
        // and the tile sits near 5/2 times it
        const [cxr, cyr] = [
            r.vertices.reduce((a, v) => a + v[0], 0) / 4,
            r.vertices.reduce((a, v) => a + v[1], 0) / 4,
        ];
        assert.ok(Math.hypot(cxr - 2.5 * r.x0, cyr - 2.5 * r.y0) < 2.5,
                  "tile far from its own crossing");
    }
});

// ── regularity ────────────────────────────────────────────────────

/** Independent oracle: hunt for concurrent triples by direct search. */
function bruteSingular(gamma, R = 12) {
    const found = new Set();
    for (let a = 0; a < NUM_GRIDS; a++)
        for (let b = a + 1; b < NUM_GRIDS; b++)
            for (let c = b + 1; c < NUM_GRIDS; c++)
                for (let na = -R; na <= R; na++)
                    for (let nb = -R; nb <= R; nb++) {
                        const P = solveIntersection(pg(gamma), a, b, na, nb);
                        if (!P || Math.hypot(P[0], P[1]) > R) continue;
                        const d = dirs[c][0] * P[0] + dirs[c][1] * P[1] + gamma[c];
                        if (Math.abs(d - Math.round(d)) < 1e-9) found.add(`${a}${b}${c}`);
                    }
    return [...found].sort();
}
const toQ = (g, den) => g.map((x) => Math.round(x * den));

test("the exact criterion agrees with brute-force search", () => {
    // A fine denominator, so the 5e-9 case is representable at all — see the
    // quantisation test below for why that is not a given.
    const den = 1e9;
    const cases = [
        [0, 0, 0, 0, 0],                       // all ten triples
        [0, 5e-9, 0, 0, -5e-9],                // the old nudge: 014 and 023 survive
        GENERIC,                               // regular
        [1, -0.3, 0.3, -0.5, 0.5],             // integer gamma, still regular
        [1, -0.3, 0.3, 0.7, -1.7],             // integer gamma, 023 singular
        [0.5, 2, -0.5, 0.25, -2.25],           // 012 and 134
    ];
    for (const g of cases) {
        const predicted = singularTriples(toQ(g, den), den).sort();
        assert.deepEqual(predicted, bruteSingular(g),
                         `gamma = [${g}]`);
    }
});

test("a symmetric nudge leaves 014 and 023 singular at any size", () => {
    const den = 1e9;
    for (const eps of [5e-9, 1e-6, 1e-3, 0.25]) {
        const g = [0, eps, 0, 0, -eps];
        assert.deepEqual(singularTriples(toQ(g, den), den).sort(), ["014", "023"],
                         `symmetric nudge of ${eps} should not help`);
    }
    // Because it is symmetric it preserves gamma_1 + gamma_4 = 0, and it leaves
    // gamma_0, gamma_2, gamma_3 on the integers. Magnitude was never the issue.
});

test("an asymmetric nudge of one unit clears every triple", () => {
    const den = 10000;
    // what the guard actually does from the singular default
    const q = [1, 2, 3, 4, -10];
    assert.equal(q.reduce((a, b) => a + b, 0), 0, "the sum-zero constraint must survive");
    assert.deepEqual(singularTriples(q, den), []);
    assert.ok(noIntegerGamma(q, den));
});

test("the page's denominator cannot represent a 5e-9 nudge at all", () => {
    // 5e-9 over 1/10000 rounds to zero, so at the page's precision the old nudge
    // is not merely ineffective, it does not exist. A second, independent reason
    // it could never have worked in the shipped code.
    const den = 10000;
    const q = toQ([0, 5e-9, 0, 0, -5e-9], den);
    // Compared with === rather than deepEqual: Math.round(-5e-5) is -0, which is
    // strictly-deep-unequal to 0 but behaves as zero everywhere it matters,
    // including the criterion's `% den === 0`.
    for (const v of q) assert.ok(v === 0, `expected zero, got ${v}`);
    assert.equal(singularTriples(q, den).length, 10);
});

test("no integer gamma implies regular, everywhere", () => {
    const den = 10000;
    let checked = 0;
    for (let t = 0; t < 60; t++) {
        const g = [];
        for (let j = 0; j < 4; j++) g.push(Math.round((Math.random() * 4 - 2) * den) / den);
        g.push(-g.reduce((a, b) => a + b, 0));
        const q = toQ(g, den);
        if (!noIntegerGamma(q, den)) continue;
        checked++;
        assert.equal(singularTriples(q, den).length, 0);
        assert.deepEqual(bruteSingular(g), []);
    }
    assert.ok(checked > 40, `only ${checked} configurations qualified`);
});

test("every triple has a lone gamma, which is why the corollary holds", () => {
    assert.equal(TRIPLES.length, 10);
    const loneCount = new Map();
    for (const [, L] of TRIPLES) loneCount.set(L, (loneCount.get(L) ?? 0) + 1);
    // each family is the lone one for exactly two triples
    for (let j = 0; j < NUM_GRIDS; j++) assert.equal(loneCount.get(j), 2, `family ${j}`);
});

// ── the small-region scan ─────────────────────────────────────────

test("every region the scan reports is one genuine region", () => {
    const g = GENERIC;
    const vis = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
    const { small } = scanRegions(pg(g), vis, { scale: 60 });
    assert.ok(small.length > 20, `only ${small.length} found`);
    const sorted = [...small].sort((a, b) => a.size - b.size).slice(0, 15);
    for (const r of sorted) {
        const inr = r.size / 2 / 60; // back to math units
        const K0 = computeKTuple(pg(g), r.x, r.y).join(",");
        for (let t = 0; t < 64; t++) {
            const th = 2 * Math.PI * t / 64;
            const p = [r.x + 0.7 * inr * Math.cos(th), r.y + 0.7 * inr * Math.sin(th)];
            assert.equal(computeKTuple(pg(g), p[0], p[1]).join(","), K0,
                         "interior of a reported region is not one region");
        }
        let differs = false;
        for (let t = 0; t < 64 && !differs; t++) {
            const th = 2 * Math.PI * t / 64;
            const p = [r.x + 3 * inr * Math.cos(th), r.y + 3 * inr * Math.sin(th)];
            if (computeKTuple(pg(g), p[0], p[1]).join(",") !== K0) differs = true;
        }
        assert.ok(differs, "reported region is not bounded");
    }
});

test("a singular gamma reports concurrencies, a generic one reports none", () => {
    const vis = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
    const sing = scanRegions(pg([0, 0, 0, 0, 0]), vis, { scale: 60 });
    assert.ok(sing.concurrencies.length > 0);
    const origin = sing.concurrencies.find((c) => Math.hypot(c.x, c.y) < 1e-9);
    assert.ok(origin, "the origin concurrency was not found");
    assert.equal(origin.lines, 5, "all five families meet at the origin when gamma = 0");

    const ok = scanRegions(pg(GENERIC), vis, { scale: 60 });
    assert.deepEqual(ok.concurrencies, []);
});

// ── the region polygon, the map run backwards ─────────────────────

test("regionPoly recovers a polygon whose interior has the K-tuple asked for", () => {
    const g = GENERIC;
    const vis = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
    for (const [x, y] of [[0.4, 0.2], [-2.1, 1.3], [3.05, -2.4]]) {
        const K = computeKTuple(pg(g), x, y);
        const poly = regionPoly(pg(g), K, vis);
        assert.ok(poly.length >= 3, "degenerate polygon");
        const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
        const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
        assert.deepEqual(computeKTuple(pg(g), cx, cy), K,
                         "polygon centroid has a different K-tuple");
    }
});

// ── the arc decoration ────────────────────────────────────────────

test("arc radii sum to 1, which is what makes them meet", () => {
    assert.ok(near(ARC_T, 1 / (PHI * PHI), 1e-12));
    assert.ok(near(ARC_T + (1 - ARC_T), 1, 1e-12));
});

test("arcs join across every shared edge", () => {
    const g = [1e-4, 2e-4, 3e-4, 4e-4, -1e-3];
    const rhombs = collectRhombs(pg(g), { xMin: -14, xMax: 14, yMin: -14, yMax: 14 },
                                 { gain: 2.5 });
    // Key each edge by its tail vertex and family; the crossing point recorded
    // from either rhomb on that edge must be the same point.
    const seen = new Map();
    let shared = 0;
    for (const r of rhombs) {
        const [fx, fy] = r.vertices[0];
        const [vj, vk] = [dirs[r.j], dirs[r.k]];
        const tails = [
            [fx, fy, r.j], [fx, fy, r.k],
            [fx + vk[0], fy + vk[1], r.j], [fx + vj[0], fy + vj[1], r.k],
        ];
        for (const [ax, ay, fam] of tails) {
            const key = `${Math.round(ax * 1e6)},${Math.round(ay * 1e6)},${fam}`;
            const pt = [ax + ARC_T * dirs[fam][0], ay + ARC_T * dirs[fam][1]];
            if (seen.has(key)) {
                shared++;
                const q = seen.get(key);
                assert.ok(Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 1e-12,
                          "arc crossing points disagree on a shared edge");
            } else seen.set(key, pt);
        }
    }
    assert.ok(shared > 500, `only ${shared} shared edges exercised`);
});

test("each rhomb yields two arcs, on opposite corners, radii summing to 1", () => {
    const rhombs = collectRhombs(pg(GENERIC), { xMin: -8, xMax: 8, yMin: -8, yMax: 8 },
                                 { gain: 2.5 });
    for (const r of rhombs.slice(0, 200)) {
        const [a, b] = rhombArcs(pg(GENERIC), r);
        assert.ok(near(a.r + b.r, 1, 1e-12));
        assert.deepEqual([a.x, a.y], r.vertices[0]);
        assert.deepEqual([b.x, b.y], r.vertices[2]);
    }
});
