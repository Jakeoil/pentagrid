#!/usr/bin/env node
/**
 * The nudges: what the reading control is actually choosing between.
 *
 * Jake, 2026-10-19: *"You still count 62 permutation. We know there are only
 * 10 which express penrose tiles. There are many others, 20 I believe, that
 * leave a single wall of singularites which passes through the decagon leaving
 * four penrose tiles and two skewbs."*
 *
 * Both numbers are right, and 20 is the sharper one. A resolution of a
 * singular pentagrid is ONE perturbation ε of the five families, not a choice
 * per polygon (§5.-1), and Σε = 0 is the Penrose condition on it. So the thing
 * to enumerate is the nudges, and this is their census.
 *
 * What it prints, at Γ = 0:
 *
 *   The decagon admits **62** rhombic tilings and exactly **10** of them are
 *   reachable — `zonohedronOf([0,1,2,3,4]).penrose`, readings 12 to 21, one
 *   orbit under rotation. 62 is the zonogon's combinatorics; 10 is the grid's.
 *
 *   There are **50** vectors in {−1,0,1}⁵ with Σε = 0 and ε ≠ 0, and they move
 *   either two lines or four — never three or five. Parity forces it: an odd
 *   number of ±1's cannot sum to zero. This is the same parity that makes
 *   4-fold singularities impossible on a Penrose grid.
 *
 *   | lines moved | resolve everything | leave a wall |
 *   |---|---|---|
 *   | 2 | **0** | **20** |
 *   | 4 | **10** | 20 |
 *
 *   So Jake's 20 are exactly the MINIMAL nudges — one line up, one line down,
 *   the smallest move that holds Σγ. Not one of them resolves the decagon.
 *   Every one leaves a wall, which is the phason-flip transition he named:
 *   *"this occurs when a grid intersection crosses a gridline."*
 *
 *   A wall leaves **K113 + K122** standing at the origin — one thin skewb and
 *   one thick, 3 + 3 = 6 of the decagon's 10 rhombs — so 4 are placed as
 *   ordinary Penrose tiles. *"Four penrose tiles and two skewbs."*
 *
 *   There are **5 walls**, one per spoke direction, each the surviving pair of
 *   triples of §5.-1: 012/134, 013/234, 014/023, 024/123, 034/124. Each is
 *   reached by 8 of the 40 wall nudges — 4 of them minimal — and those 8 give
 *   8 distinct tilings, so the 50 nudges are 50 distinct states: 10 whole and
 *   40 walled.
 *
 * Usage: node tools/nudges.mjs
 */
import { zonohedronOf } from "../dist/geometry/zonohedron.js";
import { nudgeVectors } from "../dist/geometry/cascade.js";
import { makeDirections, solveIntersection, collectRhombs }
    from "../dist/geometry/pentagrid.js";

const dirs = makeDirections(true);
/** How far γ is pushed to read a nudge off the grid. Small enough to be local. */
const T = 1e-3;
const key = (x, y) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;

/** A triple's K-code: 113 is the thin skewb, 122 the thick. Same as spokes.mjs. */
export const shapeOf = (fams) => {
    const f = [...fams].sort((a, b) => a - b);
    return [f[1] - f[0], f[2] - f[1], 5 - (f[2] - f[0])].sort().join("");
};

/** The concurrencies still standing within `reach` of the origin, after a nudge. */
export function surviving(e, reach = 0.5) {
    const pg = { n: 5, directions: dirs, gamma: e.map((v) => v * T) };
    const at = new Map();
    for (let j = 0; j < 5; j++) for (let k = j + 1; k < 5; k++) {
        for (let nj = -4; nj <= 4; nj++) for (let nk = -4; nk <= 4; nk++) {
            const p = solveIntersection(pg, j, k, nj, nk);
            if (!p || Math.hypot(p[0], p[1]) > reach) continue;
            const kk = key(p[0], p[1]);
            let s = at.get(kk);
            if (!s) { s = { p, fams: new Set() }; at.set(kk, s); }
            s.fams.add(j); s.fams.add(k);
        }
    }
    return [...at.values()].filter((s) => s.fams.size >= 3);
}

/** The tiling near the origin, as a string — so two nudges can be told apart. */
export function localTiling(e, reach = 1.6) {
    const pg = { n: 5, directions: dirs, gamma: e.map((v) => v * T) };
    return collectRhombs(pg, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 })
        .filter((r) => Math.hypot(r.x0, r.y0) < reach)
        .map((r) => `${r.x0.toFixed(4)},${r.y0.toFixed(4)},${r.j}${r.k}`)
        .sort().join("|");
}

/**
 * Every sum-zero nudge, sorted into the ones that resolve the decagon and the
 * ones that leave a wall — and for a wall, which one.
 */
export function census() {
    const z = zonohedronOf(dirs, [0, 1, 2, 3, 4]);
    const whole = [], walls = new Map();
    for (const e of nudgeVectors(5, true)) {
        const r = z.readingOf(e);
        if (r !== null) { whole.push({ e, reading: r }); continue; }
        const tag = surviving(e).filter((s) => s.fams.size === 3)
            .map((s) => [...s.fams].sort().join("")).sort().join("/");
        if (!walls.has(tag)) walls.set(tag, []);
        walls.get(tag).push(e);
    }
    return { z, whole, walls };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { z, whole, walls } = census();
    const all = [...whole.map((w) => w.e), ...[...walls.values()].flat()];
    console.log(`\n── the decagon`);
    console.log(`   ${z.readings.length} rhombic tilings of the zonogon,`
        + ` ${z.penrose.length} of them reachable (readings`
        + ` ${z.penrose[0]}–${z.penrose[z.penrose.length - 1]})`);

    console.log(`\n── the ${all.length} sum-zero nudges, by how many lines they move`);
    const moved = new Map();
    for (const e of all) {
        const m = e.filter((v) => v).length;
        if (!moved.has(m)) moved.set(m, { whole: 0, wall: 0 });
        moved.get(m)[z.readingOf(e) === null ? "wall" : "whole"]++;
    }
    for (const [m, c] of [...moved].sort()) {
        console.log(`   ${m} lines   ${String(c.whole).padStart(3)} resolve everything`
            + `   ${String(c.wall).padStart(3)} leave a wall`);
    }
    const two = all.filter((e) => e.filter((v) => v).length === 2);
    console.log(`   the ${two.length} MINIMAL nudges — one line up, one down — resolve`
        + ` ${two.filter((e) => z.readingOf(e) !== null).length} of ${two.length}`);

    console.log(`\n── the ${walls.size} walls`);
    for (const [tag, es] of [...walls].sort()) {
        const shapes = tag.split("/").map((t) => `K${shapeOf(t)}`).join(" + ");
        const min = es.filter((e) => e.filter((v) => v).length === 2).length;
        const distinct = new Set(es.map((e) => localTiling(e))).size;
        console.log(`   ${tag}  ${shapes}   ${es.length} nudges (${min} minimal)`
            + `   ${distinct} distinct tilings`);
    }
    const rhombs = 3 + 3;
    console.log(`   each leaves ${rhombs} of the decagon's`
        + ` ${z.pairs.length} rhombs inside two skewbs,`
        + ` so ${z.pairs.length - rhombs} are placed as ordinary tiles`);

    const states = new Set(all.map((e) => localTiling(e)));
    console.log(`\n── ${states.size} distinct states in all:`
        + ` ${whole.length} whole, ${all.length - whole.length} walled\n`);
}
