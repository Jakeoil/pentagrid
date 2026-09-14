// Deciding singularities by arithmetic, and the presets that show each kind.

import test from "node:test";
import assert from "node:assert/strict";

import { createGammaSet } from "../dist/geometry/gamma.js";
import { scanRegions } from "../dist/geometry/regularity.js";
import { resolveConcurrency } from "../dist/geometry/resolve.js";
import {
    classifySingularities, isRegular, SINGULAR_PRESETS, COUPLES,
} from "../dist/geometry/hunt.js";
import { TRIPLES } from "../dist/geometry/regularity.js";
import { angleCode } from "../dist/geometry/resolve.js";
import { collectRhombs } from "../dist/geometry/pentagrid.js";
import { findClusters } from "../dist/geometry/clusters.js";

const VIS = { xMin: -9, xMax: 9, yMin: -9, yMax: 9 };

/** Set a phase vector exactly, with the total released so nothing is imposed. */
function at(numerators, den) {
    const g = createGammaSet({ guard: false });
    g.setLocked(-1);
    g.setValues(numerators.map((q) => q / den));
    return g;
}

/** Which family-sets the scan actually finds, as sorted "abc" keys. */
function found(g) {
    const { concurrencies } = scanRegions(g.model, VIS, { scale: 1 });
    const kinds = new Map();
    for (const c of concurrencies) {
        const r = resolveConcurrency(g.model, c);
        if (!r) continue;
        kinds.set([...c.families].sort((a, b) => a - b).join(""), r.code);
    }
    return kinds;
}

test("the exact classifier agrees with the scan, on random rational phases", () => {
    const den = 20;
    let checked = 0;
    for (let t = 0; t < 120; t++) {
        // Biased towards integral phases, or almost everything is regular and the
        // test proves nothing.
        const q = Array.from({ length: 5 },
                             () => (t * 7 + Math.random() < 0.55 ? 0
                                    : Math.floor(Math.random() * den)));
        const g = at(q, den);
        const predicted = new Set(
            classifySingularities(g.model, q, den).map((k) => k.families.join("")));
        const actual = found(g);

        for (const key of predicted) {
            assert.ok(actual.has(key),
                      `gamma*${den} = ${q}: predicted ${key}, the scan found none`);
        }
        for (const key of actual.keys()) {
            assert.ok(predicted.has(key),
                      `gamma*${den} = ${q}: the scan found ${key}, unpredicted`);
        }
        checked++;
    }
    assert.equal(checked, 120);
});

test("a 4-fold is absorbed into a 5-fold exactly when the total is an integer", () => {
    // Sum(v_j) = 0, so at a point where four families meet,
    //     x.v_e + gamma_e = -Sum(n_j) + Sum(gamma)
    // and the fifth family passes through it iff Sum(gamma) is an integer. This
    // is why a locked total can never show an octagon.
    const den = 60;
    for (const fifth of [0, 30, 20, 15, 12]) {
        const q = [0, 0, 0, 0, fifth];
        const g = at(q, den);
        const kinds = classifySingularities(g.model, q, den);
        const octagons = kinds.filter((k) => k.fold === 4);
        const decagons = kinds.filter((k) => k.fold === 5);
        const sumIsInteger = fifth % den === 0;

        if (sumIsInteger) {
            assert.equal(octagons.length, 0, "an integral total showed an octagon");
            assert.equal(decagons.length, 1, "an integral total lost its decagon");
        } else {
            assert.equal(octagons.length, 1, `fifth = ${fifth}/${den}: no octagon`);
            assert.equal(decagons.length, 0, "a non-integral total showed a decagon");
        }
        // And the scan must agree, not just the arithmetic.
        const actual = found(g);
        assert.equal([...actual.keys()].filter((k) => k.length === 4).length,
                     octagons.length, `fifth = ${fifth}/${den}: scan disagrees`);
    }
});

