// The VE codes: that the table is the figure, and that a Penrose patch shows
// the seven it is supposed to show, at the frequencies it is supposed to.

import test from "node:test";
import assert from "node:assert/strict";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import { VE_CODE, PENROSE_CODES, veCensus, veWord, vertexStars } from "../dist/geometry/vertexenv.js";

const dirs = makeDirections(true);
const patch = (gamma, reach) =>
    collectRhombs({ n: 5, directions: dirs, gamma },
                  { xMin: -reach, xMax: reach, yMin: -reach, yMax: reach });

const census = (gamma, reach = 34, inset = 4) => {
    const out = new Map();
    let incomplete = 0;
    for (const v of vertexStars(patch(gamma, reach)).values()) {
        if (Math.hypot(v.x, v.y) > reach - inset) continue;
        if (!v.complete) { incomplete++; continue; }
        const k = v.code ?? `?${v.word}`;
        out.set(k, (out.get(k) ?? 0) + 1);
    }
    return { out, incomplete };
};

test("the sixteen codes are the sixteen pictures of figure 5a", () => {
    assert.equal(Object.keys(VE_CODE).length, 16);
    // Every word is a whole turn: 36 degrees a unit, ten units round.
    for (const w of Object.keys(VE_CODE)) {
        const sum = [...w].reduce((s, c) => s + Number(c), 0);
        assert.equal(sum, 10, `${w} (${VE_CODE[w]}) is not a whole turn`);
        // and only ever the four angles the two rhombs have
        for (const c of w) assert.ok("1234".includes(c), `${w} has a ${c}`);
    }
    // Each letter once, with ST written as the single glyph Jake asked for.
    const letters = Object.values(VE_CODE);
    assert.equal(new Set(letters).size, 16, "a letter is used twice");
    assert.ok(letters.includes("*"), "ST is written *");
    assert.ok(!letters.includes("ST"), "ST should not survive as two characters");
    // The arm counts run 3 up to 10, which is what the two rows of the figure
    // show: D's three tiles through ST's ten thin rhombs.
    const arms = Object.keys(VE_CODE).map((w) => w.length).sort((a, b) => a - b);
    assert.deepEqual(arms, [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10]);
    assert.equal(VE_CODE["1111111111"], "*", "ten thin rhombs is ST");
    assert.equal(VE_CODE["22222"], "S", "five thick rhombs is S");
});

test("the word is canonical under rotation and reflection", () => {
    assert.equal(veWord([3, 3, 4]), "334");
    assert.equal(veWord([4, 3, 3]), "334");
    assert.equal(veWord([3, 4, 3]), "334");
    // M's two forms are mirror images, and the paper counts them as one letter.
    assert.equal(veWord([1, 2, 4, 3]), veWord([3, 4, 2, 1]));
    // but the three distinct arrangements of {1,2,3,4} stay distinct
    assert.equal(new Set([veWord([1, 2, 3, 4]), veWord([1, 2, 4, 3]),
                          veWord([1, 3, 2, 4])]).size, 3);
});

test("a Penrose patch shows the seven, at powers of 1/phi", () => {
    const PHI = (1 + Math.sqrt(5)) / 2;
    const { out } = census([0.0817, 0.3391, -0.2234, 0.1109, -0.3083]);
    const named = [...out].filter(([c]) => !c.startsWith("?"));
    assert.deepEqual([...named.map(([c]) => c)].sort(), [...PENROSE_CODES].sort(),
                     "a Penrose patch showed something outside the seven");
    const total = named.reduce((s, [, n]) => s + n, 0);
    // D phi^-2, J phi^-3, Q phi^-4, K phi^-5, S and V phi^-6, T phi^-7.
    const want = { D: 2, J: 3, Q: 4, K: 5, S: 6, V: 6, T: 7 };
    let sum = 0;
    for (const [c, n] of named) {
        const f = n / total;
        sum += f;
        assert.ok(Math.abs(f - PHI ** -want[c]) < 0.006,
                  `${c} at ${f.toFixed(4)}, not phi^-${want[c]} = ${(PHI ** -want[c]).toFixed(4)}`);
    }
    assert.ok(Math.abs(sum - 1) < 1e-9, "the seven are the whole patch");
});

