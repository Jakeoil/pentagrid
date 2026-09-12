// The narrative: pages, and what each one makes of the view.
//
// This used to live inside createPentagrid, which took the pages as config and
// carried a parallel table of feature presets. That put the walkthrough inside
// the instrument: the view had to know what a step was, how many there were, and
// which capabilities each one turned on.
//
// It is the other way round now. A page is content plus an `enter` that sets the
// view up — features, how far the grid has faded, which controls are worth
// exposing on it. The view knows none of that and only offers the handles.

import type { Features, PentagridHandle } from "../view/pentagrid.js";

export interface Page {
    title: string;
    html: string;
    /**
     * Put the view in this page's state. Called on arrival, and it is the ONLY
     * thing that decides what the page shows — there is no preset table behind it.
     */
    enter: (pg: PentagridHandle) => void;
}

export interface NarrativeConfig {
    pages: Page[];
    handle: PentagridHandle;
    /** Where Prev / indicator / Next go. */
    nav?: HTMLElement;
    /** Where the page's prose goes. */
    explanation?: HTMLElement;
    buildId?: string;
}

export interface Narrative {
    go: (i: number) => void;
    /** The page a feature belongs to, or -1. For jumping to what a switch means. */
    pageFor: (key: keyof Features) => number;
    current: () => number;
    count: () => number;
}

export function createNarrative(config: NarrativeConfig): Narrative {
    const { pages, handle } = config;
    const nav = config.nav ?? document.createElement("div");
    const explanation = config.explanation ?? document.createElement("div");

    const prev = document.createElement("button");
    prev.textContent = "← Previous";
    const indicator = document.createElement("span");
    indicator.className = "step-indicator";
    const next = document.createElement("button");
    next.textContent = "Next →";
    const tag = document.createElement("span");
    tag.className = "build-tag";
    tag.textContent = config.buildId ? `build ${config.buildId}` : "";

    nav.appendChild(prev);
    nav.appendChild(indicator);
    nav.appendChild(next);
    nav.appendChild(tag);

    let at = 0;

    function go(i: number) {
        if (pages.length === 0) return;
        at = Math.max(0, Math.min(pages.length - 1, i));
        const page = pages[at];
        page.enter(handle);                       // the page sets the view up
        indicator.textContent = `Step ${at + 1} of ${pages.length}`;
        prev.disabled = at === 0;
        next.disabled = at === pages.length - 1;
        explanation.innerHTML = `<h3>${page.title}</h3>${page.html}`;
    }

    prev.addEventListener("click", () => go(at - 1));
    next.addEventListener("click", () => go(at + 1));

    /**
     * Which page is about this feature.
     *
     * Found by asking each page what it turns on, through a stand-in handle that
     * records instead of drawing — so the answer comes from the pages themselves
     * and cannot drift from what they actually do.
     */
    function pageFor(key: keyof Features): number {
        for (let i = 0; i < pages.length; i++) {
            let found = false;
            const probe = {
                setFeatures: (f: Partial<Features>) => { if (f[key]) found = true; },
                setGridAlpha: () => {},
                exposeRows: () => {},
                onFeatureOn: () => {},
                redraw: () => {},
            } as unknown as PentagridHandle;
            pages[i].enter(probe);
            if (found) return i;
        }
        return -1;
    }

    go(0);
    return { go, pageFor, current: () => at, count: () => pages.length };
}
