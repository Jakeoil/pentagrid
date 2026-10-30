# Canvas modules

How the drawing in this project is packaged, how to write another one, and how to
use one from a page — this site's or anybody else's.

## The name, and the two things it means

"Module" is right, and it is right on two different axes. Worth separating them
once, because they get conflated:

| | what it means | example here |
|---|---|---|
| **ES module** | the *distribution* unit — one file with `import` / `export`, loaded natively by the browser | `dist/view/pentagrid.js` |
| **module pattern** | the *code* shape — a function that closes over private state and returns an object of public methods | `createPentagrid(config) → handle` |

They are independent. You can write the module pattern inside a `<script>` tag,
and you can ship a file of loose functions as an ES module. This project does
both at once, which is why one word covers it.

When the two need distinguishing, this project says **canvas module** for the
whole thing: an ES module exporting a factory that mounts a drawing into an
element you give it.

Related names you will see elsewhere for the same shape: *factory function*
(the general term), *revealing module pattern* (the closure-returning-an-API
idiom), *component* or *widget* (the role it plays). No framework is involved —
these are plain functions.

## The shape

```
createThing(config) → handle
```

A canvas module:

1. **Takes a `container` element.** It never looks its own DOM up by id. The page
   decides where it goes and how big it is.
2. **Owns its canvases.** It creates them, sizes them, positions them, and cleans
   up after itself.
3. **Returns a handle of verbs, not state.** `set`, `redraw`, `getView` — not a
   bag of mutable fields. What is inside stays inside.
4. **Needs no stylesheet.** Anything structural — `position: absolute` on a layer
   canvas, `position: relative` on the container — is set inline by the module.
   Classes stay on for pages that want to restyle, but nothing depends on them.
5. **Reads the page for size, or takes it explicitly.** Naming a size pins it;
   saying nothing means the container's own CSS decides and the module follows it.

Point 4 is the one that is easy to get wrong and impossible to notice from
inside this repo, because our own stylesheet is always there. It only shows up
when somebody else imports it.

## Writing one

A minimal module, complete:

```ts
// src/view/spiral.ts
export interface SpiralConfig {
    container: HTMLElement;
    turns?: number;
    color?: string;
}

export interface SpiralHandle {
    set: (patch: { turns?: number; color?: string }) => void;
    redraw: () => void;
    destroy: () => void;
}

export function createSpiral(config: SpiralConfig): SpiralHandle {
    // 1. private state, in the closure
    let turns = config.turns ?? 5;
    let color = config.color ?? "#457b9d";

    // 2. own the canvas, and position it without help from any stylesheet
    const box = config.container;
    if (getComputedStyle(box).position === "static") box.style.position = "relative";
    const rect = box.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width) || 400;
    canvas.height = Math.round(rect.height) || 400;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    box.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // 3. one place that draws
    function redraw() {
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let t = 0; t < turns * 2 * Math.PI; t += 0.05) {
            const r = (t / (turns * 2 * Math.PI)) * Math.min(w, h) * 0.45;
            const x = w / 2 + r * Math.cos(t), y = h / 2 + r * Math.sin(t);
            if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // 4. follow the container, if the page did not name a size
    const ro = new ResizeObserver(() => {
        const r = box.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return;
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
        redraw();
    });
    ro.observe(box);

    redraw();

    // 5. verbs out, state in
    return {
        set: (patch) => {
            if (patch.turns !== undefined) turns = patch.turns;
            if (patch.color !== undefined) color = patch.color;
            redraw();
        },
        redraw,
        destroy: () => { ro.disconnect(); canvas.remove(); },
    };
}
```

That is the whole pattern. `createPentagrid` is the same thing with more inside
it.

### Checklist for a new one

- [ ] Takes `container`; no `getElementById` for its own DOM
- [ ] Positions its own canvases inline — works with the stylesheet deleted
- [ ] Sets `position: relative` on a static container, and leaves a positioned one alone
- [ ] Returns verbs; `get` hands back a **copy**, never the live state
- [ ] Follows the container on resize, unless the page named a size
- [ ] `destroy` disconnects observers and removes what it added
- [ ] Draws correctly at any canvas size, including non-square
- [ ] Testable with no page: construct it, drive it, assert on the handle

## Using one

### From a page in this project

```html
<div id="view" style="width: 100%; height: 70vh"></div>
<script type="module">
  import { createPentagrid } from "./dist/view/pentagrid.js";
  createPentagrid({ container: document.getElementById("view") });
</script>
```

Give the container a size in CSS and say nothing about it in the config — the
module measures it and follows it. To pin a size instead, put `data-width` and
`data-height` on the container and it will not reflow.

### From anybody else's page

The modules are plain ES modules served from GitHub Pages with
`content-type: application/javascript` and `access-control-allow-origin: *`, so a
cross-origin import works with no build step, no bundler and no install:

