const NUM_GRIDS = 5;

// Unit vectors at 72° intervals
const directions: [number, number][] = [];
for (let j = 0; j < NUM_GRIDS; j++) {
    const angle = (2 * Math.PI * j) / 5;
    directions.push([Math.cos(angle), Math.sin(angle)]);
}

// Grid line colors
const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#d4a017", "#9b5de5"];

// Rhomb fill colors
const THICK_FILL = "#e8c170";
const THIN_FILL = "#7eb8da";

// Unicode subscripts for K labels
const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄'];

// Canvas dimensions
const CANVAS_W = 800;
const CANVAS_H = 800;

// State
const gamma = [0, 0, 0, 0, 0];
let currentStep = 0;
const STEP_COUNT = 6;
let lockedIndex = 4;

// View state
const MARGIN = 40;
let scale = 60;
let viewX = 0;
let viewY = 0;

// ── Step content ──────────────────────────────────────────────────

const stepContent = [
    {
        title: "Step 1 &mdash; The Pentagrid",
        html: `<p>For <i>j</i>&thinsp;=&thinsp;0,&thinsp;&hellip;,&thinsp;4 let
            <b>v</b><sub><i>j</i></sub>&thinsp;=&thinsp;(cos&thinsp;2&pi;<i>j</i>/5,&thinsp;sin&thinsp;2&pi;<i>j</i>/5)
            be unit vectors at 72&deg; intervals.</p>
            <p>Each family of grid lines is the set</p>
            <p class="equation">{&thinsp;<b>x</b> &isin; &Ropf;<sup>2</sup> :
            <b>x</b>&thinsp;&middot;&thinsp;<b>v</b><sub><i>j</i></sub>
            + &gamma;<sub><i>j</i></sub> &isin; &Zopf;&thinsp;}</p>
            <p>The dot product measures signed distance along
            <b>v</b><sub><i>j</i></sub>. Requiring it (shifted by
            &gamma;<sub><i>j</i></sub>) to be an integer produces a family of
            equally spaced parallel lines perpendicular to
            <b>v</b><sub><i>j</i></sub>.</p>
            <p>The constraint
            &gamma;<sub>0</sub>&thinsp;+&thinsp;&middot;&middot;&middot;&thinsp;+&thinsp;&gamma;<sub>4</sub>&thinsp;=&thinsp;0
            ensures the pentagrid is <em>regular</em>&thinsp;&mdash;&thinsp;generically,
            no more than two lines meet at any point.</p>`,
    },
    {
        title: "Step 2 &mdash; Intersections",
        html: `<p>Lines from different families intersect pairwise.
            Each dot marks where line <i>n<sub>j</sub></i> from
            family&nbsp;<i>j</i> crosses line <i>n<sub>k</sub></i> from
            family&nbsp;<i>k</i>.</p>
            <p>There are <span style="font-family:'Times New Roman',serif">C</span>(5,&thinsp;2)&thinsp;=&thinsp;10
            family pairs, each producing a lattice of intersection points.</p>
            <p>The regularity condition guarantees these are all
            <em>simple crossings</em>&thinsp;&mdash;&thinsp;exactly two lines
            at each point. This is essential for the dual construction
            that follows.</p>`,
    },
    {
        title: "Step 3 &mdash; Pentagrid Regions",
        html: `<p>The grid lines partition the plane into regions.
            Each region has constant <em>pentagrid coordinates</em>:</p>
            <p class="equation"><i>K<sub>j</sub></i>(<b>x</b>)&thinsp;=&thinsp;&lceil;&thinsp;<b>v</b><sub><i>j</i></sub>&thinsp;&middot;&thinsp;<b>x</b>
            + &gamma;<sub><i>j</i></sub>&thinsp;&rceil;</p>
            <p>At the intersection of line <i>k<sub>r</sub></i> from
            family&nbsp;<i>r</i> and line <i>k<sub>s</sub></i> from
            family&nbsp;<i>s</i>, four regions meet. Their
            <i>K</i>-tuples differ only at positions <i>r</i>
            and&nbsp;<i>s</i>:</p>
            <p class="equation" style="font-size:15px;text-align:left;padding-left:16px;">
            <i>K</i>(<b>x</b><sub>0</sub>)&thinsp;+&thinsp;(0,&thinsp;&hellip;,&thinsp;&epsilon;<sub><i>r</i></sub>,&thinsp;&hellip;,&thinsp;&epsilon;<sub><i>s</i></sub>,&thinsp;&hellip;,&thinsp;0)<br>
            where &epsilon;<sub><i>r</i></sub>,&thinsp;&epsilon;<sub><i>s</i></sub>&thinsp;&isin;&thinsp;{0,&thinsp;1}</p>
            <p>Intersection points correspond to <em>rhombs</em>.
            Regions between grid lines correspond to <em>vertices</em>,
            at positions
            <i>f</i>(<b>x</b>)&thinsp;=&thinsp;&sum;&thinsp;<i>K<sub>j</sub></i>&thinsp;&middot;&thinsp;<b>v</b><sub><i>j</i></sub>.</p>`,
    },
    {
        title: "Step 4 &mdash; Dual Vertices",
        html: `<p>Each point <b>x</b> receives <em>pentagrid coordinates</em>
            via the ceiling function:</p>
            <p class="equation"><i>K<sub>j</sub></i>(<b>x</b>)&thinsp;=&thinsp;&lceil;&thinsp;<b>v</b><sub><i>j</i></sub>&thinsp;&middot;&thinsp;<b>x</b>
            + &gamma;<sub><i>j</i></sub>&thinsp;&rceil;</p>
            <p>These integers are constant within each region between
            grid lines. The <em>vertex function</em> maps each region
            to a point:</p>
            <p class="equation"><i>f</i>&thinsp;(<b>x</b>)&thinsp;=&thinsp;&sum;
            <i>K<sub>j</sub></i>(<b>x</b>)&thinsp;&middot;&thinsp;<b>v</b><sub><i>j</i></sub></p>
            <p>Each red dot is <i>f</i>&thinsp;(<b>x</b>) for one region.
            Adjacent regions (differing in one <i>K<sub>j</sub></i>)
            map to vertices one <b>v</b><sub><i>j</i></sub> apart.</p>`,
    },
    {
        title: "Step 5 &mdash; Building Rhombs",
        html: `<p>At each intersection, four regions meet. Their
            <i>K</i>-tuples differ in exactly two coordinates
            (<i>j</i>&thinsp;and&thinsp;<i>k</i>), producing four
            <i>f</i>-values that form a parallelogram&thinsp;&mdash;&thinsp;a
            rhomb with unit sides
            <b>v</b><sub><i>j</i></sub> and
            <b>v</b><sub><i>k</i></sub>.</p>
            <p>The angle between the two directions determines the
            rhomb type:</p>
            <div class="legend">
                <span><span class="legend-swatch" style="background:${THICK_FILL}"></span>
                thick (72&deg;)</span>
                <span><span class="legend-swatch" style="background:${THIN_FILL}"></span>
                thin (36&deg;)</span>
            </div>
            <p>Families whose index difference is 1 (mod&nbsp;5) yield
            thick rhombs; difference 2 yields thin.</p>`,
    },
    {
        title: "Step 6 &mdash; Penrose Tiling",
        html: `<p>The complete dual is a <em>Penrose rhomb tiling</em>.</p>
            <div class="legend">
                <span><span class="legend-swatch" style="background:${THICK_FILL}"></span>
                thick</span>
                <span><span class="legend-swatch" style="background:${THIN_FILL}"></span>
                thin</span>
            </div>
            <p>Every &gamma; configuration satisfying
            &gamma;<sub>0</sub>&thinsp;+&thinsp;&middot;&middot;&middot;&thinsp;+&thinsp;&gamma;<sub>4</sub>&thinsp;=&thinsp;0
            produces a valid tiling.</p>
            <p>Moving the sliders translates the tiling continuously.
            At singular values where three lines become concurrent,
            the tiling undergoes <em>phason flips</em>&thinsp;&mdash;&thinsp;local
            rearrangements of tiles.</p>
            <p style="font-size:13px;color:#888;margin-top:24px;">
            N.&thinsp;G.&thinsp;de Bruijn, &ldquo;Algebraic theory of
            Penrose&rsquo;s non-periodic tilings of the plane,&rdquo;
            <i>Kon. Nederl. Akad. Wetensch. Proc.</i> <b>84</b>
            (1981).</p>`,
    },
];

