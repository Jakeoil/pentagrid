// Tiles as walks, and the rhomb overlay, both checked against penrose-mosaic.
//
// Two oracles live in this file, and both are things penrose-mosaic COMPUTES or
// STORES rather than draws:
//
//   `SHAPES`         its eight stored tile outlines, shape-modes.js class
//                    Quadrille. Four walks here reproduce all eight.
//   `MOSAIC_RHOMBS`  its computed `quadrille.thickRhomb` / `thinRhomb`, all ten
//                    tenths at both stored generations.
//
// The second one is why the rhomb spelling is settled rather than argued: the
// two tidy spellings that close as exact parallelograms match 0 of those 40
// shapes, and the mixture that closes as a kite matches all 40. shape-modes.js
// imports only wheels.js and point.js -- no DOM -- so it can be read straight
// out under node, which is what should have happened the first time.
//
// Fixtures, not implementation: nothing in `src/math/` imports either one.

import test from "node:test";
import assert from "node:assert/strict";

import {
    BOAT, DIAMOND, PENTA, STAR, THICK, THIN, anchorFor, closes, pentagon,
    reverse, rhombGroup, rhombus, starOutline, turn, vertices,
} from "../src/math/walk.js";
import {
    PENTA_UP, REAL_PENTA, eWheel, inflate, m10, wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";

// ── penrose-mosaic, transcribed: shape-modes.js, class Quadrille ──────────
const SHAPES = {
    pentaUp: [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]],
    starUp: [[0, -6], [1, -2], [5, -2], [2, 0], [3, 4], [0, 2], [-3, 4], [-2, 0], [-5, -2], [-1, -2]],
    boatUp: [[0, -6], [1, -2], [5, -2], [2, 0], [-2, 0], [-5, -2], [-1, -2]],
    boatWon: [[3, -4], [2, 0], [5, 2], [1, 2], [-2, 0], [-3, -4], [0, -2]],
    boatToo: [[5, -2], [2, 0], [3, 4], [0, 2], [-1, -2], [0, -6], [1, -2]],
    diamondUp: [[0, -6], [1, -2], [0, 2], [-1, -2]],
    diamondWon: [[3, -4], [0, -2], [-1, 2], [2, 0]],
    diamondToo: [[5, -2], [2, 0], [-2, 0], [1, -2]],
};

// ── penrose-mosaic, computed: shape-modes.js quadrille.thickRhomb/thinRhomb ──
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

/** A seed with no symmetry at all, to keep the construction from leaning on one. */
const LOPSIDED = [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]];

const show = (ps) => ps.map((p) => `(${p[0]},${p[1]})`).join(" ");
/** Normalized through the key: negating a zero gives −0, which strict equality
 *  of formatted pairs would reject against 0. */
const key = (ps) => ps.map((p) => `${p[0] + 0},${p[1] + 0}`).join(" ");
const exact = (a, b) =>
    a.length === b.length && a.every((v, i) => v[0] === b[i][0] && v[1] === b[i][1]);

/** Same closed polygon up to where the walk starts and which way it winds. */
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

/** The same four points in the same place, start and winding aside. */
const sameLoop = (a, b) => {
    if (a.length !== b.length) return false;
    for (const seq of [a, [a[0], ...a.slice(1).reverse()]])
        if (key(seq) === key(b)) return true;
    return false;
};

const edgesOf = (q) => [
    [q[1][0] - q[0][0], q[1][1] - q[0][1]],
    [q[2][0] - q[1][0], q[2][1] - q[1][1]],
    [q[3][0] - q[2][0], q[3][1] - q[2][1]],
    [q[0][0] - q[3][0], q[0][1] - q[3][1]],
];
const sidesOf = (q) => edgesOf(q).map((e) => Math.hypot(e[0], e[1]));
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

// ── the tiles ─────────────────────────────────────────────────────────────
test("every tile walk closes", () => {
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const e = eWheel(wheelFromPoints(pts));
        for (const [name, w] of Object.entries({ PENTA, STAR, BOAT, DIAMOND }))
            assert.ok(closes(w, e), `${name} does not close on ${show(pts)}`);
    }
});

test("closes() is an exact integer predicate, so the real preset fails it", () => {
    // Known limitation, recorded rather than hidden. The walks close on the real
    // pentagon too -- the residue is rounding, 1e-15 on a figure of size 4 --
    // but `closes` asks for === 0, which only the lattice can give. Every other
    // function in this module is indifferent to whether the five points are
    // integers; this one is not, and it is the one place a tolerance belongs.
    const e = eWheel(wheelFromPoints(REAL_PENTA));
    for (const [name, w] of Object.entries({ PENTA, STAR, BOAT })) {
        let x = 0, y = 0;
        for (const t of w) { x += e[m10(t)][0]; y += e[m10(t)][1]; }
        assert.ok(Math.hypot(x, y) < 1e-12, `${name} residue ${Math.hypot(x, y)}`);
        assert.equal(closes(w, e), false, `${name} unexpectedly closes exactly`);
    }
    // the diamond happens to cancel exactly, which is luck, not a rule
    assert.ok(closes(DIAMOND, e));
});

