// grow7.html: the same growth animation on a heptagrid.
//
// Identical to grow.ts but for n. Everything that differs — seven dials, seven
// colours, three rhomb shapes, a registration gain of 7/2 rather than 5/2 — is
// derived from that one number rather than configured here, which is the point
// of the exercise.

import { createGrowthView } from "../view/growth.js";
import { bindSliders, bindToggles, mountGammaControls } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const host = document.getElementById("grow7-view");
if (host) {
    const view = createGrowthView({ container: host, n: 7, lift: false, ribbons: "stroke" });

    // Σγ = 1 is the uniform offset 1/7, the one setting with global 7-fold
    // symmetry (Lutfalla Thm 1.2). Starting anywhere else buries the reason the
    // page exists, and starting at 0 would only be the guard's nudge off zero.
    view.pentagrid.gamma.setSum(1, true);

    bindSliders(view, [
        { id: "grow7-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "grow7-w", key: "band", format: (v) => `${Math.round(v * 100)}%` },
    ]);
    bindToggles(view, [{ id: "grow7-edges", key: "boldEdges" }]);

    const gammaHost = document.getElementById("grow7-gamma");
    if (gammaHost) {
        mountGammaControls(view.pentagrid.gamma, gammaHost, { colors: FAMILY_COLORS });
    }
}