// ── DOM elements ──────────────────────────────────────────────────

const controlsDiv = document.getElementById("controls")!;
const stepNavDiv = document.getElementById("step-nav")!;
const explanationDiv = document.getElementById("explanation")!;
const layerPanelDiv = document.getElementById("layer-panel")!;
const container = document.getElementById("canvas-container")!;

// Tooltip for K-tuple display
const tooltip = document.createElement("div");
tooltip.style.cssText = "position:fixed;padding:4px 8px;background:rgba(0,0,0,0.8);color:#fff;font:12px monospace;border-radius:3px;pointer-events:none;display:none;z-index:10;";
document.body.appendChild(tooltip);

// ── Layer infrastructure ──────────────────────────────────────────

interface Layer {
    id: string;
    label: string;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    zIndex: number;
    visible: boolean;
    userVisible: boolean;
    draw: () => void;
}

const layers = new Map<string, Layer>();

function addLayer(id: string, label: string, zIndex: number, drawFn: () => void): Layer {
    const c = document.createElement("canvas");
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    c.className = "layer-canvas";
    c.style.zIndex = String(zIndex);
    c.style.pointerEvents = "none";
    container.appendChild(c);
    const layer: Layer = {
        id, label,
        canvas: c,
        ctx: c.getContext("2d")!,
        zIndex,
        visible: true,
        userVisible: true,
        draw: drawFn,
    };
    layers.set(id, layer);
    return layer;
}

function drawAllLayers() {
    for (const [, layer] of layers) {
        if (layer.visible && layer.userVisible) {
            layer.canvas.style.display = "block";
            layer.draw();
        } else {
            layer.canvas.style.display = "none";
        }
    }
}

// Event-capture canvas (topmost, receives all input)
const eventCanvas = document.createElement("canvas");
eventCanvas.width = CANVAS_W;
eventCanvas.height = CANVAS_H;
eventCanvas.className = "layer-canvas";
eventCanvas.style.zIndex = "100";
eventCanvas.style.pointerEvents = "auto";
eventCanvas.style.cursor = "grab";
container.appendChild(eventCanvas);

// ── Create layers ─────────────────────────────────────────────────

// Background layer (K-regions pixel fill)
const bgLayer = addLayer("background", "K-regions", 5, () => {
    bgLayer.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (currentStep === 2) {
        drawKRegions(bgLayer.ctx, CANVAS_W / 2, CANVAS_H / 2);
    }
});

// Grid layers (one per family)
const gridLayers: Layer[] = [];
for (let j = 0; j < NUM_GRIDS; j++) {
    const layer = addLayer(`grid-${j}`, `Grid ${j}`, 10 + j, () => {
        layer.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawGridFamily(layer.ctx, j, CANVAS_W, CANVAS_H, CANVAS_W / 2, CANVAS_H / 2);
    });
    gridLayers.push(layer);
}

// Axes layer
const axesLayer = addLayer("axes", "Axes", 20, () => {
    axesLayer.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawAxes(axesLayer.ctx, CANVAS_W, CANVAS_H, CANVAS_W / 2, CANVAS_H / 2);
});

// Content layer (step-specific overlays: dots, rhombs, vertices, edge labels)
const contentLayer = addLayer("content", "Content", 50, () => {
    contentLayer.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const vis = getVisibleRect();
    switch (currentStep) {
        case 1:
            drawIntersectionDots(contentLayer.ctx, cx, cy, vis);
            break;
        case 2:
            drawKEdgeLabels(contentLayer.ctx, cx, cy);
            break;
        case 3: {
            const rhombs = collectRhombs(vis);
            drawDualVertices(contentLayer.ctx, rhombs, cx, cy);
            break;
        }
        case 4: {
            const rhombs = collectRhombs(vis);
            drawRhombs(contentLayer.ctx, rhombs, cx, cy, false);
            break;
        }
        case 5: {
            const rhombs = collectRhombs(vis);
            drawRhombs(contentLayer.ctx, rhombs, cx, cy, true);
            break;
        }
    }
});

// Highlight overlay canvas (for dual vertex hover on step 4)
const highlightCanvas = document.createElement("canvas");
highlightCanvas.width = CANVAS_W;
highlightCanvas.height = CANVAS_H;
highlightCanvas.className = "layer-canvas";
highlightCanvas.style.zIndex = "55";
highlightCanvas.style.pointerEvents = "none";
container.appendChild(highlightCanvas);
const highlightCtx = highlightCanvas.getContext("2d")!;

// ── Build slider controls ─────────────────────────────────────────

interface Dial {
    input: HTMLInputElement;
    display: HTMLSpanElement;
}

