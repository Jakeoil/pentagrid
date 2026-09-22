# Discrete directions

A second geometry, and what happens if you dualize it.

Everything in the parent project is de Bruijn's: `n` families of parallel lines
at exactly 2π/n, and a dual tiling in the corresponding cyclotomic field. This
subproject is about a different object. [penrose-mosaic] builds Penrose tilings
on the **integer lattice** — exact coordinates at every generation, inflation an
integer substitution — and the natural assumption is that it is a rational
approximant converging back to the Euclidean 36° and 72°. It is not. The
substitution has its own dominant eigenvector, and its limiting slopes are
algebraic of degree 2 over ℚ, in ℚ(√5) — a *simpler* field than the true
tangents, which need nested radicals.

**Independent of the pentagrid pages**: it shares the mathematics and
`site.css`, nothing else. Its own `tsconfig`, its own `dist/`, its own test.

```
npm run build     # tsc -p .
npm test          # the substitution against penrose-mosaic's stated results
```

| file | holds |
|---|---|
| `src/wheels.ts` | the substitution, its exact inverse and the half step; the ten-point wheel and its pentagon; the limit, the five directions, the frame operator |
| `src/e2.ts` | E2's figure: the discrete wheel against the Euclidean one |
| `src/index-figure.ts` | the index figure: the quadrille pentagon beside the real one, on quadrille paper |
| `NOTES.md` | the working notes — the φ² ladder and its missing halves, ψ land below zero |
| `index.html` | the subproject's front door, pointing at its sub-subprojects |
| `e2.html` | E2 — the wheel, and the directions a discrete multigrid would use |

## The ladder

The wheels store only **even** powers of φ, so their x-components are alternate
Fibonacci numbers — 3, 8, 21, 55. The missing half is a two-term sum instead of
a three-term one (drop the middle), and interleaved the sequence is Fibonacci
exactly: 3, 5, 8, 13, 21, 34, 55, 89. It is a half step on x term for term and
on y up to an alternating ±2 — My's λ = −1 eigenvalue, penrose-mosaic's "±2
correction" — which is why φ² is where the two coordinates agree. Below zero
there is one more positive half generation, then the conjugate ψ = −1/φ takes
over. See `NOTES.md`.

## What is settled

    Mx = [1 0 0; 1 1 1; 0 1 2]      My = [1 2 0; 1 1 1; 0 1 0]

x and y evolve under two different integer matrices, because the wheel's two
reflections act on the coordinates differently. Both carry φ² and φ⁻², so the
growth is φ² — proved rather than measured; Mx carries an extra 1 (x₀ never
moves: the first seed stays on the vertical) and My an extra −1 (an alternating
component that neither grows nor decays). The limit, from the vertical:

    0, 34.6438, 71.1377, 108.8623, 145.3562, 180, 214.6438, 251.1377, 288.8623, 325.3562

    tan 34.643814° = (5−√5)/4        tan 71.137740° = (5+3√5)/4

Mirror symmetric about the vertical, as the reflection construction forces, but
with gaps 34.64, 36.49, 37.72, 36.49, 34.64 rather than five equal 36s. The
frame Σ v vᵀ is diagonal — the mirror survives — but **not** isotropic, so a
dual map built on these is a linear map with two gains, not a similarity.

## What is not

Dualizing them. Whether the dual stays two rhomb shapes or splits into ten
parallelogram types; whether the result is aperiodic (at any finite generation
the slopes are rational, so a grid built from them is periodic — only the limit
is irrational); and whether the resulting P3 regroups into the discrete P1
tiles, which would close the construction on itself.

Adapted from `penrose-mosaic/wheels.js` (the substitution), `shape-modes.js`
(the quadrille seeds) and `docs/wheels.md` (the derivation). The tests check
this copy against that project's stated results, so drift shows up as a failure
rather than as a quiet disagreement.

[penrose-mosaic]: https://github.com/Jakeoil/penrose-mosaic
