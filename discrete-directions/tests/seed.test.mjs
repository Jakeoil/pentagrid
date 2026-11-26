// The seed: five points plus the origin their spokes are measured from.
//
// There is no oracle for this one. penrose-mosaic has no movable origin — its
// wheels are stored tables about a fixed center — so every claim here is
// checked against brute force or against the geometry it predicts, never
// against that project.

import test from "node:test";
import assert from "node:assert/strict";

import {
    HANDLE_ORIGIN, SEEDS, centered, centroidOf, checkSeed, integralCentroid,
    moveHandle,
    nearestOrigin, originFence, seedOf, spokeSum, spokesOf, walkSeed, wheelOf,
    wheelsOf,
} from "../src/math/seed.js";
import {
    ASYMMETRIC, EVEN_PENTAD, PENTA_UP, REAL_PENTA, deflate, inflate, m10,
    pWheel, sWheel,
    tWheel, wheelFromPoints, wheelsAt,
} from "../src/math/wheel.js";
import { THICK, THIN, pentagon, rhombus } from "../src/math/walk.js";

const PHI = (1 + Math.sqrt(5)) / 2;

// ── walkSeed: a rung is a move, not a view ────────────────────────────────
//
// The control that used to need `use` now moves the five, so the walk has to
// behave like an action a hand can undo: nothing at 0, back where it came from,
// and a count that means what it says. All three come from pinning the figure's
// centroid, and all three fail without it -- which is why they are tested on
// every preset and on a seed with no symmetry at all.
const WALK_SEEDS = {
    quadrille: PENTA_UP,
    asymmetric: ASYMMETRIC,
    even: EVEN_PENTAD,
    real: REAL_PENTA,
    skew: [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]],
};
const nearly = (a, b, eps = 1e-7) =>
    a.length === b.length
    && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < eps);

test("walking nowhere moves nothing, on every seed", () => {
    for (const [name, pts] of Object.entries(WALK_SEEDS)) {
        const seed = seedOf(pts, [1, -2]);
        assert.ok(nearly(walkSeed(seed, 0).points, seed.points), name);
        assert.deepEqual(walkSeed(seed, 0).origin, [1, -2], name);
    }
});

test("a walk is reversible, and the origin never moves", () => {
    for (const [name, pts] of Object.entries(WALK_SEEDS)) {
        const seed = seedOf(pts, [1, -2]);
        for (const by of [0.5, 1, 1.5, 2, -0.5, -1]) {
            const there = walkSeed(seed, by);
            assert.deepEqual(there.origin, [1, -2], `${name} ${by}`);
            assert.ok(nearly(walkSeed(there, -by).points, seed.points),
                `${name} ${by}: and back`);
        }
    }
});

test("a walk composes, so the control can just count", () => {
    // k steps of a half equal one step of k halves. Without the centroid pin
    // this is false everywhere from rung 1 up -- the figure slides a little on
    // each half step and the slides compound -- and that was the caveat the page
    // used to carry about halfUp twice not being one generation. It was the
    // placement, not the shape.
    for (const [name, pts] of Object.entries(WALK_SEEDS)) {
        const seed = seedOf(pts, [1, -2]);
        let inc = seed;
        for (let k = 1; k <= 8; k++) {
            inc = walkSeed(inc, 0.5);
            assert.ok(nearly(inc.points, walkSeed(seed, k * 0.5).points),
                `${name} at +${k * 0.5}`);
        }
    }
});

test("a walked lattice seed is still on the lattice", () => {
    // The pin is a difference of two ROUNDED centroids, so it is integral, so
    // the corners stay Gaussian integers and `snap: units` stays honest.
    for (const name of ["quadrille", "asymmetric", "even", "skew"]) {
        let seed = seedOf(WALK_SEEDS[name], [1, -2]);
        for (let k = 0; k < 8; k++) {
            seed = walkSeed(seed, 0.5);
            for (const p of seed.points)
                assert.ok(Number.isInteger(p[0]) && Number.isInteger(p[1]),
                    `${name} at +${(k + 1) * 0.5}: (${p})`);
        }
    }
});

