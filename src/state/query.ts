/**
 * A setup in the query string — PLAN §9.4's top sink.
 *
 * Jake, 2026-10-25: *"This would include the query parameters for pages."* And
 * his second want was *"creating urls of existing pages eventually"*. §9.4 has
 * had the URL at the top of the precedence since the plan was written:
 *
 *     query  >  session  >  attributes (the page's setup)  >  defaults
 *
 * It was the one sink never built — the attribute reader landed in step 5 and
 * the URL was left out because *"don't update the URL"* was read as *"no URLs
 * at all"*. It is not: the address bar is never **written**, which is a
 * different thing from never **read**. A link someone sends you says *show me
 * exactly this*, and nothing has to rewrite history for that to work.
 *
 * **One vocabulary, two spellings.** The parameters are the same fields as the
 * attributes, by the same names, parsed by the same rules — `state/attributes`
 * `.collect` does the sorting for both. A URL may spell them with or without
 * the `data-` prefix, since `?data-color=bands` is correct and `?color=bands`
 * is what anyone would actually type.
 *
 * **A query suppresses the session for that load.** Otherwise a link you share
 * arrives wearing the recipient's last visit, which is the one thing a link
 * must not do.
 */
import { collect } from "./attributes.js";
import type { AttributePatch } from "./attributes.js";
import { BY_ATTR } from "./inventory.js";
import { SLICE_ATTRS } from "./embed.js";

/** The page's query string, or "" where there is no location (node, a test). */
export function pageQuery(): string {
    return globalThis.location?.search ?? "";
}

/**
 * Both spellings of a parameter, in the order they should win.
 *
 * The `data-` form first: it is the canonical name, the one `copy setup`
 * emits, and the one to prefer if a URL somehow carries both.
 */
function spellings(attr: string): string[] {
    return [attr, attr.replace(/^data-/, "")];
}

/**
 * Every parameter name a query may carry: the flat fields AND the slices.
 *
 * The slices were missing, and that was a real hole rather than a tidy-up.
 * `BY_ATTR` is the FIELDS — one attribute, one value — while γ, the view and
 * the hidden layers live in `SLICE_ATTRS` and are read separately. So a link
 * carrying only `?gamma=…&gamma-den=…&scale=…` — which is the commonest kind
 * of link there is, and the only kind moiré writes — was read for its setup
 * and then NOT allowed to suppress the session, because nothing it named was
 * recognized as a setting. The γ in the URL applied; the view came from
 * whatever that browser remembered. Found 2026-11-27 while giving moiré one
 * link for its two canvases; it was never moiré's bug.
 */
const ALL_ATTRS: string[] =
    [...BY_ATTR.keys(), ...Object.values(SLICE_ATTRS)];

/** Does this query carry any setting of ours? */
export function hasQuerySetup(search: string): boolean {
    if (!search) return false;
    const q = new URLSearchParams(search);
    for (const attr of ALL_ATTRS) {
        for (const name of spellings(attr)) if (q.has(name)) return true;
    }
    return false;
}

/**
 * The flat fields a query names.
 *
 * A bare parameter — `?penta-face` — is HTML's kind of boolean: present is
 * true. `URLSearchParams` gives `""` for it, which `parse` already reads as
 * true, so the two sinks agree without a special case.
 */
export function readQuery(search: string): AttributePatch {
    const q = new URLSearchParams(search);
    const names: string[] = [];
    const value = new Map<string, string>();
    for (const attr of BY_ATTR.keys()) {
        for (const name of spellings(attr)) {
            if (!q.has(name)) continue;
            names.push(attr);
            value.set(attr, q.get(name) ?? "");
            break;                             // the canonical spelling wins
        }
    }
    return collect(names, (n) => value.get(n) ?? null);
}

/**
 * A query string for a set of attributes — the inverse, for a copy-link button.
 *
 * Written in the short spelling, without `data-`, because that is what a person
 * reads in an address bar. A boolean appears bare.
 */
export function queryFor(attrs: Record<string, string>): string {
    const parts: string[] = [];
    for (const [name, v] of Object.entries(attrs)) {
        const short = name.replace(/^data-/, "");
        parts.push(v === "" ? short : `${short}=${encodeURIComponent(v)}`);
    }
    return parts.length ? `?${parts.join("&")}` : "";
}
