# Ultra Corpotech Inc. website

The animated website for Ultra Corpotech Inc., the American subsidiary of Ultra Corpotech Pvt Ltd. It is built on the Ultra Corpotech design system: brand green `#00a972` on white, Bahnschrift (Barlow on the web) in Regular and Bold only, square full-bleed photography, no drop shadows, and the 8px green foot bar.

Pages: Home, Products, Services, Facilities, Case studies, About, Careers, Blog (with three articles) and Contact. The site leads with UCI in Conroe, Texas, serving customers throughout the United States and Canada, then explains the Ultra group that supports it.

The June 2026 corporate presentation supplies the updated UCI facility profile and three-phase development plan, group scale (4,500+ people, 650+ machine tools and 18 manufacturing facilities across 10 Pune locations), material capabilities and expanded product examples. The UCI plan's dates are intended milestones, not confirmation that each phase is complete. Earlier content and imagery from the December 2025 presentation and [ultracorpotech.com](https://ultracorpotech.com/) remain where they have not been superseded. See [content sources](docs/content-sources.md) for page references and editorial boundaries.

The Parts Library has 101 examples: the original 87, with eight images upgraded, plus 14 additions from the June 2026 presentation (eight oil-and-gas components, three rail components and three mining components). Source photographs are extracted at their embedded resolution, cleaned with image generation to remove backgrounds and improve clarity, then exported with transparent backgrounds and matching edge masks. They are illustrative component photographs, not dimensionally accurate CAD models. [Image source records](docs/part-image-sources.json) identify the 22 upgraded or added images by presentation page and embedded-image reference.

It is a plain static site: HTML, one stylesheet and one script, with no build step and no third-party requests.

## Run it locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works (`npx serve .` too). Use a server rather than opening the files straight from disk, where browsers restrict the self-hosted fonts.

## Deploy

Upload the repository as it is to any static host. For GitHub Pages: **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`.

## Before going live

Content the company still has to supply is marked on the pages with a yellow **To be added** badge or box, and in the text with square brackets. To list every spot:

```sh
grep -n 'todo-badge\|todo-box\|\[[A-Z#][^]]*\]' *.html
```

- **Contact details.** `[Phone]` and `[Email]` (footer of every page, and the Contact page aside and offices), and `[Careers email]` (Careers).
- **Proof.** The customer logo wall and testimonials (Home), and the challenge and result of each case study (Case studies). Use only logos and quotes you have permission to show.
- **Careers.** Current openings, benefits, and employee stories, photos or video.
- **About.** A short biography for Pratiksha A. Bhosle, and measurable sustainability figures (waste, energy, water). Facility photographs can go in the "Where We Make It" section once the photoshoot is done.
- **Facilities photographs.** The photographs in `assets/img/facilities/` come from the corporate presentations, including the Conroe aerial photograph from June 2026, page 8. Some are soft at large sizes. Replace them with approved photographs of the same subjects when available, preserving the file paths used by the pages.
- **Parts library.** Solar tracker, aluminum and hardware names retain the earlier presentation captions without customer program codes. The June 2026 update corrects identifiable oil-and-gas and mining captions, including the two crossheads, micro grid, boom bracket, counterweight and carrying fixtures; see [content sources](docs/content-sources.md). Some retained images still have descriptive names that need checking against the company's part list. The enlarged image viewer helps visitors inspect examples and their available specifications. For later replacements, use a transparent cutout and run `python3 tools/part-image.py cutout.png og-drill-01` (same file name), then update the image dimensions and any enlarged-image source in `products.html`. Keep the source record current.
- **Claims to confirm.** Confirm the validity and site scope of certificates before using them for a customer's program; group certifications must not be presented as UCI certifications. Existing certificate confirmation badges remain where needed. Confirm any remaining response-time promises, award claims and descriptive product names. The June 2026 development plan gives target dates; ask UCI to verify each phase's actual commissioning status before marking it complete.
- **Quote form.** The form validates and shows its confirmation, but a static site cannot send email. In `contact.html`, set `data-endpoint` on the `<form>` to your form handler's URL (Formspree, Netlify Forms, or your own endpoint). The script then posts the form, files included, and only shows the confirmation when the handler accepts it.

## How it is put together

```
index.html             Home
products.html          Products, by line: oil and gas, renewable energy, rail, telecom, infrastructure, industrial, defense
services.html          Services: capacity, the process chain, drawing to delivery, standards
facilities.html        UCI Conroe site and development plan, then group plants, machines, capacity and quality lab
case-studies.html      Case studies
about.html             Story, milestones, vision, mission and values, leadership, plants, sustainability
careers.html           Careers
blog.html              Blog index, plus blog-rfq-checklist.html, blog-en-15085-2.html, blog-choosing-a-finish.html
contact.html           Quote form and offices
assets/css/site.css    design tokens (light and dark), layout, components, motion states
assets/js/site.js      motion, canvases, dual-origin shipping map, part inspector, line icons and form
assets/img/            logos and photographs from the design system, plus WebP copies
assets/img/facilities/ Conroe aerial and group shop-floor photographs from the corporate presentations
assets/img/parts/      transparent part images, matching -edges.webp masks and enlarged images where available
docs/content-sources.md source pages, claim scope and corrected product captions
docs/part-image-sources.json source page and embedded-image reference for updated part images
tools/part-image.py    turns a cut-out part photograph into the two files the Parts Library uses
assets/fonts/          Barlow Regular and Bold, latin and latin-ext (SIL Open Font License)
```

The header, menu, intro, page curtain and footer are identical on every page; change them in all twelve files. Below 1200px wide the header's links fold into the menu.

- **Request a quote by industry.** A link to `contact.html#oil-and-gas` (or any other line's key, set as `data-key` on the options of the Industry field) opens the form with that industry selected.
- **Adding an article.** Copy one of the `blog-*.html` files, change its title, date, reading time and text, then add its card to `blog.html` and to the "More From the Blog" lists in the other articles. Any page named `blog-*.html` gets the "Article" page transition.

