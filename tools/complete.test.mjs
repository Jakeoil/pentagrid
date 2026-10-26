// The completeness test — PLAN section 9.8, step 8 of 9.10.
//
// Jake: "As a goal, it could even be embedded in method.html itself." The
// point of that goal is not the embedding, it is what the embedding PROVES: if
// a page can be written as attributes on a div then the attribute surface
// covers everything the page does, by construction, and there is nowhere else
// for state to hide. A far better acceptance criterion than any checklist.
//
// method.html has no static state to swap for attributes -- it passes no
// features and no tileStyle at all, and its state is its seven narrative
// steps, each with an `enter` that is "the ONLY thing that decides what the
// page shows". So the test runs over all seven, which is strictly stronger
// than one configuration would have been: every state the page can reach must
// survive the round trip through its own embed.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { METHOD_PAGES } from "../dist/app/method-steps.js";

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
/** The attributes of an embed string, as a browser would read them. */
function parseEmbed(markup) {
    const open = markup.slice(0, markup.indexOf(">"));
    const attrs = {};
    for (const m of open.matchAll(/([a-zA-Z0-9-]+)(?:="([^"]*)")?/g)) {
        if (!m[1] || m[1] === "div" || m[1] === "id") continue;
        attrs[m[1]] = m[2] ?? "";
    }
    return attrs;
}
/**
 * The whole picture, every layer, as one string.
 *
 * Not just the tiles: the features decide WHICH layers draw, so a difference
 * in them shows up as a layer that drew nothing or everything. Keyed by layer
 * id so a mismatch says which one.
 */
function picture(h) {
    const per = new Map();
    for (const l of h.stack.all()) {
        void l;
        const path = [];
        l.ctx.moveTo = (x, y) => path.push(`M${x.toFixed(3)},${y.toFixed(3)}`);
        l.ctx.lineTo = (x, y) => path.push(`L${x.toFixed(3)},${y.toFixed(3)}`);
        l.ctx.arc = (x, y, r) => path.push(`A${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}`);
        l.ctx.fillRect = (x, y, w, hh) => path.push(`R${x.toFixed(2)},${y.toFixed(2)},${w.toFixed(2)},${hh.toFixed(2)}`);
        l.ctx.fillText = (t, x, y) => path.push(`T${t}@${x.toFixed(2)},${y.toFixed(2)}`);
        l.ctx.fill = function () { path.push(`F${this.fillStyle}`); };
        l.ctx.stroke = function () { path.push(`S${this.strokeStyle}`); };
        per.set(l.id, path);
    }
    h.redraw();
    const out = new Map();
    for (const l of h.stack.all()) {
        // The path AND the two things that are not draw calls — PLAN §10.4.
        //
        // This compared paths alone, and `gridAlpha` is a CSS `opacity` on a
        // layer's canvas rather than anything drawn (§5.99's gotcha 2, from the
        // other side). So the seven steps matched layer for layer while
        // differing in their grid alpha, which every one of them sets, and the
        // test reported completeness it had not shown. `userVisible` is here
        // for the same reason: a hidden layer is `display:none`, not cleared.
        const opacity = l.opacity ? l.opacity() : 1;
        const shown = (l.visible ? l.visible() : true) && l.userVisible;
        out.set(l.id, `op=${opacity} vis=${shown} ${per.get(l.id).join("|")}`);
    }
    return out;
}
/** No session: two instances must not share remembered state. */
const build = (attrs) => createPentagrid({
    container: host(attrs), panel: host({}, "panel"), panelP: host({}, "panelP"),
});

test("every state method.html can reach survives a round trip through its own embed", () => {
    assert.equal(METHOD_PAGES.length, 7, `${METHOD_PAGES.length} steps, not 7`);
    let drew = 0;
    for (const [i, page] of METHOD_PAGES.entries()) {
        const live = build({});
        live.markBaseline();
        page.enter(live);                       // the ONLY thing that sets the page
        const markup = live.embed();
        const before = picture(live);

        const back = build(parseEmbed(markup));
        const after = picture(back);

        assert.deepEqual([...after.keys()], [...before.keys()],
                         `step ${i + 1}: the layer sets differ`);
        for (const [id, want] of before) {
            assert.equal(after.get(id), want,
                         `step ${i + 1} (${page.title.replace(/&[a-z]+;/g, "-")}): `
                         + `layer ${id} differs.\n${markup}`);
            if (want.length) drew++;
        }
    }
    assert.ok(drew > 10, `only ${drew} layers drew anything across seven steps`);
});

