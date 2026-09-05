// Two linked viewports on the index page: the same pentagrid, drawn as lines on
// the left and as its dual tiling on the right.
//
// This is the first page that is not method.html, and the whole reason for
// createPentagrid. It supplies no controls, no narration and no steps — just a
// container each, a shared γ, and a feature set. Panning or zooming either one
// drives the other, because the offsets are identical and the two pictures share
// a coordinate system.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle, View } from "../view/pentagrid.js";

/** A random regular pentagrid: four free offsets, the fifth fixed by Σγ = 0. */
function randomGamma(): number[] {
    const g: number[] = [];
    for (let j = 0; j < 4; j++) {
        g.push(Math.round((Math.random() * 2 - 1) * 1e4) / 1e4);
    }
    g.push(-g.reduce((a, b) => a + b, 0));
    return g;
}

const gridHost = document.getElementById("pair-grid");
const tileHost = document.getElementById("pair-tiles");

if (gridHost && tileHost) {
    const gamma = randomGamma();

    // Declared first so each callback can reach the other; they are only ever
    // called after both exist.
    let lines: PentagridHandle;
    let tiles: PentagridHandle;

    // setView deliberately does not fire onViewChange, so this is a one-hop
    // relay rather than a loop.
    const relay = (to: () => PentagridHandle) => (v: View) => to().setView(v);

    lines = createPentagrid({
        container: gridHost,
        gamma,
        steps: [],
        features: { gridLines: true, axes: false },
        onViewChange: relay(() => tiles),
    });

    tiles = createPentagrid({
        container: tileHost,
        gamma,
        steps: [],
        // The grid is hidden rather than switched off: a family's userVisible
        // also removes the rhombs it generates, which would leave nothing here.
        features: { gridLines: false, axes: false, penroseTiles: true },
        onViewChange: relay(() => lines),
    });

    // Start them on the same view, whichever way the defaults fall.
    tiles.setView(lines.getView());
}