### Motion

The motion language comes from the brand: the slides' slow upward push drives every reveal and the page transitions, the cover lockup grows from its centre on the first visit, the green foot bar becomes the scroll gauge, and the cover's grid, set with the Ultra "U" monogram, becomes a field that reacts to the pointer.

The monogram is a vector traced from `mark-large.png` (two pillars and the dot). It is the `--mark` and `--mark-tile` masks in `site.css` and `MARK_POLYS` in `site.js`, and it appears wherever the design used to repeat a plus sign: the hero fields, the intro and page curtain, the marquee separators, the process-chain and milestone nodes, the standards seals, the map pins, the gear hubs, the laser cutter's plate and the burst when the quote form is sent. The crosshair cursor and the file-drop "add" icon stay as crosses because they are controls, not decoration.

The pages also read like an engineering drawing sheet:

- **Heroes** are CAD viewports: rulers along the top and left edges, guides through the pointer, a snap box on the nearest grid node and a readout of the pointer's position in millimetres. Page titles carry a dimension line with their measured width, which counts up as the line draws out.
- **Sections** are numbered (§ 01, § 02, …) on a dash-dot centre line that ends in a tick.
- **Cards** have bracketed corners that draw out on reveal and reach further on hover; product cards carry part numbers (P-01, P-02, …). Placeholders still waiting for content are cross-hatched.
- **Muted bands** are graph paper on the same 48px pitch as the hero grid. Figures sit on a scale, and the scroll gauge has a tick every tenth.
- **Gears** show dash-dot pitch circles, the centre line and callouts with each gear's tooth count.
- **The footer** ends in a title block: company, discipline, page title, sheet number, scale and units.
- **The Parts Library** shows each part like a model in a CAD viewer: it stands on a turntable whose grid floor turns with it, with its shadow on the floor, a highlight that slides across the metal, a view triad and an azimuth and elevation readout. A part loads as a green wireframe that a scan line fills in, turns slowly on its own, follows the pointer, and shows its wireframe again on hover. The parts are photographs, so they turn within a few degrees either side rather than all the way round. The Inspect control opens an enlarged view with the product name and available example specifications; these images are illustrative, not measurement tools.

