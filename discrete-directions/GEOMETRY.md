# Gaussean Pentadic Geometry

**Five ordered Gaussian integers and the lattice point they radiate from.**

Jake named it on 2026-11-22, when the origin on the input figure became a thing
you could move. The name is the definition: *Gaussean* because the five points
are Gaussian integers — points of **Z²**, not of the plane; *pentadic* because
there are five of them and they are **ordered**; and the geometry is in what you
may do to them and what it costs.

This file is the **object**. `PLAN.md` is the charter and says what is being
built; `NOTES.md` is the argument, left as it was written while it was being
had; `WISHLIST.md` is what penrose-mosaic has that this does not. What follows
is just the geometry, with each claim pointing at the code that computes it and
the test that holds it.

Every number quoted here was measured, not derived on paper and hoped for.

- [1. The object](#1-the-object)
- [2. When five points are a seed](#2-when-five-points-are-a-seed)
- [3. The fence](#3-the-fence)
- [4. The perturbation law](#4-the-perturbation-law)
- [5. The centroid](#5-the-centroid)
- [6. What is affine, and what is not](#6-what-is-affine-and-what-is-not)
- [7. Open](#7-open)

---

## 1. The object

A **seed** is five ordered positions and the point their spokes are measured
from:

    seed = (p0, p1, p2, p3, p4; o)        pk, o in Z^2
    spokes:   sk = pk - o

The **ten directions** are the spokes and their negatives, interleaved:

    W[2k]     =  sk
    W[2k + 5] = -sk

That is the whole construction's one asymmetry and its one economy. The list is
**ordered**, so a rotation is an index shift and nothing else; the negatives are
*in* the wheel, so a half turn is a shift by five. **No step in this geometry
reflects.** There is no mirror operator anywhere, which is exactly why the five
points may be asymmetric and everything downstream still works.

**The origin adds no geometry.** Jake, putting it straight when the first draft
of this said otherwise: *the operation of moving the origin is effectively just a
translation of the five points.* Moving `o` by δ gives the same ten spokes as
moving all five points by −δ, so `(p, o)` and `(p − o, 0)` are **the same
seed**. The parameterization is redundant on purpose.

What it adds is a **handle**: the one motion the five corner handles cannot make
between them, which is sliding the pentagon over the lattice as a block. With
snap on, that is the question of *which lattice point the pentagon is centered
on* — and the answer turns out to matter a great deal, which is what §3 and §5
are about.

Three seeds are kept as presets. Their centroids are §5's subject:

| preset | the five points | centroid | 5 × centroid |
| --- | --- | --- | --- |
| `classic` (quadrille) | (0,−3) (3,−1) (2,3) (−2,3) (−3,−1) | (0, ⅕) | (0, 1) |
| `asymmetric` | (−2,−4) (3,−3) (3,2) (−1,4) (−5,0) | (−⅖, −⅕) | (−2, −1) |
| `real` | the regular pentagon, edge 4 | (0, 0) | (0, 0) |

`real` is in **R²** rather than **Z²** and is kept as the control: it is what the
discrete seeds are *not*, and the place to check whether a claim is about
pentagons or only about lattice pentagons. Its edge wheel has **one** length, 4
— it is scaled so that it does — while the classic seed's has **three**, 3.6056,
4 and 4.1231, and the asymmetric one's has **four**.

That spread is not an error term, and it does not shrink. The quadrille is **not
a rational approximant creeping toward Penrose**: its rhombs settle on angles
fixed by its own two limiting directions, 34.643814° and 71.137740°, and stay
there —

    thick acute  ->  2 x 34.643814        =  69.287628     (not 72)
    thin  acute  ->  180 - 2 x 71.137740  =  37.724519     (not 36)

— while `real`'s rhombs are 72° and 36° at every generation, with nothing to
converge.

Code: `src/math/seed.js` (`seedOf`, `spokesOf`, `wheelOf`), `src/math/wheel.js`
(`wheelFromPoints`, the operator family). Nothing under `src/math/` knows a
canvas exists.

---

## 2. When five points are a seed

Not every five points are. The condition is on the **ten spokes**, not on the
five points:

> The ten must be in angular order: each step turns the same way, by less than a
> half turn, closing at exactly one full turn.

    cross(W[t], W[t+1]) > 0   for every t,   and   sum of turns = 2*pi

**A perfectly convex pentagon can fail this.** Convexity of the five is not the
condition and never was; interleaving with the negatives is. That is why the
check is written on the wheel and why it is worth having an explicit verdict in
the UI rather than discovering it by the figure falling apart.

`checkSeed` returns `{ ok, why }` and `why` is written to be read by somebody
with a handle under their thumb, so it names the **point** and not the tenth:

| what happened | what it says |
| --- | --- |
| a spoke is zero | `the origin is on point 3` |
| `cross = 0` | `points 1 and 2 are in line with the origin` |
| `cross < 0` | `points 1 and 2 are out of order around the origin` |
| turn ≠ 2π | `the five wind more than once round the origin` |

The middle two are kept apart deliberately. *In line* is the fence's **boundary**
rather than its outside: it is what somebody dragging the origin meets first,
and it is repaired by a nudge in any direction rather than by going back where
they came from. The test for it is relative — `|cross| <= 1e-9 · |a||b|` — since
an absolute epsilon means something different for a seed of radius 3 and one of
radius 300.

Held by `tests/seed.test.mjs`.

---

## 3. The fence

**The origin cannot go just anywhere, and the legal region is exact.**

Read as translation — which is what it is — the statement is worth saying out
loud: *a pentagon's five points cannot be slid very far as a block*, although
dragging them one at a time is comparatively free.

### Why it is a polygon

Each order condition, written out in the origin, is **affine** in it:

    cross(pa - o, pb - o) = cross(pa, pb) + cross(pb - pa, o)

because the `o × o` term cancels. So the legal set is an intersection of half
planes: **a convex polygon, computed exactly, for any five points.**

### Why it has five sides and not ten

`W[t+5] = −W[t]`, so

    cross(W[t+5], W[t+6]) = cross(-W[t], -W[t+1]) = cross(W[t], W[t+1])

The ten conditions are **five conditions, each stated twice**. The fence
therefore has **at most five sides, always**.

### What it measures

| preset | sides | fence area | pentagon area | ratio | integer origins | ⅕ origins |
| --- | --- | --- | --- | --- | --- | --- |
| `classic` | 5 | 3.7614 | 26 | 0.14467 | **2** | 88 |
| `asymmetric` | 5 | 6.2761 | 43.5 | 0.14428 | **6** | 155 |
| `real` | 5 | 4.0162 | 27.5276 | **0.14590** | 5 | 102 |

φ⁻⁴ = 0.14590 — the area ratio of **one deflation**. On the regular pentagon
that is not a near miss: the fence *is* `pentagon(deflate(w), 1)`, the pentagon
one generation down and inverted, agreeing vertex for vertex to 1.4e-15. On the
quadrille it is a different pentagon of nearly the same area, which is the
discrete geometry answering for itself again rather than approximating the real
one.

The integer counts are the practical fact: **two** places the classic seed's
origin may sit, six for the asymmetric one. The ⅕ counts are why `snap` has a
fifths setting — on that grid there is room to maneuver, and §5 is where you are
maneuvering to.

### Its edges mean something

On `cross(W[t], W[t+1]) = 0` two adjacent spokes line up, so the boundary is
exactly the origins at which **two of the five points fall in line with the
origin**. The fence is closed and `checkSeed` rejects its edges, which is right:
a wheel with two spokes in one direction has nine, not ten.

Code: `originFence` in `src/math/seed.js`, which reads the affine coefficients
off three probe origins rather than deriving the indices by hand, clips a box by
the five half planes, and then strips vertices that are repeated *or* collinear
— the regular pentagon's fence is a pentagon only once both are gone.
`nearestOrigin` projects onto it, for a consumer that wants to clamp a drag
rather than let it go illegal.

Held by `tests/seed.test.mjs`, including a brute-force agreement check over a
121 × 121 grid of candidate origins per preset — 14,641 each — with
disagreements tolerated only within 1e-9 of an edge. That tolerance is not
slack: the seeds are integer points and the grid step is rational, so landing
exactly on an edge is not a freak event, and it happened five times before the
test allowed for it.

---

## 4. The perturbation law

Moving the origin by δ moves every wheel, and by how much is a single rule.
Write σ_t = (−1)^t. Then

    X[t]  ->  X[t] - c_X * sigma_t * delta

and for any wheel spelled as a comb of the D wheel,

    X[t] = sum_j  s_j * D[t + k_j]        =>        c_X = sum_j  s_j * (-1)^(k_j)

The sign alternates because D itself does: an even tenth is a spoke and an odd
tenth is its negative, so the shift lands on them with opposite signs. Measured
over all ten tenths, every coefficient constant to 1e-14:

| wheel | spelling | c |
| --- | --- | --- |
| D | the five spokes | **+1** |
| P | `D[t−1] + D[t+1]` | −2 |
| S | `D[t−2] + D[t] + D[t+2]` | +3 |
| T | `S + D` | +4 |
| **E** | `D[t+1] − D[t−1]` | **0** |
| `inflate(D)` | `P + D` | −1 |
| `deflate(D)` | | −1 |
| `halfUp(D)` | | −2 |

**A wheel is origin-invariant exactly when its comb coefficients sum to zero,
and E is the only one of the family that does.** Which is a real fact about the
geometry and not a curiosity: E is the **edge** wheel, so *tile edge lengths and
directions do not depend on where you measure from*. The shapes a seed makes are
the seed's; only their placement is the origin's.

Measured directly as well as predicted: the E wheel at the centroid is identical
to the E wheel at (0, 0) on all three presets, to 1e-12.

---

## 5. The centroid

**The sweet spot.** Jake found it by dragging: *if I move the center to a "sweet"
spot, the rhombs look beautiful, but the sweet spot is not integral. Find the
formula for that sweet spot, and its technical name.* It is the **centroid** —
the barycenter of the five points — and it is exact:

    o* = (1/5) * sum pk

Four statements, all of them the same fact.

### P = S

The two φ-wheels coincide there, because they differ by exactly the sum:

    P[t] - S[t] = -(-1)^t * sum pk        at every tenth, residual 0

Zero the sum and the gap closes. Verified exactly on the integer presets (the
residual is 0, not small) and to 4e-16 on the regular one.

### inflate(D) = T

Since `T = S + D` and `inflate(D) = P + D`, `P = S` is `inflate(D) = T`. That is
the condition the page has carried as an open note from the beginning — *"modes
can be unified if the real of d + p == t"* — and this is where it unifies.

### The three rhomb spellings become one quadrilateral, and it is a parallelogram

Worst skew over both generations, all ten tenths and both rhomb specs, as
`|e0 + e2|` over the longest edge:

| preset | origin | `classic` | `t` | `inflated` |
| --- | --- | --- | --- | --- |
| `classic` | (0,0) | **0.2774** | 0 | 0 |
| `classic` | centroid | 2.6e-16 | 6.9e-17 | 1.0e-16 |
| `asymmetric` | (0,0) | **0.4472** | 0 | 0 |
| `asymmetric` | centroid | 2.2e-16 | 9.6e-17 | 9.6e-17 |
| `real` | either | 2.9e-16 | 5.0e-17 | 1.0e-16 |

So the kite `walk.js` documents **is not deliberate geometry**. It is what
measuring from a point that is not the centroid looks like. And the regular
pentagon never had the problem because its centroid is already its origin, which
is also the reason `real` shows no skew at (0, 0) and needs no correction.

### It is rational — better than rational, it is in (1/5)Z²

The five points are integers, so the centroid's denominator is exactly **5**:
(0, ⅕) for the classic seed, (−⅖, −⅕) for the asymmetric one. Jake: *I hope the
sweet spot is in Q at least.* It is, and the useful form of that is

> **scale a seed by five and its sweet spot is a lattice point.**

Which is what it would take to make these rhombs fit the grid, and is the first
place to look in §7.

Code: `centroidOf` and `centered` in `src/math/seed.js`; the `centroid` button
and the `centroid` rhomb mode in the UI, with `snap` following down to fifths
because the sweet spot is never an integer unless the five happen to sum to a
multiple of five. Held by three tests in `tests/seed.test.mjs`.

---

## 6. What is affine, and what is not

Jake's finding, from the page, before any of this was computed: *my findings are
that pentagons and stars are affine, that is, not relying on choice of the
origin.* Measured, by removing the mean translation and asking what deformation
is left:

| figure | deformation after removing the translation |
| --- | --- |
| pentagons, all three presets | ≤ 4.6e-16 |
| stars, all three presets | **0** |

So **pentagons and stars move rigidly** under an origin change: pure
translation, no distortion, nothing to choose. The E wheel being the invariant
one (§4) is the same statement from the algebra's side — their edges are E
vectors.

The rhombs are the exception, and only in one spelling:

- `t` and `inflated` are **exact parallelograms at every origin** — skew
  identically 0, not merely small.
- `classic` skews, and it already skews at the origin: 0.2774 on the classic
  seed, 0.4472 on the asymmetric one. It is not an affine spelling and no choice
  of origin makes it one, except the centroid, where it stops being distinct
  from the other two.

**Which is the disappointing answer to the question that was asked.** Jake: *not
unexpected and rather disappointing, since my goal was an affine solution. I may
have to do research to find a way to make quadrille rhombs fit the grid. For now
let's call the algorithm for these rhombs "classic".* Hence the name — `classic`
is a named algorithm, not a description of a property it has.

And it is kept as the default for a hard reason: `classic` matches
penrose-mosaic's stored rhombs on **all 40** (ten tenths × two specs × two
generations), and the tidy spellings match **0 of 40**. The oracle stores the
un-centered rhombs. So the fork is real, and it is now a selector rather than a
dilemma: `classic` keeps the match, `centroid` gives the parallelograms.

Held by `tests/walk.test.mjs` (the 40 and the 0) and `tests/seed.test.mjs` (the
collapse at the centroid).

---

## 7. Open

**Make the quadrille rhombs fit the grid.** The 5× scaling above is the obvious
first move: on a seed scaled by five, the sweet spot is a lattice point, the
rhombs close as exact parallelograms there, and everything is back on **Z²** —
at the cost of a lattice five times finer. Whether that is the same tiling at a
different scale or a different object is not yet settled, and it is the question
to settle next.

**The fence is drawn, not enforced.** `nearestOrigin` exists and nothing calls
it: dragging the origin out of the fence is allowed, and the figure says so by
going hollow and naming the two points that went out of order. Clamping instead
is a one-line change if that turns out to be wanted, but being able to *see* the
illegal state has been more useful than being prevented from reaching it.

**Arbitrary cyclic pentagons**, functional wheels rather than tabular, and
deflation inward are step 6 of `PLAN.md` and not this document's business yet.
The Star patch is still broken and still has a test asserting so.

---

## Where it lives

| | |
| --- | --- |
| `src/math/seed.js` | the seed, the check, the fence, the centroid |
| `src/math/wheel.js` | the ten directions, the operator family, the ladder |
| `src/math/walk.js` | tile outlines as tenth-walks, the rhombs, the spellings |
| `lib/wheels.js` | all of the above, as a pinned public surface |
| `src/ui/pentadiculum.js` | the instrument: the figure, the handles, the fence drawn |
| `lib/pentadiculum.js` | the instrument, as a pinned public surface |
| `tests/seed.test.mjs` | §2, §3, §5 |
| `tests/walk.test.mjs` | §6, and the mosaic oracle |
| `by-your-bootstraps.html` | all of it, with handles on it |
