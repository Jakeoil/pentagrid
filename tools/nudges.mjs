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

/**
 * A nudge's three coordinates — which is the structure Jake asked for.
 *
 * Jake, 2026-10-22: *"The exceptional singularity has 5 modes/directions.
 * Entering, it encounters two neker scubes/skewbs. It can take the thin-thick
 * thick-thin direction. and of that, the top or the bottom (or unresolved
 * both)... So a stepper with 5 values, a boolean with short long, long short,
 * and finally a three state stepper for the two paths and singularity."*
 *
 * Measured, the 50 factor exactly, and all three of his axes are real:
 *
 *   **axis** — a family j, 0 to 4, and it means the same thing in both
 *   branches. A whole resolution is the one that moves every line BUT j. A
 *   wall is the one that leaves family j's own gridline standing: the two
 *   surviving triples share exactly j, and their spoke is 90° off v_j, which
 *   is to say it IS that gridline. *"A single wall of singularities which
 *   passes through the decagon."*
 *
 *   **sense** — the ±ε involution, one bit. ε and −ε always differ in it, and
 *   each branch reads it its own way: upper against lower surface for a whole
 *   resolution, thin-then-thick against thick-then-thin along the spoke for a
 *   wall. One knob, two readings — so it must not be spent twice.
 *
 *   **branch** — `whole`, or one of FOUR wall positions, not three. The two
 *   skewbs slide along the spoke as the nudge grows, and where they end up is
 *   a state of the grid, not a way of drawing it:
 *
 *     `S at center`  the thin skewb stays on the decagon's center, 2 lines
 *     `L at center`  the thick skewb stays there, 2 lines
 *     `same side`    both step off, to the same side, 4 lines
 *     `straddling`   both step off, opposite sides, 4 lines
 *
 *   The two centered ones are the minimal nudges — the phason flips — and
 *   they are why the branch is 5-valued and not 3: `top` and `bottom` are
 *   already `sense`.
 *
 * So 5 × 2 × 5 = 50, and the catalog below is that product in order.
 */
export function factor(e) {
    const standing = surviving(e);
    if (!standing.length) {
        const axis = e.findIndex((v) => v === 0);
        return { axis, sense: Math.sign(e[(axis + 1) % 5]), branch: "whole" };
    }
    const triples = standing.map((s) => new Set(s.fams));
    const axis = [...triples[0]].find((j) => triples[1].has(j));
    // The spoke, oriented deterministically: v_axis turned a quarter turn. It
    // is perpendicular to v_axis, measured, so this is the spoke's own line.
    const v = dirs[axis];
    const d = [-v[1], v[0]];
    const at = {};
    for (const s of standing) {
        at[shapeOf(s.fams) === "113" ? "S" : "L"] = s.p[0] * d[0] + s.p[1] * d[1];
    }
    const EPS = 1e-12;
    const branch = Math.abs(at.S) < EPS ? "S at center"
        : Math.abs(at.L) < EPS ? "L at center"
        : at.S * at.L > 0 ? "same side" : "straddling";
    return { axis, sense: at.S < at.L ? 1 : -1, branch };
}

/** The five branches, in the order a control should step through them. */
export const BRANCHES = ["whole", "S at center", "L at center",
                         "same side", "straddling"];

/**
 * All 50 states as (axis, sense, branch) — what the reading control should be
 * indexing instead of a slot in the zonogon's 62.
 */
export function catalog() {
    const out = [];
    for (const e of nudgeVectors(5, true)) out.push({ e, ...factor(e) });
    return out.sort((a, b) =>
        BRANCHES.indexOf(a.branch) - BRANCHES.indexOf(b.branch)
        || a.axis - b.axis || b.sense - a.sense);
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
        + ` ${whole.length} whole, ${all.length - whole.length} walled`);

    console.log(`\n── and they factor: axis x sense x branch`);
    const cat = catalog();
    const seen = new Map();
    for (const c of cat) {
        const k = c.branch;
        if (!seen.has(k)) seen.set(k, new Set());
        seen.get(k).add(`${c.axis}${c.sense > 0 ? "+" : "-"}`);
    }
    for (const b of BRANCHES) {
        const cells = [...seen.get(b)].sort();
        console.log(`   ${b.padEnd(12)} ${String(cells.length).padStart(2)}`
            + `   ${cells.join(" ")}`);
    }
    console.log(`   ${BRANCHES.length} branches x 5 axes x 2 senses = `
        + `${BRANCHES.length * 10}, and the catalog holds ${cat.length}\n`);
}
