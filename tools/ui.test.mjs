// Tests for the two reusable clusters. "Reusable" is a claim, and the way to
// check it is to drive them with no pentagrid anywhere in sight.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";
import { createGammaBank } from "../dist/ui/dials.js";
import { createReticulum } from "../dist/ui/reticulum.js";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { mountReticulum, wheelSteps } from "../dist/view/controls.js";
import { createLoupe } from "../dist/ui/loupe.js";

const COLORS = ["#a", "#b", "#c", "#d", "#e"];

// ── the γ bank ────────────────────────────────────────────────────

function bank(over = {}) {
    const seen = { changes: [], locks: [] };
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => seen.changes.push([i, v]),
        onLock: (i) => seen.locks.push(i),
        ...over,
    });
    // element children are the five dials plus the sum readout
    const dials = b.element.children.slice(0, 5);
    const inputs = dials.map((d) => d.children[1]);
    const labels = dials.map((d) => d.children[0]);
    return { b, seen, dials, inputs, labels };
}

test("builds one dial per value, plus a sum readout", () => {
    const { b } = bank();
    assert.equal(b.element.children.length, 6);
});

test("reports which slider moved, and to what", () => {
    const { seen, inputs } = bank();
    inputs[2].value = "0.75";
    inputs[2].on.input[0]();
    assert.deepEqual(seen.changes, [[2, 0.75]]);
});

test("reports a lock request without acting on it", () => {
    const { b, seen, labels } = bank();
    labels[3].on.click[0]();
    assert.deepEqual(seen.locks, [3]);
    // it did not lock anything itself — that is the page's call
    assert.equal(b.element.children[3].className, "dial");
});

test("sync renders the state it is given", () => {
    const { b, dials, inputs } = bank();
    b.sync({ values: [0.1, -0.2, 0.3, -0.4, 0.2], locked: 4, sum: 0 });
    assert.equal(dials[0].children[2].textContent, "0.100");
    assert.equal(dials[4].className, "dial computed");
    assert.equal(dials[0].className, "dial");
    assert.equal(inputs[4].disabled, true);
    assert.equal(inputs[0].disabled, false);
});

test("sync writes back to every slider except the one under a held pointer", () => {
    // It used to write back only the computed one, which was right while dragging
    // was the only input. A wheel notch changes a value without touching its
    // thumb, so every other slider now has to follow or it drifts from its number.
    const { b, inputs } = bank();
    inputs[0].on.pointerdown[0]();          // this one is being dragged
    inputs[0].value = "MIDDRAG";
    inputs[2].value = "stale";
    inputs[4].value = "stale";
    b.sync({ values: [1, 0, 0.25, 0, -1], locked: 4, sum: 0.25 });

    assert.equal(inputs[0].value, "MIDDRAG", "wrote back over the slider under the thumb");
    assert.equal(inputs[2].value, "0.250000", "an idle slider must follow the model");
    // the thumb shows the offset modulo 1, so the computed -1 sits at 0
    assert.equal(inputs[4].value, "0.000000");

    inputs[0].on.pointerup[0]();            // released — it must rejoin the model
    b.sync({ values: [0.5, 0, 0.25, 0, -0.75], locked: 4, sum: 0 });
    assert.equal(inputs[0].value, "0.500000", "a released slider must follow again");
});

test("a slider that merely has focus still follows the wheel", () => {
    // The bug this replaced: focus was used as the test for "being dragged", but a
    // slider stays FOCUSED after you let go. So one click on a dial froze its thumb
    // for the rest of the session while the wheel went on changing the number.
    const { b, inputs } = bank();
    b.sync({ values: [0.2, 0, 0, 0, 0], locked: 4, sum: 0.2 });
    globalThis.document.activeElement = inputs[0];      // clicked once, still focused
    b.sync({ values: [0.21, 0, 0, 0, 0], locked: 4, sum: 0.21 });
    globalThis.document.activeElement = undefined;
    assert.equal(inputs[0].value, "0.210000",
                 "focus is not a drag — the thumb must follow the value");
});

test("the bank knows nothing about what the constraint is", () => {
    // Σ is whatever the page says it is; the bank just prints it.
    const { b } = bank();
    b.sync({ values: [9, 9, 9, 9, 9], locked: 0, sum: 45 });
    assert.equal(b.element.children[5].textContent, "Σ = 45.0000");
});

// ── the loupe ─────────────────────────────────────────────────────

function loupe(over = {}) {
    const container = { children: [], appendChild(c) { this.children.push(c); return c; } };
    const seen = { renders: [], hovers: [] };
    const l = createLoupe({
        container,
        render: (ctx, view, size) => seen.renders.push({ view: { ...view }, size }),
        onHover: (x, y) => { seen.hovers.push([x, y]); return "hi"; },
        ...over,
    });
    return { l, seen, container };
}

