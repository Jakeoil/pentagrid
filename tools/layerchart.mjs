// The layer chart: every layer of createPentagrid, its z-order, its group and
// the feature that switches it, read off the live stack. Front is the top.
//
//   node tools/layerchart.mjs          prints the chart
//   node tools/layerchart.mjs --write  rewrites the block in MODULES.md
//
// A test compares MODULES.md against this output, so the chart cannot drift
// from the code that it describes.

import { readFileSync, writeFileSync } from "node:fs";
import "./domstub.mjs";
import { createPentagrid, LAYER_FEATURE } from "../dist/view/pentagrid.js";
import { createGrowthView } from "../dist/view/growth.js";

const BEGIN = "<!-- layerchart:begin -->";
const END = "<!-- layerchart:end -->";

function host() {
    const el = globalThis.document.createElement("div");
    el.getBoundingClientRect = () => ({ width: 800, height: 800, left: 0, top: 0 });
    el.clientWidth = 800; el.clientHeight = 800;
    return el;
}

function rows(stack, featureOf) {
    return [...stack.all()]
        .sort((a, b) => b.z - a.z)
        .map((l) => `| ${l.z} | \`${l.id}\` | ${l.label} | ${l.group ?? ""} | ${featureOf(l.id) ?? ""} |`);
}

export function chart() {
    const h = createPentagrid({ container: host(), panel: globalThis.document.createElement("div") });
    // Which feature drives a layer, from the map the panel uses. Layers not in
    // it are driven some other way — the grid by the family flags, the highlight
    // and the loupe by the hover — and say so.
    const OTHER = { grid: "family flags", highlight: "hover", loupe: "hover", };
    const main = rows(h.stack, (id) => LAYER_FEATURE[id] ? `\`${LAYER_FEATURE[id]}\`` : (OTHER[id] ?? ""));
    const g = createGrowthView({ container: host() });
    const growth = [...g.pentagrid.stack.all()]
        .filter((l) => l.group === "Exploration")
        .sort((a, b) => b.z - a.z)
        .map((l) => `| ${l.z} | \`${l.id}\` | ${l.label} | ${l.group} | growth state |`);
    return [
        "Front to back. z decides the order; the group is where the switch lives.",
        "",
        "| z | id | label | group | switched by |",
        "|---|---|---|---|---|",
        ...main,
        "",
        "The growth pages add, in the same stack:",
        "",
        "| z | id | label | group | switched by |",
        "|---|---|---|---|---|",
        ...growth,
    ].join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
    const out = chart();
    if (process.argv.includes("--write")) {
        const p = new URL("../MODULES.md", import.meta.url).pathname;
        const md = readFileSync(p, "utf8");
        const i = md.indexOf(BEGIN), j = md.indexOf(END);
        if (i < 0 || j < 0) throw new Error("MODULES.md has no layerchart block");
        writeFileSync(p, md.slice(0, i + BEGIN.length) + "\n" + out + "\n" + md.slice(j));
        console.log("MODULES.md updated");
    } else {
        console.log(out);
    }
}
