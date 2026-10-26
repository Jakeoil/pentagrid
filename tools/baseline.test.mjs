// Reset to a page's baseline — PLAN section 9.6, step 3 of 9.10.
//
// Jake's fifth want: "as always, a reset to defaults for a page." The care is
// in WHOSE defaults: the view's literals are NO_FEATURES and TILE_DEFAULTS, but
// no page runs on those -- each layers its own config over them, and lift sets
// grow, fold, elevation and azimuth. So resetting to the view's defaults would
// land a page somewhere it has never been, which is what these tests pin.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStub } from "./domstub.mjs";
import { createPentagrid, NO_FEATURES, TILE_DEFAULTS } from "../dist/view/pentagrid.js";
import { createGrowthView } from "../dist/view/growth.js";
import { captureGamma, restoreGamma } from "../dist/state/baseline.js";
import { FIELDS, alternative } from "../dist/state/inventory.js";

function host(w = 800, h = 800) {
    const el = makeStub({
        children: [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
        getAttribute: () => null,
    });
    el.appendChild = (c) => { el.children.push(c); return c; };
    return el;
}
/** The drawing, as a string, so "unchanged" can be asserted rather than hoped. */
function recorder(layer) {
    const path = [];
    layer.ctx.moveTo = (x, y) => path.push(`M${x.toFixed(3)},${y.toFixed(3)}`);
    layer.ctx.lineTo = (x, y) => path.push(`L${x.toFixed(3)},${y.toFixed(3)}`);
    layer.ctx.arc = (x, y, r) => path.push(`A${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)}`);
    layer.ctx.fill = function () { path.push(`F${this.fillStyle}`); };
    layer.ctx.stroke = function () { path.push(`S${this.strokeStyle}`); };
    return () => { path.length = 0; return path; };
}

test("reset goes to the PAGE's baseline, not the view's defaults", () => {
    // A page whose config differs from the view's literals in both objects.
    const h = createPentagrid({
        container: host(), panel: host(800, 300),
        features: { penroseTiles: true, penroseEdges: true },
        tileStyle: { color: "bands", band: 0.25, pentaFace: true },
    });
    // Those are the page's, and they are not the view's.
    assert.notEqual(TILE_DEFAULTS.color, "bands");
    assert.equal(NO_FEATURES.penroseTiles, false);

    h.setTileStyle({ color: "groups", pentaFace: false, opacity: 0.3 });
    h.setFeatures({ kRegions: true });
    h.reset();

    const t = h.getTileStyle(), f = h.getFeatures();
    assert.equal(t.color, "bands", "reset went to the view's color, not the page's");
    assert.equal(t.band, 0.25);
    assert.equal(t.pentaFace, true);
    assert.equal(t.opacity, TILE_DEFAULTS.opacity, "a field the page never set should go home too");
    assert.equal(f.penroseTiles, true, "reset lost the page's own features");
    assert.equal(f.penroseEdges, true);
    assert.equal(f.kRegions, false, "reset kept a feature switched on since");
});

test("markBaseline moves home, for a page that configures after construction", () => {
    // roof.ts binds its controls and fires each apply() to push the markup's
    // initial values in, so a page's real home is after that wiring -- which is
    // why this is two calls and not one.
    const h = createPentagrid({ container: host(), panel: host(800, 300) });
    h.setTileStyle({ color: "kowalewski", boldEdges: true });
    h.markBaseline();
    h.setTileStyle({ color: "type", boldEdges: false });
    h.reset();
    assert.equal(h.getTileStyle().color, "kowalewski", "markBaseline did not move home");
    assert.equal(h.getTileStyle().boldEdges, true);
});

test("every field in the inventory goes home, one at a time", () => {
    // Section 9.7's per-field walk. An end-to-end reset alone would miss a
    // field left at its default; this perturbs each one on its own.
    const h = createPentagrid({
        container: host(), panel: host(800, 300),
        features: { penroseTiles: true },
    });
    h.markBaseline();
    // Read and write each owner through the handle it belongs to.
    const read = {
        tileStyle: (k) => h.getTileStyle()[k],
        features: (k) => h.getFeatures()[k],
        grid: (k) => (k === "gridAlpha" ? h.getGridAlpha() : undefined),
    };
    const write = {
        tileStyle: (k, v) => h.setTileStyle({ [k]: v }),
        features: (k, v) => h.setFeatures({ [k]: v }, { merge: true }),
        grid: (k, v) => { if (k === "gridAlpha") h.setGridAlpha(v); },
    };
    for (const f of FIELDS) {
        if (f.owner === "growth") continue;              // not this view's
        // gridLineWidth has no setter on the handle -- it is a panel slider --
        // so it cannot be driven from here. It is covered by the embed tests.
        if (read[f.owner](f.key) === undefined) continue;
        const before = read[f.owner](f.key);
        const alt = alternative(f, before);
        write[f.owner](f.key, alt);
        assert.equal(read[f.owner](f.key), alt,
                     `${f.owner}.${f.key} would not take ${alt}`);
        h.reset();
        assert.equal(read[f.owner](f.key), before,
                     `${f.owner}.${f.key} came back as ${read[f.owner](f.key)}, `
                     + `not ${before}`);
    }
});

test("a baseline covers every field the inventory names", () => {
    // The inventory as auditor: the reset works from a snapshot of whole
    // objects, which cannot miss a field -- and this is the check that the two
    // descriptions of the state agree.
    const h = createPentagrid({ container: host(), panel: host(800, 300) });
    const got = { tileStyle: Object.keys(h.getTileStyle()).sort(),
                  features: Object.keys(h.getFeatures()).sort() };
    for (const owner of ["tileStyle", "features"]) {
        const named = FIELDS.filter((f) => f.owner === owner).map((f) => f.key).sort();
        assert.deepEqual(got[owner], named,
                         `the ${owner} snapshot and the inventory disagree`);
    }
});

test("reset restores the view, the layer visibility and gamma", () => {
    const h = createPentagrid({
        container: host(), panel: host(800, 300),
        features: { penroseTiles: true },
    });
    h.gamma.setGuard(true);
    h.markBaseline();
    const view0 = h.getView();
    const gamma0 = h.gamma.exact().join(",");
    const vis0 = h.stack.visibility();

    h.setView({ scale: view0.scale * 2.5, x: 3, y: -4 });
    h.gamma.setValues([0.11, 0.23, 0.31, 0.17, 0.4]);
    h.stack.setVisibility({ "penrose-tiles": false });
    h.reset();

    assert.deepEqual(h.getView(), view0, "the view did not come home");
    assert.equal(h.gamma.exact().join(","), gamma0, "gamma did not come home, exactly");
    assert.deepEqual(h.stack.visibility(), vis0, "layer visibility did not come home");
});

test("the drawing after a reset is identical, byte for byte", () => {
    // The acceptance test of section 9.7, in its reset form.
    const h = createPentagrid({
        container: host(), panel: host(800, 300),
        features: { penroseTiles: true, penroseEdges: true },
        tileStyle: { color: "bands", band: 0.4 },
    });
    h.gamma.setGuard(true);
    h.markBaseline();
    const layer = h.stack.get("penrose-tiles");
    const reset = recorder(layer);
    const draw = () => { const p = reset(); h.redraw(); return p.join("|"); };
    const before = draw();
    assert.ok(before.length > 2000, "nothing was drawn, so this proves nothing");

    h.setTileStyle({ color: "groups", pentaFace: true, pentaShape: "outie",
                     shading: true, opacity: 0.5 });
    h.setFeatures({ kRegions: true, penroseVertices: true }, { merge: true });
    h.setView({ scale: 70, x: 1.5, y: 2 });
    h.gamma.setValues([0.3, 0.1, 0.2, 0.25, 0.15]);
    assert.notEqual(draw(), before, "the perturbation changed nothing");

    h.reset();
    assert.equal(draw(), before, "the drawing did not come back after a reset");
});

test("gamma captures and restores exactly, including its flags", () => {
    const h = createPentagrid({ container: host(), panel: host(800, 300) });
    const g = h.gamma;
    g.setLocked(-1);
    g.setValues([0.2, 0.2, 0.2, 0.2, 0.2]);
    g.setLocked(2);
    g.setGuard(true);
    g.setGeneration(-2);
    g.setFamilyEnabled(3, false);
    g.setFamilyLine(1, 2);
    const snap = captureGamma(g);

    g.setLocked(0);
    g.setValues([0.4, 0.1, 0.1, 0.2, 0.2]);
    g.setGuard(false);
    g.setGeneration(1);
    g.setFamilyEnabled(3, true);
    g.setFamilyLine(1, null);
    restoreGamma(g, snap);

    assert.deepEqual(g.exact(), snap.exact, "the numerators are not exact");
    assert.equal(g.getLocked(), 2);
    assert.equal(g.getGuard(), true);
    assert.equal(g.getGeneration(), -2);
    assert.equal(g.familyEnabled(3), false);
    assert.equal(g.familyLine(1), 2);
    assert.equal(g.getSymmetry(), snap.symmetry);
});

test("the growth view resets its own state and the pentagrid under it", () => {
    const v = createGrowthView({ container: host(), lift: true });
    // lift's own setup, which is not the view's literals.
    assert.equal(v.get().fold, 1);
    assert.equal(v.get().grow, 1);
    v.markBaseline();
    const home = v.get();

    v.set({ grow: 0.3, fold: 0, paths: "high", axis: 3, penta: true,
            edgeStyle: "bold", resolve: true });
    v.pentagrid.setTileStyle({ color: "groups" });
    v.reset();

    const back = v.get();
    for (const k of ["grow", "fold", "paths", "axis", "penta", "edgeStyle", "resolve"]) {
        assert.equal(back[k], home[k], `growth ${k} came back as ${back[k]}`);
    }
    assert.equal(v.pentagrid.getTileStyle().color, TILE_DEFAULTS.color,
                 "the pentagrid under the growth view did not reset");
});
