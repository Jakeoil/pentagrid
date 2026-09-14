// House style: American spellings, everywhere.
//
// Jake's standing rule, and it covers code identifiers and comments as well as
// prose. It had drifted badly — 204 British forms across 28 files — because the
// rule lived only in a note and nothing checked it. It is a test now, so the
// drift cannot come back quietly.
//
// This file names the British forms it looks for, so it excludes itself.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".github", "jake"]);
const TEXT = /\.(ts|mjs|js|html|md|css|json)$/;
const SELF = "tools/spelling.test.mjs";

/**
 * British form -> American. Prefixes where the whole family follows the stem, and
 * whole words where it does not: `centred` has to be caught before `centre`, or
 * a stem rule would leave "centerd".
 */
const FORBIDDEN = [
    ["centred", "centered"], ["catalogue", "catalog"],
    ["labelled", "labeled"], ["labelling", "labeling"],
    ["travelling", "traveling"], ["modelled", "modeled"],
    ["cancelled", "canceled"], ["signalled", "signaled"],
    ["synthesis" + "ed", "synthesized"], ["emphasis" + "ed", "emphasized"],
    ["specialis", "specializ"], ["organis", "organiz"],
    ["initialis", "initializ"], ["normalis", "normaliz"],
    ["recognis", "recogniz"], ["minimis", "minimiz"], ["maximis", "maximiz"],
    ["parameteris", "parameteriz"], ["visualis", "visualiz"],
    ["summaris", "summariz"], ["prioritis", "prioritiz"], ["serialis", "serializ"],
    ["neighbour", "neighbor"], ["behaviour", "behavior"], ["flavour", "flavor"],
    ["favourit", "favorit"], ["colour", "color"], ["centre", "center"],
    ["grey", "gray"], ["defence", "defense"], ["licence", "license"],
    ["practis" + "e", "practice"], ["whilst", "while"], ["amongst", "among"],
    ["judgement", "judgment"], ["programme", "program"],
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (TEXT.test(name)) out.push(p);
    }
    return out;
}

test("no British spellings anywhere in the repo", () => {
    const offences = [];
    for (const file of walk(ROOT)) {
        const rel = relative(ROOT, file);
        if (rel === SELF) continue;
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
            const low = line.toLowerCase();
            for (const [bad, good] of FORBIDDEN) {
                if (low.includes(bad)) {
                    offences.push(`${rel}:${i + 1}  "${bad}" -> "${good}"`);
                    break;
                }
            }
        });
    }
    assert.deepEqual(offences, [],
                     `British spellings found:\n  ${offences.join("\n  ")}`);
});
