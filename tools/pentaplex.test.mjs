// What the pentaplex emits, pinned — PLAN section 5.6-a.
//
// Jake, 2026-10-23: "The thick tile obviously draws one yellow pentagon and
// its edges. How about the orange pentagon? is it drawn two times on thin
// rhombs? Does the thick tile also draw and orange tile? Are orange tiles
// drawn twice?"
import test from "node:test";
import assert from "node:assert/strict";
import { census } from "./pentaplex.mjs";
import { rhombPentagons, PENTA_R } from "../dist/geometry/decor.js";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import { vertexIndex } from "../dist/geometry/roof.js";

test("a thick tile emits one yellow and two orange; a thin emits two orange", () => {
    const dirs = makeDirections(true);
    const pg = { n: 5, directions: dirs, gamma: [0.2, 0.2, 0.2, 0.2, 0.2] };
    const rs = collectRhombs(pg, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 });
    let lo = Infinity, hi = -Infinity;
    for (const r of rs) {
        const m = vertexIndex(r.kTuples[0]);
        lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    const levels = hi - lo + 3;
    let thick = 0, thin = 0;
    for (const r of rs) {
        const p = rhombPentagons(r, lo, levels);
        if (r.thick) {
            thick++;
            assert.ok(p.yellow, "a thick tile with no yellow");
            assert.equal(p.orange.length, 2, "a thick tile should emit two orange");
        } else {
            thin++;
            assert.equal(p.yellow, null, "a thin tile emitted a yellow");
            assert.equal(p.orange.length, 2, "a thin tile should emit two orange");
            // The two are DIFFERENT pentagons, on the two edges at that corner,
            // not one drawn twice. PENTA_R = 1/phi^2.
            const c = p.orange.map((q) => {
                let x = 0, y = 0;
                for (const v of q) { x += v[0]; y += v[1]; }
                return [x / q.length, y / q.length];
            });
            const apart = Math.hypot(c[0][0] - c[1][0], c[0][1] - c[1][1]);
            assert.ok(apart > 0.1, `the thin's two oranges are ${apart} apart`);
        }
    }
    assert.ok(thick > 100 && thin > 100, `${thick} thick, ${thin} thin`);
    assert.ok(Math.abs(PENTA_R - 1 / ((1 + Math.sqrt(5)) / 2) ** 2) < 1e-12);
});

test("yellow never duplicates; orange does, and the copies coincide exactly", () => {
    const { emits, draws } = census();
    const per = { yellow: { draws: 0, set: new Set() },
                  orange: { draws: 0, set: new Set() } };
    let mixed = 0;
    for (const [k, list] of emits) {
        if (new Set(list.map((e) => e.color)).size > 1) mixed++;
        for (const e of list) { per[e.color].draws++; per[e.color].set.add(k); }
    }
    // One yellow per thick tile, and no two tiles ever claim the same one.
    assert.equal(per.yellow.draws, per.yellow.set.size,
                 "a yellow pentagon was drawn twice");
    // Orange is shared: a neighbor reaches over the edge for it. This is why
    // the draw pass deduplicates on the center alone, and why it must.
    assert.ok(per.orange.draws > per.orange.set.size * 1.5,
              `orange ${per.orange.draws} draws for ${per.orange.set.size} pentagons: `
              + "the sharing is gone");
    // And the kinds never conflict, though they are computed tile by tile.
    assert.equal(mixed, 0, `${mixed} centers carry two different colors`);
    assert.equal(draws, per.yellow.draws + per.orange.draws);
});

test("the pentaplex overhangs its tile, and only the yellow does not", () => {
    // Which is the premise of Jake's question: "the pentaplex decorations
    // extend beyond the tile." Measured, 61.7% of the pentagon area is inside
    // the tile that drew it, and the only figures wholly inside are the
    // yellows — one per thick tile.
    const { emits, draws, fully, inside, total } = census();
    let yellows = 0;
    for (const list of emits.values()) {
        yellows += list.filter((e) => e.color === "yellow").length;
    }
    assert.equal(fully, yellows,
                 `${fully} draws lie wholly inside their tile but there are ${yellows} yellows`);
    assert.ok(fully < draws / 3, `${fully} of ${draws} draws are contained`);
    const frac = inside / total;
    assert.ok(frac > 0.5 && frac < 0.7,
              `${(100 * frac).toFixed(1)}% of the area is inside its own tile`);
});

// ── the taxonomy of PLAN section 5.6-a, axes A and B ──────────────────────
import { rhombDeflation, rhombKitesDarts, rhombArcs, extremeCorner,
         dressingReadings, ARC_T } from "../dist/geometry/decor.js";
import { clipToConvex } from "../dist/geometry/region.js";

const patch = (gamma, n = 5) => {
    const dirs = makeDirections(true, n);
    const pg = { n, directions: dirs, gamma };
    const rs = collectRhombs(pg, { xMin: -8, xMax: 8, yMin: -8, yMax: 8 });
    let lo = Infinity, hi = -Infinity;
    for (const r of rs) {
        const m = vertexIndex(r.kTuples[0]);
        lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    return { pg, rs, lo, levels: hi - lo + 3 };
};
const polyArea = (p) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
};

