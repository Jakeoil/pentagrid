// grow.html: the pentagrid assembling itself, flat.
//
// All the drawing lives in view/growth.ts. This is the page: a container, a
// starting state, the sliders, and the reticulum — whose presets popup is the
// only preset control here.

import { createGrowthView } from "../view/growth.js";
import {
    bindSliders, bindToggles, bindSelects, mountGammaControls, mountFloatingReticulum, addSetupButtons,
} from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const host = document.getElementById("grow-view");
if (host) {
    const view = createGrowthView({
        // Remembered across visits — PLAN §9.4, Jake's want #4. The
        // exploration pages opt in; the narrative ones do not, since a step
        // imposes its own feature set and a session would fight it. `reset
        // page` in the panel's settings is the way home.
        session: "grow", container: host, lift: false, ribbons: "stroke" });
    bindSliders(view, [
        { id: "grow-t", key: "grow", format: (v) => v.toFixed(2) },
        { id: "grow-w", key: "band", format: (v) => `${Math.round(v * 100)}%` },
    ]);
    bindSelects(view, [{ id: "grow-edges", key: "edgeStyle" }]);
    bindToggles(view, [
        { id: "grow-2kgons", key: "showResolutions" },
        { id: "grow-p1", key: "p1" },
        { id: "grow-penta", key: "penta" },
        { id: "grow-nextgen", key: "nextgen" },
        { id: "grow-kites", key: "kites" },
        { id: "grow-kowalewski", key: "kowalewski" },
        { id: "grow-height", key: "height" },
        { id: "grow-isogloss", key: "isogloss" },
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

    // The page's own machinery, in the bar: this picture as markup, and as a
    // vector file. Jake, 2026-11-26: "Add the export svg and copy setup
    // buttons to roof and grow." They were the panel's, and the growth pages
    // have no panel — so the two pages that most want a vector file were the
    // two that could not ask for one. `addSetupButtons` is the panel's own
    // code, not a second copy.
    const setupBar = document.getElementById("grow-setup");
    if (setupBar) {
        addSetupButtons(setupBar, {
            embed: (o) => view.embed(o),
            link: () => view.link(),
            svg: () => view.svg(),
        }, ["setup", "link", "svg"]);
    }

}
