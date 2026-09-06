// A stack of absolutely-positioned canvases, and a way to add to it.
//
// This is what lets a page other than method.html have its own layers without
// importing the method page: it registers a spec here instead. The stack knows
// about canvases, z-order and visibility; it knows nothing about pentagrids.
//
// Layers declare rather than command. `visible` and `opacity` are predicates
// evaluated at draw time, so step presets and feature flags change what is drawn
// by changing what those predicates read — no caller has to remember to update a
// flag on the layer.

export interface LayerContext {
    ctx: CanvasRenderingContext2D;
    w: number; h: number;
    cx: number; cy: number;   // canvas centre, the origin most draw code wants
}

export interface LayerSpec {
    id: string;
    label: string;
    /** Paint order. Higher is nearer the viewer. */
    z: number;
    /** Panel section. Omitted means the layer gets no toggle. */
    group?: string;
    draw: (c: LayerContext) => void;
    /** Step- or feature-driven visibility. Default: always. */
    visible?: () => boolean;
    /** Default: 1. Applied as CSS opacity, so it costs no redraw. */
    opacity?: () => number;
}

export interface Layer extends LayerSpec {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    /** The panel's switch. Separate from `visible`, which the page drives. */
    userVisible: boolean;
}

export interface RawLayer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
}

export class LayerStack {
    readonly container: HTMLElement;
    /** Current size. Mutable: the host may resize the stack under us. */
    w: number;
    h: number;
    private readonly byId = new Map<string, Layer>();
    private readonly order: Layer[] = [];
    /** Canvases the stack sizes but never draws, so resize can reach them too. */
    private readonly raw: HTMLCanvasElement[] = [];

    constructor(container: HTMLElement, w: number, h: number) {
        this.container = container;
        this.w = w;
        this.h = h;
        // Absolutely positioned children need a positioned ancestor, and the
        // container is not ours to restyle beyond that one requirement.
        const pos = typeof getComputedStyle === "function"
            ? getComputedStyle(container).position : "";
        if (!pos || pos === "static") container.style.position = "relative";
    }

    private makeCanvas(z: number, pointerEvents: string): HTMLCanvasElement {
        const c = document.createElement("canvas");
        c.width = this.w;
        c.height = this.h;
        // The stack only works if the canvases overlay each other, so that is set
        // here rather than left to a stylesheet. The class stays for pages that
        // want to style them further, but nothing depends on it — an outside page
        // that imports this and knows none of our CSS still gets a working stack.
        c.className = "layer-canvas";
        c.style.position = "absolute";
        c.style.top = "0";
        c.style.left = "0";
        c.style.zIndex = String(z);
        c.style.pointerEvents = pointerEvents;
        this.container.appendChild(c);
        return c;
    }

    /** Register a drawn layer. */
    add(spec: LayerSpec): Layer {
        const canvas = this.makeCanvas(spec.z, "none");
        const layer: Layer = {
            ...spec,
            canvas,
            ctx: canvas.getContext("2d")!,
            userVisible: true,
        };
        this.byId.set(spec.id, layer);
        this.order.push(layer);
        return layer;
    }

    /**
     * A canvas the stack sizes and positions but does not draw — overlays painted
     * imperatively (a highlight, a hover marker) and the input-capture surface.
     */
    addRaw(z: number, pointerEvents = "none"): RawLayer {
        const canvas = this.makeCanvas(z, pointerEvents);
        this.raw.push(canvas);
        return { canvas, ctx: canvas.getContext("2d")! };
    }

    /**
     * Resize every canvas, drawn and raw alike. Setting width or height clears a
     * canvas, so the caller must redraw afterwards — which is why this does not
     * redraw itself: the host knows what a redraw costs and when it is due.
     */
    resize(w: number, h: number) {
        if (!(w > 0 && h > 0)) return;
        if (w === this.w && h === this.h) return;
        this.w = w;
        this.h = h;
        for (const l of this.order) { l.canvas.width = w; l.canvas.height = h; }
        for (const c of this.raw) { c.width = w; c.height = h; }
    }

    get(id: string): Layer | undefined {
        return this.byId.get(id);
    }

    all(): readonly Layer[] {
        return this.order;
    }

    /** Layers that asked for a panel toggle, in declaration order, by section. */
    groups(): Map<string, Layer[]> {
        const out = new Map<string, Layer[]>();
        for (const l of this.order) {
            if (!l.group) continue;
            const list = out.get(l.group) ?? [];
            list.push(l);
            out.set(l.group, list);
        }
        return out;
    }

    /** Move a whole group, keeping its internal order. */
    setGroupZ(group: string, base: number) {
        let i = 0;
        for (const l of this.order) {
            if (l.group !== group) continue;
            l.z = base + i;
            l.canvas.style.zIndex = String(l.z);
            i++;
        }
    }

    /**
     * Draw every layer that wants to be drawn, clearing first so no layer has to
     * remember to. Hidden layers are display:none rather than cleared, so a layer
     * that is expensive to build is not rebuilt to hide it.
     */
    drawAll() {
        const cx = this.w / 2;
        const cy = this.h / 2;
        for (const l of this.order) {
            const wanted = (l.visible ? l.visible() : true) && l.userVisible;
            if (!wanted) {
                l.canvas.style.display = "none";
                continue;
            }
            l.canvas.style.display = "block";
            l.canvas.style.opacity = String(l.opacity ? l.opacity() : 1);
            l.ctx.clearRect(0, 0, this.w, this.h);
            l.draw({ ctx: l.ctx, w: this.w, h: this.h, cx, cy });
        }
    }
}
