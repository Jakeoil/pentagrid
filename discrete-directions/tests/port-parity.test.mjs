// The port's safety net: the JavaScript must agree with the TypeScript it came
// from, export for export, until the TypeScript is deleted.
//
// This is a scaffold, not a permanent test. When `src/bootstrap/` goes, so does
// this file -- `wheel.test.mjs` is what checks the mathematics on its own terms,
// against penrose-mosaic. Delete this one and nothing is lost; delete that one
// and the oracle goes with it.

import test from "node:test";
import assert from "node:assert/strict";

import * as js from "../src/math/wheel.js";
import * as jsFlake from "../src/math/flake.js";
import * as jsStar from "../src/math/star.js";
import * as jsWalk from "../src/math/walk.js";
import * as jsPatch from "../src/math/patch.js";

/** The TypeScript build is gone once a module is ported out of it, which is the
 *  point. Nothing to compare against then, and that is success, not failure. */
const old = async (/** @type {string} */ path) => {
    try {
        return await import(path);
    } catch {
        return null;
    }
};

/** @type {typeof js | null} */
const ts = await old("../../dist/bootstrap/wheel.js");
/** @type {typeof jsFlake | null} */
const tsFlake = await old("../../dist/bootstrap/flake.js");
/** @type {typeof jsStar | null} */
const tsStar = await old("../../dist/bootstrap/star.js");
/** @type {typeof jsWalk | null} */
const tsWalk = await old("../../dist/bootstrap/walk.js");
/** @type {typeof jsPatch | null} */
const tsPatch = await old("../../dist/bootstrap/patch.js");

const SEEDS = [
    js.PENTA_UP,
    js.REAL_PENTA,
    [[-1, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]],
    [[0, -4], [4, -1], [2, 3], [-3, 2], [-3, -2]],
];

const k = (v) => JSON.stringify(v);

test("the JavaScript agrees with the TypeScript it was ported from", (t) => {
    if (!ts) return t.skip("dist/bootstrap/wheel.js is gone — port complete");

    assert.equal(k(ts.PENTA_UP), k(js.PENTA_UP));
    assert.equal(k(ts.REAL_PENTA), k(js.REAL_PENTA));
    assert.equal(k(ts.PRESETS), k(js.PRESETS));
    assert.equal(ts.TENTHS, js.TENTHS);
    assert.equal(ts.SEED_GENERATION, js.SEED_GENERATION);

    for (let n = -25; n <= 25; n++) assert.equal(ts.m10(n), js.m10(n), `m10(${n})`);

    for (const [i, pts] of SEEDS.entries()) {
        assert.equal(k(ts.wheelFromPoints(pts)), k(js.wheelFromPoints(pts)), `seed ${i}`);
        const w = ts.wheelFromPoints(pts);
        assert.equal(k(ts.pointsOf(w)), k(js.pointsOf(w)), `pointsOf ${i}`);

        for (let s = 1; s <= 4; s++) {
            assert.equal(k(ts.stride(w, s)), k(js.stride(w, s)), `stride ${i}.${s}`);
            assert.equal(k(ts.pair(w, s)), k(js.pair(w, s)), `pair ${i}.${s}`);
        }
        for (const f of ["inflate", "deflate", "halfUp", "halfDown",
                         "pWheel", "sWheel", "tWheel", "eWheel"])
            assert.equal(k(ts[f](w)), k(js[f](w)), `${f} ${i}`);

        for (const offs of [[0], [-1, 1], [-1, 0, 1], [-2, 0, 0, 2], [-3, 0, 3], [1, 2, 3]])
            assert.equal(k(ts.comb(w, offs)), k(js.comb(w, offs)), `comb ${i} [${offs}]`);

        // every rung the ladder reaches, half and negative included
        for (let g = -4; g <= 6; g += 0.5)
            assert.equal(k(ts.wheelsAt(pts, g)), k(js.wheelsAt(pts, g)), `wheelsAt ${i} ${g}`);
        for (let g = 0; g <= 6; g++)
            assert.equal(k(ts.ladderTo(pts, g)), k(js.ladderTo(pts, g)), `ladderTo ${i} ${g}`);
    }

    // and they fail the same way
    const err = (f) => { try { f(); return "no throw"; } catch (e) { return e.message; } };
    const four = [[0, 0], [1, 1], [2, 2], [3, 3]];
    assert.equal(err(() => ts.wheelFromPoints(four)), err(() => js.wheelFromPoints(four)));
});

