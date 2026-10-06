// The method page: de Bruijn's construction in seven pages.
//
// All the machinery is in view/pentagrid.ts now; this is the page that asks for
// it. A second page — an exploration with its own layers — is the same shape,
// with a different page list and a `layers` callback.

import { BUILD_ID } from "./build-id.js";
import { METHOD_PAGES } from "./app/method-steps.js";
import { createNarrative } from "./app/narrative.js";
import { createPentagrid } from "./view/pentagrid.js";
import { mountFloatingReticulum } from "./view/controls.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;

const handle = createPentagrid({
    container: document.getElementById("canvas-container")!,
    controls: byId("controls"),
    panel: byId("layer-panel"),
});

// The pages drive the view, not the other way round: createPentagrid no longer
// takes them, and each page's own `enter` decides what it shows and which
// controls are worth exposing on it.
const narrative = createNarrative({
    pages: METHOD_PAGES,
    handle,
    nav: byId("step-nav"),
    explanation: byId("explanation"),
    buildId: BUILD_ID,
});

// A switch that turns on something another page is about takes you there, rather
// than sitting on with nothing to see. The view reports; the narrative decides.
handle.onFeatureOn((key) => {
    const page = narrative.pageFor(key);
    if (page >= 0 && page !== narrative.current()) narrative.go(page);
});

// The reticulum is the instrument; the slider bank is kept, folded, for the
// comparison. Jake: default the sliders off on every page.
mountFloatingReticulum(handle.gamma, {
    colors: ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"],
    // At the end of the View row, with the sliders' fold button; shows only
    // while the reticulum is shut.
    buttons: handle.panelRow("View") ?? byId("step-nav") ?? document.body,
    sliders: byId("controls"),
    foldSliders: true,
});
