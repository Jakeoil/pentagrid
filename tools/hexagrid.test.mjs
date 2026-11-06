// The icosahedral hexagrid and its dual — PLAN §8.7, step 4.
//
// Jake, 2026-11-06: "Do the hexagrid in geometry." It is de Bruijn's
// construction one dimension up: six families of planes on the icosahedral
// axes, an intersection of three planes dual to a rhombohedron, and the same
// two formulas the pentagrid has always used.
//
// Two claims are worth the whole file, both from Socolar and Steinhardt and
// both now measured rather than quoted:
//
//  1. the periodic hexagrid's dual is a clean tiling by the two rhombohedra,
//     and
//  2. at their alpha = 1/tau, beta = -1/2 the oblate rhombohedron NEVER
//     appears as an order-3 cell. "Anywhere one might have expected an
//     intersection of three planes whose dual is an oblate rhombohedron,
//     additional planes pass through the intersection." Measured: zero O6, in
//     every box tried, and the oblates come back the moment either number is
//     moved.

import test from "node:test";
import assert from "node:assert/strict";
import {
    HEX_N, DUAL_GAIN, MEAN_GAP, SOLID_NAMES,
    planePos, planeIndexAt, kTupleAt, dualVertex, solveTriple,
    collectCells, cellCensus, cellContains, cellVolumeOf,
    periodicHexagrid, fibonacciHexagrid,
} from "../dist/geometry/hexagrid.js";
import { ICO_AXES, faceDiagonals, PHI } from "../dist/geometry/zono3.js";

const box = (r) => ({ xMin: -r, xMax: r, yMin: -r, yMax: r, zMin: -r, zMax: r });
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── the grid ──────────────────────────────────────────────────────

test("six families on the icosahedral axes, every pair at the one angle", () => {
    assert.equal(HEX_N, 6);
    const hg = periodicHexagrid();
    assert.equal(hg.directions.length, 6);
    assert.equal(hg.directions, ICO_AXES, "the grid is on the axes zono3 built");
    // Fifteen pairs, one angle: |cos| = 1/sqrt(5). This is what makes every
    // face of the dual the same golden rhomb.
    for (let i = 0; i < 6; i++) {
        assert.ok(near(dot(ICO_AXES[i], ICO_AXES[i]), 1), "the normals are unit");
        for (let j = i + 1; j < 6; j++) {
            assert.ok(near(Math.abs(dot(ICO_AXES[i], ICO_AXES[j])), 1 / Math.sqrt(5)),
                      `pair ${i},${j} is at the wrong angle`);
        }
    }
});

test("the dual map's gain is 2, which is n/d as the plane's 5/2 is", () => {
    // Sum_j v_j v_j^T = (n/d) I -- six unit vectors spread isotropically in
    // three dimensions, so the trace 6 divides by 3. Measured, not assumed.
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const v of ICO_AXES) {
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += v[a] * v[b];
    }
    for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
            assert.ok(near(M[a][b], a === b ? 2 : 0, 1e-12),
                      `M[${a}][${b}] = ${M[a][b]}`);
        }
    }
    assert.equal(DUAL_GAIN, 2);
});

test("a plane's position and its index invert each other, both kinds of family", () => {
    for (const hg of [periodicHexagrid(), fibonacciHexagrid()]) {
        for (let j = 0; j < 6; j++) {
            for (let n = -6; n <= 6; n++) {
                assert.equal(planeIndexAt(hg, j, planePos(hg, j, n)), n,
                             `family ${j}, plane ${n}`);
            }
            // And the index function is what it says: the smallest n at or past t.
            const t = planePos(hg, j, 3) + 0.01;
            assert.equal(planeIndexAt(hg, j, t), 4);
        }
    }
});

