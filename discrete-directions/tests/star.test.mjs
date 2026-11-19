// The star family, checked against penrose-mosaic's stored outlines.
//
// Those eight arrays are the oracle: they were found by hand on quadrille paper
// and they are what "a star" means for the symmetric pentagon. `star.js` stores
// none of them — it interleaves two consecutive P generations and the arrays
// come out. If that ever stops being true, this file is where it shows.
//
// Transcribed from penrose-mosaic's `shape-modes.js`, class Quadrille. Fixture,
// not implementation: nothing in `src/math/` imports it.

import test from "node:test";
import assert from "node:assert/strict";

import { starPolygon, starTips } from "../src/math/star.js";
import { PENTA_UP, REAL_PENTA, ladderTo, m10 } from "../src/math/wheel.js";

// ── penrose-mosaic, transcribed: shape-modes.js, class Quadrille ──────────
const SHAPES = {
    starUp: [[0, -6], [1, -2], [5, -2], [2, 0], [3, 4], [0, 2], [-3, 4], [-2, 0], [-5, -2], [-1, -2]],
    boatUp: [[0, -6], [1, -2], [5, -2], [2, 0], [-2, 0], [-5, -2], [-1, -2]],
    boatWon: [[3, -4], [2, 0], [5, 2], [1, 2], [-2, 0], [-3, -4], [0, -2]],
    boatToo: [[5, -2], [2, 0], [3, 4], [0, 2], [-1, -2], [0, -6], [1, -2]],
    diamondUp: [[0, -6], [1, -2], [0, 2], [-1, -2]],
    diamondWon: [[3, -4], [0, -2], [-1, 2], [2, 0]],
    diamondToo: [[5, -2], [2, 0], [-2, 0], [1, -2]],
};

/** A seed with no symmetry at all, to keep the construction from leaning on one. */
const LOPSIDED = [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]];

const show = (ps) => ps.map((p) => `(${p[0]},${p[1]})`).join(" ");
/** Normalized through the key: negating a zero gives −0, which strict equality
 *  of formatted pairs would reject against 0. */
const key2 = (p) => `${p[0] + 0},${p[1] + 0}`;
const key = (ps) => ps.map(key2).join(" ");

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

// ── the measurement ──────────────────────────────────────────────────────
test("two P generations interleaved are penrose-mosaic's stored stars", () => {
    // Tips on P[gen], dimples on P[gen-1], about the star's center. The stored
    // arrays come out at the right tenth with no offset table in between.
    const L = ladderTo(PENTA_UP, 2);
    for (const [name, type, t] of [
        ["starUp", "St5", 0],
        ["boatUp", "St3", 0], ["boatWon", "St3", 1], ["boatToo", "St3", 2],
    ]) {
        const got = starPolygon(type, L[1], L[0], t, [0, 0]);
        assert.equal(key(got), key(SHAPES[name]), `${name}: ${show(got)}`);
    }
    // The three diamonds are the same four points; penrose-mosaic winds them
    // the other way round, which is the one difference in the eight.
    for (const [name, t] of [["diamondUp", 0], ["diamondWon", 1], ["diamondToo", 2]]) {
        const got = starPolygon("St1", L[1], L[0], t, [0, 0]);
        assert.ok(congruent(got, SHAPES[name]), `${name}: ${show(got)}`);
    }
});

test("a star's tips are P[gen] and its dimples P[gen-1], at every tenth", () => {
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const L = ladderTo(pts, 2);
        for (let t = 0; t < 10; t++) {
            const poly = starPolygon("St5", L[1], L[0], t, [0, 0]);
            assert.equal(poly.length, 10);
            for (let i = 0; i < 10; i++) {
                const from = i % 2 === 0 ? L[1].p : L[0].p;
                assert.deepEqual([...poly[i]], [...from[m10(t + i)]], `t=${t} vertex ${i}`);
            }
        }
    }
});

test("St3 and St1 are the St5 with points missing, same center", () => {
    // What their names say: drop tips, keep the middle. Every vertex of the two
    // smaller tiles is a vertex of the St5 at the same tenth -- except the
    // diamond's far corner, which closes across the star through t+5.
    for (const pts of [PENTA_UP, LOPSIDED]) {
        const L = ladderTo(pts, 2);
        for (let t = 0; t < 10; t++) {
            const five = new Set(starPolygon("St5", L[1], L[0], t).map(key2));
            for (const type of ["St3", "St1"])
                for (const v of starPolygon(type, L[1], L[0], t))
                    assert.ok(five.has(key2(v)), `${type} t=${t} vertex ${show([v])} is not the St5's`);
        }
    }
});
test("a star is P at stride 2, as a pentagon is D at stride 2", () => {
    for (const pts of [PENTA_UP, LOPSIDED, REAL_PENTA]) {
        const L = ladderTo(pts, 3);
        for (let t = 0; t < 10; t++) {
            const tips = starTips(L[1], t);
            assert.equal(tips.length, 5);
            for (let i = 0; i < 5; i++)
                assert.deepEqual([...tips[i]], [...L[1].p[m10(t + 2 * i)]]);
        }
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

test("loc translates the outline and nothing else", () => {
    const L = ladderTo(PENTA_UP, 2);
    for (const type of ["St5", "St3", "St1"]) {
        const at = starPolygon(type, L[1], L[0], 3, [17, -5]);
        const home = starPolygon(type, L[1], L[0], 3);
        assert.deepEqual(at.map((p) => [p[0] - 17, p[1] + 5]), home.map((p) => [...p]));
    }
});

test("no star outline self-intersects, on any of the three seeds", () => {
    for (const [name, pts] of [["quadrille", PENTA_UP], ["real", REAL_PENTA],
                               ["lopsided", LOPSIDED]]) {
        const L = ladderTo(pts, 6);
        for (let g = 1; g <= 5; g++)
            for (let t = 0; t < 10; t++)
                for (const type of ["St5", "St3", "St1"])
                    assert.equal(selfCrossings(starPolygon(type, L[g], L[g - 1], t)), 0,
                        `${name} ${type} generation ${g} tenth ${t} crosses itself`);
    }
});
