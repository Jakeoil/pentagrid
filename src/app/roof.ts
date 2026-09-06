// roof.html: the same assembly, stood up into golden rhombi.
//
// Same container as grow.html — view/growth.ts — with the lift on and the camera
// live. The difference between the two pages is a config object.

import { createGrowthView } from "../view/growth.js";
import { bindSliders, bindToggles } from "../view/controls.js";

const host = document.getElementById("roof-view");
if (host) {
    const view = createGrowthView({ container: host, lift: true, ribbons: "quads" });
    bindSliders(view, [
        { id: "roof-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "roof-fold", key: "fold", format: (v) => `${Math.round(v * 100)}%` },
        { id: "roof-band", key: "band", format: (v) => `${Math.round(v * 100)}%` },
        { id: "roof-az", key: "azimuth", format: (v) => `${Math.round(v * 180 / Math.PI)}°` },
        { id: "roof-el", key: "elevation", format: (v) => `${Math.round(v * 180 / Math.PI)}°` },
    ]);
    bindToggles(view, [{ id: "roof-edges", key: "boldEdges" }]);
}
