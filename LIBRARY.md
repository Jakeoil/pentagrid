# `lib/` — the pentagrid code as a library

Jake, 2026-11-03: *"want to make the pentagrid code and knowledge available to
the wieringa-roof project as a library, and in the future all other projects.
Is any of this code practical to be used in a library so other projects can
import it from github? In particular the pentagrid code and reticulum stuff.
My first target will be the wieringa project. All potentially common code
should go into this library."*

Planned 2026-11-03. Nothing built. `penrose-mosaic/docs/PLANS.md` §"The core as
a library" is the model for how this was assessed — stand up a pretend outside
consumer and measure, rather than reason about the design.

---

## 0. The answer, before the argument

**Yes, and most of it is already library-shaped.** Three measurements, all
taken 2026-11-03 against the built `dist/`:

1. **Every module imports clean in plain node with no DOM and no stub.** All 45
   files under `dist/{geometry,state,svg,ui,view}` — `view/pentagrid.js`
   included — import in **59 ms** and **7.7 MB** of heap. Not one touches the
   document at module scope. That is normally what kills a browser project as a
   library, and it is already not a problem here. (`tools/outsider.test.mjs`
   should pin this; see §8.)
2. **The instruments carry almost nothing with them.** Dependency closures,
   measured over `src/`:

   | module | files it drags in | total lines |
   |---|---|---|
   | `ui/floating` | **0** | 263 |
   | `ui/loupe` | **0** | 192 |
   | `view/layers` | **0** | 263 |
   | `svg/record` | **0** | 373 |
   | `geometry/zono3` | **0** | 223 |
   | `geometry/roof` | 1 (`geometry/types`) | 202 |
   | `geometry/pentagrid` | 1 (`geometry/types`) | 494 |
   | `ui/sumstrip` | 1 (`ui/wheel`) | 352 |
   | `ui/dials` | 1 (`ui/wheel`) | 331 |
   | `ui/reticulum` | 1 (`ui/wheel`) | 597 |
   | `geometry/gamma` | 3 | 1,254 |
   | `view/pentagrid` | **38** | **17,272** |

   The reticulum — the thing Jake named — needs one 97-line helper and nothing
   else. The last row is the application, and §3 says why that is fine.
3. **The duplication is already real and already drifting.** φ is defined
   **eight times** across the three repos (4 in pentagrid, 2 in wieringa-roof,
   2 in penrose-mosaic), the zonohedron-on-generators construction exists
   twice, the Wieringa lift twice, `tools/stamp.mjs` is byte-identical in two
   repos, and `tools/spelling.test.mjs` was copied by hand into a third.
   `wieringa-roof/src/solids.ts` already says the quiet part: *"A third copy of
   a zonohedron construction is how three copies drift apart."* It is now a
   fourth copy, across a repo boundary where no test can see it.

So the question is not whether the code *can* be a library. It is which parts
earn the move, and in what order, given that **wieringa-roof has 20,430 lines
of source and zero tests** while pentagrid has 22,151 and 721.

---

## 1. What is practical — the tiers

Each tier is defined by what it costs a consumer, not by what it is about.

### Tier 1 — the instruments (the thing Jake asked for)

| module | factory | lines | needs |
|---|---|---|---|
| `ui/reticulum` | `createReticulum` | 498 | `ui/wheel` |
| `ui/sumstrip` | `createSumStrip` | 253 | `ui/wheel` |
| `ui/dials` | `createGammaBank` | 232 | `ui/wheel` |
| `ui/wheel` | — | 97 | — |
| `ui/floating` | `createFloatingPanel` | 262 | — |
| `ui/loupe` | `createLoupe` | 191 | — |
| `view/layers` | `LayerStack` | 262 | — |

**1,795 lines in all**, and 97 of them are the shared `ui/wheel`.

Already portable by construction: `MODULES.md` is the contract — take a
container, own your canvases, return verbs, need no stylesheet — and these were
written to it. They are **pure views**: the reticulum reports moves and renders
what it is told, and knows nothing about γ, pentagrids or φ. A consumer with
seven sliders and a constraint can use it unchanged.

