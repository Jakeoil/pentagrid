// Circular cut lines — PLAN §11.16.
//
// From Figure 6 of the starfish / ivy-leaf / hexagon paper, fourth panel. The
// claim the whole feature rests on is that the circles are the TILING's and not
// the edge's: every selected edge is a unit chord of two decagon circles, one
// each side, centered at the decagon centers. These are the measurements that
// say so, and they are exact rather than approximate — which is why the drawing
// needs no joint arithmetic at all.
import test from "node:test";
import assert from "node:assert/strict";
import { makeDirections, collectRhombs } from "../dist/geometry/pentagrid.js";
import { vertexIndex } from "../dist/geometry/roof.js";
import {
    buildCuts, cutRadius, outlineChords, CUT_SECTOR,
    CUT_APOTHEM, CUT_RMAX, CUT_WIDTH_MIN, CUT_WIDTH_MAX,
} from "../dist/geometry/cuts.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/** A Penrose patch, and the 2-3 chords the outline fold would select. */
function patch(pair = [2, 3], half = 9) {
    const model = {
        n: 5, directions: makeDirections(true),
        gamma: [0.0817, 0.3391, -0.2234, 0.1109, -0.3083],
    };
    const rhombs = collectRhombs(model, { xMin: -half, xMax: half, yMin: -half, yMax: half });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) lo = Math.min(lo, vertexIndex(K));
    const keep = (K) => pair.includes(vertexIndex(K) - lo + 1);
    return { rhombs, raw: outlineChords(rhombs, keep) };
}

test("the decagon fixes everything but the radius", () => {
    // The unit-edge decagon: a chord of length 1 on a circle of circumradius φ.
    assert.ok(near(CUT_RMAX, PHI));
    assert.ok(near(CUT_APOTHEM, Math.sqrt(PHI * PHI - 0.25)),
              "the apothem is not sqrt(phi^2 - 1/4)");
    assert.ok(near(CUT_APOTHEM, 1.538842, 1e-6));
    // A chord subtends exactly 36 degrees at its own center, so ten tile the
    // circle -- which is what makes two edges at 144 degrees ONE arc rather
    // than two that happen to meet.
    assert.ok(near(CUT_SECTOR, Math.PI / 5));
    assert.ok(near(CUT_SECTOR * 180 / Math.PI, 36));
    assert.ok(near(2 * Math.asin(0.5 / PHI), CUT_SECTOR),
              "a unit chord does not subtend 36 degrees at distance phi");
    // And the center is exactly phi from both ends of its chord.
    assert.ok(near(Math.hypot(CUT_APOTHEM, 0.5), PHI));
});

test("the width is signed through the pinch, and the radius follows", () => {
    // Jake, 2026-11-28: "if the R is the inscribed circle it is tangent to its
    // other circle... circumscribed circle. This is the maximum size R."
    assert.ok(near(cutRadius(0), CUT_APOTHEM), "0 is not the tangent point");
    assert.ok(near(cutRadius(CUT_WIDTH_MAX), CUT_RMAX),
              "the top of the range is not the circumscribed circle");
    assert.ok(near(CUT_WIDTH_MAX, 2 * (PHI - CUT_APOTHEM)));
    assert.ok(near(CUT_WIDTH_MAX, 0.158384, 1e-6));
    // Negative is the concave band: the two circles of one edge are 2a apart,
    // so they are disjoint below the apothem and overlap above it. The sign
    // change is the same number from both directions.
    assert.ok(cutRadius(-0.12) < CUT_APOTHEM);
    assert.ok(near(2 * (CUT_APOTHEM - cutRadius(-0.12)), 0.12),
              "a width of -0.12 does not give a band 0.12 wide");
    assert.ok(cutRadius(+0.1) > CUT_APOTHEM);
    // Clamped at both ends, and never negative.
    assert.ok(near(cutRadius(99), CUT_RMAX), "the radius ran past phi");
    assert.equal(cutRadius(CUT_WIDTH_MIN - 5), 0);
    assert.ok(near(CUT_WIDTH_MIN, -2 * CUT_APOTHEM));
});

test("the chords are deduplicated and the centers are shared", () => {
    // The rhomb loop reaches a shared edge from both of its rhombs. Harmless
    // for a stroke and fatal for a fill, and fatal twice over for the span
    // bookkeeping, which would claim the same sector again.
    const { raw } = patch();
    const cuts = buildCuts(raw, -0.12);
    assert.equal(raw.length, 1180, "the patch moved");
    assert.equal(cuts.chords.length, 623, "the chords were not deduplicated");
    assert.ok(near(cuts.r, CUT_APOTHEM - 0.06));

    // Two circles per chord, 1246 in all if nothing were shared. 334 says
    // almost every one is shared, which is the figure's long smooth arcs.
    assert.equal(cuts.circles.length, 334, "the center count moved");
    assert.ok(cuts.circles.length < cuts.chords.length,
              "there are more centers than chords, so nothing is being shared");
});

