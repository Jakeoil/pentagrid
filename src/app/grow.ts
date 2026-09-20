// grow.html: the pentagrid assembling itself, flat.
//
// All the drawing lives in view/growth.ts. This is the page: a container, a
// starting state, the sliders, and the reticulum — whose presets popup is the
// only preset control here.

import { createGrowthView } from "../view/growth.js";
import {
    bindSliders, bindToggles, mountGammaControls, mountFloatingReticulum,
} from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const host = document.getElementById("grow-view");
if (host) {
    const view = createGrowthView({ container: host, lift: false, ribbons: "stroke" });
    bindSliders(view, [
        { id: "grow-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "grow-w", key: "band", format: (v) => `${Math.round(v * 100)}%` },
    ]);
    bindToggles(view, [
        { id: "grow-edges", key: "boldEdges" },
        { id: "grow-2kgons", key: "showResolutions" },
        { id: "grow-p1", key: "p1" },
        { id: "grow-penta", key: "penta" },
        { id: "grow-nextgen", key: "nextgen" },
        { id: "grow-kites", key: "kites" },
        { id: "grow-offp", key: "offPenrose" },
    ]);

    // The γ controls are a cluster, not markup: one call mounts the five linked
    // dials and the total, already wired to the set the view is drawing from.
    const gammaHost = document.getElementById("grow-gamma");
    if (gammaHost) {
        mountGammaControls(view.pentagrid.gamma, gammaHost, { colors: FAMILY_COLORS });
    }

    // The reticulum, floating, exactly as on the method page — one mount for
    // both. Default here is the reticulum alone: the sliders start folded.
    const bar = document.querySelector<HTMLElement>(".bar");
    mountFloatingReticulum(view.pentagrid.gamma, {
        colors: FAMILY_COLORS,
        buttons: bar ?? document.body,
        sliders: gammaHost ?? undefined,
        foldSliders: true,
    });
}