**The one real blocker is CSS, and it is small.** The look lives in
`site.css`, which is 722 lines of instrument styling *and* page chrome mixed
together. The instrument share, counted: `.ret-*` 36 lines, `.float-*` 15,
`.ss-*` 14, `.dial`/`.sum-*` 11 — about **76 lines**, and `.loupe` needs none
because the loupe already styles itself inline. So the fix is to ship one CSS
file per instrument and leave the chrome behind; the loupe shows the pattern
for anything that would rather have no file at all.

### Tier 2 — the pure geometry

`geometry/` is **4,617 lines with no DOM anywhere in it**, confirmed by import
rather than by inspection. Candidates, in rough order of how likely a second
project wants them:

| module | lines | what it is | second consumer |
|---|---|---|---|
| `geometry/types` | 110 | `Vec2`, `Rhomb`, `Pentagrid`, `ViewRect` | everything |
| `geometry/roof` | 90 | the Wieringa lift, heights, face normals | **wieringa has its own copy** |
| `geometry/zono3` | 222 | zonohedra on 3D generators, cell kinds | **wieringa has its own copy** |
| `geometry/zonohedron` | 474 | zonogons, the 2D side | wieringa's `dissect` |
| `geometry/pentagrid` | 382 | `makeDirections`, `collectRhombs` | any multigrid |
| `geometry/gamma` | 594 | `GammaSet`: exact rationals, guard, deflation | — (see §4) |
| `geometry/clusters` | 202 | P1 clusters: pentagon, star, boat, diamond | wieringa's seeds |
| `geometry/vertexenv` | 239 | the 16 vertex environments, the census | — |
| `geometry/decor`, `walls`, `resolve`, `cascade`, `acceptance`, `region`, `hunt`, `ammann`, `regularity` | 2,100 | the rest of the pentagrid's mathematics | — |

### Tier 3 — the SVG recorder

`svg/record` (373 lines, **zero dependencies**) is a `CanvasRenderingContext2D`
shim that emits SVG, so any canvas drawing becomes paper with no second
renderer. `svg/export` adds the layer-stack pass (838 lines with `view/layers`),
`svg/download` the browser save.

Honest note: **wieringa-roof does not need this.** Its `sheet.ts` already emits
SVG strings directly and is shared between the browser and
`tools/bfs-unfold.mjs`, which is a different and equally good answer for a
project whose output is paper first. This tier is for the *next* project that
draws to canvas and then wants a PDF — so it earns an entry point, but it is not a
reason to start.

### Tier 4 — the harness, which is the "knowledge" half

| file | lines | what it buys |
|---|---|---|
| `tools/domstub.mjs` | 200 | construct any page in node: DOM, 2d context, recorded handlers |
| `tools/pagecheck.mjs` | 61 | import every page module against the stub and report what throws |
| `tools/spelling.test.mjs` | 73 | American spellings, enforced rather than noted |
| `tools/stamp.mjs` | 8 | `build id HH:MM:SS` on the page and in the console |
| `tools/layerchart.mjs`, `attrdoc.mjs` | 217 | generate documentation from the code, and fail when they disagree |

This is the tier with the largest ratio of value to risk, because
**wieringa-roof has no tests at all** and the first four are 342 lines that
work the day they land. It is also the tier that is *already* being copied by hand between
repos, which is the definition of library material. It ships as node tooling,
not as browser modules — a separate entry point (§6).

### Tier 5 — the state engine

`state/{store,session,query,attributes,embed,baseline,slot}` — 743 lines that
read a setting off the container, the query string and the session with a
documented precedence, parse booleans the way HTML does, ignore what does not
parse, and write back `copy setup` / `copy link`. The *engine* is general; the
*vocabulary* is not — `state/inventory.ts` lists 73 pentagrid fields. So the
kit takes the engine and each project supplies its own inventory. See §4: this
is the tier where wieringa has something pentagrid lacks.

---

## 1a. The four Jake named, and what each costs — MEASURED 2026-11-04

