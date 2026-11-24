// The Pentadiculum, driven from a consumer's position.
//
// The point of the extraction is that the instrument works on a page that has
// never heard of `by-your-bootstraps`, so this file imports it the way such a
// page would -- through `lib/pentadiculum.js`, against a stub DOM, with nothing
// of this project's own pages in the frame. If it needs `boot-input` or a
// module-level `let`, these tests cannot pass.
//
// The stub is deliberately small and local: a canvas that records what it is
// told to draw, and elements that remember their handlers. Recording the calls
// is what lets a test ask "did the arrowheads get drawn" without a browser.

import test from "node:test";
import assert from "node:assert/strict";

import {
    PD_ORIGIN, SNAPS, centerMoves, createPentadiculum, gridBoxes,
    mountFloatingPentadiculum, mountPentadiculum, setBox, snapForSeed,
    snapStep, snapped,
} from "../lib/pentadiculum.js";
import {
    EDGE_INK, GRID_FIFTHS, GRID_LEVELS, GRID_OVER, GRID_OVER_ALPHA,
    GRID_OVER_FIFTHS,
} from "../lib/pentadiculum.js";
import { EVEN_PENTAD, PENTA_UP, centroidOf, integralCentroid } from "../lib/wheels.js";

// ── the stub ──────────────────────────────────────────────────────────────

const SIZE = 340;

/** A canvas context that records every call and every property set. */
function recorder() {
    const log = [];
    const ctx = new Proxy({}, {
        get(_, k) {
            if (k === "measureText") return (s) => ({ width: 6 * String(s).length });
            if (k === "canvas") return undefined;
            if (typeof k === "string" && /^(fill|stroke)Style$|^(lineWidth|font|globalAlpha|textAlign|textBaseline|lineJoin)$/.test(k))
                return "";
            return (...a) => { log.push(`${String(k)}(${a.join(",")})`); };
        },
        set(_, k, v) { log.push(`${String(k)}=${v}`); return true; },
    });
    return { ctx, log };
}

function element(tag = "div") {
    const handlers = {};
    const node = {
        tagName: tag.toUpperCase(), className: "", id: "", value: "", checked: false,
        disabled: false,
        textContent: "", innerHTML: "", type: "", style: {}, children: [],
        width: SIZE, height: SIZE, offsetLeft: 0, offsetTop: 0,
        appendChild(c) { node.children.push(c); return c; },
        append(...cs) { node.children.push(...cs); },
        remove() {},
        addEventListener(t, f) { (handlers[t] ||= []).push(f); },
        removeEventListener(t, f) {
            handlers[t] = (handlers[t] || []).filter((g) => g !== f);
        },
        setPointerCapture() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: SIZE, height: SIZE }),
        // test handles
        fire(t, ev = {}) {
            (handlers[t] || []).forEach((f) =>
                f({ preventDefault() {}, pointerId: 1, ...ev }));
        },
        listens: (t) => (handlers[t] || []).length,
        /** Every descendant, flattened, so a test can find a control by tag. */
        all() {
            return node.children.flatMap((c) => [c, ...(c.all ? c.all() : [])]);
        },
    };
    return node;
}

/** A canvas element whose context records. */
function canvasStub() {
    const node = element("canvas");
    const { ctx, log } = recorder();
    node.getContext = () => ctx;
    node.log = log;
    return node;
}

function stubDocument() {
    const body = element("body");
    return {
        body,
        createElement: (tag) => (tag === "canvas" ? canvasStub() : element(tag)),
        createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    };
}

/** The lattice coordinate `at` as a client position, at a given cell size. */
const client = (at, cell) => ({ clientX: SIZE / 2 + at[0] * cell, clientY: SIZE / 2 + at[1] * cell });

const SEED = { points: PENTA_UP.map((p) => [p[0], p[1]]), origin: [0, 0] };
const copy = (s) => ({ points: s.points.map((p) => [p[0], p[1]]), origin: [...s.origin] });

// ── the view ──────────────────────────────────────────────────────────────

test("it draws a seed it is handed, and reports what that took", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    const drawn = pd.sync(copy(SEED), { extrapolate: 0 });

    assert.equal(drawn.verdict.ok, true, drawn.verdict.why);
    assert.equal(drawn.shown.length, 5, "the figure at the base rung is the five");
    assert.ok(drawn.cell > 0 && drawn.cell <= 78, `cell ${drawn.cell}`);
    // the fence is a convex polygon of at most five sides -- see src/math/seed.js
    assert.ok(drawn.fence.length >= 3 && drawn.fence.length <= 5,
        `fence has ${drawn.fence.length} sides`);
    // and it actually drew: paper, the figure, the handles
    assert.ok(canvas.log.includes("clearRect(0,0,340,340)"));
    assert.ok(canvas.log.filter((l) => l.startsWith("arc(")).length >= 6,
        "five handles and the origin");
    assert.ok(canvas.log.some((l) => l === "fillText(0,170.5,170.5)")
        || canvas.log.some((l) => l.startsWith("fillText(0,")), "handles are numbered");
});

test("it holds no seed of its own: two of them on one page do not interfere", () => {
    // The whole reason for the extraction. A moire page wants four.
    const doc = stubDocument();
    const a = createPentadiculum({ canvas: canvasStub(), document: doc });
    const b = createPentadiculum({ canvas: canvasStub(), document: doc });
    const moved = { points: SEED.points.map((p) => [p[0], p[1]]), origin: [0, 1] };
    a.sync(copy(SEED));
    b.sync(moved);
    assert.deepEqual(a.seed().origin, [0, 0]);
    assert.deepEqual(b.seed().origin, [0, 1]);
    // and each drew its own figure at its own origin
    assert.notDeepEqual(a.drawn().shown, b.drawn().shown);
});

test("an illegal origin is reported, not drawn as though it were fine", () => {
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const drawn = pd.sync({ points: SEED.points.map((p) => [p[0], p[1]]), origin: [9, 9] });
    assert.equal(drawn.verdict.ok, false);
    assert.match(drawn.verdict.why, /points \d and \d/);
});

test("the affine vectors are drawn only when asked, and there are five", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });

    pd.sync(copy(SEED), { vectors: false, spokes: false, face: "none", edge: "none" });
    const without = canvas.log.filter((l) => l.startsWith("lineTo(")).length;

    canvas.log.length = 0;
    pd.sync(copy(SEED), { vectors: true });
    const texts = canvas.log.filter((l) => l.startsWith("fillText(")).length;
    const withVectors = canvas.log.filter((l) => l.startsWith("lineTo(")).length;

    assert.ok(withVectors > without, "the arrows add lines");
    // Five corner numbers plus two numerals an arrow -- and the classic seed's
    // differences are single digit integers, so one cell each.
    assert.equal(texts, 5 + 10, `drew ${texts} pieces of text`);
});

