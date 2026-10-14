/**
 * π(C^k): the golden zonohedra, as one construction with k turned up.
 *
 * PLAN §8.2. Dietl and Eschenburg's Lemma 6 says the five golden isozonohedra
 * are projections of cubes from ℝ⁶ — K30 = π(C⁶), F20 = π(C⁵), B12 = π(C⁴),
 * and the two rhombohedra A6 = π(C₂³), O6 = π(C₁³) — and that every face of
 * all of them is π(C²), the golden rhomb. So it is not five solids and a face;
 * it is one operation at every rung of a ladder:
 *
 *     k  π(C^k)                      vertices  faces   in the tiling
 *     0  a point                        1        0
 *     1  an edge                        2        0     a generator
 *     2  the golden rhomb               4        2     the face of all of them
 *     3  two rhombohedra, A6 and O6     8        6     the TILES
 *     4  Bilinski's dodecahedron       14       12     the minilens
 *     5  Fedorov's rhombic icosahedron 22       20     the lens
 *     6  Kepler's triacontahedron      32       30     the window
 *
 * The plane has most of this already and we built it without seeing the
 * ladder: §5.0's singularity solids are π(C³), π(C⁴) and π(C⁵) — the hexagon,
 * the octagon and the decagon — and a Penrose tile is π(C²). What the
 * pentagrid cannot reach is k = 6, because that needs a sixth zone and a
 * family of lines with no direction. The icosahedral hexagrid has it.
 *
 * The face count is k(k−1), so the flat rung k = 2 has two: the rhomb from
 * each side. Euler holds all the way down — V − E + F = 2 at every k ≥ 2.
 *
 * Nothing here knows about a canvas, and nothing imports three.js.
 */

export type Vec3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;
/** The angle any two icosahedral axes make: |cos| = 1/√5 for all fifteen pairs. */
export const ICO_COS = 1 / Math.sqrt(5);

/**
 * The six five-fold axes of an icosahedron, as unit vectors.
 *
 * One up the pole and five in a ring at the icosahedral angle, which is the
 * arrangement §5.0 arrived at from the other end: the pentagrid's five lifted
 * generators vⱼ + ½ẑ ARE five of these, and the sixth is the vertical the
 * plane cannot supply. Every pair has |cos| = 1/√5 — fifteen pairs, one angle.
 */
export const ICO_AXES: readonly Vec3[] = (() => {
    const out: Vec3[] = [];
    const cz = ICO_COS, s = Math.sqrt(1 - cz * cz);
    for (let k = 0; k < 5; k++) {
        const a = (2 * Math.PI * k) / 5;
        out.push([s * Math.cos(a), s * Math.sin(a), cz]);
    }
    out.push([0, 0, 1]);
    return out;
})();

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, t: number): Vec3 => [a[0] * t, a[1] * t, a[2] * t];
const norm = (a: Vec3) => Math.sqrt(dot(a, a));

/** The sum of the generators a mask selects — a corner of the zonotope. */
export function maskPoint(gens: readonly Vec3[], mask: number): Vec3 {
    const p: Vec3 = [0, 0, 0];
    for (let j = 0; j < gens.length; j++) {
        if (mask >> j & 1) { p[0] += gens[j][0]; p[1] += gens[j][1]; p[2] += gens[j][2]; }
    }
    return p;
}

export interface Zonohedron {
    /** The generators it was built from. */
    gens: readonly Vec3[];
    /** Which subsets land on the hull, as bit masks. Centrally symmetric. */
    vertexMasks: number[];
    /** Those subsets as points. */
    vertices: Vec3[];
    /** Each face as four masks, in order round it. Two per pair of generators. */
    faces: { pair: [number, number]; masks: [number, number, number, number] }[];
    /** Every edge, as a pair of masks. */
    edges: [number, number][];
}

/**
 * π(C^k): the zonotope of k generators in 3-space.
 *
 * **The vertices** are the subsets that are extreme, and which those are is a
 * question about DIRECTIONS rather than about points: Σ_{j∈T} gⱼ is a vertex
 * exactly when some c has c·gⱼ > 0 on T and < 0 off it. The c that do this are
 * the open regions of the arrangement of the k great circles gⱼ·c = 0 on the
 * sphere, and a great-circle arrangement in general position has k² − k + 2
 * regions — which is 8, 14, 22, 32 for k = 3, 4, 5, 6, the vertex counts of the
 * rhombohedron, Bilinski, Fedorov and Kepler. So the count is not measured, it
 * is forced, and the enumeration walks the arrangement rather than testing a
 * hull: every region has a corner, so visiting the four quadrants around each
 * circle crossing visits every region.
 *
 * **The faces** need no perturbation at all. For each pair (i, j) the face
 * normal is gᵢ × gⱼ, and the other generators are off that plane, so the two
 * opposite faces are the rhomb {0, gᵢ, gᵢ+gⱼ, gⱼ} translated by whichever of
 * the rest point the right way. k(k−1) faces: 6, 12, 20, 30.
 */