const dials: Dial[] = [];
for (let j = 0; j < NUM_GRIDS; j++) {
    const div = document.createElement("div");
    div.className = "dial";

    const label = document.createElement("label");
    label.innerHTML = `<span style="color:${COLORS[j]}">γ<sub>${j}</sub></span>`;
    label.style.cursor = "pointer";
    label.title = `Lock γ${j} (compute from others)`;
    label.addEventListener("click", () => setLockedIndex(j));

    const input = document.createElement("input");
    input.type = "range";
    input.min = "-2";
    input.max = "2";
    input.step = "0.01";
    input.value = "0";
    input.style.accentColor = COLORS[j];

    const display = document.createElement("span");
    display.className = "value";
    display.style.color = COLORS[j];
    display.textContent = "0.00";

    div.appendChild(label);
    div.appendChild(input);
    div.appendChild(display);
    controlsDiv.appendChild(div);

    dials.push({ input, display });
}

// Sum display
const sumSpan = document.createElement("div");
sumSpan.className = "sum-display";
sumSpan.textContent = "Σ = 0.00";
controlsDiv.appendChild(sumSpan);

// ── Build step navigation ─────────────────────────────────────────

const prevBtn = document.createElement("button");
prevBtn.textContent = "\u2190 Previous";

const stepIndicator = document.createElement("span");
stepIndicator.className = "step-indicator";

const nextBtn = document.createElement("button");
nextBtn.textContent = "Next \u2192";

stepNavDiv.appendChild(prevBtn);
stepNavDiv.appendChild(stepIndicator);
stepNavDiv.appendChild(nextBtn);

// ── Gamma / slider logic ──────────────────────────────────────────

function updateLockedGamma() {
    let sum = 0;
    for (let i = 0; i < NUM_GRIDS; i++) {
        if (i !== lockedIndex) sum += gamma[i];
    }
    gamma[lockedIndex] = -sum;
    dials[lockedIndex].input.value = gamma[lockedIndex].toFixed(2);
    dials[lockedIndex].display.textContent = gamma[lockedIndex].toFixed(2);
    const total = gamma.reduce((a, b) => a + b, 0);
    sumSpan.textContent = `Σ = ${total.toFixed(4)}`;
}

function setLockedIndex(j: number) {
    dials[lockedIndex].input.disabled = false;
    dials[lockedIndex].input.parentElement!.className = "dial";
    lockedIndex = j;
    dials[lockedIndex].input.disabled = true;
    dials[lockedIndex].input.parentElement!.className = "dial computed";
    updateLockedGamma();
    draw();
}

function onSliderChange(j: number) {
    if (j === lockedIndex) return;
    gamma[j] = parseFloat(dials[j].input.value);
    dials[j].display.textContent = gamma[j].toFixed(2);
    updateLockedGamma();
    draw();
}

for (let j = 0; j < NUM_GRIDS; j++) {
    dials[j].input.addEventListener("input", () => onSliderChange(j));
}

// Set initial locked slider
setLockedIndex(4);

// ── Step navigation logic ─────────────────────────────────────────

function updateStepUI() {
    stepIndicator.textContent = `Step ${currentStep + 1} of ${STEP_COUNT}`;
    prevBtn.disabled = currentStep === 0;
    nextBtn.disabled = currentStep === STEP_COUNT - 1;
    const step = stepContent[currentStep];
    explanationDiv.innerHTML = `<h3>${step.title}</h3>${step.html}`;
    tooltip.style.display = "none";
}

prevBtn.addEventListener("click", () => {
    if (currentStep > 0) { currentStep--; updateStepUI(); draw(); }
});
nextBtn.addEventListener("click", () => {
    if (currentStep < STEP_COUNT - 1) { currentStep++; updateStepUI(); draw(); }
});

// ── View transforms ───────────────────────────────────────────────

function mathToScreen(mx: number, my: number, cx: number, cy: number): [number, number] {
    return [cx + (mx - viewX) * scale, cy - (my - viewY) * scale];
}

function screenToMath(sx: number, sy: number, cx: number, cy: number): [number, number] {
    return [viewX + (sx - cx) / scale, viewY - (sy - cy) / scale];
}

interface ViewRect {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
}

function getVisibleRect(): ViewRect {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    return {
        xMin: viewX - (cx - MARGIN) / scale,
        xMax: viewX + (CANVAS_W - cx - MARGIN) / scale,
        yMin: viewY - (cy - MARGIN) / scale,
        yMax: viewY + (CANVAS_H - cy - MARGIN) / scale,
    };
}

// ── Pan & zoom ────────────────────────────────────────────────────

let isPanning = false;
let panLastX = 0;
let panLastY = 0;
let lastPinchDist = 0;

function zoomAtScreen(sx: number, sy: number, factor: number) {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const [mx, my] = screenToMath(sx, sy, cx, cy);
    scale = Math.max(10, Math.min(400, scale * factor));
    viewX = mx - (sx - cx) / scale;
    viewY = my + (sy - cy) / scale;
    draw();
}

// Mouse
eventCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.pow(2, -e.deltaY / 300);
    zoomAtScreen(e.offsetX, e.offsetY, factor);
}, { passive: false });

eventCanvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        isPanning = true;
        panLastX = e.offsetX;
        panLastY = e.offsetY;
        eventCanvas.style.cursor = "grabbing";
    }
});

eventCanvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    viewX -= (e.offsetX - panLastX) / scale;
    viewY += (e.offsetY - panLastY) / scale;
    panLastX = e.offsetX;
    panLastY = e.offsetY;
    draw();
});

eventCanvas.addEventListener("mouseup", endPan);
eventCanvas.addEventListener("mouseleave", endPan);

function endPan() {
    if (isPanning) {
        isPanning = false;
        eventCanvas.style.cursor = "grab";
    }
}

// Double-click to reset view
eventCanvas.addEventListener("dblclick", () => {
    scale = 60;
    viewX = 0;
    viewY = 0;
    draw();
});

// Touch
function touchDist(a: Touch, b: Touch): number {
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

eventCanvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isPanning = true;
        panLastX = e.touches[0].clientX;
        panLastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        isPanning = false;
        lastPinchDist = touchDist(e.touches[0], e.touches[1]);
    }
}, { passive: false });

eventCanvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
        const dx = e.touches[0].clientX - panLastX;
        const dy = e.touches[0].clientY - panLastY;
        viewX -= dx / scale;
        viewY += dy / scale;
        panLastX = e.touches[0].clientX;
        panLastY = e.touches[0].clientY;
        draw();
    } else if (e.touches.length === 2) {
        const dist = touchDist(e.touches[0], e.touches[1]);
        if (lastPinchDist > 0) {
            const rect = eventCanvas.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            zoomAtScreen(midX, midY, dist / lastPinchDist);
        }
        lastPinchDist = dist;
    }
}, { passive: false });

