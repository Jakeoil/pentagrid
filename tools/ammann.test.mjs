// Ammann bars: the four facts that were measured before they were built, each
// as an assertion. PLAN §7.1 has the reasoning; this has the numbers.
import test from "node:test";
import assert from "node:assert/strict";
import { collectRhombs, makeDirections } from "../dist/geometry/pentagrid.js";
import {
    rhombAmmann, ammannOffset, AMMANN_SHORT, AMMANN_LONG, AMMANN_POINTS,
} from "../dist/geometry/ammann.js";
import { PHI } from "../dist/geometry/decor.js";

const REACH = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };
const dirs = makeDirections(true);
const makePentagrid = (n, gamma) => ({ n, directions: dirs, gamma });

/** A patch, its chords, and where each chord's bar sits. */
function patch(gamma, reach = REACH) {
    const pg = makePentagrid(5, gamma);
    const rhombs = collectRhombs(pg, reach, { gain: 2.5 });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) {
        lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    }
    const chords = [];
    let bare = 0;
    for (const r of rhombs) {
        const cs = rhombAmmann(pg, r, lo);
        if (!cs.length) { bare++; continue; }
        for (const c of cs) chords.push({ ...c, thick: r.thick });
    }
    // family -> sorted bar offsets, and how many chords landed on each
    const bars = new Map();
    for (const c of chords) {
        const at = ammannOffset(pg, c).toFixed(6);
        const fam = bars.get(c.family) ?? new Map();
        fam.set(at, (fam.get(at) ?? 0) + 1);
        bars.set(c.family, fam);
    }
    return { pg, rhombs, lo, chords, bare, bars };
}
const SUN = [0.2, 0.2, 0.2, 0.2, 0.2];
const lines = (bars) => [...bars.values()].reduce((n, m) => n + m.size, 0);
const gapsOf = (bars) => {
    const out = [];
    for (const fam of bars.values()) {
        const pos = [...fam.keys()].map(Number).sort((a, b) => a - b);
        for (let i = 1; i < pos.length; i++) out.push(pos[i] - pos[i - 1]);
    }
    return out;
};

test("every chord is exactly parallel to a gridline family, five to a tile", () => {
    // On the thick rhomb the five chords run at 54, 18, 90, 162 and 126 degrees
    // to its edges, which are the five gridline directions, each used once. So
    // the mosaic's six-point polyline is five bars chained end to end.
    const { pg, chords } = patch(SUN);
    assert.ok(chords.length > 1000, `only ${chords.length} chords`);
    for (const c of chords) {
        const [vx, vy] = pg.directions[c.family];
        const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1];
        const skew = Math.abs((dx * vx + dy * vy) / Math.hypot(dx, dy));
        assert.ok(skew < 1e-12, `a chord ${skew} off its family's normal`);
    }
    // Five a tile, one per family, both prototiles.
    const pgm = makePentagrid(5, SUN);
    const rhombs = collectRhombs(pgm, REACH, { gain: 2.5 });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    let thick = 0, thin = 0;
    for (const r of rhombs) {
        const cs = rhombAmmann(pgm, r, lo);
        if (!cs.length) continue;
        assert.equal(cs.length, 5, "five chords a tile");
        assert.equal(new Set(cs.map((c) => c.family)).size, 5, "one per family");
        if (r.thick) thick++; else thin++;
    }
    assert.ok(thick > 50 && thin > 50, `${thick} thick, ${thin} thin`);

    // Chained: consecutive chords share an endpoint, which is a point on an
    // edge where two bars of different families meet.
    const one = rhombAmmann(pgm, rhombs.find((r) => r.thick && rhombAmmann(pgm, r, lo).length), lo);
    for (let i = 0; i < one.length - 1; i++) {
        assert.ok(Math.hypot(one[i].b[0] - one[i + 1].a[0], one[i].b[1] - one[i + 1].a[1]) < 1e-12,
                  "the chords chain");
    }
});

test("the bars assemble, and only from the index extreme corner", () => {
    // 1665 chords of a sun patch on 68 lines, 24.5 to a line. From the opposite
    // corner: 198 lines at 8.4, which is to say they do not assemble.
    const { chords, bars } = patch(SUN);
    const n = lines(bars);
    assert.ok(n < 100, `${chords.length} chords should land on few lines, got ${n}`);
    assert.ok(chords.length / n > 20,
              `${(chords.length / n).toFixed(1)} chords a line is not an assembly`);
    // Every line carries chords from both prototiles — a bar does not care.
    let mixed = 0;
    const byBar = new Map();
    for (const c of chords) {
        const k = `${c.family}|${Math.round(c.a[0] * 1e6)}`;
        byBar.set(k, (byBar.get(k) ?? new Set()).add(c.thick));
    }
    for (const kinds of byBar.values()) if (kinds.size === 2) mixed++;
    assert.ok(mixed > 0, "a bar should cross both prototiles");
});

