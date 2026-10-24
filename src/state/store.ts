/**
 * Durable key/value, guarded — the one place that knows about `localStorage`.
 *
 * Both the reticulum slot (§9.3) and the session memory (§9.4) want the same
 * thing: write something that survives a navigation, and carry on regardless
 * when that is impossible. Written twice it would be guarded twice and
 * differently, so it is here once.
 *
 * Three facts about browser storage that the guards are for:
 *
 * - **The accessor itself can throw.** Where site data is blocked,
 *   `localStorage` is not undefined — reading the property raises. So the test
 *   is a `try`, not a `typeof`.
 * - **A write can fail on a full quota**, long after the read worked.
 * - **It can come back empty** for reasons that are not bugs: a private
 *   window, cleared site data, a different browser.
 *
 * So every operation falls back to a module-level map, which also makes this
 * work in node — in `pagecheck` and in the tests — with no special case at the
 * call site. The fallback is per-process and therefore per-page in a browser,
 * which is the honest degradation: things stop surviving a navigation, and
 * nothing else changes.
 */
const memory = new Map<string, string>();

function backing(): Storage | null {
    try {
        const s = globalThis.localStorage;
        return s && typeof s.getItem === "function" ? s : null;
    } catch {
        return null;
    }
}

export function storeGet(key: string): string | null {
    const s = backing();
    if (s) {
        try {
            const raw = s.getItem(key);
            if (raw !== null) return raw;
        } catch { /* fall through to memory */ }
    }
    return memory.get(key) ?? null;
}

export function storeSet(key: string, value: string): void {
    memory.set(key, value);
    const s = backing();
    if (!s) return;
    try { s.setItem(key, value); } catch { /* full, or blocked */ }
}

export function storeDelete(key: string): void {
    memory.delete(key);
    const s = backing();
    if (!s) return;
    try { s.removeItem(key); } catch { /* nothing to do */ }
}

/**
 * Parse what was stored, or null.
 *
 * Everything in storage came from outside this program — an older version
 * wrote it, or a user edited it — so a caller must say what a usable value
 * looks like and anything else is treated as absent. §9.5's rule, one level
 * down: refuse, never guess.
 */
export function storeRead<T>(key: string, ok: (v: unknown) => boolean): T | null {
    const raw = storeGet(key);
    if (raw === null) return null;
    try {
        const got: unknown = JSON.parse(raw);
        return ok(got) ? (got as T) : null;
    } catch {
        return null;
    }
}