eventCanvas.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) {
        isPanning = false;
        lastPinchDist = 0;
    } else if (e.touches.length === 1) {
        isPanning = true;
        panLastX = e.touches[0].clientX;
        panLastY = e.touches[0].clientY;
        lastPinchDist = 0;
    }
});

// ── Math utilities ────────────────────────────────────────────────

function solveIntersection(
    j: number, k: number, nj: number, nk: number,
): [number, number] | null {
    const [cj, sj] = directions[j];
    const [ck, sk] = directions[k];
    const det = cj * sk - sj * ck;
    if (Math.abs(det) < 1e-10) return null;
    const rj = nj - gamma[j];
    const rk = nk - gamma[k];
    return [
        (sk * rj - sj * rk) / det,
        (cj * rk - ck * rj) / det,
    ];
}

interface Rhomb {
    vertices: [number, number][]; // 4 vertices in parallelogram order
    kTuples: number[][]; // K-tuple for each of the 4 vertices
    thick: boolean;
}

function computeRhomb(
    j: number, k: number, nj: number, nk: number,
    x0: number, y0: number,
): Rhomb {
    const baseK: number[] = [];
    let fx = 0, fy = 0;
    for (let i = 0; i < NUM_GRIDS; i++) {
        let Ki: number;
        if (i === j) Ki = nj;
        else if (i === k) Ki = nk;
        else {
            const dot = directions[i][0] * x0 + directions[i][1] * y0;
            Ki = Math.ceil(dot + gamma[i] - 1e-9);
        }
        baseK.push(Ki);
        fx += Ki * directions[i][0];
        fy += Ki * directions[i][1];
    }

    const [vjx, vjy] = directions[j];
    const [vkx, vky] = directions[k];

    const vertices: [number, number][] = [
        [fx, fy],
        [fx + vjx, fy + vjy],
        [fx + vjx + vkx, fy + vjy + vky],
        [fx + vkx, fy + vky],
    ];

    // K-tuples for each vertex: base, base+e_j, base+e_j+e_k, base+e_k
    const kTuples: number[][] = [
        baseK,
        baseK.map((v, i) => i === j ? v + 1 : v),
        baseK.map((v, i) => (i === j || i === k) ? v + 1 : v),
        baseK.map((v, i) => i === k ? v + 1 : v),
    ];

    const d = Math.min(k - j, 5 - (k - j));
    return { vertices, kTuples, thick: d === 1 };
}

function collectRhombs(vis: ViewRect): Rhomb[] {
    const rhombs: Rhomb[] = [];
    const maxCoord = Math.max(
        Math.abs(vis.xMin), Math.abs(vis.xMax),
        Math.abs(vis.yMin), Math.abs(vis.yMax),
    );
    const maxN = Math.min(Math.ceil(maxCoord) + 5, 50);
    const pad = 1.5;

    for (let j = 0; j < NUM_GRIDS; j++) {
        const layerJ = layers.get(`grid-${j}`);
        if (layerJ && !layerJ.userVisible) continue;
        for (let k = j + 1; k < NUM_GRIDS; k++) {
            const layerK = layers.get(`grid-${k}`);
            if (layerK && !layerK.userVisible) continue;
            for (let nj = -maxN; nj <= maxN; nj++) {
                for (let nk = -maxN; nk <= maxN; nk++) {
                    const pt = solveIntersection(j, k, nj, nk);
                    if (!pt) continue;
                    const rhomb = computeRhomb(j, k, nj, nk, pt[0], pt[1]);
                    let visible = false;
                    for (const [vx, vy] of rhomb.vertices) {
                        if (vx >= vis.xMin - pad && vx <= vis.xMax + pad &&
                            vy >= vis.yMin - pad && vy <= vis.yMax + pad) {
                            visible = true;
                            break;
                        }
                    }
                    if (visible) rhombs.push(rhomb);
                }
            }
        }
    }
    return rhombs;
}

// ── Drawing ───────────────────────────────────────────────────────

function drawAxes(tc: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number) {
    tc.save();

    const vis = getVisibleRect();
    const nxMin = Math.ceil(vis.xMin);
    const nxMax = Math.floor(vis.xMax);
    const nyMin = Math.ceil(vis.yMin);
    const nyMax = Math.floor(vis.yMax);

    tc.strokeStyle = "#999";
    tc.fillStyle = "#666";
    tc.lineWidth = 1;
    tc.font = "11px monospace";
    const tickLen = 5;

    // X axis ticks along bottom edge
    tc.textAlign = "center";
    tc.textBaseline = "top";
    const bottomY = h - MARGIN + 10;
    for (let n = nxMin; n <= nxMax; n++) {
        const [sx] = mathToScreen(n, 0, cx, cy);
        if (sx < MARGIN || sx > w - MARGIN) continue;
        tc.beginPath();
        tc.moveTo(sx, h - MARGIN);
        tc.lineTo(sx, h - MARGIN + tickLen);
        tc.stroke();
        tc.fillText(`${n}`, sx, bottomY);
    }
    tc.textAlign = "right";
    tc.fillText("x", w - MARGIN + 20, bottomY);

    // Y axis ticks along left edge
    tc.textAlign = "right";
    tc.textBaseline = "middle";
    for (let n = nyMin; n <= nyMax; n++) {
        const [, sy] = mathToScreen(0, n, cx, cy);
        if (sy < MARGIN || sy > h - MARGIN) continue;
        tc.beginPath();
        tc.moveTo(MARGIN - tickLen, sy);
        tc.lineTo(MARGIN, sy);
        tc.stroke();
        tc.fillText(`${n}`, MARGIN - tickLen - 2, sy);
    }
    tc.textBaseline = "bottom";
    tc.textAlign = "center";
    tc.fillText("y", MARGIN - tickLen - 2, MARGIN - 8);

    // Axis lines at x=0 and y=0
    tc.strokeStyle = "#bbb";
    tc.lineWidth = 0.5;

    const [zeroX] = mathToScreen(0, 0, cx, cy);
    const [, zeroY] = mathToScreen(0, 0, cx, cy);

    if (zeroY > MARGIN && zeroY < h - MARGIN) {
        tc.beginPath();
        tc.moveTo(MARGIN, zeroY);
        tc.lineTo(w - MARGIN, zeroY);
        tc.stroke();
    }
    if (zeroX > MARGIN && zeroX < w - MARGIN) {
        tc.beginPath();
        tc.moveTo(zeroX, MARGIN);
        tc.lineTo(zeroX, h - MARGIN);
        tc.stroke();
    }

    tc.restore();
}

