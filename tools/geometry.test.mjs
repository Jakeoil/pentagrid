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
    solveIntersection, segmentAt, nearestLine,
} from "../dist/geometry/pentagrid.js";
import { TRIPLES, noIntegerGamma, scanRegions, singularTriples } from "../dist/geometry/regularity.js";
import { ARC_T, PENTA_R, rhombArcs, rhombArrows, rhombPentagons, rhombDeflation, rhombKitesDarts } from "../dist/geometry/decor.js";
import { regionPoly } from "../dist/geometry/region.js";
import { createGammaSet } from "../dist/geometry/gamma.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const dirs = makeDirections(true);
const pg = (gamma) => ({ n: dirs.length, directions: dirs, gamma });
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

// ── the perpendicular plane (PLAN.md, E1 reading (b)) ─────────────

import { regionPoly as _regionPoly } from "../dist/geometry/region.js";

const unit = (u) => { const n = Math.hypot(...u); return u.map((x) => x / n); };
const ang = (j) => Math.atan2(dirs[j][1], dirs[j][0]);
const E3 = unit([0,1,2,3,4].map((j) => Math.cos(2 * ang(j))));
const E4 = unit([0,1,2,3,4].map((j) => Math.sin(2 * ang(j))));
const perpGamma = (p, q) => [0,1,2,3,4].map((j) => p * E3[j] + q * E4[j]);
const FEAS = { xMin: -80, xMax: 80, yMin: -80, yMax: 80 };
const realised = (gamma, K) => _regionPoly(pg(gamma), K, FEAS).length >= 3;

test("E_par and E_perp are orthogonal, and both are orthogonal to the sum", () => {
    const d = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
    const A = dirs.map((v) => v[0]), B = dirs.map((v) => v[1]);
    for (const [u, name] of [[A, "A"], [B, "B"]]) {
        assert.ok(near(d(u, E3), 0, 1e-12), `${name}·E3`);
        assert.ok(near(d(u, E4), 0, 1e-12), `${name}·E4`);
    }
    assert.ok(near(d(E3, [1,1,1,1,1]), 0, 1e-12));
    assert.ok(near(d(E3, E4), 0, 1e-12));
});

test("shifting gamma inside E_par leaves the tiling literally unchanged", () => {
    const g0 = GENERIC;
    const box = { xMin: -14, xMax: 14, yMin: -14, yMax: 14 };
    const sig = (g) => new Set(collectRhombs(pg(g), box, { gain: 2.5 }).map((r) => {
        const vj = dirs[r.j], vk = dirs[r.k], f = r.vertices[0];
        const cx = f[0] + (vj[0] + vk[0]) / 2, cy = f[1] + (vj[1] + vk[1]) / 2;
        return `${r.j}${r.k}${r.thick ? 1 : 0}|${Math.round(cx * 1e6)},${Math.round(cy * 1e6)}`;
    }));
    const base = sig(g0);
    for (const [a, b] of [[0.37, -0.62], [1.5, 0.9], [-2.2, 3.1]]) {
        const g = g0.map((x, j) => x + a * dirs[j][0] + b * dirs[j][1]);
        assert.ok(near(g.reduce((x, y) => x + y, 0), 0, 1e-12), "sum-zero must survive");
        const s = sig(g);
        assert.equal(s.size, base.size);
        for (const k of s) assert.ok(base.has(k), `E_par shift moved a tile: w=(${a},${b})`);
    }
});

test("shifting gamma inside E_perp does change the tiling", () => {
    const box = { xMin: -14, xMax: 14, yMin: -14, yMax: 14 };
    const sig = (g) => new Set(collectRhombs(pg(g), box, { gain: 2.5 })
        .map((r) => `${r.j}${r.k}|${Math.round(r.vertices[0][0] * 1e6)},${Math.round(r.vertices[0][1] * 1e6)}`));
    const base = sig(GENERIC);
    const moved = sig(GENERIC.map((x, j) => x + 0.4 * E3[j]));
    let same = 0;
    for (const k of moved) if (base.has(k)) same++;
    assert.ok(same < moved.size * 0.3, `E_perp shift changed too little: ${same}/${moved.size}`);
});

test("the acceptance region is convex and shrinks as the patch grows", () => {
    const p0 = 0.31, q0 = -0.17;
    const patchAt = (r) => {
        const g = perpGamma(p0, q0), P = pg(g);
        const seen = new Set(), out = [];
        for (let x = -r - 1; x <= r + 1; x += 0.08)
            for (let y = -r - 1; y <= r + 1; y += 0.08) {
                const K = computeKTuple(P, x, y), key = K.join(",");
                if (seen.has(key)) continue;
                seen.add(key);
                const f = dualVertex(P, K);
                if (Math.hypot(f[0], f[1]) <= r) out.push(K);
            }
        return out;
    };
    const holds = (p, q, patch) => {
        const g = perpGamma(p, q);
        return patch.every((K) => realised(g, K));
    };
    let prevArea = Infinity, prevCount = 0;
    for (const r of [1.2, 2.5, 4]) {
        const patch = patchAt(r);
        assert.ok(patch.length > prevCount, "patch did not grow");
        prevCount = patch.length;
        assert.ok(holds(p0, q0, patch), "the anchoring gamma must be inside its own region");

        const RAYS = 72, rad = [];
        for (let i = 0; i < RAYS; i++) {
            const a = 2 * Math.PI * i / RAYS, dx = Math.cos(a), dy = Math.sin(a);
            let lo = 0, hi = 2.5;
            if (holds(p0 + hi * dx, q0 + hi * dy, patch)) lo = hi;
            else for (let s = 0; s < 20; s++) {
                const m = (lo + hi) / 2;
                if (holds(p0 + m * dx, q0 + m * dy, patch)) lo = m; else hi = m;
            }
            rad.push(lo);
        }
        // convex: the midpoint of any chord of the boundary must still hold
        for (let t = 0; t < 120; t++) {
            const i = t % RAYS, k = (t * 7 + 13) % RAYS;
            const ai = 2 * Math.PI * i / RAYS, ak = 2 * Math.PI * k / RAYS;
            const mx = (p0 + rad[i] * Math.cos(ai) + p0 + rad[k] * Math.cos(ak)) / 2;
            const my = (q0 + rad[i] * Math.sin(ai) + q0 + rad[k] * Math.sin(ak)) / 2;
            assert.ok(holds(mx, my, patch), "acceptance region is not convex");
        }
        let area = 0;
        for (let i = 0; i < RAYS; i++)
            area += 0.5 * rad[i] * rad[(i + 1) % RAYS] * Math.sin(2 * Math.PI / RAYS);
        assert.ok(area <= prevArea + 1e-12, `room grew as the patch grew: ${area} > ${prevArea}`);
        prevArea = area;
    }
});

