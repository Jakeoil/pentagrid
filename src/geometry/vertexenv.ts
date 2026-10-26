/**
 * Vertex environments — the VE codes of the generalized Penrose literature.
 *
 * A vertex of a rhombus tiling is classified by the cyclic word of the corner
 * angles that meet there, written in units of 36 degrees: a thin rhomb
 * contributes 1 or 4, a thick one 2 or 3, and a complete vertex sums to 10.
 * Two vertices are the same environment when their words agree up to rotation
 * AND reflection — which is the paper's convention, not de Bruijn's: it counts
 * M's two mirror forms as one letter.
 *
 * The sixteen letters are transcribed from figure 5a of
 * `Nature Communications (2024) 15:10856` — read off the figure rather than
 * copied from a caption, by segmenting each picture into tiles, finding the
 * corner every tile shares, and measuring its angle there. All sixteen came
 * out summing to exactly 10 with every angle within 0.1 of an integer.
 *
 * These are the un-arrowed environments. De Bruijn classifies by the figure
 * the colored arrows make (`Indagationes Mathematicae` 1981, figure 7, page
 * 48) and so counts eight where this counts seven: his S and S5 share a rhomb
 * star and are told apart only by the arrows. Jake: "the diagram of 16 rhombs
 * is not and in many cases can not use the green rhomb arrows. (thus S == S5)".
 */

import type { Rhomb } from "./types.js";

/**
 * The sixteen, keyed by canonical word. `ST` is written `*`: it is the only
 * two-character code in the set, and a pool ball has room for one glyph.
 */
export const VE_CODE: Readonly<Record<string, string>> = {
    "334": "D",
    "244": "Q",
    "2224": "K",
    "1333": "L",
    "1243": "M",
    "12133": "J",
    "11242": "R",
    "22222": "S",
    "112222": "T",
    "121213": "U",
    "1121122": "V",
    "1121212": "W",
    "11112112": "X",
    "11111212": "Y",
    "111111112": "Z",
    "1111111111": "*",
};

/**
 * Which of the sixteen a Penrose patch can show: the seven whose density is
 * constant, measured as consecutive powers of 1/phi summing to exactly 1 —
 * D at phi^-2, J phi^-3, Q phi^-4, K phi^-5, S and V both phi^-6, T phi^-7.
 *
 * This is de Bruijn's own list with S and S5 merged, and it is the six the
 * paper names for LIC1 — {Q, K, J, S, T, V} — plus D.
 */
export const PENROSE_CODES: readonly string[] = ["D", "Q", "K", "J", "S", "T", "V"];

/**
 * The interior angle at corner `i` of a rhomb, in units of 36 degrees.
 *
 * Rhomb vertices come out counterclockwise for some tiles and clockwise for
 * others, so half the corners arrive as the exterior angle; both rhombs only
 * ever have interior angles of 1, 2, 3 or 4 units, so folding anything above 5
 * is both the fix and a check.
 */
export function cornerUnits(r: Rhomb, i: number): number {
    const p = r.vertices[i];
    const a = r.vertices[(i + 3) % 4], b = r.vertices[(i + 1) % 4];
    const t1 = Math.atan2(a[1] - p[1], a[0] - p[0]);
    const t2 = Math.atan2(b[1] - p[1], b[0] - p[0]);
    let d = t2 - t1;
    while (d < 0) d += 2 * Math.PI;
    while (d > 2 * Math.PI) d -= 2 * Math.PI;
    const u = Math.round(d / (Math.PI / 5));
    return u > 5 ? 10 - u : u;
}

/** The canonical word for one star: least rotation of it or of its reverse. */
export function veWord(units: readonly number[]): string {
    let best: string | null = null;
    for (const seq of [units, [...units].reverse()]) {
        for (let i = 0; i < seq.length; i++) {
            const s = seq.slice(i).concat(seq.slice(0, i)).join("");
            if (best === null || s < best) best = s;
        }
    }
    return best ?? "";
}

/** One vertex of the tiling, with the star that sits on it. */
export interface VertexStar {
    x: number;
    y: number;
    /** Corner angles in units of 36 degrees, counterclockwise. */
    units: number[];
    /** True when they sum to 10 — a whole turn, so nothing is missing. */
    complete: boolean;
    /** The canonical word, or "" when the star is incomplete. */
    word: string;
    /**
     * Its letter from figure 5a, or null — either because the star runs off
     * the edge of the patch, or because it is a word the figure does not list.
     * The three this app can produce and the figure does not are `1234`,
     * `1324` and `11224`, all of them off Penrose.
     */
    code: string | null;
}

/**
 * Every vertex of a patch, keyed the way the renderer keys them, with the
 * star standing on it. A vertex at the edge of the collected patch is missing
 * arms, so `complete` is false and `code` is null: an incomplete star is not
 * evidence of a rare environment.
 */
export function vertexStars(rhombs: readonly Rhomb[]): Map<string, VertexStar> {
    const at = new Map<string, { x: number; y: number; arms: { u: number; b: number }[] }>();
    for (const r of rhombs) {
        for (let i = 0; i < 4; i++) {
            const p = r.vertices[i];
            const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
            const next = r.vertices[(i + 1) % 4];
            let slot = at.get(key);
            if (!slot) at.set(key, slot = { x: p[0], y: p[1], arms: [] });
            slot.arms.push({
                u: cornerUnits(r, i),
                b: Math.atan2(next[1] - p[1], next[0] - p[0]),
            });
        }
    }
    const out = new Map<string, VertexStar>();
    for (const [key, v] of at) {
        const units = [...v.arms].sort((a, b) => a.b - b.b).map((a) => a.u);
        const complete = units.reduce((s, u) => s + u, 0) === 10;
        const word = complete ? veWord(units) : "";
        out.set(key, { x: v.x, y: v.y, units, complete, word,
                       code: complete ? (VE_CODE[word] ?? null) : null });
    }
    return out;
}