test("starts closed and invisible", () => {
    const { l, seen } = loupe();
    assert.equal(l.view, null);
    assert.equal(l.element.style.display, "none");
    assert.equal(seen.renders.length, 0);
});

test("open scales the host's scale by the target's magnification", () => {
    const { l, seen } = loupe();
    l.open({ x: 2, y: -3, mag: 40, label: "region" }, 60);
    assert.deepEqual(l.view, { x: 2, y: -3, scale: 2400 });
    assert.equal(l.element.style.display, "block");
    assert.equal(seen.renders.at(-1).view.scale, 2400);
    assert.equal(seen.renders.at(-1).size, 220);
});

test("re-opening the same target does not re-latch the magnification", () => {
    const { l } = loupe();
    l.open({ x: 1, y: 1, mag: 10, label: "a" }, 60);
    l.open({ x: 1, y: 1, mag: 900, label: "a" }, 60);
    assert.equal(l.view.scale, 600, "magnification moved under the cursor");
    // a different target does retarget
    l.open({ x: 2, y: 1, mag: 900, label: "b" }, 60);
    assert.equal(l.view.scale, 54000);
});

test("close hides it and forgets the view", () => {
    const { l } = loupe();
    l.open({ x: 0, y: 0, mag: 10, label: "x" }, 60);
    l.close();
    assert.equal(l.view, null);
    assert.equal(l.element.style.display, "none");
});

test("entering freezes it; leaving releases", () => {
    const { l } = loupe();
    l.open({ x: 0, y: 0, mag: 10, label: "x" }, 60);
    assert.equal(l.frozen, false);
    l.element.on.mouseenter[0]();
    assert.equal(l.frozen, true, "entering must latch, or traveling to it retargets");
    l.element.on.mouseleave[0]();
    assert.equal(l.frozen, false);
});

test("hovering inside reports host coordinates, not panel pixels", () => {
    const { l, seen } = loupe();
    l.open({ x: 5, y: 5, mag: 1, label: "x" }, 100);   // scale 100, size 220
    l.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 220 });
    l.element.on.mousemove[0]({ clientX: 110, clientY: 110 });   // dead center
    assert.deepEqual(seen.hovers.at(-1), [5, 5], "center of the panel is the target");
    l.element.on.mousemove[0]({ clientX: 210, clientY: 110 });   // 100px right
    const [hx, hy] = seen.hovers.at(-1);
    assert.ok(Math.abs(hx - 6) < 1e-9, `x ${hx}`);   // 100px at scale 100 = 1 unit
    assert.ok(Math.abs(hy - 5) < 1e-9, `y ${hy}`);
});

test("it is not told what it is magnifying", () => {
    // the whole point: no pentagrid was imported by this file's loupe tests
    const { l, seen } = loupe({ render: (ctx, view, size) => seen.renders.push(size) });
    l.open({ x: 0, y: 0, mag: 3, label: "anything at all" }, 1);
    assert.equal(seen.renders.at(-1), 220);
});

// ── the sum belongs to the cluster ────────────────────────────────

test("the bank grows a total slider only when asked, and stays a pure view", () => {
    const seen = [];
    const plain = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
    });
    const withSum = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
        onSum: (v) => seen.push(v),
    });
    assert.equal(plain.element.children.length, 6, "five dials and a readout");
    assert.equal(withSum.element.children.length, 8, "a total, and its note");

    // it reports the move; it does not decide what a total means
    const dial = withSum.element.children[6];
    const input = dial.children[1];
    input.value = "1.75";
    input.on.input[0]();
    assert.deepEqual(seen, [1.75]);
});

test("sync renders the total and its note, but not over a drag", () => {
    const b = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
        onSum: () => {},
    });
    const input = b.element.children[6].children[1];
    // The note is a sibling of the dial, not a child of it: inside the dial its
    // text length set the flex item's width, so the bar reflowed on every step.
    const note = b.element.children[7];
    b.sync({ values: [0.5, 0.5, 0.5, 0.5, 0.5], locked: 4, sum: 2.5,
             sumNote: "largest pentagon" });
    assert.equal(input.value, "2.500000");
    assert.equal(note.textContent, "largest pentagon");

    // while the user holds it, leave it alone
    input.on.pointerdown[0]();
    b.sync({ values: [0, 0, 0, 0, 0], locked: 4, sum: 0, sumNote: "x" });
    assert.equal(input.value, "2.500000", "wrote back over a slider being dragged");
    input.on.pointerup[0]();
    b.sync({ values: [0, 0, 0, 0, 0], locked: 4, sum: 0, sumNote: "x" });
    assert.equal(input.value, "0.000000", "released, the total must follow again");
});

// ── the wheel ─────────────────────────────────────────────────────

const wheelEvt = (deltaY, shiftKey = false) => ({
    deltaY, shiftKey, preventDefault() { this.defaulted = true; }, defaulted: false,
});