test("a drag reports the seed it would make, and changes nothing itself", () => {
    const canvas = canvasStub();
    /** @type {any[]} */
    const seen = [];
    const pd = createPentadiculum({
        canvas, document: stubDocument(),
        onChange: (seed, what) => seen.push([copy(seed), what]),
    });
    const drawn = pd.sync(copy(SEED));
    const cell = drawn.cell;

    // grab point 0, which sits at (0,3) on the classic seed, and move it right
    pd.canvas.fire("pointerdown", client(SEED.points[0], cell));
    assert.equal(pd.dragging(), 0, "point 0 is under the pointer");
    pd.canvas.fire("pointermove", client([2, 3], cell));
    pd.canvas.fire("pointerup", {});

    assert.equal(seen.length, 1, "one move, one report");
    const [seed, what] = seen[0];
    assert.equal(what, "point");
    assert.deepEqual(seed.points[0], [2, 3]);
    assert.deepEqual(seed.points[1], SEED.points[1], "the others are untouched");
    assert.equal(pd.dragging(), -1, "and it let go");
});

test("the origin wins a tie, because a small pentagon can bury it", () => {
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: (seed, what) => seen.push(what),
    });
    const { cell } = pd.sync(copy(SEED));
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    assert.equal(pd.dragging(), PD_ORIGIN);
    pd.canvas.fire("pointermove", client([0, 1], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(seen, ["origin"]);
    assert.deepEqual(pd.seed().origin, [0, 1]);
});

test("off the base rung the handles are not handles", () => {
    // An extrapolated pentagon is a VIEW of the five, not a thing to edit --
    // there would be nothing to write a drag back to.
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: () => seen.push(1),
    });
    const { cell } = pd.sync(copy(SEED), { extrapolate: 1 });
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    assert.equal(pd.dragging(), -1);
    pd.canvas.fire("pointermove", client([0, 1], cell));
    assert.deepEqual(seen, [], "nothing to report");
    // and the fence is not drawn where the origin cannot be moved
    assert.deepEqual(pd.drawn().fence, []);
});

test("snap: two settings, and each handle on its own grid", () => {
    // Jake, 2026-11-23: *in snap mode only the centroid need snap at 1/5 [...]
    // moving centroid moves 1/5, moving points moves 5/5.*
    assert.deepEqual([...SNAPS], ["units", "none"]);
    assert.equal(snapStep("units", 0), 1, "a corner moves by a whole unit");
    assert.equal(snapStep("units", PD_ORIGIN), 1 / 5, "the center by a fifth");
    assert.equal(snapStep("none", PD_ORIGIN), 1 / 256);

    assert.equal(snapped("units", 0.4, 0), 0, "a corner cannot sit on a fifth");
    assert.equal(snapped("units", 0.23, PD_ORIGIN), 0.2);
    assert.equal(snapped("units", 0.4, PD_ORIGIN), 0.4);
    assert.equal(snapped("none", 1 / 3, 0), 85 / 256);

    // and it follows a figure rather than a name: a preset that is not on the
    // lattice must not be rounded onto it by the first drag
    assert.equal(snapForSeed(SEED), "units");
    assert.equal(snapForSeed({ points: SEED.points, origin: [0, 0.2] }), "units",
        "a center on a fifth is ON the snap now");
    assert.equal(snapForSeed({ points: SEED.points, origin: [0, 0.3333] }), "none");
    assert.equal(snapForSeed({ points: SEED.points.map(([x, y]) => [x + 0.5, y]), origin: [0, 0] }),
        "none", "a corner off the lattice is not");
    // the sweet spot is on the snap, which it had better be: the `centroid`
    // button is how you get there
    assert.equal(snapForSeed({ points: SEED.points, origin: centroidOf(SEED.points) }),
        "units");
});

test("a dragged handle lands where the snap says", () => {
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: (seed) => seen.push(copy(seed)),
    });
    const { cell } = pd.sync(copy(SEED), { snap: "fifths" });
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    // a third of a cell to the right: fifths rounds it to 0.4, units would have
    // rounded it to 0
    pd.canvas.fire("pointermove", { clientX: SIZE / 2 + cell * 0.37, clientY: SIZE / 2 });
    assert.deepEqual(seen.at(-1).origin, [0.4, 0]);
});

test("it unwires itself on destroy", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    assert.ok(canvas.listens("pointerdown") > 0);
    pd.destroy();
    assert.equal(canvas.listens("pointerdown"), 0);
    assert.equal(canvas.listens("wheel"), 0);
});

// ── the mounts ────────────────────────────────────────────────────────────

test("the inline mount builds its own canvas and controls", () => {
    const doc = stubDocument();
    const host = element();
    const seen = [];
    const m = mountPentadiculum(host, { document: doc, onChange: (s) => seen.push(copy(s)) });

    assert.equal(host.children.length, 1, "one wrapper");
    const kinds = m.element.all().map((c) => c.tagName).sort();
    assert.ok(kinds.includes("CANVAS"), kinds.join(" "));
    assert.ok(kinds.filter((k) => k === "SELECT").length === 1, "preset");
    // origin, and the ladder's minus, plus and use
    assert.equal(kinds.filter((k) => k === "BUTTON").length, 4, kinds.join(" "));
    // snap, fine, actual, closest, vectors -- three sections of checkboxes
    assert.equal(kinds.filter((k) => k === "INPUT").length, 5, kinds.join(" "));
    assert.equal(seen.length, 1, "it draws and announces once on mount");
    assert.deepEqual(m.seed().origin, [0, 0]);

    // The canvas it built has a SIZE. `{ size: 340, ...options }` let a mount
    // that was given no size pass `size: undefined` through and win, which in a
    // browser is a 0x0 canvas; here it made every cell NaN. No page had met it
    // because the pages all hand in a canvas of their own.
    const made = m.element.all().find((c) => c.tagName === "CANVAS");
    assert.equal(made.width, 340, `the mount's canvas is ${made.width} wide`);
    assert.ok(m.pentadiculum.drawn().cell > 0, `cell is ${m.pentadiculum.drawn().cell}`);
});

test("the mount's centroid actual box lands on the sweet spot, and says so", () => {
    const doc = stubDocument();
    const m = mountPentadiculum(element(), { document: doc });
    const buttons = m.element.all().filter((c) => c.tagName === "BUTTON");
    const boxes = m.element.all().filter((c) => c.tagName === "INPUT");
    const [snapBox, fineBox, actual, closest] = boxes;
    const read = m.element.all().find((c) => c.className === "pentadiculum-read");
    assert.equal(m.pentadiculum.drawn().sweet, false, "not before");
    assert.doesNotMatch(read.innerHTML, /sweet spot/);
    // the classic seed starts at the origin, which IS the nearest unit to its
    // centroid (0, 0.2) -- so `closest` is where it already is, and grayed
    assert.equal(actual.disabled, false, "actual is the one to press");
    assert.equal(closest.checked, true, "and closest is already satisfied");
    assert.equal(closest.disabled, true);

    actual.checked = true;
    actual.fire("change");
    assert.deepEqual(m.seed().origin, centroidOf(SEED.points));
    assert.deepEqual(m.seed().origin, [0, 0.2], "the classic seed's centroid");
    assert.equal(m.pentadiculum.drawn().sweet, true, "and it is reported");
    assert.match(read.innerHTML, /on the sweet spot/);
    // now it is actual that is grayed, and closest that is the way back
    assert.equal(actual.checked, true);
    assert.equal(actual.disabled, true, "nowhere for a second press to go");
    assert.equal(closest.checked, false);
    assert.equal(closest.disabled, false);
    // the figure is still ON its snap, because the center moves in fifths
    assert.equal(snapBox.checked, true);
    assert.equal(m.pentadiculum.view().snap, "units");
    // and the fifths are forced up, because 0.2 is not a place the unit
    // lattice can describe
    assert.equal(fineBox.checked, true, "the fine grid came up by itself");
    assert.equal(fineBox.disabled, true, "and cannot be turned off from there");
    // and `origin` puts it back
    buttons.find((b) => b.textContent === "origin").fire("click");
    assert.deepEqual(m.seed().origin, [0, 0]);
    assert.equal(m.pentadiculum.drawn().sweet, false);
    assert.equal(fineBox.checked, false, "and the fifths go back down");
    assert.equal(fineBox.disabled, false);
});

