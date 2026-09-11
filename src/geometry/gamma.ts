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
import { noIntegerGamma, singularTriples } from "./regularity.js";

export interface GammaSetOptions {
    /** γ is integer numerators over this. 10⁴ matches a 0.01 slider with room. */
    denominator?: number;
    /**
     * Target Σγ. Zero gives the Penrose tilings; other values give the
     * generalised ones — same two rhombs, not locally isomorphic to Penrose.
     * Lutfalla's Gn(x) is every offset equal to x, so his G5(½) is sum 5/2 here.
     */
    sum?: number;
    /** Which index is computed from the others to hold the sum, or -1 for none. */
    locked?: number;
    /** Turn the star a quarter turn: v0 up, family 0's lines horizontal. */
    symmetry?: boolean;
    /** Hold γ off the singular set, so every dual tile stays a rhomb. */
    guard?: boolean;
    /**
     * How many line families. Five is the pentagrid; seven is Lutfalla's P7.
     *
     * Note the denominator: γ is carried as exact rationals over it, and the
     * distinguished uniform offset is 1/n, so `den` must be a multiple of n or
     * the most interesting setting is not representable. 10000 is fine for 5 and
     * useless for 7 — hence the default below scales with n.
     */
    n?: number;
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
    /**
     * Which offset is computed from the others to hold Σγ. Pass **-1** to hold
     * nothing: every offset becomes free and the total floats.
     */
    setLocked: (index: number) => void;
    getLocked: () => number;
    setSymmetry: (on: boolean) => void;
    getSymmetry: () => boolean;
    setGuard: (on: boolean) => void;
    getGuard: () => boolean;

    /**
     * Whether a family takes part at all. Off removes its lines *and* the tiles
     * they generate, which is the honest reading of turning a γ index off — the
     * dual of a line is a ribbon of tiles, so you cannot drop one and keep the
     * other.
     */
    setFamilyEnabled: (index: number, on: boolean) => void;
    familyEnabled: (index: number) => boolean;
    /** All families, as collectRhombs wants them. */
    enabledFlags: () => boolean[];

    /**
     * Show one line of a family instead of all of them. null restores all.
     *
     * It restricts only the pairs that family takes part in; what the others make
     * between themselves is unaffected. The chosen line's ribbon is therefore the
     * part of the result involving that family, not the whole of it.
     */
    setFamilyLine: (index: number, line: number | null) => void;
    familyLine: (index: number) => number | null;
    /** All families, as collectRhombs wants them. */
    lineFlags: () => (number | null)[];

    /**
     * Keep only the tiles one family takes part in, or null for all of them.
     * Together with a single line that leaves exactly one ribbon, which enable
     * and line cannot do between them: enabling two families admits their pair.
     */
    setIsolated: (index: number | null) => void;
    isolated: () => number | null;

    /** All as equal as possible for the current sum, then guarded. */
    reset: () => void;

    /** How many line families this set has. */
    readonly n: number;

    /**
     * Exactly which triples are singular — PENTAGRID ONLY, and empty there means
     * provably regular. For other n no such characterization is available, so
     * this is always empty and says nothing; ask `provenRegular`.
     */
    singular: () => string[];

    /**
     * Whether the grid is *proved* regular, by whichever result applies.
     *
     * n = 5 has an exact criterion, so this is regularity itself — false means
     * genuinely singular. For other n it rests on Lutfalla's Theorem 2, which is
     * sufficient and not necessary: false means unproved, not singular.
     */
    provenRegular: () => boolean;
    /** Whether the last change had to be nudged off the singular set. */
    nudged: () => boolean;

    /**
     * Whether every offset is the same — Lutfalla's Gn(r), the only case his
     * symmetry results speak about.
     *
     * "Same" as intended, not as measured: an even split is still uniform after
     * the guard has nudged it off the integers, even though that leaves the
     * locked index holding the negated rest. Moving a single dial ends it.
     */
    isUniform: () => boolean;

    onChange: (cb: () => void) => void;
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k: number) => String(k).split("").map((d) => SUB[+d]).join("");

