/**
 * π(C^k) on a screen: the golden zonohedra, turned, exploded and cut.
 *
 * PLAN §8. The mathematics is in `geometry/zono3.ts` and this draws it —
 * container rules as everywhere else (§4.1): own the canvas, take a config,
 * hand back a handle, and keep the geometry out of it.
 *
 * **The solid is chosen by name, not by k.** The ladder has seven rungs and
 * eight entries, because k = 3 is two solids and not one: a triple of axes is
 * a chain or an equilateral triangle, and those are the oblate O6 and the
 * acute A6. A dropdown of Coxeter's short names says that where a slider on k
 * would hide it.
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
 * **Two colorings, and they say different things.** A face takes the PAIR of
 * axes that spans it — the bands grammar the tiles use in the plane, so a face
 * says which two zones made it. A stick takes the ONE axis it runs along, six
 * colors, which is Zometool's own convention and the reason Dietl's figure 35
 * reads at a glance.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ICO_AXES, maskPoint, zonohedron } from "../geometry/zono3.js";
import type { Vec3, Zonohedron } from "../geometry/zono3.js";

/** The ladder, by name. `gens` indexes ICO_AXES. */
export const SOLIDS = [
    { key: "point", label: "point", gens: [] as number[] },
    { key: "edge", label: "edge", gens: [0] },
    { key: "rhomb", label: "rhomb", gens: [0, 1] },
    // 012 is a chain of axes and 013 an equilateral triangle — the two orbits,
    // measured oblate and acute, volumes 0.470228 and 0.760845, ratio φ.
    { key: "O6", label: "O6 — oblate", gens: [0, 1, 2] },
    { key: "A6", label: "A6 — acute", gens: [0, 1, 3] },
    { key: "B12", label: "B12 — Bilinski", gens: [0, 1, 2, 3] },
    { key: "F20", label: "F20 — Fedorov", gens: [0, 1, 2, 3, 4] },
    { key: "K30", label: "K30 — Kepler", gens: [0, 1, 2, 3, 4, 5] },
] as const;

export type SolidKey = typeof SOLIDS[number]["key"];
export type EdgeStyle = "none" | "thin" | "zome";
export type FaceStyle = "none" | "transparent" | "solid";

export interface Zono3dState {
    /** Which rung, by name. */
    solid: SolidKey;
    /** 0 assembled, 1 fully apart. */
    explode: number;
    /** Where the clipping plane sits, 1 for no cut at all. */
    cut: number;
    /** Turn it slowly on its own. */
    spin: boolean;
    /** none, a hairline, or balls and colored sticks. */
    edges: EdgeStyle;
    /** none, see-through, or opaque. */
    faces: FaceStyle;
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

const DEFAULTS: Zono3dState = {
    solid: "K30", explode: 0, cut: 1, spin: false, edges: "thin", faces: "solid",
};
const BALL = 0.055, STICK = 0.028;

/**
 * Fifteen pair colors, one per unordered pair of the six axes.
 *
 * Hue by the pair's lower axis so the five faces sharing an axis read as a
 * family, lightness by how far apart the two are — the same grammar the
 * plane's band colors use.
 */
function pairColor(i: number, j: number): THREE.Color {
    const hue = (i / 6 + 0.04) % 1;
    const gap = Math.min(Math.abs(j - i), 6 - Math.abs(j - i));
    return new THREE.Color().setHSL(hue, 0.55, 0.40 + 0.12 * gap);
}
/** Six stick colors, one per axis: Zometool's convention, a hue per direction. */
function axisColor(i: number): THREE.Color {
    return new THREE.Color().setHSL((i / 6 + 0.04) % 1, 0.68, 0.46);
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

    /** The one clipping plane the cut drives. Normal −x, moved by `cut`. */
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);

    const spec = () => SOLIDS.find((s) => s.key === state.solid) ?? SOLIDS[SOLIDS.length - 1];
    let gens: Vec3[] = spec().gens.map((i) => ICO_AXES[i]);
    let solid: Zonohedron = zonohedron(gens);
    /** Per face: its mesh, where its center sits, and the way out. */
    let pieces: { mesh: THREE.Mesh; out: THREE.Vector3 }[] = [];
    /** The frame: a hairline, or balls and sticks. One group either way. */
    const frame = new THREE.Group();
    root.add(frame);

