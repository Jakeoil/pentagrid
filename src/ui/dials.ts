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
    /** Optional words for the sum — again the page's business, not the bank's. */
    sumNote?: string;
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
    /**
     * Supply this and the bank grows a slider for the total. Like the rest of it,
     * the bank only reports the move — what a total means, and whether changing
     * it should redistribute the values, is the page's business.
     */
    onSum?: (sum: number) => void;
    sumRange?: { min: number; max: number; step: number };
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

    let sumInput: HTMLInputElement | null = null;
    let sumNote: HTMLElement | null = null;
    if (opts.onSum) {
        const r = opts.sumRange ?? { min: 0, max: 2.5, step: 0.05 };
        const wrap = document.createElement("div");
        wrap.className = "dial sum-dial";
        sumInput = document.createElement("input");
        sumInput.type = "range";
        sumInput.min = String(r.min);
        sumInput.max = String(r.max);
        sumInput.step = String(r.step);
        sumInput.value = "0";
        sumInput.addEventListener("input", () => opts.onSum!(parseFloat(sumInput!.value)));
        const cap = document.createElement("div");
        cap.className = "sum-cap";
        cap.textContent = "Σγ";
        wrap.appendChild(cap);
        wrap.appendChild(sumInput);
        element.appendChild(wrap);

        // The note is a sibling of the dials, not a child of one. Inside the
        // flex item its text length set the item's width, and the text changes
        // length as the slider moves — so the whole bar reflowed on every step.
        // On its own row it can say what it likes.
        sumNote = document.createElement("div");
        sumNote.className = "sum-note";
        element.appendChild(sumNote);
    }

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
        // Only written when the user is not holding it, same reason as the
        // computed slider: writing back mid-drag fights the drag.
        if (sumInput && document.activeElement !== sumInput) {
            sumInput.value = s.sum.toFixed(2);
        }
        if (sumNote) sumNote.textContent = s.sumNote ?? "";
    }

    return { element, sync };
}
