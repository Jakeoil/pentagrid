// The seed: five points plus the origin their spokes are measured from.
//
// There is no oracle for this one. penrose-mosaic has no movable origin — its
// wheels are stored tables about a fixed center — so every claim here is
// checked against brute force or against the geometry it predicts, never
// against that project.

import test from "node:test";
import assert from "node:assert/strict";

import {
    SEEDS, centered, centroidOf, checkSeed, nearestOrigin, originFence, seedOf,
    spokesOf, wheelOf, wheelsOf,
} from "../src/math/seed.js";
import {
    ASYMMETRIC, PENTA_UP, REAL_PENTA, deflate, inflate, m10, pWheel, sWheel,
    tWheel, wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";
import { THICK, THIN, pentagon, rhombus } from "../src/math/walk.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const area = (poly) => Math.abs(poly.reduce((a, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return a + p[0] * q[1] - q[0] * p[1];
}, 0) / 2);

/** Brute force: are the ten spokes of this origin in angular order? */
function orderedByHand(points, origin) {
    const s = points.map(([x, y]) => [x - origin[0], y - origin[1]]);
    if (s.some(([x, y]) => x === 0 && y === 0)) return false;
    const w = wheelFromPoints(s);
    let turn = 0;
    for (let t = 0; t < 10; t++) {
        const a = w[t], b = w[m10(t + 1)];
        const c = cross(a, b);
        if (c <= 0) return false;
        turn += Math.atan2(c, a[0] * b[0] + a[1] * b[1]);
    }
    return Math.abs(turn - 2 * Math.PI) < 1e-9;
}

const inPoly = (poly, p) => poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return cross([b[0] - a[0], b[1] - a[1]], [p[0] - a[0], p[1] - a[1]]) > 0;
});

/** How far `p` is from the nearest edge of `poly`, unsigned. */
const toEdge = (poly, p) => Math.min(...poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    return Math.abs(cross([dx / len, dy / len], [p[0] - a[0], p[1] - a[1]]));
}));

// ── the subtraction, which is the whole module ────────────────────────────

test("a seed is five positions and the point they radiate from", () => {
    const s = seedOf(PENTA_UP);
    assert.deepEqual(s.origin, [0, 0]);
    assert.deepEqual(spokesOf(s), PENTA_UP);
    assert.deepEqual(wheelOf(s), wheelFromPoints(PENTA_UP));
    assert.deepEqual(wheelsOf(s, 3), wheelsAt(PENTA_UP, 3));
    assert.throws(() => seedOf([[0, 0], [1, 1], [2, 2], [3, 3]]), /five points/);
});

test("moving the origin moves no point, and changes every spoke", () => {
    const home = seedOf(PENTA_UP);
    const moved = seedOf(PENTA_UP, [0, 1]);
    assert.deepEqual(moved.points, home.points, "the pentagon has not moved");
    assert.deepEqual(spokesOf(moved), PENTA_UP.map(([x, y]) => [x, y - 1]));
    // and therefore a different tiling, not a translated one: the D wheel's
    // spoke lengths are not a rigid motion of the first.
    const len = (seed) => wheelOf(seed).map(([x, y]) => +Math.hypot(x, y).toFixed(6));
    assert.notDeepEqual(len(moved), len(home));
});

test("the three presets sit at the origin, so nothing about them changed", () => {
    for (const [name, seed] of Object.entries(SEEDS)) {
        assert.deepEqual(seed.origin, [0, 0], name);
        assert.ok(checkSeed(seed).ok, name);
    }
    assert.deepEqual(SEEDS.quadrille.points, PENTA_UP);
    assert.deepEqual(SEEDS.asymmetric.points, ASYMMETRIC);
    assert.deepEqual(SEEDS.real.points, REAL_PENTA);
});

// ── the fence ─────────────────────────────────────────────────────────────

