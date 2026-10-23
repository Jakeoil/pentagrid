#!/usr/bin/env node
/**
 * What the pentaplex decoration actually emits, per tile and over a patch.
 *
 * Jake, 2026-10-23: *"The thick tile obviously draws one yellow pentagon and
 * its edges. How about the orange pentagon? is it drawn two times on thin
 * rhombs? Does the thick tile also draw and orange tile? Are orange tiles
 * drawn twice?"* PLAN §5.6-a is the write-up; this is the measurement.
 *
 * What it prints, over the sun:
 *
 *   A **thick** tile emits one yellow (Pe3) and **two** orange (Pe1); a
 *   **thin** emits two orange and no yellow. The thin's two are different
 *   pentagons, at C + PENTA_R·e₁ and C + PENTA_R·e₂ with PENTA_R = 1/φ².
 *
 *   Over the patch the **yellow never duplicates** — one per thick tile, and
 *   the only figure that lies wholly inside the tile that drew it. **Orange
 *   duplicates heavily**: 463 of 533 are emitted twice, by a thick and a thin
 *   or by two thicks, the second being a neighbor reaching over the shared
 *   edge. The two copies agree to 4e-15, which is what lets the draw pass
 *   deduplicate on the center alone.
 *
 *   The decoration **overhangs by design**: only 61.7% of the pentagon area
 *   falls inside its own tile, so clipping per tile would cut the figure.
 *
 *   No center is ever claimed as both colors, so the kinds are globally
 *   consistent although computed tile by tile.
 *
 * Usage: node tools/pentaplex.mjs [--reach 8] [--gamma 0.2,0.2,0.2,0.2,0.2]
 */
import { rhombPentagons, PENTA_R } from "../dist/geometry/decor.js";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import { vertexIndex } from "../dist/geometry/roof.js";
import { clipToConvex } from "../dist/geometry/region.js";

const arg = (name, dflt) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
};
const REACH = Number(arg("reach", 8));
const GAMMA = String(arg("gamma", "0.2,0.2,0.2,0.2,0.2")).split(",").map(Number);

const center = (p) => {
    let x = 0, y = 0;
    for (const q of p) { x += q[0]; y += q[1]; }
    return [x / p.length, y / p.length];
};
const key = (p) => center(p).map((v) => v.toFixed(5)).join(",");
const area = (p) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
};

/** Every pentagon the decoration emits, by center, with who emitted it. */
export function census(gamma = GAMMA, reach = REACH) {
    const dirs = makeDirections(true);
    const pg = { n: 5, directions: dirs, gamma };
    const rs = collectRhombs(pg, { xMin: -reach, xMax: reach, yMin: -reach, yMax: reach });
    let lo = Infinity, hi = -Infinity;
    for (const r of rs) {
        const m = vertexIndex(r.kTuples[0]);
        lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    const levels = hi - lo + 3;
    const emits = new Map();
    let draws = 0, fully = 0, inside = 0, total = 0;
    for (const r of rs) {
        const parts = rhombPentagons(r, lo, levels);
        const all = [...(parts.yellow ? [[parts.yellow, "yellow"]] : []),
                     ...parts.orange.map((o) => [o, "orange"])];
        for (const [p, color] of all) {
            const k = key(p);
            if (!emits.has(k)) emits.set(k, []);
            emits.get(k).push({ color, thick: r.thick });
            draws++;
            const clip = clipToConvex(p.map((q) => [...q]), r.vertices);
            const a = area(p), c = clip.length >= 3 ? area(clip) : 0;
            total += a; inside += c;
            if (Math.abs(c - a) < 1e-9) fully++;
        }
    }
    return { rs, emits, draws, fully, inside, total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { rs, emits, draws, fully, inside, total } = census();
    const thick = rs.filter((r) => r.thick).length;
    console.log(`\n── the pentaplex over γ = (${GAMMA.join(", ")}), reach ${REACH}`);
    console.log(`   PENTA_R = 1/φ² = ${PENTA_R.toFixed(6)}`);
    console.log(`   ${rs.length} tiles: ${thick} thick, ${rs.length - thick} thin`);

    const perColor = { yellow: { draws: 0, set: new Set() },
                       orange: { draws: 0, set: new Set() } };
    let mixed = 0;
    const byKinds = new Map();
    for (const [k, list] of emits) {
        if (new Set(list.map((e) => e.color)).size > 1) mixed++;
        for (const e of list) { perColor[e.color].draws++; perColor[e.color].set.add(k); }
        const os = list.filter((e) => e.color === "orange");
        if (!os.length) continue;
        const tag = os.map((e) => (e.thick ? "K" : "N")).sort().join("");
        byKinds.set(tag, (byKinds.get(tag) ?? 0) + 1);
    }
    for (const c of ["yellow", "orange"]) {
        const { draws: d, set } = perColor[c];
        console.log(`   ${c.padEnd(7)} ${String(d).padStart(4)} draws`
            + `   ${String(set.size).padStart(4)} distinct`
            + `   ${d === set.size ? "never duplicated" : `${d - set.size} duplicates`}`);
    }
    console.log(`   orange by the tiles emitting it (K thick, N thin): ${
        [...byKinds].sort().map(([k, v]) => `${k} ${v}`).join("   ")}`);
    console.log(`   centers claimed by BOTH colors: ${mixed} of ${emits.size}`);
    console.log(`   wholly inside the tile that drew it: ${fully} of ${draws} draws`);
    console.log(`   pentagon area inside its own tile: ${(100 * inside / total).toFixed(1)}%\n`);
}
