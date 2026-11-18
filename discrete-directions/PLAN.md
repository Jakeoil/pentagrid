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

**The split follows that line.** `dual.html` and `src/discrete/dual.ts` are
pentagrid work and stay pentagrid work: they build a multigrid on the discrete
directions and dualize it, and they need the pentagrid's view code to do it.
Everything else goes to the library.

---

## 4. The library

One place, plain JavaScript, no build:

    discrete-directions/
      lib/            the facade a consumer imports
      src/math/       wheels, ladder, walks, substitution -- no DOM, no UI
      src/ui/         pages and canvas
      tests/          node --test, importing src/math/ directly

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
   must not go dark during the move.
4. **Grow `lib/`** and point the pages at it.
5. **Cut `dual.ts` loose** — or rather, leave it where it is and stop treating it
   as part of this project.
6. **Then** the new work: arbitrary cyclic pentagons, functional wheels,
   deflation inward, the workshop pages.

Step 3 is the one with a trap in it. `tools/bootstrap.test.mjs` carries
penrose-mosaic's computed arrays as a fixture, and that fixture is what caught
the rhomb spelling (0 of 40 against 40 of 40) and the Sun's diamonds. It stays,
unchanged, as the symmetric-case oracle. It simply cannot follow the project into
the asymmetric regime, and nothing else can either — which is the point of Rule 2.

---

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
