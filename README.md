    # Pentagrid

Interactive explorations of de Bruijn's pentagrid method for constructing Penrose
tilings.

**Live:** [jakeoil.github.io/pentagrid](https://jakeoil.github.io/pentagrid/)

## The pages

[`method.html`](https://jakeoil.github.io/pentagrid/method.html) walks through the
dual construction in seven steps:

1. **The Pentagrid** — five families of parallel lines at 72° intervals
2. **Intersections** — pairwise crossings, color-coded by family pair
3. **Pentagrid Regions** — the K-tuples `Kⱼ(x) = ⌈x·vⱼ + γⱼ⌉`, hoverable
4. **Dual Vertices** — the vertex function `f(x) = Σ Kⱼ(x)·vⱼ`
5. **Building Rhombs** — parallelograms from the four regions at a crossing
6. **Penrose Tiling** — the complete dual (thick 72° / thin 36°)
7. **When lines meet** — singularities: what a 2k-gon is, and the three Penrose
   singular states

The other pages are explorations on the same machinery: `grow.html` (the tiling
assembling out of its crossings), `roof.html` (the same, folded into the
Wieringa roof), `grow7.html` (a heptagrid), `multigrid.html` (any n from 4 to 12, chosen on the
page), `sunstar.html` (the sun, the star and
the deca as one family of uniform phase), `split.html` (the grid on one canvas,
its dual on the other, one γ), `wiggle.html`, and the index's linked pair.

### Controls

The **reticulum** is the γ instrument: a decagon with one axis per family, the
offset shown as a signed representative in [−½, ½] and driven by the mouse wheel
(a notch snaps to the next tenth; thousandths with a modifier). It floats, remembers where you put it,
carries a **settings** popup (vertical-axis symmetry: the star turned so v₀
points up — a rotation of the frame, nothing else), two constrained modes —
**symmetric** (every γ the same: Σ is the knob, the γ float, ghosted, each axis
marked at the five settings for Σ's phase — (Σγ + k)/5 — and a notch on any
axis steps among them) and **mirror** (γ_j = γ_{n−j}
about γ₀'s axis, γ₀ floating to hold Σγ = 1: the deca's family) — a generation
row (λ = φᵐ, the spacing, with **deflate** / **inflate**: γ ↦ Mγ and λ ↦ λ/φ,
de Bruijn's deflation on the grid, the finer tiling landing inside the old one
in place) — and the **presets** — the three caps (sun, star, deca) and the singular
catalog (decagon, couple, octagon, 1 thick, 2 thick, 1 thin, 2 thin); choosing
one puts its name on the title bar. The slider bank is still there, folded, for
comparison.

The panel below the canvas is in two halves. The **G** half decides what is
computed: which gridline is isolated, how far past the canvas edge to compute,
the axes, the viewport statistics. The **P** half decides how the dual is
dressed — tile style, shading, edge decorations, and the **ribbons** filter,
which dualizes only the tiles on chosen gridlines. Between them a three-by-three
table pairs each grid object with its Penrose counterpart and the hover helper
that shows the correspondence:

| Pentagrid | K-region | gridline | intersection |
|---|---|---|---|
| Hover | region ↔ vertex | segment ↔ edge | crossing ↔ tile |
| Penrose | vertex | edge | tile |

Pan with mouse drag, zoom with the scroll wheel, double-click to reset. Touch pan
and pinch are supported.

### Three things that are not obvious

**Regularity is decided, not tested.** The construction needs no three lines
concurrent. That has a closed form: triple (a,b,c) is singular exactly when one
particular γ is an integer *and* a particular pair sums to an integer. So if no γⱼ
is an integer, the pentagrid is regular **everywhere** — ten integer comparisons, no
tolerance, no window. γ is held as exact rationals so those comparisons are exact.
The guard holds you off the singular set by default; `allow singularities` in the
settings lets you sit on one deliberately, which is how a phason flip gets watched.
The default γ = 0 is singular, with all five lines through the origin.

**Sub-pixel regions are normal, not exceptional.** A generic γ at default zoom
already has regions of ~0.04 px, because near-concurrent triples equidistribute. The
meter counts how many are too small to aim at. The **loupe** magnifies one
adaptively — 8× or 8000× as needed — opening as you approach it; move into the panel
to hover inside, Esc to dismiss. It is **off by default**: it is a tool for
inspecting near-singular configurations and it gets in the way of simply looking at
the picture. Turn it on under `settings`, or pass `loupe: true`.

**The tiling is 5/2 the size of the grid that makes it.** `f(x) = (5/2)x + const +
bounded wobble`, because `Σ vⱼvⱼᵀ = (5/2)I`. The construction projects ℤ⁵ onto a
plane and each basis vector keeps 2/5 of its squared length there, so the gain is
the reciprocal. The grid is drawn at 5/2 always, so every rhomb lands on the
crossing that generated it and the two pictures share one coordinate system.

## API

The page is a library with one caller. `method.html` loads `dist/method.js`,
which hands `createPentagrid` a container and some config and hands the result to
`createNarrative`; `index.html` loads `dist/app/pair.js`, which does it twice.
There is no bundler, so a new page is an HTML file and an entry point — nothing
else.

| module | holds | DOM |
|---|---|---|
| `geometry/pentagrid` | directions, crossings, K-tuples, dual vertices, rhombs; `segmentAt`, `nearestLine` | no |
| `geometry/gamma` | `createGammaSet` — the offsets, the total, the lock, the guard, the ribbons filter | no |
| `geometry/regularity` | the exact singularity criterion, the small-region scan | no |
| `geometry/hunt` | `classifySingularities`, the preset catalog | no |
| `geometry/resolve` | what a concurrency resolves into: the 2k-gon, its angle code | no |
| `geometry/clusters` | `findClusters` — the rhomb groups; `p1Pentagons` — the P1 tiling on them | no |
| `geometry/region` | the dual map run backwards; `clipToConvex` | no |
| `geometry/decor` | arc geometry; `rhombArrows` — the AR-pattern from the indices | no |
| `geometry/roof` | the Wieringa lift | no |
| `discrete/wheels` | penrose-mosaic's integer substitution, its inverse and half step, the limiting directions (`discrete-directions/`) | no |
| `geometry/acceptance` | the perpendicular plane, convex boundaries | no |
| `view/layers` | `LayerStack` — canvases, z-order, visibility | yes |
| `view/pentagrid` | `createPentagrid` | yes |
| `view/growth` | `createGrowthView` — the assembling tiling, flat or folded | yes |
| `view/region-panel` | `createRegionPanel` — a convex region and a draggable point | yes |
| `view/controls` | `mountReticulum`, `mountFloatingReticulum`, `mountGammaControls`, `bindSliders`, `bindToggles` | yes |
| `app/narrative` | `createNarrative` — the pages that drive a view | yes |
| `app/method-steps` | the seven pages of method.html | yes |
| `ui/reticulum`, `ui/sumstrip` | the γ instrument and its Σ strip | yes |
| `ui/floating` | `createFloatingPanel` — a draggable, resizable, remembered panel | yes |
| `ui/presets` | the preset buttons, for any page that wants a row of them | yes |
| `ui/dials`, `ui/loupe`, `ui/wheel` | the slider bank, the magnifier, the wheel step | yes |

### Two viewports on one pentagrid, locked together

This is `src/app/pair.ts`, which drives the pair on the front page. Give both
instances the same γ and they are the same tiling; relay the view and they move
together.

```ts
import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle, View } from "../view/pentagrid.js";

const gamma = [0.23, -0.41, 0.15, 0.31, -0.28];

let lines: PentagridHandle;
let tiles: PentagridHandle;
const relay = (to: () => PentagridHandle) => (v: View) => to().setView(v);

lines = createPentagrid({
    container: document.getElementById("grid")!,
    gamma,                                       // no controls, no panel: a bare viewport
    features: { gridLines: true, axes: false },
    onViewChange: relay(() => tiles),
});

tiles = createPentagrid({
    container: document.getElementById("tiles")!,
    gamma,
    // gridLines hides the grid. Switching a family off via its layer would also
    // remove the rhombs that family generates, leaving nothing to draw. Tiles
    // and edges both: a tile is only its fill now, and a tiling with no edges
    // is a color field.
    features: { gridLines: false, axes: false, penroseTiles: true, penroseEdges: true },
    onViewChange: relay(() => lines),
});
```

`setView` deliberately does **not** fire `onViewChange`. That is what makes the
relay one hop rather than two instances bouncing updates off each other forever.
`split.html` is not a pair at all: one `createPentagrid` with `containerP`, so
the grid and its dual are one model on two canvases, and a hover on either
side lights its counterpart on the other. `createNarrative` (`app/narrative.ts`) is how `method.html` puts pages in front
of a single handle: each page's `enter` imposes a feature set and exposes the
panel rows that matter to it, and `onFeatureOn` sends a switch flipped on the
panel to the page that is about it.

### Config

| field | meaning |
|---|---|
| `container` | required; where the canvases go, and the source of implicit sizing |
| `containerP` | a second container: the Penrose group draws there, the grid here, the axes in both — one model on two canvases (split) |
| `controls`, `panel` | optional hosts for the meter and the layer panel; omit for a bare viewport |
| `panelP` | with `containerP`: the Penrose rows of the panel go here |
| `features` | starting feature set (see below). A page's `enter` usually imposes its own |
| `tileStyle` | how the tiles are dressed (see below) |
| `gamma` | starting offsets. Omitted means the sun, uniform 1/5 |
| `n` | how many line families. 5 is the pentagrid; 7 gives Lutfalla's heptagrid |
| `layers` | a callback for registering your own layers, before the first draw |
| `onViewChange` | fired on pan or zoom — not by `setView`, so two linked views cannot loop |
| `onOrbit` | right-drag deltas, for a host with a camera; also suppresses the context menu |
| `collectRect` | widen the rect tiles are collected from, for a host that sees more than a flat view |
| `computePad` | how far beyond the canvas to compute, in tiling units. Default 1, the wobble bound |
| `hoverBox` | where the hover readout sits: `"corner"` (default) or `"pointer"` |
| `loupe` | the magnifier that opens on tiny regions. Off by default |

**Features** are the on/off switches a page or the panel flips: `gridLines`,
`axes`, `kRegions`, `kLabels`, `intersectionDots`, `penroseTiles`,
`penroseEdges`, `penroseVertices`, `penroseDecor` (the arcs), `arrows` (the
AR-pattern), `pseudoEdges` (the superposed tiles' edges inside a 2k-gon),
`center` (a ring on the origin), and the
three hover helpers `hoverVertex`, `hoverEdge`, `hoverTile`.

**Tile style** is not a feature set but a dressing: `color` is one of `type`
(thick/thin), `pair` (the two families, blended), `bands` (families2 — the two
families as crossed bands, `band` wide), `groups` (the rhomb groups in sun-star's
colors), `p1` (the pentagon tiling on the groups — the small rhombs), `curves`
(Penrose's matching curves as filled regions) `pentagons` (P1 at the scale
where every thick rhomb holds one whole — the big rhombs) `nextgen` (the
deflation: thick gold, thin gray, at 1/φ — the next generation once the edges
are off) or `kites` (P2 on the rhombs, a dart in every thick); plus `isogloss`, `shading` with its `ramp` (the
Wieringa height ramp, over any color), `boldEdges`, `coloredArrows` (de Bruijn's
solid arrows along the edges, dot to dot, green doubles and red singles, in place
of the chevrons), `vertexMark` (`dot`, the red dot, or `index`, the vertex's
de Bruijn index in a white circle — hover one to see the K-region that made
it), `offPenrose` (dress the tiles at
the extreme index levels off a Penrose patch; the middle ones stay bare), and
`opacity`.

Size comes from `data-width` / `data-height` on the container, or from the
container's laid-out size. **Those two behave differently on resize**: naming a
size pins the box and it stays put, while an implicitly sized view observes its
container and follows it, redrawing as it goes. Only pin a size when the page
really wants that exact number of pixels — a `width: 100%` viewport should say
nothing and let the CSS decide.

The handle:

| member | does |
|---|---|
| `redraw()` | draw everything |
| `setFeatures(f, { merge? })` | impose a feature set — replaces unless `merge` |
| `setGridAlpha(a)` | fade the grid, as the pages do when the tiling takes over |
| `setTileStyle(s)` | change the dressing; merges |
| `exposeRows(labels \| null)` | which panel rows a page shows |
| `panelRow(label)` | a panel row's element, so a page can add a control to it — the reticulum's button goes on View |
| `onFeatureOn(cb)` | a panel switch turned a feature on — a narrative can go to its page |
| `getView()`, `setView(v)` | the pan and zoom, read and driven |
| `setGamma(g)` | set the offsets outright |
| `gamma` | the `GammaSet` itself: values, total, lock, guard, ribbons, generation (λ = φᵐ, `deflate`/`inflate`), `onChange` |
| `stack` | the `LayerStack` |

### Registering a layer

The reason the layer stack is its own module: an exploration adds to it rather
than importing the method page. Anything with a `group` gets a panel toggle
without the panel knowing it exists.

```ts
createPentagrid({
    container: document.getElementById("explore")!,
    features: { gridLines: true },
    layers: ({ stack, currentRhombs }) => {
        stack.add({
            id: "ribbons", label: "Ribbons", z: 40, group: "Exploration",
            draw: ({ ctx, cx, cy }) => {
                for (const r of currentRhombs()) {
                    if (r.j !== 0) continue;      // one family's ribbon
                    // r.x0, r.y0 is the crossing that generated this tile
                }
            },
        });
    },
});
```

`visible` and `opacity` are predicates read at draw time, not flags, so a step
preset changes what is drawn by changing what they see.

### Canvas containers

See **[MODULES.md](MODULES.md)** for the full guide: what the pattern is called,
how to write one, and how to use these from any page including a third party's.

**Anything with real drawing in it gets a container.** A page should be a
container element, a config object and some sliders — not a renderer. The rule
is the same one `createPentagrid` follows: own your canvases, take a config,
hand back a handle.

Two things fall out of it. A second page that wants the same picture is a config
change rather than a copy, and the renderer can be tested with no page in sight.
`grow.html` and `roof.html` are the same 300-line container behind 16 and 19
lines of page.

#### `createGrowthView` — the assembling tiling

Tiles growing out of the crossings that made them, with the grid lines still
fastened to the edge midpoints they pass between. `lift` stands the surface up
into golden rhombi; the flat view is just `fold = 0` with the camera looking
straight down.

```ts
import { createGrowthView } from "../view/growth.js";
import { bindSliders } from "../view/controls.js";

const view = createGrowthView({
    container: document.getElementById("view")!,
    lift: true,            // the Wieringa roof; false for the flat assembly
    orbit: true,           // right-drag to spin and tilt; defaults to `lift`
});

bindSliders(view, [
    { id: "t",    key: "grow", format: (v) => v.toFixed(2) },
    { id: "fold", key: "fold", format: (v) => `${Math.round(v * 100)}%` },
]);

view.set({ grow: 1, band: 0.5 });   // patches state, leaves the rest alone
view.get().fold;                    // a copy, not the live object
view.pentagrid;                     // pan/zoom, γ and the layer stack underneath
```

State is `{ grow, fold, band, azimuth, elevation, boldEdges }`. `bindSliders`
wires range inputs to it and writes the formatted value into `#<id>-value` if that
element exists; `bindToggles` does the same for checkboxes.

**γ controls are a cluster, not markup.** A page that wants the five linked dials
and the total mounts them; it does not build sliders of its own.

```ts
import { mountGammaControls } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

mountGammaControls(view.pentagrid.gamma, document.getElementById("gamma")!,
                   { colors: FAMILY_COLORS });
```

`ui/dials.ts` stays a pure view — it reports which slider moved and renders what
it is told — and `geometry/gamma.ts` stays a DOM-free model. `mountGammaControls`
is the only thing that knows about both.

**The camera is a gesture, not a slider.** Left-drag pans, right-drag spins and
tilts, and the two feel like one control because they are. Underneath,
`createPentagrid` takes an `onOrbit(dx, dy)` callback and suppresses the context
menu when one is given — it has no camera of its own and does not interpret the
numbers.

#### `createRegionPanel` — a region and a point in it

A small canvas showing a convex polygon with a draggable dot. Knows nothing
about pentagrids — a polygon, a point and a callback.

```ts
import { createRegionPanel } from "../view/region-panel.js";

const panel = createRegionPanel({
    container: document.getElementById("panel")!,
    size: 400,
    span: 3.2,                                   // world units across
    onMove: (x, y) => { /* dragged to here */ },
});

panel.setRegion(polygon);      // [[x, y], ...]
panel.setPoint(0.3, -0.2);
panel.inside();                // is the point in the region?
```

The region itself comes from `geometry/acceptance`, which is DOM-free:
`convexBoundary(predicate, from)` traces a convex region by ray casting from a
point known to be inside it, and `polygonArea` measures the result.

### The geometry on its own

`geometry/` has no DOM in it and runs anywhere — that is what the tests use.

```js
import { collectRhombs, computeKTuple, dualVertex, makeDirections }
    from "./dist/geometry/pentagrid.js";
import { singularTriples } from "./dist/geometry/regularity.js";

const grid = {
    n: 5,                                        // 7 for a heptagrid; every geometry call reads it
    directions: makeDirections(true),            // true = v0 points up; makeDirections(true, 7) for n=7
    gamma: [0.23, -0.41, 0.15, 0.31, -0.28],
};

const rhombs = collectRhombs(grid, { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
                             { gain: 2.5 });
rhombs.length;                                   // 737
rhombs.filter((r) => r.thick).length;            // 453
rhombs[0].x0;                                    // the crossing that made it

computeKTuple(grid, 0.4, 0.2);                   // [1, 0, 0, 1, 1]
dualVertex(grid, [1, 0, 0, 1, 1]);               // [1.5388, 0.5]

// γ as exact rationals over a denominator: regularity is then decided, not tested
singularTriples(grid.gamma.map((g) => Math.round(g * 1e4)), 1e4);   // []
```

The `gain: 2.5` is the registration factor — see the third note above. Pass `1`
to work in raw grid coordinates.

## Development

```
npm install
npm run build    # stamp the build id, then compile TypeScript
npm run dev      # tsc watch mode
npm run serve    # static server on :8001
npm test         # every tools/*.test.mjs, plus the spelling and layer-chart guards
npm run check    # pagecheck: import a built page against a stub DOM and fire its handlers
node tools/layerchart.mjs --write   # regenerate the layer chart in MODULES.md
```

`npm run check` exists because typechecking says nothing about whether a page
renders — a throw during module evaluation leaves a blank canvas and an error
only in the console. It stubs the DOM, imports the built page, turns every
checkbox on, walks the pages and fires the hover paths. `PAGECHECK_SIZE=640x480`
runs it at another canvas size; non-square ones catch code that assumed `w === h`.

`npm run build` writes `src/build-id.ts` first; the narrative shows that stamp next to
the page indicator and logs it to the console, so a stale script is obvious at a
glance. Both `dist/` and `src/build-id.ts` are generated and gitignored — CI
regenerates them, since the Pages workflow runs the same build.

Plain `tsc`, no bundler, no runtime dependencies. `dist/` mirrors `src/`, and
each page loads its own entry point.

## Notes

- [`PLAN.md`](PLAN.md) — the working plan: open items, site structure, and the
  explorations. Start here when picking the project back up.
- [`RESEARCH.md`](RESEARCH.md) — the open research question, a pentagrid built on
  the discrete directions rather than 72° ones.
- [`MODULES.md`](MODULES.md) — the canvas-module pattern: writing one, and using
  one from any page.

## References

N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane,"
*Kon. Nederl. Akad. Wetensch. Proc.* **84** (1981).
