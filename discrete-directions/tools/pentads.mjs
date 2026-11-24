// @ts-check
// Search for EVEN PENTADS: five Gaussian integers, no two parallel, in wheel
// order, summing to ZERO -- which is the same thing as five lattice points
// whose sum is divisible by five, seen from their own centroid.
//
// Jake, 2026-11-23: *what is the smallest pentadic vector set which adds to a
// sum divisible by 5. what happens to the centers of the extrapolations (wheel
// successors) of such "even" pentadicae.*
//
// Why it is worth searching rather than deriving: GEOMETRY.md section 9 shows a
// seed has exactly three mode families under the ladder, and two of them are
// permanent --
//
//     m = +/-1   x phi^2     the figure. A pair, not one: m = +1 is a regular
//                            decagon and m = -1 its counter-rotating twin, and
//                            the RATIO |m9| / |m1| never changes. It is the
//                            anisotropy of the limiting affine map, and it is
//                            what leaves the rhombs misshapen for ever.
//     m = 3, 7   x phi^-2    the wobble. Dies like phi^-4 against the figure,
//                            so it is gone by generation eight.
//     m = 5      x -1        the spoke sum. Flips sign every generation and
//                            never shrinks. Zero exactly on an even pentad.
//
// So an even pentad is the seed whose m5 is zero, and the search is for the one
// whose m9/m1 is smallest at a given reach. Neither is a matter of taste: m5 is
// the rhombs' failure to close, exactly, and m9/m1 fixes how far their angles
// settle from 72 and 36.
//
// Usage:  node tools/pentads.mjs [reach] [--all]
//           reach   largest |v| to consider, default 9
//           --all   every record-setter, not just the frontier

import { checkSeed, inflate, wheelFromPoints, wheelsAt } from "../lib/wheels.js";
import { THICK, THIN, rhombus } from "../lib/tiles.js";

/** @typedef {readonly [number, number]} Pt */
/**
 * @typedef {{ spokes: Pt[], anisotropy: number, wobble: number,
 *             reach: number, square: number }} Pentad
 */

const DEG = Math.PI / 180;
const TEN = [...Array(10).keys()];

/**
 * The amplitude of Fourier mode `m` of a wheel. The wheel obeys W[t+5] = -W[t],
 * so only the odd modes are ever non-zero.
 * @param {readonly Pt[]} w
 * @param {number} m
 */
export function mode(w, m) {
    let re = 0, im = 0;
    for (const t of TEN) {
        const a = -m * t * 36 * DEG, c = Math.cos(a), s = Math.sin(a);
        re += w[t][0] * c - w[t][1] * s;
        im += w[t][0] * s + w[t][1] * c;
    }
    return Math.hypot(re, im) / 10;
}

const gcd = (/** @type {number} */ a, /** @type {number} */ b) =>
    b ? gcd(b, Math.abs(a % b)) : Math.abs(a);

/**
 * A searcher over every even pentad whose spokes fit inside `reach`. It returns
 * a function you hand a callback: the pentads are STREAMED rather than
 * collected, because past reach 10 there are tens of millions of them and an
 * array of that many objects is how the first version of this ran out of heap.
 *
 * Sorting the ten +/- by angle puts the five chosen at the EVEN positions, and
 * reading those off gives u0, u2, u4, -u1, -u3 where u0..u4 are the five sorted
 * by direction within one half turn. So "sums to zero" is an ALTERNATING sum,
 *
 *     u0 - u1 + u2 - u3 + u4 = 0
 *
 * which is what makes the search a four-deep loop with the fifth SOLVED rather
 * than a five-deep one: the same reason it finishes in seconds.
 *
 * @param {number} reach
 */
