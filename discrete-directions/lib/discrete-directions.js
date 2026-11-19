// @ts-check
/**
 * Everything, for a consumer that wants one import.
 *
 * The three named entry points beside this one are the ones to prefer — they
 * say what a page actually uses, and they are what the surface test pins:
 *
 *     lib/wheels.js    five points, the operator family, the ladder, the flake
 *     lib/tiles.js     outlines, the star family, the rhombs
 *     lib/patch.js     the substitution and `outlineOf`
 */

export * from "./wheels.js";
export * from "./tiles.js";
export * from "./patch.js";
