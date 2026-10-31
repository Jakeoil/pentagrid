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

import { wheelNotch, snapStep, snapStepWith, makeNotchGate } from "./wheel.js";

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

/**
 * The thirds, which are stops.
 *
 * Σγ mod 1 is the LI class, and 1/3 is special: deflation is `s ↦ −2s`, so it
 * holds 1/3 and holds 2/3, and inflation is `s ↦ 2s`, so it swaps them. With 0
 * (Penrose) that is the whole fixed set — every other class wanders. Jake,
 * 2026-10-31: "1/3 is a very special class (sum) put a stop at the 1/3 and 2/3
 * mark on the sum... Note that inflation will alternate between 1/3 and 2/3."
 *
 * They are exact, not nearly: γ is carried as rationals over a denominator
 * divisible by 3, so a third is a whole numerator and the alternation above
 * runs forever without drift.
 */
const THIRDS = [1 / 3, 2 / 3] as const;

/** Near enough to BE a third: the arithmetic is exact, so this only eats float dust. */
const THIRD_TOL = 1e-9;

/**
 * How wide the detent is to a dragging thumb, in turns.
 *
 * A notch finds a third by arithmetic, but a drag is continuous and would pass
 * through it: one turn is about 88 units across, so this is a half-unit catch
 * either side — a stop you can feel, and the only way to land on a third by
 * hand.
 */
const CATCH = 0.006;

/** Which third this phase is, if any. */
const whichThird = (p: number): number | undefined =>
    THIRDS.find((t) => Math.abs(p - t) < THIRD_TOL);

/** The exact third a freely dragged value should fall into, if one is in reach. */
function catchThird(x: number): number {
    const k = Math.floor(x);
    for (const t of THIRDS) {
        if (Math.abs(x - (k + t)) < CATCH) return k + t;
        // The turn above, for a drag that crossed the wrap.
        if (Math.abs(x - (k + 1 + t)) < CATCH) return k + 1 + t;
    }
    return x;
}

export interface SumStripState {
    sum: number;
    /** True when nothing holds the total, so it is the dependent member. */
    released: boolean;
    /**
     * Snap the wheel and the drag to multiples of this instead of the fine
     * steps. Symmetric mode with the total driving uses 1: the five offsets are
     * all Σγ/n, so the settings worth stopping at are the integer totals — the
     * Penrose members of the uniform family, c = 0, 1/5, 2/5, 3/5, 4/5 — and a
     * hundredth at a time would never land on one. Shift still gives ½, the
     * flower.
     */
    snap?: number;
}

export interface SumStripOptions {
    /** How many families: the turn is graduated at the nths and read in 200n units. Default 5. */
    count?: number;
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
    const count = opts.count ?? 5;
    const UNITS = 200 * count;                 // 1000 at five: the thousandths
    const step = opts.wheelStep ?? 1 / (2 * count);
    const fine = opts.wheelFine ?? 1 / UNITS;

    const svg = el("svg") as SVGSVGElement;
    attrs(svg, { viewBox: `0 0 ${W} ${H}`, class: "sumstrip", role: "group",
                 "aria-label": "total phase" });

    const hit = attrs(el("rect"), { x: 0, y: 0, width: W, height: H,
                                    class: "ss-hit", fill: "transparent" });
    svg.appendChild(hit);

    // The scale: a light gray bed under the whole turn, graduated at the nths.
    const bed = attrs(el("rect"), { x: L, y: BASE - 3.2, width: R - L, height: 6.4,
                                    rx: 1, class: "ss-bed" });
    svg.appendChild(bed);
    const ticks = attrs(el("g"), { class: "ss-ticks" });
    for (let k = 1; k < count; k++) {
        const x = L + (k / count) * (R - L);
        ticks.appendChild(attrs(el("line"),
            { x1: x, y1: BASE - 3.2, x2: x, y2: BASE + 3.2, class: "ss-tick" }));
    }
    // The thirds get their own marks, shorter and in their own color: they are
    // not graduations of the fifths and must not read as some of them.
    for (const t of THIRDS) {
        const x = L + t * (R - L);
        ticks.appendChild(attrs(el("line"),
            { x1: x, y1: BASE - 2, x2: x, y2: BASE + 2, class: "ss-tick ss-third" }));
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
    let snap: number | undefined;
    let dragging = false;
    let from = 0;
    let warnTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Refuse a change, loudly.
     *
     * When the total is released it is not a value you set — it is whatever the
     * offsets happen to add up to. Graying the bar said "fine, carry on" in the
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

    const gate = makeNotchGate();
    hit.addEventListener("wheel", (ev) => {
        const e = ev as WheelEvent;
        e.preventDefault();                 // never scroll the page from in here
        const d = wheelNotch(e, { step, fine });
        if (d === 0) return;
        if (released) { refuse(); return; }
        if (!gate(e)) return;               // the rest of a trackpad burst
        if (snap) {
            // A notch is one snap; a fine notch (any modifier) is half of one.
            const unit = Math.abs(d) <= fine * 1.5 ? snap / 2 : snap;
            opts.onChange(snapStep(current, unit, d));
            return;
        }
        // Otherwise a plain notch snaps to the next tenth, like an axis; a
        // fine one is thousandths. Both pass through the thirds: at the coarse
        // step that reads 300, 33*, 400, and at the fine one 333, 33*, 334.
        opts.onChange(snapStepWith(current, Math.abs(d) === step ? step : fine, d, THIRDS));
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
        const next = current + (x - from) / (R - L);
        opts.onChange(snap ? Math.round(next / snap) * snap : catchThird(next));
        from = x;
    });
    const end = () => { dragging = false; };
    hit.addEventListener("pointerup", end);
    hit.addEventListener("pointercancel", end);

    function sync(s: SumStripState) {
        snap = s.snap;
        current = s.sum;
        released = s.released;
        const p = phase(s.sum);
        const x = L + p * (R - L);
        attrs(marker, { x1: x, x2: x });
        const digits = String(UNITS - 1).length;
        const plain = String(Math.round(p * UNITS) % UNITS).padStart(digits, "0");
        // A third is not a whole number of these units, so it cannot be said in
        // them: the last digit becomes a star. 33* and 66* are a third and two
        // thirds EXACTLY, and are not the 333 and 667 next door to them.
        const third = whichThird(p);
        readout.textContent = third === undefined
            ? plain
            : plain.slice(0, digits - 1) + "*";
        if (!warnTimer) {
            svg.setAttribute("class", "sumstrip" + (s.released ? " released" : ""));
        }
        // The unwrapped total still decides which Penrose representative you have,
        // so it is a hover away rather than gone.
        const t = `Σγ = ${s.sum.toFixed(4)} · phase ${readout.textContent}`
            + (third === undefined ? ""
               : ` — exactly ${third === THIRDS[0] ? "1/3" : "2/3"}, which deflation`
                 + " holds and inflation swaps for the other");
        svg.setAttribute("aria-label", t);
        readout.setAttribute("title", t);
    }

    sync({ sum: 0, released: false });
    return { element: svg, sync };
}