// ── the Wieringa lift ─────────────────────────────────────────────

import {
    RISE, ROOF_EDGE, faceNormal, liftLocal, vertexIndex,
} from "../dist/geometry/roof.js";

const roofRhombs = () => collectRhombs(pg(GENERIC),
    { xMin: -14, xMax: 14, yMin: -14, yMax: 14 }, { gain: 2.5 });

test("every lifted edge is the golden rhombus edge, sqrt(5)/2", () => {
    const P = pg(GENERIC);
    let lo = Infinity, hi = 0;
    for (const r of roofRhombs()) {
        const c = [[0,0],[1,0],[1,1],[0,1]].map(([a, b]) => liftLocal(P, r, a, b));
        for (let i = 0; i < 4; i++) {
            const A = c[i], B = c[(i + 1) % 4];
            const L = Math.hypot(B[0]-A[0], B[1]-A[1], B[2]-A[2]);
            lo = Math.min(lo, L); hi = Math.max(hi, L);
        }
    }
    assert.ok(near(lo, ROOF_EDGE, 1e-12) && near(hi, ROOF_EDGE, 1e-12), `${lo}..${hi}`);
});

test("both rhomb types lift to the SAME golden rhombus, diagonals phi:1", () => {
    const P = pg(GENERIC);
    let sawThick = false, sawThin = false;
    for (const r of roofRhombs().slice(0, 400)) {
        const A = liftLocal(P, r, 0, 0), B = liftLocal(P, r, 1, 0);
        const C = liftLocal(P, r, 1, 1), D = liftLocal(P, r, 0, 1);
        const d1 = Math.hypot(C[0]-A[0], C[1]-A[1], C[2]-A[2]);
        const d2 = Math.hypot(D[0]-B[0], D[1]-B[1], D[2]-B[2]);
        const ratio = Math.max(d1, d2) / Math.min(d1, d2);
        assert.ok(near(ratio, PHI, 1e-9), `${r.thick ? "thick" : "thin"} ratio ${ratio}`);
        if (r.thick) sawThick = true; else sawThin = true;
    }
    assert.ok(sawThick && sawThin, "did not see both types");
});

test("the index runs exactly 1..4, so the roof has four levels", () => {
    const P = pg(GENERIC);
    const levels = new Set();
    for (const r of roofRhombs())
        for (const K of r.kTuples) levels.add(vertexIndex(K));
    assert.deepEqual([...levels].sort((a, b) => a - b), [1, 2, 3, 4]);
    assert.equal(RISE, 0.5);
});

test("fold angles are 36, 72 or 108 and never flat", () => {
    const P = pg(GENERIC);
    const rhombs = roofRhombs();
    const key = (p) => `${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)},${Math.round(p[2]*1e6)}`;
    const edges = new Map();
    for (const r of rhombs) {
        const c = [[0,0],[1,0],[1,1],[0,1]].map(([a, b]) => liftLocal(P, r, a, b));
        for (let i = 0; i < 4; i++) {
            const k = [key(c[i]), key(c[(i+1)%4])].sort().join("|");
            const l = edges.get(k);
            if (l) l.push(r); else edges.set(k, [r]);
        }
    }
    const byKind = new Map();
    let shared = 0;
    for (const rs of edges.values()) {
        if (rs.length !== 2) continue;
        shared++;
        const n1 = faceNormal(P, rs[0]), n2 = faceNormal(P, rs[1]);
        const dot = Math.min(1, Math.max(-1, n1[0]*n2[0] + n1[1]*n2[1] + n1[2]*n2[2]));
        const deg = Math.acos(dot) * 180 / Math.PI;
        assert.ok(deg > 1e-6, "an interior edge came out flat");
        const rounded = Math.round(deg);
        assert.ok([36, 72, 108].includes(rounded), `fold angle ${deg}`);
        assert.ok(near(deg, rounded, 1e-9), `fold angle not exact: ${deg}`);
        const kind = [rs[0].thick ? "thick" : "thin", rs[1].thick ? "thick" : "thin"].sort().join("|");
        if (!byKind.has(kind)) byKind.set(kind, new Set());
        byKind.get(kind).add(rounded);
    }
    assert.ok(shared > 1000, `only ${shared} interior edges`);
    // wieringa-roof's independently verified table
    assert.deepEqual([...byKind.get("thick|thick")].sort((a,b)=>a-b), [36]);
    assert.deepEqual([...byKind.get("thick|thin")].sort((a,b)=>a-b), [36, 72]);
    assert.deepEqual([...byKind.get("thin|thin")].sort((a,b)=>a-b), [108]);
});

