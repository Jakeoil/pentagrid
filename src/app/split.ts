// split.html: the grid on one canvas and its dual on the other, one gamma.
//
// One createPentagrid, one model, one layer stack — the Pentagrid group's
// canvases in the left container and the Penrose group's in the right, the axes
// in both. Nothing is computed twice, there is nothing to relay, and a hover
// crosses over because it is the same handler drawing its grid half on one
// canvas and its Penrose half on the other. PLAN.md 5.0.

import { createPentagrid } from "../view/pentagrid.js";
import { mountFloatingReticulum } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;
const gridHost = byId("split-grid");
const tileHost = byId("split-tiles");

if (gridHost && tileHost) {
    const grid = createPentagrid({
        container: gridHost,
        containerP: tileHost,
        panel: byId("split-grid-panel"),
        panelP: byId("split-tiles-panel"),
        // Start regular — the "regular" preset — rather than on the singular default.
        gamma: [0.07, 0.11, 0.13, 0.17, -0.48],
        features: {
            gridLines: true, kRegions: true, intersectionDots: true, axes: false, center: true,
            penroseVertices: true, penroseEdges: true, penroseTiles: true,
            hoverVertex: true, hoverEdge: true, hoverTile: true,
        },
    });

    // The "show reticulum" button lives at the end of the View row and only
    // while the reticulum is shut; a bar of its own was a waste of a line.
    mountFloatingReticulum(grid.gamma, {
        colors: FAMILY_COLORS,
        buttons: grid.panelRow("View") ?? document.body,
    });
}
