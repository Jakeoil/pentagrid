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

    // Declared first so each side's relay can reach the other. Unlike pair.ts,
    // which says "they are only ever called after both exist", here they are
    // NOT: a page with a stored session restores γ during construction, and
    // `setGeneration` notifies the view from inside `createPentagrid`. So A's
    // relay fires while B is still undefined. It threw, which killed the
    // module before the bar and the reticula were built — the page came up
    // with no controls at all, and only for someone who had visited before.
    let a: PentagridHandle | null = null;
    let b: PentagridHandle | null = null;

    const lam = (h: PentagridHandle) => h.gamma.model.lambda ?? 1;

    // A view is in TILING units and a tiling unit is λ world units, so two
    // sides at different generations do not share view numbers. What they
    // share is the world: the invariants are scale/λ and λ·view, which the
    // view code already uses when λ changes under it. Convert, or B drifts off
    // by a factor of φ per deflation.
    const relay = (to: () => PentagridHandle | null, from: () => PentagridHandle | null) =>
        (v: View) => {
            const t = to(), f = from();
            if (!t || !f) return;            // mid-construction: nothing to be in register with
            t.setView(convertView(v, lam(f), lam(t)));
        };

    const make = (host: HTMLElement, panel: HTMLElement | undefined, session: string,
                  other: () => PentagridHandle | null, self: () => PentagridHandle | null) =>
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

    const A = make(aHost, byId("moire-a-panel"), "moire-a", () => b, () => a);
    a = A;
    const B = make(bHost, byId("moire-b-panel"), "moire-b", () => a, () => b);
    b = B;
    A.exposeRows(ROWS);
    B.exposeRows(ROWS);
    sideA = A;
    sideB = B;
    // Whatever the two restored separately, they are in register from here.
    relay(() => b, () => a)(A.getView());

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

    // Jake: "I lost the reticulae. Maybe a reset button." Nothing ON a panel
    // can rescue it — the thing you would press is the thing that is lost —
    // so the rescue sits out here, and puts both back open, uncollapsed, and
    // at the places they started.
    const findRet = document.createElement("button");
    findRet.type = "button";
    findRet.className = "moire-find";
    findRet.textContent = "reset γ panels";
    findRet.title = "Put both reticula back where they started, open and in view — "
        + "for when one has been dragged behind the other, off the edge, or into a "
        + "corner of a window that is now a different size.";

    const note = document.createElement("span");
    note.className = "moire-note";

    bar.append(linkLabel, stepLabel, mergeLabel, findRet, note);

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
        if (!a || !b) return;
        b.gamma.setLocked(-1);
        b.gamma.setGeneration(a.gamma.getGeneration());
        b.gamma.setValues(a.gamma.values());
        for (let i = 0; i < Math.abs(k); i++) {
            if (k > 0) b.gamma.deflate(); else b.gamma.inflate();
        }
        syncing = false;
        // λ moved under B, so the two no longer agree on view numbers.
        relay(() => b, () => a)(A.getView());
        say();
    };

    const say = () => {
        if (!a || !b) return;
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

    A.gamma.onChange(() => { syncB(); say(); });
    B.gamma.onChange(() => {
        if (syncing) return;
        // Linked means B IS A deflated, so anything that writes to B directly
        // — its own reticulum, a preset, the panel's `reset page` — is put
        // back. Without this, resetting B left it at generation 0 with
        // nothing to restore the link: syncB only ran from A's changes, the
        // link box and the step count, so the page looked permanently broken.
        // Jake: "when I reset, I couldn't get it back."
        if (linkBox.checked) { syncB(); return; }
        say();
    });
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
        if (mergeBox.checked) relay(() => b, () => a)(A.getView());
    });

    // ── Two reticula, named apart and placed apart ────────────────────
    //
    // The floating panel's id is also the key its position is remembered
    // under, so two unnamed ones would claim the same spot and the same id.
    // And a panel with nothing stored opens at a FIXED default — the top
    // right — so two of them land exactly on top of each other and the one
    // underneath is simply gone. Jake: "I lost the reticulae." They get a
    // side each.
    const W = globalThis.innerWidth || 1200;
    const aRet = mountFloatingReticulum(a.gamma, {
        colors: FAMILY_COLORS, id: "moire-a", title: "A · γ",
        reopenLabel: "show A's γ",
        x: Math.max(12, Math.round(W * 0.5) - 320), y: 96,
        buttons: A.panelRow("View") ?? document.body,
    });
    const bRet = mountFloatingReticulum(b.gamma, {
        colors: FAMILY_COLORS, id: "moire-b", title: "B · γ",
        reopenLabel: "show B's γ",
        x: Math.max(12, Math.round(W * 0.5) + 20), y: 96,
        buttons: B.panelRow("View") ?? document.body,
    });

    findRet.addEventListener("click", () => {
        aRet.panel.resetPlace();
        bRet.panel.resetPlace();
    });

    syncB();
    say();
}
