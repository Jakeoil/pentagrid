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
