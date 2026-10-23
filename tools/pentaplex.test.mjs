// What the pentaplex emits, pinned — PLAN section 5.6-a.
//
// Jake, 2026-10-23: "The thick tile obviously draws one yellow pentagon and
// its edges. How about the orange pentagon? is it drawn two times on thin
// rhombs? Does the thick tile also draw and orange tile? Are orange tiles
// drawn twice?"
import test from "node:test";
import assert from "node:assert/strict";
import { census } from "./pentaplex.mjs";
import { rhombPentagons, PENTA_R } from "../dist/geometry/decor.js";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import { vertexIndex } from "../dist/geometry/roof.js";

test("a thick tile emits one yellow and two orange; a thin emits two orange", () => {
    const dirs = makeDirections(true);
    const pg = { n: 5, directions: dirs, gamma: [0.2, 0.2, 0.2, 0.2, 0.2] };
    const rs = collectRhombs(pg, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 });
    let lo = Infinity, hi = -Infinity;
    for (const r of rs) {
        const m = vertexIndex(r.kTuples[0]);
        lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    const levels = hi - lo + 3;
    let thick = 0, thin = 0;
    for (const r of rs) {
        const p = rhombPentagons(r, lo, levels);
        if (r.thick) {
            thick++;
            assert.ok(p.yellow, "a thick tile with no yellow");
            assert.equal(p.orange.length, 2, "a thick tile should emit two orange");
        } else {
            thin++;
            assert.equal(p.yellow, null, "a thin tile emitted a yellow");
            assert.equal(p.orange.length, 2, "a thin tile should emit two orange");
            // The two are DIFFERENT pentagons, on the two edges at that corner,
            // not one drawn twice. PENTA_R = 1/phi^2.
            const c = p.orange.map((q) => {
                let x = 0, y = 0;
                for (const v of q) { x += v[0]; y += v[1]; }
                return [x / q.length, y / q.length];
            });
            const apart = Math.hypot(c[0][0] - c[1][0], c[0][1] - c[1][1]);
            assert.ok(apart > 0.1, `the thin's two oranges are ${apart} apart`);
        }
    }
    assert.ok(thick > 100 && thin > 100, `${thick} thick, ${thin} thin`);
    assert.ok(Math.abs(PENTA_R - 1 / ((1 + Math.sqrt(5)) / 2) ** 2) < 1e-12);
});

test("yellow never duplicates; orange does, and the copies coincide exactly", () => {
    const { emits, draws } = census();
    const per = { yellow: { draws: 0, set: new Set() },
                  orange: { draws: 0, set: new Set() } };
    let mixed = 0;
    for (const [k, list] of emits) {
        if (new Set(list.map((e) => e.color)).size > 1) mixed++;
        for (const e of list) { per[e.color].draws++; per[e.color].set.add(k); }
    }
    // One yellow per thick tile, and no two tiles ever claim the same one.
    assert.equal(per.yellow.draws, per.yellow.set.size,
                 "a yellow pentagon was drawn twice");
    // Orange is shared: a neighbor reaches over the edge for it. This is why
    // the draw pass deduplicates on the center alone, and why it must.
    assert.ok(per.orange.draws > per.orange.set.size * 1.5,
              `orange ${per.orange.draws} draws for ${per.orange.set.size} pentagons: `
              + "the sharing is gone");
    // And the kinds never conflict, though they are computed tile by tile.
    assert.equal(mixed, 0, `${mixed} centers carry two different colors`);
    assert.equal(draws, per.yellow.draws + per.orange.draws);
});

test("the pentaplex overhangs its tile, and only the yellow does not", () => {
    // Which is the premise of Jake's question: "the pentaplex decorations
    // extend beyond the tile." Measured, 61.7% of the pentagon area is inside
    // the tile that drew it, and the only figures wholly inside are the
    // yellows — one per thick tile.
    const { emits, draws, fully, inside, total } = census();
    let yellows = 0;
    for (const list of emits.values()) {
        yellows += list.filter((e) => e.color === "yellow").length;
    }
    assert.equal(fully, yellows,
                 `${fully} draws lie wholly inside their tile but there are ${yellows} yellows`);
    assert.ok(fully < draws / 3, `${fully} of ${draws} draws are contained`);
    const frac = inside / total;
    assert.ok(frac > 0.5 && frac < 0.7,
              `${(100 * frac).toFixed(1)}% of the area is inside its own tile`);
});