    const clear = (g: THREE.Group) => {
        for (const child of [...g.children]) {
            const m = child as THREE.Mesh;
            m.geometry?.dispose();
            const mat = m.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) for (const x of mat) x.dispose(); else mat?.dispose();
            g.remove(child);
        }
    };

    /** A zonotope's center is half the sum of its generators. */
    const centerOf = (gs: readonly Vec3[]) => {
        const c = new THREE.Vector3();
        for (const g of gs) c.add(new THREE.Vector3(g[0], g[1], g[2]));
        return c.multiplyScalar(0.5);
    };

    function buildFaces(mid: THREE.Vector3) {
        for (const p of pieces) {
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
            root.remove(p.mesh);
        }
        pieces = [];
        if (state.faces === "none") return;
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
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                color: pairColor(f.pair[0], f.pair[1]),
                roughness: 0.85,
                metalness: 0,
                side: THREE.DoubleSide,
                clippingPlanes: [plane],
                transparent: true,
                opacity: 1,
                depthWrite: state.faces === "solid",
            }));
            const home = new THREE.Vector3();
            for (const p of pts) home.add(new THREE.Vector3(p[0], p[1], p[2]));
            home.multiplyScalar(0.25).sub(mid);
            pieces.push({ mesh, out: home.clone().normalize() });
            root.add(mesh);
        }
    }

    /**
     * The frame. A hairline is one LineSegments; the Zome build is a ball at
     * every vertex and a stick along every edge, each stick colored by the one
     * axis it runs along — which is what makes Dietl's figure 35 legible, and
     * what a plain wireframe cannot say.
     */
    function buildFrame() {
        clear(frame);
        if (state.edges === "none" || !solid.edges.length) return;
        if (state.edges === "thin") {
            const seg: number[] = [];
            for (const [a, b] of solid.edges) {
                const p = maskPoint(gens, a), q = maskPoint(gens, b);
                seg.push(p[0], p[1], p[2], q[0], q[1], q[2]);
            }
            const wg = new THREE.BufferGeometry();
            wg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
            frame.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({
                color: 0x1b1b22, transparent: true, opacity: 0.55, clippingPlanes: [plane],
            })));
            return;
        }
        const ballGeo = new THREE.IcosahedronGeometry(BALL, 2);
        const ballMat = new THREE.MeshStandardMaterial({
            color: 0xdedee4, roughness: 0.5, metalness: 0.1, clippingPlanes: [plane],
        });
        for (const m of solid.vertexMasks) {
            const p = maskPoint(gens, m);
            const ball = new THREE.Mesh(ballGeo, ballMat);
            ball.position.set(p[0], p[1], p[2]);
            frame.add(ball);
        }
        // One cylinder geometry, reused: unit length up the y axis, then each
        // stick is a rotation onto its own generator.
        const stickGeo = new THREE.CylinderGeometry(STICK, STICK, 1, 12);
        const byAxis = new Map<number, THREE.MeshStandardMaterial>();
        const up = new THREE.Vector3(0, 1, 0);
        for (const [a, b] of solid.edges) {
            const p = maskPoint(gens, a), q = maskPoint(gens, b);
            // The edge runs along exactly one generator: the bit that differs.
            const axis = Math.log2((a ^ b) >>> 0) | 0;
            let mat = byAxis.get(axis);
            if (!mat) {
                mat = new THREE.MeshStandardMaterial({
                    color: axisColor(spec().gens[axis] ?? axis),
                    roughness: 0.45, metalness: 0.05, clippingPlanes: [plane],
                });
                byAxis.set(axis, mat);
            }
            const dir = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
            const len = dir.length();
            const stick = new THREE.Mesh(stickGeo, mat);
            stick.scale.set(1, len, 1);
            stick.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
            stick.quaternion.setFromUnitVectors(up, dir.normalize());
            frame.add(stick);
        }
    }

    function build() {
        gens = spec().gens.map((i) => ICO_AXES[i]);
        solid = zonohedron(gens);
        const mid = centerOf(gens);
        buildFaces(mid);
        buildFrame();
        root.position.set(-mid.x, -mid.y, -mid.z);
        place();
    }

    /** Where each face sits at the current explode, and how solid it looks. */
    function place() {
        const t = state.explode;
        const base = state.faces === "transparent" ? 0.45 : 1;
        for (const p of pieces) {
            p.mesh.position.copy(p.out).multiplyScalar(t * 2.2);
            // Assembled, the faces are the surface and want to be opaque.
            // Apart, they are specimens and want to be seen through.
            (p.mesh.material as THREE.MeshStandardMaterial).opacity = base * (1 - 0.35 * t);
        }
        // The frame is the assembled solid, so it goes once the faces leave it.
        frame.visible = t < 0.02;
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
    function frameLoop(now: number) {
        if (!alive) return;
        const dt = last ? (now - last) / 1000 : 0;
        last = now;
        if (state.spin) root.rotation.y += dt * 0.35;
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(frameLoop);
    }
    build();
    requestAnimationFrame(frameLoop);

    return {
        state,
        set(s) {
            const rebuild = (s.solid !== undefined && s.solid !== state.solid)
                || (s.edges !== undefined && s.edges !== state.edges)
                || (s.faces !== undefined && s.faces !== state.faces);
            Object.assign(state, s);
            if (rebuild) build(); else place();
        },
        counts: () => ({
            k: gens.length,
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

export type { Vec3 };