test("the mount's closest box puts the center on the nearest unit", () => {
    const m = mountPentadiculum(element(), { document: stubDocument() });
    const boxes = m.element.all().filter((c) => c.tagName === "INPUT");
    const [, fineBox, actual, closest] = boxes;

    // go to the centroid first, which is where closest has something to do
    actual.checked = true;
    actual.fire("change");
    assert.deepEqual(m.seed().origin, [0, 0.2]);
    assert.equal(fineBox.checked, true);

    closest.checked = true;
    closest.fire("change");
    assert.deepEqual(m.seed().origin, [0, 0], "rounded to the lattice");
    assert.equal(m.pentadiculum.drawn().sweet, false, "no longer exact");
    // Jake: *Fine checkbox will be reset.*
    assert.equal(fineBox.checked, false);
    assert.equal(fineBox.disabled, false);
    assert.equal(m.pentadiculum.view().fifths, false, "the setting too, not just the box");
});

test("the mount's preset picker loads a preset, origin and all", () => {
    const m = mountPentadiculum(element(), { document: stubDocument() });
    const presetPick = m.element.all().filter((c) => c.tagName === "SELECT")[0];
    const names = presetPick.children.map((o) => o.value);
    assert.deepEqual(names, ["quadrille", "asymmetric", "even", "real"]);
    // the label, not the key: Jake calls the quadrille "classic"
    assert.equal(presetPick.children[0].textContent, "classic");

    m.set({ points: SEED.points, origin: [0, 1] });
    presetPick.value = "real";
    presetPick.fire("change");
    assert.deepEqual(m.seed().origin, [0, 0], "a preset is five vectors FROM the origin");
    // and snap comes off, because the real pentagon is irrational
    assert.equal(m.pentadiculum.view().snap, "none");
});

/** The floating panel's parts, by the order it builds them. */
function panelParts(m) {
    const bar = m.panel.children[0];
    const [title, extras, fold, shut] = bar.children;
    return { bar, title, extras, fold, shut,
             body: m.panel.children[1], grip: m.panel.children[2] };
}

/** A localStorage that lives in the test, so the panel can be asked to
 *  remember without a browser. Returns a restore function. */
function withStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    const before = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
    };
    return { store, restore: () => { globalThis.localStorage = before; } };
}

test("the floating mount is a panel on the body, dragged by its bar", () => {
    const doc = stubDocument();
    const m = mountFloatingPentadiculum({ document: doc, title: "seed", at: [40, 60] });
    assert.equal(doc.body.children.length, 1);
    assert.equal(m.panel.style.left, "40px");
    assert.equal(m.panel.style.width, "372px", "the Reticulum's width");

    const { bar, fold, shut } = panelParts(m);
    bar.fire("pointerdown", { clientX: 50, clientY: 70, target: bar });
    bar.fire("pointermove", { clientX: 90, clientY: 130 });
    assert.equal(m.panel.style.left, "80px", "it followed the pointer");
    assert.equal(m.panel.style.top, "120px");
    bar.fire("pointerup", {});
    bar.fire("pointermove", { clientX: 200, clientY: 200 });
    assert.equal(m.panel.style.left, "80px", "and stopped when it was let go");
    assert.deepEqual(m.at(), [80, 120]);

    // a press on a BUTTON in the bar is not a drag
    bar.fire("pointerdown", { clientX: 300, clientY: 70, target: fold });
    bar.fire("pointermove", { clientX: 400, clientY: 200 });
    assert.equal(m.panel.style.left, "80px", "the fold button is not a handle");

    // the shut button hides it rather than destroying it
    shut.fire("click");
    assert.equal(m.panel.hidden, true);
    assert.equal(m.isOpen(), false);
    m.toggle();
    assert.equal(m.panel.hidden, false);
    assert.equal(m.isOpen(), true);
});

test("the panel's bar names the SEED, and says more when it is folded", () => {
    // Jake, 2026-11-24: *preset name in the header.* Folding the panel to its
    // bar should not cost you the two things the readout was telling you.
    const doc = stubDocument();
    const m = mountFloatingPentadiculum({ document: doc, title: "pentadiculum" });
    const { title, fold, body, grip } = panelParts(m);
    assert.match(title.textContent, /^pentadiculum — classic$/);

    // move it off the preset and the bar says so
    m.set({ points: [[3, 2], [0, 2], [-3, 2], [-2, -3], [2, -3]], origin: [0, 0] });
    assert.match(title.textContent, /— even$/, title.textContent);
    m.set({ points: [[4, 1], [0, 2], [-3, 2], [-2, -3], [2, -3]], origin: [0, 0] });
    assert.match(title.textContent, /— custom$/, title.textContent);

    // folded, it carries the origin too, and the sweet spot when it is on it
    m.set({ points: PENTA_UP.map((p) => [...p]), origin: [0, 0] });
    m.collapse(true);
    assert.equal(m.isCollapsed(), true);
    assert.equal(body.style.display, "none", "the body folds away");
    assert.equal(grip.style.display, "none", "and so does the grip");
    assert.match(title.textContent, /classic\s+\(0, 0\)$/, title.textContent);
    assert.doesNotMatch(title.textContent, /sweet/);

    m.set({ points: PENTA_UP.map((p) => [...p]), origin: centroidOf(PENTA_UP) });
    assert.match(title.textContent, /\(0, 0\.2\) · sweet$/, title.textContent);

    // and the fold button is the way back
    fold.fire("click");
    assert.equal(m.isCollapsed(), false);
    assert.equal(body.style.display, "");
    assert.doesNotMatch(title.textContent, /sweet/, "unfolded, the readout says it");
});

