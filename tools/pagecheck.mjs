// Import the built page module against a stub DOM and report anything it throws
// at init. Compiling clean does not mean the page renders — a throw during
// module evaluation leaves a blank canvas and no error anywhere but the console.
// Same idea as wieringa-roof/tools/pagecheck.mjs.

const noop = () => {};

// Every handler the module registers, so the check can drive the page instead of
// only importing it. Init running clean says nothing about step 6.
const handlers = [];
const handler = {
    get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === Symbol.toPrimitive || prop === "toString") return () => "";
        if (prop === Symbol.iterator) return undefined;
        return makeStub();
    },
    set(target, prop, value) { target[prop] = value; return true; },
};

function makeStub(extra = {}) {
    const base = function () { return makeStub(); };
    Object.assign(base, {
        style: {}, classList: { add: noop, remove: noop },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: SW, height: SH }),
        getAttribute: (name) => {
            if (!USE_ATTR) return null;
            if (name === "data-width") return String(SW);
            if (name === "data-height") return String(SH);
            return null;
        },
        appendChild: (c) => c, removeChild: noop,
        addEventListener: (type, fn) => { handlers.push({ type, fn }); },
        setAttribute: noop,
        value: "0", checked: false, textContent: "", innerHTML: "", dataset: {},
        ...extra,
    });
    return new Proxy(base, handler);
}

function ctx2d() {
    return makeStub({
        canvas: makeStub(),
        measureText: () => ({ width: 10 }),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        createLinearGradient: () => makeStub({ addColorStop: noop }),
        putImageData: noop, save: noop, restore: noop, beginPath: noop, closePath: noop,
        moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop,
        fillRect: noop, clearRect: noop, fillText: noop, strokeRect: noop, setLineDash: noop,
    });
}

const inputs = [];
const elements = new Map();

// PAGECHECK_SIZE=640x480        implicit sizing, via the container's laid-out box
// PAGECHECK_ATTR=1              explicit sizing, via data-width / data-height
const [SW, SH] = (process.env.PAGECHECK_SIZE || "800x800").split("x").map(Number);
const USE_ATTR = process.env.PAGECHECK_ATTR === "1";
globalThis.document = makeStub({
    getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, makeStub());
        return elements.get(id);
    },
    createElement: (tag) => {
        const el = makeStub(
            tag === "canvas" ? { width: 800, height: 800, getContext: () => ctx2d() } : {}
        );
        if (tag === "input") inputs.push(el);
        return el;
    },
    body: makeStub(),
    addEventListener: noop,
});
globalThis.window = makeStub({ addEventListener: noop, devicePixelRatio: 1 });
globalThis.Touch = class {};

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
