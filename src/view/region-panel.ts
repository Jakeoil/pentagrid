// A canvas showing a convex region and a point you can drag around inside it.
//
// Small, but it is a canvas with its own interaction, so it gets a container of
// its own rather than living in a page. Nothing here knows about pentagrids: a
// polygon, a point, and a callback.

import { pointInPolygon } from "../geometry/acceptance.js";
import type { Vec2 } from "../geometry/types.js";

export interface RegionPanelConfig {
    container: HTMLElement;
    size?: number;
    /** World units across the shorter side. */
    span?: number;
    /** The point was dragged to here. */
    onMove?: (x: number, y: number) => void;
    fill?: string;
    stroke?: string;
}

export interface RegionPanelHandle {
    element: HTMLCanvasElement;
    setRegion: (poly: readonly Vec2[]) => void;
    setPoint: (x: number, y: number) => void;
    getPoint: () => Vec2;
    inside: () => boolean;
    redraw: () => void;
}

export function createRegionPanel(config: RegionPanelConfig): RegionPanelHandle {
    const size = config.size ?? 400;
    const span = config.span ?? 3.2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.className = "region-panel";
    canvas.style.display = "block";
    canvas.style.background = "#fff";
    canvas.style.cursor = "crosshair";
    config.container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    let poly: readonly Vec2[] = [];
    let point: Vec2 = [0, 0];
    const scale = () => size / span;

    const toScreen = (x: number, y: number): Vec2 =>
        [size / 2 + x * scale(), size / 2 - y * scale()];
    const fromScreen = (sx: number, sy: number): Vec2 =>
        [(sx - size / 2) / scale(), -(sy - size / 2) / scale()];

    function redraw() {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
        ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
        ctx.stroke();

        if (poly.length > 2) {
            ctx.beginPath();
            poly.forEach(([x, y], i) => {
                const [sx, sy] = toScreen(x, y);
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            });
            ctx.closePath();
            ctx.fillStyle = config.fill ?? "rgba(69, 123, 157, 0.18)";
            ctx.fill();
            ctx.strokeStyle = config.stroke ?? "#457b9d";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        const [dx, dy] = toScreen(point[0], point[1]);
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = pointInPolygon(poly, point[0], point[1]) ? "#e63946" : "#999";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    let dragging = false;
    const move = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        point = fromScreen(e.clientX - r.left, e.clientY - r.top);
        config.onMove?.(point[0], point[1]);
        redraw();
    };
    canvas.addEventListener("mousedown", (e) => { dragging = true; move(e); });
    canvas.addEventListener("mousemove", (e) => { if (dragging) move(e); });
    window.addEventListener("mouseup", () => { dragging = false; });

    redraw();

    return {
        element: canvas,
        setRegion: (p) => { poly = p; redraw(); },
        setPoint: (x, y) => { point = [x, y]; redraw(); },
        getPoint: () => [point[0], point[1]],
        inside: () => pointInPolygon(poly, point[0], point[1]),
        redraw,
    };
}
