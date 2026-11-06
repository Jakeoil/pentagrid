// The growth law, the Wieringa lift, and the tiles they act on.
//
// The first of this repo's public entry points — LIBRARY.md §5. Plain
// JavaScript, no build step on your side: import it from a sibling checkout or
// from this repo's GitHub Pages URL.
//
//     import { tileCorner, projectToScreen } from "../pentagrid/lib/grow.js";
//     import { tileCorner } from "https://jakeoil.github.io/pentagrid/lib/grow.js";
//
// WHAT IT IS FOR. `tileCorner` puts a tile's own (a, b) coordinate in world
// space at a partial **grow** (0 = every point on the crossing that made it,
// 1 = the finished tiling) and a partial **fold** (0 = flat, 1 = the full
// Wieringa roof). So a net that rises from flat to roof by degrees, or a patch
// that assembles out of its own crossings, is two numbers and this function.
// `projectToScreen` then puts a world point on a canvas, given a camera.
//
// WHAT A TILE HAS TO BE. `tileCorner` reads `{ j, k, x0, y0, vertices,
// kTuples }` — the two families, the crossing that made it, the four corners,
// and the de Bruijn K-tuple per corner. `collectRhombs` below produces them;
// anything else wanting to use this law has to supply the same six fields,
// and `x0, y0` and `kTuples` are the two that are easy to forget, because
// they are what the grow and the height are measured from.
//
// NAMES HERE ARE A PROMISE; `../dist/` IS NOT. The layout behind this file
// moves — `tools/surface.test.mjs` fails if what this file exports changes, so
// the surface cannot drift without someone deciding to let it.
//
// `dist/` is built, not committed (see LIBRARY.md §6): on the website the
// deploy action builds it, and in a sibling checkout `npm run build` does.

// ── the growth law ────────────────────────────────────────────────
export {
    tileCorner,
    outlineCorner,
    crossingLerp,
    standHeight,
    registrationGain,
    projectToScreen,
} from "../dist/geometry/growth.js";

// ── the lift it stands on ─────────────────────────────────────────
export {
    RISE,
    ROOF_EDGE,
    vertexIndex,
    vertexHeight,
    generator,
    liftLocal,
    faceNormal,
    flatLocal,
} from "../dist/geometry/roof.js";

// ── the tiles, so this entry is usable on its own ─────────────────
//
// Also the natural contents of a `lib/tiling.js` when that lands, and that is
// fine: a facade is a surface, not a partition, and both names would point at
// the one implementation.
export { makeDirections, collectRhombs } from "../dist/geometry/pentagrid.js";