test("the walk keeps the figure around its centroid, which is what the pin buys", () => {
    // Taken at face value, `pentagon(d, 0)` places the figure by its own first
    // spoke and the quadrille drifts (0,-1) per half step -- 13107 units after
    // eight up and eight back. Pinned, the centroid stays put to the rounding.
    const seed = seedOf(PENTA_UP, [0, 0]);
    let w = seed;
    for (let k = 0; k < 8; k++) w = walkSeed(w, 0.5);
    const mid = centroidOf(w.points);
    assert.ok(Math.hypot(mid[0], mid[1]) < 1.5,
        `the centroid stayed near the origin: (${mid})`);
    // and the figure really did grow -- phi^4 over four generations
    const reach = (s) => Math.max(...s.points.map((p) => Math.hypot(p[0], p[1])));
    assert.ok(reach(w) / reach(seed) > 5, `it grew: ${reach(w) / reach(seed)}`);
});
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
        // AT MOST five, not exactly five. `even` has FOUR: one of the five half
        // planes is slack, so its fence is a kite. GEOMETRY.md section 3 says
        // "at most five sides, always" and means it -- this assertion used to
        // say five and only three seeds had ever been asked.
        assert.ok(fence.length >= 3 && fence.length <= 5,
            `${name}: ${fence.length} sides`);
        const mid = [0, 1].map((k) =>
            fence.reduce((t, p) => t + p[k], 0) / fence.length);
        assert.ok(tightest(seed.points, mid) > 0.1,
            `${name}: the middle of the fence is well clear`);
        for (let i = 0; i < fence.length; i++) {
            const a = fence[i], b = fence[(i + 1) % fence.length];
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

test("the origin's freedom is one deflation -- on a ROUND seed", () => {
    // phi^-4 is exact on the regular pentagon, where the fence IS the pentagon
    // one generation down, and near it on seeds shaped like one. It is not a
    // law. `even` is lopsided at generation 0 -- one spoke of 2 among four of
    // sqrt 13 -- and its fence is a four-sided kite at 0.1029, a third short.
    for (const name of ["quadrille", "asymmetric", "real"]) {
        const seed = SEEDS[name];
        const ratio = area(originFence(seed.points)) / area(seed.points);
        assert.ok(Math.abs(ratio - PHI ** -4) < 0.002,
            `${name}: ${ratio.toFixed(4)} against ${(PHI ** -4).toFixed(4)}`);
    }
    const odd = area(originFence(SEEDS.even.points)) / area(SEEDS.even.points);
    assert.ok(Math.abs(odd - 0.102857) < 1e-5, `even: ${odd}`);
    assert.ok(PHI ** -4 - odd > 0.04, "and it is not a near miss");
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

test("integralCentroid is the centroid rounded, and is the centroid when even", () => {
    // The `closest` box on the page: an integral origin, so the spokes stay
    // Gaussian integers and every wheel above stays on the lattice -- at the
    // cost of not being the exact center any more.
    assert.deepEqual(integralCentroid(PENTA_UP), [0, 0], "from (0, 0.2)");
    assert.deepEqual(integralCentroid(ASYMMETRIC), [0, 0], "from (-0.4, -0.2)");

    // An EVEN pentad has nothing to round: its five sum to a multiple of five,
    // so the centroid is already a lattice point and the two agree exactly.
    // GEOMETRY.md §8.
    assert.deepEqual(centroidOf(EVEN_PENTAD), [0, 0]);
    assert.deepEqual(integralCentroid(EVEN_PENTAD), centroidOf(EVEN_PENTAD));

    // and it never moves further than half a unit, in either coordinate
    for (const pentad of [PENTA_UP, ASYMMETRIC, EVEN_PENTAD]) {
        const c = centroidOf(pentad), i = integralCentroid(pentad);
        assert.ok(Math.abs(c[0] - i[0]) <= 0.5 && Math.abs(c[1] - i[1]) <= 0.5,
            `(${c}) rounded to (${i})`);
    }
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

// ── the floater: one handle driven by the others ──────────────────────────
//
// `moveHandle` is the whole rule, and the rule is arithmetic, so it is checked
// here rather than through a canvas. The gesture that chooses the floater is in
// `tests/pentadiculum.test.mjs`.

test("the spoke sum is five times the offset from the origin to the centroid", () => {
    for (const [name, seed] of Object.entries(SEEDS)) {
        for (const o of [[0, 0], [1, -2], [0.4, 0.2]]) {
            const moved = { points: seed.points, origin: o };
            const s = spokeSum(moved);
            const c = centroidOf(seed.points);
            assert.ok(Math.hypot(s[0] - 5 * (c[0] - o[0]), s[1] - 5 * (c[1] - o[1])) < 1e-12,
                `${name} at origin ${o}: ${s} is not 5(centroid - origin)`);
        }
    }
    // and zero is the sweet spot, by definition rather than by coincidence
    const sweet = spokeSum(centered(SEEDS.quadrille));
    assert.ok(Math.hypot(sweet[0], sweet[1]) < 1e-12, `centered seed holds ${sweet}`);
});

test("the center floats: a corner drag carries the origin a fifth of the way", () => {
    const seed = seedOf(PENTA_UP);
    const target = spokeSum(seed);
    const delta = [2, -1];
    const to = [seed.points[0][0] + delta[0], seed.points[0][1] + delta[1]];
    const next = moveHandle(seed, 0, to, HANDLE_ORIGIN, target);

    // the origin follows by delta/5
    assert.ok(Math.hypot(next.origin[0] - delta[0] / 5, next.origin[1] - delta[1] / 5) < 1e-12,
        `origin went to ${next.origin}`);
    // the sum is held, which is the point
    const held = spokeSum(next);
    assert.ok(Math.hypot(held[0] - target[0], held[1] - target[1]) < 1e-12,
        `held ${held}, wanted ${target}`);
    // the dragged spoke moves 4/5 of delta and the other four -1/5 of it
    const was = spokesOf(seed), now = spokesOf(next);
    for (let k = 0; k < 5; k++) {
        const want = k === 0 ? [delta[0] * 4 / 5, delta[1] * 4 / 5]
            : [-delta[0] / 5, -delta[1] / 5];
        assert.ok(Math.hypot(now[k][0] - was[k][0] - want[0],
                             now[k][1] - was[k][1] - want[1]) < 1e-12,
            `spoke ${k} moved ${[now[k][0] - was[k][0], now[k][1] - was[k][1]]}`);
    }
});

test("and holding zero means no drag can leave the sweet spot", () => {
    // The payoff, and the thing GEOMETRY.md section 5 is about: at the centroid
    // P = S, inflate(D) = T, and all three rhomb spellings are one exact
    // parallelogram. Press `centroid` once and the floater keeps you there.
    let seed = centered(seedOf(PENTA_UP));
    const target = [0, 0];
    const moves = [[0, [1, 2]], [3, [-5, 1]], [1, [4, -2]], [4, [-2, -6]]];
    for (const [k, to] of moves) {
        seed = moveHandle(seed, k, to, HANDLE_ORIGIN, target);
        const c = centroidOf(seed.points);
        assert.ok(Math.hypot(seed.origin[0] - c[0], seed.origin[1] - c[1]) < 1e-12,
            `after moving ${k}: origin ${seed.origin} is not the centroid ${c}`);
        // and the two phi wheels coincide there, which is the same fact
        const { d, p, s, t } = wheelsOf(seed, 1);
        for (let i = 0; i < 10; i++) {
            assert.ok(Math.hypot(p[i][0] - s[i][0], p[i][1] - s[i][1]) < 1e-9,
                `P and S part at tenth ${i}`);
            const id = inflate(d);
            assert.ok(Math.hypot(id[i][0] - t[i][0], id[i][1] - t[i][1]) < 1e-9,
                `inflate(D) is not T at tenth ${i}`);
        }
    }
});

test("a point floats: the centroid is pinned and the center will not move", () => {
    const seed = seedOf(PENTA_UP, [1, -1]);
    const target = spokeSum(seed);
    const was = centroidOf(seed.points);
    const delta = [3, 2];
    const to = [seed.points[0][0] + delta[0], seed.points[0][1] + delta[1]];
    const next = moveHandle(seed, 0, to, 2, target);

    assert.deepEqual(next.origin, [1, -1], "the center is fixed");
    // point 2 answers with -delta, so the centroid does not move
    assert.ok(Math.hypot(next.points[2][0] - seed.points[2][0] + delta[0],
                         next.points[2][1] - seed.points[2][1] + delta[1]) < 1e-12,
        `point 2 went to ${next.points[2]}`);
    const now = centroidOf(next.points);
    assert.ok(Math.hypot(now[0] - was[0], now[1] - was[1]) < 1e-12,
        `centroid moved from ${was} to ${now}`);
    // and pulling on the center itself is refused rather than absorbed
    assert.equal(moveHandle(seed, HANDLE_ORIGIN, [0, 0], 2, target), seed);
});

test("dragging the floater is a plain move, because that is the retarget", () => {
    const seed = seedOf(PENTA_UP);
    const target = spokeSum(seed);
    // the origin floats and the origin is dragged: it goes where it is put
    const o = moveHandle(seed, HANDLE_ORIGIN, [0.4, -1], HANDLE_ORIGIN, target);
    assert.deepEqual(o.origin, [0.4, -1]);
    assert.deepEqual(o.points, seed.points.map((p) => [p[0], p[1]]));
    // which is a NEW target, and the caller is the one that re-reads it
    const after = spokeSum(o);
    assert.ok(Math.hypot(after[0] - target[0], after[1] - target[1]) > 1,
        "the held value has genuinely changed");
    // point 3 floats and point 3 is dragged: likewise
    const q = moveHandle(seed, 3, [-1, 1], 3, target);
    assert.deepEqual(q.points[3], [-1, 1]);
    assert.deepEqual(q.origin, [0, 0]);
});

test("with no floater it is exactly the move it always was", () => {
    const seed = seedOf(PENTA_UP, [1, 2]);
    const plain = moveHandle(seed, 1, [7, -7], -1, [99, 99]);
    assert.deepEqual(plain.origin, [1, 2], "the target is ignored");
    assert.deepEqual(plain.points[1], [7, -7]);
    assert.deepEqual(plain.points[0], seed.points[0]);
    const o = moveHandle(seed, HANDLE_ORIGIN, [3, 3], -1, [99, 99]);
    assert.deepEqual(o.origin, [3, 3]);
    assert.deepEqual(o.points, seed.points.map((p) => [p[0], p[1]]));
});

test("a driven handle is clean of the division's dust", () => {
    // It is not snapped -- it is determined -- but the one division by five
    // leaves a coordinate that ought to read 0.2 a few ulps away from it, and a
    // readout showing 0.20000000000000004 is a readout nobody can use.
    const seed = seedOf(PENTA_UP);
    const next = moveHandle(seed, 0, [1, 3], HANDLE_ORIGIN, [0, 0]);
    for (const v of [...next.origin, ...next.points.flat()])
        assert.equal(v, Math.round(v * 5) / 5, `${v} is not a clean fifth`);
});
