// The substitution: one tile in, a whole tiling out.
//
// Ported from penrose-mosaic's `penrose-screen.js` and reduced to tenths. Two
// things fell out in the reduction and are worth recording:
//
//  - `isHeads` never reaches a tile outline. It is threaded through every call
//    in the original and consulted only by layers that are not the P1 tiles, so
//    the shape is a function of the tenth alone. It is gone here.
//
//  - `deca()` branches on `angle.isDown` and reads `wheel.up[f]` or
//    `wheel.down[f]` accordingly, sometimes swapping which. Every one of those
//    branches is `+5` on the tenth. The whole up/down distinction is the fifth
//    bit of the index, so with tenths there is no branch left to take.
//
// Each generation is one P1 inflation, ×φ², which is two Robinson deflations.

import { m10, type Pt, type Wheel, type WheelSet } from "./wheel.js";
import { BOAT, DIAMOND, PENTA, STAR, pentagon, starOutline, type Walk } from "./walk.js";

/** The six P1 tile types, plus the three composite seeds that are not tiles. */
export type TileType = "Pe5" | "Pe3" | "Pe1" | "St5" | "St3" | "St1";
export type SeedType = TileType | "Sun" | "Star" | "Deca";

/** One placed tile: which shape, turned how far, centered where. */
export interface Placement {
    readonly type: TileType;
    readonly tenth: number;
    readonly loc: Pt;
}

/** The outline each tile type walks. */
export const WALK_OF: Record<TileType, Walk> = {
    Pe5: PENTA, Pe3: PENTA, Pe1: PENTA,
    St5: STAR, St3: BOAT, St1: DIAMOND,
};

/**
 * The substitution tables, from penrose-mosaic's `penrose.js`.
 *
 * `twist` is how far each of the five child pentagons turns, in fifths;
 * `diamond` names the slots that also carry a St1; `arms` names the slots of a
 * star that exist at all — St5 has five, the boat three, the diamond one, which
 * is where those names come from.
 */
const PENTA_RULE: Record<"Pe5" | "Pe3" | "Pe1", {
    twist: readonly number[]; diamond: readonly number[];
}> = {
    Pe5: { twist: [0, 0, 0, 0, 0], diamond: [] },
    Pe3: { twist: [0, 0, -1, 1, 0], diamond: [0] },
    Pe1: { twist: [0, -1, 1, -1, 1], diamond: [1, 4] },
};

const STAR_ARMS: Record<"St5" | "St3" | "St1", readonly boolean[]> = {
    St5: [true, true, true, true, true],
    St3: [true, true, false, false, true],
    St1: [true, false, false, false, false],
};

const isPenta = (t: string): t is "Pe5" | "Pe3" | "Pe1" => t in PENTA_RULE;
const isStar = (t: string): t is "St5" | "St3" | "St1" => t in STAR_ARMS;

/** The names `expand` accepts. Anything else is a caller's mistake, not a tile. */
export const SEED_TYPES: readonly SeedType[] =
    ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1", "Sun", "Star", "Deca"];

export const isSeedType = (t: string): t is SeedType =>
    (SEED_TYPES as readonly string[]).includes(t);

/** Wheels per generation, built once per expansion. */
type Ladder = readonly WheelSet[];

const tr = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

/**
 * Expand `type` at `tenth` about `loc`, down to single tiles.
 *
 * `gen` counts P1 generations; at 0 the figure is one tile and is emitted.
 */
