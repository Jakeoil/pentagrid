#!/usr/bin/env node
/**
 * Are the innie/outie penta regions rhomb groups?
 *
 * Jake, looking at the bends: "Those shapes could be divided into penrose
 * rhombs. I can almost see the rhomb groups. Both innie and outie. Is it
 * trivial? Outie has a wonderful number of decagons."
 *
 * This answers it by measurement rather than by eye. For each bent pentagon of
 * a patch it reports:
 *
 *   directions  the ten boundary legs, and whether they lie in the host's own
 *               rhomb-edge star
 *   balance     per direction, the legs minus the legs of its opposite. A
 *               rhombic tiling needs zero everywhere: each de Bruijn ribbon
 *               enters the region through one boundary leg of its direction and
 *               leaves through another, traversed the other way, so the signed
 *               count per direction has to cancel. This is what rules out
 *               bend 36 outright.
 *   bill        the only rhomb count the area permits. a·sin36 + b·sin72 =
 *               n·sin36 + 5·sin72 means a + bφ = n + 5φ, and φ is irrational,
 *               so a = n and b = 5: FIVE thick and one thin per outward bend,
 *               or no tiling at all.
 *   tiling      an actual one, by ear-clipping, which settles existence
 *   lattice     whether the group's own vertices are vertices of the host's
 *               own deflations, generations 1 to 4 — the question of whether
 *               these groups are a sub-tiling of a real generation or a
 *               rhombic figure that merely shares its edge and its star
 *
 * Usage: node tools/rhombgroups.mjs [--gamma a,b,c,d,e] [--reach N]
 */
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";
import { rhombPentagons, dressingReadings, PENTA_R, PHI } from "../dist/geometry/decor.js";

const arg = (name, dflt) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : dflt;
};
const GAMMA = arg("gamma", "0.2,0.2,0.2,0.2,0.2").split(",").map(Number);
const REACH = Number(arg("reach", 8));
const EPS = 1e-7;
const DEG = 180 / Math.PI;
const THIN = Math.sin(Math.PI / 5), THICK = Math.sin(2 * Math.PI / 5);

// ── the patch, and every penta pentagon on it ────────────────────────

const host = makeStub({
    children: [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
    getAttribute: () => null,
});
const h = createPentagrid({ container: host, features: { penroseTiles: false } });
h.gamma.setLocked(-1);
h.gamma.setValues(GAMMA);
const model = h.gamma.model;
const rect = { xMin: -REACH, xMax: REACH, yMin: -REACH, yMax: REACH };
const rhombs = collectRhombs(model, rect, { gain: 2.5 });
let lo = Infinity;
for (const r of rhombs) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
const LEVELS = 4;
const ckey = (x, y) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;

const pents = new Map();
for (const r of rhombs) for (const { extAt } of dressingReadings(r, lo, LEVELS)) {
    const parts = rhombPentagons(r, lo, LEVELS, extAt);
    const add = (pts, kind) => {
        let x = 0, y = 0;
        for (const p of pts) { x += p[0]; y += p[1]; }
        pents.set(ckey(x / 5, y / 5), { pts, kind, C: [x / 5, y / 5] });
    };
    for (const o of parts.orange) add(o, "Pe1");
    if (parts.yellow) add(parts.yellow, "Pe3");
}
const kindAt = new Map([...pents].map(([k, v]) => [k, v.kind]));

/**
 * One bent pentagon, as the renderer draws it: corner, apex, corner, ... The
 * apex sits over the middle of each chord at tan(ang) of the half chord, out or
 * in as the innie/outie cycle says. Returns the ten vertices and which of the
 * five edges bowed outward.
 */
function bend(p, shape, ang, scale) {
    const { pts, kind, C } = p;
    const pushesInto = kind === "Pe3" ? "blue" : "Pe3";
    const poly = [];
    let nOut = 0;
    for (let i = 0; i < 5; i++) {
        const a = pts[i], b = pts[(i + 1) % 5];
        const M = [a[0] + b[0] - C[0], a[1] + b[1] - C[1]];
        const across = kindAt.get(ckey(M[0], M[1])) ?? "blue";
        const outward = (across === pushesInto) === (shape === "innie");
        if (outward) nOut++;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey);
        const nx = -ey / len, ny = ex / len;
        const away = nx * (mx - C[0]) + ny * (my - C[1]) >= 0 ? 1 : -1;
        const rise = (len / 2) * Math.tan(ang) * (outward ? away : -away);
        poly.push([(a[0] - C[0]) * scale, (a[1] - C[1]) * scale],
                  [(mx + nx * rise - C[0]) * scale, (my + ny * rise - C[1]) * scale]);
    }
    return { poly, nOut };
}

