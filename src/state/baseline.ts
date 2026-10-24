/**
 * A page's baseline, and the reset to it — PLAN §9.6, step 3 of §9.10.
 *
 * Jake's fifth want: *"as always, a reset to defaults for a page."* The thing
 * to be careful about is **whose** defaults. The view's own literals are
 * `NO_FEATURES` and `TILE_DEFAULTS`, but no page runs on those: each layers its
 * own `config.features` and `config.tileStyle` over them, and
 * `createGrowthView({ lift: true })` further sets `grow`, `fold`, `elevation`
 * and `azimuth`. Pages then keep configuring after construction — `roof.ts`
 * binds its controls and fires each one's `apply()` to push the markup's
 * initial values in. So "the view's defaults" is a place no page has ever been,
 * and resetting there would be a bug wearing the name of a feature.
 *
 * Hence two calls rather than one. `markBaseline()` says *this is home* and a
 * page calls it when its setup is done; `reset()` returns there. A baseline is
 * taken automatically at the end of construction so a page that never marks one
 * still resets somewhere sensible.
 *
 * **A snapshot, not a walk over the inventory.** `state/inventory.ts` is how
 * the attribute reader and writer agree about the fields, but a reset does not
 * need the list: copying whole objects cannot miss a field, where a walk could.
 * The inventory is still the auditor — `tools/baseline.test.mjs` checks a
 * snapshot covers every field the inventory names, so the two cannot drift.
 */
import type { GammaSet } from "../geometry/gamma.js";

/** Everything about γ that is not derived. §9.3's shared slice, as a value. */
export interface GammaSnapshot {
    /** Integer numerators over `den` — exact, so no float round-trips. */
    exact: number[];
    den: number;
    locked: number;
    symmetry: boolean;
    guard: boolean;
    generation: number;
    enabled: boolean[];
    lines: (number | null)[];
    isolated: number | null;
}

export function captureGamma(g: GammaSet): GammaSnapshot {
    return {
        exact: g.exact(),
        den: g.denominator,
        locked: g.getLocked(),
        symmetry: g.getSymmetry(),
        guard: g.getGuard(),
        generation: g.getGeneration(),
        enabled: g.enabledFlags(),
        lines: g.lineFlags(),
        isolated: g.isolated(),
    };
}

/**
 * Put γ back, exactly.
 *
 * The order matters. Symmetry rebuilds the direction vectors, so it goes first.
 * The lock is released before the values are written and restored after, or the
 * locked index would be re-derived from the others and the vector would not be
 * the one saved. And the numerators go back through `setValues` as
 * `numerator / den`, which `setValues` rounds by `den` — so the round trip is
 * exact arithmetic, not a float approximation.
 */
export function restoreGamma(g: GammaSet, s: GammaSnapshot) {
    g.setSymmetry(s.symmetry);
    g.setGuard(false);                     // not while writing: it nudges γ
    g.setLocked(-1);
    g.setValues(s.exact.map((q) => q / s.den));
    g.setLocked(s.locked);
    g.setGeneration(s.generation);
    for (let i = 0; i < s.enabled.length; i++) g.setFamilyEnabled(i, s.enabled[i]);
    for (let i = 0; i < s.lines.length; i++) g.setFamilyLine(i, s.lines[i]);
    g.setIsolated(s.isolated);
    g.setGuard(s.guard);                   // last, so it judges the restored γ
}
