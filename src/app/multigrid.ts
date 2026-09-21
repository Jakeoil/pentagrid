// multigrid.html: de Bruijn's construction for any n.
//
// The same createPentagrid the method page uses, with n chosen on the page —
// the reticulum draws a 2n-gon, the panel offers what makes sense off the
// pentagrid, and the geometry is the geometry. n is fixed at construction
// (the γ set, the directions, the palette all come from it), so choosing a
// new one rebuilds the view in the same containers.

import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle } from "../view/pentagrid.js";
import { mountFloatingReticulum } from "../view/controls.js";

const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5",
                "#e07a5f", "#3d5a80", "#8ac926", "#ff6b35", "#6a4c93",
                "#118ab2", "#b5838d"];

const byId = (id: string) => document.getElementById(id) ?? undefined;
const viewHost = byId("multigrid-view");
const panelHost = byId("multigrid-panel");
const pick = document.getElementById("multigrid-n") as HTMLSelectElement | null;
const note = byId("multigrid-note");

if (viewHost && pick) {
    let handle: PentagridHandle | null = null;
    let teardown: (() => void) | null = null;

    const build = (n: number) => {
        teardown?.();
        for (const el of [viewHost, panelHost]) {
            if (el) el.replaceChildren();
        }
        handle = createPentagrid({
            container: viewHost,
            panel: panelHost,
            // No `controls`: the reticulum is the instrument here, and the slider
            // bank and meter that come with a controls host are not wanted. Jake.
            n,
            features: { gridLines: true, intersectionDots: true, center: true,
                        penroseTiles: true, penroseEdges: true, penroseVertices: false,
                        hoverVertex: true, hoverEdge: true, hoverTile: true },
        });
        // The uniform offset 1/n is the one setting with global n-fold symmetry
        // for odd n (Lutfalla Thm 1.2); for even n, 1/2 each gives 2n-fold
        // (Thm 1.1). Start there, so the page opens on the reason it exists.
        handle.gamma.setLocked(-1);
        handle.gamma.setValues(new Array(n).fill(n % 2 === 1 ? 1 / n : 1 / 2));
        const { panel } = mountFloatingReticulum(handle.gamma, {
            colors: COLORS, buttons: handle.panelRow("View") ?? document.body,
        });
        panel.setTitle(`Reticulum · n = ${n}`);
        teardown = () => { panel.element.remove(); };
        if (note) {
            const shapes = Math.floor(n / 2);
            const step = n % 2 === 1 ? `2π/${n}` : `π/${n}`;
            note.textContent = `${n} families, ${step} apart · ${shapes} rhomb shape${shapes > 1 ? "s" : ""} · `
                + `registration gain ${n}/2` + (n % 2 === 0 ? " · even: half-turn spacing, no two families parallel" : "");
        }
    };

    pick.addEventListener("change", () => build(parseInt(pick.value, 10) || 7));
    build(parseInt(pick.value, 10) || 7);
}