test("adjacent tiles on a ribbon share an attachment midpoint exactly", () => {
    // What the growth renderer seals its gaps against. Note "consecutive along
    // the line" is not the same as "adjacent": collectRhombs culls tiles at the
    // edge of a patch, so a consecutive pair can straddle a missing one — which
    // is why the renderer checks before drawing a seam. Whether that happens
    // depends on where the boundary falls, so this sweeps several windows.
    const P = pg(GENERIC);
    let totalSealed = 0, totalStraddled = 0, worst = 0;
    for (const R of [4, 8, 16, 30]) {
        const rhombs = collectRhombs(P, { xMin: -R, xMax: R, yMin: -R, yMax: R },
                                     { gain: 2.5 });
        for (let fam = 0; fam < NUM_GRIDS; fam++) {
            const [vx, vy] = dirs[fam], px = -vy, py = vx;
            const byLine = new Map();
            for (const r of rhombs) {
                const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
                if (n === null) continue;
                if (!byLine.has(n)) byLine.set(n, []);
                byLine.get(n).push(r);
            }
            const seam = (r) => {
                const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
                const at = (a, b) => [v0[0] + a * vj[0] + b * vk[0], v0[1] + a * vj[1] + b * vk[1]];
                const pair = fam === r.j ? [at(0.5, 0), at(0.5, 1)] : [at(0, 0.5), at(1, 0.5)];
                const proj = (p) => p[0] * px + p[1] * py;
                return proj(pair[0]) <= proj(pair[1])
                    ? { entry: pair[0], exit: pair[1] } : { entry: pair[1], exit: pair[0] };
            };
            for (const tiles of byLine.values()) {
                if (tiles.length < 2) continue;
                tiles.sort((a, b) => (a.x0 * px + a.y0 * py) - (b.x0 * px + b.y0 * py));
                for (let i = 1; i < tiles.length; i++) {
                    const a = seam(tiles[i - 1]), b = seam(tiles[i]);
                    const d = Math.hypot(a.exit[0] - b.entry[0], a.exit[1] - b.entry[1]);
                    if (d > 1e-6) { totalStraddled++; continue; }
                    totalSealed++;
                    worst = Math.max(worst, d);
                }
            }
        }
    }
    assert.ok(totalSealed > 5000, `only ${totalSealed} seams found`);
    assert.ok(worst < 1e-12, `seams do not meet: worst ${worst}`);
    // the guard has to earn its place, but it should be rare
    assert.ok(totalStraddled > 0, "no straddled pair anywhere — is the guard needed?");
    assert.ok(totalStraddled < totalSealed * 0.01,
              `${totalStraddled} straddled against ${totalSealed} sealed`);
});

test("a heptagrid dualises to three rhombs, not two", () => {
    // floor(n/2) shapes, corner angle 2*pi*cls/n. The pentagrid's two are the
    // special case, and `thick` is a name only it can carry.
    const dirs7 = makeDirections(false, 7);
    const g7 = { n: 7, directions: dirs7, gamma: [.1, .2, .3, .15, .25, .05, .12] };
    const tiles = collectRhombs(g7, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 });
    assert.ok(tiles.length > 100);

    const classes = new Set(tiles.map((t) => t.cls));
    assert.deepEqual([...classes].sort(), [1, 2, 3]);

    for (const t of tiles) {
        // The corner at vertex 0 spans v_j to v_k, which are 2*pi*cls/n apart.
        const [a, b] = [t.vertices[1], t.vertices[3]].map((v) =>
            [v[0] - t.vertices[0][0], v[1] - t.vertices[0][1]]);
        const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
        const deg = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
        assert.ok(Math.abs(deg - 360 * t.cls / 7) < 1e-9,
                  `cls ${t.cls} should be ${360 * t.cls / 7}deg, got ${deg}`);
    }

    // and the pentagrid still makes exactly two, with cls 1 the fat one
    const g5 = pg([.1, .2, .3, .15, .25]);
    const five = collectRhombs(g5, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 });
    assert.deepEqual([...new Set(five.map((t) => t.cls))].sort(), [1, 2]);
    assert.ok(five.every((t) => t.thick === (t.cls === 1)));
});

test("rhomb classes appear in proportion to |sin 2*pi*c/n|", () => {
    // Two families at angle theta cross at a rate proportional to |sin theta|,
    // and every crossing is one tile — so that is the frequency of the shape.
    // This is the number quoted on grow7.html, so it is pinned here.
    const dirs = makeDirections(false, 7);
    const gamma = new Array(7).fill(1 / 7);
    const tiles = collectRhombs({ n: 7, directions: dirs, gamma },
                                { xMin: -30, xMax: 30, yMin: -30, yMax: 30 },
                                { maxNCap: 200 });
    assert.ok(tiles.length > 4000, `only ${tiles.length} tiles`);

    const s = (c) => Math.abs(Math.sin(2 * Math.PI * c / 7));
    const total = s(1) + s(2) + s(3);
    const seen = { 1: 0, 2: 0, 3: 0 };
    for (const t of tiles) seen[t.cls]++;

    for (const c of [1, 2, 3]) {
        const got = 100 * seen[c] / tiles.length;
        const want = 100 * s(c) / total;
        assert.ok(Math.abs(got - want) < 0.6,
                  `class ${c}: ${got.toFixed(2)}% vs predicted ${want.toFixed(2)}%`);
    }
    // and the ordering the page states: cls 2 commonest, cls 3 rarest
    assert.ok(seen[2] > seen[1] && seen[1] > seen[3]);
});

