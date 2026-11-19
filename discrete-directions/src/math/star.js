// @ts-check
// The star family, measured rather than stored.
//
// Jake, 2026-09-24: *You have to master measuring the star centers. The St5 is
// the most 'symmetric' one.* That is the way in. A St5 is a ten-pointed figure
// with no ambiguity about where its middle is, so measure it there first and the
// other two follow — St3 and St1 are the SAME star with points missing, which is
// what their names say, and they keep its center unchanged.
//
// Measured, a star is two consecutive generations of the P wheel interleaved:
//
//     tips     P[gen]      at t, t+2, t+4, t+6, t+8
//     dimples  P[gen−1]    at t+1, t+3, t+5, t+7, t+9
//
// about the star's center. Exact at all ten tenths, against every one of
// penrose-mosaic's stored arrays. So the center is simply the point both P
// wheels are centered on — nothing to disambiguate, for any of the three.
//
// That also answers the question the diamond posed. Its outline is a rhombus,
// whose two tips are congruent, so the shape alone cannot say which end carries
// the reference. Built this way the question does not arise: the tip is the one
// on P[gen], the far corner is a dimple on P[gen−1], and the center was never in
// the outline to begin with.

import { m10 } from "./wheel.js";

/** @typedef {import("./wheel.js").Pt} Pt */
/** @typedef {import("./wheel.js").WheelSet} WheelSet */

/**
 * The three star tiles. The number is how many of the five points survive.
 * @typedef {"St5" | "St3" | "St1"} StarType
 */

/**
 * Which points a star keeps, as tip offsets in tenths from its own angle.
 * St5 keeps all five; the boat drops two adjacent; the diamond keeps one.
 * @type {Record<StarType, readonly number[]>}
 */
const TIPS = {
    St5: [0, 2, 4, 6, 8],
    St3: [0, 2, 8],
    St1: [0],
};

/**
 * Which dimples bound what is left. A dimple sits between two tips, so dropping
 * tips drops the dimples they enclosed — except that the remaining figure still
 * has to close, and the diamond closes across the star through the far dimple
 * at t+5 rather than around its rim.
 * @type {Record<StarType, readonly number[]>}
 */
const DIMPLES = {
    St5: [1, 3, 5, 7, 9],
    St3: [1, 3, 7, 9],
    St1: [1, 5, 9],
};

/**
 * The outline of a star tile, in order, as absolute points.
 *
 * `w` is the wheel set at the tile's generation and `below` the one under it —
 * the tips come from the first and the dimples from the second.
 *
 * @param {StarType} type
 * @param {WheelSet} w
 * @param {WheelSet} below
 * @param {number} tenth
 * @param {Pt} [loc]
 * @returns {Pt[]}
 */
export function starPolygon(type, w, below, tenth, loc = [0, 0]) {
    const tips = TIPS[type], dimples = DIMPLES[type];
    /** @type {Pt[]} */
    const out = [];
    /** @type {(v: Pt) => void} */
    const push = (v) => { out.push([loc[0] + v[0], loc[1] + v[1]]); };

    if (type === "St1") {
        // One point, closed back through the star's far side.
        push(w.p[m10(tenth)]);
        push(below.p[m10(tenth + 1)]);
        push(below.p[m10(tenth + 5)]);
        push(below.p[m10(tenth + 9)]);
        return out;
    }
    // Walk the rim: tip, dimple, tip, dimple, … in tenth order, skipping the
    // points this type does not have.
    for (let k = 0; k < 10; k++) {
        const off = m10(k);
        if (k % 2 === 0 && tips.includes(off)) push(w.p[m10(tenth + off)]);
        if (k % 2 === 1 && dimples.includes(off)) push(below.p[m10(tenth + off)]);
    }
    return out;
}

/**
 * The five tip directions of a St5 at `tenth` — the stride-2 rule again, this
 * time on P rather than D. A pentagon is D at stride 2 about its center; a star
 * is P at stride 2 about its center, with P of the generation below filling in
 * between. The two figures are the same construction on the two wheels.
 *
 * @param {WheelSet} w
 * @param {number} tenth
 * @returns {Pt[]}
 */
export function starTips(w, tenth) {
    return [0, 1, 2, 3, 4].map((i) => w.p[m10(tenth + 2 * i)]);
}
