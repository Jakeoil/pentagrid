// Sliders wired to a view's state. Small, but every page was repeating it.

import type { GrowthHandle, GrowthState } from "./growth.js";
import type { GammaSet } from "../geometry/gamma.js";
import { describeSum } from "../geometry/gamma.js";
import { createGammaBank } from "../ui/dials.js";
import type { GammaBank } from "../ui/dials.js";
import { createReticulum } from "../ui/reticulum.js";
import { createSumStrip } from "../ui/sumstrip.js";
import { SINGULAR_PRESETS } from "../geometry/hunt.js";
import { createFloatingPanel } from "../ui/floating.js";
import type { FloatingPanel } from "../ui/floating.js";

/**
 * What every gamma control is, whichever one a page picks.
 *
 * The dial bank and the reticulum are interchangeable — neither replaces the
 * other, and a page chooses. `GammaBank` names the dial one specifically, so
 * this is the name to use where either will do.
 */
export type GammaControl = GammaBank;

/** The state fields a range input can drive. */
type NumericKey = {
    [K in keyof GrowthState]: GrowthState[K] extends number ? K : never
}[keyof GrowthState];

/** The state fields a checkbox can drive. */
type BooleanKey = {
    [K in keyof GrowthState]: GrowthState[K] extends boolean ? K : never
}[keyof GrowthState];

export interface SliderSpec {
    /** Element id of the range input. */
    id: string;
    /** Which piece of state it drives. */
    key: NumericKey;
    /** Rendered next to it, in an element with id `${id}-value` if present. */
    format?: (v: number) => string;
}

export interface ToggleSpec {
    /** Element id of the checkbox. */
    id: string;
    key: BooleanKey;
}

/**
 * Mount the γ controls — five linked dials and a total — and wire them to a set.
 *
 * This is the seam between a page and the model: `ui/dials.ts` stays a pure view
 * that reports moves and renders what it is told, `geometry/gamma.ts` stays a
 * DOM-free model, and this is the only place that knows about both. A page
 * wanting γ controls calls this rather than building sliders of its own — which
 * is what three separate hand-wired Σγ sliders were about to become.
 */
export function mountGammaControls(
    set: GammaSet,
    container: HTMLElement,
    opts: {
        colors: readonly string[];
        sum?: boolean;
        /** Defaults to 0 … n/2, which is every family the total can name. */
        sumRange?: { min: number; max: number; step: number };
        /**
         * Which control to build. The two are plugin-interchangeable and both
         * stay: dials where space is tight or the control is incidental, the
         * reticulum where the five families are the point.
         */
        control?: "dials" | "reticulum";
    },
): GammaControl {
    if (opts.control === "reticulum") return mountReticulum(set, container, opts);
    const bank = createGammaBank({
        count: set.values().length,
        colors: opts.colors,
        // n/2 is the uniform offset ½ — the largest total worth reaching, since
        // Σγ = n·r and r is an offset mod 1. A page should not have to know that.
        sumRange: opts.sumRange ?? { min: 0, max: set.n / 2, step: 0.001 },
        onChange: (j, v) => set.setValue(j, v),
        onLock: (j) => set.setLocked(j),
        // Spreading is what makes a total control mean anything: without it the
        // locked index absorbs the whole change and you get one huge offset.
        onSum: opts.sum === false ? undefined : (v) => set.setSum(v, true),
    });
    container.appendChild(bank.element);

    const render = () => bank.sync({
        values: set.values(),
        locked: set.getLocked(),
        sum: set.values().reduce((a, b) => a + b, 0),
        // The figures describeSum can offer depend on the offsets being equal,
        // not just on their total — so it has to be told.
        sumNote: describeSum(set.getSum(), set.nudged(), set.isUniform(), set.n),
    });
    set.onChange(render);
    render();
    return bank;
}

/**
 * Bind one range input to an arbitrary setter. `bindSliders` covers a growth
 * view's own state; this is for controls that drive something else — the γ set,
 * say, which the view holds but does not own.
 */
export function bindRange(
    id: string,
    onChange: (v: number) => void,
    format?: (v: number) => string,
) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    const label = document.getElementById(`${id}-value`);
    const apply = () => {
        const v = parseFloat(input.value);
        if (!Number.isFinite(v)) return;
        onChange(v);
        if (label && format) label.textContent = format(v);
    };
    input.addEventListener("input", apply);
    apply();
}

