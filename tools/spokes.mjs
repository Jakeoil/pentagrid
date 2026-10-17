#!/usr/bin/env node
/**
 * The spokes: the lines of hexagon singularities through the decagon.
 *
 * Jake, 2026-10-17: *"The spokes are those thin and thick hexagons arranged in
 * a fibinacci (musical) sequence. Their configurations varies intimately with
 * that of the decagon. SLLSLLSLSLLSLSL... They actually pass through the
 * decagon."* And: *"there are not just valid penrose tilings in the decagon
 * paths (10 of those) but a couple of paths where two skewbs (thin and thick)
 * remain. when this happens, one of the spokes continues the musical
 * sequence."*
 *
 * Both halves hold. What this prints:
 *
 *   At Γ = 0 — 390 three-folds and one five-fold in a reach of 26, no
 *   four-folds, which is §5.12's catalog. The three-folds of each triple are
 *   EXACTLY collinear (to 1e-15), one line per triple, and the ten lines fall
 *   into five directions, two triples each: one K113 and one K122 — a thin and
 *   a thick skewb sharing a spoke. Every line passes through the origin, which
 *   is to say through the decagon.
 *
 *   Along one spoke the two triples interleave, and the sequence of WHICH —
 *   thin or thick — is the musical one. Reading thin as S and thick as L it
 *   comes out SLSSLSSLSLSS…, whose complement is LSLLSLLSLSLL…, and Jake's
 *   SLLSLLSLSLLSLSL is that from its second letter. The lengths themselves are
 *   not the sequence: the two periods are incommensurate and their union takes
 *   48 distinct gap values. It is the labels that are Sturmian.
 *
 *   And the decagon is a DEFECT in it. Each triple's own spacing is periodic,
 *   g and 2g, with the double gap exactly at the origin — the slot where that
 *   spoke's hexagon would be, taken by the five-fold instead. The merged word
 *   therefore fails to be Sturmian: its factor complexity runs 2 3 4 5 6 7 8
 *   then 10 12 14 16, departing from n+1 at n = 8, which is the signature of
 *   one defect.
 *
 *   Jiggle to a WALL and it heals. With ε = (0, 0, 0, t, −t) the sum is held
 *   and the couple 012 / 134 stays concurrent — §5.12's rule, γ_L integral and
 *   γ_P + γ_Q integral, which also forces the partner. Those two are the thin
 *   and the thick of the 72° spoke. Each gains one hexagon where the decagon
 *   was, and the word becomes a genuine factor of the Fibonacci word with
 *   complexity exactly n + 1. The spoke continues the musical sequence,
 *   which is what Jake said.
 *
 * Usage: node tools/spokes.mjs [--reach N] [--t 0.013]
 */
import { makeDirections, solveIntersection } from "../dist/geometry/pentagrid.js";

const arg = (name, dflt) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? Number(process.argv[i + 1]) : dflt;
};
const REACH = arg("reach", 40);
const T = arg("t", 0.013);
const PHI = (1 + Math.sqrt(5)) / 2;
const dirs = makeDirections(true);
const key = (x, y) => `${Math.round(x * 1e7)},${Math.round(y * 1e7)}`;

/** A triple's K-code: 113 is the thin skewb, 122 the thick. */
export const shapeOf = (t) => {
    const f = [...t].map(Number).sort((a, b) => a - b);
    return [f[1] - f[0], f[2] - f[1], 5 - (f[2] - f[0])].sort().join("");
};

/** Every concurrency of three or more lines in a patch, by position. */
export function concurrencies(gamma, reach = REACH) {
    const pg = { n: 5, directions: dirs, gamma };
    const at = new Map();
    for (let j = 0; j < 5; j++) for (let k = j + 1; k < 5; k++) {
        for (let nj = -reach; nj <= reach; nj++) for (let nk = -reach; nk <= reach; nk++) {
            const p = solveIntersection(pg, j, k, nj, nk);
            if (!p || Math.hypot(p[0], p[1]) > reach) continue;
            const kk = key(p[0], p[1]);
            let e = at.get(kk);
            if (!e) { e = { p, fams: new Set() }; at.set(kk, e); }
            e.fams.add(j);
            e.fams.add(k);
        }
    }
    return [...at.values()].filter((e) => e.fams.size >= 3);
}

/** The hexagons of each triple, which are collinear: one spoke per triple. */
export function spokes(gamma, reach = REACH) {
    const out = new Map();
    for (const e of concurrencies(gamma, reach)) {
        if (e.fams.size !== 3) continue;
        const t = [...e.fams].sort().join("");
        if (!out.has(t)) out.set(t, []);
        out.get(t).push(e.p);
    }
    return out;
}