/** Spin the wheel over dial j and return what the bank reported. */
function spin(bank, j, e) {
    const dial = bank.element.children[j];
    dial.on.wheel[0](e);
}

test("the wheel nudges by hundredths, and by thousandths with shift", () => {
    const moves = [];
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => moves.push([i, v]), onLock: () => {},
    });
    b.sync({ values: [0.3, 0, 0, 0, 0], locked: 4, sum: 0.3 });

    spin(b, 0, wheelEvt(-1));            // wheel up
    assert.equal(moves.length, 1);
    assert.equal(moves[0][0], 0);
    assert.ok(Math.abs(moves[0][1] - 0.31) < 1e-9, `got ${moves[0][1]}`);

    spin(b, 0, wheelEvt(1));             // wheel down
    assert.ok(Math.abs(moves[1][1] - 0.29) < 1e-9, `got ${moves[1][1]}`);

    spin(b, 0, wheelEvt(-1, true));      // shift = a tenth of the step
    assert.ok(Math.abs(moves[2][1] - 0.301) < 1e-9, `got ${moves[2][1]}`);
});

test("the wheel reports a continuous value; only the display wraps mod 1", () => {
    // Wrapping the stored value looks equivalent and is not. With an index holding
    // the sum, recording 0.99 + 0.01 as 0.00 keeps Σγ nominally put and makes the
    // locked offset absorb -0.99 — a real move of another family. That was the
    // bank jumping once per lap.
    const moves = [];
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => moves.push(v), onLock: () => {},
    });

    b.sync({ values: [0.995, 0, 0, 0, 0], locked: 4, sum: 0.995 });
    spin(b, 0, wheelEvt(-1));
    assert.ok(Math.abs(moves[0] - 1.005) < 1e-9,
              `the value must run on past 1, got ${moves[0]}`);

    // but a value past the turn is SHOWN, and placed, modulo 1
    b.sync({ values: [1.005, 0, 0, 0, 0], locked: 4, sum: 1.005 });
    const dial = b.element.children[0];
    assert.equal(dial.children[2].textContent, "0.005", "readout must wrap");
    assert.equal(dial.children[1].value, "0.005000", "thumb must wrap");
    assert.equal(dial.children[2].title, "1.005000",
                 "hover must admit the true unwrapped value");
});

test("one offset wheeled a full turn never jerks another", () => {
    // The regression this replaced: at the wrap the locked offset leapt 0.99.
    const seen = [];
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => seen.push(v), onLock: () => {},
    });
    let v = 0.9;
    for (let i = 0; i < 30; i++) {
        b.sync({ values: [v, 0, 0, 0, 0], locked: 4, sum: v });
        spin(b, 0, wheelEvt(-1));
        const next = seen[seen.length - 1];
        assert.ok(Math.abs(next - v - 0.01) < 1e-9,
                  `notch ${i} moved ${next - v}, not 0.01`);
        v = next;
    }
    assert.ok(v > 1.1, "should have run past a full turn without wrapping");
});

test("the wheel does not drive the computed dial, and eats the page scroll", () => {
    const moves = [];
    const b = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (i, v) => moves.push(i), onLock: () => {},
    });
    b.sync({ values: [0, 0, 0, 0, 0], locked: 4, sum: 0 });

    const onLocked = wheelEvt(-1);
    spin(b, 4, onLocked);
    assert.deepEqual(moves, [], "the locked dial is computed, not driven");
    assert.equal(onLocked.defaulted, false, "should let the page scroll over it");

    const onFree = wheelEvt(-1);
    spin(b, 1, onFree);
    assert.deepEqual(moves, [1]);
    assert.ok(onFree.defaulted, "must swallow the scroll it acted on");
});

test("the readout shows thousandths and the exact value on hover", () => {
    const b = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
    });
    b.sync({ values: [0.1234, 0, 0, 0, 0], locked: 4, sum: 0.1234 });
    const display = b.element.children[0].children[2];
    // two places would have hidden a shift-wheel notch entirely
    assert.equal(display.textContent, "0.123");
    assert.equal(display.title, "0.123400", "hover must carry the exact value");
});

test("a wheel-set value survives the write-back to the slider", () => {
    // The slider snaps `.value` onto its step grid, and it used only to be written
    // for the locked index. A thousandth had to survive both.
    const b = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
    });
    b.sync({ values: [0.007, 0, 0, 0, 0], locked: 4, sum: 0.007 });
    assert.equal(b.element.children[0].children[1].value, "0.007000");
});

