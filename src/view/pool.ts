/**
 * The index mark that both the pentagrid and the growth views draw: a number
 * in a white disc, or the same number on a pool ball whose color IS the index.
 *
 * It lives in its own module because the two views cannot import each other —
 * `createGrowthView` builds a pentagrid underneath itself — and because the
 * whole point of the mark is that roof, grow, method and split draw it
 * identically. One function, so it cannot drift.
 */

/**
 * The pool balls, by index. Jake: 1 yellow, 2 blue, 3 red, 4 purple, 0 white.
 *
 * Three stops each — a lit face, the body, a darkened rim — which is what
 * turns a flat disc into a sphere. 1 to 4 are the levels a Penrose patch
 * stands on; 0 is the cue ball and 5 the orange, and both appear only off
 * Penrose, where the index takes a fifth value.
 */
export const POOL: Record<number, { lit: string; body: string; rim: string }> = {
    0: { lit: "#ffffff", body: "#f2f0e8", rim: "#b9b6ab" },
    1: { lit: "#fff6c2", body: "#f2c230", rim: "#9c7a0d" },
    2: { lit: "#bcd8ff", body: "#2f6fd0", rim: "#163a76" },
    3: { lit: "#ffc4b4", body: "#d4342a", rim: "#7d1510" },
    4: { lit: "#e2c9f2", body: "#7a3fa8", rim: "#41215c" },
    5: { lit: "#ffd9b8", body: "#e07a28", rim: "#8a4310" },
};

/**
 * One index mark, centered at (x, y) with radius R.
 *
 * `pool` off: a white disc with the number in it. White throughout — the digit
 * says which level it is, so a second encoding in the fill only competed with
 * it. `pool` on: the ball, its color the index, the number riding a white disc
 * as it does on a real ball so it reads over any body color.
 *
 * The caller owns the font, alignment and line width; this owns the fills.
 */
export function drawIndexMark(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, R: number, m: number, pool: boolean,
    label = String(m), dy = 0.5,
) {
    const hue = pool ? (POOL[m] ?? POOL[0]) : null;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, 2 * Math.PI);
    if (hue) {
        // A sphere's outline is always a circle, so a ball is a radial
        // gradient in one: the highlight up and left of center, the body
        // falling to a dark rim.
        const g = ctx.createRadialGradient(
            x - R * 0.35, y - R * 0.4, R * 0.08, x, y, R * 1.05);
        g.addColorStop(0, hue.lit);
        g.addColorStop(0.55, hue.body);
        g.addColorStop(1, hue.rim);
        ctx.fillStyle = g;
    } else {
        ctx.fillStyle = "#fff";
    }
    ctx.fill();
    ctx.strokeStyle = hue ? "rgba(0,0,0,0.35)" : "#111";
    ctx.stroke();
    if (hue) {
        ctx.beginPath();
        ctx.arc(x, y, R * 0.56, 0, 2 * Math.PI);
        ctx.fillStyle = "#fbfbf7";
        ctx.fill();
    }
    ctx.fillStyle = "#111";
    ctx.fillText(label, x, y + dy);
}