export function zonohedron(gens: readonly Vec3[]): Zonohedron {
    const k = gens.length;
    const vertexMasks: number[] = [];
    if (k === 0) vertexMasks.push(0);
    else if (k === 1) vertexMasks.push(0, 1);
    else {
        const seen = new Set<number>();
        const EPS = 1e-6;
        for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
            const c = cross(gens[i], gens[j]);
            if (norm(c) < 1e-12) continue;                 // parallel: no crossing
            // Move off the crossing in the four ways that flip i and j alone:
            // u is perpendicular to gⱼ, v to gᵢ, so each nudges one sign.
            const u = cross(gens[j], c), v = cross(c, gens[i]);
            for (const sc of [1, -1]) for (const su of [1, -1]) for (const sv of [1, -1]) {
                const dir = add(mul(c, sc), add(mul(u, su * EPS), mul(v, sv * EPS)));
                let mask = 0, ok = true;
                for (let m = 0; m < k; m++) {
                    const d = dot(dir, gens[m]);
                    if (Math.abs(d) < 1e-12) { ok = false; break; }
                    if (d > 0) mask |= 1 << m;
                }
                if (ok) seen.add(mask);
            }
        }
        vertexMasks.push(...[...seen].sort((a, b) => a - b));
    }
    const faces: Zonohedron["faces"] = [];
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
        const nrm = cross(gens[i], gens[j]);
        if (norm(nrm) < 1e-12) continue;
        for (const side of [1, -1]) {
            let base = 0;
            for (let m = 0; m < k; m++) {
                if (m === i || m === j) continue;
                if (side * dot(nrm, gens[m]) > 0) base |= 1 << m;
            }
            faces.push({
                pair: [i, j],
                masks: [base, base | (1 << i), base | (1 << i) | (1 << j), base | (1 << j)],
            });
        }
    }
    const edgeSet = new Map<string, [number, number]>();
    for (const f of faces) {
        for (let e = 0; e < 4; e++) {
            const a = f.masks[e], b = f.masks[(e + 1) % 4];
            const key = a < b ? `${a},${b}` : `${b},${a}`;
            if (!edgeSet.has(key)) edgeSet.set(key, a < b ? [a, b] : [b, a]);
        }
    }
    return {
        gens,
        vertexMasks,
        vertices: vertexMasks.map((m) => maskPoint(gens, m)),
        faces,
        edges: [...edgeSet.values()],
    };
}

/** The volume of the rhombohedron on three generators: |det|. */
export function cellVolume(a: Vec3, b: Vec3, c: Vec3): number {
    return Math.abs(dot(a, cross(b, c)));
}

/**
 * Which of the two rhombohedra a triple of axes spans.
 *
 * There are exactly two, and the reason is a group action rather than a
 * measurement. The icosahedral group is transitive on the six axes and on
 * their pairs, but NOT on their triples: three axes either form a chain —
 * isosceles, not equilateral — or an equilateral triangle, and those are the
 * two orbits. Ten triples each, of the twenty.
 *
 * The volumes tell them apart and stand in the ratio φ, which §5.0 measured in
 * the plane before any of this was read: 0.657164 and 1.063314 there, the
 * oblate the smaller.
 */
export function cellKind(a: Vec3, b: Vec3, c: Vec3): "acute" | "oblate" {
    // The two volumes differ by φ, so the midpoint of the two separates them.
    const unit = cellVolume(ICO_AXES[0], ICO_AXES[1], ICO_AXES[2]);
    const other = cellVolume(ICO_AXES[0], ICO_AXES[1], ICO_AXES[3]);
    const lo = Math.min(unit, other), hi = Math.max(unit, other);
    return cellVolume(a, b, c) > (lo + hi) / 2 ? "acute" : "oblate";
}

/** Every three-subset of the six axes: twenty, ten of each kind. */
export function cellTriples(): { ijk: [number, number, number]; kind: "acute" | "oblate" }[] {
    const out: { ijk: [number, number, number]; kind: "acute" | "oblate" }[] = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let l = j + 1; l < 6; l++) {
        out.push({
            ijk: [i, j, l],
            kind: cellKind(ICO_AXES[i], ICO_AXES[j], ICO_AXES[l]),
        });
    }
    return out;
}

/**
 * A face's two diagonals, longer first — φ apart on a golden rhomb.
 *
 * The check that the whole ladder rests on: every face of every π(C^k) is the
 * same rhomb, so the solids are isozonohedra and the tiling has one edge
 * length and one face shape.
 */
export function faceDiagonals(
    gens: readonly Vec3[], face: Zonohedron["faces"][number],
): [number, number] {
    const p = face.masks.map((m) => maskPoint(gens, m));
    const d1 = norm([p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]]);
    const d2 = norm([p[3][0] - p[1][0], p[3][1] - p[1][1], p[3][2] - p[1][2]]);
    return d1 >= d2 ? [d1, d2] : [d2, d1];
}

/** The golden ratio, for callers checking a diagonal ratio. */
export { PHI };
