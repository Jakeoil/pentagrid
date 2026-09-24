// roof.html: the same assembly, stood up into golden rhombi.
//
// Same container as grow.html — view/growth.ts — with the lift on and the camera
// live. The difference between the two pages is a config object.

import { createGrowthView } from "../view/growth.js";
import {
    bindSliders, bindToggles, mountGammaControls, mountFloatingReticulum,
} from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const host = document.getElementById("roof-view");
if (host) {
    // The solids layer reports what it drew; the note under the viewport says it.
    const note = document.getElementById("roof-solid-note");
    const view = createGrowthView({
        container: host, lift: true, ribbons: "quads",
        onReadout: (text) => { if (note) note.textContent = text; },
    });
    bindSliders(view, [
        { id: "roof-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "roof-fold", key: "fold", format: (v) => `${Math.round(v * 100)}%` },
        { id: "roof-band", key: "band", format: (v) => `${Math.round(v * 100)}%` },
        // Both wrap per singularity against its own count — a hexagon has two
        // readings, a decagon 62 — so one control drives every solid on screen.
        { id: "roof-reading", key: "reading", format: (v) => `${v + 1}` },
        { id: "roof-flip", key: "pick", format: (v) => `${v + 1}` },
    ]);
    bindToggles(view, [
        { id: "roof-edges", key: "boldEdges" },
        { id: "roof-p1", key: "p1" },
        { id: "roof-penta", key: "penta" },
        { id: "roof-nextgen", key: "nextgen" },
        { id: "roof-kites", key: "kites" },
        { id: "roof-offp", key: "offPenrose" },
        { id: "roof-2kgons", key: "showResolutions" },
        { id: "roof-solids", key: "solids" },
        { id: "roof-pair", key: "pairGhost" },
        { id: "roof-stackbands", key: "stackBands" },
    ]);

    // Nothing draws the solids layer when it is off, so nothing clears its note.
    const solids = document.getElementById("roof-solids") as HTMLInputElement | null;
    solids?.addEventListener("change", () => {
        if (!solids.checked && note) note.textContent = "";
    });

    // Σγ shifts the de Bruijn index range, so here it also changes how many
    // levels the surface stands on — see the note under the viewport.
    const gammaHost = document.getElementById("roof-gamma");
    if (gammaHost) {
        mountGammaControls(view.pentagrid.gamma, gammaHost, { colors: FAMILY_COLORS });
        // The reticulum floats, and the sliders start folded, as everywhere.
        const bar = document.querySelector<HTMLElement>(".bar");
        mountFloatingReticulum(view.pentagrid.gamma, {
            colors: FAMILY_COLORS,
            buttons: bar ?? document.body,
            sliders: gammaHost,
            foldSliders: true,
        });
    }
}
