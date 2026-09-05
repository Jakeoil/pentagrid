# Pentagrid

Interactive explorations of de Bruijn's pentagrid method for constructing Penrose
tilings.

**Live:** [jakeoil.github.io/pentagrid](https://jakeoil.github.io/pentagrid/)

## The method page

[`method.html`](https://jakeoil.github.io/pentagrid/method.html) walks through the
dual construction in six steps:

1. **The Pentagrid** — five families of parallel lines at 72° intervals
2. **Intersections** — pairwise crossings, color-coded by family pair
3. **Pentagrid Regions** — the K-tuples `Kⱼ(x) = ⌈x·vⱼ + γⱼ⌉`, hoverable
4. **Dual Vertices** — the vertex function `f(x) = Σ Kⱼ(x)·vⱼ`
5. **Building Rhombs** — parallelograms from the four regions at a crossing
6. **Penrose Tiling** — the complete dual (thick 72° / thin 36°)

### Controls

Five γ sliders set the grid offsets, constrained to sum to zero; click any γ label
to choose which one is computed from the others. Pan with mouse drag, zoom with the
scroll wheel, double-click to reset. Touch pan and pinch are supported.

Each grid family can be toggled independently, along with the axes. The toggles are
not only cosmetic — switching a family off also removes the rhombs it generates, so
they answer "what does family *j* contribute?"

Hovering does different work per step. On step 3 it reads the K-tuple at the cursor
— any point, at any region size — and draws an arrow to the dual vertex that region
maps to. On step 4 it snaps to the nearest dual vertex, shows `f = Σ Kⱼ·vⱼ` term by
term, and runs the map *backwards*, clipping half-planes to recover and highlight
the source region.

### Three things that are not obvious

**Regularity is decided, not tested.** The construction needs no three lines
concurrent. That has a closed form: triple (a,b,c) is singular exactly when one
particular γ is an integer *and* a particular pair sums to an integer. So if no γⱼ
is an integer, the pentagrid is regular **everywhere** — ten integer comparisons, no
tolerance, no window. γ is held as exact rationals so those comparisons are exact.
The `keep γ regular` checkbox holds you off the singular set; uncheck it to sit on a
singularity deliberately. The default γ = 0 is singular, with all five lines through
the origin.

**Sub-pixel regions are normal, not exceptional.** A generic γ at default zoom
already has regions of ~0.04 px, because near-concurrent triples equidistribute. The
meter counts how many are too small to aim at, and the **loupe** opens automatically
as you approach one, magnifying adaptively — 8× or 8000× as needed. Move into the
panel to hover inside it; Esc dismisses it.

**The tiling is 5/2 the size of the grid that makes it.** `f(x) = (5/2)x + const +
bounded wobble`, because `Σ vⱼvⱼᵀ = (5/2)I`. The construction projects ℤ⁵ onto a
plane and each basis vector keeps 2/5 of its squared length there, so the gain is
the reciprocal. The `register 5:2` toggle draws the grid at 5/2 so every rhomb lands
on the crossing that generated it.

## Development

```
npm install
npm run build    # stamp the build id, then compile TypeScript
npm run dev      # tsc watch mode
npm run serve    # static server on :8001
```

`npm run build` writes `src/build-id.ts` first; the page shows that stamp next to
the step indicator and logs it to the console, so a stale script is obvious at a
glance. Both `dist/` and `src/build-id.ts` are generated and gitignored — CI
regenerates them, since the Pages workflow runs the same build.

`src/method.ts` is essentially the whole project. Plain `tsc`, no bundler, no
runtime dependencies.

## Notes

- [`PLAN.md`](PLAN.md) — the working plan: open items, site structure, and the
  explorations. Start here when picking the project back up.
- [`RESEARCH.md`](RESEARCH.md) — the open research question, a pentagrid built on
  the discrete directions rather than 72° ones.

## References

N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane,"
*Kon. Nederl. Akad. Wetensch. Proc.* **84** (1981).
