# Ultra Corpotech Inc. website

The animated website for Ultra Corpotech Inc., the American subsidiary of Ultra Corpotech Pvt Ltd. It is built on the Ultra Corpotech design system: brand green `#00a972` on white, Bahnschrift (Barlow on the web) in Regular and Bold only, square full-bleed photography, no drop shadows, and the 8px green foot bar.

Pages: Home, Products, Services, Case studies, About, Careers, Blog (with three articles) and Contact. Product, process, plant and company details come from the group site, [ultracorpotech.com](https://ultracorpotech.com/).

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

- **Contact details.** `[Phone]` and `[Email]` (footer of every page, and the Contact page aside and offices), `[Year]` the US company was established (About), and `[Careers email]` (Careers).
- **Proof.** The two missing figures on Home (parts delivered, by quantity and value; customers served), the customer logo wall and the testimonials (Home), and the challenge and result of each case study (Case studies). Use only logos and quotes you have permission to show.
- **Careers.** Current openings, benefits, and employee stories, photos or video.
- **About.** A short biography for Pratiksha A. Bhosle, and measurable sustainability figures (waste, energy, water). Facility photographs can go in the "Where We Make It" section once the photoshoot is done.
- **Claims to confirm.** That the ISO 14001 certificate is current (the badge says so where it is claimed), the 24 to 48 hour reply time (Home, Services, Contact and the quote checklist article), 3,500+ people, the EEPC India Star Performer award, and the fifth value, written here as "Customer Focus".
- **Quote form.** The form validates and shows its confirmation, but a static site cannot send email. In `contact.html`, set `data-endpoint` on the `<form>` to your form handler's URL (Formspree, Netlify Forms, or your own endpoint). The script then posts the form, files included, and only shows the confirmation when the handler accepts it.

## How it is put together

```
index.html             Home
products.html          Products, by line: oil and gas, renewable energy, rail, telecom, infrastructure, industrial, defense
services.html          Services: capacity, the process chain, drawing to delivery, standards
case-studies.html      Case studies
about.html             Story, milestones, vision, mission and values, leadership, plants, sustainability
careers.html           Careers
blog.html              Blog index, plus blog-rfq-checklist.html, blog-en-15085-2.html, blog-choosing-a-finish.html
contact.html           Quote form and offices
assets/css/site.css    design tokens (light and dark), layout, components, motion states
assets/js/site.js      the motion engine, canvases, world map, line icons and the form
assets/img/            logos and photographs from the design system, plus WebP copies
assets/fonts/          Barlow Regular and Bold, latin and latin-ext (SIL Open Font License)
```

The header, menu, intro, page curtain and footer are identical on every page; change them in all eleven files.

- **Request a quote by industry.** A link to `contact.html#oil-and-gas` (or any other line's key, set as `data-key` on the options of the Industry field) opens the form with that industry selected.
- **Adding an article.** Copy one of the `blog-*.html` files, change its title, date, reading time and text, then add its card to `blog.html` and to the "More From the Blog" lists in the other articles. Any page named `blog-*.html` gets the "Article" page transition.

### Motion

The motion language comes from the brand: the slides' slow upward push drives every reveal and the page transitions, the cover lockup grows from its centre on the first visit, the green foot bar becomes the scroll gauge (and the shutter that opens into the cover photograph), and the cover's plus grid becomes a field that reacts to the pointer.

| Where | What moves |
| --- | --- |
| Every page | First-visit intro, green page curtain between pages, scroll gauge along the foot, crosshair cursor whose frame locks onto links and buttons, magnetic buttons with rolling labels |
| Home | Plus-grid field, 3D wireframe gears that mesh and follow the pointer, foot bar that opens into the cover photo, product cards, stacking service strips, scroll-driven marquees, pinned four-step "Working With UCI" run with a truck along the foot bar, rolling odometers, case study index with a preview that trails the pointer, testimonial slider, dot-matrix world map that draws its export lanes from Pune, a milestone strip you can drag, word-by-word vision quote, values that fill in, rising skyline |
| Products | The sectors orbiting the mark, illustrations that stay in view beside each product line, scroll-driven metro train |
| Services | Laser cutter that cuts parts from a plate (inner contours first) with a live X/Y readout, capacity visuals (450 squares for 450 machine tools), process chain that lights up as you scroll, pinned "From Drawing to Delivery", stamped standards |
| Case studies | The four sectors orbiting the mark |
| About | Datum ring around the mark, scroll-lit story, the milestone strip, vision and mission cards that lock together, plants listed year by year |
| Careers | Meshing gears, values that fill in |
| Contact | Handshake photo that opens from the centre, animated fields and file drop, a burst of plus crosses on sending |

The line icons and illustrations are drawn in code (one stroke weight, ink with a green accent) in the `ICONS` and `ARTS` tables in `site.js`; a page asks for one with `data-icon="wind"` or `data-art="weld"`.

### Accessibility

- With **prefers-reduced-motion**, or without JavaScript, every page renders complete and still: no intro, no curtain, nothing hidden waiting for a scroll. Without JavaScript the world map's dots are not drawn; its pins, legend and text still show.
- Automated browsers (link previews, screenshots) also get the still page.
- Text never goes below 13 pt (17.33px), green is never used for small text, and every interactive element shows the design system's focus ring.
- The milestone strip scrolls with the keyboard as well as by dragging, and has Earlier and Later buttons.
- The site follows the visitor's light or dark setting using the design system's dark theme. On dark grounds the header and footer use the mark alone, as the logo rules require; the skyline bands always stay light.

### Brand notes

- Logos are the design system's files, unaltered: `lockup.png` on light grounds, `mark.png` / `mark-large.png` on their own.
- Photographs are full-bleed, square-cornered and untinted. The WebP copies are resized versions of the same images.
- Bahnschrift is used where it is installed (Windows); everywhere else the site falls back to Barlow.

### Credits

The world map's land outline is derived from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