test("the total clamps at its ends instead of wrapping", () => {
    // The sum is not an offset: its distinguished values are spread over 0..n/2,
    // so wrapping would jump between them.
    const sums = [];
    const b = createGammaBank({
        count: 5, colors: COLORS, onChange: () => {}, onLock: () => {},
        onSum: (v) => sums.push(v), sumRange: { min: 0, max: 2.5, step: 0.001 },
    });
    b.sync({ values: [0.5, 0.5, 0.5, 0.5, 0.5], locked: 4, sum: 2.5 });
    b.element.children[6].on.wheel[0](wheelEvt(-1));
    assert.equal(sums[0], 2.5, "must not wrap past the top");

    b.sync({ values: [0, 0, 0, 0, 0], locked: 4, sum: 0 });
    b.element.children[6].on.wheel[0](wheelEvt(1));
    assert.equal(sums[1], 0, "must not wrap below zero");
});

// ── the two instruments over one state ────────────────────────────

test("the dial bank and the reticulum stay in step over one gamma set", () => {
    // The requirement that breaks silently: two views, one source of truth. They
    // disagree about the NUMBER — 0.8 in the bank is -0.2 on the reticulum — and
    // must never disagree about the gamma.
    const set = createGammaSet();
    set.setSum(1, true);

    const seen = [];
    const bank = createGammaBank({
        count: 5, colors: COLORS,
        onChange: (j, v) => set.setValue(j, v), onLock: (j) => set.setLocked(j),
    });
    const ret = createReticulum({
        count: 5, directions: set.model.directions, colors: COLORS,
        onChange: (j, v) => { seen.push(v); set.setValue(j, v); },
        onLock: (j) => set.setLocked(j),
    });
    const push = () => {
        const values = set.values();
        const state = { values, locked: set.getLocked(), sum: set.getSum() };
        bank.sync(state);
        ret.sync(state);
    };
    set.onChange(push);
    push();

    // drive the bank, read the reticulum
    const dial = bank.element.children[1];        // the wrap carries the wheel
    dial.on.wheel[0]({ deltaY: -1, shiftKey: false, preventDefault() {} });
    const g1 = set.values()[1];
    const line = ret.element.children.filter((c) =>
        (c.getAttribute("class") || "").startsWith("ret-axis"))[1]
        .children.filter((c) => c.getAttribute("class") === "ret-grid")[0];
    assert.ok(line, "the reticulum drew no line for that family");
    assert.ok(Math.abs(g1 - 0.21) < 1e-9, `the bank moved gamma-1 to ${g1}`);

    // Drive the reticulum, read the bank. Aim straight up: with the star set for
    // vertical symmetry that is family 0, and family 4 is the dependent one.
    const hit = ret.element.children.filter(
        (c) => (c.getAttribute("class") || "") === "ret-hit")[0];
    const up = { clientX: 400, clientY: 100, preventDefault() {}, stopPropagation() {} };
    hit.on.pointerdown[0](up);
    hit.on.pointerup[0](up);
    hit.on.wheel[0]({ ...up, deltaY: -1, shiftKey: false });
    assert.ok(seen.length > 0, "the reticulum reported nothing");
    assert.equal(bank.element.children[0].children[2].textContent,
                 set.values()[0].toFixed(3), "the bank did not follow the reticulum");

    // and the dependent index is shared, not reimplemented by either view
    set.setLocked(-1);
    push();
    assert.equal(set.getLocked(), -1);
    assert.match(bank.element.children[5].className, /computed/,
                 "the bank must gray Sigma when nothing holds the total");
    const axes = ret.element.children.filter((c) =>
        (c.getAttribute("class") || "").startsWith("ret-axis"));
    for (const a of axes) {
        assert.doesNotMatch(a.getAttribute("class"), /dependent/,
                            "no axis is dependent once the total is released");
    }
});

test("Sigma is a phase too: 000..999, graduated in fifths, same touch", () => {
    // Gamma is a phase rather than a scalar, and so is the total. Sigma-gamma
    // mod 1 is also the LI class, so the phase is the number worth showing; the
    // unwrapped total is on hover.
    const set = createGammaSet({ guard: false });
    set.setSum(1, true);
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });

    const strip = host.children[0].children[1];
    const cls = (c) => c.getAttribute("class") || "";
    const kids = strip.children;
    const hit = kids.find((c) => cls(c) === "ss-hit");
    const bed = kids.find((c) => cls(c) === "ss-bed");
    const ticks = kids.find((c) => cls(c) === "ss-ticks");
    const sigma = kids.find((c) => cls(c) === "ss-sigma");
    const readout = kids.find((c) => cls(c) === "ss-readout");
    assert.ok(hit && bed && ticks && sigma && readout, "the strip is missing a part");

    // one turn across, graduated at the four fifths, plus the two thirds --
    // which are stops rather than graduations and carry their own class.
    const fifths = ticks.children.filter((c) => cls(c) === "ss-tick");
    const thirds = ticks.children.filter((c) => cls(c) === "ss-tick ss-third");
    assert.equal(fifths.length, 4, "fifths only: 1/5, 2/5, 3/5, 4/5");
    assert.equal(thirds.length, 2, "1/3 and 2/3 are marked");

    // the phase, not the total
    assert.equal(readout.textContent, "000", "Σγ = 1 is phase 000");
    set.setSum(1.2, true);
    assert.equal(readout.textContent, "200");
    set.setSum(-0.2, true);
    assert.equal(readout.textContent, "800", "and it wraps like a gamma");

    // same touch as an axis: unclamped in both directions, modifier for fine
    set.setSum(0, true);
    hit.on.wheel[0]({ deltaY: 1, preventDefault() {} });
    assert.ok(set.getSum() < 0, `must go below zero, got ${set.getSum()}`);
    hit.on.wheel[0]({ deltaY: -1, preventDefault() {} });
    assert.ok(Math.abs(set.getSum()) < 1e-9, "and back symmetrically");
    hit.on.wheel[0]({ deltaY: 0, deltaX: -1, shiftKey: true, preventDefault() {} });
    assert.ok(Math.abs(set.getSum() - 0.001) < 1e-9,
              `shift-wheel on deltaX: ${set.getSum()}`);

    // pressing Σ releases the total
    sigma.on.pointerdown[0]({ stopPropagation() {} });
    assert.equal(set.getLocked(), -1);
    assert.match(strip.getAttribute("class"), /released/);
});