test("a turned walk still closes, at every tenth", () => {
    const e = eWheel(wheelFromPoints(PENTA_UP));
    for (const w of [PENTA, STAR, BOAT, DIAMOND])
        for (let n = 0; n < 10; n++)
            assert.ok(closes(turn(w, n), e), `turn ${n} does not close`);
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
    // by a different amount per tenth. That is a bug the tests did not catch once.
    const w = wheelsAt(PENTA_UP, 1);
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
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const w = wheelsAt(pts, 1);
        for (let t = 0; t < 10; t++) {
            assert.deepEqual([...anchorFor("penta", w, t)], [...w.d[t]]);
            assert.deepEqual([...anchorFor("star", w, t)], [...w.p[t]]);
        }
    }
});

test("the pentagon rule gives two polygons over the ten tenths", () => {
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const { d } = wheelsAt(pts, 1);
        const shapes = new Set();
        for (let t = 0; t < 10; t++)
            shapes.add(pentagon(d, t).map((p) => `${p[0]},${p[1]}`).sort().join("|"));
        assert.equal(shapes.size, 2, "a pentagon should have exactly an up and a down");
        // and the down one is the 180 copy, which is what the flake places.
        assert.equal(key(pentagon(d, 0)), key(pts));
        assert.equal(key(pentagon(d, 5)), key(pts.map((v) => [-v[0], -v[1]])));
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

test("turn is the only rotation primitive, and ten turns are the identity", () => {
    for (const walk of [PENTA, STAR, BOAT, DIAMOND]) {
        assert.deepEqual([...turn(walk, 10)], [...walk]);
        assert.deepEqual([...turn(turn(walk, 3), 7)], [...walk]);
        assert.deepEqual([...turn(walk, -1)], [...turn(walk, 9)]);
    }
});

test("re-winding an outline is turn(reverse(walk), 5), not reverse alone", () => {
    // Walking an outline backwards takes each edge negated, in reverse order,
    // and negating is +5. Reverse by itself is the index-reversal mirror the
    // header mentions -- it gives the mirror IMAGE, which is a different figure.
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const e = eWheel(wheelFromPoints(pts));
        for (const walk of [PENTA, STAR, BOAT, DIAMOND]) {
            assert.ok(closes(reverse(walk), e), "a reversed walk still closes");
            assert.deepEqual([...reverse(reverse(walk))], [...walk]);
            assert.ok(congruent(vertices(turn(reverse(walk), 5), e), vertices(walk, e)),
                "the re-wound outline should be the same polygon");
        }
    }
});

test("reverse alone draws the 180 copy, for any five points", () => {
    // Reversal negates every step relative to the backwards walk, so the figure
    // it draws is the re-wound outline point-reflected through the origin: the
    // tile's 180 copy, which is the SAME construction the pentaflake uses for a
    // leaf. No mirror axis is involved, which is the point -- a negation works
    // on five points with no symmetry, and a reflection would not.
    const neg = (ps) => ps.map((p) => [-p[0], -p[1]]);
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const e = eWheel(wheelFromPoints(pts));
        for (const walk of [PENTA, STAR, BOAT, DIAMOND])
            assert.ok(congruent(vertices(reverse(walk), e), neg(vertices(walk, e))),
                `${show(vertices(reverse(walk), e))} is not the 180 copy`);
    }
    // On penrose-mosaic's symmetric pentaUp the 180 copy coincides with the
    // y-mirror, which is where the helper came from and why its old comment
    // called it a winding change. On a lopsided seed those two part company.
    const quad = eWheel(wheelFromPoints(PENTA_UP));
    for (const walk of [PENTA, STAR, BOAT, DIAMOND]) {
        const a = vertices(walk, quad), b = vertices(reverse(walk), quad);
        assert.ok(a.every((p, i) => p[0] === b[i][0] && p[1] === -b[i][1]),
            `${show(b)} is not the y-mirror of ${show(a)}`);
    }
    const lop = eWheel(wheelFromPoints(LOPSIDED));
    const a = vertices(PENTA, lop), b = vertices(reverse(PENTA), lop);
    assert.ok(!a.every((p, i) => p[0] === b[i][0] && p[1] === -b[i][1]),
        "a lopsided seed should not give the y-mirror");
});

// ── the rhombs ────────────────────────────────────────────────────────────
test("spelled in one wheel, the rhombs are exact parallelograms", () => {
    // W[k + 5] = -W[k], so steps one and three are opposite vectors and the
    // fourth edge is forced opposite the second. True for any five points.
    for (const pts of [PENTA_UP, LOPSIDED])
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
    const sides = sidesOf(rhombus(THICK, t, inflated, 0, "classic"));
    assert.deepEqual(sides.map((v) => Number(v.toFixed(3))), [8.602, 9.434, 9.434, 8.602]);
    const [e0, , e2] = edgesOf(rhombus(THICK, t, inflated, 0, "classic"));
    assert.notDeepEqual([e0[0] + e2[0], e0[1] + e2[1]], [0, 0]);
    // adjacent pairs equal instead: a kite
    assert.ok(Math.abs(sides[0] - sides[3]) < 1e-9);
    assert.ok(Math.abs(sides[1] - sides[2]) < 1e-9);
});

