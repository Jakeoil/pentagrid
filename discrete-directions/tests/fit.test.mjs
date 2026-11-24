// The input figure's framing, and the runaway it used to have.
//
// Jake, 2026-11-19: *moving a point toward the edge causes extremely quick
// zoomout.* This file is that bug, written down. The old rule and the new one
// differ in one word -- whether the scale is recomputed or held -- and the test
// is the same simulated drag against both.
//
// The simulation is the real loop, which is what makes it worth having:
//
//     the pointer sits at a fixed place on the canvas
//     pick() turns it into lattice coordinates by dividing by a scale
//     the figure's reach is that coordinate
//     the next frame's drawing scale is computed from the reach
//
// Four lines, no canvas, and the whole bug lives in them. Which scale pick()
// divides by is the entire question: the live one closes the loop, the one
// frozen at the start of the drag opens it.
//
// A first fix only damped step four to 1% a frame. The second test here caught
// that it still ran away -- `reach · scale` is identically the pointer offset,
// so the figure is past the edge for ever and the scale decays without bottom.
// Slowing a runaway is not stopping one.

import test from "node:test";
import assert from "node:assert/strict";

import { EDGE_SHRINK, fitStep } from "../src/ui/fit.js";

const MARGIN = 136;             // 0.40 x a 340px canvas
const CAP = 78;                 // CELL * 3

/**
 * Hold the pointer at `offset` pixels from the center and drag for n frames.
 *
 * `frozen` is the fix: false means `pick()` divides by the scale just drawn,
 * which is what the page used to do; true means it divides by the scale from
 * the start of the drag, which is what it does now.
 */
const drag = (offset, frames, rule, frozen) => {
    let scale = fitStep(3, 0, MARGIN, CAP);
    const mapping = scale;
    const seen = [];
    for (let i = 0; i < frames; i++) {
        const reach = offset / (frozen ? mapping : scale);   // what pick() reads
        scale = rule(reach, scale);
        seen.push(reach);
    }
    return seen;
};

const OLD = (reach) => Math.min(MARGIN / reach, CAP);
const NEW = (reach, held) => fitStep(reach, held, MARGIN, CAP);

test("the old rule runs away: the figure shoots off under a held pointer", () => {
    // Beyond the margin, reach' = offset * reach / margin -- geometric. The
    // pointer is not even moving here, which is what made it feel so violent.
    const seen = drag(200, 40, OLD, false);
    const ratio = seen.at(-1) / seen.at(-2);
    assert.ok(ratio > 1.4, `each frame should multiply the reach, got x${ratio}`);
    assert.ok(seen.at(-1) > 1e6, `40 frames should be absurd, got ${seen.at(-1)}`);
});

test("damping alone does NOT fix it, it only slows it down", () => {
    // Recorded because it was the first fix, and it looked right. The reach
    // still grows without bound -- a pointer held still would keep zooming out
    // for as long as you left it there, at 1% a frame instead of 47%.
    const seen = drag(200, 400, NEW, false);
    assert.ok(seen.at(-1) > seen[0] * 10, "it should still be running away");
    const ratio = seen.at(-1) / seen.at(-2);
    assert.ok(ratio > 1.005 && ratio < 1.02, `slowly, but still going: x${ratio}`);
});

test("freezing the mapping for the drag is what actually stops it", () => {
    const seen = drag(200, 400, NEW, true);
    // It settles, and it settles where the pointer actually is: reach x scale
    // comes to rest at the margin, so the dragged corner sits on the edge.
    const last = seen.at(-1);
    assert.ok(Number.isFinite(last), `should stay finite, got ${last}`);
    const settled = seen.slice(-20);
    const spread = Math.max(...settled) / Math.min(...settled);
    assert.equal(spread, 1, `should be perfectly still, moving by x${spread}`);
    // and the point is exactly where the frozen mapping put it: no drift at all
    assert.ok(Math.abs(last - 200 / fitStep(3, 0, MARGIN, CAP)) < 1e-9);
});

test("and it gives way slowly: one percent a frame, not all at once", () => {
    // "when reaching edge zoom out much more slowly". A frame may shrink the
    // scale by EDGE_SHRINK and no more, however far past the edge the figure is.
    let scale = 40;
    const reach = 1e6;                   // absurdly far out
    for (let i = 0; i < 50; i++) {
        const next = fitStep(reach, scale, MARGIN, CAP);
        assert.ok(next >= scale * EDGE_SHRINK - 1e-12,
            `frame ${i} shrank by more than one step`);
        assert.ok(next < scale, `frame ${i} did not shrink at all`);
        scale = next;
    }
    // fifty frames is about a 40% reduction, not a collapse
    assert.ok(scale > 40 * 0.5, `fifty frames took it to ${scale}`);
});

test("a figure that fits is left exactly alone", () => {
    // The stability the drag depends on: no change at all until the edge.
    for (const reach of [1, 3, 6.8]) {
        const held = 20;
        assert.equal(fitStep(reach, held, MARGIN, CAP), held, `reach ${reach}`);
    }
});

test("a held scale of zero asks for an exact fit", () => {
    // What a preset, `use` and a rung step want: frame the figure afresh.
    assert.equal(fitStep(136, 0, MARGIN, CAP), 1);
    assert.equal(fitStep(1000, 0, MARGIN, CAP), MARGIN / 1000);
    // and the cap keeps a tiny figure from being blown up to fill the frame
    assert.equal(fitStep(0.5, 0, MARGIN, CAP), CAP);
    assert.equal(fitStep(1e-12, 0, MARGIN, CAP), CAP);
});

