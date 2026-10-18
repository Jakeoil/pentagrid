#!/usr/bin/env node
/**
 * Are the readings legal where two 2k-gons meet?
 *
 * Jake, 2026-10-17: *"Every reading is wrong, not legal penrose — P(0). All
 * reading showing identically oriented tiles at border between big purple and
 * pink. The bands at the border should not fit on a line segment."*
 *
 * The invariant he is appealing to is Socolar's: in the dual of a pentagrid,
 * two ADJACENT cells can never have both the same shape and the same
 * orientation. A rhomb's (j, k) is exactly shape-and-orientation, so the test
 * is that no edge is shared by two rhombs of equal (j, k).
 *
 * Measured, at Γ = 0, reach 7 — and he is right:
 *
 *   - The UNRESOLVED patch is clean. 412 rhombs, 634 shared edges, zero
 *     same-(j,k) adjacencies. So the bug is not in the tiling.
 *   - Each reading on its own is clean too: inside one 2k-gon every face has
 *     its own generator pair, so a violation can only happen at a BORDER —
 *     which is what Jake saw, between the big purple decagon and a pink
 *     hexagon. The two are 2.5045 apart and their outlines touch.
 *   - At EVERY position of the reading slider there are exactly two
 *     same-orientation adjacencies at that border. Zero of ten are clean.
 *   - And it is not forced. For every one of the decagon's ten readings,
 *     every neighboring hexagon has a reading that avoids the clash — zero
 *     hexagons stuck, at all ten.
 *
 * So the readings are not wrong; the CHOICE is missing. One slider drives
 * every solid, wrapped against each one's own count — decagon N mod 10,
 * hexagon N mod 2 — and nothing couples them. The hexagons are never asked to
 * agree with the decagon, and at two places they do not. The fix is to choose
 * rather than to wrap, and since a clean choice always exists, choosing can
 * always succeed.
 *
 * Usage: node tools/border.mjs
 */
const P = "/Users/jakeoil/projects/claude-projects/math-legacy/pentagrid";
const Z = await import(P + "/dist/geometry/zonohedron.js");
const { createGammaSet } = await import(P + "/dist/geometry/gamma.js");
const { collectRhombs } = await import(P + "/dist/geometry/pentagrid.js");
const { findResolutions } = await import(P + "/dist/geometry/resolve.js").catch(()=>({}));
const set = createGammaSet({ guard: false });
set.setLocked(-1); set.setValues([0,0,0,0,0]);
const model = set.model, dirs = model.directions;
const R = collectRhombs(model, { xMin:-7, xMax:7, yMin:-7, yMax:7 }, { gain: 2.5 });
// group superposed rhombs: those sharing a crossing
const byX = new Map();
for (const r of R) {
  const k = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
  if (!byX.has(k)) byX.set(k, []);
  byX.get(k).push(r);
}
const stacks = [...byX.entries()].filter(([,v])=>v.length>1)
  .map(([k,v])=>({ k, rhombs:v, fams:[...new Set(v.flatMap(r=>[r.j,r.k]))].sort() }));
console.log(`stacks: ${stacks.length}`);
const byK = new Map();
for (const s of stacks) byK.set(s.fams.length, (byK.get(s.fams.length)??0)+1);
console.log("by order:", [...byK].sort().map(([k,c])=>`${k}: ${c}`).join("  "));

// place one reading's faces for a stack, in the plane
function placed(stack, reading) {
  const z = Z.zonohedronOf(dirs, stack.fams);
  const outline = stack.rhombs.flatMap(r=>r.vertices);
  const outlineK = stack.rhombs.flatMap(r=>r.kTuples);
  const anchor = Z.zonogonAnchor(z, outline, outlineK, dirs);
  const pool = z.penrose.length ? z.penrose : z.readings.map((_,i)=>i);
  const bases = z.readings.length
    ? z.readings[pool[((reading % pool.length)+pool.length)%pool.length]] : z.lower;
  const pt = (mask) => {
    let x = anchor.origin[0], y = anchor.origin[1];
    for (let l = 0; l < z.k; l++) if (mask>>l&1) { x += dirs[z.fams[l]][0]; y += dirs[z.fams[l]][1]; }
    return [x,y];
  };
  return z.pairs.map((pr,i) => ({
    j: z.fams[pr[0]], k: z.fams[pr[1]],
    pts: z.face(bases, i).map(pt),
  }));
}
const deca = stacks.find(s=>s.fams.length===5);
const hexes = stacks.filter(s=>s.fams.length===3);
console.log(`\ndecagon at ${deca.k}; ${hexes.length} hexagons`);
// nearest hexagons by the DRAWN distance between stack centers
const cen = (s) => {
  const all = s.rhombs.flatMap(r=>r.vertices);
  return [all.reduce((a,p)=>a+p[0],0)/all.length, all.reduce((a,p)=>a+p[1],0)/all.length];
};
const dc = cen(deca);
const near = hexes.map(h=>({h, d: Math.hypot(cen(h)[0]-dc[0], cen(h)[1]-dc[1])}))
  .sort((a,b)=>a.d-b.d).slice(0,5);
console.log("nearest hexagons, drawn distance:", near.map(n=>n.d.toFixed(4)).join("  "));

const key = (p) => `${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)}`;
const key2 = (p) => `${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)}`;
const clash = (A, B) => {
  let n = 0;
  for (const a of A) for (const b of B) {
    if (a.j !== b.j || a.k !== b.k) continue;
    for (let i=0;i<4;i++) for (let m=0;m<4;m++) {
      const e1=[key2(a.pts[i]),key2(a.pts[(i+1)%4])].sort().join("|");
      const e2=[key2(b.pts[m]),key2(b.pts[(m+1)%4])].sort().join("|");
      if (e1===e2) n++;
    }
  }
  return n;
};
// EVERY hexagon that shares an edge with the decagon, and every hexagon pair
// too — the border is wherever two 2k-gons touch, not only at the decagon.
console.log("\nWhat the app actually does: ONE slider, wrapped per solid.");
console.log("slider N -> decagon uses N mod 10, every hexagon uses N mod 2.\n");
let cleanPositions = 0;
for (let N = 0; N < 10; N++) {
  const D = placed(deca, N);
  let v = 0;
  for (const h of hexes) v += clash(D, placed(h, N));
  // and hexagon against hexagon
  let hv = 0;
  for (let i = 0; i < hexes.length; i++) for (let j = i+1; j < hexes.length; j++) {
    hv += clash(placed(hexes[i], N), placed(hexes[j], N));
  }
  if (v + hv === 0) cleanPositions++;
  console.log(` N=${N}: decagon|hexagon ${v}   hexagon|hexagon ${hv}`
    + `   ${v+hv === 0 ? "clean" : "ILLEGAL"}`);
}
console.log(`\nclean slider positions: ${cleanPositions} of 10`);

// Could the hexagons be CHOSEN instead of wrapped?
console.log("\nIf each hexagon picked its own reading to suit the decagon:");
for (let N = 0; N < 10; N++) {
  const D = placed(deca, N);
  let stuck = 0;
  for (const h of hexes) {
    if (clash(D, placed(h,0)) > 0 && clash(D, placed(h,1)) > 0) stuck++;
  }
  console.log(` N=${N}: ${stuck} hexagon(s) with no good reading`);
}
