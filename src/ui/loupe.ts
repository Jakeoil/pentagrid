// A pinned magnifier panel: an inset view of a small thing, at whatever
// magnification it takes to make it workable.
//
// Nothing here knows about pentagrids. It is given a point, a magnification and
// a label, and a callback that paints its own content into the panel at the
// panel's view. That makes it usable by any canvas app with something too small
// to aim at.
//
// Why an inset and not a fisheye. A radial magnifier is not conformal, so inside
// it straight lines curve and angles change — expensive for a picture whose
// subject is straight lines at exact angles. And with g(0)=0 and g(R)=R the mean
// of g' over [0,R] is exactly 1, so magnifying the centre forces a compression
// annulus at the rim, where things are HARDER to hit than at 1x. An inset costs
// neither, and picking inside it is the host's own transform at a different
// scale and centre.

export interface LoupeView {
    x: number; y: number;   // centre, in the host's coordinates
    scale: number;          // pixels per unit, inside the panel
}

export interface LoupeTarget {
    x: number; y: number;
    /** Magnification relative to the host's scale. */
    mag: number;
    label: string;
}

export interface LoupeOptions {
    container: HTMLElement;
    size?: number;
    /** Paint the panel. `size` is its width and height in pixels. */
    render: (ctx: CanvasRenderingContext2D, view: LoupeView, size: number) => void;
    /** Hovering inside, in the host's coordinates. Return tooltip HTML, or null. */
    onHover?: (x: number, y: number) => string | null;
    /** Called when the hover moves or the panel closes, so the host can redraw. */
    onChange?: () => void;
    tooltip?: HTMLElement;
}

export interface Loupe {
    element: HTMLCanvasElement;
    /** Non-null while open. */
    readonly view: LoupeView | null;
    /** True while the cursor is inside, which latches the view. */
    readonly frozen: boolean;
    open: (t: LoupeTarget, hostScale: number) => void;
    close: () => void;
    redraw: () => void;
}

export function createLoupe(opts: LoupeOptions): Loupe {
    const size = opts.size ?? 220;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.className = "loupe";
    canvas.style.display = "none";
    opts.container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    let view: LoupeView | null = null;
    let label = "";
    let mag = 1;
    let frozen = false;

    function toHost(sx: number, sy: number): [number, number] {
        return [
            view!.x + (sx - size / 2) / view!.scale,
            view!.y - (sy - size / 2) / view!.scale,
        ];
    }

    function redraw() {
        if (!view) return;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);

        opts.render(ctx, view, size);

        // Centre mark on whatever opened the panel
        const c = size / 2;
        ctx.strokeStyle = "rgba(220, 40, 70, 0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c - 7, c); ctx.lineTo(c - 3, c);
        ctx.moveTo(c + 3, c); ctx.lineTo(c + 7, c);
        ctx.moveTo(c, c - 7); ctx.lineTo(c, c - 3);
        ctx.moveTo(c, c + 3); ctx.lineTo(c, c + 7);
        ctx.stroke();

        // Magnification is adaptive and spans orders of magnitude, so say it.
        const magStr = mag >= 1000
            ? `${(mag / 1000).toFixed(mag < 10000 ? 1 : 0)}k×`
            : `${Math.round(mag)}×`;
        ctx.font = "11px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        const foot = `${magStr}  ${label}`;
        const tw = ctx.measureText(foot).width;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillRect(3, size - 17, tw + 8, 15);
        ctx.fillStyle = "#444";
        ctx.fillText(foot, 7, size - 4);

        // The panel is useless unless you know you can move into it.
        if (!frozen) {
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const hint = "move in to hover · esc to close";
            const hw = ctx.measureText(hint).width;
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.fillRect(size / 2 - hw / 2 - 4, 3, hw + 8, 14);
            ctx.fillStyle = "#888";
            ctx.fillText(hint, size / 2, 5);
        }
    }

    function open(t: LoupeTarget, hostScale: number) {
        // Already latched onto this target: leave the magnification alone, or the
        // panel zooms continuously as the cursor moves and becomes unreadable.
        if (view && view.x === t.x && view.y === t.y) return;
        view = { x: t.x, y: t.y, scale: hostScale * t.mag };
        mag = t.mag;
        label = t.label;
        canvas.style.display = "block";
        canvas.style.pointerEvents = "auto";
        redraw();
    }

    function close() {
        if (!view) return;
        view = null;
        frozen = false;
        canvas.style.display = "none";
        canvas.style.pointerEvents = "none";
        if (opts.tooltip) opts.tooltip.style.display = "none";
        opts.onChange?.();
    }

    // Entering is the commit gesture: the view latches and stays put while
    // hovering inside, so travelling to the panel can never retarget or close it.
    canvas.addEventListener("mouseenter", () => { frozen = true; redraw(); });

    canvas.addEventListener("mouseleave", () => {
        frozen = false;
        if (opts.tooltip) opts.tooltip.style.display = "none";
        opts.onChange?.();
        redraw();
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!view) return;
        const rect = canvas.getBoundingClientRect();
        const [mx, my] = toHost(e.clientX - rect.left, e.clientY - rect.top);
        const html = opts.onHover?.(mx, my) ?? null;
        if (opts.tooltip) {
            if (html === null) {
                opts.tooltip.style.display = "none";
            } else {
                opts.tooltip.innerHTML = html;
                opts.tooltip.style.display = "block";
                opts.tooltip.style.left = `${e.clientX + 12}px`;
                opts.tooltip.style.top = `${e.clientY - 28}px`;
            }
        }
        opts.onChange?.();
        redraw();
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
    });

    return {
        element: canvas,
        get view() { return view; },
        get frozen() { return frozen; },
        open, close, redraw,
    };
}
