// Draw a bootstrap figure to SVG, so it can be looked at.
//
//     node tools/render.mjs St5 2 > /tmp/st5.svg
//     node tools/render.mjs Sun 2 | magick - /tmp/sun.png
//     node tools/render.mjs Pe5 3 14 '[[-1,-3],[3,-1],[2,3],[-2,3],[-3,-1]]'
//
// The fourth argument is five ordered points to use instead of the quadrille
// ones — the whole point of the module is that they need not be symmetric.
//
// `gen` is Jake's numbering: a single tile is generation 1, so `St5 2` is one
// substitution. Added because a figure can pass every numeric test and still be
// visibly wrong: the Sun's five diamonds and the Star patch's boats overlap
// their neighbors, and no test in this repo caught it until the picture did.
//
// penrose-mosaic's colors: blue Pe5 and the star family, yellow Pe3, orange Pe1.

import { PENTA_UP, ladderTo } from "../dist/bootstrap/wheel.js";
import { expand, outlineOf } from "../dist/bootstrap/patch.js";

const FILL = {
    Pe5: "#0000ff", Pe3: "#ffff00", Pe1: "#e46c0a",
    St5: "#0000ff", St3: "#0000ff", St1: "#0000ff",
};

const seed = process.argv[2] ?? "Pe5";
const gen = Number(process.argv[3] ?? 2);
const scale = Number(process.argv[4] ?? 14);
const points = process.argv[5] ? JSON.parse(process.argv[5]) : PENTA_UP;

// Jake's generation minus one is the recursion depth this module counts.
const depth = Math.max(0, gen - 1);
const ladder = ladderTo(points, depth + 2);
const tiles = expand(seed, 0, [0, 0], depth, ladder)
    .map((t) => ({ ...t, poly: outlineOf(t, ladder[1]) }));

if (!tiles.length) {
    console.error(`render: ${seed} generation ${gen} is empty`);
    process.exit(1);
}

let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const t of tiles)
    for (const [x, y] of t.poly) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
const pad = 2;
const w = (x1 - x0 + 2 * pad) * scale, h = (y1 - y0 + 2 * pad) * scale;
const px = (v) => ((v[0] - x0 + pad) * scale).toFixed(2);
const py = (v) => ((v[1] - y0 + pad) * scale).toFixed(2);

const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
];
for (const t of tiles)
    out.push(`<polygon points="${t.poly.map((v) => `${px(v)},${py(v)}`).join(" ")}"`
        + ` fill="${FILL[t.type] ?? "#999999"}" stroke="#333333" stroke-width="1"/>`);
out.push("</svg>");
console.log(out.join("\n"));
console.error(`render: ${seed} generation ${gen} — ${tiles.length} tiles`
    + (process.argv[5] ? `, on ${JSON.stringify(points)}` : ""));
