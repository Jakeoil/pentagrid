// The border between two 2k-gons: Socolar's adjacency rule, as a test.
// tools/border.mjs prints it; PLAN §5.-1a has the finding.
import test from "node:test";
import assert from "node:assert/strict";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";
import { zonohedronOf, zonogonAnchor } from "../dist/geometry/zonohedron.js";

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
function placed(stack, reading) {
    const z = zonohedronOf(dirs, stack.fams);
    const anchor = zonogonAnchor(z, stack.rhombs.flatMap((r) => r.vertices),
                                 stack.rhombs.flatMap((r) => r.kTuples), dirs);
    const pool = z.penrose.length ? z.penrose : z.readings.map((_, i) => i);
    const bases = z.readings.length
        ? z.readings[pool[((reading % pool.length) + pool.length) % pool.length]]
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

test("KNOWN BUG: every slider position leaves an illegal border", () => {
    // Jake: "Every reading is wrong, not legal penrose." One slider drives
    // every solid, wrapped against its own count — the decagon N mod 10, a
    // hexagon N mod 2 — and nothing couples them, so the hexagons are never
    // asked to agree with the decagon. This asserts the bug so that fixing it
    // has to come here and say so.
    assert.ok(deca, "no decagon at Gamma = 0");
    for (let N = 0; N < 10; N++) {
        const D = placed(deca, N);
        let v = 0;
        for (const h of hexes) v += clash(D, placed(h, N));
        assert.equal(v, 2, `N=${N}: expected the known two clashes, got ${v}`);
    }
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
