/**
 * π(C^k) on a screen: the golden zonohedra, turned, exploded and cut.
 *
 * PLAN §8. The mathematics is in `geometry/zono3.ts` and this draws it —
 * container rules as everywhere else (§4.1): own the canvas, take a config,
 * hand back a handle, and keep the geometry out of it.
 *
 * **Explode pulls the FACES apart, not cells.** The cell dissection is a
 * harder object and is its own step; what this page can already say, and say
 * better than a sentence, is that every face of every rung is the SAME golden
 * rhomb. Pull thirty rhombs off a triacontahedron, twenty off an icosahedron,
 * six off a rhombohedron, and they are one shape — which is the k = 2 rung of
 * the ladder, seen from the solids above it. Each face travels along its own
 * outward normal, so zero reassembles exactly.
 *
 * **Cut is a clipping plane**, which is the thing a painter's algorithm cannot
 * do at all and the reason three.js is here: you can sort faces back to front,
 * but you cannot sort the half of a face that survives a cut.
 *
 * **Color is by the generator PAIR** a face is spanned by — which is the same
 * "bands" idea the tiles use in the plane, and wieringa-roof uses on its own
 * cells. With six axes there are fifteen pairs, so a face's color says which
 * two zones made it.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ICO_AXES, maskPoint, zonohedron } from "../geometry/zono3.js";
import type { Vec3, Zonohedron } from "../geometry/zono3.js";

export interface Zono3dState {
    /** How many generators: 0 is a point, 6 the triacontahedron. */
    k: number;
    /** 0 assembled, 1 fully apart. */
    explode: number;
    /** Where the clipping plane sits, 1 for no cut at all. */
    cut: number;
    /** Turn it slowly on its own. */
    spin: boolean;
    /** Draw the edges over the faces. */
    edges: boolean;
}

export interface Zono3dConfig {
    container: HTMLElement;
    state?: Partial<Zono3dState>;
}

export interface Zono3dHandle {
    state: Zono3dState;
    set(s: Partial<Zono3dState>): void;
    /** What is on screen now, for a readout or a test. */
    counts(): { k: number; vertices: number; faces: number; edges: number };
    dispose(): void;
}

const DEFAULTS: Zono3dState = { k: 6, explode: 0, cut: 1, spin: false, edges: true };

/**
 * Fifteen pair colors, one per unordered pair of the six axes.
 *
 * Hue by the pair's lower axis so the five faces sharing an axis read as a
 * family, lightness by how far apart the two are — which is the same grammar
 * the plane's band colors use.
 */
function pairColor(i: number, j: number): THREE.Color {
    const hue = (i / 6 + 0.04) % 1;
    const gap = Math.min(Math.abs(j - i), 6 - Math.abs(j - i));
    return new THREE.Color().setHSL(hue, 0.55, 0.40 + 0.12 * gap);
}

export function createZono3d(config: Zono3dConfig): Zono3dHandle {
    const state: Zono3dState = { ...DEFAULTS, ...config.state };
    const host = config.container;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Clipping is off by default in three; the cut needs it on globally.
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(4.2, 2.6, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;

    // Flat and matte, so a face reads as a face. This is a diagram, not a
    // scene: one key light, one fill, and enough ambient that nothing goes
    // black when it turns away.
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(5, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.7);
    fill.position.set(-6, -3, -4);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    /** The one clipping plane the cut drives. Normal +x, moved by `cut`. */
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);

    let solid: Zonohedron = zonohedron(ICO_AXES.slice(0, state.k));
    /** Per face: its mesh, its center offset, and the outward direction. */
    let pieces: { mesh: THREE.Mesh; home: THREE.Vector3; out: THREE.Vector3 }[] = [];
    let wire: THREE.LineSegments | null = null;

    const centerOf = (z: Zonohedron) => {
        // A zonotope's center is half the sum of its generators.
        const c = new THREE.Vector3();
        for (const g of z.gens) c.add(new THREE.Vector3(g[0], g[1], g[2]));
        return c.multiplyScalar(0.5);
    };

    function build() {
        for (const p of pieces) {
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
            root.remove(p.mesh);
        }
        pieces = [];
        if (wire) { wire.geometry.dispose(); root.remove(wire); wire = null; }

        solid = zonohedron(ICO_AXES.slice(0, state.k));
        const mid = centerOf(solid);
        const gens = solid.gens;

        for (const f of solid.faces) {
            const pts = f.masks.map((m) => maskPoint(gens, m as number));
            const geo = new THREE.BufferGeometry();
            // Two triangles, 0-1-2 and 0-2-3, round the rhomb.
            const v: number[] = [];
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
                for (const i of [a, b, c]) v.push(pts[i][0], pts[i][1], pts[i][2]);
            }
            geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
                color: pairColor(f.pair[0], f.pair[1]),
                roughness: 0.85,
                metalness: 0,
                side: THREE.DoubleSide,
                clippingPlanes: [plane],
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const home = new THREE.Vector3();
            for (const p of pts) home.add(new THREE.Vector3(p[0], p[1], p[2]));
            home.multiplyScalar(0.25).sub(mid);
            pieces.push({ mesh, home, out: home.clone().normalize() });
            root.add(mesh);
        }

        const seg: number[] = [];
        for (const [a, b] of solid.edges) {
            const p = maskPoint(gens, a), q = maskPoint(gens, b);
            seg.push(p[0], p[1], p[2], q[0], q[1], q[2]);
        }
        const wg = new THREE.BufferGeometry();
        wg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
        wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({
            color: 0x1b1b22, transparent: true, opacity: 0.55, clippingPlanes: [plane],
        }));
        root.add(wire);
        root.position.set(-mid.x, -mid.y, -mid.z);
        place();
    }

    /** Where each face sits at the current explode, and how solid it looks. */
    function place() {
        const t = state.explode;
        for (const p of pieces) {
            p.mesh.position.copy(p.out).multiplyScalar(t * 2.2);
            // Assembled, the faces are the surface and want to be opaque.
            // Apart, they are specimens and want to be seen through.
            (p.mesh.material as THREE.MeshStandardMaterial).opacity = 1 - 0.35 * t;
        }
        if (wire) wire.visible = state.edges && t < 0.02;
        plane.constant = state.cut >= 1 ? 100 : -2.6 + state.cut * 5.2;
    }

    function resize() {
        const w = host.clientWidth || 600, h = host.clientHeight || 420;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let alive = true;
    let last = 0;
    function frame(now: number) {
        if (!alive) return;
        const dt = last ? (now - last) / 1000 : 0;
        last = now;
        if (state.spin) root.rotation.y += dt * 0.35;
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    build();
    requestAnimationFrame(frame);

    return {
        state,
        set(s) {
            const rebuild = s.k !== undefined && s.k !== state.k;
            Object.assign(state, s);
            if (rebuild) build(); else place();
        },
        counts: () => ({
            k: state.k,
            vertices: solid.vertexMasks.length,
            faces: solid.faces.length,
            edges: solid.edges.length,
        }),
        dispose() {
            alive = false;
            ro.disconnect();
            controls.dispose();
            renderer.dispose();
            host.removeChild(renderer.domElement);
        },
    };
}

/** Re-exported so a page need not reach into geometry for the axis count. */
export const MAX_K = ICO_AXES.length;
export type { Vec3 };
