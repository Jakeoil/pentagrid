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
const canvas = document.getElementById("pentagrid") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// Tooltip for K-tuple display
const tooltip = document.createElement("div");
tooltip.style.cssText = "position:fixed;padding:4px 8px;background:rgba(0,0,0,0.8);color:#fff;font:12px monospace;border-radius:3px;pointer-events:none;display:none;z-index:10;";
document.body.appendChild(tooltip);

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
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return {
        xMin: viewX - (cx - MARGIN) / scale,
        xMax: viewX + (canvas.width - cx - MARGIN) / scale,
        yMin: viewY - (cy - MARGIN) / scale,
        yMax: viewY + (canvas.height - cy - MARGIN) / scale,
    };
}

// ── Pan & zoom ────────────────────────────────────────────────────

let isPanning = false;
let panLastX = 0;
let panLastY = 0;
let lastPinchDist = 0;

function zoomAtScreen(sx: number, sy: number, factor: number) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const [mx, my] = screenToMath(sx, sy, cx, cy);
    scale = Math.max(10, Math.min(400, scale * factor));
    viewX = mx - (sx - cx) / scale;
    viewY = my + (sy - cy) / scale;
    draw();
}

// Mouse
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = Math.pow(2, -e.deltaY / 300);
    zoomAtScreen(e.offsetX, e.offsetY, factor);
}, { passive: false });

canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        isPanning = true;
        panLastX = e.offsetX;
        panLastY = e.offsetY;
        canvas.style.cursor = "grabbing";
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    viewX -= (e.offsetX - panLastX) / scale;
    viewY += (e.offsetY - panLastY) / scale;
    panLastX = e.offsetX;
    panLastY = e.offsetY;
    draw();
});

canvas.addEventListener("mouseup", endPan);
canvas.addEventListener("mouseleave", endPan);

function endPan() {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = "grab";
    }
}

