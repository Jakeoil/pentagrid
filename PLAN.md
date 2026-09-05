# Pentagrid — Plan

What this project is, what is open, and what to build next.

Research questions with real mathematical content live in [RESEARCH.md](RESEARCH.md).
This file is the working plan.

---

## Orientation

State of play, verified 2026-09-05. Working tree clean and in sync with origin.

- `src/method.ts` (~2100 lines) is essentially the whole project. Plain `tsc` to
  `dist/`, no bundler, no runtime dependencies. `.github/workflows/deploy.yml`
  builds and publishes the repo root to Pages, so any new top-level `.html` is
  live on push with no configuration. `npm run build` stamps `src/build-id.ts`
  first; the page shows that id beside the step indicator.
- Stacked canvases in a relative container: `background` (z 5), `grid-0..4`
  (z 10–14), `axes` (z 20), `content` (z 50), `highlight` (z 55), `footprint`
  (z 60), `event` (z 100, takes all input), plus the pinned loupe panel.
- Visibility is two-level: `layer.visible` is step-driven, `layer.userVisible` is
  the checkbox. Grid alpha is CSS opacity per step, not a redraw. `userVisible`
  is not merely cosmetic — `collectRhombs` skips family pairs whose layer is off.
- The math layer is clean. `solveIntersection` / `computeRhomb` / `collectRhombs`
  return plain data; every draw function takes its target context first. `scale`,
  `viewX`, `viewY` are globals swapped by `withView` rather than threaded.
- Regularity is decided exactly (item 1), the loupe is built (item 2), and the
  5/2 gain is understood and has a toggle (item 3).
- **Still open: item 4, rhomb provenance.** `Rhomb` is `{vertices, kTuples,
  thick}`; `computeRhomb` receives `j, k, nj, nk, x0, y0` and discards all six.
  Item 5 (split geometry recompute from render) is also open. Both gate the work
  in *The method page, reorganised* below, and item 4 gates the explorations.

---

## Open items

These come first because they are cheap, and because items 4 and 5 gate the
explorations below — and item 3 changes what two of them should say.

### 1. Regularity: prove it, and guard it — DECIDED 2026-09-04, corrected same day

**Correction first.** An earlier draft of this item said regularity could not be
enforced and should only be measured. That conflated two different claims and
one of them is false. Region *size* cannot be bounded below — that argument, and
the 0.042 px measurement under it, still stand. But exact *concurrency* is a
measure-zero condition, and it turns out to be not merely avoidable but
**decidable in closed form**. The guard was always achievable; it was removed on
the strength of an argument that did not apply to it.

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

**Corollary: if no γⱼ is an integer, the pentagrid is regular everywhere.** Ten
integer comparisons, no tolerance, no window. This *decides* legality rather than
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

**Everything below still holds, about size rather than legality:**

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
  Step 6 already promises. Nudging γ to keep triangles fat makes the most
  interesting phenomenon on the page unreachable.

**One more reason, found by measurement.** The old nudge did not even do its one
job. Perturbing `γ₁ += 5e-9`, `γ₄ -= 5e-9` from the singular default still leaves
**29 exact three-line concurrencies** in view. Of course it does: a concurrency
among families {0,2,3} is a condition on γ₀, γ₂, γ₃ alone, so moving γ₁ and γ₄
cannot touch it. Pairwise γ nudging can never remove concurrencies.

**What to build instead — a regularity meter.** Measured over the visible window,
in **pixels**, live. Geometric rather than a proxy, continuous rather than binary,
in screen units so it means what it needs to mean.

**Report the count, not the minimum.** The minimum alone is useless: a *generic*
sum-zero γ at default zoom already has a smallest region of **0.042 px**. Not a
near-singular configuration — an ordinary one. With ~1000 triples in a window,
equidistribution guarantees the minimum is tiny essentially always, so a bare
minimum reads red permanently and says nothing. The count of regions under the
hoverable threshold is the number that responds: zoom in and it falls, because
fewer triples are in view and each renders larger. (Generic γ at default zoom:
308 regions under 5 px.)

This is a stronger form of the argument above. It is not merely that no γ bounds
region size below over the plane — no γ bounds it below over a *single 800 px
window at default zoom*. Sub-pixel regions are the normal state of the picture,
not an exceptional one, which makes the loupe the actual answer and the meter a
readout of how much is hiding.

