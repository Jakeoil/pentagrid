// moire.html: two pentagrids, one the other deflated, and the register
// between them. PLAN §12.

import test from "node:test";
import assert from "node:assert/strict";
import { handlers, inputs, makeStub } from "./domstub.mjs";
import { convertView } from "../dist/view/register.js";

const PHI = (1 + Math.sqrt(5)) / 2;

test("converting a view between generations keeps the same world rectangle", () => {
    // A view is in TILING units and a tiling unit is λ world units, so the two
    // sides do not share view numbers. What they must agree on is the world:
    // the rectangle on screen, and where it sits.
    const v = { scale: 60, x: 1.7, y: -0.4 };
    const W = 800, H = 600;
    // The world rectangle a canvas shows, from its own view and its own λ.
    const world = (view, lam) => ({
        xMin: (view.x - W / 2 / view.scale) * lam,
        xMax: (view.x + W / 2 / view.scale) * lam,
        yMin: (view.y - H / 2 / view.scale) * lam,
        yMax: (view.y + H / 2 / view.scale) * lam,
    });
    for (const m of [-3, -2, -1, 0, 1, 2, 3]) {
        const lamTo = PHI ** m;
        const got = convertView(v, 1, lamTo);
        const a = world(v, 1), b = world(got, lamTo);
        for (const k of ["xMin", "xMax", "yMin", "yMax"]) {
            assert.ok(Math.abs(a[k] - b[k]) < 1e-9,
                      `λ = φ^${m}: ${k} is ${b[k]}, not ${a[k]}`);
        }
    }
    // Same λ is the identity, which is what pair.ts relies on.
    assert.deepEqual(convertView(v, 2, 2), v);
    // And it round-trips.
    const there = convertView(v, 1, 1 / PHI);
    const back = convertView(there, 1 / PHI, 1);
    for (const k of ["scale", "x", "y"]) assert.ok(Math.abs(back[k] - v[k]) < 1e-12);
});

// The module builds the page on import, against the stub, and ESM caches it --
// so it is imported once here and the tests below drive what it built.
const page = await import("../dist/app/moire.js");
const doc = globalThis.document;
const cap = (id) => doc.getElementById(id).textContent ?? "";
const control = (cls) => inputs.find((i) => i.className === cls);
const fire = (el) => (el.on?.change ?? []).forEach((fn) => fn());
const click = (el) => (el.on?.click ?? []).forEach((fn) => fn());
/** A button in the bar, by class — buttons are not `inputs`. */
const button = (cls) => (doc.getElementById("moire-bar").children ?? [])
    .find((c) => c.className === cls);
/** Set A's offsets and let the page hear about it. */
const setA = (values) => {
    page.sideA.gamma.setLocked(-1);
    page.sideA.gamma.setValues(values);
};

test("the page builds two sides and names both classes", () => {
    assert.ok(page.sideA && page.sideB, "the page built no sides");
    // Both start Penrose: A is, and deflation fixes the class at 0.
    assert.match(cap("moire-a-caption"), /^A — class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /^B — class 0 · Penrose/);
    // B is one deflation down, and says so; A is at generation 0 and says nothing.
    assert.match(cap("moire-b-caption"), /λ = φ⁻¹/);
    assert.doesNotMatch(cap("moire-a-caption"), /λ/);
});

test("B is A deflated: the class follows s to -2s mod 1", () => {
    // 1/2 deflates INTO Penrose in one step -- the fact the page exists for.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.5]);
    assert.match(cap("moire-a-caption"), /class 1\/2/);
    assert.match(cap("moire-b-caption"), /class 0 · Penrose/);

    // 1/4 goes to 1/2, not to 0: one deflation is not enough.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.match(cap("moire-b-caption"), /class 1\/2/);

    // 1/5 runs a four-cycle and never reaches Penrose: 1/5 -> 3/5.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.2]);
    assert.match(cap("moire-b-caption"), /class 3\/5/);
});

test("the step count is how many INFLATIONS B is", () => {
    // Jake asked for it this way round -- "First inflation factor (yes,
    // opposite of moire)" -- so a positive k goes UP and the page's own
    // subject, deflation, is the negative direction and the default.
    const steps = control("moire-steps");
    assert.ok(steps, "no step control");
    assert.equal(steps.value, "-1", "the default is not one deflation");

    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.125]);   // 1/8
    steps.value = "-3";
    fire(steps);
    // 1/8 -> 3/4 -> 1/2 -> 0, and three deflations is λ = φ⁻³.
    assert.match(cap("moire-b-caption"), /class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /λ = φ⁻³/);
    // Zero is B at A's own generation, so it reads A's class back.
    steps.value = "0";
    fire(steps);
    assert.match(cap("moire-b-caption"), /class 1\/8/);
    // And positive goes the other way: two inflations is λ = φ².
    steps.value = "2";
    fire(steps);
    assert.match(cap("moire-b-caption"), /λ = φ²/);
    steps.value = "-1";
    fire(steps);
});

