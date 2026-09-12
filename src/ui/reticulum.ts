// The reticulum: n grid directions inside a regular decagon.
//
// GEOMETRY. A regular decagon has ten sides in five opposite pairs, and the pair
// normals are exactly {+v_j, -v_j} for the five pentagrid directions — so the
// figure and the families fit each other with nothing left over. For family j its
// own opposite pair of sides ARE its range limits: the side at +v_j is +1/2, the
// side at -v_j is -1/2, and the centre is 0. Gamma therefore runs the full width
// through the centre, side to side. It is NOT a radial slider from the centre
// out, and at the extremes the drawn line coincides with the decagon side itself.
//
// COORDINATES. The model keeps gamma canonical in [0,1); the reticulum shows the
// congruent signed representative in [-1/2, +1/2]. That conversion is a display
// transform and nothing else — 0.8 and -0.2 are the same gamma, shown differently
// by the two instruments, which is what keeps them trivially in sync. Everything
// reported back out is unwrapped, so dragging through either 0 or the mod-1
// boundary is continuous in the state even though the picture wraps.
//
// A pure view, like ui/dials.ts. It reports moves and renders what it is told; it
// never computes the dependent value and knows nothing about pentagrids.

const NS = "http://www.w3.org/2000/svg";

/** Centre-to-side distance of the decagon. Gamma's full travel is 2A. */
const A = 1;
/** Centre-to-vertex. */
const CIRC = A / Math.cos(Math.PI / 10);
/** Where the family labels sit. */
const LABEL_R = CIRC + 0.2;
/** Half-width of the active gamma's band, as a fraction of A. */
const BAND = 0.26;

export interface ReticulumState {
    values: readonly number[];
    /** The dependent index, or -1 when nothing holds the total. */
    locked: number;
    sum: number;
    sumNote?: string;
}

export interface ReticulumOptions {
    count: number;
    /** Unit vectors, math convention (y up). Held live: the model mutates in
     *  place, so turning the star is picked up without re-mounting. */
    directions: readonly (readonly [number, number])[];
    colors: readonly string[];
    wheelStep?: number;
    wheelFine?: number;
    onChange: (index: number, value: number) => void;
    onSelect?: (index: number) => void;
    /** The user asked for a different dependent offset by clicking its label. */
    onLock?: (index: number) => void;
}

export interface Reticulum {
    element: SVGSVGElement;
    sync: (s: ReticulumState) => void;
    selected: () => number;
}

/**
 * The congruent signed representative, in [-1/2, +1/2).
 *
 * THE one place the conversion happens. +1/2 and -1/2 are the same gamma — they
 * are opposite sides of the decagon and adjacent lines of the same family — and
 * this returns the lower of the two, so the marker leaves one side and re-enters
 * at the other rather than stopping.
 */
export const signedGamma = (g: number): number => (((g + 0.5) % 1) + 1) % 1 - 0.5;

const el = (tag: string): SVGElement => document.createElementNS(NS, tag) as SVGElement;

/**
 * Mix a colour towards white. The active band is the family's own colour washed
 * out, so the band says *which* gamma is being driven without competing with the
 * line that says *where* it is.
 */
