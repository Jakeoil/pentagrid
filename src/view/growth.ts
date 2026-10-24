// A pentagrid assembling itself into its tiling, flat or folded.
//
// Both grow.html and roof.html are this one container: the same tiles growing
// out of the same crossings, with the grid lines still fastened to the edge
// midpoints they pass between. `lift` stands the surface up into golden rhombi,
// `camera` turns on the 3D projection and the depth sort. A flat top-down view
// is just lift = 0 with the camera looking straight down.
//
// It owns its canvases the way createPentagrid does — you hand it a container
// and get back a handle — because a renderer this involved should not be page
// code. See README, "Canvas containers".

import { createPentagrid } from "./pentagrid.js";
import type { PentagridHandle } from "./pentagrid.js";
import { RISE, vertexIndex } from "../geometry/roof.js";
import { resolveConcurrency, angleCode } from "../geometry/resolve.js";
import type { Resolution } from "../geometry/resolve.js";
import { zonohedronOf, zonogonAnchor, popcount } from "../geometry/zonohedron.js";
import { cascade, faceSeats } from "../geometry/cascade.js";
import type { Seat } from "../geometry/cascade.js";
import type { CascadeSite } from "../geometry/cascade.js";
import { penroseCondition } from "../geometry/gamma.js";
import { wallView, skewbCode } from "../geometry/walls.js";
import { readAttributes, watchAttributes } from "../state/attributes.js";
import { DEFAULTS } from "../state/defaults.js";
import { FIELDS, format } from "../state/inventory.js";
// Re-exported from where it has always been imported.
export { DEFAULTS } from "../state/defaults.js";
import type { Paths } from "../geometry/walls.js";
import { p1Pentagons, P1_FILL, P1_STAR } from "../geometry/clusters.js";
import { rhombPentagons, rhombDeflation, rhombKitesDarts, dressingReadings, rhombArcs } from "../geometry/decor.js";
import { clipToConvex } from "../geometry/region.js";
import type { Concurrency, Pentagrid, Rhomb, Vec2 } from "../geometry/types.js";

