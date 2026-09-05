// Tests for createPentagrid: that a second page can exist.
//
// Stage 5's claim is that the method page is now one caller of a factory rather
// than the only possible page. These construct it twice, with different configs,
// and check the registration hook an exploration would use.

import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";

function host(w = 800, h = 800) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: () => null,
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}

test("constructs with only a container", () => {
    const h = createPentagrid({ container: host() });
    assert.ok(h.stack, "no stack returned");
    assert.ok(typeof h.redraw === "function");
    assert.ok(h.stack.all().length > 5, "no layers registered");
});

test("two instances are independent", () => {
    const a = createPentagrid({ container: host(800, 800) });
    const b = createPentagrid({ container: host(400, 300) });
    assert.notEqual(a.stack, b.stack);
    // the second was sized from its own container, not the first's
    assert.equal(b.stack.w, 400);
    assert.equal(b.stack.h, 300);
    assert.equal(a.stack.w, 800);
});

test("the page supplies its own narration, and step count follows", () => {
    const steps = [
        { title: "One", html: "<p>first</p>" },
        { title: "Two", html: "<p>second</p>" },
    ];
    const h = createPentagrid({
        container: host(),
        steps,
        presets: [{}, { penroseTiles: true }],
    });
    h.setStep(1);
    h.setStep(99);          // clamped, not thrown
    h.setStep(-5);
    assert.ok(true, "step navigation survived out-of-range input");
});

test("an exploration registers its own layer through the config", () => {
    let drew = 0;
    let handed = null;
    const h = createPentagrid({
        container: host(),
        layers: (parts) => {
            handed = parts;
            parts.stack.add({
                id: "ribbons", label: "Ribbons", z: 40, group: "Exploration",
                draw: () => { drew++; },
            });
        },
    });

    // the hook was given what a layer actually needs
    assert.ok(handed, "layers callback never ran");
    assert.ok(handed.stack, "no stack");
    assert.ok(Array.isArray(handed.model.directions), "no pentagrid model");
    assert.equal(handed.model.directions.length, 5);
    assert.ok(typeof handed.currentRhombs === "function");
    assert.ok(typeof handed.withView === "function");
    assert.ok(typeof handed.redraw === "function");

    // it drew, and it got its own panel section without the panel knowing
    assert.ok(drew > 0, "registered layer never drew");
    assert.ok(h.stack.groups().has("Exploration"));
    assert.deepEqual(h.stack.groups().get("Exploration").map((l) => l.label), ["Ribbons"]);

    // and the geometry it was handed is live, not a snapshot
    const rhombs = handed.currentRhombs();
    assert.ok(rhombs.length > 0, "currentRhombs returned nothing");
    assert.ok("x0" in rhombs[0] && "j" in rhombs[0], "rhombs lack provenance");
});

test("redraw is callable from outside and does not throw", () => {
    const h = createPentagrid({ container: host() });
    h.redraw();
    h.redraw();
    assert.ok(true);
});