Finding it cheaply. The candidate filter is exact, because the direction vectors
are unit vectors:

```
for each family pair (a,b) and line indices (na,nb):
    P = intersection                    # collectRhombs already computes this
    for each third family c:
        d = P·v_c + γ_c
        h = |d − round(d)|               # ⊥ distance from P to the nearest
                                        # line of family c, exactly
        if h·scale < ~20 px:            # candidate
            build the triangle from (a,na), (b,nb), (c,round(d))
            size = 2·inradius, in pixels # "how big a target is it"
```

Caveat worth a comment in the code: a fourth line can cut the triangle, in which
case the true region is smaller than reported. Rare at the sizes that matter —
lines are one unit apart and these triangles are tiny — but the meter is
optimistic, not conservative, when it happens.

**Concurrencies are a separate finding and must be reported separately.** A small
triangle has an interior and the loupe can open it up. Three or more lines
actually meeting have no interior at all, and no magnification will ever help —
that is where de Bruijn's construction is undefined, not merely inconvenient. The
scan's triangle test misses them by construction (the triangle degenerates and
falls out of the perimeter guard), so they need their own branch: inradius below
a tolerance in **math units**, then dedupe by position and count how many
families pass through the point.

The page's **default γ = 0 is fully singular** — all ten triples, 97 concurrency
points in the default window, the origin among them with all five lines. It is the
classic five-fold symmetric configuration, so the guard (on by default, one
checkbox) moves off it by 1/10⁴ and says so; unchecking the guard sits on it
deliberately, which is how a phason flip gets watched.

Companion control: **go to the smallest region in view.** Turns the near-singular
configuration from a hazard into a destination, and is the entry point for a
phason-flip page later.

### 2. The loupe — DECIDED 2026-09-04

Regions are hoverable at *any* size already: step 3's hover calls
`computeKTuple(mx, my)` at the cursor point, which is exact — no threshold, no
nearest-neighbor search. A 0.1 px triangle already returns the right K-tuple.
**The only thing that fails is aiming.** So this is magnification and no new
picking code at all.

**Inset panel, not a fisheye.** A radial magnifier is not conformal, so inside it
straight lines become curves and 72° stops being 72° — an unusually expensive
distortion for a page whose whole subject is straight lines at exact angles.
A constraint bites even before that: with `g(0)=0` and `g(R)=R`, the mean of `g′`
over `[0,R]` is exactly 1, so `g′(0) = n > 1` forces `g′ < 1` somewhere — a
compression annulus just inside the rim, where things are *harder* to hit than at
1×. Avoiding it needs `g(R) > R`, which puts the discontinuity back. Compression
ring or discontinuity; there is no third option.

The inset costs none of that: lines stay straight, angles stay true, and picking
is `screenToMath` at a different scale and center.

Behavior, as settled:

- **Pinned to a fixed corner** of the canvas. Not floating — it must never
  occlude what is being studied, and travelling to it must be an unambiguous
  gesture rather than something that happens while aiming.
- **Opens automatically** when the smallest region within ~20 px of the cursor
  falls below ~5 px. Same quantity as the meter at a different radius: meter =
  min over the window, loupe = min near the cursor.
- **Adaptive magnification**, `n = 40 / size_px`, so the target always arrives at
  a workable size — 8× or 800× as needed. **Latched on open**, otherwise the
  content zooms continuously as the cursor moves and the panel is unreadable.
- **Freezes when the cursor enters it.** Entering is the commit gesture: the view
  locks and stays locked while hovering inside, and leaving releases it. This is
  what removes the trapping problem — whatever would re-trigger the loupe is in a
  different panel from the thing now being hovered.
- **Never closes on distance.** The first cut closed the loupe as soon as the
  cursor moved off the target, which meant it vanished on the way to the panel and
  could not be entered at all. It retargets on approach to something new, and is
  dismissed with Esc — but "nothing nearby" is not a reason to close, because
  travelling to the panel *is* moving away from the target.
- **Says what it is showing.** `12k×  5 lines concurrent`, or `40×  region 0.04
  px`, plus a "move in to hover" hint while unfrozen. Without the hint there is no
  way to discover the panel is interactive.
