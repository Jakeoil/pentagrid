// split.html: the grid on one canvas and its dual on the other, one gamma.
//
// The pair on the index page linked two views with a random gamma and nothing
// else. This is the workbench version: grid objects on the left, Penrose objects
// on the right, the reticulum and the presets driving both, and each side with
// its own switches. Built on the same relay — setView does not fire onViewChange,
// so the link is one hop and cannot loop.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle, View } from "../view/pentagrid.js";
import { mountFloatingReticulum } from "../view/controls.js";
import { addPresets } from "../ui/presets.js";
import { FAMILY_COLORS } from "../view/growth.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;
const gridHost = byId("split-grid");
const tileHost = byId("split-tiles");

if (gridHost && tileHost) {
    let grid: PentagridHandle;
    let tiles: PentagridHandle;
    const relay = (to: () => PentagridHandle) => (v: View) => to().setView(v);

    // Start regular — the "regular" preset — rather than on the singular default.
    const gamma = [0.07, 0.11, 0.13, 0.17, -0.48];
    grid = createPentagrid({
        container: gridHost,
        panel: byId("split-grid-panel"),
        gamma,
        features: { gridLines: true, kRegions: true, intersectionDots: true, axes: false },
        onViewChange: relay(() => tiles),
    });
    tiles = createPentagrid({
        container: tileHost,
        panel: byId("split-tiles-panel"),
        gamma,
        // The grid is hidden, not switched off: a family's userVisible also
        // removes the rhombs it generates, which would leave nothing here.
        features: { gridLines: false, axes: false,
                    penroseVertices: true, penroseEdges: true, penroseTiles: true },
        onViewChange: relay(() => grid),
    });
    tiles.setView(grid.getView());

    // One gamma. The left side's set is the instrument; every change on it is
    // pushed to the right, values and lock alike, so a preset or a wheel notch
    // lands on both. The right side never drives: its total is released so the
    // pushed values are never rewritten against a lock of its own.
    tiles.gamma.setLocked(-1);
    const push = () => {
        tiles.gamma.setValues(grid.gamma.values());
        tiles.redraw();
    };
    grid.gamma.onChange(push);
    push();

    const bar = byId("split-bar");
    if (bar) {
        mountFloatingReticulum(grid.gamma, { colors: FAMILY_COLORS, buttons: bar });
    }
    const caps = byId("split-caps");
    if (caps) addPresets(caps, "cap", grid.gamma, () => grid.redraw());
    const hunt = byId("split-hunt");
    if (hunt) addPresets(hunt, "hunt", grid.gamma, () => grid.redraw());
}
