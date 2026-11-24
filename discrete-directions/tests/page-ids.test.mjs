// The page's ids, checked against themselves and against the script.
//
// Both of these cost a round trip on 2026-11-24. A float toggle was given
// `id="boot-seed"`, which the patch picker had held since the page was written,
// so `document.getElementById("boot-seed")` handed the button's handler to a
// `<select>` and the button did nothing at all. Jake: *seed button does
// nothing.* Nothing caught it: `tsc` has no opinion about HTML, and
// `tools/pagecheck.mjs` cannot, because its stub mints a fresh element for
// every id it is asked for -- which is exactly what makes a duplicate id
// invisible to it.
//
// So the HTML is read as text and checked two ways:
//
//  1. no id is used twice, because the second one is unreachable;
//  2. every `byId("...")` in the script names an id that exists, because a
//     typo there is a control that silently does nothing.
//
// Deliberately NOT the other direction: an id in the page with no `byId` is
// ordinary -- CSS and `aria` use plenty, and `boot-seed-inline` is only ever
// touched by a stylesheet.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, "..", p), "utf8");

const PAGES = [["by-your-bootstraps.html", "src/ui/page.js"]];

test("no id is used twice on a page", () => {
    for (const [page] of PAGES) {
        const html = read(page);
        /** @type {Map<string, number>} */
        const seen = new Map();
        for (const m of html.matchAll(/\sid="([^"]+)"/g))
            seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
        const twice = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
        assert.deepEqual(twice, [], `${page}: duplicate ids -- ${twice.join(", ")}`);
    }
});

test("every byId in the script names an id the page has", () => {
    for (const [page, script] of PAGES) {
        const html = read(page);
        const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
        const asked = [...read(script).matchAll(/byId\("([^"]+)"\)/g)].map((m) => m[1]);
        assert.ok(asked.length > 20, `only ${asked.length} byId calls found -- regex stale?`);
        const missing = [...new Set(asked)].filter((id) => !ids.has(id));
        assert.deepEqual(missing, [], `${page}: asked for ids it has not got -- ${missing.join(", ")}`);
    }
});

test("the ids the script builds from a template are there too", () => {
    // `boot-fifths-${f}` and the like are built rather than written out, so the
    // regex above cannot see them. The five fifths radios are the only ones.
    const html = read("by-your-bootstraps.html");
    for (let f = 0; f < 5; f++)
        assert.ok(html.includes(`id="boot-fifths-${f}"`), `boot-fifths-${f} is missing`);
});