```html
<div id="view" style="width: 640px; height: 480px"></div>
<script type="module">
  import { createPentagrid }
    from "https://jakeoil.github.io/pentagrid/dist/view/pentagrid.js";

  const grid = createPentagrid({
    container: document.getElementById("view"),
    gamma: [0.23, -0.41, 0.15, 0.31, -0.28],
    features: { penroseTiles: true, penroseEdges: true },
    tileStyle: { color: "curves" },
  });
</script>
```

Or the growing tiling, which is the same idea one layer up:

```html
<script type="module">
  import { createGrowthView }
    from "https://jakeoil.github.io/pentagrid/dist/view/growth.js";

  const roof = createGrowthView({
    container: document.getElementById("view"),
    lift: true,
  });
  roof.set({ grow: 1, fold: 1, azimuth: 0.4 });
</script>
```

Three things to know before relying on that:

- **The container must have a size.** An empty `<div>` is zero pixels tall and
  you will get the 800×800 fallback or nothing.
- **There is no versioning.** Those URLs track `main`, so a change here can change
  a page elsewhere. For anything you care about, copy `dist/` and serve your own
  copy — the files are self-contained and have no runtime dependencies.
- **No stylesheet is required**, but our `site.css` is what makes the pages here
  look the way they do. Borders, radii and the control bar are yours to write.

### TypeScript, or not

Not restricted to TypeScript in any way. TypeScript is this project's build-time
convenience; what ships is plain JavaScript, and a consumer writes plain
JavaScript with no compiler, bundler or package manager involved.

The build does emit `.d.ts` alongside every module, so a TypeScript consumer gets
full types from the same URL:

```ts
import type { PentagridConfig } from "./dist/view/pentagrid.js";
```

### Other ways to distribute

| | what it takes | when |
|---|---|---|
| import the Pages URL | nothing | trying it out, a demo, a blog post |
| copy `dist/` | a file copy | anything that must not change under you |
| npm package | a `package.json` `exports` map and a publish | if other projects start depending on it |
| single-file bundle | a bundler, which this project does not have | a `<script>` tag with no module support |

The first two need no changes here. The third and fourth are not set up, and
neither is needed until somebody asks.

## The modules in this project

| module | factory | what it draws |
|---|---|---|
| `view/pentagrid` | `createPentagrid` | the pentagrid and its dual tiling |
| `view/growth` | `createGrowthView` | the assembling tiling, flat or folded into the roof |
| `view/region-panel` | `createRegionPanel` | a convex region and a draggable point |
| `ui/reticulum` | `createReticulum` | the γ instrument: one axis per family, wheel-driven |
| `ui/sumstrip` | `createSumStrip` | the Σγ strip under the reticulum |
| `ui/floating` | `createFloatingPanel` | a draggable, resizable panel that remembers its place |
| `ui/presets` | `addPresets` | a row of preset buttons for a `GammaSet` |
| `ui/loupe` | `createLoupe` | a pinned magnifier over any canvas view |
| `ui/dials` | `createGammaBank` | a bank of linked sliders, one computed from the rest |
| `view/layers` | `new LayerStack` | the stacked canvases the others are built on; one container, or a container per group |
| `app/narrative` | `createNarrative` | the pages that drive a handle: nav, explanation, build stamp |

`view/controls` is the seam between a page and a module: `mountReticulum` and
`mountFloatingReticulum` put the γ instrument, its presets popup and the folded
slider bank on a page; `mountGammaControls` is the bank alone; `bindSliders` and
`bindToggles` wire ordinary page inputs to a handle.

Anything DOM-free lives under `geometry/` instead and is imported the same way —
`makeDirections`, `collectRhombs`, `classifySingularities`, `findClusters`,
`p1Pentagons`, `rhombArrows` and the rest run in Node as happily as in a browser.

## The layers, and their z-order

Generated by `node tools/layerchart.mjs --write` from the live stack, and a test
fails if this block and the stack disagree — so what is written here is what is
drawn, not what was once intended. Note that `LayerStack` bumps a duplicate z, so
the number here can differ from the one at the `stack.add` call.

<!-- layerchart:begin -->
Front to back. z decides the order; the group is where the switch lives.

| z | id | label | group | switched by |
|---|---|---|---|---|
| 70 | `axes` | Axes | Axes | `axes` |
| 35 | `penrose-vertices` | Vertices | Penrose | `penroseVertices` |
| 34 | `penrose-decor` | Arcs | Penrose | `penroseDecor` |
| 33 | `penrose-pseudo` | Pseudo edges | Penrose | `pseudoEdges` |
| 32 | `penrose-edges` | Edges | Penrose | `penroseEdges` |
| 31 | `big-rhombs` | Big rhombs | Penrose |  |
| 30 | `penrose-tiles` | Tiles | Penrose | `penroseTiles` |
| 29 | `dots` | Dots | Pentagrid | `intersectionDots` |
| 28 | `klabels` | K-labels | Pentagrid | `kLabels` |
| 11 | `ammann-grid` | Ammann | Pentagrid | `ammannGrid` |
| 10 | `grid` | Grid | Pentagrid | family flags |
| 5 | `background` | K-regions | Pentagrid | `kRegions` |

