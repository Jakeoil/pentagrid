/**
 * Session memory — PLAN §9.4, step 7 of §9.10.
 *
 * Jake's fourth want: *"Also remember the current state of the page."* So a
 * page comes back as you left it.
 *
 * **Where it sits in the order.** §9.4's precedence, with the URL gone:
 *
 *     attributes (the markup, or a saved setup)  >  session  >  page defaults
 *
 * Read **after** `markBaseline`, which is the point: the baseline is the page's
 * own setup, so `reset()` throws the session away and returns to the markup
 * rather than to your last visit. The session is the transient layer and reset
 * is how you leave it.
 *
 * **Opt-in, per page.** Not every page wants to be remembered: the narrative
 * pages impose a feature set per step, and a session restoring the features
 * from three steps ago would fight the step you are on. So a page asks, with
 * `session: true` or a key of its own, and the ones that do not ask are
 * untouched.
 *
 * **Keyed per page**, since §9.3's page scope is per page: method's dressings
 * have nothing to say to grow7's. The key defaults to the path plus the
 * container's id, which separates two canvases on one page as well.
 *
 * Saved on a debounce rather than on every change: a pan fires continuously
 * and the point is where you ended up, not the thirty places you passed
 * through.
 */
import { storeRead, storeSet, storeDelete } from "./store.js";

/** Everything the page scope holds, as the stored shape. */
export interface SessionState {
    /** The format, so a later shape can be refused rather than misread. */
    v: 1;
    features?: Record<string, boolean | number | string>;
    tileStyle?: Record<string, boolean | number | string>;
    grid?: Record<string, boolean | number | string>;
    growth?: Record<string, boolean | number | string>;
    gamma?: unknown;
    view?: { scale: number; x: number; y: number };
    hide?: string[];
}

/** How long to wait after the last change before writing. */
export const SAVE_AFTER_MS = 400;

const keyFor = (id: string) => `pentagrid.session.${id}`;

/**
 * The page's own key.
 *
 * The path identifies the page and the container's id separates two canvases
 * on one of them. Neither exists in node, where the fallback is a constant —
 * which is right, since a test wants one predictable slot and not the name of
 * whatever file it happens to be run from.
 */
export function sessionKey(container?: { id?: string }): string {
    const path = globalThis.location?.pathname ?? "node";
    const id = container?.id ? `#${container.id}` : "";
    return `${path}${id}`;
}

export function saveSession(id: string, state: SessionState): void {
    storeSet(keyFor(id), JSON.stringify(state));
}

export function loadSession(id: string): SessionState | null {
    return storeRead<SessionState>(keyFor(id), (v) => {
        const s = v as SessionState;
        // Version-checked rather than shape-guessed: a later format is refused
        // outright, so an old page meeting a new session takes its defaults
        // instead of half-reading something it does not understand.
        return !!s && s.v === 1;
    });
}

export function forgetSession(id: string): void {
    storeDelete(keyFor(id));
}

/**
 * A debouncer that does not hold a process open.
 *
 * `unref` where there is one, so a pending save cannot keep node alive at the
 * end of a test run — a browser's `setTimeout` returns a number and has no
 * such method, hence the check.
 */
export function debounce(fn: () => void, ms: number): () => void {
    let t: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (t !== null) clearTimeout(t);
        t = setTimeout(() => { t = null; fn(); }, ms);
        const maybe = t as unknown as { unref?: () => void };
        if (typeof maybe?.unref === "function") maybe.unref();
    };
}
