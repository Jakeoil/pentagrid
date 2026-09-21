// The reticulum: n grid directions inside a regular decagon, signed range.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";

import { createReticulum, signedGamma, lighten } from "../dist/ui/reticulum.js";

const COLORS = ["#a", "#b", "#c", "#d", "#e", "#f", "#g"];
// must track the module's constants
const A = 1, CIRC = A / Math.cos(Math.PI / 10), LABEL_R = CIRC + 0.1;
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
    // gamma = 0 puts the line through the CENTER. A radial slider would put it
    // at an end, which is the bug this replaced.
    const { r, axes } = ret(5);
    r.sync({ values: [0, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 0.8 });
    const mid = gridOf(axes[0]);
    // axis 0 is +x, so its line is the vertical chord at x = 0
    assert.ok(Math.abs(num(mid, "x1")) < 1e-9, "gamma 0 must pass through the center");
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

test("nothing sits at the center but the cross — the hub is gone", () => {
    const { r } = ret(5);
    assert.equal(pick(r.element, "ret-hub").length, 0);
    for (const c of r.element.children) {
        assert.notEqual((c.textContent || "").trim(), "Σ", "Sigma is back at the center");
    }
});

test("wheel: a notch snaps to the next tenth, thousandths with shift, and it eats the scroll", () => {
    const moves = [];
    const { hit } = ret(5, { onChange: (j, v) => moves.push([j, +v.toFixed(6)]) });
    hit.on.pointerdown[0](ev(760, 400));
    hit.on.pointerup[0](ev(760, 400));
    const up = ev(760, 400, { deltaY: -1 });
    hit.on.wheel[0](up);
    assert.deepEqual(moves.at(-1), [0, 0.3]);
    assert.ok(up.dp);
    hit.on.wheel[0](ev(760, 400, { deltaY: -1, shiftKey: true }));
    assert.deepEqual(moves.at(-1), [0, 0.201]);
    // from off a tenth, a plain notch lands ON the next tenth, not 0.1 further
    const { r: r2, hit: hit2 } = ret(5, { onChange: (j, v) => moves.push([j, +v.toFixed(6)]) });
    r2.sync({ values: [0.234, 0.2, 0.2, 0.2, 0.2], locked: 4, sum: 1.034 });
    hit2.on.pointerdown[0](ev(760, 400)); hit2.on.pointerup[0](ev(760, 400));
    hit2.on.wheel[0](ev(760, 400, { deltaY: -1 }));
    assert.deepEqual(moves.at(-1), [0, 0.3], "0.234 up a notch is 0.3");
    hit2.on.wheel[0](ev(760, 400, { deltaY: 1 }));
    assert.deepEqual(moves.at(-1), [0, 0.2], "the state did not follow (a bare reticulum); 0.234 down a notch is 0.2");
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

test("the dependent axis is inert, and still swallows the wheel", () => {
    // Doing nothing is fine; scrolling the page out from under an instrument you
    // are aiming at is not "nothing".
    const moves = [];
    const { hit, axes, labels } = ret(5, { onChange: (j) => moves.push(j) });
    assert.match(cls(axes[4]), /dependent/);
    assert.equal(labels[4].getAttribute("fill"), "#aaa");
    const [dx, dy] = dirsFor(5)[4];
    const e = ev(400 + dx * 300, 400 - dy * 300, { deltaY: -1 });
    hit.on.wheel[0](e);
    assert.deepEqual(moves, [], "the dependent axis must not be driven");
    assert.equal(e.dp, true, "but the page must not scroll either");
});

test("shift-wheel arrives on deltaX, and any modifier means fine", () => {
    // Browsers turn shift+wheel into horizontal scroll: deltaY is flat zero and
    // the movement is on deltaX. Reading only deltaY made the fine step do
    // nothing, or work in one direction where the swap did not happen.
    const moves = [];
    const { hit } = ret(5, { onChange: (j, v) => moves.push(+v.toFixed(6)) });
    hit.on.pointerdown[0](ev(760, 400));
    hit.on.pointerup[0](ev(760, 400));

    hit.on.wheel[0](ev(760, 400, { deltaY: 0, deltaX: -1, shiftKey: true }));
    assert.equal(moves.at(-1), 0.201, "shift-wheel on deltaX must still register");
    hit.on.wheel[0](ev(760, 400, { deltaY: 0, deltaX: 1, shiftKey: true }));
    assert.equal(moves.at(-1), 0.199, "and in the other direction");

    for (const mod of ["ctrlKey", "altKey", "metaKey"]) {
        hit.on.wheel[0](ev(760, 400, { deltaY: -1, [mod]: true }));
        assert.equal(moves.at(-1), 0.201, `${mod} should ask for the fine step`);
        hit.on.wheel[0](ev(760, 400, { deltaY: 1, [mod]: true }));
    }
    // a wheel with no movement at all does nothing
    const before = moves.length;
    hit.on.wheel[0](ev(760, 400, { deltaY: 0, deltaX: 0 }));
    assert.equal(moves.length, before);
});

test("n is a parameter: seven families give fourteen sides", () => {
    const { axes, labels, rim } = ret(7);
    assert.equal(axes.length, 7);
    assert.equal(labels.length, 7);
    assert.equal(rim.getAttribute("points").split(" ").length, 14);
});

test("the band wears its own family's color, washed out", () => {
    // Not a fixed pink: the band says WHICH gamma is live, the line says where.
    // Real hex here — the placeholder colors elsewhere are deliberately not
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
    assert.ok(!real.includes(fill), "the band must be lighter than the family color");

    const live = [...Array(5).keys()].find((j) => lighten(real[j], 0.82) === fill);
    assert.ok(live !== undefined, `${fill} is not a lightened family color`);

    // a different family gives a different wash
    const first = fill;
    hit.on.pointermove[0](ev(400, 120));
    assert.notEqual((band.getAttribute("fill") || "").toLowerCase(), first);
});

test("lighten mixes toward white and leaves anything it cannot parse alone", () => {
    assert.equal(lighten("#000000", 0), "#000000");
    assert.equal(lighten("#000000", 1), "#ffffff");
    assert.equal(lighten("#e63946", 0.82), "#fbdbde");
    assert.equal(lighten("not a color", 0.5), "not a color");
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
    assert.ok(Math.abs(posOf(0)) < 1e-9, "gamma 0 sits at the center");
    assert.ok(posOf(0.1) < 0, "raising gamma must move the line to -v");
    assert.ok(posOf(-0.1) > 0, "lowering it must move the line to +v");

    // and it is linear in gamma across the whole range, 2A per unit
    const a = posOf(-0.25), b = posOf(0.25);
    assert.ok(Math.abs((a - b) - A) < 1e-6, `half a unit should be A, got ${a - b}`);
});

test("each gamma shows its canonical thousandths opposite its own symbol", () => {
    // 000..999, the same number the dial bank reports — the decagon places the
    // line by the signed representative, but the two instruments must never
    // disagree about what they are SAYING.
    const { r, axes } = ret(5);
    const valueOf = (j) => pick(r.element, "ret-value")[j];
    const labelOf = (j) => pick(r.element, "ret-label")[j];

    r.sync({ values: [0, 0.2, 0.5, 0.8, 0.999], locked: 4, sum: 2.499 });
    assert.equal(valueOf(0).textContent, "000");
    assert.equal(valueOf(1).textContent, "200");
    assert.equal(valueOf(2).textContent, "500");
    assert.equal(valueOf(3).textContent, "800");
    assert.equal(valueOf(4).textContent, "999");

    // whole turns and negatives read canonically too
    r.sync({ values: [-0.2, 1.2, 0, 0, 0], locked: 4, sum: 1 });
    assert.equal(valueOf(0).textContent, "800", "-0.2 is 800 thousandths");
    assert.equal(valueOf(1).textContent, "200", "1.2 is 200");

    // and it sits on the FAR side from its own symbol
    for (let j = 0; j < 5; j++) {
        const lx = +labelOf(j).getAttribute("x"), ly = +labelOf(j).getAttribute("y");
        const vx = +valueOf(j).getAttribute("x"), vy = +valueOf(j).getAttribute("y");
        assert.ok(lx * vx + ly * vy < 0, `family ${j}: value is not opposite its label`);
    }
});

test("the subscript is its own tspan, not a Unicode subscript character", () => {
    // The subscript characters are drawn too small to read at this size and
    // cannot be sized independently.
    const { r } = ret(5);
    const label = pick(r.element, "ret-label")[3];
    assert.equal(label.textContent, "γ", "the symbol itself is just gamma");
    const sub = label.children.find((c) => (c.getAttribute("class") || "") === "ret-sub");
    assert.ok(sub, "no subscript tspan");
    assert.equal(sub.textContent, "3");
});

test("a push at the dependent axis is refused, visibly", () => {
    const { r, hit } = ret(5);
    const [dx, dy] = dirsFor(5)[4];                 // family 4 is dependent
    const on4 = ev(400 + dx * 300, 400 - dy * 300, { deltaY: -1 });
    hit.on.wheel[0](on4);
    assert.equal(r.element.getAttribute("data-warn"), "1", "no refusal shown");
    assert.equal(on4.dp, true, "and the page still must not scroll");
});

// ── the mount: presets and settings popups ────────────────────────

import { mountReticulum } from "../dist/view/controls.js";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { makeStub } from "./domstub.mjs";

function host() {
    const el = makeStub({ children: [] });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
const walk = (n, f) => { if (!n || !n.children) return; for (const c of n.children) { f(c); walk(c, f); } };

test("the settings popup holds vertical-axis symmetry, and only one popup is open at a time", () => {
    const set = createGammaSet({ guard: true });
    const container = host();
    mountReticulum(set, container, { colors: ["#000", "#000", "#000", "#000", "#000"] });

    const buttons = [], popups = [];
    walk(container, (c) => {
        if (c.className === "ret-bump") buttons.push(c);
        if (String(c.className).includes("ret-presets")) popups.push(c);
    });
    const presetsBtn = buttons.find((b) => b.textContent === "presets");
    const settingsBtn = buttons.find((b) => b.textContent === "settings");
    assert.ok(presetsBtn && settingsBtn, "both buttons exist");
    const presets = popups.find((p) => p.className === "ret-presets");
    const settings = popups.find((p) => String(p.className).includes("ret-settings"));
    assert.ok(presets && settings, "both popups exist");
    assert.equal(settings.hidden, true, "settings starts closed");

    // the checkbox is the gamma set's symmetry, both ways
    let cb = null;
    walk(settings, (c) => { if (c.type === "checkbox") cb = c; });
    assert.ok(cb, "no symmetry checkbox in settings");
    assert.equal(cb.checked, true, "symmetry is on by default");
    cb.checked = false;
    cb.on.change.forEach((f) => f({}));
    assert.equal(set.getSymmetry(), false, "unchecking turns the frame back");
    set.setSymmetry(true);
    assert.equal(cb.checked, true, "and the box follows the set");

    // one popup at a time
    settingsBtn.on.click.forEach((f) => f({}));
    assert.equal(settings.hidden, false);
    presetsBtn.on.click.forEach((f) => f({}));
    assert.equal(presets.hidden, false);
    assert.equal(settings.hidden, true, "opening presets closes settings");
    settingsBtn.on.click.forEach((f) => f({}));
    assert.equal(presets.hidden, true, "and the other way round");

    // choosing a preset leaves the popup up; only its own button dismisses it
    settingsBtn.on.click.forEach((f) => f({}));
    presetsBtn.on.click.forEach((f) => f({}));
    assert.equal(presets.hidden, false);
    let star = null;
    walk(presets, (c) => { if (c.textContent === "star") star = c; });
    assert.ok(star, "no star preset");
    star.on.click.forEach((f) => f({}));
    assert.equal(presets.hidden, false, "a preset click must not close the popup");
    assert.ok(set.values().every((v) => Math.abs(v - 0.4) < 1e-9), "and it applied");
    presetsBtn.on.click.forEach((f) => f({}));
    assert.equal(presets.hidden, true, "the button dismisses it");
});

test("mirror: pairs move together, gamma0 floats, and the total is held at 1", () => {
    const set = createGammaSet({ guard: false });
    set.setValues([0.07, 0.11, 0.13, 0.17, -0.48]);      // no symmetry at all
    const container = host();
    mountReticulum(set, container, { colors: ["#000", "#000", "#000", "#000", "#000"] });
    const boxes = [];
    walk(container, (c) => { if (c.className === "ret-check") boxes.push(c); });
    const label = (b) => b.children.map((c) => c.textContent ?? "").join("").trim();
    const mirrorBox = boxes.find((b) => label(b).includes("mirror"));
    const symBox = boxes.find((b) => label(b).includes("symmetric"));
    assert.ok(mirrorBox && symBox, "both checkboxes exist");
    const mirrorCb = mirrorBox.children.find((c) => c.type === "checkbox");
    const symCb = symBox.children.find((c) => c.type === "checkbox");

    mirrorCb.checked = true;
    mirrorCb.on.change.forEach((f) => f({}));
    const g = set.values();
    const eq = (a, b) => Math.abs(a - b) < 1e-9;
    assert.ok(eq(g[1], g[4]) && eq(g[2], g[3]), `not mirrored: ${g}`);
    assert.ok(eq(g.reduce((a, b) => a + b, 0), 1), `sum is ${g.reduce((a, b) => a + b, 0)}, not 1`);
    assert.equal(set.getLocked(), 0, "gamma0 is the float");
    assert.ok(eq(g[1], -0.185) && eq(g[2], 0.15), `pairs folded to their means: ${g}`);
    assert.ok(eq(g[0], 1.07), "gamma0 makes up the total");

    // a wheel notch on axis 1 carries axis 4 with it, and gamma0 absorbs
    let hit = null;
    walk(container, (c) => { if (cls(c).startsWith("ret-hit")) hit = c; });
    const [dx, dy] = set.model.directions[1];
    const p = ev(400 + 300 * dx, 400 - 300 * dy, { deltaY: -1 });
    hit.on.pointerdown[0](p); hit.on.pointerup[0](p);
    hit.on.wheel[0](p);
    const h = set.values();
    assert.ok(eq(h[1], -0.1) && eq(h[4], -0.1), `pair did not move together, to the next tenth: ${h}`);
    assert.ok(eq(h[2], 0.15) && eq(h[3], 0.15), "the other pair is untouched");
    assert.ok(eq(h[0], 1 - 2 * (-0.1) - 0.3), "gamma0 floated to hold the total");

    // the mirror is gamma0's axis wherever the frame puts it: with vertical-axis
    // symmetry off the pairing is the same, about the horizontal
    set.setSymmetry(false);
    const [dx2, dy2] = set.model.directions[2];
    const p2 = ev(400 + 300 * dx2, 400 - 300 * dy2, { deltaY: -1 });
    hit.on.pointerdown[0](p2); hit.on.pointerup[0](p2);
    hit.on.wheel[0](p2);
    const k = set.values();
    assert.ok(eq(k[2], 0.2) && eq(k[3], 0.2), `pair 2-3 did not move together: ${k}`);
    assert.equal(set.getSymmetry(), false, "the mode does not touch the frame");

    // symmetric and mirror are exclusive
    symCb.checked = true; symCb.on.change.forEach((f) => f({}));
    assert.equal(mirrorCb.checked, false);
    mirrorCb.checked = true; mirrorCb.on.change.forEach((f) => f({}));
    assert.equal(symCb.checked, false);
});

test("symmetric: the total is the knob; the gammas float, marked at the five settings for its phase, and a notch steps among them", () => {
    const set = createGammaSet({ guard: false });
    set.setLocked(-1);
    set.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);                     // the sun, Σγ = 1
    const container = host();
    mountReticulum(set, container, { colors: ["#000", "#000", "#000", "#000", "#000"] });
    const boxes = [];
    walk(container, (c) => { if (c.className === "ret-check") boxes.push(c); });
    const label = (b) => b.children.map((c) => c.textContent ?? "").join("").trim();
    const symCb = boxes.find((b) => label(b).includes("symmetric")).children.find((c) => c.type === "checkbox");
    symCb.checked = true; symCb.on.change.forEach((f) => f({}));

    let hit = null, stripHit = null, ticks = null; const axes = [];
    walk(container, (c) => {
        const k = cls(c);
        if (k.startsWith("ret-hit")) hit = c;
        if (k.startsWith("ret-axis")) axes.push(c);
        if (k.startsWith("ret-ticks")) ticks = c;
        if (k.startsWith("ss-hit")) stripHit = c;
    });
    const eq = (a, b) => Math.abs(a - b) < 1e-9;
    const dependent = () => axes.filter((a) => cls(a).includes("dependent")).length;
    const lit = () => axes.filter((a) => cls(a).includes("live")).length;
    assert.equal(dependent(), 5, "the gammas float (ghosted)");

    // the total is solid: a notch is a tenth, and the gammas follow as Σγ/5
    stripHit.on.wheel[0](ev(0, 0, { deltaY: 1 }));                // 1.0 -> 0.9
    assert.ok(eq(set.getSum(), 0.9), `the total steps by a tenth: ${set.getSum()}`);
    assert.ok(set.values().every((v) => eq(v, 0.18)), `and the gammas are Σγ/5: ${set.values()}`);
    // set it to a phase of 0.5: the marks slide to 100, 300, 500, 700, 900
    set.setSum(0.5, true);
    const [dx, dy] = set.model.directions[1];
    const p = ev(400 + 300 * dx, 400 - 300 * dy, { deltaY: -1 });
    hit.on.pointerdown[0](p); hit.on.pointerup[0](p);             // axis 1 live
    assert.equal(lit(), 5, "every axis is lit while one is live");
    const marks = ticks.getAttribute("d").split("M").filter(Boolean).length;
    assert.equal(marks, 25, "five marks on each of five axes");
    // a notch on an axis steps c by a fifth: 0.1 -> 0.3, the total by one
    hit.on.wheel[0](p);
    assert.ok(set.values().every((v) => eq(v, 0.3)), `a notch steps every gamma by a fifth: ${set.values()}`);
    assert.ok(eq(set.getSum(), 1.5), "the total went up by one, same phase");
    hit.on.wheel[0](p);
    assert.ok(set.values().every((v) => eq(v, 0.5)), "and again: 500");
    hit.on.wheel[0](ev(400 + 300 * dx, 400 - 300 * dy, { deltaY: 1 }));
    assert.ok(set.values().every((v) => eq(v, 0.3)), "and back");
});
test("the live axis shows five fifth marks, the size of the cross arm, and none when nothing is live", () => {
    const { r, hit } = ret(5);
    const ticksOf = () => pick(r.element, "ret-ticks")[0];
    assert.ok(ticksOf(), "the ticks path exists");
    assert.equal(ticksOf().getAttribute("opacity"), "0", "off while nothing is live");
    assert.equal(ticksOf().getAttribute("stroke-width"), "0.007", "thin, as an attribute — not left to a stylesheet");
    assert.equal(ticksOf().getAttribute("fill"), "none");
    hit.on.pointerdown[0](ev(760, 400)); hit.on.pointerup[0](ev(760, 400));   // axis 0 live
    assert.equal(ticksOf().getAttribute("opacity"), "0.75");
    const d = ticksOf().getAttribute("d");
    const segs = d.split("M").filter(Boolean);
    assert.equal(segs.length, 5, "one tick per fifth: 0, .2, .4, .6, .8");
    // each is 2 * 0.055 A long, across the axis: axis 0 is along x, so the ticks are vertical
    for (const sg of segs) {
        const [a, b] = sg.split("L").map((p) => p.trim().split(" ").map(Number));
        assert.ok(Math.abs(a[0] - b[0]) < 1e-6, "a tick crosses the axis");
        assert.ok(Math.abs(Math.abs(a[1] - b[1]) - 0.11) < 1e-3, `a tick is the cross arm's length, got ${Math.abs(a[1] - b[1])}`);
    }
    // they sit where the line would at those gammas: x = -signed(k/5)*2A,
    // i.e. 0, -0.4, -0.8, +0.8, +0.4
    const xs = segs.map((sg) => +sg.split("L")[0].trim().split(" ")[0]).sort((p, q) => p - q);
    assert.deepEqual(xs.map((x) => +x.toFixed(3)), [-0.8, -0.4, 0, 0.4, 0.8]);
});

test("one flick, one notch: a burst of coarse wheel events within 90 ms is one step; fine steps are not gated", () => {
    const moves = [];
    const { hit } = ret(5, { onChange: (j, v) => moves.push(+v.toFixed(6)) });
    hit.on.pointerdown[0](ev(760, 400)); hit.on.pointerup[0](ev(760, 400));
    // a trackpad burst: five events 16 ms apart
    for (let i = 0; i < 5; i++) hit.on.wheel[0](ev(760, 400, { deltaY: -1, timeStamp: 1000 + i * 16 }));
    assert.equal(moves.length, 1, `a burst is one step, got ${moves.length}`);
    // the next gesture, 200 ms later, is another
    hit.on.wheel[0](ev(760, 400, { deltaY: -1, timeStamp: 1300 }));
    assert.equal(moves.length, 2);
    // fine steps come through every time
    for (let i = 0; i < 4; i++) hit.on.wheel[0](ev(760, 400, { deltaY: -1, shiftKey: true, timeStamp: 1400 + i * 10 }));
    assert.equal(moves.length, 6);
});

// ── the units follow n ────────────────────────────────────────────

test("at n = 7 a turn is 1400 units, the marks are the sevenths, a notch is 100 units; five is untouched", () => {
    // seven
    const set = createGammaSet({ guard: false, n: 7 });
    set.setLocked(-1);
    set.setValues(new Array(7).fill(1 / 7));
    const container = host();
    mountReticulum(set, container, { colors: ["#1", "#2", "#3", "#4", "#5", "#6", "#7"] });
    const values = [], axes = []; let hit = null, ticks = null, readout = null, stripHit = null;
    walk(container, (c) => {
        const k = cls(c);
        if (k.startsWith("ret-value")) values.push(c);
        if (k.startsWith("ret-axis")) axes.push(c);
        if (k.startsWith("ret-hit")) hit = c;
        if (k.startsWith("ret-ticks")) ticks = c;
        if (k.startsWith("ss-readout")) readout = c;
        if (k.startsWith("ss-hit")) stripHit = c;
    });
    assert.equal(values.length, 7);
    assert.equal(values[0].textContent, "0200", "1/7 of 1400 is 200, four digits");
    assert.equal(readout.textContent, "0000", "Σγ = 1: phase 0 of 1400");
    // a notch: 100 units, to 300; the marks at the sevenths
    const [dx, dy] = set.model.directions[1];
    const p = ev(400 + 300 * dx, 400 - 300 * dy, { deltaY: -1 });
    hit.on.pointerdown[0](p); hit.on.pointerup[0](p); hit.on.wheel[0](p);
    assert.ok(Math.abs(set.values()[1] - (1 / 7 + 1 / 14)) < 1e-9, `a notch is 1/14: ${set.values()[1]}`);
    assert.equal(values[1].textContent, "0300");
    const segs = ticks.getAttribute("d").split("M").filter(Boolean);
    assert.equal(segs.length, 7, "seven marks on the live axis");
    // no generation row off five
    let gen = null; walk(container, (c) => { if (String(c.className).includes("ret-gen")) gen = c; });
    assert.ok(gen && gen.hidden, "the λ row is the pentagrid's");

    // five, exactly as before: thousandths, three digits, a notch a tenth
    const five = createGammaSet({ guard: false });
    five.setLocked(-1); five.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
    const c5 = host();
    mountReticulum(five, c5, { colors: ["#1", "#2", "#3", "#4", "#5"] });
    const v5 = []; walk(c5, (c) => { if (cls(c).startsWith("ret-value")) v5.push(c); });
    assert.equal(v5[0].textContent, "200");
});
