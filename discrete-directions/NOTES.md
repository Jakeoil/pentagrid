# Working notes — discrete directions

Running record of what we have argued about in this corner and what is still
unsettled. Same project as the pentagrid, same build and same tests: the code
is `src/discrete/`, the test is `tools/discrete.test.mjs`, and this directory
holds the page and these notes. Fenced off, not split off — Jake: *this is all
part of the pentagrid project, don't overdo it.*

The house style is the parent's: American spellings everywhere, in prose,
identifiers and comments alike.

---

## By your bootstraps: five ordered points, and everything else

**Jake, 2026-09-24:** *It is possible to derive the complete quadrille tiling
from these 5 ordered points and the origin. The motivation here is to eventually
create diagrams of penrose tiles using any 5 points relative to 0,0.* And, on
the shape of it: *this is step 0, how we got to quadrille and star, and penta.
It also will be symmetry agnostic… keep in mind that the list is ordered and you
will be rotating a lot more than mirroring.*

The program is `src/bootstrap/`, the page is `by-your-bootstraps.html`, and
`tools/bootstrap.test.mjs` checks every claim below against penrose-mosaic,
which is the reference and is not imported.

### The ladder in half steps, and below zero

**Jake, 2026-09-25:** *Is your wheel in half steps? A generation corresponds to
two deflations in the penrose sense.* It was not — `ladderTo` stepped whole
generations — but the half step was already there, sideways.

`pair(w, k) = W[t−k] + W[t+k]` completes the operator family: it is
**2cos(36k°)**, giving φ, φ⁻¹, −φ⁻¹, −φ for k = 1..4, alongside the three-term
`stride(w, k) = 1 + 2cos(36k°)` giving φ², φ, φ⁻², −φ⁻¹. Eight operators, all
integer, covering ±φ^{±1} and ±φ^{±2}.

`wheelsAt(pts, gen)` now takes halves and negatives, on E2's convention
(`src/discrete/wheels.ts`, `wheelAt(name, halves)`) so the two corners agree:

    gen   D seeds (tenths 0,1,2)       |D[1]|
    -1    (0,1)   (1,-1)   (0,-1)       1.414
   -0.5   (0,-2)  (0,0)    (1,0)        0.000   a seed on the origin
      0   (0,-1)  (1,-1)   (1,-1)       1.414
    0.5   (0,-2)  (1,-2)   (2,0)        2.236   last rung all-positive
      1   (0,-3)  (2,-3)   (3,-1)       3.606   the five points
    1.5   (0,-6)  (3,-4)   (5,-2)       5.000   = the P wheel at generation 1
      2   (0,-9)  (5,-7)   (8,-3)       8.602
    2.5   (0,-14) (8,-12) (13,-4)      14.422

**The half rung above D is P, exactly.** So the four wheels were always three
consecutive half rungs of one ladder — D, P/S, T at φ⁰, φ¹, φ² — and naming them
separately is what hid it. Verified at four generations and on an asymmetric five.

**Rungs anchor on the seed, never on each other.** Whole rungs by
inflate/deflate from the seed, half rungs by one `halfUp` from the whole rung
below. Composing half steps is wrong and the test says so: `halfUp` twice is not
`inflate`, and `halfDown(halfUp(w))` is not the identity. Both miss by the
alternating (0, ±1) that is My's λ = −1 — the same gap that makes T and the next
generation's D two different integer wheels on one rung. Walking the ladder by
half steps would pile that error up.

Downward it is two-sided but **not symmetric**, which the E2 notes already had
for the P wheel and which now holds on D: generation ½ is the last rung that
reads as a figure, at −½ a seed collapses onto the origin — the deflation running
out of wheel, not a numerical accident — and below that ψ = −1/φ takes over and
the pentagon turns inside out. Exact on the lattice the whole way down; it just
stops being a pentagon.

The input figure on the page has a rung slider stepping in halves from −3 to 5.
Handles appear only at rung 1, since that is the rung the five points live on and
a derived pentagon has nothing to write back to.

### Step 1 is the pentaflake, and P is measured off it

**Jake, 2026-09-24, correcting a first pass that went too fast:** *The first step
is to create your tiles and you get that by making measurement. Here is what I
did. Make a pentaflake: copy 12345. Rotate the coordinates 180 degrees through
O. Put the copy so that 12 touches 21, then the next copy 23 touches 32, 34-43,
45-54 and 51 touches 15. That is a pentaflake. All the copies are yellow. The
first value of your penta wheel (gen1) will be O to O_1, O to O_2 etc.*

