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
