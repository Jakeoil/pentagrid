// Does the bootstrap actually reproduce penrose-mosaic?
//
// src/bootstrap/ derives the wheels and the tiles from five ordered points and
// nothing else. penrose-mosaic built the same objects by hand thirty years ago.
// This file is the check that the derivation lands on the hand-built data, and
// it is the only reason to trust anything the bootstrap prints.
//
// The hand-built values below are transcribed from penrose-mosaic's
// shape-modes.js (class Quadrille) and wheels.js. They are the fixture, not the
// implementation: nothing in src/bootstrap/ imports them.

import test from "node:test";
import assert from "node:assert/strict";

import {
    PENTA_UP, PRESETS, REAL_PENTA, comb, deflate, eWheel, halfDown, halfUp,
    inflate, ladderTo, m10, pWheel, pair, sWheel, stride, tWheel,
    wheelFromPoints, wheelsAt,
} from "../dist/bootstrap/wheel.js";
import {
    BOAT, DIAMOND, PENTA, STAR, THICK, THIN, anchorFor, closes, pentagon,
    rhombGroup, rhombus, starOutline, turn, vertices,
} from "../dist/bootstrap/walk.js";

/** The smallest interior angle of a quadrilateral, in degrees. */
const acuteOf = (q) => {
    const a = [];
    for (let i = 0; i < 4; i++) {
        const u = [q[(i + 3) % 4][0] - q[i][0], q[(i + 3) % 4][1] - q[i][1]];
        const v = [q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]];
        a.push(Math.acos((u[0] * v[0] + u[1] * v[1])
            / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI);
    }
    return Math.min(...a);
};
import { pWheelFromFlake, pentaflake, sharedEdge } from "../dist/bootstrap/flake.js";
import { starPolygon, starTips } from "../dist/bootstrap/star.js";
import { WALK_OF, expand, outlineOf } from "../dist/bootstrap/patch.js";

// ── penrose-mosaic, transcribed ───────────────────────────────────────────
const SEEDS = {                       // wheels.js, index 1 (the seed)
    p: [[0, -6], [3, -4], [5, -2]],
    s: [[0, -5], [3, -5], [5, -1]],
    t: [[0, -8], [5, -8], [8, -2]],
    d: [[0, -3], [2, -3], [3, -1]],
};
const SEEDS_GEN0 = { d: [[0, -1], [1, -1], [1, -1]], p: [[0, -2], [1, -2], [2, 0]] };
const SEEDS_GEN2 = { p: [[0, -14], [8, -12], [13, -4]], t: [[0, -24], [13, -18], [21, -8]] };

const SHAPES = {                      // shape-modes.js, class Quadrille
    pentaUp: [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]],
    starUp: [[0, -6], [1, -2], [5, -2], [2, 0], [3, 4], [0, 2], [-3, 4], [-2, 0], [-5, -2], [-1, -2]],
    boatUp: [[0, -6], [1, -2], [5, -2], [2, 0], [-2, 0], [-5, -2], [-1, -2]],
    boatWon: [[3, -4], [2, 0], [5, 2], [1, 2], [-2, 0], [-3, -4], [0, -2]],
    boatToo: [[5, -2], [2, 0], [3, 4], [0, 2], [-1, -2], [0, -6], [1, -2]],
    diamondUp: [[0, -6], [1, -2], [0, 2], [-1, -2]],
    diamondWon: [[3, -4], [0, -2], [-1, 2], [2, 0]],
    diamondToo: [[5, -2], [2, 0], [-2, 0], [1, -2]],
};

// penrose-mosaic's Wheel constructor: three seeds, seven reflections.
const expand10 = ([p0, p1, p2]) => {
    const vr = ([x, y]) => [x, -y], hr = ([x, y]) => [-x, y], ng = ([x, y]) => [-x, -y];
    return [p0, p1, p2, vr(p2), vr(p1), vr(p0), ng(p1), ng(p2), hr(p2), hr(p1)];
};

const eq = (a, b) => a.length === b.length && a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1]);
const show = (w) => w.map((p) => `(${p[0]},${p[1]})`).join(" ");

/** Same closed outline, up to translation, starting vertex and winding. */
function congruent(a, b) {
    if (a.length !== b.length) return false;
    const n = a.length;
    for (const seq of [a, [...a].reverse()])
        for (let r = 0; r < n; r++) {
            const dx = b[0][0] - seq[r][0], dy = b[0][1] - seq[r][1];
            if (b.every((q, i) => seq[(i + r) % n][0] + dx === q[0]
                               && seq[(i + r) % n][1] + dy === q[1])) return true;
        }
    return false;
}

// ── the wheels ────────────────────────────────────────────────────────────
test("the four wheels come out of the five points", () => {
    const w = wheelsAt(PENTA_UP, 1);
    for (const k of ["d", "p", "s", "t"])
        assert.ok(eq(w[k], expand10(SEEDS[k])),
            `${k}: got ${show(w[k])}\n   want ${show(expand10(SEEDS[k]))}`);
});

test("and at the generations above and below it", () => {
    const below = wheelsAt(PENTA_UP, 0);
    assert.ok(eq(below.d, expand10(SEEDS_GEN0.d)), `d[0]: ${show(below.d)}`);
    assert.ok(eq(below.p, expand10(SEEDS_GEN0.p)), `p[0]: ${show(below.p)}`);
    const above = wheelsAt(PENTA_UP, 2);
    assert.ok(eq(above.p, expand10(SEEDS_GEN2.p)), `p[2]: ${show(above.p)}`);
    assert.ok(eq(above.t, expand10(SEEDS_GEN2.t)), `t[2]: ${show(above.t)}`);
});

test("the stride family is one operator", () => {
    const d = wheelFromPoints(PENTA_UP);
    // stride k scales by 1 + 2cos(36k)°: phi^2, phi, phi^-2, -phi^-1
    assert.ok(eq(stride(d, 1), inflate(d)));
    assert.ok(eq(stride(d, 2), sWheel(d)));
    assert.ok(eq(stride(d, 3), deflate(d)));
    // and 1 and 3 are exact inverses, in both orders
    assert.ok(eq(inflate(deflate(d)), d));
    assert.ok(eq(deflate(inflate(d)), d));
});

