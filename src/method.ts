// The method page: de Bruijn's construction in six steps.
//
// All the machinery is in view/pentagrid.ts now; this is the page that asks for
// it. A second page — an exploration with its own layers — is the same shape,
// with a different `steps` list and a `layers` callback.

import { BUILD_ID } from "./build-id.js";
import { METHOD_STEPS } from "./app/method-steps.js";
import { createPentagrid } from "./view/pentagrid.js";
import { mountReticulum } from "./view/controls.js";
import { createFloatingPanel } from "./ui/floating.js";

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
//
// The reticulum floats: it is an instrument you want beside whichever part of the
// picture you are looking at, not a thing pinned under the controls. Drag it by
// the bar; it remembers where you put it.
const panel = createFloatingPanel({
    id: "reticulum",
    title: "Reticulum · γ",
    // Closing it must not be a one-way door, so the button that opens it comes
    // back the moment it is shut.
    onClose: () => { reopen.hidden = false; },
});
document.body.appendChild(panel.element);
mountReticulum(handle.gamma, panel.body, {
    colors: ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"],
});

const reopen = document.createElement("button");
reopen.type = "button";
reopen.className = "reopen-panel";
reopen.textContent = "γ reticulum";
reopen.title = "Show the reticulum again";
reopen.hidden = true;
reopen.addEventListener("click", () => {
    panel.show();
    reopen.hidden = true;
});
byId("step-nav")?.appendChild(reopen);

// The slider bank is a lot of screen for something you set and forget. Fold it
// away without taking it off the page — the reticulum is usually the instrument
// you want in front of you.
const controls = byId("controls");
if (controls) {
    const fold = document.createElement("button");
    fold.type = "button";
    fold.className = "fold-controls";
    let folded = false;
    const paint = () => {
        controls.classList.toggle("folded", folded);
        fold.textContent = folded ? "▸ γ sliders" : "▾ γ sliders";
    };
    fold.addEventListener("click", () => { folded = !folded; paint(); });
    paint();
    byId("step-nav")?.appendChild(fold);
}