/** How far a set of points departs from one line, and which way that line runs. */
export function fitLine(pts) {
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of pts) {
        const dx = x - cx, dy = y - cy;
        sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ux = Math.cos(th), uy = Math.sin(th);
    let off = 0;
    for (const [x, y] of pts) off = Math.max(off, Math.abs(-(x - cx) * uy + (y - cy) * ux));
    return { th, ux, uy, off, deg: (((th * 180) / Math.PI) + 180) % 180 };
}

/**
 * The label word along one spoke: S for the thin triple, L for the thick,
 * in order along the line. The two triples sharing a direction interleave,
 * and that interleaving is the sequence.
 */
export function spokeWord(gamma, pair, reach = REACH) {
    const all = spokes(gamma, reach);
    const pts = [];
    for (const t of pair) {
        const c = shapeOf(t) === "113" ? "S" : "L";
        for (const p of all.get(t) ?? []) pts.push({ p, c });
    }
    if (!pts.length) return "";
    const { ux, uy } = fitLine(pts.map((a) => a.p));
    pts.sort((a, b) => (a.p[0] * ux + a.p[1] * uy) - (b.p[0] * ux + b.p[1] * uy));
    return pts.map((a) => a.c).join("");
}

/** The Fibonacci word, as the reference the measured one is tested against. */
export const fibWord = (n, shift = 0) => [...Array(n)].map((_, k) =>
    Math.floor((k + 1 + shift) / PHI) - Math.floor((k + shift) / PHI) ? "L" : "S").join("");

/** Distinct factors of each length: a Sturmian word has exactly n + 1. */
export function complexity(w, upto = 12) {
    const out = [];
    for (let n = 1; n <= upto; n++) {
        const s = new Set();
        for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n));
        out.push(s.size);
    }
    return out;
}
/** Where the complexity first departs from n + 1, or 0 if it never does. */
export const sturmianUpto = (w, upto = 12) => {
    const c = complexity(w, upto);
    for (let i = 0; i < c.length; i++) if (c[i] !== i + 2) return i + 1;
    return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) {
    const report = (label, gamma) => {
        const sing = concurrencies(gamma, 26);
        const orders = new Map();
        for (const e of sing) orders.set(e.fams.size, (orders.get(e.fams.size) ?? 0) + 1);
        console.log(`\n── ${label} — γ = (${gamma.join(", ")})`);
        console.log(`   reach 26: ${[...orders].sort()
            .map(([k, c]) => `${k}-fold ${c}`).join("   ") || "nothing concurrent"}`);
        const all = spokes(gamma);
        if (!all.size) return;
        const byDir = new Map();
        for (const [t, pts] of all) {
            const d = fitLine(pts).deg.toFixed(2);
            if (!byDir.has(d)) byDir.set(d, []);
            byDir.get(d).push({ t, pts, off: fitLine(pts).off });
        }
        for (const [d, grp] of [...byDir].sort((a, b) => Number(a[0]) - Number(b[0]))) {
            const names = grp.map((g) => `${g.t} K${shapeOf(g.t)} (${g.pts.length})`).join(" + ");
            const off = Math.max(...grp.map((g) => g.off));
            console.log(`   ${String(d).padStart(6)}°  ${names}   off-line ${off.toExponential(0)}`);
        }
        const pair = [...byDir.values()][0].map((g) => g.t);
        const w = spokeWord(gamma, pair);
        const swapped = [...w].map((c) => (c === "S" ? "L" : "S")).join("");
        const bad = sturmianUpto(w);
        console.log(`   word on ${pair.join("/")}: ${w.slice(0, 56)}${w.length > 56 ? "…" : ""}`);
        console.log(`   complexity: ${complexity(w).join(" ")}`);
        console.log(`   Sturmian? ${bad === 0 ? "YES" : `no — breaks at n = ${bad}`}`
            + `   a Fibonacci factor? ${fibWord(2000).includes(swapped)}`);
    };
    report("the exceptional singularity", [0, 0, 0, 0, 0]);
    report("a WALL: the couple 012 / 134 survives", [0, 0, 0, T, -T]);
    report("a CHAMBER: a generic sum-zero jiggle", [0.001, -0.004, 0.002, 0.005, -0.004]);
    console.log("\nJake: SLLSLLSLSLLSLSL");
    const sw = [...spokeWord([0, 0, 0, 0, 0], ["014", "023"])]
        .map((c) => (c === "S" ? "L" : "S")).join("");
    console.log(`ours: ${sw.slice(1, 16)}   ${sw.slice(1, 16) === "SLLSLLSLSLLSLSL" ? "— the same" : ""}`);
}
