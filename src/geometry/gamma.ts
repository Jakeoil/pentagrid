// The γ cluster: everything that decides *which* pentagrid you are looking at.
//
// Five directions, five offsets, the constraint tying them together, and the
// rule about what counts as a legal configuration. No DOM — this is a model, and
// the slider bank in ui/dials.ts is a view over it.
//
// γ is carried twice. `q` holds exact rationals as integer numerators over
// `den`, and that copy is the source of truth, because regularity is decidable
// exactly and only in exact arithmetic. `model.gamma` holds the floats the
// drawing and geometry want. Both arrays are mutated in place, so a `model`
// handed out once stays current for the life of the set.

import type { Pentagrid, Vec2 } from "./types.js";
import { NUM_GRIDS, makeDirections } from "./pentagrid.js";
import { singularTriples } from "./regularity.js";

export interface GammaSetOptions {
    /** γ is integer numerators over this. 10⁴ matches a 0.01 slider with room. */
    denominator?: number;
    /**
     * Target Σγ. Zero gives the Penrose tilings; other values give the
     * generalised ones — same two rhombs, not locally isomorphic to Penrose.
     * Lutfalla's Gn(x) is every offset equal to x, so his G5(½) is sum 5/2 here.
     */
    sum?: number;
    /** Which index is computed from the others to hold the sum. */
    locked?: number;
    /** Turn the star a quarter turn: v0 up, family 0's lines horizontal. */
    symmetry?: boolean;
    /** Hold γ off the singular set, so every dual tile stays a rhomb. */
    guard?: boolean;
}

export interface GammaSet {
    /** Live: both arrays are mutated in place, never replaced. */
    readonly model: Pentagrid;
    values: () => number[];
    /** Exact numerators, for anyone who needs to decide rather than measure. */
    exact: () => number[];
    readonly denominator: number;

    setValue: (index: number, value: number) => void;
    setValues: (values: readonly number[]) => void;
    /**
     * Retarget Σγ. With `spread`, also redistribute evenly — which is usually
     * what you want from a sum control: without it the locked index absorbs the
     * whole change, leaving four tiny offsets and one enormous one. Valid, but
     * not the symmetric family the sum is interesting for.
     */
    setSum: (sum: number, spread?: boolean) => void;
    getSum: () => number;
    setLocked: (index: number) => void;
    getLocked: () => number;
    setSymmetry: (on: boolean) => void;
    getSymmetry: () => boolean;
    setGuard: (on: boolean) => void;
    getGuard: () => boolean;

    /** All as equal as possible for the current sum, then guarded. */
    reset: () => void;

    /** Exactly which triples are singular. Empty means provably regular. */
    singular: () => string[];
    /** Whether the last change had to be nudged off the singular set. */
    nudged: () => boolean;

    onChange: (cb: () => void) => void;
}

export function createGammaSet(options: GammaSetOptions = {}): GammaSet {
    const den = options.denominator ?? 10000;
    let sumQ = Math.round((options.sum ?? 0) * den);
    let locked = options.locked ?? NUM_GRIDS - 1;
    let symmetry = options.symmetry ?? true;
    let guard = options.guard ?? true;
    let didNudge = false;
    const listeners: (() => void)[] = [];

    const q: number[] = new Array(NUM_GRIDS).fill(0);
    const directions: Vec2[] = [];
    const gamma: number[] = new Array(NUM_GRIDS).fill(0);
    const model: Pentagrid = { directions, gamma };

    function rebuildDirections() {
        const next = makeDirections(symmetry);
        for (let j = 0; j < NUM_GRIDS; j++) directions[j] = next[j];
    }

    /** Re-derive the locked index from the rest, then the floats from the exact. */
    function relock() {
        let rest = 0;
        for (let i = 0; i < NUM_GRIDS; i++) if (i !== locked) rest += q[i];
        q[locked] = sumQ - rest;
        for (let j = 0; j < NUM_GRIDS; j++) gamma[j] = q[j] / den;
    }

    /**
     * Move γ off the singular set if it is on it.
     *
     * A triple can only be singular when its lone γ is an integer, so taking
     * every γ off the integers makes the whole pentagrid regular. One unit of the
     * denominator does it: correctness here is about rationality class, not
     * magnitude — which is what the old 5e-9 nudge got wrong twice over, being
     * both symmetric and, at this precision, indistinguishable from zero.
     *
     * The offsets differ per family so the pair sums cannot stay integral either.
     */
    function applyGuard() {
        didNudge = false;
        if (!guard) return;
        for (let attempt = 0; attempt < 8; attempt++) {
            if (singularTriples(q, den).length === 0) return;
            didNudge = true;
            for (let j = 0; j < NUM_GRIDS; j++) {
                if (j === locked) continue;
                if (q[j] % den === 0) q[j] += j + 1;
            }
            relock();
            if (q[locked] % den === 0) {
                q[(locked + 1) % NUM_GRIDS] += 1;
                relock();
            }
        }
    }

    function settle() {
        relock();
        applyGuard();
        for (const cb of listeners) cb();
    }

    function reset() {
        // As equal as possible: the share each, with the remainder spread over the
        // first few so the exact sum is still hit.
        const share = Math.trunc(sumQ / NUM_GRIDS);
        let left = sumQ - share * NUM_GRIDS;
        for (let j = 0; j < NUM_GRIDS; j++) {
            q[j] = share;
            if (left > 0) { q[j] += 1; left -= 1; }
            else if (left < 0) { q[j] -= 1; left += 1; }
        }
        settle();
    }

    rebuildDirections();
    reset();

    return {
        model,
        denominator: den,
        values: () => gamma.slice(),
        exact: () => q.slice(),

        setValue: (index, value) => {
            if (index === locked) return;
            q[index] = Math.round(value * den);
            settle();
        },
        setValues: (values) => {
            for (let j = 0; j < NUM_GRIDS; j++) q[j] = Math.round((values[j] ?? 0) * den);
            settle();
        },
        setSum: (s, spread) => {
            sumQ = Math.round(s * den);
            if (spread) reset(); else settle();
        },
        getSum: () => sumQ / den,
        setLocked: (index) => { locked = index; settle(); },
        getLocked: () => locked,
        setSymmetry: (on) => { symmetry = on; rebuildDirections(); settle(); },
        getSymmetry: () => symmetry,
        setGuard: (on) => { guard = on; settle(); },
        getGuard: () => guard,

        reset,
        singular: () => singularTriples(q, den),
        nudged: () => didNudge,
        onChange: (cb) => { listeners.push(cb); },
    };
}
