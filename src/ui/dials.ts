// A bank of linked sliders, one of which is computed from the others.
//
// Knows nothing about pentagrids: it is a view over a vector of numbers with one
// index held as the dependent one. The page owns the values and decides what the
// constraint is — here that is Σγ = 0, but the bank neither knows nor cares.
//
// It reports intent and renders state. It never computes the locked value.

export interface GammaBankState {
    values: readonly number[];
    /** Which index is computed from the others. */
    locked: number;
    /** Shown alongside; the page decides what it means. */
    sum: number;
}

export interface GammaBankOptions {
    count: number;
    /** One per index, used for the label, the slider accent and the readout. */
    colors: readonly string[];
    min?: number;
    max?: number;
    step?: number;
    /** The user dragged slider `index` to `value`. */
    onChange: (index: number, value: number) => void;
    /** The user asked for `index` to become the computed one. */
    onLock: (index: number) => void;
}

export interface GammaBank {
    element: HTMLElement;
    /** Render the given state. Cheap, and safe to call on every draw. */
    sync: (s: GammaBankState) => void;
}

export function createGammaBank(opts: GammaBankOptions): GammaBank {
    const { count, colors } = opts;
    const element = document.createElement("div");
    element.className = "controls";

    const inputs: HTMLInputElement[] = [];
    const displays: HTMLSpanElement[] = [];
    const wraps: HTMLDivElement[] = [];

    for (let j = 0; j < count; j++) {
        const div = document.createElement("div");
        div.className = "dial";

        const label = document.createElement("label");
        label.innerHTML = `<span style="color:${colors[j]}">γ<sub>${j}</sub></span>`;
        label.style.cursor = "pointer";
        label.title = `Lock γ${j} (compute from others)`;
        label.addEventListener("click", () => opts.onLock(j));

        const input = document.createElement("input");
        input.type = "range";
        input.min = String(opts.min ?? -2);
        input.max = String(opts.max ?? 2);
        input.step = String(opts.step ?? 0.01);
        input.value = "0";
        input.style.accentColor = colors[j];
        input.addEventListener("input", () => opts.onChange(j, parseFloat(input.value)));

        const display = document.createElement("span");
        display.className = "value";
        display.style.color = colors[j];
        display.textContent = "0.00";

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(display);
        element.appendChild(div);

        inputs.push(input);
        displays.push(display);
        wraps.push(div);
    }

    const sumSpan = document.createElement("div");
    sumSpan.className = "sum-display";
    sumSpan.textContent = "Σ = 0.00";
    element.appendChild(sumSpan);

    function sync(s: GammaBankState) {
        for (let j = 0; j < count; j++) {
            displays[j].textContent = s.values[j].toFixed(2);
            wraps[j].className = j === s.locked ? "dial computed" : "dial";
            inputs[j].disabled = j === s.locked;
            // Only the computed slider is driven from the model. Writing back to
            // the one under the user's thumb would fight the drag.
            if (j === s.locked) inputs[j].value = s.values[j].toFixed(2);
        }
        sumSpan.textContent = `Σ = ${s.sum.toFixed(4)}`;
    }

    return { element, sync };
}
