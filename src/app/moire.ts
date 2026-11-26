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
import { addSetupButtons, mountFloatingReticulum } from "../view/controls.js";
import { FAMILY_COLORS } from "../view/growth.js";
import { convertView } from "../view/register.js";
import { BUILD_ID } from "../build-id.js";

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
const ROWS = [
    "View", "Pentagrid", "Penrose", "system", "face shade",
    "edge style", "vertex style",
    // The dressing folds. They were left out at first and so never showed:
    // they are one line each while shut and flow together onto one, so they
    // cost the panel a single row and are the quickest way to tell two
    // generations apart. Jake: "I don't see the folded (collapsed?) entries
    // above the canvases." `for groups` still appears only when the system is
    // rhomb groups — that is its own condition, not this list.
    "pentaplex", "next-rhomb", "kites", "misc", "band", "for groups", "outlines",
    // `settings` carries copy setup, reset page, copy link and export svg.
    // It was trimmed away here, so each side BUILT all four and then hid them
    // — the page had none of them but the bar's own `reset page`, and asking
    // for this page as a link or a file was impossible. Jake, 2026-11-26: "I
    // would like a copy url button on all those pages." A side's buttons act
    // on that side, which is what you want when the two differ: two canvases,
    // two files, two links.
    "settings",
];

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

    /**
     * Give B the zoom range that means the same thing as A's.
     *
     * The wheel's limits are in pixels per TILING unit, and B's tiling unit
     * is λB where A's is λA, so B's range is A's scaled by the same factor
     * `convertView` uses. Without it the pair stops zooming at a different
     * place on each side, and crossing between them jumps.
     */
    const SCALE_MIN = 10, SCALE_MAX = 400;
    const pairScales = () => {
        if (!a || !b) return;
        const k = lam(b) / lam(a);
        a.setScaleRange(SCALE_MIN, SCALE_MAX);
        b.setScaleRange(SCALE_MIN * k, SCALE_MAX * k);
    };

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
    // Whatever the two restored separately, they are in register from here —
    // the same rectangle of the plane, and the same room to zoom.
    pairScales();
    relay(() => b, () => a)(A.getView());

    // ── The bar: merge, and the two ways back ─────────────────────────
    const label = (text: string) => {
        const l = document.createElement("label");
        l.className = "moire-opt";
        l.appendChild(document.createTextNode(text));
        return l;
    };
    /**
     * The merge state. It used to be a checkbox in the bar at the top of the
     * page, which meant scrolling past two panels to reach it — Jake,
     * 2026-11-26: *"All I wanted to do is not have to scroll up to the top for
     * merge split."* Two goes at moving the LINE both broke the layout, which
     * counts grid rows; this is his third answer and the right one:
     *
     * > *"on the split screen, each canvas has a heading... Put the merge
     * > button on each. Now, when they're merged, put a header on that canvas.
     * > Put a split button on that. also, on these headers, also put and
     * > export svg button, which will export it's image."*
     *
     * So the control sits ON the heading of the thing it acts on, which is
     * already in the right place and needs no geometry at all: merge on each
     * of the two, split on the composite's.
     */
    let merged = false;

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

    // The whole page back to how it arrives. The per-side `reset page` lives in
    // the settings row, which `exposeRows` trims away here, so without this
    // there is no way back at all — and two sides and two reticula is a lot of
    // state to put right by hand. Jake: "Is there a clear all button to go back
    // to page defaults."
    const resetAll = document.createElement("button");
    resetAll.type = "button";
    resetAll.className = "moire-reset";
    resetAll.textContent = "reset page";
    resetAll.title = "Everything back to the page's own setup: both tilings, both "
        + "views, the switches here, and the two reticula. This also throws away "
        + "what the page remembered of your last visit.";

    const note = document.createElement("span");
    note.className = "moire-note";

    // One line for everything that acts on BOTH sides: merge first, then the
    // two ways back, then the note.
    //
    // It STICKS to the top of the viewport — `.moire-bar`, like `.bar` on
    // every other page. Jake, 2026-11-26: "All I wanted to do is not have to
    // scroll up to the top for merge split." The line was already in the right
    // place in the reading order; what it was not was reachable, since the two
    // panels and their canvases are taller than a screen. Moving it down the
    // page was the wrong fix and broke the merged layout, which counts grid
    // rows; staying put and not scrolling away is the right one.
    bar.append(findRet, resetAll, note);

    /**
     * One header per canvas, carrying what acts on THAT canvas.
     *
     * The caption was text; it is now text plus two buttons, so the class it
     * names and the things you do to it are in one place. Merged, A's header
     * becomes the composite's — it spans both columns, says what the two are,
     * and its button says `split`.
     */
    // Kept in a Map rather than found with `querySelector`: the DOM stub hands
    // back a fresh element for every query, so a lookup would never find the
    // span it just made and the header would rebuild itself on each draw —
    // invisible in a browser, and invisible to a test for the opposite reason.
    const heads = new Map<string, { el: HTMLElement; text: HTMLElement }>();
    const headerOf = (id: string) => {
        const had = heads.get(id);
        if (had) return had;
        const el = byId(id);
        if (!el) return null;
        el.textContent = "";
        el.className = "moire-head";
        const text = document.createElement("span");
        text.className = "cap-text";
        el.appendChild(text);
        const made = { el, text };
        heads.set(id, made);
        return made;
    };
    const headButton = (id: string, cls: string, onClick: () => void) => {
        const h = headerOf(id);
        if (!h) return null;
        const b = document.createElement("button");
        b.type = "button";
        b.className = `head-btn ${cls}`;
        b.addEventListener("click", onClick);
        h.el.appendChild(b);
        return b;
    };

    const say = () => {
        if (!a || !b) return;
        const sa = liClass(a), sb = liClass(b);
        const cap = (id: string, name: string, h: PentagridHandle, s: number) => {
            const head = headerOf(id);
            if (!head) return;
            const el = head.text;
            // λ is the generation AND the normalization — it used to report the
            // generation alone, so a side scaled by n said nothing about it and
            // the shrink from the inflation looked like n's doing. Shown as
            // both parts when n is pulling, the way the reticulum does it, so
            // it is clear which is which. Jake: "n = phi: 0 actually shrinks
            // them. Shouldn't it be phi^0 = 1 for same size?" — it is; what
            // shrank B was the inflation, which is now its own ℐ box.
            const m = h.gamma.getGeneration(), q = h.gamma.getNormalization();
            const sup = (k: number) => (k < 0 ? "⁻" : "")
                + String(Math.abs(k)).split("")
                    .map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]).join("");
            const lam = q !== 0 ? `, λ = φ${sup(m)}·φ${sup(q)} = φ${sup(m + q)}`
                      : m !== 0 ? `, λ = φ${sup(m)}` : "";
            el.textContent = `${name} — class ${sayClass(s)}${lam}`;
        };
        if (merged) {
            // One header for one picture: what the composite IS, which is the
            // two classes multiplied together on the page.
            const head = headerOf("moire-a-caption");
            if (head) {
                head.text.textContent =
                    `A × B — class ${sayClass(sa)} over class ${sayClass(sb)}`;
            }
        } else {
            cap("moire-a-caption", "A", a, sa);
        }
        cap("moire-b-caption", "B", b, sb);
        for (const t of toggles) {
            t.textContent = merged ? "split" : "merge";
            t.title = merged
                ? "Unstack them: two canvases side by side again, each with its "
                + "own header."
                : "Stack the two canvases into one of method's size and multiply "
                + "them together. This is where the moiré is.";
        }
        // What the next deflation would do to A's class, which is the whole
        // arithmetic of the page in one line.
        const next = (-2 * sa) - Math.floor(-2 * sa);
        note.textContent = `deflate A again → class ${sayClass(next)}`;
    };

    // Each side owns itself: a change to either one only re-reads the caption.
    // Nothing is put back, because nothing is held — which is the whole of
    // what retiring the link means.
    /**
     * The headers' own buttons.
     *
     * Two per canvas: the merge/split toggle, whose word is whichever state
     * you are not in, and an export that writes THAT picture. Merged, B's
     * header is hidden by the stylesheet and A's is the composite's, so the
     * toggle you can see always belongs to what is on screen.
     */
    const toggles: HTMLButtonElement[] = [];
    for (const id of ["moire-a-caption", "moire-b-caption"]) {
        const t = headButton(id, "head-merge", () => setMerged(!merged));
        if (t) toggles.push(t);
    }

    /**
     * One SVG of the composite: A's document with B's layers laid into it,
     * multiplied.
     *
     * The two canvases are the same size and in register — that is the page's
     * whole invariant — so their documents share a frame and B's groups can be
     * dropped into A's between the same coordinates. `mix-blend-mode` on the
     * group is what the screen is already doing to the pixels.
     */
    const compositeSvg = (): { id: string; svg: string }[] => {
        if (!a || !b) return [];
        const fa = a.svg()[0], fb = b.svg()[0];
        if (!fa || !fb) return [];
        const inner = fb.svg.slice(fb.svg.indexOf(">") + 1, fb.svg.lastIndexOf("</svg>"));
        const at = fa.svg.lastIndexOf("</svg>");
        return [{
            id: "merged",
            svg: `${fa.svg.slice(0, at)}  <g style="mix-blend-mode: multiply">`
                + `${inner}</g>\n${fa.svg.slice(at)}`,
        }];
    };

    for (const [id, side] of [["moire-a-caption", () => a], ["moire-b-caption", () => b]] as const) {
        const h = headerOf(id);
        if (!h) continue;
        addSetupButtons(h.el, {
            svg: () => (merged ? compositeSvg() : (side()?.svg() ?? [])),
        }, ["svg"]);
    }

    A.gamma.onChange(say);
    B.gamma.onChange(say);

    // ── Merge ─────────────────────────────────────────────────────────
    //
    // No rebuild: createPentagrid installs a ResizeObserver whenever the canvas
    // size is not explicit, so moving the viewports into one cell with CSS is
    // enough — both re-measure and redraw on their own.
    const setMerged = (on: boolean) => {
        merged = on;
        grid.classList.toggle("merged", on);
        // The stack only means anything in register.
        if (on) relay(() => b, () => a)(A.getView());
        say();
    };

    // ── The two panels, laid out the same ─────────────────────────────
    //
    // Each side has the same five folded rows, and they open independently —
    // so one panel grows a line while the other does not, every row below it
    // shifts on one side only, and the canvas under it drops. The two stop
    // corresponding, which on a page whose whole point is comparing them is
    // the wrong way round. Jake: "Try to keep the window containers the same
    // height when they uncollapse like in split. [...] Put them in the same
    // relative positions."
    //
    // So a fold opens on both sides or neither. Same rows, same heights, every
    // control in the same place, and the two canvases stay level.
    const foldsOf = (panel: HTMLElement | undefined): Map<string, HTMLDetailsElement> => {
        const out = new Map<string, HTMLDetailsElement>();
        if (!panel) return out;
        const walk = (el: Element, row: string | null) => {
            const name = (el as HTMLElement).dataset?.row || row;
            if (el.tagName?.toLowerCase() === "details" && name && !out.has(name)) {
                out.set(name, el as HTMLDetailsElement);
            }
            for (const kid of Array.from(el.children ?? [])) walk(kid, name);
        };
        walk(panel, null);
        return out;
    };
    const fa = foldsOf(byId("moire-a-panel"));
    const fb = foldsOf(byId("moire-b-panel"));
    for (const [name, da] of fa) {
        const db = fb.get(name);
        if (!db) continue;
        // No re-entry guard needed: each side only writes when the two
        // DISAGREE, so the echo finds them equal and stops. Which matters,
        // because a browser fires `toggle` after the fact rather than during
        // the assignment, and a synchronous flag would already be down.
        const mirror = (from: HTMLDetailsElement, to: HTMLDetailsElement) => () => {
            if (to.open !== from.open) to.open = from.open;
        };
        da.addEventListener("toggle", mirror(da, db));
        db.addEventListener("toggle", mirror(db, da));
    }

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
        reopenLabel: "show A's γ", presetPrefix: "A · ",
        x: Math.max(12, Math.round(W * 0.5) - 320), y: 96,
        buttons: A.panelRow("View") ?? document.body,
    });
    const bRet = mountFloatingReticulum(b.gamma, {
        colors: FAMILY_COLORS, id: "moire-b", title: "B · γ",
        reopenLabel: "show B's γ", presetPrefix: "B · ",
        x: Math.max(12, Math.round(W * 0.5) + 20), y: 96,
        buttons: B.panelRow("View") ?? document.body,
    });

    findRet.addEventListener("click", () => {
        aRet.panel.resetPlace();
        bRet.panel.resetPlace();
    });

    resetAll.addEventListener("click", () => {
        setMerged(false);
        A.reset();
        B.reset();
        aRet.panel.resetPlace();
        bRet.panel.resetPlace();
        // Both sides reset to the same page defaults, so the pair arrives in
        // register — and `reset` throws the session away, which is the only
        // way back from two sides wandered apart.
        pairScales();
        relay(() => b, () => a)(A.getView());
        say();
    });

    // The stamp, under the canvases. Only roof carried one; method gets its
    // tag from the narrative step bar, which this page has no reason to have.
    // Jake: "I can't see a buildid on the page."
    const stamp = byId("moire-buildid");
    if (stamp) stamp.textContent = `build id ${BUILD_ID}`;

    say();
}
