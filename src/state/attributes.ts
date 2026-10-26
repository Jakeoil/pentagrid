/**
 * The container's attributes, read — PLAN §9.8, step 5 of §9.10.
 *
 * Jake, 2026-10-24: *"imagine exporting a library and allowing the canvas to be
 * a widget. The settings would be html attributes. The output would be a string
 * that could be embedded in the apps page to build it. As a goal, it could even
 * be embedded in "method.html" itself."*
 *
 * So the serialized form of a setup is attributes on the container:
 *
 *     <div id="stage" data-width="800" data-penrose-tiles data-color="bands"
 *          data-band="0.5" data-penta-face data-penta-shape="innie"></div>
 *
 * Which is one surface used two ways — a host page configuring a widget, and a
 * saved setup being applied — and the pattern was already there: `readCanvasSpec`
 * has read `data-width`, `data-height` and `data-margin` off the container since
 * long before this. Those three stay where they are: they size the canvas rather
 * than style the drawing, and they are not state in §9.2's sense.
 *
 * Everything here goes through `state/inventory.ts`, so the names, the kinds and
 * the parsing cannot disagree with the reset or the test. §9.5's rule holds
 * throughout: **an attribute that is absent, or that does not parse, is a
 * default** — never a guess. That is what lets an older embed meet a newer page
 * and simply not set the fields it never knew about.
 */
import { BY_ATTR, parse } from "./inventory.js";
import type { Owner } from "./inventory.js";

export interface AttributePatch {
    features: Record<string, boolean | number | string>;
    tileStyle: Record<string, boolean | number | string>;
    grid: Record<string, boolean | number | string>;
    growth: Record<string, boolean | number | string>;
    /** Attributes that looked like ours and were not usable, for a readout. */
    ignored: string[];
}

/**
 * The attribute names on an element.
 *
 * `getAttributeNames()` first — it is exactly this question, and every browser
 * has had it for years. `attributes` is the fallback for an older one, and it
 * is checked properly: a first version duck-typed it as "has a numeric
 * `length`", which a FUNCTION also has (its arity), so against a Proxy-based
 * test stub it matched the method and read every element as having no
 * attributes at all. Hence the explicit `typeof !== "function"`.
 */
function attributesOf(el: Element): string[] {
    const names = (el as { getAttributeNames?: () => string[] }).getAttributeNames;
    if (typeof names === "function") {
        const got = names.call(el);
        if (Array.isArray(got)) return got;
    }
    const list = (el as { attributes?: ArrayLike<{ name: string }> }).attributes;
    if (list && typeof list !== "function" && typeof list.length === "number") {
        return Array.from(list, (a) => a.name);
    }
    return [];
}

/**
 * Read the container and sort what is there by which object it belongs to.
 *
 * Only attributes the inventory names are touched. Anything else on the element
 * — `id`, `class`, `data-width`, a host's own `data-analytics-id` — is left
 * alone, because a widget lives on someone else's div.
 */
export function readAttributes(el: Element): AttributePatch {
    return collect(attributesOf(el), (n) => el.getAttribute(n));
}

/**
 * The same sorting, over any source of named values.
 *
 * Shared with the query-string reader (`state/query.ts`), because a page's
 * settings are one vocabulary however they arrive: a container's attributes
 * and a URL's parameters name the same fields, parse by the same rules and
 * refuse the same values. Written twice they would diverge the first time a
 * field changed kind.
 */
export function collect(
    names: readonly string[], get: (name: string) => string | null,
): AttributePatch {
    const out: AttributePatch = {
        features: {}, tileStyle: {}, grid: {}, growth: {}, ignored: [],
    };
    for (const name of names) {
        const field = BY_ATTR.get(name);
        if (!field) continue;                      // not ours: not our business
        const value = parse(field, get(name));
        if (value === null) { out.ignored.push(name); continue; }
        out[field.owner as Owner][field.key] = value;
    }
    return out;
}

/**
 * Watch for an attribute changing, and tell the caller.
 *
 * §9.8a: *"embedded widget can be interactive in so far that it can be redrawn
 * with changed attributes."* So the widget is a function of its attributes and
 * something has to notice one move. A `MutationObserver` needs no API of its
 * own, which is more in keeping with "it IS its attributes" than an exported
 * `refresh()` would be — the host writes an attribute and the picture follows.
 *
 * Returns a function that stops watching, or null where there is no observer to
 * be had (node, an old browser). Only the attributes the inventory names are
 * watched, so a host's own bookkeeping on the same element costs nothing.
 */
export function watchAttributes(el: Element, onChange: () => void): (() => void) | null {
    const Obs = (globalThis as { MutationObserver?: typeof MutationObserver })
        .MutationObserver;
    if (typeof Obs !== "function") return null;
    const obs = new Obs(() => onChange());
    obs.observe(el, {
        attributes: true,
        attributeFilter: [...BY_ATTR.keys()],
    });
    return () => obs.disconnect();
}