test("the two-term family is 2cos(36k)", () => {
    // pair(w, k) scales by 2cos(36k): phi, 1/phi, -1/phi, -phi for k = 1..4.
    const PHI = (1 + Math.sqrt(5)) / 2;
    let far = wheelFromPoints(PENTA_UP);
    for (let i = 0; i < 10; i++) far = inflate(far);
    for (const [k, want] of [[1, PHI], [2, 1 / PHI], [3, -1 / PHI], [4, -PHI]]) {
        const got = Math.hypot(...pair(far, k)[1]) / Math.hypot(...far[1]);
        assert.ok(Math.abs(got - Math.abs(want)) < 1e-3,
            `pair k=${k}: ${got} against ${Math.abs(want)}`);
    }
    assert.deepEqual(halfUp(far).map((v) => [...v]), pair(far, 1).map((v) => [...v]));
    assert.deepEqual(halfDown(far).map((v) => [...v]), pair(far, 2).map((v) => [...v]));
});

test("half steps do not compose, which is why rungs anchor on the seed", () => {
    const d = wheelFromPoints(PENTA_UP);
    // If these were true the ladder could be walked by half steps. They are not:
    // both miss by My's lambda = -1 term, and the error would accumulate.
    assert.ok(!eq(halfDown(halfUp(d)), d));
    assert.ok(!eq(halfUp(halfUp(d)), inflate(d)));
    // the gap is exactly the alternating term
    const gap = halfUp(halfUp(d)).map((v, i) => [v[0] - inflate(d)[i][0], v[1] - inflate(d)[i][1]]);
    assert.ok(gap.every(([x]) => x === 0), "the gap is in y alone");
    assert.deepEqual(gap.map(([, y]) => y), [1, -1, 1, -1, 1, -1, 1, -1, 1, -1]);
});

test("the ladder takes half rungs, and the half rung above D is P", () => {
    for (const pts of [PENTA_UP, [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]])
        for (const g of [0, 1, 2, 3]) {
            // D at generation g + 1/2 is exactly the P wheel at generation g
            assert.ok(eq(wheelsAt(pts, g + 0.5).d, wheelsAt(pts, g).p),
                `generation ${g}: the half rung is not P`);
        }
});

test("whole rungs are unchanged by taking halves", () => {
    // The half-step index must not move any generation that already existed.
    for (let g = 0; g <= 5; g++) {
        const viaHalves = wheelsAt(PENTA_UP, g);
        let d = wheelFromPoints(PENTA_UP);
        for (let i = 1; i < g; i++) d = inflate(d);
        for (let i = 1; i > g; i--) d = deflate(d);
        assert.ok(eq(viaHalves.d, d), `generation ${g} moved`);
    }
});

test("the ladder runs negative, exactly, into psi land", () => {
    // Downward it reaches a floor and changes character rather than mirroring
    // the way up. Generation 1/2 is the last rung every coordinate stays
    // positive on; below, one seed collapses onto the origin and then the signs
    // alternate. All of it exact integer arithmetic.
    const half = wheelsAt(PENTA_UP, 0.5).d;
    assert.ok(half.slice(0, 3).every(([x, y]) => x >= 0 && y <= 0),
        `generation 1/2 should still read as a figure: ${show(half.slice(0, 3))}`);
    const hinge = wheelsAt(PENTA_UP, -0.5).d;
    assert.ok(hinge.slice(0, 3).some(([x, y]) => x === 0 && y === 0),
        `generation -1/2 should have a seed on the origin: ${show(hinge.slice(0, 3))}`);
    for (const g of [-3, -2.5, -2, -1.5, -1])
        for (const v of wheelsAt(PENTA_UP, g).d)
            assert.ok(Number.isInteger(v[0]) && Number.isInteger(v[1]),
                `generation ${g} left the lattice`);
});

test("T = S + D, and the next D = D + P", () => {
    let d = wheelFromPoints(PENTA_UP);
    for (let g = 1; g <= 8; g++) {
        const s = sWheel(d), p = pWheel(d);
        assert.ok(eq(tWheel(d), s.map((v, i) => [v[0] + d[i][0], v[1] + d[i][1]])),
            `T != S + D at generation ${g}`);
        assert.ok(eq(inflate(d), d.map((v, i) => [v[0] + p[i][0], v[1] + p[i][1]])),
            `inflate != D + P at generation ${g}`);
        d = inflate(d);
    }
});

test("T and the next D are different wheels on the same rung", () => {
    // Both are x phi^2. They differ by My's lambda = -1 term, which is why the
    // quadrille rhombs are parallelograms rather than rhombs.
    const d = wheelFromPoints(PENTA_UP);
    assert.ok(!eq(tWheel(d), inflate(d)));
    const gap = tWheel(d).map((v, i) => [v[0] - inflate(d)[i][0], v[1] - inflate(d)[i][1]]);
    assert.deepEqual(gap.slice(0, 3), [[0, 1], [0, -1], [0, 1]]);
});

test("every operator commutes with rotation", () => {
    const d = wheelFromPoints(PENTA_UP);
    const rot = (w, n) => w.map((_, t) => w[m10(t - 2 * n)]);
    for (const op of [inflate, deflate, pWheel, sWheel, tWheel, eWheel])
        for (let n = 1; n < 5; n++)
            assert.ok(eq(op(rot(d, n)), rot(op(d), n)), `${op.name} does not commute at ${n}`);
});

test("the edge wheel is the (4,0) (3,2) (1,4) basis", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    assert.deepEqual([...e.slice(0, 3)].map((p) => [...p]), [[4, 0], [3, 2], [1, 4]]);
    const lengths = new Set(e.map((p) => Math.hypot(p[0], p[1]).toFixed(6)));
    assert.deepEqual([...lengths].sort(), ["3.605551", "4.000000", "4.123106"]);
});

