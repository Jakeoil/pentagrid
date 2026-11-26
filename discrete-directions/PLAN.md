# Discrete directions — plan

A project about **wheels**, half-step ladders and Fibonacci sums, heading toward
orthogonal and arbitrary cyclic pentagons with their own star and penta seeds.

**The generation is pentaplex based.** The figures are Penrose's P1 set from
*Pentaplexity* — pentagon, pentacle, boat, diamond — and they are substituted
the way penrose-mosaic's `penta()` and `star()` substitute them, deflating by
φ². That correspondence is not incidental; it is the thing this project
generalizes. It is not a rhomb construction and not a multigrid one.

It does not use a pentagrid. It builds by **recursion inward** — deflating from
the end of the wheel to the core — which is the opposite direction from de
Bruijn's construction and the reason the two have so little to say to each other.

**This is the version 2 library.** Not a version 2 of penrose-mosaic the
program — see Rule 2 — but the second version of the mathematics that program
implements, written once, as a library, for anything to consume. The features of
the mosaic worth having here are listed in `WISHLIST.md`.

Settled with Jake 2026-11-18, corrected 2026-11-19: the version-2 framing, the
pentaplex basis, and what the oracle is an oracle *for*. This supersedes three
documents that say otherwise, one of them an earlier draft of this one; see §6.

**The four documents.** This is the charter — what is being built and in what
order. `GEOMETRY.md` is the **object**: Gaussean Pentadic Geometry, what a seed
is, when five points are one, what the origin may do and what that costs.
`NOTES.md` is the argument that got here, left as it was written. `WISHLIST.md`
is what penrose-mosaic has that this does not.

---

## 1. The three rules

**Rule 1 — its own project, inside this repository.** Discrete directions
behaves as its own project with its own library. The floor is what it is today:
a corner of the pentagrid repo that owns its code and its tests. The ceiling was
once "a JavaScript project inside penrose-mosaic", and that is withdrawn — see
Rule 2. For now it stays here, uncoupled, and can be lifted out whole later
because nothing will reach into it.

**Rule 2 — penrose-mosaic is the working oracle, and is not upgraded.** Its
`penta()` and `star()` do exactly what this project does, and `deca()` composes
the two. That is what makes it an oracle worth having.

**It is an oracle in two senses, and the second is the larger one.**

- **For the numbers**, where it answers **only for symmetric pentagons**,
  because its wheels are stored tables found by hand. That ceiling is real, and
  it is why the asymmetric work cannot go there.
- **For the decisions**, where it has no such ceiling. It is a *working program*
  that has already settled, visibly and in code, what this library will have to
  settle again: the six figure colors, the pentas-and-stars / mosaic / tree
  overlays, the rhomb overlay at two sizes, Ammann bars, the fill and stroke
  modes including the gradient, the isogloss and the dihedral stroke, and a
  sidebar's worth of behavior besides. Those are
  not theorems to be rederived. They are answers to look up, and an answer about
  color is as good on an asymmetric pentagon as on a symmetric one.

`WISHLIST.md` is where the second sense is being written down.

Jake, 2026-11-18: *"discrete directions does everything penrose mosaic does — and
more."* So penrose-mosaic is left alone by *this* project. No half generations
grafted on, no functional wheels retrofitted, no arbitrary pentagons. The
version 2 is a separate library — this one — and not a rewrite of that program.

**That is not a freeze.** It is self-contained and may still be supported and
developed on its own terms. It is simply not the place the asymmetric and
half-generation work goes.

**Rule 3 — math libraries in JavaScript, not TypeScript.** The shape to copy is
`turns-and-spirals`, with `kissing-circles` as the other reference:

- No build step. Plain ES modules, `// @ts-check` with JSDoc for types.
- `src/math/` imports nothing from `src/ui/` and runs under bare `node --test`.
- `exports` in `package.json` so siblings import by name, never by relative path.
- Pages load a controller with `<script type="module" src="./x.mjs">`.
- Write to width 80, American spelling, no formatters.

---

## 2. Where it is going

The future is **orthogonal and arbitrary cyclic pentagons**, each with its own
star and penta seeds. Today's quadrille five is one seed among many; the real
subject is the family.

That is already half-built. `src/bootstrap/` derives all four wheels and all four
tile outlines from five ordered points, with no reflection anywhere, which is why
an asymmetric pentagon tiles at all. What remains:

- **Arbitrary cyclic pentagons**, not just the lattice ones.
- **Functional wheels, not tabular.** The stored seeds go; a wheel is computed
  from its five points at any rung, whole or half, up or down.
- **Deflation inward** as the primary construction: from the end of the wheel to
  the core, rather than inflating a seed outward.
- **Workshop pages** for building mosaics from orthogonal lines.

Open questions that belong to this project and nowhere else are already recorded
in `NOTES.md`: the exact condition on five points for tiles to meet rather than
sliver, the `twist`/`diamond` substitution lists (the last transcribed thing),
and the half-rung parity bit in y.

---

## 2a. Two ladders, even and odd

**Jake, 2026-11-18.** The recursive `penta()` and `star()` deflate by **φ²**.
That is the step, and it is the only step those functions know.

A seed for the **odd** steps can be generated from the original seed by them. So
what exists is not one ladder with half rungs in it, but **two ladders** — an
even one and an odd one — each stepping by φ² within itself, the odd one seeded
off the even. That is why they are rightly called *generations* and *half
generations*: the half generations are a ladder of their own, not fractions of
the first.

Whether the two combine into a single ladder is **open**, and would be a
discovery rather than a tidying.

This reframes something recorded in `NOTES.md` as an awkwardness. The finding
there — that two half steps are not one generation, missing in y by an
alternating (0, ±1) — is the same fact seen from the wrong side: it is what
treating two ladders as one looks like. Each ladder is consistent on its own
terms. The ±1 is the offset between them, not an error inside either.

## 3. The seam, measured

