// grow.html: the pentagrid assembling itself, flat.
//
// All the drawing lives in view/growth.ts. This is the page: a container, a
// starting state, and five sliders.

import { createGrowthView } from "../view/growth.js";
import { bindSliders, bindToggles } from "../view/controls.js";

const host = document.getElementById("grow-view");
if (host) {
    const view = createGrowthView({ container: host, lift: false, ribbons: "stroke" });
    bindSliders(view, [
        { id: "grow-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "grow-w", key: "band", format: (v) => `${Math.round(v * 100)}%` },
    ]);
    bindToggles(view, [{ id: "grow-edges", key: "boldEdges" }]);
}
