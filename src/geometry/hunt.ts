// Hunting singularities: which ones a phase vector has, decided exactly.
//
// The scan finds concurrencies by looking. This decides them by arithmetic, which
// is the thing the scan can never do however small its epsilon — it answers for
// the whole plane, not for a window, and it answers exactly.
//
// PENTAGRID ONLY. The triple table is the n = 5 split over Q(phi); at other n the
// determinant condition splits differently and this says nothing.
//
// RATIONAL PHASES ONLY, and this is the load-bearing assumption. The triple
// condition is one equation `u + phi*v = 0`; it separates into `u = 0` and `v = 0`
// only because u and v are RATIONAL, and they are rational only when the phases
// are. The dials and the wheel produce hundredths and thousandths, so in practice
// every phase the user can reach is rational — but a phase vector arrived at any
// other way is outside what this decides.

import type { Pentagrid } from "./types.js";
import { TRIPLES } from "./regularity.js";
import { angleCode, type AngleCode } from "./resolve.js";

export interface SingularKind {
    /** The families whose lines meet. */
    families: number[];
    /** The angle code — the shape's real name. */
    code: AngleCode;
    /** How many of them the exact rule predicts: one per qualifying subset. */
    fold: number;
}

/** The singular triples, as a set of "abc" keys. */
function singularKeys(gammaQ: readonly number[], den: number): Set<string> {
    const out = new Set<string>();
    for (const [key, L, [P, Q]] of TRIPLES) {
        if (gammaQ[L] % den === 0 && (gammaQ[P] + gammaQ[Q]) % den === 0) out.add(key);
    }
    return out;
}

/**
 * Every kind of concurrency this phase vector has, anywhere in the plane.
 *
 * `gammaQ` holds integer numerators over `den`, so "is an integer" is an exact
 * comparison and not a tolerance.
 *
 * A subset is concurrent when every triple inside it is. The one exception is the
 * reason a 4-fold is hard to see:
 *
 *     Sum(v_j) = 0, so at a point where a,b,c,d meet,
 *     x.v_e + gamma_e = -Sum(n_j) + Sum(gamma)
 *
 * — the fifth family passes through that same point exactly when **Sum(gamma) is
 * an integer**. So with the total locked at 0 every 4-fold is swallowed by a
 * 5-fold and no octagon can appear, however the other phases are set. Release the
 * total and four integral phases give one.
 *
 * Verified against the scan on 300 random rational phase vectors, exactly.
 */
export function classifySingularities(
    pg: Pentagrid, gammaQ: readonly number[], den: number,
): SingularKind[] {
    const sing = singularKeys(gammaQ, den);
    const allFive = gammaQ.every((q) => q % den === 0);
    const out: SingularKind[] = [];

    for (let mask = 0; mask < (1 << pg.n); mask++) {
        const S: number[] = [];
        for (let j = 0; j < pg.n; j++) if (mask & (1 << j)) S.push(j);
        if (S.length < 3) continue;
        // Absorbed: with every phase integral the 4-folds are all 5-folds.
        if (S.length === 4 && allFive) continue;

        let ok = true;
        for (let a = 0; a < S.length && ok; a++) {
            for (let b = a + 1; b < S.length && ok; b++) {
                for (let c = b + 1; c < S.length && ok; c++) {
                    if (!sing.has(`${S[a]}${S[b]}${S[c]}`)) ok = false;
                }
            }
        }
        if (ok) out.push({ families: S, code: angleCode(pg, S), fold: S.length });
    }
    return out;
}

/**
 * The five couples: triples that are singular together whenever Sum(gamma) is an
 * integer — which is to say, whenever the tiling is Penrose.
 *
 * A triple is `{L, P, Q}` with `gamma_L` integral and `gamma_P + gamma_Q` integral.
 * Its partner is `{L} + the complement`, which has the SAME lone family and the
 * complementary pair. Sum(gamma) integral forces that pair sum too, so the two
 * stand or fall together. Each couple is one K122 and one K113: at Sum = 0 the two
 * hexagons only ever appear together, never alone.
 */
export const COUPLES: readonly [string, string][] = [
    ["012", "134"], ["013", "234"], ["014", "023"], ["024", "123"], ["034", "124"],
];

/** True when nothing anywhere is concurrent. Ten integer comparisons. */
export function isRegular(gammaQ: readonly number[], den: number): boolean {
    return singularKeys(gammaQ, den).size === 0;
}

export interface SingularPreset {
    name: string;
    /** Numerators over `den`. */
    gamma: number[];
    den: number;
    /** What it is for. */
    note: string;
}

/**
 * The preset denominator.
 *
 * It MUST divide the gamma set's own denominator (2000n, so 10000 at n = 5) or
 * the phases are rounded on the way in and the vector you get is not the vector
 * the rule was checked against. 60 does not divide 10000; 100 does. A test pins
 * the round trip rather than trusting this comment.
 */
const D = 100;

/**
 * Every Penrose singularity there is. All three of them.
 *
 * Penrose means Sum(gamma) in Z, so every preset here sums to zero and the total
 * stays locked. Under that constraint the catalog is complete and very short —
 * searched exhaustively over all rational phase vectors at denominators 12, 15,
 * 20, 24 and 25, which is every one of them up to scaling:
 *
 *     regular          nothing concurrent anywhere
 *     one couple       one K122 + one K113, and nothing else
 *     Gamma = 0        five of each, plus the decagon
 *
 * Two facts make it that short. **Couples**: see COUPLES above — the hexagons come
 * in pairs, one of each kind. **Two couples force all five**: two couples means two
 * integral phases, whose pair conditions drag in two more, and Sum(gamma) integral
 * supplies the fifth — so there is no way to have three or four couples, and
 * nothing between one couple and the whole decagon.
 *
 * And **no octagon is Penrose.** A 4-fold needs Sum(gamma) off the integers, since
 * Sum(v_j) = 0 puts the fifth family through any point where four meet as soon as
 * Sum(gamma) is integral. The octagon is real, but it lives outside the condition.
 */
export const SINGULAR_PRESETS: readonly SingularPreset[] = [
    {
        name: "Regular", gamma: [7, 11, 13, 17, -48], den: D,
        note: "No integral phase, so no three lines meet anywhere — the corollary "
            + "in closed form, ten integer comparisons. Sums to zero.",
    },
    {
        name: "One couple", gamma: [0, 30, 25, -25, -30], den: D,
        note: "The smallest Penrose singularity: gamma0 integral and gamma1 + "
            + "gamma4 integral give triple 014, and Sum(gamma) = 0 forces its "
            + "partner 023. One thick hexagon and one thin, nothing else.",
    },
    {
        name: "Decagon", gamma: [0, 0, 0, 0, 0], den: D,
        note: "Every phase integral: all five couples at once, ten hexagons, and "
            + "the unique 5-fold at the origin. The most singular pentagrid there is.",
    },
];
