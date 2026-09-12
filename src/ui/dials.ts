import { wheelNotch } from "./wheel.js";

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
    /**
     * Wheel over a dial to nudge it. A slider is hopeless at hundredths — the
     * whole -2..2 range is a couple of hundred pixels — and the offsets that
     * matter sit at exact rationals like 1/5, so there has to be a way to walk
     * onto one rather than aim for it.
     */
    wheelStep?: number;
    /** With shift held. */
    wheelFine?: number;
}

export interface GammaBank {
    element: HTMLElement;
    /** Render the given state. Cheap, and safe to call on every draw. */
    sync: (s: GammaBankState) => void;
}

/** Enough decimals to show the exact value: gamma is rationals over 10^4. */
const EXACT_DP = 6;

export function createGammaBank(opts: GammaBankOptions): GammaBank {
    const { count, colors } = opts;
    const step = opts.wheelStep ?? 0.01;
    const fine = opts.wheelFine ?? 0.001;
    const element = document.createElement("div");
    element.className = "controls";

    const inputs: HTMLInputElement[] = [];
    const displays: HTMLSpanElement[] = [];
    const wraps: HTMLDivElement[] = [];
    /** Last synced values, so a wheel notch knows what it is nudging from. */
    let current: readonly number[] = new Array(count).fill(0);
    let lockedNow = count - 1;
    let active = -1;
    /**
     * Which slider is under a held pointer, or -1.
     *
     * This used to ask `document.activeElement`, which is wrong: a slider stays
     * FOCUSED after you let go of it, so once you had clicked a dial its thumb
     * never followed the model again — the wheel moved the number and left the
     * thumb behind. Focus is not the question; a held pointer is.
     */
    let dragging = -1;
    let sumDragging = false;

    /** One notch: hundredths, thousandths with a modifier. See ui/wheel.ts. */
    const notch = (e: WheelEvent) => wheelNotch(e, { step, fine });

    /**
     * Offsets are shown modulo 1, because that is all of an offset there is:
     * K_j = ceil(x·v_j + γ_j), so a whole turn renumbers that family's lines and
     * leaves the grid exactly where it was.
     *
     * Only the DISPLAY wraps. The stored value runs on. Wrapping the value itself
     * looks equivalent and is not, once an index is holding the sum: wheeling γ₀
     * from 0.99 to 1.00 is a harmless notch, but recording it as 0.00 keeps Σγ
     * nominally put and makes the locked offset absorb -0.99 — a real move of
     * another family, which showed up as the whole bank jumping once per lap.
     */
    const mod1 = (x: number) => ((x % 1) + 1) % 1;

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
        // One full turn, and no more: -2..2 spent three quarters of the travel on
        // offsets indistinguishable from ones already in [0,1).
        input.min = String(opts.min ?? 0);
        input.max = String(opts.max ?? 1);
        // Fine enough that a wheel-set thousandth survives being written back:
        // a range input snaps `.value` onto its step grid.
        input.step = String(opts.step ?? 0.001);
        input.value = "0";
        input.style.accentColor = colors[j];
        input.addEventListener("input", () => opts.onChange(j, parseFloat(input.value)));
        input.addEventListener("pointerdown", () => { dragging = j; });
        input.addEventListener("pointerup", () => { dragging = -1; });
        input.addEventListener("pointercancel", () => { dragging = -1; });

        const display = document.createElement("span");
        display.className = "value";
        display.style.color = colors[j];
        display.textContent = "0.00";

        div.addEventListener("wheel", (e) => {
            const w = e as WheelEvent;
            if (j === lockedNow) return;      // computed from the others; not driven
            w.preventDefault();               // and do not scroll the page with it
            active = j;
            opts.onChange(j, current[j] + notch(w));
        }, { passive: false });

        div.appendChild(label);
        div.appendChild(input);
        div.appendChild(display);
        element.appendChild(div);

        inputs.push(input);
        displays.push(display);
        wraps.push(div);
    }

    // Sigma is the sixth member of the lock group, here as in the reticulum:
    // click it and nothing holds the total, so every offset is free at once.
    const sumSpan = document.createElement("div");
    sumSpan.className = "sum-display";
    sumSpan.textContent = "Σ = 0.00";
    sumSpan.title = "Release the total — every γ free";
    sumSpan.style.cursor = "pointer";
    sumSpan.addEventListener("click", () => opts.onLock(-1));
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
        sumInput.addEventListener("pointerdown", () => { sumDragging = true; });
        sumInput.addEventListener("pointerup", () => { sumDragging = false; });
        sumInput.addEventListener("pointercancel", () => { sumDragging = false; });
        wrap.addEventListener("wheel", (e) => {
            const w = e as WheelEvent;
            w.preventDefault();
            active = -1;
            // Not wrapped: the sum is not an offset. Its distinguished values are
            // spread over 0..n/2 and wrapping would jump between them.
            const lo = parseFloat(sumInput!.min), hi = parseFloat(sumInput!.max);
            const next = parseFloat(sumInput!.value) + notch(w);
            opts.onSum!(Math.min(hi, Math.max(lo, next)));
        }, { passive: false });
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
        current = s.values;
        lockedNow = s.locked;
        for (let j = 0; j < count; j++) {
            // Three places, because a shift-wheel notch moves the third one and a
            // control whose number does not answer the gesture reads as broken.
            displays[j].textContent = mod1(s.values[j]).toFixed(3);
            // Hover gives the exact value as carried — unwrapped, so a γ that has
            // been wheeled past a turn admits it rather than pretending to be
            // small. The readout above is the same number modulo 1.
            displays[j].title = s.values[j].toFixed(EXACT_DP);
            wraps[j].className = "dial"
                + (j === s.locked ? " computed" : "")
                + (j === active ? " active" : "");
            inputs[j].disabled = j === s.locked;
            // Write back to every slider except the one actually being dragged, so
            // a wheel notch moves the thumb as well as the number.
            // The thumb tracks the offset modulo 1, so it wraps round the ends of
            // its travel like a compass instead of running off them.
            if (dragging !== j) inputs[j].value = mod1(s.values[j]).toFixed(EXACT_DP);
        }
        sumSpan.textContent = `Σ = ${s.sum.toFixed(4)}`;
        // Greyed when it is the one being held free, matching the dials.
        sumSpan.className = "sum-display" + (s.locked < 0 ? " computed" : "");
        // Same rule: only a held pointer stops the write-back.
        if (sumInput && !sumDragging) sumInput.value = s.sum.toFixed(EXACT_DP);
        sumSpan.title = s.sum.toFixed(EXACT_DP);
        if (sumNote) sumNote.textContent = s.sumNote ?? "";
    }

    return { element, sync };
}
