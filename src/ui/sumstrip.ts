// Sigma's handle: one turn of phase, laid out flat.
//
// Gamma is a PHASE, not a scalar — an angle, in effect, and the read-outs round
// the decagon say so by running 000..999 and wrapping. The total is the same kind
// of quantity, so it gets the same kind of read-out and the same kind of touch:
// one turn across, graduated at the fifths, wheel and drag exactly as an axis.
//
// Sigma-gamma mod 1 is also the thing that means something — it is the LI class —
// so the phase is the number worth showing. The unwrapped total is on hover.
//
// A pure view. It reports moves and renders what it is told.

import { wheelNotch } from "./wheel.js";

const NS = "http://www.w3.org/2000/svg";
const W = 100;
const H = 17;
const BASE = 11;
const L = 12, R = W - 21;

const el = (tag: string): SVGElement => document.createElementNS(NS, tag) as SVGElement;
const attrs = (n: SVGElement, a: Record<string, string | number>) => {
    for (const k of Object.keys(a)) n.setAttribute(k, String(a[k]));
    return n;
};
const phase = (x: number) => ((x % 1) + 1) % 1;

export interface SumStripState {
    sum: number;
    /** True when nothing holds the total, so it is the dependent member. */
    released: boolean;
}

export interface SumStripOptions {
    wheelStep?: number;
    wheelFine?: number;
    onChange: (sum: number) => void;
    /** The Σ symbol was pressed: make the total the dependent member. */
    onRelease?: () => void;
}

/** How long the refusal shows for. */
const WARN_MS = 420;

export interface SumStrip {
    element: SVGSVGElement;
    sync: (s: SumStripState) => void;
}

export function createSumStrip(opts: SumStripOptions): SumStrip {
    const step = opts.wheelStep ?? 0.01;
    const fine = opts.wheelFine ?? 0.001;

    const svg = el("svg") as SVGSVGElement;
    attrs(svg, { viewBox: `0 0 ${W} ${H}`, class: "sumstrip", role: "group",
                 "aria-label": "total phase" });

    const hit = attrs(el("rect"), { x: 0, y: 0, width: W, height: H,
                                    class: "ss-hit", fill: "transparent" });
    svg.appendChild(hit);

    // The scale: a light grey bed under the whole turn, graduated at the fifths.
    const bed = attrs(el("rect"), { x: L, y: BASE - 3.2, width: R - L, height: 6.4,
                                    rx: 1, class: "ss-bed" });
    svg.appendChild(bed);
    const ticks = attrs(el("g"), { class: "ss-ticks" });
    for (let k = 1; k <= 4; k++) {
        const x = L + (k / 5) * (R - L);
        ticks.appendChild(attrs(el("line"),
            { x1: x, y1: BASE - 3.2, x2: x, y2: BASE + 3.2, class: "ss-tick" }));
    }
    svg.appendChild(ticks);

    const marker = attrs(el("line"), { class: "ss-marker", y1: BASE - 4.6, y2: BASE + 4.6 });
    svg.appendChild(marker);

    const sigma = attrs(el("text"), { x: 2, y: BASE, class: "ss-sigma",
                                      "dominant-baseline": "middle" });
    sigma.textContent = "Σ";
    sigma.addEventListener("pointerdown", (e) => {
        (e as PointerEvent).stopPropagation?.();
        opts.onRelease?.();
    });
    svg.appendChild(sigma);

    const readout = attrs(el("text"), { x: W - 1, y: BASE, class: "ss-readout",
                                        "text-anchor": "end",
                                        "dominant-baseline": "middle" });
    svg.appendChild(readout);

    let current = 0;
    let released = false;
    let dragging = false;
    let from = 0;
    let warnTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Refuse a change, loudly.
     *
     * When the total is released it is not a value you set — it is whatever the
     * offsets happen to add up to. Greying the bar said "fine, carry on" in the
     * same visual language as everything else that is merely inactive, so a push
     * against it read as working. This says no.
     */
    function refuse() {
        svg.setAttribute("class", "sumstrip released warn");
        if (warnTimer) clearTimeout(warnTimer);
        warnTimer = setTimeout(() => {
            warnTimer = null;
            svg.setAttribute("class", "sumstrip" + (released ? " released" : ""));
        }, WARN_MS);
    }

    const at = (e: { clientX: number }) => {
        const r = svg.getBoundingClientRect();
        return !r || !r.width ? 0 : (e.clientX - r.left) / r.width * W;
    };

    hit.addEventListener("wheel", (ev) => {
        const e = ev as WheelEvent;
        e.preventDefault();                 // never scroll the page from in here
        const d = wheelNotch(e, { step, fine });
        if (d === 0) return;
        if (released) { refuse(); return; }
        opts.onChange(current + d);
    }, { passive: false });

    hit.addEventListener("pointerdown", (ev) => {
        const e = ev as PointerEvent;
        if (released) { refuse(); return; }
        dragging = true;
        from = at(e);
        hit.setPointerCapture?.(e.pointerId);
    });
    hit.addEventListener("pointermove", (ev) => {
        if (!dragging) return;
        const x = at(ev as PointerEvent);
        // One turn across the bed, so the touch matches an axis of the decagon.
        opts.onChange(current + (x - from) / (R - L));
        from = x;
    });
    const end = () => { dragging = false; };
    hit.addEventListener("pointerup", end);
    hit.addEventListener("pointercancel", end);

    function sync(s: SumStripState) {
        current = s.sum;
        released = s.released;
        const p = phase(s.sum);
        const x = L + p * (R - L);
        attrs(marker, { x1: x, x2: x });
        readout.textContent = String(Math.round(p * 1000) % 1000).padStart(3, "0");
        if (!warnTimer) {
            svg.setAttribute("class", "sumstrip" + (s.released ? " released" : ""));
        }
        // The unwrapped total still decides which Penrose representative you have,
        // so it is a hover away rather than gone.
        const t = `Σγ = ${s.sum.toFixed(4)} · phase ${readout.textContent}`;
        svg.setAttribute("aria-label", t);
        readout.setAttribute("title", t);
    }

    sync({ sum: 0, released: false });
    return { element: svg, sync };
}
