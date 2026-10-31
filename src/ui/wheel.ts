// One reading of a wheel event, shared by every control that takes one.
//
// Two things bite here, and they bit.
//
// SHIFT IS TAKEN. Most browsers turn shift+wheel into horizontal scroll, so the
// movement arrives on deltaX and deltaY is flat zero — the fine step silently did
// nothing, or worked in one direction where the browser happened not to swap.
// Reading `deltaY || deltaX` takes the value whichever axis it came on, and any
// of shift / ctrl / alt / meta asks for the fine step, so a platform that eats one
// of them still leaves two.
//
// NOTHING SCROLLS THE PAGE. A control that declines to act on a wheel should still
// swallow it: scrolling the page out from under an instrument you are aiming at is
// worse than doing nothing.

export interface WheelSteps {
    /** A plain notch. */
    step: number;
    /** With a modifier held. */
    fine: number;
}

/** True when the event asks for the fine step. */
export const isFine = (e: WheelEvent): boolean =>
    e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;

/** How far one notch of this event should move a value, sign included. */
export function wheelNotch(e: WheelEvent, s: WheelSteps): number {
    const raw = e.deltaY || e.deltaX;      // shift-wheel arrives on deltaX
    if (!raw) return 0;
    return (raw > 0 ? -1 : 1) * (isFine(e) ? s.fine : s.step);
}

/**
 * ONE FLICK, ONE NOTCH. A trackpad reports a single flick as a burst of wheel
 * events a few milliseconds apart, and keeps reporting while the inertia runs
 * down; a control that snaps a whole step per event then runs away — 000 to
 * 200 arrives at 600, and the picture never matches the notch you meant. A
 * mouse wheel's notches come ~100 ms apart, so a short cooldown after an
 * accepted coarse step keeps one gesture to one step without slowing a
 * deliberate spin. Fine steps (a modifier held) are not gated: those are
 * meant to be many.
 */
export function makeNotchGate(coolMs = 90) {
    let last = -Infinity;
    return (e: WheelEvent): boolean => {
        if (isFine(e)) return true;
        // The event's own clock, so a burst is judged by when it was generated;
        // a synthetic event with no timestamp is always accepted.
        const now = e.timeStamp;
        if (!(now > 0)) return true;
        if (now - last < coolMs) return false;
        last = now;
        return true;
    };
}

/**
 * The next multiple of `unit` in the direction of `d`, from `cur`. Sitting on
 * a multiple moves a whole unit; sitting between lands on the nearer edge in
 * that direction — 0.234 up is 0.3, down is 0.2 — and 1.5 up is 2, not 3.
 */
export function snapStep(cur: number, unit: number, d: number): number {
    const eps = 1e-9;
    const k = d > 0 ? Math.floor(cur / unit + eps) + 1 : Math.ceil(cur / unit - eps) - 1;
    return k * unit;
}

/**
 * `snapStep` with extra stops that are not on the grid.
 *
 * Σγ mod 1 is the LI class, and the classes worth stopping at are not all
 * multiples of a thousandth: deflation is `s ↦ −2s` and inflation `s ↦ 2s`, so
 * besides 0 the only classes either map fixes are **1/3 and 2/3** — deflation
 * holds each one, inflation swaps them. A third is not a multiple of anything
 * the readout counts in, so it has to be carried alongside the grid rather
 * than on it.
 *
 * `detents` are phases in [0, 1) and recur every turn, like the quantity they
 * stop. A detent is taken only when it falls strictly between where you are
 * and where the plain step would have put you: sitting on one, the next notch
 * leaves it.
 */
export function snapStepWith(
    cur: number, unit: number, d: number, detents: readonly number[],
): number {
    const eps = 1e-9;
    let best = snapStep(cur, unit, d);
    for (const p of detents) {
        // The representative of p nearest `cur` in the direction of travel.
        const v = d > 0
            ? Math.floor(cur - p + eps) + 1 + p
            : Math.ceil(cur - p - eps) - 1 + p;
        best = d > 0 ? Math.min(best, v) : Math.max(best, v);
    }
    return best;
}