Jake, 2026-11-04: *"Another thing I would like to expose is the UI, especially
the reticulum UI and the mathematics used to generate the pentagrid, and the
dualization mathematics, and some of the UI, in the process of being organized
which dresses up the vertices, edges, faces and groups (mostly Penrose context
sensitive stuff). And the grow logic will be very important for wieringa too."*

Four asks, and they are **not** the same size. Two are facade work and nothing
else; one is fifty lines of extraction; one is the largest refactor in the
repo. Taking them in that order is what keeps the plan honest.

### 1. The reticulum UI — nothing to extract

Stage 0 already. `createReticulum` + `createSumStrip` + `createGammaBank` +
`ui/wheel`, 1,180 lines, and the closure stops there: the reticulum reports
moves and renders what it is told, and knows nothing about γ, pentagrids or φ.

### 2. The pentagrid, and the dualization — nothing to extract

| module | lines | closure | what it carries |
|---|---|---|---|
| `geometry/types` | 110 | 1 | `Vec2`, `Rhomb`, `Pentagrid`, `LineSet` |
| `geometry/pentagrid` | 382 | 2 | `makeDirections`, the K functions, `collectRhombs` |
| `geometry/gamma` | 594 | 4 | `GammaSet`: exact rationals, the guard, deflation |
| `geometry/regularity` | 164 | 1 | singular triples, decided on integers |

This **is** the dualization: `Kⱼ(x) = ⌈x·vⱼ + γⱼ⌉` and `f = Σ Kⱼ vⱼ`, with
`collectRhombs` walking the crossings and emitting rhombs with their `(j, k)`,
their K-tuples and their corner levels. All pure, all already imported in node
by 721 tests. A facade entry and a `.d.ts`, and it is exposed.

### 3. The dressing — two halves, and only one of them is hard

**The mathematics is already library-shaped.** Everything context-sensitive
about the Penrose side is pure, in its own module, with a closure of one or two
files:

| module | lines | closure | dresses |
|---|---|---|---|
| `geometry/decor` | 365 | 2 | the arcs — the two loop families |
| `geometry/ammann` | 438 | 3 | the Ammann bars, and the cut behind each family |
| `geometry/clusters` | 202 | 3 | the groups: Pe5, Pe3, Pe1, St5, St3, St1 |
| `geometry/vertexenv` | 239 | 2 | the 16 vertex environments, and the census |
| `geometry/walls` | 385 | 4 | the pentaplex, the 18° innie and outie |
| `geometry/resolve` | 206 | 3 | what a singular vertex resolves into |
| `view/pool` | 70 | **0** | the index mark: the disc, and the pool balls |

**The UI is not.** The dressing panel is `view/pentagrid.ts` lines 4241–5489 —
**1,248 lines inside `createPentagrid`'s closure** — and the drawing it
switches is another ~1,800 (lines 2111–3948). Both read the closure's private
state. That is the largest extraction in this plan, and it is the one Jake
describes as *"in the process of being organized"* — the folded dressing rows,
`rowWhen` / `exposedRows`, `panelSyncs` all landed in the last fortnight. **So
it goes last** (§7, Stage 5): extracting a panel that is still changing shape
means doing the work twice and pinning the wrong surface.

There is an honest answer in the meantime that needs no refactor at all: **the
dressing vocabulary is already a public API.** `state/inventory.ts`'s 73
fields, documented in `MODULES.md`, reach every treatment through
`data-*` attributes, the query string and `setTileStyle` — so a consumer can
drive the whole dressing today without the panel, and `copy setup` writes the
markup for them. What the panel adds is the *controls*, not the capability.

### 4. The grow logic — fifty lines, and the best value in the plan

The surprise. `view/growth.ts` is 1,973 lines and drags the entire 39-file
knot, because `createGrowthView` builds a pentagrid underneath itself — so by
the §0 measurements it looked unreachable. It is not. **The grow and fold
mathematics is one 25-line function**, `world()` at line 404:

```ts
// the registration gain, so a tile at grow = 0 sits on the crossing that
// made it: n/2 because Sum_j v_j v_j^T = (n/2) I
const gain = dirs.length / 2;
const x = (1 - grow) * gain * r.x0 + grow * cx
        + grow * ((a - 0.5) * vj[0] + (b - 0.5) * vk[0]);
...
return [x, y, fold * grow * RISE * (m + a + b)];
```

