/**
 * The reticulum slot — PLAN §9.3, step 4 of §9.10.
 *
 * Jake, 2026-10-24: *"Simplify the shared reticulum for now. At the very least,
 * it could be pushed on a stack (single entry stack) when switching pages. Add
 * preset named 'restore' to pull it off the stack on the new page. (In this
 * case the title bar will show what's in the stack, not restore)"*
 *
 * So not a synchronized shared scope: **one slot, written on the way out and
 * read on request.** Nothing is overwritten behind the user — the new page's γ
 * stays where it is until `restore` is clicked — which is why this is simpler
 * than a live shared scope: no precedence, no merge, no surprise.
 *
 * **Written on leaving, not on change.** Writing whenever γ moved would be more
 * robust against a missed unload event, and would be wrong: arriving somewhere
 * and nudging γ before clicking `restore` would overwrite the very thing you
 * came to restore. So the slot is pushed on the way out and is then immutable
 * until the next exit.
 *
 * **n is carried and checked.** `grow7.html` is a heptagrid, so a slot written
 * there holds seven numerators and a pentagrid page must refuse it rather than
 * read five of them — §9.3's one hazard.
 *
 * Storage is `localStorage` when there is one and a module variable otherwise,
 * so this works in a page, in `pagecheck` and in a test without a special case
 * at the call site. Every access is guarded: a private window, cleared site
 * data or a browser set to block storage all throw on the accessor itself.
 */
import type { GammaSnapshot } from "./baseline.js";

export interface Slot {
    /** What the title bar should say once it is pulled. */
    label: string;
    /** How many families, so a page with a different n can refuse it. */
    n: number;
    gamma: GammaSnapshot;
}

const KEY = "pentagrid.reticulum.slot";
/** The fallback store, and the one the tests use. */
let memory: Slot | null = null;

function store(): Storage | null {
    try {
        // The accessor itself throws where site data is blocked, so this is not
        // the same as checking for undefined.
        const s = globalThis.localStorage;
        return s && typeof s.getItem === "function" ? s : null;
    } catch {
        return null;
    }
}

/** Put the reticulum in the slot, replacing whatever was there. */
export function pushSlot(slot: Slot): void {
    memory = slot;
    const s = store();
    if (!s) return;
    try { s.setItem(KEY, JSON.stringify(slot)); } catch { /* full, or blocked */ }
}

/** What is in the slot, whatever its n. Null when empty or unreadable. */
export function peekSlot(): Slot | null {
    const s = store();
    if (s) {
        try {
            const raw = s.getItem(KEY);
            if (raw) {
                const got = JSON.parse(raw) as Slot;
                // Shape-checked, because this came from outside the program:
                // another version wrote it, or a user edited it.
                if (got && typeof got.label === "string" && typeof got.n === "number"
                    && got.gamma && Array.isArray(got.gamma.exact)) return got;
            }
        } catch { /* unparseable: treat as empty */ }
    }
    return memory;
}

/**
 * The slot, but only if it fits a grid of `n` families. §9.3's hazard: a slot
 * from the heptagrid page must not be read as five numerators.
 */
export function slotFor(n: number): Slot | null {
    const got = peekSlot();
    return got && got.n === n && got.gamma.exact.length === n ? got : null;
}

/** For tests, and for a page that wants to forget. */
export function clearSlot(): void {
    memory = null;
    const s = store();
    if (!s) return;
    try { s.removeItem(KEY); } catch { /* nothing to do */ }
}