test("a center is identified by distance, not by a rounded key", () => {
    // Eight pairs of computed centers came out 0.0000 apart under a 1e-5
    // string key and were counted as two circles, because the rounding fell
    // between them. A circle split in two is a seam down the middle of an arc
    // that is supposed to be continuous.
    const a = { a: [0, 0], b: [1, 0] };
    const b = { a: [1 + 1e-12, 1e-12], b: [1 + Math.cos(Math.PI / 5), Math.sin(Math.PI / 5)] };
    const cuts = buildCuts([a, b], -0.12);
    assert.equal(cuts.chords.length, 2, "the two chords were merged");
    // Two edges meeting at 144°: three circles, not four, because one is
    // shared — and that shared one is what makes their arcs one arc.
    assert.equal(cuts.circles.length, 3,
                 `${cuts.circles.length} centers for two edges at 144 degrees`);
    const [p, q] = cuts.bands;
    const shared = [p.left, p.right].find(
        (x) => [q.left, q.right].some((y) => y.ci === x.ci));
    assert.ok(shared, "the two bands share no circle");
    const mate = [q.left, q.right].find((y) => y.ci === shared.ci);
    // Contiguous: one arc ends where the other begins, to the last place.
    const meet = Math.min(
        Math.abs(shared.a1 - mate.a0), Math.abs(shared.a0 - mate.a1),
        Math.abs(shared.a1 - mate.a1), Math.abs(shared.a0 - mate.a0));
    assert.ok(meet < 1e-9,
              `the shared arcs do not meet: closest ends are ${meet} apart`);
});

test("a chord claims a 36 degree sector, and ten of them close a circle", () => {
    // 43 of the 334 centers carry all ten -- the decagon in Jake's second
    // picture. The rest are partial, where no decagon is there but the
    // curvature still is: "the center of the circle/decagon's point is not
    // defined here, but is obviously the same curvature."
    const cuts = buildCuts(patch().raw, -0.12);
    const per = new Map();
    for (const b of cuts.bands) {
        for (const arc of [b.left, b.right]) per.set(arc.ci, (per.get(arc.ci) ?? 0) + 1);
    }
    assert.equal(per.size, cuts.circles.length, "a circle carries no chord");
    const ten = [...per.values()].filter((n) => n === 10).length;
    assert.equal(ten, 43, `${ten} full decagons, not 43`);
    for (const n of per.values()) {
        assert.ok(n >= 1 && n <= 10, `a circle carries ${n} chords, which is not 1..10`);
    }
    // An arc runs a sector where its neighbor shares the circle, and PAST one
    // where it does not: at a 72 degree joint the two bands overlap, so the
    // boundary of what you see carries on to where the neighbor's circle cuts
    // in. Measured, the longest is a little over 40 degrees. What it may never
    // do is run away round the circle.
    let longest = 0;
    for (const b of cuts.bands) {
        for (const arc of [b.left, b.right]) {
            longest = Math.max(longest, Math.abs(arc.a1 - arc.a0));
        }
    }
    assert.ok(longest > CUT_SECTOR,
              "no arc passes its sector, so nothing is meeting its neighbor");
    assert.ok(longest < 2 * CUT_SECTOR,
              `an arc spans ${(longest * 180 / Math.PI).toFixed(1)} degrees`);
});

test("past the apothem the band is a lens, with tips where its own circles cross", () => {
    // The positive regime is its own case: the two circles of one edge overlap
    // and the band is the overlap, strictly inside its own edge, so no
    // neighbor trims it. The tips are at ±sqrt(R² − a²) from the middle --
    // exactly ±0.5, the vertices, at R = phi, which is what makes the
    // circumscribed circle the maximum.
    for (const [w, want] of [[0.05, 0.279], [0.1, 0.395], [CUT_WIDTH_MAX, 0.5]]) {
        const r = cutRadius(w);
        const half = Math.sqrt(r * r - CUT_APOTHEM * CUT_APOTHEM);
        assert.ok(near(half, want, 1e-3), `tips at ${half}, not ${want}`);
        assert.ok(half <= 0.5 + 1e-9, "the lens is longer than its own edge");
    }
    // Drawn, the arcs then span the lens rather than the whole chord.
    const cuts = buildCuts(patch([2, 3], 5).raw, 0.1);
    const r = cuts.r;
    const span = 2 * Math.sqrt(r * r - CUT_APOTHEM * CUT_APOTHEM);
    for (const b of cuts.bands.slice(0, 40)) {
        for (const arc of [b.left, b.right]) {
            const c = cuts.circles[arc.ci];
            const p0 = [c[0] + r * Math.cos(arc.a0), c[1] + r * Math.sin(arc.a0)];
            const p1 = [c[0] + r * Math.cos(arc.a1), c[1] + r * Math.sin(arc.a1)];
            assert.ok(near(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), span, 1e-9),
                      "a lens arc does not span tip to tip");
        }
    }
});