A tile's corner at `(grow, fold)`, lerped from the crossing that made it to
where it belongs, standing to `RISE·(index + a + b)` as the roof rises. Beside
it, `projectToScreen` (17 lines) is **already a top-level export**, and its
comment says why: *"the same world-to-screen mapping the renderer uses, exposed
so it can be checked without a canvas."* The extraction pattern already exists
in the file; this just finishes it.

So the grow core is `world()` + `projectToScreen` + `geometry/roof.ts`'s lift
— call it 150 lines of pure function in a new `geometry/growth.ts`, with
`grow`/`fold`/`seat` as arguments instead of closure reads, and the view
calling it. Nothing about the view changes except where the formula lives.

**What wieringa-roof gains, specifically.** It has the lift (`computeLift`,
`pos3D`) and a three.js camera, so not those. It has no **partial** fold and no
grow at all: a net that rises from flat to roof at `fold = t`, or a patch that
assembles from its own crossings, is capability it cannot currently draw — and
`unfold.ts` / `cutaway.ts` are exactly the pages that would want to show a
crease opening by degrees. This is the one ask where the answer is *new page*,
not *less duplication*.

## 2. What `lib/` does **not** expose

- **`view/pentagrid` and `view/controls`** — one mutually recursive knot of 39
  files and 17,272 lines, with `state/inventory`'s 73-field vocabulary baked
  in. It is the application, not a library, and trying to make it one would be
  the whole refactor with none of the benefit.
- **`view/growth`** — the view, for the same reason: it builds a pentagrid
  underneath itself, so its closure *is* the knot. Its mathematics is a
  different matter — §1a.4.
- **`app/*`, `bootstrap/*`, `discrete/*`, `method.ts`** — pages.
- **`site.css` beyond the 76 instrument lines** — the look belongs to each
  project. Jake's standing rule on penrose-mosaic ("don't change the look")
  applies in the other direction here: an import must not arrive carrying a
  look.

This costs nothing, because whole-widget use **already works today** with no
library at all. `MODULES.md` documents the cross-origin import, and Pages
serves `dist/` as `application/javascript` with `access-control-allow-origin:
*`:

```js
import { createPentagrid }
  from "https://jakeoil.github.io/pentagrid/dist/view/pentagrid.js";
```

So there are two distribution stories and they do not compete: **`lib/`** for
pieces another project builds with, and **the Pages URL** for dropping a whole
canvas into a page. Only the first needs versioning, which is §6.

---

## 3. The duplication inventory — MEASURED

What exists twice today, and which copy should win.

| concept | pentagrid | wieringa-roof | notes |
|---|---|---|---|
| φ | `PHI` in 4 files | `PHI` in 2 files | +2 in penrose-mosaic. Eight definitions of one number |
| 3D vector ops | private in `zono3` | exported from `solids` | wieringa's are the better API (exported, named) |
| icosahedral axes | `ICO_AXES` | `ICOSA_AXES` | same six vectors, two spellings |
| zonohedron on generators | `zono3.zonohedron` → rich object | `solids.zonohedron` → `Face[]` | pentagrid's carries masks, cells, volumes; wieringa's is what a renderer wants. `lib/` needs both faces of one function |
| the Wieringa lift | `geometry/roof` (`generator`, `liftLocal`, `faceNormal`) | `geometry.ts` (`E5`, `pos3D`, `computeLift`, `getLift`) | **independently derived and already agreed numerically** — `roof.ts`'s header says so. The safest possible first merge |
| index → color | `view/pool` (`POOL`, pool balls) | `INDEX_COLORS`, `indexColor` | different palettes on purpose. expose the *mechanism*, each project keeps its colors |
| golden rhombus constants | `ROOF_EDGE = √5/2` | `GOLDEN_SIDE = √5/2` | same number, two names, two meanings documented |
| durable settings | `state/store` (guarded three ways) | `src/prefs.ts` (build-id invalidation) | **each has what the other lacks** — see §4 |
| build stamp | `tools/stamp.mjs` | `tools/stamp.mjs` | byte-identical |
| page check | `tools/pagecheck.mjs` + `domstub` | `tools/pagecheck.mjs` | same name, same purpose, different code; pentagrid's imports the page, wieringa's reads it as text. Both checks are worth having — merge, do not pick |
| spelling test | `tools/spelling.test.mjs` | — | copied by hand into penrose-mosaic 2026-10-21 |

