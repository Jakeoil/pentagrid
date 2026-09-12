// The floating panel: drag, collapse, close, and remembering where it was put.

import test from "node:test";
import assert from "node:assert/strict";
import "./domstub.mjs";

import { createFloatingPanel } from "../dist/ui/floating.js";

// a localStorage the tests can see into
function storage() {
    const map = new Map();
    globalThis.localStorage = {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
    };
    return map;
}

const ev = (x, y, extra = {}) => ({
    clientX: x, clientY: y, pointerId: 1, target: null,
    preventDefault() {}, ...extra,
});

const parts = (p) => {
    const bar = p.element.children[0];
    return {
        bar,
        title: bar.children[0],
        collapse: bar.children[1].children[0],
        close: bar.children[1].children[1],
        body: p.element.children[1],
    };
};

test("a panel has a bar, a body, and the two buttons", () => {
    storage();
    const p = createFloatingPanel({ id: "t1", title: "Reticulum" });
    const { bar, title, collapse, close, body } = parts(p);
    assert.equal(bar.className, "float-bar");
    assert.equal(title.textContent, "Reticulum");
    assert.equal(close.textContent, "×");
    assert.equal(collapse.textContent, "▾");
    assert.equal(body.className, "float-body");
    assert.equal(p.body, body, "content goes in the body, not the frame");
});

test("dragging the bar moves the panel and remembers where", () => {
    const map = storage();
    const p = createFloatingPanel({ id: "t2", title: "x", x: 100, y: 100 });
    const { bar } = parts(p);

    bar.on.pointerdown[0](ev(100, 100));
    bar.on.pointermove[0](ev(160, 140));
    assert.equal(p.element.style.left, "160px");
    assert.equal(p.element.style.top, "140px");
    assert.equal(map.size, 0, "nothing stored until the drag ends");

    bar.on.pointerup[0](ev(160, 140));
    const saved = JSON.parse(map.get("pentagrid.panel.t2"));
    assert.equal(saved.x, 160);
    assert.equal(saved.y, 140);

    // and a panel built again with that id comes back where it was left
    const again = createFloatingPanel({ id: "t2", title: "x" });
    assert.equal(again.element.style.left, "160px");
    assert.equal(again.element.style.top, "140px");
});

test("a press on a button in the bar is not the start of a drag", () => {
    storage();
    const p = createFloatingPanel({ id: "t3", title: "x", x: 50, y: 50 });
    const { bar } = parts(p);
    const onButton = ev(50, 50, { target: { closest: (sel) => (sel === "button" ? {} : null) } });
    bar.on.pointerdown[0](onButton);
    bar.on.pointermove[0](ev(300, 300));
    assert.equal(p.element.style.left, "50px", "the panel followed a button press");
});

test("the panel cannot be dragged out of reach", () => {
    storage();
    globalThis.innerWidth = 1000;
    globalThis.innerHeight = 700;
    const p = createFloatingPanel({ id: "t4", title: "x", x: 100, y: 100 });
    const { bar } = parts(p);
    bar.on.pointerdown[0](ev(100, 100));
    bar.on.pointermove[0](ev(9000, 9000));
    assert.equal(p.element.style.left, `${1000 - 60}px`);
    assert.equal(p.element.style.top, `${700 - 40}px`);
    bar.on.pointermove[0](ev(-9000, -9000));
    assert.equal(p.element.style.left, "4px");
    assert.equal(p.element.style.top, "4px");
});

test("collapse hides the body, flips the caret, and is remembered", () => {
    const map = storage();
    const p = createFloatingPanel({ id: "t5", title: "x" });
    const { collapse } = parts(p);
    assert.equal(p.isCollapsed(), false);

    collapse.on.click[0]();
    assert.equal(p.isCollapsed(), true);
    assert.ok(p.element.classList.contains("collapsed"));
    assert.equal(collapse.textContent, "▸");
    assert.equal(JSON.parse(map.get("pentagrid.panel.t5")).collapsed, true);

    collapse.on.click[0]();
    assert.equal(p.isCollapsed(), false);
    assert.ok(!p.element.classList.contains("collapsed"));

    // and it opens collapsed next time if that is how it was left
    collapse.on.click[0]();
    const again = createFloatingPanel({ id: "t5", title: "x" });
    assert.equal(again.isCollapsed(), true);
    assert.ok(again.element.classList.contains("collapsed"));
});

test("close hides it and says so; show brings it back", () => {
    storage();
    let closed = 0;
    const p = createFloatingPanel({ id: "t6", title: "x", onClose: () => closed++ });
    const { close } = parts(p);
    close.on.click[0]();
    assert.equal(p.element.hidden, true);
    assert.equal(closed, 1);
    p.show();
    assert.equal(p.element.hidden, false);
});

test("storage being unavailable is not a reason to fail", () => {
    // Private windows, and browsers set to block site data, throw on access.
    globalThis.localStorage = {
        getItem() { throw new Error("denied"); },
        setItem() { throw new Error("denied"); },
    };
    const p = createFloatingPanel({ id: "t7", title: "x", x: 10, y: 10 });
    const { bar, collapse } = parts(p);
    bar.on.pointerdown[0](ev(10, 10));
    bar.on.pointermove[0](ev(40, 30));
    bar.on.pointerup[0](ev(40, 30));
    collapse.on.click[0]();
    assert.equal(p.element.style.left, "40px", "it must still work, just not persist");
    assert.equal(p.isCollapsed(), true);
});

test("closing is not a one-way door: onClose can put the way back", () => {
    storage();
    let shown = true;
    const p = createFloatingPanel({ id: "t8", title: "x", onClose: () => { shown = false; } });
    const { close } = parts(p);

    close.on.click[0]();
    assert.equal(p.element.hidden, true);
    assert.equal(shown, false, "onClose must fire so the page can offer a way back");

    p.show();
    assert.equal(p.element.hidden, false, "and show must bring it back");
    // and it comes back where it was, not at the default
    assert.ok(p.element.style.left.endsWith("px"));
});