export function lighten(hex: string, t: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    const mix = (c: number) => Math.round(c + (255 - c) * t);
    const r = mix((v >> 16) & 255), g = mix((v >> 8) & 255), b = mix(v & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const attrs = (node: SVGElement, a: Record<string, string | number>) => {
    for (const k of Object.keys(a)) node.setAttribute(k, String(a[k]));
    return node;
};

export function createReticulum(opts: ReticulumOptions): Reticulum {
    const { count, colors, directions } = opts;
    const step = opts.wheelStep ?? 0.01;
    const fine = opts.wheelFine ?? 0.001;
    const SPAN = 2 * LABEL_R + 0.28;

    const svg = el("svg") as SVGSVGElement;
    attrs(svg, {
        viewBox: `${-SPAN / 2} ${-SPAN / 2} ${SPAN} ${SPAN}`,
        class: "reticulum", role: "group", "aria-label": "grid offsets",
    });

    /** SVG has y down; the model has y up. Flip once, here. */
    const axisVec = (j: number): [number, number] => {
        const [x, y] = directions[j] ?? [1, 0];
        return [x, -y];
    };
    /** The direction family j's LINES run: across its axis. */
    const lineVec = (j: number): [number, number] => {
        const [x, y] = axisVec(j);
        return [-y, x];
    };

    /** The decagon's ten outward normals: every axis and its opposite. */
    function normals(): [number, number][] {
        const out: [number, number][] = [];
        for (let j = 0; j < count; j++) {
            const [x, y] = axisVec(j);
            out.push([x, y], [-x, -y]);
        }
        return out;
    }

    /** Corners, as the meeting points of neighbouring sides. */
    function corners(): [number, number][] {
        const ns = normals().slice().sort(
            (p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
        const pts: [number, number][] = [];
        for (let i = 0; i < ns.length; i++) {
            const a = ns[i], b = ns[(i + 1) % ns.length];
            const det = a[0] * b[1] - a[1] * b[0];
            if (Math.abs(det) < 1e-12) continue;
            pts.push([(A * b[1] - A * a[1]) / det, (A * a[0] - A * b[0]) / det]);
        }
        return pts;
    }

    /**
     * How far a line may run inside the decagon: the t-interval of
     * `d * u + t * w` that satisfies every side. Gives the drawn line ends, and
     * at |gamma| = 1/2 it collapses onto a side exactly.
     */
    function span(d: number, u: [number, number], w: [number, number]): [number, number] {
        let lo = -Infinity, hi = Infinity;
        for (const nrm of normals()) {
            const du = u[0] * nrm[0] + u[1] * nrm[1];
            const dw = w[0] * nrm[0] + w[1] * nrm[1];
            const slack = A - d * du;
            if (Math.abs(dw) < 1e-12) { if (slack < 0) return [0, 0]; continue; }
            const t = slack / dw;
            if (dw > 0) hi = Math.min(hi, t); else lo = Math.max(lo, t);
        }
        return lo > hi ? [0, 0] : [lo, hi];
    }

    const poly = (pts: [number, number][]) =>
        pts.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(" ");

    // ── structure ────────────────────────────────────────────────
    // The target goes in first so the drawing sits over it; the drawing is
    // pointer-transparent in CSS and the labels opt back in.
    const hit = attrs(el("rect"), {
        x: -SPAN / 2, y: -SPAN / 2, width: SPAN, height: SPAN,
        class: "ret-hit", fill: "transparent",
    });
    svg.appendChild(hit);

    const band = attrs(el("polygon"), { class: "ret-band", points: "" });
    svg.appendChild(band);

    const rim = attrs(el("polygon"), { class: "ret-rim", points: poly(corners()) });
    svg.appendChild(rim);

    interface AxisParts { group: SVGElement; line: SVGElement; grid: SVGElement; label: SVGElement; }
    const axes: AxisParts[] = [];
    const SUB = "₀₁₂₃₄₅₆₇₈₉";

    for (let j = 0; j < count; j++) {
        const group = attrs(el("g"), { class: "ret-axis", "data-j": j });
        const line = attrs(el("line"), { class: "ret-line", stroke: colors[j % colors.length] });
        const grid = attrs(el("line"), { class: "ret-grid", stroke: colors[j % colors.length] });
        group.appendChild(line);
        group.appendChild(grid);
        svg.appendChild(group);

        const label = attrs(el("text"), {
            class: "ret-label", "data-j": j,
            "text-anchor": "middle", "dominant-baseline": "middle",
        });
        label.textContent = `γ${SUB[j] ?? j}`;
        label.addEventListener("pointerdown", (e) => {
            (e as PointerEvent).stopPropagation?.();
            opts.onLock?.(j);
        });
        svg.appendChild(label);
        axes.push({ group, line, grid, label });
    }

    // A tiny cross at the origin, no more: one arm along the active family's
    // lines, one along the dependent family's. A reference mark, not a cursor.
    const cross = attrs(el("g"), { class: "ret-cross" });
    const crossA = attrs(el("line"), { class: "ret-cross-active" });
    const crossD = attrs(el("line"), { class: "ret-cross-dep" });
    cross.appendChild(crossD);
    cross.appendChild(crossA);
    svg.appendChild(cross);

    let current: readonly number[] = new Array(count).fill(0);
    let lockedNow = count - 1;
    let selected = -1;
    let hovered = -1;
    let dragging = -1;
    let dragFrom: [number, number] | null = null;

    function at(e: { clientX: number; clientY: number }): [number, number] {
        const r = svg.getBoundingClientRect();
        if (!r || !r.width || !r.height) return [0, 0];
        return [
            (e.clientX - r.left) / r.width * SPAN - SPAN / 2,
            (e.clientY - r.top) / r.height * SPAN - SPAN / 2,
        ];
    }

    /** Nearest axis by perpendicular distance to its whole diameter. */
    function nearest(p: [number, number]): number {
        let best = -1, bestD = Infinity;
        for (let j = 0; j < count; j++) {
            const [ux, uy] = axisVec(j);
            const d = Math.abs(p[0] * uy - p[1] * ux);
            if (d < bestD) { bestD = d; best = j; }
        }
        return best;
    }

    const target = (p: [number, number]) => (selected >= 0 ? selected : nearest(p));

    function drive(j: number, delta: number) {
        if (j < 0 || j === lockedNow) return;
        // Unwrapped: the state runs on, only the picture wraps.
        opts.onChange(j, current[j] + delta);
    }

    hit.addEventListener("wheel", (ev) => {
        const e = ev as WheelEvent;
        const j = target(at(e));
        if (j === lockedNow) return;
        e.preventDefault();
        drive(j, (e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? fine : step));
    }, { passive: false });

    hit.addEventListener("pointerdown", (ev) => {
        const e = ev as PointerEvent;
        const p = at(e);
        const j = nearest(p);
        selected = j;
        opts.onSelect?.(j);
        if (j !== lockedNow) { dragging = j; dragFrom = p; }
        render();
    });

    hit.addEventListener("pointermove", (ev) => {
        const e = ev as PointerEvent;
        const p = at(e);
        if (dragging >= 0 && dragFrom) {
            const [ux, uy] = axisVec(dragging);
            // One unit of gamma is the full side-to-side width, 2A, and the line
            // runs against gamma — so dragging it along +v LOWERS gamma. The sign
            // is what keeps the line under the finger.
            const along = (p[0] - dragFrom[0]) * ux + (p[1] - dragFrom[1]) * uy;
            drive(dragging, -along / (2 * A));
            dragFrom = p;
            return;
        }
        const h = nearest(p);
        if (h !== hovered) { hovered = h; render(); }
    });

    const release = () => { dragging = -1; dragFrom = null; };
    hit.addEventListener("pointerup", release);
    hit.addEventListener("pointercancel", release);
    hit.addEventListener("pointerleave", () => {
        release();
        if (hovered !== -1) { hovered = -1; render(); }
    });

    function render() {
        const live = selected >= 0 ? selected : hovered;

        for (let j = 0; j < count; j++) {
            const { group, line, grid, label } = axes[j];
            const u = axisVec(j), w = lineVec(j);
            const isLive = j === live;
            const isDependent = j === lockedNow;
            group.setAttribute("class", "ret-axis"
                + (isLive ? " live" : "") + (isDependent ? " dependent" : ""));

            // the diameter, side to side
            attrs(line, {
                x1: -u[0] * A, y1: -u[1] * A, x2: u[0] * A, y2: u[1] * A,
            });

            // The family's line, at the signed offset. -1/2 and +1/2 land on the
            // two opposite sides; 0 passes through the centre.
            //
            // NEGATED, and that is the whole of it: the model puts line n at
            // x . v_j = n - gamma_j, so raising gamma slides the family along
            // MINUS v_j. Drawing it along +v_j made the reticulum move opposite to
            // the grid it is a picture of.
            const d = -signedGamma(current[j] ?? 0) * 2 * A;
            const [lo, hi] = span(d, u, w);
            attrs(grid, {
                x1: u[0] * d + w[0] * lo, y1: u[1] * d + w[1] * lo,
                x2: u[0] * d + w[0] * hi, y2: u[1] * d + w[1] * hi,
            });

            attrs(label, { x: u[0] * LABEL_R, y: u[1] * LABEL_R });
            label.setAttribute("class", "ret-label"
                + (isDependent ? " dependent" : "") + (isLive ? " live" : ""));
            label.setAttribute("fill", isDependent ? "#aaa" : colors[j % colors.length]);
        }

        // The active gamma's range: a corridor along its axis, side to side.
        // Subordinate to the marker, and it rotates with whichever is live.
        if (live >= 0) {
            const u = axisVec(live), w = lineVec(live), b = BAND * A;
            band.setAttribute("points", poly([
                [-u[0] * A - w[0] * b, -u[1] * A - w[1] * b],
                [u[0] * A - w[0] * b, u[1] * A - w[1] * b],
                [u[0] * A + w[0] * b, u[1] * A + w[1] * b],
                [-u[0] * A + w[0] * b, -u[1] * A + w[1] * b],
            ]));
            band.setAttribute("fill", lighten(colors[live % colors.length], 0.82));
            band.setAttribute("class", "ret-band on");
        } else {
            band.setAttribute("class", "ret-band");
        }

        // The cross: active arm and dependent arm, each along that family's lines.
        const arm = 0.055 * A;
        const set = (node: SVGElement, j: number) => {
            const w = j >= 0 ? lineVec(j) : ([1, 0] as [number, number]);
            attrs(node, {
                x1: -w[0] * arm, y1: -w[1] * arm, x2: w[0] * arm, y2: w[1] * arm,
            });
            node.setAttribute("opacity", j >= 0 ? "1" : "0");
        };
        set(crossA, live);
        set(crossD, lockedNow);

        rim.setAttribute("points", poly(corners()));
    }

    function sync(s: ReticulumState) {
        current = s.values;
        lockedNow = s.locked;
        if (selected === lockedNow) selected = -1;
        render();
        const live = selected >= 0 ? selected : hovered;
        svg.setAttribute("aria-label", live >= 0
            ? `grid offsets, axis ${live} at ${signedGamma(s.values[live] ?? 0).toFixed(3)}`
            : "grid offsets");
    }

    render();
    return { element: svg, sync, selected: () => selected };
}
