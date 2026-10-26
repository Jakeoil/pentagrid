/**
 * Every field of a canvas's state, as data — PLAN §9.10 step 2.
 *
 * Four things have to agree about what the state IS: the attribute reader, the
 * attribute writer, the reset to a page's baseline, and the round-trip test.
 * Four hand-written lists would disagree within a month — this session alone
 * added `pentaOverlay`, `axis`, `direction` and `paths` — so they read one.
 *
 * **Derived where it can be, declared only where it cannot.** The fields, their
 * kinds and their defaults all come from the defaults literals themselves
 * (`NO_FEATURES`, `TILE_DEFAULTS`, growth's `DEFAULTS`), so a switch added to
 * any of them appears here with no edit and cannot be forgotten. What a
 * TypeScript union cannot tell you at runtime is the set of values an enum
 * admits, so those are declared below — and `tools/inventory.test.mjs` parses
 * the unions back out of the source and compares, so they cannot drift either.
 *
 * The attribute name is derived too: camelCase to `data-kebab-case`, the one
 * rule, so there is no table of sixty names to mistype.
 *
 * What is NOT here: γ and the view. §9.3's shared slice is the reticulum, which
 * is integer numerators over a denominator plus a few flags — a shaped value,
 * not a bag of fields — and the view is three floats with their own getter and
 * setter. Both are named in `SLICES` so a serializer can see them, and neither
 * pretends to be a `Field`.
 */
import { NO_FEATURES, TILE_DEFAULTS, GRID_DEFAULTS } from "./defaults.js";
import { DEFAULTS as GROWTH_DEFAULTS } from "./defaults.js";

/** Which object a field lives on. */
export type Owner = "features" | "tileStyle" | "grid" | "growth";
/** What a field holds, which is what a reader has to parse it into. */
export type Kind = "bool" | "enum" | "number";
/** How far a field travels — §9.3. */
export type Scope = "page" | "shared";

export interface Field {
    owner: Owner;
    key: string;
    /** The HTML attribute, §9.8: `data-penta-face`. */
    attr: string;
    kind: Kind;
    scope: Scope;
    /** The view's own default. A page's baseline may differ — §9.6. */
    fallback: boolean | number | string;
    /** For an enum, every value it admits. Absent otherwise. */
    values?: readonly string[];
}

/**
 * The value sets a TypeScript union cannot provide at runtime.
 *
 * Keyed `owner.key`. Checked against the interfaces in the source by
 * `tools/inventory.test.mjs`, which is what keeps them honest.
 */
const ENUMS: Record<string, readonly string[]> = {
    "tileStyle.color": ["type", "pair", "bands", "groups", "kowalewski"],
    "tileStyle.pentaShape": ["penta", "innie", "outie"],
    "tileStyle.pentaBoundary": ["circle", "bisector", "bend18", "bend36"],
    "tileStyle.p1Shape": ["pentaplex", "in18", "out18"],
    "tileStyle.vertexMark": ["dot", "index"],
    "growth.edgeStyle": ["none", "normal", "bold"],
    "growth.paths": ["high", "low", "both"],
    "growth.indexStyle": ["none", "numbers", "pool"],
};

/**
 * The three attribute names the one rule cannot give, because two owners use
 * the same key.
 *
 * `isogloss`, `band` and `offPenrose` exist on BOTH `TileStyle` and
 * `GrowthState`, and a roof page carries both objects — `createGrowthView`
 * builds a pentagrid underneath itself — so `data-band` there would be
 * ambiguous. Method and split are the pages whose attribute names Jake wrote
 * out (§9.8), so those keep the plain form and the growth side takes the
 * prefix.
 *
 * Declared rather than computed on collision, deliberately: a rule that
 * prefixes "when there is a clash" would RENAME an existing attribute the day
 * a clashing field is added, and an old embed would quietly lose it. A table
 * only ever grows, and `tools/inventory.test.mjs` fails on any collision it
 * does not cover.
 */
const ATTR_OVERRIDES: Record<string, string> = {
    "growth.isogloss": "data-growth-isogloss",
    "growth.band": "data-growth-band",
    "growth.offPenrose": "data-growth-off-penrose",
};

