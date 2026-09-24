// The pattern of ten rhombs inside the decagon, and its symmetries.
//
// Jake's questions, in order: are they all mirror symmetric (no — 42 of 62),
// do they match rotations (they fall into six patterns up to the decagon's own
// D10), and is the Penrose one always a rotation of one seed (yes, exactly one
// orbit of ten). See tools/decagon-stats.mjs and PLAN §5.0.

import test from "node:test";
import assert from "node:assert/strict";

import { zonohedronOf } from "../dist/geometry/zonohedron.js";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { orbits, reachable, leftovers } from "./decagon-stats.mjs";

const dirs = createGammaSet({ guard: false }).model.directions;
const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
const reach = reachable(4);
const table = orbits(reach.held);

test("a jiggle only has to be small: the pattern depends on the ratios", () => {
    // Which is why nothing outside the decagon moves — every other crossing
    // keeps its tile however the five lines are pulled apart.
    for (let t = 0; t < 200; t++) {
        const e = [0, 0, 0, 0, 0].map(() => Math.floor(Math.random() * 9) - 4);
        for (const s of [2, 7, 1000]) {
            assert.equal(z.readingOf(e.map((v) => v * s)), z.readingOf(e),
                         `scaling by ${s} changed the pattern`);
        }
    }
});

test("every one of the 62 patterns is a jiggle of the five lines", () => {
    assert.equal(reach.all.size, z.readings.length);
});

test("six patterns, up to every symmetry of the decagon", () => {
    assert.deepEqual(table.map((t) => t.size), [2, 10, 10, 10, 10, 20]);
    assert.equal(table.reduce((s, t) => s + t.size, 0), 62);
    // Orbit size times stabilizer is the group order, 20 throughout.
    for (const t of table) {
        const stab = (t.mirror ? 2 : 1) * t.turn;
        assert.equal(t.size * stab, 20, `orbit at reading ${t.rep}`);
    }
});

test("not all of them are mirror symmetric: twenty are chiral", () => {
    const mirrored = table.filter((t) => t.mirror).reduce((s, t) => s + t.size, 0);
    assert.equal(mirrored, 42);
    assert.equal(62 - mirrored, 20);
    // The chiral ones are one orbit, and it is the only orbit of twenty.
    const chiral = table.filter((t) => !t.mirror);
    assert.equal(chiral.length, 1);
    assert.equal(chiral[0].size, 20);
});

test("only the two extreme readings have a turn of their own", () => {
    const turning = table.filter((t) => t.turn > 1);
    assert.equal(turning.length, 1);
    assert.equal(turning[0].size, 2, "the star and the anti-star");
    assert.equal(turning[0].turn, 5, "five-fold");
    assert.equal(turning[0].flips, 5, "and the only readings with five flips");
    for (const i of turning[0].members) {
        assert.equal(z.flips(z.readings[i]).length, 5);
    }
});

test("Penrose gives one pattern in ten placements — the deca seed", () => {
    assert.equal(reach.held.size, 10);
    const orbit = table.filter((t) => t.penrose);
    assert.equal(orbit.length, 1, "the Penrose readings are a single orbit");
    assert.equal(orbit[0].size, 10);
    assert.deepEqual([...reach.held].sort((a, b) => a - b), orbit[0].members);
    assert.equal(orbit[0].mirror, true);
    assert.equal(orbit[0].turn, 1, "the seed has no turn of its own");
    assert.equal(orbit[0].flips, 4);
    // Off Penrose there are six patterns rather than one.
    assert.ok(table.length > 1);
});

test("some jiggles leave an octagon or a hexagon inside the decagon", () => {
    assert.ok(reach.kinds.get("one hexagon left") > 0);
    assert.ok(reach.kinds.get("two hexagons left") > 0);
    assert.ok(reach.kinds.get("an octagon left") > 0);
    assert.equal(reach.kinds.get("the decagon intact"), 1, "only the zero jiggle");
    // An octagon is four of the ten triples staying concurrent at once.
    const oct = leftovers([1, 0, 0, 0, 0]);
    assert.equal(oct.length, 4);
    assert.deepEqual(oct, ["123", "124", "134", "234"]);
});