- A **footprint rectangle** in the main view showing what the loupe covers, and a
  **magnification label** on the loupe, since `n` is adaptive and ranges over
  orders of magnitude.

Fallback if auto-open proves twitchy: **click-to-lock** — click within a few px of
the tight spot, loupe locks there, Esc releases. No hysteresis tuning at all.

**Prerequisite:** `scale`, `viewX`, `viewY` are module-level globals read
implicitly by every draw function, and the loupe is a second view. Either thread a
view parameter through everything, or save/swap/restore the globals around the
loupe's render. The latter is far less invasive and needs no change to any draw
function.

### 3. The dual map has gain 5/2 — FOUND 2026-09-05

The tiling is drawn 2½ times the size of the pentagrid that generates it. Not an
error; a consequence of drawing unit rhombs. But it means the two pictures do not
register, and it quietly corrupts two specs below.

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
2`. Pythagoras in ℝ⁵. With those correctly normalised images (`|u_j| = √(2/5)`)
the frame operator is exactly the identity and **the dual map has gain 1**. The
5/2 appears only because the page renormalises to unit rhombs, inflating each
vector by `√(5/2)`. So `5/2 = 1/(2/5)`, and in general n dimensions to d gives
gain n/d.

Which also means registration is not a fudge — it is the natural normalisation.

**Where φ actually lives.** Walking one unit along v₀ you cross `2φ = 3.236068`
rhomb edges but net-displace only `5/2`, because the edges are not collinear
(ratio `4φ/5`). φ owns the combinatorics and the shapes; n/d owns the isotropic
gain. A φ-flavoured gain would have meant the frame operator was not isotropic,
contradicting the five-fold symmetry the whole construction rests on.

Verified three ways: `n/2` holds for n = 3,5,7,9,11 to nine decimals, so it is a
frame fact and not a Penrose one; direct measurement over 38,550 rhombs built the
way the page builds them gives 2.50156 → 2.50044 → 2.50014 as the patch grows;
and the density ratio (7.6942 regions per unit area against 1.2311 rhombs) is
6.250000 = (5/2)².

**Consequences, both of which correct specs written earlier:**

- The transition lerp recorded under *On animation* is wrong. `lerp(x₀, f, t)`
  interpolates between grid scale and 2.5× scale, so the animation is dominated
  by a 2.5× zoom-out with the real content buried under it. It must be
  `lerp((5/2)·x₀, f, t)`. Then the motion is *only* the wobble — each rhomb moves
  at most ~1.6 units and settles — which shows the actual theorem: **the dual map
  is a similarity plus a bounded perturbation.**
- E1's ribbon straightening has the same defect. Comparing a wiggly dual path
  against its straight generator only means something at matched scale, or the
  2.5× swamps the wiggle being looked at.

**On the page:** a *register scales* toggle drawing the pentagrid under
`x ↦ (5/2)x`, so lines sit 2.5 apart and each rhomb lands on the crossing that
made it. Scaling the grid up rather than the tiling down keeps the rhombs at the
size they deserve. You cannot have both registration and edge = line spacing;
the gain is the reason.

### 4. Rhombs should carry their provenance

`computeRhomb(j, k, nj, nk, x0, y0)` receives everything about where the rhomb
came from and stores none of it — the `Rhomb` interface keeps only
`{vertices, kTuples, thick}`. `x0, y0` are used to resolve the three
non-participating K values and then discarded.

Store `j, k, nj, nk, x0, y0` on the `Rhomb`. It is a few lines, and it is the
single change that unlocks **both** the transition animation and Exploration 1.
Do this before either.

### 5. Split geometry recompute from render

Right now `collectRhombs` runs on every `draw()`. At default zoom that is a few
thousand `solveIntersection` calls — fine. Zoomed out, `maxN` clamps at 50, so
101² × 10 ≈ **100k solves per frame**. Fine at one frame per click; fatal at 60.

`drawKRegions` is the same story from the other direction: a per-pixel
`ImageData` fill over 720×720, five dot products and a ceiling each.

The fix for both: **the rhomb set and the K-region bitmap depend on γ and the
view, not on any animation parameter.** Recompute them when γ or the view
changes; at scrub time only re-render. The layer architecture already makes the
K-region cache easy, since it is its own canvas.

The regularity scan (item 1) has exactly the same dependency and should share
whatever cache this produces.

### 6. ~~README is stale~~ — DONE 2026-09-05

Rewritten: six steps with the current titles, the layer toggles and the two hover
behaviours, the three non-obvious findings (exact regularity, sub-pixel regions
and the loupe, the 5/2 gain), the build-stamp workflow, and pointers here and to
RESEARCH.md. Live link now points at the site root rather than `method.html`.

### 7. ~~`src/index.ts` is vestigial~~ — DONE 2026-09-05

Deleted along with its `dist/` output when `index.html` became a static page.

---

## The method page, reorganised

Requested 2026-09-05. The individual asks below are one design, and this is the
idea holding them together:

> **Features stop being step-gated. They become independent booleans, and the six
> steps become presets over them.**

Right now eight places switch on `currentStep`, so every capability is welded to
the step that introduced it — intersection dots exist only at step 2, filled
tiles only at step 6. Making them flags and letting the steps *set* the flags
costs little and answers most of the list at once. Prev/Next still walks the
narrative; it just stops being the only way to reach anything.

### Layers

- **Penrose gets its own layers**, split by what they draw: tiles, edges,
  vertices, decoration. Cleans up the `content` catch-all, which currently holds
  four unrelated things behind a switch.
- **Orderable front or back** relative to the grid, so the tiling can sit over
  the pentagrid or under it.
- **One coordinate system, not two.** Registration (item 3) becomes permanent
  rather than a toggle, so grid and tiling always share coordinates. The toggle
  existed to make the 5/2 visible; the layer switch replaces it, and the tiling
  can simply be hidden instead.

### Settings, collapsed

Behind a settings button — set once, then forgotten:

- **`allow singularities`, default false.** The inverse of today's `keep γ
  regular`. The current framing exposes as a choice something that is almost
  always wrong to want; the escape hatch is only there to sit on a singularity
  and watch a phason flip, which is a deliberate act, not a default-facing knob.
- **Vertical-axis symmetry, default on.** Rotate the directions 90° so v₀ points
  up and family 0's lines are *horizontal*. The five directions are then mirror
  symmetric about the vertical axis (angles 90, 162, 234, 306, 18). Jake's
  preferred orientation across all his Penrose work, so it is the default rather
  than an option to find. Note this cannot disturb item 1: the concurrency
  condition depends only on angle *differences*, which a common rotation
  preserves.
- **Gridline thickness.** Sometimes you just have to see them.

### Settings, out in the open

Per-view toggles, visible next to the layer switches:

- Dots on intersections — at any step, not only step 2
- Show the corresponding Penrose **vertex** on region hover
- Show the corresponding Penrose **tile** on intersection hover
- Show **all** Penrose vertices, restricted to the active grid layers
- Show **all** Penrose edges
- Show **all** Penrose tiles — solid fill, and/or the standard arc decoration

### Order of work

1. **Item 4 first — rhomb provenance.** "Penrose tile on intersection hover"
   cannot be built without it: hovering a crossing has to find *its* rhomb, which
   means the rhomb must remember the `(j, k, nj, nk, x₀)` that made it. This is
   the same few lines the explorations have been waiting on.
2. Feature flags, and the steps rewritten as presets over them.
3. Penrose layers split out, ordering control, registration made permanent.
4. The settings panel: collapsed group, symmetry, thickness.
5. The open toggles, and intersection picking for the tile-on-hover.
6. The arc decoration — the classic two-arcs-per-rhomb marking whose curves close
   into loops across the tiling. Self-contained, and last.

### One thing to watch

Item 5 (split geometry recompute from render) stops being optional here. Every new
"show all" toggle is another consumer of `collectRhombs`, which already runs on
every draw and hits ~100k intersection solves per frame when zoomed out. Turning
three of these on at once with no cache will be felt.

## Parameterising the canvas

Decided 2026-09-05, after weighing four shapes for it: a config object plus
`createPentagrid()`, a class, a module split with explicit context, or a web
component. The component turned out not to be an alternative — it is a wrapper
over whichever of the other three you pick, so it is a later skin, not a choice
instead of them.

**Chosen: the module split, reached in stages**, each independently useful and
committable. What decides it is the explorations: `wiggle.html` needs the same γ
cluster and grid layers but its *own* content layer, and no feature flag in
`method.ts` will ever name "ribbons". A closed `Features` enum cannot express
that; layer registration can, and only the split lets an exploration's draw
function be written without importing the whole page.

A second reason, particular to how this project gets verified: every check this
session re-implemented the geometry from scratch — the small-region scan, the
regularity criterion, the 5/2 gain, the arc joins. Four re-derivations, any of
which could drift from what the page actually runs. With a DOM-free `geometry/`
they become tests importing the real code, and `pagecheck` goes back to covering
wiring, which is all it should ever have covered.

The build already supports this for free: `tsc` with `include: ["src"]` and plain
ES modules means multiple entry points need no bundler and no configuration.

### Stages

1. **~~Canvas size into the view~~ — DONE 2026-09-05.** `CANVAS_W`/`CANVAS_H` and
   `MARGIN` are gone; a `CanvasSpec` is read once from the page and everything
   downstream goes through it (83 sites). Explicit `data-width` / `data-height` /
   `data-margin` on `#canvas-container` win; otherwise the container's own
   laid-out size, then 800. Margin keeps its *proportion* (5% of the short side,
   still 40 at 800) rather than its number, so the K-labels keep a gutter at any
   size. `pagecheck` now takes `PAGECHECK_SIZE` and `PAGECHECK_ATTR` and is run at
   several sizes including non-square.
