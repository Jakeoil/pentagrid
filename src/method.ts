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

// State
const gamma = [0, 0, 0, 0, 0];
let currentStep = 0;
const STEP_COUNT = 5;
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
        title: "Step 3 &mdash; Dual Vertices",
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
        title: "Step 4 &mdash; Building Rhombs",
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
        title: "Step 5 &mdash; Penrose Tiling",
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

// ── Main draw ─────────────────────────────────────────────────────

function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    drawAxes(w, h, cx, cy);

    const vis = getVisibleRect();

    switch (currentStep) {
        case 0:
            drawPentagrid(cx, cy, 0.6);
            break;

        case 1:
            drawPentagrid(cx, cy, 0.6);
            drawIntersectionDots(cx, cy, vis);
            break;

        case 2: {
            drawPentagrid(cx, cy, 0.15);
            const rhombs = collectRhombs(vis);
            drawDualVertices(rhombs, cx, cy);
            break;
        }

        case 3: {
            drawPentagrid(cx, cy, 0.15);
            const rhombs = collectRhombs(vis);
            drawRhombs(rhombs, cx, cy, false);
            break;
        }

        case 4: {
            const rhombs = collectRhombs(vis);
            drawRhombs(rhombs, cx, cy, true);
            break;
        }
    }
}

// ── Init ──────────────────────────────────────────────────────────

updateLockedGamma();
updateStepUI();
draw();
