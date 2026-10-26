/**
 * A recording context: the drawing surface the layers already use, emitting
 * SVG instead of pixels — PLAN §5.99, step 1.
 *
 * Every layer draws through one `CanvasRenderingContext2D` and touches nothing
 * else, so an object with the same members records instead of rasterizing and
 * no layer's `draw` changes. That is the whole argument for doing it this way
 * rather than writing an SVG emitter per layer, and it is why the surface being
 * **closed** matters: counted over `src/`, the layers use 28 distinct members
 * and nothing more (`tools/ctxapi.test.mjs` fails if that stops being true).
 *
 * Four of the 28 do not map cleanly, and each is handled here as §5.99 decided:
 *
 * - **gradients** become `<linearGradient>` in `<defs>`, deduplicated by their
 *   stops. The height ramp builds one per painted face — 658 over bare tiles,
 *   1974 over families2 — and the index range is four or five levels, so the
 *   distinct gradients number in the dozens.
 * - **`clip`** becomes a `<clipPath>` and a `clip-path` on what follows, which
 *   keeps the pentaplex inlay's property that curves pass through unflattened
 *   and the cut adds no line of its own.
 * - **`measureText`** has no answer in a recorder — there is no layout — so it
 *   is approximated from the font size and the string, and the callers only
 *   want it to size a box behind a label.
 * - **`putImageData`** is the one true raster (`drawKRegions`). It is recorded
 *   as having happened and nothing is emitted; the caller decides whether to
 *   embed a PNG or leave the layer out.
 *
 * And the **export scale**: `lineWidth` and `font` are multiplied as they pass,
 * which is the one place that can fix a zoomed export's stroke weight (§5.99 —
 * line widths are constants at some twenty call sites, none derived from
 * `scale`, so a zoom makes them relatively finer). It is 1 by default and
 * changes nothing.
 */

/** What a recorded drawing comes out as. */
export interface Recording {
    /** The `<defs>` body: gradients and clip paths. */
    defs: string[];
    /** The drawn elements, in the order they were drawn. */
    body: string[];
    /** True if a layer drew a raster this recorder cannot represent. */
    raster: boolean;
}

interface State {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    lineJoin: string;
    lineCap: string;
    dash: number[];
    globalAlpha: number;
    font: string;
    textAlign: string;
    textBaseline: string;
    clip: string | null;
}

const START: State = {
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
    lineJoin: "miter", lineCap: "butt", dash: [], globalAlpha: 1,
    font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic",
    clip: null,
};

/** A gradient, as the layers build it and as `<defs>` wants it. */
class Grad {
    readonly stops: [number, string][] = [];
    constructor(
        readonly kind: "linear" | "radial",
        readonly coords: number[],
    ) {}
    addColorStop(at: number, color: string) { this.stops.push([at, color]); }
    /**
     * A gradient has two identities, and fusing them is what made the first
     * version of this almost useless.
     *
     * `paint()` is the stops — the colors and where they sit. `place()` is the
     * geometry. Measured over a shaded patch: **1659 gradient defs, 10 distinct
     * stop sets, 488 distinct geometries** — one geometry per tile, because
     * each tile's ramp runs along its own diagonal. A key over both therefore
     * deduplicates almost nothing, which is why §5.99's "dozens, not thousands"
     * was right about the stops and wrong about the mechanism.
     *
     * Split, SVG can express it exactly: a gradient may inherit its stops from
     * another through `href`, so ten defs carry the paint and the per-tile defs
     * carry nothing but four numbers and a reference.
     */
    paint() {
        return `${this.kind}|${this.stops.map(([a, c]) => `${a.toFixed(4)}:${c}`).join(";")}`;
    }
    place() {
        return `${this.kind}|${this.coords.map((c) => c.toFixed(3)).join(",")}`;
    }
}