test("off the Penrose class it still works, which is the point of generalizing", () => {
    // Jake: "This is a general edge treatment, but we are only using this
    // target 2,3 at the moment." A class other than 0 has a fifth index level,
    // and the chords there are still unit chords of the same circles.
    const model = {
        n: 5, directions: makeDirections(true),
        gamma: [0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.5],   // class 1/2
    };
    const rhombs = collectRhombs(model, { xMin: -7, xMax: 7, yMin: -7, yMax: 7 });
    let lo = Infinity;
    for (const r of rhombs) for (const K of r.kTuples) lo = Math.min(lo, vertexIndex(K));
    const raw = outlineChords(rhombs, (K) => [2, 3].includes(vertexIndex(K) - lo + 1));
    const cuts = buildCuts(raw, -0.12);
    assert.ok(cuts.chords.length > 100, "no chords off the Penrose class");
    for (const c of cuts.chords) {
        assert.ok(near(Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), 1),
                  "a chord off the class is not a unit edge");
    }
});

// ── and through the view, which is where it has to actually draw ──────

import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";

const host = (id) => {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null, getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
};

test("the layer draws cut lines instead of heavy ones, and exports them", () => {
    const h = createPentagrid({ container: host("cut-c"), panel: host("cut-p") });
    h.setTileStyle({ outline2: true, outline3: true });
    h.redraw();
    const layerOf = (svg) => {
        const at = svg.indexOf('id="penrose-outlines"');
        return at < 0 ? "" : svg.slice(at, svg.indexOf("</g>", at));
    };
    const lines = layerOf(h.svg()[0].svg);
    assert.ok(lines.length > 0, "the outline layer did not draw at all");
    assert.ok(!/A[\d.-]/.test(lines), "the line style drew arcs");

    h.setTileStyle({ outlineCut: true, cutWidth: -0.12 });
    h.redraw();
    const body = layerOf(h.svg()[0].svg);
    assert.ok(/A[\d.-]/.test(body), "the cut style drew no arcs");
    assert.ok(body.includes("#3f7d5f"), "no green fill");
    assert.ok(body.includes('stroke-width="1.4"'), "the arcs are not stroked at 1.4");
    // Two passes, and no clipping: the first version clipped to the complement
    // of every disk, which is wrong -- the centers are dense enough that
    // foreign circles run through the band. A band is bounded by its OWN two
    // circles. PLAN §11.16.
    assert.ok(!/clip-path="url/.test(body), "the cut layer is clipped again");
});

test("with no index switched on the cut style draws nothing", () => {
    // The same silence the line style keeps. All six switches off is the
    // visibility test for the layer, but the draw must be safe anyway.
    const h = createPentagrid({ container: host("cut-q"), panel: host("cut-qp") });
    h.setTileStyle({ outlineCut: true });
    h.redraw();
    const svg = h.svg()[0].svg;
    const at = svg.indexOf('id="penrose-outlines"');
    const body = at < 0 ? "" : svg.slice(at, svg.indexOf("</g>", at));
    assert.ok(!body.includes("#3f7d5f"), "green with nothing switched on");
});

test("the fold carries the switch and the width, and they travel in a link", () => {
    const panel = host("cut-panel");
    const h = createPentagrid({ container: host("cut-s"), panel });
    const labels = [];
    const walk = (el) => {
        for (const c of el.children ?? []) {
            if (String(c.className).includes("cut-name")) labels.push(c.textContent);
            walk(c);
        }
    };
    walk(panel);
    assert.deepEqual(labels, ["circular cut"], "the outlines fold has no cut line");

    h.markBaseline();
    h.setTileStyle({ outline2: true, outline3: true, outlineCut: true, cutWidth: -0.2 });
    const url = h.link();
    assert.ok(url.includes("outline-cut"), `the style is not in the link: ${url}`);
    assert.ok(url.includes("cut-width=-0.2"), `the width is not in the link: ${url}`);
});
