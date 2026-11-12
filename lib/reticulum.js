// The reticulum: the γ instrument, its strip, its dials, and the panel they
// float in.
//
// A public entry point — LIBRARY.md §5. Plain JavaScript, no build step on
// your side:
//
//     import { mountFloatingReticulum } from "../pentagrid/lib/reticulum.js";
//     import { createReticulum }
//         from "https://jakeoil.github.io/pentagrid/lib/reticulum.js";
//
// THE STYLESHEET IS NOT OPTIONAL HERE. Structure is inline — each piece
// positions its own parts, per MODULES.md — but the LOOK is CSS, and an
// unstyled reticulum works and looks like unstyled HTML. Link what you use:
//
//     <link rel="stylesheet" href="../pentagrid/lib/css/reticulum.css">
//     <link rel="stylesheet" href="../pentagrid/lib/css/panel.css">
//     <link rel="stylesheet" href="../pentagrid/lib/css/dials.css">
//
// They are the same bytes this project's own pages use: `site.css` imports
// them rather than keeping a copy, so what you link cannot drift from what
// jakeoil.github.io/pentagrid shows.
//
// TWO LAYERS, AND THE SECOND ONE IS THE USEFUL ONE.
//
// The PIECES are pure views: `createReticulum` reports moves and renders what
// it is told, and knows nothing about γ, pentagrids or φ. A consumer with
// seven sliders and one constraint can drive it unchanged.
//
//     const ret = createReticulum({ count: 5, directions, colors,
//                                   onChange: (i, v) => ..., onLock: (i) => ... });
//     host.appendChild(ret.element);
//     ret.sync({ values, locked, sum });
//
// The MOUNTS bind those pieces to a `GammaSet` from `lib/gamma.js` and give
// you the whole instrument — axes, the Σ strip, the preset catalog, the three
// exponent boxes, the folded slider bank:
//
//     const set = createGammaSet({ n: 5 });
//     mountReticulum(set, host, { colors });                  // in the page
//     mountFloatingReticulum(set, { colors, buttons });        // draggable
//
// Two things `mountFloatingReticulum` presumes, worth knowing before you call
// it: it appends its panel to `document.body` itself, and it wants a `buttons`
// element to hang its "show reticulum" and "γ sliders" buttons on.
//
// It needs no canvas and no pentagrid. Verified from a consumer's position:
// a GammaSet and a host element, in node, against a DOM stub, with nothing of
// this project's own pages in the frame.
//
// NAMES HERE ARE A PROMISE; `../dist/` IS NOT. `tools/surface.test.mjs` fails
// if this file's exports change, and `lib/README.md` says what each dist
// module behind it is.
//
// `dist/` is built, not committed (LIBRARY.md §6): on the website the deploy
// action builds it, and in a sibling checkout `npm run build` does.

// ── the whole instrument, bound to a GammaSet ─────────────────────
export {
    mountReticulum,
    mountFloatingReticulum,
    mountGammaControls,
} from "../dist/view/controls.js";

// ── binding ordinary page inputs to any handle with set/get ───────
export {
    bindRange, bindSliders, bindToggles, bindSelects, wheelSteps,
} from "../dist/view/controls.js";

// ── the pieces, for a consumer driving them directly ──────────────
export { createReticulum, signedGamma, lighten } from "../dist/ui/reticulum.js";
export { createSumStrip } from "../dist/ui/sumstrip.js";
export { createGammaBank } from "../dist/ui/dials.js";
export { createFloatingPanel } from "../dist/ui/floating.js";
export { createLoupe } from "../dist/ui/loupe.js";
export { addPresets } from "../dist/ui/presets.js";

// ── one reading of a wheel event, shared by every control above ───
export {
    wheelNotch, isFine, makeNotchGate, snapStep, snapStepWith,
} from "../dist/ui/wheel.js";
