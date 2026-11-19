// @ts-check
/**
 * The tiles themselves: P1 outlines as walks in the edge wheel, the star family
 * as two P generations interleaved, and the P3 rhomb overlay.
 *
 * A tile is a shape plus an anchor. Use `pentagon` and `starOutline` — or
 * `outlineOf` from `./patch.js` — rather than placing a walk by its first
 * vertex, which displaces it by a different amount at every tenth.
 */

export {
    // outlines as walks
    PENTA, STAR, BOAT, DIAMOND, turn, reverse, vertices, closes,
    // placing them
    anchorFor, pentagon, starOutline,
    // the rhombs
    THICK, THIN, rhombus, rhombGroup,
} from "../src/math/walk.js";

export { starPolygon, starTips } from "../src/math/star.js";

/** @typedef {import("../src/math/walk.js").Walk} Walk */
/** @typedef {import("../src/math/walk.js").RhombSpec} RhombSpec */
/** @typedef {import("../src/math/walk.js").Spelling} Spelling */
/** @typedef {import("../src/math/walk.js").GroupMember} GroupMember */
/** @typedef {import("../src/math/star.js").StarType} StarType */
