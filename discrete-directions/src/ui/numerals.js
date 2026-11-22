// @ts-check
// Jake's compact numeral: four characters, always, and the sign is a color.
//
//     red     negative            black   positive
//
// No minus sign — it costs a character and the color says it better. Three
// significant digits fill three of the four cells; the fourth is a MARKER that
// slides right as the number grows:
//
//     amber 2  3 4 5        0.00345     two leading zeros
//     amber 1  3 4 5        0.0345      one
//        .     3 4 5        0.345       none: the point itself, at the left
//        3  .  4 5          3.45
//        3  4  .  5         34.5
//        3  4  5  .         345
//        3  4  5  amber 1   3450        one trailing zero
//        3  4  5  amber 2   34500       two
//
// So the marker is one continuous ladder: an amber count of leading zeros, then
// the decimal point walking across the digits, then an amber count of trailing
// zeros. Four cells hold every magnitude from 10⁻⁹ to 10⁹ with three figures of
// precision, and columns of them line up.
//
// EXACT INTEGERS UNDER 1000 ARE LEFT ALONE. Most of what this project prints is
// a small lattice coordinate, and `3` should read as `3`, not as `3.00`. The
// ladder is for when floating point has actually turned up.

/** One character of a rendered numeral, and what color it wants. */
/** @typedef {{ ch: string, tone: "digit" | "amber" | "point" }} Cell */

/**
 * @param {number} v
 * @returns {{ cells: Cell[], neg: boolean, exact: boolean }}
 *   `exact` is true where the value printed in full, with nothing rounded away.
 */
export function compact(v) {
    const neg = v < 0 || Object.is(v, -0);
    const a = Math.abs(v);
    /** @type {(s: string) => Cell[]} */
    const digits = (s) => [...s].map((ch) => ({ ch, tone: /** @type {const} */ ("digit") }));

    if (!Number.isFinite(v)) return { cells: digits(a === Infinity ? "inf" : "nan"), neg, exact: false };
    if (a === 0) return { cells: digits("0"), neg, exact: true };
    if (Number.isInteger(a) && a < 1000) return { cells: digits(String(a)), neg, exact: true };

    // Three significant figures, and the decimal exponent they sit at.
    let e = Math.floor(Math.log10(a));
    let d = Math.round(a / 10 ** (e - 2));
    if (d >= 1000) { d = Math.round(d / 10); e += 1; }   // 999.6 rounds up a decade
    if (d < 100) { d = Math.round(a / 10 ** (e - 3)); e -= 1; }
    const s = String(d);
    const exact = Math.abs(d * 10 ** (e - 2) - a) < 1e-12 * a;

    if (e <= -2)                                   // amber count of leading zeros
        return { cells: [{ ch: String(-e - 1), tone: "amber" }, ...digits(s)], neg, exact };
    if (e >= 3)                                    // amber count of trailing zeros
        return { cells: [...digits(s), { ch: String(e - 2), tone: "amber" }], neg, exact };
    const at = e + 1;                              // the point, walking across
    const cells = digits(s);
    cells.splice(at, 0, { ch: ".", tone: "point" });
    return { cells, neg, exact };
}

/** The colors the three tones are drawn in. Amber is the odd one out on purpose. */
export const TONE = {
    positive: "#111418",
    negative: "#c62828",
    amber: "#c77c00",
};

/**
 * The numeral as HTML, for a readout.
 * @param {number} v
 * @returns {string}
 */
export function numHTML(v) {
    const { cells, neg } = compact(v);
    const body = cells.map(({ ch, tone }) => tone === "amber"
        ? `<i class="amber">${ch}</i>`
        : ch === "." ? "." : ch).join("");
    return `<span class="num${neg ? " neg" : ""}">${body}</span>`;
}

/** A point, as two numerals. @type {(p: readonly [number, number]) => string} */
export const ptHTML = (p) => `(${numHTML(p[0])}, ${numHTML(p[1])})`;

/**
 * How wide one character is. A stub canvas — which is what the page checks run
 * against — may have no `measureText` at all, and a numeral is not worth
 * throwing over, so fall back to a monospace guess.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} ch
 * @returns {number}
 */
function charWidth(ctx, ch) {
    const m = typeof ctx.measureText === "function" ? ctx.measureText(ch) : null;
    return m && typeof m.width === "number" ? m.width : 6;
}

/**
 * The numeral on a canvas, laid out left to right from `x`. Returns its width,
 * so a caller can center it by drawing twice or by measuring first.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} v
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function drawNumeral(ctx, v, x, y) {
    const { cells, neg } = compact(v);
    const ink = neg ? TONE.negative : TONE.positive;
    const was = ctx.textAlign;
    ctx.textAlign = "left";
    let at = x;
    for (const { ch, tone } of cells) {
        ctx.fillStyle = tone === "amber" ? TONE.amber : ink;
        ctx.fillText(ch, at, y);
        at += charWidth(ctx, ch);
    }
    ctx.textAlign = was;
    return at - x;
}

/**
 * How wide `drawNumeral` will be, without drawing it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} v
 * @returns {number}
 */
export const numeralWidth = (ctx, v) =>
    compact(v).cells.reduce((w, c) => w + charWidth(ctx, c.ch), 0);