test("symmetric mode couples every gamma and releases the total", () => {
    // Equal offsets with a held total can only meet at g = k/n, so keeping the
    // constraint would fight every move. Releasing it is the honest coupling.
    const set = createGammaSet({ guard: false });
    set.setSum(1, true);
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });

    const wrap = host.children[0];
    const tools = wrap.children[2];
    const symInput = tools.children[0].children[0];

    assert.equal(set.getLocked(), 4, "constrained to begin with");
    symInput.checked = true;
    symInput.on.change[0]();
    assert.equal(set.getLocked(), -1, "symmetric mode must release the total");
    const vals = set.values();
    assert.ok(vals.every((v) => Math.abs(v - vals[0]) < 1e-9), `not equal: ${vals}`);

    // driving any one of them moves all of them
    const hit = wrap.children[0].children.filter(
        (c) => (c.getAttribute("class") || "") === "ret-hit")[0];
    const up = { clientX: 400, clientY: 100, preventDefault() {}, stopPropagation() {} };
    hit.on.pointerdown[0](up);
    hit.on.pointerup[0](up);
    hit.on.wheel[0]({ ...up, deltaY: -1, shiftKey: false });
    const after = set.values();
    assert.ok(after.every((v) => Math.abs(v - after[0]) < 1e-9),
              `symmetric mode broke equality: ${after}`);
    assert.ok(Math.abs(after[0] - (vals[0] + 0.2)) < 1e-9, "the coupled move was wrong: a notch is a fifth, the next setting for the total's phase");

    // and Σγ = n·g floats with it
    assert.ok(Math.abs(set.getSum() - 5 * after[0]) < 1e-9);
});


test("the Sigma strip drags like an axis, one turn across the bed", () => {
    const set = createGammaSet({ guard: false });
    set.setSum(0, true);
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });
    const strip = host.children[0].children[1];
    const hit = strip.children.find((c) => c.getAttribute("class") === "ss-hit");

    // the stub lays the svg out 800 wide; the bed runs from 12 to 79 of 100 units
    const pd = (x) => ({ clientX: x, pointerId: 1, preventDefault() {} });
    hit.on.pointerdown[0](pd(100));
    hit.on.pointermove[0](pd(100 + 800 * (67 / 100) / 2));   // half the bed
    assert.ok(Math.abs(set.getSum() - 0.5) < 0.02,
              `half the bed should be half a turn, got ${set.getSum()}`);
    hit.on.pointerup[0](pd(0));
});

test("a released total refuses a push instead of graying politely", () => {
    // Graying said "fine, carry on" in the same language as everything merely
    // inactive, so pushing against it looked like it worked. It did something
    // too: setSum on a released set spreads the offsets evenly.
    const set = createGammaSet({ guard: false });
    set.setValues([0.1, 0.2, 0.3, 0.15, 0.05]);
    set.setLocked(-1);
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });
    const strip = host.children[0].children[1];
    const hit = strip.children.find((c) => c.getAttribute("class") === "ss-hit");

    const before = set.exact().slice();
    hit.on.wheel[0]({ deltaY: -1, preventDefault() {} });
    assert.deepEqual(set.exact(), before, "a released total must not be settable");
    assert.match(strip.getAttribute("class"), /warn/, "and it must say so");

    hit.on.pointerdown[0]({ clientX: 100, pointerId: 1, preventDefault() {} });
    hit.on.pointermove[0]({ clientX: 400, pointerId: 1, preventDefault() {} });
    assert.deepEqual(set.exact(), before, "nor dragged");
});