The only overlap with the pentagrid is **dualizing**. That is not a judgment,
it is what the imports say (measured 2026-11-18):

    src/bootstrap/*                 nothing from pentagrid but ../build-id.js
    src/discrete/index-figure.ts    only ./wheels.js
    src/discrete/dual.ts            ../view/pentagrid.js, ../view/controls.js

So the wheels, the ladder, the tile construction and the substitution — about
900 lines — are already standalone. One file reaches into the pentagrid, and it
is the one whose whole subject is the dual map.

**The split follows that line — but not where this first put it.** The original
reading was that `dual.html` and `dual.ts` are pentagrid work and stay pentagrid
work, since they need the pentagrid's view code. Jake, 2026-11-18:

> Dual will stay where it is. It will use pentagrid's external library as if it
> were in another project.

Which is better, and is what §5 records as done. Dualizing is discrete
directions' own subject; what belongs to the pentagrid is the *view code* it
takes to draw a multigrid. So `dual.html` does not move, `dual.ts` ports to
`src/ui/dual.js` like the other pages, and the one import that crosses the
boundary goes through `lib/`:

    from here    import { createPentagrid } from "../../../lib/pentagrid.js";
    a sibling    import { createPentagrid } from "../pentagrid/lib/pentagrid.js";

one `../` apart, and nothing else in this project imports the pentagrid at all.
That is the whole of the coupling, stated in one line of one file.

---

## 4. The library

One place, plain JavaScript, no build:

    discrete-directions/
      lib/            the facade a consumer imports
      src/math/       wheels, ladder, walks, substitution -- no DOM, no UI
      src/ui/         pages and canvas
      tests/          node --test, importing src/math/ directly
      tools/          the stamp, which writes the one generated file

**Built 2026-11-18.** The facade is three entry points plus an all-in-one,
grouped by what a page asks for rather than mirroring the modules -- mirroring
would pin nothing:

| entry point | what it is |
| ---- | ---------- |
| `lib/wheels.js` | five points, the operator family, the ladder, the pentaflake |
| `lib/tiles.js` | outlines as walks, the star family, the rhombs |
| `lib/patch.js` | the substitution and `outlineOf` |
| `lib/discrete-directions.js` | all three, for a consumer that wants one import |
| `lib/pentadiculum.js` | the UI half: the Pentadiculum, the drawing primitives, the numeral |

`lib/pentadiculum.js` is the one entry that needs a DOM, which is why it is
*not* gathered into the all-in-one -- `import ... from "discrete-directions"`
has to keep running in node. Its stylesheet is `lib/css/pentadiculum.css`, and
for the mounts it is not optional.

`tests/lib-surface.test.mjs` pins those names, checks the facade re-exports the
same function objects rather than copies, checks every statement in `lib/` is an
import or an export, and checks the entry points reach every module under
`src/math/`. Unlike the parent's `lib/`, these re-export source and not a build.

What moves in, from `pentagrid/src/bootstrap/` and the wheel half of
`src/discrete/`:

| from | what it is |
| ---- | ---------- |
| `wheel.ts` | the stride family, the ladder, half rungs, negatives |
| `walk.ts` | tile outlines as tenth-walks, the rhombs, `rhombGroup` |
| `star.ts` | the star family as two P generations interleaved |
| `flake.ts` | the pentaflake, and P measured off it |
| `patch.ts` | the substitution, `isHeads`, the recursion floor |
| `discrete/wheels.ts` | the E2 wheel work, where it does not duplicate the above |

TypeScript becomes `@ts-check` + JSDoc. The types were load-bearing in places —
`Spelling`, `Face`, `Edge`, `SeedType` — and JSDoc unions carry them without a
compiler.

---

## 5. Staging

Nothing here is urgent and none of it should be done in one sweep.

1. **Write this down.** Done, this file.
2. **Reconcile the superseded documents** (§6) so nothing says two things.
3. **Port the math to JavaScript**, module by module, keeping
   `tools/bootstrap.test.mjs` green at each step. It is the safety net and it
   must not go dark during the move. *(Done — and it never went dark: a parity
   test compared every export against the TypeScript until the day both went.)*
4. **Grow `lib/`** and point the pages at it. *(Done.)*
5. **Cut `dual.ts` loose** — or rather, leave it where it is and stop treating it
   as part of this project. *(Done, and better: it stayed here and became a
   consumer of the pentagrid's `lib/`. See the entries below.)*
6. **Then** the new work, which is where this now is. Two tracks, and they do
   not depend on each other:
   - **The mathematics.** Arbitrary cyclic pentagons with their own star and
     penta seeds, functional wheels rather than tabular, deflation inward from
     the end of the wheel to the core, the workshop pages.
   - **The features.** What the mosaic already does and this library does not.
     Collected in `WISHLIST.md` rather than settled here, because the list is
     Jake's to set and most entries are a look rather than a proof.

Step 3 was the one with a trap in it. `tools/bootstrap.test.mjs` carried
penrose-mosaic's computed arrays as a fixture, and that fixture is what caught
the rhomb spelling (0 of 40 against 40 of 40) and the Sun's diamonds. Those
arrays live in `tests/` here now, unchanged, and are still the symmetric-case
oracle. They cannot follow the project into the asymmetric regime, and no stored
table can — which is the point of Rule 2's **first** sense.

Rule 2's second sense has no such ceiling, and that is worth keeping straight.
The mosaic stops being able to check the numbers the moment the five points stop
being symmetric. It does not stop being the place to look up what the overlays
do, how the tree is drawn, or which of six colors a figure is drawn in.

---

### Progress — the port, started 2026-11-18

**`src/math/wheel.js` is done.** A faithful port of `src/bootstrap/wheel.ts`:
the stride family, the two-term pairs, the ladder with half and negative rungs,
the four wheels and the edge wheel. `@ts-check` with JSDoc carries the types that
were load-bearing — `Pt`, `Wheel`, `WheelSet` — and `npx tsc --noEmit` on the
repo is still clean.

Two tests, and the split between them is the point:

- **`tests/wheel.test.mjs`** checks the mathematics on its own terms, against
  penrose-mosaic's transcribed seeds. 21 tests. This one survives the port and is
  the oracle link; losing it would be losing the net.
- **`tests/port-parity.test.mjs`** checks the JavaScript against the TypeScript
  it came from — every export, four seeds, every rung from −4 to 6 in halves,
  and that they fail the same way. 265 comparisons, 0 differ. **Scaffolding**: it
  skips itself once `dist/bootstrap/` is gone, and should be deleted then.

`package.json` here gives the project its own `test` script and an `exports` map,
so siblings import by name. The parent's `npm test` runs these too, so the port
cannot rot while it is half done.

One test earned its keep immediately. A spoke's growth does **not** hit φ² at
once — the quadrille's wheel is not a scalar multiple of itself — it converges,
and the error falls by **φ⁻² a generation**, the subdominant eigenvalue, reaching
machine precision by thirty. A single tolerance would have hidden that; asserting
the rate says what is actually true and would catch a wheel converging to the
right number the wrong way.

**`src/math/flake.js`, `star.js`, `walk.js` and `patch.js` followed**, bottom
up, the same way: faithful ports, `@ts-check` with JSDoc, each with its own test
against penrose-mosaic plus a parity block in `port-parity.test.mjs`. The whole
of `src/bootstrap/` is now ported except `page.ts`, which is the page and not
the math.

The oracle each one answers to:

| module | what it is checked against |
| --- | --- |
| `wheel.js` | penrose-mosaic's four stored wheels, transcribed |
| `flake.js` | the P wheel it measures out, and the stride formula |
| `star.js` | its eight stored star/boat/diamond outlines |
| `walk.js` | those eight again, plus its **computed** `thickRhomb`/`thinRhomb` |
| `patch.js` | no stored arrays — overlap, interior holes, and the subset claim |

`discrete-directions/tsconfig.json` is new, and it is the reason the `@ts-check`
headers mean anything: the parent's `tsconfig.json` has `"include": ["src"]`
relative to the repo root, so it never reached these files and the headers were
decoration. The new one is check-only — `noEmit`, `checkJs`, `strict`, no
`types` — and `npm test` here runs it before the tests. There is no build step
and never will be; the browser loads these files as they are.

**96 tests here, 853 in the parent, 0 failures, nothing skipped** — so the
parity blocks are genuinely running against `dist/bootstrap/`, not quietly
passing because the comparison was unavailable.

Three things came out of the port that were not in the TypeScript:

- **`closes()` is an exact integer predicate.** It asks for `=== 0`, so the real
  preset fails it by 4e-16 while the walks do close. Every other function in
  these modules is indifferent to whether the five points are integers. That one
  is the single place a tolerance belongs, and a test now records both halves.
- **`reverse()`'s comment was wrong.** It said "reverse the winding", but
  re-winding an outline is `turn(reverse(walk), 5)` — walking backwards takes
  each edge *negated*, in reverse order. Reversal alone draws the figure's 180°
  copy, which on the symmetric `pentaUp` happens to coincide with its y-mirror,
  which is where the comment came from. Behavior unchanged, comment corrected,
  and the test now states the identity for any five points.
- **A dead binding** in `patch.js`'s `sun()`: it destructured the `s` wheel the
  diamonds used to hang on, before they moved to the inflated D wheel. Dropped.

### The page, same day

**`lib/` is built and `by-your-bootstraps.html` loads its own JavaScript.**
`src/bootstrap/page.ts` became `discrete-directions/src/ui/page.js`, importing
through the facade; the HTML's one script tag now reads `src/ui/page.js`.

Pointing the page at `lib/` *required* porting it. The parent's `tsconfig.json`
has no `allowJs` and a `rootDir` of `./src`, so a TypeScript page cannot import
these files at all — the dependency only runs the other way once the page is
JavaScript too.

**How the port was checked.** "It compiles" and "it does not throw" are both
weak claims about a page. Instead every canvas call both versions make was
recorded — each `moveTo`, `fill`, `fillStyle` and `lineWidth`, coordinates to
six decimals — through the same stub DOM, with the same handlers fired in the
same order: **1,399,698 operations, identical**. `tools/pagecheck.mjs` agrees
on the weaker claim too, 80 handler calls and nothing thrown, same as before.

Two notes from the move:

- **`GRID` and `GRID_BOLD` were dead** in `page.ts` — declared, never read, left
  over from before `GRID_LEVELS`. Not carried over.
- **The build stamp needed a home.** `discrete-directions/tools/stamp.mjs`
  writes `src/ui/build-id.js`, the one generated file in the project, and the
  parent's `npm run stamp` calls it with its own stamp so both report the same
  id for one build. It resolves paths against itself, so it runs from either
  root. It is gitignored, as `src/build-id.ts` is, because the Pages workflow
  runs `npm run build` before it publishes — so a fresh clone has to run `npm
  run build` (or `npm run stamp` here) once before the page loads or `tsc`
  passes. Same condition the parent already has for `dist/`.

`src/bootstrap/page.ts` is marked SUPERSEDED and loads nowhere. It is left in
place so the move stays one commit at a time, and it is the next thing to
delete. The five math modules beside it stay until `tools/bootstrap.test.mjs`
and the parity test are retired.

### Cutting `src/discrete/` loose, 2026-11-19

All three of its modules are now here, and `src/discrete/` loads nothing:

| was | is | checked by |
| --- | --- | --- |
| `discrete/wheels.ts` | `src/math/e2.js` + `lib/e2.js` | 16 ported tests, and parity on every export |
| `discrete/index-figure.ts` | `src/ui/index-figure.js` | 1,219 canvas ops and readouts, identical |
| `discrete/dual.ts` | `src/ui/dual.js` | 28,492 canvas ops and readouts at init, identical |

**`lib/e2.js` is deliberately not in `discrete-directions.js`.** It is the other
representation of the same geometry — three seeds and their reflections in MATH
coordinates, against ten tenths of five ordered points in SCREEN coordinates —
and four names collide: `inflate`, `deflate`, `pentagon` and `SEED_GENERATION`.
The first three are *different functions wearing one name*, which is exactly
what one namespace must not hide, so E2 is imported by name and the collision
becomes a choice. (`SEED_GENERATION` is no conflict at all: both count the
stored seed as generation 1, and penrose-mosaic is where both got it.) The
surface test asserts that list, and asserts the three really are different
functions.

**The pentagrid grew `lib/pentagrid.js` to be consumed.** `createPentagrid` was
not on its public surface — `lib/gamma.js` is the model and `lib/grow.js` the
geometry, with no entry for the view. There is one now, with a `.d.ts` beside it
so this project's `tsc` type-checks the import across the boundary, which it
does: `dual.js` resolves `lib/pentagrid.d.ts` and the `dist/*.d.ts` behind it.

One gap found and recorded rather than closed, because closing it is a look
change: that entry ships **no stylesheet**. The instruments in `lib/reticulum.js`
carry their rules in `lib/css/`; `createPentagrid` assigns about thirty classes
whose rules are still in the repo's `site.css`, so a consumer outside the
pentagrid gets a working view with a bare panel. `tools/surface.test.mjs` now
records that, and in recording it found two classes — `regularity-control` and
`regularity-meter` — with no rule in *any* stylesheet in the repo, while their
sibling `penrose-flag` has one. Bare in the pentagrid's own pages too.

`src/discrete/dual.ts` and `index-figure.ts` are marked SUPERSEDED.
`wheels.ts` is marked PORTED and is still load-bearing: `tools/discrete.test.mjs`
checks it against penrose-mosaic and the parity test compares the JavaScript
against it, so it retires when they do.

### The TypeScript is gone, 2026-11-19

`src/bootstrap/`, `src/discrete/`, `tools/bootstrap.test.mjs`,
`tools/discrete.test.mjs` and `port-parity.test.mjs` are deleted. Steps 1–5 of
the staging above are done; what is left is step 6, the new work.

**The gate was coverage, not compilation.** Diffing the old test names against
the new ones found five tests with no counterpart and one that had quietly
narrowed — real coverage that would have vanished silently:

| moved | to |
| --- | --- |
| the four *adopting a derived pentagon* tests, and the extrapolate round trip | `tests/rebase.test.mjs` |
| *collinear vertices are not crossings* | `tests/star.test.mjs` |
| *no tile outline self-intersects* | same, with the PENTAGONS it had lost |
| *the discrete dual: six rhomb shapes…* | `tests/dual.test.mjs` |

The rest were renames, checked one by one. `rebase.test.mjs` is where the
two-ladder gap is now pinned: `halfUp` twice is not `inflate`, except on a
regular pentagon — §2a.

**`tests/dual.test.mjs` is the one test here that needs the pentagrid built**,
because it takes `collectRhombs` from `lib/grow.js` and `lib/` re-exports
`../dist/`. It skips itself and says so rather than failing, which was verified
by moving `dist/geometry/pentagrid.js` aside and watching it skip.

**`tools/render.mjs` moved here too** and imports `../lib/`. It draws any figure
to SVG, and it is the tool that caught what no numeric test did — the Sun's
diamonds and the Star patch's boats. Its output was diffed before and after the
move across four figures: identical. `npm run render` works from either root,
since the parent's script now delegates here.

**What the parent keeps:** `tools/surface.test.mjs` (its own `lib/`), and in
`src/` nothing of this project at all. The count went 878 → 790 tests, which is
89 deleted against 7 added, and the arithmetic of that was checked rather than
assumed.

**NOTES.md's paths are now historical** and its header says so, with the map
from the old names to the new. That file is the argument that got here; it is
left as it was written.

**Next: step 6.** Arbitrary cyclic pentagons with their own star and penta
seeds, functional wheels rather than tabular, deflation inward from the end of
the wheel to the core, and the workshop pages. The Star patch is still broken
and still has a test asserting so.

### Step 6 framed, 2026-11-19

The document was corrected rather than extended, on three points Jake set out:

1. **This is the version 2 library** — see the header and Rule 2. The earlier
   "there is no v2" was penrose-mosaic's answer about itself, read too broadly.
2. **The generation is pentaplex based**, the P1 figures substituted as
   `penta()` and `star()` substitute them. Stated in the header, where the
   document previously said only what the project is *not* (a pentagrid).
3. **The oracle is an oracle for decisions as much as for numbers** — color,
   the rhomb overlays, Ammann bars, the tree — and that half of it has no
   symmetric-pentagon ceiling. Rule 2 now says so in two parts.

And **`WISHLIST.md` is opened** as the place those features get listed: a list,
explicitly not a plan, with each entry pointing at the file in penrose-mosaic
that already answers it. Writing it found one thing worth having anyway: the
mosaic's per-child `color` table is not independent data. It is `twist === 0 ?
Pe3 : Pe1`, agreeing in all fifteen slots with what `expand()` already computes
here, so that entry became a wanted test rather than a wanted feature.

### The Pentadiculum, 2026-11-22

The input figure became an instrument with a name. Jake: *the pentagon and its
group of controls will be named the Pentadiculum, analogous to the pentagrid's
Reticulum*, and the geometry it presents is **Gaussean Pentadic Geometry** --
five ordered Gaussian integers and the lattice point they radiate from.

**The origin moves.** And it adds no geometry: `(p, o)` and `(p - o, 0)` are the
same seed, so what it adds is the one motion the five handles cannot make
between them, which is sliding the pentagon over the lattice as a block. Jake
put it first: *the operation of moving the origin is effectively just a
translation of the five points.*

The motion is **fenced**, exactly. `cross(W[t], W[t+1]) > 0` is affine in the
origin because the o x o term cancels, and the ten conditions collapse to five
because `W[t+5] = -W[t]`, so the legal origins are a convex polygon of at most
five sides -- about `phi^-4` of the pentagon's own area, and for a regular
pentagon exactly the pentagon one generation down. Two integer origins for the
classic seed, six for the asymmetric one. `originFence` in `src/math/seed.js`.

**The sweet spot is the centroid.** `P[t] - S[t] = -(-1)^t sum(points)` at every
tenth, so `P = S` exactly at the barycenter, and there `inflate(D) = T` -- which
settles the page's own open note, *modes can be unified if the real of d + p ==
t*. All three rhomb spellings become the same quadrilateral there, an exact
parallelogram, against a worst kite of 0.277 at the origin. It is always in
`(1/5)Z^2`, which is why the center snaps in fifths while the five corners snap
to whole units.

**What is affine and what is not**, measured rather than assumed: the E wheel is
the only origin-invariant wheel (its comb coefficients sum to zero); pentagons
and stars move by pure translation; the `classic` and `mixed` rhomb spellings
skew, and `t` and `inflated` do not. Jake's goal was an affine solution for the
quadrille rhombs and the honest answer is that `classic` is not one -- hence the
name, and hence the `centroid` mode beside it.

**Two layers, as `lib/reticulum.js` has it.** `createPentadiculum` is a pure
view: a canvas, a viewport and the pointer, holding no seed. `mountPentadiculum`
and `mountFloatingPentadiculum` bind it to a seed and build the controls.
Nothing is a module-level `let`, which is the whole point -- the moire page
wants four of them on one page, reading four seeds.

`by-your-bootstraps` was repointed at it and the extraction proven: 4,931
recorded canvas calls over a scripted drag, preset, ladder, zoom and centroid
run, identical before and after.

### The left column IS the panel, 2026-11-26

Jake, five things in one note: *the left panel containing the controls should
be fixed to it's size when pentadiculum is anchored. The left panel should
behave like left panel, everything on the right is output. The pentadiculum
button should behave like the header line on the anchor. Same display. Panel
width. Status text should not cause anything below it to jump. The "origin,
centroid" status should not be in the floating part. It can be moved below the
panel button, but it must be fixed size so the output controls dont jump.
Finally: although the index/order boxes on the anchored are correct, they are
still misaligned on the floating.*

**One panel in two places.** The left column is now the floating panel standing
still: `.pentadiculum-anchor` is its border and its width, `#boot-float` wears
`.pentadiculum-bar` as the header line, and the instrument hangs under it in a
`.pentadiculum-body`. The values are shared rather than copied -- both classes
live in `lib/css/pentadiculum.css` beside the panel's own, and the width is
`--pd-panel-w`, which the page sets to the 372px the mount floats at -- so the
two cannot drift. The bar says what the panel's bar says, down to the seed's
name: `pentadiculum -- classic`, `-- custom` once you drag it off a preset.

**The column does not resize, in either state.** It was `1fr 2fr`, and `auto
1fr` while floating, so the output and every control in it moved sideways
whenever the instrument left or came back. Now it is `var(--pd-panel-w) 1fr`
in both. The output canvas goes from 733px to 728px and stops changing.

**The status is the page's, at a fixed height.** It was the first thing in the
floating panel, which is the worst place for a line that grows: a decimal in
the origin, or a verdict, pushed every control under it down a line. The panel
has none now (`read: false`, a mount option so a droppable mount still has
one), and the page keeps it under the bar as three lines -- origin, centroid,
floater -- each one line tall and elided rather than wrapped. 51px of status
whatever it says, so nothing below it can move. It sits outside
`#boot-seed-inline`, so it stays while the instrument floats, naming the same
seed.

**The boxes on the floating were the same trap as before, one file over.**
`.pentadiculum-ctl button` is (0,1,1) and `.pd-box` is (0,1,0), so inside the
panel the generic rule won: the index and order boxes came out at 11px in the
system font with 7px of side padding, against 12px tabular with none on the
page -- where the host's rule already excluded them. Measured in headless
Chrome rather than guessed at, before and after:

| | anchored | floating, before | floating, after |
|---|---|---|---|
| box font | 12px ui-monospace | 11px system | 12px ui-monospace |
| box padding | 0 | 2px 7px | 0 |
| box width | 30.34px | 29.09px | 30.33px |
| `presets` height | 21.6px | 23.6px | 21.6px |

The fix is the one the page already had, in the stylesheet that owns the
classes: `:not(.pd-box):not(.pd-bump):not(.pd-preset)`. Worth saying once more
in general: **a stylesheet that sets metrics for every button it contains has
to name the exceptions it ships**, or the next one it ships breaks silently.

### A step moves the five, 2026-11-25

Jake: *we don't need the use button. Just move the handles to their appointed
area. Just change the output dynamically for both.*

So `extrapolate` stopped being a view of a derived figure that a second click
had to adopt. A step walks the seed -- `walkSeed` in `src/math/seed.js` -- the
handles land on the rung and stay live, the fence stays drawn, and a page hears
it as what it is: a new seed. `use` is gone from both instruments.

**The walk is pinned on the integral centroid, and that is the whole trick.**
`pentagon(d, 0)` places a figure by its own first spoke, and a half rung's wheel
starts somewhere else, so taking it at face value slides the pentagon on every
half step: (0, -1) a step for the quadrille, (2, 1) for the asymmetric, and
nothing at all for the even pentad -- evenness again, since the half-step wheel
closes integrally only when the five sum to a multiple of five. The slides
compound: eight halves up and eight back left the quadrille **13107 units** from
where it started. Pinning the centroid instead makes the walk

- exact at rung 0, so stepping nowhere moves nothing;
- reversible, up and back to the point;
- **composable** -- k steps of a half equal one step of k halves, at every rung
  and on every seed tried, which is what lets the control just count.

That third one **supersedes a caveat `page.js` used to carry**, that composing
two half rungs is not one generation on an irregular pentagon. The discrepancy
was the placement, not the shape; with the centroid pinned, `halfUp` twice and
`inflate` once land on the same five. Measured in `tests/seed.test.mjs`.

**What the output does, measured, because it is less than it sounds.** The patch
is grown from the five, so walking them rebuilds it -- but the output fits the
patch to its canvas, so the scale cancels and only the shape change survives.
Max vertex shift against rung 0, as a fraction of the patch's span, quadrille:
9.2% at rung -1 and 1.4% at +1 for a one-generation patch, 3.2% and 0.5% at
generation 2, 0.4% and 0.06% at generation 4. On the `real` preset it is
**exactly zero** (1.7e-16): that pentagon's inflation is an exact similarity, so
an offset ladder is a pure zoom and the fit undoes it. The effect exists at all
only because the discrete inflation is not a similarity, and it shrinks as the
patch grows because the lattice wheels converge on the irrational limit. Open:
whether the rung should drive the output's scale as well, which would make it
visible and is one line.

### The Reticulum's controls, wholesale, 2026-11-25

Jake: *make the pentadiculum more similar action to the reticulum. Make presets
and settings into buttons. When you press either of them dropdown unfolds from
the bottom... push presets or settings again to hide them or another dropdown
button.* And: *the bottom line will contain the extrapolate and gen
functionality... two fields with scrollable values. Again, much like the I,
lambda and phi fields of the reticulum. Exact parity is not required in the
anchored version. just the functionality. Use the same styles and colors.*

Four things, and the fourth is the interesting one.

1. **`presets` and `settings` are dropdown buttons.** One open at a time,
   pressing the open one folds it, and each drop is appended straight after the
   row that opens it so it unfolds downward rather than covering anything --
   nothing in a 372px panel wants to be covered. `reset` moved INTO the presets
   drop, dashed and italic, which is where the Reticulum keeps `restore`: a verb
   among nouns. The `<details>` fold is gone; it was a second idea about what a
   disclosure looks like, two rows above the Reticulum's.
2. **`index` and `order`, two scrollable boxes on the bottom line.** The
   Reticulum's `.exp-box`, which Jake asked for there because an exponent at 8px
   could not be read: fixed width in `ch` and tabular figures, so a minus sign
   cannot shift the digits under the pointer. Three gestures, not one -- wheel,
   click for a step up, arrows or w/s -- because a box you can only scroll is a
   box a trackpad user can only fight. `preventDefault` on the wheel is
   load-bearing: without it the page scrolls out from under the pointer while
   the value changes, which reads as the control being broken.
3. **`gen` moved off the output column** and became `order` on the instrument's
   bottom line. It rides in the `View`, so the anchored row and the floating
   panel cannot disagree about it, and the page draws the patch off
   `onViewChange`. Nothing in the instrument draws a patch; it holds the number
   for whoever does.
4. **The behavior is two exported functions, not two copies.** `bindScroll` and
   `bindDrops` in `lib/pentadiculum.js`. The anchored column is page HTML and
   the panel is built in JavaScript, and Jake has already caught this project
   once with *floating settings don't match with anchored when I flip back and
   forth* -- so the one thing they must not each have is their own idea of what
   a dropdown or a scrollable box does. The styles are the same way:
   `lib/css/pentadiculum.css` carries `.ret-bump`, `.ret-presets` and the
   `.exp-*` boxes' values under `pd-` names, for the same reason it carries
   `panel.css`'s -- the two instruments read as one site while this project stays
   droppable onto a page that has never heard of it.

**Lined up, after a look.** Jake: *the index and order boxes are not lined up
nice.* They were not, and neither was anything else: measured in a headless
Chrome, every row started its controls wherever its own label happened to end --
46px after `grid`, 71 after `centroid`, 64 after `display`, 53 after `index`.
A checkbox gets away with that and a bordered box does not, because a box has
edges and the eye measures them. The labels now share a 4em column, so every
first control starts at x = 72 in the column and at the same place in the panel,
and `.pd-term` has a `min-height` so the line keeps the 21px row rhythm instead
of sagging to 19. The box is 18px rather than 16 for the same reason.

**And the look turned up a real cost.** Driving the page headless at order 6
takes seconds a redraw, and the reason is in `drawTiling`: the clamp used to
expand at the asked-for generation and throw the result away if it was too big.
At order 6 that is a 289,991-tile Sun built and discarded, then 42,376, then
6,201 -- **404ms** before a single tile is drawn, for a picture identical to
order 4's, on every redraw. The count is a property of the seed type and the
generation alone, so it is remembered now (`countAt`) and the clamp costs
nothing the second time. What remains is the drawing itself: at order 4 and up a
redraw is 6,201 tiles or more, which is the page being asked for a lot rather
than the page being wrong. Measured, so it is not a guess: `tools/pagecheck.mjs`
drives this page in about four minutes, and it did before this round too -- 226s
against the committed page, 232s against this one. The clamp fix is a real
saving inside that, not a fix for it.

One gotcha worth recording: the page's own `.ctl select, .ctl button` rule was
overriding the boxes' fixed width, because `.ctl button` outspecifies `.pd-box`
and the page's `<style>` comes after the linked stylesheet. The row's rule now
says `:not(.pd-box):not(.pd-bump):not(.pd-preset)`, which is the honest fix: a
page that hosts the instrument's controls has to let their metrics alone.

### The Pentadiculum floats, 2026-11-24

Jake: *what is the plan you have to make the Pentadiculum float? Kind of like
the reticulum I guess, on the right of the diagram? Preset name in the header.*
Then: *alternative, not replacement. output's top-right. do all four steps.*

`mountFloatingPentadiculum` had been built and tested for a week with **zero
callers**. Four steps turned it into a thing the page uses.

**1. `presetName(seed)`,** in `src/math/seed.js`. The page was doing this inline
in `syncPreset`, comparing spokes against `PRESETS` with a fallback to
`"custom"`. The panel's bar needs the same answer, and a seed's own name is the
seed's business. `presetLabel(name)` in the UI layer is the other half: the
`quadrille` is **classic** everywhere a person reads it, and the preset picker
and the bar now go through one function rather than two copies of a ternary.

**2. The panel grew up.** It had a drag and a close button. It now has the
clamp, the fold, the remembered place, the grip, `barExtras` and `resetPlace` —
which is to say, everything `createFloatingPanel` has had in the parent repo all
along.

It is **deliberately duplicated**, and the reason is worth writing down because
it looks like laziness and is the opposite. `src/ui/floating.ts` does all of
this, better, and `site.css` already `@import`s `lib/css/panel.css`, so the look
is on the page for free. But that file compiles to `dist/`, `dist/` is
gitignored and built in CI, and this project's own `tsconfig.json` says *there is
no build step and never will be: the browser loads the files as they are.*
Importing it would give a plain-JS page that works on the deployed site and
404s on a fresh clone. So the behavior is copied into
`mountFloatingPentadiculum` and the values are copied into
`lib/css/pentadiculum.css`, which keeps this project droppable onto a page that
has never heard of it — the rule `lib/css/pentadiculum.css` already states about
`--rule` and `--ink-faint`.

Three things fell out of writing it:

- **A TDZ throw.** `mountPentadiculum` announces once while it is being
  constructed, so the wrapper that renames the bar reached `mounted` before it
  was bound and the panel never appeared at all. A `ready` flag, and the page's
  own `onChange` still gets that first call.
- **The grip sizes the CANVAS**, not just the box. A wider panel holding the
  same 340px figure would be a wider panel and nothing else.
- **Every `localStorage` access is guarded.** It throws outright in a private
  window and is absent in Node — and a panel that cannot remember where it was
  is a panel in its default position, not a broken page. Which is also how the
  tests reach it: they install a Map-backed stub on `globalThis`.

**3. Wired to the page, behind a `seed` button** under the output. It folds the
seed column away (`.rig.solo`), gives the output the whole width, and opens the
panel at the **output's** top-right corner rather than the viewport's — Jake's
call, and the right one: the panel is `position: fixed`, so the viewport's
corner is wherever you have scrolled to, while the output is the thing the panel
is meant to sit beside. A remembered place wins over it.

The page and the panel hold **one** seed, and whichever moved it tells the
other. The guard is `sameSeed`: without it the push would come straight back as
a change and the two would redraw each other forever.

The panel had to become a **complete** instrument for this to be an alternative
rather than a subset, so `mountPentadiculum` gained the **ladder** row —
`ladder [−] 0 [+] [use]`, half generations, bounded at +6 and −4 as the page's
always was, with `onLadder` telling the page so the rung readout follows.
`view.extrapolate` was always the instrument's, and off the base rung the
corners stop being handles, which is the Pentadiculum's rule and not a page's.
What stays the page's is `face` and `edges`, which are how *this page* draws the
seed; they ride along one-way and the fold that sets them comes back with the
column.

**4. Tests.** The panel was one test deep — its drag — and the panel is a state
machine: the bar's naming folded and unfolded, the grip against both clamps, the
remembered place across two mounts and a third with another id, `resetPlace` as
the rescue, the viewport clamp from both edges, `barExtras` as an empty slot,
`onClose`, and the ladder with `use` keeping the adopted figure where it was
drawn rather than teleporting it to the origin.

One real find on the way: **the page never linked
`lib/css/pentadiculum.css`**, which it now needs for the panel. Harmless for the
inline canvas, and checked rather than assumed — `paper()` fills the canvas with
`#fbfcfe`, the exact value the stylesheet sets, and `.rig canvas` already
supplied the border, the radius and `touch-action: none`.

### The build stamp goes on the page, 2026-11-24

Jake, twice in one session, looking at a stale script: *can't find 20:37:45 on
page*, then *the whole idea is to write it on the page so we can eliminate this
argument from day one.*

It was `console.log` only, which settles "am I looking at what you just built?"
for whoever has the console open and for nobody else. Both times the answer was
a cached module, and both times it cost a round trip to establish. It is now a
`.build-tag` span at the right-hand end of the top nav, `build HH:MM:SS`, set
from the same `BUILD_ID` the console line uses. The console line stays; this is
the one you can point at.

The parent repo already had the convention -- `src/app/narrative.ts` puts
`build <id>` in its nav -- and this page was the one that did not.

### One set of settings, and the Reticulum's metrics, 2026-11-24

Jake, after flipping the instrument back and forth: *floating settings don't
match with anchored. Some names like reset/origin, extrapolate/ladder, settings
and its unfold missing. Follow more efficient height: spacing and button height,
used by reticulum. Preset on pentadiculum can behave like reticulum: button with
choices under.*

Four things, and the first one was the real defect.

**The two rows held two sets of variables.** The page kept `snap`,
`inputFifths`, `showVectors`, `seedFace`, `seedEdge` and `extrapolate`; the
panel kept its own `view` with the same six. Whichever you touched, the other
still believed what it believed, so flipping the instrument from the column to
the panel and back reverted everything. `onLadder` -- which reported exactly one
of the six, the one I happened to notice -- is gone, replaced by
`onViewChange(view)` fired from `announce`, which every control in the row goes
through. The page's `adoptView` takes the panel's answer as its own and
`drawInput` puts it back on the column's controls. There is now one set of
settings with two views onto it, which is what there should have been.

Guarded on a `ready` flag, because `announce` runs once during construction and
a page being told its view changed before it has been handed the instrument is
being told about a change that did not happen.

**The names disagreed.** `ladder` is the page's `extrapolate`, and is now called
that. `origin` was the page's `reset` doing one fewer thing -- every preset here
loads at the origin, so reloading the chosen preset gets you there and also
gets you the preset back; `origin` is gone and `reset` is the name. The
`settings` fold for `face` and `edges` was the page's alone, on the reasoning
that a face is how a page draws a thing rather than anything about the thing.
True, and it made the panel less than the column it replaces, so face and edges
are the instrument's now and the page follows them through `onViewChange`.

**The presets are a row of buttons**, the Reticulum's way, in both rows. Four
reasons it is better than the dropdown, in the order they matter: the choices
are visible rather than behind a click; switching is one press instead of two;
`custom` stops needing to be a fake entry in a list of real presets, because it
is just *no button pressed in*; and the list is built from `PRESETS`, so the
page cannot offer a preset the library does not have. `pd-preset` and not
`preset`, because `button.preset` in `site.css` is the Reticulum's and the
Reticulum's panel is dark -- the metrics are borrowed and the colors are not.

**The spacing follows `button.preset`:** 11px type, 2px by 7px of padding, 4px
between, `line-height` from 2.1 down to 1.6. The old line-height was padding out
a line box the controls had already sized, at roughly 10px a row -- across six
rows and two of them, which is why a six-row panel looked like a form.

### `id="boot-seed"` was already taken, 2026-11-24

Jake: *seed button does nothing.*

It really did nothing, and not for the reason I first gave. The float toggle was
given `id="boot-seed"`, which **the patch picker has held since the page was
written**. `document.getElementById` returns the first match in document order,
the `<select>` comes first, so `seedBtn.addEventListener("click", ...)` attached
the handler to the patch dropdown and the button was never wired at all.

Nothing caught it, and it is worth saying exactly why nothing could:

- `tsc` has no opinion about HTML.
- `tools/pagecheck.mjs` **cannot** catch it. Its stub mints a fresh element for
  every id it is asked for, which is what lets a page initialize headless -- and
  it is the same property that makes a duplicate id invisible.

So `tests/page-ids.test.mjs` now reads the HTML as text and checks two things:
no id is used twice, and every `byId("...")` in the script names an id that
exists. Not the other direction -- an id with no `byId` is ordinary, since CSS
and `aria` use plenty. The guard was checked by putting the bug back: it fails
with `duplicate ids -- boot-seed x2`.

I had also told Jake the symptom was a stale cached module. That was true and it
was half the story: the server was serving the new build, and the button would
still have done nothing.

### One toggle, above the instrument, 2026-11-24

Jake: *I see no way to make it float. ... I either want to see it in the left
column, or floating. The output controls should be on the left of the output.*
And: *text "scroll to zoom.." should be eliminated.*

Three corrections to the first cut, all of them mine to have got right:

1. **The control was under the output**, which is not where you look for a
   control that moves the thing on the left. It is now one button directly above
   the rig, using the `▾`/`▸` fold marker the `settings` fold already uses on
   this page: open is the column, folded is the panel.
2. **The whole left column was being hidden**, and the output's own controls --
   patch, gen, penta face, rhombs, the lot -- are the second half of that
   column. So only `#boot-seed-inline` folds away now: the input canvas and the
   seed's own controls. The column stays at `auto` width and the output's
   controls stay beside the output.
3. **The hint paragraph is gone for good**, not just while floating. Its content
   -- scroll to zoom, drag to pan, double-click to fit, double-click a handle for
   the floater -- moved into the lead-in above the rig, where it is true of both
   canvases and does not sit inside a thing that can fold away.

The **fold happens before the measurement**: the panel is placed against the
output's right edge, folding the column moves that edge, and
`getBoundingClientRect` forces the layout, so the measurement is of the page as
it will be rather than as it was.

### Six boxes in three sections, 2026-11-24

Jake wrote the control row as a spec, and it is a better row than the one it
replaces because it turns two *settings* into four *questions about the figure*:

```
grid      [x] snap   [ ] fine
centroid  [ ] actual [ ] closest
display   [ ] vectors
```

The `units`/`none` dropdown becomes **snap**, which is the same thing with one
fewer click and no false suggestion that there is a third mode coming. It is
never grayed: `real` arrives unchecked because `snapForSeed` reads the figure,
not because the box is unavailable — Jake: *except for real preset, can be
checked.*

**fine** is the old `5 space`, now **off by default and self-managing**. It
comes up checked and grayed whenever the center is somewhere the unit lattice
cannot describe — off a whole unit, or being dragged off one, which is any
center drag and any corner drag while the center floats — and drops back to
whatever the user last set when the center returns to a unit. So the fifths now
*mean* something: they are up exactly when they are the only grid the center is
on. `centerMoves(dragging, floater)` is the two-case rule and it is exported and
tested, because "the center follows a corner at a fifth of its step" is the
floater's arithmetic, not a drawing detail.

**actual** and **closest** replace the `centroid` button with the choice §8
forces on an odd pentad, as two boxes:

| box | origin | buys | costs |
| --- | --- | --- | --- |
| `actual` | the centroid, in (1/5)Z² | §5 exactly: every rhomb an exact parallelogram | a non-integral origin, so every derived wheel comes off the lattice |
| `closest` | that point rounded to a unit | integral spokes, every wheel on the lattice | up to (½, ½) off the centroid, and §5 off by that much |

On an **even** pentad the two are the same point and both boxes come up checked
and grayed at once, which is the fastest test on the page for evenness —
`integralCentroid(points) == centroidOf(points)` iff the five sum to a multiple
of five. `integralCentroid` is new in `src/math/seed.js`, and it adds `+ 0` to
each rounded coordinate on purpose: `Math.round(-0.4)` is **negative zero**,
which is a lattice point that formats as `-0` in a readout.

The graying is the whole mechanism, and Jake named it: *if check can't be
unchecked show a grayed out check. If box can't be checked, show a grayed out
box.* Native `disabled` does all three jobs — it grays an empty box, grays a
check inside a full one, and fires no event — so there is no "can I click this"
branch in either mount's handlers, and a locked box is its own no-op.

The rule lives in one pure function, `gridBoxes(seed, { snap, fine, moving })`,
which the **view** calls on every draw and hands back as `drawn.boxes`. Both the
page and the inline mount set their row from that, so a box cannot disagree with
the canvas beside it — and the paper itself is drawn from `boxes.fine.on` rather
than from `view.fifths`, which is what makes the forced-on case one fact instead
of two that have to be kept in step.

The standalone mount got the same three sections, so `reset` moved up beside
`preset` on the page and `display [] vectors` has a line of its own.

### The handle target, in pixels, 2026-11-24

Jake, editing handles close up: *allow panning and zooming on pentadiculum
screen between handle moving. When moving handles, it seems to grab handles when
the mouse is still on the grid. Make the target within the handles. Make handle
transparent during movement so user can see grid underneath.*

The first two were one bug. `grab` tested **2.5 lattice units**, which is a
different size on every seed and at every zoom — most of the `even` pentad at
rest, and the whole canvas once zoomed in. So every press found a handle, which
both grabbed when it should have missed and left no press over for the pan. It
is now measured in **pixels** against `HANDLE_R` / `ORIGIN_R`, the radii the
handles are actually drawn at, scored as a fraction of the radius so a press at
the rim of a corner does not beat one dead center on the origin.

And a held handle draws at `HELD_ALPHA`, so the lattice point it is being placed
on reads through it. The dashed floater ring stays solid — it is around the
handle, not over the paper.

### Each canvas styles itself, 2026-11-24

Jake: *put separate functionality for faces and edges in output. … functionality
in penticulum will only affect penticulum. default it to thin and transparent.*

One pair of `face`/`edges` controls governed both canvases, on the reasoning
that the input pentagon is a face like any other. The reasoning was wrong: the
input figure is a thing you are **placing on a lattice**, so the paper has to
read through it, and the output is a **tiling**, where the fills are how you
tell a Pe5 from a Pe3. `page.js` now carries `seedFace`/`seedEdge` and
`tileFace`/`tileEdge`, and each pair redraws its own canvas only — `redraw()`
in those handlers would have kept them coupled by the back door.

The input figure and `VIEW` in the Pentadiculum both default to **transparent**
and thin; the output keeps solid and thin, which is what the page has always
looked like. Its new `penta face` and `penta edges` dropdowns sit between `gen`
and `rhombs`.

Jake, after: *in pentadiculum, add setting fold and put face and edges in it.*
The input's pair now lives in a closed `settings` fold — a native `<details>`,
no script — at the foot of the input controls. They are set once and then in
the way of the handles, which is the whole case for folding them.

### The `even` preset, and a pan, 2026-11-24

§8's find shipped as a preset: **even**, (3,2) (0,2) (−3,2) (−2,−3) (2,−3),
whose five sum to zero. Its sweet spot is the lattice point (0, 0) with no
scaling, the property survives every rung of the ladder, and it settles twelve
times closer to Penrose than the quadrille at a fifth the reach.

It also **falsified two things §3 asserted**. Its fence is a four-sided kite
rather than a pentagon — "at most five sides" was right, and the test said
*exactly* five because only three seeds had ever been asked — and its fence
ratio is 0.10286 against φ⁻⁴ = 0.14590, so that ratio is a property of round
seeds and not a law. Both corrected in the doc and in `tests/seed.test.mjs`.

Two tool complaints of Jake's, both his words: *doing close up work, I can't pan
to move individual points on the pentadiculum* — the input figure now pans by
dragging anywhere there is no handle, with the pan kept in lattice units so a
zoom holds what you panned to, and a double-click on empty paper resets zoom,
pan and fit together. And *the fine grid should be turned off and on easily* —
a `5 space` box on the input figure beside `vectors`, matching the output's.

### The three modes, and the even pentads, 2026-11-23

Jake, having scaled the quadrille by five to get an integral center: *what is the
nature of the pentadic set defining the rhombus … what is the smallest pentadic
vector set which adds to a sum divisible by 5.* The answer turned out to settle
four earlier findings at once.

A wheel has five Fourier modes, and `inflate` is diagonal on them with three
eigenvalues: φ² on m = ±1 (the figure and its counter-rotating twin), φ⁻² on
m = 3, 7 (the wobble, which dies), and −1 on m = 5 — which IS the spoke sum.
So the origin handle lives entirely in mode 5, §4's perturbation table is that
mode's eigenvalue table, and the `classic` rhomb's failure to close is exactly
|Σ spokes|, at every tenth and every generation. It never shrinks: the rhombs
get bigger around a constant gap.

An **even pentad** is a seed with m₅ = 0 — five lattice points whose sum is
divisible by five — and the property survives the ladder, so its center stays a
lattice point at every generation. `tools/pentads.mjs` searches them: the
smallest is Σ|v|² = 14, and the roundest small one, (3,2) (0,2) (−3,2) (−2,−3)
(2,−3), settles twelve times closer to Penrose than the quadrille at a fifth the
size. GEOMETRY.md §8 has it all.

### The floater, and a smooth cell, 2026-11-23

**The Fibonacci cell ladder is out of the drawing path.** Jake: *I was wrong
about grid size of pentadiculum following fibonacci numbers. At least for manual
sizing. I want to be able to size it smoothly.* The Pentadiculum draws at
`fit * zoom`, continuously. Two things the ladder had been credited with were
not its doing: legibility is `GRID_LEVELS` dropping a level once its gap falls
under 4px, and the frame is held by `fitStep` returning `min(margin/reach, cap)`
-- so the claim the test makes is now stronger, the figure being inside the
margin rather than merely inside the half-canvas. `fibCell` and its reasoning
stay in `src/ui/fit.js`, exported and tested and called by nothing, because the
observation under it is real: the wheels' x components are the Fibonacci
numbers, so a rung up at a cell down lands on the same pixels.

**The floater: one handle driven by the others.** Jake: *analogous to the
sums/gamma system in the reticulum*, and it is -- the floater is the locked
index, the held quantity is `Sigma spokes = 5(centroid - origin)`, assigned by
double-clicking a handle rather than by clicking a gamma label, and released by
double-clicking it again, which is `locked = -1`. By default the center floats,
so it keeps its offset from the centroid instead of being left behind by a
corner drag; choose one of the five instead and the center is **fixed** and the
centroid is pinned. Dragging the floater itself is the retarget -- the sum strip,
not the locked dial.

The payoff is `GEOMETRY.md` §5 made into a gesture: press `centroid`, and with
the center floating at a held value of zero **no drag can leave the sweet spot**.
`moveHandle` in `src/math/seed.js` is the whole rule, mirroring `relock` in
`src/geometry/gamma.ts`; the UI reports intent and computes none of it.
`GEOMETRY.md` §6 has the arithmetic and the three cases.

Found on the way, by a test written for the mount rather than for the page:
`{ size: 340, ...options }` let a mount that was given no size pass
`size: undefined` through and win, which in a browser is a **0x0 canvas**. No
page had met it because every page hands in a canvas of its own -- and the moire
page, which is why the mounts exist, would have been the first.

## 6. What this supersedes

Three documents say the opposite and need a line each. One of them is an
earlier draft of this file, which is the honest way to record a correction:

- **`pentagrid/LIBRARY.md` §5** — *"every project grows its own `lib/` … Peer
  facades, no center"*, and a `lib/` re-exports only its own repo's code. That
  rule survives; this is a project growing its own `lib/`. What changes is that
  discrete directions is counted as a project rather than a corner.
- **`penrose-mosaic/docs/PLANS.md`**, "The pentagrid has gone further: half
  generations" (2026-11-17) — leaves open *"should this program learn half
  generations?"* and reasons toward a possible v2. **Answered: not there.** That
  program stays as it is, and its own "Answered 2026-11-18" section says so
  correctly: *"there is no v2 **here**."*
- **This file, as first written**, on two counts.
  1. It read that answer as "there is no v2" flat. There is one: it is this
     library. What is ruled out is a v2 *of that program*, with half
     generations grafted on.
  2. It described penrose-mosaic as "the oracle for symmetric pentagons" and
     left it there — true of its arithmetic, and it undersold everything else.
     Color, the overlays, Ammann bars and the tree are settled there and
     unsettled here. Corrected in Rule 2, and listed in `WISHLIST.md`.
