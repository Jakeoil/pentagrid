// Session memory — PLAN section 9.4, step 7 of 9.10.
//
// Jake's fourth want: "Also remember the current state of the page." The care
// is in the ORDER -- the session is read after the baseline, so reset() throws
// it away and returns to the markup rather than to the last visit.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { saveSession, loadSession, forgetSession, sessionKey, debounce,
         SAVE_AFTER_MS } from "../dist/state/session.js";
import { storeGet, storeSet, storeDelete } from "../dist/state/store.js";
import { readFileSync } from "node:fs";
import { createGrowthView } from "../dist/view/growth.js";

function host(attrs = {}, id = "stage") {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: (n) => (n in attrs ? attrs[n] : null),
        getAttributeNames: () => Object.keys(attrs),
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
const settle = () => new Promise((r) => setTimeout(r, SAVE_AFTER_MS + 120));

test("the store falls back to memory, and refuses what it cannot parse", () => {
    storeDelete("t.a");
    assert.equal(storeGet("t.a"), null);
    storeSet("t.a", "hello");
    assert.equal(storeGet("t.a"), "hello");
    storeDelete("t.a");
    assert.equal(storeGet("t.a"), null);
});

test("a session is versioned, and a later version is refused not misread", () => {
    forgetSession("k");
    assert.equal(loadSession("k"), null);
    saveSession("k", { v: 1, tileStyle: { color: "bands" } });
    assert.deepEqual(loadSession("k").tileStyle, { color: "bands" });

    // A shape from the future: refused outright, so an old page takes its
    // defaults rather than half-reading something it does not understand.
    storeSet("pentagrid.session.k", JSON.stringify({ v: 2, tileStyle: { color: "x" } }));
    assert.equal(loadSession("k"), null, "a v2 session was read by a v1 reader");
    forgetSession("k");
});

test("the key separates pages, and canvases on one page", () => {
    const a = sessionKey({ id: "stage" });
    const b = sessionKey({ id: "other" });
    const c = sessionKey();
    assert.notEqual(a, b, "two canvases on a page share a key");
    assert.notEqual(a, c);
    assert.ok(a.includes("#stage"));
});

test("it is opt-in: a page that does not ask is not remembered", async () => {
    const id = sessionKey({ id: "optout" });
    forgetSession(id);
    const h = createPentagrid({ container: host({}, "optout"), panel: host() });
    h.setTileStyle({ color: "bands" });
    h.redraw();
    await settle();
    assert.equal(loadSession(id), null,
                 "a page that never asked for a session was remembered anyway");
});

test("a page that asks comes back as it was left", async () => {
    const id = "test.remembered";
    forgetSession(id);
    const first = createPentagrid({
        container: host(), panel: host(), session: id,
        features: { penroseTiles: true },
    });
    first.setTileStyle({ color: "kowalewski", pentaFace: true, band: 0.3 });
    first.setFeatures({ penroseTiles: true, penroseEdges: true }, { merge: true });
    first.gamma.setLocked(-1);
    first.gamma.setValues([0.11, 0.23, 0.31, 0.17, 0.18]);
    first.gamma.setLocked(0);
    first.setView({ scale: 77, x: 2, y: -1 });
    first.redraw();
    await settle();
    assert.ok(loadSession(id), "nothing was saved");

    const again = createPentagrid({
        container: host(), panel: host(), session: id,
        features: { penroseTiles: true },
    });
    const t = again.getTileStyle();
    assert.equal(t.color, "kowalewski", "the style was not remembered");
    assert.equal(t.pentaFace, true);
    assert.equal(t.band, 0.3);
    assert.equal(again.getFeatures().penroseEdges, true, "a feature was not remembered");
    assert.equal(again.gamma.exact().join(","), first.gamma.exact().join(","),
                 "gamma was not remembered exactly");
    assert.deepEqual(again.getView(), { scale: 77, x: 2, y: -1 });
    forgetSession(id);
});

test("reset discards the session and returns to the markup", async () => {
    // The order that matters: attributes > session > page defaults, with the
    // baseline taken BEFORE the session is read.
    const id = "test.resets";
    forgetSession(id);
    const attrs = { "data-color": "groups", "data-bold-edges": "" };
    const first = createPentagrid({
        container: host(attrs), panel: host(), session: id,
    });
    assert.equal(first.getTileStyle().color, "groups", "the markup was not applied");
    first.setTileStyle({ color: "bands", boldEdges: false });
    first.redraw();
    await settle();

    const again = createPentagrid({
        container: host(attrs), panel: host(), session: id,
    });
    assert.equal(again.getTileStyle().color, "bands", "the session was not restored");
    again.reset();
    assert.equal(again.getTileStyle().color, "groups",
                 "reset went past the markup instead of back to it");
    assert.equal(again.getTileStyle().boldEdges, true);
    forgetSession(id);
});

test("the save is debounced, so a pan writes once and not thirty times", async () => {
    let runs = 0;
    const save = debounce(() => { runs++; }, 30);
    for (let i = 0; i < 30; i++) save();
    assert.equal(runs, 0, "the debounce fired while calls were still coming");
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(runs, 1, `the debounce ran ${runs} times for thirty calls`);
});

test("a gamma of the wrong n is refused, as everywhere else", async () => {
    // The same hazard as the slot: a session written on the heptagrid page
    // must not be read as five numerators.
    const id = "test.wrongn";
    saveSession(id, {
        v: 1,
        gamma: { exact: [1, 2, 3, 4, 5, 6, 7], den: 100, locked: -1, symmetry: false,
                 guard: false, generation: 0, enabled: [], lines: [], isolated: null },
    });
    const h = createPentagrid({ container: host(), panel: host(), session: id });
    assert.equal(h.gamma.exact().length, 5, "seven numerators reached a pentagrid");
    forgetSession(id);
});

test("the growth slice rides in the same record, so a roof page is one session", async () => {
    // GrowthState lives in the growth view's own closure, so the pentagrid
    // cannot see it -- and two records for one page would be two things to keep
    // in step. config.sessionSlice is how the outer view contributes its share.
    const id = "test.growth";
    forgetSession(id);
    const first = createGrowthView({ container: host(), lift: true, session: id });
    first.set({ paths: "high", axis: 3, penta: true, edgeStyle: "bold" });
    first.redraw();
    await settle();

    const rec = loadSession(id);
    assert.ok(rec, "nothing was saved");
    assert.ok(rec.growth, "the growth slice was not in the record");
    assert.equal(rec.growth.paths, "high");
    // One record, with everything in it.
    assert.ok(rec.tileStyle, "the pentagrid's share is missing");
    assert.ok(rec.gamma, "gamma is missing");

    const again = createGrowthView({ container: host(), lift: true, session: id });
    const s = again.get();
    assert.equal(s.paths, "high", "paths was not remembered");
    assert.equal(s.axis, 3);
    assert.equal(s.penta, true);
    assert.equal(s.edgeStyle, "bold");
    forgetSession(id);
});

test("the pages that opt in are the exploration ones, not the narratives", () => {
    // A narrative step imposes its own feature set, and a session restoring
    // the features from three steps ago would fight the step you are on.
    const asked = [];
    const files = ["src/method.ts", "src/app/split.ts", "src/app/roof.ts",
                   "src/app/grow.ts", "src/app/grow7.ts"];
    for (const f of files) {
        assert.ok(/session:\s*"/.test(readFileSync(f, "utf8")),
                  `${f} does not ask for a session`);
        asked.push(f);
    }
    assert.equal(asked.length, 5);
    for (const f of ["src/app/narrative.ts", "src/app/method-steps.ts"]) {
        let src = "";
        try { src = readFileSync(f, "utf8"); } catch { continue; }
        assert.ok(!/session:/.test(src),
                  `${f} asks for a session; a narrative step would fight it`);
    }
});

test("reset page and copy setup are both in the panel's settings", () => {
    // A page that remembers where you left it and offers no way home is a
    // trap, so the reset button landed with the session.
    const src = readFileSync("src/view/pentagrid.ts", "utf8");
    assert.ok(src.includes('resetBtn.textContent = "reset page"'), "no reset button");
    assert.ok(src.includes('copyBtn.textContent = "copy setup"'), "no copy button");
    assert.ok(src.includes("resetBtn.addEventListener"), "the reset button is inert");
});
