# Research notes

Open questions worth building something for. Not a TODO — these are experiments,
and the point is what they show.

## A pentagrid on the discrete directions

**The question.** De Bruijn's pentagrid uses five line families at exactly 72°.
What does the dual tiling look like if the families are set to the *discrete*
directions instead — the ones the `penrose-mosaic` integer construction actually
converges to?

**Where the numbers come from.** That project builds P1 from three integer
vectors, `(4,0)`, `(3,2)`, `(1,4)`, and inflates them by a substitution. Working
out the substitution matrix (`penrose-mosaic/docs/wheels.md`) gives the limiting
directions in closed form. They are **not** 36° and 72°:

| slot | limiting angle | tangent, exact |
| ---- | -------------- | -------------- |
| 1 | 34.643814° | `(5 − √5)/4` = `(3 − φ)/2` |
| 2 | 71.137740° | `(5 + 3√5)/4` |

Both algebraic of degree 2, in ℚ(√5). Matched to 3·10⁻¹⁶.

The full limiting wheel, mirror-symmetric about the vertical but **not**
five-fold:

```
0, 34.6438, 71.1377, 108.8623, 145.3562, 180, 214.6438, 251.1377, 288.8623, 325.3562
```

Gaps of 34.64, 36.50, 37.71, 36.50, 34.64 rather than five equal 36s.

**Why it is interesting.** The obvious guess is that the discrete construction is
a rational approximant that converges back to Euclidean Penrose as it inflates.
It does not. Its inflation generates its own irrational geometry, and these are
its directions. So a pentagrid built on them should be **aperiodic but not de
Bruijn's** — a five-family irrational multigrid that is genuinely a different
object, not a distorted view of the usual one.

An earlier prediction (preserved in `~/Documents/obsidian/projects/penrose/Mosaic
Chat.md`) was that such a grid would converge to the standard pentagrid in the
limit. The closed forms above say otherwise. That prediction is now testable
rather than speculative.

**What to build.** The method page already takes five directions and five γ
offsets. The experiment is to allow the directions to be set to the discrete
limits instead of 72° multiples, and look at the dual.

Things to watch for:

- Do the dual tiles remain two rhomb shapes, or do they split into more
  parallelogram types? The three discrete edge lengths differ — 4, √13, √17 — so
  an integral dual would give ten parallelogram types rather than two golden
  rhombs.
- Is the result still aperiodic? At any *finite* generation the discrete slopes
  are rational, so a grid built from them is periodic — a rational approximant
  whose period grows with generation. Only the limiting directions are
  irrational.
- Does the resulting P3 regroup into the discrete P1 tiles? If it does, the
  construction closes on itself: a geometry obtained by deforming Penrose,
  regenerated from below by dualizing its own multigrid.

**One constraint worth knowing up front.** You cannot have all three of exact
lattice coordinates, equal edge lengths, and five rational directions. The mosaic
keeps coordinates and directions, and approximates equal lengths. Any pentagrid
experiment inherits that trade.

**Background, if useful:** `penrose-mosaic/docs/wheels.md` for the substitution
matrix and limits, `penrose-mosaic/docs/basis-search.md` for why no integer basis
converges to Euclidean Penrose — `sin 36°` and `sin 72°` are degree 4 over ℚ,
while the lattice reaches only ℚ(√5).
