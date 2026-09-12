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
    show: () => void;
    hide: () => void;
    setTitle: (t: string) => void;
    isCollapsed: () => boolean;
}

interface Placed { x: number | null; y: number | null; collapsed: boolean }

const storeKey = (id: string) => `pentagrid.panel.${id}`;

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
        x: opts.x ?? null, y: opts.y ?? null, collapsed: opts.collapsed ?? false,
    });

    const element = document.createElement("div");
    element.className = "float-panel";
    element.id = opts.id;

    const bar = document.createElement("div");
    bar.className = "float-bar";
    const titleEl = document.createElement("span");
    titleEl.className = "float-title";
    titleEl.textContent = opts.title;
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
    bar.appendChild(controls);

    const body = document.createElement("div");
    body.className = "float-body";

    element.appendChild(bar);
    element.appendChild(body);

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
    }

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
        show: () => { element.hidden = false; place(); },
        hide: () => { element.hidden = true; },
        setTitle: (t) => { titleEl.textContent = t; },
        isCollapsed: () => state.collapsed,
    };
}