2. **~~Extract `geometry/`~~ — DONE 2026-09-05.** Five modules, no DOM and no
   module state: `types`, `pentagrid` (directions, crossings, K-tuples, rhombs),
   `regularity` (the criterion and the small-region scan), `region` (the map run
   backwards), `decor` (arc geometry; drawing stays in the page). `method.ts`
   keeps thin adapters over a `model` built once from the two const arrays it
   mutates in place, so the call sites did not change: −281 lines, +74.

   **16 tests** in `tools/geometry.test.mjs` (`npm test`) against the real
   modules, replacing four throwaway re-derivations. Where a test needs an oracle
   — the brute-force concurrency search — it is written longhand in the test file
   on purpose: an oracle that imports the code under test proves nothing.

   Writing them found two real defects, which is the argument for having done it:

   - **The scan was reading the wrong rectangle.** It was handed the *tiling*
     visible rect while working in grid coordinates. Harmless when the gain was 1;
     once registration became permanent it meant scanning 6.25× the area and
     counting regions that are not on screen toward the meter. Now takes the grid
     rect.
   - **The page's γ cannot represent a 5e-9 nudge.** Over a denominator of 10⁴ it
     rounds to zero, so in the shipped code the old nudge was not merely
     ineffective — it did not exist. A second reason, independent of the symmetry
     argument in item 1, that it could never have worked. Locked in as a test.

   Also worth knowing: `Math.round` of a tiny negative gives `-0`, which is
   strictly-deep-unequal to `0` but behaves as zero everywhere it matters,
   including the criterion's `% den === 0`.
