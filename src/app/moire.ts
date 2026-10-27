// moire.html: two pentagrids side by side, one of them the other deflated.
//
// The question is Jake's: a generalized Penrose tiling is labeled by its LI
// class Σγ mod 1, and deflation is γⱼ ↦ −(γ_{j+2} + γ_{j+3}), whose rows sum
// to −2 — so on the class it is s ↦ −2s mod 1. A tiling off Penrose does not
// fail to deflate; it deflates into a DIFFERENT class, and stops being
// self-similar. Overlay the two levels and you see how far it moved.
//
// Two createPentagrid instances, which is what pair.ts already does on the
// index page: each brings its own GammaSet, so two reticula cost no new
// concept. PLAN §12.
import { createPentagrid } from "../view/pentagrid.js";
import type { PentagridHandle, View } from "../view/pentagrid.js";
import { mountFloatingReticulum } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";
import { convertView } from "../view/register.js";

const byId = (id: string) => document.getElementById(id) ?? undefined;

/**
 * The two sides, for `tools/moire.test.mjs`. The page is the only caller that
 * builds them, and the link between them — B is A deflated k times — is the
 * page's whole claim, so it wants driving from a test rather than only
 * clicking.
 */
export let sideA: PentagridHandle | null = null;
export let sideB: PentagridHandle | null = null;
const aHost = byId("moire-a");
const bHost = byId("moire-b");
const bar = byId("moire-bar");
const grid = byId("moire-grid");

/** The rows a side keeps. Everything else is behind the reticulum and settings. */
const ROWS = ["View", "Pentagrid", "Penrose", "edge style", "vertex style"];

/** Σγ mod 1 — the LI class, and the only thing about γ this page is about. */
function liClass(h: PentagridHandle): number {
    const s = h.gamma.values().reduce((a, b) => a + b, 0);
    return s - Math.floor(s);
}

/** A class as a fraction when it is one, to five places otherwise. */
function sayClass(s: number): string {
    if (s < 5e-6 || s > 1 - 5e-6) return "0 · Penrose";
    for (const d of [2, 3, 4, 5, 8, 10, 16, 20, 25, 40, 50, 80, 100]) {
        for (let k = 1; k < d; k++) {
            if (Math.abs(s - k / d) < 5e-6) return `${k}/${d}`;
        }
    }
    return s.toFixed(5);
}

