// A setup in the query string — PLAN section 9.4's top sink.
//
// Jake, 2026-10-25: "This would include the query parameters for pages." And
// want #2 was "creating urls of existing pages eventually". The URL was the one
// sink never built: "don't update the URL" was read as "no URLs at all", and it
// is not -- the address bar is never WRITTEN, which is a different thing from
// never being READ.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { readQuery, hasQuerySetup, queryFor } from "../dist/state/query.js";
import { saveSession, forgetSession } from "../dist/state/session.js";
import { readFileSync } from "node:fs";

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
const build = (query, extra = {}) => createPentagrid({
    container: host(), panel: host({}, "p"), query, ...extra,
});

test("both spellings work, so a URL can be readable", () => {
    // ?data-color=bands is the canonical name; ?color=bands is what anyone
    // would actually type.
    assert.deepEqual(readQuery("?color=bands").tileStyle, { color: "bands" });
    assert.deepEqual(readQuery("?data-color=bands").tileStyle, { color: "bands" });
    // A bare parameter is HTML's kind of boolean.
    assert.deepEqual(readQuery("?penta-face").tileStyle, { pentaFace: true });
    assert.deepEqual(readQuery("?penta-face=false").tileStyle, { pentaFace: false });
    // And the three owners are sorted out as the attributes are.
    const got = readQuery("?penrose-tiles&paths=high&band=0.25");
    assert.deepEqual(got.features, { penroseTiles: true });
    assert.deepEqual(got.tileStyle, { band: 0.25 });
    assert.deepEqual(got.growth, { paths: "high" });
});

test("a value that does not parse is ignored, as everywhere else", () => {
    const got = readQuery("?color=chartreuse&band=wide&penta-face");
    assert.deepEqual(got.tileStyle, { pentaFace: true });
    assert.deepEqual(got.ignored.sort(), ["data-band", "data-color"]);
});

test("hasQuerySetup sees ours and ignores everyone else's", () => {
    assert.equal(hasQuerySetup(""), false);
    assert.equal(hasQuerySetup("?utm_source=x&fbclid=y"), false);
    assert.equal(hasQuerySetup("?color=bands"), true);
    assert.equal(hasQuerySetup("?data-penta-face"), true);
});

test("a query reaches the view, flat fields and slices alike", () => {
    const h = build("?penrose-tiles&color=bands&band=0.3&penta-face"
                    + "&gamma=2000,2000,2000,2000,2000&gamma-den=10000"
                    + "&gamma-locked=0&scale=72&view-x=1.5&hide=klabels");
    assert.equal(h.getFeatures().penroseTiles, true);
    const t = h.getTileStyle();
    assert.equal(t.color, "bands");
    assert.equal(t.band, 0.3);
    assert.equal(t.pentaFace, true);
    // Over the query's own denominator, 2000/10000 -- which is 6000/30000 over
    // the set's, and exactly, which is the point of carrying the denominator
    // in the link instead of assuming today's.
    assert.equal(h.gamma.exact().join(","), "6000,6000,6000,6000,6000");
    assert.equal(h.gamma.denominator, 30000);
    assert.equal(h.gamma.getLocked(), 0);
    assert.equal(h.getView().scale, 72);
    assert.equal(h.getView().x, 1.5);
    assert.equal(h.stack.visibility().klabels, false);
});

test("a link outranks the session, so a shared link is not the recipient's last visit", () => {
    // The one thing a link must not do.
    const id = "test.query.session";
    forgetSession(id);
    saveSession(id, { v: 1, tileStyle: { color: "kowalewski", boldEdges: true } });

    // No query: the session applies.
    const plain = build("", { session: id });
    assert.equal(plain.getTileStyle().color, "kowalewski", "the session did not apply");

    // A query: the session is suppressed for this load, entirely -- not merged.
    const linked = build("?color=bands", { session: id });
    assert.equal(linked.getTileStyle().color, "bands", "the link lost to the session");
    assert.equal(linked.getTileStyle().boldEdges, false,
                 "the session leaked in beside the link");
    forgetSession(id);
});

test("a query outranks the container's attributes too", () => {
    const h = createPentagrid({
        container: host({ "data-color": "groups", "data-bold-edges": "" }),
        panel: host({}, "p"), query: "?color=bands",
    });
    assert.equal(h.getTileStyle().color, "bands", "the markup beat the link");
    // And what the link is silent about still comes from the markup.
    assert.equal(h.getTileStyle().boldEdges, true,
                 "the link cleared an attribute it never mentioned");
});

test("reset returns to the markup, discarding the link as it does the session", () => {
    const h = createPentagrid({
        container: host({ "data-color": "groups" }),
        panel: host({}, "p"), query: "?color=bands&penta-face",
    });
    assert.equal(h.getTileStyle().color, "bands");
    h.reset();
    assert.equal(h.getTileStyle().color, "groups", "reset kept the link's state");
    assert.equal(h.getTileStyle().pentaFace, false);
});

test("link() round-trips: the URL it writes is the URL it reads", () => {
    const h = build("");
    h.markBaseline();
    h.setTileStyle({ color: "bands", band: 0.35, pentaFace: true,
                     pentaShape: "innie" });
    h.setFeatures({ penroseTiles: true, penroseEdges: true }, { merge: true });
    h.setView({ scale: 68, x: 0.75, y: -0.25 });
    const url = h.link();
    assert.ok(url.includes("?"), `no query in ${url}`);
    assert.ok(url.includes("color=bands"), `the link lacks the color: ${url}`);
    assert.ok(url.includes("penta-face"), "the link lacks a boolean");
    assert.ok(!url.includes("data-"), `the link uses the long spelling: ${url}`);

    const back = build(url.slice(url.indexOf("?")));
    assert.equal(back.getTileStyle().color, "bands");
    assert.equal(back.getTileStyle().band, 0.35);
    assert.equal(back.getTileStyle().pentaShape, "innie");
    assert.equal(back.getFeatures().penroseEdges, true);
    assert.equal(back.getView().scale, 68);
    assert.ok(Math.abs(back.getView().y + 0.25) < 1e-9);
});

test("queryFor writes the short spelling, booleans bare", () => {
    assert.equal(queryFor({}), "");
    assert.equal(queryFor({ "data-color": "bands" }), "?color=bands");
    assert.equal(queryFor({ "data-penta-face": "" }), "?penta-face");
    assert.ok(queryFor({ "data-gamma": "1,2,3" }).includes("gamma=1%2C2%2C3"),
              "a comma was not escaped");
});

test("nothing writes the address bar", () => {
    // "Don't update the URL." The read path exists; no write path does.
    for (const f of ["src/view/pentagrid.ts", "src/state/query.ts"]) {
        const src = readFileSync(f, "utf8");
        assert.ok(!/history\.(pushState|replaceState)/.test(src),
                  `${f} writes history`);
        assert.ok(!/location\.(href|search)\s*=/.test(src),
                  `${f} assigns to location`);
    }
});
