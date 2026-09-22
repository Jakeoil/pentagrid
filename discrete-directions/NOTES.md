# Working notes — discrete directions

Running record of what we have argued about in this corner and what is still
unsettled. Same project as the pentagrid, same build and same tests: the code
is `src/discrete/`, the test is `tools/discrete.test.mjs`, and this directory
holds the page and these notes. Fenced off, not split off — Jake: *this is all
part of the pentagrid project, don't overdo it.*

The house style is the parent's: American spellings everywhere, in prose,
identifiers and comments alike.

---

## The wheels step by φ², and the missing half is a subtraction

**Jake, 2026-09-22:** *the discrete wheel generation sequence only does even
generations (φ²). The wheel follows the Fibonacci sequence perfectly when we add
the in-between stuff.*

Confirmed, and it is exact. The stored wheels hold only even powers of φ — their
x-components are **alternate** Fibonacci numbers:

    generation   0    1    2    3    4    5    6
    x₁           3    8   21   55  144  377  987

which is why fitting an ordinary Fibonacci recurrence to them looks wrong: it is
being applied to every other term. The missing terms are a **two-term sum**
instead of a three-term one — drop the middle:

    inflate    s_k = w[k−1] + w[k] + w[k+1]      × φ²   (the stored generation)
    halfStep   s_k = w[k−1] + w[k+1]             × φ

Interleave them and nothing is missing:

    3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610

the Fibonacci numbers in order, from F₄. In the real geometry the same drop is
`w[k−1] + w[k+1] = 2cos36°·w[k] = φ·w[k]`; this is that identity's integer
shadow. (The parent project's PLAN records the real-geometry version and notes
that nobody had run it on the discrete wheels. Now someone has.)

**It is a half step on x exactly, and on y up to a parity.** Twice the half step
is one generation in x, term for term; in y it differs by

    (0, ±2), (0, ∓2), (0, ±2)      sign flipping each generation

which is **My's λ = −1 eigenvalue** — penrose-mosaic's "±2 correction", recorded
there as an empirical oddity. It is not an oddity: `char(My) = (1+λ)(λ²−3λ+1)`
carries an eigenvalue sitting on the unit circle beside the growth, and this is
it, showing itself the moment you take a φ step rather than a φ² one. So φ is
reachable exactly in x and up to that alternation in y, and **the wheels store
φ² because that is where the two coordinates agree.** That is the structural
reason for the even-generation ladder, not a choice.

## The seed is generation 1

**Jake, 2026-09-22:** *check penrose-mosaic/measurements.html for generation
number not matching. Is this intentional.*

It is, there, and this copy was the one out of step. `makeWheels` puts the seed
at `wheels.p[1]` and **one deflation of it** at `wheels.p[0]`, so the wheel
index matches the shape generation the drawing asks for (`wheels.p[gen]`), and
`measurements.html` prints its rows on that convention. `docs/wheels.md` says so
in as many words: *"makeWheels uses it once, to produce generation 0 from the
seed at generation 1."*

Our first pass called the seed generation 0 and deflated below it, so every
number here was one low against that table. Fixed: `SEED_GENERATION = 1`, and
`wheelAt(name, halves)` counts half generations on the mosaic's numbering —
rung 2 is the seed, rung 0 the deflation below it, odd rungs the half steps.
Nothing about the arithmetic moved; only what the rungs are called.

(Do not confuse either with the **P1 generation** numbers used for patches in
the parent project's PLAN: those count φ² steps of the tile substitution, a
different ladder that happens to have the same growth rate.)

## Below the seed: one positive half generation, then ψ land

**Jake:** *there is a funky half gen below gen 0 which is positive. After that
you get into ψ land.*

Deflating the quadrille seed, in the mosaic's numbering:

    gen  1   (0, 6)  (3, 4)  (5, 2)     ← the seed
    gen  ½   (0, 4)  (2, 2)  (3, 2)     ← the funky one: still every coordinate ≥ 0
    gen  0   (0, 2)  (1, 2)  (2, 0)
    gen −1   (0, 2)  (0, 0)  (1, 0)     ← degenerate: slot 1 IS the origin
    gen −2   (0, 2) (−1, 0)  (1, −2)    ← negatives
    gen −3   (0, 6) (−3, −2) (2, −4)

