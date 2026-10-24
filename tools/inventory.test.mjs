// The state inventory as data — PLAN section 9.10 step 2.
//
// Four things must agree about what the state is: the attribute reader, the
// attribute writer, the reset to a page's baseline, and the round-trip test.
// They read one list, and this is what keeps that list honest.
//
// The fields, kinds and defaults are DERIVED from the defaults literals, so a
// switch added to any of them appears with no edit. What cannot be derived is
// the set of values an enum admits -- a TypeScript union does not exist at
// runtime -- so those are declared, and the first test here parses the unions
// back out of the source and compares.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FIELDS, BY_ATTR, SLICES, attrName, keyOf, parse, format, alternative }
    from "../dist/state/inventory.js";
import { NO_FEATURES, TILE_DEFAULTS } from "../dist/view/pentagrid.js";
import { DEFAULTS as GROWTH_DEFAULTS } from "../dist/view/growth.js";

const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (p.endsWith(".ts")) out.push(p);
    }
    return out;
};
const SRC = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");

/** The union a field is declared with, read out of the TypeScript. */
function declaredUnion(key) {
    // Either inline -- `key: "a" | "b";` -- or through a named type.
    const inline = SRC.match(new RegExp(`^\\s{4}${key}: ("[^;]*");`, "m"));
    const text = inline
        ? inline[1]
        : (() => {
            const named = SRC.match(new RegExp(`^\\s{4}${key}: ([A-Za-z]+);`, "m"));
            if (!named) return null;
            const alias = SRC.match(
                new RegExp(`type ${named[1]} =\\s*([^;]*);`, "m"));
            return alias ? alias[1] : null;
        })();
    if (!text) return null;
    return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test("every declared enum matches the union in the source", () => {
    const enums = FIELDS.filter((f) => f.kind === "enum");
    assert.ok(enums.length >= 8, `only ${enums.length} enum fields`);
    for (const f of enums) {
        const union = declaredUnion(f.key);
        assert.ok(union, `no union found in the source for ${f.owner}.${f.key}`);
        assert.deepEqual([...f.values].sort(), [...union].sort(),
                         `${f.owner}.${f.key} declares ${f.values.join("|")} `
                         + `but the source says ${union.join("|")}`);
    }
});

test("every field's fallback is the live default, and nothing is missing", () => {
    // The derivation's whole point: the inventory cannot disagree with the
    // defaults because it is read off them.
    const owners = { features: NO_FEATURES, tileStyle: TILE_DEFAULTS,
                     growth: GROWTH_DEFAULTS };
    for (const [owner, obj] of Object.entries(owners)) {
        const mine = FIELDS.filter((f) => f.owner === owner);
        assert.deepEqual(mine.map((f) => f.key).sort(), Object.keys(obj).sort(),
                         `the ${owner} fields and its defaults disagree`);
        for (const f of mine) {
            assert.equal(f.fallback, obj[f.key],
                         `${owner}.${f.key} fallback is ${f.fallback}, default is ${obj[f.key]}`);
        }
    }
    assert.equal(FIELDS.length,
                 Object.keys(NO_FEATURES).length + Object.keys(TILE_DEFAULTS).length
                 + Object.keys(GROWTH_DEFAULTS).length);
});

test("the attribute name is one rule, and it round-trips", () => {
    assert.equal(attrName("pentaFace"), "data-penta-face");
    assert.equal(attrName("p1Shape"), "data-p1-shape");
    assert.equal(attrName("axes"), "data-axes");
    for (const f of FIELDS) {
        assert.equal(keyOf(f.attr), f.key, `${f.attr} does not read back as ${f.key}`);
        assert.ok(/^data-[a-z0-9-]+$/.test(f.attr), `${f.attr} is not a clean attribute`);
    }
    // No two fields may claim the same attribute, across owners.
    assert.equal(BY_ATTR.size, FIELDS.length, "two fields share an attribute name");
});

test("parse and format round-trip every kind", () => {
    for (const f of FIELDS) {
        for (const v of [f.fallback, alternative(f, f.fallback)]) {
            const back = parse(f, format(f, v));
            assert.equal(back, v, `${f.owner}.${f.key}: ${v} formatted to `
                         + `"${format(f, v)}" and parsed back as ${back}`);
        }
    }
});

test("parse refuses what it does not understand, rather than guessing", () => {
    // Section 9.5: an attribute a page does not understand takes the default.
    const anEnum = FIELDS.find((f) => f.kind === "enum");
    const aNumber = FIELDS.find((f) => f.kind === "number");
    const aBool = FIELDS.find((f) => f.kind === "bool");
    assert.equal(parse(anEnum, "not-a-value"), null);
    assert.equal(parse(aNumber, "banana"), null);
    assert.equal(parse(anEnum, null), null, "an absent attribute is not a value");
    // HTML's kind of boolean: present is true, and only the explicit noes are false.
    assert.equal(parse(aBool, ""), true);
    assert.equal(parse(aBool, "false"), false);
    assert.equal(parse(aBool, "0"), false);
    assert.equal(parse(aBool, "anything"), true);
});

test("alternative gives a different legal value, for the per-field walk", () => {
    // Section 9.7's per-field test needs a value that differs; only the
    // inventory knows what that is per kind.
    for (const f of FIELDS) {
        const alt = alternative(f, f.fallback);
        assert.notEqual(alt, f.fallback, `${f.owner}.${f.key} has no alternative`);
        if (f.kind === "enum") {
            assert.ok(f.values.includes(alt), `${alt} is not a legal ${f.key}`);
        }
        if (f.kind === "bool") assert.equal(typeof alt, "boolean");
        if (f.kind === "number") assert.ok(Number.isFinite(alt));
        // Not asserted: that it is an involution. The per-field walk restores
        // from the value it saved, not by calling this twice, so `alternative`
        // owes only "different, and legal".
    }
});

test("the non-flat slices are named, so nothing is silently left out", () => {
    const names = SLICES.map((s) => s.name);
    assert.deepEqual([...names].sort(), ["gamma", "view", "visibility"]);
    // Gamma is the only thing that travels -- section 9.3.
    assert.equal(SLICES.find((s) => s.name === "gamma").scope, "shared");
    assert.equal(SLICES.find((s) => s.name === "view").scope, "page",
                 "the view must not travel between pages");
    // And no flat field is in page scope by accident: the shared slice is not
    // a field, so every field is page scope.
    assert.ok(FIELDS.every((f) => f.scope === "page"),
              "a flat field claims shared scope; only the reticulum travels");
});
