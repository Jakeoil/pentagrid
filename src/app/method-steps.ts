// The six steps of the method page: title and prose, nothing else.
//
// Separated because a page's narration is content, not machinery — an
// exploration supplies its own list, or none at all.

import type { StepSpec } from "../view/pentagrid.js";

const THICK_FILL = "#e8c170";
const THIN_FILL = "#7eb8da";
export const METHOD_STEPS: StepSpec[] = [
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
