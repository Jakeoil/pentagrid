// grow.html: the pentagrid assembling itself, flat.
//
// All the drawing lives in view/growth.ts. This is the page: a container, a
// starting state, and five sliders.

import { createGrowthView } from "../view/growth.js";
import { bindSliders, bindToggles, mountGammaControls } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const host = document.getElementById("grow-view");
if (host) {
    const view = createGrowthView({ container: host, lift: false, ribbons: "stroke" });
    bindSliders(view, [
        { id: "grow-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "grow-w", key: "band", format: (v) => `${Math.round(v * 100)}%` },
    ]);
    bindToggles(view, [{ id: "grow-edges", key: "boldEdges" }]);

    // The γ controls are a cluster, not markup: one call mounts the five linked
    // dials and the total, already wired to the set the view is drawing from.
    const gammaHost = document.getElementById("grow-gamma");
    if (gammaHost) {
        mountGammaControls(view.pentagrid.gamma, gammaHost, { colors: FAMILY_COLORS });
    }
}
