// The six pages of the method: prose, and what each one makes of the view.
//
// A page is not "title and prose" any more. It carries its own `enter`, which is
// the only thing that decides what the page shows — the view has no preset table
// behind it and does not know what a page is. See app/narrative.ts.

import type { Page } from "./narrative.js";

const THICK_FILL = "#e8c170";
const THIN_FILL = "#7eb8da";
export const METHOD_PAGES: Page[] = [
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
        enter: (pg) => {
            pg.setFeatures({ gridLines: true });
            pg.setGridAlpha(0.6);
            // Only what this page is about. The rest is still reachable from the
            // panel; it is just not shouted about here.
            pg.exposeRows(["Pentagrid", "single line"]);
        },
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
        enter: (pg) => {
            pg.setFeatures({ gridLines: true, intersectionDots: true, hoverTile: true });
            pg.setGridAlpha(0.6);
            pg.exposeRows(["Pentagrid", "single line", "On hover"]);
        },
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
        enter: (pg) => {
            pg.setFeatures({
                gridLines: true, kRegions: true, kLabels: true, hoverVertex: true,
            });
            pg.setGridAlpha(0.4);
            pg.exposeRows(["Pentagrid", "K-regions", "On hover"]);
        },
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
        enter: (pg) => {
            pg.setFeatures({ gridLines: true, penroseVertices: true, hoverVertex: true });
            pg.setGridAlpha(0.28);
            pg.exposeRows(["Pentagrid", "Penrose", "K-regions", "On hover"]);
        },
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
        enter: (pg) => {
            pg.setFeatures({ gridLines: true, penroseEdges: true, hoverTile: true });
            pg.setGridAlpha(0.24);
            pg.exposeRows(["Pentagrid", "Penrose", "On hover"]);
        },
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
        enter: (pg) => {
            pg.setFeatures({ gridLines: true, penroseTiles: true });
            pg.setGridAlpha(0.18);
            pg.exposeRows(null);     // the last page opens everything up
        },
    },
    {
        title: "Step 7 &mdash; When lines meet",
        html: `<p>The construction asks that no three lines be concurrent. Where
            three or more <em>are</em>, that point does not dualise to a rhomb: it
            dualises to a <b>2<i>k</i>-gon with unit sides</b>, holding the
            <i>C</i>(<i>k</i>,&thinsp;2) rhombs &mdash; one per pair of lines &mdash;
            that would lie side by side if the lines were pulled apart.</p>
            <p class="equation">3 lines &rarr; hexagon &nbsp;&middot;&nbsp; 4 &rarr;
            octagon &nbsp;&middot;&nbsp; 5 &rarr; decagon</p>
            <p>This page opens on &Gamma;&thinsp;=&thinsp;0, every phase zero, which
            is the most singular pentagrid there is: all ten triples go at once.
            Only the outline is drawn. A zonogon has many rhombic tilings and the
            construction picks none of them, so the space and its contents are
            facts while the layout is not.</p>
            <p>How many lines can meet is decided by the phases, exactly, by
            arithmetic rather than by looking. A <b>3</b>-fold needs one &gamma;
            integral and one pair summing to an integer &mdash; no more.</p>
            <p><b>No octagon is Penrose.</b> Since
            &Sigma;<b>v</b><sub><i>j</i></sub>&thinsp;=&thinsp;0, at any point where
            four families meet the fifth satisfies
            <b>x</b>&middot;<b>v</b><sub><i>e</i></sub>&thinsp;+&thinsp;&gamma;<sub><i>e</i></sub>
            = &minus;&Sigma;<i>n</i><sub><i>j</i></sub>&thinsp;+&thinsp;&Sigma;&gamma;,
            so the fifth family passes through that same point precisely when
            &Sigma;&gamma; is an integer. Penrose <em>is</em>
            &Sigma;&gamma;&thinsp;&isin;&thinsp;&Zopf;, so every 4-fold is swallowed
            by a 5-fold. The octagon is real, but it lives outside the condition.</p>
            <p>What is left is a very short catalog. The ten triples fall into
            <b>five couples</b> &mdash; same lone &gamma;, complementary pair &mdash;
            and &Sigma;&gamma;&thinsp;&isin;&thinsp;&Zopf; makes each couple stand or
            fall together. Every couple is one K122 and one K113, so
            <em>the two hexagons only ever appear together</em>. And two couples drag
            in the rest, so there is nothing between one couple and all five:</p>
            <p class="equation">regular &nbsp;&middot;&nbsp; one couple (K122 + K113)
            &nbsp;&middot;&nbsp; &Gamma;&thinsp;=&thinsp;0 (5 + 5 + decagon)</p>
            <p>Three states, and that is all of them &mdash; searched exhaustively
            over every rational phase vector. The <b>Hunt</b> row is one button per
            state, each decided by the rule and then checked against the scan.</p>
            <p>Move any phase off zero and nearly all of them go. What is left sits
            on shells at <i>m</i> and <i>m</i>&phi; times 1/cos&thinsp;18&deg;
            &mdash; &Zopf;[&phi;], radiating out.</p>`,
        enter: (pg) => {
            pg.setFeatures({ gridLines: true, intersectionDots: true });
            pg.setGridAlpha(0.5);
            pg.exposeRows(["Pentagrid", "single line", "Hunt"]);
        },
    },
];
