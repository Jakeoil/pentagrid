// The border between two 2k-gons: Socolar's adjacency rule, as a test.
// tools/border.mjs prints it; PLAN §5.-1a has the finding.
import test from "node:test";
import assert from "node:assert/strict";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";
import { zonohedronOf, zonogonAnchor } from "../dist/geometry/zonohedron.js";
import { cascade } from "../dist/geometry/cascade.js";

const set = createGammaSet({ guard: false });
set.setLocked(-1);
set.setValues([0, 0, 0, 0, 0]);
const model = set.model, dirs = model.directions;
const RH = collectRhombs(model, { xMin: -7, xMax: 7, yMin: -7, yMax: 7 }, { gain: 2.5 });
const key = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;

const byX = new Map();
for (const r of RH) {
    const k = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
    if (!byX.has(k)) byX.set(k, []);
    byX.get(k).push(r);
}
const stacks = [...byX.values()].filter((v) => v.length > 1).map((v) => ({
    rhombs: v,
    fams: [...new Set(v.flatMap((r) => [r.j, r.k]))].sort((a, b) => a - b),
}));
const deca = stacks.find((s) => s.fams.length === 5);
const hexes = stacks.filter((s) => s.fams.length === 3);

/** One stack's faces, placed in the plane, for a given reading. */
function placed(stack, reading, outline, outlineK) {
    const z = zonohedronOf(dirs, stack.fams);
    const anchor = zonogonAnchor(z, outline ?? stack.rhombs.flatMap((r) => r.vertices),
                                 outlineK ?? stack.rhombs.flatMap((r) => r.kTuples), dirs);
    const bases = z.readings.length
        ? z.readings[outline ? reading
            : (z.penrose.length ? z.penrose : z.readings.map((_, i) => i))[
                ((reading % (z.penrose.length || z.readings.length))
                 + (z.penrose.length || z.readings.length))
                % (z.penrose.length || z.readings.length)]]
        : z.lower;
    const pt = (mask) => {
        let x = anchor.origin[0], y = anchor.origin[1];
        for (let l = 0; l < z.k; l++) {
            if (mask >> l & 1) { x += dirs[z.fams[l]][0]; y += dirs[z.fams[l]][1]; }
        }
        return [x, y];
    };
    return z.pairs.map((pr, i) => ({
        j: z.fams[pr[0]], k: z.fams[pr[1]], pts: z.face(bases, i).map(pt),
    }));
}
/** Shared edges carrying the same (j, k) — Socolar says there must be none. */
function clash(A, B) {
    let n = 0;
    for (const a of A) for (const b of B) {
        if (a.j !== b.j || a.k !== b.k) continue;
        for (let i = 0; i < 4; i++) for (let m = 0; m < 4; m++) {
            const e1 = [key(a.pts[i]), key(a.pts[(i + 1) % 4])].sort().join("|");
            const e2 = [key(b.pts[m]), key(b.pts[(m + 1) % 4])].sort().join("|");
            if (e1 === e2) n++;
        }
    }
    return n;
}

test("the unresolved patch obeys Socolar's adjacency rule", () => {
    // No edge shared by two rhombs of the same shape AND orientation. So the
    // tiling is not where the trouble is.
    const edges = new Map();
    for (const r of RH) for (let i = 0; i < 4; i++) {
        const k = [key(r.vertices[i]), key(r.vertices[(i + 1) % 4])].sort().join("|");
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(r);
    }
    let bad = 0, shared = 0;
    for (const list of edges.values()) {
        if (list.length < 2) continue;
        shared++;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            if (list[i].j === list[j].j && list[i].k === list[j].k) bad++;
        }
    }
    assert.ok(shared > 500, `only ${shared} shared edges`);
    assert.equal(bad, 0, `${bad} same-orientation adjacencies in the raw patch`);
});

test("the cascade: the decagon drives and every border comes out legal", () => {
    // Jake: "My understanding is that the decagon combinations drive the
    // reading. As you go through the combinations, ensure that connected
    // pentagons agree." Which is what geometry/cascade.ts does — biggest site
    // first takes the control's value, the rest are visited outward and each
    // takes the first reading in its own pool that clashes with nothing
    // already placed.
    //
    // Before it, the control wrapped one number against each solid's own
    // count and left exactly TWO illegal borders at every one of the ten
    // positions, zero clean. This asserts the fix at all ten.
    const sites = [deca, ...hexes].map((s) => ({
        families: s.fams,
        outline: s.rhombs.flatMap((r) => r.vertices),
        outlineK: s.rhombs.flatMap((r) => r.kTuples),
    }));
    for (let N = 0; N < 10; N++) {
        const plan = cascade(model, sites, N, true);
        assert.equal(plan.clashes, 0, `N=${N}: ${plan.clashes} borders still illegal`);
        // And measured independently of the planner, by placing what it chose.
        const drawn = sites.map((s, i) =>
            placed({ fams: s.families, rhombs: [] }, plan.pools[i][plan.readings[i]],
                   s.outline, s.outlineK));
        let bad = 0;
        for (let i = 0; i < drawn.length; i++) {
            for (let j = i + 1; j < drawn.length; j++) bad += clash(drawn[i], drawn[j]);
        }
        assert.equal(bad, 0, `N=${N}: ${bad} same-orientation adjacencies on the page`);
    }
});

test("the decagon really is the one that drives", () => {
    // The control's value lands on the decagon; everything else follows. So
    // moving the slider moves the decagon through all ten of its readings.
    const sites = [deca, ...hexes].map((s) => ({
        families: s.fams,
        outline: s.rhombs.flatMap((r) => r.vertices),
        outlineK: s.rhombs.flatMap((r) => r.kTuples),
    }));
    const seen = new Set();
    for (let N = 0; N < 10; N++) {
        const plan = cascade(model, sites, N, true);
        assert.equal(plan.readings[0], N, `N=${N}: the decagon took ${plan.readings[0]}`);
        seen.add(plan.pools[0][plan.readings[0]]);
        // Few hexagons have to deviate: the wrap is right most of the time,
        // and the cascade only overrules it where the border demands.
        assert.ok(plan.followed < 6,
                  `N=${N}: ${plan.followed} hexagons overruled, expected a handful`);
    }
    assert.equal(seen.size, 10, "all ten of the decagon's readings are reachable");
});

test("and it is not forced: a clean choice always exists", () => {
    // Which is what makes it a bug rather than a fact about decagons. For
    // every reading of the decagon, every neighboring hexagon has one of its
    // two readings that avoids the clash. Choosing can always succeed; the
    // app wraps instead of choosing.
    for (let N = 0; N < 10; N++) {
        const D = placed(deca, N);
        let stuck = 0;
        for (const h of hexes) {
            if (clash(D, placed(h, 0)) > 0 && clash(D, placed(h, 1)) > 0) stuck++;
        }
        assert.equal(stuck, 0, `N=${N}: ${stuck} hexagons with no good reading`);
    }
});
