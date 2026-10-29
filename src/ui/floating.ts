// A floating panel: drag it by the bar, collapse it, close it, and it remembers
// where you left it.
//
// The pattern is lifted from planet-coyleus' editor panel in the coylean-map
// repo — fixed position, a title bar that drags, collapse and close, clamped to
// the viewport, position and collapsed state in localStorage.
//
// One deliberate difference: the drag runs on POINTER events with capture on the
// bar, rather than mousedown on the bar plus mousemove/mouseup on window. Capture
// keeps the drag alive when the pointer leaves the bar without listening to the
// whole window, it covers touch and pen for free, and it means the gesture can be
// driven in a test — window-level listeners cannot be.

export interface FloatingPanelOptions {
    /** Identity for the stored position. Also the DOM id. */
    id: string;
    title: string;
    /** Start here when nothing is stored. Defaults to the top right. */
    x?: number;
    y?: number;
    collapsed?: boolean;
    /** Called when the × is pressed. The panel hides itself either way. */
    onClose?: () => void;
}

export interface FloatingPanel {
    element: HTMLElement;
    /** Put your content in here. */
    body: HTMLElement;
    /**
     * A slot in the title bar, to the LEFT of collapse and close, for a
     * control that belongs to the panel rather than to its contents — the
     * reticulum's `restore` being the case it was added for. Empty and
     * invisible until something is put in it.
     */
    barExtras: HTMLElement;
    show: () => void;
    hide: () => void;
    setTitle: (t: string) => void;
    isCollapsed: () => boolean;
    /**
     * Put it back where it started, open and uncollapsed, and forget the
     * stored position.
     *
     * A panel that has been dragged somewhere unhelpful — behind another one,
     * or to a corner of a window that is now a different size — cannot be
     * recovered by anything on the panel itself, because the way to reach it
     * is the thing that is lost. So the rescue has to come from outside.
     */
    resetPlace: () => void;
}

interface Placed {
    x: number | null; y: number | null; collapsed: boolean;
    /** Panel width in px, or null for whatever the content wants. */
    w?: number | null;
}

const storeKey = (id: string) => `pentagrid.panel.${id}`;

/**
 * The stacking order of the floating panels, as a running counter.
 *
 * One panel is the usual case and `z-index: 200` from the stylesheet is the
 * whole story. Two of them — moiré drives two reticula — overlap, and the one
 * underneath cannot be worked without first dragging the other off it. Jake:
 * "When I use the one in the back, move it to the front." So touching a panel
 * anywhere raises it, which is what every window manager does and what nobody
 * has to be told.
 */
let topZ = 200;

function load(id: string, fallback: Placed): Placed {
    try {
        const raw = globalThis.localStorage?.getItem(storeKey(id));
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;                 // private window, or storage disabled
    }
}

function save(id: string, p: Placed) {
    try {
        globalThis.localStorage?.setItem(storeKey(id), JSON.stringify(p));
    } catch {
        /* nothing to do about it, and nothing worth breaking over */
    }
}