test("every preset shows what its name says", () => {
    // The headline shape, and everything that necessarily comes with it. A
    // decagon cannot be had alone: all ten triples go singular with it.
    // The three Penrose states, and everything that necessarily comes with each.
    // Every preset, and everything that necessarily comes with it. The caps are
    // regular except deca, which is the 5-fold singularity itself.
    const expect = {
        "sun": {},
        "star": {},
        "deca": {},
        "regular": {},
        "couple": { "113": 1, "122": 1 },
        "decagon": { "113": 5, "122": 5, "11111": 1 },
        "octagon": { "113": 2, "122": 2, "1112": 1 },
        "1 thick": { "122": 1 },
        "1 thin": { "113": 1 },
        "2 thick": { "122": 2 },
        "2 thin": { "113": 2 },
    };
    for (const p of SINGULAR_PRESETS) {
        const g = at(p.gamma, p.den);
        const kinds = classifySingularities(g.model, p.gamma, p.den);
        const tally = {};
        for (const k of kinds) tally[k.code] = (tally[k.code] ?? 0) + 1;
        assert.deepEqual(tally, expect[p.name], `preset "${p.name}"`);

        // The scan must show the same kinds, so the button does not lie.
        const codes = new Set([...found(g).values()]);
        assert.deepEqual([...codes].sort(), Object.keys(expect[p.name]).sort(),
                         `preset "${p.name}": the scan shows something else`);

        // The `penrose` flag must be the truth about Sum(gamma), not a label:
        // five of the seven singular signatures are not Penrose and say so.
        const sum = p.gamma.reduce((a, b) => a + b, 0);
        assert.equal(p.penrose, ((sum % p.den) + p.den) % p.den === 0,
                     `preset "${p.name}" mislabels whether it is Penrose`);
    }
});

test("preset phases survive the trip into the gamma set exactly", () => {
    // The gamma set carries rationals over 2000n — 10000 at n = 5 — so a preset
    // denominator that does not divide it gets rounded on the way in, and the
    // vector on screen is not the one the rule was checked against. 60 does not
    // divide 10000; this is why the presets are over 100.
    for (const p of SINGULAR_PRESETS) {
        const g = at(p.gamma, p.den);
        p.gamma.forEach((q, j) => {
            assert.ok(Math.abs(g.model.gamma[j] - q / p.den) < 1e-12,
                      `"${p.name}": gamma${j} came back as ${g.model.gamma[j]}, `
                      + `not ${q}/${p.den}`);
        });
    }
});

test("isRegular is the ten-comparison corollary", () => {
    assert.ok(isRegular([7, 11, 13, 17, 19], 60));
    assert.ok(!isRegular([0, 0, 0, 0, 0], 60));
    // One integral phase is not enough on its own: the pair sum must land too.
    assert.ok(isRegular([0, 25, 7, 11, 19], 60), "no pair sum lands, so regular");
    assert.ok(!isRegular([0, 25, 7, 11, -25], 60), "gamma1 + gamma4 = 0 makes 014");
});

// The buttons, not just the arithmetic behind them.
import "./domstub.mjs";
import { makeStub } from "./domstub.mjs";
import { createPentagrid } from "../dist/view/pentagrid.js";

/** Every descendant of `el`, depth first. */
function walk(el, out = []) {
    for (const c of el.children ?? []) { out.push(c); walk(c, out); }
    return out;
}

function sizedHost(w, h) {
    const host = globalThis.document.createElement("div");
    host.getBoundingClientRect = () => ({ width: w, height: h, left: 0, top: 0 });
    host.clientWidth = w; host.clientHeight = h;
    return host;
}

test("the Hunt buttons set the phases their labels promise", () => {
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(800, 800), panel });

    const buttons = walk(panel).filter((e) => String(e.className ?? "").startsWith("preset"));
    assert.equal(buttons.length, SINGULAR_PRESETS.length,
                 "the Hunt row did not render one button per preset");

    for (const p of SINGULAR_PRESETS) {
        const b = buttons.find((e) => e.textContent === p.name);
        assert.ok(b, `no button for "${p.name}"`);
        assert.ok(b.on?.click?.length, `"${p.name}" has no click handler`);

        b.on.click.forEach((fn) => fn({}));

        // The phases actually landed, exactly — not near enough.
        const want = p.gamma.map((q) => q / p.den);
        h.gamma.model.gamma.forEach((g, j) => {
            assert.ok(Math.abs(g - want[j]) < 1e-12,
                      `"${p.name}": gamma${j} is ${g}, wanted ${want[j]}`);
        });

        // And the map really has what the name says.
        const kinds = classifySingularities(h.gamma.model, p.gamma, p.den);
        const codes = new Set(kinds.map((k) => k.code));
        if (p.name === "octagon") assert.ok(codes.has("1112"), "no octagon");
        if (p.name === "decagon") assert.ok(codes.has("11111"), "no decagon");
        if (p.name === "regular") assert.equal(kinds.length, 0, "not regular");
    }
});