export function expand(
    type: SeedType, tenth: number, loc: Pt, gen: number, ladder: Ladder,
): Placement[] {
    const out: Placement[] = [];
    walk(type, m10(tenth), loc, gen);
    return out;

    function walk(ty: SeedType, a: number, at: Pt, g: number): void {
        switch (ty) {
            case "Sun": return sun(a, at, g);
            case "Star": return starPatch(a, at, g);
            case "Deca": return deca(a, at, g);
        }
        if (!isPenta(ty) && !isStar(ty)) throw new Error(`not a tile type: ${ty}`);
        if (g <= 0) { out.push({ type: ty, tenth: a, loc: at }); return; }
        return isPenta(ty) ? penta(ty, a, at, g) : star(ty, a, at, g);
    }

    function penta(ty: "Pe5" | "Pe3" | "Pe1", a: number, at: Pt, g: number): void {
        const { p, s } = ladder[g];
        const { twist, diamond } = PENTA_RULE[ty];

        walk("Pe5", m10(a + 5), at, g - 1);

        for (let i = 0; i < 5; i++) {
            const sh = m10(a + 2 * i);
            walk(twist[i] === 0 ? "Pe3" : "Pe1", m10(sh + 2 * twist[i]),
                 tr(at, p[sh]), g - 1);
            if (diamond.includes(i))
                walk("St1", m10(sh + 5), tr(at, s[m10(sh + 5)]), g - 1);
        }
    }

    function star(ty: "St5" | "St3" | "St1", a: number, at: Pt, g: number): void {
        const { s, t } = ladder[g];
        const arms = STAR_ARMS[ty];

        walk("St5", m10(a + 5), at, g - 1);

        for (let i = 0; i < 5; i++) {
            if (!arms[i]) continue;
            const sh = m10(a + 2 * i);
            walk("Pe1", m10(sh + 5), tr(at, s[sh]), g - 1);
            walk("St3", sh, tr(at, t[sh]), g - 1);
        }
    }

    /**
     * The Sun patch — a blue pentagon with five Queens around it.
     *
     * `penta(Pe5)` lays the center Pe5, five Pe3 and five St1; what it does not
     * place are the two orange pentagons of each Queen, nor the diamonds in the
     * cracks — its own diamonds sit on the s wheel and the Sun's are a ring
     * further out on t, halfway between the Pe3 directions.
     *
     * Rhomb count 55 = 5 (Pe5) + 5x4 (Pe3) + 10x3 (Pe1); the St1 emit none.
     */
    function sun(a: number, at: Pt, g: number): void {
        if (g <= 0) return;
        const { p, s } = ladder[g];

        walk("Pe5", a, at, g);

        for (let i = 0; i < 5; i++) {
            const sh = m10(a + 2 * i);
            const locPe3 = tr(at, p[sh]);
            for (const [off, tw] of [[3, 2], [2, 3]] as const)
                walk("Pe1", m10(sh + 2 * tw + 5),
                     tr(locPe3, p[m10(sh + 2 * off + 5)]), g - 1);
            // The diamond in the crack between this Pe3 and the next.
            //
            // penrose-mosaic put these on the T wheel, "a ring further out …
            // halfway between the Pe3 directions", and they came out stabbing
            // into the yellow pentagons with gaps beside them. They belong on
            // the S wheel at the odd tenths — the same wheel and the same rung
            // penta() already uses for its own diamonds. Found by searching
            // every wheel at three generations for a ring that overlaps nothing:
            // this is the one that also seats all twenty corners on vertices the
            // rest of the figure already has.
            const crack = m10(a + 2 * i + 1);
            walk("St1", crack, tr(at, s[crack]), g - 1);
        }
    }

    /**
     * The Star patch — a five-star gap with a ring around it.
     *
     * `star(St5)` lays the center St5, five Pe1 tips and five St3 boats, but
     * puts its boats where the Pe3 belong, so the Pe3 are placed explicitly.
     *
     * Rhomb count 35 = 5x3 (Pe1) + 5x4 (Pe3); St5 and St3 emit none.
     */
    function starPatch(a: number, at: Pt, g: number): void {
        if (g <= 0) return;
        const { s, t } = ladder[g];

        walk("St5", a, at, g - 1);

        for (let j = 0; j < 5; j++) {
            const up = m10(2 * j + a), down = m10(5 + 2 * j + a);
            walk("Pe1", up, tr(at, s[down]), g - 1);
            walk("Pe3", down, tr(at, t[up]), g - 1);
            walk("St3", down, tr(at, t[down]), g - 1);
        }
    }

    /**
     * The decagon — a type unto itself: a yellow pentagon, two diamonds, two
     * orange pentagons and a boat. Every up/down branch in the original is `+5`.
     */
    function deca(a: number, at: Pt, g: number): void {
        if (g <= 0) return;
        const { p, s } = ladder[g];

        walk("Pe3", a, at, g - 1);
        walk("St1", m10(a + 6), tr(at, s[m10(a + 2)]), g - 1);
        walk("St1", m10(a + 4), tr(at, s[m10(a + 8)]), g - 1);
        walk("Pe1", m10(a + 9), tr(at, p[m10(a + 1)]), g - 1);
        walk("Pe1", m10(a + 1), tr(at, p[m10(a + 9)]), g - 1);
        walk("St3", m10(a + 5), tr(at, tr(p[m10(a + 9)], s[m10(a + 1)])), g - 1);
    }
}

/**
 * The polygon a placement draws, in lattice coordinates.
 *
 * The only correct way to turn a `Placement` into points: a pentagon is the D
 * wheel at stride 2 about its center, and the star family walks from `loc + P[t]`.
 * Placing either by the walk's first vertex displaces it — differently at each
 * tenth — which is how the first version of this page drew a broken tiling that
 * still passed a congruence test.
 */
export function outlineOf(t: Placement, w: WheelSet): Pt[] {
    return isPenta(t.type)
        ? pentagon(w.d, t.tenth, t.loc)
        : starOutline(WALK_OF[t.type], w, t.tenth, t.loc);
}
