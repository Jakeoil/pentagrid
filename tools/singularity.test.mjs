// Jake's test: sit on the sun and jog the offsets by a thousandth.
//
// The headline is that NOTHING survives a random jog — not the decagon, not the
// hexagons. A triple of lines meets only when two exact conditions hold at once,
// and a random offset satisfies neither. What is left when something does
// survive is predicted exactly by those conditions. See tools/singularity-stats.mjs
// for the census in full, and PLAN §5.0.

import test from "node:test";
import assert from "node:assert/strict";

import { census, predict, oddOne, CONSECUTIVE, SPREAD } from "./singularity-stats.mjs";

const Q = 10000;                        // the gamma set's denominator, 2000n
const SUN = [0, 0, 0, 0, 0];
const ri = (n) => Math.floor(Math.random() * (2 * n + 1)) - n;
const triples = [...CONSECUTIVE, ...SPREAD];
const observed = (by) => [...by.keys()].filter((k) => k.length === 3).sort().join(" ");
const predicted = (gamma) => triples.filter((t) => predict(gamma, t)).sort().join(" ");

test("the sun's singularities are two orbits of five, and one decagon", () => {
    const by = census(SUN, 6);
    assert.equal(by.get("01234"), 1, "exactly one decagon, at the origin");
    const thick = CONSECUTIVE.map((t) => by.get(t) ?? 0);
    const thin = SPREAD.map((t) => by.get(t) ?? 0);
    assert.ok(thick[0] > 0 && thin[0] > 0, "the hexagons are there");
    // The star's own symmetry makes the five of each kind interchangeable, so a
    // census in a disk has to come out equal. (In a rectangle it does not, which
    // is why the tool counts in a disk.)
    for (const c of [thick, thin]) {
        assert.deepEqual(c, c.map(() => c[0]), `uneven census: ${c.join(",")}`);
    }
    assert.notEqual(thick[0], thin[0], "the two kinds are not equally common");
});

test("the hexagons lie along lines: the census is linear in the radius", () => {
    // 2r - 2 of each consecutive triple inside radius r — one per unit of line,
    // both ways from the origin. A count spread over the plane would go as r².
    for (const r of [4, 6, 8, 10, 14]) {
        const by = census(SUN, r);
        assert.equal(by.get("012"), 2 * r - 2, `radius ${r}`);
    }
});

test("a random jog of a thousandth wipes every singularity out", () => {
    // Both ways Jake asked for: the sum held at 0 with gamma0 floating, and the
    // sum shaken too.
    for (const hold of [true, false]) {
        let empty = 0, disagreed = 0;
        const TRIALS = 30;
        for (let i = 0; i < TRIALS; i++) {
            const a = [0, ri(10), ri(10), ri(10), ri(10)];
            if (hold) a[0] = -(a[1] + a[2] + a[3] + a[4]); else a[0] = ri(10);
            const gamma = a.map((q) => q / Q);
            const by = census(gamma);
            if (by.size === 0) empty++;
            if (observed(by) !== predicted(gamma)) disagreed++;
        }
        assert.equal(disagreed, 0, `the rule missed ${disagreed} of ${TRIALS}`);
        // A survivor is possible — a jog can leave an offset exactly where it
        // was — but it is rare, and there is never a decagon or an octagon.
        assert.ok(empty > TRIALS * 0.6,
                  `only ${empty}/${TRIALS} came out clean (sum held: ${hold})`);
    }
});

test("moving one offset turns the decagon into an octagon", () => {
    // gamma1..4 still all zero, so those four lines still meet; gamma0 has left.
    for (const q of [1, 10, 2500]) {
        const gamma = [q / Q, 0, 0, 0, 0];
        const by = census(gamma);
        assert.equal(by.get("01234") ?? 0, 0, "the decagon is gone");
        assert.equal(by.get("1234"), 1, "and an octagon stands in its place");
        assert.equal(observed(by).split(" ").filter(Boolean).length, 4,
                     "four hexagon families survive");
        assert.equal(observed(by), predicted(gamma));
    }
});

test("the rule: the odd family an integer, the other two summing to one", () => {
    for (const t of triples) {
        const p = oddOne(t);
        assert.ok(p >= 0, `${t} has no odd family`);
        assert.ok(t.includes(String(p)), `${t}: ${p} is not in it`);
    }
    // Structured offsets, where the conditions can be satisfied on purpose.
    let checked = 0;
    for (let i = 0; i < 40; i++) {
        const a = [0, 0, 0, 0, 0];
        // zero some, jog the rest, so the conditions hold sometimes
        for (let j = 0; j < 5; j++) if (Math.random() < 0.5) a[j] = ri(3) * 10;
        if (Math.random() < 0.5) { a[1] = 10; a[3] = -10; }
        const gamma = a.map((q) => q / Q);
        assert.equal(observed(census(gamma)), predicted(gamma),
                     `gamma ${a.join(",")}`);
        checked++;
    }
    assert.equal(checked, 40);
});
