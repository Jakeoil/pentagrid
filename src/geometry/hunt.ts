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
    /**
     * Sum(gamma) in Z — de Bruijn's condition, so the tiling is Penrose.
     *
     * Five of the seven singular signatures are NOT, and they are worth visiting
     * anyway; they are just not Penrose tilings, and the button says so.
     */
    penrose: boolean;
    /** "cap" names what sits at the origin; "hunt" names what is singular. */
    group: "cap" | "hunt";
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
 * THE CAPS. Give all five families the same offset and the pentagrid keeps its
 * five-fold symmetry, so the tiling does too.
 *
 * sun is the Pe5 cap, star the St5, and deca is the queen.
 *
 * Sun and star are uniform, c = 1/5 and 2/5, and have the SAME vertex at the
 * origin — five thick rhombs at 72 degrees, measured. What separates them is the
 * patch, not the vertex: at c = 1/5 the origin is a Pe5 cluster center, at
 * c = 2/5 it belongs to no cluster at all because it sits inside an St5. That is
 * why this needed the cluster recognizer.
 *
 * The deca is NOT uniform and NOT the singular decagon, which was the first
 * draft's mistake. It is one Pe3 with two Pe1 — ten rhombs, 5 thick + 5 thin,
 * which is exactly what the 5-fold singularity holds — and it is what Gamma = 0
 * RESOLVES INTO under a mirror-symmetric nudge, gamma1 = gamma4 and
 * gamma2 = gamma3 with the total at zero. Measured: every such nudge puts a Pe3
 * on the axis and a Pe1 either side of it, and negating Gamma flips the deca
 * end for end. It persists along that mirror line out to e = 0.3.
 */
const CAPS: readonly SingularPreset[] = [
    {
        name: "sun", gamma: [20, 20, 20, 20, 20], den: D, penrose: true, group: "cap",
        note: "c = 1/5. The origin is a Pe5 center. Regular: no three lines "
            + "meet anywhere.",
    },
    {
        name: "star", gamma: [40, 40, 40, 40, 40], den: D, penrose: true, group: "cap",
        note: "c = 2/5. The same five-thick vertex, but it belongs to no cluster: "
            + "it sits inside an St5, a star-shaped gap. Regular.",
    },
    {
        name: "deca", gamma: [0, 10, -10, -10, 10], den: D, penrose: true, group: "cap",
        note: "The queen. One Pe3 flanked by two Pe1 — 5 thick + 5 thin, ten "
            + "rhombs, mirror-symmetric about the vertical axis. It is what the "
            + "5-fold singularity at Gamma = 0 resolves into under a mirror-"
            + "symmetric nudge: gamma1 = gamma4, gamma2 = gamma3. Regular.",
    },
];

/**
 * THE SINGULARITIES. All seven of them, and that is the complete list.
 *
 * Searched exhaustively over every rational phase vector at denominators 10 and
 * 12 — the same seven signatures both times, so this is the catalog and not a
 * sample of it:
 *
 *     PENROSE, Sum(gamma) in Z
 *       one couple    K122 + K113
 *       decagon       5 of each, plus the 5-fold at the origin
 *
 *     NOT PENROSE
 *       one thick     K122 alone
 *       one thin      K113 alone
 *       two thick     K122 x2
 *       two thin      K113 x2
 *       octagon       K1112, plus 2 of each hexagon
 *
 * The Penrose column is short for the reason in COUPLES: an integral total makes
 * the hexagons come in pairs and swallows every 4-fold into a 5-fold.
 */
const HUNT: readonly SingularPreset[] = [
    {
        name: "regular", gamma: [7, 11, 13, 17, -48], den: D, penrose: true, group: "hunt",
        note: "No integral phase, so no three lines meet anywhere — the corollary "
            + "in closed form, ten integer comparisons. Sums to zero.",
    },
    {
        name: "couple", gamma: [0, 0, 0, 10, -10], den: D, penrose: true, group: "hunt",
        note: "The smallest Penrose singularity: one K122 and one K113, and "
            + "nothing else. They cannot be separated — see COUPLES.",
    },
    {
        name: "decagon", gamma: [0, 0, 0, 0, 0], den: D, penrose: true, group: "hunt",
        note: "Every phase integral: all five couples at once, ten hexagons, and "
            + "the unique 5-fold at the origin.",
    },
    {
        name: "octagon", gamma: [0, 0, 0, 0, 50], den: D, penrose: false, group: "hunt",
        note: "Sum(gamma) = 1/2, so NOT Penrose — and that is the point. Four "
            + "integral phases give a K1112, a boat and two thins. No integral "
            + "total can reach it: the fifth family would pass through the same "
            + "point and make it a decagon.",
    },
    {
        name: "1 thick", gamma: [0, 0, 0, 10, 10], den: D, penrose: false, group: "hunt",
        note: "A lone K122, with the total off the integers. Not Penrose — at "
            + "Sum(gamma) in Z a hexagon always drags its partner in.",
    },
    {
        name: "1 thin", gamma: [0, 0, 10, 0, 10], den: D, penrose: false, group: "hunt",
        note: "A lone K113, the other hexagon. Not congruent to the thick one: "
            + "144/144/72 against 144/108/108.",
    },
    {
        name: "2 thick", gamma: [0, 10, 0, -10, -10], den: D, penrose: false, group: "hunt",
        note: "Two K122 and no K113 — impossible at an integral total, where the "
            + "two kinds are forced into pairs.",
    },
    {
        name: "2 thin", gamma: [0, 0, 10, -10, 10], den: D, penrose: false, group: "hunt",
        note: "Two K113 and no K122, the mirror of the case above.",
    },
];

/** Caps first, then the singular catalog. */
export const SINGULAR_PRESETS: readonly SingularPreset[] = [...CAPS, ...HUNT];