/** Bind range inputs to a growth view, and push their initial values in. */
export function bindSliders(view: GrowthHandle, specs: readonly SliderSpec[]) {
    for (const spec of specs) {
        const input = document.getElementById(spec.id) as HTMLInputElement | null;
        if (!input) continue;
        const label = document.getElementById(`${spec.id}-value`);
        const apply = () => {
            const v = parseFloat(input.value);
            if (!Number.isFinite(v)) return;
            view.set({ [spec.key]: v } as Partial<GrowthState>);
            if (label && spec.format) label.textContent = spec.format(v);
        };
        input.addEventListener("input", apply);
        apply();
    }
}

/** Bind checkboxes to a growth view, and push their initial values in. */
export function bindToggles(view: GrowthHandle, specs: readonly ToggleSpec[]) {
    for (const spec of specs) {
        const input = document.getElementById(spec.id) as HTMLInputElement | null;
        if (!input) continue;
        const apply = () => {
            view.set({ [spec.key]: !!input.checked } as Partial<GrowthState>);
        };
        input.addEventListener("change", apply);
        apply();
    }
}

/**
 * Mount the reticulum against the same set, and hand back the same handle type.
 *
 * The set is passed `model.directions` live rather than copied: the model mutates
 * its arrays in place and never replaces them, so turning the star with
 * `setSymmetry` is picked up on the next draw with no re-mount.
 */
export function mountReticulum(
    set: GammaSet,
    container: HTMLElement,
    opts: {
        colors: readonly string[];
        /** Told the name of a preset once it has been applied. */
        onPreset?: (name: string) => void;
    },
): GammaControl {
    /**
     * Symmetric mode: every offset is the same g, so the control is one knob.
     *
     * It releases the sum, and has to. Equal offsets with a held total can only
     * meet at the discrete values g = k/n, so keeping the constraint would fight
     * every move; letting Σγ = n·g float is the honest coupling, and the Penrose
     * flag then lights at exactly those k/n where the condition is met.
     */
    let symmetric = false;

    const ret = createReticulum({
        count: set.values().length,
        directions: set.model.directions as readonly (readonly [number, number])[],
        colors: opts.colors,
        onChange: (j, v) => {
            if (!symmetric) { set.setValue(j, v); return; }
            set.setValues(new Array(set.values().length).fill(v));
        },
        // -1 is Sigma itself: hold nothing, and every offset goes free.
        onLock: (j) => { if (!symmetric) set.setLocked(j); },
    });

    const wrap = document.createElement("div");
    wrap.className = "reticulum-wrap";
    wrap.appendChild(ret.element);

    // Sigma gets a handle of its own, not a line of text: the offsets each have a
    // whole axis to move along and the total is the same kind of quantity. The
    // span is symmetric so 0 sits in the middle — the old 0..n/2 range clamped at
    // the bottom, which made the wheel dead downwards at the default Σγ = 0.
    const strip = createSumStrip({
        onChange: (v) => set.setSum(v, true),
        onRelease: () => set.setLocked(-1),
    });
    wrap.appendChild(strip.element);

    const tools = document.createElement("div");
    tools.className = "ret-tools";

    const symBox = document.createElement("label");
    symBox.className = "ret-check";
    const symInput = document.createElement("input");
    symInput.type = "checkbox";
    symInput.addEventListener("change", () => {
        symmetric = symInput.checked;
        if (symmetric) {
            // Nothing can hold the total while all n move together.
            set.setLocked(-1);
            const g = set.values()[Math.max(ret.selected(), 0)] ?? 0;
            set.setValues(new Array(set.values().length).fill(g));
        }
        render();
    });
    symBox.appendChild(symInput);
    symBox.appendChild(document.createTextNode(" symmetric"));
    tools.appendChild(symBox);

    // The presets, behind a button: a popup of the caps and the singularity
    // catalog. Jake's list and order. A preset is the whole phase vector, so it
    // releases the total first, as the Caps/Hunt rows did; the name goes back to
    // the caller, which puts it on the title bar.
    const PRESET_ORDER = ["sun", "star", "deca", "decagon", "couple",
                          "octagon", "1 thick", "2 thick", "1 thin", "2 thin"];
    const presetBtn = document.createElement("button");
    presetBtn.className = "ret-bump";
    presetBtn.textContent = "presets";
    presetBtn.title = "The caps and the singularity catalog";
    const popup = document.createElement("div");
    popup.className = "ret-presets";
    popup.hidden = true;
    for (const name of PRESET_ORDER) {
        const p = SINGULAR_PRESETS.find((q) => q.name === name);
        if (!p) continue;
        const b = document.createElement("button");
        b.type = "button";
        b.className = p.penrose ? "preset" : "preset not-penrose";
        b.textContent = p.name;
        b.title = p.note;
        b.addEventListener("click", () => {
            symmetric = false;
            symInput.checked = false;
            set.setLocked(-1);
            set.setValues(p.gamma.map((q) => q / p.den));
            // The popup stays up, like settings: dismissed by its own button,
            // so a run through the catalog is one click per entry. Jake.
            opts.onPreset?.(p.name);
            render();
        });
        popup.appendChild(b);
    }
    presetBtn.addEventListener("click", () => {
        popup.hidden = !popup.hidden;
        if (!popup.hidden) settings.hidden = true;
    });
    tools.appendChild(presetBtn);

    // Settings, behind a button of the same kind: things about the instrument
    // itself rather than a phase vector. One so far.
    const settingsBtn = document.createElement("button");
    settingsBtn.className = "ret-bump";
    settingsBtn.textContent = "settings";
    settingsBtn.title = "How the reticulum and the grid are laid out";
    const settings = document.createElement("div");
    settings.className = "ret-presets ret-settings";
    settings.hidden = true;
    {
        // Vertical-axis symmetry: the star turned a quarter turn so v0 points
        // up and the picture is mirror-symmetric about the vertical. A
        // rotation of the frame and nothing else — see makeDirections.
        const lbl = document.createElement("label");
        lbl.className = "ret-check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = set.getSymmetry();
        cb.title = "Turn the star a quarter turn so v\u2080 points up and the picture "
            + "is mirror-symmetric about the vertical axis. A rotation of the whole "
            + "frame: nothing about the tiling changes but its orientation.";
        cb.addEventListener("change", () => set.setSymmetry(cb.checked));
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(" vertical-axis symmetry"));
        settings.appendChild(lbl);
        set.onChange(() => { cb.checked = set.getSymmetry(); });
    }
    settingsBtn.addEventListener("click", () => {
        settings.hidden = !settings.hidden;
        if (!settings.hidden) popup.hidden = true;
    });
    tools.appendChild(settingsBtn);

    wrap.appendChild(tools);
    wrap.appendChild(popup);
    wrap.appendChild(settings);
    container.appendChild(wrap);

    const render = () => {
        const values = set.values();
        const sum = values.reduce((a, b) => a + b, 0);
        const locked = set.getLocked();
        ret.sync({ values, locked, sum });
        strip.sync({ sum, released: locked < 0 });
    };
    set.onChange(render);
    render();
    return { element: wrap, sync: () => render() };
}

