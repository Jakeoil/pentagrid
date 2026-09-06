// Sliders wired to a view's state. Small, but every page was repeating it.

import type { GrowthHandle, GrowthState } from "./growth.js";

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