test("unlinking leaves B where it was", () => {
    const link = control("moire-link");
    assert.ok(link, "no link control");
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083]);           // A back to Penrose
    const before = cap("moire-b-caption");
    assert.match(before, /class 0 · Penrose/);
    link.checked = false;
    fire(link);
    // A to 1/4, whose deflation is 1/2 -- so a B that followed would read
    // DIFFERENTLY from a B that did not. Moving A to 1/2 would not have tested
    // anything: 1/2 deflates to Penrose, which is where B already was.
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.equal(cap("moire-b-caption"), before, "B followed A with the link off");
    link.checked = true;
    fire(link);
    assert.match(cap("moire-b-caption"), /class 1\/2/, "relinking did not catch B up");
});

test("the merge switch stacks the canvases, and only while it is on", () => {
    const grid = doc.getElementById("moire-grid");
    const merge = control("moire-merge");
    assert.ok(merge, "no merge control");
    assert.equal(grid.classList.contains("merged"), false, "merged before anything was clicked");
    merge.checked = true;
    fire(merge);
    assert.equal(grid.classList.contains("merged"), true, "the merge switch did not stack them");
    merge.checked = false;
    fire(merge);
    assert.equal(grid.classList.contains("merged"), false, "the canvases stayed stacked");
});

test("reset page puts the whole page back, switches included", () => {
    // The per-side `reset page` is in the settings row, which exposeRows trims
    // away here, so this button is the only way back. Jake: "Is there a clear
    // all button to go back to page defaults."
    const reset = button("moire-reset");
    assert.ok(reset, "no reset-page button in the bar");

    // Put everything out of its default state.
    const link = control("moire-link"), steps = control("moire-steps");
    const merge = control("moire-merge"), grid = doc.getElementById("moire-grid");
    setA([0.0817, 0.3391, -0.2234, 0.1109, -0.3083 + 0.25]);      // A off Penrose
    steps.value = "3"; fire(steps);
    link.checked = false; fire(link);
    merge.checked = true; fire(merge);
    assert.match(cap("moire-a-caption"), /class 1\/4/);
    assert.equal(grid.classList.contains("merged"), true);

    click(reset);

    assert.equal(link.checked, true, "link did not come back on");
    assert.equal(steps.value, "-1", "the step count did not come back to one deflation");
    assert.equal(merge.checked, false, "merge did not come back off");
    assert.equal(grid.classList.contains("merged"), false, "the canvases stayed stacked");
    // Both tilings back to the page's own γ, which is Penrose, and B one
    // deflation below it.
    assert.match(cap("moire-a-caption"), /^A — class 0 · Penrose/);
    assert.match(cap("moire-b-caption"), /^B — class 0 · Penrose, λ = φ⁻¹/);
});

// ── The two canvases stay on the same rectangle of the plane ──────────

const PHI_ = (1 + Math.sqrt(5)) / 2;
/** The first descendant of a host that listens for `type`. */
const listener = (hostId, type) => {
    let hit = null;
    const walk = (el) => {
        for (const c of el.children ?? []) {
            if (!hit && c.on?.[type]?.length) hit = c;
            walk(c);
        }
    };
    walk(doc.getElementById(hostId));
    return hit;
};
const fireOn = (hostId, type, ev) =>
    (listener(hostId, type).on[type] ?? []).forEach((fn) => fn(ev));
const lamOf = (h) => h.gamma.model.lambda ?? 1;
/** Center and span in WORLD units -- what the two must agree on, whatever
 *  their generations and so whatever their view numbers. */
const onScreen = (h) => {
    const v = h.getView(), L = lamOf(h);
    return [v.x * L, v.y * L, (800 / v.scale) * L];
};
const apart = () => {
    const a = onScreen(page.sideA), b = onScreen(page.sideB);
    return Math.max(...a.map((x, i) => Math.abs(x - b[i])));
};
const wheel = (hostId, dir, x = 400, y = 400) =>
    fireOn(hostId, "wheel", { preventDefault() {}, deltaY: dir * 120, offsetX: x, offsetY: y });

