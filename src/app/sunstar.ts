// sunstar.html: the Sun/Star involution, driven one grid line at a time.
//
// The whole page is one claim made touchable. With every offset equal to c, the
// origin's K-tuple is (1,1,1,1,1) so its index is always 5, while the patch uses
// levels [Σγ+1, Σγ+4]. Five is an extreme — a Pe5 centre — only at the ends of
// that range, so Σγ = 1 and 4 are Suns and Σγ = 2 and 3 are Stars, paired by the
// Σγ ↔ −Σγ mirror. Every one of them shows five fat rhombs at the origin, which
// is why looking at the vertex tells you nothing and the cluster recogniser is
// the instrument that settles it.
//
// The guard is OFF here on purpose: Σγ = 0 is the singular decagon, and this page
// exists to visit it.

import { createPentagrid } from "../view/pentagrid.js";
import { findClusters } from "../geometry/clusters.js";
import type { Cluster } from "../geometry/clusters.js";

// penrose-mosaic's cluster palette, so the two projects agree on sight.
const FILL: Record<string, string> = {
    Pe5: "#9292e3",   // blue-purple
    Pe3: "#e6e68e",   // olive
    Pe1: "#eec09b",   // orange-tan
};

const host = document.getElementById("ss-view");
const strip = document.getElementById("ss-lines");
const verdictEl = document.getElementById("ss-verdict");
const sumEl = document.getElementById("ss-sum");

if (host && strip) {
    let active = 0;
    let clusters: Cluster[] = [];
    let atOrigin: Cluster | null = null;
    let defined = false;

    const handle = createPentagrid({
        container: host,
        features: { gridLines: true, axes: false },
        loupe: false,
        layers: ({ stack, getView, currentRhombs }) => {
            stack.add({
                id: "clusters", label: "P1 clusters", z: 30, group: "Exploration",
                draw: ({ ctx, cx, cy }) => {
                    const v = getView();
                    const rhombs = currentRhombs();
                    const res = findClusters(rhombs);
                    defined = res.defined;
                    clusters = res.clusters;
                    atOrigin = res.clusters.find(
                        (c) => Math.hypot(c.x, c.y) < 1e-9) ?? null;
                    if (!res.defined) return;

                    for (const c of res.clusters) {
                        if (!c.kind) continue;              // cut by the patch edge
                        ctx.fillStyle = FILL[c.kind];
                        for (const i of c.rhombs) {
                            const r = rhombs[i];
                            ctx.beginPath();
                            r.vertices.forEach(([x, y], k) => {
                                const sx = cx + (x - v.x) * v.scale;
                                const sy = cy - (y - v.y) * v.scale;
                                if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                            });
                            ctx.closePath();
                            ctx.fill();
                        }
                    }
                    // the point the whole page is about
                    const ox = cx + (0 - v.x) * v.scale, oy = cy - (0 - v.y) * v.scale;
                    ctx.beginPath();
                    ctx.arc(ox, oy, 5, 0, 2 * Math.PI);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = "#111";
                    ctx.stroke();
                },
            });
        },
    });

    const g = handle.gamma;
    g.setGuard(false);            // Σγ = 0 is the decagon, and we want to go there

    /** Uniform offset c for every family, so the grid keeps its five-fold symmetry. */
    function setUniform(c: number) {
        g.setSum(5 * c, true);
        refresh();
    }

    function verdict(): { text: string; cls: string } {
        if (g.singular().length > 0)
            return { text: "DECA — singular, all five lines concurrent", cls: "deca" };
        if (!defined)
            return { text: "no clusters — Σγ is not an integer, so this is not Penrose", cls: "none" };
        if (atOrigin && atOrigin.kind === "Pe5")
            return { text: "SUN — the origin is a Pe5 centre", cls: "sun" };
        if (!atOrigin)
            return { text: "STAR — the origin is in an St5 gap, in no cluster", cls: "star" };
        return { text: `origin is a ${atOrigin.kind ?? "partial"} centre`, cls: "none" };
    }

    function refresh() {
        handle.redraw();                       // recomputes clusters via the layer
        const v = verdict();
        if (verdictEl) {
            verdictEl.textContent = v.text;
            verdictEl.className = "verdict " + v.cls;
        }
        if (sumEl) sumEl.textContent = `Σγ = ${g.getSum().toFixed(3)}`;
        render();
    }

    function render() {
        strip!.innerHTML = "";
        const vals = g.values();
        const locked = g.getLocked();
        vals.forEach((val, j) => {
            const row = document.createElement("div");
            row.className = "line-row"
                + (j === active ? " active" : "")
                + (j === locked ? " free" : "");
            const swatch = document.createElement("span");
            swatch.className = "line-swatch";
            swatch.style.background = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"][j];
            const name = document.createElement("span");
            name.className = "line-name";
            name.textContent = `γ${"₀₁₂₃₄"[j]}`;
            const num = document.createElement("span");
            num.className = "line-val";
            // modulo 1: only the fractional part changes the grid at all
            num.textContent = (((val % 1) + 1) % 1).toFixed(3);
            const tag = document.createElement("span");
            tag.className = "line-tag";
            tag.textContent = j === locked ? "free" : (j === active ? "active" : "");
            row.append(swatch, name, num, tag);

            row.addEventListener("wheel", (e) => {
                e.preventDefault();
                if (j === locked) return;              // the free one is not driven
                active = j;
                const step = (e as WheelEvent).shiftKey ? 0.001 : 0.01;
                const dir = (e as WheelEvent).deltaY > 0 ? -1 : 1;
                g.setValue(j, g.values()[j] + dir * step);
                refresh();
            }, { passive: false });
            row.addEventListener("click", () => { active = j; render(); });
            strip!.appendChild(row);
        });
    }

    document.querySelectorAll<HTMLElement>("[data-c]").forEach((b) => {
        b.addEventListener("click", () => setUniform(parseFloat(b.dataset.c!)));
    });

    setUniform(1 / 5);          // open on a Sun
}
