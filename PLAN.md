# Pentagrid — Plan

What this project is, what is open, and the record of what was found while
building it. Research questions with real mathematical content live in
[RESEARCH.md](RESEARCH.md); how to write and use a canvas module is in
[MODULES.md](MODULES.md); the public surface is in [README.md](README.md).

Sections 1–4 are live and are rewritten when they go stale. Section 5 is the
record: dated findings, newest first, kept as written except where a later
result overturned them — those carry a marked correction rather than a silent
edit. Section 6 is what has been thought about and not built.

1. [Orientation](#1-orientation)
2. [Pages](#2-pages)
3. [Open items](#3-open-items)
4. [Standing rules](#4-standing-rules)
5. [The record](#5-the-record)
6. [Not built](#6-not-built)

---

## 1. Orientation

State of play, 2026-09-17.

- **Shape.** Plain `tsc` to `dist/`, no bundler, no runtime dependencies. DOM-free
  mathematics in `src/geometry/` (~2000 lines), the canvas modules in `src/view/`
  (`pentagrid.ts` is 3000 of them), the γ instrument and panels in `src/ui/`, one
  entry point per page in `src/app/`. `.github/workflows/deploy.yml` builds and
  publishes the repo root to Pages, so a new top-level `.html` is live on push.
  `npm run build` stamps `src/build-id.ts` first and the narrative shows it beside
  the page indicator; both `dist/` and the stamp are generated and gitignored.
- **One factory.** `createPentagrid(config)` owns a `LayerStack` of canvases —
  front to back: axes 70; Penrose vertices 34, arcs 33, pseudo edges 32, edges 31,
  tiles 30; dots 29, K-labels 28, grid 10, K-regions 5 — plus the growth pages'
  2k-gons 41 and growth 40. The chart in MODULES.md is generated from the code
  and a test fails if it drifts. Features are independent booleans; a narrative
  page imposes a set and exposes the panel rows it cares about.
- **γ is a `GammaSet`** (`geometry/gamma.ts`): exact rationals over `2000n`, a
  total that may be locked or free, a guard that holds off the singular set, the
  per-family enable / single line / isolate / ribbons filters. Every view is a
  view over it; the reticulum and the folded slider bank drive the same set.
- **Regularity is decided, not tested** — the exact criterion for rational γ at
  n = 5, Lutfalla's theorems for other n — and singularities are drawn rather
  than avoided: k concurrent lines dualize to a 2k-gon (`geometry/resolve.ts`),
  named by its angle code, with its C(k,2) superposed rhombs' edges and vertices
  shown and its fills and arcs withheld.
- **The dual is registered**: the grid is drawn at gain n/2 so each rhomb lands
  on the crossing that made it. Rhombs carry their provenance (`j, k, nj, nk,
  x0, y0`) and are cached per (γ, view); the P1 pentagons and rhomb groups are
  cached on top.
- **Tests.** 13 `tools/*.test.mjs` files, 265 tests, `npm test`, against the real
  modules — geometry, γ set, hunt, resolve, clusters, layers, factory, containers,
  floating panel, plus the spelling and layer-chart guards. `npm run check`
  imports every built page against a stub DOM and fires its handlers; the split
  page takes ~4 minutes there because the regularity scan reruns uncached on
  every draw (open item below).

## 2. Pages

| page | what it is | entry |
|---|---|---|
| `index.html` | front door: the construction stated, and two linked viewports — the same γ as lines and as tiles | `app/pair.ts` |
| `method.html` | de Bruijn's construction in seven pages; the full panel and the reticulum | `method.ts` + `app/method-steps.ts` |
| `grow.html` | tiles growing out of their crossings; the 2k-gons grow with them; ribbons routed through the pseudo edges; P1 overlay | `app/grow.ts` |
| `roof.html` | the same growth folded into the Wieringa roof; right-drag orbits; P1 overlay | `app/roof.ts` |
| `grow7.html` | the heptagrid: three rhomb shapes, no Penrose cap, no roof | `app/grow7.ts` |
| `sunstar.html` | the uniform family: sun, star, 5-fold, deca; rhomb groups colored | `app/sunstar.ts` |
| `split.html` | grid on one canvas, dual on the other, one γ, one panel | `app/split.ts` |
| `wiggle.html` | the acceptance region: drag γ in E⊥ and watch the patch hold or break | `app/wiggle.ts` |

Every page carries the top nav and the floating reticulum with its presets
popup (sun, star, deca; decagon, couple, octagon, 1 thick, 2 thick, 1 thin,
2 thin). Explorations are pages, not modes: sharing happens in `src/`, never by
overloading one page. There is no explorations index; the nav is it.

## 3. Open items

Nothing here blocks anything. Ordered by how likely they are to be wanted.

1. **Split: one stack, two containers.** Planned 2026-09-17, §5.0. Replaces
   the two-instance split page and, with it, the cross-canvas hover item and
   most of the scan cost on that page.
2. **Scan cache.** `scanRegions` reruns on every draw. Key it on (γ, rect,
   scale) the way the rhomb cache is. Split's four-minute pagecheck is the
   symptom; item 1 halves it, this removes the rest.
3. **Reticulum as a 2n-gon.** It draws a decagon on `grow7.html`; the axes come
   from `directions` so only the rim needs to follow n.
4. **The queen in ten orientations.** A generic nudge off Γ = 0 gives a queen
   turned; count whether the de Bruijn resolutions of the decagon are exactly
   the ten orientations, against the 62 rhombic tilings the zonogon admits, and
   whether the mirror-symmetric one-parameter family is one tiling or several
   (`perpOfGamma` in `acceptance.ts` is the tool). See §5.4.
5. **De-dualization, P → G.** Given a patch of tiles, draw the gridlines that
   made it. Every rhomb carries `(j, nj, k, nk)`, so the lines are known; what
   is missing is a page that starts from the tiling. Estimated as a layer plus
   a hit-test, not a redesign.
6. **Two-tries preset.** Jake saw a preset needing a second click once; never
   reproduced. Presets now `setLocked(-1)` before writing, which removed the one
   mechanism found.
7. **The timing test is flaky.** "Nothing consumes the scan" asserts on
   wall-clock and can fail on a loaded machine.

## 4. Standing rules

### 4.1 Canvas containers

Set 2026-09-06. **Anything with real drawing in it gets a container**, the way
`createPentagrid` does: own your canvases, take a config, hand back a handle. A
page is a container element, a config object and some controls; a second page
wanting the same picture is a config change, not a copy (`grow.html` and
`roof.html` are one container behind a few lines each). DOM-free mathematics
goes in `geometry/`, drawing in `view/`, and the renderer is tested with no page
in sight. Controls and picture share a screen: the bar is sticky, the viewport
is capped so the whole thing fits, and gestures beat sliders for a camera
(right-drag orbits the roof). Written up in MODULES.md.

### 4.2 No animation library

Theatre.js is a tool in search of an application and this is not it. A
continuous parameter is a float and a `render(t)`; the growth pages are exactly
that. The transition worth having is not a mesh morph — each rhomb moves from
`(n/2)·x₀` to `f` by only the bounded wobble, which is the theorem (§5.19).

### 4.3 Nomenclature

| symbol | meaning |
|---|---|
| `ζ_n` | the fundamental n-fold direction / rotation |
| `v_j` | normal vector of family j |
| `γ_j` | **phase** of family j |
| `Γ = (γ_0 … γ_{n−1})` | the **phase vector** |
| `Σγ` | the total; Penrose ⟺ Σγ ∈ ℤ |
| `λ` | gridline spacing, currently 1 and unnamed (§5.2) |
| `c` | the uniform phase, every γ_j = c |

Replace `ζ_5` with `ζ_7` and nothing in the notation changes — only the
cyclotomic field underneath.

**The correction that keeps being needed (Jake):** Σγ = 0, 1, 2, 3, 4 are
identical mod 1 — all Penrose, all one LI class. What distinguishes the caps is
`Γ`, the uniform phase `c = k/5`:

    sun    c = 1/5, 4/5      Pe5 at the origin
    star   c = 2/5, 3/5      origin in an St5 gap
    5-fold c = 0             singular; resolves to the deca under a mirror nudge

The mirror `c ↔ 1−c` pairs 1/5 with 4/5 and 2/5 with 3/5 and fixes 0. Never say
"Σγ = 1 is a sun".

**P1 patch names, not P3 vertex figures.** `Pe5` is the sun even though a *star
rhomb group* (5 thick) sits at its center; `St5` is the star even though it holds
five *diamond* groups; the `deca` = the queen = one `Pe3` with two `Pe1`. The
rhomb-group vocabulary (star, boat, diamond) and the patch vocabulary must not be
crossed. **Alan Schoen names the tilings the other way round** — our sun is his
STAR, our star his SUN, our deca his CARTWHEEL (Conway's mirror-symmetric
tiling). Ours stays; his is for reading his pages.

**Vertex keys**: build them from rounded integers with an explicit `r === 0 ? 0
: r`, never `toFixed` — `(-1e-16).toFixed(6)` is `"-0.000000"`. And corner 0 of
a rhomb spans `v_j` to `v_k`, so it is 72° for |Δ| = 1 and **144°** for |Δ| = 2.
Both cost a session each.

### 4.4 The math is diffusing — a standing concern (Jake, 2026-09-10)

Jake: *penrose-mosaic was my source of truth, but it has kind of moved to
wieringa, especially as far as the real is concerned. It's getting diffused, the
math is.* The same mathematics has independent implementations in three
repositories:

| what | where |
|---|---|
| the Wieringa lift | `pentagrid/src/geometry/roof.ts` **and** `wieringa-roof` — derived separately, cross-validated once |
| the cluster definitions | `wieringa-roof`'s `emitRhombs` **and** `pentagrid/src/geometry/clusters.ts` |
| the wheels | `penrose-mosaic/wheels.js` **and** `wieringa-roof/src/geometry.ts` |
| φ and the golden constants | everywhere |

It has already bitten — "one inflation apart" was ambiguous because the projects
count generations differently (§5.14). This file became the hub for
cross-project mathematics, which is either the fix or a fourth place for it to
live. The cheap move, if wanted: an authority **per topic** — the lift to
`wieringa-roof`, the discrete wheels to `penrose-mosaic`, de Bruijn (the
pentagrid, the regularity criterion, γ) to `pentagrid` — so duplicates become
deliberate copies with a named source. Not decided; recorded so the drift is
visible.

### 4.5 What was planned and is now built

The plans themselves are gone from this file; what they left behind:

- **Parameterizing the canvas (2026-09-05).** `geometry/` extracted DOM-free with
  tests importing the real code (which found the scan reading the tiling rect
  instead of the grid rect, and a 5e-9 nudge the 10⁴ denominator could not
  represent); `LayerStack` with declared `visible`/`opacity` predicates and a
  panel generated from the registered layers; `createPentagrid(config)` with a
  `layers` callback; implicit sizing observes the container, `data-width` pins
  it. `index.html`'s linked pair was the exercise that proved it — `setView`
  does not fire `onViewChange`, which is what keeps two instances from looping.
- **The method page reorganized (2026-09-05).** Features stopped being
  step-gated: independent booleans, the pages presets over them. Penrose split
  into tiles / edges / vertices / decor layers, orderable behind the grid;
  registration permanent; settings collapsed (force regular, vertical-axis
  symmetry, compute beyond the edge, readout placement).
- **The γ cluster (2026-09-09).** One `GammaSet` owning directions, phases, the
  total, the lock and the guard; the sum generalized and spread evenly on
  change; per-family enable, single line, isolate; the duplicate regularity
  checkbox found and removed. A lesson from the wiring: three of four view edits
  were never written because a patch batch asserted out partway and every test
  called the geometry directly — there are now tests that go through the view.
- **The reticulum (2026-09-11).** Built as a second `GammaControl` over the same
  set, SVG, one chord per family at `frac(γ_j)·SPACING`, labels on the rim,
  wheel-driven. Then floated, resized, given the presets popup, and put on every
  page; the slider bank kept, folded. §5.9 has what changed in the doing.
- **Singularities (2026-09-12 → 09-15).** Angle-code names, the 2k-gon drawn and
  described, the Penrose catalog decided by arithmetic and offered as presets,
  the superposed rhombs' edges restored, the pseudo-edge toggle, grow routing
  its bands through them.
- **Tile styles (2026-09-15 → 09-17).** type, pair, bands (families2), rhomb
  groups, P1, curves; isogloss, Wieringa height shading with ramp, bold edges,
  arcs, AR arrows; opacity; ribbons with OR semantics.

---

## 5. The record

Newest first. Each entry is dated to the session that found it. §5.0 is the one
plan in the file that is still a plan.

### 5.0 Split: one layer stack across two canvases (planned 2026-09-17)

Jake: *have one canvas use the pentagrid layer group (G) and the other the
Penrose layer group (P). Same reticulum, controls split according to
usefulness.*

**What split is now.** Two complete `createPentagrid` instances: two
`GammaSet`s (the right one a slave, `grid.gamma.onChange` pushing values
across), two models, two rhomb caches, two regularity scans, two K-region
bitmaps, two panels, and a view relay in each direction. Everything is computed
twice, the halves know each other only through the relays, and hover cannot
cross from one canvas to the other without a third relay.

**The plan.** One `createPentagrid`, one model, one `GammaSet`, one
`LayerStack` — whose canvases live in two containers. Layers with
`group: "Pentagrid"` go in the left container, `group: "Penrose"` in the right.
One view state, so no relay; one rhomb cache and one scan; and the hover trio
crosses canvases for free, because hovering a region on the left is the same
handler drawing the same highlight, onto the right container's highlight
canvas.

**Why it is efficient.** Compute halves — one scan, one collect, one K-region
fill (the four-minute pagecheck is mostly this). The γ sync and both view
relays disappear, and with them the "right side never drives" special case.
Cross-canvas hover stops being a feature. And the panel already sorts its rows
into G and P; `exposeRows` and the row map exist, they only need a host per
group.

**What changes**, mostly in `layers.ts`, which is page-agnostic and tested:

1. `LayerStack` takes a home per group —
   `new LayerStack({ default: left, groups: { Penrose: right } }, w, h)`.
   `add(spec)` appends to its group's container; `resize` covers both; z-order
   is per container, which is fine because the groups are already z-contiguous
   (P 30–34, G 5–29).
2. The raw canvases — highlight 55, footprint 60, event 100 — become one per
   container. The pointer handlers bind to both event canvases with the same
   `screenToMath`, since both containers are the same size and view. Highlight
   draws pick the canvas by what they draw: region → left; vertex, edge, tile →
   right.
3. Axes (z 70, its own group) are drawn on **both** — the shared frame on one
   side only reads as an error. A layer can name more than one home.
4. Config: `containerP?` (or `containers: { G, P }`). Absent, nothing changes —
   index, method, grow, roof are untouched. `panel` gains a second host the same
   way; rows route by their group.
5. `split.ts` becomes one create and one reticulum mount.

**Controls, split by usefulness.** Left (G): K-labels, gridline width, family
enable / single line, compute beyond the edge, the meter and loupe, readout
placement, force regular, symmetry. Right (P): tile style, shade, edges,
ribbons, the hover trio. The correspondence table goes between the canvases or
is dropped on this page — the hover *is* the correspondence there.

**Decided up front.** The two containers must be the same pixel size. One view
on two sizes means two visible rects and breaks the single `computeRect`; the
page's CSS already makes them equal, and the stack asserts it.

**Cost.** One session. The `LayerStack` change is the real work and the tests
catch it; the per-container raw canvases are the fiddly part; the panel is
plumbing.

### 5.1 The AR-pattern from the indices, with the thick/thin twist (2026-09-17)

AR is de Bruijn's *arrowed rhombus*. His Fig. 1 (1981, p. 41) is the ground
truth, read at 400 dpi from `jake/597566.pdf`, and it settles a question three
searches could not: the direction of the single arrows is **not** a function of
the endpoint indices — it depends on which tile the edge is on.

**Fig. 1.** Green (double) arrows meet at one corner — a 72° corner of the thick
rhomb, a 144° corner of the thin — and point INTO it. Red (single) arrows sit on
the two edges at the opposite corner, and here the tiles differ:

    thick   singles point OUT of that corner
    thin    singles point INTO it

**In index terms.** The green corner is the extreme, 1 or 4, so the doubles are
the 1–2 and 3–4 edges pointing *into the 1* and *into the 4* — the rhomb-group
centers, which is what Jake said: "the center of the rhomb groups determine the
AR pattern." The red corner is the other end of that diagonal, index 3 on a
(1,2,3,2) tile and 2 on a (2,3,4,3) tile; the singles leave it on a thick and
enter it on a thin.

**Why the twist is forced.** 291 of 387 shared 2–3 edges in a patch are shared by
a thick of one m and a thin of the other, so any rule with one sense for both
shapes conflicts on three quarters of them. Every index-only rule tried —
toward higher, toward lower, doubles in/out with singles fixed either way, and
eight line- and coordinate-parity variants — produced **four** marked
prototiles. Fig. 1's rule produces **two**, thick in/out and thin in/in, with
zero disagreements on 773 shared edges across three gammas. The test pins both.

**What misled the reading of Fig. 2 and the Treisberg slide.** Every clean tile I
read with "singles into the 3" — tile1 in Fig. 2, the blue tile in the slide —
has a 144° angle at its 1. They are thin. The rule was right for them and I had
taken them for thick. The Treisberg slide colors by the same scheme, green on
1–2 and 3–4, red on 2–3; its arrowhead counts are decorative except where they
are not, and are not to be trusted at that resolution.

The `arrows` toggle on the Tile edges row draws this. Off a Penrose patch the
index spans five values and nothing is drawn.

### 5.2 λ, the gridline spacing (2026-09-16)

Recorded, not a task. Every page runs with the lines one unit apart, and that 1 is not named anywhere.
It should be **λ** (§4.3), and it is the one knob inflation needs:

    line n of family j:   x · v_j = λ (n − γ_j)
    K_j(x)              = ceil( x · v_j / λ + γ_j )
    registration gain   = n / (2λ)         (the dual's edge stays 1)

Inflation with de Bruijn is then λ → φλ and nothing else — or φ² for a P1
generation, per the note on inflation. When the time comes the threading is
mechanical and was dry-run today: fourteen sites in `geometry/`, every one of
the form `x·v + γ` or `n − γ`, plus the gain in `view/growth.ts` and
`view/pentagrid.ts`; `computeRhomb`, `solveIntersection`, `computeKTuple`,
`lineRange`, `segmentAt`, `nearestLine`, `regionPoly` and the two scans in
`regularity.ts`. `lambda` would sit on `Pentagrid`, optional, read through a
`spacing(pg)` helper so nothing existing changes. Reverted rather than kept:
Jake, *"Nothing should be done. Just want to make sure it's recorded when we
need it."*

### 5.3 What the ghost lines are, exactly (2026-09-15)

Jake: *"The ghost lines of the 2K-gons are not exactly a dualization of something
on the Pentagrid. Some of the vertex dots within the 2K-gon apparently are."*
Right, and here is the precise version, measured at `Gamma = 0`:

| | tiles | fan corners | real sectors | ghost | edges | real (outline) | ghost |
|---|---|---|---|---|---|---|---|
| thin hexagon | 3 | 7 | 6 | 1 | 9 | 6 | 3 |
| thick hexagon | 3 | 7 | 5 | 2 | 9 | 4 | 5 |
| decagon | 10 | 16 | 5 | 11 | 25 | **0** | **25** |

**The method — there isn't a special one.** The ghost lines are the four edges of
each rhomb `computeRhomb` emits for each pair of the k concurrent lines. It takes
the crossing point and gets the base K-tuple by `ceil` there. At a concurrency
every participating family sits *exactly* on its line, so `ceil` returns the low
index for all of them at once: every rhomb in the stack has the **same** base
tuple `K0`, and they all **fan** from `f(K0)`. Corners are `f(K0)`, `f(K0+e_j)`,
`f(K0+e_k)`, `f(K0+e_j+e_k)`.

**Which dots are real.** A corner is the dual of an actual region iff its tuple
is a *sector* — one of the 2k regions around the point, i.e. an outline corner.
The other tuples in the fan name regions of zero area. `f(K0)`, the all-low
tuple, is a sector only when the k normals fit in a half-plane: true for three
lines, false for four or five. So the decagon's fan point is its center,
`f(empty) = f(all) = 0`, dual to nothing; its five `v_i` corners are ghosts too;
the only real dots the fan touches are the five adjacent-pair sums.

**Which lines are real.** An edge joins two tuples differing by one `e_j`. It is
a genuine Penrose edge iff *both* ends are sectors — and then it is an outline
side. Any edge touching a ghost vertex is a ghost edge: its source segment has
zero length and one end-region has zero area. For the decagon **all 25 are
ghosts**; its outline is drawn by `drawResolutions`, not by the fan.

**The fan is not "the superposition of the tilings."** That phrase had been used
loosely. For the thin hexagon the fan happens to be one genuine tiling — three
rhombs around an interior vertex, all six outline sides present. For the thick
hexagon it is not a tiling at all: it fans from an outline corner, overlaps near
it, and misses the opposite corner. For the decagon it overlaps three-fold at
the center (the ten corner angles sum to three turns).

**What the ghost lines are good for.** They are a record of the fan, and every
ghost edge parallel to `v_fam` is where that family's zone would cross if the fan
were pulled apart — which is exactly why routing the grow band through them
(`stackChain` in `view/growth.ts`) seals against the neighboring tiles with zero
failures. The ghost vertices are the cube corners from the earlier note: the
regions that *open up* under perturbation.

### 5.4 The deca is the resolution of the 5-fold (2026-09-14)

Jake: *"No the deca is not the 2K-gon decagon, in wieringa it is the queen
(misnamed) patch. It has 2 fold symmetry."* The first Caps row had `deca` as
`Gamma = 0`, the singular point, which is not a tiling at all. Corrected.

**What it is.** One `Pe3` flanked by two `Pe1`: 3 thick + 1 thin, plus twice
(1 thick + 2 thin), so **5 thick + 5 thin, ten rhombs** — which is exactly what
the 5-fold singularity holds, C(5,2) = 10 with 5 of each. That is the clue.

**Where it is.** Nudge `Gamma = 0` in any mirror-symmetric direction with the
total held at zero — `gamma1 = gamma4`, `gamma2 = gamma3` — and the decagon at the
origin resolves into the queen, every time, with the `Pe3` on the mirror axis and
the two `Pe1` straddling it. Measured for five different mirror directions at
e = 0.01, and along the line `(0, e, -e, -e, e)` it persists out to **e = 0.3**;
the line hits a singular couple at e = 1/2 (`gamma0` integral, `gamma1 + gamma4 =
1`). The preset is e = 0.1, comfortably inside — `+1/10` on families 1 and 4, `-1/10`
on 2 and 3, `gamma0 = 0` on the axis. On the Caps row it is **deca**; *queen* is
the wieringa-roof name for the same patch. "Decagon" stays for the k = 5 2k-gon
on the Hunt row, which is a different thing.

**The involution.** Negating the phases flips the queen end for end: `(0,e,-e,-e,e)`
puts the `Pe3` below the origin, `(0,-e,e,e,-e)` above. That is the "magic
mirroring of the sides" Jake remembers from inflation, seen here as `Gamma -> -Gamma`.

**A generic nudge gives the queen too**, just turned. `(e, 2e, 3e, 4e, -10e)` gave
a `Pe3` and two `Pe1` at the same three radii and the same angular gaps —
144/108/108 — rotated. So the decagon's *de Bruijn* resolutions look to be queens
in one of ten orientations, not the 62 rhombic tilings the zonogon admits. Worth
a proper count some day; not done.

**On uniqueness.** Jake surmises the queen is the only Penrose tiling with exactly
2-fold symmetry. The mirror-symmetric subspace at `Sum = 0` is two-dimensional;
one direction is translation along the axis, which changes nothing, leaving a
**one-parameter family** in `E-perp` of genuinely different mirror-symmetric
tilings, of which the queen-at-origin segment is `0 < e <= 0.3`. Whether that
whole family is "the queen" moved along its axis, or several tilings, is the open
question — `perpOfGamma` in `acceptance.ts` is the tool to settle it.

The `sunstar.html` button for `c = 0` is relabeled **5-fold**; it never was the
deca.

### 5.5 The Penrose singularity catalog — it has three entries (2026-09-14)

Jake: *"I'm looking for penrose singularities. Gamma must equal 0."* Under that
constraint the hunt closes completely. `geometry/hunt.ts` decides it by arithmetic
rather than by looking, so the answer holds for the whole plane and not a window.

**No octagon is Penrose.**

Not rare — impossible. Since `Sum(v_j) = 0`, at a point where families a,b,c,d meet:

```
x·v_e + gamma_e  =  −Sum(n_j) + Sum(gamma)
```

so the fifth family passes through **that same point** exactly when `Sum(gamma)` is
an integer. Penrose *is* `Sum(gamma) in Z`, so every 4-fold is swallowed by a
5-fold. This is why the map never offered one. Step 7 previously said "the octagon
is real but rare"; it is real and *outside the condition*, which is a different
claim. Release the total and four integral phases give one immediately — that is
the proof, and the classifier still handles it, it is just not a destination.

**The hexagons come in couples.**

The ten triples pair by **shared lone family and complementary pair**:

    012 <-> 134    013 <-> 234    014 <-> 023    024 <-> 123    034 <-> 124

A triple is `{L,P,Q}` with `gamma_L` integral and `gamma_P + gamma_Q` integral. Its
partner is `{L} + complement`, same lone, complementary pair — and `Sum(gamma)` in
Z forces that pair sum too. So the two stand or fall together. **Every couple is
one K122 and one K113**, so at `Sum(gamma) = 0` the thick and thin hexagons only
ever appear together, never one alone. (That invalidated two presets from the
first draft of this work, "Thick hexagon" and "Thin hexagon" alone — both were
non-Penrose without my noticing, and the test caught it.)

**And nothing in the middle.**

Two couples mean two integral phases; their pair conditions drag in two more, and
an integral total supplies the fifth. So the hexagon count is **0, 2 or 10** —
never 4, 6 or 8. The whole catalog, searched exhaustively over every rational
phase vector at denominators 12, 15, 20, 24 and 25:

| state | shows |
|---|---|
| regular | nothing concurrent anywhere |
| one couple | one K122 + one K113, and nothing else |
| `Gamma = 0` | five of each, plus the unique decagon |

Those are the Penrose entries of the reticulum's presets popup (decagon, couple;
regular is the sun). The popup also carries every unique non-Penrose signature —
octagon, 1 thick, 2 thick, 1 thin, 2 thin — seven signatures in all, each checked
against the rule AND against the scan, so a label cannot lie about what the map
shows. `classifySingularities` in `geometry/hunt.ts` is the decider.

**Two things the tests caught.**

- **Preset denominators must divide the gamma set's.** It carries rationals over
  `2000n` — 10000 at n = 5 — so presets over 60 were silently rounded on the way
  in and `7/60` arrived as `0.1167`. The vector on screen was then not the vector
  the rule had been checked against. Presets are over 100, and the round trip is
  pinned.
- **The rationality assumption is load-bearing.** The triple condition is one
  equation `u + phi*v = 0`; it splits into `u = 0` and `v = 0` only because u and v
  are rational, which holds only for rational phases. The dials and wheel produce
  hundredths and thousandths so every reachable phase is rational — but this is
  stated in `hunt.ts` rather than assumed.

### 5.6 The superposition, and how it went missing (2026-09-14)

**The regression.**

The lines inside every 2k-gon are the **C(k,2) superposed rhombs**, drawn where the
construction puts them. Nothing synthesizes them; they are ordinary rhombs that
happen to share a crossing, and they join vertex dots that were being drawn all
along. `f7a4a7e` had them. `469dbcb` took them away, and its own commit message
states the rule it broke:

> those now take no fill and no arc, while **edges and vertices are untouched**

The filter went onto three layers when it belonged on two. Tiles filtered
correctly, arcs filtered correctly, vertices correctly did not — and edges wrongly
did, which hollowed out every 2k-gon. One line. The rule was already written down
in this file, under *"Vertices, then edges — these are wanted"*, which is worth
noticing: it was recorded, agreed, and then violated by a filter added for a
different purpose.

**The rule, stated once more so it is testable:** at a concurrency a fill asserts
which of the many rhombic tilings of the 2k-gon is real, and an arc asserts a
shared edge to join across when inside a stack there is none. Edges and vertices
assert neither. `containers.test.mjs` now pins it by comparing the edge count
against the fill count at Gamma = 0, and the arcs/edges *ratio* against a regular
configuration — the raw arc count says nothing, since the decor layer strokes two
arcs per rhomb where the edge layer strokes one.

**Two measurements.**

**The five octagons are the 4-faces of the 5-cube.** Where k lines meet, each
`K_j` is free either way, so the surrounding regions are the 2^k corners of a
k-cube and `f` projects it into the plane: the shadow is the 2k-gon, the 2-faces
are the C(k,2) rhombs, the monotone surfaces are the rhombic tilings. Drop one
generator and the rest is a 4-cube, which projects to an octagon — five of them,
unit sides, centers at radius 1/2 and **72 degrees apart** (54, 126, 198, 270,
342). This confirms "the decagon is five octagons turned" above, and explains why:
they are sub-cubes, not an accident of the drawing.

The decagon's cube has **31 corners, not 32** — `Sum v_j = 0` collapses `f(empty)`
onto `f(all)` — 80 edges, and 21 corners strictly inside the outline. That count
is why drawing the cube itself is unreadable: tried, and Jake's verdict was "the
decagon is too busy". The superposed rhombs are the right object; the cube is the
explanation for their structure, not a thing to draw.

**Correction — the thin hexagon has two tilings, not one.** The note above that
K122 and K113 are "not superposable" is right and stands: they are not congruent,
144/108/108 against 144/144/72. But the stronger claim, that K113 "has only one
vertex mapped to its center and thus has only one tiling combination by rhombs",
does not survive measurement. Both hexagons have exactly **two** interior cube
corners, and perturbing Gamma 400 ways reaches both in each case — thick 64/66,
thin 74/90. Every 3-cube has two monotone surfaces and neither hexagon is an
exception. The one interior point that is genuinely unreachable is the **decagon's
center**, realised 0 times in 400, which is the `f(empty) = f(all)` collapse.

**Also landed.**

- **`hoverEdge` is wired.** It had sat in the feature list, the panel and the
  correspondence table with nothing reading it. A gridline segment separates two
  regions, so it is dual to the **edge joining the vertices those regions become** —
  the same map as region → vertex and crossing → tile, one dimension down.
  `segmentAt` finds the bracketing crossings and the regions either side;
  `nearestLine` picks the line. Hit-test order is crossing, then segment, then
  region: a point, a line, an area, or the line swallows every hover near a
  gridline. Verified against a collected patch — for every dual edge comfortably
  inside it, 1175 of 1175 were genuine tile edges.
- **The scan ran only when the meter or loupe wanted it**, but the tile and edge
  layers draw the 2k-gons from that same scan. On any page without `controls` the
  resolutions were never drawn at all. `scanSmallRegions` now also runs when the
  tiling needs it, and the factory test that asserted the old behavior was
  measuring a viewport with tiles on — it now measures a grid-only one, which is
  the saving it was always about.

### 5.7 Naming the resolutions, and what a Penrose setting should be (Jake, 2026-09-13)

**The angle code — Jake's scheme, and it is complete.**

A 2k-gon is named by the **supplements of its angle sequence**, in units of
`180/n`: a digit `d` is a vertex whose interior angle is `180 - d*(180/n)`, which
is the gap between two consecutive generator directions. Sorted, those digits are

> **a partition of n into k parts, always** — the gaps span a half turn, so they
> must add to n.

Which makes the available shapes exactly the **partitions of n into two or more
parts**. Verified both ways: n = 5 gives six codes and six partitions, n = 7 gives
fourteen and fourteen, identical sets.

    14     thin rhomb          113    thin hexagon
    23     thick rhomb         1112   octagon
    122    thick hexagon       11111  decagon

The code is the real name — it needs no lookup table, it says the shape's angles
outright, and **nothing about it changes when n does**, which is the whole point
of the `zeta_n` nomenclature. Friendly names ride along where one has been earned.
`describeResolution` now reads "K122 thick hexagon · 2 thick + 1 thin".

**Jake had not noticed there are two hexagons**, and they are not congruent —
"not superposable". K122 is 144/108/108 and holds 2 thick + 1 thin; K113 is
144/144/72 and holds 1 thick + 2 thin. Worth saying that the thick/thin content
follows from the code, so the code alone distinguishes them.

**And the decagon is five octagons turned.** Dropping any one of the five
generators from K11111 leaves K1112, and the five choices are rotations of each
other — a superposition in the same sense the rhombs are.

**Singularities stay on, and want hunting.**

Jake: *"Singularities happen, this one just happens to be in your face because our
initialization happens to be quote illegal unquote."* So the layer stays on by
default and the rest follows from assuming they occur.

The next thing was **finding** them — now the presets popup on the reticulum,
decided by `geometry/hunt.ts` (§5.5). The rules:

    3-fold   gamma_L in Z  AND  gamma_P + gamma_Q in Z   — no other integral phase
    4-fold   four integral phases                        — rare, and real
    5-fold   all five                                    — unique, Gamma = 0

**What a Penrose setting is, and what it does on a 2k-gon.** Built as stated,
and pinned by `containers.test.mjs` (§5.6). The layers behave differently over a
singularity, deliberately:

- **Vertices, then edges** — these are wanted. They give a singularity structure
  and make it legible rather than decorating it.
- **Tiles, especially opaque ones** — NOT over a 2k-gon. An opaque fill asserts a
  layout that the superposition does not have, which is the same objection that
  stopped the rhomb tiling being drawn.
- **Arcs and the other decorations** — curtail them on a 2k-gon unless a sensible
  reading is found. An arc joins across a shared edge by construction, and inside
  a superposition there is no shared edge to join across.

The longer list that went with it — the two-color composites of the bands, the
five-color tiling at full width, isoglosses, index shading, transparency — is the
Tile style / Tile shade / Tile edges rows of the panel.

### 5.8 One deliberate singularity, and the space a resolution takes (Jake, 2026-09-12)

**Only one deliberate singularity, and that is provable.**

Jake's intuition: with exact arithmetic there should be essentially **one**
singularity available on purpose. It falls straight out of the exact criterion.

A triple is singular iff `gamma_L` is an integer AND `gamma_P + gamma_Q` is an
integer. On the **uniform** family every offset is `c`, so the two conditions
become `c` in Z and `2c` in Z — and the first implies the second. Hence:

> Within the symmetric family, `Gamma` is singular **iff c = 0 (mod 1)**, and then
> all ten triples go at once.

One configuration, the five-fold one, and nothing else. Everything else singular
requires leaving the symmetric family. That is why the reticulum's symmetric mode
can be swept without ever tripping over a singularity except at the origin.

**Reserve the space for the resolution — verified.**

k concurrent lines dualise to a 2k-gon, which decomposes into C(k,2) rhombs. For
n = 5, enumerated over every subset:

    3 lines -> hexagon,   3 rhombs    2 thick + 1 thin   x5   {012}{014}{034}{123}{234}
                                      1 thick + 2 thin   x5   {013}{023}{024}{124}{134}
    4 lines -> octagon,   6 rhombs    3 thick + 3 thin   x5
    5 lines -> decagon,  10 rhombs    5 thick + 5 thin   x1   {01234}

Jake's counts confirmed: the hexagon really does have exactly **two** combos, and
the octagon is "a boat and two thins" — a boat being 3 thick + 1 thin, so
3 + 1 + 2 = the 3 thick + 3 thin measured. The decagon's 5 + 5 is the
configuration already measured at `c = 0`.

The ten hexagon subsets are the same ten triples as `TRIPLES` in
`geometry/regularity.ts`, split five and five by combo — a second reading of the
same table.

**Lutfalla states the rule and draws it** (`multigrids.pdf`, gitignored; DOI
10.4230/OASIcs.AUTOMATA.2021.9):

> "In this dualization process each cell or mesh of the multigrid is sent to a
> vertex of the dual tiling [...] and each intersection point of the multigrid is
> sent to a tile of the dual tiling. **The dual of an intersection point where k
> lines intersect is a 2k-gon with unit sides** as shown in Figure 3 for the case
> of 5-fold multigrids."

Figure 3 draws the cases left to right: two lines to a rhomb, then three lines to
a **hexagon**, then four lines to an **octagon**. The decagon is not drawn but is
the same rule at k = 5. His definition of singular is ours: "at least one
intersection point where at least 3 lines intersect".

**And his Proposition 3 is the determinant condition in `regularity.ts`.** For
odd n, with `r_j` in `Z - gamma_j`, a grid is regular when

    r_0 sin(2(p-q)pi/n) + r_p sin(2q pi/n) - r_q sin(2p pi/n) != 0

for every triple. That is exactly the expansion this repo's `regularity.ts`
header derives from the 3x3 determinant, relabeled to families 0, q, p — so the
exact n = 5 criterion here is **Proposition 3 specialized to five and then split
over Q(phi)**, which is the step Lutfalla does not take and says does not
generalise. Good to know the derivation agrees with the published one rather than
merely not contradicting it.

**Built** as `geometry/resolve.ts`: a concurrency is drawn as the 2k-gon it
dualizes to, the space the rhombs would occupy if the lines were pulled apart,
and `describeResolution` names it from the combo — "K122 thick hexagon · 2 thick
+ 1 thin" rather than "3 lines".

### 5.9 The reticulum: what changed in the doing (2026-09-11)

The plan was five axes on a decagon, each family's phase sitting on its own
grid direction so that mod 1 is structural rather than enforced; wheel primary,
hundredths a notch and thousandths with shift; the same `{element, sync}` handle
as the dial bank so a page swaps one for the other. `src/ui/reticulum.ts`,
`mountReticulum` in `view/controls.ts`; SVG, pure view, no pentagrid mathematics
inside it.

Two revisions from Jake once it was running:

- **One line per family, not a train of hatch marks.** The reticulum draws the
  single line of family j nearest the origin, as a chord perpendicular to its
  axis at distance `frac(gamma_j) * SPACING`. Mod 1 survives the change — a whole
  turn reproduces the chord exactly, and a test pins that at gamma = 0, 1, -2 and
  7.25 — but the wrap is now a visible return rather than an invisible slide. A
  clock hand passing twelve, which is the metaphor the labels ask for anyway.
- **Labels round the rim, on their own axes**, colored, with the dependent one
  grayed. For an untwisted star they land at 0, 72, 144, 216, 288 degrees;
  `setSymmetry` turns them with their axes, since they are placed from
  `directions` rather than from fixed angles.

**Sigma joins the lock group — a model change.** Clicking a colored label makes
that offset the dependent one. Clicking **Sigma at the hub** makes the *total*
the dependent member: nothing holds it, and all n offsets are free at once.
Exactly one of the n+1 is gray, always.

That needed `GammaSet` to accept `setLocked(-1)`: `relock()` now recomputes
`sumQ` from the offsets instead of writing a dependent one, and the guard skips
its `q[locked]` check. `setSum` on an unconstrained set spreads evenly, since
there is no index left to absorb a change. **The dial bank gets the same
behavior** — its Sigma readout is clickable and grays the same way — because the
change is in the model, not in either view.

**Since then.** It floats (`ui/floating.ts`: draggable, resizable, position and
width remembered), carries the presets popup whose choice names the title bar,
and is on every page with the slider bank folded beneath it. Presets call
`setLocked(-1)` before writing so a locked index cannot fight the values. Both
controls drive one `GammaSet`; nothing should assume there is exactly one set
per page.

### 5.10 Inflation — nothing implemented, and the open question (2026-09-10)

Reference images, both in `jake/` (untracked):

- `levelonetiling.gif`, from the AMS feature column on Penrose tilings. The
  **Robinson** step: each rhomb is cut into half-triangles (gray) and the pieces
  reassembled into rhombs **phi** times larger (black). Linear ratio phi.
- `next-gen-penrose-type-1.gif`. The **P1** step: heavy black outlines mark the
  next generation's pentagons and star laid over the small P1 tiles. Linear ratio
  **phi^2**, and the child group sits **inside** the ancestor pentagon, which is
  what makes it look turned over.

**Jake's observation, and why it matters here.** Under Robinson inflation a **Pe5
rhomb group becomes a smaller St5 rhomb group**, ratio phi. That is the Sun/Star
relationship in motion, and it makes a prediction this plan can already state
sharply. Sun and Star are not different LI classes — every Penrose tiling is LI
with every other — they differ only by what sits at the center, and we now know
which gamma gives which: Sigma-gamma = 1 and 4 are Suns (origin index 5 is an
extreme), 2 and 3 are Stars (origin index 5 is a middle level). So **inflating a
Sun should produce a Star**, and the map on Sigma-gamma ought to be visible in
those four values. Untested — there is no inflation to test it with.

**Settled: big rhombs and little rhombs are TWO inflations apart**, i.e. one full
P1 generation, phi^2 — not the intermediate phi level. That closes the question
left open in §5.14, and kills the guess made there that
`penrose-mosaic`'s small/large rhomb pair might already be the missing half step.
It is not; it is a whole P1 generation. [[penrose-mosaic-rhomb-groups]] updated.

**The open question: what does inflation do to the pentagrid?** Is there a
formula taking gamma to gamma-prime for each of the two steps? Penrose only, so
Sigma-gamma = 0 throughout (or any integer — same LI class).

What can be said without doing the work:

- Inflation is a linear map on R^5. On E-parallel it multiplies by phi; on
  E-perp it must act by the **Galois conjugate**, -1/phi, since that is the
  other embedding of Q(sqrt 5) and E-perp is the conjugate plane. So the
  expected shape is that gamma's perpendicular coordinates **contract by 1/phi
  and change sign** each Robinson step.
- Sigma-gamma is preserved: Penrose maps to Penrose.
- **There is no flip, and an earlier draft of this section was wrong to look for
  one.** Jake: the P1 generation does not really flip — the inflated group sits
  *inside* the ancestor pentagon, and an inscribed pentagon is simply turned. It
  is the pentagram relation, measured here to be sure: outer/inner circumradius
  **phi^2 = 2.618034**, turned **exactly 36 degrees**, determinant +1. A rotation,
  not a reflection. Point-up becomes point-down, which reads as upside down and
  is not.

  That removes the tension the draft recorded. Two Robinson steps give
  (-1/phi)^2 = +1/phi^2 on E-perp, orientation preserved, and the P1 step's
  apparent flip is the 36 degree nesting rotation rather than a sign. Two P1
  generations turn by 72, a pentagon symmetry, so orientation returns. Nothing is
  anomalous and no code should be written expecting a reflection.

**The gen-2 substitution, in rhomb groups (Jake, 2026-09-10 — verified).** Jake
gave the compositions and they check out exactly against `wieringa-roof`'s own
expansion (`generatePatch(seed, true, 2)`, counting leaves that emitted rhombs):

    gen 1                       gen 2                              rhombs
    Pe5 = star                  Pe5 -> star + 5 boats                25
    Pe3 = boat                  Pe3 -> star + 3 boats + 2 diamonds   23
    Pe1 = diamond               Pe1 -> star + boat  + 4 diamonds     21
    St5 = (nothing)             St5 -> 5 diamonds                    15

Gen 1 is one group per tile, so gen 2 is where the **complete set** first
appears and the substitution becomes visible. The St5 line confirms the earlier
correction: a star does emit from gen 2 on, as five diamond groups, and those are
its five `Pe1` children.

As a matrix on rhomb groups, every pentagon makes **exactly six** groups:

    Pe5 -> 1 star + 5 boat + 0 diamond
    Pe3 -> 1 star + 3 boat + 2 diamond
    Pe1 -> 1 star + 1 boat + 4 diamond

The Pe-only block therefore has dominant eigenvalue exactly 6 — but that is not
the growth rate, because the St family feeds back in (St5 makes five Pe1). The
true rate is below.

**Measured: a P1 generation is phi^4 in count, hence phi^2 linear.** Rhomb count
seeded on Pe5, generation by generation:

    gen     1     2      3      4       5        6        7
    rhombs  5    25    140    835    5225    33820   223835
    ratio    -  5.000  5.600  5.964  6.257    6.473    6.618      -> phi^4 = 6.854

The shortfall from phi^4 falls by roughly 1/phi each generation, which is the
boundary of a seeded patch. **This settles §5.14's caveat that nothing there
had been measured in this repo: it has been now.** One P1
generation is linear phi^2, and the count/area factor is phi^4.

**The mosaic is the heart; real was the expansion (Jake, 2026-09-10).** Worth
having straight, because the natural assumption is backwards. The originating
program was **penrose-mosaic** — the discrete tiling — not tiles, and the real
geometry came later as an expansion of it. **Real does not even need the
wheels**: five-fold symmetric coordinates are just sines, cosines and phi. The
wheels exist for the *discrete* side, where the arithmetic is integer and exact.

So "the wheels are an artifact of the discrete tiling" is exact, not loose, and
the intermediate-level work below belongs in the discrete world by default rather
than as a port to it.

**The wheels skip a level, and the missing one is a subtraction (Jake,
2026-09-10 — verified).** Jake's diagnosis of why the Fibonacci-like series in
the wheels reads "far off": it skips numbers. Confirmed from the recurrence
itself, `wieringa-roof/src/geometry.ts:146`, which on a 10-spoke wheel is

    next[k] = w[k-1] + w[k] + w[k+1]

Three unit vectors 36 degrees apart sum to `(1 + 2cos36) * w[k]`, and
`2cos36 = phi` exactly, so that factor is `1 + phi = phi^2`. **The wheels step by
phi^2 per generation, and never rotate** — the sum is parallel to its middle term.
So the sequence is every *other* Fibonacci index, which is exactly why fitting a
Fibonacci recurrence to it looks wrong.

Because consecutive wheels are parallel, the intermediate is trivial, and there
are two equivalent one-liners for it:

    drop the middle term   w[k-1] + w[k+1]   =  2cos36 * w[k]      = phi * w[k]
    or subtract            next[k] - w[k]    =  (phi^2 - 1) * w[k] = phi * w[k]

Both work for the same reason, `phi^2 = phi + 1`. Measured: 2.618034 for the
three-term sum, 1.618034 for either intermediate, all on the same spoke
direction. Jake's bet that this would be easy is correct — it is one subtraction.

**This matters more than a tidy-up.** That intermediate wheel *is* the Robinson
level, and in wheel terms it has a two-line construction.

**Not unfound — already explored (Jake).** "There's a whole set of discrete tiles
in between, ready to generate." `penrose-mosaic`'s wheels use the same three-term
successor and carry an exact integer deflation (`predecessorPoint` /
`interpolateWheel`, round-trip verified over 20,000 triples). So the intermediate
is a two-term sum instead of a three-term one, exact in integers. **Inference, not
verified**: nobody has run the two-term sum on the discrete wheels and looked at
what comes out, or whether it lands as a clean set of the six P1 shapes.

**The Fibonacci extrapolation was applied across a skip.** The discrete wheels
were extrapolated with `k(n+2) = k(n) + k(n+1)`, ratio φ, but a wheel generation
steps by φ² — every other term. Either stay on the φ² ladder with
`a(n+2) = 3a(n+1) − a(n)` (since φ⁴ = 3φ² − 1; reproduces F(2n) exactly), or
generate the intermediate and plain Fibonacci is right again.
**The St* family are second-class citizens (Jake, 2026-09-10).** Not a figure of
speech — it is structural, and it is why the round trip below is stuck:

- **They own no rhombs.** At gen 1 an `St*` emits nothing at all; it is a gap.
  From gen 2 it emits only through its `Pe` children.
- **There is no St rhomb group.** The three groups — star, boat, diamond — all
  center on `Pe5`, `Pe3`, `Pe1`. Nothing centers on a star.
- **`clusters.ts` is blind to them by construction**, since it partitions *every*
  rhomb into a Pe group and leaves nothing over.
- **They are outnumbered**, and the ratio converges on phi^2:

        gen        4       5       6       7
        pentagons  221   1406    9196   61261
        stars       50    400    2965   21210
        Pe:St     4.420  3.515   3.102   2.888     -> phi^2 = 2.618

- Even the **naming** favours the other side: the *star rhomb group* lives at the
  center of a `Pe5`, which is the sun. See the vocabulary correction above.

**The counterweight, and the way out.** [[penrose-mosaic-rhomb-groups]] records
that the St family emits no small rhombs "— in the dual it is the other way
around". So second-class is an artefact of looking from the rhomb side: in the
dual construction the St family is the one that carries. That is the obvious lead
for completing rhombs -> P1 — **recover the Pe tiles from the primary rhombs and
the St tiles from the dual** — and it is the same thing as the parked **Sun/Star
overlay** (TODO 4a), whose stated goal is that the overlaid pattern produces a P1
tiling with one pattern on thick and the other on thin. Worth noting the warning
attached to it: `goThickDual` / `thinDualRhomb` are built from the p and s wheels
rather than t, *may* be a genuine dual, and must not be blanket-renamed.

**The round trip, and what it would buy (Jake, 2026-09-10).** The six P1 shapes
— Pe5, Pe3, Pe1, St5, St3, St1 — each convert to a rhomb group of small rhombs,
and the conversion goes the other way too. That is mutual local derivability
made concrete, and it gives a *visual* conversion in both directions.

The payoff Jake names: with both directions in hand you can **see the Robinson
inflation of P1**. Since P1 generations are phi^2 apart and a Robinson step is
phi, the chain

    P1(n) -> rhombs -> one Robinson step -> rhombs -> P1

lands *between* P1 generations. That is the intermediate phi level, expressed
back in the six P1 shapes — exactly the thing §5.14
called unfound. It turns an open question into a construction.

**State of the two directions.**

- **P1 -> rhombs: implemented**, in `wieringa-roof`'s `emitRhombs` — star group 5
  thick, boat 3 thick + 1 thin, diamond 1 thick + 2 thin.
- **rhombs -> P1: half implemented.** `geometry/clusters.ts` recovers the **Pe**
  family and only that. Measured on a patch of 546 interior vertices: the 146
  extreme-index vertices own a cluster, all of them, and of the 400 middle-index
  vertices **none** does. So Pe* centers are exactly the extreme-index vertices —
  which is the rule the recognizer is built on, seen from the other side.
- **The St family is invisible to it**, because St tiles own no rhombs. Nothing
  is left over for them: the recognizer partitions *every* rhomb into a Pe group.
  So a full rhombs -> P1 conversion has to *place* the stars, boats and diamonds
  rather than read them off the rhombs.

**Lead for finding the St tiles.** They are the gaps in the Pe layout, and the
Sun/Star result says where to look: at Sigma-gamma = 2 and 3 the origin has a
middle index, owns no cluster, and sits inside an **St5**. So St centers live
among the middle-index vertices. Not all of them — 400 middle-index vertices in
that patch is far more than the St tiles it can hold — so the open part is which
subset, and by what local rule. That is the next concrete thing to work out, and
it is the last piece of the round trip.

**Nothing is implemented.** `pentagrid` has no inflation and no deflation. What
it does have is half the picture in one direction: `geometry/clusters.ts` reads a
rhomb patch up into P1 clusters (Pe5/Pe3/Pe1), which is one P1 generation of
recognition. Missing is the map itself, the Robinson half-step, and any way to
iterate. TODO, and it is the prerequisite for the deflation-tower idea above —
that proposal drives `acceptance.ts` from a tower nobody can currently build.

### 5.11 Caps, the index, and sun versus star (2026-09-09)

Prompted by Levochik's `Penrose_LI_classes.svg` on Wikipedia's *Aperiodic tiling*
(CC BY-SA 3.0, so we should redraw rather than embed). Eighteen patches, 6 across
and 3 down — the SVG is internally 3x6 with `matrix(0,1,-1,0,8833.5,-0.5)`
rotating it. Rendering note: `qlmanage` forces a square and silently gives a 3x3
crop; ImageMagick has no SVG delegate here; headless Chrome is correct.

**Measured: all eighteen are origin-centered.** 72 and 144 degree self-agreement
0.70-0.85 against a 0.21-0.28 control at 30/50/100 degrees. Five-fold symmetry
about the origin forces every offset equal — rotating by 72 sends v_j to v_{j+1},
so family j's lines land on family j+1's only if gamma_{j+1} = gamma_j mod 1. So
the figure is the *uniform* family Gn(c), one parameter.

**Sum arithmetic.** With every offset equal to c, Sigma-gamma = 5c. If c runs over
[0,1) then Sigma-gamma runs over [0,5) and the LI-class circle is traversed FIVE
times. One lap — the complete gamut — is c in [0, 1/5). The eighteen are a finite
sample of a continuum, and *origin-centered* is a second restriction: for a fixed
Sigma-gamma you can spread the dials and get a different tiling in the SAME LI
class with no symmetry at all. They are the symmetric representatives.

**Jake was right about mod 1.** Sigma-gamma = 2.5 and 0.5 are the same LI class.
Confirmed: flowers at both, none at integers or generic values.

**Cap = a minimum of the vertex-type count.** Sweeping Sigma-gamma at n = 5, in a
+-12 window:

    Sum  0.000  types  7   <== MIN      Sum  1.000  types  7   <== MIN
    Sum  0.375  types 12               Sum  2.000  types  7   <== MIN
    Sum  0.500  types 11               Sum  2.500  types 10

A sharp dip to 7 (classically 8; rare types need a bigger window) exactly at
integer Sigma-gamma, 10-12 everywhere else. Penrose is the minimum-complexity
member of the family, which is exactly the cap idea.

**No harmonics at 1/3 or 2/3.** The only distinguished points in [0,1) are
Sigma-gamma = 0, the type-count cap, and 1/2, where the ten-thin flower appears.
The flower band is Sigma-gamma in [0.34, 0.64], a symmetric staircase peaking at
1/2 (density 0, 5, 11, 21, 11, 5, 0) — the symmetry about 1/2 is the mirror
identification Sigma-gamma <-> 1 - Sigma-gamma. Nothing happens at 1/3.

**The index runs 4 values at integer Sigma-gamma and 5 otherwise.** The sharpest
Penrose test in the whole family:

    c     Sum   types  flowers  index    levels
    0.00  0.00    7      0      1..4       4    integer
    0.05  0.25   11      0      1..5       5
    0.10  0.50   12      9      1..5       5
    0.20  1.00    8      0      2..5       4    integer
    0.40  2.00    8      0      3..6       4    integer
    0.50  2.50   13     10      3..7       5

Reason: Sum_j v_j = 0, so Sum_j (x . v_j) = 0 and the index Sum K is a sum of five
ceilings of numbers totalling Sigma-gamma. An integer total collapses one case.
That is de Bruijn's index result, arrived at by measurement here.

**Correction — the Wieringa roof is NOT Penrose-only.** Checked at Sigma-gamma =
0, 0.5, 1, 1.23, 2.5: every lifted edge is exactly sqrt(5)/2 (max deviation 2e-15)
and every index step is +-1. The roof stands for the generalised tilings too; it
just sits on FIVE levels instead of four. The roof's restriction is n = 5, which
is a different thing from Sigma-gamma integer, and it is easy to slide between
them.

**The star/sun question was misframed here at first** — measured as P3 vertex
figures, every uniform c put five fat rhombs at the origin and the conclusion
"there is no star" followed. Wrong vocabulary: sun and star are P1 patch names
(§4.3), a star's center is an `St5` *gap*, and vertex probing could never find
it. The cluster recognizer settles it below.

**n = 7 has no Penrose-like cap.** At exact integers and halves:

    Sum   0.0  0.5  1.0  1.5  2.0  2.5  3.0  3.5
    types  23   24   21   25   20   23   25   20
    levels  6    6    6    5    6    6    6    5

No dip at the integers — the type count wanders in 20-25 with minima at 2.0 and
3.5 that are not obviously structural. The index span is 6 (= n-1) at most sums
and 5 at 1.5 and 3.5, which does *not* follow the n = 5 pattern of "integer gives
n-1". Measured, not explained. So the thing that makes Penrose special at five
appears to have no analogue at seven, which is worth saying on grow7.html.

**Ideas, not yet built.**

- ~~A *tweaking mode* for the dials~~ — the presets popup is this.
- Our own version of the LI-class grid: a row of patches across Sigma-gamma in
  [0,1), same even split, so the flowers appear and disappear as you sweep. All
  the geometry exists; it is a layout job.
- ~~Read Figure 3 of `multigrids.pdf`~~ — done, §5.8.

Two measurement gotchas from here are now standing rules (§4.3).

**The cluster recognizer (`geometry/clusters.ts`), and it settles Sun/Star.**

The rule is local and exact. Lift every vertex to its Wieringa index; a rhomb's
corners carry m, m+1, m+2, m+1, and Penrose uses exactly four levels, so a rhomb
spans either the bottom three or the top three and touches **exactly one**
extreme. Grouping rhombs by that vertex partitions the patch with nothing over:

    5 thick + 0 thin   star rhomb group     center of a Pe5  (the SUN)
    3 thick + 1 thin   boat rhomb group     center of a Pe3
    1 thick + 2 thin   diamond rhomb group  center of a Pe1

Measured on 1958 rhombs: no rhomb without an extreme, none with two, and 100% of
groups away from the patch edge are one of those three at every radius tried.
Off the integers the index takes five levels, a rhomb can span the middle three
and touch no extreme, and 1451 of 1952 rhombs go unassigned — so `defined` is
false and the reason says "not Penrose". That is correct, not a gap: P1
pentagons are a Penrose structure.

**Sun and Star, answered.** All four origin-centered Penrose caps show FIVE FAT
rhombs at the origin, so the vertex configuration cannot tell them apart — the
earlier reading above called them all suns on exactly that evidence and was
**wrong**. The index decides. The origin's K-tuple is (1,1,1,1,1) for a
uniform offset in (0,1), so its index is always 5, while the patch range is
[Sigma-gamma + 1, Sigma-gamma + 4]. Five is an extreme, hence a Pe5 center, only
at the ends:

    Sum-gamma = 1  origin index 5, range 2..5   MAX -> Pe5 -> SUN
    Sum-gamma = 2  origin index 5, range 3..6   middle -> no cluster -> STAR
    Sum-gamma = 3  origin index 5, range 4..7   middle -> no cluster -> STAR
    Sum-gamma = 4  origin index 5, range 5..8   MIN -> Pe5 -> SUN

So **Sun is the uniform offset 1/5 or 4/5, Star is 2/5 or 3/5**, and the pairing
1<->4, 2<->3 is the Sigma-gamma <-> -Sigma-gamma mirror again. A star's center
belongs to no cluster because it is an `St5` gap, which is why vertex probing
could never find it and why this needed the recognizer.

Lesson worth keeping: a five-fat-rhomb vertex is the *star rhomb group* wherever
it occurs, but it is a **Pe5 center** only when its index is extreme. Middle-index
sun-shaped vertices exist (7 at index 3 and 5 at index 4 in one patch) and are not
cluster centers.

**What is still missing.** Two dimensions of gamma never shrink: sliding along
E-parallel translates the pentagrid and leaves the tiling alone, so what converges
is the E-perp position plus Sigma-gamma, and the tower pins gamma only up to that
slide. And `pentagrid` has no cluster recognition — it knows rhombs, not `Pe5` /
`St5` / `deca` — so the seeding has to come from `penrose-mosaic` or
`wieringa-roof`, or a recognizer has to be written here. That is the real cost of
the idea, and it is worth scoping before starting.

**Also worth having.** Lutfalla notes de Bruijn's exact characterisation of
regular pentagrids covers only the Penrose case, Σγ ∈ ℤ. Ours was verified against
brute force at sums of 0.5, 0.9 and 2.5 as well, so it appears to cover the
generalised case too — for rational γ. Worth stating carefully rather than
claiming priority.

### 5.12 What the literature says — Lutfalla 2021, and n as a parameter (2026-09-09)

V. H. Lutfalla, *An Effective Construction for Cut-And-Project Rhombus Tilings
with Global n-Fold Rotational Symmetry*, AUTOMATA 2021,
[doi:10.4230/OASIcs.AUTOMATA.2021.9](https://doi.org/10.4230/OASIcs.AUTOMATA.2021.9);
SageMath companion at [doi:10.5281/zenodo.4698387](https://doi.org/10.5281/zenodo.4698387).
Jake has it locally as `multigrids.pdf`, deliberately not committed — the Pages
workflow publishes the repo root, and republishing someone else's paper on the
site is not ours to decide. It settled the ½ question and corrected two things
recorded here.

**Notation.** Lutfalla writes `H(ξ, γ) = {z : Re(z·ξ̄) − γ ∈ ℤ}` — offset
*subtracted*, and restricted to γ ∈ [0,1). Ours adds it, so their γ is our −γ mod
1. Nothing that matters turns on it, but translations should watch the sign.
`Gn(x)` means **all n offsets equal to x**.

**So the ½ is per-offset, not the sum.** `G5(½)` is five offsets of ½ each, which
in our terms is Σγ = 5/2 — the largest pentagon (§5.13). This also generalises, which a sum cannot:
`Gn(½)` means the same thing for every n.

**Theorem 1.** `Pn(½)` has global **2n**-fold symmetry for any n ≥ 4; `Pn(1/n)`
has global **n**-fold symmetry for odd n ≥ 5. So for genuine 7-fold symmetry the
target is **P₇(1/7)**, not P₇(½) — that one gives 14-fold.

**Theorem 2, the regularity result.** For any n ≥ 3 and any non-zero rational
r ∈ (0,1), `Gn(r)` is regular; and for **odd** n ≥ 3, *any tuple* of non-zero
rational offsets is regular. Proved via Conway–Jones on trigonometric diophantine
equations — vanishing sums of roots of unity.

Three consequences for us:

- **At n = 5 that is exactly our corollary**, arrived at independently: no γⱼ an
  integer ⟹ regular. Lutfalla proves it for all odd n.
- **Our statement is under-qualified.** The split `u + φv = 0 ⟹ u = v = 0` needs
  u and v *rational*, so the corollary holds for **rational γ**. The code is safe
  — γ is exact rationals over 2000n by construction — and §5.20 now says
  so.
- **n = 7 is much easier than this plan assumed.** An earlier note that the ℚ(ζ₇) split
  would need a real rederivation was wrong in practice: for odd n the guard is just
  "every offset a non-zero rational", which is trivially enforceable. What does
  *not* generalise is the **exact** criterion — knowing *which* triples are
  singular, which the meter reports. That stays n = 5 for now. And for **even** n
  only the all-equal case is covered, not arbitrary tuples.

**Done — n is a parameter (2026-09-09).** `NUM_GRIDS` is no longer a module
constant that everything reads: `Pentagrid` carries `n`, every family loop in the
geometry and the view reads `pg.n`, and `createGammaSet({ n })` /
`createPentagrid({ n })` take it. n = 5 is unchanged in every observable way —
same denominator, same wording, same palette — and a test pins that, because
method.html must not move under this.

What the threading turned up:

- **The denominator has to be a multiple of n.** γ is carried as exact rationals
  so the guard can *decide*, and the distinguished uniform offset is 1/n — but
  10000/7 is not an integer, so P₇(1/7) was not representable at all. The default
  is now `2000n`, which is 10000 at n = 5 (unchanged) and 14000 at n = 7, and
  keeps both 1/n and ½ exact.
- **`thick` is an n = 5 name.** A grid of order n makes ⌊n/2⌋ rhombs, corner
  angle 2πc/n, so a heptagrid has three. `Rhomb.cls` carries that separation;
  `thick` stays as the pentagrid reading of it (cls 1 is the fat one at 72°,
  but the most *acute* of the three at n = 7).
- **"Regular" needed splitting from "proved regular".** An empty triple list is a
  proof only where the criterion is exact. `provenRegular()` now picks the result
  that applies — exact at n = 5, Thm 2.2 for odd n, Thm 2.1 (uniform only) for
  even n — and the meter says *regularity unproved* rather than *regular, proved*
  when nothing covers the case. `singular()` returns [] off the pentagrid and
  documents that this means "no characterization exists", not "regular".
- **Theorem 2.1 is `isUniform() && noIntegerGamma()`**, which the Σγ-note work had
  already built for a different reason.

Still n = 5 only, and not needed by a grow page: the Wieringa lift (ℝ⁷ has a
5-dimensional perpendicular space, so there is no height function), the Penrose
decorations, `perpBasis` (returns the first of n = 7's two perpendicular planes),
and the exact `TRIPLES` criterion.

### 5.13 The sum, and the flowers (2026-09-09)

Σγ = 0 was hardwired at the time; generalizing it to Σγ = s opened real ground.

**Measured, with all five γ equal to g (so s = 5g):**

| s | g | central figure | index range | thick : thin |
|---|---|---|---|---|
| 0 | 0 | inradius 0 — all five lines concurrent | 0…4 | 1.686 |
| 0.5 | 0.1 | pentagon, inradius 0.1 | 1…5 | 1.656 |
| 1 | 0.2 | pentagon, inradius 0.2 | 2…5 | 1.638 |
| **2.5** | **0.5** | **pentagon, inradius 0.5 — the largest** | 3…7 | 1.589 |

**One correction to the sketch.** The largest pentagon is **γ = ½ each, which
makes the sum 5/2**, not a sum of ½. A *sum* of ½ puts each γ at 0.1 and gives a
small pentagon. Both are worth presets; they are different pictures and it is
worth deciding which "½" the control means. Recommended: the control sets the
**sum**, and the presets are named for what they show rather than for a number.

Beyond g = ½ the pentagon shrinks again — the lines are at `x·v ∈ ℤ − γ`, so g and
1 − g give the same figure. The useful range for the "all equal" preset is g ∈
[0, ½], i.e. s ∈ [0, 5/2].

Worth knowing: **Σγ ∈ ℤ gives Penrose tilings; other sums give the generalised
Penrose tilings.** Still the same two rhombs — thick:thin stays near φ across the
whole range — but not locally isomorphic to Penrose. That is a feature, not a
hazard, and it is most of the reason to want the control.

**Two consequences.**

**The regularity criterion does not care about the sum.** The derivation is
per-triple and only ever involves three γ; it never used Σγ = 0. Verified against
brute force at sums of 0, 0.5, 0.9 and 2.5 — 5/5 agree. So the guard, the meter
and `singularTriples` all keep working untouched.

**The index range does.** It is {1,2,3,4} only when Σγ = 0; at other sums it
shifts and can narrow. The Wieringa roof's "four levels" is therefore a property
of Σγ = 0, not of the construction; `roof.html` and `geometry/roof.ts` both say
so now, and the golden rhombus is untouched either way — a face is spanned by
two E_j, which know nothing about γ.

**The flowers — Σγ ≡ ½ is not Penrose, and we reproduce Figure 4(d).**

Jake, looking at Σγ = 5/2: *"I see the flowers of thin rhombs. We're not in
Penrose anymore there."* Both halves check out, and the second is sharper than
"non-integer sum".

**A vertex census over a ±20 patch**, counting only vertices whose corner angles
sum to 360:

| Σγ | mod 1 | vertex types | all-thin vertices |
|---|---|---|---|
| 0, 1, 2 | 0 | 7 | **0** |
| 0.25, 0.75, 1.25 | ¼, ¾ | 11 | **0** |
| 0.5, 1.5, 2.5 | ½ | 11–12 | **16–25** |

So the flower is the signature of a **half-integer** sum specifically, not of any
non-integer one. Every one of them is `0 thick + 10 thin` — ten thin rhombs at
their 36° corners, 10 × 36 = 360. Penrose has none.

The class turns on **Σγ mod 1**: 0/1/2 share a vertex-type set, 0.5/1.5 share
another, and 0.25 groups with 0.75 by the γ ↔ 1−γ reflection.

**And Σγ = 5/2 is Lutfalla's P₅(½)** — his `Gn(x)` is every offset equal to x, so
G₅(½) is our sum of 5/2. It is Figure 4(d) of the paper, captioned *10-fold*, and
visibly covered in the same blue rosettes. Checked: rotating our tiling by 36°
about the origin maps **100.0%** of vertices onto vertices, which is Theorem 1
confirmed on this implementation. Guarded Σγ = 0 manages only 92.6%, because
all-zeros is singular and forcing regularity costs the exact symmetry.

That is the second independent source this project has agreed with from the other
direction, after wieringa-roof's fold angles.

**One accounting error worth recording.** The first census gave vertices summing
to 576° and 792°, which is impossible in the plane. The corner angle at vertex 0
is the angle *between* v_j and v_k — 72° for |Δ|=1 but **144°** for |Δ|=2 — and I
had written the thin rhomb's angles the other way round, so its 36° and 144°
corners were swapped. The impossible totals are what caught it.

### 5.14 Which inflation, φ or φ² (Jake, 2026-09-09)

Shared vocabulary, so "one generation" stops being ambiguous. There are **two
natural notions of a step**, and they differ by a factor of phi:

| step | linear scale | area scale |
|---|---|---|
| **P1 generation** — a pentagon made out of pentagons | **phi^2** | phi^4 |
| **Robinson / P3 substitution** — rhombs cut and reassembled | **phi** | phi^2 |

So **one P1 generation is two Robinson steps**: phi x phi = phi^2. The Pe1 / Pe3 /
Pe5 generation numbers used across `penrose-mosaic` and `wieringa-roof` count P1
generations, which means a patch labeled generation 3 or 4 is **twice as deep**
in the elementary phi hierarchy as the number suggests. Worth remembering before
comparing a generation number against anything quoted in Robinson steps.

The phi^2 that turns up in the substitution matrix is the *area/count* eigenvalue
of the Robinson step, not a linear factor — tile counts grow by phi^2 per step
while edges grow by phi. Easy to mistake for the P1 linear factor, since it is
the same number.

**Consequence for this plan.** Wherever a note says "one inflation apart" without
saying which, it is ambiguous. [[penrose-mosaic-rhomb-groups]] says exactly that
about the large and small rhomb groups, and it matters: if they are a *Robinson*
step apart they are the intermediate phi level, and if a *P1 generation* apart
they are not. Say which from now on.

**Answered 2026-09-10** — big and little rhombs are **two** Robinson steps apart,
a full P1 generation of φ², so `penrose-mosaic`'s small/large pair is not the
missing half step. The intermediate φ level is ungenerated rather than unfound:
the wheels give it by dropping the middle term of the three-term successor
(§5.10). Measured in this repo: rhomb counts seeded on Pe5 grow toward φ⁴ = 6.854
per P1 generation. Attribution: the φ/φ² distinction and the intermediate-level
conjecture are Jake's.

### 5.15 A hall of mirrors, and telling the mirrors apart (2026-09-09)

Jake's framing: aperiodic tiling is a hall of mirrors — dichotomies, duals,
conjugates, parity, involutions everywhere — and **P1 is the ground truth.
Everything falls from there.** P3 rhombs are the derived view. That is a stance
about the project, not just about the maths: when the two disagree about what a
thing is called, P1 wins, which is exactly what the `Pe5` / `St5` correction
in §4.3 was about.

The discipline the hall of mirrors demands is telling structural resemblance from
accidental. Three kinds turned up, and they behave differently:

**1. Real involutions.** `Sigma-gamma -> -Sigma-gamma` on R/Z. Its fixed points
are exactly 0 and 1/2 — arithmetic, since 2x = 0 mod 1 — and those are precisely
the two distinguished values measured in §5.11: 0 is the vertex-type cap (Penrose),
1/2 is the flower. **That is why there is no harmonic at 1/3 or 2/3**: they are
not fixed points. The symmetric flower staircase is the same involution seen
sideways. (Empirically, comparing vertex-type multisets at c and 1-c gives 4-10%
mismatch in a +-15 window — sampling noise on rare types, so the fixed-point
argument is structural and the measurement only consistent with it.)

**2. Truncated ladders wearing a dichotomy.** Thick/thin is not a pair, it is
floor(n/2) — a ladder of length n, which dissolved into three at n = 7 exactly as
predicted. Large/small rhomb groups are *one inflation apart*
([[penrose-mosaic-rhomb-groups]]), so that ladder is Z; it looks binary only
because `shape-modes.js` builds two generations (`i < 2`), which is also why
`drawDualRhombusPattern`'s `[gen + 1]` throws at gen 1. The parked idea of a
generation index on `penta` / `star` / `deca` is the move that exposes the ladder.

**3. Two points in one class.** Sun/Star is not a structural pairing at all —
both are Penrose and mutually LI, differing only by which center you sit on,
`Pe5` or `St5`. Nothing is exchanged. The rhomb-groups memory already warns this
is not a dual, "a dual exchanges vertices and faces", and warns off blanket
renaming `goThickDual`.

**Where the binary structure comes from.** Most of the two-ness is one fact in
costume: **Q(sqrt 5) has degree 2**, so there is exactly one non-trivial Galois
involution, sqrt5 <-> -sqrt5 and phi <-> -1/phi. From it come the two conjugate
planes E-parallel / E-perp (literally the two embeddings — the "conjugate"), the
two rhombs, and the exact regularity criterion, where `u + phi*v = 0` forces
`u = v = 0` because one real equation splits into *two* rational ones. The test
is n = 7: the real subfield of Q(zeta_7) has degree **3**, and the dichotomies
became trichotomies on cue — three rhomb classes, and a regularity split needing
three equations, which is why de Bruijn's criterion does not generalise and
Lutfalla does not try.

**The anomaly.** Category-1 structure should survive a change of n, and
Sigma-gamma = 1/2 does (it is the 14-fold point at n = 7, and one of the two
type-count minima). But the *other* fixed point, Sigma-gamma = 0, is **not** a cap
at n = 7: 23, 21, 20, 25 types at sums 0, 1, 2, 3, no dip. So being a fixed point
of the involution is not sufficient for distinction, and Penrose's minimality at
five needs something the involution does not supply. Unexplained.

### 5.16 Reverse-engineering a patch back to a pentagrid (Jake, 2026-09-09)

**The question.** Start from a gen-0 core — `Pe5`, `St5` or `deca` — draw the
pentagrid lines that produce it, then step to the next generation and narrow the
lines again. Do the gammas converge asymptotically?

**Yes, and most of the machinery is already built.** `geometry/acceptance.ts` is
exactly this map run backwards: `vertexRealised(pg, K)` asks whether a K-tuple
survives, each surviving vertex is a linear condition on gamma, so the admissible
set is convex, and `convexBoundary` traces it by ray casting from any interior
point. `wiggle.html` already draws it. What Jake is proposing is to drive that
machinery from the *deflation tower* rather than from a hand-picked patch.

**Measured convergence.** Anchoring at a known gamma and growing the patch through
phi-spaced radii:

    radius  vertices   admissible area   area ratio   linear ratio
      1.20         6         1.991e-1         -            -
      1.94        16         6.141e-2       3.243        1.801
      3.14        36         2.350e-2       2.613        1.617
      5.08        93         8.909e-3       2.638        1.624
      8.22       253         3.421e-3       2.604        1.614

The region contracts by **phi in linear size and phi^2 in area per generation** —
2.618 and 1.618 to three figures after the first step settles. So convergence is
geometric with ratio 1/phi = 0.618, which is about 0.209 decimal digits per
generation: pinning gamma to the denominator we carry (1e-4) takes roughly
**17-18 generations**. Worth knowing before building a UI that promises to
converge.

**What it would settle.** Seeding from each of the three cores should converge to
three different gammas — and the `St5` seed is a *constructive* answer to the
Sun/Star centering question, which vertex probing could not reach
because a star's center is a star-shaped gap rather than a vertex figure. That is
the payoff, and it is the reason to build it.

The recognizer was then written (§5.11) and answered Sun/Star by the index
instead; the tower itself is not built. What it would still add: two dimensions
of γ never shrink — sliding along E∥ translates the grid and leaves the tiling
alone — so the tower pins γ only up to that slide, and seeding from `St5` or the
queen would need the P1 shapes placed, not just recognized (§5.10).

### 5.17 E1 — Wiggle room: the ribbon, the growth, and the acceptance region (2026-09-05/06)

Reading **(a)**, ribbon geometry, gave the closed forms below and then
`grow.html`. Reading **(b)** — the region of γ-space that produces a given finite
patch — became `wiggle.html`.

**The ribbon, and its channel.**

Fix a family `j` and a line index `nj`. That grid line's crossings are **exactly
collinear** (max deviation 1.2e-15) and each is one rhomb; all of them share edge
direction **v**ⱼ. That is a de Bruijn ribbon.

The classic picture joins **edge midpoints**, not rhomb centers. For a tile
`f, f+vⱼ, f+vⱼ+vₖ, f+vₖ` the two vⱼ-parallel edges have midpoints `f + vⱼ/2` and
`f + vⱼ/2 + vₖ`, so **every in-tile segment is exactly one unit step `vₖ`**. The
ribbon path is a walk of unit steps in the four non-`j` directions — that is why
it zigzags the way it does.

**The wiggle has a closed form.** Perpendicular spread of a ribbon about its own
generating line, constant to ~1e-14 across 45 ribbons, all five families, and two
different γ, and *attained* rather than merely bounded:

| path through | spread | exact |
|---|---|---|
| rhomb centers | 0.809016994 | **φ/2** |
| edge midpoints (the classic picture) | 1.118033989 | **√5/2** |

Not derived. The naive bound from the ε-terms gives √5 ≈ 2.236, so the true
answer is much tighter and there is structure unaccounted for. One suggestive
fact: **φ is the long diagonal of the thick rhomb**, so the center channel is
half a fat tile's long diagonal. That smells like the reason; it is a guess.

**A wrong prediction, recorded because the reasoning is tempting.** Thick steps
carry you +cos 72° sideways and thin steps −cos 144°, so keeping the walk bounded
looks like it should pin thick:thin along a ribbon to φ². Measured **1.59**,
against 1.61 for the whole tiling — both φ. The error: the step is ±vₖ depending
which way the path traverses that tile, so the sign is not fixed by tile type at
all. The real fact is better: **a ribbon has the same tile mix as the tiling it
sits in.**

**Implementation gotcha.** `collectRhombs` emits `j < k`, so a family appears as
*either* index. Filtering `r.j === j` gets 41 tiles where matching both positions
gets **83** — half the ribbon is invisible if you get this wrong.

**The better exploration: tiles growing out of their crossings** (`grow.html`).

Jake's redirection, and the right one: the ribbon picture is *an* answer, not
*the* answer. Instead of straightening a path, start from the step-2 intersection
dots and let them **grow into the tiles they generate**.

Each dot is not a dot but an infinitesimal Penrose tile, colored as the
composite of the two families whose lines crossed. As `t` rises the tiles grow to
unit size, and some must move because they cannot grow in place.

**The cross decoration.** In a tile's own frame `f + a·vⱼ + b·vₖ`, `a,b ∈ [0,1]`:

```
arm j    a ∈ [0.25, 0.75],  b ∈ [0, 1]
arm k    a ∈ [0, 1],        b ∈ [0.25, 0.75]
center   both — a half-scale rhomb, the composite
```

25 % white, 50 % color, 25 % white, exactly. Both arms run midpoint-to-midpoint
so the cross is centered for free, and **the arms join across shared edges by
themselves**: of 20,528 arm/edge crossing points, 19,856 are shared by exactly
two tiles (the rest are on the patch boundary). So the ribbons are not drawn —
they *emerge* from per-tile decoration. No ribbon logic, no ordering, no filter.

This makes one parameter run **step-2 dots → the tiling → the ribbon picture**.
The composite dot at `t = 0` is literally the center composite of a tile with
zero size.

**There is no struggle, and that is the finding.**

With one clock for every tile, the endpoint of an arm is

```
end_i(t) = (1−t)·qᵢ + t·(cᵢ + eᵢ) = (1−t)·qᵢ + t·M
```

— both neighbors are affine paths from their own crossing to *the same meeting
point* M. So the gap between them is exactly `(1−t)·|qᵢ − qⱼ|`. Measured over all
7,110 neighboring arm-ends: gap/initial = 1.000, 0.750, 0.500, 0.250, 0.000, and
the gap direction slews **0.00°**. Not small — zero, every pair. The tiling zips
itself together with no lateral motion anywhere.

The reason, in Jake's words: they are always ringing the gridline track. Every
tile starts *on* its gridline and ends in a ribbon confined to √5/2 of that same
line, so it never leaves. Belonging to two ribbons, a tile is penned inside the
**intersection of two channels** — a small parallelogram around its own crossing.
That is the entire freedom any tile has.

So the struggle is not in the mathematics; it is something you add. Per-tile
clocks break the shared target and the gap slews:

| schedule | mean slew | max |
|---|---|---|
| uniform | **0.00°** | 0.0° |
| by family | 37.4° | 179.7° |
| crowded finish first | 39.3° | 179.7° |
| thick before thin | 39.7° | 179.7° |
| random per tile | **54.0°** | 179.7° |

180° means some arms overshoot their partner and come back, which would read as a
snap. Note mean *mismatch* is the wrong metric for this — every staggered
schedule beats uniform on it, simply by parking finished tiles.

**Crowding is real and local.** Nearest-neighbor gaps among starting positions:
the tightest 200 average **0.013** — the near-concurrent triples, essentially
coincident — and those tiles travel 0.721 against 0.491 for the loosest. The most
dramatic motion happens exactly where the meter and the loupe were built to look.

**Reading (b) — `wiggle.html`.**

**The recorded obstacle was false.** The plan had said (b) "needs a way to draw a
region of 4-dimensional γ-space". It needs a way to draw a region of a *plane*.

Under the cyclic symmetry ℝ⁵ splits as E∥ (cos/sin 2πj/5) ⊕ E⊥ (cos/sin 4πj/5) ⊕
the all-ones line, and Σγ = 0 kills the last. Of the four dimensions that remain,
**two do nothing to the tiling at all**:

```
γⱼ → γⱼ + w·vⱼ   ⟹   the crossing moves to x₀ − w, but its K-tuple is
                      ⌈vᵢ·(x₀−w) + γᵢ + w·vᵢ⌉ = ⌈vᵢ·x₀ + γᵢ⌉ — unchanged.
```

Same tuple, same `f`. The pentagrid slides and **the tiling does not move**.
Measured: a shift within E∥ leaves **1235 / 1235 tiles identical**, even for
w = (−2.2, 3.1). Shifts within E⊥ genuinely change it — 1005, then 377, then 88
tiles surviving as the shift grows.

So the pattern depends only on the E⊥ component of γ. **γ-space for the tiling is
two-dimensional.**

**And the region is convex.** For a fixed patch, each tile's existence is a set of
*linear* inequalities in γ, hence linear in the two E⊥ coordinates. The admissible
set is a convex polygon, and growing the patch slices off a half-plane per tile.

Three things follow, and they are the reason to build it:

- **Its area, normalized, is that patch's frequency in the tiling.** This is the
  cut-and-project acceptance domain, reached from the "wiggle room" question
  rather than from the standard theory.
- **Crossing an edge of the polygon is a phason flip.** The γ sliders already move
  a point inside it; the moment it leaves, the patch changes.
- It is the literal answer to the question E1 asked. The polygon *is* the room.

**Built.** `wiggle.html` / `src/app/wiggle.ts`. The tiling on the left via
`createPentagrid` with a `patch` layer marking the vertices; the perpendicular
plane on the right as a plain canvas, since it is not a pentagrid. A radius
slider grows the patch, and the dot is **draggable** — which is the whole point.
Drag inside the region and the patch holds; cross the boundary and vertices go
hollow as they stop existing. Double-click re-anchors the patch to wherever you
have landed.

The region is found by **ray casting** from the anchoring γ, which is inside by
construction because the patch was read off it; convexity is what makes one
boundary crossing per ray the whole story. 120 rays, 18 bisections, and the test
for a single γ is `regionPoly(...).length >= 3` — the five strips still share a
point. Cost at the largest patch (173 vertices): **121 ms**, and only on radius
change, never while dragging.

Areas measured, showing the shrink is lumpy rather than smooth:

```
r = 1     5 vertices   room 0.26125
r = 2.5  26 vertices   room 0.06175
r = 4    52 vertices   room 0.02361
r = 5.5 104 vertices   room 0.02022     <- doubling the patch barely moved it
r = 7   173 vertices   room 0.01115
```

Most vertices you add were already forced by the ones inside them; the area only
drops when a genuinely new constraint binds.

**A derivation that failed, worth recording.** The tempting closed form is: K is
realised iff ‖P_{⊥⊕1}(s)‖_∞ < ½ for s = K − γ − ½·**1**. That is wrong — the
ℓ²-orthogonal projection minimizes the *Euclidean* residual, not the max-norm
one, so it over-rejects: 1415 of 3850 genuinely realised tuples failed it. The
honest test is 2D feasibility, which `regionPoly` already does, and which agreed
with sampled truth on all 2721 tuples with no misses.

Four tests in `tools/geometry.test.mjs` cover the claims the page rests on: the
two subspaces are orthogonal, an E∥ shift leaves every tile identical, an E⊥
shift genuinely moves things, and the acceptance region is convex and never grows
as the patch does.

**A cheap win worth taking regardless.** Two of the five sliders do not change the
pattern. Splitting the γ bank into its E∥ part (pans the grid, tiling frozen) and
its E⊥ part (actually changes the tiling) would make that visible on the method
page — and with registration permanent, "drag this and watch the grid slide under
a stationary tiling" is a demonstration in itself. A change to the bank's
callbacks, not new machinery.

### 5.18 E3 — The Wieringa roof (2026-09-06, `roof.html`)

Jake's ask after seeing `grow.html`: the same growth, but standing up.

**The lift costs nothing, because the height was already in the data.** Give
every vertex `z = RISE·ΣK` with `RISE = 1/2` — half its de Bruijn index — and both
rhomb types become the *same* golden rhombus: edge √5/2, diagonals φ:1, angles
63.4349° / 116.5651°. Thick and thin stop being different shapes; which you see
depends only on which corner sits at the shared vertex.

Equivalently the generators are `E_j = v_j + ½ẑ`, and `E_j·E_k / |E_j|² = ±1/√5`
for both |j−k| = 1 and 2 — one condition, both satisfied by the same `c = 1/2`,
which is why a single shape covers both.

In a tile's own frame `z = RISE·(m + a + b)` is affine, so every face stays
exactly planar and the surface is a **height field**. A depth sort over the faces
is therefore exact, and no 3D library is needed — Canvas 2D does it.

**Cross-validated against wieringa-roof.** That project verified these numbers
independently, from deflation rather than from the pentagrid. Measured here over
2384 interior edges:

```
edge length        1.118033989 = √5/2, every edge
interior edges     2384, none flat
thick|thick        36°
thick|thin         36° or 72°
thin|thin          108°
index range        exactly {1,2,3,4} — four levels
```

which reproduces `wieringa-roof/PLAN.md:46` exactly, from the other direction.

The lift lives in `src/geometry/roof.ts` — DOM-free like the rest of `geometry/`,
so the page is not where the mathematics is kept. Four tests cover it.

Since then: the level count follows Σγ (four levels only at an integer total,
§5.13), the height ramp on the flat pages shades by the same index, and the roof
carries the P1 overlay. The oblate and acute golden hexahedra — the roof is the
lid on them — are not built (§6).

### 5.19 The dual map has gain 5/2 (2026-09-05)

The tiling is drawn 2½ times the size of the pentagrid that generates it. Not an
error; a consequence of drawing unit rhombs. But it means the two pictures do not
register.

Writing `K_j(x) = x·v_j + γ_j + ε_j` with `ε_j ∈ [0,1)`,

```
f(x) = Σ K_j v_j = Σ (x·v_j) v_j + Σ γ_j v_j + Σ ε_j v_j
     = (5/2)·x   + const         + bounded wobble
```

because `Σ_j v_j v_jᵀ = (5/2)·I`. That value is forced and cannot involve φ: the
operator is isotropic by the five-fold symmetry, so it is a scalar times the
identity, and the scalar is `tr/2 = (Σ|v_j|²)/2 = 5/2`. The computation never
looks at the angles — five unit vectors, two dimensions.

**What it really is: 5 dimensions to 2.** The construction is the projection of
ℤ⁵ onto a 2-plane. For the orthogonal projection `P: ℝ⁵ → E∥`, each basis vector
satisfies `|Pe_j|² = 2/5` exactly — 2/5 of its squared length lands in the
physical plane, 3/5 in the perpendicular space, and `Σ|Pe_j|² = tr(P) = dim E∥ =
2`. Pythagoras in ℝ⁵. With those correctly normalized images (`|u_j| = √(2/5)`)
the frame operator is exactly the identity and **the dual map has gain 1**. The
5/2 appears only because the page renormalizes to unit rhombs, inflating each
vector by `√(5/2)`. So `5/2 = 1/(2/5)`, and in general n dimensions to d gives
gain n/d.

Which also means registration is not a fudge — it is the natural normalization.

**Where φ actually lives.** Walking one unit along v₀ you cross `2φ = 3.236068`
rhomb edges but net-displace only `5/2`, because the edges are not collinear
(ratio `4φ/5`). φ owns the combinatorics and the shapes; n/d owns the isotropic
gain. A φ-flavored gain would have meant the frame operator was not isotropic,
contradicting the five-fold symmetry the whole construction rests on.

Verified three ways: `n/2` holds for n = 3,5,7,9,11 to nine decimals, so it is a
frame fact and not a Penrose one; direct measurement over 38,550 rhombs built the
way the page builds them gives 2.50156 → 2.50044 → 2.50014 as the patch grows;
and the density ratio (7.6942 regions per unit area against 1.2311 rhombs) is
6.250000 = (5/2)².

**Consequences:**

- A transition from crossing to tile must be `lerp((5/2)·x₀, f, t)`, not
  `lerp(x₀, f, t)` — the latter is a 2.5× zoom-out with the content buried in it. Then the motion is *only* the wobble — each rhomb moves
  at most ~1.6 units and settles — which shows the actual theorem: **the dual map
  is a similarity plus a bounded perturbation.**
- A ribbon-straightening picture (§5.17) has the same defect. Comparing a wiggly dual path
  against its straight generator only means something at matched scale, or the
  2.5× swamps the wiggle being looked at.

**On the page:** registration is permanent — the pentagrid is drawn under
`x ↦ (n/2)x`, so lines sit 2.5 apart and each rhomb lands on the crossing that
made it. Scaling the grid up rather than the tiling down keeps the rhombs at the
size they deserve. You cannot have both registration and edge = line spacing;
the gain is the reason.

### 5.20 Regularity: decided, not tested (2026-09-04)

Two different claims, one of which an earlier draft got wrong. Region *size*
cannot be bounded below — that stands. But exact *concurrency* is a measure-zero
condition, and it is **decidable in closed form** for rational γ.

**The criterion.** Three lines `(j,n): x·vⱼ = n − γⱼ =: cⱼ` are concurrent iff the
3×3 determinant vanishes, which expands to

```
c_a·sin(θ_c−θ_b) + c_b·sin(θ_a−θ_c) + c_c·sin(θ_b−θ_a) = 0
```

For the pentagrid the θ are multiples of 72°, so dividing by sin 144° leaves every
coefficient in {±1, ±φ} — and for all ten triples the split has the same shape:
one `c_j` alone on one side, the other two together on the other. Each condition
therefore reads `u + φ·v = 0` with `u, v` rational, and since φ is irrational
**both** must vanish. The lone term gives `c_L = 0`, i.e. `γ_L ∈ ℤ`; the pair
gives `c_P + c_Q = 0`, i.e. `γ_P + γ_Q ∈ ℤ`. So

```
triple (a,b,c) is singular  ⟺  γ_L ∈ ℤ  and  γ_P + γ_Q ∈ ℤ
```

| triple | lone | pair | triple | lone | pair |
|---|---|---|---|---|---|
| 012 | γ₁ | γ₀+γ₂ | 034 | γ₄ | γ₀+γ₃ |
| 013 | γ₃ | γ₀+γ₁ | 123 | γ₂ | γ₁+γ₃ |
| 014 | γ₀ | γ₁+γ₄ | 124 | γ₄ | γ₁+γ₂ |
| 023 | γ₀ | γ₂+γ₃ | 134 | γ₁ | γ₃+γ₄ |
| 024 | γ₂ | γ₀+γ₄ | 234 | γ₃ | γ₂+γ₄ |

**Corollary: if no γⱼ is an integer, the pentagrid is regular everywhere** — for
rational γ, which is all the instrument can produce. Ten integer comparisons, no
tolerance, no window. This *decides* legality rather than
testing it — which is the thing the float scan can never do, however small its
epsilon.

Verified 205/205 against brute-force search, and the guarded default
(γ = [1,2,3,4,−10]/10⁴) has zero concurrencies out to radius 40 where γ = 0 has
380 out to radius 25.

**Why the old 5e-9 nudge failed, exactly.** Magnitude was never the issue. It left
γ₀, γ₂, γ₃ at exactly 0, and being *symmetric* it preserved γ₁ + γ₄ = 0 — so
triples 014 and 023 stayed singular for any step size whatsoever. Correctness here
is about rationality class, not smallness. The guard now shifts by 1/10⁴ with a
different offset per family, which is both invisible and provably sufficient.

**About size rather than legality:**

- **The old test was a proxy, and a narrow one.** Singularity is a condition on
  integer combinations of the γ's, not on pairwise equality; the table above is
  what it actually looks like.
- **A minimum region *size* still cannot be enforced.** Regularity buys *positive*
  area, never area *bounded below*. As the line indices range over ℤ the
  near-concurrency defects equidistribute (Weyl — the direction ratios are
  irrational), so for **every** γ the infimum of region size over the plane is
  zero. This is why the meter and the loupe are still needed even when γ is
  provably regular.
- **The small triangle is the content.** Three nearly-concurrent lines bound a
  genuine region with a genuine dual vertex; as γ crosses the singular value it
  collapses through zero and the tiling rearranges. That is the phason flip
  the method page promises. Nudging γ to keep triangles fat makes the most
  interesting phenomenon on the page unreachable.

**The meter.** Measured over the visible window, in pixels, live; it reports the
*count* of regions under the hoverable threshold, since the minimum is tiny
essentially always (generic γ at default zoom: 308 regions under 5 px, smallest
0.042 px). The candidate filter is exact: `h = |d − round(d)|` with
`d = P·v_c + γ_c` is the perpendicular distance from a crossing to the nearest
line of a third family.

**Concurrencies are a separate finding and reported separately.** A small
triangle has an interior and the loupe can open it up. Three or more lines
actually meeting have no interior at all, and no magnification will ever help —
that is where the dual stops being a rhombus tiling, though the construction is
not undefined there. Lutfalla: *the dual of an intersection point where k lines
meet is a 2k-gon with unit sides.* Three lines through a point give a hexagon,
not three rhombs. The scan's triangle test misses them by construction (the
triangle degenerates and falls out of the perimeter guard), so they have their
own branch: inradius below a tolerance in **math units**, then dedupe by position
and count how many families pass through the point.

**Γ = 0 is fully singular** — all ten triples, 97 concurrency points in the
default window, the origin among them with all five lines. The guard (*force
regular*) moves off it by 1/10⁴ and says so; unchecking sits on it deliberately.
The default is now the sun, c = 1/5, which is regular untouched.

### 5.21 The loupe (2026-09-04)

Regions are hoverable at *any* size already — `computeKTuple` at the cursor is
exact, so a 0.1 px triangle returns the right K-tuple. **The only thing that
fails is aiming.** So the loupe is magnification and no new picking code.

**Inset panel, not a fisheye.** A radial magnifier is not conformal: straight
lines curve and 72° stops being 72°, on a page whose subject is straight lines at
exact angles. And with `g(0)=0`, `g(R)=R` the mean of `g′` is 1, so `g′(0) > 1`
forces a compression annulus inside the rim — a ring where things are *harder* to
hit than at 1×. Compression ring or discontinuity; there is no third option. The
inset costs none of that.

As built: pinned to a corner, never floating; opens when the smallest region near
the cursor falls below ~5 px; magnification `40 / size_px`, latched on open;
freezes when the cursor enters it and releases on leaving; never closes on
distance (the first cut did, and vanished on the way to the panel); says what it
shows (`12k×  5 lines concurrent`); a footprint rectangle in the main view. Off
by default — it is a tool for near-singular configurations and gets in the way
of looking at the picture.

---

## 6. Not built

Thought about, recorded, not started. None is scheduled.

- **E2 — the pentagrid on the discrete directions.** Fully specified in
  [RESEARCH.md](RESEARCH.md): replace the 72° directions with the limiting
  directions of penrose-mosaic's integer construction, `arctan((3−φ)/2) =
  34.6438°` and `arctan((5+3√5)/4) = 71.1377°`, and dualize that. `n` and
  `directions` are already parameters, so the coupling is gone; what breaks is
  the thick/thin classification (three edge lengths, up to ten parallelogram
  types — whether it stays two shapes *is the first result*) and the meaning of
  Σγ. The payoff: the old prediction that the discrete construction converges
  back to standard Penrose has closed forms saying otherwise, so it is
  falsifiable.
- **Phason flips in slow motion.** Crossing a singular γ rearranges tiles
  locally; the hunt presets put you on one and `wiggle.html` shows the boundary.
  A page that animates one crossing is the payoff for the exact criterion.
- **An exact certifier.** The scan is floats and `Math.ceil(dot + γ − 1e-9)` is a
  float with a fudge; at extreme loupe magnification that epsilon is the floor.
  The pentagrid lives in ℚ(ζ₅), degree 4, so every crossing is four BigInt
  rationals and concurrency is a decision. Not for the hot loop — as a one-shot
  "this γ has no concurrency in this window", which the meter cannot say.
- **The ℚ(√5) two-component phase.** Whether phases carried as `a + b√5` reach
  configurations a rational denominator cannot. Jake: "that's another app".
- **The golden hexahedra.** Oblate and acute; the roof is the lid on them
  (wieringa-roof's triacontahedra note).
- **The LI-class strip.** A row of patches across Σγ ∈ [0,1), so the flowers
  appear and disappear as you sweep — Levochik's figure, redrawn from our own
  geometry (the SVG is CC BY-SA). A layout job.
- **E∥ / E⊥ split of the instrument.** Two of the five phases only slide the
  grid under a stationary tiling (§5.17). Showing which is which on the
  reticulum is a change to callbacks, not machinery.
- **The deflation tower.** Drive the acceptance region from generations of a
  seed rather than a hand-picked patch (§5.16); convergence is 1/φ per
  generation, ~18 generations to the denominator we carry.
- **P1 round trip.** rhombs → P1 recovers only the Pe family; placing the St
  tiles is the missing half (§5.10). With both directions the Robinson half-step
  becomes visible in the six P1 shapes.
- **devicePixelRatio.** The backing store is CSS pixels, so the canvas is soft on
  a retina display. A couple of lines, but it changes how everything renders.