---

## 4. What flows the other way

This is not an export from pentagrid. Three things flow the other way, and
saying so now is what keeps this from being a one-way export.

- **`prefs.ts`'s build-id invalidation.** Settings saved by any other build are
  dropped whole, because field-by-field validation catches a value that changed
  type but not one whose *meaning* moved. pentagrid's `store`/`session` has the
  better guards (the accessor itself can throw; quota; private windows) and
  none of this. Both halves belong in one module.
- **`sheet.ts`'s paper model** — `PAGES`, `MM_PER_IN`, margins, the layout that
  is pure enough to run in a node tool. pentagrid has no paper at all, and
  PLAN §5.99 stops at SVG.
- **`palettes.yaml` → `src/palettes.ts`, generated.** pentagrid's PLAN §10
  ("Page defaults as data, and palettes") is **TABLED and unbuilt** — and
  wieringa already solved it, with a build step that compiles a YAML palette
  file into typed TS. Importing it from there retires a tabled section
  instead of writing it twice.

**And a non-goal, settled on wieringa's side.** `NOTES.md` §"Settled: no de
Bruijn generator" — the tilings with exact five-fold symmetry are the
*singular* pentagrids, so a generic γ recipe cannot produce Sun or Star, and
the Queen is not a pentagrid tiling at all. So `geometry/gamma` and
`geometry/pentagrid` get an entry point for the next consumer, **not** because
wieringa wants them. Nothing in this plan proposes pointing wieringa's seeds at
a pentagrid.

---

## 5. The home — `lib/` in this repo, no new repository

**Settled by Jake, 2026-11-03:** *"No new repo."* The shape is penrose-mosaic's,
pointed at this repo:

> Expose the pentagrid construction code as browser-compatible ES modules under
> `lib/`, without changing the application behavior — importable both by sibling
> projects locally and from this repo's GitHub Pages URL. Eventually move or
> expose it as a public module under `lib/`, and add tests that capture its
> current behavior before refactoring it.

```js
// local development, from a sibling project
import { createReticulum } from "../pentagrid/lib/reticulum.js";

// or from the published repo
import { createReticulum }
  from "https://jakeoil.github.io/pentagrid/lib/reticulum.js";
```

An earlier draft of this section argued for a separate repository on the grounds
that a shared kit has to take code *from* wieringa-roof too (§4) and cannot do that
from inside one of its consumers. That objection is real and it has a cheaper
answer than a new repo: **every project grows its own `lib/`.** penrose-mosaic
is already planning `lib/penrose-mosaic.js`; this is the same move here; and if
pentagrid eventually wants wieringa's paper model or its palette compiler, then
wieringa grows a `lib/` of its own and pentagrid imports it. Peer facades, no
center.

One rule keeps that from turning into a knot:

> **A `lib/` facade re-exports only its own repo's code.** Never another
> project's `lib/`.

With that, no cycle can form inside a module graph — two projects may import
each other's facades from their own pages without either facade depending on
the other.

### What `lib/` is, exactly

`lib/` is **committed, hand-written, plain JavaScript**: one small file per
entry point, each re-exporting from the built `dist/`.

```js
// lib/reticulum.js — the whole file
export { createReticulum, signedGamma, lighten } from "../dist/ui/reticulum.js";
export { createSumStrip } from "../dist/ui/sumstrip.js";
export { createGammaBank } from "../dist/ui/dials.js";
export { wheelNotch, snapStep, snapStepWith, makeNotchGate, isFine }
    from "../dist/ui/wheel.js";
```

Three reasons it is a facade of its own files rather than "just import `dist/`,
which already works":