test("the grip resizes the canvas, not just the box", () => {
    const doc = stubDocument();
    const m = mountFloatingPentadiculum({ document: doc });
    const { grip } = panelParts(m);
    const canvas = m.pentadiculum.canvas;
    const was = canvas.width;

    grip.fire("pointerdown", { clientX: 372 });
    grip.fire("pointermove", { clientX: 500 });
    assert.equal(m.width(), 500);
    assert.equal(m.panel.style.width, "500px");
    assert.ok(canvas.width > was, `the figure grew with it: ${was} -> ${canvas.width}`);
    assert.equal(canvas.width, canvas.height, "and stayed square");
    grip.fire("pointerup", {});

    // and it will not go narrower than a control row can be read at
    grip.fire("pointerdown", { clientX: 500 });
    grip.fire("pointermove", { clientX: 40 });
    assert.equal(m.width(), 300, "clamped to the minimum");
    grip.fire("pointerup", {});
});

test("the panel remembers where it was, and resetPlace is the rescue", () => {
    const { store, restore } = withStorage();
    try {
        const one = mountFloatingPentadiculum({
            document: stubDocument(), id: "rig", at: [24, 24],
        });
        const { bar } = panelParts(one);
        bar.fire("pointerdown", { clientX: 30, clientY: 30, target: bar });
        bar.fire("pointermove", { clientX: 230, clientY: 180 });
        bar.fire("pointerup", {});
        assert.deepEqual(one.at(), [224, 174]);
        assert.ok(store.has("pentadiculum:panel:rig"), [...store.keys()].join());

        // a second panel with the same id comes up where the first was left
        const two = mountFloatingPentadiculum({
            document: stubDocument(), id: "rig", at: [24, 24],
        });
        assert.deepEqual(two.at(), [224, 174], "it remembered");

        // and one with another id does not
        const other = mountFloatingPentadiculum({
            document: stubDocument(), id: "moire", at: [24, 24],
        });
        assert.deepEqual(other.at(), [24, 24], "a different panel, a different place");

        // the rescue: back to the default, open, unfolded, and forgotten
        two.collapse(true);
        two.hide();
        two.resetPlace();
        assert.deepEqual(two.at(), [24, 24]);
        assert.equal(two.isCollapsed(), false);
        assert.equal(two.isOpen(), true);
        assert.equal(store.has("pentadiculum:panel:rig"), false, "and forgotten");
    } finally { restore(); }
});

test("the panel keeps enough bar on screen to be grabbed again", () => {
    // A panel dragged off the edge, or a window since made narrow, cannot be
    // recovered by anything ON the panel -- so the clamp runs on every move.
    const m = mountFloatingPentadiculum({ document: stubDocument(), at: [24, 24] });
    const { bar } = panelParts(m);
    bar.fire("pointerdown", { clientX: 30, clientY: 30, target: bar });
    bar.fire("pointermove", { clientX: 9000, clientY: 9000 });
    const [x, y] = m.at();
    // the viewport is the 1200x800 fallback, since Node has no window
    assert.ok(x <= 1200 - 56, `x is ${x}`);
    assert.ok(y <= 800 - 28, `y is ${y}`);

    bar.fire("pointermove", { clientX: -9000, clientY: -9000 });
    const [x2, y2] = m.at();
    assert.ok(x2 + m.width() >= 56, `x is ${x2} at width ${m.width()}`);
    assert.ok(y2 >= 0, `y is ${y2}`);
});

test("the panel's barExtras is a slot, empty until a page fills it", () => {
    const doc = stubDocument();
    const m = mountFloatingPentadiculum({ document: doc });
    const { extras } = panelParts(m);
    assert.equal(extras.className, "pentadiculum-extras");
    assert.equal(extras.children.length, 0, "nothing in it, nothing there");
    const btn = doc.createElement("button");
    m.barExtras.appendChild(btn);
    assert.equal(extras.children.length, 1);
});

test("closing the panel tells the page, so a reopen button can come back", () => {
    let closed = 0;
    const m = mountFloatingPentadiculum({
        document: stubDocument(), onClose: () => { closed++; },
    });
    panelParts(m).shut.fire("click");
    assert.equal(closed, 1);
    assert.equal(m.isOpen(), false, "and it hid itself either way");
});


// ── the floater ───────────────────────────────────────────────────────────
//
// Jake, 2026-11-23: *I would like to be able to assign a floater point by
// double clicking it. By default, the center is a floater. But you will be able
// to fix the center by choosing another point as the floater.* The arithmetic
// is `moveHandle`, tested in `tests/seed.test.mjs`; what is checked here is the
// gesture, the refusal, and that the double-click still fits.

/** Lattice coordinates with no handle within the 2.5-unit grab radius. */
const EMPTY = [0, 6];

test("the center floats by default, so a corner drag carries it along", () => {
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: (seed) => seen.push(copy(seed)),
    });
    assert.equal(pd.view().floater, PD_ORIGIN, "the center, as Jake asked");
    const { cell } = pd.sync(copy(SEED));

    // point 0 is at (0,-3); pull it two to the right
    pd.canvas.fire("pointerdown", client(SEED.points[0], cell));
    pd.canvas.fire("pointermove", client([2, -3], cell));
    pd.canvas.fire("pointerup", {});

    const next = seen.at(-1);
    assert.deepEqual(next.points[0], [2, -3]);
    assert.deepEqual(next.origin, [0.4, 0], "a fifth of the way after it");
    // which is the same thing as: the offset from the origin to the centroid
    // has not changed
    const c0 = centroidOf(SEED.points), c1 = centroidOf(next.points);
    assert.ok(Math.hypot(c1[0] - next.origin[0] - c0[0], c1[1] - next.origin[1] - c0[1]) < 1e-12,
        "the origin kept its place relative to the centroid");
});

test("double-clicking a handle assigns the floater, and again releases it", () => {
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const { cell } = pd.sync(copy(SEED));

    pd.canvas.fire("dblclick", client(SEED.points[2], cell));
    assert.equal(pd.view().floater, 2, "point 2 now follows the others");

    // and the center is FIXED: it will not be dragged
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    assert.equal(pd.dragging(), -1, "the center refuses the drag");
    pd.canvas.fire("pointerup", {});

    // the same double-click again declines the constraint: the reticulum's -1
    pd.canvas.fire("dblclick", client(SEED.points[2], cell));
    assert.equal(pd.view().floater, -1, "nothing floats");
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    assert.equal(pd.dragging(), PD_ORIGIN, "and the center is a handle again");
    pd.canvas.fire("pointerup", {});

    // the center can be made the floater back again, by the same gesture
    pd.canvas.fire("dblclick", client([0, 0], cell));
    assert.equal(pd.view().floater, PD_ORIGIN);
});

test("double-clicking empty paper still fits, which is what it always did", () => {
    const views = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onView: (v) => views.push({ ...v }),
    });
    pd.sync(copy(SEED));
    pd.canvas.fire("wheel", { deltaY: -200 });
    assert.ok(pd.zoom() > 1.2, `zoomed to ${pd.zoom()}`);

    // at the cell it is NOW drawing at, or the pick lands somewhere else
    pd.canvas.fire("dblclick", client(EMPTY, pd.drawn().cell));
    assert.equal(pd.zoom(), 1, "back to the fit");
    assert.equal(pd.view().floater, PD_ORIGIN, "and the floater is left alone");
    assert.deepEqual(views.at(-1), { zoom: 1, floater: PD_ORIGIN });
});

