# Masellas Design System
Design system extracted from **masellas.info** — the personal résumé site of Roger Masellas (frontend developer, founding member of design studio Lamosca sccl, university teacher).

## Sources
- GitHub: `rogeraclaro/masellas.info` @ `main` (https://github.com/rogeraclaro/masellas.info) — root `index.html`, `css/styles.css`, `css/fullpage.css`, `qr.html`, `tipos/`, `icons/`, `img/`.
- Not used: `/christian/` sub-site (Torre de la Fullola olive-oil brand — different identity: Anton/Jost/Lora, olive + cream). `_index.html` (scratch "Hola!" page).

## Product
One surface: a two-slide, full-viewport résumé site built on fullPage.js 3.0.3 (continuousVertical). Slide 1 "the point" (coral): name + CV/LinkedIn links. Slide 2 "some words" (charcoal): short bio + email. Plus `qr.html`, a QR code on full coral.

## CONTENT FUNDAMENTALS
- **Voice:** first person, plain, a little dry/self-deprecating. "My PDF resumé:", "My LinkedIn profile: here", "(and debates)", "(most updated cv in english)".
- **Casing:** menu labels all lowercase ("the point", "some words"). Body in sentence case. Names in Title Case.
- **Language:** English primary (OG title in Spanish: "Desarrollador Frontend"); CA/ES CVs exist but are struck through as out of date — honesty over polish.
- **Links as words:** link text is short and literal ("EN", "here", "Lamosca sccl"). Email is obfuscated in prose: "roger at lamosca.com".
- **No emoji, no exclamation, no marketing.** Copy is sparse — a heading and two lines per slide.

## VISUAL FOUNDATIONS
- **Color:** two flat grounds — coral `#f4624e` and charcoal `#272525` — with bone `#e4e1ce` text. `#ff401a` only seeds the link shadow. theme-color/tile = coral. No gradients, no tints.
- **Type:** Avant-Garde-like geometric grotesque "aglt" in book / medium / bold (custom webfonts, single-weight families each). h1 agltbold 3em, -2px tracking, **always underlined**. Paragraphs agltbook 1.5em, -1px tracking. Base 22/26 agltmedium. Tight negative tracking everywhere. `jmtregular` is declared but unused.
- **Layout:** every view is one 100vh slide, content vertically centered. Coral slide centered text; dark slide left-aligned text in a 50%-wide centered column. Fixed menu top-left. Mobile (≤640px) scales type UP (h1 5em, p 2.5em, menu 36px stacked).
- **Backgrounds:** solid color only. No imagery, textures, patterns, or illustration.
- **Motion:** slide change = vertical translate, 700ms ease (fullPage default), looping. Links: 0.25s ease-in-out.
- **Hover:** links flood with a solid block via `box-shadow: inset 500px 0 0 0` (coral slide: charcoal block, bone text, padding 10→22px; dark slide: bone block, charcoal text). Menu tabs: white 50%→80%.
- **Press:** none defined.
- **Borders / radii / shadows:** none. Radius 0. Shadow only as an inset fill — never elevation.
- **Transparency:** only menu tabs (rgba white .5/.8, black .5 active). No blur.
- **Cards:** none exist. Don't invent them.
- **Imagery:** OG image = name on coral. No photography.

## ICONOGRAPHY
- No icon system is used on the live page. `tipos/` ships Font Awesome and Glyphicons webfonts but nothing references them — not imported.
- Brand mark: "RM" monogram, underlined, charcoal on coral — raster favicons only (`assets/icons/*.png`) plus `safari-pinned-tab.svg` (mask icon). No vector logo; where a logo is needed, set "Roger Masellas" in agltbold, underlined.
- No emoji, no unicode glyph icons. Separators are plain "/".

## Index
- `styles.css` — entry (imports only) → `tokens/fonts.css, colors.css, typography.css, spacing.css, motion.css`
- `assets/fonts/` aglt book/medium/bold, jmt · `assets/icons/` favicons · `assets/img/` og-image.jpg, qr.svg
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/core/` — components (card: `core.card.html`)
- `ui_kits/website/` — masellas.info recreation
- `SKILL.md`, `github.md`, `thumbnail.html`

## Components
- **Section** — full-viewport coral/dark slide
- **Heading** — underlined agltbold h1
- **Paragraph** — lead / intro copy
- **WipeLink** — inset-shadow wipe hover link (coral / dark tones)
- **Menu** — fixed translucent tab menu

### Intentional additions
None — each maps to a source selector (`.section`, `h1`, `p` / `.intro p`, `p a` / `.intro a`, `#menu`).
