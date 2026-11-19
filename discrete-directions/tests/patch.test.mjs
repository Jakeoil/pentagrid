// The substitution, checked by whether the figure it produces actually holds
// together.
//
// There is no stored oracle for a patch -- penrose-mosaic draws these, it does
// not tabulate them -- so the checks here are structural, and they are the ones
// that caught real bugs where congruence tests passed:
//
//   no sample covered twice     a tile placed wrong overlaps its neighbor
//   no interior hole            a tile placed SHORT leaves a gap and overlaps
//                               nothing, so the overlap test alone is blind
//   subset of the generation up Jake's lead: the composites are subsets of a
//                               higher generation, the Sun of Pe5 and the Star
//                               of St5. That is what found the Sun's diamonds.
//
// Area is sampled on a 1/3 grid offset off the lattice so no sample lands on an
// edge. Do not test overlap by centroids: a centroid test missed most of these.

import test from "node:test";
import assert from "node:assert/strict";

import { SEED_TYPES, WALK_OF, expand, isSeedType, outlineOf } from "../src/math/patch.js";
import { closes, turn } from "../src/math/walk.js";
import { PENTA_UP, REAL_PENTA, ladderTo } from "../src/math/wheel.js";

/** Five points with no mirror at all -- the whole reason for no reflections. */
const SKEW = [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]];
/** The quadrille seed with one corner moved. */
const LOPSIDED = [[0, -3], [3, -1], [2, 3], [-2, 3], [-4, -1]];

const PHI = (1 + Math.sqrt(5)) / 2;
const key = (t) => `${t.type}:${t.tenth}:${t.loc[0]},${t.loc[1]}`;
const countTypes = (tiles) => {
    const n = {};
    for (const t of tiles) n[t.type] = (n[t.type] ?? 0) + 1;
    return n;
};

const inPoly = (p, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
};

function doubled(tiles, wheels) {
    const STEP = 1 / 3, OFF = 0.1657;
    const seen = new Map();
    for (const t of tiles) {
        const poly = outlineOf(t, wheels);
        const xs = poly.map((v) => v[0]), ys = poly.map((v) => v[1]);
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += STEP)
            for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += STEP) {
                const s = [x + OFF, y + OFF];
                if (!inPoly(s, poly)) continue;
                const k = `${s[0].toFixed(3)},${s[1].toFixed(3)}`;
                seen.set(k, (seen.get(k) ?? 0) + 1);
            }
    }
    let over = 0, total = 0;
    for (const [, n] of seen) { total++; if (n > 1) over++; }
    return { over, total };
}

/** Cells enclosed by the figure that no tile covers: a gap, not a boundary. */
function interiorHoles(tiles, wheels) {
    const S = 0.25, OFF = 0.1213;
    const polys = tiles.map((t) => outlineOf(t, wheels));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const poly of polys) for (const [x, y] of poly) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    x0 -= 2; x1 += 2; y0 -= 2; y1 += 2;
    const W = Math.round((x1 - x0) / S) + 1, H = Math.round((y1 - y0) / S) + 1;
    const cov = new Uint8Array(W * H);
    for (const poly of polys)
        for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
            if (cov[j * W + i]) continue;
            if (inPoly([x0 + i * S + OFF, y0 + j * S + OFF], poly)) cov[j * W + i] = 1;
        }
    const seen = new Uint8Array(W * H); const stack = [0]; seen[0] = 1;
    while (stack.length) {
        const c = stack.pop(), i = c % W, j = (c - i) / W;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
            const k = nj * W + ni;
            if (seen[k] || cov[k]) continue;
            seen[k] = 1; stack.push(k);
        }
    }
    let hole = 0;
    for (let k = 0; k < W * H; k++) if (!cov[k] && !seen[k]) hole++;
    return hole;
}

// ── what each seed lays ───────────────────────────────────────────────────
test("a Pe5 expands to the Sun's skeleton", () => {
    const ladder = ladderTo(PENTA_UP, 4);
    const tiles = expand("Pe5", 0, [0, 0], 1, ladder);
    // one deflation of a blue pentagon: a Pe5, five Pe3, no diamonds
    assert.deepEqual(countTypes(tiles), { Pe5: 1, Pe3: 5 });
});

test("the Sun patch has 55 rhombs' worth of tiles", () => {
    // 5 (Pe5) + 5x4 (Pe3) + 10x3 (Pe1); the St1 emit none.
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Sun", 0, [0, 0], 1, ladder));
    const rhombs = (n.Pe5 ?? 0) * 5 + (n.Pe3 ?? 0) * 4 + (n.Pe1 ?? 0) * 3;
    assert.equal(rhombs, 55, `got ${JSON.stringify(n)}`);
});