That is the honest first step and it was skipped. The wheels are not given;
they are measured off a figure you build.

Rotating 180° through O sends corner j to −pts[j]. For the copy's edge
(k+1 → k) to land on the original's edge (k → k+1) the copy must move by T:

    −pts[k+1] + T = pts[k]        and        −pts[k] + T = pts[k+1]

**Both equations give the same T**, which is what makes the edges *coincide*
rather than merely abut, and that T is the leaf's center:

    O_k = pts[k] + pts[k+1]

    O_0 (3,-4)   O_1 (5,2)   O_2 (0,6)   O_3 (-5,2)   O_4 (-3,-4)
      P[1]         P[3]        P[5]        P[7]         P[9]

A P vector is **the two corners of the shared edge, added**. No wheel, no
formula, no reflection — only that the list is ordered.

The five leaf centers land on the **odd** tenths, the down half, because a leaf
is the 180° copy and faces the other way. The even tenths are the same
construction run on a leaf — the flake seen from one of its own petals. Ten
directions out of one figure.

And this is the reason for the stride formula below rather than a coincidence
with it: at an odd tenth, `D[t−1] + D[t+1]` *is* the two corners of a shared
edge. penrose-mosaic's hand-measured `pSeed` contains one of these outright —
its `down3` entry is (3,-4), which is O_0.

`src/bootstrap/flake.ts`, and the figure is the first one on the page.

### Generations: a single tile is gen 1, the flake is gen 2

**Jake, 2026-09-24:** *The blue pentagon is a Pe5 gen 1. The yellow pentagon is a
Pe3 gen 1. The figure you have is Pe5 gen 2.*

So the figure's generation is its parts' plus one, and it agrees with the wheel
numbering already recorded above — the seed at index 1. `expand()`'s `gen`
argument was one low against this and has been left alone only because it counts
recursion depth rather than figure generation; the page and the notes say
Jake's number. Worth keeping straight, since this is the second time a
generation has been out of step in this corner.

    Pe5 gen 2  =  1 Pe5 + 5 Pe3                            the pentaflake
    Pe3 gen 2  =  1 Pe5 + 3 Pe3 + 2 Pe1 + 1 St1            three yellow, two orange
    Pe1 gen 2  =  1 Pe5 + 1 Pe3 + 4 Pe1 + 2 St1
    St1 gen 2  =  1 St5 + 1 Pe1 + 1 St3

Measured, and it matches the figures Jake drew.

### A placement bug the congruence test could not see

The first pass placed every tile by walking its outline from `loc`. A tile's
`loc` is its **reference point**, not a corner — for a pentagon the center, for
the star family the star's center, which for a diamond is one of its two tips.
So every tile was displaced, and by a *different* amount at each tenth.

The test did not catch it because `congruent()` allows translation: it proved
the shapes and said nothing about where they sit. There is now a second test
that allows nothing, checked against all eight of penrose-mosaic's arrays at
their literal coordinates.

The anchors are not stored data either. Measured, they are uniform:

    pentagon                D[t]
    star, boat, diamond     P[t]

### The pentagon needs no walk at all

    pentagon at tenth t  =  D[t], D[t+2], D[t+4], D[t+6], D[t+8]

the D wheel at stride 2, as offsets from its center. The ten tenths give exactly
two polygons — the five points and their negatives — which is what a pentagon
must do, and it generalizes to an asymmetric five because the second polygon is
the **180° copy** and not a mirror image. penrose-mosaic gets the same two by
`shapeWheel`'s `up`/`up.vr` alternation, which only agrees because its seed
happens to be mirror symmetric.

That is one of the four borrowed walks retired. Star, boat and diamond remain.

### The diamond space, and which tip is the reference

**Jake:** *There are now an empty diamond shaped space, 5 altogether, around the
Pe5.2. That space can be measured and it is an St1 gen 2. Finding the center of
that isn't obvious, since both tips look alike.*

Measured in a Pe3 gen 2 — the smallest figure where the gap appears. With the
tiles placed correctly the gap between the two orange pentagons is
(0,3) (1,7) (0,11) (-1,7), and the St1 the recursion places is that polygon
exactly. **The space and the tile coincide**, so the diamond can be had by
measurement and does not have to be transcribed.