test("the fence is exactly the origins that work, not an estimate of them", () => {
    // The claim that earns the half-plane derivation: computed and brute-forced
    // agree everywhere except ON the boundary, where they are allowed to, since
    // the fence is closed and `check` rejects its edges. The seeds are integer
    // points and the grid step is rational, so landing exactly on an edge is
    // not a freak event here -- it happened five times before this allowed it.
    for (const [name, seed] of Object.entries(SEEDS)) {
        const fence = originFence(seed.points);
        const r = Math.max(...seed.points.map((p) => Math.hypot(p[0], p[1])));
        let inside = 0, offEdge = 0;
        const N = 120;
        for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
            const o = [-r + 2 * r * i / N, -r + 2 * r * j / N];
            const want = orderedByHand(seed.points, o);
            if (want) inside++;
            if (want !== inPoly(fence, o) && toEdge(fence, o) > 1e-9) offEdge++;
        }
        assert.ok(inside > 100, `${name}: the sampling should find the region`);
        assert.equal(offEdge, 0, `${name}: disagreements away from the boundary`);
    }
});

test("every edge of the fence is where two spokes line up", () => {
    // Which is why the boundary is excluded rather than rounded off: a wheel
    // with two spokes in one direction has nine, not ten.
    //
    // Checked as a limit rather than by exact arithmetic. A midpoint computed
    // from two clipped vertices does not land exactly on its own edge, so
    // `check` at that point can come out either way; what cannot wobble is that
    // one of the five turns has gone to zero there, while at the middle of the
    // fence all five are comfortably open.
    const tightest = (points, o) => {
        const w = wheelFromPoints(points.map(([x, y]) => [x - o[0], y - o[1]]));
        return Math.min(...[0, 1, 2, 3, 4].map((t) => {
            const a = w[t], b = w[m10(t + 1)];
            return Math.abs(cross(a, b)) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]));
        }));
    };
    for (const [name, seed] of Object.entries(SEEDS)) {
        const fence = originFence(seed.points);
        assert.equal(fence.length, 5, `${name}: five sides, always`);
        const mid = [0, 1].map((k) =>
            fence.reduce((t, p) => t + p[k], 0) / fence.length);
        assert.ok(tightest(seed.points, mid) > 0.1,
            `${name}: the middle of the fence is well clear`);
        for (let i = 0; i < 5; i++) {
            const a = fence[i], b = fence[(i + 1) % 5];
            const on = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            assert.ok(tightest(seed.points, on) < 1e-12,
                `${name}: edge ${i} should have two spokes in line`);
            // and just outside it, the seed is gone
            const out = [on[0] + (on[0] - mid[0]) * 0.02,
                         on[1] + (on[1] - mid[1]) * 0.02];
            assert.equal(checkSeed({ points: seed.points, origin: out }).ok, false,
                `${name}: edge ${i} should be the boundary`);
        }
    }
});

test("the origin's freedom is one deflation: phi^-4 of the pentagon", () => {
    for (const [name, seed] of Object.entries(SEEDS)) {
        const ratio = area(originFence(seed.points)) / area(seed.points);
        assert.ok(Math.abs(ratio - PHI ** -4) < 0.002,
            `${name}: ${ratio.toFixed(4)} against ${(PHI ** -4).toFixed(4)}`);
    }
});

test("on a REGULAR pentagon the fence is the pentagon one generation down", () => {
    // Exactly, vertex for vertex: `pentagon(deflate(w), 1)` -- deflated by phi^2
    // and inverted. That is what makes the phi^-4 above a statement rather than
    // a coincidence, since deflation scales area by exactly that.
    const fence = originFence(REAL_PENTA);
    const down = pentagon(deflate(wheelFromPoints(REAL_PENTA)), 1);
    assert.equal(fence.length, 5);
    for (const q of down)
        assert.ok(fence.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9),
            `(${q}) should be a corner of the fence`);
});