3. **~~Two clusters as factories~~ — DONE 2026-09-05.**

   `src/ui/dials.ts` — `createGammaBank({count, colors, onChange, onLock})`
   returning `{element, sync}`. It is a view over a vector of numbers with one
   index held as the dependent one: it reports which slider moved and which label
   was clicked, and renders what it is told. **It never computes the locked
   value** — that Σγ = 0 is the constraint is the page's business, not the bank's,
   which is what makes it a multigrid widget rather than a pentagrid one.

   One detail worth keeping: `sync` writes back to the *computed* slider only.
   Writing to the one under the user's thumb would fight the drag.

   `src/ui/loupe.ts` — `createLoupe({container, render, onHover, tooltip})`. Given
   a point, a magnification and a label, plus a callback that paints its own
   content at the panel's view. It has no idea what it is magnifying. What stayed
   behind in `pentagrid.ts` is only what this page can say: what counts as a
   target, how to paint the magnified grid, and what a point under the cursor
   means.

   **13 tests** in `tools/ui.test.mjs`, driving both with no pentagrid in sight —
   which is the only way the reuse claim means anything. The DOM stub grew
   per-element `children` and `on` so a test can walk what a factory built and
   fire its handlers, rather than only checking construction did not throw.
4. **~~Layer registration~~ — DONE 2026-09-05** (out of order; it does not depend
   on stage 3). `src/view/layers.ts` holds `LayerStack`, page-agnostic: it knows
   about canvases, z-order and visibility, and nothing about pentagrids. An
   exploration registers a spec rather than importing the method page.

   Layers **declare** instead of being commanded. `visible` and `opacity` are
   predicates read at draw time, so a step preset changes what is drawn by
   changing what those predicates see — no caller has to remember to update a
   flag on a layer, which is what `draw()` used to spend twenty lines doing. The
   stack also clears before each draw, so no layer has to remember that either,
   and hides with `display:none` rather than clearing, so hiding an expensive
   layer costs nothing.

   **The panel is generated from the stack.** A layer registered with a `group`
   gets its switch without anyone editing the panel code — which is the test of
   whether registration is real. `addRaw` covers the canvases the stack should
   size and position but never draw: the highlight and footprint overlays and the
   input surface.

   The old `overlay` catch-all is gone: intersection dots and K-labels are their
   own layers now, so they toggle independently like everything else.

   **10 tests** in `tools/layers.test.mjs`, the last of which is the reason the
   stage exists — it registers a "ribbons" layer after the fact, knowing nothing
   about the layers already there, and checks it draws, receives a usable context,
   gets its own panel section, and is gated by the generated toggle. The DOM stub
   moved to `tools/domstub.mjs` so pagecheck and the tests share one.
