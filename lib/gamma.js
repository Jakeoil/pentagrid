// γ: the five offsets, as the model every view here is a view over.
//
// A public entry point — LIBRARY.md §5. Plain JavaScript, no build step on
// your side:
//
//     import { createGammaSet } from "../pentagrid/lib/gamma.js";
//     import { createGammaSet } from "https://jakeoil.github.io/pentagrid/lib/gamma.js";
//
// WHAT IT IS FOR. `createGammaSet` holds n offsets as **exact rationals over a
// denominator** rather than as doubles, so questions that are decidable stay
// decided: whether the grid is regular, whether Σγ is an integer (de Bruijn's
// Penrose condition at n = 5), which LI class the tiling is in. It carries the
// constraint — one index may be computed from the rest so the total holds —
// the guard that keeps γ off the singular set, the deflation and inflation
// maps, and the generation and normalization exponents that give λ.
//
// It is DOM-free, and so is everything it imports. It runs in node.
//
//     const set = createGammaSet({ n: 5 });
//     set.setSum(1, true);                     // the uniform Penrose family
//     set.values();                            // [0.2, 0.2, 0.2, 0.2, 0.2]
//     set.exact();                             // integer numerators
//     set.deflate();                           // γ″ⱼ = −(γⱼ₊₂ + γⱼ₊₃)
//     set.model                                // { n, directions, gamma, lambda }
//
// `set.model` is the live `Pentagrid` that `lib/grow.js`'s `collectRhombs`
// takes, so these two entries compose: a set, its model, its rhombs, and
// `tileCorner` to place them.
//
// NAMES HERE ARE A PROMISE; `../dist/` IS NOT. `tools/surface.test.mjs` fails
// if this file's exports change. See `lib/README.md` for what each dist
// module behind it is.
//
// `dist/` is built, not committed (LIBRARY.md §6): on the website the deploy
// action builds it, and in a sibling checkout `npm run build` does.

// ── the set ───────────────────────────────────────────────────────
export { createGammaSet, describeSum, penroseCondition } from "../dist/geometry/gamma.js";

// ── regularity, decided on the rationals rather than measured ─────
export { singularTriples, noIntegerGamma, TRIPLES } from "../dist/geometry/regularity.js";

// ── the singular catalog, and the presets that reach it ───────────
export {
    classifySingularities, isRegular, COUPLES, SINGULAR_PRESETS,
} from "../dist/geometry/hunt.js";

// ── carrying a set between pages, exactly ─────────────────────────
export { captureGamma, restoreGamma } from "../dist/state/baseline.js";
