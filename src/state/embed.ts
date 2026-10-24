/**
 * A setup, written out as attributes — PLAN §9.8, step 6 of §9.10.
 *
 * Jake, 2026-10-24: *"The output would be a string that could be embedded in
 * the apps page to build it."* And: *"Don't update the URL. Just a
 * copy-to-clipboard button would be fine."*
 *
 * So: one string, the markup for a container that reproduces what you are
 * looking at.
 *
 *     <div id="stage" data-color="bands" data-penta-face
 *          data-gamma="2000,2000,2000,2000,2000" data-gamma-den="10000"></div>
 *
 * **It carries more than the flat fields.** §9.3's scopes are about what
 * *travels between pages*; an embed is a complete description of a figure, so
 * it needs γ and the view as well — a patch at the wrong γ is a different
 * patch. Those three are `SLICES` in the inventory, and this module is where
 * they are read and written, since they are shaped values rather than a bag of
 * fields.
 *
 * **Only what differs from the baseline.** §9.5's omission rule, and the reason
 * it matters is forward compatibility rather than brevity: a field added later
 * is absent from an older embed and takes its new default, so embeds do not
 * rot. As HTML attributes that is simply what HTML already means.
 *
 * γ is written as **integer numerators over a denominator**, which is how
 * `GammaSet` holds it — so an embed round-trips γ exactly, and `provenRegular`
 * and the singularity catalog, which are decided on those rationals, decide the
 * same way on the far side.
 */
import type { GammaSnapshot } from "./baseline.js";

/** The attributes for the three shaped slices. */
export const SLICE_ATTRS = {
    gamma: "data-gamma",
    den: "data-gamma-den",
    locked: "data-gamma-locked",
    generation: "data-gamma-gen",
    symmetry: "data-gamma-symmetry",
    guard: "data-gamma-guard",
    /** Families switched off, by index: `data-gamma-off="3,4"`. */
    off: "data-gamma-off",
    /** A family held to one line: `data-gamma-lines="1:2"`. */
    lines: "data-gamma-lines",
    isolated: "data-gamma-isolated",
    scale: "data-scale",
    viewX: "data-view-x",
    viewY: "data-view-y",
    /** Layers whose `userVisible` is off: `data-hide="klabels,dots"`. */
    hide: "data-hide",
} as const;

export interface Setup {
    gamma: GammaSnapshot;
    view: { scale: number; x: number; y: number };
    visibility: Record<string, boolean>;
}

/** Round a float to something an attribute can carry without noise. */
const num = (v: number) => String(Math.round(v * 1e6) / 1e6);

/**
 * The slice attributes that differ from the baseline.
 *
 * γ is all-or-nothing: its parts are one value and writing half of it would
 * describe a grid that was never on screen. The view and the hidden layers are
 * each independent.
 */
export function writeSlices(now: Setup, home: Setup): Record<string, string> {
    const out: Record<string, string> = {};
    const g = now.gamma, h = home.gamma;
    if (g.exact.join(",") !== h.exact.join(",") || g.den !== h.den
        || g.locked !== h.locked || g.generation !== h.generation
        || g.symmetry !== h.symmetry || g.guard !== h.guard) {
        out[SLICE_ATTRS.gamma] = g.exact.join(",");
        out[SLICE_ATTRS.den] = String(g.den);
        out[SLICE_ATTRS.locked] = String(g.locked);
        if (g.generation !== 0) out[SLICE_ATTRS.generation] = String(g.generation);
        if (g.symmetry) out[SLICE_ATTRS.symmetry] = "";
        if (g.guard) out[SLICE_ATTRS.guard] = "";
    }
    const offNow = g.enabled.map((on, i) => (on ? -1 : i)).filter((i) => i >= 0);
    const offHome = h.enabled.map((on, i) => (on ? -1 : i)).filter((i) => i >= 0);
    if (offNow.join(",") !== offHome.join(",")) {
        out[SLICE_ATTRS.off] = offNow.join(",");
    }
    const lineNow = g.lines.map((l, i) => (l === null ? "" : `${i}:${l}`))
        .filter(Boolean).join(",");
    const lineHome = h.lines.map((l, i) => (l === null ? "" : `${i}:${l}`))
        .filter(Boolean).join(",");
    if (lineNow !== lineHome) out[SLICE_ATTRS.lines] = lineNow;
    if (g.isolated !== h.isolated) {
        out[SLICE_ATTRS.isolated] = g.isolated === null ? "" : String(g.isolated);
    }

    if (now.view.scale !== home.view.scale) out[SLICE_ATTRS.scale] = num(now.view.scale);
    if (now.view.x !== home.view.x) out[SLICE_ATTRS.viewX] = num(now.view.x);
    if (now.view.y !== home.view.y) out[SLICE_ATTRS.viewY] = num(now.view.y);

    const hidden = Object.entries(now.visibility)
        .filter(([id, on]) => !on && home.visibility[id] !== false)
        .map(([id]) => id);
    const shown = Object.entries(now.visibility)
        .filter(([id, on]) => on && home.visibility[id] === false);
    if (hidden.length || shown.length) out[SLICE_ATTRS.hide] = hidden.join(",");
    return out;
}