function drawGridFamily(
    tc: CanvasRenderingContext2D,
    j: number,
    w: number, h: number,
    cx: number, cy: number,
) {
    const [vx, vy] = directions[j];
    const px = -vy;
    const py = vx;
    const extent = Math.sqrt(w * w + h * h) / 2;
    const vis = getVisibleRect();

    const corners = [
        [vis.xMin, vis.yMin], [vis.xMax, vis.yMin],
        [vis.xMin, vis.yMax], [vis.xMax, vis.yMax],
    ];
    let minDot = Infinity, maxDot = -Infinity;
    for (const [x, y] of corners) {
        const d = vx * x + vy * y;
        if (d < minDot) minDot = d;
        if (d > maxDot) maxDot = d;
    }
    const nLo = Math.floor(minDot + gamma[j]) - 1;
    const nHi = Math.ceil(maxDot + gamma[j]) + 1;

    tc.strokeStyle = COLORS[j];
    tc.lineWidth = currentStep === 2 ? 2 : 1;

    for (let n = nLo; n <= nHi; n++) {
        const c = n - gamma[j];
        const viewDot = vx * viewX + vy * viewY;
        const d = c - viewDot;
        const [ox, oy] = mathToScreen(viewX + d * vx, viewY + d * vy, cx, cy);

        const x1 = ox + px * extent;
        const y1 = oy - py * extent;
        const x2 = ox - px * extent;
        const y2 = oy + py * extent;

        tc.beginPath();
        tc.moveTo(x1, y1);
        tc.lineTo(x2, y2);
        tc.stroke();
    }
}

// Precompute blended colors for the 10 intersection pair types
function hexToRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const pairColors: Map<string, string> = new Map();
for (let j = 0; j < NUM_GRIDS; j++) {
    for (let k = j + 1; k < NUM_GRIDS; k++) {
        const [r1, g1, b1] = hexToRgb(COLORS[j]);
        const [r2, g2, b2] = hexToRgb(COLORS[k]);
        const r = Math.round((r1 + r2) / 2);
        const g = Math.round((g1 + g2) / 2);
        const b = Math.round((b1 + b2) / 2);
        pairColors.set(`${j},${k}`, `rgba(${r},${g},${b},0.55)`);
    }
}

function drawIntersectionDots(tc: CanvasRenderingContext2D, cx: number, cy: number, vis: ViewRect) {
    const maxCoord = Math.max(
        Math.abs(vis.xMin), Math.abs(vis.xMax),
        Math.abs(vis.yMin), Math.abs(vis.yMax),
    );
    const maxN = Math.min(Math.ceil(maxCoord) + 3, 50);

    for (let j = 0; j < NUM_GRIDS; j++) {
        const layerJ = layers.get(`grid-${j}`);
        if (layerJ && !layerJ.userVisible) continue;
        for (let k = j + 1; k < NUM_GRIDS; k++) {
            const layerK = layers.get(`grid-${k}`);
            if (layerK && !layerK.userVisible) continue;
            tc.fillStyle = pairColors.get(`${j},${k}`)!;
            for (let nj = -maxN; nj <= maxN; nj++) {
                for (let nk = -maxN; nk <= maxN; nk++) {
                    const pt = solveIntersection(j, k, nj, nk);
                    if (!pt) continue;
                    const [px, py] = pt;
                    if (px < vis.xMin || px > vis.xMax ||
                        py < vis.yMin || py > vis.yMax) continue;
                    const [sx, sy] = mathToScreen(px, py, cx, cy);
                    tc.beginPath();
                    tc.arc(sx, sy, 3, 0, 2 * Math.PI);
                    tc.fill();
                }
            }
        }
    }
}

/** Stored dual vertices for hover hit-testing on step 4 */
interface DualVertex {
    sx: number; sy: number; // screen coords
    mx: number; my: number; // math coords (dual space)
    K: number[];            // K-tuple that produced this vertex
}
let dualVertices: DualVertex[] = [];

/**
 * Draw the dual vertices f(x) = Σ Kⱼ(x)·vⱼ for each rhomb corner.
 * Deduplicates by rounding to avoid plotting the same vertex twice.
 *
 * @param tc - Target canvas rendering context
 * @param rhombs - Rhombs whose corners supply the dual vertices
 * @param cx - Screen x of the canvas center
 * @param cy - Screen y of the canvas center
 */
