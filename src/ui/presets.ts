// Preset buttons for the caps and the singularity catalog.
//
// Shared, because both method.html and grow.html want them and they must agree:
// the label on a button is checked against the exact rule AND against the scan in
// the tests, so two copies would be two things to keep honest.

import type { GammaSet } from "../geometry/gamma.js";
import { SINGULAR_PRESETS } from "../geometry/hunt.js";
import type { SingularPreset } from "../geometry/hunt.js";

/**
 * Append the buttons of one group to `host`.
 *
 * `after` runs once the phases have landed, so the caller can redraw whatever it
 * owns. Every preset sets the phase vector outright; a preset whose total is not
 * an integer releases the lock first, or the locked index would quietly absorb
 * the difference and the button would not do what it says.
 */
export function addPresets(
    host: HTMLElement, group: SingularPreset["group"],
    gamma: GammaSet, after: () => void,
    /** Keep only these presets, by name. Omitted means the whole group. */
    only?: readonly string[],
): void {
    for (const p of SINGULAR_PRESETS) {
        if (p.group !== group) continue;
        if (only && !only.includes(p.name)) continue;
        const b = document.createElement("button");
        b.className = p.penrose ? "preset" : "preset not-penrose";
        b.textContent = p.name;
        b.title = p.note;
        b.addEventListener("click", () => {
            // Always release the total first. A preset IS the whole phase vector,
            // so holding a total on top of it can only fight: the stored target is
            // an exact number, not a class mod 1, and the uniform caps sum to 1
            // and 2 — a locked index would have rewritten sun's 1/5 into -4/5 to
            // keep a total of zero it was never asked to keep.
            gamma.setLocked(-1);
            gamma.setValues(p.gamma.map((q) => q / p.den));
            after();
        });
        host.appendChild(b);
    }
}
