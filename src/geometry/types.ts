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
    /**
     * λ, the gridline spacing, in world units; default 1. The geometry is
     * written for spacing 1 and stays that way — a grid at spacing λ with
     * shifts γ IS the unit grid scaled by λ, tiling included (line n of family
     * j sits at x·vⱼ = λ(n − γⱼ), the dual's edge is λ). So λ is applied once,
     * at the view: a tiling unit is λ world units. It is a power of φ, and
     * deflation is λ ↦ λ/φ with γ ↦ Mγ — see geometry/gamma.ts.
     */
    readonly lambda?: number;
    /**
     * The vectors the DUAL builds its tile edges from, if not the directions
     * themselves. De Bruijn uses one array for both and the pentagrid never
     * notices; off the even spread they come apart, since the grid's spacing
     * and the tiling's edge lengths are separate choices. Omitted means
     * `directions`, which is de Bruijn's.
     */
    readonly edges?: readonly Vec2[];
    /**
     * Where each family's lines actually are, when they are not the periodic
     * n − γⱼ.
     *
     * A family has always been an arithmetic progression: line n of family j at
     * x·vⱼ = n − γⱼ. It does not have to be. A `LineSet` says where line n
     * sits and which line a position is past, and everything downstream — the
     * crossings, the K-tuple, the dual — goes through those two questions and
     * nothing else. Omitted, or a null entry, means the periodic default, and
     * the arithmetic is the same arithmetic as before.
     *
     * This is what makes the Ammann quasilattice a GRID rather than a
     * decoration: its families are Fibonacci chains, two spacings in the ratio
     * φ, and the dual of that grid is a Penrose tiling one generation down.
     * It is also what `ribbons` wants (PLAN §7.3a) — a family carrying a line
     * SET rather than all of ℤ is the same generalization, seen smaller.
     */
    readonly lines?: readonly (LineSet | null)[];
}

/**
 * Where one family's lines are, as two questions.
 *
 * `at` must be strictly increasing in n, and `indexAt` its inverse in the
 * ceiling sense: the smallest n whose line is at or past t. For the periodic
 * family those are n − γ and ⌈t + γ⌉, which is exactly what the pentagrid has
 * always computed.
 */
export interface LineSet {
    /** Where line n sits: x·v = at(n). Strictly increasing. */
    at(n: number): number;
    /** The smallest n with at(n) >= t. */
    indexAt(t: number): number;
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
    /** Which families they are. Length always equals `lines`. */
    families: number[];
}