const f = (n: number) => {
    // Six decimals is below a pixel at any zoom anyone will use, and it keeps
    // the file from carrying seventeen digits of float noise per coordinate.
    const r = Math.round(n * 1e6) / 1e6;
    return Object.is(r, -0) ? "0" : String(r);
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface RecorderOptions {
    /** Multiplies `lineWidth` and the font size. §5.99's zoomed export. */
    scale?: number;
    /** Prefix for generated ids, so two layers' defs cannot collide. */
    idPrefix?: string;
}

/**
 * The recorder.
 *
 * Typed as `unknown` at the boundary and cast by the caller: it implements the
 * 28 members the layers use and not the ~70 a real context has, so claiming
 * `CanvasRenderingContext2D` would be a lie that only TypeScript believes.
 */
export class SvgRecorder {
    readonly out: Recording = { defs: [], body: [], raster: false };
    private st: State = { ...START };
    private stack: State[] = [];
    private path: string[] = [];
    private here: [number, number] | null = null;
    private grads = new Map<string, string>();      // placement -> id
    private stopDefs = new Map<string, string>();   // stops -> id
    private clips = new Map<string, string>();      // d -> id
    private n = 0;
    private readonly k: number;
    private readonly prefix: string;

    constructor(opts: RecorderOptions = {}) {
        this.k = opts.scale ?? 1;
        this.prefix = opts.idPrefix ?? "g";
    }

    private id() { return `${this.prefix}${++this.n}`; }

    // ── state ────────────────────────────────────────────────────────
    save() { this.stack.push({ ...this.st, dash: [...this.st.dash] }); }
    restore() { const was = this.stack.pop(); if (was) this.st = was; }

    get fillStyle() { return this.st.fillStyle; }
    set fillStyle(v: unknown) { this.st.fillStyle = this.paintOf(v); }
    get strokeStyle() { return this.st.strokeStyle; }
    set strokeStyle(v: unknown) { this.st.strokeStyle = this.paintOf(v); }
    get lineWidth() { return this.st.lineWidth; }
    set lineWidth(v: number) { this.st.lineWidth = v; }
    get lineJoin() { return this.st.lineJoin; }
    set lineJoin(v: string) { this.st.lineJoin = v; }
    get lineCap() { return this.st.lineCap; }
    set lineCap(v: string) { this.st.lineCap = v; }
    get globalAlpha() { return this.st.globalAlpha; }
    set globalAlpha(v: number) { this.st.globalAlpha = v; }
    get font() { return this.st.font; }
    set font(v: string) { this.st.font = v; }
    get textAlign() { return this.st.textAlign; }
    set textAlign(v: string) { this.st.textAlign = v; }
    get textBaseline() { return this.st.textBaseline; }
    set textBaseline(v: string) { this.st.textBaseline = v; }

    setLineDash(d: readonly number[]) { this.st.dash = [...d]; }
    getLineDash() { return [...this.st.dash]; }

    /**
     * A fill or stroke value: a CSS color passes through, a gradient becomes a
     * `url(#id)` and lands in `<defs>` — deduplicated, since the height ramp
     * builds one per face and most faces share a triple of stops.
     */
    private paintOf(v: unknown): string {
        if (!(v instanceof Grad)) return String(v);
        const tag = v.kind === "linear" ? "linearGradient" : "radialGradient";
        // The stops, once per distinct set of them.
        const pk = v.paint();
        let stopsId = this.stopDefs.get(pk);
        if (!stopsId) {
            stopsId = this.id();
            this.stopDefs.set(pk, stopsId);
            this.out.defs.push(`<${tag} id="${stopsId}">` + v.stops
                .map(([at, c]) => `<stop offset="${f(at)}" stop-color="${esc(c)}"/>`)
                .join("") + `</${tag}>`);
        }
        // The geometry, once per distinct placement, inheriting those stops.
        // Both spellings of the reference: `xlink:href` is what every editor
        // reads and SVG 1.1 requires, `href` is SVG 2's. The root has to carry
        // the xlink namespace, which is the composite's business.
        const gk = `${v.place()}|${stopsId}`;
        const had = this.grads.get(gk);
        if (had) return `url(#${had})`;
        const id = this.id();
        this.grads.set(gk, id);
        const where = v.kind === "linear"
            ? ` x1="${f(v.coords[0])}" y1="${f(v.coords[1])}"`
              + ` x2="${f(v.coords[2])}" y2="${f(v.coords[3])}"`
            : ` fx="${f(v.coords[0])}" fy="${f(v.coords[1])}"`
              + ` cx="${f(v.coords[3])}" cy="${f(v.coords[4])}" r="${f(v.coords[5])}"`;
        this.out.defs.push(`<${tag} id="${id}" gradientUnits="userSpaceOnUse"`
            + `${where} href="#${stopsId}" xlink:href="#${stopsId}"/>`);
        return `url(#${id})`;
    }

    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        return new Grad("linear", [x0, y0, x1, y1]);
    }
    createRadialGradient(
        x0: number, y0: number, r0: number, x1: number, y1: number, r1: number,
    ) {
        return new Grad("radial", [x0, y0, r0, x1, y1, r1]);
    }

    // ── paths ────────────────────────────────────────────────────────
    beginPath() { this.path = []; this.here = null; }
    moveTo(x: number, y: number) {
        this.path.push(`M${f(x)} ${f(y)}`);
        this.here = [x, y];
    }
    lineTo(x: number, y: number) {
        if (!this.path.length) return this.moveTo(x, y);
        this.path.push(`L${f(x)} ${f(y)}`);
        this.here = [x, y];
    }
    closePath() { if (this.path.length) this.path.push("Z"); }
    quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
        this.path.push(`Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`);
        this.here = [x, y];
    }

    /**
     * An arc, as SVG's `A`.
     *
     * Two things canvas does and `A` does not. A full turn cannot be one arc —
     * the endpoints coincide and the command is a no-op — so a sweep of 2π or
     * more is split in half; the dots and the pool balls are drawn that way.
     * And an arc with no current point begins with a `M` to its start, which is
     * what canvas does implicitly.
     */
    arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
        let sweep = ccw ? a0 - a1 : a1 - a0;
        if (sweep < 0) sweep = sweep % (2 * Math.PI) + 2 * Math.PI;
        const full = sweep >= 2 * Math.PI - 1e-9;
        const at = (a: number): [number, number] =>
            [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        const start = at(a0);
        if (!this.path.length) this.path.push(`M${f(start[0])} ${f(start[1])}`);
        else this.path.push(`L${f(start[0])} ${f(start[1])}`);
        const dir = ccw ? 0 : 1;                       // sweep-flag
        if (full) {
            const mid = at(a0 + (ccw ? -Math.PI : Math.PI));
            this.path.push(`A${f(r)} ${f(r)} 0 0 ${dir} ${f(mid[0])} ${f(mid[1])}`);
            this.path.push(`A${f(r)} ${f(r)} 0 0 ${dir} ${f(start[0])} ${f(start[1])}`);
            this.here = start;
            return;
        }
        const end = at(ccw ? a0 - sweep : a0 + sweep);
        const large = sweep > Math.PI ? 1 : 0;
        this.path.push(`A${f(r)} ${f(r)} 0 ${large} ${dir} ${f(end[0])} ${f(end[1])}`);
        this.here = end;
    }

    /**
     * Clip to the current path.
     *
     * A `<clipPath>` in defs and a `clip-path` on everything drawn until the
     * matching `restore` — deduplicated by the path, since the inlay clips
     * every pentagon to a tile and a tile carries several.
     */
    clip() {
        const d = this.path.join(" ");
        if (!d) return;
        let id = this.clips.get(d);
        if (!id) {
            id = this.id();
            this.clips.set(d, id);
            this.out.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
        }
        this.st.clip = id;
    }

    // ── painting ─────────────────────────────────────────────────────
    private common(): string {
        let s = "";
        if (this.st.globalAlpha !== 1) s += ` opacity="${f(this.st.globalAlpha)}"`;
        if (this.st.clip) s += ` clip-path="url(#${this.st.clip})"`;
        return s;
    }
    private strokeAttrs(): string {
        let s = ` stroke="${esc(this.st.strokeStyle)}"`
            + ` stroke-width="${f(this.st.lineWidth * this.k)}"`;
        if (this.st.lineJoin !== "miter") s += ` stroke-linejoin="${this.st.lineJoin}"`;
        if (this.st.lineCap !== "butt") s += ` stroke-linecap="${this.st.lineCap}"`;
        if (this.st.dash.length) {
            s += ` stroke-dasharray="${this.st.dash.map((d) => f(d * this.k)).join(" ")}"`;
        }
        return s;
    }

    fill() {
        const d = this.path.join(" ");
        if (!d) return;
        this.out.body.push(
            `<path d="${d}" fill="${esc(this.st.fillStyle)}"${this.common()}/>`);
    }
    stroke() {
        const d = this.path.join(" ");
        if (!d) return;
        this.out.body.push(
            `<path d="${d}" fill="none"${this.strokeAttrs()}${this.common()}/>`);
    }
    fillRect(x: number, y: number, w: number, h: number) {
        this.out.body.push(
            `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"`
            + ` fill="${esc(this.st.fillStyle)}"${this.common()}/>`);
    }
    /**
     * `clearRect` has no SVG equivalent and needs none.
     *
     * Every layer clears its whole canvas before drawing — `drawAll` does it —
     * and an empty region is what an SVG starts as. A partial clear would be a
     * hole in what is underneath, which nothing in this project does.
     */
    clearRect() { /* nothing to erase in a document that starts empty */ }

    fillText(text: string, x: number, y: number) {
        if (!text) return;
        const anchor = this.st.textAlign === "center" ? "middle"
            : this.st.textAlign === "right" || this.st.textAlign === "end" ? "end"
            : "start";
        const baseline = this.st.textBaseline === "middle" ? "central"
            : this.st.textBaseline === "top" ? "hanging"
            : this.st.textBaseline === "bottom" ? "auto" : "auto";
        const size = this.fontSize() * this.k;
        const family = this.st.font.replace(/^.*?\d+(?:\.\d+)?px\s*/, "")
            || "sans-serif";
        this.out.body.push(
            `<text x="${f(x)}" y="${f(y)}" fill="${esc(this.st.fillStyle)}"`
            + ` font-size="${f(size)}" font-family="${esc(family)}"`
            + ` text-anchor="${anchor}" dominant-baseline="${baseline}"`
            + `${this.common()}>${esc(text)}</text>`);
    }

    private fontSize(): number {
        const m = /(\d+(?:\.\d+)?)px/.exec(this.st.font);
        return m ? Number(m[1]) : 10;
    }

    /**
     * There is no layout in a recorder, so this is an estimate.
     *
     * Its four callers all want the same thing: the width of a box to put
     * behind a label. 0.55 em per character is close for the sans-serif stacks
     * in use and wrong by a few percent, which moves a background rectangle and
     * nothing else. §5.99 names the alternative — drop the boxes in SVG output
     * — and that is the caller's decision, not this one's.
     */
    measureText(text: string) {
        return { width: text.length * this.fontSize() * 0.55 };
    }

    /**
     * The one true raster: `drawKRegions` colors every pixel by its K-region.
     *
     * Nothing is emitted and the fact is recorded, so the caller can decide
     * between an embedded PNG and leaving the layer out (§5.99). Returning a
     * usable buffer matters — the layer writes into it and then hands it back
     * through `putImageData`, so a stub that refused would throw.
     */
    createImageData(w: number, h: number) {
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }
    putImageData() { this.out.raster = true; }
}
