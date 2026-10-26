/**
 * The composite: one SVG per container, every layer in it — PLAN §5.99, step 2.
 *
 * Jake: *"It's a record of a canvas with all its layers. A single image that
 * can be put into a pdf or web page. A single SVG file. For example in split,
 * one for G and one for P."* So the unit is the stacked area you look at, not
 * the layer: `LayerStack.add` builds a canvas per layer, so method gives **one
 * file of 12 layers** and split gives **two** — G with 6, P with 6 plus the
 * mirrored `axes`.
 *
 * **Four things a composite needs that per-layer files would not**, each a
 * property of `LayerStack` rather than of this module, each measured in §5.99
 * and pinned by `tools/stateinv.test.mjs`:
 *
 * 1. **Document order is z order, and it is NOT draw order.** `drawAll`
 *    iterates insertion order; the picture is stacked by the canvases'
 *    `z-index`. On G those differ — inserted `background@5 grid@10 axes@70
 *    dots@29 ammann-grid@11 klabels@28`, stacked `5 10 11 28 29 70`. SVG has no
 *    z-index, so this sorts. Canvas got away with it because the browser did
 *    the sorting; an SVG that keeps draw order is silently wrong.
 * 2. **A layer's opacity is on the element, not in the drawing.** `opacity: ()
 *    => gridAlpha` is a CSS opacity on the canvas, so it becomes the `<g>`'s
 *    `opacity` and nothing in the recorded calls carries it.
 * 3. **Hidden layers are `display:none`, not cleared** — deliberately, so an
 *    expensive layer is not rebuilt to hide it. So an empty recording cannot be
 *    trusted; the filter is `visible() && userVisible`.
 * 4. **The raw overlays are not layers.** `addRaw` canvases are the hover
 *    marker, the highlight and the input-capture surface — four on G, two on P.
 *    §9.3's transient scope, and no part of a record.
 *
 * **Every canvas in a stack is the same size**, so one `viewBox` per file and
 * the layers align with no transform of any kind. And no `width`/`height`:
 * §5.99's route A, where the file scales to whatever space it is given and the
 * reader's zoom is the zoom — which is the whole SVG advantage over a PNG here.
 */
import { SvgRecorder } from "./record.js";
import type { LayerStack, Layer, RawLayer } from "../view/layers.js";

export interface SvgExportOptions {
    /**
     * Multiplies stroke widths and font sizes — §5.99's route B. Leave at 1 for
     * an export at the on-screen scale, where the look is preserved exactly.
     */
    scale?: number;
    /** Keep only these layer ids. Default: everything visible. */
    only?: readonly string[];
    /**
     * What to do with a layer the recorder cannot draw — `drawKRegions`, which
     * colors every pixel by its K-region.
     *
     * Returning markup embeds it (a page can hand back
     * `<image href="data:image/png;base64,…"/>` from the live canvas's
     * `toDataURL`); returning null leaves the layer out. Default: out, with a
     * comment saying so, because this module has no PNG encoder and will not
     * pretend otherwise.
     */
    raster?: (layer: Layer) => string | null;
    /**
     * Mark each `<g>` as a layer for Inkscape and Illustrator, so a recipient
     * can switch one off in an editor. §5.99's happy medium: it is what
     * separate files would have bought, without the links. On by default.
     */
    editorLayers?: boolean;
}

export interface SvgFile {
    /** The container's element id where it has one, else its index. */
    id: string;
    svg: string;
    /** Layer ids in the file, in the order they are stacked. */
    layers: string[];
    /** True if a layer was left out because it is a raster. */
    droppedRaster: boolean;
}