test("axis A: next-gen and kites are inlay; only the pentaplex is overlay", () => {
    // Jake: "The kites and next-gen types can be generated with two styles
    // also." They can, and the measurement says which one they are now --
    // both already confined, so the offer is symmetric and real.
    const { rs, lo, levels } = patch([0.2, 0.2, 0.2, 0.2, 0.2]);
    const confined = (polysOf) => {
        let n = 0, fully = 0;
        for (const r of rs) {
            for (const p of polysOf(r)) {
                if (p.length < 3) continue;
                const c = clipToConvex(p.map((q) => [...q]), r.vertices);
                const a = polyArea(p), cc = c.length >= 3 ? polyArea(c) : 0;
                n++;
                if (Math.abs(cc - a) < 1e-9) fully++;
            }
        }
        return { n, fully };
    };
    const next = confined((r) => {
        const d = rhombDeflation(r, lo, levels);
        return [...d.gold, ...d.gray];
    });
    assert.equal(next.fully, next.n, `next-gen: ${next.fully} of ${next.n} confined`);
    const kd = confined((r) => {
        const d = rhombKitesDarts(r, lo, levels);
        return [...d.kites, ...d.darts];
    });
    assert.equal(kd.fully, kd.n, `kites: ${kd.fully} of ${kd.n} confined`);
    const pen = confined((r) => {
        const p = rhombPentagons(r, lo, levels);
        return [...(p.yellow ? [p.yellow] : []), ...p.orange];
    });
    assert.ok(pen.fully < pen.n / 3, `pentaplex: ${pen.fully} of ${pen.n} confined`);
});

test("axis A: arcs are edge-pinned — every endpoint on an edge, and they bow out of the thin", () => {
    // Jake: "arcs is also of this non-inlay type (classified as edge
    // decoration, but I'm not sure)." Pinned is the right word: the endpoints
    // are exactly on the edge, at ARC_T from the tail, which is what makes the
    // curves join -- and they are NOT confined, leaving the thin tile where its
    // 36 degree corner is too narrow for the radius 1 - ARC_T arc.
    const { pg, rs } = patch([0.2, 0.2, 0.2, 0.2, 0.2]);
    const inTile = (p, V) => {
        let area = 0;
        for (let i = 0; i < 4; i++) {
            const a = V[i], b = V[(i + 1) % 4];
            area += a[0] * b[1] - b[0] * a[1];
        }
        const sg = area >= 0 ? 1 : -1;
        for (let i = 0; i < 4; i++) {
            const a = V[i], b = V[(i + 1) % 4];
            const ex = b[0] - a[0], ey = b[1] - a[1];
            const d = sg * ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / Math.hypot(ex, ey);
            if (d > 1e-9) return false;
        }
        return true;
    };
    const onAnEdge = (p, V) => {
        for (let k = 0; k < 4; k++) {
            const u = V[k], w = V[(k + 1) % 4];
            const ex = w[0] - u[0], ey = w[1] - u[1], L = Math.hypot(ex, ey);
            const s = ((p[0] - u[0]) * ex + (p[1] - u[1]) * ey) / (L * L);
            const off = Math.abs((p[0] - u[0]) * ey - (p[1] - u[1]) * ex) / L;
            if (s > -1e-9 && s < 1 + 1e-9 && off < 1e-9) return true;
        }
        return false;
    };
    let ends = 0, pinned = 0;
    const out = { thick: 0, thin: 0 }, pts = { thick: 0, thin: 0 };
    for (const r of rs) {
        const kind = r.thick ? "thick" : "thin";
        for (const a of rhombArcs(pg, r)) {
            let d = a.a2 - a.a1;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            for (let i = 0; i <= 20; i++) {
                const t = a.a1 + d * (i / 20);
                const p = [a.x + a.r * Math.cos(t), a.y + a.r * Math.sin(t)];
                pts[kind]++;
                if (!inTile(p, r.vertices)) out[kind]++;
                if (i === 0 || i === 20) {
                    ends++;
                    if (onAnEdge(p, r.vertices)) pinned++;
                }
            }
        }
    }
    assert.equal(pinned, ends, `only ${pinned} of ${ends} arc endpoints sit on an edge`);
    assert.equal(out.thick, 0, `${out.thick} arc points left a THICK tile`);
    assert.ok(out.thin > 0, "the arcs no longer bow out of the thin tile");
    assert.ok(Math.abs(ARC_T - 1 / ((1 + Math.sqrt(5)) / 2) ** 2) < 1e-12);
});

