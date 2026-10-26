// The VE codes: that the table is the figure, and that a Penrose patch shows
// the seven it is supposed to show, at the frequencies it is supposed to.

import test from "node:test";
import assert from "node:assert/strict";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import { VE_CODE, PENROSE_CODES, veWord, vertexStars } from "../dist/geometry/vertexenv.js";

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

test("the unnamed words on a Penrose patch live on the singular walls", () => {
    // They sum to 10, so they are complete stars -- but their count grows with
    // the RADIUS rather than the area, because they sit along the walls, and
    // that is what tells them apart from an environment. Measured at two radii.
    const g = [0.2, 0.2, 0.2, 0.2, 0.2];                 // the sun: singular
    const small = census(g, 24), big = census(g, 40);
    const sum = (c, pick) => [...c.out].filter(([k]) => pick(k))
                                       .reduce((s, [, n]) => s + n, 0);
    const odd = (k) => k.startsWith("?");
    // Their share of the patch falls as it grows -- a count along a line
    // against a count over an area -- and it is tiny either way.
    const shareSmall = sum(small, odd) / sum(small, () => true);
    const shareBig = sum(big, odd) / sum(big, () => true);
    // A count along a line over a count over an area falls like 1/R, so the
    // share should land near 20/36 of itself; anything under 0.75 is already
    // saying it is not an environment.
    assert.ok(shareBig < shareSmall * 0.75,
              `the odd words hold their share: ${shareSmall.toFixed(4)} then ${shareBig.toFixed(4)}`);
    assert.ok(shareBig < 0.01, `${(shareBig * 100).toFixed(2)}% of the patch is unnamed`);
    // and the named seven DO hold their density
    for (const c of PENROSE_CODES) {
        const a = (small.out.get(c) ?? 0) / 20 ** 2, b = (big.out.get(c) ?? 0) / 36 ** 2;
        assert.ok(b > a * 0.75 && b < a * 1.25,
                  `${c} does not hold its density: ${a.toFixed(4)} then ${b.toFixed(4)}`);
    }
});

test("off Penrose the letters widen, and three real words go unnamed", () => {
    const { out } = census([0.0817, 0.3391, -0.2234, 0.1109, 0.1917]);   // LI 1/2
    const named = new Set([...out.keys()].filter((c) => !c.startsWith("?")));
    for (const c of ["L", "M", "R", "U", "W", "Y", "Z", "*"]) {
        assert.ok(named.has(c), `${c} should appear off Penrose`);
    }
    // The figure lists sixteen; this construction also makes 1234, 1324 and
    // 11224, which are complete stars it does not name. They are drawn "?".
    const unnamed = [...out].filter(([c, n]) => c.startsWith("?") && n > 20)
                            .map(([c]) => c.slice(1)).sort();
    assert.deepEqual(unnamed, ["11224", "1234", "1324"]);
});
