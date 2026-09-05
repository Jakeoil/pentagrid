// The method page: de Bruijn's construction in six steps.
//
// All the machinery is in view/pentagrid.ts now; this is the page that asks for
// it. A second page — an exploration with its own layers — is the same shape,
// with a different `steps` list and a `layers` callback.

import { BUILD_ID } from "./build-id.js";
import { METHOD_STEPS } from "./app/method-steps.js";
import { createPentagrid } from "./view/pentagrid.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;

createPentagrid({
    container: document.getElementById("canvas-container")!,
    controls: byId("controls"),
    stepNav: byId("step-nav"),
    panel: byId("layer-panel"),
    explanation: byId("explanation"),
    steps: METHOD_STEPS,
    buildId: BUILD_ID,
});
