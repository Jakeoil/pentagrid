/**
 * The growth law: where the tiling's points are at a partial grow and fold.
 *
 * Two parameters, both 0..1, and between them they carry every frame of
 * `grow.html` and `roof.html`:
 *
 * - **grow** — 0 puts every point on the crossing that made it, 1 on the
 *   finished tiling. A tile at grow = 0 is a dot; at grow = 1 it is a rhomb in
 *   its place; between, it is opening out of its own crossing.
 * - **fold** — 0 is flat, 1 is the full Wieringa roof. It scales the height
 *   and nothing else, because the lift gives every vertex a height that is
 *   just its de Bruijn index (see `roof.ts`): there is no hinge to compute.
 *
 * Both multiply the height, which is the one thing that is not obvious:
 * `fold · grow · RISE · level`. A tiling that has not grown has nowhere to
 * stand, so a point still on its crossing stays on the plane however far the
 * fold has gone — otherwise the roof would rise out of a field of dots.
 *
 * **THE REGISTRATION GAIN.** At grow = 0 the target is the crossing scaled by
 * n/2, not the crossing itself, and that factor is forced rather than chosen:
 * Σⱼ vⱼvⱼᵀ = (n/2)·I for n unit directions at equal angles, so n/2 is the
 * scale at which the grid and its dual register. 5/2 for the pentagrid, 7/2
 * for a heptagrid, and `dirs.length` already knows which.
 *
 * Lifted out of `view/growth.ts`'s closure, 2026-11-04, so that the mathematics
 * can be used without a canvas — PLAN §16 / `LIBRARY.md` §1a.4, Jake: *"the
 * grow logic will be very important for wieringa too."* It was already half
 * out: `projectToScreen` was a top-level export in that file, with a comment
 * saying it was exposed so it could be checked without a canvas. This is the
 * other half, and it is why both pieces are here rather than there.
 *
 * `crossingLerp` and `standHeight` exist so the two corner functions share one
 * law rather than two copies of it, and they are written as the call sites
 * wrote them — same operations, same order — because a refactor of a formula
 * that changes a last bit is not a refactor. `tools/growcore.test.mjs` pins the
 * drawn output against values captured before the move.
 */

import type { Rhomb, Vec2 } from "./types.js";
import { RISE, vertexIndex } from "./roof.js";
import type { Vec3 } from "./roof.js";

/** How far along the two parameters are. `GrowthState` satisfies this. */
export interface GrowFold {
    /** 0 = points on their crossings, 1 = the finished tiling. */
    grow: number;
    /** 0 = flat, 1 = the full Wieringa roof. */
    fold: number;
}

/** Where the camera is. `GrowthState` satisfies this too. */
export interface Camera {
    /** Spin about the vertical, radians. */
    azimuth: number;
    /** Tilt from the horizon, radians. π/2 looks straight down. */
    elevation: number;
}

/**
 * Where a reading has seated a rhomb, if one has.
 *
 * Structural on purpose, so `cascade.ts`'s `Seat` satisfies it without this
 * module importing the cascade — which would triple its dependencies to carry
 * a two-field record.
 */
export interface SeatLike {
    /** The base corner, in tiling coordinates. */
    at: Vec2;
    /** Its de Bruijn index, which the height is driven by. */
    index: number;
}

/**
 * The scale at which the grid and its dual register: Σⱼ vⱼvⱼᵀ = (n/2)I.
 *
 * Takes the direction count rather than the directions, since that is all it
 * depends on.
 */
export const registrationGain = (n: number): number => n / 2;

/** One coordinate, lerped from its crossing to where it belongs. */
export const crossingLerp = (
    grow: number, gain: number, from: number, to: number,
): number => (1 - grow) * gain * from + grow * to;

/** How high a point at this level stands, at this grow and fold. */
export const standHeight = (gf: GrowFold, level: number): number =>
    gf.fold * gf.grow * RISE * level;

/**
 * A tile's local (a, b) in world space, at the current grow and fold.
 *
 * (a, b) are the rhomb's own coordinates: (0,0) and (1,1) are opposite
 * corners, (0.5, 0.5) the center, and anything between is a point of a
 * dressing carried in the tile's frame — which is why a pentagon spanning
 * three tiles creases along their edges when the roof rises.
 *
 * A seat moves the base corner and nothing else: the rhomb keeps its shape,
 * its families and its K-tuples, so every dressing computed in the old place
 * maps to the right (a, b) and lands in the new one. The height follows the
 * seat's index rather than the rhomb's own, because a rhomb seated at a mask
 * its K-tuple did not predict is otherwise in the right place in the plane and
 * the wrong one in z — invisible from straight down and wrong from any angle.
 */
export function tileCorner(
    r: Rhomb, dirs: readonly Vec2[], a: number, b: number,
    gf: GrowFold, seat?: SeatLike | null,
): Vec3 {
    const gain = registrationGain(dirs.length);
    const vj = dirs[r.j], vk = dirs[r.k];
    const v0 = seat ? seat.at : r.vertices[0];
    const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
    const m = seat ? seat.index : vertexIndex(r.kTuples[0]);
    return [
        crossingLerp(gf.grow, gain, r.x0, cx)
            + gf.grow * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]),
        crossingLerp(gf.grow, gain, r.y0, cy)
            + gf.grow * ((a - 0.5) * vj[1] + (b - 0.5) * vk[1]),
        standHeight(gf, m + a + b),
    ];
}

/**
 * A 2k-gon corner, growing by the same law its tiles do.
 *
 * At grow = 0 every corner sits on the crossing, scaled by the gain — the same
 * point the stack's tiles start from — so the polygon opens out of the dot
 * rather than appearing around it.
 */
export function outlineCorner(
    from: Vec2, to: Vec2, K: readonly number[],
    dirs: readonly Vec2[], gf: GrowFold,
): Vec3 {
    const gain = registrationGain(dirs.length);
    return [
        crossingLerp(gf.grow, gain, from[0], to[0]),
        crossingLerp(gf.grow, gain, from[1], to[1]),
        standHeight(gf, vertexIndex(K)),
    ];
}

/**
 * World point to screen — the mapping the renderer uses, with no canvas in it.
 *
 * The pan is applied AFTER projection, in screen space, so a drag moves the
 * picture 1:1 whatever the camera is doing. Applying it in world space would
 * foreshorten a vertical drag under tilt and send it off at an angle under
 * spin. With the camera looking straight down and unspun this reduces exactly
 * to the pentagrid's own `mathToScreen`.
 *
 * `depth` is for sorting, not for drawing: larger is nearer.
 */
export function projectToScreen(
    cam: Camera,
    p: Vec3,
    view: { scale: number; x: number; y: number },
    cx: number,
    cy: number,
): { x: number; y: number; depth: number } {
    const ca = Math.cos(cam.azimuth), sa = Math.sin(cam.azimuth);
    const xr = p[0] * ca - p[1] * sa;
    const yr = p[0] * sa + p[1] * ca;
    const ce = Math.cos(cam.elevation), se = Math.sin(cam.elevation);
    const sx = xr, sy = -(yr * se + p[2] * ce);
    return {
        x: cx + (sx - view.x) * view.scale,
        y: cy + (sy + view.y) * view.scale,
        depth: yr * ce - p[2] * se,
    };
}
