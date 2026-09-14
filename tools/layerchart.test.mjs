// MODULES.md's layer chart must match the live stack.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chart } from "./layerchart.mjs";

test("the layer chart in MODULES.md is the live stack", () => {
    const md = readFileSync(new URL("../MODULES.md", import.meta.url), "utf8");
    const BEGIN = "<!-- layerchart:begin -->", END = "<!-- layerchart:end -->";
    const i = md.indexOf(BEGIN), j = md.indexOf(END);
    assert.ok(i >= 0 && j > i, "MODULES.md has no layerchart block");
    const written = md.slice(i + BEGIN.length, j).trim();
    assert.equal(written, chart().trim(),
                 "MODULES.md is behind the stack — run: node tools/layerchart.mjs --write");
});
