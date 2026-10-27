/**
 * Putting two pentagrids in register when their tiling units differ.
 *
 * A `View` is in TILING units, and a tiling unit is λ world units. Two sides
 * at the same generation share λ and can hand views straight to each other —
 * which is what `pair.ts` does. Two sides at different generations cannot: a
 * deflation divides λ by φ, so the same numbers mean a region φ times smaller.
 *
 * The invariants are `scale / λ` and `λ · view`, which is the same pair the
 * view code uses when λ changes under it ("a change of λ is a zoom about the
 * origin that keeps every WORLD point where it was on screen"). Preserving
 * them is all this does.
 */

import type { View } from "./pentagrid.js";

/**
 * `v`, read on a canvas whose tiling unit is `lamFrom`, expressed for one
 * whose tiling unit is `lamTo`. Both show the same rectangle of the plane at
 * the same size on screen.
 */
export function convertView(v: View, lamFrom: number, lamTo: number): View {
    const k = lamTo / lamFrom;
    return { scale: v.scale * k, x: v.x / k, y: v.y / k };
}