test("and in the discrete geometry it is NOT, which is the usual story", () => {
    // Same area to within a percent, different pentagon. The quadrille is not
    // an approximation of the real thing; it answers for itself. Pinned because
    // the easy mistake is to draw the deflated pentagon as the fence and call
    // it done -- it would be wrong by about a tenth of its own area, in both
    // directions, right where somebody is dragging.
    const fence = originFence(PENTA_UP);
    const down = pentagon(deflate(wheelFromPoints(PENTA_UP)), 1);
    assert.equal(fence.length, 5);
    assert.ok(Math.abs(area(fence) - 3.7614) < 1e-3);
    assert.equal(area(down), 4);
    const shared = down.filter((q) =>
        fence.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9));
    assert.equal(shared.length, 0, "not one corner in common");
    // Neither contains the other.
    assert.ok(down.some((q) => !inPoly(fence, q)), "the deflated pentagon pokes out");
    assert.ok(fence.some((p) => !inPoly(down, p)), "and the fence pokes out of it");
});

test("the fence holds very few LATTICE points, which is what snap sees", () => {
    // Why this matters to the page: with snap on, the origin of a seed this
    // size has almost nowhere to go. It opens up as the pentagon grows -- the
    // fence scales with it -- so stepping the ladder is what gives it room.
    // Counted with `check`, which is the gate, not with the fence, which is the
    // drawing: a lattice point can sit exactly ON an edge, and (1,0) does here.
    const integers = (points) => {
        let n = 0;
        for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++)
            if (checkSeed({ points, origin: [x, y] }).ok) n++;
        return n;
    };
    assert.equal(checkSeed({ points: PENTA_UP, origin: [1, 0] }).ok, false);
    assert.ok(toEdge(originFence(PENTA_UP), [1, 0]) < 1e-9, "exactly on an edge");
    assert.equal(integers(PENTA_UP), 2);
    assert.equal(integers(ASYMMETRIC), 6);
    // and the same pentagon one rung up has room to spare
    assert.ok(integers(pentagon(wheelsAt(PENTA_UP, 3).d, 0)) > 40);
});

// ── the verdict, and what it says ─────────────────────────────────────────

test("check names what is wrong, by point rather than by tenth", () => {
    const at = (o) => checkSeed({ points: PENTA_UP, origin: o });

    assert.equal(at([0, 0]).ok, true);
    assert.equal(at([0, 0]).why, "");

    // the origin landed on a corner
    const onPoint = at([0, -3]);
    assert.equal(onPoint.ok, false);
    assert.match(onPoint.why, /origin is on point 0/);

    // two spokes in one line: fatal however the points are labeled
    const inLine = at([1, 0]);
    assert.equal(inLine.ok, false);
    assert.match(inLine.why, /in line with the origin/);

    // and simply out of order, which is what most of the plane gives
    const far = at([9, 9]);
    assert.equal(far.ok, false);
    assert.match(far.why, /out of order around the origin/);
});

test("nearestOrigin leaves a legal origin alone and pulls an illegal one in", () => {
    assert.deepEqual(nearestOrigin(PENTA_UP, [0, 0]), [0, 0]);
    const pulled = nearestOrigin(PENTA_UP, [9, 9]);
    assert.ok(pulled);
    // on the fence, so legal to within the rounding of sitting exactly on it
    const fence = originFence(PENTA_UP);
    const onEdge = fence.some((a, i) => {
        const b = fence[(i + 1) % fence.length];
        return Math.abs(cross([b[0] - a[0], b[1] - a[1]],
            [pulled[0] - a[0], pulled[1] - a[1]])) < 1e-9;
    });
    assert.ok(onEdge, "the nearest legal origin is on the fence");
    // and it really is the nearest: no fence corner is closer
    const d = Math.hypot(pulled[0] - 9, pulled[1] - 9);
    for (const p of fence)
        assert.ok(Math.hypot(p[0] - 9, p[1] - 9) >= d - 1e-9);
});

// ── the sweet spot ─────────────────────────────────────────────

