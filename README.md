# Pentagrid

Interactive explorations of de Bruijn's pentagrid method for constructing Penrose tilings.

**Live demo:** [jakeoil.github.io/pentagrid/method.html](https://jakeoil.github.io/pentagrid/method.html)

## Method

The [method page](https://jakeoil.github.io/pentagrid/method.html) walks through de Bruijn's dual construction in five steps:

1. **The Pentagrid** — five families of parallel lines at 72° intervals
2. **Intersections** — pairwise crossings, color-coded by family pair
3. **Dual Vertices** — the vertex function f(x) = Σ Kⱼ(x) · vⱼ
4. **Building Rhombs** — parallelograms from adjacent regions
5. **Penrose Tiling** — the complete rhomb tiling (thick 72° / thin 36°)

Five γ sliders control the grid offsets (constrained to sum to zero). Click any γ label to choose which slider is computed from the others. Pan with mouse drag, zoom with scroll wheel, double-click to reset. Touch pan/pinch supported.

## Development

```
npm install
npm run build    # compile TypeScript
npm run dev      # watch mode
```

Serve locally with any static server (e.g. `python3 -m http.server 8001`).

## References

N. G. de Bruijn, "Algebraic theory of Penrose's non-periodic tilings of the plane," *Kon. Nederl. Akad. Wetensch. Proc.* **84** (1981).