// ── the pentaflake, which is where the P wheel actually comes from ────────
test("the flake's edges coincide, corner for corner", () => {
    // "12 touches 21": the copy's edge (k+1 -> k) lands ON the original's edge
    // (k -> k+1), both corners exactly. Not an abutment, a coincidence.
    for (const pts of [PENTA_UP, [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]]]) {
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

test("O_k is the two corners of the shared edge, added", () => {
    const [, ...leaves] = pentaflake(PENTA_UP);
    assert.deepEqual(leaves.map((l) => [...l.center]),
        [[3, -4], [5, 2], [0, 6], [-5, 2], [-3, -4]]);
});

test("the flake measures out the P wheel, and lands on the odd tenths", () => {
    // The leaves are the 180 copies, so their centers are the down half.
    for (const pts of [PENTA_UP, [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]]]) {
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

// ── the tiles ─────────────────────────────────────────────────────────────
test("every tile walk closes", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    for (const [name, w] of Object.entries({ PENTA, STAR, BOAT, DIAMOND }))
        assert.ok(closes(w, e), `${name} does not close`);
});

test("the four walks reproduce penrose-mosaic's eight arrays", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    const at = (walk, n) => vertices(turn(walk, n), e);
    const cases = [
        ["pentaUp", PENTA, 0], ["starUp", STAR, 0],
        ["boatUp", BOAT, 0], ["boatWon", BOAT, 1], ["boatToo", BOAT, 2],
        ["diamondUp", DIAMOND, 0], ["diamondWon", DIAMOND, 1], ["diamondToo", DIAMOND, 2],
    ];
    for (const [name, walk, n] of cases)
        assert.ok(congruent(at(walk, n), SHAPES[name]),
            `${name}: turn(${n}) gave ${show(at(walk, n))}`);
});

test("tiles land where penrose-mosaic puts them, exactly", () => {
    // The congruence test above allows translation, so it proves the SHAPE and
    // says nothing about placement. This one allows nothing: a tile's loc is its
    // reference point, not a corner, and getting that wrong displaces every tile
    // by a different amount per tenth. That is a bug this file did not catch once.
    const w = wheelsAt(PENTA_UP, 1);
    const exact = (a, b) => a.length === b.length
        && a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1]);

    assert.ok(exact(pentagon(w.d, 0, [0, 0]), SHAPES.pentaUp),
        `pentaUp: ${show(pentagon(w.d, 0, [0, 0]))}`);

    for (const [name, walk, t] of [
        ["starUp", STAR, 0],
        ["boatUp", BOAT, 0], ["boatWon", BOAT, 1], ["boatToo", BOAT, 2],
        ["diamondUp", DIAMOND, 0], ["diamondToo", DIAMOND, 2],
    ]) {
        const got = starOutline(walk, w, t, [0, 0]);
        assert.ok(exact(got, SHAPES[name]), `${name}: ${show(got)}`);
    }
    // diamondWon is the same four points wound the other way in the original,
    // and starts at the same anchor.
    const won = starOutline(DIAMOND, w, 1, [0, 0]);
    assert.deepEqual([...won[0]], [...SHAPES.diamondWon[0]]);
    assert.ok(congruent(won, SHAPES.diamondWon));
});

test("the anchors are D[t] and P[t], not stored offsets", () => {
    const w = wheelsAt(PENTA_UP, 1);
    for (let t = 0; t < 10; t++) {
        assert.deepEqual([...anchorFor("penta", w, t)], [...w.d[t]]);
        assert.deepEqual([...anchorFor("star", w, t)], [...w.p[t]]);
    }
});

test("the pentagon rule gives two polygons over the ten tenths", () => {
    for (const pts of [PENTA_UP, [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]]]) {
        const { d } = wheelsAt(pts, 1);
        const shapes = new Set();
        for (let t = 0; t < 10; t++)
            shapes.add(pentagon(d, t).map((p) => `${p[0]},${p[1]}`).sort().join("|"));
        assert.equal(shapes.size, 2, "a pentagon should have exactly an up and a down");
        // and the down one is the 180 copy, which is what the flake places.
        // Normalize through the key: negating a zero gives -0, which strict
        // deepEqual will not accept against 0.
        const k = (ps) => ps.map((v) => `${v[0] + 0},${v[1] + 0}`).join(" ");
        assert.equal(k(pentagon(d, 0)), k(pts));
        assert.equal(k(pentagon(d, 5)), k(pts.map((v) => [-v[0], -v[1]])));
    }
});

test("a star is two P generations interleaved, tips and dimples", () => {
    // Jake's route in: measure the St5 first, because its center is unambiguous,
    // and the other two inherit it. Checked against all eight stored arrays.
    for (const pts of [PENTA_UP, [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]]]) {
        const L = ladderTo(pts, 3);
        const k = (ps) => ps.map((v) => `${v[0] + 0},${v[1] + 0}`).join(" ");
        for (let t = 0; t < 10; t++) {
            for (const [type, walk] of [["St5", STAR], ["St3", BOAT], ["St1", DIAMOND]]) {
                const built = starPolygon(type, L[1], L[0], t, [0, 0]);
                const stored = starOutline(walk, L[1], t, [0, 0]);
                if (type === "St1") {
                    // same four points; the stored diamond is wound the other way
                    assert.ok(congruent(built, stored), `${type} t=${t}: ${show(built)}`);
                } else {
                    assert.equal(k(built), k(stored), `${type} t=${t}`);
                }
            }
        }
    }
});

test("a star is P at stride 2, as a pentagon is D at stride 2", () => {
    const L = ladderTo(PENTA_UP, 3);
    for (let t = 0; t < 10; t++) {
        const tips = starTips(L[1], t);
        assert.equal(tips.length, 5);
        for (let i = 0; i < 5; i++)
            assert.deepEqual([...tips[i]], [...L[1].p[m10(t + 2 * i)]]);
    }
});

test("the diamond's reference needs no tie-break once it is built this way", () => {
    // The tip is the corner on P[gen]; the far corner is a dimple on P[gen-1].
    // The center is not in the outline at all, so the two congruent tips never
    // have to be told apart.
    const L = ladderTo(PENTA_UP, 3);
    for (let t = 0; t < 10; t++) {
        const d = starPolygon("St1", L[1], L[0], t, [0, 0]);
        assert.deepEqual([...d[0]], [...L[1].p[m10(t)]]);
        assert.deepEqual([...d[2]], [...L[0].p[m10(t + 5)]]);
        assert.ok(Math.hypot(...d[0]) > Math.hypot(...d[2]),
            `t=${t}: the tip should be the far corner from the center`);
    }
});

test("a turn of two tenths is the same tile again for penta and star", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    for (const walk of [PENTA, STAR])
        for (const n of [2, 4, 6, 8])
            assert.ok(congruent(vertices(turn(walk, n), e), vertices(walk, e)),
                `turn ${n} changed the shape`);
});

test("a turn of one tenth does not", () => {
    // The odd tenths are the point-down tiles. If these matched, the wheel
    // indexing would be wrong by a half turn and nothing downstream would line up.
    const e = eWheel(wheelFromPoints(PENTA_UP));
    assert.ok(!congruent(vertices(turn(PENTA, 1), e), vertices(PENTA, e)));
});

const sidesOf = (q) => {
    const close = [q[0][0] - q[3][0], q[0][1] - q[3][1]];
    return [...q.slice(0, 3).map((v, i) =>
        Math.hypot(q[i + 1][0] - v[0], q[i + 1][1] - v[1])), Math.hypot(...close)];
};

