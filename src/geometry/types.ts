// Shared shapes for the geometry layer. Nothing here touches the DOM, a canvas,
// or module-level state — that is the whole point of the split, and it is what
// lets these be tested against the same code the page runs.

export type Vec2 = [number, number];

/**
 * A multigrid: n unit directions and their n offsets.
 *
 * `n` is carried rather than read off `directions.length` so that every consumer
 * says what it means. The arrays are mutated in place and never replaced, so the
 * three always agree.
 */
export interface Pentagrid {
    readonly n: number;
    readonly directions: readonly Vec2[];
    readonly gamma: readonly number[];
}

export interface ViewRect {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
}

export interface Rhomb {
    vertices: Vec2[];        // 4 vertices in parallelogram order
    kTuples: number[][];     // K-tuple for each of the 4 vertices
    /**
     * How far apart the two families are, 1..floor(n/2) — the rhomb's shape.
     * Its corner angle is 2*pi*cls/n, so an n-fold grid makes floor(n/2) shapes:
     * two for the pentagrid, three for a heptagrid.
     */
    cls: number;
    /**
     * The n = 5 reading of `cls`: at 72 degrees the rhomb is the fat one. Only
     * meaningful for the pentagrid — at n = 7, cls 1 is the most acute of the
     * three, not the fattest.
     */
    thick: boolean;
    // Provenance: the crossing that generated this rhomb.
    j: number; k: number;    // the two families whose lines crossed
    nj: number; nk: number;  // and which line of each
    x0: number; y0: number;  // the intersection itself, in grid coordinates
}

/** A region small enough to be hard to aim at. Size is in whatever units the
 *  caller's scale is in — pass scale = 1 for math units. */
export interface SmallRegion {
    size: number;            // 2 x inradius
    x: number; y: number;    // incenter
}

/** A point where three or more lines actually meet. Not a small region — it has
 *  no interior at all, and no magnification will ever open it up. */
export interface Concurrency {
    x: number; y: number;
    lines: number;           // how many families pass through the point
}
