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
    PD_ORIGIN, SNAPS, createPentadiculum, mountFloatingPentadiculum,
    mountPentadiculum, snapForSeed, snapped,
} from "../lib/pentadiculum.js";
import { PENTA_UP, centroidOf } from "../lib/wheels.js";

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

test("snap: units, fifths, none", () => {
    assert.deepEqual([...SNAPS], ["units", "fifths", "none"]);
    assert.equal(snapped("units", 0.4), 0);
    assert.equal(snapped("fifths", 0.23), 0.2);
    assert.equal(snapped("none", 1 / 3), 85 / 256);
    // and it follows a figure rather than a name: a preset that is not on the
    // lattice must not be rounded onto it by the first drag
    assert.equal(snapForSeed(SEED), "units");
    assert.equal(snapForSeed({ points: SEED.points, origin: [0, 0.2] }), "fifths");
    assert.equal(snapForSeed({ points: SEED.points, origin: [0, 0.3333] }), "none");
    // the centroid is always in fifths, which is the reason `fifths` exists
    assert.equal(snapForSeed({ points: SEED.points, origin: centroidOf(SEED.points) }),
        "fifths");
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
    assert.ok(kinds.filter((k) => k === "SELECT").length === 2, "preset and snap");
    assert.ok(kinds.filter((k) => k === "BUTTON").length === 2, "centroid and origin");
    assert.equal(seen.length, 1, "it draws and announces once on mount");
    assert.deepEqual(m.seed().origin, [0, 0]);
});

test("the mount's centroid button lands on the sweet spot and follows it down to fifths", () => {
    const doc = stubDocument();
    const m = mountPentadiculum(element(), { document: doc });
    const buttons = m.element.all().filter((c) => c.tagName === "BUTTON");
    const centroid = buttons.find((b) => b.textContent === "centroid");
    centroid.fire("click");
    assert.deepEqual(m.seed().origin, centroidOf(SEED.points));
    assert.deepEqual(m.seed().origin, [0, 0.2], "the classic seed's centroid");
    // the control follows: fifths is the grid the centroid lives on
    const snapPick = m.element.all().filter((c) => c.tagName === "SELECT")[1];
    assert.equal(snapPick.value, "fifths");
    assert.equal(m.pentadiculum.view().snap, "fifths");
    // and `origin` puts it back
    buttons.find((b) => b.textContent === "origin").fire("click");
    assert.deepEqual(m.seed().origin, [0, 0]);
});

test("the mount's preset picker loads a preset, origin and all", () => {
    const m = mountPentadiculum(element(), { document: stubDocument() });
    const presetPick = m.element.all().filter((c) => c.tagName === "SELECT")[0];
    const names = presetPick.children.map((o) => o.value);
    assert.deepEqual(names, ["quadrille", "asymmetric", "real"]);
    // the label, not the key: Jake calls the quadrille "classic"
    assert.equal(presetPick.children[0].textContent, "classic");

    m.set({ points: SEED.points, origin: [0, 1] });
    presetPick.value = "real";
    presetPick.fire("change");
    assert.deepEqual(m.seed().origin, [0, 0], "a preset is five vectors FROM the origin");
    // and snap comes off, because the real pentagon is irrational
    assert.equal(m.pentadiculum.view().snap, "none");
});

test("the floating mount is a panel on the body, dragged by its bar", () => {
    const doc = stubDocument();
    const m = mountFloatingPentadiculum({ document: doc, title: "seed", at: [40, 60] });
    assert.equal(doc.body.children.length, 1);
    assert.equal(m.panel.style.left, "40px");

    const bar = m.panel.children[0];
    bar.fire("pointerdown", { clientX: 50, clientY: 70, target: bar });
    bar.fire("pointermove", { clientX: 90, clientY: 130 });
    assert.equal(m.panel.style.left, "80px", "it followed the pointer");
    assert.equal(m.panel.style.top, "120px");
    bar.fire("pointerup", {});
    bar.fire("pointermove", { clientX: 200, clientY: 200 });
    assert.equal(m.panel.style.left, "80px", "and stopped when it was let go");

    // the shut button hides it rather than destroying it
    m.panel.children[0].children[0].fire("click");
    assert.equal(m.panel.style.display, "none");
    m.toggle();
    assert.equal(m.panel.style.display, "");
});
