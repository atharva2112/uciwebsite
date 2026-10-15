# Ultra Corpotech Inc. website

The animated website for Ultra Corpotech Inc., the American subsidiary of Ultra Corpotech Pvt Ltd. Five pages (Home, About, Capabilities, Industries, Contact), built on the Ultra Corpotech design system: brand green `#00a972` on white, Bahnschrift (Barlow on the web) in Regular and Bold only, square full-bleed photography, no drop shadows, and the 8px green foot bar.

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

- **Contact details.** Replace the placeholders `[Street address]`, `[City, State ZIP]`, `[Phone]` and `[Email]` (footer of every page, the Contact page aside and offices), and `[City, State]` and `[Year]` on the About page.
- **Quote form.** The form validates and shows its confirmation, but a static site cannot send email. In `contact.html`, set `data-endpoint` on the `<form>` to your form handler's URL (Formspree, Netlify Forms, or your own endpoint). The script then posts the form, files included, and only shows the confirmation when the handler accepts it.

## How it is put together

```
index.html, about.html, capabilities.html, industries.html, contact.html
assets/css/site.css   design tokens (light and dark), layout, components, motion states
assets/js/site.js     the motion engine, canvases, line icons and the form
assets/img/           logos and photographs from the design system, plus WebP copies
assets/fonts/         Barlow Regular and Bold, latin and latin-ext (SIL Open Font License)
```

The header, menu, intro, page curtain and footer are identical on every page; change them in all five files.

### Motion

The motion language comes from the brand: the slides' slow upward push drives every reveal and the page transitions, the cover lockup grows from its centre on the first visit, the green foot bar becomes the scroll gauge (and the shutter that opens into the cover photograph), and the cover's plus grid becomes a field that reacts to the pointer.

| Where | What moves |
| --- | --- |
| Every page | First-visit intro, green page curtain between pages, scroll gauge along the foot, crosshair cursor whose frame locks onto links and buttons, magnetic buttons with rolling labels |
| Home | Plus-grid field, 3D wireframe gears that mesh and follow the pointer, foot bar that opens into the cover photo, rolling odometers, scroll-driven marquees, stacking capability strips, pinned horizontal "From Drawing to Delivery" with a truck along the foot bar, word-by-word vision quote, rising skyline |
| About | Datum ring around the mark, scroll-lit story, vision and mission cards that lock together, tilting cards, drawn glance table |
| Capabilities | Laser cutter that cuts parts from a plate (inner contours first) with a live X/Y readout, capacity visuals (450 squares for 450 machine tools), process chain that lights up as you scroll, stamped standards |
| Industries | Ten animated sector icons orbiting the mark, scroll-driven metro train |
| Contact | Handshake photo that opens from the centre, animated fields and file drop, a burst of plus crosses on sending |

The line icons and illustrations are drawn in code (one stroke weight, ink with a green accent) in the `ICONS` and `ARTS` tables in `site.js`; a page asks for one with `data-icon="wind"` or `data-art="weld"`.

### Accessibility

- With **prefers-reduced-motion**, or without JavaScript, every page renders complete and still: no intro, no curtain, nothing hidden waiting for a scroll.
- Automated browsers (link previews, screenshots) also get the still page.
- Text never goes below 13 pt (17.33px), green is never used for small text, and every interactive element shows the design system's focus ring.
- The site follows the visitor's light or dark setting using the design system's dark theme. On dark grounds the header and footer use the mark alone, as the logo rules require; the skyline bands always stay light.

### Brand notes

- Logos are the design system's files, unaltered: `lockup.png` on light grounds, `mark.png` / `mark-large.png` on their own.
- Photographs are full-bleed, square-cornered and untinted. The WebP copies are resized versions of the same images.
- Bahnschrift is used where it is installed (Windows); everywhere else the site falls back to Barlow.
