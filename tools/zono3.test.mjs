// π(C^k): the golden zonohedra as one construction. PLAN §8.2.
//
// Cross-checked against wieringa-roof, which dissects the triacontahedron from
// the other side: its `tools/dissect.mjs` asserts twenty cells one per triple,
// ten and ten, a volume ratio of φ, and volumes summing to 4√(5+2√5). All four
// are asserted below off this module's own generators, so if the two ever
// disagree one of them is wrong — which is the point of writing it twice.
import test from "node:test";
import assert from "node:assert/strict";
import {
    ICO_AXES, ICO_COS, PHI, zonohedron, maskPoint, cellVolume, cellKind,
    cellTriples, faceDiagonals,
} from "../dist/geometry/zono3.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("the six axes are the icosahedral ones: fifteen pairs, one angle", () => {
    assert.equal(ICO_AXES.length, 6);
    for (const v of ICO_AXES) assert.ok(near(dot(v, v), 1), "unit");
    const angles = new Set();
    let pairs = 0;
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        angles.add(Math.abs(dot(ICO_AXES[i], ICO_AXES[j])).toFixed(9));
        pairs++;
    }
    assert.equal(pairs, 15);
    assert.equal(angles.size, 1, `fifteen pairs should share one angle: ${[...angles]}`);
    assert.ok(near(Number([...angles][0]), ICO_COS), "and it is 1/root5");
    // Which is what §5.0 found from the other end: the pentagrid's five lifted
    // generators plus the vertical, all at the icosahedral angle.
    assert.ok(near(ICO_COS, 1 / Math.sqrt(5)));
});

test("the ladder: vertices, faces and Euler at every rung", () => {
    // A great-circle arrangement in general position has k² − k + 2 regions,
    // and a zonotope has one vertex per region — so the counts are forced,
    // not measured. 8, 14, 22, 32 are the rhombohedron, Bilinski, Fedorov and
    // Kepler.
    const want = [
        { k: 0, v: 1, f: 0 },
        { k: 1, v: 2, f: 0 },
        { k: 2, v: 4, f: 2 },      // the golden rhomb, a face from each side
        { k: 3, v: 8, f: 6 },      // a rhombohedron
        { k: 4, v: 14, f: 12 },    // Bilinski's dodecahedron
        { k: 5, v: 22, f: 20 },    // Fedorov's rhombic icosahedron
        { k: 6, v: 32, f: 30 },    // Kepler's triacontahedron
    ];
    for (const { k, v, f } of want) {
        const z = zonohedron(ICO_AXES.slice(0, k));
        assert.equal(z.vertexMasks.length, v, `k=${k}: vertices`);
        assert.equal(z.faces.length, f, `k=${k}: faces`);
        if (k >= 2) {
            assert.equal(z.vertexMasks.length, k * k - k + 2, `k=${k}: the region count`);
            assert.equal(z.faces.length, k * (k - 1), `k=${k}: k(k-1) faces`);
            assert.equal(z.vertexMasks.length - z.edges.length + z.faces.length, 2,
                         `k=${k}: Euler`);
        }
        // Centrally symmetric: a zonotope's vertex set is closed under
        // complement, every T against its S\T. Socolar's Table I is too.
        const all = (1 << k) - 1;
        const set = new Set(z.vertexMasks);
        for (const m of z.vertexMasks) {
            assert.ok(set.has(all & ~m), `k=${k}: ${m} has no opposite`);
        }
    }
});

test("every face of every rung is the same golden rhomb", () => {
    // Which is what isozonohedron means, and what gives the tiling one edge
    // length and one face shape all the way up.
    for (let k = 2; k <= 6; k++) {
        const gens = ICO_AXES.slice(0, k);
        const z = zonohedron(gens);
        for (const f of z.faces) {
            const [long, short] = faceDiagonals(gens, f);
            assert.ok(near(long / short, PHI), `k=${k}: a face at ${long / short}`);
            // Four equal sides, each the length of a generator, which is 1.
            const p = f.masks.map((m) => maskPoint(gens, m));
            for (let e = 0; e < 4; e++) {
                const a = p[e], b = p[(e + 1) % 4];
                const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
                assert.ok(near(len, 1), `k=${k}: an edge of ${len}`);
            }
        }
    }
});

test("exactly two rhombohedra, ten and ten, volumes in the ratio phi", () => {
    // Not a measurement but a group action: the icosahedral group is
    // transitive on the six axes and on their pairs, and NOT on their triples
    // — a triple is a chain or an equilateral triangle, and those are the two
    // orbits. Twenty triples, ten each.
    const triples = cellTriples();
    assert.equal(triples.length, 20, "C(6,3)");
    const acute = triples.filter((t) => t.kind === "acute");
    const oblate = triples.filter((t) => t.kind === "oblate");
    assert.equal(acute.length, 10);
    assert.equal(oblate.length, 10);

    const volOf = (t) => cellVolume(...t.ijk.map((i) => ICO_AXES[i]));
    const vols = new Set(triples.map((t) => volOf(t).toFixed(9)));
    assert.equal(vols.size, 2, `two volumes, got ${[...vols]}`);
    // From the volumes themselves, not from the rounded labels: ten of each
    // summed at nine decimals is off by more than the tolerance below.
    const all = triples.map(volOf);
    const lo = Math.min(...all), hi = Math.max(...all);
    assert.ok(near(hi / lo, PHI), `the ratio is ${hi / lo}`);
    // The oblate is the smaller, which §5.0 established in the plane against
    // Jake's guess that it was the other way round.
    for (const t of oblate) assert.ok(near(volOf(t), lo));
    for (const t of acute) assert.ok(near(volOf(t), hi));

    // And the twenty cells are the triacontahedron's dissection: their volumes
    // sum to its own. K30 of unit edge has volume 8/√5 × ... — rather than
    // quote a closed form, check against the solid the generators make.
    const total = triples.reduce((a, t) => a + volOf(t), 0);
    assert.ok(near(total, 10 * lo + 10 * hi), "ten and ten");
    assert.ok(near(total, 4 * Math.sqrt(5 + 2 * Math.sqrt(5))),
              `the triacontahedron's volume: ${total}`);
});

test("the two rhombohedra are the two shapes, and nothing else is", () => {
    // Build each as its own zonohedron and check they are the A6 and O6 of
    // Coxeter's five: six faces, eight vertices, and the acute one the fatter.
    const chain = zonohedron([ICO_AXES[0], ICO_AXES[1], ICO_AXES[2]]);
    const equi = zonohedron([ICO_AXES[0], ICO_AXES[1], ICO_AXES[3]]);
    for (const z of [chain, equi]) {
        assert.equal(z.faces.length, 6);
        assert.equal(z.vertexMasks.length, 8);
        assert.equal(z.edges.length, 12);
    }
    const a = cellVolume(ICO_AXES[0], ICO_AXES[1], ICO_AXES[2]);
    const b = cellVolume(ICO_AXES[0], ICO_AXES[1], ICO_AXES[3]);
    assert.ok(!near(a, b), "the two triples are not the same solid");
    assert.ok(near(Math.max(a, b) / Math.min(a, b), PHI));
});
