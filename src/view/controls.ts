// Sliders wired to a view's state. Small, but every page was repeating it.

import type { GrowthHandle, GrowthState } from "./growth.js";
import type { GammaSet } from "../geometry/gamma.js";
import { describeSum } from "../geometry/gamma.js";
import { createGammaBank } from "../ui/dials.js";
import type { GammaBank } from "../ui/dials.js";

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
    },
): GammaBank {
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
