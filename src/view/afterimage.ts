// The negative afterimage of a color, as a formula.
//
// Stare at a patch of color and look away: what you see is the complement,
// pale. That is opponent-process adaptation — the cone-difference channels the
// patch has been driving one way relax the other way — so the afterimage is a
// reflection through the NEUTRAL AXIS of an opponent space, together with the
// fading and the washing-out that a partly adapted channel gives.
//
// The hue comes from the MECHANISM, not from a geometric complement. Staring
// drives each cone type and costs it gain; look at the page and you see white
// through what is left. That is von Kries adaptation —
//
//     gain_i = 1 / (1 + K · L_i / Lw_i),    afterimage_i = Lw_i · gain_i
//
// — in CAT16 cone space, with K how hard you stared. Two stages follow, and
// they are about appearance rather than mechanism: the chroma FADES by
// `strength`, since adaptation is partial and what you see is a tint; and the
// lightness is FIXED, pale, because an afterimage is seen against whatever you
// look at next and against a page they all read as pale tints — which is what
// Jake described, rather than the dark violet a strict lightness inversion
// would give for yellow.
//
// A REFLECTION came first and was not good enough. Negating a and b is the
// opponent statement too, and in Oklab it gave Jake's light purple and light
// blue exactly — but blue's afterimage landed at hue 84°, an orange-yellow,
// and he said so: "too orange. My eye sees yellow, paler than the pe3 color,
// but in that hue." The cones put it at 100°, against Pe3's own 110°, while
// reproducing the light blue to the byte. The complement of a primary is not
// 180° from it in any space; the cones know where it is and the geometry does
// not. (CIELAB is worse still: it has sRGB blue at 306°, nearer purple than
// blue, so a reflection there lands on a yellow-GREEN.)
//
// Measured against his three: #0000ff -> #f1e07b pale yellow, #ffff00 ->
// #d9dbfe light purple, #e46c0a -> #b6e6ff light blue.

/** How hard you stared: the von Kries adaptation strength. */
export const AFTERIMAGE_ADAPTATION = 8;
/** How much of the chroma survives: 1 would be a fully saturated complement. */
export const AFTERIMAGE_STRENGTH = 0.75;
/** Where the tint sits, in Oklab lightness. Pale, because afterimages are. */
export const AFTERIMAGE_LIGHTNESS = 0.9;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB hex to Oklab. */
export function oklab(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    const r = toLinear(((n >> 16) & 255) / 255);
    const g = toLinear(((n >> 8) & 255) / 255);
    const b = toLinear((n & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

/** Oklab to linear sRGB, which may be out of gamut — the caller checks. */
function toLinearRgb(L: number, A: number, B: number): [number, number, number] {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
}

const hexOf = (rgb: readonly number[]) => "#" + rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, Math.min(1, c))) * 255)))
        .toString(16).padStart(2, "0"))
    .join("");

/** CAT16, and its inverse: XYZ to the cone responses and back. */
const CAT16 = [
    [0.401288, 0.650173, -0.051461],
    [-0.250268, 1.204414, 0.045854],
    [-0.002079, 0.048952, 0.953127],
];
const CAT16_INV = [
    [1.862068, -1.011255, 0.149187],
    [0.387527, 0.621447, -0.008974],
    [-0.015841, -0.034123, 1.049964],
];
const D65: [number, number, number] = [0.95047, 1, 1.08883];
const apply = (m: number[][], v: readonly number[]): [number, number, number] =>
    [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
     m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
     m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];

/** What the cones have left after staring at `hex`, seen on white: linear sRGB. */
function adapted(hex: string, K: number): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    const r = toLinear(((n >> 16) & 255) / 255);
    const g = toLinear(((n >> 8) & 255) / 255);
    const b = toLinear((n & 255) / 255);
    const xyz: [number, number, number] = [
        0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
        0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
        0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
    ];
    const cone = apply(CAT16, xyz);
    const white = apply(CAT16, D65);
    const left = white.map((w, i) => w / (1 + K * cone[i] / w));
    const [X, Y, Z] = apply(CAT16_INV, left);
    return [
        3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
        -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
        0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
    ];
}

/** Oklab of a linear-sRGB triple. */
function oklabOf(r: number, g: number, b: number): [number, number, number] {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

const cache = new Map<string, string>();

/**
 * The afterimage of one color.
 *
 * Out-of-gamut tints are pulled in by chroma rather than clipped per channel,
 * which would swing the hue: a tint that cannot be shown is shown grayer, not
 * a different color.
 */
export function afterimage(
    hex: string,
    strength = AFTERIMAGE_STRENGTH,
    lightness = AFTERIMAGE_LIGHTNESS,
): string {
    const key = `${hex}|${strength}|${lightness}`;
    const hit = cache.get(key);
    if (hit) return hit;
    // The cones give the hue and the chroma; the stages below give the look.
    const [lr, lg, lb] = adapted(hex, AFTERIMAGE_ADAPTATION);
    // Not clamped: a cone response that lands outside sRGB still points the
    // right way, and cbrt is happy with it. Clipping here would bend the hue
    // before the gamut stage below has a chance to pull the chroma in instead.
    const [, a, b] = oklabOf(lr, lg, lb);
    let aa = a * strength, bb = b * strength;
    let out = hexOf(toLinearRgb(lightness, aa, bb));
    for (let i = 0; i < 48; i++) {
        const rgb = toLinearRgb(lightness, aa, bb);
        if (rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)) { out = hexOf(rgb); break; }
        aa *= 0.95;
        bb *= 0.95;
        out = hexOf(rgb);
    }
    cache.set(key, out);
    return out;
}