const edgesOf = (q) => [
    [q[1][0] - q[0][0], q[1][1] - q[0][1]],
    [q[2][0] - q[1][0], q[2][1] - q[1][1]],
    [q[3][0] - q[2][0], q[3][1] - q[2][1]],
    [q[0][0] - q[3][0], q[0][1] - q[3][1]],
];

test("spelled in one wheel, the rhombs are exact parallelograms", () => {
    // W[k + 5] = -W[k], so steps one and three are opposite vectors and the
    // fourth edge is forced opposite the second. True for any five points.
    for (const pts of [PENTA_UP, [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]]])
        for (const gen of [1, 2]) {
            const { d, t } = wheelsAt(pts, gen);
            const inflated = inflate(d);
            for (const spelling of ["t", "inflated"])
                for (const spec of [THICK, THIN])
                    for (let n = 0; n < 10; n++) {
                        const [e0, e1, e2, e3] = edgesOf(rhombus(spec, t, inflated, n, spelling));
                        assert.deepEqual([e0[0] + e2[0], e0[1] + e2[1]], [0, 0],
                            `${spelling} n ${n}: sides 1 and 3 are not opposite`);
                        assert.deepEqual([e1[0] + e3[0], e1[1] + e3[1]], [0, 0],
                            `${spelling} n ${n}: sides 2 and 4 are not opposite`);
                    }
        }
});

test("it is equilateral only where the wheel's spokes happen to agree", () => {
    // The T wheel's ten spokes are 8.000 9.434 8.246 8.246 9.434 and repeat, so
    // a parallelogram is a rhomb at some orientations and not at others. This is
    // the lattice showing through: exact combinatorics, approximate metric.
    const { d, t } = wheelsAt(PENTA_UP, 1);
    const inflated = inflate(d);
    const equilateral = [];
    for (let n = 0; n < 10; n++) {
        const sides = sidesOf(rhombus(THICK, t, inflated, n, "t"));
        if (sides.every((v) => Math.abs(v - sides[0]) < 1e-9)) equilateral.push(n);
    }
    assert.deepEqual(equilateral, [0, 5]);
});

test("penrose-mosaic's spelling mixes the two, and is not even a parallelogram", () => {
    const { d, t } = wheelsAt(PENTA_UP, 1);
    const inflated = inflate(d);
    const sides = sidesOf(rhombus(THICK, t, inflated, 0, "legacy"));
    assert.deepEqual(sides.map((v) => Number(v.toFixed(3))), [8.602, 9.434, 9.434, 8.602]);
    const [e0, e1, e2, e3] = edgesOf(rhombus(THICK, t, inflated, 0, "legacy"));
    assert.notDeepEqual([e0[0] + e2[0], e0[1] + e2[1]], [0, 0]);
    // adjacent pairs equal instead: a kite
    assert.ok(Math.abs(sides[0] - sides[3]) < 1e-9);
    assert.ok(Math.abs(sides[1] - sides[2]) < 1e-9);
});

