// Golden zonohedra, page 1 — the cube's shadow.
//
// π(C^k) chosen by name. The page is controls and a readout; the picture and
// the mathematics are `view/zono3d.ts` and `geometry/zono3.ts`.

import { createZono3d, SOLIDS } from "../view/zono3d.js";
import type { EdgeStyle, FaceStyle, SolidKey } from "../view/zono3d.js";
import { BUILD_ID } from "../build-id.js";

/** What each rung IS, said once, beside its short name. */
const SAYS: Record<SolidKey, string> = {
    point: "a point — no generators at all",
    edge: "an edge — one generator",
    rhomb: "the golden rhomb — the face of every solid above",
    O6: "the oblate rhombohedron — three axes in a chain",
    A6: "the acute rhombohedron — three axes in an equilateral triangle",
    B12: "Bilinski's rhombic dodecahedron — the minilens",
    F20: "Fedorov's rhombic icosahedron — the lens",
    K30: "Kepler's rhombic triacontahedron — the window",
};

const host = document.getElementById("stage");
if (!host) throw new Error("no #stage");
const view = createZono3d({ container: host, state: { solid: "K30" } });

const say = document.getElementById("readout");
const name = document.getElementById("solidname");
function report() {
    const c = view.counts();
    if (name) name.textContent = `k = ${c.k} · ${SAYS[view.state.solid]}`;
    if (say) {
        say.textContent = c.k < 2
            ? `${c.vertices} vertices`
            : `${c.vertices} vertices · ${c.edges} edges · ${c.faces} faces`
              + `  (k² − k + 2 = ${c.k * c.k - c.k + 2}, k(k−1) = ${c.k * (c.k - 1)})`;
    }
}

/** Fill a <select> from a list of value/label pairs and wire it up. */
function pick(id: string, opts: readonly { value: string; label: string }[],
              value: string, onChange: (v: string) => void) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    for (const o of opts) {
        const node = document.createElement("option");
        node.value = o.value;
        node.textContent = o.label;
        el.appendChild(node);
    }
    el.value = value;
    el.addEventListener("change", () => onChange(el.value));
}

pick("solid", SOLIDS.map((s) => ({ value: s.key, label: s.label })), "K30", (v) => {
    view.set({ solid: v as SolidKey });
    report();
});
pick("edges", [
    { value: "none", label: "none" },
    { value: "thin", label: "thin" },
    { value: "zome", label: "ball and stick" },
], "thin", (v) => view.set({ edges: v as EdgeStyle }));
pick("faces", [
    { value: "none", label: "none" },
    { value: "transparent", label: "transparent" },
    { value: "solid", label: "solid" },
], "solid", (v) => view.set({ faces: v as FaceStyle }));

function slider(id: string, onChange: (v: number) => void) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    const fire = () => onChange(Number(el.value));
    el.addEventListener("input", fire);
    fire();
}
slider("explode", (v) => view.set({ explode: v }));
slider("cut", (v) => view.set({ cut: v }));

const spin = document.getElementById("spin") as HTMLInputElement | null;
if (spin) {
    const fire = () => view.set({ spin: spin.checked });
    spin.addEventListener("change", fire);
    fire();
}

const stamp = document.getElementById("buildid");
if (stamp) stamp.textContent = `build id ${BUILD_ID}`;
report();
