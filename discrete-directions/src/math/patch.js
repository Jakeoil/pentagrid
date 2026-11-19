// @ts-check
// The substitution: one tile in, a whole tiling out.
//
// Ported from penrose-mosaic's `penrose-screen.js` and reduced to tenths. Two
// things fell out in the reduction and are worth recording:
//
//  - `isHeads` never reaches a P1 tile OUTLINE — the shape is a function of the
//    tenth alone. An earlier pass took that to mean it carried nothing and
//    dropped it, which was wrong: penrose-mosaic's `renderers.js` uses it for a
//    rhomb's fill gradient and, more to the point, for `drawDihedralStroke`,
//    where it decides which two edges are ridges and which are valleys. That is
//    the Wieringa fold parity, and it is real per-tile information. It is
//    carried on every Placement again, flipping at each level exactly as the
//    original does.
//
//  - `deca()` branches on `angle.isDown` and reads `wheel.up[f]` or
//    `wheel.down[f]` accordingly, sometimes swapping which. Every one of those
//    branches is `+5` on the tenth. The whole up/down distinction is the fifth
//    bit of the index, so with tenths there is no branch left to take.
//
// Each generation is one P1 inflation, ×φ², which is two Robinson deflations.

import { inflate, m10 } from "./wheel.js";
import { BOAT, DIAMOND, PENTA, STAR, pentagon, starOutline } from "./walk.js";

/** @typedef {import("./wheel.js").Pt} Pt */
/** @typedef {import("./wheel.js").WheelSet} WheelSet */
/** @typedef {import("./walk.js").Walk} Walk */

/**
 * The six P1 tile types.
 * @typedef {"Pe5" | "Pe3" | "Pe1" | "St5" | "St3" | "St1"} TileType
 */

/**
 * Those, plus the three composite seeds that are not tiles.
 * @typedef {TileType | "Sun" | "Star" | "Deca"} SeedType
 */

/**
 * One placed tile: which shape, turned how far, centered where.
 *
 * `heads` is the convex or concave aspect, flipped at every level of the
 * recursion. It does not change the outline; it decides a rhomb's ridge and
 * valley edges.
 *
 * @typedef {{
 *     readonly type: TileType,
 *     readonly tenth: number,
 *     readonly loc: Pt,
 *     readonly heads: boolean,
 * }} Placement
 */

/**
 * The outline each tile type walks.
 * @type {Record<TileType, Walk>}
 */