export function createFloatingPanel(opts: FloatingPanelOptions): FloatingPanel {
    const state = load(opts.id, {
        x: opts.x ?? null, y: opts.y ?? null, collapsed: opts.collapsed ?? false, w: null,
    });

    const element = document.createElement("div");
    element.className = "float-panel";
    element.id = opts.id;

    /** Bring it above the others. */
    function raise() {
        element.style.zIndex = String(++topZ);
    }
    // On the panel, not the bar: the point is that reaching for a CONTROL in
    // the one behind brings it forward, and the bar is the part you can
    // already get at. Bubbles up from whatever was pressed.
    element.addEventListener("pointerdown", raise);

    const bar = document.createElement("div");
    bar.className = "float-bar";
    const titleEl = document.createElement("span");
    titleEl.className = "float-title";
    titleEl.textContent = opts.title;
    const barExtras = document.createElement("span");
    barExtras.className = "float-extras";

    const controls = document.createElement("span");
    controls.className = "float-controls";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.title = "collapse";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.title = "close";
    closeBtn.textContent = "×";

    controls.appendChild(collapseBtn);
    controls.appendChild(closeBtn);
    bar.appendChild(titleEl);
    bar.appendChild(barExtras);
    bar.appendChild(controls);

    const body = document.createElement("div");
    body.className = "float-body";

    // The resize grip, bottom right. Dragging it sets the panel's width; the
    // content is expected to follow, which for the reticulum means the SVG scales.
    const grip = document.createElement("div");
    grip.className = "float-grip";
    grip.title = "drag to resize";

    element.appendChild(bar);
    element.appendChild(body);
    element.appendChild(grip);

    const MIN_W = 180;
    function applyWidth() {
        element.style.width = state.w ? `${Math.max(MIN_W, state.w)}px` : "";
    }

    /** Keep a corner on screen, so a panel can never be dragged out of reach. */
    function clamp() {
        const w = globalThis.innerWidth || 1200;
        const h = globalThis.innerHeight || 800;
        state.x = Math.max(4, Math.min(w - 60, state.x ?? 0));
        state.y = Math.max(4, Math.min(h - 40, state.y ?? 0));
    }

    function place() {
        if (state.x === null || state.y === null) {
            state.x = Math.max(20, (globalThis.innerWidth || 1200) - 300);
            state.y = 96;
        }
        clamp();
        element.style.left = `${state.x}px`;
        element.style.top = `${state.y}px`;
        element.classList.toggle("collapsed", state.collapsed);
        collapseBtn.textContent = state.collapsed ? "▸" : "▾";
        applyWidth();
    }

    let resize: { px: number; w: number } | null = null;
    grip.addEventListener("pointerdown", (ev) => {
        const e = ev as PointerEvent;
        const current = state.w ?? element.getBoundingClientRect?.().width ?? MIN_W;
        resize = { px: e.clientX, w: current };
        grip.setPointerCapture?.(e.pointerId);
        e.preventDefault?.();
        e.stopPropagation?.();
    });
    grip.addEventListener("pointermove", (ev) => {
        if (!resize) return;
        const e = ev as PointerEvent;
        state.w = Math.max(MIN_W, Math.round(resize.w + (e.clientX - resize.px)));
        applyWidth();
    });
    const endResize = () => {
        if (!resize) return;
        resize = null;
        save(opts.id, state);
    };
    grip.addEventListener("pointerup", endResize);
    grip.addEventListener("pointercancel", endResize);

    let drag: { px: number; py: number; x: number; y: number } | null = null;

    bar.addEventListener("pointerdown", (ev) => {
        const e = ev as PointerEvent;
        // The buttons live in the bar; pressing one is not a drag.
        const t = e.target as HTMLElement | null;
        if (t && typeof t.closest === "function" && t.closest("button")) return;
        place();                                   // settle x/y before reading them
        drag = { px: e.clientX, py: e.clientY, x: state.x ?? 0, y: state.y ?? 0 };
        bar.setPointerCapture?.(e.pointerId);
        e.preventDefault?.();
    });

    bar.addEventListener("pointermove", (ev) => {
        if (!drag) return;
        const e = ev as PointerEvent;
        state.x = drag.x + (e.clientX - drag.px);
        state.y = drag.y + (e.clientY - drag.py);
        clamp();
        element.style.left = `${state.x}px`;
        element.style.top = `${state.y}px`;
    });

    const end = () => {
        if (!drag) return;
        drag = null;
        save(opts.id, state);
    };
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);

    collapseBtn.addEventListener("click", () => {
        state.collapsed = !state.collapsed;
        element.classList.toggle("collapsed", state.collapsed);
        collapseBtn.textContent = state.collapsed ? "▸" : "▾";
        save(opts.id, state);
    });

    closeBtn.addEventListener("click", () => {
        element.hidden = true;
        opts.onClose?.();
    });

    place();
    return {
        element,
        body,
        barExtras,
        show: () => { element.hidden = false; place(); raise(); },
        hide: () => { element.hidden = true; },
        setTitle: (t) => { titleEl.textContent = t; },
        isCollapsed: () => state.collapsed,
        resetPlace: () => {
            state.x = opts.x ?? null;
            state.y = opts.y ?? null;
            state.collapsed = false;
            // Clearing the width drops back to the stylesheet's, which is a
            // definite number — not to shrink-to-fit, which is what made a
            // reset panel come back larger than it went away. Jake: "After
            // resetting γ panels, sometimes reticulums get big."
            state.w = null;
            element.hidden = false;
            place();
            raise();
            save(opts.id, state);
        },
    };
}
