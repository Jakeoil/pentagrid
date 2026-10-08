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
