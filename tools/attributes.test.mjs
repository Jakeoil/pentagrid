// The container's attributes — PLAN section 9.8, step 5 of 9.10.
//
// Jake: "imagine exporting a library and allowing the canvas to be a widget.
// The settings would be html attributes." So the serialized form of a setup is
// attributes on the container, and the same surface serves a host configuring a
// widget and a saved setup being applied.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { readAttributes, watchAttributes } from "../dist/state/attributes.js";
import { createPentagrid } from "../dist/view/pentagrid.js";
import { createGrowthView } from "../dist/view/growth.js";
import { FIELDS, BY_ATTR } from "../dist/state/inventory.js";
import { TILE_DEFAULTS, NO_FEATURES, DEFAULTS } from "../dist/state/defaults.js";

/** A container carrying attributes, the way a host page would write them. */
function host(attrs = {}, w = 800, h = 800) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: (n) => (n in attrs ? attrs[n] : null),
        getAttributeNames: () => Object.keys(attrs),
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}

test("the three owners are sorted out, and nothing else is touched", () => {
    const got = readAttributes(host({
        "data-penrose-tiles": "",            // a feature, boolean
        "data-color": "bands",               // tileStyle, enum
        "data-band": "0.25",                 // tileStyle, number
        "data-growth-band": "0.75",          // growth, the prefixed collision
        "data-paths": "high",                // growth, enum
        "data-width": "900",                 // readCanvasSpec's, not ours
        "data-analytics-id": "x7",           // the host's own
        "id": "stage",
    }));
    assert.deepEqual(got.features, { penroseTiles: true });
    assert.deepEqual(got.tileStyle, { color: "bands", band: 0.25 });
    assert.deepEqual(got.growth, { band: 0.75, paths: "high" });
    assert.deepEqual(got.ignored, [], "something usable was ignored");
});

test("an attribute that does not parse is ignored, not guessed", () => {
    // Section 9.5: absent or unusable means the default. Never a guess.
    const got = readAttributes(host({
        "data-color": "chartreuse",          // not one of its five values
        "data-band": "wide",                 // not a number
        "data-penta-face": "",               // fine
    }));
    assert.deepEqual(got.tileStyle, { pentaFace: true });
    assert.deepEqual(got.ignored.sort(), ["data-band", "data-color"]);
});

test("every field in the inventory can be set by its attribute", () => {
    // The completeness claim of section 9.8: if the page can be written as
    // attributes then the surface covers what the page does. This is the half
    // that says every field is reachable.
    for (const f of FIELDS) {
        const raw = f.kind === "bool" ? "" : String(
            f.kind === "enum" ? f.values.find((v) => v !== f.fallback) : 0.75);
        const got = readAttributes(host({ [f.attr]: raw }));
        assert.ok(f.key in got[f.owner],
                  `${f.attr} did not reach ${f.owner}.${f.key}`);
        assert.equal(got.ignored.length, 0, `${f.attr}="${raw}" was ignored`);
    }
});

test("the markup is the last word, over the page's config", () => {
    // Order: the view's defaults, then what the page asked for in code, then
    // the markup -- because a host writing data-color on the div means it.
    const h = createPentagrid({
        container: host({ "data-color": "groups", "data-penta-face": "",
                          "data-penrose-edges": "" }),
        panel: host(),
        features: { penroseTiles: true },
        tileStyle: { color: "bands", band: 0.25 },
    });
    const t = h.getTileStyle(), f = h.getFeatures();
    assert.equal(t.color, "groups", "the markup lost to the page's config");
    assert.equal(t.pentaFace, true);
    assert.equal(t.band, 0.25, "the config was dropped where the markup was silent");
    assert.equal(f.penroseEdges, true, "a feature in the markup was dropped");
    assert.equal(f.penroseTiles, true, "the config's features were dropped");
});

test("the attributes are part of the page's home, so reset returns to them", () => {
    // For a widget the markup IS the page's setup, so the baseline is taken
    // after the attributes are read -- section 9.6 with section 9.8.
    const h = createPentagrid({
        container: host({ "data-color": "kowalewski", "data-bold-edges": "" }),
        panel: host(),
    });
    assert.equal(h.getTileStyle().color, "kowalewski");
    h.setTileStyle({ color: "type", boldEdges: false });
    h.reset();
    assert.equal(h.getTileStyle().color, "kowalewski",
                 "reset went past the markup to the view's default");
    assert.equal(h.getTileStyle().boldEdges, true);
});

test("the growth view takes its own slice, prefix and all", () => {
    const v = createGrowthView({
        container: host({ "data-growth-band": "0.2", "data-paths": "low",
                          "data-axis": "3", "data-penta": "",
                          "data-band": "0.9" }),   // the TILE band, not growth's
        lift: true,
    });
    const s = v.get();
    assert.equal(s.band, 0.2, "growth took the unprefixed band");
    assert.equal(s.paths, "low");
    assert.equal(s.axis, 3);
    assert.equal(s.penta, true);
    // lift still applied, since the markup said nothing about it.
    assert.equal(s.fold, 1, "lift's own setup was lost");
    // And the tile band went where it belongs, underneath.
    assert.equal(v.pentagrid.getTileStyle().band, 0.9);
});

test("a container with no attributes behaves exactly as before", () => {
    // The widget must cost the existing pages nothing.
    const bare = createPentagrid({ container: host(), panel: host() });
    assert.equal(bare.getTileStyle().color, TILE_DEFAULTS.color);
    assert.deepEqual(bare.getFeatures(), { ...NO_FEATURES });
    const g = createGrowthView({ container: host() });
    assert.deepEqual(g.get(), { ...DEFAULTS });
});

test("the watcher filters to our attributes, and survives having no observer", () => {
    // Section 9.8a: a change of attributes redraws. In node there is no
    // MutationObserver, so the call must return null rather than throw -- which
    // is also what an old browser gets.
    assert.equal(typeof MutationObserver, "undefined",
                 "node grew a MutationObserver; this test needs rethinking");
    assert.equal(watchAttributes(host(), () => {}), null);

    // And when there is one, it watches only the names the inventory knows.
    let filter = null;
    globalThis.MutationObserver = class {
        observe(_el, opts) { filter = opts.attributeFilter; }
        disconnect() {}
    };
    try {
        const stop = watchAttributes(host(), () => {});
        assert.equal(typeof stop, "function", "no way to stop watching");
        assert.deepEqual([...filter].sort(), [...BY_ATTR.keys()].sort());
        stop();
    } finally {
        delete globalThis.MutationObserver;
    }
});