test("the Sigma strip's wheel snaps to the next tenth, thousandths with a modifier", () => {
    const set = createGammaSet({ guard: false });
    set.setSum(1.034);
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });
    const strip = host.children[0].children[1];
    const hit = strip.children.find((c) => c.getAttribute("class") === "ss-hit");
    hit.on.wheel[0]({ deltaY: -1, preventDefault() {} });
    assert.ok(Math.abs(set.getSum() - 1.1) < 1e-9, `1.034 up a notch is 1.1, got ${set.getSum()}`);
    hit.on.wheel[0]({ deltaY: 1, preventDefault() {} });
    hit.on.wheel[0]({ deltaY: 1, preventDefault() {} });
    assert.ok(Math.abs(set.getSum() - 0.9) < 1e-9, `and two down is 0.9, got ${set.getSum()}`);
    hit.on.wheel[0]({ deltaY: -1, shiftKey: true, preventDefault() {} });
    assert.ok(Math.abs(set.getSum() - 0.901) < 1e-9, `shift: a thousandth, got ${set.getSum()}`);
});

// ── scrolling a slider ────────────────────────────────────────────

/** A range input, just enough of one to be wheeled. */
function slider({ value = "5", step = "1", min = "0", max = "10" }) {
    let fn = null;
    return {
        value, step, min, max,
        addEventListener: (type, f) => { if (type === "wheel") fn = f; },
        wheel: (deltaY, shiftKey = false) =>
            fn({ deltaY, shiftKey, preventDefault: () => {} }),
    };
}

test("a slider steps under the wheel, and stays on its grid", () => {
    let applied = 0;
    const s = slider({ value: "5" });
    wheelSteps(s, () => { applied++; });

    s.wheel(-100);                               // up is forward
    assert.equal(s.value, "6");
    s.wheel(100);
    assert.equal(s.value, "5");
    assert.equal(applied, 2);

    s.wheel(-100, true);                         // shift is ten at a time
    assert.equal(s.value, "10");                 // clamped at max
    s.wheel(-100);
    assert.equal(s.value, "10");
    assert.equal(applied, 3, "a wheel that changes nothing does not redraw");

    // A fine step must not drift: 0.005 a hundred times is 0.5, exactly.
    const fine = slider({ value: "0", step: "0.005", min: "0", max: "1" });
    wheelSteps(fine, () => {});
    for (let i = 0; i < 100; i++) fine.wheel(-100);
    assert.equal(parseFloat(fine.value), 0.5);
});

// ── the two exponent steppers ─────────────────────────────────────

// Jake: "integrate the inflation and lambda settings. two hoverable buttons.
// I^i and \lambda^n (for legibility) scrollable with mouse or up down arrows
// while hovering (or w and s keys)."
function steppers() {
    const set = createGammaSet({ guard: false });
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });
    const wrap = host.children[0];
    // className, not getAttribute: these are createElement nodes, and the
    // stub answers getAttribute from the data-width/height pair alone.
    const cls = (c) => String(c.className || "");
    const gen = wrap.children.find((c) => cls(c).includes("ret-gen"));
    assert.ok(gen, "no generation row");
    const buttons = gen.children.filter((c) => cls(c) === "ret-step");
    assert.equal(buttons.length, 2, `${buttons.length} steppers, not two`);
    const lambdaOut = gen.children.find((c) => cls(c) === "ret-lambda");
    return { set, I: buttons[0], L: buttons[1], lambdaOut };
}

const wheel = (el, deltaY) => {
    const e = { deltaY, dp: false, preventDefault() { this.dp = true; } };
    el.on.wheel[0](e);
    assert.ok(e.dp, "the wheel handler let the page scroll under it");
};
const key = (el, k) => {
    el.on.mouseenter[0]();
    const e = { key: k, dp: false, preventDefault() { this.dp = true; } };
    for (const fn of document.on.keydown ?? []) fn(e);
    el.on.mouseleave[0]();
    return e;
};

test("the steppers wear their exponents: script I for the inflation, lambda for n", () => {
    const { set, I, L, lambdaOut } = steppers();
    assert.equal(I.textContent, "ℐ⁰", `the inflation reads ${JSON.stringify(I.textContent)}`);
    assert.equal(L.textContent, "λ⁰");
    // At n = 0 the total repeats the inflation's exponent, so it stays quiet.
    assert.equal(lambdaOut.textContent, "");

    wheel(I, -1);                                 // up is up, as everywhere else
    assert.equal(set.getGeneration(), 1);
    assert.equal(I.textContent, "ℐ¹", "the superscript did not follow");
    wheel(I, 1);
    wheel(I, 1);
    assert.equal(set.getGeneration(), -1);
    assert.equal(I.textContent, "ℐ⁻¹", "no minus sign on a deflation");

    wheel(L, -1);
    assert.equal(set.getNormalization(), 1);
    assert.equal(L.textContent, "λ¹");
    // Now the two exponents differ, so the sum is worth saying.
    assert.equal(lambdaOut.textContent, "= φ⁰");
});