/** What the slice attributes on a container say. Absent parts stay absent. */
export function readSlices(el: Element): {
    gamma?: {
        exact: number[]; den: number; locked: number; generation: number;
        symmetry: boolean; guard: boolean;
    };
    off?: number[];
    lines?: (number | null)[];
    isolated?: number | null;
    view?: Partial<{ scale: number; x: number; y: number }>;
    hide?: string[];
} {
    const at = (name: string) => el.getAttribute(name);
    const out: ReturnType<typeof readSlices> = {};
    const raw = at(SLICE_ATTRS.gamma);
    if (raw) {
        const exact = raw.split(",").map((s) => Number(s.trim()));
        const den = Number(at(SLICE_ATTRS.den));
        // A γ with a bad numerator or no denominator is not a γ, and §9.5 says
        // refuse rather than guess: half a grid is worse than none.
        if (exact.every(Number.isFinite) && Number.isFinite(den) && den > 0) {
            out.gamma = {
                exact, den,
                locked: Number(at(SLICE_ATTRS.locked) ?? -1),
                generation: Number(at(SLICE_ATTRS.generation) ?? 0) || 0,
                symmetry: at(SLICE_ATTRS.symmetry) !== null,
                guard: at(SLICE_ATTRS.guard) !== null,
            };
            if (!Number.isFinite(out.gamma.locked)) out.gamma.locked = -1;
        }
    }
    const off = at(SLICE_ATTRS.off);
    if (off !== null) {
        out.off = off.split(",").map((s) => Number(s.trim()))
            .filter((i) => Number.isInteger(i) && i >= 0);
    }
    const lines = at(SLICE_ATTRS.lines);
    if (lines !== null) {
        const pairs: (number | null)[] = [];
        for (const part of lines.split(",").filter(Boolean)) {
            const [i, l] = part.split(":").map((s) => Number(s.trim()));
            if (Number.isInteger(i) && Number.isFinite(l)) pairs[i] = l;
        }
        out.lines = pairs;
    }
    const iso = at(SLICE_ATTRS.isolated);
    if (iso !== null) out.isolated = iso === "" ? null : Number(iso);

    const view: Partial<{ scale: number; x: number; y: number }> = {};
    for (const [key, name] of [["scale", SLICE_ATTRS.scale],
                               ["x", SLICE_ATTRS.viewX],
                               ["y", SLICE_ATTRS.viewY]] as const) {
        const v = Number(at(name));
        if (at(name) !== null && Number.isFinite(v)) view[key] = v;
    }
    if (Object.keys(view).length) out.view = view;

    const hide = at(SLICE_ATTRS.hide);
    if (hide !== null) out.hide = hide.split(",").map((s) => s.trim()).filter(Boolean);
    return out;
}

/**
 * The embed string: one element carrying everything that differs from home.
 *
 * A boolean is written bare, the way HTML means it. The attributes come out in
 * a stable order — the inventory's, then the slices' — so two copies of the
 * same setup are the same string and a diff between two setups is readable.
 */
export function embedString(
    attrs: Record<string, string>,
    opts: { tag?: string; id?: string; width?: number; height?: number } = {},
): string {
    const tag = opts.tag ?? "div";
    const parts: string[] = [];
    if (opts.id) parts.push(`id="${opts.id}"`);
    if (opts.width) parts.push(`data-width="${opts.width}"`);
    if (opts.height) parts.push(`data-height="${opts.height}"`);
    for (const [name, value] of Object.entries(attrs)) {
        parts.push(value === "" ? name : `${name}="${value}"`);
    }
    // Wrapped, because sixty attributes on one line is not something anyone can
    // read or paste into a template with any confidence.
    const indent = " ".repeat(tag.length + 2);
    const lines: string[] = [];
    let line = "";
    for (const part of parts) {
        if (line && line.length + part.length + 1 > 76) { lines.push(line); line = ""; }
        line = line ? `${line} ${part}` : part;
    }
    if (line) lines.push(line);
    return `<${tag} ${lines.join(`\n${indent}`)}></${tag}>`;
}