test("the two phi-wheels differ by the sum of the five, alternating", () => {
    // P[t] - S[t] = -(-1)^t * sum. The whole of the sweet spot is this identity:
    // the gap between the quadrille's two phi-wheels IS the sum of the points.
    for (const [name, pts] of Object.entries(
            { classic: PENTA_UP, asymmetric: ASYMMETRIC, real: REAL_PENTA })) {
        const sum = [pts.reduce((a, p) => a + p[0], 0),
                     pts.reduce((a, p) => a + p[1], 0)];
        const d = wheelFromPoints(spokesOf(seedOf(pts)));
        const p = pWheel(d), s = sWheel(d);
        for (let t = 0; t < 10; t++) {
            const sign = t % 2 === 0 ? 1 : -1;
            assert.ok(Math.abs(p[t][0] - s[t][0] + sign * sum[0]) < 1e-9, `${name} x t=${t}`);
            assert.ok(Math.abs(p[t][1] - s[t][1] + sign * sum[1]) < 1e-9, `${name} y t=${t}`);
        }
    }
});

test("the centroid is the sweet spot, and it is always in fifths", () => {
    for (const [name, pts] of Object.entries(
            { classic: PENTA_UP, asymmetric: ASYMMETRIC })) {
        const c = centroidOf(pts);
        // integer points, so the centroid has denominator exactly five
        assert.ok(Number.isInteger(c[0] * 5) && Number.isInteger(c[1] * 5), name);
        assert.ok(checkSeed({ points: pts, origin: c }).ok, `${name}: a legal origin`);

        const d = wheelFromPoints(spokesOf(centered(seedOf(pts))));
        // P = S there, which is the same as inflate(D) = T
        const p = pWheel(d), s = sWheel(d), i = inflate(d), tw = tWheel(d);
        for (let t = 0; t < 10; t++) {
            assert.ok(Math.hypot(p[t][0] - s[t][0], p[t][1] - s[t][1]) < 1e-9,
                `${name}: P = S at tenth ${t}`);
            assert.ok(Math.hypot(i[t][0] - tw[t][0], i[t][1] - tw[t][1]) < 1e-9,
                `${name}: inflate(D) = T at tenth ${t}`);
        }
    }
    assert.deepEqual(centroidOf(PENTA_UP), [0, 0.2]);
    assert.deepEqual(centroidOf(ASYMMETRIC), [-0.4, -0.2]);
    // the regular pentagon is already centered, which is why it never skewed
    const r = centroidOf(REAL_PENTA);
    assert.ok(Math.hypot(r[0], r[1]) < 1e-12);
});

test("at the centroid all three spellings are one exact parallelogram", () => {
    // Compared with a tolerance, not as strings: the three spellings reach the
    // same corner by different sums, so they land on it to within rounding
    // rather than bit for bit, and a formatted -1e-16 reads as "-0.000000000".
    const same = (a, b) => a.every((p, i) =>
        Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 1e-9);
    const skew = (q) => {
        const e = q.map((p, i) => [q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]]);
        const big = Math.max(...e.map((v) => Math.hypot(v[0], v[1])));
        return Math.hypot(e[0][0] + e[2][0], e[0][1] + e[2][1]) / big;
    };
    for (const [name, pts] of Object.entries(
            { classic: PENTA_UP, asymmetric: ASYMMETRIC })) {
        for (const big of [false, true]) {
            const A = wheelsAt(spokesOf(centered(seedOf(pts))), big ? 1 : 0);
            const inf = inflate(A.d);
            for (const spec of [THICK, THIN]) for (let n = 0; n < 10; n++) {
                const q = rhombus(spec, A.t, inf, n, "classic");
                assert.ok(same(q, rhombus(spec, A.t, inf, n, "t")), `${name} vs t`);
                assert.ok(same(q, rhombus(spec, A.t, inf, n, "inflated")),
                    `${name} vs inflated`);
                assert.ok(skew(q) < 1e-12, `${name}: an exact parallelogram`);
            }
        }
        // and at the origin it is a kite, which is what penrose-mosaic stores.
        // Taken over both generations and all ten tenths, since individual ones
        // come much closer to closing than the worst does.
        const worst = Math.max(...[0, 1].flatMap((g) => {
            const B = wheelsAt(spokesOf(seedOf(pts)), g);
            return [THICK, THIN].flatMap((spec) => [...Array(10).keys()].map(
                (n) => skew(rhombus(spec, B.t, inflate(B.d), n, "classic"))));
        }));
        assert.ok(worst > 0.1, `${name}: a kite at the origin, worst ${worst}`);
    }
});