// Gridline segment -> Penrose edge. The same dual map as region -> vertex and
// crossing -> tile, read one dimension down: a segment separates two regions, so
// it becomes the edge joining the vertices those two regions become.
test("a gridline segment is dual to a Penrose edge", () => {
    for (const n of [5, 7]) {
        const g = createGammaSet({ n, guard: true });
        const pg = g.model;

        // Every tile edge in a generous patch, canonically keyed.
        const key = (a, b) => [a, b]
            .map((p) => p.map((v) => v.toFixed(6)).join(",")).sort().join("|");
        const edges = new Set();
        for (const r of collectRhombs(pg, { xMin: -9, xMax: 9, yMin: -9, yMax: 9 },
                                      { gain: n / 2 })) {
            for (let i = 0; i < 4; i++) {
                edges.add(key(r.vertices[i], r.vertices[(i + 1) % 4]));
            }
        }

        let seen = 0;
        for (let i = 0; i < 600; i++) {
            const x = (i % 25) / 25 * 6 - 3, y = Math.floor(i / 25) / 24 * 6 - 3;
            const near = nearestLine(pg, x, y);
            assert.ok(near, `n = ${n}: no nearest line`);
            // Step exactly onto that line before asking for the segment.
            const [vx, vy] = pg.directions[near.j];
            const d = vx * x + vy * y + pg.gamma[near.j];
            const px = x + (near.nj - d) * vx, py = y + (near.nj - d) * vy;
            const seg = segmentAt(pg, near.j, near.nj, px, py, 6);
            if (!seg) continue;

            // The two regions differ in exactly the one coordinate.
            const diff = seg.K2.map((v, m) => v - seg.K1[m]);
            assert.deepEqual(diff, diff.map((_, m) => (m === seg.j ? 1 : 0)),
                             `n = ${n}: the segment's regions differ off family ${seg.j}`);

            // So their vertices differ by exactly v_j: a unit edge, right direction.
            const A = dualVertex(pg, seg.K1), B = dualVertex(pg, seg.K2);
            assert.ok(Math.hypot(B[0] - A[0] - vx, B[1] - A[1] - vy) < 1e-9,
                      `n = ${n}: dual edge is not v${seg.j}`);

            // And it is a real edge of the tiling, not merely a plausible one.
            const far = 4;
            if (Math.max(Math.abs(A[0]), Math.abs(A[1]),
                         Math.abs(B[0]), Math.abs(B[1])) > far) continue;
            seen++;
            assert.ok(edges.has(key(A, B)),
                      `n = ${n}: dual of segment (${seg.j}, ${seg.nj}) is not a tile edge`);
        }
        assert.ok(seen > 50, `n = ${n}: only ${seen} segments landed inside the patch`);
    }
});