/** camelCase to `data-kebab-case`. The one naming rule. */
export function attrName(key: string): string {
    return "data-" + key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * And back, so a reader can go from an attribute to a key.
 *
 * `BY_ATTR` is the real lookup — this is the naming rule inverted, and it
 * undoes an override's prefix so the two stay consistent.
 */
export function keyOf(attr: string): string {
    const bare = attr.replace(/^data-(growth-)?/, "");
    return bare.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function fieldsOf(owner: Owner, defaults: Record<string, unknown>): Field[] {
    const out: Field[] = [];
    for (const [key, fallback] of Object.entries(defaults)) {
        const values = ENUMS[`${owner}.${key}`];
        const kind: Kind = typeof fallback === "boolean" ? "bool"
            : typeof fallback === "number" ? "number" : "enum";
        if (kind === "enum" && !values) {
            // A string field with no declared value set: the inventory cannot
            // parse or perturb it, so say so loudly rather than ship a field
            // that silently never round-trips.
            throw new Error(`inventory: no values declared for ${owner}.${key}`);
        }
        out.push({
            owner, key,
            attr: ATTR_OVERRIDES[`${owner}.${key}`] ?? attrName(key), kind,
            scope: "page",
            fallback: fallback as boolean | number | string,
            ...(values ? { values } : {}),
        });
    }
    return out;
}

/**
 * Every flat field, derived. Page scope throughout: the only shared thing is
 * the reticulum, which is not a flat field — see `SLICES`.
 */
export const FIELDS: readonly Field[] = [
    ...fieldsOf("features", NO_FEATURES as unknown as Record<string, unknown>),
    ...fieldsOf("tileStyle", TILE_DEFAULTS as unknown as Record<string, unknown>),
    ...fieldsOf("grid", GRID_DEFAULTS as unknown as Record<string, unknown>),
    ...fieldsOf("growth", GROWTH_DEFAULTS as unknown as Record<string, unknown>),
];

/** By attribute, for a reader walking a container's attributes. */
export const BY_ATTR: ReadonlyMap<string, Field> =
    new Map(FIELDS.map((f) => [f.attr, f]));

/**
 * The parts of the state that are not flat fields, named so a serializer can
 * see the whole and nothing is silently left out.
 *
 * `gamma` is §9.3's shared slice and the only one that travels. `view` and
 * `visibility` are page scope like the fields.
 */
export const SLICES = [
    { name: "gamma", scope: "shared" as Scope,
      note: "integer numerators over den, plus locked, symmetry, guard, "
          + "generation, family flags and lines. Exact: no float round trip." },
    { name: "view", scope: "page" as Scope,
      note: "scale, x, y — getView/setView. Does NOT travel between pages." },
    { name: "visibility", scope: "page" as Scope,
      note: "userVisible by layer id — LayerStack.visibility/setVisibility." },
] as const;

/** A field's value as an attribute string. */
export function format(f: Field, value: unknown): string {
    if (f.kind === "bool") return value ? "" : "false";
    return String(value);
}

/**
 * An attribute string back to a value, or null if it does not parse.
 *
 * A boolean is HTML's kind of boolean: present is true, and only the explicit
 * strings below are false. An enum must name one of its values and a number
 * must be finite — anything else returns null, and the caller ignores the
 * attribute rather than taking a guess, which is §9.5's rule for an attribute
 * it does not understand.
 */
export function parse(f: Field, raw: string | null): boolean | number | string | null {
    if (raw === null) return null;
    if (f.kind === "bool") {
        const no = ["false", "0", "off", "no"];
        return !no.includes(raw.trim().toLowerCase());
    }
    if (f.kind === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    return f.values!.includes(raw) ? raw : null;
}

/**
 * Some other legal value for this field.
 *
 * For §9.7's per-field walk: perturb one field, serialize, reset, restore, and
 * compare. The walk needs a value that differs from the one in hand, and only
 * the inventory knows what that is for each kind — which is the second reason
 * the enum value sets have to be declared rather than inferred.
 */
export function alternative(f: Field, from: unknown): boolean | number | string {
    if (f.kind === "bool") return !from;
    if (f.kind === "enum") {
        const vs = f.values!;
        return vs.find((v) => v !== from) ?? vs[0];
    }
    // A number: something inside the ranges the controls use, and never the
    // value given. The fields are all 0..1 fractions or small counts, so a
    // half step off and clamped is safe for every one of them.
    const n = Number(from);
    return n === 0.5 ? 0.25 : 0.5;
}
