// Jake's compact numeral: four characters, the sign carried by color.

import test from "node:test";
import assert from "node:assert/strict";

import { compact, numHTML } from "../src/ui/numerals.js";

/** The rendered characters, with the amber one wrapped so the test can see it. */
const show = (v) => compact(v).cells
    .map(({ ch, tone }) => tone === "amber" ? `[${ch}]` : ch).join("");

test("the marker is one ladder: leading zeros, the point, trailing zeros", () => {
    // Straight off Jake's description, in order of magnitude.
    assert.equal(show(0.00345), "[2]345");
    assert.equal(show(0.0345), "[1]345");
    assert.equal(show(0.345), ".345");
    assert.equal(show(3.45), "3.45");
    assert.equal(show(34.5), "34.5");
    assert.equal(show(345.5), "346.");       // three figures, so it rounds
    assert.equal(show(3450.5), "345[1]");
    assert.equal(show(34500.5), "345[2]");
});

test("four cells, never more, over nine decades either way", () => {
    for (let e = -9; e <= 9; e++)
        for (const m of [1.23, 4.56, 9.87]) {
            const n = compact(m * 10 ** e).cells.length;
            assert.ok(n <= 4, `${m}e${e} took ${n} cells`);
        }
});

test("the sign is a color, and there is no minus sign anywhere", () => {
    for (const v of [-3, -0.0345, -34.5, -34500.5]) {
        assert.equal(compact(v).neg, true, String(v));
        assert.ok(!compact(v).cells.some((c) => c.ch === "-"), String(v));
        assert.equal(show(v), show(-v), "the digits are the magnitude's");
    }
    assert.match(numHTML(-3), /class="num neg"/);
    assert.match(numHTML(3), /class="num"/);
});

test("small exact integers are left alone", () => {
    // What this project mostly prints is a lattice coordinate, and 3 should
    // read as 3 rather than as 3.00.
    for (const v of [0, 1, 3, 42, 999]) assert.equal(show(v), String(v));
    assert.equal(show(-3), "3");
    assert.equal(compact(7).exact, true);
    // 1000 is where the ladder takes over
    assert.equal(show(1000), "100[1]");
});

test("the amber digit counts zeros, so it is never itself zero", () => {
    for (let e = -9; e <= 9; e++) {
        const amber = compact(1.23 * 10 ** e).cells.find((c) => c.tone === "amber");
        if (amber) assert.notEqual(amber.ch, "0", `1.23e${e}`);
    }
});

test("`exact` says whether anything was rounded away", () => {
    assert.equal(compact(3.45).exact, true);
    assert.equal(compact(0.345).exact, true);
    assert.equal(compact(3.4567).exact, false);
    assert.equal(compact(Math.PI).exact, false);
    // the real preset's coordinates, which are where this earns its keep
    assert.equal(compact(3.402603).exact, false);
    assert.equal(show(3.402603), "3.40");
});

test("zero and the un-numbers do not pretend", () => {
    assert.equal(show(0), "0");
    assert.equal(compact(0).neg, false, "-0 and 0 both read as 0 here");
    assert.equal(show(-0), "0");
    assert.equal(compact(-0).neg, true, "but the sign is still carried");
    assert.equal(show(Infinity), "inf");
    assert.equal(show(NaN), "nan");
});