Its four sides are all √17: it is a genuine **rhombus**, which is why the tips
look alike — a rhombus has a symmetry that swaps them, so *the outline alone
cannot distinguish them*. Jake is right, and the difficulty is not a matter of
looking harder.

What is true, at every diamond in every patch tested and on an asymmetric seed
too: the reference point lies on the long diagonal, splitting it

    |p[gen−1]|  :  |p[gen]|        2 : 6 at generation 2,  →  1 : φ²

(2.333, 2.714, 2.579, 2.633, 2.612, 2.620, 2.617 by generation 8). So the
reference is always the **near** end of that split — never the midpoint, and
never a corner.

What does **not** work, tested and discarded: telling the tips apart by counting
how many pentagons meet at each. It picks the right one on a Pe5 patch (40 of
40) and is a coin toss on a Star patch (60/60). The information is not local to
the diamond; it comes from which parent placed it. **Open:** whether there is a
local rule at all, or whether the reference is inherently inherited.

### The wheels are one operator at four strides

Three unit vectors a turn apart sum to (1 + 2cos turn) times the middle one, and
on a ten-wheel the turn is the **stride**. So `W[t−k] + W[t] + W[t+k]` is the
whole ladder:

    stride 1   1 + 2cos36°  =  φ²      inflate, one generation
    stride 2   1 + 2cos72°  =  φ       the S wheel
    stride 3   1 + 2cos108° =  φ⁻²     deflate, exactly inverse to stride 1
    stride 4   1 + 2cos144° = −φ⁻¹     the conjugate root, ψ

Drop the middle term of the stride-1 sum and 2cos36° = φ gives **P**; difference
the same pair instead of summing it and you get **E**, the tile edges. So:

    D  = the five points, and their negatives on the odd tenths
    P  = D[t−1] + D[t+1]                      →  (0,-6) (3,-4) (5,-2)   == p[1]
    S  = D[t−2] + D[t] + D[t+2]               →  (0,-5) (3,-5) (5,-1)   == s[1]
    T  = S + D                                →  (0,-8) (5,-8) (8,-2)   == t[1]
    E  = D[t+1] − D[t−1]                      →  (4,0) (3,2) (1,4)
    D′ = D + P = inflate(D)                   →  p[2], t[2] at the next rung

checked at generations 0, 1 and 2. **S was the hold-out** — it is not on the
D→P→T ladder, and the note above already had it as "P's other representative"
without a rule. The rule is the stride: P and S are the same scale φ reached two
different ways, ±1 differenced and ±2 summed. That deflate falls out as stride 3
was the surprise; `interpolateWheel` need not be a separate inverse at all.

**Deriving deflate honestly cost one detour.** penrose-mosaic's three-seed
deflation assumes the mirror, which this module does not have. Inverting
`inflate` on a general five-point wheel gives an integer matrix — the
anticirculant of (1, 0, −1, 1, 0) — and that turns out to be stride 3 rewritten,
since `W[t+5] = −W[t]` turns the minus sign into a shift.

### Tiles are closed walks, and rotation is an index shift

A tile outline is a list of tenths in E, not a list of coordinates:

    penta     1 3 5 7 9          star      2 0 4 2 6 4 8 6 0 8
    boat      2 0 4 5 6 0 8      diamond   2 3 7 8

and penrose-mosaic's eight stored arrays are these four plus a shift —
`boatWon = turn(boat, 1)`, `boatToo = turn(boat, 2)`, the same for the diamond
(wound the other way in the original), and penta and star need no second array,
being invariant under a fifth. Every rotation in the module is `+n` on an index;
there is no `vr`, `hr` or `neg` anywhere.

The shift is exact in the **index** and not in the metric: `boatWon` has a √13
edge where `boatUp` has a 4, because the wheel's ten spokes are not the same
length. That is the quadrille's character stated in one line — **the
combinatorics are exact and the metric is whatever the lattice can manage at
that angle** — and it is why penrose-mosaic needed three primitives per tile in
the first place. Not symmetry. Lattice anisotropy.

### A spelling in the rhombs that changes the shape

`goThick`/`goThin` walk three steps from a corner, the fourth closing. In real
geometry every step is a **T** vector. In quadrille the first step is spelled
`P + D` — which is `inflate(D)`, also ×φ² but the *other* integer representative
of that rung, differing by the alternating (0, ±1) that is My's λ = −1.