test("zooming OFF CENTER keeps the two on the same rectangle", () => {
    // The bug Jake hit: the view was relayed between writing x and writing y,
    // so every zoom handed the other canvas the new x and the PREVIOUS y.
    // Zooming at dead center hides it -- there the two y are equal -- which is
    // why it has to be tested off center.
    const reset = button("moire-reset");
    click(reset);
    assert.ok(apart() < 1e-9, "not in register to begin with");
    for (const [x, y] of [[300, 250], [520, 610], [120, 700]]) {
        wheel("moire-a", -1, x, y);
        assert.ok(apart() < 1e-9, `zoom at (${x}, ${y}) on A left them ${apart().toFixed(4)} apart`);
        wheel("moire-b", 1, x, y);
        assert.ok(apart() < 1e-9, `zoom at (${x}, ${y}) on B left them ${apart().toFixed(4)} apart`);
    }
    click(reset);
});

test("the double-click reset moves both, not one", () => {
    // Same shape: the scale was relayed before the center was written, and the
    // center was never relayed at all.
    const reset = button("moire-reset");
    click(reset);
    wheel("moire-a", -1, 300, 250);
    wheel("moire-a", -1, 300, 250);
    assert.ok(apart() < 1e-9);
    fireOn("moire-a", "dblclick", {});
    assert.ok(apart() < 1e-9, `after a double-click they are ${apart().toFixed(4)} apart`);
    const [x, y, span] = onScreen(page.sideA);
    assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9, "the reset did not center A");
    click(reset);
});

test("the two share one zoom limit, so crossing between them does not jump", () => {
    // The wheel's bounds are in pixels per TILING unit, and B's tiling unit is
    // smaller, so the same numbers stop the two at different world scales.
    // Whichever canvas the pointer was over then decided where zooming ended,
    // and moving to the other jumped by phi.
    const reset = button("moire-reset");
    click(reset);
    for (let i = 0; i < 14; i++) wheel("moire-a", -1);       // A to its limit
    const atLimit = onScreen(page.sideA)[2];
    for (let i = 0; i < 3; i++) wheel("moire-b", -1);        // keep going on B
    const past = onScreen(page.sideA)[2];
    assert.ok(Math.abs(past - atLimit) < 1e-9,
              `B zoomed ${(atLimit / past).toFixed(2)}x past A's limit`);
    wheel("moire-a", -1);                                     // and back to A
    assert.ok(Math.abs(onScreen(page.sideA)[2] - past) < 1e-9,
              "the zoom jumped when the pointer crossed over");
    assert.ok(apart() < 1e-9, "and they are out of register");
    click(reset);
});

test("a fold opens on both sides at once, so the two panels stay the same shape", () => {
    // Each side carries the same folded rows. Opened independently, one panel
    // grows a line and the other does not: every row below it shifts on one
    // side only and the canvas under it drops, so the two stop corresponding.
    // Jake: "Try to keep the window containers the same height when they
    // uncollapse like in split. [...] Put them in the same relative positions."
    const foldsOf = (id) => {
        const out = new Map();
        const walk = (el, row) => {
            for (const c of el.children ?? []) {
                const n = c.dataset?.row || row;
                if (c.tagName === "details" && n && !out.has(n)) out.set(n, c);
                walk(c, n);
            }
        };
        walk(doc.getElementById(id), null);
        return out;
    };
    const A = foldsOf("moire-a-panel"), B = foldsOf("moire-b-panel");
    assert.deepEqual([...A.keys()], [...B.keys()], "the two panels carry different rows");
    for (const name of ["pentaplex", "next-rhomb", "kites", "misc", "for groups"]) {
        assert.ok(A.has(name), `no ${name} fold on A`);
    }
    // The stub does not fire `toggle` on assignment the way a browser does, so
    // the handlers are run by hand -- which is also what makes the mirroring
    // visible rather than hidden inside the DOM.
    const fire = (d) => (d.on?.toggle ?? []).forEach((f) => f());
    for (const d of [...A.values(), ...B.values()]) d.open = false;

    for (const name of ["pentaplex", "kites", "for groups"]) {
        A.get(name).open = true;
        fire(A.get(name));
        assert.equal(B.get(name).open, true, `opening ${name} on A left B shut`);
        A.get(name).open = false;
        fire(A.get(name));
        assert.equal(B.get(name).open, false, `shutting ${name} on A left B open`);
    }
    // And the other way round: B leads just as well.
    B.get("misc").open = true;
    fire(B.get("misc"));
    assert.equal(A.get("misc").open, true, "opening misc on B left A shut");

    // The echo stops rather than bouncing: running the mirror again changes
    // nothing, which is what lets a browser's after-the-fact `toggle` be safe.
    fire(A.get("misc"));
    fire(B.get("misc"));
    assert.equal(A.get("misc").open, true);
    assert.equal(B.get("misc").open, true);
});

