/**
 * The defaults literals, in a module of their own.
 *
 * They lived in `view/pentagrid.ts` until `state/inventory.ts` came to derive
 * its field list from them (PLAN §9.10 step 2) and `view/pentagrid.ts` came to
 * read the container's attributes (step 5). That closed a cycle —
 * pentagrid → attributes → inventory → pentagrid — and a cycle through a
 * `const` is not a warning, it is a `ReferenceError: Cannot access
 * 'NO_FEATURES' before initialization` in six test files at once.
 *
 * So the values sit here, where nothing imports anything at runtime: the two
 * interfaces come in as `import type` and are erased, leaving a module with no
 * edges for a cycle to form along. `view/pentagrid.ts` re-exports them, so
 * every existing importer is unaffected.
 */
import type { Features, TileStyle } from "../view/pentagrid.js";
import type { GrowthState } from "../view/growth.js";

/**
 * Every feature off — the floor a page builds on.
 *
 * At module scope and exported so `state/inventory.ts` can DERIVE the field
 * list from it rather than keep a second copy (PLAN §9.10 step 2). A
 * hand-written inventory goes stale the first time a switch is added; one
 * read off the defaults cannot.
 */
export const NO_FEATURES: Features = {
    gridLines: true, axes: false,
    kRegions: false, kLabels: false, ammannGrid: false, intersectionDots: false,
    penroseTiles: false, penroseEdges: false, penroseVertices: false,
    penroseDecor: false,
    arrows: false,
    pseudoEdges: false,
    center: false,
    hoverRegion: false, hoverSegment: false, hoverCrossing: false,
    hoverVertex: false, hoverEdge: false, hoverFace: false,
};

/**
 * How the tiles are dressed before a page says otherwise.
 *
 * Lifted out of the factory with `NO_FEATURES` and for the same reason: the
 * inventory derives from it.
 */
export const TILE_DEFAULTS: TileStyle = {
    color: "type", isogloss: false, shading: false, ramp: 1, opacity: 1, band: 0.5,
    curves: false, pentaFace: false, pentaEdge: false, pentaShape: "penta",
    pentaOverlay: true,
    pentaBoundary: "circle",
    nextgenFace: false, nextgenEdge: false,
    kitesFace: false, kitesEdge: false, ammann: false, nextPenta: false,
    p1Shape: "pentaplex", p1Face: false, p1Grid: false,
    bigRhombsFace: false, bigRhombsGrid: false,
    faceEdges: false, afterimage: false,
    boldEdges: false, coloredArrows: false, vertexMark: "dot", offPenrose: false,
};

/**
 * The growth view before a page says otherwise.
 *
 * Exported so `state/inventory.ts` derives its field list from it, as it does
 * from `NO_FEATURES` and `TILE_DEFAULTS` (PLAN §9.10 step 2).
 */
export const DEFAULTS: GrowthState = {
    grow: 0, fold: 0, band: 0.5, azimuth: 0, elevation: Math.PI / 2,
    showResolutions: false, p1: false, penta: false, nextgen: false, kites: false,
    offPenrose: false,
    solids: false, axis: 0, direction: 1, paths: "both", pick: 0, pairGhost: false,
    arcs: false, resolve: false, indexStyle: "none",
    height: false, isogloss: false,
    edgeStyle: "normal", kowalewski: false,
};