// The ends of a segment are crossings, so nothing else may cut it open.
test("a segment runs between consecutive crossings", () => {
    const g = createGammaSet({ guard: true });
    const pg = g.model;
    for (let i = 0; i < 200; i++) {
        const x = (i % 20) / 20 * 5 - 2.5, y = Math.floor(i / 20) / 10 * 5 - 2.5;
        const near = nearestLine(pg, x, y);
        const [vx, vy] = pg.directions[near.j];
        const d = vx * x + vy * y + pg.gamma[near.j];
        const seg = segmentAt(pg, near.j, near.nj,
                              x + (near.nj - d) * vx, y + (near.nj - d) * vy, 6);
        if (!seg) continue;
        // Sample the interior: the K-tuple must not change anywhere along it.
        const K0 = computeKTuple(pg, (seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2);
        for (const t of [0.15, 0.35, 0.65, 0.85]) {
            const qx = seg.a[0] + t * (seg.b[0] - seg.a[0]);
            const qy = seg.a[1] + t * (seg.b[1] - seg.a[1]);
            // Just off the low side, where K_j = nj and the rest is the region.
            const K = computeKTuple(pg, qx - 1e-7 * vx, qy - 1e-7 * vy);
            assert.deepEqual(K, K0,
                             `segment (${seg.j}, ${seg.nj}) is cut at t = ${t}`);
        }
    }
});

// Computing over a wider rect than is shown. A dual vertex on screen has its
// source region within a bounded wobble of it, so a region can lie partly or
// wholly outside the visible rect while its vertex is well inside — and clipping
// the region to the visible rect then leaves nothing to point at.
test("every on-screen dual vertex keeps its source region when the rect is padded", () => {
    const g = createGammaSet({ guard: true });
    const pg = g.model;
    const gain = pg.n / 2;
    // A window in tiling units, inset like the visible rect is.
    const W = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
    const inW = ([x, y]) => x >= W.xMin && x <= W.xMax && y >= W.yMin && y <= W.yMax;

    // Every K whose dual vertex lands inside W: read off the rhombs in a larger
    // window so the edge of W is not the edge of what exists.
    const Ks = new Map();
    for (const r of collectRhombs(pg, { xMin: -12, xMax: 12, yMin: -12, yMax: 12 }, { gain })) {
        r.kTuples.forEach((K, i) => { if (inW(r.vertices[i])) Ks.set(K.join(","), K); });
    }
    assert.ok(Ks.size > 100, `only ${Ks.size} vertices in the window`);

    // Clip each region to a grid-space rect: W scaled down by the gain (that is
    // registration), padded by `pad` tiling units, also scaled.
    const clipRect = (pad) => ({
        xMin: (W.xMin - pad) / gain, xMax: (W.xMax + pad) / gain,
        yMin: (W.yMin - pad) / gain, yMax: (W.yMax + pad) / gain,
    });
    const missing = (pad) => {
        let n = 0;
        for (const K of Ks.values()) if (regionPoly(pg, K, clipRect(pad)).length < 3) n++;
        return n;
    };

    // The bug: at pad 0 some sources are clipped to nothing.
    assert.ok(missing(0) > 0, "no region was ever lost at the edge, so this proves nothing");
    // The fix: one tiling unit — the wobble bound — covers it, every time.
    assert.equal(missing(1), 0, `${missing(1)} source regions still missing at pad 1`);
});

// The gridline-tiles filter, at the source. A tile is the crossing of two lines
// and is kept when EITHER is selected — the ribbons — where `active` needs both.
test("ribbons: a tile is kept when either of its gridlines is selected", () => {
    const g = createGammaSet({ guard: true });
    const pg = g.model;
    const VIS = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    const R = (ribbons) => collectRhombs(pg, VIS, { gain: pg.n / 2, ribbons });

    const all = R(["all", "all", "all", "all", "all"]);
    assert.equal(R([null, null, null, null, null]).length, 0, "none is none");

    // One family: exactly the tiles it takes part in, all on one of its lines.
    const fam0 = R(["all", null, null, null, null]);
    assert.equal(fam0.length, all.filter((r) => r.j === 0 || r.k === 0).length);
    assert.ok(fam0.every((r) => r.j === 0 || r.k === 0));
    assert.ok(fam0.length > 0, "the AND semantics are back: one family gave nothing");

    // One line: exactly that ribbon.
    const one = R([2, null, null, null, null]);
    assert.ok(one.length > 2, `a ribbon of ${one.length}`);
    assert.ok(one.every((r) => (r.j === 0 && r.nj === 2) || (r.k === 0 && r.nk === 2)),
              "a tile off line 2 of family 0 was kept");

    // Two families: the union of their ribbons, not just their mutual tiles.
    const two = R(["all", "all", null, null, null]);
    const union = all.filter((r) => [r.j, r.k].some((f) => f === 0 || f === 1)).length;
    const mutual = all.filter((r) => r.j === 0 && r.k === 1).length;
    assert.equal(two.length, union);
    assert.ok(two.length > mutual, "an OR must keep more than the AND");
});


// de Bruijn's AR-pattern from the indices, checked against his Fig. 1: every
// rhomb carries two doubles at one corner and two singles at the opposite one,
// the two tiles on a shared edge agree, and the patch reduces to Penrose's two
// marked prototiles — thick with singles out, thin with singles in.
test("the arrows are de Bruijn's AR-pattern: two prototiles, every shared edge agreeing", () => {
    const g = createGammaSet({ guard: true });
    const pg = g.model;
    const rhombs = collectRhombs(pg, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 }, { gain: pg.n / 2 });
    let lo = Infinity, hi = -Infinity;
    for (const r of rhombs) for (const K of r.kTuples) {
        const m = K.reduce((a, b) => a + b, 0);
        lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    assert.equal(hi - lo, 3, "a Penrose patch has four index levels");

    const seen = new Map();
    for (const r of rhombs) {
        const arrows = rhombArrows(pg, r, lo);
        assert.equal(arrows.length, 4);
        assert.equal(arrows.filter((a) => a.double).length, 2, "two doubles per rhomb");
        // The two doubles share a corner. Edges go round the polygon, so the two
        // at v0 are edges 0 and 3 and the two at v2 are edges 1 and 2.
        const d = arrows.map((a) => a.double);
        assert.ok((d[0] && d[3]) || (d[1] && d[2]), "the doubles are not at one corner");

        for (const a of arrows) {
            // Round before keying, and compare the rest numerically: toFixed
            // prints -0 and +0 differently, and a direction component can be
            // either side of zero by 1e-17.
            const key = `${(Math.round(a.x * 1e6) || 0) / 1e6},${(Math.round(a.y * 1e6) || 0) / 1e6}`;
            (seen.get(key) ?? seen.set(key, []).get(key)).push(a);
        }
    }
    // De Bruijn Fig. 1. Doubles into the extreme. Singles out of the red corner
    // on a thick, into it on a thin — and that difference is what makes the two
    // tiles on a shared edge agree.
    const idx = (K) => K.reduce((a, b) => a + b, 0) - lo + 1;
    const protos = new Set();
    for (const r of rhombs) {
        const arrows = rhombArrows(pg, r, lo);
        const m = idx(r.kTuples[0]);
        const red = m === 1 ? 3 : 2;
        arrows.forEach((a, i) => {
            const A = r.vertices[i], B = r.vertices[(i + 1) % 4];
            const ia = idx(r.kTuples[i]), ib = idx(r.kTuples[(i + 1) % 4]);
            const towardB = (B[0] - A[0]) * a.dx + (B[1] - A[1]) * a.dy > 0;
            const target = towardB ? ib : ia;
            if (a.double) assert.ok(target === 1 || target === 4, "a double must point into an extreme");
            else assert.equal(target === red, !r.thick,
                              `a single points ${r.thick ? "out of" : "into"} the red corner on a ${r.thick ? "thick" : "thin"}`);
        });
        // The marked prototile: which way the doubles and the singles face their corners.
        const d = arrows.filter((a) => a.double), s = arrows.filter((a) => !a.double);
        const corner = (es) => [es[0], es[1]].map((e) => arrows.indexOf(e))
            .map((i) => [i, (i + 1) % 4]).reduce((p, q) => p.filter((v) => q.includes(v)))[0];
        const faces = (es, c) => es.every((e) => {
            const i = arrows.indexOf(e);
            const T = r.vertices[c], A = r.vertices[i], B = r.vertices[(i + 1) % 4];
            const toB = (B[0] - A[0]) * e.dx + (B[1] - A[1]) * e.dy > 0;
            return (toB ? B : A) === T;
        });
        protos.add(`${r.thick ? "thick" : "thin"}:${faces(d, corner(d)) ? "in" : "out"}/${faces(s, corner(s)) ? "in" : "out"}`);
    }
    // Penrose's two, and only two.
    assert.deepEqual([...protos].sort(), ["thick:in/out", "thin:in/in"]);
    let shared = 0;
    for (const both of seen.values()) {
        if (both.length === 2) {
            shared++;
            const [p, q] = both;
            assert.equal(p.double, q.double, "the two sides of an edge disagree on single/double");
            assert.ok(Math.abs(p.dx - q.dx) < 1e-9 && Math.abs(p.dy - q.dy) < 1e-9,
                      "the two sides of an edge point their arrow different ways");
        }
    }
    assert.ok(shared > 200, `only ${shared} shared edges`);
});

// Wikipedia's rhombus-with-arcs decoration is the AR-pattern drawn as curves:
// a dark sector of radius 1/4 at the corner where the double arrows meet, blue
// at the red corner — a 3/4..1 band on the thick, a 1/4 sector on the thin.
// The curves join iff the crossing points on a shared edge coincide in color.
test("the filled curves join across every shared edge when dark sits at the arrow corner", () => {
    const g = createGammaSet({ guard: true });
    const pg = g.model;
    const R = collectRhombs(pg, { xMin: -7, xMax: 7, yMin: -7, yMax: 7 }, { gain: pg.n / 2 });
    let lo = Infinity;
    for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    const idx = (K) => K.reduce((a, b) => a + b, 0) - lo + 1;
    const key = (p) => `${(Math.round(p[0] * 1e5) || 0) / 1e5},${(Math.round(p[1] * 1e5) || 0) / 1e5}`;
    const agree = (darkAtExtreme) => {
        const byEdge = new Map();
        for (const r of R) {
            const m = idx(r.kTuples[0]);
            const extreme = m === 1 ? 0 : 2;
            const X = darkAtExtreme ? extreme : (extreme === 0 ? 2 : 0), Y = X === 0 ? 2 : 0;
            const V = r.vertices;
            const along = (a, b, t) => [V[a][0] + t * (V[b][0] - V[a][0]), V[a][1] + t * (V[b][1] - V[a][1])];
            const marks = [];
            for (const n of [(X + 1) % 4, (X + 3) % 4]) marks.push([X, n, along(X, n, 0.25), "dark"]);
            for (const n of [(Y + 1) % 4, (Y + 3) % 4]) marks.push([Y, n, along(Y, n, r.thick ? 0.75 : 0.25), "blue"]);
            for (const [a, b, p, c] of marks) {
                const ek = [V[a], V[b]].map(key).sort().join("|");
                (byEdge.get(ek) ?? byEdge.set(ek, []).get(ek)).push(`${c}@${key(p)}`);
            }
        }
        let shared = 0, ok = 0;
        for (const l of byEdge.values()) if (l.length === 2) { shared++; if (l[0] === l[1]) ok++; }
        return { shared, ok };
    };
    const yes = agree(true), no = agree(false);
    assert.ok(yes.shared > 500);
    assert.equal(yes.ok, yes.shared, "dark at the arrow corner: every curve must join");
    assert.ok(no.ok < no.shared / 2, "dark at the red corner must NOT join — or the test proves nothing");
});

// The pentagons style is P1 at the big-rhomb scale: a whole Pe3 inside every
// thick, the Pe1 straddling edges, blue elsewhere. It is a per-tile decoration,
// so the only thing that can go wrong is the pieces not meeting: an orange
// pentagon emitted by one tile must be emitted, identically, by every tile it
// overlaps. Checked on three gammas, and against the three other corner rules.
test("the pentagons assemble: every orange pentagon is emitted by both tiles it overlaps", () => {
    const inside = (p, poly) => {
        let s = 0;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
            if (Math.abs(cr) < 1e-9) continue;
            const t = cr > 0 ? 1 : -1;
            if (s === 0) s = t; else if (s !== t) return false;
        }
        return true;
    };
    const key = (P) => {
        const cx = P.reduce((a, v) => a + v[0], 0) / 5, cy = P.reduce((a, v) => a + v[1], 0) / 5;
        // orientation mod 72: the direction of the first corner, folded
        const T = 2 * Math.PI / 5;
        let a = Math.atan2(P[0][1] - cy, P[0][0] - cx); a = ((a % T) + T) % T; if (a > T - 1e-6) a = 0;
        const q = (v) => (Math.round(v * 1e4) || 0) / 1e4;       // -0 is 0, or the origin splits
        return `${q(cx)},${q(cy)},${q(a)}`;
    };
    for (const gamma of [[0.2, 0.2, 0.2, 0.2, 0.2], [0.07, 0.11, 0.13, 0.17, -0.48], [0.4, 0.4, 0.4, 0.4, 0.4]]) {
        const pg = { n: 5, directions: makeDirections(true), gamma };
        const R = collectRhombs(pg, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 }, { gain: 2.5 });
        let lo = Infinity;
        for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
        const emitted = new Map();       // key -> { poly, tiles }
        let yellowIn = 0, thick = 0;
        R.forEach((r, t) => {
            const d = rhombPentagons(r, lo);
            if (r.thick) {
                thick++;
                assert.ok(d.yellow, "a thick rhomb carries a whole pentagon");
                if (d.yellow.every((p) => inside(p, r.vertices))) yellowIn++;
                // and its rear corners sit exactly on the tile's edges at 1/phi^2
                const ids = r.kTuples.map((K) => K.reduce((a, b) => a + b, 0) - lo + 1);
                const c = ids.findIndex((v) => v === 1 || v === 4);
                const C = r.vertices[c], A = r.vertices[(c + 1) % 4], B = r.vertices[(c + 3) % 4];
                const onEdge = (p, X) => Math.hypot(p[0] - (C[0] + PENTA_R * (X[0] - C[0])), p[1] - (C[1] + PENTA_R * (X[1] - C[1]))) < 1e-9;
                assert.ok(d.yellow.some((p) => onEdge(p, A)) && d.yellow.some((p) => onEdge(p, B)), "rear corners on the edges");
            } else {
                assert.equal(d.yellow, null);
            }
            assert.equal(d.orange.length, 2);
            for (const o of d.orange) {
                const k = key(o);
                if (!emitted.has(k)) emitted.set(k, { poly: o, tiles: new Set() });
                emitted.get(k).tiles.add(t);
            }
        });
        assert.equal(yellowIn, thick, "every yellow pentagon lies inside its own thick rhomb");
        let judged = 0, missing = 0;
        for (const { poly, tiles } of emitted.values()) {
            const cx = poly.reduce((a, v) => a + v[0], 0) / 5, cy = poly.reduce((a, v) => a + v[1], 0) / 5;
            if (Math.hypot(cx, cy) > 8) continue;           // well inside the patch
            judged++;
            // every tile that holds an interior point of this pentagon must emit it
            for (let i = 0; i < 60; i++) {
                const a = i * 2 * Math.PI / 60, rr = PENTA_R * 0.7;
                const p = [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
                if (!inside(p, poly)) continue;
                const t = R.findIndex((r) => inside(p, r.vertices));
                if (t >= 0 && !tiles.has(t)) { missing++; break; }
            }
        }
        assert.ok(judged > 200, `only ${judged} pentagons judged`);
        assert.equal(missing, 0, `gamma ${gamma}: ${missing} orange pentagons not emitted by a tile they overlap`);
    }
});