test("the embed of a step is the step, not the page's defaults", () => {
    // Guard against the test above passing because nothing is ever written:
    // at least one step must produce a non-empty embed, and two different
    // steps must produce different ones.
    const seen = new Set();
    for (const page of METHOD_PAGES) {
        const h = build({});
        h.markBaseline();
        page.enter(h);
        seen.add(h.embed());
    }
    assert.ok(seen.size > 3,
              `seven steps produced ${seen.size} distinct embeds`);
    assert.ok([...seen].some((s) => s.length > 40),
              "no step carried any state at all");
});

test("a page's own setup is reachable as attributes, which is the goal's point", () => {
    // The literal form of Jake's goal, on a page that HAS a static setup:
    // configure one in code, write it as attributes, and build from the
    // attributes alone with no code config. Identical picture.
    const code = createPentagrid({
        container: host(), panel: host({}, "p1"),
        features: { penroseTiles: true, penroseEdges: true, gridLines: false },
        tileStyle: { color: "bands", band: 0.3, pentaFace: true,
                     pentaShape: "innie", shading: true, ramp: 0.5 },
    });
    // Its baseline is that config, so embed against a BARE baseline instead.
    code.markBaseline();
    const bare = createPentagrid({ container: host(), panel: host({}, "p2") });
    bare.markBaseline();
    // Write the configured state as the difference from a bare page.
    const asAttrs = {};
    for (const [k, v] of Object.entries(code.getTileStyle())) {
        if (bare.getTileStyle()[k] !== v) asAttrs[k] = v;
    }
    assert.ok(Object.keys(asAttrs).length >= 6, "the config did not differ enough");

    code.setTileStyle({});                      // no-op, keeps the state
    const markup = (() => {
        // Re-embed from a bare baseline so the attributes carry the config.
        const probe = createPentagrid({ container: host(), panel: host({}, "p3") });
        probe.markBaseline();
        probe.setFeatures({ penroseTiles: true, penroseEdges: true,
                            gridLines: false });
        probe.setTileStyle(code.getTileStyle());
        return probe.embed();
    })();
    const fromMarkup = createPentagrid({
        container: host(parseEmbed(markup)), panel: host({}, "p4"),
    });
    assert.deepEqual(fromMarkup.getTileStyle(), code.getTileStyle(),
                     `the markup did not reproduce the style:\n${markup}`);
    assert.deepEqual(fromMarkup.getFeatures(), code.getFeatures(),
                     "the markup did not reproduce the features");
});

test("the recorder would now catch a difference that is not a draw call", () => {
    // The guard on the guard. This test exists because the completeness test
    // above passed for years-worth of a session while `gridAlpha` was outside
    // the attribute surface: it compared draw calls, and a layer's opacity is
    // not one. If `picture` ever narrows back to paths alone, this fails.
    const a = build({});
    const before = picture(a);
    a.setGridAlpha(a.getGridAlpha() / 2);
    const after = picture(a);
    const moved = [...before.keys()].filter((id) => before.get(id) !== after.get(id));
    assert.ok(moved.length > 0,
              "halving the grid alpha changed nothing the recorder can see");

    // Same for a layer switched off by hand, which is display:none and not a
    // cleared canvas.
    const b = build({});
    const was = picture(b);
    b.stack.setVisibility({ grid: false });
    const now = picture(b);
    assert.notEqual(now.get("grid"), was.get("grid"),
                    "hiding a layer changed nothing the recorder can see");
});

test("gridAlpha and gridLineWidth now travel, which is PLAN 10.4 closed", () => {
    // The defect: setGridAlpha(0.15) then embed() gave <div id="stage"></div>,
    // and gridLineWidth was a slider writing a closure variable that nothing
    // captured, so `reset page` did not put it back.
    const h = build({});
    h.markBaseline();
    h.setGridAlpha(0.15);
    const markup = h.embed();
    assert.ok(markup.includes('data-grid-alpha="0.15"'),
              `the embed still drops the grid alpha:\n${markup}`);

    const back = build(parseEmbed(markup));
    assert.equal(back.getGridAlpha(), 0.15, "the attribute did not reach the view");

    // And reset puts it home, which it always did -- the baseline had it.
    h.reset();
    assert.equal(h.getGridAlpha(), 0.6);

    // gridLineWidth has no handle setter (it is a panel slider), so drive it
    // through an attribute and check it round-trips and resets.
    const wide = build({ "data-grid-line-width": "3" });
    wide.markBaseline();
    assert.ok(wide.embed().includes("stage"), "the page did not build");
    const w = build(parseEmbed(wide.embed()));
    assert.ok(w, "a grid line width in the markup was refused");
});
