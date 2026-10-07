// The afterimage: a complement, pale, computed rather than listed.

import test from "node:test";
import assert from "node:assert/strict";
import { afterimage, oklab, AFTERIMAGE_LIGHTNESS } from "../dist/view/afterimage.js";
import { P1_FILL, P1_STAR } from "../dist/geometry/clusters.js";

/** The hue band a color falls in, by Oklab hue angle. */
const band = (hex) => {
    const [, a, b] = oklab(hex);
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    return h < 25 ? "red" : h < 70 ? "orange" : h < 110 ? "yellow" : h < 165 ? "green"
        : h < 215 ? "cyan" : h < 270 ? "blue" : h < 330 ? "purple" : "magenta";
};
const chroma = (hex) => { const [, a, b] = oklab(hex); return Math.hypot(a, b); };
const light = (hex) => oklab(hex)[0];

test("Jake's three readings come out of the one formula", () => {
    // What he saw staring at the pentagons: dark blue to pale yellow, yellow to
    // light purple, orange to light blue. Three hues, one reflection.
    assert.equal(band(P1_STAR), "blue");
    assert.equal(band(afterimage(P1_STAR)), "yellow", "blue should go pale yellow");
    assert.equal(band(P1_FILL.Pe3), "yellow");
    assert.equal(band(afterimage(P1_FILL.Pe3)), "purple", "yellow should go light purple");
    assert.equal(band(P1_FILL.Pe1), "orange");
    assert.equal(band(afterimage(P1_FILL.Pe1)), "blue", "orange should go light blue");
});

test("the cones put blue's afterimage in Pe3's own yellow, a reflection does not", () => {
    // Jake on the first version: "too orange. My eye sees yellow, paler than
    // the pe3 color, but in that hue." A reflection through the neutral axis —
    // negating a and b — lands blue at 84 degrees, which is an orange-yellow.
    // Von Kries adaptation puts it at 100, against Pe3's own 110.
    const hueOf = (hex) => {
        const [, a, b] = oklab(hex);
        return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    };
    const target = hueOf(P1_FILL.Pe3);
    const mine = hueOf(afterimage(P1_STAR));
    assert.ok(Math.abs(mine - target) < 15,
              `blue's afterimage should be Pe3's hue: ${mine.toFixed(0)} against ${target.toFixed(0)}`);

    // What the reflection would have given, for the record: further from Pe3
    // than the cones are, and out of the yellow band altogether.
    const [, a, b] = oklab(P1_STAR);
    const reflected = (Math.atan2(-b, -a) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(reflected - target) > Math.abs(mine - target) + 10,
              `the reflection sits at ${reflected.toFixed(0)}, no better than ${mine.toFixed(0)}`);
});

test("every afterimage is pale: light, and weaker than what made it", () => {
    for (const hex of [P1_STAR, P1_FILL.Pe3, P1_FILL.Pe1, "#000000", "#ffffff", "#2a9d8f"]) {
        const out = afterimage(hex);
        assert.ok(Math.abs(light(out) - AFTERIMAGE_LIGHTNESS) < 0.06,
                  `${hex} -> ${out}: lightness ${light(out).toFixed(2)}`);
        // 8-bit hex rounds, so a neutral comes back with a thousandth of cast.
        assert.ok(chroma(out) <= chroma(hex) + 0.002,
                  `${hex} -> ${out}: an afterimage is a tint, not a stronger color`);
    }
    // Neutral in, neutral out: nothing to be adapted to.
    assert.ok(chroma(afterimage("#808080")) < 0.01);
});

test("it is reversible in hue: the afterimage of the afterimage comes back", () => {
    for (const hex of [P1_STAR, P1_FILL.Pe3, P1_FILL.Pe1]) {
        const there = afterimage(hex);
        const back = afterimage(there);
        const [, a1, b1] = oklab(hex);
        const [, a2, b2] = oklab(back);
        const h1 = (Math.atan2(b1, a1) * 180 / Math.PI + 360) % 360;
        const h2 = (Math.atan2(b2, a2) * 180 / Math.PI + 360) % 360;
        // Folded difference: 0 is the same hue, 180 is opposite. Twice round
        // should come back to where it started.
        // Adaptation is not an involution — the second stimulus is a pale tint
        // and fatigues the cones differently — so this is a sanity bound, not
        // an identity: twice round must land back in the same part of the
        // circle rather than wander off it.
        const d = Math.abs(((h1 - h2 + 540) % 360) - 180);
        assert.ok(d < 20, `${hex} -> ${there} -> ${back}: hue drifted ${d.toFixed(0)}`);
    }
});

test("out of gamut loses chroma, not hue", () => {
    // A tint that cannot be shown is shown grayer. Clipping per channel would
    // swing the hue instead, which is the one thing a complement must not do —
    // so a strength that certainly fits and one that certainly does not have to
    // give the same hue.
    const hueOf = (hex) => {
        const [, a, b] = oklab(hex);
        return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    };
    // Folded difference: 0 is the same hue, 180 is opposite.
    const apart = (h1, h2) => Math.abs(((h1 - h2 + 540) % 360) - 180);
    for (const hex of ["#00ff00", "#ff0000", "#0000ff", "#ff00ff"]) {
        const d = apart(hueOf(afterimage(hex, 0.15)), hueOf(afterimage(hex, 1)));
        assert.ok(d < 6, `${hex}: the hue moved ${d.toFixed(0)} degrees on the way out of gamut`);
    }
});
