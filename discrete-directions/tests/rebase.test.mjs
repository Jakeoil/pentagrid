// Adopting a derived pentagon: the ladder as a generator, not only a view.
//
// by-your-bootstraps shows the pentagon at generation x.x and "use this
// pentagon" takes it as the new five. That is only sound if re-basing is exact
// -- a rung read back at rung 1 has to give exactly the wheel it came from --
// and these are the tests of that. Ported from pentagrid's
// `tools/bootstrap.test.mjs` when `src/bootstrap/` was deleted.
//
// They are also where the two-ladder gap is pinned: `halfUp` twice is not
// `inflate`, except on a regular pentagon, where it is. See PLAN.md §2a.

import test from "node:test";
import assert from "node:assert/strict";

import {
    PENTA_UP, REAL_PENTA, halfUp, inflate, wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";
import { pentagon } from "../src/math/walk.js";

/** Five points with no mirror at all. */
const SKEW = [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]];

/**
 * Two wheels equal within a relative tolerance.
 *
 * String comparison of fixed decimals is not safe here: the real preset is
 * irrational, and `0` against `-0` prints differently while being the same
 * number. That caught three tests in the file these came from, so compare
 * numerically.
 */
const sameWheel = (a, b, tol = 1e-9) => {
    if (a.length !== b.length) return false;
    const scale = Math.max(1, ...a.map((v) => Math.hypot(v[0], v[1])));
    return a.every((v, i) =>
        Math.hypot(v[0] - b[i][0], v[1] - b[i][1]) <= tol * scale);
};

const isHalf = (r) => Math.round(r * 2) % 2 !== 0;

test("an adopted pentagon reads back as the rung it was taken from", () => {
    for (const pts of [PENTA_UP, REAL_PENTA, SKEW])
        for (const r of [-1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]) {
            const adopted = pentagon(wheelsAt(pts, r).d, 0);
            assert.ok(sameWheel(wheelsAt(adopted, 1).d, wheelsAt(pts, r).d),
                `rung ${r} does not re-base`);
        }
});

test("halfUp twice is inflate only when the pentagon is regular", () => {
    // They are different operators -- halfUp^2 is s^-2 + 2 + s^2 while inflate
    // is s^-1 + 1 + s -- but on a REGULAR wheel both scale by exactly phi^2,
    // because 2cos72 + 2 = 1 + 2cos36. So they agree on the real pentagon and
    // diverge on any irregular one. The gap is a property of the geometry, not
    // of the operators.
    const d = (pts) => wheelFromPoints(pts);
    assert.ok(sameWheel(halfUp(halfUp(d(REAL_PENTA))), inflate(d(REAL_PENTA))));
    for (const pts of [PENTA_UP, SKEW])
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
        ["skew", SKEW, false],
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

test("stepping extrapolate up and back returns the original five exactly", () => {
    // The page holds the five and derives the shown pentagon from them, so
    // walking the ladder must never touch them. This is the invariant behind
    // that: reading a rung is a pure function of the seed.
    for (const pts of [PENTA_UP, REAL_PENTA]) {
        const before = pentagon(wheelsAt(pts, 1).d, 0);
        for (const detour of [0.5, -0.5, 2, -2, 3.5]) void wheelsAt(pts, 1 + detour);
        const after = pentagon(wheelsAt(pts, 1).d, 0);
        assert.ok(sameWheel(before, after), "reading a rung changed the seed");
        assert.ok(sameWheel(before, pts.map((v) => [...v])), "rung 1 is not the five");
    }
});