/**
 * What a value of Σγ means, in words.
 *
 * Two independent facts, and it is worth giving both: the central figure the
 * offsets make, and which family of tilings you are in. The family turns on
 * Σγ **mod 1**, not on Σγ — integer is Penrose, half-integer is the one that
 * grows ten-thin-rhomb flowers, anything else is generalised without them.
 *
 * `nudged` matters only at zero: the even split there is all zeros, which is
 * singular, so with the guard on you get a 10⁻⁴ pentagon rather than a point.
 */
export function describeSum(
    sum: number, nudged = false, uniform = true, n: number = NUM_GRIDS,
): string {
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    const P = `P${sub(n)}`;

    // Every figure below is a claim about the offsets being EQUAL, not about
    // their total. Lutfalla's Theorem 1 is stated for the uniform multigrid
    // Gn(r) — global n-fold at r = 1/n for odd n, global 2n-fold at r = ½ — and
    // his symmetry argument is that dualization commutes with rotation about the
    // origin, so the tiling inherits whatever symmetry the GRID has. Unequal
    // offsets leave the grid with none. Σγ = n·r, so the totals are n/2 and 1.
    // "Penrose" is de Bruijn's n = 5 family and the thin-rhomb flowers are its
    // half-integer signature — the vertex of ten thin rhombs and no fat ones.
    // Neither survives a change of n: a heptagrid's dual is not a Penrose tiling
    // and it has three rhombs, not two. So the names are spent only at five.
    const penrose = n === 5;
    const poly = penrose ? "pentagon" : n === 7 ? "heptagon" : `${n}-gon`;

    if (uniform) {
        // n/2 is a half-integer, so the generic clause below would apply too —
        // and saying "½" twice ran the line to 94 characters. Name it once.
        if (near(sum, n / 2))
            return penrose
                ? `largest pentagon · generalised ${P}(½) — global 10-fold, thin-rhomb flowers`
                : `largest ${poly} · ${P}(½) — global ${2 * n}-fold`;
        if (near(sum, 1))
            return penrose
                ? `global 5-fold · Penrose ${P}(1/5)`
                : `global ${n}-fold · ${P}(1/${n})`;
    }

    const figure =
        uniform && Math.abs(sum) < 1e-9
            ? (nudged ? "just off concurrent (force regular)"
                      : `all ${penrose ? "five" : n} lines meet at a point`)
        : "";
    const frac = ((sum % 1) + 1) % 1;
    const integral = frac < 1e-9 || frac > 1 - 1e-9;
    const half = Math.abs(frac - 0.5) < 1e-9;
    const cls = penrose
        ? (integral ? "Penrose"
            : half ? "generalised (Σγ ≡ ½) — thin-rhomb flowers"
            : "generalised")
        : (integral ? "Σγ ≡ 0 (mod 1)"
            : half ? "Σγ ≡ ½ (mod 1)"
            : "Σγ generic");
    return figure ? `${figure} · ${cls}` : cls;
}