function drawDualVertices(tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number) {
    const seen = new Set<string>();
    dualVertices = [];
    tc.fillStyle = "#c0392b";
    for (const rhomb of rhombs) {
        for (let vi = 0; vi < rhomb.vertices.length; vi++) {
            const [vx, vy] = rhomb.vertices[vi];
            const key = `${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const [sx, sy] = mathToScreen(vx, vy, cx, cy);
            dualVertices.push({ sx, sy, mx: vx, my: vy, K: rhomb.kTuples[vi] });
            tc.beginPath();
            tc.arc(sx, sy, 3, 0, 2 * Math.PI);
            tc.fill();
        }
    }
}

function drawRhombs(tc: CanvasRenderingContext2D, rhombs: Rhomb[], cx: number, cy: number, fill: boolean) {
    for (const rhomb of rhombs) {
        const sv = rhomb.vertices.map(([vx, vy]) => mathToScreen(vx, vy, cx, cy));

        tc.beginPath();
        tc.moveTo(sv[0][0], sv[0][1]);
        tc.lineTo(sv[1][0], sv[1][1]);
        tc.lineTo(sv[2][0], sv[2][1]);
        tc.lineTo(sv[3][0], sv[3][1]);
        tc.closePath();

        if (fill) {
            tc.fillStyle = rhomb.thick ? THICK_FILL : THIN_FILL;
            tc.fill();
        }
        tc.strokeStyle = fill ? "#555" : "#999";
        tc.lineWidth = fill ? 1.5 : 1;
        tc.stroke();
    }
}

// ── K-region visualization ────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

function computeKTuple(mx: number, my: number): number[] {
    const K: number[] = [];
    for (let j = 0; j < NUM_GRIDS; j++) {
        const dot = directions[j][0] * mx + directions[j][1] * my;
        K.push(Math.ceil(dot + gamma[j] - 1e-9));
    }
    return K;
}

function drawKRegions(tc: CanvasRenderingContext2D, cx: number, cy: number) {
    const w = CANVAS_W;
    const h = CANVAS_H;
    const imgData = tc.createImageData(w, h);
    const data = imgData.data;

    for (let py = MARGIN; py < h - MARGIN; py++) {
        for (let px = MARGIN; px < w - MARGIN; px++) {
            const [mx, my] = screenToMath(px, py, cx, cy);
            const K = computeKTuple(mx, my);

            // Hash full K-tuple to a hue
            let hash = 0;
            for (let j = 0; j < NUM_GRIDS; j++) {
                hash = ((hash << 5) - hash + K[j] + 50) | 0;
            }
            const hue = (((hash * 137) % 360) + 360) % 360;
            const [r, g, b] = hslToRgb(hue, 0.45, 0.82);

            const idx = (py * w + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }

    tc.putImageData(imgData, 0, 0);
}

// ── K edge labels ─────────────────────────────────────────────────

function drawKEdgeLabels(tc: CanvasRenderingContext2D, cx: number, cy: number) {
    const w = CANVAS_W;
    const h = CANVAS_H;
    tc.font = "10px sans-serif";

    interface LabelInfo {
        x: number; y: number;
        text: string;
        color: string;
    }
    const labels: LabelInfo[] = [];

    // Pass 1: gradient-filled parallelograms, collect label positions
    for (let j = 0; j < NUM_GRIDS; j++) {
        const layer = layers.get(`grid-${j}`);
        if (layer && !layer.userVisible) continue;
        const [vx, vy] = directions[j];
        const [r, g, b] = hexToRgb(COLORS[j]);
        const colorStr = `rgba(${r},${g},${b},0.2)`;
        const clearStr = `rgba(${r},${g},${b},0)`;

        // --- Top & Bottom edges ---
        if (Math.abs(vx) > 1e-6) {
            for (const edge of [0, 1]) { // 0=top, 1=bottom
                const edgeSy = edge === 0 ? MARGIN : h - MARGIN;
                const outerY = edge === 0 ? 0 : h;
                const [, myEdge] = screenToMath(0, edgeSy, cx, cy);

                const [mxL] = screenToMath(MARGIN, edgeSy, cx, cy);
                const [mxR] = screenToMath(w - MARGIN, edgeSy, cx, cy);
                const dotL = vx * mxL + vy * myEdge + gamma[j];
                const dotR = vx * mxR + vy * myEdge + gamma[j];
                const nLo = Math.floor(Math.min(dotL, dotR)) - 1;
                const nHi = Math.ceil(Math.max(dotL, dotR)) + 1;

                const xs: number[] = [MARGIN];
                for (let n = nLo; n <= nHi; n++) {
                    const mx = (n - gamma[j] - vy * myEdge) / vx;
                    const sx = cx + (mx - viewX) * scale;
                    if (sx > MARGIN + 1 && sx < w - MARGIN - 1) xs.push(sx);
                }
                xs.push(w - MARGIN);
                xs.sort((a, b) => a - b);

                // Screen-x shift from inner edge to outer border along grid line
                const shift = edge === 0
                    ? -vy * MARGIN / vx
                    : vy * MARGIN / vx;

                // Gradient perpendicular to border
                const grad = edge === 0
                    ? tc.createLinearGradient(0, 0, 0, MARGIN)
                    : tc.createLinearGradient(0, h - MARGIN, 0, h);
                if (edge === 0) {
                    grad.addColorStop(0, clearStr);
                    grad.addColorStop(0.5, colorStr);
                    grad.addColorStop(1, colorStr);
                } else {
                    grad.addColorStop(0, colorStr);
                    grad.addColorStop(0.5, colorStr);
                    grad.addColorStop(1, clearStr);
                }

                const ly = edge === 0 ? MARGIN / 2 : h - MARGIN / 2;

                for (let i = 0; i < xs.length - 1; i++) {
                    const midX = (xs[i] + xs[i + 1]) / 2;
                    const stripW = xs[i + 1] - xs[i];

                    const probeSy = edge === 0 ? MARGIN + 2 : h - MARGIN - 2;
                    const [pmx, pmy] = screenToMath(midX, probeSy, cx, cy);
                    const K = Math.ceil(vx * pmx + vy * pmy + gamma[j] - 1e-9);

                    if (K < -1 || K > 1) continue;

                    // Fill parallelogram following grid line slope
                    tc.beginPath();
                    tc.moveTo(xs[i], edgeSy);
                    tc.lineTo(xs[i + 1], edgeSy);
                    tc.lineTo(xs[i + 1] + shift, outerY);
                    tc.lineTo(xs[i] + shift, outerY);
                    tc.closePath();
                    tc.fillStyle = grad;
                    tc.fill();

                    const label = `K${SUBSCRIPTS[j]}=${K}`;
                    const tw = tc.measureText(label).width;
                    if (stripW >= tw + 4) {
                        labels.push({
                            x: midX + shift / 2,
                            y: ly,
                            text: label,
                            color: COLORS[j],
                        });
                    }
                }
            }
        }

        // --- Left & Right edges ---
        if (Math.abs(vy) > 1e-6) {
            for (const edge of [0, 1]) { // 0=left, 1=right
                const edgeSx = edge === 0 ? MARGIN : w - MARGIN;
                const outerX = edge === 0 ? 0 : w;
                const [mxEdge] = screenToMath(edgeSx, 0, cx, cy);

                const [, myT] = screenToMath(edgeSx, MARGIN, cx, cy);
                const [, myB] = screenToMath(edgeSx, h - MARGIN, cx, cy);
                const dotT = vx * mxEdge + vy * myT + gamma[j];
                const dotB = vx * mxEdge + vy * myB + gamma[j];
                const nLo = Math.floor(Math.min(dotT, dotB)) - 1;
                const nHi = Math.ceil(Math.max(dotT, dotB)) + 1;

                const ys: number[] = [MARGIN];
                for (let n = nLo; n <= nHi; n++) {
                    const my = (n - gamma[j] - vx * mxEdge) / vy;
                    const sy = cy - (my - viewY) * scale;
                    if (sy > MARGIN + 1 && sy < h - MARGIN - 1) ys.push(sy);
                }
                ys.push(h - MARGIN);
                ys.sort((a, b) => a - b);

                // Screen-y shift from inner edge to outer border along grid line
                const shift = edge === 0
                    ? -vx * MARGIN / vy
                    : vx * MARGIN / vy;

                // Gradient perpendicular to border
                const grad = edge === 0
                    ? tc.createLinearGradient(0, 0, MARGIN, 0)
                    : tc.createLinearGradient(w - MARGIN, 0, w, 0);
                if (edge === 0) {
                    grad.addColorStop(0, clearStr);
                    grad.addColorStop(0.5, colorStr);
                    grad.addColorStop(1, colorStr);
                } else {
                    grad.addColorStop(0, colorStr);
                    grad.addColorStop(0.5, colorStr);
                    grad.addColorStop(1, clearStr);
                }

                const lx = edge === 0 ? MARGIN / 2 : w - MARGIN / 2;

                for (let i = 0; i < ys.length - 1; i++) {
                    const midY = (ys[i] + ys[i + 1]) / 2;
                    const stripH = ys[i + 1] - ys[i];

                    const probeSx = edge === 0 ? MARGIN + 2 : w - MARGIN - 2;
                    const [pmx, pmy] = screenToMath(probeSx, midY, cx, cy);
                    const K = Math.ceil(vx * pmx + vy * pmy + gamma[j] - 1e-9);

                    if (K < -1 || K > 1) continue;

                    // Fill parallelogram following grid line slope
                    tc.beginPath();
                    tc.moveTo(edgeSx, ys[i]);
                    tc.lineTo(edgeSx, ys[i + 1]);
                    tc.lineTo(outerX, ys[i + 1] + shift);
                    tc.lineTo(outerX, ys[i] + shift);
                    tc.closePath();
                    tc.fillStyle = grad;
                    tc.fill();

                    const label = `K${SUBSCRIPTS[j]}=${K}`;
                    const th = 12;
                    if (stripH >= th + 2) {
                        labels.push({
                            x: lx,
                            y: midY + shift / 2,
                            text: label,
                            color: COLORS[j],
                        });
                    }
                }
            }
        }
    }

    // Pass 2: draw all text labels on top of gradient fills
    tc.font = "10px sans-serif";
    tc.textAlign = "center";
    tc.textBaseline = "middle";
    for (const { x, y, text, color } of labels) {
        const tw = tc.measureText(text).width;
        tc.fillStyle = "rgba(255,255,255,0.7)";
        tc.fillRect(x - tw / 2 - 2, y - 6, tw + 4, 12);
        tc.fillStyle = color;
        tc.fillText(text, x, y);
    }
}

// ── Main draw ─────────────────────────────────────────────────────

function draw() {
    const gridAlphas = [0.6, 0.6, 0.4, 0.15, 0.15, 0];
    const alpha = gridAlphas[currentStep];

    // Set grid layer visibility and CSS opacity
    for (let j = 0; j < NUM_GRIDS; j++) {
        const layer = layers.get(`grid-${j}`)!;
        layer.visible = alpha > 0;
        layer.canvas.style.opacity = String(alpha);
    }

    // Background only on step 2
    layers.get("background")!.visible = currentStep === 2;

    // Axes always visible
    layers.get("axes")!.visible = true;

    // Content always drawn (draw function switches on step internally)
    layers.get("content")!.visible = true;

    drawAllLayers();
}

// ── Layer toggle UI ───────────────────────────────────────────────

function buildLayerPanel() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;gap:14px;align-items:center;margin:4px 0;flex-wrap:wrap;";

    const title = document.createElement("span");
    title.textContent = "Layers:";
    title.style.cssText = "font-size:12px;color:#888;";
    wrapper.appendChild(title);

    // Grid family toggles
    for (let j = 0; j < NUM_GRIDS; j++) {
        const layer = layers.get(`grid-${j}`)!;
        const label = document.createElement("label");
        label.className = "layer-toggle";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.addEventListener("change", () => {
            layer.userVisible = cb.checked;
            draw();
        });

        const swatch = document.createElement("span");
        swatch.className = "layer-swatch";
        swatch.style.background = COLORS[j];

        label.appendChild(cb);
        label.appendChild(swatch);
        label.appendChild(document.createTextNode(`${j}`));
        wrapper.appendChild(label);
    }

    // Axes toggle
    const axesLbl = document.createElement("label");
    axesLbl.className = "layer-toggle";
    const axesCb = document.createElement("input");
    axesCb.type = "checkbox";
    axesCb.checked = true;
    axesCb.addEventListener("change", () => {
        axesLayer.userVisible = axesCb.checked;
        draw();
    });
    axesLbl.appendChild(axesCb);
    axesLbl.appendChild(document.createTextNode("Axes"));
    wrapper.appendChild(axesLbl);

    layerPanelDiv.appendChild(wrapper);
}

// ── Tooltip / hover highlight ──────────────────────────────────────

function clearHighlight() {
    highlightCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
}

function formatKTooltip(K: number[]): string {
    const parts = K.map((v, j) => {
        const layer = layers.get(`grid-${j}`);
        const active = !layer || layer.userVisible;
        const color = active ? "#fff" : "#999";
        return `<span style="color:${color}">${v}</span>`;
    });
    const index = K.reduce((a, b) => a + b, 0);
    return `K[${index}] = {${parts.join(", ")}}`;
}

function highlightRegion(K: number[], cx: number, cy: number, dotSx: number, dotSy: number) {
    // Draw a filled polygon for the pentagrid region matching this K-tuple.
    // The region is the intersection of half-planes: K_j - 1 < x·v_j + γ_j ≤ K_j
    // We find the polygon by clipping against each strip.
    const vis = getVisibleRect();
    let poly: [number, number][] = [
        [vis.xMin, vis.yMin], [vis.xMax, vis.yMin],
        [vis.xMax, vis.yMax], [vis.xMin, vis.yMax],
    ];

    for (let j = 0; j < NUM_GRIDS; j++) {
        const [vx, vy] = directions[j];
        const lo = K[j] - 1 + 1e-9; // x·v + γ > K_j - 1
        const hi = K[j] + 1e-9;     // x·v + γ ≤ K_j
        poly = clipPoly(poly, vx, vy, gamma[j] - lo, true);
        poly = clipPoly(poly, -vx, -vy, -(gamma[j] - hi), true);
        if (poly.length === 0) break;
    }

    if (poly.length < 3) return;

    // Convert to screen and compute centroid + bounding size
    const screenPts = poly.map(([px, py]) => mathToScreen(px, py, cx, cy));
    let centX = 0, centY = 0;
    let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity;
    for (const [sx, sy] of screenPts) {
        centX += sx; centY += sy;
        if (sx < sxMin) sxMin = sx;
        if (sx > sxMax) sxMax = sx;
        if (sy < syMin) syMin = sy;
        if (sy > syMax) syMax = sy;
    }
    centX /= screenPts.length;
    centY /= screenPts.length;

    // Draw the region
    highlightCtx.fillStyle = "rgba(255, 255, 100, 0.35)";
    highlightCtx.strokeStyle = "rgba(255, 200, 0, 0.8)";
    highlightCtx.lineWidth = 2;
    highlightCtx.beginPath();
    highlightCtx.moveTo(screenPts[0][0], screenPts[0][1]);
    for (let i = 1; i < screenPts.length; i++) {
        highlightCtx.lineTo(screenPts[i][0], screenPts[i][1]);
    }
    highlightCtx.closePath();
    highlightCtx.fill();
    highlightCtx.stroke();

    // If the region is small, draw an arrow from the dot to its centroid
    const regionSize = Math.max(sxMax - sxMin, syMax - syMin);
    if (regionSize < 20) {
        const dx = centX - dotSx;
        const dy = centY - dotSy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
            const ux = dx / dist;
            const uy = dy / dist;
            // Arrow line from near the dot to near the centroid
            const startX = dotSx + ux * 8;
            const startY = dotSy + uy * 8;
            const endX = centX - ux * 4;
            const endY = centY - uy * 4;

            highlightCtx.strokeStyle = "rgba(255, 200, 0, 0.8)";
            highlightCtx.lineWidth = 1.5;
            highlightCtx.beginPath();
            highlightCtx.moveTo(startX, startY);
            highlightCtx.lineTo(endX, endY);
            highlightCtx.stroke();

            // Arrowhead
            const headLen = 7;
            const angle = Math.atan2(uy, ux);
            highlightCtx.beginPath();
            highlightCtx.moveTo(endX, endY);
            highlightCtx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
            highlightCtx.moveTo(endX, endY);
            highlightCtx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
            highlightCtx.stroke();
        }
    }
}

/** Clip polygon to the half-plane a*x + b*y + c ≥ 0 (or > 0 if strict, but we use ≥ for robustness) */
function clipPoly(poly: [number, number][], a: number, b: number, c: number, _strict: boolean): [number, number][] {
    if (poly.length === 0) return poly;
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
        const cur = poly[i];
        const next = poly[(i + 1) % poly.length];
        const dCur = a * cur[0] + b * cur[1] + c;
        const dNext = a * next[0] + b * next[1] + c;
        if (dCur >= 0) out.push(cur);
        if ((dCur >= 0) !== (dNext >= 0)) {
            const t = dCur / (dCur - dNext);
            out.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]);
        }
    }
    return out;
}

eventCanvas.addEventListener("mousemove", (e) => {
    if (isPanning) {
        tooltip.style.display = "none";
        clearHighlight();
        return;
    }

    const rect = eventCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < MARGIN || sx > CANVAS_W - MARGIN ||
        sy < MARGIN || sy > CANVAS_H - MARGIN) {
        tooltip.style.display = "none";
        clearHighlight();
        return;
    }

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    if (currentStep === 2) {
        // Step 3: show K-tuple at cursor and arrow to its dual vertex
        const [mx, my] = screenToMath(sx, sy, cx, cy);
        const K = computeKTuple(mx, my);
        tooltip.innerHTML = formatKTooltip(K);
        tooltip.style.display = "block";
        tooltip.style.left = (e.clientX + 12) + "px";
        tooltip.style.top = (e.clientY - 28) + "px";

        clearHighlight();

        // Derive dark version of the region's color
        let hash = 0;
        for (let j = 0; j < NUM_GRIDS; j++) {
            hash = ((hash << 5) - hash + K[j] + 50) | 0;
        }
        const hue = (((hash * 137) % 360) + 360) % 360;
        const [dr, dg, db] = hslToRgb(hue, 0.7, 0.35);
        const darkColor = `rgb(${dr},${dg},${db})`;

        // Compute dual vertex f = Σ K_j · v_j
        let fx = 0, fy = 0;
        for (let j = 0; j < NUM_GRIDS; j++) {
            fx += K[j] * directions[j][0];
            fy += K[j] * directions[j][1];
        }
        const [dsx, dsy] = mathToScreen(fx, fy, cx, cy);

        // Draw the dual point
        highlightCtx.fillStyle = darkColor;
        highlightCtx.beginPath();
        highlightCtx.arc(dsx, dsy, 3, 0, 2 * Math.PI);
        highlightCtx.fill();

        // Arrow from cursor to dual vertex
        const adx = dsx - sx;
        const ady = dsy - sy;
        const dist = Math.sqrt(adx * adx + ady * ady);
        if (dist > 15) {
            const ux = adx / dist;
            const uy = ady / dist;
            const startX = sx + ux * 6;
            const startY = sy + uy * 6;
            const endX = dsx - ux * 6;
            const endY = dsy - uy * 6;

            highlightCtx.strokeStyle = darkColor;
            highlightCtx.lineWidth = 1.5;
            highlightCtx.beginPath();
            highlightCtx.moveTo(startX, startY);
            highlightCtx.lineTo(endX, endY);
            highlightCtx.stroke();

            const headLen = 7;
            const angle = Math.atan2(uy, ux);
            highlightCtx.beginPath();
            highlightCtx.moveTo(endX, endY);
            highlightCtx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
            highlightCtx.moveTo(endX, endY);
            highlightCtx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
            highlightCtx.stroke();
        }
        return;
    }

    if (currentStep === 3) {
        // Step 4: find nearest dual vertex
        let best: DualVertex | null = null;
        let bestDist = 12; // pixel threshold
        for (const dv of dualVertices) {
            const dx = dv.sx - sx;
            const dy = dv.sy - sy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestDist) {
                bestDist = d;
                best = dv;
            }
        }

        clearHighlight();

        if (best) {
            // Equation: f = Σ K_j · v_j
            const terms = best.K.map((v, j) => {
                const layer = layers.get(`grid-${j}`);
                const active = !layer || layer.userVisible;
                const color = active ? "#fff" : "#999";
                return `<span style="color:${color}">${v}</span>&middot;v${SUBSCRIPTS[j]}`;
            });
            tooltip.innerHTML =
                formatKTooltip(best.K) +
                `<br><span style="color:#fc0">f</span> = ${terms.join(" + ")}`;
            tooltip.style.display = "block";
            tooltip.style.left = (e.clientX + 12) + "px";
            tooltip.style.top = (e.clientY - 28) + "px";

            // Highlight the hovered dot
            highlightCtx.fillStyle = "#fc0";
            highlightCtx.beginPath();
            highlightCtx.arc(best.sx, best.sy, 5, 0, 2 * Math.PI);
            highlightCtx.fill();

            // Highlight the source region in the pentagrid
            highlightRegion(best.K, cx, cy, best.sx, best.sy);
        } else {
            tooltip.style.display = "none";
        }
        return;
    }

    tooltip.style.display = "none";
    clearHighlight();
});

eventCanvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
    clearHighlight();
});

// ── Init ──────────────────────────────────────────────────────────

buildLayerPanel();
updateLockedGamma();
updateStepUI();
draw();
