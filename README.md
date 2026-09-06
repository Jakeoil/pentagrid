# Pentagrid

Interactive explorations of de Bruijn's pentagrid method for constructing Penrose
tilings.

**Live:** [jakeoil.github.io/pentagrid](https://jakeoil.github.io/pentagrid/)

## The method page

[`method.html`](https://jakeoil.github.io/pentagrid/method.html) walks through the
dual construction in six steps:

1. **The Pentagrid** — five families of parallel lines at 72° intervals
2. **Intersections** — pairwise crossings, color-coded by family pair
3. **Pentagrid Regions** — the K-tuples `Kⱼ(x) = ⌈x·vⱼ + γⱼ⌉`, hoverable
4. **Dual Vertices** — the vertex function `f(x) = Σ Kⱼ(x)·vⱼ`
5. **Building Rhombs** — parallelograms from the four regions at a crossing
6. **Penrose Tiling** — the complete dual (thick 72° / thin 36°)

### Controls

Five γ sliders set the grid offsets, constrained to sum to zero; click any γ label
to choose which one is computed from the others. Pan with mouse drag, zoom with the
scroll wheel, double-click to reset. Touch pan and pinch are supported.

Each grid family can be toggled independently, along with the axes. The toggles are
not only cosmetic — switching a family off also removes the rhombs it generates, so
they answer "what does family *j* contribute?"

Hovering does different work per step. On step 3 it reads the K-tuple at the cursor
— any point, at any region size — and draws an arrow to the dual vertex that region
maps to. On step 4 it snaps to the nearest dual vertex, shows `f = Σ Kⱼ·vⱼ` term by
term, and runs the map *backwards*, clipping half-planes to recover and highlight
the source region.

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
which is twenty lines handing `createPentagrid` a container and some config;
`index.html` loads `dist/app/pair.js`, which does it twice. There is no bundler,
so a new page is an HTML file and an entry point — nothing else.

| module | holds | DOM |
|---|---|---|
| `geometry/pentagrid` | directions, crossings, K-tuples, dual vertices, rhombs | no |
| `geometry/regularity` | the exact criterion, the small-region scan | no |
| `geometry/region` | the dual map run backwards | no |
| `geometry/decor` | arc geometry | no |
| `view/layers` | `LayerStack` — canvases, z-order, visibility | yes |
| `view/growth` | `createGrowthView` — the assembling tiling, flat or folded | yes |
| `view/region-panel` | `createRegionPanel` — a convex region and a draggable point | yes |
| `view/controls` | `bindSliders` | yes |
| `geometry/roof` | the Wieringa lift | no |
| `geometry/acceptance` | the perpendicular plane, convex boundaries | no |
| `view/pentagrid` | `createPentagrid` | yes |
| `ui/dials` | `createGammaBank` | yes |
| `ui/loupe` | `createLoupe` | yes |

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
    gamma,
    steps: [],                                   // no narration, no step nav
    features: { gridLines: true, axes: false },
    onViewChange: relay(() => tiles),
});

tiles = createPentagrid({
    container: document.getElementById("tiles")!,
    gamma,
    steps: [],
    // gridLines hides the grid. Switching a family off via its layer would also
    // remove the rhombs that family generates, leaving nothing to draw.
    features: { gridLines: false, axes: false, penroseTiles: true },
    onViewChange: relay(() => lines),
});
```

`setView` deliberately does **not** fire `onViewChange`. That is what makes the
relay one hop rather than two instances bouncing updates off each other forever.

### Config

| field | meaning |
|---|---|
| `container` | required; where the canvases go, and the source of implicit sizing |
| `controls`, `stepNav`, `panel`, `explanation` | optional; omit for a bare viewport |
| `steps` | narration. `[]` for none |
| `presets` | which features each step turns on |
| `features` | starting feature set, for a page with no steps to impose one |
| `gamma` | starting offsets |
| `loupe` | the magnifier that opens on tiny regions. Off by default |
| `buildId` | a stamp shown beside the step indicator |
| `layers` | a callback for registering your own layers |

Size comes from `data-width` / `data-height` on the container, or from the
container's laid-out size. **Those two behave differently on resize**: naming a
size pins the box and it stays put, while an implicitly sized view observes its
container and follows it, redrawing as it goes. Only pin a size when the page
really wants that exact number of pixels — a `width: 100%` viewport should say
nothing and let the CSS decide.

The handle is `{ redraw, setStep, getView, setView, setGamma, stack }`.

### Registering a layer

The reason the layer stack is its own module: an exploration adds to it rather
than importing the method page. Anything with a `group` gets a panel toggle
without the panel knowing it exists.

```ts
createPentagrid({
    container: document.getElementById("explore")!,
    steps: [],
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
    ribbons: "quads",      // "stroke" is one continuous polyline per grid line —
                           // better flat, but it cannot be depth sorted
});

bindSliders(view, [
    { id: "t",    key: "grow",      format: (v) => v.toFixed(2) },
    { id: "fold", key: "fold",      format: (v) => `${Math.round(v * 100)}%` },
    { id: "az",   key: "azimuth",   format: (v) => `${Math.round(v * 180 / Math.PI)}°` },
]);

view.set({ grow: 1, band: 0.5 });   // patches state, leaves the rest alone
view.get().fold;                    // a copy, not the live object
view.pentagrid;                     // pan/zoom, γ and the layer stack underneath
```

State is `{ grow, fold, band, azimuth, elevation }`. `bindSliders` wires range
inputs to it and writes the formatted value into `#<id>-value` if that element
exists.

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
    directions: makeDirections(true),            // true = v0 points up
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
npm test         # geometry, layers, factory and UI clusters
npm run check    # pagecheck: import a built page against a stub DOM
```

`npm run check` exists because typechecking says nothing about whether a page
renders — a throw during module evaluation leaves a blank canvas and an error
only in the console. It stubs the DOM, imports the built page, turns every
checkbox on, walks the steps and fires the hover paths. `PAGECHECK_SIZE=640x480`
runs it at another canvas size; non-square ones catch code that assumed `w === h`.

`npm run build` writes `src/build-id.ts` first; the page shows that stamp next to
the step indicator and logs it to the console, so a stale script is obvious at a
glance. Both `dist/` and `src/build-id.ts` are generated and gitignored — CI
regenerates them, since the Pages workflow runs the same build.

Plain `tsc`, no bundler, no runtime dependencies. `dist/` mirrors `src/`, and
each page loads its own entry point.

## Notes

- [`PLAN.md`](PLAN.md) — the working plan: open items, site structure, and the
  explorations. Start here when picking the project back up.
- [`RESEARCH.md`](RESEARCH.md) — the open research question, a pentagrid built on
  the discrete directions rather than 72° ones.

## References

N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane,"
*Kon. Nederl. Akad. Wetensch. Proc.* **84** (1981).