- **It pins the public surface.** `dist/` is 69 modules of internal layout that
  has moved four times this month and will move again. A consumer that imports
  `dist/ui/reticulum.js` is depending on where the file sits; one that imports
  `lib/reticulum.js` is depending on a name this repo promises to keep.
- **It is where defaults and conveniences live**, so the primitives stay honest
  — penrose-mosaic's plan makes the same split and for the same reason
  (`scene.overlays` is a required input that throws; its facade supplies one).
  Here the obvious candidates are a `mountReticulum`-shaped helper that does
  not drag in `view/controls`'s 39-file closure, and the CSS link (below).
- **TypeScript consumers get types from the same path.** A sibling
  `lib/reticulum.d.ts` re-exporting the generated declarations means
  `import ... from "../pentagrid/lib/reticulum.js"` type-checks in wieringa's
  `tsc` with no `paths` mapping.

### Why not TypeScript under `src/lib/`

Because `tsc` would emit it to `dist/lib/`, and the published path has to be
`/pentagrid/lib/...`. Moving `outDir` to `lib/` instead would rename every
module in the project, every `<script src>` and every test import. The facade
files are one to five lines each; writing them by hand is cheaper than either,
and §7's surface test is what keeps them honest.

---

## 6. Delivery — the three import styles, and which actually work

### MEASURED, 2026-11-03: `dist/` is not in the repository

`.gitignore` lists `dist/`, and `.github/workflows/deploy.yml` runs
`npm install && npm run build` on every push to main, then publishes the repo
root as the Pages artifact. So **the built modules exist on the website and in
your working tree, and nowhere else.** That single fact decides this section.

| import style | works? | why |
|---|---|---|
| `https://jakeoil.github.io/pentagrid/lib/x.js` | **yes** | the Action builds `dist/` before publishing, and `lib/` is committed beside it |
| `../pentagrid/lib/x.js`, sibling project, local | **yes**, with one server | needs `dist/` built locally (it is) and one HTTP root above both repos — see below |
| `npm i github:Jakeoil/pentagrid` | **no** | a git dependency clones the *tree*, which has no `dist/`. `prepare` could run `tsc`, which means devDependencies and a network on install |
| `cdn.jsdelivr.net/gh/Jakeoil/pentagrid@v1.0.0/lib/x.js` | **no, and this is the one worth wanting** | jsDelivr serves the git tree too, so it would fetch a facade pointing at a `dist/` that is not there |

The last row is the only real loss, and it is the versioning story: a Pages URL
tracks `main`, so a change here can change a page elsewhere. The answer, when
it is wanted, is a **release branch** — have `deploy.yml` also push the built
`dist/` plus `lib/` to a `release` branch, which jsDelivr can then serve at a
tag. That keeps build output out of `main`'s history, where Jake deliberately
put it, and it is a change to one workflow file rather than to the habit. Not
now; written down so the choice is not re-litigated.

### Two details that will bite

- **The `.js` extension is required.** Pages will not serve
  `/pentagrid/lib/reticulum` — there is no extensionless rewrite, so it 404s.
  Jake's sketch dropped it on the published form; the published form needs it.
- **Local sibling imports need one server, not two.** Each project serves its
  own root today (`python3 -m http.server 8001` here), and
  `SimpleHTTPRequestHandler` sanitizes `..` out of the URL, so a page served
  from `wieringa-roof/` can never reach `../pentagrid/`. Three ways round it,
  cheapest first:
  1. **Serve `math-legacy/` instead of a project root** — one server for every
     project at once. `wieringa-roof/tools/serve.py` already serves its own
     working directory and sends `no-store`, so this is `python3
     wieringa-roof/tools/serve.py 8000` run one level up, and nothing to
     write. Pages then differ from local only in the leading path segment.
  2. **A symlink under the consumer's `vendor/`** —
     `wieringa-roof/vendor/pentagrid -> ../../pentagrid`. `vendor/` is already
     gitignored there (it is how three.js arrives), and the server follows
     symlinks.
  3. **Copy `lib/` and `dist/`** — for anything that must not move under you,
     which is `MODULES.md`'s standing advice already.

  Worth settling early, because it decides whether a sibling page's import path
  is the same string locally and published. Option 1 makes it
  `../pentagrid/lib/x.js` both ways, which is why it is first.