Going down, the φ² component shrinks and the conjugate root takes over — ψ =
−1/φ, the other root of λ² − 3λ + 1, which is negative, so the coordinates
alternate in sign and the "wheel" turns inside out. Generation ½ is the last one
that reads as a figure. Gen −1 is the hinge: slot 1 collapses onto
the origin, which is the deflation running out of wheel rather than a numerical
accident. Everything below is arithmetically exact and geometrically ψ.

Worth saying plainly: **the ladder is two-sided but not symmetric.** Upward it
is φ² growth with exact lattice coordinates forever. Downward it reaches a floor
in two steps and then changes character.

## Which wheel: P and D

penrose-mosaic carries four wheels, and they differ in **scale only** — same
substitution, same dominant eigenvector, same limiting directions. Writing r
for a pentagon's minor radius (inradius, center to edge) and R for the major
(center to vertex), and following Jake's convention:

    P   2r    center to center of two pentagons — what the tiling is laid out on
    S         a pentagon's center to the near diamond's
    T         two star centers, feet touching
    D   R     one pentagon's own radius, center to corner

All four are on the picker.

**Each wheel connects a different pair of figures**, which is what Jake's
outline of T made plain — the figure had been drawing pentagons for all of
them. P is pentagon to pentagon, S pentagon to diamond, T star to star, D a
pentagon to its own corners. The shapes come from `shape-modes.js` rather than
from guesswork: `starTips = unitUp × pgram.rho`, `starDimples = unitDown ×
pgram.R`, and

    pgram.R / pgram.rho = √((25−11√5)/10) / √((5−√5)/10) = 1/φ²

so the star is the {5/2} star polygon, tips at **φ·R** of the pentagon and
dimples at **R/φ**. That is why T = **φ·P**: two stars mesh tip into dimple at
exactly that distance, which is what "feet touching" means. (A first attempt
reasoned the star was five thin rhombs about their acute corner, giving
inner/outer = 1/(2cos18°) = 0.526 — wrong, and visibly too fat.)

**St1's reference point is its star's center, not its middle.** Jake: *the
center of the diamond is not in the center. It is where the center of its star
would be. Hence the name St1.* The diamond is a star with one point — St1 to
the star's St5 and the boat's St3 — so it is measured from the star's center,
which is a **corner** of the tile. The figure hangs the diamond off the end of
the spoke accordingly.

**S and P are the same vector in real geometry, and differ only discretely.**
S = pgon.R + pgram.R = R + R/φ = φR, and P = 2r = 2R cos36° = φR: equal
exactly. So the two wheels are two integer approximations of one limiting
vector, which is why S/P → 1 (1.1662, 1.0225, 1.0033, 1.0005 by generation 7).
**Open:** where the diamond actually sits against the pentagon. Taking the
spoke along a corner ray leaves a gap of R/φ between the pentagon's corner and
the diamond's acute vertex, and taking it along an edge normal puts the star
center exactly where the neighboring pentagon's center is. Neither reading is
obviously the tiling's, and the figure currently draws the first. Ask.

**T, confirmed from Jake's figure.** He produced a drawing of it — four stars
with spokes from one center to three of its neighbors' — and measuring the
spokes off the image gives 92.5°, 17.5° and ~305°, which is 90 / 18 / 306
within drawing accuracy: three of the five `up` directions, in real geometry.
So T's endpoints really are two star centers with their feet touching, as
`shape-modes.js` says, and `measurements.js`'s caption **"T Star to boat"**
describes what the segment *crosses* — a boat sits between each pair of stars
— rather than where it ends. The endpoint reading is the one that matches the
seed arithmetic, and it is what the page says. A wheel stores **three seeds only**: the other
seven of its ten points are those three reflected (negate x, negate y, negate
both) and carry nothing new — worth saying on the page, since the tables print
all ten.