test("every whole star in the patch is one of the sixteen", () => {
    // The invariant the ordering bug broke, and the one that would have caught
    // it: the sixteen are CLOSED under this construction. A word outside them
    // is a permutation of one inside -- which is what a scrambled cyclic order
    // produces, and what Jake saw as question marks that should have been M
    // and R.
    const GAMMAS = [
        [0.0817, 0.3391, -0.2234, 0.1109, -0.3083],   // Penrose, sum 0
        [0.11, 0.23, 0.31, 0.17, 0.18],               // Penrose, sum 1
        [0.2, 0.2, 0.2, 0.2, 0.2],                    // the sun: singular
        [0.1, 0.1, 0.1, 0.1, 0.1],                    // LI 1/2, symmetric
        [0.0817, 0.3391, -0.2234, 0.1109, 0.1917],    // LI 1/2, generic
        [0.08, 0.17, 0.04, 0.21, 0.23],               // LI 0.73
        [0.02, 0.09, 0.06, 0.04, 0.04],               // LI 0.25
    ];
    const seen = new Set();
    for (const g of GAMMAS) {
        for (const v of vertexStars(patch(g, 26)).values()) {
            if (!v.complete) continue;
            assert.ok(v.code, `gamma ${g}: the star ${v.word} has no letter`);
            seen.add(v.code);
        }
    }
    // and between them they use the whole alphabet
    assert.equal(seen.size, 16, `only ${seen.size} of the sixteen ever appeared`);
});

test("off Penrose the letters widen past the Penrose seven", () => {
    const { out } = census([0.0817, 0.3391, -0.2234, 0.1109, 0.1917]);   // LI 1/2
    const named = [...out.keys()];
    for (const c of named) assert.ok(!c.startsWith("?"), `${c} went unnamed`);
    for (const c of ["L", "M", "R", "U", "W", "Y", "Z", "*"]) {
        assert.ok(named.includes(c), `${c} should appear off Penrose`);
    }
    // M and R are substantial here, not stragglers: they are what the
    // scrambled words used to be counted as.
    const total = [...out.values()].reduce((a2, b2) => a2 + b2, 0);
    assert.ok(out.get("M") / total > 0.08, "M should be a tenth of this patch");
    assert.ok(out.get("R") / total > 0.02, "R should be a few percent");
});

test("the census counts whole stars and keeps the rim out of the shares", () => {
    const rhombs = patch([0.0817, 0.3391, -0.2234, 0.1109, -0.3083], 20);
    const c = veCensus(rhombs);

    // Every vertex is accounted for, once: the whole stars plus the rim.
    const vertices = new Set();
    for (const r of rhombs) for (const v of r.vertices) {
        vertices.add(`${Math.round(v[0] * 1e4)},${Math.round(v[1] * 1e4)}`);
    }
    assert.equal(c.whole + c.rim, vertices.size, "a vertex went missing");
    assert.ok(c.rim > 0, "a finite patch has a rim");

    // The shares are of the whole stars, and they add to one.
    const total = c.rows.reduce((s, r) => s + r.n, 0);
    assert.equal(total, c.whole);
    const sum = c.rows.reduce((s, r) => s + r.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `shares sum to ${sum}`);
    for (const r of c.rows) assert.equal(r.share, r.n / c.whole);

    // Commonest first, and on a Penrose patch there is nothing unnamed to
    // sort after them.
    const letters = c.rows.filter((r) => !r.code.startsWith("?"));
    assert.equal(letters.length, c.rows.length, "a Penrose patch left a star unnamed");
    for (let i = 1; i < letters.length; i++) {
        assert.ok(letters[i - 1].n >= letters[i].n, "not commonest first");
    }
    // And it is the Penrose seven, in their phi order.
    assert.deepEqual(letters.map((r) => r.code), ["D", "J", "Q", "K", "V", "S", "T"]);
});

test("dropping the rim is what keeps the census honest", () => {
    // Folding the incomplete stars in would invent an environment: at this
    // size the rim is a tenth of the patch, which would outrank four of the
    // seven. It is reported as a count instead, beside the shares.
    const c = veCensus(patch([0.0817, 0.3391, -0.2234, 0.1109, -0.3083], 20));
    assert.ok(c.rim / (c.whole + c.rim) > 0.05, "the rim is not negligible");
    const smallest = Math.min(...c.rows.map((r) => r.n));
    assert.ok(c.rim > smallest, "the rim would not even distort the census");
});
