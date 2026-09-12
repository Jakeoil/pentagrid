// A DOM and 2d-context stub, just enough to construct a page in node.
// Shared by pagecheck (which imports a built page) and the layer tests (which
// construct a LayerStack directly).

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
    // `children` and `on` let a test walk what a factory built and fire its
    // handlers, rather than only checking that construction did not throw.
    const on = {};
    const children = [];
    Object.assign(base, {
        on, children,
        style: {}, classList: { add: noop, remove: noop },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: SW, height: SH }),
        getAttribute: (name) => {
            if (!USE_ATTR) return null;
            if (name === "data-width") return String(SW);
            if (name === "data-height") return String(SH);
            return null;
        },
        appendChild: (c) => { children.push(c); return c; },
        // Must really remove: code that empties a node by looping on
        // `while (children.length) removeChild(last)` spins forever otherwise,
        // which is a hang rather than a failure and takes a while to recognise.
        removeChild: (c) => {
            const i = children.indexOf(c);
            if (i >= 0) children.splice(i, 1);
            return c;
        },
        addEventListener: (type, fn) => {
            handlers.push({ type, fn });
            (on[type] ??= []).push(fn);
        },
        setAttribute: noop,
        // `disabled` has to be a real false. Left to the Proxy it comes back as
        // a stub, which is truthy, so any test asking "is this control enabled?"
        // silently gets the wrong answer.
        value: "0", checked: false, disabled: false,
        textContent: "", innerHTML: "", dataset: {},
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
    // SVG needs createElementNS, and it has to build the same kind of stub —
    // otherwise the Proxy hands back something callable, the control appears to
    // construct, and pagecheck passes on a page that would render nothing.
    // Keeps its text. Without this the Proxy hands back a fresh stub and every
    // label a control writes is silently discarded, so a panel can be built
    // entirely out of blanks and still look fine to a test.
    createTextNode: (text) => makeStub({ textContent: String(text), nodeType: 3 }),
    createElementNS: (_ns, tag) => {
        const el = makeStub({ tagName: tag, attrs: {} });
        el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
        el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
        if (tag === "input") inputs.push(el);
        return el;
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
globalThis.getComputedStyle = () => ({ position: "static" });

// Recorded so a test can drive a resize instead of waiting for a real layout.
export const resizeObservers = [];
globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; resizeObservers.push(this); }
    observe(el) { this.targets.push(el); }
    unobserve() {}
    disconnect() { this.targets.length = 0; }
};
/** Fire every observer that is watching `el`. */
export function fireResize(el) {
    for (const ro of resizeObservers)
        if (ro.targets.includes(el)) ro.cb([{ target: el }], ro);
}


export { handlers, inputs, elements, makeStub, noop, SW, SH, USE_ATTR };
export function reset() {
    handlers.length = 0;
    inputs.length = 0;
    elements.clear();
}