// Five for the pentagrid, then two more for a heptagrid; the first five are
// unchanged so every existing page keeps its exact palette.
export const FAMILY_COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5",
                              "#e07a5f", "#3d5a80"];

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};
const MIX: RGB[][] = FAMILY_COLORS.map((a) => FAMILY_COLORS.map((b) => {
    const [r1, g1, b1] = rgbOf(a), [r2, g2, b2] = rgbOf(b);
    return [(r1 + r2) >> 1, (g1 + g2) >> 1, (b1 + b2) >> 1] as RGB;
}));
const tint = (c: RGB, k: number) =>
    `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

/**
 * The Kowalewski five. Arbitrary colors; the partition is the content.
 *
 * A rhomb spanned by families j and k takes c = 3(j + k) mod 5, and what that
 * buys is an AXIS: the thin pair {c−1, c+1} and the thick pair {c−2, c+2} both
 * sum to 2c, so the two rhombs that meet along vc share a color. Where bands
 * gives ten composites naming a PAIR of directions, this gives five naming
 * one — which is why the two are alternatives and not a brightness setting.
 */
const KOWALEWSKI: RGB[] = ["#e4a05c", "#7fbf9b", "#8e9bd4", "#d98ba8", "#b5b35c"]
    .map(rgbOf);
const kowalewskiOf = (j: number, k: number, n: number): RGB =>
    KOWALEWSKI[(((3 * (j + k)) % n) + n) % n % KOWALEWSKI.length];


export type Vec3 = [number, number, number];

export interface GrowthConfig {
    container: HTMLElement;
    gamma?: readonly number[];
    /** How many line families. Five is the pentagrid, seven a heptagrid. */
    n?: number;
    /** Stand the surface up into golden rhombi. Needs the camera to be visible. */
    lift?: boolean;
    /**
     * Remember this page across visits — PLAN §9.4, want #4. Passed straight
     * to the pentagrid underneath, which owns the saving; the growth slice
     * rides along in the same record.
     */
    session?: boolean | string;
    /**
     * Kept for callers that named it; there is only one mode now. The bands are
     * quads inside each tile and quads across the gaps, which is exact flat and
     * folded alike and sorts correctly in 3D.
     * @deprecated has no effect
     */
    ribbons?: "stroke" | "quads";
    /** Lambert shading off the true face normal, so creases read. */
    shaded?: boolean;
    /** Right-drag to spin and tilt. Defaults on wherever there is a lift to see. */
    orbit?: boolean;
    /**
     * A line of text about the solid under the reading controls, pushed on each
     * draw — the biggest singularity in view, its reading and the cell the pair
     * control is turning. Empty when there is nothing to say.
     */
    onReadout?: (text: string) => void;
}

export interface GrowthState {
    /** 0 = points on their crossings, 1 = the finished tiling. */
    grow: number;
    /** 0 = flat, 1 = the full Wieringa roof. */
    fold: number;
    /** Band width as a fraction of the tile, 0..1. The sliders stop at 1: past
     *  it the ribbons overlap, which looks wrong rather than interesting. */
    band: number;
    /** Camera spin about the vertical, radians. */
    azimuth: number;
    /** Camera tilt from the horizon, radians. π/2 looks straight down. */
    elevation: number;
    /** Draw tile edges as real lines rather than the default hairline ghost. */
    /**
     * The tile outlines: none at all, a hairline, or bold.
     *
     * Three states rather than two because `none` is a real answer here — with
     * the bands or the Kowalewski five carrying the color, an outline on every
     * tile is noise, and the roof's creases read from the shading alone.
     */
    edgeStyle: "none" | "normal" | "bold";
    /**
     * The HEIGHT ramp — method's "height", here at a full ramp.
     *
     * Shades a tile by its de Bruijn index, pale high and dark low, which is a
     * post-tile treatment over whatever color the tile already has. On the
     * roof it says the same thing the relief does and says it flat, so the two
     * can be checked against each other; laid flat it is the only way to see
     * the index at all.
     */
    height: boolean;
    /** method's isoglosses: chords across each tile, parallel to its short way. */
    isogloss: boolean;
    /**
     * Paint the P1 tiling on the tiles: blue, with each pentagon clipped to the
     * tiles it reaches. The pieces are carried in the tile's own (a, b)
     * coordinates, so they fold with it on the roof and grow with it on the
     * flat — a pentagon that spans three tiles creases along their edges.
     */
    p1: boolean;
    /**
     * Paint the P1 tiling at the big-rhomb scale instead — the `pentagons` tile
     * style: a whole Pe3 in every thick, the Pe1 straddling edges, blue
     * elsewhere. Per tile by construction (rhombPentagons), so the pieces are
     * clipped to the tile and carried in its (a, b) frame like P1's.
     */
    penta: boolean;
    /**
     * Paint the next generation — the `nextgen` tile style: each tile cut into
     * the deflated tiling's pieces at 1/φ, thick gold and thin gray, with the
     * next generation's edges as hairlines. Per tile by construction, so the
     * pieces ride the tile's (a, b) frame and fold with it on the roof.
     */
    nextgen: boolean;
    /** Paint P2 — the `kites` tile style: kites light, a dart in every thick,
     *  P2's edges as hairlines — per tile, in the tile's (a, b) frame. */
    kites: boolean;
    /** Draw penta, next-gen and kites off a Penrose patch too — the tiles at the
     *  top or bottom index level; the middle ones stay bare. */
    offPenrose: boolean;
    /**
     * Outline the 2k-gon each stack of tiles is growing into.
     *
     * A concurrency's C(k,2) rhombs all start on the same crossing, so at grow = 0
     * they are superposed and a stack is indistinguishable from a single tile.
     * The outline is the space they are heading for, and it grows by the same law
     * they do — so you can watch them separate and fill it.
     */
    showResolutions: boolean;
    /**
     * Draw the solid each singularity stands up into: the zonohedron of its k
     * generators, one golden rhombic face per pair of lines. §5.0.
     */
    solids: boolean;
    /**
     * The singularity's state, in the three coordinates Jake reads it in.
     *
     * 2026-10-22: *"The exceptional singularity has 5 modes/directions...
     * 5 anti gridlines. two configs (call it direction) on each and
     * high/low/both for paths."* And on the old control: *"You still count 62
     * permutation. We know there are only 10 which express penrose tiles."*
     *
     * He was right twice over. 62 is the decagon zonogon's combinatorics, and
     * `n/62` was an index into it rather than a position in a state space. A
     * resolution is ONE perturbation of the five families (§5.-1), and those
     * factor (§5.-1b, `geometry/walls.ts`):
     *
     *   `axis`      the anti-gridline, 0 to 4: the family whose line is left
     *               standing, which is the wall through the decagon
     *   `direction` the ±ε involution: thin-then-thick or thick-then-thin
     *               along the spoke
     *   `paths`     the wall's two completions, or the wall itself
     *
     * `high` and `low` are the two readings the wall completes to — measured,
     * exactly two per cell and both Penrose, ordered by their own surface
     * height. `both` leaves the wall standing, which is a line of
     * singularities across the whole patch and not just the pair at the
     * center. 5 × 2 × 2 reaches all ten Penrose readings, each from the two
     * walls it sits between.
     */
    axis: number;
    direction: number;
    paths: Paths;
    /**
     * Which of the current reading's flips the pair control is showing. Wrapped
     * the same way: 3, 4 or 5 are available, and exactly 5 at the extremes.
     */
    pick: number;
    /**
     * Draw that flip's partner too — the same solid read the other way round.
     * Only one cell's cap differs, so what appears is three rhombs against
     * three, and the depth sort puts the raised cap in front.
     */
    pairGhost: boolean;
    /**
     * The Kowalewski five, as a DECORATION — a tile style like kites or penta,
     * not a second band palette. Jake, 2026-10-17: "I meant a checkbox... it
     * would be a decoration like kites, etc."
     *
     * c = 3(j + k) mod 5, and what it buys is an AXIS: the thin pair
     * {c−1, c+1} and the thick pair {c−2, c+2} both sum to 2c, so the two
     * rhombs meeting along vc share a color. Where the bands name a PAIR of
     * directions in ten composites, this names ONE in five. It paints the
     * tile's body, so the bands can run over it and say the other thing at
     * the same time.
     */
    kowalewski: boolean;
    // GONE, 2026-10-17: the legacy drawing of a 2k-gon — bands running
    // straight across it, from before the solids knew what was inside one.
    // Jake: "I told you to get rid of 2k-legacy. It should have been turned
    // off. I see the legacy ghost lines in the decagon." First I made it
    // derive from `solids`, which left exactly those ghosts whenever the
    // solids were down. A superposed tile is now never drawn: no fill, no
    // edge, no band. What is there is the 2k-gon in its own color, the solid
    // if it is up, and the band arriving at the polygon and leaving it on the
    // far side — which the gap quads carry, and which owes nothing to the
    // tiling inside.
    /**
     * The matching arcs on the tiles. Unlike the dressings these need no index
     * at all — every edge is +vⱼ from one of its ends and that orientation is
     * global — so they are drawn off a Penrose patch as readily as on one.
     */
    arcs: boolean;
    /**
     * Resolve the 2k-gons: seat each one's tiles where its reading puts them.
     *
     * Off, a stack is drawn as nothing and the polygon is empty, which is the
     * honest picture of an unresolved singularity. Jake: "There is no good way
     * to turn off reading." Now there is, and the reading slider is inert
     * while it is off.
     */
    resolve: boolean;
    /**
     * The de Bruijn index at every dual vertex: nothing, a number in a white
     * circle, or a pool ball.
     *
     * The balls are Jake's, 2026-10-17 — 1 yellow, 2 blue, 3 red, 4 purple,
     * 0 white — and they are the solid-color set, 1 to 4 being exactly the
     * levels a Penrose patch stands on. A ball is a radial gradient in a
     * circle, which is all a sphere's silhouette ever is, so it costs one
     * `arc` and stays crisp at any zoom. The white 0 is the cue ball and
     * turns up only off Penrose, where the index takes a fifth value.
     */
    indexStyle: "none" | "numbers" | "pool";
}

export interface GrowthHandle {
    set: (patch: Partial<GrowthState>) => void;
    get: () => GrowthState;
    redraw: () => void;
    /**
     * This page's home — PLAN §9.6. Marks the growth state AND the pentagrid's
     * underneath, since a roof page is both and resetting half of it would
     * leave the two disagreeing.
     */
    markBaseline: () => void;
    /** Back to the baseline, growth state and pentagrid together. */
    reset: () => void;
    /** This page as markup — §9.8. The pentagrid's share plus the growth slice. */
    embed: (opts?: { tag?: string; id?: string }) => string;
    /** The pentagrid underneath, for pan/zoom, γ and the layer stack. */
    pentagrid: PentagridHandle;
}

/**
 * What the plan says about one singularity.
 *
 * `partial` is set where the nudge left the site standing but still settled
 * some of its cells — a wall through the decagon settles four of ten, and
 * those four are ordinary Penrose tiles. Jake: *"four penrose tiles and two
 * skewbs."*
 */
interface PlanEntry {
    pool: number[];
    slot: number;
    partial: (number | null)[] | null;
}

/** The two loop families of the arc decoration, as on the flat page. */
const ARC_COLORS = ["#c1440e", "#1b6ca8"];

/** The next-gen palette, shared with the tile style. */
const NEXTGEN_THICK: [number, number, number] = [247, 208, 88];
const NEXTGEN_THIN: [number, number, number] = [182, 182, 182];
const KITE: [number, number, number] = [223, 233, 243];
const DART: [number, number, number] = [143, 168, 194];
/**
 * How solid a tile seated by a reading is drawn.
 *
 * Jake: "color the penrose legal tiles, but dress them transparently." They
 * ARE legal tiles — the reading places them and the cascade makes the borders
 * legal — so they belong in the picture; but the solid standing over them is
 * the thing being read, and a full-strength tiling underneath competes with
 * it. Faint, and every dressing comes through at the same strength.
 */
const SEATED_ALPHA = 0.22;
/** The pentaplex outline, as method draws it. */
const PENTA_EDGE = "rgba(38, 28, 18, 0.85)";
/** How far the height ramp moves a color, at a full ramp. pentagrid's RAMP. */
const RAMP = 0.55;
/** Mix an RGB towards white (t > 0) or black (t < 0). */
const ramped = (c: RGB, t: number): RGB => {
    const to = t >= 0 ? 255 : 0, a = Math.abs(t);
    return [Math.round(c[0] + (to - c[0]) * a),
            Math.round(c[1] + (to - c[1]) * a),
            Math.round(c[2] + (to - c[2]) * a)];
};

/**
 * The pool balls, by index. Jake: 1 yellow, 2 blue, 3 red, 4 purple, 0 white.
 *
 * Three stops each — a lit face, the body, a darkened rim — which is what
 * turns a flat disc into a sphere. 1 to 4 are the levels a Penrose patch
 * stands on; 0 is the cue ball and appears only off Penrose, where the index
 * takes a fifth value.
 */
const POOL: Record<number, { lit: string; body: string; rim: string }> = {
    0: { lit: "#ffffff", body: "#f2f0e8", rim: "#b9b6ab" },
    1: { lit: "#fff6c2", body: "#f2c230", rim: "#9c7a0d" },
    2: { lit: "#bcd8ff", body: "#2f6fd0", rim: "#163a76" },
    3: { lit: "#ffc4b4", body: "#d4342a", rim: "#7d1510" },
    4: { lit: "#e2c9f2", body: "#7a3fa8", rim: "#41215c" },
    5: { lit: "#ffd9b8", body: "#e07a28", rim: "#8a4310" },
};


/** What a rhombohedron's angle code means, at n = 5. PLAN §5.0. */
const CELL_SHAPE: Record<string, string> = { "122": "oblate", "113": "acute" };

/**
 * The same world-to-screen mapping the renderer uses, exposed so it can be
 * checked without a canvas. Pan is applied in screen space; with elevation π/2
 * and azimuth 0 this is exactly the pentagrid's mathToScreen.
 */
export function projectToScreen(
    state: Pick<GrowthState, "azimuth" | "elevation">,
    p: Vec3,
    view: { scale: number; x: number; y: number },
    cx: number,
    cy: number,
) {
    const ca = Math.cos(state.azimuth), sa = Math.sin(state.azimuth);
    const xr = p[0] * ca - p[1] * sa;
    const yr = p[0] * sa + p[1] * ca;
    const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
    const sx = xr, sy = -(yr * se + p[2] * ce);
    return {
        x: cx + (sx - view.x) * view.scale,
        y: cy + (sy + view.y) * view.scale,
        depth: yr * ce - p[2] * se,
    };
}

export function createGrowthView(config: GrowthConfig): GrowthHandle {
    const state: GrowthState = { ...DEFAULTS };
    if (config.lift) { state.fold = 1; state.grow = 1; state.elevation = 0.95; state.azimuth = 0.35; }
    /**
     * And then the container's attributes, which are the last word — PLAN §9.8.
     *
     * After `lift`, because `lift` is what the page asked for in code and the
     * markup outranks it; before the baseline, because for a widget the markup
     * IS the page's setup and `reset()` should return to it.
     *
     * `growth` is its own slice in the inventory, and three of its fields —
     * `isogloss`, `band`, `offPenrose` — carry a `growth-` prefix because a
     * roof page has a `TileStyle` as well and `data-band` would otherwise be
     * ambiguous.
     */
    Object.assign(state, readAttributes(config.container).growth);
    const shaded = config.shaded ?? !!config.lift;

    let handle: PentagridHandle | null = null;

    /** A tile's local (a,b), at the current grow and fold, in world space. */
    /**
     * Where a rhomb inside a 2k-gon has been SEATED by the current reading.
     *
     * The C(k,2) rhombs superposed on a concurrency are the faces of its
     * zonogon, one per pair, so a reading does not invent tiles — it says
     * where the ones already there go. Seating moves a rhomb's base corner
     * and nothing else: it keeps its own shape, its own families and its own
     * K-tuples, so every dressing works on it unchanged and the index it is
     * placed by is still its own. Jake: "color the penrose legal tiles."
     */
    let seats: Map<string, Seat> | null = null;
    /**
     * A rhomb's name, stable across recollection.
     *
     * The seat map used to be keyed by the Rhomb OBJECT, and `currentRhombs`
     * builds new objects whenever it recollects — so a cached map silently
     * matched nothing and every tile inside a 2k-gon vanished until something
     * invalidated the cache. Jake: "reading tiles still do disappear,
     * difficult to get back without scrolling to the next reading." Its
     * crossing and its two families name it, and both survive a rebuild.
     */
    const seatKeyOf = (r: Rhomb) =>
        `${r.x0.toFixed(6)},${r.y0.toFixed(6)}|${r.j},${r.k}`;

    function world(r: Rhomb, dirs: readonly Vec2[], a: number, b: number): Vec3 {
        const { grow, fold } = state;
        // The registration gain, so a tile at grow = 0 sits on the crossing that
        // made it. It is n/2 because Sum_j v_j v_j^T = (n/2)I — 5/2 here for the
        // pentagrid, 7/2 for a heptagrid — and dirs already knows n.
        const gain = dirs.length / 2;
        const vj = dirs[r.j], vk = dirs[r.k];
        // A seat moves the base corner and nothing else. tileLocal keeps
        // using the rhomb's own vertices, so a dressing computed in the
        // old place maps to the right (a, b) and lands in the new one.
        const seat = seats?.get(seatKeyOf(r));
        const v0 = seat ? seat.at : r.vertices[0];
        const cx = v0[0] + (vj[0] + vk[0]) / 2, cy = v0[1] + (vj[1] + vk[1]) / 2;
        const x = (1 - grow) * gain * r.x0 + grow * cx
            + grow * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]);
        const y = (1 - grow) * gain * r.y0 + grow * cy
            + grow * ((a - 0.5) * vj[1] + (b - 0.5) * vk[1]);
        // The height is the INDEX, not the position: a corner stands at
        // RISE*(index + popcount). A seated rhomb carries the index of the
        // mask it was seated at, which its own K-tuple need not predict.
        const m = seat ? seat.index : vertexIndex(r.kTuples[0]);
        return [x, y, fold * grow * RISE * (m + a + b)];
    }

    /**
     * The concurrencies, read off the tiles themselves.
     *
     * Not scanned for: a stack IS a set of rhombs sharing a crossing, so grouping
     * what is being drawn cannot disagree with what is being drawn. Two rhombs on
     * a point is a pair of lines crossing twice over, which is nothing; three is
     * the first real concurrency.
     */
    /**
     * Which reading every singularity takes, for the patch as a whole.
     *
     * The control picks the biggest one's — the decagon drives — and the rest
     * are chosen to agree with it across their shared borders, outward from
     * it. See geometry/cascade.ts for the rule and PLAN §5.-1a for the bug it
     * fixes. Cached on γ and the control's value, since a draw asks for it
     * once per solid and the answer is the same every time.
     */
    let planCache: Map<string, PlanEntry> | null = null;
    /**
     * The perturbation the controls currently name, and what it leaves standing.
     *
     * One lookup per draw, since `wallView` enumerates. Null off the pentagrid's
     * five families, where the factorization has nothing to say.
     */
    const viewNudge = (pg: Pentagrid) =>
        wallView(pg.directions, state.axis, state.direction, state.paths);
    let planKey = "";
    /**
     * Where the current reading seats each tile that lives inside a 2k-gon.
     *
     * One entry per superposed rhomb, matched to its zonogon face by its own
     * family pair — so a rhomb keeps everything that makes it what it is and
     * only moves. Cached with the plan, on γ and the control's value.
     */
    let seatCache: Map<string, Seat> | null = null;
    let seatKey = "";
    function seatsFor(
        pg: Pentagrid, rhombs: readonly Rhomb[],
    ): Map<string, Seat> {
        // Keyed on the STACKS, not the rhomb count: panning changes which
        // tiles are collected without necessarily changing how many, and a
        // stale seat map is a tiling drawn in the wrong place. Jake:
        // "refreshing is iffy when I move through viewport."
        const stackKeys = stacksOf(rhombs)
            .map((c) => `${c.x.toFixed(6)},${c.y.toFixed(6)}`).sort().join(";");
        const key = `${pg.gamma.map((g) => g.toFixed(9)).join(",")}`
            + `|${state.axis},${state.direction},${state.paths}|${stackKeys}`;
        if (seatCache && key === seatKey) return seatCache;
        const plan = readingPlan(pg, rhombs);
        const out = new Map<string, Seat>();
        const byPoint = new Map<string, Rhomb[]>();
        for (const r of rhombs) {
            const k = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
            const at = byPoint.get(k);
            if (at) at.push(r); else byPoint.set(k, [r]);
        }
        for (const c of stacksOf(rhombs)) {
            const at = `${c.x.toFixed(6)},${c.y.toFixed(6)}`;
            const seat = plan.get(at);
            const group = byPoint.get(at);
            if (!seat || !group) continue;
            const res = resolveConcurrency(pg, c);
            if (!res) continue;
            const where = faceSeats(pg, {
                families: res.families, outline: res.outline, outlineK: res.outlineK,
            }, seat.pool[seat.slot], seat.partial);
            for (const r of group) {
                const p = where.get(r.j < r.k ? `${r.j},${r.k}` : `${r.k},${r.j}`);
                if (p) out.set(seatKeyOf(r), p);
            }
        }
        seatCache = out;
        seatKey = key;
        return out;
    }

    function readingPlan(
        pg: Pentagrid, rhombs: readonly Rhomb[],
    ): Map<string, PlanEntry> {
        const held = penroseCondition(
            pg.gamma.reduce((t, g) => t + g, 0), pg.directions.length) === true;
        const stackKeys = stacksOf(rhombs)
            .map((c) => `${c.x.toFixed(6)},${c.y.toFixed(6)}`).sort().join(";");
        const key = `${pg.gamma.map((g) => g.toFixed(9)).join(",")}`
            + `|${state.axis},${state.direction},${state.paths}|${held}|${stackKeys}`;
        if (planCache && key === planKey) return planCache;
        const sites: CascadeSite[] = [];
        const at: string[] = [];
        for (const c of stacksOf(rhombs)) {
            const res = resolveConcurrency(pg, c);
            if (!res) continue;
            sites.push({ families: res.families, outline: res.outline, outlineK: res.outlineK });
            at.push(`${c.x.toFixed(6)},${c.y.toFixed(6)}`);
        }
        // The ordinary tiles, as the boundary condition every reading has to
        // meet. A stacked rhomb has no fixed place and is not one of them.
        const stuck = new Set<string>();
        for (const c of stacksOf(rhombs)) stuck.add(`${c.x.toFixed(6)},${c.y.toFixed(6)}`);
        const fixed = [];
        for (const r of rhombs) {
            if (stuck.has(`${r.x0.toFixed(6)},${r.y0.toFixed(6)}`)) continue;
            const v0 = r.vertices[0], vj = pg.directions[r.j], vk = pg.directions[r.k];
            fixed.push({
                j: r.j, k: r.k,
                pts: [v0, [v0[0] + vj[0], v0[1] + vj[1]],
                      [v0[0] + vj[0] + vk[0], v0[1] + vj[1] + vk[1]],
                      [v0[0] + vk[0], v0[1] + vk[1]]] as Vec2[],
            });
        }
        const out = new Map<string, PlanEntry>();
        if (sites.length) {
            // The controls name the perturbation outright, so the cascade is
            // told rather than asked. A site the nudge leaves STANDING comes
            // back as −1 and gets no entry: it keeps its superposition, which
            // at a wall is the whole point. Jake: "both."
            const view = viewNudge(pg);
            const plan = cascade(pg, sites, 0, held, fixed, view ? view.e : null);
            sites.forEach((_, i) => {
                const partial = plan.partials?.[i] ?? null;
                if (plan.readings[i] < 0 && !partial) return;
                out.set(at[i], { pool: plan.pools[i],
                                 slot: Math.max(plan.readings[i], 0), partial });
            });
        }
        planCache = out;
        planKey = key;
        return out;
    }

    function stacksOf(rhombs: readonly Rhomb[]): Concurrency[] {
        const byPoint = new Map<string, Rhomb[]>();
        for (const r of rhombs) {
            const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
            const at = byPoint.get(key);
            if (at) at.push(r); else byPoint.set(key, [r]);
        }
        const out: Concurrency[] = [];
        for (const group of byPoint.values()) {
            if (group.length < 2) continue;
            const fams = new Set<number>();
            for (const r of group) { fams.add(r.j); fams.add(r.k); }
            if (fams.size < 3) continue;
            const families = [...fams].sort((a, b) => a - b);
            out.push({ x: group[0].x0, y: group[0].y0, lines: families.length, families });
        }
        return out;
    }

    /** A point of the plane in a tile's own (a, b) frame. */
    function tileLocal(r: Rhomb, dirs: readonly Vec2[], p: Vec2): [number, number] {
        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
        const det = vj[0] * vk[1] - vj[1] * vk[0];
        const x = p[0] - v0[0], y = p[1] - v0[1];
        return [(x * vk[1] - y * vk[0]) / det, (vj[0] * y - vj[1] * x) / det];
    }

    /** Which crossings carry a stack of superposed tiles. */
    function stackKeysOf(rhombs: readonly Rhomb[]): Set<string> {
        return new Set(stacksOf(rhombs).map((c) => `${c.x.toFixed(6)},${c.y.toFixed(6)}`));
    }
    const isOnStack = (keys: Set<string>, r: Rhomb) =>
        keys.has(`${r.x0.toFixed(6)},${r.y0.toFixed(6)}`);

    /**
     * The patch's index range, with the stacks left out.
     *
     * A 2k-gon's corners carry levels the tiling around it does not — the
     * decagon's ghost runs 0..5 — so counting them takes a Penrose patch out of
     * its 1..4 and silences every dressing placed by the index. The same fix the
     * flat page made in indexRange().
     */
    function patchLevels(rhombs: readonly Rhomb[], stacks: Set<string>) {
        let lo = Infinity, hi = -Infinity;
        for (const r of rhombs) {
            if (isOnStack(stacks, r)) continue;
            for (const K of r.kTuples) {
                const m = vertexIndex(K);
                if (m < lo) lo = m;
                if (m > hi) hi = m;
            }
        }
        return { lo, hi, levels: hi - lo + 1 };
    }

    /**
     * A 2k-gon corner, growing by the same law its tiles do.
     *
     * At grow = 0 every corner sits on the crossing, scaled by the registration
     * gain — the same point the stack's tiles start from — so the polygon opens
     * out of the dot rather than appearing around it.
     */
    function outlineAt(
        c: Concurrency, K: readonly number[], p: Vec2, dirs: readonly Vec2[],
    ): Vec3 {
        const { grow, fold } = state;
        const gain = dirs.length / 2;
        return [
            (1 - grow) * gain * c.x + grow * p[0],
            (1 - grow) * gain * c.y + grow * p[1],
            fold * grow * RISE * vertexIndex(K),
        ];
    }

    /**
     * World point to screen.
     *
     * The pan is applied AFTER projection, in screen space, so a drag moves the
     * picture 1:1 whatever the camera is doing. Applying it in world space would
     * foreshorten a vertical drag under tilt and send it off at an angle under
     * spin. With the camera looking straight down and unspun this reduces exactly
     * to the pentagrid's own mathToScreen.
     */
    function toScreen(p: Vec3, v: { scale: number; x: number; y: number }, cx: number, cy: number) {
        const q = project(p);
        return {
            x: cx + (q.sx - v.x) * v.scale,
            y: cy + (q.sy + v.y) * v.scale,
            d: q.depth,
        };
    }

    /** Orthographic: spin about the vertical, then tilt. */
    function project(p: Vec3) {
        const ca = Math.cos(state.azimuth), sa = Math.sin(state.azimuth);
        const xr = p[0] * ca - p[1] * sa;
        const yr = p[0] * sa + p[1] * ca;
        const ce = Math.cos(state.elevation), se = Math.sin(state.elevation);
        return { sx: xr, sy: -(yr * se + p[2] * ce), depth: yr * ce - p[2] * se };
    }

    /**
     * Where a family's ribbon meets one edge of a tile, at full size — used to
     * decide whether two tiles are really edge-adjacent. Sorting a ribbon by
     * position along its line gives consecutive tiles, but consecutive is not
     * adjacent: collectRhombs culls tiles at the edge of the patch, so a pair can
     * straddle a missing one. Their final attachment points then differ, and a
     * gap quad drawn between them spans the hole instead of sealing a seam.
     */
    function finalSeam(r: Rhomb, fam: number, dirs: readonly Vec2[], rib: { px: number; py: number }) {
        const vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
        const at = (a: number, b: number): Vec2 =>
            [v0[0] + a * vj[0] + b * vk[0], v0[1] + a * vj[1] + b * vk[1]];
        const pair = fam === r.j ? [at(0.5, 0), at(0.5, 1)] : [at(0, 0.5), at(1, 0.5)];
        const proj = (p: Vec2) => p[0] * rib.px + p[1] * rib.py;
        return proj(pair[0]) <= proj(pair[1])
            ? { entry: pair[0], exit: pair[1] }
            : { entry: pair[1], exit: pair[0] };
    }

    /**
     * The two corners of a family's band where it meets one edge of a tile —
     * the leaving edge if `exit`, the entering one otherwise. Ordered along the
     * grid line so consecutive tiles pair corner-to-corner without crossing.
     */
    function bandEdge(
        r: Rhomb, fam: number, dirs: readonly Vec2[], lo: number, hi: number,
        rib: { px: number; py: number }, exit: boolean,
    ): [Vec3, Vec3] {
        const along = fam === r.j
            ? ([[lo, 0], [hi, 0]] as const)      // the b = 0 edge
            : ([[0, lo], [0, hi]] as const);     // the a = 0 edge
        const far = fam === r.j
            ? ([[lo, 1], [hi, 1]] as const)
            : ([[1, lo], [1, hi]] as const);
        const near = along.map(([a, b]) => world(r, dirs, a, b)) as [Vec3, Vec3];
        const away = far.map(([a, b]) => world(r, dirs, a, b)) as [Vec3, Vec3];
        const proj = (p: Vec3) => p[0] * rib.px + p[1] * rib.py;
        // which of the two edges is downstream along the line
        const pair = (proj(near[0]) + proj(near[1]) <= proj(away[0]) + proj(away[1]))
            ? (exit ? away : near)
            : (exit ? near : away);
        // and order the two corners consistently across the gap
        const dj = dirs[fam];
        return (pair[0][0] * dj[0] + pair[0][1] * dj[1])
            <= (pair[1][0] * dj[0] + pair[1][1] * dj[1]) ? pair : [pair[1], pair[0]];
    }

    /**
     * A concurrency, as one node on a ribbon.
     *
     * The k-1 tiles a family makes at a stack are superposed, not laid out, so
     * routing the band through them tile by tile zigzags and the seam checks
     * fail — the band stopped dead at every 2k-gon. But the family's ZONE across
     * the 2k-gon is well defined whatever tiling you imagine inside: it enters
     * through the side parallel to v_fam and leaves through the opposite one, the
     * parallel face. So the stack is one node with those two sides as its entry
     * and exit, and the band runs straight across. Nothing inside is asserted.
     */
    interface StackNode {
        kind: "stack"; c: Concurrency; res: Resolution;
        /** This family's superposed tiles on the stack — the pseudo edges. */
        tiles: Rhomb[];
    }
    interface TileNode { kind: "tile"; r: Rhomb; }
    type RibbonNode = TileNode | StackNode;

    /**
     * The two sides of a 2k-gon that carry a family's direction, each as its two
     * corners (with their K-tuples, for height), ordered along +v_fam so the
     * band's lo/hi corners pair up across a gap without crossing.
     */
    function stackSides(res: Resolution, fam: number, dirs: readonly Vec2[]) {
        const [vx, vy] = dirs[fam];
        const n = res.outline.length;
        const sides: { a: Vec2; b: Vec2; Ka: number[]; Kb: number[] }[] = [];
        for (let i = 0; i < n; i++) {
            const p = res.outline[i], q = res.outline[(i + 1) % n];
            const ex = q[0] - p[0], ey = q[1] - p[1];
            const along = Math.hypot(ex - vx, ey - vy) < 1e-6;
            const against = Math.hypot(ex + vx, ey + vy) < 1e-6;
            if (!along && !against) continue;
            sides.push(along
                ? { a: p, b: q, Ka: res.outlineK[i], Kb: res.outlineK[(i + 1) % n] }
                : { a: q, b: p, Ka: res.outlineK[(i + 1) % n], Kb: res.outlineK[i] });
        }
        return sides;   // two of them, for any family that meets here
    }

    /** The stack's seam points at full size: the midpoints of its two faces. */
    function stackSeam(node: StackNode, fam: number, dirs: readonly Vec2[],
                       rib: { px: number; py: number }) {
        const [s0, s1] = stackSides(node.res, fam, dirs);
        const mid = (sd: { a: Vec2; b: Vec2 }): Vec2 =>
            [(sd.a[0] + sd.b[0]) / 2, (sd.a[1] + sd.b[1]) / 2];
        const m0 = mid(s0), m1 = mid(s1);
        const proj = (p: Vec2) => p[0] * rib.px + p[1] * rib.py;
        return proj(m0) <= proj(m1) ? { entry: m0, exit: m1 } : { entry: m1, exit: m0 };
    }

    /** The band's two corners on one face of the stack, at the current grow. */
    function stackBandEdge(node: StackNode, fam: number, dirs: readonly Vec2[],
                           lo: number, hi: number, rib: { px: number; py: number },
                           exit: boolean): [Vec3, Vec3] {
        const [s0, s1] = stackSides(node.res, fam, dirs);
        const proj = (sd: { a: Vec2; b: Vec2 }) =>
            (sd.a[0] + sd.b[0]) * rib.px + (sd.a[1] + sd.b[1]) * rib.py;
        const near = proj(s0) <= proj(s1) ? s0 : s1;
        const far = near === s0 ? s1 : s0;
        const sd = exit ? far : near;
        // Linear along the side, so the grown corners interpolate exactly.
        const A = outlineAt(node.c, sd.Ka, sd.a, dirs);
        const B = outlineAt(node.c, sd.Kb, sd.b, dirs);
        const at = (f: number): Vec3 =>
            [A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1]), A[2] + f * (B[2] - A[2])];
        return [at(lo), at(hi)];
    }

    /**
     * The band's path THROUGH a stack, as a chain of parallel edges.
     *
     * Jake: use the pseudo edges. The family's superposed tiles each carry two
     * edges parallel to v_fam — the pseudo edges — and the tile loop has already
     * painted the band inside each of them. What links them is this: the entry
     * face, then every pseudo edge in order across the 2k-gon, then the exit
     * face, each a band-width slice of a unit edge. Consecutive pairs are sealed
     * with a quad, so the band visibly steps across on the pseudo structure
     * instead of leaping the polygon in one piece. Duplicates — the spoke every
     * tile shares — are folded to one.
     */
    function stackChain(node: StackNode, fam: number, dirs: readonly Vec2[],
                        lo: number, hi: number, rib: { px: number; py: number }): [Vec3, Vec3][] {
        const edges: { at: number; e: [Vec3, Vec3] }[] = [];
        const along = (e: [Vec3, Vec3]) =>
            ((e[0][0] + e[1][0]) / 2) * rib.px + ((e[0][1] + e[1][1]) / 2) * rib.py;
        const push = (e: [Vec3, Vec3]) => {
            const at = along(e);
            if (edges.some((x) => Math.abs(x.at - at) < 1e-6)) return;
            edges.push({ at, e });
        };
        push(stackBandEdge(node, fam, dirs, lo, hi, rib, false));
        push(stackBandEdge(node, fam, dirs, lo, hi, rib, true));
        for (const r of node.tiles) {
            push(bandEdge(r, fam, dirs, lo, hi, rib, false));
            push(bandEdge(r, fam, dirs, lo, hi, rib, true));
        }
        edges.sort((a, b) => a.at - b.at);
        return edges.map((x) => x.e);
    }

    /** Seam and band edge for either kind of node. */
    function nodeSeam(nd: RibbonNode, fam: number, dirs: readonly Vec2[],
                      rib: { px: number; py: number }) {
        return nd.kind === "tile" ? finalSeam(nd.r, fam, dirs, rib) : stackSeam(nd, fam, dirs, rib);
    }
    function nodeBandEdge(nd: RibbonNode, fam: number, dirs: readonly Vec2[],
                          lo: number, hi: number, rib: { px: number; py: number },
                          exit: boolean): [Vec3, Vec3] {
        return nd.kind === "tile"
            ? bandEdge(nd.r, fam, dirs, lo, hi, rib, exit)
            : stackBandEdge(nd, fam, dirs, lo, hi, rib, exit);
    }

    /** Ribbons as nodes: tiles, with each stack collapsed to one node. */
    function ribbonsOf(pg: Pentagrid, rhombs: readonly Rhomb[], dirs: readonly Vec2[]) {
        const out: { fam: number; px: number; py: number; nodes: RibbonNode[] }[] = [];
        // Every concurrency in the patch, keyed by its crossing, resolved once.
        const resolved = new Map<string, { c: Concurrency; res: Resolution }>();
        for (const c of stacksOf(rhombs)) {
            const res = resolveConcurrency(pg, c);
            if (res) resolved.set(`${c.x.toFixed(6)},${c.y.toFixed(6)}`, { c, res });
        }
        for (let fam = 0; fam < dirs.length; fam++) {
            // One node per stack per family, carrying that family's tiles there.
            const stacks = new Map<string, StackNode>();
            for (const r of rhombs) {
                if (r.j !== fam && r.k !== fam) continue;
                const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
                const rs = resolved.get(key);
                if (!rs) continue;
                const st = stacks.get(key) ?? { kind: "stack" as const, ...rs, tiles: [] };
                if (!stacks.has(key)) stacks.set(key, st);
                st.tiles.push(r);
            }
            const [vx, vy] = dirs[fam];
            const px = -vy, py = vx;
            const byLine = new Map<number, RibbonNode[]>();
            const seen = new Set<string>();
            for (const r of rhombs) {
                // collectRhombs emits j < k, so a family shows up as either index
                const n = r.j === fam ? r.nj : (r.k === fam ? r.nk : null);
                if (n === null) continue;
                const l = byLine.get(n) ?? [];
                if (!byLine.has(n)) byLine.set(n, l);
                // A tile on a stack is the stack, once, however many of the
                // family's tiles are superposed there.
                const key = `${r.x0.toFixed(6)},${r.y0.toFixed(6)}`;
                const st = stacks.get(key);
                if (st) {
                    const once = `${n}|${key}`;
                    if (!seen.has(once)) { seen.add(once); l.push(st); }
                } else {
                    l.push({ kind: "tile", r });
                }
            }
            for (const nodes of byLine.values()) {
                if (nodes.length < 2) continue;
                // Order along the line by where each node ENDS UP: a tile by its
                // final center, a stack by the 2k-gon's. Ordering by the crossing
                // x0 tied inside a stack and came out arbitrary.
                const key = (nd: RibbonNode) => {
                    if (nd.kind === "stack") return nd.res.x * px + nd.res.y * py;
                    const r = nd.r, vj = dirs[r.j], vk = dirs[r.k], v0 = r.vertices[0];
                    return (v0[0] + (vj[0] + vk[0]) / 2) * px
                        + (v0[1] + (vj[1] + vk[1]) / 2) * py;
                };
                nodes.sort((a, b) => key(a) - key(b));
                out.push({ fam, px, py, nodes });
            }
        }
        return out;
    }

    // Radians per pixel. A drag across a 700px view turns about a half turn,
    // which is enough to get round the roof without being twitchy.
    const SPIN_PER_PX = 0.008;
    const TILT_PER_PX = 0.006;
    const orbit = config.orbit ?? !!config.lift;

    const pentagrid = createPentagrid({
        container: config.container,
        gamma: config.gamma,
        n: config.n,
        features: { gridLines: false, axes: false },
        session: config.session,
        // This view's own slice, so a roof page is one session record and not
        // two. Filtered through the inventory so only real fields are stored.
        sessionSlice: {
            read: () => {
                const out: Record<string, unknown> = {};
                for (const f of FIELDS) {
                    if (f.owner !== "growth") continue;
                    out[f.key] = (state as unknown as Record<string, unknown>)[f.key];
                }
                return out;
            },
            write: (v) => {
                for (const f of FIELDS) {
                    if (f.owner !== "growth" || !(f.key in v)) continue;
                    (state as unknown as Record<string, unknown>)[f.key] = v[f.key];
                }
            },
        },
        // What fills the canvas under a camera is not what fills it flat. Tilting
        // squashes world-y onto the screen by sin(elevation), so the same rect
        // covers less and less of the picture as the roof lies back; spinning
        // turns the region. Undo both, then take the axis-aligned bound.
        collectRect: (base) => {
            const { azimuth: az, elevation: el, fold, grow } = state;
            const se = Math.max(Math.sin(el), 0.08);
            const ce = Math.cos(el);
            const hw = (base.xMax - base.xMin) / 2;
            const hh = (base.yMax - base.yMin) / 2;
            const cx = (base.xMin + base.xMax) / 2;
            const cy = (base.yMin + base.yMax) / 2;
            // the roof's own relief lifts the far side up the screen
            const zMax = fold * grow * RISE * 6;
            // screen extents, back through the tilt
            const xr = hw;
            const yr = (hh + zMax * ce) / se;
            // and back through the spin: the rotated box's own bound
            const ca = Math.cos(az), sa = Math.sin(az);
            const bx = Math.abs(xr * ca) + Math.abs(yr * sa);
            const by = Math.abs(xr * sa) + Math.abs(yr * ca);
            // A grazing view wants an unbounded region; cap it, and accept that
            // the far edge thins out rather than paying for the whole plane.
            const capX = Math.min(bx, hw * 6);
            const capY = Math.min(by, hh * 6);
            return {
                xMin: cx - capX, xMax: cx + capX,
                yMin: cy - capY, yMax: cy + capY,
            };
        },
        onOrbit: orbit ? (dx, dy) => {
            state.azimuth += dx * SPIN_PER_PX;
            // Drag down to drop toward the horizon, up to rise overhead. Clamped
            // short of both, since edge-on is a line and straight down is flat.
            state.elevation = Math.max(0.05, Math.min(Math.PI / 2,
                state.elevation - dy * TILT_PER_PX));
            handle!.redraw();
        } : undefined,
        layers: ({ stack, model, currentRhombs, getView }) => {
            stack.add({
                // Over the tiles: it is the space they are growing into, so it has
                // to stay legible once they fill it.
                id: "resolutions", label: "2k-gons", z: 41, group: "Exploration",
                visible: () => state.showResolutions,
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    for (const c of stacksOf(currentRhombs())) {
                        const r = resolveConcurrency(model as Pentagrid, c);
                        if (!r) continue;
                        ctx.beginPath();
                        r.outline.forEach((p, i) => {
                            const q = S(outlineAt(c, r.outlineK[i], p, dirs));
                            if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
                        });
                        ctx.closePath();
                        // Pink for a hexagon, purple for the octagon and the
                        // decagon — the split the flat page uses, since the
                        // hexagons are the common case and the ones that come in
                        // a column. With the legacy drawing off this color is
                        // the whole of what is inside the polygon.
                        // Lighter than it was: with a reading seating real
                        // tiles underneath, the wash has to be something you
                        // see THROUGH. Jake: "The center decagon is opaque and
                        // decorations don't show through."
                        const big = r.families.length > 3;
                        ctx.fillStyle = big
                            ? "rgba(140, 90, 175, 0.12)" : "rgba(214, 90, 170, 0.10)";
                        ctx.fill();
                        // The polygon's own outline answers to the edge
                        // control like everything else. Jake: "when I turn off
                        // edges, I expect the 2kgon edges to be turned off too."
                        if (state.edgeStyle !== "none") {
                            const bold = state.edgeStyle === "bold";
                            ctx.strokeStyle = big
                                ? `rgba(122, 72, 160, ${bold ? 0.95 : 0.6})`
                                : `rgba(196, 70, 152, ${bold ? 0.95 : 0.6})`;
                            ctx.lineWidth = bold ? 2.2 : 1.1;
                            ctx.stroke();
                        }
                    }
                },
            });
            stack.add({
                /**
                 * The singularity as a solid.
                 *
                 * Over the 2k-gon, because it is the same space seen with its
                 * missing dimension put back: the outline is the shadow, this is
                 * what casts it. Faces are carried as generator MASKS, so a
                 * corner's height is RISE*(m0 + popcount) exactly and the whole
                 * thing grows out of the crossing by the law its tiles use.
                 */
                id: "solids", label: "Solids", z: 42, group: "Exploration",
                visible: () => state.solids,
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    const gain = dirs.length / 2;
                    const { grow, fold, pick, pairGhost } = state;
                    // edge: the rhomb's outline, which is all that is left of the
                    // face. band: one family's strip across it. cross: where two
                    // strips overlap, in the mixed color the whole face used to be.
                    type Facet = {
                        pts: { x: number; y: number }[]; d: number;
                        kind: "edge" | "band" | "cross" | "ghost"; fill?: string;
                    };
                    const facets: Facet[] = [];
                    let report = "";
                    let widest = 0;

                    // Which reading each singularity takes, decided ONCE for
                    // the whole patch rather than wrapped per solid. The
                    // decagon drives and the rest agree with it — Jake's
                    // design, and §5.-1a's bug: wrapping one number against
                    // each solid's own count left two illegal borders at
                    // every position of the control, zero of ten clean,
                    // although a clean choice always existed.
                    const plan = readingPlan(model as Pentagrid, currentRhombs());

                    for (const c of stacksOf(currentRhombs())) {
                        const res = resolveConcurrency(model as Pentagrid, c);
                        if (!res) continue;
                        const z = zonohedronOf(dirs, res.families);

                        // Anchored to the polygon the 2k-gons layer draws, so the
                        // two cannot disagree.
                        const anchor = zonogonAnchor(z, res.outline, res.outlineK, dirs);
                        const [sx, sy] = anchor.origin;

                        // On a Penrose grid the reading control is held to what
                        // the grid can reach without leaving Σγ where it is. No
                        // switch: Σγ being an integer IS the criterion, so the
                        // grid already says which readings exist.
                        const held = penroseCondition(
                            model.gamma.reduce((t, g) => t + g, 0), dirs.length) === true;
                        const seat = plan.get(`${c.x.toFixed(6)},${c.y.toFixed(6)}`);
                        const pool = seat ? seat.pool
                            : (held && z.penrose.length ? z.penrose
                                : z.readings.map((_, i) => i));
                        // What a SUPERPOSITION shows, which is not the same
                        // list. `pool` is what the single-surface case indexes
                        // into, and the cascade hands back every reading there
                        // so that the index means what it says. The states to
                        // show at once are the ones the grid can actually
                        // reach, and on a Penrose grid that is ten, not 62 —
                        // Jake: "we know there are only 10 which express
                        // penrose tiles."
                        //
                        // Reading these off `pool` is what went wrong at
                        // `both`: the four settled cells were drawn once and
                        // correctly, and then buried under ghosts from 52
                        // readings the grid never takes. Jake: "both is
                        // mistaken about the decagon. The rhombs inside the
                        // decagon that are unchanged with high and low should
                        // also be unchanged for both."
                        const shown = held && z.penrose.length
                            ? z.penrose : z.readings.map((_, i) => i);
                        const count = z.readings.length ? pool.length : 0;
                        // Seated or STANDING. The nudge the controls name
                        // resolves most sites and leaves the wall's own alone,
                        // and a site with no seat has no single surface to
                        // draw: it keeps its superposition even with the
                        // reading on. Jake: "high/low/both for paths" — this
                        // is `both`, and at a wall it is not a choice, it is
                        // what the grid is doing.
                        const partial = seat?.partial ?? null;
                        const resolved = seat !== undefined && !partial;
                        const slot = seat ? seat.slot : 0;
                        const bases = count ? z.readings[pool[slot]] : z.lower;
                        const flips = z.flips(bases);
                        const turn = flips.length
                            ? flips[((pick % flips.length) + flips.length) % flips.length]
                            : null;

                        // A point of the solid: a corner mask, plus fractional
                        // steps along two generators. z stays affine in those —
                        // every generator raises by RISE — so a band across a
                        // face is as exact as the face is.
                        const at = (mask: number, s: number, gs: number,
                                    t: number, gt: number): Vec3 => {
                            let x = sx, y = sy;
                            for (let l = 0; l < z.k; l++) {
                                if (!(mask >> l & 1)) continue;
                                x += dirs[z.fams[l]][0];
                                y += dirs[z.fams[l]][1];
                            }
                            x += s * dirs[z.fams[gs]][0] + t * dirs[z.fams[gt]][0];
                            y += s * dirs[z.fams[gs]][1] + t * dirs[z.fams[gt]][1];
                            return [
                                (1 - grow) * gain * c.x + grow * x,
                                (1 - grow) * gain * c.y + grow * y,
                                fold * grow * RISE * (anchor.index + popcount(mask) + s + t),
                            ];
                        };
                        const corner = (mask: number): Vec3 => at(mask, 0, 0, 0, 0);
                        const quad = (w: Vec3[]) => w.map(S);
                        const depth = (q: { d: number }[]) =>
                            q.reduce((s, r) => s + r.d, 0) / q.length;
                        const lambert = (w: Vec3[]) => {
                            if (!shaded) return 1;
                            const u = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]];
                            const t = [w[3][0] - w[0][0], w[3][1] - w[0][1], w[3][2] - w[0][2]];
                            const n = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2],
                                       u[0] * t[1] - u[1] * t[0]];
                            const nl = Math.hypot(n[0], n[1], n[2]) || 1;
                            return 0.62 + 0.38 * Math.abs(
                                (n[0] * 0.35 - n[1] * 0.30 + n[2] * 0.89) / nl);
                        };

                        // A face is drawn as its edges, the two bands crossing
                        // on it, and the crossing itself.
                        //
                        // A family's ribbon enters through the edge parallel to
                        // that family and leaves through the opposite one, so on
                        // this face it is the strip s ∈ [lo, hi] along its own
                        // generator, the full width across. Consecutive faces of
                        // a ribbon share that edge, so the strips join with
                        // nothing between them and the band runs over the solid
                        // continuously. The two strips on a face overlap in one
                        // patch, which IS the crossing of those two families —
                        // so it takes the mixed color the whole face used to
                        // carry, and the rhomb reads as a rhomb.
                        const lo = 0.5 - state.band / 2, hi = 0.5 + state.band / 2;

                        /**
                         * With the reading OFF, every state at once.
                         *
                         * Jake: "skewbs should have both paths through the
                         * Necker cube shown. This indicates it is showing all
                         * its states simultaneously." So the faces drawn are
                         * not one surface's but the UNION over every reading
                         * the grid can reach — deduplicated by (face, mask),
                         * since most placements are shared between readings
                         * and drawing one twice would double its band.
                         *
                         * A skewb has two placements per face, which are the
                         * two Necker states. The decagon has six per face over
                         * its ten readings, 60 placements for 10 faces, and is
                         * the mess Jake predicts.
                         */
                        const states: { p: number; m: number }[] = [];
                        if ((state.resolve && resolved) || !count) {
                            for (let p = 0; p < z.pairs.length; p++) {
                                states.push({ p, m: bases[p] });
                            }
                        } else if (state.resolve && partial) {
                            // A wall: the settled cells once, the standing ones
                            // superposed. Which is the picture Jake asked for —
                            // "four penrose tiles and two skewbs" — rather than
                            // the whole 62-fold stack, most of which the grid
                            // is not doing here.
                            // Only the readings that AGREE with what the wall
                            // already settled.
                            //
                            // Jake: "both is mistaken about the decagon. The
                            // rhombs inside the decagon that are unchanged with
                            // high and low should also be unchanged for both."
                            // They were drawn, and then contradicted: the open
                            // cells superposed over every reachable reading,
                            // including the eight whose settled cells disagree
                            // with this wall. Those ghosts are states the grid
                            // cannot be in while standing on this wall.
                            //
                            // Filtered, what survives is exactly the wall's two
                            // completions — so `both` is the union of high and
                            // low, which is what it should have been saying all
                            // along: everything those two agree on, held, and
                            // the two skewbs showing both of their states.
                            const agrees = shown.filter((ri) =>
                                partial.every((m, p) =>
                                    m === null || z.readings[ri][p] === m));
                            const seenState = new Set<string>();
                            for (let p = 0; p < z.pairs.length; p++) {
                                if (partial[p] !== null) {
                                    states.push({ p, m: partial[p]! });
                                    continue;
                                }
                                for (const ri of (agrees.length ? agrees : shown)) {
                                    const m = z.readings[ri][p];
                                    const k = `${p}|${m}`;
                                    if (seenState.has(k)) continue;
                                    seenState.add(k);
                                    states.push({ p, m });
                                }
                            }
                        } else {
                            const seenState = new Set<string>();
                            for (const ri of shown) {
                                const b = z.readings[ri];
                                for (let p = 0; p < z.pairs.length; p++) {
                                    const k = `${p}|${b[p]}`;
                                    if (seenState.has(k)) continue;
                                    seenState.add(k);
                                    states.push({ p, m: b[p] });
                                }
                            }
                        }
                        for (const st of states) {
                            const p = st.p;
                            const [i, j] = z.pairs[p];
                            const m = st.m;
                            const w = z.faceAt(m, p).map(corner);
                            const q = quad(w);
                            const d0 = depth(q);
                            facets.push({ pts: q, d: d0, kind: "edge" });
                            if (state.band <= 0.001) continue;
                            const k = lambert(w);
                            const strip = (s0: number, s1: number, t0: number, t1: number) =>
                                quad([at(m, s0, i, t0, j), at(m, s1, i, t0, j),
                                      at(m, s1, i, t1, j), at(m, s0, i, t1, j)]);
                            // just in front of their own face, so the painter's
                            // order lands them on the right one
                            facets.push({
                                pts: strip(lo, hi, 0, 1), d: d0 - 1e-3, kind: "band",
                                fill: tint(rgbOf(FAMILY_COLORS[z.fams[i]]), k),
                            });
                            facets.push({
                                pts: strip(0, 1, lo, hi), d: d0 - 1e-3, kind: "band",
                                fill: tint(rgbOf(FAMILY_COLORS[z.fams[j]]), k),
                            });
                            facets.push({
                                pts: strip(lo, hi, lo, hi), d: d0 - 2e-3, kind: "cross",
                                fill: tint(MIX[z.fams[i]][z.fams[j]], k),
                            });
                        }

                        // The partner reading differs in one cell's cap, so only
                        // those three faces are worth drawing twice.
                        if (pairGhost && turn) {
                            for (const ch of turn.changed) {
                                const q = quad(z.face(turn.to, ch.pair).map(corner));
                                facets.push({ pts: q, d: depth(q), kind: "ghost" });
                            }
                        }

                        if (res.families.length > widest) {
                            widest = res.families.length;
                            const which = count ? pool[slot] : 0;
                            // Say what made the reading, not just which one it is:
                            // the nudge that pulls the lines apart into it.
                            const e = count ? z.nudgeOf(which) : null;
                            // "2↑ 3↓↓ 4·" — which way each line slid, and how far.
                            const how = e === null
                                ? "beyond the nudges enumerated"
                                : z.fams.map((f, l) => {
                                    const v = e[l];
                                    const arrow = v === 0
                                        ? "\u00b7"
                                        : (v > 0 ? "\u2191" : "\u2193").repeat(Math.abs(v));
                                    return `${f}${arrow}`;
                                }).join(" ");
                            // What the STATE is, not where it sits in a list.
                            //
                            // This said `reading 22/62`, and Jake: "you still
                            // count 62 permutation. We know there are only 10
                            // which express penrose tiles." 62 is the zonogon's
                            // combinatorics and the index was into that. The
                            // state is the nudge, and it has a name.
                            const view = viewNudge(model as Pentagrid);
                            const at = !count ? "lower surface"
                                : view ? `axis ${view.axis} · `
                                    + `${view.sense > 0 ? "thin→thick" : "thick→thin"} · `
                                    + `${view.paths}`
                                    + `${resolved ? "" : " · standing"}`
                                    + ` · ${how}`
                                : `reading ${slot + 1}/${count} · ${how}`;
                            let pairText = "no flip";
                            if (turn) {
                                const fams = turn.cell.map((l) => z.fams[l]);
                                const code = angleCode(model as Pentagrid, fams);
                                const shape = CELL_SHAPE[code] ?? code;
                                const at = ((pick % flips.length) + flips.length) % flips.length;
                                pairText = `pair ${at + 1}/${flips.length} turns the ${shape}`
                                    + ` cell K${code}`;
                            }
                            report = `${res.name} · ${at} · ${pairText}`;
                        }
                    }

                    facets.sort((p, q) => q.d - p.d);          // far first
                    for (const f of facets) {
                        if (f.kind === "ghost") continue;      // outlined on top
                        ctx.beginPath();
                        f.pts.forEach((q, i) => {
                            if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
                        });
                        ctx.closePath();
                        if (f.kind === "edge") {
                            // The solid's own face outlines answer to the same
                            // control the tiles do. Jake: "edges don't obey
                            // edge setting."
                            if (state.edgeStyle === "none") continue;
                            const bold = state.edgeStyle === "bold";
                            ctx.lineWidth = bold ? 2.2 : 1.1;
                            ctx.strokeStyle = bold
                                ? "rgba(18, 22, 30, 0.85)" : "rgba(28, 34, 44, 0.55)";
                            ctx.stroke();
                            continue;
                        }
                        ctx.globalAlpha = f.kind === "band" ? 0.85 : 1;
                        ctx.fillStyle = f.fill!;
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                    // The partner cap is the near one half the time and the far
                    // one the other half; depth alone would hide it whenever the
                    // current reading is the upper. So its outline goes on top —
                    // the fill still loses to whatever is in front of it, which
                    // is the z priority the front band is supposed to have.
                    ctx.setLineDash([4, 3]);
                    ctx.lineWidth = 1.6;
                    ctx.strokeStyle = "rgba(230, 57, 70, 0.95)";
                    for (const f of facets) {
                        if (f.kind !== "ghost") continue;
                        ctx.beginPath();
                        f.pts.forEach((q, i) => {
                            if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
                        });
                        ctx.closePath();
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);
                    config.onReadout?.(report);
                },
            });
            stack.add({
                /**
                 * The matching arcs, over the folded tiles.
                 *
                 * They need no index — every edge is +vⱼ from one of its ends
                 * and that orientation is global, so the curves join by
                 * construction — which is why this works off a Penrose patch
                 * where the dressings go quiet. A circular arc in the plane is
                 * not a circle once the tile is folded, so it is carried in the
                 * tile's own (a, b) frame and sampled, which is exact at every
                 * fold. Not drawn on a superposition: an arc asserts a matching
                 * that a stack of tiles does not have.
                 */
                id: "arcs", label: "Arcs", z: 43, group: "Exploration",
                visible: () => state.arcs,
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    const rhombs = currentRhombs();
                    const stacks = stackKeysOf(rhombs);
                    // The seats, so an arc on a resolved 2k-gon rides with its
                    // tile. Jake: "I just noticed that arcs is not
                    // implemented" — they were, and skipped on every stack,
                    // which before a reading was right (an arc asserts a
                    // matching a superposition does not have) and after one is
                    // not: a seated tile is a legal tile and its arcs join.
                    seats = state.resolve
                        ? seatsFor(model as Pentagrid, rhombs) : null;
                    ctx.lineWidth = 1.6;
                    ctx.lineCap = "round";
                    const STEPS = 14;
                    for (const r of rhombs) {
                        if (isOnStack(stacks, r) && !seats?.has(seatKeyOf(r))) continue;
                        for (const arc of rhombArcs(model as Pentagrid, r)) {
                            let d = arc.a2 - arc.a1;
                            while (d > Math.PI) d -= 2 * Math.PI;
                            while (d < -Math.PI) d += 2 * Math.PI;
                            ctx.strokeStyle = ARC_COLORS[arc.family];
                            ctx.beginPath();
                            for (let i = 0; i <= STEPS; i++) {
                                const a = arc.a1 + (d * i) / STEPS;
                                const [la, lb] = tileLocal(r, dirs, [
                                    arc.x + arc.r * Math.cos(a),
                                    arc.y + arc.r * Math.sin(a),
                                ]);
                                const p = S(world(r, dirs, la, lb));
                                if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                            }
                            ctx.stroke();
                        }
                    }
                },
            });
            stack.add({
                /**
                 * Every dual vertex with its de Bruijn index in a white circle.
                 *
                 * Normalized to the patch minimum, so a Penrose patch reads
                 * 1..4 — the same numbers the dressings are placed by — with the
                 * stacks left out of the range so a singular preset still does.
                 * One circle per vertex however many tiles meet there.
                 */
                id: "vertex-index", label: "Index", z: 44, group: "Exploration",
                visible: () => state.indexStyle !== "none",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    const rhombs = currentRhombs();
                    const stacks = stackKeysOf(rhombs);
                    const { lo } = patchLevels(rhombs, stacks);
                    if (!Number.isFinite(lo)) return;
                    // Same seats the tiles use, so a mark sits on the corner it
                    // is marking and says the index that corner really has.
                    seats = state.resolve
                        ? seatsFor(model as Pentagrid, rhombs) : null;
                    const R = Math.max(6, Math.min(10, v.scale * 0.11));
                    ctx.font = `bold ${Math.round(R * 1.4)}px sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.lineWidth = 1;
                    const seen = new Set<string>();
                    const marks: { x: number; y: number; d: number; m: number }[] = [];
                    for (const r of rhombs) {
                        for (let i = 0; i < 4; i++) {
                            const [a, b] = [[0, 0], [1, 0], [1, 1], [0, 1]][i];
                            const seat = seats?.get(seatKeyOf(r));
                            const idx = seat
                                ? seat.index + a + b
                                : vertexIndex(r.kTuples[i]);
                            const p = S(world(r, dirs, a, b));
                            const key = `${Math.round(p.x * 1e3)},${Math.round(p.y * 1e3)},${idx}`;
                            if (seen.has(key)) continue;
                            seen.add(key);
                            marks.push({ x: p.x, y: p.y, d: p.d, m: idx - lo + 1 });
                        }
                    }
                    marks.sort((p, q) => q.d - p.d);          // far first
                    const pool = state.indexStyle === "pool";
                    for (const mk of marks) {
                        const hue = pool ? (POOL[mk.m] ?? POOL[0]) : null;
                        ctx.beginPath();
                        ctx.arc(mk.x, mk.y, R, 0, 2 * Math.PI);
                        if (hue) {
                            // A sphere's outline is always a circle, so a ball
                            // is a radial gradient in one: the highlight up and
                            // left of center, the body falling to a dark rim.
                            const g = ctx.createRadialGradient(
                                mk.x - R * 0.35, mk.y - R * 0.4, R * 0.08,
                                mk.x, mk.y, R * 1.05);
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
                        if (pool) {
                            // The number rides a white disc, as it does on a
                            // real ball, so it reads over any body color.
                            ctx.beginPath();
                            ctx.arc(mk.x, mk.y, R * 0.56, 0, 2 * Math.PI);
                            ctx.fillStyle = "#fbfbf7";
                            ctx.fill();
                        }
                        ctx.fillStyle = "#111";
                        ctx.fillText(String(mk.m), mk.x, mk.y + 0.5);
                    }
                },
            });
            stack.add({
                id: "growth", label: "Growth", z: 40, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const dirs = model.directions;
                    const rhombs = currentRhombs();
                    const { grow, band } = state;
                    const S = (p: Vec3) => toScreen(p, v, cx, cy);
                    const lo = 0.5 - band / 2, hi = 0.5 + band / 2;

                    const order = rhombs
                        .map((r) => ({ r, d: S(world(r, dirs, 0.5, 0.5)).d }))
                        .sort((p, q) => q.d - p.d);   // far first

                    // Every crossing where tiles are superposed, once. Three
                    // things have to know about them: the index range (a stack's
                    // corners carry the 2k-gon's ghost levels and would take the
                    // dressings out of Penrose), the legacy switch (with it off
                    // nothing of a stack is drawn at all — the 2k-gon's own color
                    // is the whole statement), and the arcs, which assert a
                    // matching a superposition does not have.
                    const stackKeys = stackKeysOf(rhombs);
                    const onStack = (r: Rhomb) => isOnStack(stackKeys, r);

                    const trace = (r: Rhomb, corners: number[][]) => {
                        ctx.beginPath();
                        corners.forEach(([a, b], i) => {
                            const p = S(world(r, dirs, a, b));
                            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
                        });
                        ctx.closePath();
                    };
                    const BODY = [[0, 0], [1, 0], [1, 1], [0, 1]];

                    /**
                     * Does a point lie on the segment a→b?
                     *
                     * Both tests, because a point can be on the LINE and past
                     * the end of the segment.
                     */
                    const onSegment = (p: Vec2, a: Vec2, b: Vec2) => {
                        const ex = b[0] - a[0], ey = b[1] - a[1];
                        const L2 = ex * ex + ey * ey;
                        if (L2 < 1e-18) return false;
                        const t = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2;
                        if (t < -1e-9 || t > 1 + 1e-9) return false;
                        const off = (p[0] - a[0]) * ey - (p[1] - a[1]) * ex;
                        return Math.abs(off) / Math.sqrt(L2) < 1e-7;
                    };
                    /**
                     * Stroke the edges of a clipped piece that belong to the
                     * SHAPE, and none of the ones the clip introduced.
                     *
                     * Jake: "seems to be a vertical line drawn through the
                     * orange pentagons... the line follows the actual tile
                     * edge. method does not have that error." It doesn't,
                     * because method draws the pentagons in one unclipped pass
                     * over the whole patch. A folded roof cannot: every tile is
                     * drawn in its own frame, so a pentagon crossing a tile
                     * edge has to be cut there — and the cut edge is a real
                     * edge of the piece, which a plain `stroke` then draws.
                     *
                     * So the clip stays and the stroke gets choosier. An edge
                     * whose midpoint lies on the original polygon's boundary is
                     * the shape's own; anything else came from the knife. The
                     * two halves either side of a tile edge stroke their own
                     * parts and together make the one pentagon's outline.
                     */
                    const strokeOwnEdges = (
                        r: Rhomb, piece: readonly Vec2[], shape: readonly Vec2[],
                    ) => {
                        ctx.beginPath();
                        for (let i = 0; i < piece.length; i++) {
                            const a = piece[i], b = piece[(i + 1) % piece.length];
                            const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                            let own = false;
                            for (let j = 0; j < shape.length && !own; j++) {
                                own = onSegment(mid, shape[j], shape[(j + 1) % shape.length]);
                            }
                            if (!own) continue;
                            const pa = S(world(r, dirs, ...toLocal(r, a)));
                            const pb = S(world(r, dirs, ...toLocal(r, b)));
                            ctx.moveTo(pa.x, pa.y);
                            ctx.lineTo(pb.x, pb.y);
                        }
                        ctx.stroke();
                    };

                    // The P1 pentagons, once per draw. A piece is mapped into the
                    // tile's (a, b) frame by solving p = v0 + a*vj + b*vk, and
                    // `world` then puts it where the tile is, lifted or not.
                    // The reading's seats, so the tiles inside a 2k-gon can be
                    // drawn where that reading puts them rather than left out.
                    seats = state.resolve
                        ? seatsFor(model as Pentagrid, rhombs) : null;
                    const pents = state.p1 ? p1Pentagons(rhombs, dirs) : [];
                    const { lo: idxLo, levels } = patchLevels(rhombs, stackKeys);
                    const placeable = levels === 4 || (levels === 5 && state.offPenrose);
    /**
     * Which readings a tile's dressings take — and for a SEATED tile, by the
     * index the reading gave it rather than the one its own K-tuple carries.
     *
     * Jake: "when I turn on penta, kites, or next-gen decoration, the
     * decorations are not oriented correctly." They were placed from
     * `r.kTuples`, which at a singularity is whichever resolution
     * `computeRhomb` happened to pick — not the one the reading chose. A
     * dressing's ORIENTATION is which corner is the index extreme, so a wrong
     * index is a turned decoration. Mirrors `dressingReadings`, with the
     * seated index in place of the K-tuple sum.
     */
                    const readings = (r: Rhomb) => {
                        const seat = seats?.get(seatKeyOf(r));
                        if (!seat) return dressingReadings(r, idxLo, levels);
                        const m = seat.index - idxLo + 1;          // v0's level
                        if (m < 1 || m + 2 > levels) return [];
                        if (m === 1) return [{ extAt: 0 as const, alpha: 1 }];
                        if (m + 2 === levels) return [{ extAt: 2 as const, alpha: 1 }];
                        return [{ extAt: 0 as const, alpha: 0.5 },
                                { extAt: 2 as const, alpha: 0.5 }];
                    };
                    // One switch per decoration, drawing its face and then its
                    // own edge. Jake: "I want the parity to be in implemented
                    // functionality. The controls are just a specialization, so
                    // grow and roof have reduced choice... and the edge
                    // referred to here is a component of the DECORATION, not
                    // the tile edge." So a decoration is whole here, where
                    // method splits it in two, and the tile's own edge control
                    // has nothing to do with any of it.
                    const pentaOn = state.penta && placeable;
                    const nextOn = state.nextgen && placeable;
                    const kitesOn = state.kites && placeable;
                    const toLocal = (r: Rhomb, p: Vec2) => tileLocal(r, dirs, p);
                    const outlines: { r: Rhomb; A: number; k: number }[] = [];
                    /**
                     * method's height treatment: a GRADIENT over the decorated
                     * face, by vertex index.
                     *
                     * Not a flat shade per tile, which is what this was and
                     * was wrong — Jake: "the height treatment takes a decorated
                     * face and applies a gradient based on the vertex
                     * instance." A rhomb's four corners carry three index
                     * levels, m at v0, m+1 at both middles, m+2 at v2, so the
                     * gradient runs along the v0→v2 diagonal with a stop at
                     * each. Its direction IS the direction of increasing
                     * height, which is what the isoglosses then run across.
                     */
                    const rampT = (m: number) =>
                        ((m - idxLo) / Math.max(levels - 1, 1) - 0.5) * 2;
                    const indexOf = (r: Rhomb) => {
                        const seat = seats?.get(seatKeyOf(r));
                        return seat ? seat.index : vertexIndex(r.kTuples[0]);
                    };
                    const heightFill = (r: Rhomb, base: RGB, k: number) => {
                        const m = indexOf(r);
                        const a = S(world(r, dirs, 0, 0)), b = S(world(r, dirs, 1, 1));
                        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                        for (const [stop, at] of [[0, m], [0.5, m + 1], [1, m + 2]] as const) {
                            g.addColorStop(stop, tint(ramped(base, rampT(at) * RAMP), k));
                        }
                        return g;
                    };

                    for (const { r } of order) {
                        // With the legacy drawing off, a superposed tile is not
                        // drawn at all: no fill, no edges, no bands. What is
                        // there is the 2k-gon, in the 2k-gon's own color, and
                        // the solid if it is on.
                        // A tile in a 2k-gon is drawn when the reading has
                        // seated it — it is a legal Penrose tile and belongs in
                        // the picture — and faintly, because the solid above it
                        // is the thing being read and this is its shadow.
                        // Unseated, it is still nothing: a stack with no reading
                        // to place it has no honest position to be drawn at.
                        const seated = seats?.has(seatKeyOf(r)) ?? false;
                        if (onStack(r) && !seated) continue;
                        // The BODY of a seated tile is faint; its decorations
                        // are not. Jake, twice: "the decorations are still
                        // washed out." The first version put one alpha on the
                        // whole tile, so dressing and ground faded together and
                        // the thing you wanted to read faded with the thing you
                        // wanted to see through. Only the ground takes A.
                        // Faint only when the tile is BARE. Jake: "in pentas,
                        // the blue fields are not being rendered" — penta's
                        // field IS the tile's ground, so fading the ground of
                        // a dressed tile erases the dressing's own background.
                        // A dressed seated tile is drawn at full strength; a
                        // bare one stays a hint.
                        const dressed = pentaOn || nextOn || kitesOn
                            || state.p1 || state.kowalewski;
                        const A = seated && !dressed ? SEATED_ALPHA : 1;
                        let k = 1;
                        if (shaded) {
                            const A = world(r, dirs, 0, 0);
                            const B = world(r, dirs, 1, 0);
                            const C = world(r, dirs, 0, 1);
                            const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
                            const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
                            const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2],
                                       u[0] * w[1] - u[1] * w[0]];
                            const nl = Math.hypot(n[0], n[1], n[2]) || 1;
                            k = 0.62 + 0.38 * Math.abs((n[0] * 0.35 - n[1] * 0.30 + n[2] * 0.89) / nl);
                        }
                        if (grow > 0.02) {
                            trace(r, BODY);
                            // The ground, under every other dressing. Kowalewski
                            // is one of them and the coarsest: it colors the
                            // whole tile by its axis, so the finer dressings
                            // and the bands both read over it.
                            const base: RGB = kitesOn ? KITE : nextOn ? NEXTGEN_THICK
                                : state.p1 || pentaOn ? rgbOf(P1_STAR)
                                : state.kowalewski
                                    ? kowalewskiOf(r.j, r.k, dirs.length)
                                    : [255, 255, 255];
                            // The face at FULL strength, seated or not.
                            //
                            // A bare seated tile used to take SEATED_ALPHA
                            // here, and that cost the height ramp and the angle
                            // shade their whole range: both modulate the face's
                            // lightness, which is exactly what the alpha was
                            // weakening. Jake: "height shading does not show,
                            // or shows extremely poorly, when reading rendered
                            // singularity tile permutation" and "angle shading
                            // is not expressed as strongly in the singularities
                            // as in the normal tiles." Measured at Γ = 0 with
                            // the reading on: 246 seated faces, every one at
                            // 0.22, against 604 ordinary ones at 1 — and the
                            // gradients themselves were already correct.
                            //
                            // It bought nothing either way. A bare tile's base
                            // is white, so white at 0.22 over the page's ground
                            // is still white: the alpha never changed how the
                            // body looked, it only divided the shading by 4.5.
                            // What marks a singularity is the 2k-gon's own wash,
                            // drawn OVER the tiles; the faintness still worth
                            // keeping is the seated tile's OUTLINE, which takes
                            // A below as it always did.
                            //
                            // The ramp sits OVER the color, as in method:
                            // pale high, dark low, across the face.
                            ctx.fillStyle = state.height
                                ? heightFill(r, base, k) : tint(base, k);
                            ctx.fill();
                            ctx.globalAlpha = 1;      // the dressings at full
                            if (kitesOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const d = rhombKitesDarts(r, idxLo, levels, extAt);
                                for (const poly of d.darts) {
                                    trace(r, poly.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(DART, k);
                                    ctx.fill();
                                }
                                ctx.strokeStyle = shaded
                                    ? `rgba(0,0,0,${(0.30 + 0.30 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.55)";
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                for (const [a, b] of d.edges) {
                                    const [pa, pb] = [a, b].map((p) => toLocal(r, p)).map(([x, y]) => S(world(r, dirs, x, y)));
                                    ctx.moveTo(pa.x, pa.y);
                                    ctx.lineTo(pb.x, pb.y);
                                }
                                ctx.stroke();
                                ctx.globalAlpha = 1;
                            }
                            if (nextOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const d = rhombDeflation(r, idxLo, levels, extAt);
                                for (const poly of d.gray) {
                                    trace(r, poly.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(NEXTGEN_THIN, k);
                                    ctx.fill();
                                }
                                ctx.strokeStyle = shaded
                                    ? `rgba(0,0,0,${(0.30 + 0.30 * k).toFixed(3)})`
                                    : "rgba(0,0,0,0.55)";
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                for (const [a, b] of d.edges) {
                                    const [pa, pb] = [a, b].map((p) => toLocal(r, p)).map(([x, y]) => S(world(r, dirs, x, y)));
                                    ctx.moveTo(pa.x, pa.y);
                                    ctx.lineTo(pb.x, pb.y);
                                }
                                ctx.stroke();
                                ctx.globalAlpha = 1;
                            }
                            if (pentaOn) for (const { extAt, alpha } of readings(r)) {
                                ctx.globalAlpha = alpha;
                                const parts = rhombPentagons(r, idxLo, levels, extAt);
                                const pieces: [number[][], string][] = parts.orange.map(
                                    (o) => [o, P1_FILL.Pe1] as [number[][], string]);
                                if (parts.yellow) pieces.push([parts.yellow, P1_FILL.Pe3]);
                                for (const [poly, fill] of pieces) {
                                    const piece = clipToConvex(poly as Vec2[], r.vertices);
                                    if (piece.length < 3) continue;
                                    trace(r, piece.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(rgbOf(fill), k);
                                    ctx.fill();
                                    // The decoration's OWN edge, after its
                                    // face. Nothing to do with the tile edge
                                    // control: that one draws the tiling, this
                                    // one is part of the pentaplex — and it
                                    // traces the PENTAGON, never the tile edge
                                    // the piece was cut against.
                                    ctx.strokeStyle = PENTA_EDGE;
                                    ctx.lineWidth = 1.4;
                                    ctx.lineJoin = "round";
                                    strokeOwnEdges(r, piece, poly as Vec2[]);
                                }
                                ctx.globalAlpha = 1;
                            }
                            if (state.p1) {
                                const mx = (r.vertices[0][0] + r.vertices[2][0]) / 2;
                                const my = (r.vertices[0][1] + r.vertices[2][1]) / 2;
                                for (const pent of pents) {
                                    if (Math.hypot(pent.x - mx, pent.y - my) > 2) continue;
                                    const piece = clipToConvex(pent.verts, r.vertices);
                                    if (piece.length < 3) continue;
                                    trace(r, piece.map((p) => toLocal(r, p)));
                                    ctx.fillStyle = tint(rgbOf(P1_FILL[pent.kind]), k);
                                    ctx.fill();
                                }
                            }
                        }
                        if (band > 0.001 && grow > 0.02) {
                            // The ramp is a POST-TILE treatment, so it takes
                            // the bands too. Without that it does nothing on a
                            // bare tile, whose ground is white and cannot go
                            // paler — and the bands are where the roof's color
                            // actually lives.
                            const up = (c: RGB) =>
                                state.height ? heightFill(r, c, k) : tint(c, k);
                            trace(r, [[lo, 0], [hi, 0], [hi, 1], [lo, 1]]);
                            ctx.fillStyle = up(rgbOf(FAMILY_COLORS[r.j]));
                            ctx.fill();
                            trace(r, [[0, lo], [1, lo], [1, hi], [0, hi]]);
                            ctx.fillStyle = up(rgbOf(FAMILY_COLORS[r.k]));
                            ctx.fill();
                            trace(r, [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]);
                            ctx.fillStyle = up(MIX[r.j][r.k]);
                            ctx.fill();
                        }
                        if (state.isogloss && grow > 0.02) {
                            // method's isoglosses, and they are not chords in
                            // some arbitrary direction: they are LEVEL LINES of
                            // the height. Jake: "isoglosses are related, they
                            // decorate parallel to the height." The index rises
                            // along v0→v2, so stepping that diagonal and
                            // drawing the chord parallel to v1→v3 draws lines
                            // of constant height — the same direction the
                            // gradient runs, seen the other way.
                            //
                            // Written as the level lines themselves rather
                            // than as method's fixed-length chords. method can
                            // afford those because it clips the tile first and
                            // lets them overrun; the roof draws each tile in
                            // its own fold frame, and Jake's requirement is
                            // the simpler statement anyway: "the parallel
                            // lines must all be within the tile."
                            //
                            // Height is linear, m at v0, m+1 at both middles,
                            // m+2 at v2, so the level a + b = u runs corner to
                            // corner: under u = 1 it cuts the two edges that
                            // meet at v0, over it the two that meet at v2, and
                            // at u = 1 it IS the v1→v3 diagonal, where the two
                            // formulas agree.
                            // At full strength too, and for the same reason:
                            // they are level lines of the height, so fading
                            // them on a seated tile fades the treatment.
                            ctx.strokeStyle = "rgba(60,60,60,0.45)";
                            ctx.lineWidth = r.thick ? 1.1 : 0.8;
                            const LINES = 7;
                            for (let i = 1; i < LINES; i++) {
                                const u = (2 * i) / LINES;
                                const [p, q] = u <= 1
                                    ? [[u, 0], [0, u]]
                                    : [[1, u - 1], [u - 1, 1]];
                                const a = S(world(r, dirs, p[0], p[1]));
                                const b = S(world(r, dirs, q[0], q[1]));
                                ctx.beginPath();
                                ctx.moveTo(a.x, a.y);
                                ctx.lineTo(b.x, b.y);
                                ctx.stroke();
                            }
                        }
                        ctx.globalAlpha = 1;
                        if (grow > 0.02 && state.edgeStyle !== "none") outlines.push({ r, A, k });
                    }

                    // The tile outlines, in ONE pass after every fill.
                    //
                    // Drawn inside the loop they were overdrawn: tiles are
                    // painted far to near, so a nearer tile's body landed on
                    // the edge its neighbor had just stroked and a bold edge
                    // came out thick in some places and thin in others. Jake:
                    // "current heavy edges are sketchy in roof, not
                    // consistently thick, maybe due to placement order." They
                    // are, and this is the order.
                    //
                    // Decoration edges are NOT these: next-rhomb's and kites'
                    // own hairlines belong to the decoration and stay whatever
                    // the edge control says — especially at `none`, where the
                    // tiling loses its outlines and the decoration keeps its.
                    {
                        const bold = state.edgeStyle === "bold";
                        for (const o of outlines) {
                            ctx.globalAlpha = o.A;
                            ctx.strokeStyle = bold
                                ? (shaded
                                    ? `rgba(0,0,0,${(0.55 + 0.35 * o.k).toFixed(3)})`
                                    : "rgba(0,0,0,0.85)")
                                : (shaded
                                    ? `rgba(0,0,0,${(0.10 + 0.18 * o.k).toFixed(3)})`
                                    : "rgba(0,0,0,0.28)");
                            ctx.lineWidth = bold
                                ? Math.max(1.6, Math.min(4, v.scale * 0.03))
                                : 1;
                            trace(o.r, BODY);
                            ctx.stroke();
                        }
                        ctx.globalAlpha = 1;
                    }

                    // The grid lines, still attached. Each tile's band is
                    // already drawn above; what remains is the gap to the next
                    // tile, and that is a quad rather than a stroke.
                    //
                    // A stroke cannot be right: the in-tile band spans `band`
                    // ALONG v_j, so its perpendicular width is band·sinθ — 0.951
                    // on a thick tile, 0.588 on a thin one. No constant width
                    // matches both. Joining the two bands' own corner points
                    // does, exactly, and it collapses to nothing at grow = 1.
                    if (grow > 0.02 && band > 0.001) {
                        const quad = (p: [Vec3, Vec3], q: [Vec3, Vec3]) => {
                            const c = [p[0], p[1], q[1], q[0]].map(S);
                            ctx.beginPath();
                            ctx.moveTo(c[0].x, c[0].y);
                            for (let n = 1; n < 4; n++) ctx.lineTo(c[n].x, c[n].y);
                            ctx.closePath();
                            ctx.fill();
                        };
                        for (const rib of ribbonsOf(model as Pentagrid, rhombs, dirs)) {
                            ctx.fillStyle = FAMILY_COLORS[rib.fam];
                            for (let i = 0; i < rib.nodes.length; i++) {
                                const nd = rib.nodes[i];
                                // Through a stack: entry face to exit face, the
                                // whole way, at every grow — this is the band's
                                // path across the 2k-gon and it does not close
                                // up at grow = 1 the way a gap does.
                                // Only the run THROUGH it is optional. The band
                                // still arrives at the polygon and leaves it on
                                // the far side: a family's zone enters by the
                                // side parallel to that family and leaves by the
                                // opposite one, which is fixed by the outline and
                                // owes nothing to the tiling inside. The gap
                                // quads below carry it there either way.
                                if (i === 0 || grow >= 0.999) continue;
                                const a = nodeSeam(rib.nodes[i - 1], rib.fam, dirs, rib);
                                const b = nodeSeam(nd, rib.fam, dirs, rib);
                                // only seal a seam these two actually share
                                if (Math.hypot(a.exit[0] - b.entry[0], a.exit[1] - b.entry[1]) > 1e-6) continue;
                                quad(nodeBandEdge(rib.nodes[i - 1], rib.fam, dirs, lo, hi, rib, true),
                                     nodeBandEdge(nd, rib.fam, dirs, lo, hi, rib, false));
                            }
                        }
                    }

                    // The crossing itself: the two families mixed. A dot while
                    // the tiles are still points, the center patch once they are not.
                    for (const r of rhombs) {
                        if (grow < 0.04) {
                            ctx.fillStyle = tint(MIX[r.j][r.k], 1);
                            const c = S(world(r, dirs, 0.5, 0.5));
                            ctx.beginPath();
                            ctx.arc(c.x, c.y, 2.5, 0, 2 * Math.PI);
                            ctx.fill();
                        }
                    }
                },
            });
        },
    });
    handle = pentagrid;

    // This page's home. A roof page is a growth state over a pentagrid, so a
    // baseline is both and the two are marked and restored together.
    let baseline: GrowthState = { ...state };
    // A change of attributes redraws, §9.8a. The pentagrid under this one
    // watches its own share of the same element; this takes the growth slice.
    watchAttributes(config.container, () => {
        Object.assign(state, DEFAULTS, readAttributes(config.container).growth);
        handle!.redraw();
    });
    return {
        set: (patch) => { Object.assign(state, patch); handle!.redraw(); },
        get: () => ({ ...state }),
        redraw: () => handle!.redraw(),
        markBaseline: () => {
            baseline = { ...state };
            pentagrid.markBaseline();
        },
        /**
         * The whole page as markup: the pentagrid's share plus this view's own.
         *
         * The pentagrid writes everything but the growth slice — it skips
         * `owner === "growth"` deliberately, because that state is here — so
         * this adds those fields and splices them into the same element.
         */
        embed: (opts) => {
            const base = pentagrid.embed(opts);
            const mine: string[] = [];
            for (const f of FIELDS) {
                if (f.owner !== "growth") continue;
                const here = (state as unknown as Record<string, unknown>)[f.key];
                const home = (baseline as unknown as Record<string, unknown>)[f.key];
                if (here === home) continue;
                const v = format(f, here);
                mine.push(v === "" ? f.attr : `${f.attr}="${v}"`);
            }
            if (!mine.length) return base;
            // Before the closing `>` of the opening tag, which is the first one.
            const cut = base.indexOf(">");
            return `${base.slice(0, cut)} ${mine.join(" ")}${base.slice(cut)}`;
        },
        reset: () => {
            // The pentagrid first: its own reset redraws, and the growth state
            // should be the thing that lands last.
            pentagrid.reset();
            Object.assign(state, baseline);
            handle!.redraw();
        },
        pentagrid,
    };
}
