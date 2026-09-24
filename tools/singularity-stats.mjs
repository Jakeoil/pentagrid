// Which singularities a pentagrid actually has, and what it takes to keep them.
//
// Jake's test: sit on the sun — gamma = 0,0,0,0,0, sum 0 — then jog the offsets
// by a thousandth and see what survives. Run it with:
//
//     node tools/singularity-stats.mjs [trials] [radius]
//
// Counted in a DISK, not the scan rectangle. A square window biases the census
// badly: at gamma = 0 the five consecutive triples are equivalent under the
// star's own symmetry and must come out equal, and in a rectangle they do not.

import { createGammaSet } from "../dist/geometry/gamma.js";
import { scanRegions } from "../dist/geometry/regularity.js";
import { resolveConcurrency } from "../dist/geometry/resolve.js";

const TRIALS = Number(process.argv[2] ?? 40);
const RADIUS = Number(process.argv[3] ?? 6);
const Q = 10000;                       // the gamma set's denominator, 2000n

/** The ten triples, split by the two hexagon shapes. */
export const CONSECUTIVE = ["012", "123", "234", "034", "014"];   // K122, thick
export const SPREAD = ["013", "023", "024", "124", "134"];        // K113, thin

/**
 * The odd family out of a triple: the one whose condition stands alone.
 *
 * Three lines are concurrent when the 3x3 system drops rank, and with five-fold
 * directions the determinant reads
 *
 *     sin72 * (a + c)  =  sin144 * b        (up to which family is which)
 *
 * with a, b, c the rational numbers n_j - gamma_j. sin144/sin72 is 1/phi, which
 * is irrational, so BOTH sides have to vanish separately. That is the whole
 * story: the odd family's offset must be an integer, and the other two must sum
 * to one. Two exact conditions per triple — which is why a random jog wipes
 * every singularity out.
 */
export function oddOne(triple) {
    const t = [...triple].map(Number);
    for (const p of t) {
        const rest = t.filter((x) => x !== p);
        const gap = (a, b) => Math.min((a - b + 5) % 5, (b - a + 5) % 5);
        // consecutive run: the odd one is the middle; spread: the one outside
        // the adjacent pair. Both are "the family not in the closest pair".
        if (gap(rest[0], rest[1]) === 2 && gap(p, rest[0]) === 1 && gap(p, rest[1]) === 1) return p;
        if (gap(rest[0], rest[1]) === 1 && gap(p, rest[0]) === 2 && gap(p, rest[1]) === 2) return p;
    }
    return -1;
}

const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-9;

/** Does this triple of families meet anywhere, at these offsets? */
export function predict(gamma, triple) {
    const p = oddOne(triple);
    const rest = [...triple].map(Number).filter((x) => x !== p);
    return isInt(gamma[p]) && isInt(gamma[rest[0]] + gamma[rest[1]]);
}

/** Every concurrency within RADIUS of the origin, keyed by its families. */
export function census(gamma, radius = RADIUS) {
    const g = createGammaSet({ guard: false });
    g.setLocked(-1);
    g.setValues(gamma);
    const pad = radius + 1;
    const { concurrencies } = scanRegions(
        g.model, { xMin: -pad, xMax: pad, yMin: -pad, yMax: pad }, { scale: 1 });
    const by = new Map();
    for (const c of concurrencies) {
        if (Math.hypot(c.x, c.y) > radius) continue;
        const r = resolveConcurrency(g.model, c);
        if (!r) continue;
        const key = r.families.join("");
        by.set(key, (by.get(key) ?? 0) + 1);
    }
    return by;
}

const row = (by, keys) => keys.map((t) => `${t}:${by.get(t) ?? 0}`).join("  ");
const totalOf = (by) => [...by.values()].reduce((s, v) => s + v, 0);

// ── the sun itself ────────────────────────────────────────────────

const sun = census([0, 0, 0, 0, 0]);
console.log(`\ngamma = 0 0 0 0 0   (the sun, sum 0)   disk r = ${RADIUS}`);
console.log(`  decagon K11111     ${sun.get("01234") ?? 0}`);
console.log(`  thick hexagons K122  ${row(sun, CONSECUTIVE)}`);
console.log(`  thin  hexagons K113  ${row(sun, SPREAD)}`);
console.log(`  total ${totalOf(sun)}`);

