// Reading a rhomb patch back as P1 clusters.

import test from "node:test";
import assert from "node:assert/strict";

import { createGammaSet } from "../dist/geometry/gamma.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";
import { vertexIndex } from "../dist/geometry/roof.js";
import { findClusters, completeClusters, clusterCounts } from "../dist/geometry/clusters.js";

const patch = (sum, r = 20, opts = {}) => {
    const g = createGammaSet();
    g.setSum(sum, true);
    return collectRhombs(g.model, { xMin: -r, xMax: r, yMin: -r, yMax: r },
                         { maxNCap: 140, ...opts });
};

test("a Penrose patch partitions completely: every rhomb in exactly one cluster", () => {
    const rhombs = patch(1);
    const res = findClusters(rhombs);
    assert.ok(res.defined);
    assert.equal(res.levels, 4, "Penrose must use exactly four index levels");
    assert.equal(res.unassigned, 0, "a rhomb touched no extreme vertex");

    // the partition is exact — no rhomb counted twice, none missed
    const seen = new Set();
    for (const c of res.clusters)
        for (const i of c.rhombs) {
            assert.ok(!seen.has(i), `rhomb ${i} landed in two clusters`);
            seen.add(i);
        }
    assert.equal(seen.size, rhombs.length, "not every rhomb was placed");
});

test("clusters are one of the three rhomb groups, and nothing else", () => {
    const rhombs = patch(1, 26);
    const res = findClusters(rhombs);
    // Away from the patch edge every group must be whole. Incomplete ones exist
    // only because the collector cut them, so they sit near the rim.
    const inner = res.clusters.filter((c) => Math.hypot(c.x, c.y) < 14);
    assert.ok(inner.length > 150, `only ${inner.length} interior clusters`);
    for (const c of inner)
        assert.ok(c.kind, `interior cluster at ${c.x},${c.y} is ${c.thick}+${c.thin}, not a group`);

    for (const c of completeClusters(res)) {
        if (c.kind === "Pe5") assert.deepEqual([c.thick, c.thin], [5, 0]);
        if (c.kind === "Pe3") assert.deepEqual([c.thick, c.thin], [3, 1]);
        if (c.kind === "Pe1") assert.deepEqual([c.thick, c.thin], [1, 2]);
    }
    const n = clusterCounts(res);
    assert.ok(n.Pe5 > 0 && n.Pe3 > 0 && n.Pe1 > 0, JSON.stringify(n));
});

test("the center of a cluster really is an extreme-index vertex", () => {
    const rhombs = patch(1);
    const res = findClusters(rhombs);
    const all = rhombs.flatMap((r) => r.kTuples.map(vertexIndex));
    const lo = Math.min(...all), hi = Math.max(...all);
    for (const c of res.clusters)
        assert.ok(c.index === lo || c.index === hi,
                  `center index ${c.index} is neither ${lo} nor ${hi}`);
});

test("a Pe5 center is a sun: five fat rhombs, no thin", () => {
    // The naming trap — Pe5 IS the sun, and the *star rhomb group* is what sits
    // at its center. Five thick is the star group, so the cluster is a Pe5.
    const res = findClusters(patch(1, 22));
    const pe5 = completeClusters(res).filter((c) => c.kind === "Pe5");
    assert.ok(pe5.length > 20, `only ${pe5.length} Pe5`);
    for (const c of pe5) {
        assert.equal(c.thin, 0);
        assert.equal(c.rhombs.length, 5);
    }
});

test("every index level appears, and each cluster sits at the bottom or the top", () => {
    const res = findClusters(patch(1));
    const at = new Map();
    for (const c of res.clusters) at.set(c.index, (at.get(c.index) || 0) + 1);
    assert.equal(at.size, 2, "clusters should occupy exactly two index levels");
});

test("a generalised tiling has no clusters, and says why", () => {
    // Not a limitation of the code: P1 pentagons are a Penrose structure. Off the
    // integers the index takes five values, a rhomb can span the middle three and
    // touch no extreme, and the partition does not exist to be found.
    for (const sum of [0.5, 2.5, 1.23]) {
        const res = findClusters(patch(sum));
        assert.ok(!res.defined, `Σγ = ${sum} should not admit clusters`);
        assert.equal(res.levels, 5);
        assert.equal(res.clusters.length, 0);
        assert.match(res.reason, /not Penrose/);
    }
});

test("integer sums all work, whatever the level range happens to be", () => {
    // The extremes shift with Σγ — 1..4, then 2..5, then 3..6 — so the rule has
    // to read them off the patch rather than assume 1..4.
    for (const sum of [0, 1, 2, 3]) {
        const res = findClusters(patch(sum));
        assert.ok(res.defined, `Σγ = ${sum}`);
        assert.equal(res.unassigned, 0);
        const n = clusterCounts(res);
        assert.ok(n.Pe5 > 0 && n.Pe3 > 0 && n.Pe1 > 0, `Σγ = ${sum}: ${JSON.stringify(n)}`);
    }
});

test("a patch too small to show four levels is refused, not guessed", () => {
    const res = findClusters(patch(1, 1.2));
    if (!res.defined) assert.match(res.reason, /too small|not Penrose/);
    assert.deepEqual(findClusters([]).clusters, []);
    assert.equal(findClusters([]).defined, false);
});