test("mixed is the default spelling", () => {
    const { d, t } = wheelsAt(PENTA_UP, 1);
    const inflated = inflate(d);
    for (let n = 0; n < 10; n++)
        for (const spec of [THICK, THIN])
            assert.equal(key(rhombus(spec, t, inflated, n)),
                key(rhombus(spec, t, inflated, n, "classic")));
});

test("the rhombs are penrose-mosaic's, at every tenth and both generations", () => {
    // shapeWheel builds tenths 3,4,5,8,9 by reflection, which reverses the
    // winding; this module builds them by rotation, which does not. Same
    // polygon either way, so compare as a closed outline.
    for (let g = 0; g < 2; g++) {
        const w = wheelsAt(PENTA_UP, g);
        const inflated = inflate(w.d);
        for (let t = 0; t < 10; t++)
            for (const [name, spec] of [["thickRhomb", THICK], ["thinRhomb", THIN]]) {
                const mine = rhombus(spec, w.t, inflated, t, "classic");
                assert.ok(sameLoop(mine, MOSAIC_RHOMBS[name][g][t]),
                    `${name}[${g}] tenth ${t}: ${key(mine)} against ${key(MOSAIC_RHOMBS[name][g][t])}`);
            }
    }
});

test("the tidy spellings do NOT match, which is why mixed is the default", () => {
    // 0 of 40 against penrose-mosaic, where mixed takes all 40. This is the
    // whole argument, and it is settled by diffing the oracle, not by looking.
    let matches = 0;
    for (const spelling of ["t", "inflated"])
        for (let g = 0; g < 2; g++) {
            const w = wheelsAt(PENTA_UP, g);
            const inflated = inflate(w.d);
            for (let t = 0; t < 10; t++)
                for (const [name, spec] of [["thickRhomb", THICK], ["thinRhomb", THIN]])
                    if (sameLoop(rhombus(spec, w.t, inflated, t, spelling),
                                 MOSAIC_RHOMBS[name][g][t])) matches++;
        }
    assert.equal(matches, 0, "a tidy spelling matched -- re-check the default");
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

test("the real preset's rhombs are 72 and 36 at once, with nothing to converge", () => {
    for (const g of [1, 2, 3]) {
        const w = wheelsAt(REAL_PENTA, g);
        const inflated = inflate(w.d);
        assert.ok(Math.abs(acuteOf(rhombus(THICK, w.t, inflated, 0, "t")) - 72) < 1e-9,
            `generation ${g} thick`);
        assert.ok(Math.abs(acuteOf(rhombus(THIN, w.t, inflated, 0, "t")) - 36) < 1e-9,
            `generation ${g} thin`);
    }
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
    assert.ok(Math.abs(at(THICK, 0) - 90) < 1e-9, "gen 0 thick should be a square");
    assert.ok(at(THIN, 0.5) < 1e-9, "gen 0.5 thin should be degenerate");
    // and both are healthy a rung or two up
    assert.ok(at(THICK, 2) > 50 && at(THIN, 2) > 20);
});

test("large rhombs are the small ones one generation up", () => {
    const small = wheelsAt(PENTA_UP, 1).t, large = wheelsAt(PENTA_UP, 2).t;
    assert.equal(key(large), key(inflate(small)));
});

// ── the rhomb overlay sits on its tiles ───────────────────────────────────
//
// Two versions of this overlay shipped wrong: one scaled the rhombs by the
// PATCH's generation (phi^4 too big at generation 3), one by the tile's own
// (still phi^2 too big). Both passed every numeric test there was and were
// obviously broken the moment anyone drew them. These tests are the numeric
// version of looking at it.

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

test("a rhomb group is five rhombs for a Pe5, not one", () => {
    // The overlay's first version drew one rhomb per pentagon. It is one group
    // per pentagon, and a group has members.
    assert.equal(rhombGroup("Pe5", 0).length, 5);
    assert.equal(rhombGroup("Pe3", 0).length, 4);
    assert.equal(rhombGroup("Pe1", 0).length, 3);
});

test("the group's turns are the tile's angle plus even tenths", () => {
    for (const type of ["Pe5", "Pe3", "Pe1"])
        for (const t of [0, 3, 7])
            for (const { turn: n } of rhombGroup(type, t))
                assert.equal(m10(n - t) % 2, 0,
                    `${type} at ${t}: turn ${n} is not an even step from it`);
});

test("a group turns with its tile, as a shift and nothing else", () => {
    for (const type of ["Pe5", "Pe3", "Pe1"])
        for (let t = 0; t < 10; t++) {
            const home = rhombGroup(type, 0), moved = rhombGroup(type, t);
            assert.equal(moved.length, home.length);
            moved.forEach((m, i) => {
                assert.equal(m.spec, home[i].spec, `${type} at ${t}: member ${i} changed shape`);
                assert.equal(m.turn, m10(home[i].turn + t));
            });
        }
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
