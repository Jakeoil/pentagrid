// The growth law, lifted out of the view — LIBRARY.md section 1a.4.
//
// Jake, 2026-11-04: "the grow logic will be very important for wieringa too.
// Do the grow core first." So `world()` and `outlineAt()` came out of
// createGrowthView's closure into geometry/growth.ts as pure functions.
//
// THE GOLDENS WERE CAPTURED BEFORE THE MOVE. The five rows below are the SVG
// of a roof page at five (grow, fold) pairs, recorded off the code as it stood
// on 2026-11-04 and compared after: identical to the last digit, every
// coordinate and every document hash. That is the whole point of writing them
// down -- a refactor of a formula that changes a last bit is not a refactor,
// and nothing else in the suite would have noticed.

import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createGrowthView, projectToScreen } from "../dist/view/growth.js";
import { exportSvg } from "../dist/svg/export.js";
import {
    tileCorner, outlineCorner, crossingLerp, standHeight, registrationGain,
} from "../dist/geometry/growth.js";
import { RISE, vertexIndex } from "../dist/geometry/roof.js";
import { makeDirections, collectRhombs } from "../dist/geometry/pentagrid.js";

// ── the pin: what the page draws ──────────────────────────────────

const host = (id) => {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
};

/** A cheap stable digest of a whole SVG document. */
const digest = (s) => {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
    return h;
};

const GOLDEN = [
    { grow: 0, fold: 0, len: 114327, count: 8370, hash: 1625505876,
      head: [1260.256656, 824.624167, 2.5, 2.5, 1255.256656, 824.624167] },
    { grow: 0.4, fold: 0, len: 785586, count: 47173, hash: 1904691457,
      head: [655.998699, -395.227274, 675.908128, -384.325849, 694.806575, -396.35914] },
    { grow: 0.4, fold: 0.6, len: 839955, count: 50366, hash: -1182330789,
      head: [736.053077, -453.318872, 727.82353, -475.845398, 721.229787, -461.262774] },
    { grow: 1, fold: 0, len: 585045, count: 34301, hash: -128048615,
      head: [679.315417, -395.141411, 729.088992, -367.887849, 776.335109, -397.971078] },
    { grow: 1, fold: 1, len: 710511, count: 41525, hash: -1832549842,
      head: [852.780933, -481.547749, 832.207065, -544.844262, 772.245597, -560.545925] },
];

test("the roof draws what it drew before the law moved out", () => {
    const v = createGrowthView({
        container: host("roof-view"), lift: true, ribbons: "quads",
    });
    v.pentagrid.gamma.setGuard(true);
    // A gamma in general position: uniform gamma is the singular family, and a
    // singular grid's reading depends on the cascade rather than on this law.
    v.pentagrid.gamma.setValues([0.23, -0.41, 0.15, 0.31, -0.28]);

    for (const g of GOLDEN) {
        v.set({ grow: g.grow, fold: g.fold, azimuth: 0.35, elevation: 0.95,
                edgeStyle: "normal", showResolutions: true });
        const svg = exportSvg(v.pentagrid)[0].svg;
        const nums = [...svg.matchAll(/-?\d+\.\d+/g)].map((m) => +m[0]);
        const at = `grow=${g.grow} fold=${g.fold}`;
        assert.equal(svg.length, g.len, `${at}: the document changed size`);
        assert.equal(nums.length, g.count, `${at}: a different number of coordinates`);
        assert.deepEqual(nums.slice(0, 6), g.head, `${at}: the first tile moved`);
        assert.equal(digest(svg), g.hash, `${at}: some coordinate moved`);
    }
});

// ── the law itself ────────────────────────────────────────────────

const PG = (gamma = [0.23, -0.41, 0.15, 0.31, -0.28]) => ({
    n: 5, directions: makeDirections(false, 5), gamma, lambda: 1,
});
const someRhomb = () => {
    const pg = PG();
    const rhombs = collectRhombs(pg, { xMin: -3, yMin: -3, xMax: 3, yMax: 3 });
    // A thick one, so vj and vk are two apart and the corner is not the easy case.
    return { pg, r: rhombs.find((x) => (x.k - x.j + 5) % 5 === 2) ?? rhombs[0] };
};

test("the registration gain is n/2, because Sum v_j v_j^T = (n/2) I", () => {
    assert.equal(registrationGain(5), 2.5);
    assert.equal(registrationGain(7), 3.5);
    // Measured rather than asserted: the identity the gain comes from.
    for (const n of [5, 7]) {
        const dirs = makeDirections(false, n);
        let xx = 0, xy = 0, yy = 0;
        for (const [x, y] of dirs) { xx += x * x; xy += x * y; yy += y * y; }
        assert.ok(Math.abs(xx - n / 2) < 1e-12, `xx is ${xx}, not n/2`);
        assert.ok(Math.abs(yy - n / 2) < 1e-12, `yy is ${yy}, not n/2`);
        assert.ok(Math.abs(xy) < 1e-12, "the off-diagonal must vanish");
    }
});