test("the two phi-squared wheels differ only by the alternating term", () => {
    const { d, t } = wheelsAt(PENTA_UP, 1);
    const gap = inflate(d).map((v, i) => [v[0] - t[i][0], v[1] - t[i][1]]);
    assert.ok(gap.every(([x]) => x === 0), "the gap is in y alone");
    assert.deepEqual(gap.map(([, y]) => y), [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
});

test("the rhomb angles converge on the DISCRETE limits, not 72 and 36", () => {
    // The quadrille is not a rational approximant creeping toward Penrose. Its
    // rhombs settle on angles fixed by its own two limiting directions,
    // 34.643814 and 71.137740, and stay there:
    //
    //     thick acute -> 2 x 34.643814          = 69.287628
    //     thin  acute -> 180 - 2 x 71.137740    = 37.724519
    //
    // Measured on the tiles here; the E2 work measured the directions.
    const DIR1 = 34.643814, DIR2 = 71.137740;
    const w = wheelsAt(PENTA_UP, 20);
    const inflated = inflate(w.d);
    const thick = acuteOf(rhombus(THICK, w.t, inflated, 0, "t"));
    const thin = acuteOf(rhombus(THIN, w.t, inflated, 0, "t"));
    assert.ok(Math.abs(thick - 2 * DIR1) < 1e-5, `thick acute ${thick}`);
    assert.ok(Math.abs(thin - (180 - 2 * DIR2)) < 1e-5, `thin acute ${thin}`);
    assert.ok(Math.abs(thick - 72) > 2, "thick should NOT be the Euclidean 72");
    assert.ok(Math.abs(thin - 36) > 1, "thin should NOT be the Euclidean 36");
});

test("the rhomb ladder takes half rungs too", () => {
    // A rhomb at every phi step, so the level between big and small -- the one
    // the phi^2 P1 construction skips -- is generable.
    const PHI = (1 + Math.sqrt(5)) / 2;
    const edge = (g) => {
        const w = wheelsAt(PENTA_UP, g);
        const q = rhombus(THICK, w.t, inflate(w.d), 0, "t");
        return Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    };
    for (let g = 6; g <= 12; g += 0.5) {
        const r = edge(g + 0.5) / edge(g);
        assert.ok(Math.abs(r - PHI) < 0.02, `rung ${g} to ${g + 0.5}: x${r}`);
    }
});

test("the low rungs degenerate, and not together", () => {
    // gen 0's thick is a square; gen 1/2's thin has collapsed to a line. So the
    // thin's floor sits a half rung above the thick's -- the same lopsidedness
    // the wheel ladder has going down.
    const at = (spec, g) => {
        const w = wheelsAt(PENTA_UP, g);
        return acuteOf(rhombus(spec, w.t, inflate(w.d), 0, "t"));
    };
    assert.ok(Math.abs(at(THICK, 0) - 90) < 1e-9, `gen 0 thick should be a square`);
    assert.ok(at(THIN, 0.5) < 1e-9, `gen 0.5 thin should be degenerate`);
    // and both are healthy a rung or two up
    assert.ok(at(THICK, 2) > 50 && at(THIN, 2) > 20);
});

test("large rhombs are the small ones one generation up", () => {
    const small = wheelsAt(PENTA_UP, 1).t, large = wheelsAt(PENTA_UP, 2).t;
    assert.ok(eq(large, inflate(small)));
});

// ── the patches ───────────────────────────────────────────────────────────
const countTypes = (tiles) => {
    const n = {};
    for (const t of tiles) n[t.type] = (n[t.type] ?? 0) + 1;
    return n;
};

test("a Pe5 expands to the Sun's skeleton", () => {
    const ladder = ladderTo(PENTA_UP, 4);
    const tiles = expand("Pe5", 0, [0, 0], 1, ladder);
    // one deflation of a blue pentagon: a Pe5, five Pe3, no diamonds
    assert.deepEqual(countTypes(tiles), { Pe5: 1, Pe3: 5 });
});

test("the Sun patch has 55 rhombs' worth of tiles", () => {
    // 5 (Pe5) + 5x4 (Pe3) + 10x3 (Pe1); the St1 emit none.
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Sun", 0, [0, 0], 1, ladder));
    const rhombs = (n.Pe5 ?? 0) * 5 + (n.Pe3 ?? 0) * 4 + (n.Pe1 ?? 0) * 3;
    assert.equal(rhombs, 55, `got ${JSON.stringify(n)}`);
});

test("the Star patch has 35", () => {
    // 5x3 (Pe1) + 5x4 (Pe3); St5 and St3 emit none.
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Star", 0, [0, 0], 1, ladder));
    const rhombs = (n.Pe5 ?? 0) * 5 + (n.Pe3 ?? 0) * 4 + (n.Pe1 ?? 0) * 3;
    assert.equal(rhombs, 35, `got ${JSON.stringify(n)}`);
});

test("the deca lays its six figures", () => {
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Deca", 0, [0, 0], 1, ladder));
    assert.deepEqual(n, { Pe3: 1, St1: 2, Pe1: 2, St3: 1 });
});

test("tile counts grow by phi^4 per generation", () => {
    // Each generation is one P1 inflation of linear ratio phi^2, so area and
    // tile count go as phi^4 = 6.854.
    const ladder = ladderTo(PENTA_UP, 7);
    const counts = [1, 2, 3, 4, 5].map((g) => expand("Pe5", 0, [0, 0], g, ladder).length);
    const PHI = (1 + Math.sqrt(5)) / 2;
    for (let i = 1; i < counts.length; i++) {
        const ratio = counts[i] / counts[i - 1];
        assert.ok(Math.abs(ratio - PHI ** 4) < 0.35,
            `generation ${i + 1}: ratio ${ratio.toFixed(3)} against ${(PHI ** 4).toFixed(3)}`);
    }
});

test("no two tiles land on the same spot with the same angle", () => {
    const ladder = ladderTo(PENTA_UP, 5);
    for (const seed of ["Sun", "Star", "Deca"]) {
        const tiles = expand(seed, 0, [0, 0], 3, ladder);
        const seen = new Set(tiles.map((t) => `${t.type}:${t.tenth}:${t.loc[0]},${t.loc[1]}`));
        assert.equal(seen.size, tiles.length, `${seed} places a tile twice`);
    }
});

test("every placed tile has a walk, and it closes", () => {
    const ladder = ladderTo(PENTA_UP, 5);
    const e = ladderTo(PENTA_UP, 1)[1].e;
    for (const t of expand("Sun", 0, [0, 0], 2, ladder)) {
        const walk = WALK_OF[t.type];
        assert.ok(walk, `no walk for ${t.type}`);
        assert.ok(closes(turn(walk, t.tenth), e), `${t.type} at ${t.tenth} does not close`);
    }
});

// ── the point of the exercise ─────────────────────────────────────────────
test("five different points give a different, still coherent, tiling", () => {
    // Nothing above may depend on the quadrille seed's mirror symmetry. This
    // seed has none: it is the quadrille one with a single corner moved.
    const skew = [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]];
    const ladder = ladderTo(skew, 4);
    const tiles = expand("Sun", 0, [0, 0], 2, ladder);
    assert.ok(tiles.length > 50, `only ${tiles.length} tiles`);
    const e = ladderTo(skew, 1)[1].e;
    for (const t of tiles)
        assert.ok(closes(turn(WALK_OF[t.type], t.tenth), e),
            `${t.type} at ${t.tenth} does not close on the skew seed`);
});

// ── does a figure actually fit together? ──────────────────────────────────
//
// Congruence proves a shape, absolute placement proves one tile, and neither
// proves a FIGURE. These sample tile area on a 1/3 grid, offset off the lattice
// so no sample lands on an edge, and ask whether any point is covered twice.
// The composite seeds fail this and are excluded below, deliberately: see
// discrete-directions/NOTES.md. Do not test overlap by centroids — a centroid
// test missed most of these.

const inPoly = (p, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
};

function doubled(tiles, wheels) {
    const STEP = 1 / 3, OFF = 0.1657;
    const seen = new Map();
    for (const t of tiles) {
        const poly = outlineOf(t, wheels);
        const xs = poly.map((v) => v[0]), ys = poly.map((v) => v[1]);
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += STEP)
            for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += STEP) {
                const s = [x + OFF, y + OFF];
                if (!inPoly(s, poly)) continue;
                const k = `${s[0].toFixed(3)},${s[1].toFixed(3)}`;
                seen.set(k, (seen.get(k) ?? 0) + 1);
            }
    }
    let over = 0, total = 0;
    for (const [, n] of seen) { total++; if (n > 1) over++; }
    return { over, total };
}

test("no tile substitution covers a point twice", () => {
    for (const seed of ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1", "Deca"])
        for (const g of [1, 2]) {
            const L = ladderTo(PENTA_UP, g + 2);
            const { over, total } = doubled(expand(seed, 0, [0, 0], g, L), L[1]);
            assert.equal(over, 0, `${seed} gen ${g}: ${over}/${total} samples covered twice`);
        }
});

test("the Sun no longer overlaps itself", () => {
    // Its five diamonds were on the T wheel, "a ring further out", and stabbed
    // into the yellow pentagons. They belong on S at the odd tenths, which is
    // the wheel penta() already uses for its own.
    const L = ladderTo(PENTA_UP, 3);
    const { over } = doubled(expand("Sun", 0, [0, 0], 1, L), L[1]);
    assert.equal(over, 0, `Sun still covers ${over} samples twice`);
});

test("the Star patch still does — known broken, set aside", () => {
    // Recorded as a test so the day it is fixed, this one fails and says so.
    const L = ladderTo(PENTA_UP, 3);
    const { over } = doubled(expand("Star", 0, [0, 0], 1, L), L[1]);
    assert.ok(over > 0,
        "Star no longer overlaps itself — good; delete this test and move it "
        + "into the one above.");
});

test("an asymmetric pentagon still tiles", () => {
    // The whole reason for building this without reflections. This five has no
    // mirror at all; the figure it generates has none either, and still holds
    // together with no overlap and no interior hole.
    const skew = [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]];
    for (const g of [1, 2]) {
        const L = ladderTo(skew, g + 2);
        const tiles = expand("Pe5", 0, [0, 0], g, L);
        const { over } = doubled(tiles, L[1]);
        assert.equal(over, 0, `skew Pe5 gen ${g}: ${over} samples covered twice`);
        assert.ok(tiles.length > 5);
    }
    // and it really is asymmetric: no vertical mirror among the five
    const k = (v) => `${v[0]},${v[1]}`;
    const mirrored = new Set(skew.map((v) => k([-v[0], v[1]])));
    assert.ok(!skew.every((v) => mirrored.has(k(v))), "that seed is symmetric after all");
});