The growth pages add, in the same stack:

| z | id | label | group | switched by |
|---|---|---|---|---|
| 44 | `vertex-index` | Index | Exploration | growth state |
| 43 | `arcs` | Arcs | Exploration | growth state |
| 42 | `solids` | Solids | Exploration | growth state |
| 41 | `resolutions` | 2k-gons | Exploration | growth state |
| 40 | `growth` | Growth | Exploration | growth state |
<!-- layerchart:end -->

## The container's attributes, and the page's query — the canvas API

A canvas reads its settings off the container it is mounted on **and** off the
page's query string. The panel's `settings` writes both back out: **copy setup**
gives the markup that rebuilds the canvas inside a page you are writing, **copy
link** gives the URL that reopens this page as it is now. PLAN §9.8 and §9.4.

    <div id="stage" data-penrose-tiles data-color="bands" data-band="0.5"
         data-penta-face data-penta-shape="innie"></div>

    method.html?penrose-tiles&color=bands&band=0.5&penta-face&penta-shape=innie

<!-- attrdoc:begin -->
Every setting a canvas accepts — as an **attribute** on its container,
and as a **query parameter** on the page. One vocabulary, two spellings:
a parameter may be written with or without the `data-` prefix, since
`?data-color=bands` is the canonical name and `?color=bands` is what
anyone would type. `copy setup` emits the attributes; `copy link` emits
the parameters.

They are read in this order, each outranking the one after:

| | |
|---|---|
| the query string | a link says *show me exactly this*, so it wins |
| the session | where you left this page, if it opted in |
| the container's attributes | the page's own setup, and what `reset page` returns to |
| the page's config, then the defaults | |

A link **suppresses the session** for that load, or a link you shared
would arrive wearing the recipient's last visit. Nothing ever writes the
address bar.

Generated by `tools/attrdoc.mjs` from `src/state/inventory.ts` — the same
list the reader, the writer and the reset read, so this cannot disagree
with what the code does. Regenerate with `node tools/attrdoc.mjs --write`.

A **boolean** follows HTML: present is true, and only `false`, `0`, `off`
or `no` are false. Anything that does not parse is **ignored**, and the
field takes its default — so an older embed meets a newer page without
rotting. An attribute that is absent is a default too, which is why
`copy setup` emits only what differs from the page's own baseline.

**73 fields** in all: 51 booleans, 9 enums, 13 numbers.

### Features — which layers exist

What the page draws at all. Each one switches a layer or a hover.

| attribute / parameter | accepts | default |
|---|---|---|
| `data-grid-lines` | present / `false` | `true` |
| `data-axes` | present / `false` | `false` |
| `data-k-regions` | present / `false` | `false` |
| `data-k-labels` | present / `false` | `false` |
| `data-ammann-grid` | present / `false` | `false` |
| `data-intersection-dots` | present / `false` | `false` |
| `data-penrose-tiles` | present / `false` | `false` |
| `data-penrose-edges` | present / `false` | `false` |
| `data-penrose-vertices` | present / `false` | `false` |
| `data-penrose-decor` | present / `false` | `false` |
| `data-arrows` | present / `false` | `false` |
| `data-pseudo-edges` | present / `false` | `false` |
| `data-center` | present / `false` | `false` |
| `data-hover-region` | present / `false` | `false` |
| `data-hover-segment` | present / `false` | `false` |
| `data-hover-crossing` | present / `false` | `false` |
| `data-hover-vertex` | present / `false` | `false` |
| `data-hover-edge` | present / `false` | `false` |
| `data-hover-face` | present / `false` | `false` |

### Tile style — how the tiles are dressed

The Penrose side's dressings: colors, the decorations, the shading.