test("with a point floating, pulling a corner pins the centroid", () => {
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: (seed) => seen.push(copy(seed)),
    });
    const { cell } = pd.sync(copy(SEED));
    pd.canvas.fire("dblclick", client(SEED.points[4], cell));

    pd.canvas.fire("pointerdown", client(SEED.points[1], cell));
    pd.canvas.fire("pointermove", client([5, -1], cell));
    pd.canvas.fire("pointerup", {});

    const next = seen.at(-1);
    assert.deepEqual(next.points[1], [5, -1]);
    assert.deepEqual(next.points[4], [-5, -1], "point 4 answered with -delta");
    assert.deepEqual(next.origin, [0, 0], "the center never moved");
    const c0 = centroidOf(SEED.points), c1 = centroidOf(next.points);
    assert.ok(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) < 1e-12, `centroid moved to ${c1}`);
});

test("the cell is smooth: every scroll click changes it", () => {
    // Jake, 2026-11-23: *I want to be able to size it smoothly.* The ladder gave
    // the same cell for several clicks in a row and then jumped 1.6x.
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const cells = [pd.sync(copy(SEED)).cell];
    for (let i = 0; i < 4; i++) {
        pd.canvas.fire("wheel", { deltaY: -40 });
        cells.push(pd.drawn().cell);
    }
    assert.equal(new Set(cells).size, cells.length, `cells were ${cells}`);
    for (let i = 1; i < cells.length; i++)
        assert.ok(cells[i] > cells[i - 1], `cell ${i} went ${cells[i - 1]} -> ${cells[i]}`);
    // and no rung of any ladder: a cell that is not an integer is the proof
    assert.ok(cells.some((k) => !Number.isInteger(k)), `all of ${cells} are integers`);
});

test("the mount's readout names the floater, because it moves what you did not", () => {
    const doc = stubDocument();
    const m = mountPentadiculum(element(), { document: doc });
    const read = m.element.all().find((c) => c.className === "pentadiculum-read");
    assert.ok(read, "the readout is there");
    assert.match(read.innerHTML, /the center floats/);

    const canvas = m.element.all().find((c) => c.tagName === "CANVAS");
    const cell = m.pentadiculum.drawn().cell;
    canvas.fire("dblclick", client(SEED.points[3], cell));
    assert.match(read.innerHTML, /point 3 floats/);
    assert.match(read.innerHTML, /the center is fixed/);

    canvas.fire("dblclick", client(SEED.points[3], cell));
    assert.match(read.innerHTML, /nothing floats/);
});

// ── one snap, two step sizes, and the paper that shows them ──────────────
//
// Jake, 2026-11-23: *in snap mode only the centroid need snap at 1/5. Divide
// unit square with 5 lighter lines. Leave unit lines on vertices of handle
// points. Moving centroid moves 1/5, moving points moves 5/5. Indicate when
// center is in sweet spot.*

test("the center drags in fifths and a corner drags in whole units", () => {
    const seen = [];
    const pd = createPentadiculum({
        canvas: canvasStub(), document: stubDocument(),
        onChange: (seed) => seen.push(copy(seed)),
    });
    // nothing floating, so each handle is only itself
    const { cell } = pd.sync(copy(SEED), { floater: -1 });

    // the center, a third of a cell right: a fifth catches it, a unit would not
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    assert.equal(pd.dragging(), PD_ORIGIN);
    pd.canvas.fire("pointermove", { clientX: SIZE / 2 + cell * 0.37, clientY: SIZE / 2 });
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(seen.at(-1).origin, [0.4, 0], "5/5 would have left it at 0");

    // a corner, the same third of a cell: it lands on the unit
    pd.canvas.fire("pointerdown", client(SEED.points[1], cell));
    assert.equal(pd.dragging(), 1);
    pd.canvas.fire("pointermove", {
        clientX: SIZE / 2 + cell * (SEED.points[1][0] + 0.37),
        clientY: SIZE / 2 + cell * SEED.points[1][1],
    });
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(seen.at(-1).points[1], SEED.points[1],
        "a corner is a Gaussian integer or it is nothing");

    // two thirds over, and it moves a whole unit
    pd.canvas.fire("pointerdown", client(SEED.points[1], cell));
    pd.canvas.fire("pointermove", {
        clientX: SIZE / 2 + cell * (SEED.points[1][0] + 0.7),
        clientY: SIZE / 2 + cell * SEED.points[1][1],
    });
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(seen.at(-1).points[1], [SEED.points[1][0] + 1, SEED.points[1][1]]);
});

test("the input's paper divides each unit square into fifths, under the unit lines", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    // Asked for: `fine` is off by default now, and this seed's center is on a
    // unit, so nothing is forcing the fifths up.
    const { cell } = pd.sync(copy(SEED), { fifths: true });
    assert.ok(cell / 5 >= 4, `a fifth is ${(cell / 5).toFixed(1)}px, too fine to draw`);

    const strokes = canvas.log.filter((l) => l.startsWith("strokeStyle="));
    const fifths = strokes.indexOf("strokeStyle=#edf2fa");
    const units = strokes.indexOf("strokeStyle=#dce7f6");
    assert.ok(fifths >= 0, `no fifths level in ${strokes.slice(0, 6)}`);
    assert.ok(units >= 0, "no unit level");
    assert.ok(fifths < units, "the fifths go first, so the unit lines draw over them");

    // and they drop out of their own accord when there is no room: GRID_FIFTHS
    // is culled at 4px like every other level
    const tiny = canvasStub();
    const small = createPentadiculum({ canvas: tiny, document: stubDocument(), cell: 2 });
    small.sync(copy(SEED), { extrapolate: 6 });
    assert.ok(!tiny.log.includes("strokeStyle=#edf2fa"), "drawn at a cell nobody can read");
});

