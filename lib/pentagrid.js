// The pentagrid itself, as a mounted view: five families of lines on one
// canvas, their dual tiling on another, one γ between them.
//
// A public entry point — LIBRARY.md §5. Plain JavaScript, no build step on
// your side:
//
//     import { createPentagrid } from "../pentagrid/lib/pentagrid.js";
//     import { createPentagrid }
//       from "https://jakeoil.github.io/pentagrid/lib/pentagrid.js";
//
// WHAT IT IS FOR. `lib/gamma.js` is the model and `lib/grow.js` the geometry;
// this is the VIEW over them. `createPentagrid` takes one or two host elements
// and returns a handle: the γ set, the layer stack, the viewport, and the panel
// rows it built. It accepts `directions` and `edges` explicitly, which is what
// makes it usable for a grid that is not the Euclidean five — the dual map runs
// on whatever normals it is handed.
//
// It is the one entry here that NEEDS A DOM. `lib/gamma.js` and `lib/grow.js`
// run in node; this does not.
//
//     const handle = createPentagrid({
//         container: gridHost, containerP: tileHost,
//         directions: normals, edges,
//         features: { gridLines: true, penroseTiles: true },
//     });
//     handle.gamma.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
//
// NO STYLESHEET YET, and that is a real gap rather than an omission. The
// instruments in `lib/reticulum.js` ship their rules in `lib/css/`, so they
// come up styled in somebody else's page; this view assigns about thirty
// classes — `panel-row`, `layer-toggle`, `penta-line` and the rest — whose
// rules are still in this repo's `site.css`. A consumer outside this repo gets
// a working view with a bare panel until those move. `tools/surface.test.mjs`
// records the carve-out so it stays visible.
//
// NAMES HERE ARE A PROMISE; `../dist/` IS NOT. `tools/surface.test.mjs` fails
// if this file's exports change. See `lib/README.md` for what each dist
// module behind it is.
//
// `dist/` is built, not committed (LIBRARY.md §6): on the website the deploy
// action builds it, and in a sibling checkout `npm run build` does.

// ── the view ──────────────────────────────────────────────────────
export { createPentagrid, LAYER_FEATURE } from "../dist/view/pentagrid.js";

// ── what to configure it with ─────────────────────────────────────
export { NO_FEATURES, TILE_DEFAULTS, GRID_DEFAULTS } from "../dist/state/defaults.js";