test("a preset lands intact whichever index is holding the total", () => {
    // A preset is the whole phase vector, so it releases the total before setting
    // it. Without that the locked index rewrites it against the stored target —
    // sun is uniform 1/5 and sums to 1, and a lock holding zero turned gamma0
    // into -4/5 while the button still said "sun".
    const panel = makeStub();
    const h = createPentagrid({ container: sizedHost(800, 800), panel });
    const buttons = walk(panel).filter((e) => String(e.className ?? "").startsWith("preset"));

    for (const lock of [0, 2, 4]) {
        for (const p of SINGULAR_PRESETS) {
            h.gamma.setLocked(lock);
            buttons.find((e) => e.textContent === p.name)
                .on.click.forEach((fn) => fn({}));

            const want = p.gamma.map((q) => q / p.den);
            h.gamma.model.gamma.forEach((g, j) => {
                assert.ok(Math.abs(g - want[j]) < 1e-12,
                          `"${p.name}" with gamma${lock} locked: gamma${j} is ${g}, `
                          + `wanted ${want[j]}`);
            });
            // The total is the preset's own, not zero: sun is uniform 1/5 and
            // sums to 1, which is an integer and so still Penrose. What matters is
            // that it is an integer exactly when the preset claims to be Penrose.
            const sum = h.gamma.model.gamma.reduce((a, b) => a + b, 0);
            const wantSum = p.gamma.reduce((a, b) => a + b, 0) / p.den;
            assert.ok(Math.abs(sum - wantSum) < 1e-12,
                      `"${p.name}": total is ${sum}, wanted ${wantSum}`);
            assert.equal(Math.abs(sum - Math.round(sum)) < 1e-12, p.penrose,
                         `"${p.name}": total ${sum} contradicts penrose=${p.penrose}`);
        }
    }
});

// ── The Penrose catalog ──────────────────────────────────────────────

test("the five couples are real, and each is one thick hexagon and one thin", () => {
    const g = createGammaSet({ guard: false });
    const lone = Object.fromEntries(TRIPLES.map(([k, L]) => [k, L]));
    const pair = Object.fromEntries(TRIPLES.map(([k, , PQ]) => [k, PQ]));

    assert.equal(COUPLES.length, 5, "ten triples make five couples");
    assert.equal(new Set(COUPLES.flat()).size, 10, "every triple in exactly one");

    for (const [a, b] of COUPLES) {
        // Same lone family — that is what makes them a couple.
        assert.equal(lone[a], lone[b], `${a} and ${b} have different lone families`);
        // Complementary pairs: together with the lone they exhaust the five.
        const all = [lone[a], ...pair[a], ...pair[b]].sort((x, y) => x - y);
        assert.deepEqual(all, [0, 1, 2, 3, 4], `${a}/${b} pairs are not complementary`);
        // One of each shape.
        const codes = [a, b].map((k) => angleCode(g.model, k.split("").map(Number)));
        assert.deepEqual(codes.slice().sort(), ["113", "122"],
                         `couple ${a}/${b} is not one thick and one thin`);
    }
});

test("at Sum(gamma) = 0 there are exactly three singular states, and no octagon", () => {
    // Exhaustive over every rational phase vector at each denominator, with the
    // fifth phase forced so the total is an integer. This is the whole Penrose
    // catalog, not a sample of it.
    const g = createGammaSet({ guard: false });
    for (const den of [12, 15, 20]) {
        const seen = new Set();
        const q = [0, 0, 0, 0, 0];
        for (q[0] = 0; q[0] < den; q[0]++) {
            for (q[1] = 0; q[1] < den; q[1]++) {
                for (q[2] = 0; q[2] < den; q[2]++) {
                    for (q[3] = 0; q[3] < den; q[3]++) {
                        q[4] = (((-(q[0] + q[1] + q[2] + q[3])) % den) + den) % den;
                        const t = {};
                        for (const k of classifySingularities(g.model, q, den)) {
                            t[k.code] = (t[k.code] ?? 0) + 1;
                        }
                        seen.add(JSON.stringify(t));
                    }
                }
            }
        }
        assert.deepEqual([...seen].sort(), [
            '{"113":1,"122":1}',
            '{"113":5,"122":5,"11111":1}',
            "{}",
        ].sort(), `den = ${den}: the catalog is not the three known states`);

        for (const sig of seen) {
            assert.ok(!sig.includes("1112"),
                      `den = ${den}: an octagon appeared at an integral total`);
        }
    }
});