test("the target is the handle you can see, not a patch of grid around it", () => {
    // Jake, 2026-11-24: *it seems to grab handles when the mouse is still on
    // the grid. Make the target within the handles.* The hit test used to be
    // 2.5 LATTICE UNITS, so on a small seed, or at any real zoom, every press
    // landed on a handle -- which is also why the paper could not be panned.
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const { cell } = pd.sync(copy(SEED));
    assert.ok(cell * 0.5 > 8, `half a unit is ${cell / 2}px, not clear of a handle`);

    // half a unit off point 0 at (0,-3): inside the old radius, outside the dot
    pd.canvas.fire("pointerdown", client([0, -2.5], cell));
    pd.canvas.fire("pointermove", client([1, -2.5], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.seed().points, SEED.points, "the handle was not grabbed");
    assert.deepEqual(pd.pan().map((v) => Math.round(v * 1e9) / 1e9), [1, 0],
        "it panned instead, which is the same bug seen from the other side");

    // and ON the handle it still grabs: the dot itself is the target
    pd.reset();
    pd.sync(copy(SEED));
    pd.canvas.fire("pointerdown", client(SEED.points[0], cell));
    pd.canvas.fire("pointermove", client([1, -4], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.seed().points[0], [1, -4]);
});

test("zooming in does not swallow the paper: the target stays the same size", () => {
    // The old radius grew with the zoom, so the closer you looked the less of
    // the canvas was pannable. In pixels it is the same dot at every scale.
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    pd.sync(copy(SEED));
    for (let i = 0; i < 6; i++) pd.canvas.fire("wheel", { deltaY: -120, preventDefault() {} });
    assert.ok(pd.zoom() > 2, `zoom ${pd.zoom()}`);
    const cell = pd.drawn().cell;

    // a quarter of a unit off point 0 is now a long way in pixels
    pd.canvas.fire("pointerdown", client([0.25, -3], cell));
    pd.canvas.fire("pointermove", client([0.5, -3], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.seed().points, SEED.points, "zoomed in, a near miss is a miss");
    assert.ok(pd.pan()[0] > 0, "and the paper moved");
});

test("a held handle goes translucent, so the lattice reads under it", () => {
    // Jake, 2026-11-24: *make handle transparent during movement so user can
    // see grid underneath.*
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    const { cell } = pd.sync(copy(SEED));
    assert.ok(!canvas.log.includes("globalAlpha=0.4"), "nothing is held yet");

    canvas.log.length = 0;
    pd.canvas.fire("pointerdown", client(SEED.points[0], cell));
    assert.ok(canvas.log.includes("globalAlpha=0.4"), "the grabbed handle is translucent");

    canvas.log.length = 0;
    pd.canvas.fire("pointerup", {});
    assert.ok(!canvas.log.includes("globalAlpha=0.4"), "and solid again once let go");

    // the center too, when it is the one being dragged
    const other = canvasStub();
    const two = createPentadiculum({ canvas: other, document: stubDocument() });
    const k = two.sync(copy(SEED)).cell;
    other.log.length = 0;
    two.canvas.fire("pointerdown", client([0, 0], k));
    assert.ok(other.log.includes("globalAlpha=0.4"), "the center is translucent too");
});

test("a Pentadiculum starts transparent, so the paper reads through it", () => {
    // Jake, 2026-11-24, splitting the input figure's face and edge controls off
    // from the output's: *default it to thin and transparent.* The lattice, the
    // fifths, the fence and the sweet spot all live UNDER the figure.
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    pd.sync(copy(SEED));
    assert.equal(pd.view().face, "transparent");
    assert.equal(pd.view().edge, "thin");
    assert.ok(canvas.log.some((l) => l.startsWith("globalAlpha=") && l !== "globalAlpha=1"),
        "something was drawn at less than full opacity");
    // and solid is still a setting, not a thing it has lost
    const solid = canvasStub();
    const two = createPentadiculum({ canvas: solid, document: stubDocument() });
    two.sync(copy(SEED), { face: "solid" });
    assert.equal(two.view().face, "solid");
});

test("the fifths can be switched off, and the unit lattice stays", () => {
    // Jake, 2026-11-24: *the fine grid should be turned off and on easily.*
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    pd.sync(copy(SEED), { fifths: false });
    assert.ok(!canvas.log.includes("strokeStyle=#edf2fa"), "the fifths are off");
    assert.ok(canvas.log.includes("strokeStyle=#dce7f6"), "the unit lines are not");
    // and back on again without re-handing it the seed
    const again = canvasStub();
    const two = createPentadiculum({ canvas: again, document: stubDocument() });
    two.sync(copy(SEED), { fifths: false });
    again.log.length = 0;
    two.sync(undefined, { fifths: true });
    assert.ok(again.log.includes("strokeStyle=#edf2fa"), "the fifths are back");
});

test("dragging where no handle is pans the paper, and the seed does not move", () => {
    // Jake, 2026-11-24: *doing close up work, I can't pan to move individual
    // points on the pentadiculum.*
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const { cell } = pd.sync(copy(SEED));
    assert.deepEqual(pd.pan(), [0, 0]);

    pd.canvas.fire("pointerdown", client([6, 6], cell));     // well clear of the five
    pd.canvas.fire("pointermove", client([8, 7], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.pan().map((v) => Math.round(v * 1e9) / 1e9), [2, 1],
        "the paper followed the pointer, in lattice units");
    assert.deepEqual(pd.seed().points, SEED.points, "and nothing was dragged");
    assert.deepEqual(pd.seed().origin, [0, 0]);

    // the hit test now reads through the pan: point 0 is two units right of
    // where it was on screen, and grabbing it there drags it
    pd.canvas.fire("pointerdown", client([0 + 2, -3 + 1], cell));
    pd.canvas.fire("pointermove", client([1 + 2, -4 + 1], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.seed().points[0], [1, -4], "grabbed through the pan");

    // and a double-click on empty paper puts the pan back with the fit
    pd.canvas.fire("dblclick", client([9, 9], cell));
    assert.deepEqual(pd.pan(), [0, 0]);
    assert.equal(pd.zoom(), 1);
});

test("the pan survives a zoom, because it is kept in lattice units", () => {
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const { cell } = pd.sync(copy(SEED));
    pd.canvas.fire("pointerdown", client([7, 0], cell));
    pd.canvas.fire("pointermove", client([10, 0], cell));
    pd.canvas.fire("pointerup", {});
    const panned = pd.pan();
    pd.canvas.fire("wheel", { deltaY: -200, preventDefault() {} });
    assert.ok(pd.zoom() > 1, "it zoomed");
    assert.deepEqual(pd.pan(), panned, "and stayed where it was looking");
});

test("a center that will not move pans instead of doing nothing", () => {
    const pd = createPentadiculum({ canvas: canvasStub(), document: stubDocument() });
    const { cell } = pd.sync(copy(SEED), { floater: 2 });   // a point floats: the center is fixed
    pd.canvas.fire("pointerdown", client([0, 0], cell));
    pd.canvas.fire("pointermove", client([1, 0], cell));
    pd.canvas.fire("pointerup", {});
    assert.deepEqual(pd.seed().origin, [0, 0], "the center is still fixed");
    assert.deepEqual(pd.pan().map((v) => Math.round(v * 1e9) / 1e9), [1, 0],
        "and the grab moved the paper instead");
});

test("the center becomes a bullseye on the sweet spot, and says so", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });

    assert.equal(pd.sync(copy(SEED)).sweet, false, "(0,0) is not the centroid here");
    canvas.log.length = 0;
    const mid = centroidOf(SEED.points);
    const drawn = pd.sync({ points: SEED.points.map((p) => [p[0], p[1]]), origin: mid });
    assert.equal(drawn.sweet, true);

    // the pupil: a white fill on a small arc at the center of the canvas
    const arcs = canvas.log.filter((l) => l.startsWith("arc("));
    assert.ok(arcs.some((l) => l.split(",")[2] === "2.6"), `no pupil in ${arcs.at(-1)}`);

    // and it is a question about the ORIGIN, not about the preset: move a
    // corner and the centroid moves out from under it
    const off = pd.sync({
        points: SEED.points.map((p, i) => (i === 0 ? [p[0] + 1, p[1]] : [p[0], p[1]])),
        origin: mid,
    }, { floater: -1 });
    assert.equal(off.sweet, false, "the centroid moved and the center did not");
});

// ── the four grid palettes ───────────────────────────────────────────────

test("the grid palettes: fifths lighter than units, over darker than under", () => {
    // Jake, 2026-11-23: *use light 5 space grid on units in output grid too.
    // [...] render output "on top" grid more contrasty.* Two claims about color,
    // and color is exactly the kind of thing that gets edited to taste later and
    // quietly stops being true.
    const lum = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };

    for (const [name, base, fifths] of [
        ["under", GRID_LEVELS, GRID_FIFTHS],
        ["over", GRID_OVER, GRID_OVER_FIFTHS],
    ]) {
        // the fifths list is its base with one rung added underneath
        assert.equal(fifths.length, base.length + 1, `${name}: wrong length`);
        assert.equal(fifths[0][0], 1 / 5, `${name}: the added rung is not a fifth`);
        assert.deepEqual(fifths.slice(1), [...base], `${name}: the base changed`);
        // "leave unit lines on vertices of handle points": the unit lines have
        // to stay the ones you read, so the fifths are lighter
        assert.ok(lum(fifths[0][1]) > lum(base[0][1]),
            `${name}: fifths ${fifths[0][1]} is not lighter than units ${base[0][1]}`);
        // and every level is drawn over the last, so each is darker than it
        for (let i = 1; i < base.length; i++)
            assert.ok(lum(base[i][1]) < lum(base[i - 1][1]),
                `${name}: level ${base[i][0]} is not darker than ${base[i - 1][0]}`);
    }

    // the over palette has to carry over the three tile fills AND over white
    for (let i = 0; i < GRID_LEVELS.length; i++)
        assert.ok(lum(GRID_OVER[i][1]) < lum(GRID_LEVELS[i][1]) - 60,
            `over level ${GRID_OVER[i][0]} is no darker than the one read through`);
    for (const fill of ["#3355cc", "#f2d13b", "#dd7722", "#ffffff"])
        assert.ok(Math.abs(lum(GRID_OVER[0][1]) - lum(fill)) > 20,
            `the over grid vanishes on ${fill}`);
    assert.ok(GRID_OVER_ALPHA > 0.75, "it was 0.75 and read as nothing");
});

test("the over grid is not black, and its weight is in the width", () => {
    // Jake, 2026-11-23: *the five(4) space lines on the output should be
    // lighter, and the 4 unit spacing heavier. Make it non black to contrast
    // with existing edges.*
    const lum = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    /** How far from neutral: tile edges are `#111418`, where this is 7. */
    const cast = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return (n & 255) - ((n >> 16) & 255);
    };

    assert.equal(cast(EDGE_INK), 7, "EDGE_INK stopped being the neutral it was");
    for (const [step, color] of GRID_OVER_FIFTHS)
        assert.ok(cast(color) >= 20,
            `over level ${step} is ${color}, too neutral to tell from a tile edge`);

    // the finest division is the faintest line on the sheet, lighter than every
    // rung above it rather than a shade off the unit lines
    const [, fifth] = GRID_OVER_FIFTHS[0];
    for (const [step, color] of GRID_OVER)
        assert.ok(lum(fifth) > lum(color) + 40,
            `the fifths are not clearly lighter than level ${step}`);

    // and "heavier" is the stroke, because the ramp has no room left to darken
    const widths = GRID_OVER.map(([, , w]) => w);
    assert.equal(widths[0], 1, "the unit lines stay hairline");
    assert.ok(widths[1] > widths[0], "the 4s are not heavier than the 1s");
    for (let i = 1; i < widths.length; i++)
        assert.ok(widths[i] >= widths[i - 1], `level ${GRID_OVER[i][0]} got lighter`);
    assert.equal(GRID_OVER_FIFTHS[0][2], 1, "the fifths stay hairline too");

    // under the figure, on white paper, color carries it all and nothing is thick
    for (const [step, , w] of GRID_FIFTHS)
        assert.equal(w, 1, `the pale level ${step} is drawn thick`);
});


