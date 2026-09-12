// The reticulum: n grid directions inside a regular decagon, signed range.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";

import { createReticulum, signedGamma, lighten } from "../dist/ui/reticulum.js";

const COLORS = ["#a", "#b", "#c", "#d", "#e", "#f", "#g"];
// must track the module's constants
const A = 1, CIRC = A / Math.cos(Math.PI / 10), LABEL_R = CIRC + 0.2;
const SPAN = 2 * LABEL_R + 0.28;

const dirsFor = (n) => Array.from({ length: n }, (_, j) => {
    const a = 2 * Math.PI * j / n;
    return [Math.cos(a), Math.sin(a)];
});

const cls = (c) => c.getAttribute("class") || "";
const pick = (el, prefix) => el.children.filter((c) => cls(c).startsWith(prefix));
const num = (el, a) => +el.getAttribute(a);

function ret(n = 5, hooks = {}) {
    const r = createReticulum({
        count: n, directions: dirsFor(n), colors: COLORS,
        onChange: hooks.onChange ?? (() => {}),
        onLock: hooks.onLock ?? (() => {}),
    });
    r.sync({ values: new Array(n).fill(0.2), locked: n - 1, sum: 0.2 * n });
    return {
        r,
        hit: pick(r.element, "ret-hit")[0],
        band: pick(r.element, "ret-band")[0],
        rim: pick(r.element, "ret-rim")[0],
        cross: pick(r.element, "ret-cross")[0],
        axes: pick(r.element, "ret-axis"),
        labels: pick(r.element, "ret-label"),
    };
}

const ev = (x, y, extra = {}) => ({
    clientX: x, clientY: y, dp: false,
    preventDefault() { this.dp = true; }, stopPropagation() {}, ...extra,
});

const gridOf = (axis) => pick(axis, "ret-grid")[0];
const ends = (l) => ["x1", "y1", "x2", "y2"].map((a) => +num(l, a).toFixed(9));

// ── the signed representative ─────────────────────────────────────

test("signedGamma is a display transform: 0.8 and -0.2 are the same gamma", () => {
    assert.equal(signedGamma(0.8).toFixed(9), (-0.2).toFixed(9));
    assert.equal(signedGamma(0.2).toFixed(9), (0.2).toFixed(9));
    assert.equal(signedGamma(0), 0);
    // whole turns change nothing
    for (const k of [-3, -1, 1, 4]) {
        assert.ok(Math.abs(signedGamma(0.3 + k) - 0.3) < 1e-9, `turn ${k}`);
    }
    // everything lands in [-1/2, +1/2)
    for (let g = -2; g <= 2; g += 0.031) {
        const s = signedGamma(g);
        assert.ok(s >= -0.5 - 1e-12 && s < 0.5, `${g} -> ${s}`);
    }
});

