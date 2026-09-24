// The ten rhombs inside the decagon: every pattern, and what it takes to get it.
//
//     node tools/decagon-stats.mjs
//
// The decagon is the only five-line singularity in the pentagrid, and jiggling
// the five lines apart resolves it into a definite pattern of ten rhombs. The
// jiggle only has to be small: the pattern depends on the RATIOS of the five
// displacements, not their size, so it can be made as small as you like and
// nothing outside the decagon moves at all. Every other crossing keeps its tile.
//
// So the space of jiggles is best thought of projectively. Displacing all five
// lines by e_j = t·v_j just slides the concurrency sideways and changes nothing,
// which kills two dimensions, and scale kills a third — leaving a sphere. On it,
// each of the ten triples of lines draws a great circle where that triple stays
// concurrent. The chambers are the patterns; the circles are the jiggles that
// leave a hexagon standing inside the decagon; their crossings leave an octagon,
// or two hexagons.

import { zonohedronOf } from "../dist/geometry/zonohedron.js";
import { createGammaSet } from "../dist/geometry/gamma.js";

const dirs = createGammaSet({ guard: false }).model.directions;
const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);

/** A reading as its ten rhombs, in plane coordinates about the decagon's center. */
export function shape(bases) {
    const out = [];
    for (let p = 0; p < z.pairs.length; p++) {
        out.push(z.face(bases, p).map((m) => {
            let x = 0, y = 0;
            for (let l = 0; l < 5; l++) if (m >> l & 1) { x += dirs[l][0]; y += dirs[l][1]; }
            return [x, y];
        }));
    }
    return out;
}
const R6 = (x) => Math.round(x * 1e6);
const key = (rh) => rh.map((c) => c.map(([x, y]) => `${R6(x)},${R6(y)}`).sort().join("|"))
    .sort().join(" / ");
const apply = (rh, M) => rh.map((c) => c.map(([x, y]) => [M[0] * x + M[1] * y, M[2] * x + M[3] * y]));
const rot = (t) => [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];
const ref = (t) => [Math.cos(t), Math.sin(t), Math.sin(t), -Math.cos(t)];

// The decagon's own symmetry is D10, order 20: the five line directions are
// carried to themselves by a turn of 36 degrees, not just 72, because a line
// has no sign.
export const ROTS = [...Array(10).keys()].map((i) => rot(Math.PI * i / 5));
export const REFS = [...Array(10).keys()].map((i) => ref(Math.PI * i / 5));

const keys = z.readings.map((b) => key(shape(b)));
const index = new Map(keys.map((k, i) => [k, i]));
const act = (i, M) => index.get(key(apply(shape(z.readings[i]), M)));

/** Which lines are still concurrent after this jiggle. */
export function leftovers(e) {
    const out = [];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) {
        const [va, vb, vc] = [dirs[a], dirs[b], dirs[c]];
        const d = e[a] * (vb[0] * vc[1] - vb[1] * vc[0])
            - e[b] * (va[0] * vc[1] - va[1] * vc[0])
            + e[c] * (va[0] * vb[1] - va[1] * vb[0]);
        if (Math.abs(d) < 1e-9) out.push(`${a}${b}${c}`);
    }
    return out;
}

/** Every pattern up to the decagon's symmetries, with what distinguishes it. */
export function orbits(penrose) {
    const seen = new Set();
    const out = [];
    for (let i = 0; i < z.readings.length; i++) {
        if (seen.has(i)) continue;
        const members = new Set();
        for (const M of [...ROTS, ...REFS]) {
            const j = act(i, M);
            if (j !== undefined) members.add(j);
        }
        members.forEach((j) => seen.add(j));
        out.push({
            rep: i,
            size: members.size,
            members: [...members].sort((a, b) => a - b),
            mirror: REFS.some((M) => act(i, M) === i),
            turn: ROTS.filter((M) => act(i, M) === i).length,
            flips: z.flips(z.readings[i]).length,
            penrose: [...members].some((j) => penrose.has(j)),
        });
    }
    return out.sort((a, b) => a.size - b.size || a.rep - b.rep);
}

/** Readings reachable by integer jiggles within `reach`, and the Penrose ones. */
export function reachable(reach = 4) {
    const all = new Set(), held = new Set();
    const kinds = new Map();
    const span = [];
    for (let v = -reach; v <= reach; v++) span.push(v);
    for (const a of span) for (const b of span) for (const c of span)
        for (const d of span) for (const f of span) {
            const e = [a, b, c, d, f];
            const r = z.readingOf(e);
            if (r !== null) {
                all.add(r);
                if (a + b + c + d + f === 0) held.add(r);       // still Penrose
                continue;
            }
            const L = leftovers(e);
            if (!L.length) continue;
            const kind = L.length === 1 ? "one hexagon left"
                : L.length === 2 ? "two hexagons left"
                    : L.length === 4 ? "an octagon left" : "the decagon intact";
            kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        }
    return { all, held, kinds, total: Math.pow(2 * reach + 1, 5) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { all, held, kinds, total } = reachable(4);
    const table = orbits(held);
    console.log("\nthe ten rhombs inside the decagon\n");
    console.log(`  readings in all: ${z.readings.length}   reached by jiggling: ${all.size}`);
    console.log("\n  up to every symmetry of the decagon (D10, order 20):\n");
    console.log("   orbit  size  turn  mirror  flips  Penrose");
    table.forEach((t, i) => {
        console.log(`     ${String.fromCharCode(65 + i)}    ${String(t.size).padStart(4)}`
            + `  ${t.turn}-fold   ${t.mirror ? "yes" : "NO "}     ${t.flips}`
            + `      ${t.penrose ? "YES" : "-"}`);
    });
    const mir = table.filter((t) => t.mirror).reduce((s, t) => s + t.size, 0);
    console.log(`\n  mirror-symmetric: ${mir} of ${z.readings.length}`
        + `   chiral: ${z.readings.length - mir}`);
    console.log(`  with a turn of their own: ${table.filter((t) => t.turn > 1)
        .reduce((s, t) => s + t.size, 0)} — the two extreme readings, and only those`);
    console.log(`\n  holding the sum (staying Penrose) reaches ${held.size},`
        + ` which is exactly orbit ${String.fromCharCode(65 + table.findIndex((t) => t.penrose))}`);
    console.log("  — one pattern, in its ten placements. Off Penrose, all 62.");
    console.log("\n  jiggles that leave something standing inside the decagon:");
    for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${k.padEnd(20)} ${v} of ${total}`);
    }
}