test("the arrows and w/s drive whichever stepper the pointer is over", () => {
    for (const k of ["ArrowUp", "w", "W"]) {
        const { set, I, L } = steppers();
        assert.ok(key(I, k).dp, `${k} was not taken`);
        assert.equal(set.getGeneration(), 1, `${k} over the inflation`);
        assert.equal(set.getNormalization(), 0, `${k} over the inflation moved n`);
        assert.ok(key(L, k).dp);
        assert.equal(set.getNormalization(), 1, `${k} over lambda`);
        assert.equal(set.getGeneration(), 1, `${k} over lambda moved the generation`);
    }
    for (const k of ["ArrowDown", "s", "S"]) {
        const { set, I, L } = steppers();
        key(I, k);
        assert.equal(set.getGeneration(), -1, `${k} over the inflation`);
        key(L, k);
        assert.equal(set.getNormalization(), -1, `${k} over lambda`);
    }
    // With the pointer nowhere near, the keys are the page's own again.
    const { set, I } = steppers();
    I.on.mouseenter[0]();
    I.on.mouseleave[0]();
    for (const fn of document.on.keydown ?? []) fn({ key: "w", preventDefault() {} });
    assert.equal(set.getGeneration(), 0, "a stepper kept the keys after the pointer left");

    // And not while someone is typing: a gamma box under the pointer would
    // otherwise eat its own w and s.
    I.on.mouseenter[0]();
    for (const fn of document.on.keydown ?? []) {
        fn({ key: "w", target: { tagName: "INPUT" }, preventDefault() {} });
    }
    assert.equal(set.getGeneration(), 0, "a stepper stole a keystroke from a text box");
    I.on.mouseleave[0]();
});

test("the inflation moves gamma; the normalization moves lambda alone", () => {
    // The distinction the two buttons exist to keep: a deflation is a map on
    // the offsets that happens to rescale the grid, and n is the rescale with
    // the offsets held still.
    const PHI = (1 + Math.sqrt(5)) / 2;
    const { set, I, L } = steppers();
    set.setSum(0.5, true);
    const before = set.values().join(",");

    wheel(L, -1);
    assert.equal(set.values().join(","), before, "n moved gamma");
    assert.ok(Math.abs(set.model.lambda - PHI) < 1e-12,
              `n = 1 put lambda at ${set.model.lambda}, not phi`);

    wheel(I, 1);                                  // one deflation
    assert.notEqual(set.values().join(","), before, "a deflation left gamma alone");
    // lambda is the two exponents added: phi^(-1 + 1) = 1.
    assert.ok(Math.abs(set.model.lambda - 1) < 1e-12,
              `lambda is ${set.model.lambda}, not the two exponents added`);
});

// ── the thirds are stops ──────────────────────────────────────────

// Jake, 2026-10-31: "1/3 is a very special class (sum) put a stop at the 1/3
// and 2/3 mark on the sum. e.g. 100, 200, 300, 33*, 400, 500, 600, 66*, 700
// etc. made the thousants similar 333, 33*, 335 and 666, 66* and 667. As close
// as possible. Note that inflation will alternate between 1/3 and 2/3."
function strip() {
    const set = createGammaSet({ guard: false });
    const host = { children: [], appendChild(c) { this.children.push(c); return c; } };
    mountReticulum(set, host, { colors: COLORS });
    const cls = (c) => c.getAttribute("class") || "";
    const s = host.children[0].children[1];
    const kids = s.children;
    return {
        set,
        hit: kids.find((c) => cls(c) === "ss-hit"),
        readout: kids.find((c) => cls(c) === "ss-readout"),
        notch: (dir, fine = false) => kids.find((c) => cls(c) === "ss-hit")
            .on.wheel[0]({ deltaY: dir, shiftKey: fine, preventDefault() {} }),
    };
}

test("the coarse notch stops at the thirds: 300, 33*, 400", () => {
    const { set, readout, notch } = strip();
    const seen = [];
    set.setSum(0, true);
    for (let i = 0; i < 7; i++) { notch(-1); seen.push(readout.textContent); }
    assert.deepEqual(seen, ["100", "200", "300", "33*", "400", "500", "600"]);
    notch(-1);
    assert.equal(readout.textContent, "66*");
    notch(-1);
    assert.equal(readout.textContent, "700");

    // And the same coming back down, which is the same stops in reverse.
    const back = [];
    for (let i = 0; i < 4; i++) { notch(1); back.push(readout.textContent); }
    assert.deepEqual(back, ["66*", "600", "500", "400"]);
});