### CSS

An instrument's structure is inline (`MODULES.md` point 4), but its look is in
`site.css`. So each instrument entry gets a stylesheet beside it —
`lib/css/reticulum.css`, 36 lines carved out of `site.css` — and `site.css`
`@import`s them back so this project's pages are byte-identical in appearance.
A consumer links what it uses. The loupe needs none, which is the example to
follow where a new instrument can manage it.

---

## 7. The stages

Reordered for the in-repo facade. Nothing here moves a file out of this
repository, so every stage is additive and reversible — which is the main
practical win over the separate-repo plan.

### Stage 0 — `lib/reticulum.js` and the surface test

The facade for the thing Jake named, plus the test that makes a facade
meaningful.

**The surface test** is this repo's version of *"tests that capture its current
behavior before refactoring."* 721 tests already pin the behavior; what nothing
pins is the **public surface**. So: a golden list of every name each `lib/`
entry exports, with its type, asserted by importing the facade — the same shape
as `layerchart.test.mjs` asserting the docs match the stack. Adding an export
is a one-line edit to the golden file; removing or renaming one fails loudly,
which is exactly the signal a consumer needs and the only thing a facade is
*for*.

Then `lib/css/reticulum.css`, and `lib/reticulum.d.ts` so wieringa's `tsc`
sees the types.

**Done when:** a scratch HTML page in this repo drives `createReticulum` through
`lib/reticulum.js` with no other import, the surface test passes, and the same
page works from the Pages URL after a push.

### Stage 1 — the first real consumer

One wieringa-roof page imports one entry. The honest first candidate is **not**
the reticulum — wieringa has no γ — but `lib/panel.js`
(`createFloatingPanel`, `createLoupe`, `LayerStack`): a loupe over `nets.html`
or a floating panel around an existing control bar is new capability with no
mathematics to agree about. Decide the serving question (§6) here, in practice.

**Done when:** that page works locally and published, and `npm run build` in
wieringa-roof type-checks against `lib/*.d.ts`.

### Stage 2 — the geometry entries, and the duplicate merges

`lib/roof.js` (the lift), `lib/zono.js`, `lib/tiling.js`, `lib/gamma.js`. Then
the §3 merges, **one per commit, each deleting the losing copy in the same
change**: φ, the 3D vector ops, the icosahedral axes, the zonohedron
constructor, the lift.

The lift goes first for the reason the earlier draft gave: the two projects
derived it independently and the numbers already agree, documented in
`roof.ts`'s header — so a disagreement can only be a pipeline bug, never a
mathematics bug.

**Done when:** φ is defined once in each repo rather than four and two times,
there is one zonohedron constructor, and both projects' pages render unchanged.

### Stage 2b — the grow core

`geometry/growth.ts`: `world()` and `projectToScreen` lifted out of
`createGrowthView`'s closure as pure functions taking `{grow, fold}` and an
optional seat, with the view calling them (§1a.4). Then `lib/grow.js`, with the
lift beside it.

Small, and the highest value per line in the plan: it is the one entry
wieringa-roof cannot approximate with what it already has, and the one that
opens a page rather than deleting a duplicate.

**Done when:** `roof.html`, `grow.html` and `grow7.html` draw exactly what they
draw today — a golden test over `world()` at a few `(grow, fold)` pairs,
written *before* the move, is what says so — and one wieringa page shows a
crease opening by degrees.

### Stage 3 — the harness, which the facade cannot deliver

`tools/domstub.mjs`, `pagecheck.mjs`, `spelling.test.mjs`, `stamp.mjs` are node
tooling: no browser, so no ES-module URL helps. The options are to **copy**
them (which is what has happened twice already) or to let the consumer take a
git dependency on this repo for `tools/` alone, which works because `tools/` is
committed — `"pentagrid": "github:Jakeoil/pentagrid#<sha>"` with nothing
imported from `dist/`.

