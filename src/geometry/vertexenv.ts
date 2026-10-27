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
 * The wedge a rhomb occupies at its corner `i`: how wide it is, in units of 36
 * degrees, and the bearing it STARTS at, going counterclockwise.
 *
 * Both halves matter, and the start is the half that is easy to get wrong.
 * Rhomb vertices come out counterclockwise for some tiles and clockwise for
 * others, so the turn from the `prev` edge to the `next` edge is the interior
 * angle on some tiles and the exterior angle on others — both rhombs only ever
 * have interior angles of 1, 2, 3 or 4 units, so folding anything above 5 is
 * both the fix and a check. But when it folds, the wedge runs from `next`
 * round to `prev` rather than the other way, so `next` is its START and not
 * its end.
 *
 * Reading the bearing to `next` for every corner regardless — which this did
 * at first — sorts some corners by where their wedge begins and others by
 * where it ends. The cyclic order then scrambles whenever a wide wedge sits
 * beside a narrow one, and the word comes out a PERMUTATION of the true one:
 * `1234` or `1324` where M's `1243` belongs, `11224` where R's `11242` does.
 * Jake, looking at a patch: "some of the question marks are M's some should be
 * R's."
 */
export function cornerSector(r: Rhomb, i: number): { units: number; start: number } {
    const p = r.vertices[i];
    const a = r.vertices[(i + 3) % 4], b = r.vertices[(i + 1) % 4];
    const t1 = Math.atan2(a[1] - p[1], a[0] - p[0]);
    const t2 = Math.atan2(b[1] - p[1], b[0] - p[0]);
    let d = t2 - t1;
    while (d < 0) d += 2 * Math.PI;
    while (d > 2 * Math.PI) d -= 2 * Math.PI;
    const u = Math.round(d / (Math.PI / 5));
    return u > 5 ? { units: 10 - u, start: t2 } : { units: u, start: t1 };
}

/** The interior angle at corner `i` of a rhomb, in units of 36 degrees. */
export function cornerUnits(r: Rhomb, i: number): number {
    return cornerSector(r, i).units;
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

/**
 * What kind of star stands on a vertex, by the one test that tells them
 * apart: whether the corner angles add to a whole turn.
 *
 * `whole` — ten units, one environment, and the only kind with a letter.
 *
 * `rim` — fewer than ten. The star runs off the edge of the collected patch,
 * so part of it was never built. Nothing to say.
 *
 * `superposed` — MORE than ten, which only a singular pentagrid produces.
 * Several readings' stars stand on the same point, sharing some tiles and not
 * others, so the union overruns a turn without being a multiple of one.
 *
 * The last two were one value until 2026-10-27, and they are opposites: the
 * rim has too little information and a singular vertex has too much. Jake:
 * "grow/roof has a lot of work that makes singularities first class. [...]
 * they are superpositions of finite sets of VE's." A superposed vertex has a
 * SET of environments — pushing γ off the singular set by `walls.ts`'s fifty
 * sum-zero nudges gives {D, J}, {J, V}, {K, Q}, {K, Q, S} and so on, evenly
 * split — and naming the set is the work PLAN §11.11 describes. Telling it
 * apart from the rim is the first step of that and is worth having on its own.
 */
export type StarKind = "whole" | "rim" | "superposed";

/** One vertex of the tiling, with the star that sits on it. */
export interface VertexStar {
    x: number;
    y: number;
    /** Corner angles in units of 36 degrees, counterclockwise. */
    units: number[];
    /** Their total. 10 is a whole turn. */
    turn: number;
    kind: StarKind;
    /** True when `kind` is `whole` — the one case with a word and a letter. */
    complete: boolean;
    /** The canonical word, or "" when the star is not whole. */
    word: string;
    /**
     * Its letter from figure 5a, or null — because the star is not whole, or
     * because it is a word the figure does not list. No γ tried has produced
     * the second case: the sixteen are closed under this construction, and
     * `tools/vertexenv.test.mjs` asserts it. The words that once seemed to
     * escape them were permutations of them, from the ordering bug
     * `cornerSector` describes.
     */
    code: string | null;
}

/**
 * Every vertex of a patch, keyed the way the renderer keys them, with the
 * star standing on it. Only a `whole` star carries a word and a letter: a rim
 * vertex is missing arms and a superposed one has too many, and neither is
 * evidence of a rare environment.
 */
export function vertexStars(rhombs: readonly Rhomb[]): Map<string, VertexStar> {
    const at = new Map<string, { x: number; y: number; arms: { u: number; b: number }[] }>();
    for (const r of rhombs) {
        for (let i = 0; i < 4; i++) {
            const p = r.vertices[i];
            const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
            let slot = at.get(key);
            if (!slot) at.set(key, slot = { x: p[0], y: p[1], arms: [] });
            const { units, start } = cornerSector(r, i);
            slot.arms.push({ u: units, b: start });
        }
    }
    const out = new Map<string, VertexStar>();
    for (const [key, v] of at) {
        const units = [...v.arms].sort((a, b) => a.b - b.b).map((a) => a.u);
        const turn = units.reduce((s, u) => s + u, 0);
        const kind: StarKind = turn === 10 ? "whole" : turn < 10 ? "rim" : "superposed";
        const complete = kind === "whole";
        const word = complete ? veWord(units) : "";
        out.set(key, { x: v.x, y: v.y, units, turn, kind, complete, word,
                       code: complete ? (VE_CODE[word] ?? null) : null });
    }
    return out;
}

/** One line of a census: an environment, how many there are, and its share. */
export interface VeCount {
    /** The letter, or `?` followed by the word when the sixteen do not name it. */
    code: string;
    n: number;
    /** Of the whole stars, not of every vertex — the rim is not an environment. */
    share: number;
}

export interface VeCensus {
    /** Most common first, with the unnamed words after the letters. */
    rows: VeCount[];
    /** Stars that close — the denominator of every share. */
    whole: number;
    /** Vertices whose star runs off the edge of the patch, so it is not read. */
    rim: number;
    /**
     * Vertices carrying more than a whole turn: a singular pentagrid's
     * superposed readings. Counted apart from the rim because they are its
     * opposite — see `StarKind` — and because their number is a direct
     * reading of how singular the γ is. Zero on any regular pentagrid.
     */
    superposed: number;
}

/**
 * What environments a patch contains and in what proportion — the figure 5b/c
 * reading, taken from the patch on screen.
 *
 * The rim and the superposed are counted and excluded rather than silently
 * dropped. A patch's edge is a ring of part-built stars and folding them in
 * would invent a large rare environment out of nothing; a superposed vertex is
 * several environments at once and belongs to none of them until the reading
 * is chosen.
 */
export function veCensus(rhombs: readonly Rhomb[]): VeCensus {
    const n = new Map<string, number>();
    let whole = 0, rim = 0, superposed = 0;
    for (const v of vertexStars(rhombs).values()) {
        if (v.kind === "rim") { rim++; continue; }
        if (v.kind === "superposed") { superposed++; continue; }
        whole++;
        const k = v.code ?? `?${v.word}`;
        n.set(k, (n.get(k) ?? 0) + 1);
    }
    const rows = [...n]
        .map(([code, c]) => ({ code, n: c, share: whole ? c / whole : 0 }))
        // letters before the unnamed words, then commonest first
        .sort((a, b) => Number(a.code.startsWith("?")) - Number(b.code.startsWith("?"))
                     || b.n - a.n || a.code.localeCompare(b.code));
    return { rows, whole, rim, superposed };
}