test("the flake agrees with the TypeScript it was ported from", (t) => {
    if (!tsFlake) return t.skip("dist/bootstrap/flake.js is gone — port complete");

    for (const [i, pts] of SEEDS.entries()) {
        assert.equal(k(tsFlake.pentaflake(pts)), k(jsFlake.pentaflake(pts)), `flake ${i}`);
        assert.equal(k(tsFlake.pWheelFromFlake(pts)), k(jsFlake.pWheelFromFlake(pts)),
            `pWheelFromFlake ${i}`);
        for (let e = 0; e < 5; e++)
            assert.equal(k(tsFlake.sharedEdge(pts, e)), k(jsFlake.sharedEdge(pts, e)),
                `sharedEdge ${i}.${e}`);
    }

    const err = (f) => { try { f(); return "no throw"; } catch (e) { return e.message; } };
    const four = [[0, 0], [1, 1], [2, 2], [3, 3]];
    assert.equal(err(() => tsFlake.pentaflake(four)), err(() => jsFlake.pentaflake(four)));
});

test("the star family agrees with the TypeScript it was ported from", (t) => {
    if (!tsStar) return t.skip("dist/bootstrap/star.js is gone — port complete");

    for (const [i, pts] of SEEDS.entries()) {
        const L = js.ladderTo(pts, 4);
        for (let g = 1; g <= 3; g++)
            for (let tenth = 0; tenth < 10; tenth++) {
                assert.equal(k(tsStar.starTips(L[g], tenth)), k(jsStar.starTips(L[g], tenth)),
                    `starTips ${i}.${g}.${tenth}`);
                for (const type of ["St5", "St3", "St1"])
                    for (const loc of [[0, 0], [13, -8]])
                        assert.equal(
                            k(tsStar.starPolygon(type, L[g], L[g - 1], tenth, loc)),
                            k(jsStar.starPolygon(type, L[g], L[g - 1], tenth, loc)),
                            `starPolygon ${type} ${i}.${g}.${tenth} at ${loc}`);
            }
    }
});

