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

## Below zero: one positive half generation, then ψ land

**Jake:** *there is a funky half gen below gen 0 which is positive. After that
you get into ψ land.*

Deflating the quadrille seed:

    gen  0   (0, 6)  (3, 4)  (5, 2)
    half     (0, 4)  (2, 2)  (3, 2)     ← the funky one: still every coordinate ≥ 0
    gen −1   (0, 2)  (1, 2)  (2, 0)
    gen −2   (0, 2)  (0, 0)  (1, 0)     ← degenerate: slot 1 IS the origin
    gen −3   (0, 2) (−1, 0)  (1, −2)    ← negatives
    gen −4   (0, 6) (−3, −2) (2, −4)

Going down, the φ² component shrinks and the conjugate root takes over — ψ =
−1/φ, the other root of λ² − 3λ + 1, which is negative, so the coordinates
alternate in sign and the "wheel" turns inside out. The half step below gen 0 is
the last one that reads as a figure. Gen −2 is the hinge: slot 1 collapses onto
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
    D   R     one pentagon's own radius, center to vertex
    S         pentagon center to the near diamond      (not used here)
    T         two star centers, feet touching          (not used here)

P/D tends to 2r/R = 2cos36° = **φ**, which the discrete seeds reach from a
long way off: 1.3868 at generation 0, then 1.6765, 1.5907, 1.6278, … 1.61807
by the ninth. That the ratio of two *integer* wheels converges on φ is the
same fact as the Fibonacci interleave, seen sideways.

The index shows P by default, with D on the picker.

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

## Open

- The dualization itself (E2's actual question). The frame is diagonal but not
  isotropic, and Σvⱼ ≠ 0, so both the registration gain and the index have to be
  rebuilt before there is a dual tiling to look at.
- Whether the half-step wheels land on a clean set of the six P1 shapes, which
  is the thing the parent project calls "the intermediate φ level" and has
  called ungenerated rather than unfound. The arithmetic above generates it;
  nobody has looked at the tiles.
