// The negative afterimage of a color, as a formula.
//
// Stare at a patch of color and look away: what you see is the complement,
// pale. That is opponent-process adaptation — the cone-difference channels the
// patch has been driving one way relax the other way — so the afterimage is a
// reflection through the NEUTRAL AXIS of an opponent space, together with the
// fading and the washing-out that a partly adapted channel gives.
//
// Three choices, and the first is the one that matters:
//
// 1. The space is **Oklab**, not CIELAB. Reflecting a and b IS the opponent
//    statement in either, but CIELAB's hue lines bend badly in the blues — its
//    sRGB blue sits at hue 306°, nearer purple than blue — so the reflection
//    lands at 126°, a yellow-green. Jake's own observation was pale yellow, and
//    Oklab, which was built to keep hue straight through exactly that region,
//    gives it: blue 264° -> yellow 84°. All three of his readings come out of
//    the same formula once the space is right.
// 2. The chroma FADES by `strength`: adaptation is partial, so the afterimage
//    is a tint rather than a saturated complement.
// 3. The lightness is FIXED, pale. An afterimage is seen against whatever you
//    look at next, and against a page they all read as pale tints whatever the
//    stimulus was — which is what Jake described, rather than the dark violet
//    a strict lightness inversion would give for yellow.
//
// Measured against his three: #0000ff -> #ffd98d pale yellow, #ffff00 ->
// #ddd9ff light purple, #e46c0a -> #b6e6ff light blue.

/** How much of the chroma survives the reflection: 1 would be fully adapted. */
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
    const [, a, b] = oklab(hex);
    let aa = -a * strength, bb = -b * strength;
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