test("the walks and the rhombs agree with the TypeScript they were ported from", (t) => {
    if (!tsWalk) return t.skip("dist/bootstrap/walk.js is gone — port complete");

    for (const name of ["PENTA", "STAR", "BOAT", "DIAMOND", "THICK", "THIN"])
        assert.equal(k(tsWalk[name]), k(jsWalk[name]), name);

    const walks = [jsWalk.PENTA, jsWalk.STAR, jsWalk.BOAT, jsWalk.DIAMOND, [0, 2, 5, 7]];

    for (const [i, pts] of SEEDS.entries()) {
        const e = js.eWheel(js.wheelFromPoints(pts));
        for (const [j, walk] of walks.entries())
            for (let n = -3; n <= 12; n++) {
                assert.equal(k(tsWalk.turn(walk, n)), k(jsWalk.turn(walk, n)), `turn ${j}.${n}`);
                assert.equal(k(tsWalk.vertices(jsWalk.turn(walk, n), e, [5, -2])),
                    k(jsWalk.vertices(jsWalk.turn(walk, n), e, [5, -2])), `vertices ${i}.${j}.${n}`);
                assert.equal(tsWalk.closes(jsWalk.turn(walk, n), e),
                    jsWalk.closes(jsWalk.turn(walk, n), e), `closes ${i}.${j}.${n}`);
            }
        for (const walk of walks)
            assert.equal(k(tsWalk.reverse(walk)), k(jsWalk.reverse(walk)));

        const L = js.ladderTo(pts, 4);
        for (let g = 1; g <= 3; g++)
            for (let tenth = 0; tenth < 10; tenth++) {
                assert.equal(k(tsWalk.anchorFor("penta", L[g], tenth)),
                    k(jsWalk.anchorFor("penta", L[g], tenth)), `anchor penta ${i}.${g}.${tenth}`);
                assert.equal(k(tsWalk.anchorFor("star", L[g], tenth)),
                    k(jsWalk.anchorFor("star", L[g], tenth)), `anchor star ${i}.${g}.${tenth}`);
                for (const loc of [[0, 0], [13, -8]]) {
                    assert.equal(k(tsWalk.pentagon(L[g].d, tenth, loc)),
                        k(jsWalk.pentagon(L[g].d, tenth, loc)), `pentagon ${i}.${g}.${tenth}`);
                    for (const walk of walks)
                        assert.equal(k(tsWalk.starOutline(walk, L[g], tenth, loc)),
                            k(jsWalk.starOutline(walk, L[g], tenth, loc)),
                            `starOutline ${i}.${g}.${tenth}`);
                }
                const inflated = js.inflate(L[g].d);
                for (const spec of [jsWalk.THICK, jsWalk.THIN])
                    for (const spelling of ["mixed", "t", "inflated", undefined])
                        assert.equal(
                            k(tsWalk.rhombus(spec, L[g].t, inflated, tenth, spelling)),
                            k(jsWalk.rhombus(spec, L[g].t, inflated, tenth, spelling)),
                            `rhombus ${i}.${g}.${tenth} ${spelling}`);
                for (const type of ["Pe5", "Pe3", "Pe1"])
                    assert.equal(k(tsWalk.rhombGroup(type, tenth)),
                        k(jsWalk.rhombGroup(type, tenth)), `rhombGroup ${type} ${tenth}`);
            }
    }
});

test("the substitution agrees with the TypeScript it was ported from", (t) => {
    if (!tsPatch) return t.skip("dist/bootstrap/patch.js is gone — port complete");

    assert.equal(k(tsPatch.SEED_TYPES), k(jsPatch.SEED_TYPES));
    assert.equal(k(tsPatch.WALK_OF), k(jsPatch.WALK_OF));
    for (const name of [...jsPatch.SEED_TYPES, "Pe9", "sun", "", "St4"])
        assert.equal(tsPatch.isSeedType(name), jsPatch.isSeedType(name), `isSeedType ${name}`);

    for (const [i, pts] of SEEDS.entries()) {
        const L = js.ladderTo(pts, 6);
        for (const seed of jsPatch.SEED_TYPES)
            for (const tenth of [0, 1, 4, 7]) {
                for (const g of [0, 1, 2, 3])
                    for (const heads of [true, false])
                        for (const floor of [0, 1, 2]) {
                            const args = [seed, tenth, [3, -4], g, L, heads, floor];
                            assert.equal(k(tsPatch.expand(...args)), k(jsPatch.expand(...args)),
                                `expand ${seed} ${i}.${tenth} gen ${g} heads ${heads} floor ${floor}`);
                        }
                // and the defaults, which is how every caller actually calls it
                assert.equal(k(tsPatch.expand(seed, tenth, [0, 0], 2, L)),
                    k(jsPatch.expand(seed, tenth, [0, 0], 2, L)),
                    `expand defaults ${seed} ${i}.${tenth}`);
            }

        for (const placed of jsPatch.expand("Sun", 0, [0, 0], 2, L))
            assert.equal(k(tsPatch.outlineOf(placed, L[1])), k(jsPatch.outlineOf(placed, L[1])),
                `outlineOf ${placed.type} ${i}`);
    }

    const err = (f) => { try { f(); return "no throw"; } catch (e) { return e.message; } };
    const L = js.ladderTo(js.PENTA_UP, 3);
    assert.equal(err(() => tsPatch.expand("Pe9", 0, [0, 0], 1, L)),
                 err(() => jsPatch.expand("Pe9", 0, [0, 0], 1, L)));
});