5. **~~`createPentagrid(config)`~~ — DONE 2026-09-05.** `src/view/pentagrid.ts`
   holds the factory; `src/method.ts` is now twenty lines that hand it the page's
   five elements, `METHOD_STEPS` and the build id. `src/app/method-steps.ts`
   holds the narration, because a page's prose is content, not machinery.

   The config takes container, the four control elements, `steps`, `presets`,
   `buildId`, and a **`layers` callback** — the registration hook. It runs before
   the panel is generated, so an exploration's layers get their switches like
   anything else, and it is handed `{ stack, model, currentRhombs, withView,
   gridView, redraw }`: what a layer needs and nothing more.

   Sizing stayed implicit-from-container, so a second instance sizes itself from
   its own host. Two instances on one page are independent.

   **5 tests** in `tools/factory.test.mjs`: constructs from a bare container,
   builds two independent instances at different sizes, takes custom narration
   and clamps out-of-range steps, and registers a "ribbons" layer through the
   config — checking it draws, gets a live `currentRhombs` whose rhombs carry
   provenance, and gets its own panel section without the panel knowing.

   Stage 3 (γ bank and loupe as `{element, sync}` factories) is the only one left,
   and it is now optional rather than blocking: a second page can already exist.

State ownership, decided alongside: **a central model with clusters as views over
it**, each with a `sync()`. That is already the seam — `syncPanel()` is exactly
this — and it survives a page that drives γ from something other than sliders.

Which clusters are honestly reusable: the **γ dial bank** (any multigrid), the
**loupe** (any canvas view — the most portable code in the file), the **step nav
and explanation** (any narrated page). The **layer panel** should be *generated
from* the layer list rather than reused, and the **regularity meter** is
pentagrid-specific and should not try to be general.

### The exercise that proved it

`index.html` now carries two linked viewports — the same random pentagrid drawn
as lines on the left and as its dual tiling on the right, with pan and zoom on
either driving the other. `src/app/pair.ts` is 50 lines and imports nothing from
`method.ts`, which is the whole claim.

It found four things the factory was missing, all now added:

- **`gridLines` and `axes` as features.** A family's `userVisible` also removes
  the rhombs that family generates, so switching the grid off on the tiling side
  would have left nothing to draw. Hiding and not-participating had to become
  separate ideas.
- **`config.features`**, so a page with no steps can state its own set rather
  than inheriting step 1's.
- **`config.gamma`**, so two instances can be given the same pentagrid.
- **`getView` / `setView` / `onViewChange`.** `setView` deliberately does *not*
  fire `onViewChange`, which is what stops two linked instances bouncing updates
  off each other forever — a one-hop relay rather than a loop.

Also needed: a page with no steps had to stop throwing. `updateStepUI` indexed
`stepContent[currentStep]` unconditionally, and `setStep` is now a no-op rather
than an error when there is nothing to step through.