Because `W[k+5] = −W[k]`, a figure spelled in **one** wheel has its first and
third steps exactly opposite and its closing edge exactly opposite its second: an
exact parallelogram, for any five points, and a true rhomb wherever the wheel's
spokes agree (tenths 0 and 5 for the thick rhomb at the seed). Mixing loses even
that:

    real, all four on T              1.000 1.000 1.000 1.000   rhomb
    quadrille, all four on T         9.434 9.434 9.434 9.434   rhomb at this tenth
    quadrille, all four on D + P     8.602 8.602 8.602 8.602   rhomb at this tenth
    quadrille, penrose-mosaic's mix  8.602 9.434 9.434 8.602   kite

penrose-mosaic's own source flags the line: the comment above `goThickReal` asks
whether the modes can be unified "if the real of d + p == t". They cannot, and
this is what the difference does. **Open, and Jake's call:** whether the kite is
deliberate — registering against the P1 pentagons — or a slip. The page draws
all three spellings so they can be compared; nothing in penrose-mosaic has been
touched.

Large and small rhombs are the same walk one generation apart, as
[[penrose-mosaic-rhomb-groups]] records: `wheels.t[1]` and `wheels.t[0]`, and
`inflate(small) == large` exactly.

### The patches

`penta`/`star`/`sun`/`starPatch`/`deca` are ported and reduced to tenths. Two
things fell out in the reduction:

- **`isHeads` never reaches a tile outline.** It is threaded through every call
  in penrose-screen.js and consulted only by layers that are not the P1 tiles;
  `drawPentaPattern` selects on `angle.tenths` alone. It is gone here.
- **`deca()`'s up/down branches are all `+5`.** It reads `wheel.up[f]` or
  `wheel.down[f]` by `angle.isDown`, sometimes swapping which; every one of those
  is the fifth bit of the tenth. With tenths there is no branch left to take.

The Sun comes out at 55 rhombs and the Star at 35, matching the counts recorded
in that source, and no tile is placed twice.

### Measuring the star centers, and the Sun's five misplaced diamonds

**Jake, 2026-09-24:** *You have to master measuring the star centers. The St5 is
the most 'symmetric' one. Note the gen 2 st1 (st5-Pe1-st3), the 5 are all
misplaced.*

**The bug is confirmed, and it is exactly those five.** Sampling tile area on a
1/3 grid across every seed and generation:

    Pe5 Pe3 Pe1 St5 St3 St1 Deca      0% doubled — every tile substitution is clean
    Sun                               4.60% doubled, 11 overlapping pairs
    Star                              5.72% doubled,  9 overlapping pairs

and in the Sun the five worst offenders are its five diamonds:

    St1@8 (8,2)   St1@2 (-8,2)   St1@6 (5,-8)   St1@4 (-5,-8)   St1@0 (0,8)