test("a Fibonacci family has two gaps in the ratio phi, in the Fibonacci word", () => {
    const hg = fibonacciHexagrid();
    const gaps = [];
    for (let n = -20; n < 20; n++) gaps.push(planePos(hg, 0, n + 1) - planePos(hg, 0, n));
    const kinds = [...new Set(gaps.map((g) => g.toFixed(9)))].map(Number).sort();
    assert.equal(kinds.length, 2, `${kinds.length} gap lengths, not two`);
    assert.ok(near(kinds[1] / kinds[0], PHI), `the ratio is ${kinds[1] / kinds[0]}`);
    // The word is the Fibonacci word: no two shorts adjacent, no three longs.
    const word = gaps.map((g) => (g > kinds[0] * 1.5 ? "L" : "S")).join("");
    assert.doesNotMatch(word, /SS/, "two shorts in a row is not the musical sequence");
    assert.doesNotMatch(word, /LLL/, "three longs in a row is not either");
    // And the mean gap is the module's own constant.
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(Math.abs(mean - MEAN_GAP) < 0.05, `mean gap ${mean}, not ${MEAN_GAP}`);
});

test("K and f are the pentagrid's own formulas: an edge of the dual is a generator", () => {
    const hg = periodicHexagrid();
    const K = kTupleAt(hg, [0.31, -0.22, 0.17]);
    assert.equal(K.length, 6);
    for (let j = 0; j < 6; j++) {
        const bumped = K.slice();
        bumped[j] += 1;
        const a = dualVertex(hg, K), b = dualVertex(hg, bumped);
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        for (let c = 0; c < 3; c++) assert.ok(near(d[c], ICO_AXES[j][c]));
        assert.ok(near(Math.hypot(...d), 1), "so every edge of the dual is unit");
    }
});

test("three planes meet where the solver says, and the point is on all three", () => {
    const hg = periodicHexagrid();
    const p = solveTriple(hg, [0, 2, 4], [1, -1, 2]);
    assert.ok(p, "the icosahedral triples are never coplanar");
    assert.ok(near(dot(ICO_AXES[0], p), planePos(hg, 0, 1)));
    assert.ok(near(dot(ICO_AXES[2], p), planePos(hg, 2, -1)));
    assert.ok(near(dot(ICO_AXES[4], p), planePos(hg, 4, 2)));
});

// ── the periodic dual: the regular case ───────────────────────────

test("the periodic dual is two rhombohedra, in the ratio phi, and nothing else", () => {
    const hg = periodicHexagrid();
    const cells = collectCells(hg, box(2.5));
    assert.ok(cells.length > 1000, `only ${cells.length} cells`);
    // Regular: a generic gamma puts no fourth plane through any intersection.
    for (const c of cells) assert.equal(c.order, 3, `an order-${c.order} cell`);
    const census = cellCensus(cells);
    assert.deepEqual(Object.keys(census).sort(), ["A6", "O6"]);
    // The number ratio is phi, as thick to thin is in the plane.
    const ratio = census.A6 / census.O6;
    assert.ok(Math.abs(ratio - PHI) < 0.02, `acute/oblate = ${ratio}, not phi`);
});

test("every face of every cell is the one golden rhomb", () => {
    const hg = periodicHexagrid();
    const cells = collectCells(hg, box(1.6));
    assert.ok(cells.length > 50);
    for (const c of cells) {
        assert.equal(c.zono.faces.length, 6, "a rhombohedron has six faces");
        for (const f of c.zono.faces) {
            const [long, short] = faceDiagonals(c.zono.gens, f);
            assert.ok(near(long / short, PHI, 1e-9),
                      `a face's diagonals are ${long}/${short}`);
        }
    }
});

test("the periodic cells TILE: every point in exactly one, and the volume fills", () => {
    const hg = periodicHexagrid();
    const R = 2.5;
    const cells = collectCells(hg, box(R));
    // Sample well inside the dual region, so no cell is cut off by the box.
    let seed = 20261106;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
    const reach = R * DUAL_GAIN * 0.3;
    for (let s = 0; s < 120; s++) {
        const p = [(rnd() * 2 - 1) * reach, (rnd() * 2 - 1) * reach, (rnd() * 2 - 1) * reach];
        let hits = 0;
        for (const c of cells) if (cellContains(hg, c, p)) hits++;
        assert.equal(hits, 1, `point ${p.map((v) => v.toFixed(3))} is in ${hits} cells`);
    }
    // And the volume: the dual of a box of side L fills (gain L)^3.
    const V = cells.reduce((a, c) => a + cellVolumeOf(hg, c), 0);
    const want = (2 * R) ** 3 * DUAL_GAIN ** 3;
    assert.ok(Math.abs(V / want - 1) < 0.05, `volume ratio ${(V / want).toFixed(4)}`);
});

