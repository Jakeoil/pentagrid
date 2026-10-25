// The generated attribute documentation is current — MODULES.md's attrdoc block.
//
// Jake, 2026-10-25: "Where is the API for all the settings of the containers
// (copy-setup)" -- and there was not one. Now there is, generated from the
// inventory. A generated document that is not regenerated is worse than none,
// so this fails when it drifts, the way tools/layerchart.test.mjs does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { doc } from "./attrdoc.mjs";
import { FIELDS } from "../dist/state/inventory.js";

const BEGIN = "<!-- attrdoc:begin -->";
const END = "<!-- attrdoc:end -->";

test("MODULES.md carries the current attribute table", () => {
    const md = readFileSync("MODULES.md", "utf8");
    const i = md.indexOf(BEGIN), j = md.indexOf(END);
    assert.ok(i >= 0 && j > i, "MODULES.md has no attrdoc block");
    const got = md.slice(i + BEGIN.length, j).trim();
    assert.equal(got, doc().trim(),
                 "the attribute table is stale: run `node tools/attrdoc.mjs --write`");
});

test("every field is documented, with its values and its default", () => {
    const text = doc();
    for (const f of FIELDS) {
        assert.ok(text.includes(`\`${f.attr}\``),
                  `${f.owner}.${f.key} is not in the document`);
        if (f.kind === "enum") {
            for (const v of f.values) {
                assert.ok(text.includes(`\`${v}\``),
                          `${f.attr} does not list its value ${v}`);
            }
        }
    }
    // And the shaped slices, which are not fields.
    for (const name of ["data-gamma", "data-gamma-den", "data-scale", "data-hide",
                        "data-width", "data-margin"]) {
        assert.ok(text.includes(`\`${name}\``), `${name} is not documented`);
    }
});

test("the document states the precedence, which is the thing people get wrong", () => {
    const text = doc();
    for (const want of ["query string", "session", "attributes"]) {
        assert.ok(text.includes(want), `the precedence does not mention the ${want}`);
    }
    assert.ok(/writes the\s+address bar/.test(text),
              "the document does not say the address bar is left alone");
});