// The next-gen style is the deflation drawn per tile: gold half-thick' and gray
// thin' pieces at scale 1/phi. It is a picture of the next generation only if
// the pieces assemble across tile edges — every next-gen edge (length 1/phi)
// shared by exactly two pieces or on the boundary, every half-rhomb base shared
// by two halves of the SAME color. The obvious other corner rule fails this.
test("the deflation assembles: next-gen edges pair up and half-rhombs meet their other halves", () => {
    const key = (p) => `${(Math.round(p[0] * 1e6) || 0) / 1e6},${(Math.round(p[1] * 1e6) || 0) / 1e6}`;
    const ekey = (a, b) => [key(a), key(b)].sort().join("|");
    const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const gamma of [[0.2, 0.2, 0.2, 0.2, 0.2], [0.07, 0.11, 0.13, 0.17, -0.48], [0.4, 0.4, 0.4, 0.4, 0.4]]) {
        const pg = { n: 5, directions: makeDirections(true), gamma };
        const R = collectRhombs(pg, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 }, { gain: 2.5 });
        let lo = Infinity;
        for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
        const sides = new Map();           // edge -> [{color, len}]
        let gold = 0, gray = 0, area = 0;
        const polyArea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
        for (const r of R) {
            const d = rhombDeflation(r, lo);
            // thick: 4 gold halves + 2 gray halves; thin: 2 + 2
            assert.equal(d.gold.length, r.thick ? 4 : 2);
            assert.equal(d.gray.length, 2);
            // and the next-gen edges: seven and five, each 1/phi long, each a
            // side of some piece
            assert.equal(d.edges.length, r.thick ? 7 : 5);
            const pieceSides = new Set();
            for (const P of [...d.gold, ...d.gray]) for (let i = 0; i < P.length; i++) pieceSides.add(ekey(P[i], P[(i + 1) % P.length]));
            for (const [a, b] of d.edges) {
                assert.ok(Math.abs(len(a, b) - 1 / PHI) < 1e-9, "an interior edge is not 1/phi");
                assert.ok(pieceSides.has(ekey(a, b)), "an interior edge is not a piece side");
            }
            const pieces = [...d.gold.map((P) => ["gold", P]), ...d.gray.map((P) => ["gray", P])];
            let covered = 0;
            for (const [color, P] of pieces) {
                covered += polyArea(P);
                for (let i = 0; i < P.length; i++) {
                    const a = P[i], b = P[(i + 1) % P.length];
                    const k = ekey(a, b);
                    (sides.get(k) ?? sides.set(k, []).get(k)).push({ color, len: len(a, b) });
                }
            }
            // the pieces tile the rhomb exactly
            assert.ok(Math.abs(covered - polyArea(r.vertices)) < 1e-9, "pieces do not cover the tile");
            gold += d.gold.length / 2; gray += d.gray.length / 2; area += polyArea(r.vertices);
        }
        // the substitution matrix: thick -> 2 thick' + 1 thin', thin -> 1 + 1
        const thick = R.filter((r) => r.thick).length, thin = R.length - thick;
        assert.equal(gold, 2 * thick + thin);
        assert.equal(gray, thick + thin);

        // the tiles' edge lists, together, are exactly the deflated tiling's
        // edge set: every 1/phi piece side is listed by some tile, nothing else is
        const listed = new Set();
        for (const r of R) for (const [a, b] of rhombDeflation(r, lo).edges) listed.add(ekey(a, b));
        let edges = 0, bases = 0, bad = 0;
        for (const [k, list] of sides) {
            const ends = k.split("|").map((e) => e.split(",").map(Number));
            if (ends.some(([x, y]) => Math.hypot(x, y) > 7.5)) continue;   // well inside the patch
            const L = list[0].len;
            if (Math.abs(L - 1 / PHI) < 1e-6) {                    // a next-gen tile edge
                edges++;
                if (list.length !== 2) bad++;
                if (!listed.has(k)) bad++;
            } else {
                if (listed.has(k)) bad++;                                               // a half-rhomb base: 1 (thick') or 1/phi^2 (thin')
                bases++;
                assert.ok(Math.abs(L - 1) < 1e-6 || Math.abs(L - 1 / PHI / PHI) < 1e-6, `stray side of length ${L}`);
                if (list.length !== 2 || list[0].color !== list[1].color) bad++;
            }
        }
        assert.ok(edges > 500 && bases > 200, `only ${edges} edges, ${bases} bases judged`);
        assert.equal(bad, 0, `gamma ${gamma}: ${bad} sides do not assemble`);
    }
});

