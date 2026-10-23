// The singularity's state space, factored from the algebra — src/geometry/walls.ts.
//
// tools/nudges.mjs reaches the same answer by probing a patch; this is the
// closed form the view uses, and the two are checked against each other at the
// bottom so neither can drift.
import test from "node:test";
import assert from "node:assert/strict";
import { nudgeStates, stateAt, factorNudge, sumZeroNudges, resolvesTriple,
         skewbCode, BRANCHES } from "../dist/geometry/walls.js";
import { makeDirections } from "../dist/geometry/pentagrid.js";
import { zonohedronOf } from "../dist/geometry/zonohedron.js";
import { factor, census } from "./nudges.mjs";

const dirs = makeDirections(true);
const states = nudgeStates(dirs);

test("the state space is 5 axes x 2 senses x 5 branches, each cell once", () => {
    assert.equal(sumZeroNudges(5).length, 50);
    assert.equal(states.length, 50, "a nudge fell outside the factorization");
    const cells = new Set(states.map((s) => `${s.branch}|${s.axis}|${s.sense}`));
    assert.equal(cells.size, 50);
    for (const b of BRANCHES) for (let j = 0; j < 5; j++) for (const g of [1, -1]) {
        const s = stateAt(dirs, j, g, b);
        assert.ok(s, `no state at ${b} / axis ${j} / sense ${g}`);
        assert.equal(s.axis, j);
        assert.equal(s.sense, g);
        assert.equal(s.branch, b);
    }
});

test("a wall's axis is the family its two skewbs share, and the spoke is its gridline", () => {
    for (const s of states.filter((x) => x.branch !== "whole")) {
        assert.equal(s.standing.length, 2, "a wall stands on exactly two triples");
        assert.deepEqual(s.standing.map((t) => skewbCode(5, t)).sort(),
                         ["113", "122"], "one thin skewb and one thick");
        const [a, b] = s.standing;
        assert.deepEqual(a.filter((j) => b.includes(j)), [s.axis]);
        // Perpendicular to v_axis: the spoke IS family axis's own gridline.
        const d = [-dirs[s.axis][1], dirs[s.axis][0]];
        const dot = Math.abs(d[0] * dirs[s.axis][0] + d[1] * dirs[s.axis][1]);
        assert.ok(dot < 1e-12);
    }
    for (const s of states.filter((x) => x.branch === "whole")) {
        assert.equal(s.e[s.axis], 0, "a whole resolution moves its own axis");
        assert.equal(s.standing.length, 0);
    }
});

test("negating the nudge flips the sense and nothing else", () => {
    const by = new Map(states.map((s) => [s.e.join(","), s]));
    for (const s of states) {
        const anti = by.get(s.e.map((v) => -v).join(","));
        assert.ok(anti, `${s.e.join("")} has no antipode`);
        assert.equal(anti.axis, s.axis);
        assert.equal(anti.branch, s.branch);
        assert.equal(anti.sense, -s.sense);
    }
});

test("the centered branches are exactly the 20 phason flips", () => {
    // A triple whose three families all stand still keeps its concurrency
    // point, so that skewb stays on the old decagon's center.
    for (const s of states) {
        const minimal = s.e.filter((v) => v).length === 2;
        assert.equal(minimal, s.branch.endsWith("at center"),
                     `${s.e.join("")} is ${s.branch} on ${s.e.filter((v)=>v).length} lines`);
        if (!minimal) continue;
        const still = s.standing.find((t) => t.every((j) => s.e[j] === 0));
        assert.ok(still, "no triple stands completely still at a centered branch");
        const code = skewbCode(5, still);
        assert.equal(s.branch, code === "113" ? "S at center" : "L at center");
    }
    assert.equal(states.filter((s) => s.branch.endsWith("at center")).length, 20);
});

test("resolvesTriple agrees with the grid, triple by triple", () => {
    // The determinant against what a perturbed pentagrid actually does.
    const { walls } = census();
    for (const [tag, es] of walls) {
        const survivors = tag.split("/").map((t) => [...t].map(Number));
        for (const e of es) {
            for (const t of survivors) {
                assert.equal(resolvesTriple(dirs, t, e), false,
                             `${t.join("")} should stand under ${e.join("")}`);
            }
        }
    }
});

test("the closed form and the patch probe agree on all 50", () => {
    for (const s of states) {
        const probed = factor(s.e);
        assert.equal(probed.axis, s.axis, `axis differs on ${s.e.join("")}`);
        assert.equal(probed.sense, s.sense, `sense differs on ${s.e.join("")}`);
        assert.equal(probed.branch, s.branch, `branch differs on ${s.e.join("")}`);
    }
});

test("a wall settles four of the decagon's ten cells and leaves six stacked", () => {
    // Jake: a wall through the decagon leaves "four penrose tiles and two
    // skewbs". Two skewbs are 3 + 3 cells, so four cells settle — and those
    // four are what `partialOf` has to hand back, or they get swallowed by the
    // superposition and the picture is the 62-fold mess instead of the state.
    const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
    for (const s of states.filter((x) => x.branch !== "whole")) {
        assert.equal(z.readingOf(s.e), null, "a wall has no whole reading");
        const part = z.partialOf(s.e);
        assert.equal(part.length, 10, "one entry per cell of the decagon");
        const open = part.filter((m) => m === null).length;
        assert.equal(open, 6, `${s.e.join("")} left ${open} cells stacked, not 6`);
        assert.equal(part.length - open, 4, "four cells should settle");
        // The six open ones are exactly the two standing skewbs' own cells:
        // a cell belongs to a skewb when both its families do.
        const inSkewb = z.pairs.map(([i, j]) => s.standing.some(
            (t) => t.includes(z.fams[i]) && t.includes(z.fams[j])));
        part.forEach((m, p) => {
            assert.equal(m === null, inSkewb[p],
                         `cell ${p} disagrees with the skewbs it belongs to`);
        });
    }
});

test("a whole resolution settles every cell", () => {
    const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
    for (const s of states.filter((x) => x.branch === "whole")) {
        const part = z.partialOf(s.e);
        assert.equal(part.filter((m) => m === null).length, 0);
        // And it agrees with the reading it names, cell for cell.
        assert.deepEqual(part, z.readings[z.readingOf(s.e)]);
    }
});
