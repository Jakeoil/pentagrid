// Sliders wired to a view's state. Small, but every page was repeating it.

import type { GrowthHandle, GrowthState } from "./growth.js";
import type { GammaSet } from "../geometry/gamma.js";
import { describeSum } from "../geometry/gamma.js";
import { createGammaBank } from "../ui/dials.js";
import type { GammaBank } from "../ui/dials.js";
import { createReticulum } from "../ui/reticulum.js";

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
    opts: { colors: readonly string[] },
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

    // Sigma is the (n+1)th member of the lock group, and this is where it lives:
    // reading the total and releasing it are the same control. It was briefly a
    // hub at the centre of the decagon, which put it in the way of the geometry
    // and left nothing at the origin but clutter.
    const readout = document.createElement("div");
    readout.className = "ret-readout";
    readout.style.cursor = "pointer";
    readout.title = "Click to release the total — every γ free";
    readout.addEventListener("click", () => set.setLocked(-1));
    wrap.appendChild(readout);

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

    // An explicit way off a singular configuration. Not automatic: the guard is
    // off by default now, and moving someone's offsets uninvited hides the very
    // cases worth looking at.
    const bump = (dir: number, text: string) => {
        const b = document.createElement("button");
        b.className = "ret-bump";
        b.textContent = text;
        b.title = `Nudge the selected γ ${dir > 0 ? "up" : "down"} by one unit `
            + `(${(1 / set.denominator).toExponential(0)}) — off the singular set`;
        b.addEventListener("click", () => {
            const j = ret.selected();
            if (j < 0) return;
            if (symmetric) {
                const v = (set.values()[j] ?? 0) + dir / set.denominator;
                set.setValues(new Array(set.values().length).fill(v));
            } else {
                set.bump(j, dir);
            }
        });
        return b;
    };
    tools.appendChild(bump(-1, "bump −"));
    tools.appendChild(bump(+1, "bump +"));
    wrap.appendChild(tools);
    container.appendChild(wrap);

    const render = () => {
        const values = set.values();
        const sum = values.reduce((a, b) => a + b, 0);
        const locked = set.getLocked();
        ret.sync({ values, locked, sum });
        const frac = ((sum % 1) + 1) % 1;
        // Sigma-gamma mod 1 is the LI class, so it earns its place whenever it
        // differs from the total itself.
        const modPart = Math.abs(frac - sum) < 1e-9 ? "" : ` · mod 1 = ${frac.toFixed(3)}`;
        readout.textContent = `Σγ = ${sum.toFixed(3)}${modPart}`;
        // Greyed exactly when it is the dependent member, like a greyed label.
        readout.className = "ret-readout" + (locked < 0 ? " released" : "");
        readout.style.cursor = symmetric ? "default" : "pointer";
    };
    set.onChange(render);
    render();
    return { element: wrap, sync: () => render() };
}
