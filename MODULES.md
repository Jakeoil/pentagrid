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
    steps: [],
    features: { penroseTiles: true },
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
| `ui/loupe` | `createLoupe` | a pinned magnifier over any canvas view |
| `ui/dials` | `createGammaBank` | a bank of linked sliders, one computed from the rest |
| `view/layers` | `new LayerStack` | the stacked canvases the others are built on |

`view/controls` (`bindSliders`, `bindToggles`) wires page inputs to a handle, and
is the seam between a page and a module.

Anything DOM-free lives under `geometry/` instead and is imported the same way —
`makeDirections`, `collectRhombs`, `singularTriples` and the rest run in Node as
happily as in a browser.

## The rule

**Anything with real drawing in it gets a module.** A page should be a container
element, a config object and some controls. If a page is accumulating rendering
code, that is the signal to pull it out — and the second page that wants the same
picture should be a config change, not a copy.