export interface FloatingReticulumOptions {
    colors: readonly string[];
    /** Where the "γ reticulum" and "γ sliders" buttons go. */
    buttons: HTMLElement;
    /** The slider bank to fold, if the page has one. */
    sliders?: HTMLElement;
    /** Start with the sliders folded away. Default true: the reticulum is usually
     *  the instrument you want in front of you. */
    foldSliders?: boolean;
}

/**
 * The reticulum as a floating instrument, with its two buttons.
 *
 * It floats because it is something you want beside whichever part of the
 * picture you are looking at, not a thing pinned under the controls. Drag it by
 * the bar; it remembers where you put it. Closing it is not a one-way door: the
 * "γ reticulum" button appears the moment it is shut. The slider bank, being a
 * lot of screen for something you set and forget, folds behind "γ sliders".
 *
 * One implementation for method.html and grow.html, so they cannot drift.
 */
export function mountFloatingReticulum(
    set: GammaSet, opts: FloatingReticulumOptions,
): { panel: FloatingPanel; control: GammaControl } {
    const reopen = document.createElement("button");
    reopen.type = "button";
    reopen.className = "reopen-panel";
    reopen.textContent = "γ reticulum";
    reopen.title = "Show the reticulum again";
    reopen.hidden = true;

    const panel = createFloatingPanel({
        id: "reticulum",
        title: "Reticulum · γ",
        onClose: () => { reopen.hidden = false; },
    });
    document.body.appendChild(panel.element);
    const control = mountReticulum(set, panel.body, {
        colors: opts.colors,
        // The selected preset's name replaces the title. Jake's spec.
        onPreset: (name) => panel.setTitle(name),
    });

    reopen.addEventListener("click", () => {
        panel.show();
        reopen.hidden = true;
    });
    opts.buttons.appendChild(reopen);

    if (opts.sliders) {
        const sliders = opts.sliders;
        const fold = document.createElement("button");
        fold.type = "button";
        fold.className = "fold-controls";
        let folded = opts.foldSliders ?? true;
        const paint = () => {
            sliders.classList.toggle("folded", folded);
            fold.textContent = folded ? "▸ γ sliders" : "▾ γ sliders";
        };
        fold.addEventListener("click", () => { folded = !folded; paint(); });
        paint();
        opts.buttons.appendChild(fold);
    }

    return { panel, control };
}