// ── the Fibonacci hexagrid: singular in the extreme ───────────────

test("Socolar's hexagrid is singular in the extreme, and names its cells", () => {
    const hg = fibonacciHexagrid();
    const cells = collectCells(hg, box(3.5));
    const census = cellCensus(cells);
    const orders = new Set(cells.map((c) => c.order));
    // Orders above three exist, which is the whole difference from periodic.
    assert.ok(orders.size > 1, `every cell is order ${[...orders]}`);
    for (const c of cells) {
        assert.ok(c.order >= 3 && c.order <= 6, `order ${c.order}`);
        if (c.order > 3) {
            assert.equal(c.solid, SOLID_NAMES[c.order]);
            // pi(C^k) has k(k-1) faces and k^2-k+2 vertices -- the ladder.
            assert.equal(c.zono.faces.length, c.order * (c.order - 1));
            assert.equal(c.zono.vertices.length, c.order ** 2 - c.order + 2);
        }
    }
    // The payoff: NO oblate rhombohedron is ever a non-singular dual.
    assert.equal(census.O6 ?? 0, 0,
                 `${census.O6} oblate rhombohedra, where Socolar says none`);
    assert.ok((census.A6 ?? 0) > 100, "the prolate is the only order-3 cell");
    assert.ok((census.K30 ?? 0) > 0, "no triacontahedron appeared");
    assert.ok((census.B12 ?? 0) > 0, "no Bilinski dodecahedron appeared");
});

test("and both of their numbers are load-bearing: the oblates come back", () => {
    // alpha = 1/tau and beta = -1/2. Move either and the structure is a
    // different one -- which is the sharpest evidence that these are not
    // decorative constants.
    const O6 = (alpha, beta) =>
        cellCensus(collectCells(fibonacciHexagrid(1, alpha, beta), box(3.5))).O6 ?? 0;
    assert.equal(O6(1 / PHI, -0.5), 0, "their own cut");
    assert.ok(O6(1 / PHI, -0.2) > 50, "beta moved: oblates return");
    assert.ok(O6(0, -0.5) > 50, "alpha moved: oblates return, in force");
    assert.ok(O6(0.5, -0.5) > 50);
});

test("the Fibonacci cells tile too, and fill once the spacings agree", () => {
    // At T = 1 the planes are MEAN_GAP apart, so the dual covers 1/MEAN_GAP^3
    // of what a unit periodic grid's does -- a density, not a gap.
    const R = 3;
    const sparse = fibonacciHexagrid(1);
    const sparseCells = collectCells(sparse, box(R));
    const want = (2 * R) ** 3 * DUAL_GAIN ** 3;
    const Vs = sparseCells.reduce((a, c) => a + cellVolumeOf(sparse, c), 0);
    assert.ok(Math.abs(Vs / want - 1 / MEAN_GAP ** 3) < 0.03,
              `at T = 1 the ratio is ${(Vs / want).toFixed(4)}, not ${(1 / MEAN_GAP ** 3).toFixed(4)}`);

    // And at T = 1/MEAN_GAP the two grids fill the same space.
    const matched = fibonacciHexagrid(1 / MEAN_GAP);
    const cells = collectCells(matched, box(R));
    const V = cells.reduce((a, c) => a + cellVolumeOf(matched, c), 0);
    assert.ok(Math.abs(V / want - 1) < 0.1, `matched ratio ${(V / want).toFixed(4)}`);

    // Tiling, with the four cell shapes in play: still exactly one each.
    let seed = 777;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
    const reach = R * DUAL_GAIN * 0.3;
    for (let s = 0; s < 120; s++) {
        const p = [(rnd() * 2 - 1) * reach, (rnd() * 2 - 1) * reach, (rnd() * 2 - 1) * reach];
        let hits = 0;
        for (const c of cells) if (cellContains(matched, c, p)) hits++;
        assert.equal(hits, 1, `point ${p.map((v) => v.toFixed(3))} is in ${hits} cells`);
    }
});
