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

test("CIELAB would get the blue wrong, which is why the space is Oklab", () => {
    // sRGB blue sits at 306 degrees in CIELAB — nearer purple than blue — so
    // reflecting it there lands on a yellow-green. In Oklab it is 264, and the
    // reflection is a yellow. This is the whole reason for the choice.
    const [, a, b] = oklab(P1_STAR);
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(h - 264) < 6, `Oklab puts sRGB blue at ${h.toFixed(0)}, not 264`);
    const [, a2, b2] = oklab(afterimage(P1_STAR));
    const h2 = (Math.atan2(b2, a2) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(h2 - (h - 180)) < 12,
              `the afterimage should sit opposite: ${h2.toFixed(0)} against ${(h - 180).toFixed(0)}`);
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
        const d = Math.abs(((h1 - h2 + 540) % 360) - 180);
        assert.ok(d < 10, `${hex} -> ${there} -> ${back}: hue drifted ${d.toFixed(0)}`);
    }
});

test("out of gamut loses chroma, not hue", () => {
    // A tint that cannot be shown is shown grayer. Clipping per channel would
    // swing the hue instead, which is the one thing a complement must not do.
    const hot = afterimage("#00ff00");
    const [, a, b] = oklab(hot);
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    const [, a0, b0] = oklab("#00ff00");
    const h0 = (Math.atan2(b0, a0) * 180 / Math.PI + 360) % 360;
    const d = Math.abs(((h0 - h + 540) % 360) - 180);
    assert.ok(180 - d < 12, `green's afterimage drifted ${(180 - d).toFixed(0)} degrees`);
});