Six more tests, including the two that matter for this shape: `setView` does not
notify, and two instances given the same γ produce rhomb-for-rhomb identical
tilings while different γ do not.

**The loupe is now off by default** (item 2's `loupe` config flag, and a
checkbox in the method page's settings). It is a tool for inspecting
near-singular configurations and it gets in the way of simply looking at the
picture. Turning it off exposed a worse problem: `scanSmallRegions` — the
expensive call in the file — was running on every draw whether or not anything
would read the result, so the paired views were paying for it twice per pan
frame. It is now skipped unless the loupe is on or the page has somewhere to put
the meter.

### Still available, not taken

- **devicePixelRatio.** The canvas is an 800-wide backing store at 800 CSS px, so
  it is soft on a retina display. Now that size flows through one place this is a
  couple of lines — but it changes how everything renders, so it is its own step.
- **`ResizeObserver`.** "Implicit" sizing currently means *read the container
  once*. Observing it would make the page stop being one fixed size forever.

## Site structure

Three top-level pages, following the shape wieringa-roof uses.

| page | content | state |
|---|---|---|
| `index.html` | front door — what a pentagrid is, why it matters, links out | done |
| `method.html` | the mathematics — de Bruijn's dual construction in six steps | done |
| `explorations.html` | index of the explorations, each linking to its own page | deferred |

`index.html` is a static page — no script, and `src/index.ts` is gone with it.
It states the construction, links to `method.html` as the spine, and surfaces the
three things that are not obvious from looking at the method page: that
regularity is decided rather than tested, that sub-pixel regions are the normal
case and the loupe is the answer, and that the tiling is 5/2 the grid.

`explorations.html` is **deferred until there is an exploration page to index**.
An index of zero pages is worse than a section, so for now the explorations are a
"planned" block on `index.html`; that block moves to its own page as soon as
either E1 or E2 has one.

`method.html` stays as it is. It is the explanatory core and everything else
assumes it. The explorations link back to it rather than re-deriving.

Each exploration gets its **own page** — `wiggle.html`, `discrete.html`, and so
on. They are projects unto themselves, not extra steps bolted onto the method
walkthrough. Sharing happens at the source level (`src/`), not by overloading one
page with modes.

---

## Explorations

### E1 — Wiggle room, and watching the grid lines straighten

The picture: a patch of tiles with the transformed grid lines drawn across it,
wandering through the rhomb centers, then straightening into the actual
pentagrid.

**The mechanism is already latent in the data.** Fix a family `j` and a line
index `nj`. That single grid line crosses lines of all other families; each
crossing is one rhomb, and all of them share edge direction **v**ⱼ — that is a
de Bruijn ribbon. Ordered along the line, the crossings give points `x₀` that lie
*exactly on the straight grid line*; their dual images `f` give the wandering
chain of rhomb centers.

So the two polylines are the same list of rhombs read two ways, and

```
p_i(t) = lerp((5/2)·x₀_i, f_i, t)
```

is the straightening animation. At `t = 0` the ribbon path *is* the straight grid
line, by construction. At `t = 1` it is the wiggly chain. This is the same lerp
the tile transition needs, applied to ribbon polylines instead of tile vertices —
which is why item 2 comes first.

Selecting a ribbon is `j, nj` — a field on the rhomb once item 2 is done, so
"highlight the ribbon through this tile" is a filter, not a search.

**One ambiguity to settle.** "Wiggle room of the grid line combinations" may mean
a second thing, and it is also worth building:

- **(a) ribbon geometry** — how far the dual path deviates from its straight
  generator. The reading above, and clearly what the second sentence describes.
- **(b) γ-space freedom** — for a *given finite patch*, the set of γ producing
  that patch is an open region in the sum-zero hyperplane. As the patch grows
  from 1 to x tiles, that region shrinks. Showing the patch beside its admissible
  γ-region, and watching the region close as tiles are added, is a different
  exploration with the same name.

(b) is the more interesting mathematical object — it is patch frequency and local
isomorphism made visible — but it needs a way to draw a region of 4-dimensional
γ-space. (a) is buildable immediately. **Decide whether these are one exploration
or two before starting.**

### E2 — The pentagrid on the discrete directions

Fully specified in [RESEARCH.md](RESEARCH.md): replace the 72° directions with
the limiting directions of penrose-mosaic's integer construction —
`arctan((3−φ)/2) = 34.6438°` and `arctan((5+3√5)/4) = 71.1377°` — and dualize
that instead.

Three code-shape notes RESEARCH.md does not make:

- `directions[]` is built once at the top of `method.ts` from `2πj/5`. It has to
  become a basis *choice* before this is reachable. That is the whole coupling —
  everything downstream already reads from the array.
- **The thick/thin classification breaks.** `min(k−j, 5−(k−j)) === 1`
  (`src/method.ts:666`) hardcodes the 5-fold assumption. With three distinct edge
  lengths (4, √13, √17) there are up to ten parallelogram types rather than two
  golden rhombs, so the classification and the two-color legend both have to
  generalize. Whether it stays two shapes *is the experiment's first result*.
- **Sum-zero loses its meaning.** The γ constraint is specific to the 5-fold
  case. On arbitrary directions this is a generalized de Bruijn multigrid and the
  constraint has to be restated or dropped — which is the same conversation as
  open item 1.

The payoff, per RESEARCH.md: the old prediction that the discrete construction
converges back to standard Penrose has closed forms saying otherwise. This makes
it falsifiable rather than speculative.

### Later slots

Not scoped, recorded so they aren't lost:

- **Phason flips.** Step 6's text already promises them. Crossing a singular γ
  rearranges tiles locally — animating one crossing in slow motion is a natural
  page, and it is the payoff for getting item 1 right.
- **Exact arithmetic — largely delivered, see item 1.** The regularity question
  turned out to need only ℚ(√5), not the full cyclotomic field, and reduces to ten
  integer comparisons on γ held as exact rationals. What remains open is the same
  treatment for the *K-tuples*: `Math.ceil(dot + γ − 1e-9)` is still a float with a
  fudge, and at extreme loupe magnification that epsilon is the real floor.
  Original note, still true of the general case: exact arithmetic would not
  *prevent* singularities — singularity is a property of γ, not of precision; at
  γ = 0 five lines genuinely meet at the origin and no arithmetic changes that.
  What it buys is **decidability**.
  `CONCURRENT_TOL = 1e-9` is currently a guess: a triple 1e-10 apart is called
  concurrent, one 1e-8 apart is not, and neither verdict is certain. The pentagrid
  lives in the fifth cyclotomic field, degree 4 over ℚ, so points, γ and every
  intersection are exactly representable as four BigInt rationals, and
  concurrency becomes a decision rather than a threshold. Jake's instinct about
  primes is half right: with γ over a common denominator q, concurrency becomes an
  integer condition, and choosing q to avoid the low-height relations gives a γ
  that is *provably* regular over a stated window — something no amount of nudging
  or measuring can deliver.
  Not worth it in the scan, which is the hot loop and needs floats for the
  display anyway. Worth it as a one-shot **certifier**: "this γ has no concurrency
  in this window", run once, exactly. That is the one thing the meter cannot do.
- **The lift.** P3 → Wieringa roof. Belongs in `wieringa-roof`, not here, but it
  is where a continuous parameter earns the most, and the fold angles are already
  verified there.

---

## On animation

**No animation library.** Theatre.js is a tool in search of an application and
this is not it.

If and when a continuous parameter is wanted, the page already has the data model
for it. `const gridAlphas = [0.6, 0.6, 0.4, 0.15, 0.15, 0]` indexed by
`currentStep` is a six-key track sampled only at its keys; Prev/Next is a
scrubber with the in-between frames removed. Making that parameter a float and
writing `render(t)` is the entire mechanism, in roughly the number of lines it
takes to describe.

The transition worth having is not a mesh morph. Each rhomb is generated by an
intersection and lands where the dual map sends it:

```
vertex_i(t) = lerp((5/2)·x₀, f + offset_i, t)
```

The 5/2 is not optional — see item 3. Without it the animation is a 2.5× zoom
with the content hidden inside it; with it, each rhomb moves only by the bounded
wobble and settles onto its place. The animation is the theorem, not decoration —
and it is also exactly the E1 mechanism, one dimension up.

Some explorations may borrow the *vocabulary* — a scene, a parameter, a state
derived from `t` — without borrowing any machinery.
