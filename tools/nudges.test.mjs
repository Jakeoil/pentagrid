// The nudge census, which is what the reading control is choosing between.
//
// Jake: "You still count 62 permutation. We know there are only 10 which
// express penrose tiles. There are many others, 20 I believe, that leave a
// single wall of singularites which passes through the decagon leaving four
// penrose tiles and two skewbs."
import test from "node:test";
import assert from "node:assert/strict";
import { census, surviving, localTiling, shapeOf } from "./nudges.mjs";
import { nudgeVectors } from "../dist/geometry/cascade.js";

const { z, whole, walls } = census();

test("62 is the zonogon's number and 10 is the grid's", () => {
    assert.equal(z.readings.length, 62, "the decagon's rhombic tilings");
    assert.equal(z.penrose.length, 10, "the ones a Penrose grid reaches");
    // One contiguous block, because they are one orbit under rotation.
    assert.deepEqual([...z.penrose], [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    // And the ten resolving nudges find exactly those ten.
    assert.deepEqual(whole.map((w) => w.reading).sort((a, b) => a - b), [...z.penrose]);
});

test("a sum-zero nudge moves two lines or four, never three or five", () => {
    // Parity: an odd number of +/-1 cannot sum to zero. The same parity that
    // puts a 4-fold singularity off a Penrose grid.
    const all = nudgeVectors(5, true);
    assert.equal(all.length, 50);
    const moved = new Set(all.map((e) => e.filter((v) => v).length));
    assert.deepEqual([...moved].sort(), [2, 4]);
});

test("the 20 minimal nudges never resolve: every one leaves a wall", () => {
    // This is Jake's 20, and it is the sharper statement. A minimal nudge is
    // one line up and one down — the smallest move that holds the sum, and
    // the phason flip: "this occurs when a grid intersection crosses a
    // gridline."
    const two = nudgeVectors(5, true).filter((e) => e.filter((v) => v).length === 2);
    assert.equal(two.length, 20, "one up and one down, over the ordered pairs");
    for (const e of two) {
        assert.equal(z.readingOf(e), null, `${e.join("")} resolved the decagon`);
    }
    // And the ten that do resolve all move four.
    for (const w of whole) {
        assert.equal(w.e.filter((v) => v).length, 4, `${w.e.join("")} resolves on two`);
    }
});

test("a wall leaves one thin skewb and one thick: four ordinary tiles of ten", () => {
    assert.equal(walls.size, 5, "one wall per spoke direction");
    assert.deepEqual([...walls.keys()].sort(),
                     ["012/134", "013/234", "014/023", "024/123", "034/124"]);
    let rhombsInside = 0;
    for (const [tag, es] of walls) {
        const triples = tag.split("/");
        assert.deepEqual(triples.map(shapeOf).sort(), ["113", "122"],
                         `${tag} is not a thin and a thick skewb`);
        assert.equal(es.length, 8, `${tag} is reached by ${es.length} nudges`);
        assert.equal(es.filter((e) => e.filter((v) => v).length === 2).length, 4,
                     `${tag} has the wrong number of minimal nudges`);
        // Nothing but those two survives: no second wall, no 4-fold, no 5-fold.
        for (const e of es) {
            const s = surviving(e);
            assert.equal(s.length, 2, `${e.join("")} left ${s.length} standing`);
            assert.deepEqual(s.map((x) => x.fams.size), [3, 3]);
        }
        rhombsInside = triples.length * 3;
    }
    // Two skewbs are 3 + 3 of the decagon's C(5,2) = 10 rhombs, so four are
    // placed as ordinary Penrose tiles. Jake: "four penrose tiles and two
    // skewbs."
    assert.equal(z.pairs.length, 10);
    assert.equal(rhombsInside, 6);
    assert.equal(z.pairs.length - rhombsInside, 4);
});

test("the 50 nudges are 50 distinct tilings: the control has 50 positions, not 62", () => {
    // Which is the point of the restructure: the readout said "22/62", an
    // index into a combinatorial list the grid cannot reach most of.
    const all = [...whole.map((w) => w.e), ...[...walls.values()].flat()];
    assert.equal(all.length, 50);
    assert.equal(new Set(all.map((e) => localTiling(e))).size, 50,
                 "two nudges give the same tiling near the origin");
});

// ── the factorization Jake proposed, 2026-10-22 ────────────────────────────
// "The exceptional singularity has 5 modes/directions... a stepper with 5
// values, a boolean with short long, long short, and finally a three state
// stepper for the two paths and singularity."
import { factor, catalog, BRANCHES } from "./nudges.mjs";
import { makeDirections } from "../dist/geometry/pentagrid.js";

test("the 50 are a 5 x 2 x 5 product: axis, sense, branch", () => {
    const cat = catalog();
    assert.equal(cat.length, 50);
    const cells = new Set(cat.map((c) => `${c.branch}|${c.axis}|${c.sense}`));
    assert.equal(cells.size, 50, "two nudges share a cell, so this is not a product");
    // Every cell of the product is occupied: nothing is missing and nothing
    // doubles up.
    for (const b of BRANCHES) {
        for (let j = 0; j < 5; j++) {
            for (const s of [1, -1]) {
                assert.ok(cells.has(`${b}|${j}|${s}`), `${b} ${j} ${s} is empty`);
            }
        }
    }
    assert.equal(BRANCHES.length, 5,
                 "the branch is 5-valued: whole, plus FOUR wall positions");
});

test("the axis is family j, and it means the same in both branches", () => {
    const dirs = makeDirections(true);
    for (const c of catalog()) {
        if (c.branch === "whole") {
            // The whole resolution on axis j is the one that moves every line
            // but j.
            assert.equal(c.e[c.axis], 0, `${c.e.join("")} moved its own axis`);
            assert.equal(c.e.filter((v) => v).length, 4);
            continue;
        }
        // A wall's two triples share exactly j, and their spoke IS family j's
        // gridline: 90 degrees off v_j, measured.
        const s = surviving(c.e);
        assert.equal(s.length, 2);
        const [a, b] = s.map((x) => new Set(x.fams));
        assert.deepEqual([...a].filter((x) => b.has(x)), [c.axis],
                         `${c.e.join("")} does not share its axis`);
        let d = [s[1].p[0] - s[0].p[0], s[1].p[1] - s[0].p[1]];
        const L = Math.hypot(...d);
        const dot = Math.abs((d[0] * dirs[c.axis][0] + d[1] * dirs[c.axis][1]) / L);
        assert.ok(dot < 1e-9, `the spoke is not perpendicular to v${c.axis}: ${dot}`);
    }
});

test("negation flips the sense and nothing else", () => {
    // Which is why the sense must not be spent twice: top/bottom for a whole
    // resolution and SL/LS for a wall are the SAME bit, read by two branches.
    const by = new Map(catalog().map((c) => [c.e.join(","), c]));
    for (const c of by.values()) {
        const anti = by.get(c.e.map((v) => -v).join(","));
        assert.ok(anti, `${c.e.join("")} has no antipode in the catalog`);
        assert.equal(anti.axis, c.axis, "negation moved the axis");
        assert.equal(anti.branch, c.branch, "negation moved the branch");
        assert.equal(anti.sense, -c.sense, "negation did not flip the sense");
    }
});

test("the two centered branches are exactly the phason flips", () => {
    // A minimal nudge leaves one skewb sitting on the decagon's center and
    // steps the other off along the spoke. Those 20 are Jake's 20.
    for (const c of catalog()) {
        const minimal = c.e.filter((v) => v).length === 2;
        const centered = c.branch === "S at center" || c.branch === "L at center";
        assert.equal(minimal, centered,
                     `${c.e.join("")} is ${c.branch} on ${c.e.filter((v)=>v).length} lines`);
    }
    assert.equal(catalog().filter((c) => c.branch.endsWith("at center")).length, 20);
});