test("axis B: the arrow is the extreme corner, and only Penrose arrows every tile", () => {
    // Jake: "Some decorations only work with penrose arrow rhombuses, but some,
    // like kowalewski, bands, and any wieringa work with any LI (barring
    // singular exceptions)." The mechanism: extremeCorner exists only when the
    // tile's four levels touch an END of the patch's index range, and sum gamma
    // in Z gives exactly four levels -- so every tile has one.
    const count = (gamma, n = 5) => {
        const { pg, rs, lo, levels } = patch(gamma, n);
        let arrowed = 0, ambiguous = 0, arcs = 0;
        for (const r of rs) {
            if (extremeCorner(r, lo, levels) !== null) arrowed++;
            else if (dressingReadings(r, lo, levels).length) ambiguous++;
            if (rhombArcs(pg, r).length === 2) arcs++;      // no index needed
        }
        return { levels, tiles: rs.length, arrowed, ambiguous, arcs };
    };
    for (const g of [[0.2, 0.2, 0.2, 0.2, 0.2], [0.4, 0.4, 0.4, 0.4, 0.4],
                     [0.11, 0.23, 0.31, 0.17, 0.18]]) {
        const c = count(g);
        assert.equal(c.levels, 4, `Penrose should span four levels, got ${c.levels}`);
        assert.equal(c.arrowed, c.tiles,
                     `${c.arrowed} of ${c.tiles} arrowed on a Penrose patch`);
        assert.equal(c.ambiguous, 0);
        assert.equal(c.arcs, c.tiles, "arcs need no arrow");
    }
    // Off Penrose: five levels, and most tiles have no end to point at.
    for (const g of [[0.11, 0.23, 0.31, 0.17, 0.40], [0.1, 0.1, 0.1, 0.1, 0.1]]) {
        const c = count(g);
        assert.equal(c.levels, 5, `off Penrose should span five levels, got ${c.levels}`);
        assert.ok(c.arrowed < c.tiles / 2,
                  `${c.arrowed} of ${c.tiles} arrowed off Penrose — too many`);
        assert.ok(c.ambiguous > 0, "nothing ambiguous off Penrose");
        assert.equal(c.arcs, c.tiles, "arcs should still reach every tile");
    }
    // And at n = 7 there is no arrow marking to speak of, but arcs still work.
    const h = count([0.13, 0.17, 0.19, 0.23, 0.29, 0.31, 0.37], 7);
    assert.ok(h.arrowed < h.tiles / 4, `${h.arrowed} of ${h.tiles} arrowed on a heptagrid`);
    assert.equal(h.arcs, h.tiles, "arcs should reach every tile at n = 7");
});

test("the whole patch is ten rhomb shapes, which is what <defs>/<use> exports", () => {
    // PLAN 5.99's happy medium. A rhomb of pair (j,k) is v0 + {0, vj, vj+vk, vk},
    // so every tile of a pair is a TRANSLATE of every other -- ten shapes for
    // any patch, one per family pair, and the SVG export can define ten paths
    // and place a <use> per tile. The XObject analogue, and PDF's answer to the
    // same question.
    const { rs } = patch([0.2, 0.2, 0.2, 0.2, 0.2]);
    const shapes = new Map();
    for (const r of rs) {
        const key = `${r.j},${r.k}`;
        const rel = r.vertices.map(([x, y]) =>
            [x - r.vertices[0][0], y - r.vertices[0][1]]);
        if (!shapes.has(key)) shapes.set(key, []);
        const seen = shapes.get(key);
        const dup = seen.some((s) => s.every((p, i) =>
            Math.hypot(p[0] - rel[i][0], p[1] - rel[i][1]) < 1e-9));
        if (!dup) seen.push(rel);
    }
    assert.equal(shapes.size, 10, `${shapes.size} family pairs, not C(5,2) = 10`);
    for (const [pair, set] of shapes) {
        assert.equal(set.length, 1,
                     `pair ${pair} has ${set.length} shapes: the tiles of a pair `
                     + "are no longer translates of each other");
    }
    assert.ok(rs.length > 400, `only ${rs.length} tiles, so the saving is untested`);
});

test("extent is W/scale: pixel size and scale are separate knobs", () => {
    // PLAN 5.99, measured. Doubling W at fixed scale is MORE TILES at the same
    // tile size; doubling scale at fixed W is FEWER, BIGGER tiles; doubling
    // both is the same patch with every coordinate doubled, which for a vector
    // file renders identically. The save dialog's two numbers rest on this.
    const dirs = makeDirections(true);
    const pg = { n: 5, directions: dirs, gamma: [0.2, 0.2, 0.2, 0.2, 0.2] };
    // The visible rect a canvas of W pixels at `scale` sees, as the view computes it.
    const seen = (W, scale) => {
        const half = (W / 2) / scale;
        return collectRhombs(pg, { xMin: -half, xMax: half, yMin: -half, yMax: half })
            .length;
    };
    const base = seen(800, 40);
    assert.ok(base > 200, `only ${base} tiles at the base size`);

    // W doubled, scale held: a bigger patch.
    assert.ok(seen(1600, 40) > base * 2,
              `${seen(1600, 40)} against ${base}: W is not setting the extent`);
    // scale doubled, W held: a smaller patch.
    assert.ok(seen(800, 80) < base / 2,
              `${seen(800, 80)} against ${base}: scale is not setting the extent`);
    // Both doubled: the SAME patch, which is the no-op for a vector file.
    assert.equal(seen(1600, 80), base,
                 "W and scale together should leave the content alone");
    assert.equal(seen(3200, 160), base, "and at any factor");
});