export function createGammaSet(options: GammaSetOptions = {}): GammaSet {
    const n = options.n ?? NUM_GRIDS;
    // 1/n has to land on an integer numerator, and so does 1/2; 2000n does both
    // and keeps the pentagrid's historical 10000.
    const den = options.denominator ?? 2000 * n;
    let sumQ = Math.round((options.sum ?? 0) * den);
    let locked = options.locked ?? n - 1;
    let symmetry = options.symmetry ?? true;
    let guard = options.guard ?? true;
    let didNudge = false;
    // Whether the offsets are all equal — Lutfalla's Gn(r). Tracked rather than
    // measured, because the guard's nudge makes them unequal on purpose and the
    // locked index then absorbs the negated rest: an even split at Σγ = 0 comes
    // out [1,2,3,4,-10], which no honest tolerance calls uniform. What the note
    // wants to know is whether the user spread them, and that is intent.
    let uniformIntent = true;
    const listeners: (() => void)[] = [];

    let isolatedFamily: number | null = null;
    const enabled: boolean[] = new Array(n).fill(true);
    const singleLine: (number | null)[] = new Array(n).fill(null);
    const q: number[] = new Array(n).fill(0);
    const directions: Vec2[] = [];
    const gamma: number[] = new Array(n).fill(0);
    const model: Pentagrid = { n, directions, gamma };

    function rebuildDirections() {
        const next = makeDirections(symmetry, n);
        for (let j = 0; j < n; j++) directions[j] = next[j];
    }

    /**
     * Re-derive the locked index from the rest, then the floats from the exact.
     *
     * `locked < 0` means **nothing** is holding the total: every offset is free
     * and Σγ is whatever they happen to add up to. That is a real configuration,
     * not a disabled one — the sum constraint is itself a choice, and this is the
     * state where it has been declined.
     */
    function relock() {
        if (locked < 0) {
            sumQ = q.reduce((a, b) => a + b, 0);
        } else {
            let rest = 0;
            for (let i = 0; i < n; i++) if (i !== locked) rest += q[i];
            q[locked] = sumQ - rest;
        }
        for (let j = 0; j < n; j++) gamma[j] = q[j] / den;
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
    /**
     * Whether the guard still has work to do.
     *
     * At n = 5 the exact criterion answers it, so the guard nudges only when the
     * grid really is singular. Elsewhere the target is Lutfalla's hypothesis —
     * every offset a non-integer rational — which is what the nudge below
     * establishes and is sufficient for regularity at any odd n.
     */
    function needsNudge(): boolean {
        return n === 5
            ? singularTriples(q, den).length > 0
            : !noIntegerGamma(q, den);
    }

    function applyGuard() {
        didNudge = false;
        if (!guard) return;
        for (let attempt = 0; attempt < 8; attempt++) {
            if (!needsNudge()) return;
            didNudge = true;
            for (let j = 0; j < n; j++) {
                if (j === locked) continue;
                if (q[j] % den === 0) q[j] += j + 1;
            }
            relock();
            if (locked >= 0 && q[locked] % den === 0) {
                q[(locked + 1) % n] += 1;
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
        uniformIntent = true;
        // As equal as possible: the share each, with the remainder spread over the
        // first few so the exact sum is still hit.
        const share = Math.trunc(sumQ / n);
        let left = sumQ - share * n;
        for (let j = 0; j < n; j++) {
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
            uniformIntent = false;
            settle();
        },
        setValues: (values) => {
            for (let j = 0; j < n; j++) q[j] = Math.round((values[j] ?? 0) * den);
            // Handed a whole vector, so believe it rather than the history.
            uniformIntent = q.every((v) => v === q[0]);
            settle();
        },
        setSum: (s, spread) => {
            sumQ = Math.round(s * den);
            // With nothing holding the total there is no index to absorb a change,
            // so the only sensible reading of "set the sum" is an even split.
            if (locked < 0) { reset(); return; }
            // Without spread the locked index takes the whole change, which is
            // exactly the lopsided case the note must not call symmetric.
            if (spread) { reset(); } else { uniformIntent = false; settle(); }
        },
        getSum: () => sumQ / den,
        setLocked: (index) => { locked = index; settle(); },
        getLocked: () => locked,
        setSymmetry: (on) => { symmetry = on; rebuildDirections(); settle(); },
        getSymmetry: () => symmetry,
        setGuard: (on) => { guard = on; settle(); },
        getGuard: () => guard,

        reset,
        n,
        singular: () => (n === 5 ? singularTriples(q, den) : []),
        provenRegular: () => {
            // n = 5: exact, in both directions.
            if (n === 5) return singularTriples(q, den).length === 0;
            // Thm 2.2: any odd n, every offset a non-integer rational.
            if (n % 2 === 1) return noIntegerGamma(q, den);
            // Thm 2.1: any n, but only for the uniform grid Gn(r).
            return uniformIntent && noIntegerGamma(q, den);
        },
        nudged: () => didNudge,
        isUniform: () => uniformIntent,
        setFamilyEnabled: (index, on) => {
            enabled[index] = on;
            for (const cb of listeners) cb();
        },
        familyEnabled: (index) => enabled[index],
        enabledFlags: () => enabled.slice(),

        setIsolated: (index) => {
            isolatedFamily = index;
            for (const cb of listeners) cb();
        },
        isolated: () => isolatedFamily,

        setFamilyLine: (index, line) => {
            singleLine[index] = line;
            for (const cb of listeners) cb();
        },
        familyLine: (index) => singleLine[index],
        lineFlags: () => singleLine.slice(),

        onChange: (cb) => { listeners.push(cb); },
    };
}