// Kites and darts: P2 read off P3 per tile. It is P2 only if the half-kites on
// a rhomb's single-arrow edges meet their other halves next door: every side
// of every piece inside the patch is shared by exactly two pieces; a side that
// is NOT a listed P2 edge must be a kite axis, i.e. shared by two half-kites
// that are mirror images across it; and the listed edges are everything else.
test("kites and darts assemble: every P2 edge is shared, and the unlisted sides are kite axes", () => {
    const key = (p) => `${(Math.round(p[0] * 1e6) || 0) / 1e6},${(Math.round(p[1] * 1e6) || 0) / 1e6}`;
    const ekey = (a, b) => [key(a), key(b)].sort().join("|");
    const polyArea = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    for (const gamma of [[0.2, 0.2, 0.2, 0.2, 0.2], [0.07, 0.11, 0.13, 0.17, -0.48], [0.4, 0.4, 0.4, 0.4, 0.4]]) {
        const pg = { n: 5, directions: makeDirections(true), gamma };
        const R = collectRhombs(pg, { xMin: -6, xMax: 6, yMin: -6, yMax: 6 }, { gain: 2.5 });
        let lo = Infinity;
        for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
        const sides = new Map();           // side -> [{kind, apex}]
        const listed = new Set();
        let halfKites = 0, darts = 0;
        for (const r of R) {
            const d = rhombKitesDarts(r, lo);
            assert.equal(d.kites.length, 2);
            assert.equal(d.darts.length, r.thick ? 1 : 0);
            halfKites += 2; darts += d.darts.length;
            let covered = 0;
            for (const [kind, P] of [...d.kites.map((P) => ["kite", P]), ...d.darts.map((P) => ["dart", P])]) {
                covered += polyArea(P);
                for (let i = 0; i < P.length; i++) {
                    const a = P[i], b = P[(i + 1) % P.length];
                    // the vertex of the piece not on this side, for the mirror check
                    const other = P.filter((_, k) => k !== i && k !== (i + 1) % P.length);
                    (sides.get(ekey(a, b)) ?? sides.set(ekey(a, b), []).get(ekey(a, b))).push({ kind, other });
                }
            }
            assert.ok(Math.abs(covered - polyArea(r.vertices)) < 1e-9, "the pieces cover the tile");
            for (const [a, b] of d.edges) listed.add(ekey(a, b));
        }
        const thick = R.filter((r) => r.thick).length, thin = R.length - thick;
        assert.equal(halfKites / 2, thick + thin, "#kites = #thick + #thin");
        assert.equal(darts, thick, "#darts = #thick");

        let edges = 0, axes = 0, bad = 0;
        for (const [k, list] of sides) {
            const ends = k.split("|").map((e) => e.split(",").map(Number));
            if (ends.some(([x, y]) => Math.hypot(x, y) > 7.5)) continue;     // well inside
            if (list.length !== 2) { bad++; continue; }
            if (listed.has(k)) { edges++; continue; }
            // an axis: two half-kites, mirror images across the side
            axes++;
            if (!list.every((s) => s.kind === "kite")) { bad++; continue; }
            const [a, b] = ends;
            const reflect = (p) => {                       // across the line a-b
                const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
                const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
                const fx = a[0] + t * dx, fy = a[1] + t * dy;
                return [2 * fx - p[0], 2 * fy - p[1]];
            };
            const q = reflect(list[0].other[0]);
            if (Math.hypot(q[0] - list[1].other[0][0], q[1] - list[1].other[0][1]) > 1e-6) bad++;
        }
        assert.ok(edges > 400 && axes > 100, `only ${edges} edges, ${axes} axes judged`);
        assert.equal(bad, 0, `gamma ${gamma}: ${bad} sides do not assemble`);
    }
});