| attribute / parameter | accepts | default |
|---|---|---|
| `data-color` | `type` · `pair` · `bands` · `groups` · `kowalewski` | `type` |
| `data-isogloss` | present / `false` | `false` |
| `data-ramp` | a number | `0` |
| `data-opacity` | a number | `1` |
| `data-band` | a number | `0` |
| `data-curves` | present / `false` | `false` |
| `data-penta-face` | present / `false` | `false` |
| `data-penta-edge` | present / `false` | `false` |
| `data-penta-shape` | `penta` · `innie` · `outie` | `penta` |
| `data-penta-overlay` | present / `false` | `true` |
| `data-penta-boundary` | `circle` · `bisector` · `bend18` · `bend36` | `circle` |
| `data-nextgen-face` | present / `false` | `false` |
| `data-nextgen-edge` | present / `false` | `false` |
| `data-kites-face` | present / `false` | `false` |
| `data-kites-edge` | present / `false` | `false` |
| `data-ammann` | present / `false` | `false` |
| `data-next-penta` | present / `false` | `false` |
| `data-p1-shape` | `pentaplex` · `in18` · `out18` | `pentaplex` |
| `data-p1-face` | present / `false` | `false` |
| `data-p1-grid` | present / `false` | `false` |
| `data-big-rhombs-face` | present / `false` | `false` |
| `data-big-rhombs-grid` | present / `false` | `false` |
| `data-face-edges` | present / `false` | `false` |
| `data-afterimage` | present / `false` | `false` |
| `data-bold-edges` | present / `false` | `false` |
| `data-arrow-style` | `plain` · `colored` · `dots` | `plain` |
| `data-vertex-mark` | `dot` · `numbers` · `pool` · `ve` | `dot` |
| `data-off-penrose` | present / `false` | `false` |

### Grid — how the gridlines themselves draw

The reticulum's own lines, not the tiling's. Two knobs that belonged to no owner until PLAN §10.4 gave them one.

| attribute / parameter | accepts | default |
|---|---|---|
| `data-grid-alpha` | a number | `0.6` |
| `data-grid-line-width` | a number | `1` |

### Growth — the roof and grow pages

`roof.html`, `grow.html` and `grow7.html` only. Three names carry a `growth-` prefix because a roof page has a tile style as well, and `data-band` would otherwise be ambiguous.

| attribute / parameter | accepts | default |
|---|---|---|
| `data-grow` | a number | `0` |
| `data-fold` | a number | `0` |
| `data-growth-band` | a number | `0.5` |
| `data-azimuth` | a number | `0` |
| `data-elevation` | a number | `1.5707963267948966` |
| `data-show-resolutions` | present / `false` | `false` |
| `data-p1` | present / `false` | `false` |
| `data-penta` | present / `false` | `false` |
| `data-nextgen` | present / `false` | `false` |
| `data-kites` | present / `false` | `false` |
| `data-growth-off-penrose` | present / `false` | `false` |
| `data-solids` | present / `false` | `false` |
| `data-axis` | a number | `0` |
| `data-direction` | a number | `1` |
| `data-paths` | `high` · `low` · `both` | `both` |
| `data-pick` | a number | `0` |
| `data-pair-ghost` | present / `false` | `false` |
| `data-arcs` | present / `false` | `false` |
| `data-resolve` | present / `false` | `false` |
| `data-index-style` | `none` · `numbers` · `pool` | `none` |
| `data-height` | present / `false` | `false` |
| `data-growth-isogloss` | present / `false` | `false` |
| `data-edge-style` | `none` · `normal` · `bold` | `normal` |
| `data-kowalewski` | present / `false` | `false` |

### The shaped slices

γ, the view and the layer visibility are not flat fields, so they have
their own attributes. γ is written as **integer numerators over a**
**denominator**, which is how `GammaSet` holds it — so an embed
round-trips γ exactly and `provenRegular` decides the same way on the
far side. It is all-or-nothing: numerators without a denominator are
refused rather than guessed, because half a grid is not a grid.

| attribute | what it carries |
|---|---|
| `data-gamma` | the numerators, comma separated: `2000,2000,2000,2000,2000` |
| `data-gamma-den` | their denominator. Required with the above |
| `data-gamma-locked` | which index is held to keep Σγ, or `-1` for none |
| `data-gamma-gen` | the generation m, where λ = φᵐ |
| `data-gamma-symmetry` | the offsets move together |
| `data-gamma-guard` | nudge γ off the singular set |
| `data-gamma-off` | families switched off, by index: `3,4` |
| `data-gamma-lines` | a family held to one line: `1:2` |
| `data-gamma-isolated` | the isolated family, or empty for none |
| `data-scale` | pixels per tiling unit |
| `data-view-x`, `data-view-y` | the pan, in tiling units |
| `data-hide` | layers switched off, by id: `klabels,dots` |

And three that size the canvas rather than style the drawing, read by
`readCanvasSpec` and older than all of the above:

| attribute | what it carries |
|---|---|
| `data-width`, `data-height` | the canvas in pixels. Absent: the element's own size |
| `data-margin` | the gutter the K-labels live in. Absent: 5% of the lesser side |
<!-- attrdoc:end -->

## The rule

**Anything with real drawing in it gets a module.** A page should be a container
element, a config object and some controls. If a page is accumulating rendering
code, that is the signal to pull it out — and the second page that wants the same
picture should be a config change, not a copy.