export function evenPentads(reach) {
    /** @type {Pt[]} */
    const half = [];
    for (let x = -reach; x <= reach; x++)
        for (let y = -reach; y <= reach; y++) {
            if (x === 0 && y === 0) continue;
            if (y < 0 || (y === 0 && x < 0)) continue;   // one of each +/- pair
            if (x * x + y * y > reach * reach) continue;
            half.push([x, y]);
        }
    half.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const at = new Map(half.map((v, i) => [`${v[0]},${v[1]}`, i]));
    const dir = (/** @type {Pt} */ v) => {
        const k = gcd(v[0], v[1]);
        return `${v[0] / k},${v[1] / k}`;
    };

    /** @param {(f: Pentad) => void} emit */
    return (emit) => {
    for (let i = 0; i < half.length; i++)
        for (let j = i + 1; j < half.length; j++)
            for (let k = j + 1; k < half.length; k++)
                for (let l = k + 1; l < half.length; l++) {
                    const [a, b, c, d] = [half[i], half[j], half[k], half[l]];
                    /** @type {Pt} */
                    const e = [b[0] + d[0] - a[0] - c[0], b[1] + d[1] - a[1] - c[1]];
                    const pos = at.get(`${e[0]},${e[1]}`);
                    if (pos === undefined || pos <= l) continue;
                    const u = [a, b, c, d, e];
                    if (new Set(u.map(dir)).size !== 5) continue;   // no two parallel
                    /** @type {Pt[]} */
                    const spokes = [u[0], u[2], u[4],
                        [-u[1][0], -u[1][1]], [-u[3][0], -u[3][1]]];
                    if (!checkSeed({ points: spokes, origin: [0, 0] }).ok) continue;
                    const w = wheelFromPoints(spokes);
                    const m1 = mode(w, 1);
                    emit({
                        spokes,
                        anisotropy: mode(w, 9) / m1,
                        wobble: mode(w, 3) / m1,
                        reach: Math.max(...spokes.map((v) => Math.hypot(v[0], v[1]))),
                        square: spokes.reduce((t, v) => t + v[0] * v[0] + v[1] * v[1], 0),
                    });
                }
    };
}

/**
 * The rhombs a seed settles into, measured rather than predicted: inflate well
 * past the wobble's half-life and read the quadrilaterals off.
 * @param {readonly Pt[]} spokes
 */
export function settledRhombs(spokes) {
    const w = wheelsAt(spokes, 14);
    const inf = inflate(w.d);
    let spread = 1, acuteLo = 180, acuteHi = 0;
    for (const spec of [THICK, THIN])
        for (let n = 0; n < 10; n++) {
            const q = rhombus(spec, w.t, inf, n, "classic");
            const e = [0, 1, 2, 3].map((i) =>
                [q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]]);
            const L = e.map((v) => Math.hypot(v[0], v[1]));
            spread = Math.max(spread, Math.max(...L) / Math.min(...L));
            let a = Math.abs(Math.atan2(e[0][0] * e[1][1] - e[0][1] * e[1][0],
                e[0][0] * e[1][0] + e[0][1] * e[1][1]) / DEG);
            if (a > 90) a = 180 - a;
            acuteLo = Math.min(acuteLo, a);
            acuteHi = Math.max(acuteHi, a);
        }
    return { spread, acuteLo, acuteHi };
}

// ── as a script ──────────────────────────────────────────────────────────

const reach = Number(process.argv[2] ?? 9);
const all = process.argv.includes("--all");
const show = (/** @type {readonly Pt[]} */ v) =>
    v.map((p) => `(${p[0]},${p[1]})`).join(" ");

let count = 0, leastSquare = Infinity;
/** @type {Pentad[]} */
let smallest = [];
/** @type {Map<number, Pentad>} */
const best = new Map();
evenPentads(reach)((f) => {
    count++;
    if (f.square < leastSquare) { leastSquare = f.square; smallest = [f]; }
    else if (f.square === leastSquare) smallest.push(f);
    const key = Math.round(f.reach * 1000) / 1000;
    const cur = best.get(key);
    if (!cur || f.anisotropy < cur.anisotropy) best.set(key, f);
});

console.log(`reach ${reach}: ${count} even pentads\n`);
console.log(`SMALLEST, sum|v|^2 = ${leastSquare}:`);
for (const f of smallest)
    console.log(`  reach ${f.reach.toFixed(3)}  ${show(f.spokes)}`);

console.log("\nROUNDEST, by the anisotropy that never goes away:");
console.log("  reach    m9/m1      m3/m1    rhomb spread   acute angles      spokes");
let floor = Infinity;
for (const key of [...best.keys()].sort((a, b) => a - b)) {
    const f = /** @type {Pentad} */ (best.get(key));
    if (!all && f.anisotropy >= floor) continue;
    floor = Math.min(floor, f.anisotropy);
    const r = settledRhombs(f.spokes);
    console.log(`  ${key.toFixed(3).padStart(6)}  ${(f.anisotropy * 100).toFixed(4).padStart(8)}%`
        + `  ${(f.wobble * 100).toFixed(2).padStart(6)}%  ${r.spread.toFixed(6).padStart(10)}`
        + `   ${r.acuteLo.toFixed(2)}-${r.acuteHi.toFixed(2)}`.padEnd(17)
        + `  ${show(f.spokes)}`);
}