const equal = (xs) => xs.every((x) => x === xs[0]);
console.log(`  the five K122 agree: ${equal(CONSECUTIVE.map((t) => sun.get(t) ?? 0))}`
    + ` · the five K113 agree: ${equal(SPREAD.map((t) => sun.get(t) ?? 0))}`);
console.log("  so the ten triples are two orbits of five. Rotation alone already");
console.log("  gives that, and adding the reflection merges nothing further: the");
console.log("  mirror through family 0 sends 012 to 034, which is in the same orbit.");

console.log("\n  how the count grows with the disk:");
for (const r of [4, 6, 8, 10, 12, 14]) {
    const by = census([0, 0, 0, 0, 0], r);
    console.log(`    r = ${String(r).padStart(2)}   K122 ${by.get("012") ?? 0} each`
        + `   K113 ${by.get("013") ?? 0} each   decagon ${by.get("01234") ?? 0}`);
}
console.log("  Linear in r, not square: each triple's hexagons lie along one line");
console.log("  through the origin. That is the column of singularities.");

// ── Jake's jog ────────────────────────────────────────────────────

const ri = (n) => Math.floor(Math.random() * (2 * n + 1)) - n;
function trials(label, make) {
    const tally = new Map();
    let empty = 0, wrong = 0;
    for (let i = 0; i < TRIALS; i++) {
        const gamma = make();
        const by = census(gamma);
        if (by.size === 0) empty++;
        const seen = [...by.keys()].filter((k) => k.length === 3).sort().join(" ");
        const said = [...CONSECUTIVE, ...SPREAD].filter((t) => predict(gamma, t)).sort().join(" ");
        if (seen !== said) wrong++;
        for (const [k, v] of by) tally.set(k, (tally.get(k) ?? 0) + v);
    }
    console.log(`\n${label}`);
    console.log(`  ${empty}/${TRIALS} trials had no singularity at all`);
    console.log(`  everything found: ${[...tally].map(([k, v]) => `${k}:${v}`).join(" ") || "nothing"}`);
    console.log(`  the rule disagreed with the scan ${wrong} times`);
    if (empty < TRIALS) {
        console.log("  (a survivor means the jog happened to leave one offset where it was,");
        console.log("   or two of them summing back to zero — both conditions are exact)");
    }
}

trials("gamma0 floats to hold the sum at 0, the other four jogged +-1/1000", () => {
    const a = [0, ri(10), ri(10), ri(10), ri(10)];
    a[0] = -(a[1] + a[2] + a[3] + a[4]);
    return a.map((q) => q / Q);
});

trials("all five jogged +-1/1000, the sum shaken too", () =>
    [ri(10), ri(10), ri(10), ri(10), ri(10)].map((q) => q / Q));

// ── what does survive ─────────────────────────────────────────────

console.log("\nstructured moves off the sun, and what is left:");
const shapes = [
    ["one offset moved, gamma0 = 1/1000", [10, 0, 0, 0, 0]],
    ["one offset moved far, gamma0 = 1/4", [2500, 0, 0, 0, 0]],
    ["two moved oppositely, gamma1 = -gamma3", [0, 10, 0, -10, 0]],
    ["two pairs, equal steps", [0, 10, -10, 10, -10]],
    ["two pairs, unequal steps", [0, 10, -10, 100, -100]],
    ["all five equal, the sum moved", [10, 10, 10, 10, 10]],
];
for (const [label, quanta] of shapes) {
    const gamma = quanta.map((q) => q / Q);
    const by = census(gamma);
    const live = [...CONSECUTIVE, ...SPREAD].filter((t) => predict(gamma, t));
    const seen = [...by.keys()].filter((k) => k.length === 3).sort();
    console.log(`  ${label}`);
    console.log(`     counted  ${[...by].sort().map(([k, v]) => `${k}:${v}`).join(" ") || "nothing"}`);
    console.log(`     predicted ${live.sort().join(" ") || "nothing"}`
        + `${seen.join(" ") === live.sort().join(" ") ? "   (agrees)" : "   MISMATCH"}`);
}
