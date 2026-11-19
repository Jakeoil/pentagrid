// The pentaflake, which is where the P wheel actually comes from.
//
// This is the first step of the derivation and the one that is a measurement
// rather than a formula: build the figure by hand, then read O to O_k off it.
// The test's job is to keep the formula honest against the figure — if
// `pWheel`'s stride ever drifts from "the two corners of the shared edge,
// added", this is what notices.
//
// The oracle here is penrose-mosaic by way of `wheel.test.mjs`: the P wheel the
// flake measures out is the one that file checks against the hand-built tables.

import test from "node:test";
import assert from "node:assert/strict";

import { pWheelFromFlake, pentaflake, sharedEdge } from "../src/math/flake.js";
import { PENTA_UP, REAL_PENTA, m10, pWheel, wheelFromPoints } from "../src/math/wheel.js";

const eq = (a, b) =>
    a.length === b.length && a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1]);

/** A seed with no symmetry at all, to keep the construction from leaning on one. */
const LOPSIDED = [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]];

test("the flake's edges coincide, corner for corner", () => {
    // "12 touches 21": the copy's edge (k+1 -> k) lands ON the original's edge
    // (k -> k+1), both corners exactly. Not an abutment, a coincidence.
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const [middle, ...leaves] = pentaflake(pts);
        assert.equal(leaves.length, 5);
        for (const leaf of leaves) {
            const [a, b] = sharedEdge(pts, leaf.edge);
            // the leaf is the 180 copy, so its corner j sits at -pts[j] + center
            assert.deepEqual([...leaf.corners[(leaf.edge + 1) % 5]], [...a]);
            assert.deepEqual([...leaf.corners[leaf.edge]], [...b]);
            assert.deepEqual([...middle.corners[leaf.edge]], [...a]);
        }
    }
});

test("the middle keeps the five points, untouched and in order", () => {
    const [middle] = pentaflake(PENTA_UP);
    assert.deepEqual(middle.corners.map((p) => [...p]), PENTA_UP.map((p) => [...p]));
    assert.deepEqual([...middle.center], [0, 0]);
    assert.equal(middle.tenth, 0);
    assert.equal(middle.edge, -1);
});

test("O_k is the two corners of the shared edge, added", () => {
    const [, ...leaves] = pentaflake(PENTA_UP);
    assert.deepEqual(leaves.map((l) => [...l.center]),
        [[3, -4], [5, 2], [0, 6], [-5, 2], [-3, -4]]);
});

test("the flake measures out the P wheel, and lands on the odd tenths", () => {
    // The leaves are the 180 copies, so their centers are the down half.
    for (const pts of [PENTA_UP, LOPSIDED]) {
        assert.ok(eq(pWheelFromFlake(pts), pWheel(wheelFromPoints(pts))),
            "the flake and the stride formula disagree");
        const [, ...leaves] = pentaflake(pts);
        const p = pWheel(wheelFromPoints(pts));
        for (const leaf of leaves) {
            assert.ok(leaf.tenth % 2 === 1, `leaf at even tenth ${leaf.tenth}`);
            assert.deepEqual([...p[leaf.tenth]], [...leaf.center]);
        }
    }
});

test("so P[t] = D[t-1] + D[t+1] is the pentaflake, not an algebraic trick", () => {
    // At an odd tenth the stride-1 pair IS the two corners of a shared edge.
    const d = wheelFromPoints(PENTA_UP);
    for (let k = 0; k < 5; k++) {
        const viaStride = pWheel(d)[m10(2 * k + 1)];
        const viaFlake = [PENTA_UP[k][0] + PENTA_UP[(k + 1) % 5][0],
                          PENTA_UP[k][1] + PENTA_UP[(k + 1) % 5][1]];
        assert.deepEqual([...viaStride], viaFlake);
        assert.deepEqual([...d[m10(2 * k)]], [...PENTA_UP[k]]);
        assert.deepEqual([...d[m10(2 * k + 2)]], [...PENTA_UP[(k + 1) % 5]]);
    }
});

test("the P wheel the flake measures is a wheel: ten filled, W[t+5] = -W[t]", () => {
    for (const pts of [PENTA_UP, LOPSIDED, REAL_PENTA]) {
        const p = pWheelFromFlake(pts);
        assert.equal(p.length, 10);
        for (let t = 0; t < 10; t++) {
            assert.ok(p[t], `tenth ${t} unfilled`);
            assert.deepEqual([...p[m10(t + 5)]], [-p[t][0], -p[t][1]]);
        }
    }
});

test("the pentaflake identity holds off the lattice too", () => {
    // O_k = pts[k] + pts[k+1], and for a regular pentagon that is 2r = 2R cos36.
    const [, ...leaves] = pentaflake(REAL_PENTA);
    const R = 4 / (2 * Math.sin(Math.PI / 5));
    for (const leaf of leaves)
        assert.ok(Math.abs(Math.hypot(...leaf.center) - 2 * R * Math.cos(Math.PI / 5)) < 1e-12,
            `|O_${leaf.edge}| = ${Math.hypot(...leaf.center)}`);
});

test("five points or nothing", () => {
    assert.throws(() => pentaflake([[0, 0], [1, 1], [2, 2], [3, 3]]),
        /need five points, got 4/);
});
