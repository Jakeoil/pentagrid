// @ts-check
/**
 * The substitution: one seed in, a whole tiling out.
 *
 * `expand` returns placements — type, tenth, location, parity — and nothing
 * drawable. `outlineOf` is what turns one into points, and it is the only
 * correct way to do so.
 */

export {
    SEED_TYPES, WALK_OF, isSeedType, expand, outlineOf,
} from "../src/math/patch.js";

/** @typedef {import("../src/math/patch.js").TileType} TileType */
/** @typedef {import("../src/math/patch.js").SeedType} SeedType */
/** @typedef {import("../src/math/patch.js").Placement} Placement */
/** @typedef {import("../src/math/patch.js").Ladder} Ladder */