// ── the two invariants, read off the boundary ────────────────────────

function legs(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const deg = ((Math.atan2(dy, dx) * DEG) + 720) % 360;
        out.push({ len: Math.hypot(dx, dy), deg: deg > 359.999 ? 0 : deg });
    }
    return out;
}
/** Per direction, legs minus the legs of its opposite. Zero everywhere or no tiling. */
function imbalance(poly) {
    const by = new Map();
    for (const l of legs(poly)) {
        const k = l.deg.toFixed(3);
        by.set(k, (by.get(k) ?? 0) + 1);
    }
    let worst = 0;
    for (const [k, v] of by) {
        const opp = ((parseFloat(k) + 180) % 360).toFixed(3);
        worst = Math.max(worst, Math.abs(v - (by.get(opp) ?? 0)));
    }
    return worst;
}
const areaOf = (poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const u = poly[i], v = poly[(i + 1) % poly.length];
        a += u[0] * v[1] - v[0] * u[1];
    }
    return Math.abs(a) / 2;
};

// ── an actual tiling, by ear-clipping ────────────────────────────────
//
// At a convex corner the rhomb spanned by the two legs has angles t and 180-t,
// a Penrose one when t is 36/144 (thin) or 72/108 (thick). Cut it off — the
// corner moves to u + w - v — and insist the area dropped by exactly that
// rhomb, which is what proves the ear lay inside. The remainder must stay a
// simple polygon: a crossed equilateral quadrilateral has four equal sides and
// a shoelace area and would otherwise pass. A cut can pinch the region into two
// loops, and then both are tiled.

