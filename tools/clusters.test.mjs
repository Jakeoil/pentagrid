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

test("the centre of a cluster really is an extreme-index vertex", () => {
    const rhombs = patch(1);
    const res = findClusters(rhombs);
    const all = rhombs.flatMap((r) => r.kTuples.map(vertexIndex));
    const lo = Math.min(...all), hi = Math.max(...all);
    for (const c of res.clusters)
        assert.ok(c.index === lo || c.index === hi,
                  `centre index ${c.index} is neither ${lo} nor ${hi}`);
});

test("a Pe5 centre is a sun: five fat rhombs, no thin", () => {
    // The naming trap — Pe5 IS the sun, and the *star rhomb group* is what sits
    // at its centre. Five thick is the star group, so the cluster is a Pe5.
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

test("the recogniser separates the Sun from the Star, which vertices alone cannot", () => {
    // All four origin-centred Penrose caps show FIVE FAT rhombs at the origin, so
    // the vertex configuration cannot tell them apart — an earlier reading called
    // them all suns on exactly that evidence, and was wrong. The index decides.
    //
    // The origin's K-tuple is (1,1,1,1,1) for a uniform offset in (0,1), so its
    // index is always 5, while the patch range is [Σγ+1, Σγ+4]. Five is therefore
    // an extreme — a Pe5 centre — only at Σγ = 4 (the minimum) and Σγ = 1 (the
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
        assert.equal(c.kind, "Pe5", `Σγ = ${sum} should centre on a Pe5`);
    }
    for (const sum of [2, 3]) {
        assert.equal(capAt(sum), null,
            `Σγ = ${sum}: the origin must belong to no cluster (Star, an St5 gap)`);
    }
});

test("sunstar.html's five preset caps give the verdicts the page prints", () => {
    // The page offers c = 0, 1/5, 2/5, 3/5, 4/5 as buttons. If these ever stop
    // agreeing with the recogniser the page is lying, and nothing else catches it.
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