test("the fine notch stops there too: 333, 33*, 334", () => {
    const { set, readout, notch } = strip();
    set.setSum(0.332, true);
    const up = [];
    for (let i = 0; i < 3; i++) { notch(-1, true); up.push(readout.textContent); }
    assert.deepEqual(up, ["333", "33*", "334"]);

    set.setSum(0.668, true);
    const down = [];
    for (let i = 0; i < 3; i++) { notch(1, true); down.push(readout.textContent); }
    assert.deepEqual(down, ["667", "66*", "666"]);
});

test("the stop is the exact third, and 33* is not the 333 beside it", () => {
    const { set, readout, notch } = strip();
    set.setSum(0.333, true);
    assert.equal(readout.textContent, "333", "a plain thousandth wears no star");
    notch(-1, true);
    // Exact, not near: the denominator is divisible by 3, so a third is a whole
    // numerator -- which is what makes Jake's alternation hold forever.
    assert.equal(set.getSum(), 1 / 3, `the stop is ${set.getSum()}, not a third`);
    assert.equal(set.exact().reduce((a, b) => a + b, 0) * 3, set.denominator,
                 "the third is not a whole numerator");
    assert.equal(readout.textContent, "33*");
});

test("both steppers hold a third: the fixed classes stay fixed, exactly", () => {
    // What Jake flagged, measured. Deflation is s -> -2s on the class, so it
    // holds 1/3 (-2/3 = 1/3 mod 1) and holds 2/3. Inflation undoes a
    // deflation, and deflation is 2-to-1 on classes, so it has two preimages
    // to pick from -- half a turn apart. It now picks the one that holds a
    // fixed class, where the old branch sent 1/3 to 5/6 and left the fixed set
    // for good. So the thirds are stops in the arithmetic too, not only on the
    // strip; at den 10000 the class drifted instead (PLAN 12.1a).
    const { set, readout, notch } = strip();
    set.setSum(0, true);
    for (let i = 0; i < 4; i++) notch(-1);               // 100, 200, 300, 33*
    assert.equal(readout.textContent, "33*");

    // The class is exact in the numerators; the dust is in reading a phase off
    // an unreduced representative (4/3 and 1/3 are the same class, and the
    // remainder of 1.3333... is not 0.3333... to the last bit).
    const phase = () => ((set.getSum() % 1) + 1) % 1;
    const at = (t, what) => assert.ok(Math.abs(phase() - t) < 1e-9,
                                      `${what} left the class at ${phase()}`);
    for (let i = 1; i <= 12; i++) { set.inflate(); at(1 / 3, `inflation ${i}`); }
    for (let i = 1; i <= 12; i++) { set.deflate(); at(1 / 3, `deflation ${i}`); }
    assert.equal(readout.textContent, "33*", "the star went out");

    // And the same at 2/3, the other one.
    set.setSum(2 / 3, true);
    assert.equal(readout.textContent, "66*");
    for (let i = 1; i <= 6; i++) { set.inflate(); at(2 / 3, `inflation ${i}`); }
    for (let i = 1; i <= 6; i++) { set.deflate(); at(2 / 3, `deflation ${i}`); }
    assert.equal(readout.textContent, "66*", "the star went out at 2/3");
});

test("picking the preimage did not cost the round trip", () => {
    // The branch is free only because both choices are exact inverses: an
    // inflation followed by a deflation has to return the very same
    // numerators, or the stepper is not a stepper.
    for (const s of [0, 0.1, 1 / 3, 0.5, 2 / 3, 1.5, -1 / 3]) {
        const g = createGammaSet({ guard: false });
        g.setSum(s, true);
        const before = g.exact().join(",");
        g.inflate();
        g.deflate();
        assert.equal(g.exact().join(","), before, `s = ${s} did not come home`);
    }
});

test("a drag has a catch at the thirds, since it could never land on one", () => {
    // One turn is the bed, 67 of the strip's 100 units, and the stub reports
    // the strip 800px wide -- so a turn is 536px and a third of one is 179.
    const { set, hit, readout } = strip();
    set.setSum(0, true);
    const TURN = 536;
    hit.on.pointerdown[0]({ clientX: 0, pointerId: 1,
                            preventDefault() {}, stopPropagation() {} });
    hit.on.pointermove[0]({ clientX: (1 / 3 - 0.002) * TURN, pointerId: 1 });
    hit.on.pointerup[0]({ pointerId: 1 });
    assert.equal(readout.textContent, "33*", `the catch missed: ${readout.textContent}`);
    assert.equal(set.getSum(), 1 / 3);

    // Outside the catch it is a free drag, as it was.
    set.setSum(0, true);
    hit.on.pointerdown[0]({ clientX: 0, pointerId: 1,
                            preventDefault() {}, stopPropagation() {} });
    hit.on.pointermove[0]({ clientX: 0.3 * TURN, pointerId: 1 });
    hit.on.pointerup[0]({ pointerId: 1 });
    assert.equal(readout.textContent, "300");
});