/** Which of a container's children an element is, without needing a real DOM. */
function inside(el: unknown, container: HTMLElement): boolean {
    if ((el as { parentNode?: unknown }).parentNode === container) return true;
    const kids = (container as { children?: ArrayLike<unknown> }).children;
    if (!kids || typeof kids.length !== "number") return false;
    for (let i = 0; i < kids.length; i++) if (kids[i] === el) return true;
    return false;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Record a view once and return one SVG per container.
 *
 * It swaps every layer's context for a recorder, redraws, and puts the real
 * contexts back — so the page is exactly as it was when this returns, and a
 * failure part way through still restores them.
 */
export function exportSvg(
    view: { stack: LayerStack; redraw: () => void },
    opts: SvgExportOptions = {},
): SvgFile[] {
    const { stack } = view;
    const scale = opts.scale ?? 1;
    const editorLayers = opts.editorLayers ?? true;

    // ── record
    const recs = new Map<RawLayer | Layer, SvgRecorder>();
    const saved: { t: RawLayer | Layer; ctx: CanvasRenderingContext2D }[] = [];
    let n = 0;
    try {
        for (const l of stack.all()) {
            for (const t of [l as RawLayer | Layer, ...l.mirrors]) {
                const r = new SvgRecorder({ scale, idPrefix: `d${++n}-` });
                recs.set(t, r);
                saved.push({ t, ctx: t.ctx });
                t.ctx = r as unknown as CanvasRenderingContext2D;
            }
        }
        view.redraw();
    } finally {
        for (const s of saved) s.t.ctx = s.ctx;
    }

    // ── assemble, one file per container
    const out: SvgFile[] = [];
    stack.containers.forEach((container, i) => {
        const mine: { layer: Layer; rec: SvgRecorder }[] = [];
        for (const l of stack.all()) {
            // The layer's own canvas, or its mirror in this container.
            const target: (RawLayer | Layer) | undefined =
                inside(l.canvas, container) ? l
                : l.mirrors.find((m) => inside(m.canvas, container));
            if (!target) continue;
            const rec = recs.get(target);
            if (!rec) continue;
            // Gotcha 3: hidden layers are display:none, not cleared.
            const shown = (l.visible ? l.visible() : true) && l.userVisible;
            if (!shown) continue;
            if (opts.only && !opts.only.includes(l.id)) continue;
            mine.push({ layer: l, rec });
        }
        // Gotcha 1: document order is z order, which is not draw order.
        mine.sort((a, b) => a.layer.z - b.layer.z);

        const defs: string[] = [];
        const groups: string[] = [];
        const ids: string[] = [];
        let dropped = false;
        for (const { layer, rec } of mine) {
            if (rec.out.raster) {
                // Gotcha: the one layer that is not vector. §5.99 — composited
                // it is a <g> inside the single file rather than a file to
                // skip, so it is an embedded PNG or an omission.
                const embedded = opts.raster?.(layer) ?? null;
                if (!embedded) {
                    dropped = true;
                    groups.push(`  <!-- layer ${esc(layer.id)} omitted: a raster`
                        + ` (every pixel colored by its K-region) -->`);
                    continue;
                }
                defs.push(...rec.out.defs);
                groups.push(openGroup(layer, editorLayers) + embedded + `</g>`);
                ids.push(layer.id);
                continue;
            }
            if (!rec.out.body.length) continue;      // drew nothing; say nothing
            defs.push(...rec.out.defs);
            groups.push(openGroup(layer, editorLayers)
                + `\n    ${rec.out.body.join("\n    ")}\n  </g>`);
            ids.push(layer.id);
        }

        // The xlink namespace, because the gradients' stop references are
        // written in both spellings and SVG 1.1 requires the prefixed one.
        const ns = [
            'xmlns="http://www.w3.org/2000/svg"',
            'xmlns:xlink="http://www.w3.org/1999/xlink"',
            ...(editorLayers
                ? ['xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"']
                : []),
        ].join(" ");
        // No width or height: §5.99's route A. The viewBox fixes the content
        // and the file then scales to whatever space it is given.
        const svg = `<svg ${ns} viewBox="0 0 ${stack.w} ${stack.h}">\n`
            + (defs.length ? `  <defs>\n    ${defs.join("\n    ")}\n  </defs>\n` : "")
            + groups.join("\n")
            + `\n</svg>\n`;
        const id = (container as { id?: string }).id || (i === 0 ? "main" : `c${i}`);
        out.push({ id, svg, layers: ids, droppedRaster: dropped });
    });
    return out;
}

/** A layer's group, with its opacity and — optionally — its editor identity. */
function openGroup(layer: Layer, editorLayers: boolean): string {
    // Gotcha 2: the opacity is on the element, not in the drawing.
    const alpha = layer.opacity ? layer.opacity() : 1;
    let g = `  <g id="${esc(layer.id)}"`;
    if (alpha !== 1) g += ` opacity="${Math.round(alpha * 1e6) / 1e6}"`;
    if (editorLayers) {
        g += ` inkscape:groupmode="layer" inkscape:label="${esc(layer.label)}"`;
    }
    return `${g}>`;
}