test("at grow = 0 every point is on its own crossing, scaled by the gain", () => {
    const { pg, r } = someRhomb();
    const gf = { grow: 0, fold: 0 };
    // Every (a, b) collapses to the same point: the tile is a dot.
    for (const [a, b] of [[0, 0], [1, 0], [0.5, 0.5], [1, 1]]) {
        const p = tileCorner(r, pg.directions, a, b, gf);
        assert.ok(Math.abs(p[0] - 2.5 * r.x0) < 1e-12, `x is ${p[0]}, not 2.5 x0`);
        assert.ok(Math.abs(p[1] - 2.5 * r.y0) < 1e-12);
        assert.equal(p[2], 0, "nothing stands before it has grown");
    }
    // And the fold cannot lift it off the plane while it is still a dot --
    // otherwise the roof would rise out of a field of points.
    assert.equal(tileCorner(r, pg.directions, 0, 0, { grow: 0, fold: 1 })[2], 0);
});

test("at grow = 1 the tile is its own rhomb, in its own place", () => {
    const { pg, r } = someRhomb();
    const flat = { grow: 1, fold: 0 };
    for (const [i, [a, b]] of [[0, 0], [1, 0], [1, 1], [0, 1]].entries()) {
        const p = tileCorner(r, pg.directions, a, b, flat);
        const want = r.vertices[i];
        assert.ok(Math.hypot(p[0] - want[0], p[1] - want[1]) < 1e-12,
                  `corner ${i} is at ${p.slice(0, 2)}, not ${want}`);
    }
});

test("the height is fold x grow x RISE x level, and the level is the index", () => {
    const { pg, r } = someRhomb();
    const m = vertexIndex(r.kTuples[0]);
    for (const grow of [0.25, 1]) {
        for (const fold of [0, 0.5, 1]) {
            const gf = { grow, fold };
            const p = tileCorner(r, pg.directions, 0, 0, gf);
            assert.ok(Math.abs(p[2] - fold * grow * RISE * m) < 1e-12);
            // (a, b) rides the level, which is what makes the rhomb a face of
            // the roof rather than a flat lid on it: every edge rises by RISE.
            const q = tileCorner(r, pg.directions, 1, 0, gf);
            assert.ok(Math.abs(q[2] - p[2] - fold * grow * RISE) < 1e-12,
                      "one step of (a, b) is one RISE");
        }
    }
    assert.equal(standHeight({ grow: 1, fold: 1 }, 4), 4 * RISE);
    assert.equal(standHeight({ grow: 1, fold: 0 }, 4), 0);
});

test("a seat moves the base corner and the level, and nothing else", () => {
    const { pg, r } = someRhomb();
    const gf = { grow: 1, fold: 1 };
    const bare = tileCorner(r, pg.directions, 0, 0, gf);
    const seat = { at: [r.vertices[0][0] + 1, r.vertices[0][1] - 2], index: 7 };
    const sat = tileCorner(r, pg.directions, 0, 0, gf, seat);
    assert.ok(Math.abs(sat[0] - (bare[0] + 1)) < 1e-12, "x did not follow the seat");
    assert.ok(Math.abs(sat[1] - (bare[1] - 2)) < 1e-12);
    assert.ok(Math.abs(sat[2] - RISE * 7) < 1e-12,
              "the height must be the SEAT's index, not the rhomb's");
    // The shape is the rhomb's own either way: a seat is a translation.
    const d = (s) => [tileCorner(r, pg.directions, 1, 0, gf, s),
                      tileCorner(r, pg.directions, 0, 0, gf, s)];
    const [a1, a0] = d(null), [b1, b0] = d(seat);
    assert.ok(Math.abs((a1[0] - a0[0]) - (b1[0] - b0[0])) < 1e-12, "the tile was reshaped");
});

test("a 2k-gon corner grows by the same law its tiles do", () => {
    const dirs = makeDirections(false, 5);
    const from = [0.3, -0.7], to = [1.25, 0.5];
    for (const grow of [0, 0.3, 1]) {
        const p = outlineCorner(from, to, [1, 1, 1, 1, 1], dirs, { grow, fold: 1 });
        assert.ok(Math.abs(p[0] - crossingLerp(grow, 2.5, from[0], to[0])) < 1e-12);
        assert.ok(Math.abs(p[1] - crossingLerp(grow, 2.5, from[1], to[1])) < 1e-12);
        assert.ok(Math.abs(p[2] - grow * RISE * 5) < 1e-12, "the level is Sum K");
    }
    // Same law: at grow 0 it is the gained crossing, at 1 it is where it belongs.
    const a = outlineCorner(from, to, [1, 0, 0, 0, 0], dirs, { grow: 0, fold: 1 });
    assert.deepEqual(a.slice(0, 2), [2.5 * from[0], 2.5 * from[1]]);
    const b = outlineCorner(from, to, [1, 0, 0, 0, 0], dirs, { grow: 1, fold: 1 });
    assert.deepEqual(b.slice(0, 2), to);
});

test("the view still exports projectToScreen from where callers found it", () => {
    // It moved into geometry/growth.ts with the law; view/growth.js re-exports
    // it, because containers.test.mjs and any page import it from there.
    assert.equal(typeof projectToScreen, "function");
    const flat = { azimuth: 0, elevation: Math.PI / 2 };
    const p = projectToScreen(flat, [1, 2, 0], { scale: 10, x: 0, y: 0 }, 100, 50);
    assert.ok(Math.abs(p.x - 110) < 1e-9 && Math.abs(p.y - 30) < 1e-9,
              `straight down is the plain mapping, got ${p.x},${p.y}`);
});