test("the gaps are S and L, and nothing else", () => {
    const { bars } = patch(SUN);
    const gaps = gapsOf(bars);
    assert.ok(gaps.length > 50, `only ${gaps.length} gaps`);
    for (const g of gaps) {
        const ok = Math.abs(g - AMMANN_SHORT) < 1e-6 || Math.abs(g - AMMANN_LONG) < 1e-6;
        assert.ok(ok, `a gap of ${g.toFixed(6)}, neither S nor L`);
    }
    assert.ok(gaps.some((g) => Math.abs(g - AMMANN_SHORT) < 1e-6), "some are short");
    assert.ok(gaps.some((g) => Math.abs(g - AMMANN_LONG) < 1e-6), "and some are long");
    // S = root5 / 2, L = phi S. The ratio is the whole point.
    assert.ok(Math.abs(AMMANN_SHORT - Math.sqrt(5) / 2) < 1e-15);
    assert.ok(Math.abs(AMMANN_LONG / AMMANN_SHORT - PHI) < 1e-15);
    // Wider than the rhomb edge, which is the same fact as one chord per
    // family per tile.
    assert.ok(AMMANN_SHORT > 1);
});

test("the LS word is Conway's musical sequence", () => {
    // The Fibonacci word, floor((n+1)/phi) - floor(n/phi), at some shift: the
    // patch is a window onto an infinite word and where it starts is the gamma.
    const { bars } = patch(SUN, { xMin: -9, xMax: 9, yMin: -9, yMax: 9 });
    const fib = (len, shift) => [...Array(len)].map((_, k) =>
        Math.floor((k + 1 + shift) / PHI) - Math.floor((k + shift) / PHI) ? "L" : "S").join("");
    let checked = 0;
    for (const fam of bars.values()) {
        const pos = [...fam.keys()].map(Number).sort((a, b) => a - b);
        const word = pos.slice(1).map((v, i) =>
            Math.abs(v - pos[i] - AMMANN_LONG) < 1e-6 ? "L" : "S").join("");
        if (word.length < 10) continue;
        // A factor of the Fibonacci word: it must appear somewhere in it.
        const long = fib(word.length + 40, 0);
        assert.ok(long.includes(word),
                  `${word} is not a factor of the Fibonacci word`);
        // And never two S in a row, which is the characteristic property.
        assert.ok(!word.includes("SS"), `${word} has SS, so it is not Sturmian`);
        checked++;
    }
    assert.ok(checked >= 4, `only ${checked} families had a long enough word`);
});

test("they work on every LI class, and the singular patch is the exception", () => {
    // The index extreme needs four index levels and every Penrose patch has
    // them, so the orientation is available everywhere.
    for (const [name, gamma] of [
        ["the sun", SUN],
        ["an odd sum 1", [0.37, 0.11, 0.29, 0.08, 0.15]],
        ["sum 2", [0.5, 0.3, 0.4, 0.6, 0.2]],
        ["sum 0", [0.3, -0.1, 0.2, -0.25, -0.15]],
    ]) {
        const { chords, bars, bare } = patch(gamma);
        assert.equal(bare, 0, `${name}: ${bare} tiles carried no bar`);
        const n = lines(bars);
        assert.ok(chords.length / n > 20, `${name}: ${(chords.length / n).toFixed(1)} a line`);
        for (const g of gapsOf(bars)) {
            const ok = Math.abs(g - AMMANN_SHORT) < 1e-6 || Math.abs(g - AMMANN_LONG) < 1e-6;
            assert.ok(ok, `${name}: a gap of ${g.toFixed(6)}`);
        }
    }

    // The singular star superposes tiles, and a superposed tile has no one
    // index to be placed by, so the bars it would have carried are missing and
    // leave gaps of L - S.
    const star = patch([0, 0, 0, 0, 1]);
    assert.ok(star.bare > 50, `the star should leave tiles bare, got ${star.bare}`);
    const broken = gapsOf(star.bars).filter((g) =>
        Math.abs(g - AMMANN_SHORT) > 1e-6 && Math.abs(g - AMMANN_LONG) > 1e-6);
    assert.ok(broken.length > 10, "and the bars should break there");
    for (const g of broken.slice(0, 5)) {
        assert.ok(Math.abs(g - (AMMANN_LONG - AMMANN_SHORT)) < 1e-6,
                  `a broken gap should be L - S, got ${g.toFixed(6)}`);
    }
});