test("no tile substitution leaves an interior hole", () => {
    // A tile placed short leaves a gap without overlapping anything, so the
    // overlap test alone is not enough.
    const S = 0.25, OFF = 0.1213;
    for (const seed of ["Pe5", "St5", "St3", "St1"]) {
        const L = ladderTo(PENTA_UP, 3);
        const tiles = expand(seed, 0, [0, 0], 1, L).map((t) => outlineOf(t, L[1]));
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const poly of tiles) for (const [x, y] of poly) {
            x0 = Math.min(x0, x); x1 = Math.max(x1, x);
            y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        x0 -= 2; x1 += 2; y0 -= 2; y1 += 2;
        const W = Math.round((x1 - x0) / S) + 1, H = Math.round((y1 - y0) / S) + 1;
        const cov = new Uint8Array(W * H);
        for (const poly of tiles)
            for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
                if (cov[j * W + i]) continue;
                if (inPoly([x0 + i * S + OFF, y0 + j * S + OFF], poly)) cov[j * W + i] = 1;
            }
        const seen = new Uint8Array(W * H); const stack = [0]; seen[0] = 1;
        while (stack.length) {
            const c = stack.pop(), i = c % W, j = (c - i) / W;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const ni = i + di, nj = j + dj;
                if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
                const k = nj * W + ni;
                if (seen[k] || cov[k]) continue;
                seen[k] = 1; stack.push(k);
            }
        }
        let hole = 0;
        for (let k = 0; k < W * H; k++) if (!cov[k] && !seen[k]) hole++;
        assert.equal(hole, 0, `${seed} gen 2 has ${hole} cells of interior hole`);
    }
});

// ── the rhomb overlay sits on its tiles ───────────────────────────────────
//
// Two versions of this overlay shipped wrong: one scaled the rhombs by the
// PATCH's generation (phi^4 too big at generation 3), one by the tile's own
// (still phi^2 too big). Both passed every test in this file and were obviously
// broken the moment anyone drew them. These tests are the numeric version of
// looking at it.

test("a rhomb group has the right membership", () => {
    // penrose-mosaic's drawRhombusPattern: Pe5 five thick, Pe3 three thick and
    // one thin, Pe1 one thick and two thin.
    const count = (type) => {
        const g = rhombGroup(type, 0);
        return {
            thick: g.filter((m) => m.spec === THICK).length,
            thin: g.filter((m) => m.spec === THIN).length,
        };
    };
    assert.deepEqual(count("Pe5"), { thick: 5, thin: 0 });
    assert.deepEqual(count("Pe3"), { thick: 3, thin: 1 });
    assert.deepEqual(count("Pe1"), { thick: 1, thin: 2 });
});

test("the group's turns are the tile's angle plus even tenths", () => {
    for (const type of ["Pe5", "Pe3", "Pe1"])
        for (const t of [0, 3, 7])
            for (const { turn } of rhombGroup(type, t))
                assert.equal(m10(turn - t) % 2, 0,
                    `${type} at ${t}: turn ${turn} is not an even step from it`);
});

test("rhombs are drawn one generation below the tiles they sit on", () => {
    // The overlay hangs on leaf tiles, which are drawn at generation 1, so the
    // group that belongs there is the SMALL one -- wheels index 0. If the rhomb
    // edge is not commensurate with the pentagon it decorates, it is the wrong
    // rung, and that is exactly how this went wrong twice.
    const tileR = Math.max(...PENTA_UP.map((v) => Math.hypot(v[0], v[1])));
    const edgeAt = (g) => {
        const w = wheelsAt(PENTA_UP, g);
        const q = rhombus(THICK, w.t, inflate(w.d), 0, "t");
        return Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    };
    const ratio = edgeAt(0) / tileR;
    assert.ok(ratio > 0.5 && ratio < 1.5,
        `the small rhomb should be tile-sized: edge ${edgeAt(0)} against R ${tileR}`);
    // and the rungs either side are plainly the wrong size for a leaf tile
    assert.ok(edgeAt(1) / tileR > 2, "generation 1 is the large group, a level up");
});


// ── the rhomb oracle ──────────────────────────────────────────────────────
//
// penrose-mosaic COMPUTES these; there was never a reason to re-derive them and
// then argue about the result from screenshots. shape-modes.js imports only
// wheels.js and point.js -- no DOM -- so its `quadrille.thickRhomb` and
// `thinRhomb` can be read straight out and used as ground truth. Exported
// verbatim below, all ten tenths at both stored generations.
//
// This is what settled the spelling: the two tidy spellings that close as exact
// parallelograms match 0 of 40 shapes; the mixture that closes as a kite matches
// all 40. The kite is the real geometry.