Those are the ones `sun()` places by the reconstructed rule — on the **t wheel**
at `m10(1 + 2i + a)`, "halfway between the Pe3 directions" — which
penrose-mosaic's own comment flags as a guess. `starPatch()` has the same
disease in its Pe3 and St3 rings, also a reconstruction ("Measured ring, in
tenth offsets from the center's own angle"). The six single-tile substitutions
are not affected; the two composite seeds are.

Worth recording what the first pass of this investigation got wrong: a
centroid-inside-polygon test reported "only Star at generation 2, 4 pairs" and
was believed for a moment. It misses every overlap where neither centroid falls
inside the other, which is most of them. Area sampling found five times as many
and named the right tiles. **Do not test tile overlap by centroids.**

### A star is two P generations interleaved

Taking Jake's route in — measure the St5 first, because a ten-pointed figure has
no ambiguity about its middle:

    tips     P[gen]     at t, t+2, t+4, t+6, t+8
    dimples  P[gen−1]   at t+1, t+3, t+5, t+7, t+9

about the star's center. **Exact at all ten tenths**, against every one of
penrose-mosaic's stored arrays, on the quadrille seed and on an asymmetric one.

St3 and St1 are the same star with points missing, which is what their names
say, and they keep its center unchanged:

    St5   tips 0,2,4,6,8    dimples 1,3,5,7,9
    St3   tips 0,2,8        dimples 1,3,7,9
    St1   tip  0            dimples 1,5,9      — closes across the star, not round its rim

So the star family needs no stored walks either. And note the shape of it:

    a pentagon is D at stride 2 about its center
    a star     is P at stride 2 about its center, with P of the generation below between

the same construction on the two wheels, one generation apart.

**This dissolves the diamond's tip problem.** Two notes ago the reference could
not be located from the outline, because a rhombus's tips are congruent — true,
and it stays true. But built this way the question never arises: the tip is the
corner on P[gen], the far corner is a dimple on P[gen−1], and the center is not
in the outline at all. The earlier search for a local tie-break was the wrong
question; the center is not recovered from the diamond, it is where the diamond
was measured from.

`src/bootstrap/star.ts`.

### Look at the figure

**Jake, 2026-09-24:** *Correct your output. The gen2 boats are placed too low.*

He could see it; nothing here could. Every numeric test passed while the Sun and
the Star patch were visibly wrong on screen. `tools/render.mjs` now draws any
figure to SVG —

    node tools/render.mjs Star 2 | magick - /tmp/star.png

— and it should be the first thing run after any change to placement, before
any argument about wheels. What it shows:

- **Pe5 generation 3 is right.** It reproduces Jake's own figure exactly:
  the center Pe5, five Pe3, the ring of Pe3/Pe1 and the five diamonds.
- **The Sun's five diamonds are misplaced**, as he said — they stab into the
  yellow pentagons with white gaps beside them.
- **The Star patch's boats overlap its Pe3 ring**, which is the "boats placed
  too low". Both rings are `starPatch()`'s own reconstruction.
- The six single-tile substitutions draw clean, and match penrose-mosaic's
  arrays exactly at every tenth. **Jake confirmed Pe5 and St5 are correct.**

Three tests were added off the back of this, because the existing ones could not
have caught it: area double-coverage by sampling, interior-hole detection by
flood fill, and a deliberately inverted test asserting Sun and Star *do* still
overlap, so that fixing them makes a test fail and say so.

A first attempt to find the right ring placements by searching wheel × offset ×
turn for the three rings found **no** overlap-free arrangement, so the answer is
not a different index into an existing wheel. It has to be measured, the way the
pentaflake gave P.

### The Sun's diamonds were on the wrong wheel

**Jake, 2026-09-24:** *Sun and star are composites created manually right? Do you
have all the wheels for that configuration built up correctly?*

Yes to both, and the second question was the useful one. The wheels were already
right; `sun()` was reaching for the wrong one. Searching every wheel this module
has, at three generations, every offset and every turn, for a five-diamond ring
that overlaps nothing gave 215 candidates, and the best of them seat **all
twenty** diamond corners on vertices the rest of the figure already has:

    was   St1 at t[1 + 2i]   tenth 2i + 6      penrose-mosaic's reconstruction
    is    St1 at s[2i + 1]   tenth 2i + 1      the S wheel, at the odd tenths

which is the same wheel, and the same rung, that `penta()` already uses for its
own diamonds. The source comment asserting the Sun's are "a ring further out at
the t-wheel" is simply wrong. Fixed, and the render is clean.

The Star patch is untouched and still overlaps; it stays set aside.

### An asymmetric pentagon tiles

**Jake:** *are you ready to try out a new pentagon? an asymmetric one?*

That is the test the whole no-reflection design exists for, and it passes — for
some fives, not all.

    [[-1,-3], [3,-1], [2,3], [-2,3], [-3,-1]]

has no mirror. Its wheels, its tiles and its whole Pe5 generation 3 figure have
none either, and the figure holds together: no overlap, no interior hole, the
same combinatorics, the same diamonds in the same cracks. Rendered and looked
at, not only measured.

**Almost any convex five works** — Jake's verdict, and the measurement agrees
once it is made properly. Of the 195 convex fives containing the origin reachable
by moving one corner of the quadrille seed anywhere in a 7x7 neighborhood:

    exact (no hole, no overlap)     30
    slivers only (<1% of area)     121     coherent; tiles meet within a sliver
    actually broken (>=1%)          23

So 151 of 195 hold together, and the failures are concentrated in the extreme
shapes. Convexity and containing the origin are what matter; irregularity as
such does not — counting distinct edge lengths separates nothing, 3, 4 and 5
distinct lengths all appear on both sides.

A first pass here reported "30 of 240 tile" and that was wrong twice over: it
counted raster cells rather than area, so a sub-unit sliver read the same as a
structural gap, and it included the non-convex fives that were never candidates.
**The lesson is the same one the Sun taught — render it and look.** The
stretched pentagon that the cell count called broken is plainly coherent on
screen.

What remains genuinely open is the exact condition. The symmetric case is
settled in `penrose-mosaic/docs/basis-search.md` as the Diophantine condition
`p = 2(q - s)` for a mirror basis `v0=(p,0), v1=(q,r), v2=(s,t)`; the 30 exact
fives above are presumably its generalization to five free points, with the 121
sliver cases being those that miss it but stay close. Not derived.

Until that is known, `by-your-bootstraps.html` will happily draw a five that does
not tile, and says nothing about it. That is the next thing the page needs.

### What is constructed, and what is still borrowed

**Constructed:** P, off the pentaflake. The pentagon, as D at stride 2. The
whole star family — St5, St3, St1 — as two P generations interleaved. The
anchors. The diamond space, as the measured gap.

That is all four tile outlines derived, and penrose-mosaic's eight stored arrays
retired.

**Still borrowed:** the `twist`/`diamond` substitution lists saying how a Pe3
breaks into its children — now the only transcribed thing left in the module —
and the S and T wheels, which are verified identities with no figure behind them
the way P has the pentaflake.

**Fixed:** the Sun, by putting its diamonds on the S wheel where they belong.

**Broken, and set aside:** `starPatch()`, whose boats and Pe3 ring overlap.
**Jake, 2026-09-24: _don't worry about sun and star_** — out of scope, not
pending work. The inverted test asserting it still overlaps stays, so the record
does not quietly rot.

**Open, and now the most interesting thing here:** the exact condition on five
points for the tiles to meet exactly rather than within a sliver. Almost any
convex five is coherent; 30 of 195 are exact. See above.

Two smaller ones: whether a five that is *not* a valid pentagon should be
rejected rather than drawn, and whether the E wheel's three edge lengths are
forced by the five points or are a property of this seed.

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
- **A grid needs a reference or it reads as regular.** Jake, at generation 1:
  *the gridlines look perfectly regular.* They are not — the gaps there are
  43.60, 31.33, 36.87, 36.87, 31.33 against the pentagrid's five 36s, and
  there is no concurrency (319 crossings, 319 tiles, none stacked) — but five
  families of evenly spaced lines look like a regular mesh whatever their
  angles. So the real pentagrid is ghosted behind in gray, same γ and spacing,
  and the divergence is the picture. Checked first that the slider really
  reaches the model, since "looks regular" and "is the default grid" are the
  same symptom: it does. The ghost is dashed and off by default — solid gray
  lines two degrees from the red ones read as a doubled grid rather than as a
  reference, which is what Jake saw next.
- **The reticulum already adapts; its label ring did not.** Jake: *does the
  reticulum itself need to adjust — make the decagon field reflect the new
  shape to accommodate the new angles?* The rim is built from the axes, so it
  is an irregular 2n-gon the moment the directions are (corner distances
  1.039–1.077 at generation 1, against a regular 1.051). Every axis pierces
  its **own** side at exactly A whatever the shape, so the axes and their
  chords need nothing. The label ring did: `circ(n)` is the regular
  circumradius and an irregular rim can reach past it, so it now clears the
  furthest corner. Tested both ways.
- **Generation 1 is 3-4-5.** Jake, on the limit-only version: *this is kind of
  meh. What happens if we make the pentagrid on different generations?* The
  right question. At any finite generation the wheel's points are **lattice
  vectors**, so the slopes are rational and the grid — with it the tiling — is
  **periodic**; only the limit is aperiodic. Generation 1 is (0,6), (5,2),
  (3,−4) and mirrors: 3-4-5 slopes, rhombs at 31.33°, 36.87°, 43.60°, nothing
  like the limit's 34.64°, 36.49°, 37.72°. Winding forward they crawl in —
  33.69/34.21/39.21, 34.99/35.57/38.88, 34.51/36.86/37.26 — six shapes at
  every rung, the error falling monotonically. So the page shows
  quasiperiodicity as **the limit of a sequence of periodic tilings**, with the
  period growing out of sight, which is worth more than the limit alone.
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