test("the dressing folds are actually on screen, not merely built", () => {
    // They were in the DOM and hidden: exposeRows trims the panel to a named
    // list and the folds were not on it, so the mirroring worked on rows
    // nobody could see. Jake: "I don't see the folded (collapsed?) entries
    // above the canvases."
    const shown = (id) => {
        const out = [];
        const walk = (el) => {
            for (const c of el.children ?? []) {
                if (c.dataset?.row && c.hidden !== true) out.push(c.dataset.row);
                walk(c);
            }
        };
        walk(doc.getElementById(id));
        return out;
    };
    for (const id of ["moire-a-panel", "moire-b-panel"]) {
        const rows = shown(id);
        for (const name of ["pentaplex", "next-rhomb", "kites", "misc"]) {
            assert.ok(rows.includes(name), `${name} is not showing in ${id}: ${rows.join(" ")}`);
        }
        // `for groups` keeps its own condition -- the system is thick/thin here.
        assert.ok(!rows.includes("for groups"),
                  "for groups is showing with the tiles colored by type");
    }
    // and turning the system to groups brings it out, on both sides
    page.sideA.setTileStyle({ color: "groups" });
    page.sideB.setTileStyle({ color: "groups" });
    for (const id of ["moire-a-panel", "moire-b-panel"]) {
        assert.ok(shown(id).includes("for groups"), `for groups stayed hidden in ${id}`);
    }
    page.sideA.setTileStyle({ color: "type" });
    page.sideB.setTileStyle({ color: "type" });
});

test("the page says which build it is", () => {
    // Only roof carried a stamp; method gets its tag from the narrative step
    // bar, which this page has no reason to have. Jake: "I can't see a
    // buildid on the page."
    const stamp = doc.getElementById("moire-buildid");
    assert.ok(stamp, "no build-id element");
    assert.match(stamp.textContent ?? "", /^build id \d\d:\d\d:\d\d$/,
                 `the stamp reads ${JSON.stringify(stamp.textContent)}`);
});

test("the normalization reaches B as a power of phi, and resizes it alone", () => {
    // The second parameter: an extra power of phi on B's lambda, on top of the
    // inflation. It lives on B's GammaSet, which is also what B's reticulum
    // writes, so the two controls are two ways to one piece of state.
    const PHI_ = (1 + Math.sqrt(5)) / 2;
    const reset = button("moire-reset");
    click(reset);
    const steps = control("moire-steps"), norm = control("moire-norm");
    assert.ok(norm, "no normalization control in the bar");
    assert.equal(norm.value, "0");
    assert.equal(page.sideB.gamma.getNormalization(), 0);

    const gammaB = () => page.sideB.gamma.values().join(",");
    const before = gammaB();
    norm.value = "2";
    fire(norm);
    assert.equal(page.sideB.gamma.getNormalization(), 2, "the bar's n did not reach B");
    assert.equal(page.sideA.gamma.getNormalization(), 0, "it reached A as well");
    assert.equal(gammaB(), before, "n moved B's gamma, which only the inflation may do");

    // B is one deflation down by default, so phi^2 on top puts its lambda at
    // phi: the deflated tiling drawn LARGER than its parent, which is the kind
    // of reconciliation the control exists for.
    assert.ok(Math.abs(page.sideB.gamma.model.lambda - PHI_) < 1e-9,
              `B's lambda is ${page.sideB.gamma.model.lambda}, not phi`);

    // It survives a change of generation -- lambda is the two exponents added.
    steps.value = "2";
    fire(steps);
    assert.equal(page.sideB.gamma.getNormalization(), 2, "changing the inflation wiped n");
    assert.ok(Math.abs(page.sideB.gamma.model.lambda - PHI_ ** 4) < 1e-9);

    // And the two canvases are still on the same rectangle of the plane: n
    // rides on lambda, which the relay already reads.
    assert.ok(apart() < 1e-9, `n left them ${apart().toFixed(4)} apart`);

    click(reset);
    assert.equal(norm.value, "0", "reset did not put n back");
    assert.equal(page.sideB.gamma.getNormalization(), 0, "reset left B scaled");
});