const MOSAIC_RHOMBS = {
    thickRhomb: [
        [
            [[0,0], [-2,-3], [0,-5], [2,-3]],
            [[0,0], [0,-3], [3,-5], [3,-1]],
            [[0,0], [2,-3], [5,-1], [3,1]],
            [[0,0], [2,3], [5,1], [3,-1]],
            [[0,0], [0,3], [3,5], [3,1]],
            [[0,0], [-2,3], [0,5], [2,3]],
            [[0,0], [0,3], [-3,5], [-3,1]],
            [[0,0], [-2,3], [-5,1], [-3,-1]],
            [[0,0], [-2,-3], [-5,-1], [-3,1]],
            [[0,0], [0,-3], [-3,-5], [-3,-1]],
        ],
        [
            [[0,0], [-5,-7], [0,-15], [5,-7]],
            [[0,0], [0,-9], [8,-11], [8,-3]],
            [[0,0], [5,-7], [13,-5], [8,3]],
            [[0,0], [5,7], [13,5], [8,-3]],
            [[0,0], [0,9], [8,11], [8,3]],
            [[0,0], [-5,7], [0,15], [5,7]],
            [[0,0], [0,9], [-8,11], [-8,3]],
            [[0,0], [-5,7], [-13,5], [-8,-3]],
            [[0,0], [-5,-7], [-13,-5], [-8,3]],
            [[0,0], [0,-9], [-8,-11], [-8,-3]],
        ],
    ],
    thinRhomb: [
        [
            [[0,0], [3,1], [0,3], [-3,1]],
            [[0,0], [2,3], [-1,1], [-3,-1]],
            [[0,0], [0,3], [-2,1], [-2,-3]],
            [[0,0], [0,-3], [-2,-1], [-2,3]],
            [[0,0], [2,-3], [-1,-1], [-3,1]],
            [[0,0], [3,-1], [0,-3], [-3,-1]],
            [[0,0], [-2,-3], [1,-1], [3,1]],
            [[0,0], [0,-3], [2,-1], [2,3]],
            [[0,0], [0,3], [2,1], [2,-3]],
            [[0,0], [-2,3], [1,1], [3,-1]],
        ],
        [
            [[0,0], [8,3], [0,5], [-8,3]],
            [[0,0], [5,7], [-3,5], [-8,-3]],
            [[0,0], [0,9], [-5,1], [-5,-7]],
            [[0,0], [0,-9], [-5,-1], [-5,7]],
            [[0,0], [5,-7], [-3,-5], [-8,3]],
            [[0,0], [8,-3], [0,-5], [-8,-3]],
            [[0,0], [-5,-7], [3,-5], [8,3]],
            [[0,0], [0,-9], [5,-1], [5,7]],
            [[0,0], [0,9], [5,1], [5,-7]],
            [[0,0], [-5,7], [3,5], [8,-3]],
        ],
    ],
};

test("the rhombs are penrose-mosaic's, at every tenth and both generations", () => {
    const key = (a) => a.map((v) => `${v[0] + 0},${v[1] + 0}`).join(" ");
    // shapeWheel builds tenths 3,4,5,8,9 by reflection, which reverses the
    // winding; this module builds them by rotation, which does not. Same
    // polygon either way, so compare as a closed outline.
    const sameLoop = (a, b) => {
        if (a.length !== b.length) return false;
        for (const seq of [a, [a[0], ...a.slice(1).reverse()]])
            if (key(seq) === key(b)) return true;
        return false;
    };
    for (let g = 0; g < 2; g++) {
        const w = wheelsAt(PENTA_UP, g);
        const inflated = inflate(w.d);
        for (let t = 0; t < 10; t++)
            for (const [name, spec] of [["thickRhomb", THICK], ["thinRhomb", THIN]]) {
                const mine = rhombus(spec, w.t, inflated, t, "mixed");
                assert.ok(sameLoop(mine, MOSAIC_RHOMBS[name][g][t]),
                    `${name}[${g}] tenth ${t}: ${key(mine)} against ${key(MOSAIC_RHOMBS[name][g][t])}`);
            }
    }
});

test("the tidy spellings do NOT match, which is why mixed is the default", () => {
    const key = (a) => a.map((v) => `${v[0] + 0},${v[1] + 0}`).join(" ");
    const w = wheelsAt(PENTA_UP, 0);
    const inflated = inflate(w.d);
    for (const spelling of ["t", "inflated"])
        assert.notEqual(key(rhombus(THICK, w.t, inflated, 0, spelling)),
            key(MOSAIC_RHOMBS.thickRhomb[0][0]),
            `spelling ${spelling} unexpectedly matches -- re-check the default`);
});


// ── the real preset ───────────────────────────────────────────────────────
//
// The lattice was never a requirement, only what the quadrille uses. Given a
// REGULAR pentagon the same code should land on Euclidean Penrose -- and it
// should land there at once, since a regular pentagon is the substitution's
// fixed point.

test("the real preset is regular, side 4, centered on the origin", () => {
    const side = (ps, i) => Math.hypot(ps[(i + 1) % 5][0] - ps[i][0],
                                       ps[(i + 1) % 5][1] - ps[i][1]);
    for (let i = 0; i < 5; i++)
        assert.ok(Math.abs(side(REAL_PENTA, i) - 4) < 1e-12,
            `side ${i} is ${side(REAL_PENTA, i)}`);
    const R = 4 / (2 * Math.sin(Math.PI / 5));
    for (const p of REAL_PENTA)
        assert.ok(Math.abs(Math.hypot(p[0], p[1]) - R) < 1e-12);
    assert.deepEqual(PRESETS.real, REAL_PENTA);
    assert.deepEqual(PRESETS.quadrille, PENTA_UP);
});

test("the real preset gives 72 and 36 exactly, at every generation", () => {
    const acute = (q) => {
        const a = [];
        for (let i = 0; i < 4; i++) {
            const u = [q[(i + 3) % 4][0] - q[i][0], q[(i + 3) % 4][1] - q[i][1]];
            const v = [q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]];
            a.push(Math.acos((u[0] * v[0] + u[1] * v[1])
                / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI);
        }
        return Math.min(...a);
    };
    for (const g of [1, 2, 3, 5, 8]) {
        const w = wheelsAt(REAL_PENTA, g);
        const inflated = inflate(w.d);
        assert.ok(Math.abs(acute(rhombus(THICK, w.t, inflated, 0, "mixed")) - 72) < 1e-9,
            `generation ${g} thick`);
        assert.ok(Math.abs(acute(rhombus(THIN, w.t, inflated, 0, "mixed")) - 36) < 1e-9,
            `generation ${g} thin`);
    }
});

test("the real pentagon has one edge length, the quadrille three", () => {
    const lengths = (pts) => new Set(eWheel(wheelFromPoints(pts))
        .map((p) => Math.hypot(p[0], p[1]).toFixed(6)));
    assert.equal(lengths(REAL_PENTA).size, 1);
    assert.deepEqual([...lengths(REAL_PENTA)], ["4.000000"]);
    assert.equal(lengths(PENTA_UP).size, 3);
});

test("the pentaflake identity holds off the lattice too", () => {
    // O_k = pts[k] + pts[k+1], and for a regular pentagon that is 2r = 2R cos36.
    const [, ...leaves] = pentaflake(REAL_PENTA);
    const R = 4 / (2 * Math.sin(Math.PI / 5));
    for (const leaf of leaves)
        assert.ok(Math.abs(Math.hypot(...leaf.center) - 2 * R * Math.cos(Math.PI / 5)) < 1e-12,
            `|O_${leaf.edge}| = ${Math.hypot(...leaf.center)}`);
});

test("a real patch holds together, same as an integer one", () => {
    for (const g of [1, 2]) {
        const L = ladderTo(REAL_PENTA, g + 2);
        const tiles = expand("Pe5", 0, [0, 0], g, L);
        const { over } = doubled(tiles, L[1]);
        assert.equal(over, 0, `real Pe5 gen ${g}: ${over} samples covered twice`);
    }
});


