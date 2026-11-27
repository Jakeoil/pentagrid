// Show the picture and nothing else, and a link that opens it that way.
// PLAN §5.100.
//
// Jake, 2026-11-27: "I want to be able to show a canvas full screen as well as
// export the svg. I also want to create a copyable link that will simply show
// the full screen. Wherever there is an export-svg, make a button/dropdown
// called image. pressing image will allow three choices. export-svg, show, and
// image-link."

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A window with a shape, so "fills the window" is a number a test can check.
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;

const { makeStub } = await import("./domstub.mjs");
const { createPentagrid } = await import("../dist/view/pentagrid.js");
const { resetShowClaim, SHOW_PARAM } = await import("../dist/view/present.js");

const doc = globalThis.document;

function host(id = "stage") {
    const el = makeStub({
        children: [], id,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
        getAttribute: () => null,
        getAttributeNames: () => [],
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
const build = (id, extra = {}) =>
    createPentagrid({ container: host(id), panel: host(`${id}-panel`), ...extra });

/** Everything under `el`, depth first. */
const all = (el, out = []) => {
    for (const c of el.children ?? []) { out.push(c); all(c, out); }
    return out;
};
/** The image menu inside a panel: its head button and its items by label. */
const imageMenu = (panel) => {
    const menu = all(panel).find((c) => String(c.className).includes("img-menu"));
    if (!menu) return null;
    const head = (menu.children ?? []).find((c) => c.textContent === "image");
    const pop = (menu.children ?? []).find((c) => String(c.className).includes("img-pop"));
    const items = {};
    for (const b of pop?.children ?? []) if (b.textContent) items[b.textContent] = b;
    return { menu, head, pop, items };
};
const click = (el) => (el.on?.click ?? []).forEach((f) => f({}));
/** The canvas size the view has settled on. */
const canvasSize = (container) => {
    const c = (container.children ?? []).find((k) => k.tagName === "canvas");
    return c ? { w: c.width, h: c.height } : null;
};
const pressEsc = () =>
    (doc.on?.keydown ?? []).forEach((f) => f({ key: "Escape" }));

test("the image menu is one button holding the three choices", () => {
    // Jake: "make a button/dropdown called image. pressing image will allow
    // three choices." So `export svg` is no longer a button of its own -- it
    // is the first item of the menu that replaced it.
    const panel = host("m-panel");
    createPentagrid({ container: host("m"), panel });
    const m = imageMenu(panel);
    assert.ok(m?.head, "no image menu in the panel");
    assert.equal(m.head.textContent, "image");
    assert.deepEqual(Object.keys(m.items), ["export svg", "show", "image link"]);
    // Shut until pressed, and a choice shuts it again: these are verbs, not
    // settings, so there is nothing to come back to.
    assert.equal(m.pop.hidden, true, "the menu starts open");
    click(m.head);
    assert.equal(m.pop.hidden, false, "pressing image did not open it");
    click(m.head);
    assert.equal(m.pop.hidden, true, "pressing it again did not shut it");
});

test("the popup's own display cannot outvote the hidden attribute", () => {
    // Jake: "It shouldn't show the drop down buttons unless I push image."
    // `.img-pop { display: flex }` beats the browser's own
    // `[hidden] { display: none }`, so `pop.hidden = true` set an attribute
    // that changed nothing and the menu came up open. A test in node cannot
    // see a computed style, so this reads the rule -- which is the claim that
    // was missing, not the attribute.
    const css = readFileSync("lib/css/panel.css", "utf8");
    assert.match(css, /\.img-pop\[hidden\]\s*\{[^}]*display:\s*none/,
        "nothing re-asserts display:none for a hidden .img-pop");
    // And the same hazard anywhere else a rule gives something a display and
    // the code then hides it with the attribute.
    for (const [sel, file] of [[".show-exit", "site.css"]]) {
        const src = readFileSync(file, "utf8");
        const rule = src.slice(src.indexOf(sel));
        assert.ok(!/^[^}]*display:/.test(rule.slice(0, rule.indexOf("}"))),
            `${sel} sets a display, so it needs a [hidden] rule beside it`);
    }
});

test("the stage's geometry is inline, because a class cannot win", () => {
    // `view/layers.ts` sets `style.position = "relative"` on a container whose
    // computed position is static -- method's -- and an inline style beats any
    // class. `.show-stage { position: fixed }` lost, the stage stayed in the
    // flow with `height: auto`, and a box whose canvases are absolute is zero
    // tall: the canvas hung out below it with the page's text above. Jake: "a
    // half text half image that only took the bottom half of the view."
    const container = host("pinned");
    container.style.position = "relative";          // what layers.ts does
    const h = createPentagrid({ container, panel: host("pinned-panel") });
    h.show();
    assert.equal(container.style.position, "fixed",
                 "the stage is not pinned by inline style");
    for (const [k, v] of Object.entries({ top: "0", left: "0", right: "0",
                                          bottom: "0", width: "100%",
                                          height: "100%", zIndex: "9000" })) {
        assert.equal(container.style[k], v, `${k} is not pinned`);
    }
    // The background is NOT inline: moiré's merged rule has to be able to keep
    // the upper canvas transparent, and an inline background could not be
    // overridden by any stylesheet.
    assert.ok(!container.style.background, "the stage pinned a background");
    h.show(false);
    assert.equal(container.style.position, "relative",
                 "leaving did not put the container's own position back");
    assert.equal(container.style.height, "", "leaving left a height behind");
});

test("show fills the window, and tells the view so", () => {
    const container = host("s1");
    const h = createPentagrid({ container, panel: host("s1-panel") });
    const was = canvasSize(container);
    assert.deepEqual(was, { w: 800, h: 800 }, "the canvas did not start at its box");
    assert.equal(h.showing(), false);

    h.show();
    assert.equal(h.showing(), true);
    assert.ok(container.classList.contains("show-stage"),
              "the container was not lifted over the page");
    assert.ok(doc.body.classList.contains("showing"),
              "the page behind can still scroll");
    assert.deepEqual(canvasSize(container), { w: 1280, h: 720 },
        "the canvas was stretched rather than re-laid at the window's shape");

    // An exit, because a picture with no way out is a trap -- and the page's
    // own controls are under the stage.
    const exit = (doc.body.children ?? []).find(
        (c) => String(c.className).includes("show-exit"));
    assert.ok(exit, "no exit button");
    assert.equal(exit.hidden, false);

    h.show(false);
    assert.equal(h.showing(), false);
    assert.equal(container.classList.contains("show-stage"), false);
    assert.equal(doc.body.classList.contains("showing"), false);
    assert.deepEqual(canvasSize(container), was,
        "leaving stranded the canvas at window size");
    assert.equal(exit.hidden, true, "the exit button stayed up");
});

test("escape leaves, and the exit button leaves everything", () => {
    const a = host("e1"), b = host("e2");
    const ha = createPentagrid({ container: a, panel: host("e1-panel") });
    const hb = createPentagrid({ container: b, panel: host("e2-panel") });

    ha.show();
    pressEsc();
    assert.equal(ha.showing(), false, "escape did not leave");

    // Two at once is moiré merged: one cell, two containers, and one way out.
    ha.show();
    hb.show();
    assert.equal(ha.showing() && hb.showing(), true);
    const exit = (doc.body.children ?? []).find(
        (c) => String(c.className).includes("show-exit"));
    click(exit);
    assert.equal(ha.showing(), false, "the exit left only one of the two");
    assert.equal(hb.showing(), false);
    assert.equal(doc.body.classList.contains("showing"), false,
                 "the body class outlived the last stage");
});

test("the image link carries the setup AND which container to show", () => {
    const container = host("linky");
    const h = createPentagrid({ container, panel: host("linky-panel") });
    h.markBaseline();
    h.setTileStyle({ p1Palette: "patriotic" });
    h.setView({ scale: 68, x: 0.5, y: -0.25 });
    const url = h.imageLink();
    assert.ok(url.includes("p1-palette=patriotic"), `no setup in ${url}`);
    assert.ok(url.includes("scale=68"), "no view in the image link");
    assert.ok(url.includes(`${SHOW_PARAM}=linky`),
              `the link does not say which container: ${url}`);
    // One `?`, however many parameters.
    assert.equal(url.split("?").length, 2, `malformed query in ${url}`);
    // And `copy link` is unchanged -- the two differ by exactly the showing.
    assert.equal(url.replace(`&${SHOW_PARAM}=linky`, ""), h.link());
});

test("a link that says show comes up showing, with its setup", () => {
    resetShowClaim();
    const container = host("fromlink");
    const h = createPentagrid({
        container, panel: host("fromlink-panel"),
        query: "?p1-palette=patriotic&scale=55&show=fromlink",
    });
    assert.equal(h.showing(), true, "the link asked to show and the page did not");
    assert.equal(h.getTileStyle().p1Palette, "patriotic",
                 "shown, but not the setup the link carried");
    assert.equal(h.getView().scale, 55);
    assert.deepEqual(canvasSize(container), { w: 1280, h: 720 });
    h.show(false);
});

test("show names its container, so a two-canvas page is unambiguous", () => {
    resetShowClaim();
    // The same query reaching both canvases -- which is what happens on moiré
    // and split, both sides reading `location.search` -- shows the one named.
    const q = "?show=right";
    const left = createPentagrid({ container: host("left"), panel: host("l-p"), query: q });
    const right = createPentagrid({ container: host("right"), panel: host("r-p"), query: q });
    assert.equal(left.showing(), false, "the wrong canvas went full window");
    assert.equal(right.showing(), true, "the named canvas did not");
    right.show(false);
});

test("a bare ?show is claimed once, not by every canvas on the page", () => {
    resetShowClaim();
    const q = "?show";
    const first = createPentagrid({ container: host("b1"), panel: host("b1-p"), query: q });
    const second = createPentagrid({ container: host("b2"), panel: host("b2-p"), query: q });
    assert.equal(first.showing(), true, "a bare ?show did nothing");
    assert.equal(second.showing(), false,
                 "a bare ?show raised a second stage over the first");
    first.show(false);
});

test("show is not part of a setup, so it does not suppress the session", async () => {
    // It is how the picture is PRESENTED. A `?show` with nothing else in it
    // must still come up as the page the visitor left, or the link would be
    // quietly resetting their work to the defaults.
    const { hasQuerySetup } = await import("../dist/state/query.js");
    assert.equal(hasQuerySetup("?show=stage"), false);
    assert.equal(hasQuerySetup("?show"), false);
    // With a setup beside it, the setup still counts.
    assert.equal(hasQuerySetup("?show=stage&p1-palette=patriotic"), true);
});