// Double-click to reset view
canvas.addEventListener("dblclick", () => {
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

canvas.addEventListener("touchstart", (e) => {
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

canvas.addEventListener("touchmove", (e) => {
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
            const rect = canvas.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
            zoomAtScreen(midX, midY, dist / lastPinchDist);
        }
        lastPinchDist = dist;
    }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
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
    thick: boolean;
}

function computeRhomb(
    j: number, k: number, nj: number, nk: number,
    x0: number, y0: number,
): Rhomb {
    let fx = 0, fy = 0;
    for (let i = 0; i < NUM_GRIDS; i++) {
        let Ki: number;
        if (i === j) Ki = nj;
        else if (i === k) Ki = nk;
        else {
            const dot = directions[i][0] * x0 + directions[i][1] * y0;
            Ki = Math.ceil(dot + gamma[i] - 1e-9);
        }
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

    const d = Math.min(k - j, 5 - (k - j));
    return { vertices, thick: d === 1 };
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
        for (let k = j + 1; k < NUM_GRIDS; k++) {
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

function drawAxes(w: number, h: number, cx: number, cy: number) {
    ctx.save();

    const vis = getVisibleRect();
    const nxMin = Math.ceil(vis.xMin);
    const nxMax = Math.floor(vis.xMax);
    const nyMin = Math.ceil(vis.yMin);
    const nyMax = Math.floor(vis.yMax);

    ctx.strokeStyle = "#999";
    ctx.fillStyle = "#666";
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    const tickLen = 5;

    // X axis ticks along bottom edge
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const bottomY = h - MARGIN + 10;
    for (let n = nxMin; n <= nxMax; n++) {
        const [sx] = mathToScreen(n, 0, cx, cy);
        if (sx < MARGIN || sx > w - MARGIN) continue;
        ctx.beginPath();
        ctx.moveTo(sx, h - MARGIN);
        ctx.lineTo(sx, h - MARGIN + tickLen);
        ctx.stroke();
        ctx.fillText(`${n}`, sx, bottomY);
    }
    ctx.textAlign = "right";
    ctx.fillText("x", w - MARGIN + 20, bottomY);

    // Y axis ticks along left edge
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let n = nyMin; n <= nyMax; n++) {
        const [, sy] = mathToScreen(0, n, cx, cy);
        if (sy < MARGIN || sy > h - MARGIN) continue;
        ctx.beginPath();
        ctx.moveTo(MARGIN - tickLen, sy);
        ctx.lineTo(MARGIN, sy);
        ctx.stroke();
        ctx.fillText(`${n}`, MARGIN - tickLen - 2, sy);
    }
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    ctx.fillText("y", MARGIN - tickLen - 2, MARGIN - 8);

    // Axis lines at x=0 and y=0
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 0.5;

    const [zeroX] = mathToScreen(0, 0, cx, cy);
    const [, zeroY] = mathToScreen(0, 0, cx, cy);

    if (zeroY > MARGIN && zeroY < h - MARGIN) {
        ctx.beginPath();
        ctx.moveTo(MARGIN, zeroY);
        ctx.lineTo(w - MARGIN, zeroY);
        ctx.stroke();
    }
    if (zeroX > MARGIN && zeroX < w - MARGIN) {
        ctx.beginPath();
        ctx.moveTo(zeroX, MARGIN);
        ctx.lineTo(zeroX, h - MARGIN);
        ctx.stroke();
    }

    ctx.restore();
}

function drawPentagrid(cx: number, cy: number, alpha: number) {
    const w = canvas.width;
    const h = canvas.height;
    const extent = Math.sqrt(w * w + h * h) / 2;
    const vis = getVisibleRect();

    for (let j = 0; j < NUM_GRIDS; j++) {
        const [vx, vy] = directions[j];
        const px = -vy;
        const py = vx;

        // Compute range of n for this family in the visible area
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

        ctx.strokeStyle = COLORS[j];
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha;

        for (let n = nLo; n <= nHi; n++) {
            const c = n - gamma[j];
            // Anchor at closest point on line to view center (not origin)
            const viewDot = vx * viewX + vy * viewY;
            const d = c - viewDot;
            const [ox, oy] = mathToScreen(viewX + d * vx, viewY + d * vy, cx, cy);

            const x1 = ox + px * extent;
            const y1 = oy - py * extent;
            const x2 = ox - px * extent;
            const y2 = oy + py * extent;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }
    ctx.globalAlpha = 1.0;
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

function drawIntersectionDots(cx: number, cy: number, vis: ViewRect) {
    const maxCoord = Math.max(
        Math.abs(vis.xMin), Math.abs(vis.xMax),
        Math.abs(vis.yMin), Math.abs(vis.yMax),
    );
    const maxN = Math.min(Math.ceil(maxCoord) + 3, 50);

    for (let j = 0; j < NUM_GRIDS; j++) {
        for (let k = j + 1; k < NUM_GRIDS; k++) {
            ctx.fillStyle = pairColors.get(`${j},${k}`)!;
            for (let nj = -maxN; nj <= maxN; nj++) {
                for (let nk = -maxN; nk <= maxN; nk++) {
                    const pt = solveIntersection(j, k, nj, nk);
                    if (!pt) continue;
                    const [px, py] = pt;
                    if (px < vis.xMin || px > vis.xMax ||
                        py < vis.yMin || py > vis.yMax) continue;
                    const [sx, sy] = mathToScreen(px, py, cx, cy);
                    ctx.beginPath();
                    ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    }
}

function drawDualVertices(rhombs: Rhomb[], cx: number, cy: number) {
    const seen = new Set<string>();
    ctx.fillStyle = "#c0392b";
    for (const rhomb of rhombs) {
        for (const [vx, vy] of rhomb.vertices) {
            const key = `${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const [sx, sy] = mathToScreen(vx, vy, cx, cy);
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawRhombs(rhombs: Rhomb[], cx: number, cy: number, fill: boolean) {
    for (const rhomb of rhombs) {
        const sv = rhomb.vertices.map(([vx, vy]) => mathToScreen(vx, vy, cx, cy));

        ctx.beginPath();
        ctx.moveTo(sv[0][0], sv[0][1]);
        ctx.lineTo(sv[1][0], sv[1][1]);
        ctx.lineTo(sv[2][0], sv[2][1]);
        ctx.lineTo(sv[3][0], sv[3][1]);
        ctx.closePath();

        if (fill) {
            ctx.fillStyle = rhomb.thick ? THICK_FILL : THIN_FILL;
            ctx.fill();
        }
        ctx.strokeStyle = fill ? "#555" : "#999";
        ctx.lineWidth = fill ? 1.5 : 1;
        ctx.stroke();
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

function drawKRegions(cx: number, cy: number) {
    const w = canvas.width;
    const h = canvas.height;
    const cellSize = 5;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let cellY = MARGIN; cellY < h - MARGIN; cellY += cellSize) {
        for (let cellX = MARGIN; cellX < w - MARGIN; cellX += cellSize) {
            const [mx, my] = screenToMath(
                cellX + cellSize / 2, cellY + cellSize / 2, cx, cy,
            );
            const K = computeKTuple(mx, my);

            // Hash K-tuple to a hue
            let hash = 0;
            for (let j = 0; j < NUM_GRIDS; j++) {
                hash = ((hash << 5) - hash + K[j] + 50) | 0;
            }
            const hue = (((hash * 137) % 360) + 360) % 360;
            const [r, g, b] = hslToRgb(hue, 0.45, 0.82);

            const maxDy = Math.min(cellSize, h - MARGIN - cellY);
            const maxDx = Math.min(cellSize, w - MARGIN - cellX);
            for (let dy = 0; dy < maxDy; dy++) {
                for (let dx = 0; dx < maxDx; dx++) {
                    const idx = ((cellY + dy) * w + (cellX + dx)) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

function drawKLabels(cx: number, cy: number) {
    const w = canvas.width;
    const h = canvas.height;
    const spacing = 110;

    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let sy = MARGIN + spacing / 2; sy < h - MARGIN; sy += spacing) {
        for (let sx = MARGIN + spacing / 2; sx < w - MARGIN; sx += spacing) {
            const [mx, my] = screenToMath(sx, sy, cx, cy);

            // Skip if too close to any grid line
            let minFrac = 1;
            for (let j = 0; j < NUM_GRIDS; j++) {
                const dot = directions[j][0] * mx + directions[j][1] * my + gamma[j];
                const frac = Math.abs(dot - Math.round(dot));
                if (frac < minFrac) minFrac = frac;
            }
            if (minFrac < 0.15) continue;

            const K = computeKTuple(mx, my);
            const label = `(${K.join(",")})`;

            // White background for readability
            const metrics = ctx.measureText(label);
            const pad = 2;
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.fillRect(
                sx - metrics.width / 2 - pad,
                sy - 6 - pad,
                metrics.width + pad * 2,
                12 + pad * 2,
            );

            ctx.fillStyle = "#333";
            ctx.fillText(label, sx, sy);
        }
    }
}

// ── K edge labels ─────────────────────────────────────────────────

function drawKEdgeLabels(cx: number, cy: number) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.font = "10px sans-serif";

    interface LabelInfo {
        x: number; y: number;
        text: string;
        color: string;
    }
    const labels: LabelInfo[] = [];

    // Pass 1: gradient-filled parallelograms, collect label positions
    for (let j = 0; j < NUM_GRIDS; j++) {
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
                    ? ctx.createLinearGradient(0, 0, 0, MARGIN)
                    : ctx.createLinearGradient(0, h - MARGIN, 0, h);
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
                    ctx.beginPath();
                    ctx.moveTo(xs[i], edgeSy);
                    ctx.lineTo(xs[i + 1], edgeSy);
                    ctx.lineTo(xs[i + 1] + shift, outerY);
                    ctx.lineTo(xs[i] + shift, outerY);
                    ctx.closePath();
                    ctx.fillStyle = grad;
                    ctx.fill();

                    const label = `K${SUBSCRIPTS[j]}=${K}`;
                    const tw = ctx.measureText(label).width;
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
                    ? ctx.createLinearGradient(0, 0, MARGIN, 0)
                    : ctx.createLinearGradient(w - MARGIN, 0, w, 0);
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
                    ctx.beginPath();
                    ctx.moveTo(edgeSx, ys[i]);
                    ctx.lineTo(edgeSx, ys[i + 1]);
                    ctx.lineTo(outerX, ys[i + 1] + shift);
                    ctx.lineTo(outerX, ys[i] + shift);
                    ctx.closePath();
                    ctx.fillStyle = grad;
                    ctx.fill();

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
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const { x, y, text, color } of labels) {
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(x - tw / 2 - 2, y - 6, tw + 4, 12);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }
}

// ── Main draw ─────────────────────────────────────────────────────

function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const vis = getVisibleRect();

    switch (currentStep) {
        case 0:
            drawAxes(w, h, cx, cy);
            drawPentagrid(cx, cy, 0.6);
            break;

        case 1:
            drawAxes(w, h, cx, cy);
            drawPentagrid(cx, cy, 0.6);
            drawIntersectionDots(cx, cy, vis);
            break;

        case 2:
            drawKRegions(cx, cy);
            drawAxes(w, h, cx, cy);
            drawPentagrid(cx, cy, 0.4);
            drawKEdgeLabels(cx, cy);
            break;

        case 3: {
            drawAxes(w, h, cx, cy);
            drawPentagrid(cx, cy, 0.15);
            const rhombs = collectRhombs(vis);
            drawDualVertices(rhombs, cx, cy);
            break;
        }

        case 4: {
            drawAxes(w, h, cx, cy);
            drawPentagrid(cx, cy, 0.15);
            const rhombs = collectRhombs(vis);
            drawRhombs(rhombs, cx, cy, false);
            break;
        }

        case 5: {
            drawAxes(w, h, cx, cy);
            const rhombs = collectRhombs(vis);
            drawRhombs(rhombs, cx, cy, true);
            break;
        }
    }
}

// ── Init ──────────────────────────────────────────────────────────

// ── Tooltip for K-tuple on step 3 ─────────────────────────────────

canvas.addEventListener("mousemove", (e) => {
    if (currentStep !== 2 || isPanning) {
        tooltip.style.display = "none";
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (sx < MARGIN || sx > canvas.width - MARGIN ||
        sy < MARGIN || sy > canvas.height - MARGIN) {
        tooltip.style.display = "none";
        return;
    }
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const [mx, my] = screenToMath(sx, sy, cx, cy);
    const K = computeKTuple(mx, my);
    tooltip.textContent = `(K₀,K₁,K₂,K₃,K₄) = (${K.join(", ")})`;
    tooltip.style.display = "block";
    tooltip.style.left = (e.clientX + 12) + "px";
    tooltip.style.top = (e.clientY - 28) + "px";
});

canvas.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
});

// ── Init ──────────────────────────────────────────────────────────

updateLockedGamma();
updateStepUI();
draw();
