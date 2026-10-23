// roof.html: the same assembly, stood up into golden rhombi.
//
// Same container as grow.html — view/growth.ts — with the lift on and the camera
// live. The difference between the two pages is a config object.

import { createGrowthView } from "../view/growth.js";
import {
    bindSliders, bindToggles, bindSelects, mountGammaControls, mountFloatingReticulum,
} from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";
import { BUILD_ID } from "../build-id.js";

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
        { id: "roof-band", key: "band", format: (v) => `${Math.round(v * 100)}%` },
        // The singularity's state in Jake's three coordinates (§5.-1b): the
        // anti-gridline, the sense, and which of the wall's two completions —
        // or the wall itself. It replaced a 0..61 slider, which indexed the
        // decagon zonogon's 62 rhombic tilings where the grid reaches ten.
        { id: "roof-axis", key: "axis", format: (v) => `${v}` },
        { id: "roof-flip", key: "pick", format: (v) => `${v + 1}` },
    ]);
    bindSelects(view, [
        { id: "roof-edges", key: "edgeStyle" },
        { id: "roof-index", key: "indexStyle" },
        { id: "roof-paths", key: "paths" },
    ]);
    bindToggles(view, [
        { id: "roof-penta", key: "penta" },
        { id: "roof-nextgen", key: "nextgen" },
        { id: "roof-kites", key: "kites" },
        { id: "roof-kowalewski", key: "kowalewski" },
        { id: "roof-height", key: "height" },
        { id: "roof-isogloss", key: "isogloss" },
        { id: "roof-offp", key: "offPenrose" },
        { id: "roof-arcs", key: "arcs" },
        { id: "roof-2kgons", key: "showResolutions" },
        { id: "roof-resolve", key: "resolve" },
        { id: "roof-solids", key: "solids" },
        { id: "roof-pair", key: "pairGhost" },
    ]);

    // Fold is a checkbox here and a float underneath: the geometry wants a
    // continuous parameter — it is the whole of the lift — and the roof only
    // ever wants the two ends of it. Up by default, since a roof page that
    // opens flat is a tiling page — which is why the switch reads FLAT and
    // starts unchecked rather than reading `fold` and starting checked. Jake:
    // "change fold checkbox to opposite: flat. This reverses the function of
    // the checkmark. It's more intuitive." A box you tick to make something
    // happen beats one you untick.
    // The sense is +1 or -1 underneath — it is the sign of the perturbation,
    // and `wallView` reads it as one — so the checkbox maps onto the two signs
    // rather than onto true and false. Checked is thin-then-thick along the
    // spoke. Jake: "two configs (call it direction) on each."
    const dir = document.getElementById("roof-direction") as HTMLInputElement | null;
    if (dir) {
        const apply = () => view.set({ direction: dir.checked ? 1 : -1 });
        dir.addEventListener("change", apply);
        apply();
    }

    const flat = document.getElementById("roof-flat") as HTMLInputElement | null;
    if (flat) {
        const apply = () => view.set({ fold: flat.checked ? 0 : 1 });
        flat.addEventListener("change", apply);
        apply();
    }

    // Jake could not find it: the stamp, under the viewport with the readout.
    const stamp = document.getElementById("roof-buildid");
    if (stamp) stamp.textContent = `build id ${BUILD_ID}`;

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
