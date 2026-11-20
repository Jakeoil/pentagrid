# Wishlist — what to bring over from penrose-mosaic

Discrete directions is the **version 2 library** (PLAN.md, Rule 2). penrose-mosaic
is the version that works, and it has already answered a great many questions
this library has not been asked yet: color, the overlays, Ammann bars, the tree,
fill and stroke modes, and a sidebar's worth of behavior.

This file is the list of those answers, and nothing more. It is **not a plan**:

- Nothing here is committed, scheduled, or implied. The list is Jake's to set.
- Entries are candidates, including ones that will be declined. Saying no in
  writing is as useful as saying yes.
- Most of these are a **look**, not a proof. That makes them exactly the kind of
  thing to look up rather than rederive, and exactly the kind of thing not to
  invent a second answer for by accident.
- Each entry names where it lives in penrose-mosaic, so the answer can be read
  rather than remembered.

Both sides are plain JavaScript with no build step, which is why this is a
reading list rather than a porting problem. But the geometries differ: the mosaic
has `discrete` and `real` as a *mode*, while here they are two entries in
`PRESETS` and any five ordered points is a third. Anything that depended on there
being exactly two will need rethinking, not transcribing.

---

## 1. Color

| want | where it is | notes |
| --- | --- | --- |
| the six figure colors | `penrose.js` — `Pe5` blue, `Pe3` yellow, `Pe1` orange, `St5`/`St3`/`St1` blue | `tools/render.mjs`'s `FILL` already has all six, matching; no page here knows any of them |
| the color pickers, and reset | `controls/ShapeColors.js`, `#pe5-color`…`#diamond-color`, `#color-reset` | UI, and only if a page wants it |
| `lerp` between two colors | `color.js` | needed by the gradient fill, §3. No imports, on purpose — the easiest thing in the mosaic to take |

**Which child inherits which color is already here, derived rather than
stored** — and that is worth writing down, because it looks like a gap and is
not. penrose-mosaic keeps a `color: [...]` array of five child types on each of
`Pe5`, `Pe3` and `Pe1`. `src/math/patch.js` keeps no such array; `expand()` says

    walk(twist[i] === 0 ? "Pe3" : "Pe1", ...)

and on all three types, in all fifteen slots, the two agree exactly. So the
mosaic's third table is not an independent datum at all: it is `twist`, read
again. The entry here is therefore **a test, not a feature** — nothing pins
that agreement today, and if `twist` ever stops determining the child type for
some asymmetric seed, that is a discovery worth catching rather than a line to
patch.

## 2. Overlays

The mosaic's overlay flags, from `controls/Overlays.js`, drawn in
`penrose-screen.js`:

| want | flag | where it is drawn |
| --- | --- | --- |
| pentas and stars, as outlines | `#penta-ovl` | the ordinary figure draw |
| the mosaic presentation | `#mosaic-penta` | `shape-modes.js` `mosaic`, as square cells rather than outlines |
| **the tree** | `#tree-penta` | `penrose-screen.js` ~488 and ~616 — a line from each parent's center to each child's, black to a penta, red to a diamond, blue to a boat |
| the rhomb overlay | `#rhomb-ovl` | `renderers.js` |
| rhombs at two sizes | `#large-rhomb` / `#small-rhomb` | one generation apart; see `docs/rhomb-groups.md` |
| **Ammann bars** | `#ammann` | `penrose-screen.js` `ammannSegments()` / `ammannTarget()`, ~884–950 |

**The tree is the one to want most.** It draws the recursion that
`src/math/patch.js` already computes — `expand()` knows every parent and every
child — so it is the cheapest overlay here and the most useful while the Star
patch is still broken. A wrong substitution is visible in a tree and invisible in
a finished patch.

**Ammann bars are the one with real content.** They are matching rules made
visible, they cross tile boundaries, and the mosaic's version is built on `PHI`
and the rhomb's own corners. Whether they survive an asymmetric pentagon at all
is an open question, and a good one.

## 3. Styles

From `styles.js` (frozen defaults) and the three style controls:

| want | where it is |
| --- | --- |
| fill and stroke modes: solid, none, gradient, transparent | `styles.js` `MODES`; `controls/PentaStyle.js` |
| the mosaic's border as grid or outline | `styles.js` `DEFAULT_MOSAIC_STYLE`; `controls/MosaicStyle.js` |
| the gradient fill | `renderers.js`, with `color.js`'s `lerp` |
| **isogloss** — contour lines across a rhomb | `renderers.js` `drawIsogloss()`, seven lines perpendicular to the `[0]→[2]` diagonal, weighted so thick and thin balance |
| **the dihedral stroke** | `renderers.js`, and `docs/dihedral-stroke.md` for the plan |
| `pickStyle()`, the fallback chain | `styles.js` — a caller passes nothing and still gets a complete set |

`src/math/patch.js` already has a comment pointing at the dihedral stroke, which
is why `isHeads` is carried on every placement. The mosaic's version is still the
`isHeads` heuristic; `docs/dihedral-stroke.md` plans the edge-hash replacement
and has not been built. **So this is the one entry where the mosaic is not an
oracle but a shared open problem** — and this library, which has an exact edge
wheel, may be the better place to solve it.

## 4. Figures and composites

| want | where it is | state here |
| --- | --- | --- |
| `Pe5` `Pe3` `Pe1` `St5` `St3` `St1` | `penrose.js`, `shape-modes.js` | have all six |
| `Deca` | `penrose-screen.js` `deca()` | have it |
| `Sun` | `penrose-screen.js` | have it, and it is correct |
| `Star` | `penrose-screen.js` | have it and it is **broken** — not yet a subset of `St5`, and it overlaps itself. Tests assert both so a fix cannot pass unnoticed. The mosaic is the oracle for exactly this |
| heads / orientation cycling | `controls/Figure.js` — `#type`, `#isHeads`, `#fifths`, `#isDown` | the pages here step the ladder instead |
| the Sun/Star side-by-side | `controls/SunStar.js`, `#sunstar-a` / `#sunstar-b` | two figures at chosen type, orientation and generation, compared |

## 5. Output

| want | where it is | state here |
| --- | --- | --- |
| canvas | `renderers.js` | have it, per page |
| SVG | `svg-renderer.js` | `tools/render.mjs` writes SVG, but it is a tool and not a renderer — no styles, no overlays, three colors |
| **PDF** | `pdf-renderer.js` | nothing here. Wanted eventually for anything printed |
| a renderer that takes its styles from the caller | `styles.js`'s header says why: `CanvasRenderer` used to read module globals, which made it unusable outside the app | this library has no renderer at all yet, so it can start on the right side of that |

## 6. Behaviors, not drawings

| want | where it is | notes |
| --- | --- | --- |
| fitting the figure to the canvas | `bounds.js` | `src/ui/fit.js` here solves a narrower version of the same problem, and solves it differently |
| the control state surviving a reload | `controls.js` `cookie` | the pages here keep nothing |
| measurement tables | `measurements.js`, `measurements.html` | proportions of each figure, solved by `shape-modes.js`'s `solve()` |
| page navigation | `controls/PageNavigation.js` | |

## 7. Already here, and better — do not bring these

Recorded so they are not mistaken for gaps:

- **Shape mode.** The mosaic switches between `discrete` and `real` as a mode
  (`controls/ShapeMode.js`). Here they are `PRESETS.quadrille` and
  `PRESETS.real`, two entries in a table, and any five ordered points is a third.
  The mode disappears into the data, which is the whole point of the project.
- **Stored wheels.** `wheels.js` there holds tables found by hand.
  `src/math/wheel.js` computes them from five points, at any rung, whole or half,
  up or down, including negative.
- **Whole generations only.** `build` there takes integers and says so.
- **Reflection.** Nothing here reflects anything — the odd tenths are negations
  of the even ones, which is why an asymmetric pentagon tiles at all.

---

*Opened 2026-11-19. Add to it freely; entries do not need to be in any order,
and a declined entry should stay with its reason.*
