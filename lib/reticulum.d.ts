// Types for lib/reticulum.js — see that file for what this entry is and why.
export {
    mountReticulum, mountFloatingReticulum, mountGammaControls,
    bindRange, bindSliders, bindToggles, bindSelects, wheelSteps,
} from "../dist/view/controls.js";
export type {
    GammaControl, SliderSpec, ToggleSpec, SelectSpec, FloatingReticulumOptions,
} from "../dist/view/controls.js";

export { createReticulum, signedGamma, lighten } from "../dist/ui/reticulum.js";
export type {
    Reticulum, ReticulumOptions, ReticulumState,
} from "../dist/ui/reticulum.js";

export { createSumStrip } from "../dist/ui/sumstrip.js";
export type { SumStrip, SumStripOptions, SumStripState } from "../dist/ui/sumstrip.js";

export { createGammaBank } from "../dist/ui/dials.js";
export type { GammaBank, GammaBankOptions, GammaBankState } from "../dist/ui/dials.js";

export { createFloatingPanel } from "../dist/ui/floating.js";
export type { FloatingPanel, FloatingPanelOptions } from "../dist/ui/floating.js";

export { createLoupe } from "../dist/ui/loupe.js";
export type { Loupe, LoupeOptions, LoupeTarget, LoupeView } from "../dist/ui/loupe.js";

export { addPresets } from "../dist/ui/presets.js";

export {
    wheelNotch, isFine, makeNotchGate, snapStep, snapStepWith,
} from "../dist/ui/wheel.js";
export type { WheelSteps } from "../dist/ui/wheel.js";