test("two couples force all five, so nothing sits between them", () => {
    // Two integral phases drag in two more through their pair conditions, and an
    // integral total supplies the fifth. That is why the catalog has no middle.
    const g = createGammaSet({ guard: false });
    const den = 20;
    let sawOne = 0, sawFive = 0;
    const q = [0, 0, 0, 0, 0];
    for (q[0] = 0; q[0] < den; q[0]++) {
        for (q[1] = 0; q[1] < den; q[1]++) {
            for (q[2] = 0; q[2] < den; q[2]++) {
                for (q[3] = 0; q[3] < den; q[3]++) {
                    q[4] = (((-(q[0] + q[1] + q[2] + q[3])) % den) + den) % den;
                    const kinds = classifySingularities(g.model, q, den);
                    const hexes = kinds.filter((k) => k.fold === 3).length;
                    assert.ok(hexes === 0 || hexes === 2 || hexes === 10,
                              `gamma*${den} = ${q} gave ${hexes} hexagons`);
                    if (hexes === 2) sawOne++;
                    if (hexes === 10) sawFive++;
                }
            }
        }
    }
    assert.ok(sawOne > 0 && sawFive > 0, "the search never reached both states");
});

// ── The caps, through the cluster recognizer ─────────────────────────

/** The complete clusters within `r` of the origin, for a preset by name. */
function clustersNearOrigin(name, r = 2.2) {
    const p = SINGULAR_PRESETS.find((q) => q.name === name);
    const g = at(p.gamma, p.den);
    const rhombs = collectRhombs(g.model, { xMin: -7, xMax: 7, yMin: -7, yMax: 7 },
                                 { gain: g.model.n / 2 });
    const res = findClusters(rhombs);
    assert.equal(res.levels, 4, `${name}: not a Penrose patch (${res.levels} levels)`);
    return res.clusters.filter((c) => c.kind && Math.hypot(c.x, c.y) < r);
}

test("sun puts a Pe5 center on the origin; star puts the origin in no cluster", () => {
    const sun = clustersNearOrigin("sun", 1e-6);
    assert.deepEqual(sun.map((c) => c.kind), ["Pe5"], "sun: the origin is not a Pe5 center");

    const star = clustersNearOrigin("star", 1e-6);
    assert.deepEqual(star, [], "star: the origin should belong to no cluster");
});

test("the deca is one Pe3 with two Pe1, mirror-symmetric about the axis", () => {
    // The deca of wieringa-roof: ten rhombs, 5 thick + 5 thin — exactly what the
    // 5-fold singularity holds — and what Gamma = 0 resolves into under a nudge
    // with gamma1 = gamma4 and gamma2 = gamma3. Family 0 is vertical, so the
    // mirror is the y axis: the Pe3 sits on it and the Pe1s straddle it.
    const home = clustersNearOrigin("deca");
    assert.deepEqual(home.map((c) => c.kind).sort(), ["Pe1", "Pe1", "Pe3"],
                     `deca: found ${home.map((c) => c.kind).join("+")}`);
    const pe3 = home.find((c) => c.kind === "Pe3");
    const [a, b] = home.filter((c) => c.kind === "Pe1");
    assert.ok(Math.abs(pe3.x) < 1e-6, `deca: the Pe3 is off the axis at x = ${pe3.x}`);
    assert.ok(Math.abs(a.x + b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6,
              "deca: the two Pe1 are not mirror images");
    assert.equal(pe3.thick + a.thick + b.thick, 5, "deca: 5 thick");
    assert.equal(pe3.thin + a.thin + b.thin, 5, "deca: 5 thin");
});

test("negating the deca's phases flips it end for end", () => {
    const p = SINGULAR_PRESETS.find((q) => q.name === "deca");
    const side = (gamma) => {
        const g = at(gamma, p.den);
        const rhombs = collectRhombs(g.model, { xMin: -7, xMax: 7, yMin: -7, yMax: 7 },
                                     { gain: g.model.n / 2 });
        const pe3 = findClusters(rhombs).clusters
            .find((c) => c.kind === "Pe3" && Math.hypot(c.x, c.y) < 2.2);
        return Math.sign(pe3.y);
    };
    assert.equal(side(p.gamma) * side(p.gamma.map((q) => -q)), -1,
                 "the Pe3 should swap sides of the origin under Gamma -> -Gamma");
});