// ── the six boxes ─────────────────────────────────────────────────────────
//
// Jake's spec, 2026-11-24: three sections, `grid [] snap [] fine`,
// `centroid [] actual [] closest` and `display [] vectors`, with a box that
// cannot be unchecked drawn as a grayed check and one that cannot be checked as
// a grayed box. `gridBoxes` is the whole rule, so it is tested without a DOM.

test("centerMoves: the two ways a drag takes the center with it", () => {
    // nothing held
    assert.equal(centerMoves(-1, PD_ORIGIN), false);
    // the center itself, which snaps at a fifth
    assert.equal(centerMoves(PD_ORIGIN, PD_ORIGIN), true);
    assert.equal(centerMoves(PD_ORIGIN, -1), true, "held is held, floater or not");
    assert.equal(centerMoves(PD_ORIGIN, 2), true);
    // a corner, with the center floating -- the default, and the center
    // follows at a fifth of the step
    assert.equal(centerMoves(3, PD_ORIGIN), true);
    // a corner, with another CORNER floating: the center stays put
    assert.equal(centerMoves(3, 1), false);
    assert.equal(centerMoves(3, 3), false, "dragging the floater retargets");
    assert.equal(centerMoves(3, -1), false);
});

test("the grid boxes: snap is never locked, fine is locked when it is forced", () => {
    const seed = { points: PENTA_UP, origin: [0, 0] };
    // the center is on a unit and nothing is moving: fine is the user's
    let b = gridBoxes(seed, { snap: "units", fine: false, moving: false });
    assert.deepEqual(b.snap, { on: true, locked: false });
    assert.deepEqual(b.fine, { on: false, locked: false });
    b = gridBoxes(seed, { snap: "units", fine: true, moving: false });
    assert.deepEqual(b.fine, { on: true, locked: false }, "on, and still theirs");

    // `none` for the real preset, and still never locked -- Jake: *except for
    // real preset, can be checked*
    b = gridBoxes(seed, { snap: "none", fine: false, moving: false });
    assert.deepEqual(b.snap, { on: false, locked: false });

    // a drag that moves the center forces the fifths up and locks them there
    b = gridBoxes(seed, { snap: "units", fine: false, moving: true });
    assert.deepEqual(b.fine, { on: true, locked: true });

    // and so does a center that is already off a unit, moving or not
    b = gridBoxes({ points: PENTA_UP, origin: [0, 0.2] },
        { snap: "units", fine: false, moving: false });
    assert.deepEqual(b.fine, { on: true, locked: true },
        "only the fifths can say where 0.2 is");
});