export const WALK_OF = {
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
 *
 * @type {Record<"Pe5" | "Pe3" | "Pe1",
 *     { twist: readonly number[], diamond: readonly number[] }>}
 */
const PENTA_RULE = {
    Pe5: { twist: [0, 0, 0, 0, 0], diamond: [] },
    Pe3: { twist: [0, 0, -1, 1, 0], diamond: [0] },
    Pe1: { twist: [0, -1, 1, -1, 1], diamond: [1, 4] },
};

/** @type {Record<"St5" | "St3" | "St1", readonly boolean[]>} */
const STAR_ARMS = {
    St5: [true, true, true, true, true],
    St3: [true, true, false, false, true],
    St1: [true, false, false, false, false],
};

/** @type {(t: string) => t is "Pe5" | "Pe3" | "Pe1"} */
const isPenta = (t) => t in PENTA_RULE;
/** @type {(t: string) => t is "St5" | "St3" | "St1"} */
const isStar = (t) => t in STAR_ARMS;

/**
 * The names `expand` accepts. Anything else is a caller's mistake, not a tile.
 * @type {readonly SeedType[]}
 */
export const SEED_TYPES =
    ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1", "Sun", "Star", "Deca"];

/** @type {(t: string) => t is SeedType} */
export const isSeedType = (t) => /** @type {readonly string[]} */ (SEED_TYPES).includes(t);

/**
 * Wheels per generation, built once per expansion.
 * @typedef {readonly WheelSet[]} Ladder
 */

/** @type {(a: Pt, b: Pt) => Pt} */
const tr = (a, b) => [a[0] + b[0], a[1] + b[1]];

/**
 * Expand `type` at `tenth` about `loc`, down to single tiles.
 *
 * `floor` stops the recursion early and emits whatever it has reached, which is
 * penrose-mosaic's short-circuit: `penta()` bails at `gen == 1` and draws the
 * large rhomb group there instead of recursing. The result covers the SAME area
 * as a full expansion but with φ⁴ fewer, larger figures — which is not at all
 * the same as expanding one generation less, since that gives a patch φ² smaller
 * overall. Getting those two confused is what put the big rhombs in a huddle in
 * the middle of the figure.
 *
 * @param {SeedType} type
 * @param {number} tenth
 * @param {Pt} loc
 * @param {number} gen
 * @param {Ladder} ladder
 * @param {boolean} [heads]
 * @param {number} [floor]
 * @returns {Placement[]}
 */
export function expand(type, tenth, loc, gen, ladder, heads = true, floor = 0) {
    /** @type {Placement[]} */
    const out = [];
    walk(type, m10(tenth), loc, gen, heads);
    return out;

    /**
     * @param {SeedType} ty
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function walk(ty, a, at, g, h) {
        switch (ty) {
            case "Sun": return sun(a, at, g, h);
            case "Star": return starPatch(a, at, g, h);
            case "Deca": return deca(a, at, g, h);
        }
        if (!isPenta(ty) && !isStar(ty)) throw new Error(`not a tile type: ${ty}`);
        if (g <= floor) { out.push({ type: ty, tenth: a, loc: at, heads: h }); return; }
        return isPenta(ty) ? penta(ty, a, at, g, h) : star(ty, a, at, g, h);
    }

    /**
     * @param {"Pe5" | "Pe3" | "Pe1"} ty
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function penta(ty, a, at, g, h) {
        const { p, s } = ladder[g];
        const { twist, diamond } = PENTA_RULE[ty];

        walk("Pe5", m10(a + 5), at, g - 1, !h);

        for (let i = 0; i < 5; i++) {
            const sh = m10(a + 2 * i);
            walk(twist[i] === 0 ? "Pe3" : "Pe1", m10(sh + 2 * twist[i]),
                 tr(at, p[sh]), g - 1, !h);
            if (diamond.includes(i))
                walk("St1", m10(sh + 5), tr(at, s[m10(sh + 5)]), g - 1, h);
        }
    }

    /**
     * @param {"St5" | "St3" | "St1"} ty
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function star(ty, a, at, g, h) {
        const { s, t } = ladder[g];
        const arms = STAR_ARMS[ty];

        walk("St5", m10(a + 5), at, g - 1, h);

        for (let i = 0; i < 5; i++) {
            if (!arms[i]) continue;
            const sh = m10(a + 2 * i);
            walk("Pe1", m10(sh + 5), tr(at, s[sh]), g - 1, h);
            walk("St3", sh, tr(at, t[sh]), g - 1, !h);
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
     *
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function sun(a, at, g, h) {
        if (g <= 0) return;
        const { p } = ladder[g];

        walk("Pe5", a, at, g, h);

        for (let i = 0; i < 5; i++) {
            const sh = m10(a + 2 * i);
            const locPe3 = tr(at, p[sh]);
            for (const [off, tw] of [[3, 2], [2, 3]])
                walk("Pe1", m10(sh + 2 * tw + 5),
                     tr(locPe3, p[m10(sh + 2 * off + 5)]), g - 1, !h);
            // The diamond in the crack between this Pe3 and the next.
            //
            // Jake: the Sun is a composite like the Deca but does not follow the
            // rules -- it is a SUBSET of a higher generation of Pe5, as the Star
            // is of St5. That is the test that found this: of the Sun's 21 tiles,
            // 16 already appear in `Pe5` at tenth a+5, one generation up, and the
            // five that did not were exactly these diamonds.
            //
            // penrose-mosaic put them on the T wheel; a search then put them on S
            // at the odd tenths, which tiles but is the wrong TILE -- a rhombus is
            // centrally symmetric, so the same gap is filled by two diamonds whose
            // references are opposite ends, and only one of them is the one Pe5
            // places. It is this one: the far tenth, on the inflated D wheel.
            const crack = m10(a + 2 * i + 1);
            walk("St1", m10(crack + 5), tr(at, inflate(ladder[g].d)[crack]), g - 1, h);
        }
    }

    /**
     * The Star patch — a five-star gap with a ring around it.
     *
     * `star(St5)` lays the center St5, five Pe1 tips and five St3 boats, but
     * puts its boats where the Pe3 belong, so the Pe3 are placed explicitly.
     *
     * Rhomb count 35 = 5x3 (Pe1) + 5x4 (Pe3); St5 and St3 emit none.
     *
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function starPatch(a, at, g, h) {
        if (g <= 0) return;
        const { s, t } = ladder[g];

        walk("St5", a, at, g - 1, h);

        for (let j = 0; j < 5; j++) {
            const up = m10(2 * j + a), down = m10(5 + 2 * j + a);
            walk("Pe1", up, tr(at, s[down]), g - 1, h);
            walk("Pe3", down, tr(at, t[up]), g - 1, !h);
            walk("St3", down, tr(at, t[down]), g - 1, !h);
        }
    }

    /**
     * The decagon — a type unto itself: a yellow pentagon, two diamonds, two
     * orange pentagons and a boat. Every up/down branch in the original is `+5`.
     *
     * @param {number} a
     * @param {Pt} at
     * @param {number} g
     * @param {boolean} h
     */
    function deca(a, at, g, h) {
        if (g <= 0) return;
        const { p, s } = ladder[g];

        walk("Pe3", a, at, g - 1, !h);
        walk("St1", m10(a + 6), tr(at, s[m10(a + 2)]), g - 1, h);
        walk("St1", m10(a + 4), tr(at, s[m10(a + 8)]), g - 1, h);
        walk("Pe1", m10(a + 9), tr(at, p[m10(a + 1)]), g - 1, !h);
        walk("Pe1", m10(a + 1), tr(at, p[m10(a + 9)]), g - 1, !h);
        walk("St3", m10(a + 5), tr(at, tr(p[m10(a + 9)], s[m10(a + 1)])), g - 1, h);
    }
}

/**
 * The polygon a placement draws, in its own coordinates.
 *
 * The only correct way to turn a `Placement` into points: a pentagon is the D
 * wheel at stride 2 about its center, and the star family walks from `loc + P[t]`.
 * Placing either by the walk's first vertex displaces it — differently at each
 * tenth — which is how the first version of this page drew a broken tiling that
 * still passed a congruence test.
 *
 * @param {Placement} t
 * @param {WheelSet} w
 * @returns {Pt[]}
 */
export function outlineOf(t, w) {
    return isPenta(t.type)
        ? pentagon(w.d, t.tenth, t.loc)
        : starOutline(WALK_OF[t.type], w, t.tenth, t.loc);
}