**In the limit the four lengths are 1 : φ : φ : φ²** — D, P, S, T. So P and S
converge on the *same vector* and are two lattice approximations of it,
distinguishable only at finite generations: S/P runs 1.1662, 1.0225, 1.0033,
1.0005 by generation 7. P/D tends to 2r/R = 2cos36° = **φ** from a long way
off — 1.3868 at the seed, then 1.6765, 1.5907, 1.6278, … 1.61807. That the
ratio of two *integer* wheels converges on φ is the Fibonacci interleave seen
sideways.

The index shows P by default, and the right-hand figure
draws what each one measures rather than repeating the wheel: for P a
**pentaflake** — one pentagon and the five that share its edges — with the
spokes center to center; for D a single pentagon with its spokes center to
corner; S and T take the same pentagon with the spokes reaching further out,
to where that other figure sits. The pentagon drawn is always the **D** wheel's,
since D *is* the pentagon's radius, and the spokes end on the **down** points: a neighbor sits
across an edge, and the edge normals of a point-up pentagon are the point-down
directions. (Checked: the D pentagon's edge midpoints land exactly on the P
down directions, at half their length.)

## Quadrille, and mosaic

The discrete mode is called **quadrille** — the seeds are the quadrille seeds,
and the picture is a figure drawn on square graph paper. That is the name to
use here; `mosaic` is penrose-mosaic's other geometry and is a different thing,
kept in mind rather than mixed in. The index draws the wheel with its angles
and, beside it, the quadrille pentagon with the real one laid **over** it at the
same circumradius — both on the blue grid, because the whole point of this
corner is that they are two geometries and not one rounded off. One page: E2 is
a section of it, not a page of its own. Jake, 2026-09-22: *the only breadcrumb I
want to see is home to pentagrid/index.*

## Dualizing them: dual.html

Built 2026-09-22, split's arrangement — the multigrid on one canvas, its dual
on the other, one γ, one view — because the question is what the dual *does*
and the differences show as differences between two pictures. Not the method
page (its narrative is about facts that do not survive) and not grow first
(the growth animation's charm is that each tile moves by a bounded wobble and
settles, which needs the dual map to be a similarity; here it shears).

**Two switches, because de Bruijn's construction conflates two choices** that
come apart the moment the directions are unequal:

- **spacing** λⱼ, how far apart family j's lines are. All equal isolates the
  effect of direction alone; the wheel's own lengths (1.0462, 1, 1.0288,
  1.0288, 1) are what the lattice supplies.
- **edges** eⱼ, what the dual adds up: f = Σ Kⱼ eⱼ. Unit vectors are de
  Bruijn's and give rhombs; the wheel vectors give parallelograms with unequal
  sides — the reading that could reproduce the quadrille tiles, whose edges are
  4, √13, √17.

One array used to do both (scaling a direction tightens the grid *and*
lengthens the edge), so `Pentagrid` gained an optional `edges`; without it
nothing changes, and the pentagrid never notices.

**What it shows.**

- **Six shapes, not two** — and not the ten RESEARCH.md expected. The ten
  family pairs give 34.6438, 36.4939, 37.7245, 69.2876, 71.1377, 74.2184;
  the mirror symmetry pairs four of them off. Tested from the directions and
  from the tiles.
- **The dual map shears.** Σ v vᵀ is diagonal — the mirror survives — but not
  isotropic, so there are two gains instead of the pentagrid's single n/2.
  The view registers by the mean and the page reports both and the gap.
- **The index almost survives.** Σvⱼ over the five directions is
  **(0, 0.0012)**: exactly zero across the mirror, only just off it the other
  way. So ΣK is not a height function but drifts from one *slowly* — a more
  interesting failure than a flat one, and a patch may look as though the lift
  were there. (An earlier note here said 3.292; that came from taking all five
  normals in the upper half plane, which is a choice of representative and
  says nothing, since each direction is a ± pair. The test caught it.)

## Open

- The dualization itself (E2's actual question). The frame is diagonal but not
  isotropic, and Σvⱼ ≠ 0, so both the registration gain and the index have to be
  rebuilt before there is a dual tiling to look at.
- Whether the half-step wheels land on a clean set of the six P1 shapes, which
  is the thing the parent project calls "the intermediate φ level" and has
  called ungenerated rather than unfound. The arithmetic above generates it;
  nobody has looked at the tiles.
