// @ts-check
// How the input figure is framed, as a function rather than as a line inside a
// draw call — because the line inside the draw call was wrong and nothing could
// see it.
//
// Jake, 2026-11-19: *moving a point toward the edge causes extremely quick
// zoomout.* The old rule refit exactly on every frame:
//
//     k = margin / reach
//
// which is a FEEDBACK LOOP once a drag is reading the pointer back through that
// same k. `pick()` turns a screen offset into lattice coordinates by dividing by
// the scale, so a smaller scale maps the same pointer to a larger coordinate:
//
//     reach' = offset / k = offset · reach / margin
//
// and for any pointer beyond the margin that is geometric growth, frame over
// frame, with the figure shooting away from the hand dragging it. Nothing in the
// loop was wrong on its own; the loop was.
//
// Two changes break it, and BOTH are needed — slowing the loop down is not the
// same as opening it. A first attempt only damped the shrink to 1% a frame, and
// the test below caught that it still ran away, just politely: `reach · scale`
// is identically the pointer's offset, so "the figure is past the edge" stays
// true for ever and the scale decays 1% a frame with no bottom.
//
//   1. The DRAWING scale gives way only at the edge, and then by `EDGE_SHRINK`
//      a frame. That is `fitStep`, below.
//   2. The MAPPING scale — the one `pick()` divides by — is frozen for the
//      length of a drag. So `reach` is a fixed function of where the pointer is,
//      the recursion is gone, and the easing in (1) has something to converge
//      to: the figure settles with the dragged corner on the margin.
//
// Which is why Jake asked for the scroll zoom first. With the mapping frozen the
// figure can legitimately end up larger than its frame, and the wheel is how you
// pull back out — the auto-fit is no longer allowed to do it violently.

/** Per draw, once the figure has reached the edge. 1% is the "much more slowly". */
export const EDGE_SHRINK = 0.99;

/**
 * The scale to draw at, given the one last drawn.
 *
 * @param {number} reach the figure's own radius, in lattice units
 * @param {number} held the scale the last draw used; 0 asks for an exact fit
 * @param {number} margin how far from the center the figure may reach, in pixels
 * @param {number} cap the largest scale worth using, so a tiny figure is not
 *   blown up to fill the frame
 * @returns {number} pixels per lattice unit
 */
export function fitStep(reach, held, margin, cap) {
    const exact = Math.min(margin / Math.max(reach, 1e-9), cap);
    if (!held) return exact;                       // a preset, `use`, a rung step
    if (reach * held > margin) return Math.max(exact, held * EDGE_SHRINK);
    return held;                                   // it fits: leave it alone
}

/**
 * The cell sizes the input figure is allowed to use, in pixels.
 *
 * Jake, 2026-11-22: in the spirit of the thing, the grid jumps by Fibonacci —
 * 8×8, then 13×13, then 21×21. Which is not only decorative. The wheels' x
 * components ARE the Fibonacci numbers at every rung, so a figure stepped one
 * rung up at one cell size down lands on the same pixels; and a continuous fit
 * meant the paper's own squares were never twice a readable size.
 *
 * The ladder runs BOTH ways. Jake, same day: *make sure grid-size keeps up with
 * display. I saw (didn't see rather) points outside the canvas.* The first
 * version stopped at 1 pixel, and a cell can legitimately need to be smaller
 * than that — at extrapolate +6 the classic pentagon reaches 1091 lattice units
 * and wants 0.293 px/unit. Floored at 1 it was drawn three times too large and
 * the whole figure left the canvas. So the reciprocals are cells too: 1/2, 1/3,
 * 1/5, 1/8, where the paper is far too fine to draw and the number is purely a
 * scale.
 */
export const FIB_CELLS = [
    1 / 233, 1 / 144, 1 / 89, 1 / 55, 1 / 34, 1 / 21, 1 / 13, 1 / 8, 1 / 5,
    1 / 3, 1 / 2, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233,
];

/**
 * The largest Fibonacci cell that is no bigger than `k`. Rounding DOWN rather
 * than to nearest is what keeps a fitted figure inside its frame — and below
 * the ladder's own bottom the ladder gives way rather than the frame, so
 * `fibCell(k) <= k` holds for every k and the display always wins.
 * @param {number} k
 * @returns {number}
 */
export function fibCell(k) {
    let out = FIB_CELLS[0];
    for (const f of FIB_CELLS) if (f <= k) out = f;
    return Math.min(out, k);
}
