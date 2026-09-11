// The method page: de Bruijn's construction in six steps.
//
// All the machinery is in view/pentagrid.ts now; this is the page that asks for
// it. A second page — an exploration with its own layers — is the same shape,
// with a different `steps` list and a `layers` callback.

import { BUILD_ID } from "./build-id.js";
import { METHOD_STEPS } from "./app/method-steps.js";
import { createPentagrid } from "./view/pentagrid.js";
import { mountReticulum } from "./view/controls.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;

const handle = createPentagrid({
    container: document.getElementById("canvas-container")!,
    controls: byId("controls"),
    stepNav: byId("step-nav"),
    panel: byId("layer-panel"),
    explanation: byId("explanation"),
    steps: METHOD_STEPS,
    buildId: BUILD_ID,
});

// Both controls, on one page and one gamma set, so they can be compared before
// either is preferred. Neither replaces the other — see PLAN.md.
const retHost = byId("reticulum");
if (retHost) {
    mountReticulum(handle.gamma, retHost, {
        colors: ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"],
    });
}