test("it never shrinks past the exact fit", () => {
    // Otherwise a drag inward would keep shrinking after the figure had already
    // come back inside the frame.
    const exact = MARGIN / 200;
    let scale = exact * 1.5;
    for (let i = 0; i < 500; i++) scale = fitStep(200, scale, MARGIN, CAP);
    assert.ok(Math.abs(scale - exact) < 1e-9, `settled at ${scale}, not ${exact}`);
});

// ── the cell: smooth now, and the ladder it used to climb ────────────────
//
// Jake, 2026-11-23: *I was wrong about grid size of pentadiculum following
// fibonacci numbers. At least for manual sizing. I want to be able to size it
// smoothly.* So the Pentadiculum draws at `fit * zoom` and the ladder below is
// exported, tested and uncalled. Both are kept under test: the first test here
// is the guarantee the PAGE now relies on, and the rest are the ladder's own.
//
// Jake, 2026-11-22: *although I want fib values for grid-size, make sure
// grid-size keeps up with display. I saw (didn't see rather) points outside the
// canvas.* The ladder stopped at 1 pixel, and the extrapolated pentagon wants
// less than that: at rung +6 the classic seed reaches 1091 lattice units, so a
// 340px canvas needs 0.29 px/unit and got 1. Three times too large, and the
// figure was off the sheet with nothing on screen to say why.

import { FIB_CELLS, fibCell } from "../src/ui/fit.js";
import { PENTA_UP, PRESETS, wheelsAt } from "../lib/wheels.js";
import { pentagon } from "../lib/tiles.js";

test("the cell is never larger than the fit it was rounded from", () => {
    // The whole guarantee. Rounding to nearest, or flooring the ladder, breaks
    // it -- and a cell larger than the fit is a figure off the canvas.
    for (let e = -4; e <= 4; e += 0.0625) {
        const k = 10 ** e;
        assert.ok(fibCell(k) <= k, `fibCell(${k}) = ${fibCell(k)} > ${k}`);
        assert.ok(fibCell(k) > 0, `fibCell(${k}) is not positive`);
    }
});

test("and it is the largest cell on the ladder that fits", () => {
    for (const f of FIB_CELLS) {
        assert.equal(fibCell(f), f, `${f} should be its own cell`);
        // just under a rung takes the rung below
        const below = FIB_CELLS.filter((g) => g < f).at(-1);
        if (below !== undefined) assert.equal(fibCell(f * 0.999), below);
    }
    // consecutive cells are Fibonacci: each is the sum of the two before it
    const whole = FIB_CELLS.filter((f) => f >= 1);
    for (let i = 2; i < whole.length; i++)
        assert.equal(whole[i], whole[i - 1] + whole[i - 2], `at ${whole[i]}`);
});

test("every rung stays on the canvas at the smooth cell the page uses", () => {
    // The bug as the page met it, against the cell the page now draws at. The
    // claim is stronger than it was: with no ladder to round through, the
    // figure is inside the MARGIN -- 40% of a 340px canvas -- and not merely
    // inside the half-canvas it was allowed to reach before. Any zoom at or
    // below 1 only shrinks it further.
    const CANVAS = 340, MARGIN = CANVAS * 0.40, CAP = 78;
    for (const [name, pts] of [["classic", PENTA_UP], ...Object.entries(PRESETS)]) {
        for (let e = -4; e <= 6; e += 0.5) {
            const shown = pentagon(wheelsAt(pts, 1 + e).d, 0);
            const reach = Math.max(1, ...shown.map((v) => Math.hypot(v[0], v[1])));
            const fit = fitStep(reach, 0, MARGIN, CAP);
            for (const zoom of [1, 0.5, 0.1]) {
                const k = fit * zoom;
                assert.ok(reach * k <= MARGIN + 1e-9,
                    `${name} at rung ${1 + e}, zoom ${zoom}: `
                    + `reaches ${(reach * k).toFixed(1)}px of ${MARGIN}`);
                assert.ok(k > 0, `${name} at rung ${1 + e}: cell ${k}`);
            }
        }
    }
});

test("and the wheel moves it every click, which the ladder did not", () => {
    // The complaint itself. One scroll notch is exp(-deltaY * 0.0015); at the
    // 100-unit deltaY a trackpad sends that is about 14%, and from the ladder's
    // cell 13 the next rung up is 21 -- so three clicks changed nothing and the
    // fourth jumped 1.6x. Smooth, every click lands.
    const fit = 13, click = Math.exp(-100 * 0.0015);
    let zoom = 1, smooth = [], laddered = [];
    for (let i = 0; i < 4; i++) {
        zoom /= click;                                  // scrolling up, zooming in
        smooth.push(fit * zoom);
        laddered.push(fibCell(fit * zoom));
    }
    assert.equal(new Set(smooth).size, 4, `smooth gave ${smooth}`);
    assert.ok(new Set(laddered).size < 4, `the ladder used to give ${laddered}`);
    for (let i = 1; i < smooth.length; i++)
        assert.ok(smooth[i] > smooth[i - 1], "and it is monotonic");
});