test("the offsets are the mosaic's, read off penrose-screen.js", () => {
    // Not a derivation — a record of where they came from, so a change to the
    // table is deliberate. One of them is 1 - 1/(4phi), which looks like a
    // fudge and is not: the test above shows every chord lands on a gridline
    // direction exactly.
    assert.deepEqual(AMMANN_POINTS.thick.map(([e]) => e),
                     ["fl", "fr", "nr", "nl", "fl", "fr"]);
    assert.deepEqual(AMMANN_POINTS.thin.map(([e]) => e),
                     ["fl", "nl", "fl", "fr", "nr", "fr"]);
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-15, `${a} != ${b}`);
    near(AMMANN_POINTS.thick[0][1], 1 - 1 / (4 * PHI));
    near(AMMANN_POINTS.thick[2][1], PHI / 2);
    near(AMMANN_POINTS.thin[0][1], 1 / (4 * PHI));
    // phi/2 is cos 36, and the two tables are each other's complement at the
    // ends: 1 - 1/(4phi) against 1/(4phi).
    near(PHI / 2, Math.cos(Math.PI / 5));
    near(AMMANN_POINTS.thick[0][1] + AMMANN_POINTS.thin[0][1], 1);
});

// ── The bars as their own object (PLAN §7.4) ─────────────────────────

import { ammannBars, ammannFit, ammannChain, AMMANN_WINDOW } from "../dist/geometry/ammann.js";

/** A patch's bars, by family, as sorted position lists. */
function barsOf(gamma, reach = 16) {
    const pg = makePentagrid(5, gamma);
    const rhombs = collectRhombs(pg, { xMin: -reach, xMax: reach, yMin: -reach, yMax: reach },
                                 { gain: 2.5 });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) {
        lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    }
    const all = ammannBars(pg, rhombs, lo);
    const fams = new Map();
    for (const b of all) {
        if (!fams.has(b.family)) fams.set(b.family, []);
        fams.get(b.family).push(b.at);
    }
    return { all, fams };
}

test("a bar is an object with provenance, the way a rhomb has one", () => {
    // A chord knows its family; it did not know WHICH bar of that family it
    // belonged to, where a rhomb has carried its (j, nj) all along.
    const { all, fams } = barsOf(SUN);
    assert.equal(fams.size, 5, "five families");
    assert.ok(all.length > 100, `only ${all.length} bars`);
    for (const [, pos] of fams) {
        // Ascending, distinct, and indexed from the lowest in view.
        for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1]);
    }
    for (const [family, pos] of fams) {
        const mine = all.filter((b) => b.family === family);
        assert.deepEqual(mine.map((b) => b.index), mine.map((_, i) => i));
        assert.equal(mine.length, pos.length);
    }
    // Every chord of the patch lands on one of them — that is what assembly is.
    const pg = makePentagrid(5, SUN);
    const rhombs = collectRhombs(pg, { xMin: -16, xMax: 16, yMin: -16, yMax: 16 }, { gain: 2.5 });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) lo = Math.min(lo, K.reduce((a, b) => a + b, 0));
    const seats = new Set(all.map((b) => `${b.family}|${b.at.toFixed(9)}`));
    let chords = 0;
    for (const r of rhombs) for (const c of rhombAmmann(pg, r, lo)) {
        chords++;
        assert.ok(seats.has(`${c.family}|${ammannOffset(pg, c).toFixed(9)}`),
                  "a chord with no bar to sit on");
    }
    assert.ok(chords > all.length * 10, `${chords} chords over ${all.length} bars`);
});