test("the centroid boxes read the figure, and lock where there is nothing to do", () => {
    const points = PENTA_UP;
    const mid = centroidOf(points);
    assert.deepEqual(mid, [0, 0.2], "the classic seed is odd: its centroid is a fifth");

    // at the origin: `closest` is satisfied, `actual` is the move to make
    let b = gridBoxes({ points, origin: [0, 0] });
    assert.deepEqual(b.actual, { on: false, locked: false });
    assert.deepEqual(b.closest, { on: true, locked: true });

    // at the centroid: the other way about
    b = gridBoxes({ points, origin: mid });
    assert.deepEqual(b.actual, { on: true, locked: true });
    assert.deepEqual(b.closest, { on: false, locked: false });

    // somewhere else entirely: both are offers
    b = gridBoxes({ points, origin: [1, -2] });
    assert.deepEqual(b.actual, { on: false, locked: false });
    assert.deepEqual(b.closest, { on: false, locked: false });
});

test("on an EVEN pentad both centroid boxes are the same box", () => {
    // GEOMETRY.md §8: an even pentad's five spokes sum to zero, so its centroid
    // is a lattice point and there is no choice to make between the exact
    // center and an integral one. Both boxes checked at once is what that looks
    // like on the page.
    const points = EVEN_PENTAD;
    assert.deepEqual(centroidOf(points), [0, 0]);
    assert.deepEqual(integralCentroid(points), centroidOf(points));

    const b = gridBoxes({ points, origin: [0, 0] }, { fine: false });
    assert.deepEqual(b.actual, { on: true, locked: true });
    assert.deepEqual(b.closest, { on: true, locked: true });
    // and the fine grid has nothing to do either, because the center is on a unit
    assert.deepEqual(b.fine, { on: false, locked: false });

    // which the classic seed cannot manage at the same time
    const odd = gridBoxes({ points: PENTA_UP, origin: centroidOf(PENTA_UP) });
    assert.equal(odd.actual.on && odd.closest.on, false);
});

test("setBox puts a box on a checkbox, grayed and all", () => {
    const input = element("input");
    setBox(input, { on: true, locked: true });
    assert.equal(input.checked, true);
    assert.equal(input.disabled, true, "a check you cannot uncheck is grayed");
    setBox(input, { on: false, locked: true });
    assert.equal(input.checked, false);
    assert.equal(input.disabled, true, "and so is a box you cannot check");
    setBox(input, { on: false, locked: false });
    assert.equal(input.disabled, false);
});

test("the draw reports its boxes, so the row cannot disagree with the canvas", () => {
    const canvas = canvasStub();
    const pd = createPentadiculum({ canvas, document: stubDocument() });
    const drawn = pd.sync({ points: PENTA_UP.map((p) => [...p]), origin: [0, 0] });
    assert.deepEqual(drawn.boxes.closest, { on: true, locked: true });
    assert.deepEqual(drawn.boxes.fine, { on: false, locked: false });
    // and the PAPER follows the box, not the setting: drag the center and the
    // fifths come up although `fifths` was never switched on
    assert.ok(!canvas.log.includes("strokeStyle=#edf2fa"), "no fifths at rest");
    const { cell } = drawn;
    canvas.fire("pointerdown", client([0, 0], cell));
    canvas.log.length = 0;
    canvas.fire("pointermove", { clientX: SIZE / 2 + cell * 0.4, clientY: SIZE / 2 });
    assert.ok(canvas.log.includes("strokeStyle=#edf2fa"),
        "the fifths come up under a center drag");
    assert.deepEqual(pd.drawn().boxes.fine, { on: true, locked: true });
    canvas.fire("pointerup", {});
    assert.equal(pd.view().fifths, false, "and the SETTING was never touched");
});

test("the mount's ladder row walks half generations, and use adopts one", () => {
    // The floating panel has to be a working alternative to the page's own
    // column, and the column had the ladder. `view.extrapolate` was always the
    // instrument's, so the controls for it belong here too.
    const rungs = [];
    const m = mountPentadiculum(element(), {
        document: stubDocument(), onLadder: (n) => rungs.push(n),
    });
    const buttons = m.element.all().filter((c) => c.tagName === "BUTTON");
    const down = buttons.find((b) => b.textContent === "−");
    const up = buttons.find((b) => b.textContent === "+");
    const use = buttons.find((b) => b.textContent === "use");
    const rung = m.element.all().find((c) => c.className === "step");
    assert.equal(rung.textContent, "0");

    up.fire("click");
    assert.equal(m.pentadiculum.view().extrapolate, 0.5, "half a generation");
    assert.equal(rung.textContent, "+0.5", "signed, so +0.5 and -0.5 differ");
    down.fire("click");
    down.fire("click");
    assert.equal(m.pentadiculum.view().extrapolate, -0.5);
    assert.equal(rung.textContent, "-0.5");
    assert.deepEqual(rungs, [0.5, 0, -0.5], "and the page was told each time");

    // bounded at both ends
    for (let i = 0; i < 20; i++) down.fire("click");
    assert.equal(m.pentadiculum.view().extrapolate, -4, "as far down as it goes");
    for (let i = 0; i < 30; i++) up.fire("click");
    assert.equal(m.pentadiculum.view().extrapolate, 6, "and as far up");

    // `use` adopts the shown figure and comes back to the base rung
    const was = copy(m.seed()).points;
    up.fire("click");                           // nothing: already at the top
    use.fire("click");
    assert.equal(m.pentadiculum.view().extrapolate, 0, "back to the five");
    assert.equal(rung.textContent, "0");
    assert.notDeepEqual(m.seed().points, was, "and the five are the rung's");
    assert.equal(rungs.at(-1), 0);
});

test("use keeps the adopted figure where it was drawn, not at the origin", () => {
    // In spoke coordinates the rung is measured from the origin, so adopting it
    // without putting it back would teleport the pentagon.
    const m = mountPentadiculum(element(), { document: stubDocument() });
    m.set({ points: PENTA_UP.map((p) => [p[0] + 3, p[1] - 2]), origin: [3, -2] });
    const buttons = m.element.all().filter((c) => c.tagName === "BUTTON");
    buttons.find((b) => b.textContent === "+").fire("click");
    buttons.find((b) => b.textContent === "use").fire("click");
    assert.deepEqual(m.seed().origin, [3, -2], "the origin did not move");
    const mid = centroidOf(m.seed().points);
    assert.ok(Math.hypot(mid[0] - 3, mid[1] - (-2)) < 1.5,
        `the five stayed around the origin: centroid (${mid})`);
});

test("every canvas carries the class its stylesheet styles, adopted or made", () => {
    // `lib/css/pentadiculum.css` styles `canvas.pentadiculum`, and the page
    // that hosts a mount has to link it -- `touch-action: none` lives there,
    // and without it a touch drag on a handle scrolls the page instead of
    // moving the point.
    const made = createPentadiculum({ document: stubDocument() });
    assert.equal(made.canvas.className, "pentadiculum");

    // and an adopted canvas KEEPS its page's classes, with this one added:
    // `#boot-input` is styled by the page it lives in as well.
    const mine = canvasStub();
    mine.className = "mine";
    const adopted = createPentadiculum({ canvas: mine, document: stubDocument() });
    assert.equal(adopted.canvas.className, "mine pentadiculum");
});
