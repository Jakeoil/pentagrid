// Shared shapes for the geometry layer. Nothing here touches the DOM, a canvas,
// or module-level state — that is the whole point of the split, and it is what
// lets these be tested against the same code the page runs.

export type Vec2 = [number, number];

/** A pentagrid: five unit directions and their five offsets. */
export interface Pentagrid {
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
