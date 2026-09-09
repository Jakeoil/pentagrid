// Tests for the two reusable clusters. "Reusable" is a claim, and the way to
// check it is to drive them with no pentagrid anywhere in sight.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";
import { createGammaBank } from "../dist/ui/dials.js";
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
    assert.equal(l.frozen, true, "entering must latch, or travelling to it retargets");
    l.element.on.mouseleave[0]();
    assert.equal(l.frozen, false);
});

test("hovering inside reports host coordinates, not panel pixels", () => {
    const { l, seen } = loupe();
    l.open({ x: 5, y: 5, mag: 1, label: "x" }, 100);   // scale 100, size 220
    l.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 220 });
    l.element.on.mousemove[0]({ clientX: 110, clientY: 110 });   // dead centre
    assert.deepEqual(seen.hovers.at(-1), [5, 5], "centre of the panel is the target");
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
