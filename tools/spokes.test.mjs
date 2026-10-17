// The spokes: Jake's claim, as assertions. PLAN §5.-1 and tools/spokes.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import {
    concurrencies, spokes, fitLine, spokeWord, shapeOf, fibWord,
    complexity, sturmianUpto,
} from "./spokes.mjs";

const PHI = (1 + Math.sqrt(5)) / 2;
const ZERO = [0, 0, 0, 0, 0];
const WALL = [0, 0, 0, 0.013, -0.013];

test("at Gamma = 0 the catalog is 390 hexagons and one decagon, no octagon", () => {
    const sing = concurrencies(ZERO, 26);
    const by = new Map();
    for (const e of sing) by.set(e.fams.size, (by.get(e.fams.size) ?? 0) + 1);
    assert.equal(by.get(5), 1, "one five-fold, at the origin");
    assert.equal(by.get(4) ?? 0, 0, "no octagon is Penrose — §5.12");
    assert.ok(by.get(3) > 300, `${by.get(3)} hexagons`);
});

test("each triple's hexagons are exactly collinear — that is a spoke", () => {
    const all = spokes(ZERO);
    assert.equal(all.size, 10, "all ten triples are present");
    for (const [t, pts] of all) {
        assert.ok(pts.length > 20, `${t}: only ${pts.length} hexagons`);
        assert.ok(fitLine(pts).off < 1e-12, `${t} is not a line: ${fitLine(pts).off}`);
    }
});

test("the ten spokes are five lines, each a thin and a thick sharing it", () => {
    // Which is §5.12's couples read geometrically: every couple is one K122
    // and one K113, and here they are the two triples on one spoke.
    const byDir = new Map();
    for (const [t, pts] of spokes(ZERO)) {
        const d = fitLine(pts).deg.toFixed(2);
        if (!byDir.has(d)) byDir.set(d, []);
        byDir.get(d).push(t);
    }
    assert.equal(byDir.size, 5, "five directions, 36 degrees apart");
    for (const [d, pair] of byDir) {
        assert.equal(pair.length, 2, `${d}: ${pair.length} triples`);
        assert.deepEqual(pair.map(shapeOf).sort(), ["113", "122"],
                         `${d}: should be one thin and one thick`);
    }
});

test("one spoke's own hexagons are periodic, with the decagon as a gap", () => {
    // Each triple alone is evenly spaced at g — except at the origin, where
    // the five-fold has taken the slot its hexagon would occupy, leaving 2g.
    for (const [t, pts] of spokes(ZERO)) {
        const { ux, uy } = fitLine(pts);
        const ts = pts.map(([x, y]) => x * ux + y * uy).sort((a, b) => a - b);
        const gaps = ts.slice(1).map((v, i) => v - ts[i]);
        const small = Math.min(...gaps);
        const vals = [...new Set(gaps.map((g) => g.toFixed(6)))];
        assert.equal(vals.length, 2, `${t}: ${vals.length} gap lengths, want 2`);
        const big = Math.max(...gaps);
        assert.ok(Math.abs(big / small - 2) < 1e-9, `${t}: the long gap is ${big / small}g`);
        assert.equal(gaps.filter((g) => g > small * 1.5).length, 1,
                     `${t}: exactly one double gap, at the decagon`);
    }
});

test("the two spoke types are themselves phi apart", () => {
    const g = new Map();
    for (const [t, pts] of spokes(ZERO)) {
        const { ux, uy } = fitLine(pts);
        const ts = pts.map(([x, y]) => x * ux + y * uy).sort((a, b) => a - b);
        const small = Math.min(...ts.slice(1).map((v, i) => v - ts[i]));
        g.set(shapeOf(t), small);
    }
    assert.ok(Math.abs(g.get("122") / g.get("113") - PHI) < 1e-9,
              `the thick spacing over the thin is ${g.get("122") / g.get("113")}`);
});

test("the word along a spoke is Jake's, and the decagon is a defect in it", () => {
    // Jake: "SLLSLLSLSLLSLSL..." — ours from its second letter, exactly. The
    // lengths are NOT the sequence: two incommensurate periods interleaved
    // take dozens of gap values. It is the LABELS that are Sturmian.
    const w = spokeWord(ZERO, ["014", "023"]);
    const swapped = [...w].map((c) => (c === "S" ? "L" : "S")).join("");
    assert.equal(swapped.slice(1, 16), "SLLSLLSLSLLSLSL", "Jake's sequence");
    assert.ok(!w.includes("LL") && !w.includes("SSS"), "a Sturmian-looking word");
    // And the defect: complexity departs from n + 1, which a Sturmian word
    // never does. One missing letter, at the decagon.
    assert.notEqual(sturmianUpto(w), 0, "Gamma = 0 should NOT be Sturmian");
    assert.deepEqual(complexity(w, 8), [2, 3, 4, 5, 6, 7, 8, 10],
                     "the break is at n = 8, the signature of one defect");
    assert.equal(fibWord(2000).includes(swapped), false, "nor a Fibonacci factor");
});

test("THE CLAIM: at a wall the couple survives and the spoke heals", () => {
    // Jake: "a couple of paths where two skewbs (thin and thick) remain. when
    // this happens, one of the spokes continues the musical sequence."
    //
    // The wall is eps = (0,0,0,t,-t): the sum is held, so the patch stays
    // Penrose, and §5.12's rule — gamma_L integral, gamma_P + gamma_Q integral
    // — keeps the triple 012 concurrent and FORCES its partner 134 with it.
    const all = spokes(WALL);
    assert.equal(all.size, 2, `${all.size} triples survive, want the couple`);
    assert.deepEqual([...all.keys()].sort(), ["012", "134"]);
    assert.deepEqual([...all.keys()].map(shapeOf).sort(), ["113", "122"],
                     "one thin skewb and one thick");
    // The other eight spokes are gone entirely, and so is the decagon.
    const sing = concurrencies(WALL, 26);
    assert.equal(sing.filter((e) => e.fams.size > 3).length, 0, "the decagon is resolved");

    // Each of the couple gains exactly one hexagon — the slot the decagon had.
    const at0 = spokes(ZERO);
    for (const t of ["012", "134"]) {
        assert.equal(all.get(t).length, at0.get(t).length + 1,
                     `${t} should gain exactly one hexagon`);
    }
    // And the word is now Sturmian, and a factor of the Fibonacci word.
    const w = spokeWord(WALL, ["012", "134"]);
    assert.equal(sturmianUpto(w), 0, `complexity ${complexity(w).join(" ")}`);
    assert.deepEqual(complexity(w, 12),
                     [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "exactly n + 1");
    const swapped = [...w].map((c) => (c === "S" ? "L" : "S")).join("");
    assert.ok(fibWord(2000).includes(swapped), "a factor of the Fibonacci word");
});

test("a chamber resolves everything, which is what a chamber means", () => {
    assert.equal(concurrencies([0.001, -0.004, 0.002, 0.005, -0.004], 26).length, 0);
});
