// Show the picture and nothing else — PLAN §5.100.
//
// Jake, 2026-11-27: *"I want to be able to show a canvas full screen as well as
// export the svg. I also want to create a copyable link that will simply show
// the full screen."*
//
// **What "full screen" means here.** The picture fills the browser's window:
// the canvas's container is lifted to `position: fixed; inset: 0` and the view
// is told its new size, so the drawing is re-laid out at the window's shape
// rather than scaled up from a smaller one. What it is NOT is the Fullscreen
// API. That needs a user gesture, so a LINK could never reproduce it, and the
// two routes would then mean different things — which is the one thing a
// shareable link must not do. One mode, reachable by click or by URL, behaving
// the same both ways.
//
// **Nothing is hidden.** The first design hid the nav, the prose and the panels
// — which means knowing every page's furniture, and each page has different
// furniture. A fixed box over the whole window covers all of it without naming
// any of it, and `body.showing { overflow: hidden }` stops the page behind from
// scrolling under the picture.
//
// **The geometry is INLINE STYLE, not a class.** A stylesheet cannot win this
// argument. `view/layers.ts` sets `style.position = "relative"` on any container
// whose computed position is static — method's is — and an inline style beats
// any class, so `.show-stage { position: fixed }` lost and the stage stayed in
// the flow of the page. With `height: auto` on a box whose canvases are
// absolutely positioned that is a ZERO-TALL box: the canvas hung out below it
// and the page's text stayed visible above. Jake: *"In one case (method) it gave
// me a half text half image that only took the bottom half of the view. In
// another case (moire) I got a page with just the text, frozen, no image."* Two
// pages, one cause. The class stays, for the background and for anything that
// wants to style the mode; the geometry is written here, saved and put back.
//
// **One exit for however many stages are up.** Moiré merged is two containers
// in one cell, so showing the composite raises BOTH — and two exit buttons, or
// a stage that only knows about itself, would be wrong. The live stages are a
// module-level set; the exit button and the Escape key are made once and leave
// all of them.

/** The page-level parameter. Not an inventory attribute: it is how the picture
 *  is PRESENTED, not part of the setup, so it never suppresses a session. */
export const SHOW_PARAM = "show";

/**
 * Does this query ask for this container to be shown?
 *
 * `?show=<container id>` names one. A bare `?show` means *the page's picture*,
 * which is unambiguous on the six pages with one canvas and is claimed by the
 * first asker on the two with more — so a hand-typed URL does something
 * sensible and a copied one is exact.
 */
let bareClaimed = false;
export function wantsShow(search: string, id: string): boolean {
    if (!search) return false;
    const v = new URLSearchParams(search).get(SHOW_PARAM);
    if (v === null || v === "false" || v === "0") return false;
    if (v === "") {
        if (bareClaimed) return false;
        bareClaimed = true;
        return true;
    }
    return v === id;
}

/** For the tests: the bare claim is module state, and a test builds many pages. */
export function resetShowClaim(): void {
    bareClaimed = false;
}

export interface Stage {
    enter: () => void;
    leave: () => void;
    toggle: () => void;
    showing: () => boolean;
}

interface Live {
    el: HTMLElement;
    fit: () => void;
    leave: () => void;
}

/**
 * What it takes to be a full-window box, as inline style.
 *
 * Every one of these is here because a page or a module sets it otherwise:
 * `position` (layers.ts, inline), `width`/`height` (the `.viewport` rule and
 * moiré's page-local one), `maxWidth` (the panel sizing), `margin` and the
 * insets. `background` is deliberately absent — moiré's merged rule has to be
 * able to keep the upper canvas transparent, and an inline background could not
 * be overridden by any stylesheet.
 */
const PINNED: Record<string, string> = {
    position: "fixed",
    top: "0", left: "0", right: "0", bottom: "0",
    width: "100%", height: "100%",
    maxWidth: "none", margin: "0",
    zIndex: "9000",
};

const live = new Set<Live>();
let exitBtn: HTMLButtonElement | null = null;
let wired = false;

const leaveAll = () => { for (const s of [...live]) s.leave(); };

/** The furniture that belongs to the mode rather than to one stage. */
function openChrome(): void {
    document.body?.classList.add("showing");
    if (!exitBtn) {
        exitBtn = document.createElement("button");
        exitBtn.type = "button";
        exitBtn.className = "show-exit";
        exitBtn.textContent = "exit";
        exitBtn.title = "Back to the page. Escape does the same.";
        exitBtn.addEventListener("click", () => leaveAll());
        document.body?.appendChild(exitBtn);
    }
    exitBtn.hidden = false;
    if (!wired) {
        wired = true;
        // On `document`, not on the stage: the canvas is not focusable, so a
        // keydown on it never arrives. And capture, so a control inside the
        // picture cannot swallow it.
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            if (live.size && (e.key === "Escape" || e.key === "Esc")) leaveAll();
        }, true);
        globalThis.addEventListener?.("resize", () => {
            for (const s of live) s.fit();
        });
    }
}

function closeChrome(): void {
    if (live.size) return;                       // another stage is still up
    document.body?.classList.remove("showing");
    if (exitBtn) exitBtn.hidden = true;
}

/**
 * Make one container showable.
 *
 * `fit` is called with the window's size on entering and on every resize while
 * up; `restore` when leaving, and the VIEW remembers what to go back to — not
 * this module, and not the DOM.
 *
 * The view has to be told at all because a `ResizeObserver` is not enough:
 * method's `#canvas-container` is a `position: relative` box holding absolute
 * canvases, so its own rect is zero tall, and the observer skips a zero rect by
 * design. Entering would work and leaving would strand the canvas at window
 * size. For the same reason the size to come back to is the view's idea of its
 * canvas rather than the container's rect, which for that page is not a size at
 * all.
 */
export function createStage(
    el: HTMLElement,
    hooks: { fit: (w: number, h: number) => void; restore: () => void },
): Stage {
    const size = () => ({
        w: Math.max(1, globalThis.innerWidth || 800),
        h: Math.max(1, globalThis.innerHeight || 800),
    });
    /** The inline values the element had before we pinned it. */
    let unpin: Record<string, string> | null = null;
    const rec: Live = {
        el,
        fit: () => { const s = size(); hooks.fit(s.w, s.h); },
        leave: () => {
            if (!live.has(rec)) return;
            live.delete(rec);
            el.classList.remove("show-stage");
            // Back to what was there, which for most of these is "" — and ""
            // is the right answer, since it hands the property back to the
            // stylesheet rather than freezing today's computed value.
            const style = el.style as unknown as Record<string, string>;
            if (unpin) for (const [k, v] of Object.entries(unpin)) style[k] = v;
            unpin = null;
            closeChrome();
            hooks.restore();
        },
    };
    const enter = () => {
        if (live.has(rec)) return;
        live.add(rec);
        const style = el.style as unknown as Record<string, string>;
        unpin = {};
        for (const [k, v] of Object.entries(PINNED)) {
            unpin[k] = style[k] ?? "";
            style[k] = v;
        }
        el.classList.add("show-stage");
        openChrome();
        rec.fit();
    };
    return {
        enter,
        leave: () => rec.leave(),
        toggle: () => { if (live.has(rec)) rec.leave(); else enter(); },
        showing: () => live.has(rec),
    };
}
