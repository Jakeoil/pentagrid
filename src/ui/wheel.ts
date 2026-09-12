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
