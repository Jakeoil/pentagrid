# Discrete directions — plan

A project about **wheels**, half-step ladders and Fibonacci sums, heading toward
orthogonal and arbitrary cyclic pentagons with their own star and penta seeds.

It does not use a pentagrid. It builds by **recursion inward** — deflating from
the end of the wheel to the core — which is the opposite direction from de
Bruijn's construction and the reason the two have so little to say to each other.

Settled with Jake 2026-11-18. This supersedes two documents that say otherwise;
see §6.

---

## 1. The three rules

**Rule 1 — its own project, inside this repository.** Discrete directions
behaves as its own project with its own library. The floor is what it is today:
a corner of the pentagrid repo that owns its code and its tests. The ceiling was
once "a JavaScript project inside penrose-mosaic", and that is withdrawn — see
Rule 2. For now it stays here, uncoupled, and can be lifted out whole later
because nothing will reach into it.

**Rule 2 — penrose-mosaic is the oracle, and is not upgraded.** Its `penta()`
and `star()` do exactly what this project does, and `deca()` composes the two.
That is what makes it an oracle worth having. But it answers **only for
symmetric pentagons**, because its wheels are stored tables found by hand.

Jake, 2026-11-18: *"discrete directions does everything penrose mosaic does — and
more."* So penrose-mosaic is left alone by *this* project. No v2, no half
generations grafted on, no functional wheels retrofitted.

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
6. **Then** the new work: arbitrary cyclic pentagons, functional wheels,
   deflation inward, the workshop pages.

Step 3 is the one with a trap in it. `tools/bootstrap.test.mjs` carries
penrose-mosaic's computed arrays as a fixture, and that fixture is what caught
the rhomb spelling (0 of 40 against 40 of 40) and the Sun's diamonds. It stays,
unchanged, as the symmetric-case oracle. It simply cannot follow the project into
the asymmetric regime, and nothing else can either — which is the point of Rule 2.

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

## 6. What this supersedes

Two documents currently say the opposite and need a line each:

- **`pentagrid/LIBRARY.md` §5** — *"every project grows its own `lib/` … Peer
  facades, no center"*, and a `lib/` re-exports only its own repo's code. That
  rule survives; this is a project growing its own `lib/`. What changes is that
  discrete directions is counted as a project rather than a corner.
- **`penrose-mosaic/docs/PLANS.md`**, "The pentagrid has gone further: half
  generations" (2026-11-17) — leaves open *"should this program learn half
  generations?"* and reasons toward a possible v2. **Answered: no.**
  penrose-mosaic stays as it is, the oracle for symmetric pentagons.
