// Beyond Wieringa, page 1 — the cube's shadow.
//
// π(C^k) with k on a slider. The page is controls and a readout; the picture
// and the mathematics are `view/zono3d.ts` and `geometry/zono3.ts`.

import { createZono3d, MAX_K } from "../view/zono3d.js";
import { BUILD_ID } from "../build-id.js";

const NAMES = [
    "a point",
    "an edge — one generator",
    "the golden rhomb — the face of every solid above",
    "a golden rhombohedron — one of the two tiles",
    "Bilinski's rhombic dodecahedron — the minilens",
    "Fedorov's rhombic icosahedron — the lens",
    "Kepler's rhombic triacontahedron — the window",
];

const host = document.getElementById("stage");
if (!host) throw new Error("no #stage");
const view = createZono3d({ container: host, state: { k: 6 } });

const say = document.getElementById("readout");
const name = document.getElementById("solidname");
function report() {
    const c = view.counts();
    if (name) name.textContent = `k = ${c.k} · ${NAMES[c.k]}`;
    if (say) {
        say.textContent = c.k < 2
            ? `${c.vertices} vertices`
            : `${c.vertices} vertices · ${c.edges} edges · ${c.faces} faces`
              + `  (k² − k + 2 = ${c.k * c.k - c.k + 2}, k(k−1) = ${c.k * (c.k - 1)})`;
    }
}

function slider(id: string, onChange: (v: number) => void) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    const fire = () => onChange(Number(el.value));
    el.addEventListener("input", fire);
    fire();
}
slider("k", (v) => { view.set({ k: v }); report(); });
slider("explode", (v) => view.set({ explode: v }));
slider("cut", (v) => view.set({ cut: v }));

for (const [id, key] of [["spin", "spin"], ["edges", "edges"]] as const) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) continue;
    const fire = () => view.set({ [key]: el.checked });
    el.addEventListener("change", fire);
    fire();
}

const stamp = document.getElementById("buildid");
if (stamp) stamp.textContent = `build id ${BUILD_ID}`;
report();