test("the recognizer separates the Sun from the Star, which vertices alone cannot", () => {
    // All four origin-centered Penrose caps show FIVE FAT rhombs at the origin, so
    // the vertex configuration cannot tell them apart — an earlier reading called
    // them all suns on exactly that evidence, and was wrong. The index decides.
    //
    // The origin's K-tuple is (1,1,1,1,1) for a uniform offset in (0,1), so its
    // index is always 5, while the patch range is [Σγ+1, Σγ+4]. Five is therefore
    // an extreme — a Pe5 center — only at Σγ = 4 (the minimum) and Σγ = 1 (the
    // maximum). At Σγ = 2 and 3 the origin sits at a middle index and belongs to
    // no cluster at all: it is inside an St5 gap.
    const capAt = (sum) => {
        const g = createGammaSet({ guard: false });
        g.setSum(sum, true);
        const rhombs = collectRhombs(g.model,
            { xMin: -18, xMax: 18, yMin: -18, yMax: 18 }, { maxNCap: 120 });
        const res = findClusters(rhombs);
        assert.ok(res.defined, `Σγ = ${sum} should be Penrose`);
        return res.clusters.find((c) => Math.hypot(c.x, c.y) < 1e-9) ?? null;
    };

    for (const sum of [1, 4]) {
        const c = capAt(sum);
        assert.ok(c, `Σγ = ${sum}: expected a cluster at the origin (Sun)`);
        assert.equal(c.kind, "Pe5", `Σγ = ${sum} should center on a Pe5`);
    }
    for (const sum of [2, 3]) {
        assert.equal(capAt(sum), null,
            `Σγ = ${sum}: the origin must belong to no cluster (Star, an St5 gap)`);
    }
});

test("sunstar.html's five preset caps give the verdicts the page prints", () => {
    // The page offers c = 0, 1/5, 2/5, 3/5, 4/5 as buttons. If these ever stop
    // agreeing with the recognizer the page is lying, and nothing else catches it.
    const capAt = (c) => {
        const g = createGammaSet({ guard: false });
        g.setSum(5 * c, true);
        const rhombs = collectRhombs(g.model,
            { xMin: -12, xMax: 12, yMin: -12, yMax: 12 }, { maxNCap: 90 });
        const res = findClusters(rhombs);
        if (g.singular().length > 0) return "DECA";
        if (!res.defined) return "not Penrose";
        const at = res.clusters.find((k) => Math.hypot(k.x, k.y) < 1e-9);
        if (at && at.kind === "Pe5") return "SUN";
        if (!at) return "STAR";
        return `origin is ${at.kind}`;
    };
    assert.equal(capAt(0), "DECA", "c = 0 is the singular decagon");
    assert.equal(capAt(1 / 5), "SUN");
    assert.equal(capAt(2 / 5), "STAR");
    assert.equal(capAt(3 / 5), "STAR");
    assert.equal(capAt(4 / 5), "SUN");
});

// The P1 tiling read off the groups: a pentagon of circumradius 1 at every
// group center, turned 36° from the spokes. Measured against penrose-mosaic's
// own drawing (Sun on Sun, gen 3): every pentagon center is a rhomb vertex, the
// circumradius is the rhomb edge, every yellow center has four rhombs (Pe3) and
// every orange three (Pe1), and no pentagon corner is a rhomb vertex.
test("the P1 pentagons on the groups tile without overlap and share edges", () => {
    const PHI = (1 + Math.sqrt(5)) / 2;
    for (const gam of [[0.2, 0.2, 0.2, 0.2, 0.2], [0, 0.1, -0.1, -0.1, 0.1]]) {
        const g = createGammaSet({ guard: false });
        g.setLocked(-1);
        g.setValues(gam);
        const pg = g.model, dirs = pg.directions;
        const R = collectRhombs(pg, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 }, { gain: pg.n / 2 });
        let lo = Infinity;
        for (const r of R) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
        const res = findClusters(R);
        assert.ok(res.defined);

        const pents = [];
        for (const c of res.clusters) {
            if (!c.kind) continue;
            const sign = c.index === lo ? -1 : 1;
            pents.push({ x: c.x, y: c.y, verts: dirs.map(([x, y]) => [c.x + sign * x, c.y + sign * y]), rhombs: c.rhombs });
        }
        assert.ok(pents.length > 50);

        // Turned 36°: no pentagon vertex lies along a spoke of its own group.
        for (const p of pents) for (const ri of p.rhombs) {
            const r = R[ri];
            for (let i = 0; i < 4; i++) {
                if (Math.hypot(r.vertices[i][0] - p.x, r.vertices[i][1] - p.y) > 1e-6) continue;
                for (const w of [r.vertices[(i + 1) % 4], r.vertices[(i + 3) % 4]]) {
                    const sa = Math.atan2(w[1] - p.y, w[0] - p.x);
                    assert.ok(!p.verts.some((q) => Math.abs(Math.atan2(q[1] - p.y, q[0] - p.x) - sa) < 1e-6),
                              "a pentagon vertex lies on a spoke");
                }
            }
        }
        // A tiling: no two closer than phi (two inradii), and many exactly at it.
        let adjacent = 0;
        for (let i = 0; i < pents.length; i++) for (let j = i + 1; j < pents.length; j++) {
            const d = Math.hypot(pents[i].x - pents[j].x, pents[i].y - pents[j].y);
            assert.ok(d > PHI - 1e-6, `pentagons overlap at distance ${d}`);
            if (Math.abs(d - PHI) < 1e-6) adjacent++;
        }
        assert.ok(adjacent > 50, `only ${adjacent} edge-adjacent pentagons`);
    }
});
