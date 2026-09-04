# Pentagrid — Plan

What this project is, what is open, and what to build next.

Research questions with real mathematical content live in [RESEARCH.md](RESEARCH.md).
This file is the working plan.

---

## Orientation

Returning after a dormancy. The state of play:

- `src/method.ts` (~1500 lines) is essentially the whole project. Plain `tsc` to
  `dist/`, no bundler, no runtime dependencies. `.github/workflows/deploy.yml`
  builds and publishes the entire repo root to Pages, so any new `.html` file at
  the top level is live on push with no configuration.
- The multi-layer canvas refactor is **done** (commit `24ad0c8`). Stacked
  canvases in a relative container: `background` (z 5), `grid-0..4` (z 10–14),
  `axes` (z 20), `content` (z 50), plus `highlightCanvas` (z 55) and
  `eventCanvas` (z 100, takes all input).
- Visibility is two-level as designed: `layer.visible` is step-driven,
  `layer.userVisible` is the checkbox. Grid alpha is CSS opacity per step, not a
  redraw.
- The math layer is already clean. `solveIntersection` / `computeRhomb` /
  `collectRhombs` return plain data; every draw function takes its target
  context as the first argument. No rendering types leak into the geometry.
- An unfinished "enforce regularity" feature is committed as WIP in `5a7d04d`.
  It is **superseded** — see item 1 for what replaces it and why.

---

## Open items

These come first because they are cheap, and because items 3, 4 and 5 gate the
explorations below.

### 1. Regularity: measure it, do not enforce it — DECIDED 2026-09-04

**Supersedes the WIP in `5a7d04d`.** That commit's `checkRegularity()` flags
`|γⱼ − γₖ| < 1e-10` and nudges by `5e-9`. Both the test and the response are
wrong, for reasons worth keeping:

- **The test is a proxy, and a narrow one.** De Bruijn's singularity condition is
  three lines concurrent — a condition on integer combinations of the γ's, not on
  pairwise equality. Configurations with all five γ distinct are routinely
  singular; the pairwise test catches only the symmetric coincidences.
- **Enforcement cannot work globally.** Regularity buys *positive* triangle area,
  never area *bounded below*. As the line indices range over ℤ the
  near-concurrency defects equidistribute (Weyl — the direction ratios are
  irrational), so for **every** γ the infimum of region size over the plane is
  zero. A window-local guarantee is achievable but breaks the moment you pan, and
  then the sliders move as a side effect of panning.
- **The small triangle is the content.** Three nearly-concurrent lines bound a
  genuine region with a genuine dual vertex; as γ crosses the singular value it
  collapses through zero and the tiling rearranges. That is the phason flip
  Step 6 already promises. Nudging γ to keep triangles fat makes the most
  interesting phenomenon on the page unreachable.

**What to build instead — a regularity meter.** Minimum region size over the
visible window, reported in **pixels**, live. Geometric rather than a proxy,
continuous rather than binary, in screen units so it means what it needs to mean.
Amber below ~3 px, red below ~1 px.

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

### 3. Rhombs should carry their provenance

`computeRhomb(j, k, nj, nk, x0, y0)` receives everything about where the rhomb
came from and stores none of it — the `Rhomb` interface keeps only
`{vertices, kTuples, thick}`. `x0, y0` are used to resolve the three
non-participating K values and then discarded.

Store `j, k, nj, nk, x0, y0` on the `Rhomb`. It is a few lines, and it is the
single change that unlocks **both** the transition animation and Exploration 1.
Do this before either.

### 4. Split geometry recompute from render

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

### 5. README is stale

It describes **five** steps with the old titles. The page has **six** — "Step 3 —
Pentagrid Regions" was inserted in `1ea38c0` and shifted everything after it. The
README also predates the layer toggles and the hover equations entirely.

### 6. `src/index.ts` is vestigial

Three lines that append an `<h1>`. It becomes dead the moment `index.html` is a
real page (below). Delete it and its `dist/` output then.

---

## Site structure

Three top-level pages, following the shape wieringa-roof uses.

| page | content | state |
|---|---|---|
| `index.html` | front door — what a pentagrid is, why it matters, links out | **to build** |
| `method.html` | the mathematics — de Bruijn's dual construction in six steps | done |
| `explorations.html` | index of the explorations, each linking to its own page | **to build** |

`index.html` is currently a stub that loads `dist/index.js` to write a heading.
It becomes a real landing page: a short statement of what the object is, a
prominent link to `method.html` as the mathematical spine, and a link to
`explorations.html`.

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
p_i(t) = lerp(x₀_i, f_i, t)
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
vertex_i(t) = lerp(x₀, f + offset_i, t)
```

Each rhomb grows out of the crossing that made it. The animation is the theorem,
not decoration — which is also exactly the E1 mechanism, one dimension up.

Some explorations may borrow the *vocabulary* — a scene, a parameter, a state
derived from `t` — without borrowing any machinery.