test("the Star patch has 35", () => {
    // 5x3 (Pe1) + 5x4 (Pe3); St5 and St3 emit none.
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Star", 0, [0, 0], 1, ladder));
    const rhombs = (n.Pe5 ?? 0) * 5 + (n.Pe3 ?? 0) * 4 + (n.Pe1 ?? 0) * 3;
    assert.equal(rhombs, 35, `got ${JSON.stringify(n)}`);
});

test("the deca lays its six figures", () => {
    const ladder = ladderTo(PENTA_UP, 4);
    const n = countTypes(expand("Deca", 0, [0, 0], 1, ladder));
    assert.deepEqual(n, { Pe3: 1, St1: 2, Pe1: 2, St3: 1 });
});

test("the composites lay nothing at generation 0", () => {
    // They are figures, not tiles: there is no single shape to fall back to.
    const L = ladderTo(PENTA_UP, 3);
    for (const seed of ["Sun", "Star", "Deca"])
        assert.deepEqual(expand(seed, 0, [0, 0], 0, L), [], `${seed} laid something`);
});

test("a tile seed at generation 0 is itself, once", () => {
    const L = ladderTo(PENTA_UP, 3);
    for (const seed of ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1"])
        for (let t = 0; t < 10; t++)
            assert.deepEqual(expand(seed, t, [3, -4], 0, L),
                [{ type: seed, tenth: t, loc: [3, -4], heads: true }]);
});

test("a name that is not a seed is a caller's mistake", () => {
    const L = ladderTo(PENTA_UP, 3);
    assert.throws(() => expand("Pe9", 0, [0, 0], 1, L), /not a tile type: Pe9/);
    for (const name of SEED_TYPES) assert.ok(isSeedType(name), name);
    for (const name of ["Pe9", "sun", "", "St4"]) assert.ok(!isSeedType(name), name);
});

test("tile counts grow by phi^4 per generation", () => {
    // Each generation is one P1 inflation of linear ratio phi^2, so area and
    // tile count go as phi^4 = 6.854.
    const ladder = ladderTo(PENTA_UP, 7);
    const counts = [1, 2, 3, 4, 5].map((g) => expand("Pe5", 0, [0, 0], g, ladder).length);
    for (let i = 1; i < counts.length; i++) {
        const ratio = counts[i] / counts[i - 1];
        assert.ok(Math.abs(ratio - PHI ** 4) < 0.35,
            `generation ${i + 1}: ratio ${ratio.toFixed(3)} against ${(PHI ** 4).toFixed(3)}`);
    }
});

test("no two tiles land on the same spot with the same angle", () => {
    const ladder = ladderTo(PENTA_UP, 5);
    for (const seed of ["Sun", "Star", "Deca"]) {
        const tiles = expand(seed, 0, [0, 0], 3, ladder);
        const seen = new Set(tiles.map(key));
        assert.equal(seen.size, tiles.length, `${seed} places a tile twice`);
    }
});

test("every placed tile has a walk, and it closes", () => {
    const ladder = ladderTo(PENTA_UP, 5);
    const e = ladderTo(PENTA_UP, 1)[1].e;
    for (const t of expand("Sun", 0, [0, 0], 2, ladder)) {
        const walk = WALK_OF[t.type];
        assert.ok(walk, `no walk for ${t.type}`);
        assert.ok(closes(turn(walk, t.tenth), e), `${t.type} at ${t.tenth} does not close`);
    }
});

// ── does the figure actually fit together? ────────────────────────────────
test("no tile substitution covers a point twice", () => {
    for (const seed of ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1", "Deca"])
        for (const g of [1, 2]) {
            const L = ladderTo(PENTA_UP, g + 2);
            const { over, total } = doubled(expand(seed, 0, [0, 0], g, L), L[1]);
            assert.equal(over, 0, `${seed} gen ${g}: ${over}/${total} samples covered twice`);
        }
});

test("no tile substitution leaves an interior hole", () => {
    // A tile placed short leaves a gap without overlapping anything, so the
    // overlap test alone is not enough.
    for (const seed of ["Pe5", "St5", "St3", "St1"]) {
        const L = ladderTo(PENTA_UP, 3);
        const hole = interiorHoles(expand(seed, 0, [0, 0], 1, L), L[1]);
        assert.equal(hole, 0, `${seed} has ${hole} cells of interior hole`);
    }
});

test("the Sun is a subset of Pe5 one generation up", () => {
    // Jake: the composites are subsets of a higher generation -- the Sun of Pe5,
    // the Star of St5 -- and the Sun "does not follow the rules". This is the
    // test that found its five diamonds: 16 of its 21 tiles were already inside
    // Pe5 and the five that were not were exactly those. They are placed the way
    // Pe5 places them now, and the whole figure sits inside it at every
    // generation. If this ever fails, the composite has drifted from the
    // substitution again.
    const L = ladderTo(PENTA_UP, 7);
    for (const g of [1, 2, 3]) {
        const sun = expand("Sun", 0, [0, 0], g, L);
        const host = new Set(expand("Pe5", 5, [0, 0], g + 1, L).map(key));
        const inside = sun.filter((t) => host.has(key(t))).length;
        assert.equal(inside, sun.length,
            `generation ${g}: ${sun.length - inside} of ${sun.length} outside Pe5`);
    }
});

test("the Sun does not overlap itself", () => {
    // Its five diamonds were on the T wheel, "a ring further out", and stabbed
    // into the yellow pentagons. They belong where Pe5 puts them one generation
    // up -- the far tenth, on the inflated D wheel.
    const L = ladderTo(PENTA_UP, 3);
    const { over } = doubled(expand("Sun", 0, [0, 0], 1, L), L[1]);
    assert.equal(over, 0, `Sun still covers ${over} samples twice`);
});

test("the Star is NOT yet a subset of St5, and is the next one to do", () => {
    // Recorded so fixing it fails this test and says so.
    const L = ladderTo(PENTA_UP, 5);
    const star = expand("Star", 0, [0, 0], 1, L);
    const host = new Set(expand("St5", 0, [0, 0], 2, L).map(key));
    const inside = star.filter((t) => host.has(key(t))).length;
    assert.ok(inside < star.length,
        "the Star now sits inside St5 -- good; move it into the test above");
});

test("the Star patch still overlaps itself — known broken, set aside", () => {
    // Recorded as a test so the day it is fixed, this one fails and says so.
    const L = ladderTo(PENTA_UP, 3);
    const { over } = doubled(expand("Star", 0, [0, 0], 1, L), L[1]);
    assert.ok(over > 0,
        "Star no longer overlaps itself — good; delete this test and move it "
        + "into the one above.");
});

// ── the point of the exercise ─────────────────────────────────────────────
test("five different points give a different, still coherent, tiling", () => {
    // Nothing above may depend on the quadrille seed's mirror symmetry.
    const ladder = ladderTo(LOPSIDED, 4);
    const tiles = expand("Sun", 0, [0, 0], 2, ladder);
    assert.ok(tiles.length > 50, `only ${tiles.length} tiles`);
    const e = ladderTo(LOPSIDED, 1)[1].e;
    for (const t of tiles)
        assert.ok(closes(turn(WALK_OF[t.type], t.tenth), e),
            `${t.type} at ${t.tenth} does not close on the lopsided seed`);
});

test("an asymmetric pentagon still tiles", () => {
    // The whole reason for building this without reflections. This five has no
    // mirror at all; the figure it generates has none either, and still holds
    // together with no overlap and no interior hole.
    for (const g of [1, 2]) {
        const L = ladderTo(SKEW, g + 2);
        const tiles = expand("Pe5", 0, [0, 0], g, L);
        assert.equal(doubled(tiles, L[1]).over, 0, `skew Pe5 gen ${g} overlaps`);
        assert.ok(tiles.length > 5);
    }
    assert.equal(interiorHoles(expand("Pe5", 0, [0, 0], 1, ladderTo(SKEW, 3)),
        ladderTo(SKEW, 3)[1]), 0, "skew Pe5 has an interior hole");
    // and it really is asymmetric: no vertical mirror among the five
    const k = (v) => `${v[0]},${v[1]}`;
    const mirrored = new Set(SKEW.map((v) => k([-v[0], v[1]])));
    assert.ok(!SKEW.every((v) => mirrored.has(k(v))), "that seed is symmetric after all");
});

test("a real patch holds together, same as an integer one", () => {
    for (const g of [1, 2]) {
        const L = ladderTo(REAL_PENTA, g + 2);
        const { over } = doubled(expand("Pe5", 0, [0, 0], g, L), L[1]);
        assert.equal(over, 0, `real Pe5 gen ${g}: ${over} samples covered twice`);
    }
});

// ── heads and tails ───────────────────────────────────────────────────────
//
// An earlier pass dropped `isHeads` on the grounds that it "never reaches a
// tile outline". True of the outline, false of the tile: penrose-mosaic's
// renderers.js uses it for a rhomb's fill gradient and for drawDihedralStroke,
// which decides ridges from valleys. That is the Wieringa fold parity.

test("every placement carries a heads flag", () => {
    const L = ladderTo(PENTA_UP, 5);
    for (const seed of ["Pe5", "St5", "Sun", "Deca"])
        for (const t of expand(seed, 0, [0, 0], 2, L))
            assert.equal(typeof t.heads, "boolean", `${seed} tile without heads`);
});

test("the seed's parity flips the whole patch", () => {
    const L = ladderTo(PENTA_UP, 5);
    const a = expand("Pe5", 0, [0, 0], 2, L, true);
    const b = expand("Pe5", 0, [0, 0], 2, L, false);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
        // same tile, same place, opposite aspect
        assert.equal(a[i].type, b[i].type);
        assert.deepEqual([...a[i].loc], [...b[i].loc]);
        assert.equal(a[i].heads, !b[i].heads, `tile ${i} did not flip`);
    }
});

test("heads does not move or reshape anything", () => {
    // It is an aspect, not a geometry. If this ever fails, something is using
    // it to place a tile, which is not what it means.
    const L = ladderTo(PENTA_UP, 5);
    const ks = (ts) => ts.map(key).join("|");
    assert.equal(ks(expand("Sun", 0, [0, 0], 2, L, true)),
                 ks(expand("Sun", 0, [0, 0], 2, L, false)));
});

test("both parities occur in any patch worth the name", () => {
    const L = ladderTo(PENTA_UP, 5);
    const tiles = expand("Pe5", 0, [0, 0], 3, L);
    assert.ok(tiles.some((t) => t.heads) && tiles.some((t) => !t.heads),
        "a patch with only one parity means the flip is not propagating");
});

// ── the recursion floor, and what big rhombs hang on ──────────────────────
test("a floored expansion covers the same area with phi^4 fewer figures", () => {
    // Big rhombs go where penrose-mosaic short-circuits: the SAME patch stopped
    // one level early. Expanding one generation less instead gives a patch phi^2
    // smaller, which is how the big rhombs ended up huddled in the middle.
    const L = ladderTo(PENTA_UP, 6);
    const spanOf = (ts) => {
        let lo = Infinity, hi = -Infinity;
        for (const t of ts) { lo = Math.min(lo, t.loc[0]); hi = Math.max(hi, t.loc[0]); }
        return hi - lo;
    };
    for (const g of [2, 3, 4]) {
        const leaves = expand("Pe5", 0, [0, 0], g, L);
        const floored = expand("Pe5", 0, [0, 0], g, L, true, 1);
        const smaller = expand("Pe5", 0, [0, 0], g - 1, L);

        // same count as a shorter expansion...
        assert.equal(floored.length, smaller.length, `generation ${g} count`);
        // ...but the area of the full one, not the shorter one
        assert.ok(spanOf(floored) > spanOf(smaller) * 2,
            `generation ${g}: floored span ${spanOf(floored)} against ${spanOf(smaller)}`);
        // Span is measured on tile CENTERS, and a floored figure is a bigger
        // object, so its centers reach less far than the leaves' while its drawn
        // extent does not. 0.6 clears that and still fails hard on the wrong
        // thing, which sits at 0.28.
        assert.ok(spanOf(floored) > spanOf(leaves) * 0.6,
            `generation ${g}: floored ${spanOf(floored)} vs leaves ${spanOf(leaves)}`);
        assert.ok(spanOf(smaller) < spanOf(leaves) * 0.45,
            `generation ${g}: the shorter expansion should be plainly smaller`);
        // and phi^4 fewer figures than the leaves
        const ratio = leaves.length / floored.length;
        assert.ok(Math.abs(ratio - PHI ** 4) < 0.5,
            `generation ${g}: ratio ${ratio} against ${PHI ** 4}`);
    }
});

test("floor 0 is the ordinary expansion", () => {
    const L = ladderTo(PENTA_UP, 5);
    const ks = (ts) => ts.map(key).join("|");
    assert.equal(ks(expand("Sun", 0, [0, 0], 3, L, true, 0)),
                 ks(expand("Sun", 0, [0, 0], 3, L)));
});

test("a floor at or above the seed's generation emits the seed alone", () => {
    const L = ladderTo(PENTA_UP, 5);
    assert.deepEqual(expand("Pe5", 2, [0, 0], 3, L, true, 3),
        [{ type: "Pe5", tenth: 2, loc: [0, 0], heads: true }]);
    assert.deepEqual(expand("Pe5", 2, [0, 0], 3, L, true, 9),
        [{ type: "Pe5", tenth: 2, loc: [0, 0], heads: true }]);
});

// ── turning a placement into points ───────────────────────────────────────
test("outlineOf places a pentagon by its center and a star by P[t]", () => {
    const L = ladderTo(PENTA_UP, 3);
    for (const t of expand("Sun", 0, [0, 0], 2, L)) {
        const poly = outlineOf(t, L[1]);
        assert.equal(poly.length, WALK_OF[t.type].length);
        // a pentagon's vertices are its center plus D at stride 2
        if (t.type.startsWith("Pe"))
            assert.deepEqual([...poly[0]], [t.loc[0] + L[1].d[t.tenth][0],
                                            t.loc[1] + L[1].d[t.tenth][1]]);
        else
            assert.deepEqual([...poly[0]], [t.loc[0] + L[1].p[t.tenth][0],
                                            t.loc[1] + L[1].p[t.tenth][1]]);
    }
});