const area2 = (poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const u = poly[i], v = poly[(i + 1) % poly.length];
        a += u[0] * v[1] - v[0] * u[1];
    }
    return a;
};
function prune(poly) {
    const out = [];
    for (const p of poly) {
        const last = out[out.length - 1];
        if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < EPS) continue;
        out.push(p);
    }
    while (out.length > 1
           && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < EPS)
        out.pop();
    return out;
}
const vkey = (p) => `${Math.round(p[0] / EPS)},${Math.round(p[1] / EPS)}`;
function pinch(poly) {
    const at = new Map();
    for (let i = 0; i < poly.length; i++) {
        const k = vkey(poly[i]);
        if (at.has(k)) {
            const j = at.get(k);
            return [poly.slice(j, i), poly.slice(i).concat(poly.slice(0, j))];
        }
        at.set(k, i);
    }
    return null;
}
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function simple(poly) {
    const n = poly.length;
    const hits = (a, b, c, d) => {
        const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
        return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS))
            && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
    };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (hits(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
    return true;
}
const memo = new Map();
/** The smallest cyclic reading, and the vertex it was read from. */
function shapeKey(poly) {
    let best = null, at = 0;
    for (let r = 0; r < poly.length; r++) {
        const o = poly[r];
        let k = "";
        for (let i = 0; i < poly.length; i++) {
            const p = poly[(r + i) % poly.length];
            k += `${Math.round((p[0] - o[0]) / EPS)},${Math.round((p[1] - o[1]) / EPS)};`;
        }
        if (best === null || k < best) { best = k; at = r; }
    }
    return { key: best, o: poly[at] };
}
const shift = (rs, dx, dy) => rs.map((r) => r.map((p) => [p[0] + dx, p[1] + dy]));
export function tileIt(poly, acc) {
    poly = prune(poly);
    if (poly.length < 4) return Math.abs(area2(poly)) < EPS;
    // Memoized on the shape read from its own origin, so a sub-polygon reached
    // by a different order of cuts is not solved twice.
    const { key, o } = shapeKey(poly);
    const had = memo.get(key);
    if (had !== undefined) {
        if (had) acc.push(...shift(had, o[0], o[1]));
        return !!had;
    }
    const mine = [];
    const ok = solve(poly, mine);
    memo.set(key, ok ? shift(mine, -o[0], -o[1]) : false);
    if (ok) acc.push(...mine);
    return ok;
}
function solve(poly, acc) {
    const parts = pinch(poly);
    if (parts) {
        // A repeated vertex splits the region only if the two loops account for
        // all of it; it can also be a crossing, where they overlap.
        if (Math.abs(parts.reduce((t, q) => t + Math.abs(area2(q)), 0) - Math.abs(area2(poly))) > 1e-6)
            return false;
        const mark = acc.length;
        if (parts.every((q) => tileIt(q, acc))) return true;
        acc.length = mark;
        return false;
    }
    if (!simple(poly)) return false;
    const A = Math.abs(area2(poly));
    const n = poly.length;
    if (n === 4) {
        const e = [0, 1, 2, 3].map((i) => Math.hypot(
            poly[(i + 1) % 4][0] - poly[i][0], poly[(i + 1) % 4][1] - poly[i][1]));
        if (!e.every((v) => Math.abs(v - e[0]) < EPS)) return false;
        acc.push(poly);
        return true;
    }
    const ccw = area2(poly) > 0;
    for (let i = 0; i < n; i++) {
        const u = poly[(i + n - 1) % n], v = poly[i], w = poly[(i + 1) % n];
        const a = [u[0] - v[0], u[1] - v[1]], b = [w[0] - v[0], w[1] - v[1]];
        const la = Math.hypot(...a), lb = Math.hypot(...b);
        if (Math.abs(la - lb) > EPS) continue;
        const crs = a[0] * b[1] - a[1] * b[0];
        if ((ccw ? -crs : crs) <= EPS) continue;            // reflex: no ear here
        const t = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb)))) * DEG;
        if (![36, 72, 108, 144].some((want) => Math.abs(t - want) < 0.5)) continue;
        const rest = poly.slice();
        rest[i] = [u[0] + w[0] - v[0], u[1] + w[1] - v[1]];
        // area2 is twice the area; the ear's own is |crs|, so twice it here.
        if (Math.abs(A - Math.abs(area2(prune(rest))) - 2 * Math.abs(crs)) > 1e-6) continue;
        const mark = acc.length;
        acc.push([v, u, rest[i], w]);
        if (tileIt(rest, acc)) return true;                 // the first one is enough
        acc.length = mark;
    }
    return false;
}
/** Thick or thin, by the rhomb's acute angle. */
function bill(rs) {
    let thin = 0, thick = 0;
    for (const r of rs) {
        const a = [r[1][0] - r[0][0], r[1][1] - r[0][1]];
        const b = [r[3][0] - r[0][0], r[3][1] - r[0][1]];
        const t = Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))) * DEG;
        if (Math.abs(Math.min(t, 180 - t) - 36) < 1) thin++; else thick++;
    }
    return { thin, thick };
}

// ── the host's own frames: its edge directions, and generation 3 ─────

const hostDirs = new Set();
for (const r of rhombs) for (let i = 0; i < 4; i++) {
    const a = r.vertices[i], b = r.vertices[(i + 1) % 4];
    hostDirs.add((((Math.atan2(b[1] - a[1], b[0] - a[0]) * DEG) + 720) % 180).toFixed(2));
}

/**
 * The patch `gens` deflations down, in the host's own units.
 *
 * Deflation is a grid in its own right — γ″ⱼ = −(γⱼ₊₂ + γⱼ₊₃) at 1/φ — so the
 * generation is collected as a pentagrid over a rect φ times as wide and then
 * scaled back, which is what nextPentas() does for one step.
 */
function generation(gens) {
    const n = model.n;
    let g = model.gamma.slice();
    for (let k = 0; k < gens; k++)
        g = g.map((_, j) => -(g[(j + 2) % n] + g[(j + 3) % n]));
    const s = PHI ** gens;
    const sub = collectRhombs(
        { n, directions: model.directions, gamma: g, edges: model.edges },
        { xMin: rect.xMin * s, xMax: rect.xMax * s, yMin: rect.yMin * s, yMax: rect.yMax * s },
        { gain: 2.5 },
    );
    const verts = new Set();
    for (const r of sub) for (const [x, y] of r.vertices) verts.add(ckey(x / s, y / s));
    return { rhombs: sub.length, verts };
}

// ── the report ───────────────────────────────────────────────────────

const side = 2 * PENTA_R * Math.sin(Math.PI / 5);
console.log(`gamma ${GAMMA.join(",")}  sum ${GAMMA.reduce((a, b) => a + b, 0).toFixed(3)}`
            + `   ${rhombs.length} tiles, ${pents.size} pentagons`);