Worth doing early despite being last in this list: **wieringa-roof has 20,430
lines of source and no tests**, and these four are 342 lines that work the day
they land. Jake's call whether it goes before Stage 2.

**Done when:** `npm test` exists in wieringa-roof and passes, with a pagecheck
over its 14 pages.

### Stage 4 — the rest, as it is wanted

`lib/svg.js`, `lib/state.js`, `lib/pentagrid.js` (the whole canvas, under a
promised name rather than `dist/view/pentagrid.js`). Pull each when a second
page wants it, not before — a facade entry with one consumer is a guess, and
§4's traffic in the other direction (wieringa's `prefs.ts`, `sheet.ts`,
`palettes.yaml`) waits for the same signal from the other side.

---

### Stage 5 — the dressing panel, once the reorganization settles

Last, deliberately. 1,248 lines of panel and ~1,800 of drawing inside
`createPentagrid`'s closure (§1a.3), and the panel is *currently being
reorganized* — the dressing folds, the row-visibility map and the panel syncs
all landed within the last fortnight. Extracting a surface that is still moving
means pinning the wrong one.

The shape it wants, when it is time: `createDressingPanel({ get, set })` —
a panel over a tile-style getter and setter rather than over a closure, which
is the same seam `setTileStyle` and the 73 attribute fields already describe.
The drawing follows the same way: a `drawDressings(ctx, rhombs, style)` that
reads a style object instead of a closure, which is most of what the layer
callbacks already do.

Until then the dressing is reachable anyway, through the attributes and the
query (§1a.3). That is the argument for patience: nothing is blocked by
waiting.

**Done when:** `method.html` and `split.html` are visually identical, Jake
having looked, and a second page drives the panel with no pentagrid behind it.

---

## 8. Rules, risks, and the one thing that must not happen

- **The application does not change.** Every stage is additive: a new `lib/`
  file, a new CSS file, a new test. `site.css` keeps its appearance by
  `@import`ing what was carved out of it. If a stage needs `src/` to change
  shape, that is a separate change with its own reason.
- **No visual change, ever, as a side effect.** `lib/` carries structure and
  behavior; the look stays with the consumer. Jake checks before any stage
  that touches a page.
- **One copy or none.** A merge from §3 is not done while two copies exist
  "for now" — the commit that adds the import deletes the loser.
- **A facade re-exports only this repo's code.** Never another project's
  `lib/`. That is what keeps peer facades (§5) from becoming a cycle.
- **The surface is the promise, the layout is not.** Names in `lib/` keep
  working; `src/` and `dist/` stay free to move. The surface test is what makes
  that a fact rather than an intention.
- **A consumer that must not move copies `lib/` and `dist/`.** Pages tracks
  `main`, so until there is a release branch (§6) the published URL is for
  demos, pages under Jake's own hand, and anything he is willing to re-fix.
- **The risk worth naming:** a shared module puts a bug in two projects at
  once, and wieringa-roof has no tests to notice. That is why the §3 merges
  start with the lift, where the two projects already agree numerically, and
  why the harness (Stage 3) is a candidate to jump the queue.

## 9. Open, for Jake

1. **Where the local import points** — one server over `math-legacy/`, a
   symlink under the consumer's `vendor/`, or a copy (§6). Decides whether a
   sibling page's import string is the same locally and published.
2. **Entry-point granularity.** `lib/reticulum.js` carrying the strip and the
   bank with it, as sketched — or one file per instrument and a
   `lib/pentagrid-ui.js` that re-exports them all? Fewer files is friendlier to
   a consumer; one-per-instrument makes a page's imports say what it actually
   uses.
3. **Whether the harness (Stage 3) jumps the queue.** It is the largest value
   for the least risk and it is the only stage that touches nothing visual.
4. **Versioning, eventually.** The release branch in §6, or the standing advice
   to copy `dist/` for anything that must not move.
5. **Whether the grow core (Stage 2b) comes before the geometry merges.** It is
   the ask with no duplicate to delete and a new wieringa page at the end of
   it, which is a better first demonstration than deleting a second φ.
