// The reticulum slot — PLAN section 9.3, step 4 of 9.10.
//
// Jake: "it could be pushed on a stack (single entry stack) when switching
// pages. Add preset named 'restore' to pull it off the stack on the new page.
// (In this case the title bar will show what's in the stack, not restore)"
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { readFileSync } from "node:fs";
import { pushSlot, peekSlot, slotFor, clearSlot } from "../dist/state/slot.js";
import { captureGamma } from "../dist/state/baseline.js";
import { createGammaSet } from "../dist/geometry/gamma.js";
import { mountReticulum } from "../dist/view/controls.js";

const FAMILY = ["#c00", "#0a0", "#00c", "#c0c", "#0cc", "#cc0", "#888"];
function host() {
    const el = makeStub({ children: [] });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
const sun = () => {
    const g = createGammaSet({ n: 5 });
    g.setGuard(false);
    g.setLocked(-1);
    g.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
    g.setLocked(0);
    return g;
};
/** Walk a stub tree for the buttons of a class. */
const find = (el, cls, out = []) => {
    for (const c of el.children ?? []) {
        if (String(c.className ?? "").split(/\s+/).includes(cls)) out.push(c);
        find(c, cls, out);
    }
    return out;
};

test("the slot holds one reticulum, exactly, and n goes with it", () => {
    clearSlot();
    assert.equal(peekSlot(), null, "the slot did not start empty");
    const g = sun();
    g.setGeneration(-2);
    pushSlot({ label: "sun", n: 5, gamma: captureGamma(g) });

    const got = peekSlot();
    assert.equal(got.label, "sun");
    assert.equal(got.n, 5);
    assert.deepEqual(got.gamma.exact, g.exact(), "the numerators are not exact");
    assert.equal(got.gamma.generation, -2, "the generation did not travel");

    // One slot: a second push replaces, it does not stack.
    pushSlot({ label: "star", n: 5, gamma: captureGamma(g) });
    assert.equal(peekSlot().label, "star");
});

test("slotFor refuses a reticulum of the wrong n", () => {
    // Section 9.3's one hazard: grow7 is a heptagrid, so a slot written there
    // holds seven numerators and a pentagrid page must refuse it rather than
    // read five of them.
    clearSlot();
    const seven = createGammaSet({ n: 7 });
    pushSlot({ label: "hepta", n: 7, gamma: captureGamma(seven) });
    assert.ok(slotFor(7), "a heptagrid page cannot see its own slot");
    assert.equal(slotFor(5), null, "a pentagrid page was offered seven numerators");

    clearSlot();
    pushSlot({ label: "sun", n: 5, gamma: captureGamma(sun()) });
    assert.ok(slotFor(5));
    assert.equal(slotFor(7), null);
});

test("restore is offered only when the slot fits, and is not a catalog preset", () => {
    clearSlot();
    const bare = mountReticulum(sun(), host(), { colors: FAMILY });
    assert.equal(find(bare.element, "ret-restore").length, 1,
                 "no restore button was built");
    assert.equal(find(bare.element, "ret-restore")[0].hidden, true,
                 "restore is offered with an empty slot");

    pushSlot({ label: "deca", n: 5, gamma: captureGamma(sun()) });
    const withSlot = mountReticulum(sun(), host(), { colors: FAMILY });
    const btn = find(withSlot.element, "ret-restore")[0];
    assert.equal(btn.hidden, false, "restore is hidden with a full slot");
    assert.equal(btn.textContent, "restore");
    assert.ok(btn.title.includes("deca"), `the tooltip does not name the slot: ${btn.title}`);

    // It shares the popup but it is a verb, not an entry in the catalog -- so
    // it must not answer to `.preset`, which two other tests enumerate.
    assert.equal(find(withSlot.element, "preset").some((b) => b === btn), false,
                 "restore is being counted as a catalog preset");
});

test("restore pulls the slot, and the title bar says the slot's name", () => {
    clearSlot();
    // Something to carry: a deflated, locked, guarded reticulum.
    const away = sun();
    away.setLocked(3);
    away.setGeneration(-1);
    away.setValues([0.11, 0.23, 0.31, 0.17, 0.18]);
    const carried = captureGamma(away);
    pushSlot({ label: "my setup", n: 5, gamma: carried });

    // A new page, elsewhere.
    const here = sun();
    const titles = [];
    const ctl = mountReticulum(here, host(), {
        colors: FAMILY, onPreset: (name) => titles.push(name),
    });
    assert.notEqual(here.exact().join(","), carried.exact.join(","),
                    "the new page already had the carried reticulum");

    assert.equal(ctl.restore(), true, "restore found nothing to pull");

    assert.equal(here.exact().join(","), carried.exact.join(","),
                 "restore did not pull the numerators");
    assert.equal(here.getLocked(), 3, "the lock did not travel");
    assert.equal(here.getGeneration(), -1,
                 "the generation did not travel -- restore must not reset it like "
                 + "the catalog presets do");
    assert.deepEqual(titles, ["my setup"],
                     `the title bar says ${JSON.stringify(titles)}, not the slot's name`);
});

test("nothing is overwritten behind the user: the new page keeps its gamma until asked", () => {
    clearSlot();
    pushSlot({ label: "carried", n: 5, gamma: captureGamma(sun()) });
    const here = createGammaSet({ n: 5 });
    here.setGuard(false);
    here.setLocked(-1);
    here.setValues([0.4, 0.4, 0.4, 0.4, 0.4]);        // the star, not the sun
    const was = here.exact().join(",");
    mountReticulum(here, host(), { colors: FAMILY });
    assert.equal(here.exact().join(","), was,
                 "mounting the reticulum pulled the slot without being asked");
});

test("the push is wired to leaving the page, not to gamma changing", () => {
    // Writing whenever gamma moved would overwrite the very thing you arrived
    // to restore, so the slot is written on the way OUT and is immutable until
    // the next exit.
    clearSlot();
    const g = sun();
    const ctl = mountReticulum(g, host(), { colors: FAMILY });
    assert.equal(typeof ctl.push, "function", "the control cannot push its slot");

    // Changing gamma must NOT write the slot.
    g.setValues([0.3, 0.3, 0.3, 0.3, 0.3]);
    assert.equal(peekSlot(), null, "a gamma change wrote the slot");

    ctl.push();
    assert.equal(peekSlot().n, 5);
    assert.deepEqual(peekSlot().gamma.exact, g.exact());

    // And it is `pagehide` that is listened for, not `beforeunload`, which is
    // not fired reliably on mobile. Read off the source: the stub's window
    // takes listeners into a noop, so there is nothing to observe at runtime.
    const src = readFileSync("src/view/controls.ts", "utf8");
    assert.ok(/window\.addEventListener\("pagehide", push\)/.test(src),
              "nothing listens for pagehide");
    assert.ok(/visibilitychange/.test(src), "no belt for a tab closed unloaded");
    // The call, not the mention: the comment beside it explains why
    // beforeunload is the wrong event, so the word is in the file on purpose.
    assert.ok(!/addEventListener\(\s*"beforeunload"/.test(src),
              "beforeunload is not fired reliably on mobile");
});