test("a family is a Fibonacci chain of window exactly phi, and the cut round-trips", () => {
    // PLAN §7.4: one module c + S·(ℤ + φℤ) for all five families, and a family
    // is the members whose conjugate lies in an interval of width φ. Fit the cut
    // off the assembled bars, generate the family back from it, and the two sets
    // must agree exactly — which is the characterization, and the generator a
    // grid of bars needs.
    assert.ok(Math.abs(AMMANN_WINDOW - PHI) < 1e-15, "the window is phi");
    for (const [name, gamma] of [
        ["the sun", SUN],
        ["an odd sum 1", [0.37, 0.11, 0.29, 0.08, 0.15]],
        ["sum 0", [0.3, -0.1, 0.2, -0.25, -0.15]],
    ]) {
        const { fams } = barsOf(gamma);
        for (const [j, pos] of fams) {
            const cut = ammannFit(pos);
            assert.equal(cut.outside, 0, `${name} j${j}: ${cut.outside} bars off the module`);
            assert.equal(cut.fitted, pos.length);
            assert.ok(cut.chain, `${name} j${j}: not a chain of window phi`);
            assert.ok(cut.wHi - cut.wLo < 0.1,
                      `${name} j${j}: the bracket should be tight, got ${cut.wHi - cut.wLo}`);
            // Generate over the interior, clear of the rim where the patch ends
            // mid-chain, and ask for the same bars back.
            const from = pos[2], to = pos[pos.length - 3];
            const want = pos.filter((p) => p >= from - 1e-9 && p <= to + 1e-9);
            const got = ammannChain(cut.c, (cut.wLo + cut.wHi) / 2, from, to);
            assert.equal(got.length, want.length,
                         `${name} j${j}: generated ${got.length} for ${want.length}`);
            got.forEach((p, i) => assert.ok(Math.abs(p - want[i]) < 1e-7,
                                            `${name} j${j}: bar ${i} off by ${p - want[i]}`));
        }
    }
});

test("the window is phi only on Penrose — off it the bars overflow it", () => {
    // The matching rule in a number, and it needs no reference to gamma. On a
    // Penrose patch the conjugates of a family sit inside a window of width phi
    // with room to spare, so the bracket on where that window starts is open.
    // Off Penrose the bars the broken figure adds have nowhere in the window to
    // sit: the span saturates phi and the bracket shuts, and no chain of width
    // phi can reproduce the family.
    const slack = (pos) => {
        const cut = ammannFit(pos);
        return { cut, bracket: cut.wHi - cut.wLo };
    };
    for (const [, pos] of barsOf(SUN).fams) {
        const { bracket } = slack(pos);
        assert.ok(bracket > 0.03, `on Penrose the bracket should be open, got ${bracket}`);
    }
    for (const [j, pos] of barsOf([0.2, 0.2, 0.2, 0.2, 0.3]).fams) {   // sum 1.1
        const { cut, bracket } = slack(pos);
        assert.ok(bracket <= 1e-6,
                  `j${j} off Penrose: the bracket should be shut, got ${bracket}`);
        // And the generator cannot give the family back, whatever w is tried.
        const from = pos[2], to = pos[pos.length - 3];
        const want = pos.filter((p) => p >= from - 1e-9 && p <= to + 1e-9);
        let best = 0;
        for (let t = 0; t <= 20; t++) {
            const w = cut.wLo + (cut.wHi - cut.wLo) * (t / 20);
            const got = ammannChain(cut.c, w, from, to);
            const hit = got.filter((p) => want.some((q) => Math.abs(p - q) < 1e-7)).length;
            best = Math.max(best, hit - (got.length - hit));
        }
        assert.ok(best < want.length,
                  `j${j} off Penrose: a chain of window phi reproduced the family`);
    }
});

test("the two gaps fall in the ratio phi, which is phi bars to a gridline", () => {
    // The Fibonacci word has L and S in the ratio phi, so the average gap is
    // S(2+phi)/phi^2 = 1.545085 — and the gridlines of a family sit 5/2 apart
    // in tiling coordinates, so there are 2.5/1.545085 = phi bars to a line.
    const { fams } = barsOf(SUN, 20);
    for (const [j, pos] of fams) {
        let short = 0, long = 0, total = 0;
        for (let i = 1; i < pos.length; i++) {
            const g = pos[i] - pos[i - 1];
            total += g;
            if (Math.abs(g - AMMANN_LONG) < 1e-6) long++; else short++;
        }
        assert.ok(Math.abs(long / short - PHI) < 0.2,
                  `j${j}: ${long} long to ${short} short is ${(long / short).toFixed(3)}`);
        const mean = total / (pos.length - 1);
        const want = AMMANN_SHORT * (2 + PHI) / (PHI * PHI);
        assert.ok(Math.abs(mean - want) < 0.03, `j${j}: mean gap ${mean} against ${want}`);
        assert.ok(Math.abs(2.5 / want - PHI) < 1e-9, "phi bars to a gridline");
    }
});