if (aHost && bHost && bar && grid) {
    // Regular, spread, Σγ = 0: Penrose, and NOT the uniform family. An evenly
    // spread class is the singular one — γ = (0,0,0,0,0) is every family's
    // line 0 through the origin — and it is no way to meet a class. PLAN
    // §12.1b-i, which is the mistake that cost a measurement.
    const START = [0.0817, 0.3391, -0.2234, 0.1109, -0.3083];

    let a: PentagridHandle;
    let b: PentagridHandle;

    const lam = (h: PentagridHandle) => h.gamma.model.lambda ?? 1;

    // A view is in TILING units and a tiling unit is λ world units, so two
    // sides at different generations do not share view numbers. What they
    // share is the world: the invariants are scale/λ and λ·view, which the
    // view code already uses when λ changes under it. Convert, or B drifts off
    // by a factor of φ per deflation.
    const relay = (to: () => PentagridHandle, from: () => PentagridHandle) => (v: View) => {
        to().setView(convertView(v, lam(from()), lam(to())));
    };

    const make = (host: HTMLElement, panel: HTMLElement | undefined, session: string,
                  other: () => PentagridHandle, self: () => PentagridHandle) =>
        createPentagrid({
            session,
            container: host,
            panel,
            gamma: START,
            features: {
                gridLines: false, axes: false, center: true,
                penroseTiles: true, penroseEdges: true,
            },
            onViewChange: relay(other, self),
        });

    a = make(aHost, byId("moire-a-panel"), "moire-a", () => b, () => a);
    b = make(bHost, byId("moire-b-panel"), "moire-b", () => a, () => b);
    a.exposeRows(ROWS);
    b.exposeRows(ROWS);
    sideA = a;
    sideB = b;

    // ── The bar: link, how many deflations, merge ─────────────────────
    const label = (text: string) => {
        const l = document.createElement("label");
        l.className = "moire-opt";
        l.appendChild(document.createTextNode(text));
        return l;
    };
    const linkBox = document.createElement("input");
    linkBox.type = "checkbox";
    linkBox.className = "moire-link";
    linkBox.checked = true;
    const linkLabel = label(" link");
    linkLabel.title = "Hold B at A deflated, so changing A's γ — by the reticulum, a "
        + "preset, or the sum — carries B with it. Off, the two are independent "
        + "pentagrids and the page is a general comparator.";
    linkLabel.prepend(linkBox);

    const steps = document.createElement("input");
    steps.type = "number";
    steps.min = "-3";
    steps.max = "3";
    steps.step = "1";
    steps.value = "1";
    steps.className = "moire-steps";
    const stepLabel = label("B = ");
    stepLabel.title = "How many times B is deflated relative to A. Negative inflates "
        + "instead. Each deflation multiplies the LI class by −2 and divides the "
        + "tiling's scale by φ.";
    stepLabel.appendChild(steps);
    stepLabel.appendChild(document.createTextNode(" × deflate(A)"));

    const mergeBox = document.createElement("input");
    mergeBox.type = "checkbox";
    mergeBox.className = "moire-merge";
    const mergeLabel = label(" merge");
    mergeLabel.title = "Stack the two canvases into one of method's size and multiply "
        + "them together. This is where the moiré is.";
    mergeLabel.prepend(mergeBox);

    const note = document.createElement("span");
    note.className = "moire-note";

    bar.append(linkLabel, stepLabel, mergeLabel, note);

    // ── Linking ───────────────────────────────────────────────────────
    //
    // B is rebuilt from A rather than nudged: set it to A's offsets and then
    // deflate it however many steps. One direction only — B never writes back
    // — so there is no loop to break, only a guard against hearing our own
    // write while we are making it.
    let syncing = false;
    const syncB = () => {
        if (!linkBox.checked || syncing) return;
        syncing = true;
        const k = Math.round(Number(steps.value) || 0);
        b.gamma.setLocked(-1);
        b.gamma.setGeneration(a.gamma.getGeneration());
        b.gamma.setValues(a.gamma.values());
        for (let i = 0; i < Math.abs(k); i++) {
            if (k > 0) b.gamma.deflate(); else b.gamma.inflate();
        }
        syncing = false;
        // λ moved under B, so the two no longer agree on view numbers.
        relay(() => b, () => a)(a.getView());
        say();
    };

    const say = () => {
        const sa = liClass(a), sb = liClass(b);
        const cap = (id: string, name: string, h: PentagridHandle, s: number) => {
            const el = byId(id);
            if (!el) return;
            const m = h.gamma.getGeneration();
            el.textContent = `${name} — class ${sayClass(s)}`
                + (m ? `, λ = φ${m > 0 ? "" : "⁻"}${"¹²³⁴⁵⁶⁷⁸⁹"[Math.abs(m) - 1] ?? Math.abs(m)}` : "");
        };
        cap("moire-a-caption", "A", a, sa);
        cap("moire-b-caption", "B", b, sb);
        // What the next deflation would do to A's class, which is the whole
        // arithmetic of the page in one line.
        const next = (-2 * sa) - Math.floor(-2 * sa);
        note.textContent = `deflate A again → class ${sayClass(next)}`;
    };

    a.gamma.onChange(() => { syncB(); say(); });
    b.gamma.onChange(say);
    linkBox.addEventListener("change", () => { syncB(); say(); });
    steps.addEventListener("change", syncB);

    // ── Merge ─────────────────────────────────────────────────────────
    //
    // No rebuild: createPentagrid installs a ResizeObserver whenever the canvas
    // size is not explicit, so moving the viewports into one cell with CSS is
    // enough — both re-measure and redraw on their own.
    mergeBox.addEventListener("change", () => {
        grid.classList.toggle("merged", mergeBox.checked);
        // The stack only means anything in register.
        if (mergeBox.checked) relay(() => b, () => a)(a.getView());
    });

    // ── Two reticula, named apart ─────────────────────────────────────
    //
    // The floating panel's id is also the key its position is remembered
    // under, so two unnamed ones would claim the same spot and the same id.
    mountFloatingReticulum(a.gamma, {
        colors: FAMILY_COLORS, id: "moire-a", title: "A · γ",
        reopenLabel: "show A's γ",
        buttons: a.panelRow("View") ?? document.body,
    });
    mountFloatingReticulum(b.gamma, {
        colors: FAMILY_COLORS, id: "moire-b", title: "B · γ",
        reopenLabel: "show B's γ",
        buttons: b.panelRow("View") ?? document.body,
    });

    syncB();
    say();
}
