/**
 * Handing a file to the browser — PLAN §5.99, step 3.
 *
 * The export is an *export*: steps 1 and 2 build the document and nothing could
 * ask for one, which is the same shape of gap `reset()` had before §9.4 gave it
 * a button. A feature nobody can invoke is not a feature.
 *
 * Two routes, because one of them is often blocked. `URL.createObjectURL` plus
 * a synthetic click on an `<a download>` is the normal way and needs no server.
 * Where that is unavailable — an old browser, a sandbox that refuses blob URLs
 * — a `data:` URL is the fallback, which works for anything of this size.
 * Both are guarded, and the caller is told which happened rather than left to
 * guess, because a download that silently does not happen is the worst outcome.
 */

export type DownloadResult = "blob" | "data" | "unavailable";

/** A filename safe on every platform, from a page name and a container id. */
export function svgFilename(page: string, container: string): string {
    const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "").toLowerCase() || "canvas";
    const a = safe(page), b = safe(container);
    // One canvas on a page needs no disambiguating suffix; two do.
    return b && b !== a ? `${a}-${b}.svg` : `${a}.svg`;
}

/**
 * Save `text` as `name`. Returns how it was done, or `"unavailable"`.
 *
 * Nothing here throws: a page that cannot download should still be a page.
 */
export function downloadText(
    name: string, text: string, type = "image/svg+xml",
): DownloadResult {
    const doc = globalThis.document;
    if (!doc || typeof doc.createElement !== "function") return "unavailable";
    let a: HTMLAnchorElement;
    try {
        a = doc.createElement("a") as HTMLAnchorElement;
    } catch {
        return "unavailable";
    }
    if (typeof a.click !== "function") return "unavailable";
    a.download = name;

    // The blob route: no size limit worth worrying about, and the URL is
    // revoked afterwards so the document is not held in memory for the session.
    const U = globalThis.URL;
    if (typeof Blob === "function" && U && typeof U.createObjectURL === "function") {
        try {
            const url = U.createObjectURL(new Blob([text], { type }));
            a.href = url;
            a.click();
            // Revoked on a turn of the event loop: Safari has been known to
            // cancel the download if the URL dies in the same tick.
            setTimeout(() => { try { U.revokeObjectURL(url); } catch { /* gone */ } }, 0);
            return "blob";
        } catch { /* fall through to data: */ }
    }
    try {
        a.href = `data:${type};charset=utf-8,${encodeURIComponent(text)}`;
        a.click();
        return "data";
    } catch {
        return "unavailable";
    }
}
