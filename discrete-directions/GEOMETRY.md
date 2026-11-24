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
- [6. The floater](#6-the-floater)
- [7. What is affine, and what is not](#7-what-is-affine-and-what-is-not)
- [8. The three modes](#8-the-three-modes)
- [9. Open](#9-open)

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
are about. §6 is what happens when that handle is handed to one of the five
instead.

Three seeds are kept as presets. Their centroids are §5's subject:

| preset | the five points | centroid | 5 × centroid |
| --- | --- | --- | --- |
| `classic` (quadrille) | (0,−3) (3,−1) (2,3) (−2,3) (−3,−1) | (0, ⅕) | (0, 1) |
| `asymmetric` | (−2,−4) (3,−3) (3,2) (−1,4) (−5,0) | (−⅖, −⅕) | (−2, −1) |
| `even` | (3,2) (0,2) (−3,2) (−2,−3) (2,−3) | **(0, 0)** | (0, 0) |
| `real` | the regular pentagon, edge 4 | (0, 0) | (0, 0) |

`even` is §8's find and the only lattice seed of the four whose centroid is
already a lattice point — its five sum to zero, which is what that means. It
was searched for rather than drawn, and it settles twelve times closer to
Penrose than the quadrille at a fifth of the size.

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
converge. Those two are the tenths at which the quadrille's rhomb is genuinely
equilateral, and there are only two of ten; §9 has the other four shapes it
settles into.

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
| `even` | **4** | 2.5714 | 25 | **0.10286** | **2** | 58 |
| `real` | 5 | 4.0162 | 27.5276 | **0.14590** | 5 | 102 |

φ⁻⁴ = 0.14590 — the area ratio of **one deflation**. On the regular pentagon
that is not a near miss: the fence *is* `pentagon(deflate(w), 1)`, the pentagon
one generation down and inverted, agreeing vertex for vertex to 1.4e-15. On the
quadrille it is a different pentagon of nearly the same area, which is the
discrete geometry answering for itself again rather than approximating the real
one.

**But it is not a law, and `even` is what showed that.** Its fence is a
four-sided **kite** — (0, −1), (6/7, −1/7), (0, 2), (−6/7, −1/7) — because one of
the five half planes is slack rather than binding, and its ratio is 0.10286, a
third short of φ⁻⁴ rather than two parts in a thousand off it. "At most five
sides" above means **at most**; a test here asserted *exactly* five until a
fourth seed was asked. What the three near-φ⁻⁴ rows have in common is being
round at generation 0, which `even` is not — see §8: it is lopsided where the
quadrille is even, and even where the quadrille is lopsided, and only one of the
two survives the ladder.

The integer counts are the practical fact: **two** places the classic seed's
origin may sit, six for the asymmetric one. The ⅕ counts are why the center
snaps to a fifth and the five corners do not — on that grid there is room to
maneuver, and §5 is where you are maneuvering to. Jake, 2026-11-23: *in snap
mode only the centroid need snap at 1/5. [...] moving centroid moves 1/5, moving
points moves 5/5.* There is no fifths *mode*: the two handles are different
kinds of thing and each lands on its own grid under one setting.

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

Which is what it would take to make these rhombs fit the grid. Jake did it on
2026-11-23, and what the 5× seed buys and what it does not is §9's first item.

**It is indicated.** Nothing about the figure's outline says any of the above
has happened, so the center draws as a bullseye — a white pupil inside the dot —
and the readout says *on the sweet spot*. The `centroid` button goes there in one
press; the fifths ruled across each unit square are how you get there by hand.

Code: `centroidOf` and `centered` in `src/math/seed.js`; the `centroid` button
and the `centroid` rhomb mode in the UI, with the center snapping in fifths
because the sweet spot is never an integer unless the five happen to sum to a
multiple of five. Held by three tests in `tests/seed.test.mjs`, and `Drawn.sweet`
reports it to whatever is drawing.

---

## 6. The floater

Jake, 2026-11-23: *I would like to be able to assign a floater point by double
clicking it. By default, the center is a floater. But you will be able to fix
the center by choosing another point as the floater. Analogous to the sums/gamma
system in the reticulum.*

The analogy is exact, and it is the reason this section is short: the pentagrid
already has this machinery, and it transfers without adjustment.

| reticulum | pentadiculum |
| --- | --- |
| five offsets γⱼ | six handles: the five points and the origin |
| Σγ, a target you can retarget | Σ spokes, likewise |
| the **locked** index | the **floater** |
| clicked on its γⱼ label | double-clicked on its handle |
| the dependent axis refuses a push | the floater is not pushed; it follows |
| `locked = −1`, the total floats | `floater = −1`, every handle is free |

### The invariant is Σ spokes, and it is five times the offset to the centroid

    Σ(pₖ − o)  =  Σp − 5o  =  5·(centroid − origin)

This is the only quantity the origin and the five determine *jointly* — §1's
statement that the origin adds a handle rather than geometry is exactly the
statement that it has one job, and this is the thing that measures it. Holding
it fixed holds the origin's **offset from the centroid**, so the origin keeps
its relationship to the figure instead of being left behind by a corner drag.

Zero is the sweet spot of §5. So:

> with the center floating and the held value zero, **no drag can leave the
> sweet spot** — P = S, `inflate(D) = T`, all three rhomb spellings one exact
> parallelogram, however the pentagon is reshaped.

Which is §5 turned from a place you can reach into a place you can stay. Press
`centroid` once and it is armed; the test walks four corner drags and checks P =
S and `inflate(D) = T` at every tenth after each one.

### The three cases are each one unknown

- **The center floats** (the default): `o = (Σp − target) / 5`. Drag a point by
  δ and the origin follows by δ/5; the dragged spoke moves 4δ/5 and the other
  four −δ/5 each. Measured, not asserted.
- **A point floats**: Σp must stay at `target + 5o`, so that point takes the
  remainder — drag another by δ and it answers with −δ. The **centroid is
  pinned** and the pentagon flexes about it. The origin is then not a handle at
  all, which is Jake's *fix the center*: absorbing an origin drag would cost the
  floating point five units per unit of origin, and a handle that flings another
  handle five times as far is not a handle anyone can use. It draws at the size
  it already uses off the base rung, where it is not a handle either.
- **Nothing floats**: the plain move, exactly as before any of this.

Dragging the floater itself is a plain move too, and that is how the target is
**retargeted** — the reticulum's sum strip, not its locked dial. Without it the
origin could never be placed once it was floating, and the fence of §3 would
stop meaning anything.

A driven handle is never snapped, because it is determined rather than chosen.
With the five on units and the target zero it lands on a **fifth**, which is the
second reason that snap setting exists (§5 is the first). The one division by
five is also the only inexactness in the rule, and it is swept at the twelfth
decimal so a readout does not show 0.20000000000000004.

The constraint does not protect the seed: a driven handle can be pushed until
the ten spokes go out of order, and then `checkSeed` says which two points did
it. That is the same bargain as §9's note about the fence — seeing the illegal
state has been worth more than being unable to reach it.

Code: `spokeSum` and `moveHandle` in `src/math/seed.js`, which is the whole
rule; `src/ui/pentadiculum.js` only reports the gesture, exactly as
`src/ui/dials.ts` never computes a locked γ. Seven tests in
`tests/seed.test.mjs`, five more for the gesture in `tests/pentadiculum.test.mjs`.

---

## 7. What is affine, and what is not

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

## 8. The three modes

Jake, 2026-11-23: *what is the nature of the pentadic set defining the rhombus.
… What is the smallest pentadic vector set which adds to a sum divisible by 5.
what happens to the centers of the extrapolations (wheel successors) of such
"even" pentadicae.*

The answer is a decomposition, and once it is written down §4, §5, §7 and §9 stop
being four findings and become one.

**A wheel has only five Fourier modes.** Ten tenths, but `W[t+5] = −W[t]` kills
every even one, so a wheel is m = 1, 3, 5, 7, 9 and nothing else. `inflate` is
the circulant `W[t−1] + W[t] + W[t+1]`, whose multiplier at mode m is
1 + 2·cos(36m°) — and the three values it takes are the whole story:

| mode | multiplier | what it is | what the ladder does to it |
| --- | --- | --- | --- |
| m = ±1 | **φ²** = 2.618034 | the figure: a regular decagon at m = 1 and its counter-rotating twin at m = 9 | both grow by the same factor, so **their ratio never changes** |
| m = 3, 7 | **φ⁻²** = 0.381966 | the wobble | dies like φ⁻⁴ against the figure — gone by generation 8 |
| m = 5 | **−1** | **Σ spokes** | flips sign, and never shrinks |

Measured on the quadrille, amplitudes at generations 0, 2, 4, 6:

    m1    3.306   22.659   155.308   1064.497      x phi^2 a generation
    m9    0.083    0.568     3.896     26.704      x phi^2 a generation
    m3    0.039    0.006     0.001     0.0001      x phi^-2
    m5    0.200    0.200     0.200     0.200       constant, sign alternating

    m9/m1   0.02509 at every one of them
    m3/m1   1.18e-2  2.51e-4  5.33e-6  1.14e-7

### m = 5 is the origin, and §4 is its eigenvalue table

The mode-5 multiplier of a comb Σⱼ sⱼ·D[t + kⱼ] is Σⱼ sⱼ·(−1)^kⱼ — which is
*exactly* §4's `c_X`. So §4's perturbation law says one thing: **the origin
handle lives entirely in mode 5.** `E` has c = 0 because `E` annihilates mode 5,
and that is the whole reason tile edges do not care where you measure from.

The ladder's own rows read the same way. Measured: `inflate` and `deflate` each
send Σ spokes to −Σ exactly, `halfUp` to −2Σ and `halfDown` to +2Σ, for every
seed and at every generation.

### The rhombs' failure to close IS the spoke sum

The `classic` spelling opens in `inflate(D)` and runs in `T`, and `W[t+5] =
−W[t]` makes the third step the second's opposite, so

    e0 + e2  =  inflate(D)[n+9] − T[n+9]

and those two φ² wheels differ by a pure mode-5 term. Therefore

    |e0 + e2|  =  |Σ spokes|     exactly — every tenth, both specs, every generation

| seed | Σ spokes | │Σ│ | worst `│e0 + e2│` |
| --- | --- | --- | --- |
| quadrille | (0, 1) | 1 | 1.000000 |
| asymmetric | (−2, −1) | 2.236068 | 2.236068 |
| quadrille ×5 at (0,0) | (0, 5) | 5 | 5.000000 |
| `real` | (0, 0) | 0 | 0 |

§7's kite is this and nothing else, and §5's four statements are the single
statement **m₅ = 0**.

And see what does *not* happen. The ladder only flips mode 5's sign while the
figure grows by φ², so the hole is a fixed size in lattice units. **The rhombs
never close up. They get bigger around a constant gap**, which is why §9's 5×
scaling made the misfit five times larger rather than five times smaller.

### Even pentads

Jake's word for a seed with m₅ = 0. Four ways of saying it, all the same thing:

- the five spokes sum to **zero**;
- five lattice points whose sum is **divisible by five**, seen from their own
  centroid — which is then a lattice point;
- the centroid and the origin coincide, so §5's sweet spot is *integral*;
- the five are the edge vectors, in order, of a **convex lattice pentagon with
  no two sides parallel**.

**The centers of the extrapolations do not move.** m₅ = 0 is carried by an
eigenvalue, so every wheel successor of an even pentad is even too: the five
points sum to zero at every generation, up the ladder and down it, and the
centroid stays on the lattice point it started from. That is the direct answer
to the question, and it is why an even pentad is worth hunting for — it is not a
property you arrange at one generation and lose at the next.

Sorting the ten ± by angle puts the five chosen at the **even** positions, which
reads off as u₀, u₂, u₄, −u₁, −u₃ where u₀..u₄ are the five sorted by direction
within one half turn. So the condition is an **alternating sum**:

    u0 − u1 + u2 − u3 + u4  =  0

which is what turns the search into a four-deep loop with the fifth *solved*.

**The smallest is Σ│v│² = 14**, reach √5, the pentagon's area exactly 4. There
are four of them, and they are one shape under the square lattice's own eight
symmetries:

    (1,0) (1,2) (−1,1) (−1,−1) (0,−2)
    (1,0) (0,2) (−1,1) (−1,−1) (1,−2)
    (2,0) (1,1) (−1,1) (−2,−1) (0,−1)
    (2,0) (0,1) (−2,1) (−1,−1) (1,−1)

It is a terrible pentagon — spokes of 1, √2, √2, 2 and √5 — and that is the
point of the next part: **smallest is not roundest.**

### The anisotropy is what is left, and it is permanent

With m₅ killed and m₃ dying on its own, one number survives: **m₉ / m₁**, the
ratio of the counter-rotating twin to the figure. Both grow by φ², so the ratio
is an exact invariant of the whole tower — it is the anisotropy of the limiting
**affine** map, which is §7 from the algebra's side: the limit of any seed is an
affine image of the regular decagon, and it is a *similarity* only if m₉ = 0.

It sets the rhombs' shape directly. Measured over a range of seeds, the limiting
edge spread obeys

    spread − 1  →  1.80902 × (m9 / m1)        and 1.80902 = 1 + cos 36°

to four figures as the anisotropy goes to zero. The frontier, searched by
`tools/pentads.mjs` out to reach 9 — each row the roundest even pentad that fits
inside that reach:

| reach | m₉/m₁ | rhomb spread | acute angles | spokes |
| --- | --- | --- | --- | --- |
| √5 = 2.236 | 4.4994% | 1.089391 | 33.21–76.72° | (2,0) (0,2) (−1,1) (−2,−1) (1,−2) |
| 2√2 = 2.828 | 2.5086% | 1.046657 | 34.34–74.75° | (2,0) (1,2) (−2,2) (−2,−2) (1,−2) |
| 3 | 1.2782% | 1.023335 | 35.31–73.13° | (3,0) (1,2) (−2,2) (−2,−1) (0,−3) |
| √13 = 3.606 | **0.2024%** | **1.003668** | **35.89–72.18°** | **(3,2) (0,2) (−3,2) (−2,−3) (2,−3)** |
| √26 = 5.099 | 0.1032% | 1.001868 | 35.93–72.11° | (5,1) (−2,3) (−3,2) (−1,−5) (1,−1) |
| √52 = 7.211 | 0.0321% | 1.000580 | 35.98–72.03° | (6,4) (−2,5) (−5,2) (−4,−6) (5,−5) |
| √73 = 8.544 | 0.0163% | 1.000296 | 35.99–72.02° | (8,3) (0,6) (−8,3) (−2,−6) (2,−6) |

Out to reach 13 — 39,953,870 even pentads — the frontier adds only 0.0122% at
12.166, 0.0091% at 12.369 and 0.0077% at 13. The returns stop early; √13 is
where the curve bends.

**The quadrille sits at 2.5086%**, the second row's number exactly — reach 17.205
once scaled by five to make it even, for a figure the 2√2 pentad draws at a
twentieth the size. And the √13 pentad, five times smaller again than the scaled
quadrille, settles **twelve times rounder**: rhombs within 0.37% of equilateral
and within a fifth of a degree of 72° and 36°, with every vertex on **Z²** and
the center on a lattice point. A `Sun` patch at generation 2 on it: 136 tiles,
690 of 690 tile vertices and 1460 of 1460 rhomb corners integral.

Jake: *my classic pentagon was not the ideal because it lacked an integral
center.* It lacked both. The quadrille is neither the roundest nor the smallest
lattice seed, and nothing about it was ever chosen for either — it is
penrose-mosaic's, inherited.

The √13 pentad is the page's `even` preset — `EVEN_PENTAD` in
`src/math/wheel.js`. Press `centroid` on it and nothing moves: it is already
there.

Code: `tools/pentads.mjs` (`mode`, `evenPentads`, `settledRhombs`), run as
`node tools/pentads.mjs [reach]`. Held by `tests/modes.test.mjs`.

---

## 9. Open

### Make the quadrille rhombs fit the grid: the 5× seed

§5's move, carried out. Jake, 2026-11-23, having gone and done it on the page:

> I discovered awfully misshapen Penrose rhombs. My pentas and star centers were
> off. No big deal for pentas, but every 1x1 tile has to grow by 5x5 to
> accommodate the new centroid. The rhombs are now very large. Following the
> decagon, (15, −6), (10, −14), (0, 16), … you can extrapolate wheels and
> pentagons. I can't see the fit.

**Why he had to.** The rhombs are parallelograms only at the centroid (§5), and
the quadrille's centroid is (0, ⅕) — not a lattice point. Centering therefore
takes the whole figure *off* the lattice, which is exactly *my pentas and star
centers were off*. Scale the five points by five and the centroid becomes the
lattice point (0, 1), so you can have both at once:

    points    (0,-15) (15,-5) (10,15) (-10,15) (-15,-5)
    centroid  (0, 1)                  <- a lattice point, which is the whole point
    spokes    (0,-16) (15,-6) (10,14) (-10,14) (-15,-6)

    decagon   (0,-16) (10,-14) (15,-6) (15,6)   (10,14)
              (0,16)  (-10,14) (-15,6) (-15,-6) (-10,-14)

Every number he quoted is a tenth of that decagon.

**The scaling buys exactness, and it buys all of it.** Measured on the 5× seed,
origin on the centroid, at generations 1, 2 and 3: the D, E, P and T wheels, the
pentagon vertices, the star vertices and all twenty rhombs are **on Z²** at every
one. Nothing is left over the half-lattice, and nothing drifts with generation,
because every operator in `wheel.js` is an integer combination of the five.

What it also buys is the shape. Big rhombs (generation 1), `classic` spelling:

| origin | edge lengths | longest/shortest | worst `\|e0 + e2\|` |
| --- | --- | --- | --- |
| (0, 0) | 40.00 – 47.17 | 1.179 | **5.00**, 10.6% of the longest edge |
| the centroid (0, 1) | 42.38 – 44.00 | 1.038 | **0** |

So *awfully misshapen* is measured, and it is the kite of §7, not a rendering
fault: a tenth of an edge of skew, on a figure 44 lattice units across. The
centroid removes it exactly.

**What it costs is size, and he is right about the size.** The edge wheel at
generation 1 is (20,0) (15,10) (5,20) (−5,20) (−15,10) — tile edges of 18.028,
20.000 and 20.623 lattice units where the seed's own edge used to be 4. Rhomb
edges run 16.00 – 17.20 for the little ones and 42.38 – 44.00 for the big. That
is *every 1x1 tile has to grow by 5x5*, said in the figures: the square that
used to frame a tile now frames a twenty-fifth of one.

**The fit is there. It is arithmetic, which is why it is hard to see.** A `Sun`
patch at generation 2 on the 5× seed — 136 tiles, 365 little rhombs:

| | |
| --- | --- |
| tile vertices on Z² | 690 of 690 |
| rhomb corners on Z² | 1460 of 1460 |
| distinct rhomb corners | 411, of which **136 are exactly the tile centers** |
| rhomb corners on a tile *vertex* | 0 |
| distinct rhomb edges | 775, of which **685 are shared by two rhombs** |
| the 90 that are not | all at radius 133 – 178: the patch's rim |

Identical at the origin and at the centroid, which is §7 again — the overlay's
*combinatorics* does not depend on the origin, only its shape does. So the
overlay is edge-to-edge, it hangs on the P1 tiles by their centers, and on the
5× seed every last vertex of it is a lattice point.

**What is not there is a rhomb.** Converged by generation 8 and read off at
generation 12, the quadrille has **three** thick shapes and **three** thin ones,
not one each:

| | at how many tenths | longer/shorter edge | acute angle |
| --- | --- | --- | --- |
| thick | 2 | 1.000000 | 69.2876° |
| thick | 4 | 1.046202 | 71.1377° |
| thick | 4 | 1.028799 | 74.2184° |
| thin | 2 | 1.000000 | 37.7245° |
| thin | 4 | 1.028799 | 36.4939° |
| thin | 4 | 1.016915 | 34.6438° |

§1's two angles are the first and fourth rows: the two tenths of ten at which
the figure is genuinely equilateral. At the other eight it is a parallelogram up
to 4.6% off and five degrees away, and that **does not shrink** — the spread
converges to 1.04620 and stays. It is the seed's three spoke lengths (16.000,
16.155, 17.205 at 5×) showing through the overlay, so no origin and no scale can
remove it. *Fit the grid* can mean lattice-exact, and that is now had; it cannot
also mean equilateral.

**Which leaves three questions actually open.**

1. **Is there a lattice seed whose rhombs are rhombs?** Ten lattice points on
   one circle is not impossible — radius √65 carries sixteen — so equal spokes
   are not ruled out by counting, and whether equal spokes in angular order
   would even give an equilateral T wheel is a second question. Nothing here
   settles either.
2. **Is the 5× quadrille the same tiling at a different scale, or a different
   object?** Open as it was, and now sharper: the figure it draws is
   combinatorially identical and metrically not.
3. **It is no longer penrose-mosaic's figure.** The 5× centered rhombs are the
   parallelograms, and §7's count says the tidy spellings match the oracle at 0
   of 40. The overlay tiles; it just is not the one the oracle stores. Whether
   that is a loss is a judgment nobody has made yet.

### The fence is drawn, not enforced

`nearestOrigin` exists and nothing calls it: dragging the origin out of the
fence is allowed, and the figure says so by going hollow and naming the two
points that went out of order. Clamping instead is a one-line change if that
turns out to be wanted, but being able to *see* the illegal state has been more
useful than being prevented from reaching it.

### The rest of the list

**Arbitrary cyclic pentagons**, functional wheels rather than tabular, and
deflation inward are step 6 of `PLAN.md` and not this document's business yet.
The Star patch is still broken and still has a test asserting so.

---

## Where it lives

| | |
| --- | --- |
| `src/math/seed.js` | the seed, the check, the fence, the centroid, the floater |
| `src/math/wheel.js` | the ten directions, the operator family, the ladder |
| `src/math/walk.js` | tile outlines as tenth-walks, the rhombs, the spellings |
| `lib/wheels.js` | all of the above, as a pinned public surface |
| `src/ui/pentadiculum.js` | the instrument: the figure, the handles, the fence drawn |
| `lib/pentadiculum.js` | the instrument, as a pinned public surface |
| `tests/seed.test.mjs` | §2, §3, §5, §6 |
| `tests/walk.test.mjs` | §7, and the mosaic oracle |
| `tools/pentads.mjs` | §8: the mode amplitudes, and the even-pentad search |
| `by-your-bootstraps.html` | all of it, with handles on it |