// ── self-intersection, and the fill rule ──────────────────────────────────

/**
 * Number of non-adjacent edge pairs that PROPERLY cross.
 *
 * Collinear is not crossing. A first version of this returned `Math.sign(...)`
 * and treated a zero — three points in a line — as a difference, which reported
 * twelve self-intersections in the real preset that were not there. Several of a
 * star's vertices share a y, so the false positives were not rare. Drawing both
 * fill rules side by side gave identical pictures, which is what caught it.
 */
function selfCrossings(poly) {
    const side = (p, q, r) => {
        const v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        return Math.abs(v) < 1e-9 ? 0 : Math.sign(v);
    };
    const crosses = (a, b, c, d) => {
        const d1 = side(c, d, a), d2 = side(c, d, b);
        const d3 = side(a, b, c), d4 = side(a, b, d);
        return d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0 && d1 !== d2 && d3 !== d4;
    };
    const n = poly.length;
    let count = 0;
    for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
            if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
            if (crosses(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) count++;
        }
    return count;
}

test("no tile outline self-intersects, on either preset", () => {
    // Tiles are filled even-odd anyway, because it is the rule that stays
    // correct if a walk is ever changed and costs nothing when it is not. But
    // the claim to hold onto is this one: as built, every outline is simple, so
    // the two fill rules agree on every tile this module currently draws.
    for (const [name, pts] of [["quadrille", PENTA_UP], ["real", REAL_PENTA],
                               ["skew", [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]]]) {
        const L = ladderTo(pts, 6);
        for (let g = 1; g <= 5; g++)
            for (let t = 0; t < 10; t++)
                for (const [kind, poly] of [
                    ["Pe", pentagon(L[g].d, t)],
                    ["St5", starPolygon("St5", L[g], L[g - 1], t)],
                    ["St3", starPolygon("St3", L[g], L[g - 1], t)],
                    ["St1", starPolygon("St1", L[g], L[g - 1], t)],
                ])
                    assert.equal(selfCrossings(poly), 0,
                        `${name} ${kind} generation ${g} tenth ${t} crosses itself`);
    }
});

test("collinear vertices are not crossings", () => {
    // The bug the test above was written around: a square with an extra point
    // in the middle of one side is simple, not self-intersecting.
    assert.equal(selfCrossings([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]]), 0);
    // and a genuine crossing is still found
    assert.ok(selfCrossings([[0, 0], [4, 4], [4, 0], [0, 4]]) > 0);
});


// ── adopting a derived pentagon ───────────────────────────────────────────
//
// The rung slider shows the pentagon at generation x.x, and "use this pentagon"
// takes it as the new five. That is only sound if re-basing is exact.

/**
 * Two wheels equal within a relative tolerance.
 *
 * String comparison of fixed decimals is not safe here: the real preset is
 * irrational, and `0` against `-0` prints differently while being the same
 * number. That has now caught three tests in this file, so compare numerically.
 */
const sameWheel = (a, b, tol = 1e-9) => {
    if (a.length !== b.length) return false;
    const scale = Math.max(1, ...a.map((v) => Math.hypot(v[0], v[1])));
    return a.every((v, i) =>
        Math.hypot(v[0] - b[i][0], v[1] - b[i][1]) <= tol * scale);
};

test("an adopted pentagon reads back as the rung it was taken from", () => {
    for (const pts of [PENTA_UP, REAL_PENTA,
                       [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]])
        for (const r of [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]) {
            const adopted = pentagon(wheelsAt(pts, r).d, 0);
            assert.ok(sameWheel(wheelsAt(adopted, 1).d, wheelsAt(pts, r).d),
                `rung ${r} does not re-base`);
        }
});

const isHalf = (r) => Math.round(r * 2) % 2 !== 0;

test("halfUp twice is inflate only when the pentagon is regular", () => {
    // They are different operators -- halfUp^2 is s^-2 + 2 + s^2 while inflate
    // is s^-1 + 1 + s -- but on a REGULAR wheel both scale by exactly phi^2,
    // because 2cos72 + 2 = 1 + 2cos36. So they agree on the real pentagon and
    // diverge on any irregular one. The gap is a property of the geometry, not
    // of the operators.
    const d = (pts) => wheelFromPoints(pts);
    assert.ok(sameWheel(halfUp(halfUp(d(REAL_PENTA))), inflate(d(REAL_PENTA))));
    for (const pts of [PENTA_UP, [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]])
        assert.ok(!sameWheel(halfUp(halfUp(d(pts))), inflate(d(pts))));
    assert.ok(Math.abs((2 * Math.cos(2 * Math.PI / 5) + 2)
        - (1 + 2 * Math.cos(Math.PI / 5))) < 1e-12);
});

test("stepping on from an adopted pentagon agrees, except for the half-step gap", () => {
    // Adopting rung `taken` and walking to `then` lands on rung taken+then-1 of
    // the original. On an irregular pentagon that fails when BOTH are half
    // rungs, because it composes halfUp twice. On a regular one it never fails.
    for (const [name, pts, regular] of [
        ["quadrille", PENTA_UP, false],
        ["real", REAL_PENTA, true],
        ["skew", [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]], false],
    ]) {
        let diverged = 0;
        for (const taken of [0, 1, 1.5, 2, 2.5])
            for (const then of [1, 2, 2.5, 3]) {
                const adopted = pentagon(wheelsAt(pts, taken).d, 0);
                const same = sameWheel(wheelsAt(adopted, then).d,
                    wheelsAt(pts, taken + then - 1).d);
                if (regular || !(isHalf(taken) && isHalf(then)))
                    assert.ok(same, `${name}: adopt ${taken} then ${then} should agree`);
                else if (!same) diverged++;
            }
        if (!regular) assert.ok(diverged > 0, `${name} should show the half-step gap`);
    }
});

test("adopting from the quadrille stays on the lattice, even at half rungs", () => {
    // Every wheel operator is an integer combination, so a derived quadrille
    // pentagon is still a lattice pentagon and snapping stays safe.
    for (const r of [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3])
        for (const v of pentagon(wheelsAt(PENTA_UP, r).d, 0))
            assert.ok(Number.isInteger(v[0]) && Number.isInteger(v[1]),
                `rung ${r} left the lattice: (${v})`);
    // and adopting from the real preset does not, which is why snap follows it
    assert.ok(!pentagon(wheelsAt(REAL_PENTA, 0.5).d, 0)
        .every((v) => Number.isInteger(v[0]) && Number.isInteger(v[1])));
});
