/**
 * A Fibonacci family of lines — one dimension, no geometry.
 *
 * A quasiperiodic grid in the sense of Socolar and Steinhardt's Eq. (3)
 * (PLAN §7.4a), at ρ = σ = τ: positions in the Fibonacci word, two gaps in the
 * ratio φ, which is Conway's musical sequence written as a function.
 *
 * It lives in its own module because it belongs to neither of the dimensions
 * that use it. `ammann.ts` built it for the Ammann bars of a Penrose patch and
 * re-exports it still; `hexagrid.ts` takes the same function for the six
 * icosahedral families, where Socolar's α = 1/τ, β = −½ is the one grid that
 * gives the 3D icosahedral class (PLAN §8.3). A position is a number: nothing
 * here knows how many dimensions the normal it is measured along has.
 */

import type { LineSet } from "./types.js";

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * One family of the Ammann quasilattice, as a `LineSet` the pentagrid can use.
 *
 * Socolar and Steinhardt's Eq. (3) at ρ = σ = τ (PLAN §7.4a) is the closed
 * form, and it is O(1) in the line number, which is why a family can be a
 * function rather than a list:
 *
 *     at(n) = T·( n + α + (1/φ)⌊n/φ + β⌋ )
 *
 * with T the short spacing, α the phase and β the cut. In our terms α = c/T
 * and β = −w/φ, so `ammannFit`'s output feeds straight in. The spacings are T
 * and φT in the Fibonacci word, two gaps in the ratio φ, which is what makes
 * the dual of five of these a Penrose tiling — one generation down from the
 * one the bars were read off.
 *
 * `indexAt` inverts it: at(n) grows like T·n·(1 + 1/φ²), so the estimate is
 * exact to a line or two and a short walk finishes it.
 */
export function fibonacciLines(T: number, alpha: number, beta: number): LineSet {
    const at = (n: number) => T * (n + alpha + Math.floor(n / PHI + beta) / PHI);
    const DEN = 1 + 1 / (PHI * PHI);
    return {
        at,
        indexAt(t: number): number {
            let n = Math.round((t / T - alpha - beta / PHI) / DEN);
            // at() is increasing, so walk to the smallest n with at(n) >= t.
            // The tolerance is there so that indexAt(at(n)) is n and not n+1:
            // at() is a float, and landing a hair under its own value would
            // cost a whole line.
            const EPS = 1e-9;
            while (at(n) < t - EPS) n++;
            while (at(n - 1) >= t - EPS) n--;
            return n + 0;        // Math.round can hand back -0; a line is 0.
        },
    };
}