The tags, dimension lines, readout and title-block cells are added by the script and hidden from assistive technology; without the script the page is unchanged.

| Where | What moves |
| --- | --- |
| Every page | First-visit intro with the lockup framed in registration brackets, green page curtain patterned with the monogram, ruled scroll gauge along the foot, crosshair cursor whose frame locks onto links and buttons, magnetic buttons with rolling labels, section tags whose centre lines draw out, dimensioned page titles, card corners that draw out |
| Home | Monogram field with CAD rulers and a millimetre readout, 3D wireframe gears with pitch circles and tooth-count callouts that mesh and follow the pointer, the cover photo screened behind What We Make, drifting under a scan line, product cards, stacking service strips, scroll-driven marquees, pinned four-step "Working With UCI" run with a truck along the foot bar, rolling odometers, case study index with a preview that trails the pointer, testimonial slider, dot-matrix world map with UCI delivery lanes from Conroe across the US and into Canada, alongside the group’s global lanes from Pune, a milestone strip you can drag, word-by-word vision quote, values that fill in, rising skyline |
| Products | The sectors orbiting the mark, the business mix drawn as bars, the Parts Library's turntables, illustrations that stay in view beside each product line, scroll-driven metro train |
| Services | Laser cutter that cuts parts from a plate (inner contours first) with a live X/Y readout, capacity visuals (650 squares for 650+ group machine tools), process chain whose monogram nodes fill green as you scroll, pinned "From Drawing to Delivery", stamped standards |
| Facilities | A press brake that bends a blank and dimensions the angle, bars that draw out to scale (monthly capacity, floor area of each unit), machine icons that run (laser head, press ram, welding robot, roll formers, furnace, galvanizing dip, CMM probe), numbered figures in registration brackets |
| Case studies | The four sectors orbiting the mark |
| About | Datum ring around the mark, scroll-lit story, the milestone strip, vision and mission cards that lock together, plants listed year by year |
| Careers | Meshing gears, values that fill in |
| Contact | Handshake photo that opens from the centre, animated fields and file drop, a burst of monograms on sending |

The line icons and illustrations are drawn in code (one stroke weight, ink with a green accent) in the `ICONS` and `ARTS` tables in `site.js`; a page asks for one with `data-icon="wind"` or `data-art="weld"`.

### Accessibility

- With **prefers-reduced-motion**, or without JavaScript, every page renders complete and still: no intro, no curtain, nothing hidden waiting for a scroll. Without JavaScript the world map's dots are not drawn; its pins, legend and text still show.
- Automated browsers (link previews, screenshots) also get the still page.
- Text never goes below 13 pt (17.33px), green is never used for small text, and every interactive element shows the design system's focus ring.
- The milestone strip scrolls with the keyboard as well as by dragging, and has Earlier and Later buttons.
- The Parts Library's families are tabs (the arrow keys move between them, Home and End jump to the ends); without the script every family is listed in turn under its own heading. Its Inspect buttons open a modal dialog that supports keyboard focus, Escape to close and focus return to the opening control.
- The site follows the visitor's light or dark setting using the design system's dark theme. On dark grounds the header and footer use the mark alone, as the logo rules require. The skyline at the foot of each page is a mask drawn in the theme's green, so its band follows the theme too.

### Brand notes

- Logos are the design system's files, unaltered: `lockup.png` on light grounds, `mark.png` / `mark-large.png` on their own.
- Photographs are full-bleed, square-cornered and untinted, except the cover photograph behind "What We Make" on Home, which is screened in grey as a backdrop. The WebP copies are resized versions of the same images.
- The interface has no drop shadows. The only shadows are the ones the parts cast on their turntables, which belong to the 3D scene.
- Bahnschrift is used where it is installed (Windows); everywhere else the site falls back to Barlow.

### Credits

The world map's land outline is derived from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