console.log(`host rhomb edge directions: ${[...hostDirs].sort((a, b) => a - b).join(", ")} (mod 180)`);
console.log(`pentagon side ${side.toFixed(6)}  =  2 cos18 / phi^3`);

// Generations 1 to 4, to see which if any the groups' own vertices sit on.
// Every vertex of a tiling is a vertex of its deflation, so these nest.
const gens = [1, 2, 3, 4].map((k) => ({ k, ...generation(k) }));
for (const g of gens)
    console.log(`generation ${g.k}: ${g.rhombs} tiles, ${g.verts.size} vertices,`
                + ` edge ${(1 / PHI ** g.k).toFixed(6)}`);

for (const [name, ang] of [["bend 18", Math.PI / 10], ["bend 36", Math.PI / 5]]) {
    // Scaled so the leg is 1 — the edge of the rhombs the pieces would be made
    // of — which for bend 18 is 1/phi^3 of the host edge and for bend 36 1/phi.
    const leg = (side / 2) / Math.cos(ang);
    console.log(`\n== ${name}: leg ${leg.toFixed(6)} = `
                + `${(leg * PHI ** 3).toFixed(4)} x phi^-3 of the host edge`);
    for (const shape of ["innie", "outie"]) {
        const dirs = new Set(), imb = new Set(), rows = new Map();
        let offBill = 0;
        // Corners and apexes counted apart: the pentagon's corners are points
        // along the host's edges and may well be on a generation, while the
        // apexes are the bend's own invention.
        const onGen = gens.map(() => ({ corner: 0, apex: 0 }));
        let corners = 0, apexes = 0;
        for (const p of pents.values()) {
            const { poly, nOut } = bend(p, shape, ang, 1 / leg);
            for (const l of legs(poly)) dirs.add(l.deg.toFixed(2));
            imb.add(imbalance(poly));
            const n = (areaOf(poly) - 5 * THICK) / THIN;
            if (Math.abs(n - nOut) > 1e-6) offBill++;
            const acc = [];
            const ok = tileIt(poly, acc);
            const b = ok ? bill(acc) : null;
            const row = rows.get(nOut) ?? { n: 0, tiled: 0, bills: new Set() };
            row.n++;
            if (ok) { row.tiled++; row.bills.add(`${b.thick}T+${b.thin}t`); }
            rows.set(nOut, row);
            // Are the group's own vertices vertices of a generation?
            const back = bend(p, shape, ang, 1).poly;
            for (let i = 0; i < back.length; i++) {
                const k = ckey(back[i][0] + p.C[0], back[i][1] + p.C[1]);
                if (i % 2 === 0) corners++; else apexes++;
                gens.forEach((g, gi) => {
                    if (!g.verts.has(k)) return;
                    if (i % 2 === 0) onGen[gi].corner++; else onGen[gi].apex++;
                });
            }
        }
        const starless = [...dirs].map(Number).sort((a, b) => a - b);
        const on36 = starless.every((d) => Math.abs(d / 36 - Math.round(d / 36)) < 1e-6);
        console.log(`   ${shape}: directions ${starless.length}`
                    + `  (${on36 ? "multiples of 36" : "odd multiples of 18"})`
                    + `   imbalance ${[...imb].join("/")} (0 or no tiling)`
                    + `   area off the bill ${offBill}`);
        for (const [k, v] of [...rows].sort((a, b) => a[0] - b[0]))
            console.log(`      ${k} out: ${v.n} shapes, ${v.tiled} tiled, `
                        + `${[...v.bills].join(" ") || "none"}`);
        console.log("      on a generation's vertices: "
                    + gens.map((g, gi) => `gen${g.k} ${onGen[gi].corner}/${corners} corners,`
                                        + ` ${onGen[gi].apex}/${apexes} apexes`).join("   "));
    }
}

console.log("\nThe short of it. bend 18: every leg is 1/phi^3 of the host edge and parallel"
            + "\nto its rhomb edges, every direction appears once with its opposite, and the"
            + "\narea admits exactly one bill — five thick and a thin per outward bend — which"
            + "\near-clipping then builds. bend 36: the legs lie along the rhomb DIAGONALS, each"
            + "\ndirection twice with the same sign, and no rhombic tiling exists at any scale."
            + "\nThe open part is registration: the groups are rhombs of the generation-3 edge"
            + "\nin the generation-3 star, but their corners are on no generation's vertices.");
