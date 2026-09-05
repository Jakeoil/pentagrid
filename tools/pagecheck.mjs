// Import the built page module against a stub DOM and report anything it throws
// at init. Compiling clean does not mean the page renders — a throw during
// module evaluation leaves a blank canvas and no error anywhere but the console.
// Same idea as wieringa-roof/tools/pagecheck.mjs.

import { SH, SW, USE_ATTR, handlers, inputs, makeStub, noop } from "./domstub.mjs";

const target = process.argv[2] || "./dist/method.js";
try {
    await import(new URL(target, `file://${process.cwd()}/`).href);
    console.log(`pagecheck: ${target} initialised with no throw`);
} catch (err) {
    console.error(`pagecheck: ${target} FAILED during init`);
    console.error(err.stack || String(err));
    process.exit(1);
}

// Drive it: fire every click and change handler, which walks the steps and flips
// every toggle, so the layers that only draw under some preset actually draw.
const evt = makeStub({ clientX: 400, clientY: 400, offsetX: 400, offsetY: 400,
                       button: 0, deltaY: -100, key: "Escape", preventDefault: noop,
                       touches: [], changedTouches: [] });
let fired = 0, failed = 0;
const run = (label, type, fn, times) => {
    for (let i = 0; i < times; i++) {
        try { fn(evt); fired++; } catch (err) {
            failed++;
            console.error(`pagecheck: ${label} ("${type}") threw`);
            console.error(err.stack || String(err));
            return;
        }
    }
};

// Turn every checkbox on, then fire the change handlers, so the layers that only
// draw when a feature is enabled actually draw.
for (const el of inputs) el.checked = true;
for (const { type, fn } of [...handlers]) {
    if (type === "change" || type === "input") run("toggle", type, fn, 1);
}

// Walk the steps. Firing each click handler consecutively reaches step 6 with
// "next"; interleaving them would just oscillate between the first two.
for (const { type, fn } of [...handlers]) {
    if (type === "click") run("click", type, fn, 6);
}

// Hover and zoom paths, with every feature on.
for (const { type, fn } of [...handlers]) {
    if (type === "mousemove" || type === "wheel") run("pointer", type, fn, 2);
}

// And back off again, to catch anything that only breaks on the way down.
for (const el of inputs) el.checked = false;
for (const { type, fn } of [...handlers]) {
    if (type === "change") run("untoggle", type, fn, 1);
}

console.log(`pagecheck: ${SW}x${SH} ${USE_ATTR ? "(explicit)" : "(implicit)"}` +
            ` — fired ${fired} handler calls, ${failed} threw`);
if (failed) process.exit(1);
