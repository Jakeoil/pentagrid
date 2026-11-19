// Types for lib/pentagrid.js — see that file for what this entry is and why.
export { createPentagrid, LAYER_FEATURE } from "../dist/view/pentagrid.js";
export type {
    PentagridConfig, PentagridHandle, PentagridParts, Features, ViewState,
    View, GridStyle, TileStyle,
} from "../dist/view/pentagrid.js";

export { NO_FEATURES, TILE_DEFAULTS, GRID_DEFAULTS } from "../dist/state/defaults.js";

// The coordinate pair every direction and edge is given as.
export type { Vec2 } from "../dist/geometry/types.js";