test("a gamma and its congruent partner draw the identical line", () => {
    // The point of centralising the transform: the two instruments disagree about
    // the number and agree about the picture.
    const { r, axes } = ret(5);
    const shot = (g) => {
        r.sync({ values: [g, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: g + 0.8 });
        return ends(gridOf(axes[0]));
    };
    assert.deepEqual(shot(0.8), shot(-0.2));
    assert.deepEqual(shot(1), shot(0));
    assert.deepEqual(shot(7.25), shot(0.25));
});

// ── geometry ──────────────────────────────────────────────────────

test("the range is a signed full-width traverse, not a radial slider", () => {
    // gamma = 0 puts the line through the CENTRE. A radial slider would put it
    // at an end, which is the bug this replaced.
    const { r, axes } = ret(5);
    r.sync({ values: [0, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 0.8 });
    const mid = gridOf(axes[0]);
    // axis 0 is +x, so its line is the vertical chord at x = 0
    assert.ok(Math.abs(num(mid, "x1")) < 1e-9, "gamma 0 must pass through the centre");
    assert.ok(Math.abs(num(mid, "x2")) < 1e-9);

    // and +1/2 / -1/2 sit on opposite sides, a full width apart. The line runs
    // AGAINST gamma, because the model puts line n at x . v_j = n - gamma_j.
    r.sync({ values: [0.499999, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 1.1 });
    const plus = num(gridOf(axes[0]), "x1");
    r.sync({ values: [-0.5, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 0.3 });
    const minus = num(gridOf(axes[0]), "x1");
    assert.ok(Math.abs(plus + A) < 1e-4, `gamma +1/2 should reach -A, got ${plus}`);
    assert.ok(Math.abs(minus - A) < 1e-9, `gamma -1/2 should reach +A, got ${minus}`);
    assert.ok(Math.abs((minus - plus) - 2 * A) < 1e-4, "full travel must be 2A");
});

test("at the limits the line lies along the decagon side itself", () => {
    const { r, axes, rim } = ret(5);
    r.sync({ values: [-0.5, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 0.3 });
    const l = gridOf(axes[0]);
    // both ends must be corners of the decagon
    const pts = rim.getAttribute("points").split(" ").map((s) => s.split(",").map(Number));
    const near = (x, y) => pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 1e-4);
    assert.ok(near(num(l, "x1"), num(l, "y1")), "an end is not on the rim");
    assert.ok(near(num(l, "x2"), num(l, "y2")), "an end is not on the rim");
});

test("the rim is a regular decagon: ten corners, all at the circumradius", () => {
    const { rim } = ret(5);
    const pts = rim.getAttribute("points").split(" ").map((s) => s.split(",").map(Number));
    assert.equal(pts.length, 10, "five families make ten sides");
    for (const [x, y] of pts) {
        // the points attribute is written to 5 decimals, so that is the floor
        assert.ok(Math.abs(Math.hypot(x, y) - CIRC) < 1e-4, `corner at ${Math.hypot(x, y)}`);
    }
});

// ── the rest of the instrument ────────────────────────────────────

test("the active band shows only when an axis is live, and turns with it", () => {
    const { hit, band } = ret(5);
    assert.doesNotMatch(cls(band), /on/, "nothing live yet");
    hit.on.pointermove[0](ev(760, 400));            // over axis 0
    assert.match(cls(band), /on/);
    const first = band.getAttribute("points");
    hit.on.pointermove[0](ev(400, 120));            // a different axis
    assert.notEqual(band.getAttribute("points"), first, "the band must rotate");
});

test("the origin carries a tiny cross aligned with the active and dependent lines", () => {
    const { r, hit, cross } = ret(5);
    const [act, dep] = [pick(cross, "ret-cross-active")[0], pick(cross, "ret-cross-dep")[0]];
    // dependent is family 4; its LINES run across its axis
    const [dx, dy] = dirsFor(5)[4];
    const w = [dy, dx];                 // perp of (dx,-dy) in svg space
    const along = Math.abs(num(dep, "x1") * w[1] - num(dep, "y1") * w[0]);
    assert.ok(along < 1e-9, "the dependent arm is not along its line direction");
    assert.equal(act.getAttribute("opacity"), "0", "no active axis yet");
    hit.on.pointermove[0](ev(760, 400));
    assert.equal(act.getAttribute("opacity"), "1");
    // and it stays tiny
    assert.ok(Math.hypot(num(act, "x1"), num(act, "y1")) < 0.1 * A);
});

test("nothing sits at the centre but the cross — the hub is gone", () => {
    const { r } = ret(5);
    assert.equal(pick(r.element, "ret-hub").length, 0);
    for (const c of r.element.children) {
        assert.notEqual((c.textContent || "").trim(), "Σ", "Sigma is back at the centre");
    }
});

test("wheel: hundredths a notch, thousandths with shift, and it eats the scroll", () => {
    const moves = [];
    const { hit } = ret(5, { onChange: (j, v) => moves.push([j, +v.toFixed(6)]) });
    hit.on.pointerdown[0](ev(760, 400));
    hit.on.pointerup[0](ev(760, 400));
    const up = ev(760, 400, { deltaY: -1 });
    hit.on.wheel[0](up);
    assert.deepEqual(moves.at(-1), [0, 0.21]);
    assert.ok(up.dp);
    hit.on.wheel[0](ev(760, 400, { deltaY: -1, shiftKey: true }));
    assert.deepEqual(moves.at(-1), [0, 0.201]);
});

test("dragging is 1:1 across the full width, and reports unwrapped state", () => {
    // Closes the loop the way the page does: what the control reports goes to the
    // model, and the model syncs it back. Without that the control keeps nudging
    // from a stale value, which is a fair description of a broken page.
    const moves = [];
    let r;
    const feedback = (j, v) => {
        moves.push(v);
        const vals = [0.2, 0.2, 0.2, 0.2, 0.2];
        vals[j] = v;
        r.sync({ values: vals, locked: 4, sum: vals.reduce((a, b) => a + b, 0) });
    };
    const made = ret(5, { onChange: (j, v) => feedback(j, v) });
    r = made.r;
    const { hit } = made;

    hit.on.pointerdown[0](ev(760, 400));
    hit.on.pointermove[0](ev(800, 400));
    // Dragging the line along +v LOWERS gamma, so the line stays under the finger.
    const expect = 0.2 - (40 / 800 * SPAN) / (2 * A);
    assert.ok(Math.abs(moves.at(-1) - expect) < 1e-6,
              `got ${moves.at(-1)} want ${expect}`);

    // and running well past the boundary must not clamp or wrap the state
    for (let i = 1; i <= 40; i++) hit.on.pointermove[0](ev(800 + i * 20, 400));
    assert.ok(moves.at(-1) < -1, `state should run on, got ${moves.at(-1)}`);
    assert.ok(Math.abs(signedGamma(moves.at(-1))) <= 0.5, "but the display stays signed");
});

test("clicking a label makes that gamma the dependent one", () => {
    const locks = [];
    const { labels } = ret(5, { onLock: (j) => locks.push(j) });
    labels[2].on.pointerdown[0](ev(0, 0));
    assert.deepEqual(locks, [2]);
});

test("with the total released, no axis is dependent", () => {
    const { r, axes, labels } = ret(5);
    r.sync({ values: new Array(5).fill(0.2), locked: -1, sum: 1 });
    for (const a of axes) assert.doesNotMatch(cls(a), /dependent/);
    for (const l of labels) assert.doesNotMatch(cls(l), /dependent/);
});

test("the dependent axis is marked, inert, and lets the page scroll", () => {
    const moves = [];
    const { r, hit, axes, labels } = ret(5, { onChange: (j) => moves.push(j) });
    assert.match(cls(axes[4]), /dependent/);
    assert.equal(labels[4].getAttribute("fill"), "#aaa");
    const [dx, dy] = dirsFor(5)[4];
    const e = ev(400 + dx * 300, 400 - dy * 300, { deltaY: -1 });
    hit.on.wheel[0](e);
    assert.deepEqual(moves, []);
    assert.equal(e.dp, false, "must not swallow the page scroll");
});

test("n is a parameter: seven families give fourteen sides", () => {
    const { axes, labels, rim } = ret(7);
    assert.equal(axes.length, 7);
    assert.equal(labels.length, 7);
    assert.equal(rim.getAttribute("points").split(" ").length, 14);
});

test("the band wears its own family's colour, washed out", () => {
    // Not a fixed pink: the band says WHICH gamma is live, the line says where.
    // Real hex here — the placeholder colours elsewhere are deliberately not
    // parseable, and lighten passes those straight through.
    const real = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];
    const r = createReticulum({
        count: 5, directions: dirsFor(5), colors: real, onChange: () => {},
    });
    r.sync({ values: new Array(5).fill(0.2), locked: 4, sum: 1 });
    const hit = pick(r.element, "ret-hit")[0];
    const band = pick(r.element, "ret-band")[0];

    hit.on.pointermove[0](ev(760, 400));
    const fill = (band.getAttribute("fill") || "").toLowerCase();
    assert.ok(fill, "the band has no fill");
    assert.ok(!real.includes(fill), "the band must be lighter than the family colour");

    const live = [...Array(5).keys()].find((j) => lighten(real[j], 0.82) === fill);
    assert.ok(live !== undefined, `${fill} is not a lightened family colour`);

    // a different family gives a different wash
    const first = fill;
    hit.on.pointermove[0](ev(400, 120));
    assert.notEqual((band.getAttribute("fill") || "").toLowerCase(), first);
});

test("lighten mixes toward white and leaves anything it cannot parse alone", () => {
    assert.equal(lighten("#000000", 0), "#000000");
    assert.equal(lighten("#000000", 1), "#ffffff");
    assert.equal(lighten("#e63946", 0.82), "#fbdbde");
    assert.equal(lighten("not a colour", 0.5), "not a colour");
});

test("the drawn line matches the map: raising gamma slides it along -v", () => {
    // The convention, checked against the model rather than against itself.
    // geometry/pentagrid.ts puts line n at x . v_j = n - gamma_j, so a rising
    // gamma moves the family in MINUS v_j. Drawing it the other way made the
    // reticulum a mirror of the thing it is a picture of.
    const { r, axes } = ret(5);
    const posOf = (g) => {
        r.sync({ values: [g, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: g + 0.8 });
        const l = gridOf(axes[0]);
        // axis 0 is +x here, so the signed offset is just x
        return num(l, "x1");
    };
    assert.ok(Math.abs(posOf(0)) < 1e-9, "gamma 0 sits at the centre");
    assert.ok(posOf(0.1) < 0, "raising gamma must move the line to -v");
    assert.ok(posOf(-0.1) > 0, "lowering it must move the line to +v");

    // and it is linear in gamma across the whole range, 2A per unit
    const a = posOf(-0.25), b = posOf(0.25);
    assert.ok(Math.abs((a - b) - A) < 1e-6, `half a unit should be A, got ${a - b}`);
});
