# F&L Media — Design System

> Wij zijn F&L Media. Makers van content, liefhebbers van magazines.

This design system captures the visual & editorial language of **F&L Media** (FNL Media), a Dutch magazine publisher based in Nijmegen. It's built directly from F&L's official 2023 brand assets — logo, color, type — combined with the voice and content patterns from fnlmedia.nl.

---

## About F&L Media

F&L Media is a young company with more than thirty years of experience. Started as a magazine publisher, today they run **nine magazine brands** covering computers, cooking, gardening, history, politics, philosophy, and cars. Their headquarters sits on the 16th floor of 52Nijmegen, "boven de wolken" (above the clouds).

**Core promise:** trustworthy content, made by humans, with personality and craft. *"Betrouwbaarheid staat voor ons bovenaan. Zeker nu er zoveel #@%$ geschreven wordt door machines."*

### The nine brands
| Brand | Focus | Tag |
|---|---|---|
| **Auto Review** | Automotive | Beleef het rijden |
| **iCreate** | Apple / gadgets | Alles voor je Apple |
| **c't magazine** | IT / professional | Hét magazine voor de IT-liefhebber |
| **Historisch Nieuwsblad** | History | Begrijp het heden, begin bij het verleden |
| **Gardeners' World** | Gardening | Voor elke tuinliefhebber |
| **Foodies** | Food culture | Fijne van eten |
| **Filosofie Magazine** | Philosophy | Filosoferen is makkelijker als je denkt |
| **Maarten!** | Opinion / politics | Op het scherpst van de snede |
| **koken & genieten** | Everyday cooking | Recepten voor elke dag |

This system focuses on the **F&L Media corporate brand**.

---

## Sources

- **Official 2023 logo SVGs** (horizontal + vertical)
- **F&L PowerPoint template** (FL [22-0808]) — extracted brand color and font scheme
- **fnlmedia.nl** — homepage, /over-ons/, /merken/ — voice, copy, brand portfolio

---

## Index

| File | Purpose |
|---|---|
| `README.md` | This document |
| `SKILL.md` | Agent-Skills entry point |
| `colors_and_type.css` | Drop-in CSS variables |
| `fonts/` | Sharp Grotesk Book 20 / Book 25 / SemiBold 25 |
| `assets/` | Logo (horizontal + vertical), wordmark, brand patterns |
| `preview/` | Design system preview cards |
| `ui_kits/website/` | Recreation of fnlmedia.nl |

---

## Content fundamentals

The F&L Media voice is **warm, confident, Dutch-direct, editorially proud**. It treats the reader as someone who already cares — never condescending, never breathless.

### Language
- **Dutch first.** Marketing copy is in Nederlands. English appears only in brand names (Gardeners' World, Foodies).
- **Sentence case** for headings. "Wij zijn F&L Media" — never "Wij Zijn F&L Media".
- **Person:** "we" / "ons" / "onze". Readers addressed as "je", not "u" — friendly, peer-to-peer.

### Tone
- **Plain, direct, unpretentious.** Short sentences. No corporate jargon.
- **Warm, slightly playful.** Comfortable with a punchy aside (`#@%$`).
- **Confident, not boastful.** "Dertig jaar ervaring" stated as fact.
- **Loves magazines.** Copy regularly nods to print heritage and the redactie.

### Casing & punctuation
- Sentence case everywhere.
- Brand names keep their stylings: `c't magazine`, `Maarten!`, `koken & genieten`, `Gardeners' World`.
- Use **F&L** with a real ampersand. `FNL` only in domains/file paths.
- Hashtags appear on news cards (`#samenwerking`, `#foodies`) — lowercase, no spaces.

### Examples
- **Headline:** *"Makers van content, liefhebbers van magazines"*
- **Sub:** *"Bij F&L Media combineren we persoonlijke passies met de passie voor magazines."*
- **Sharp aside:** *"Zeker nu er zoveel #@%$ geschreven wordt door machines."*
- **CTAs:** "Adverteren", "Werken bij", "Over Ons"

### Emoji
**Never** in marketing copy.

---

## Visual foundations

F&L Media's visual language is **clean, confident, Dutch-corporate**. Strong navy blue against bright white, large bold sans-serif headlines, a subtle geometric pattern in soft blue-grey for decorative space.

### Color
- **Primary blue:** `#004077` — the F&L brand blue, used for headlines, the logo, primary buttons, and large brand surfaces. This is *the* brand color.
- **Deep blue (ink):** `#001E3B` — body text. Never pure black.
- **Background:** pure white (`#FFFFFF`). The brand is white-grounded — clean, magazine-feeling, not warm-cream.
- **Soft tints:** `--blue-pale` (`#F0F4F8`) for section bands, `--blue-soft` (`#DCE7F0`) for hover backgrounds and quiet badges.
- **Pattern accents:** soft blue-grey (`#C9D6E0`, `#E5ECF2`) used inside the brand quarter-circle pattern.

### Typography
- **Display + body:** **`Sharp Grotesk`** — F&L's official typeface family.
  - `Sharp Grotesk SemiBold 25` for h1–h4, display, buttons, the logo wordmark.
  - `Sharp Grotesk Book 20` for body copy and UI.
  - `Sharp Grotesk Book 25` for slightly heavier body / lede contexts.
- **Mono:** `JetBrains Mono` — only for code / dev surfaces.

Sharp Grotesk is a closed/uniform-grotesque with characterful geometric corners — it carries both display weight (large headlines) and body weight (running copy). The brand uses a **single typeface family** across the system; no serif pairing.

### Spacing
4px base scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128`.

### Layout
- 12-col grid, `--container-max: 1200px`.
- Generous whitespace. Big headlines sit alone or against the brand pattern.

### Backgrounds
- White is the default page surface.
- The **F&L pattern** (`assets/pattern-frame.png`, `pattern-strip.png`) — repeating quarter-circle "petals" in soft blue-grey — is the signature decorative element. Used as a frame around hero areas, as a top/bottom strip on section transitions, or behind centered title slides.
- No gradients. No textured/painted backgrounds. No photographic full-bleeds in the corporate identity (those belong to the individual magazines).

### Imagery
- The corporate brand is **graphic, not photographic**. Logos, patterns, type — not stock photos.
- Magazine sub-brands carry their own imagery; reach for it only when speaking *as* a magazine, not as F&L Media.

### Borders & corners
- **Radius:** `4px` for buttons, `8px` for cards, `0` for full-bleed sections.
- 1px hairlines in `--ink-12` for dividers.

### Shadows
- **Cards:** `0 1px 2px rgba(0,30,59,.04), 0 8px 24px rgba(0,30,59,.06)` — feathery, blue-tinted.
- **Floating menus:** `0 12px 40px rgba(0,30,59,.18)`.
- No inner shadows, no glassmorphism stacks.

### Hover states
- **Links:** color shifts `blue` → `blue-dark`, underline thickens.
- **Cards:** lift 2px, soft shadow upgrade.
- **Buttons:** background `blue` → `blue-dark`. No size change.
- **Hashtag chips:** background fills `blue-soft`.

### Press states
- Buttons: `transform: translateY(1px)`. No scale, no spring.

### Animation
- **Easing:** `cubic-bezier(.2, .6, .2, 1)` (custom) or `ease-out`.
- **Durations:** 150ms for state changes, 300ms entrance/exit.
- No bounces. No spring physics. Editorial calm.
- Reduce-motion respected.

### Transparency & blur
- Sticky header gets `backdrop-filter: blur(12px)` on `--paper / 0.92` when scrolled. Nowhere else.

### Fixed elements
- Sticky top header (logo + nav + "Adverteren" CTA).
- No floating chat widgets, cookie banners, etc.

---

## Iconography

F&L Media is a **minimal-icon** brand. The corporate site relies on:
- **The wordmark logo** ("F&L Media" set in Sharp Grotesk SemiBold, in brand blue) — see `assets/logo-horizontal.svg`, `assets/logo-vertical.svg`, `assets/wordmark.png`.
- **The geometric pattern** (`assets/pattern-frame.png`) — the unofficial second brand mark, made of repeating quarter-circle "petals". Use it for decorative scaffolding around hero sections.
- **Hashtag glyphs** (`#`) — textual category badges, treated as part of the typography.
- **Inline UI icons:** small line icons for menu, close, social (LinkedIn), contact (phone, mail, map-pin) — 1.5px stroke, rounded caps.

### Icon system
- **Lucide** (CDN) — `https://unpkg.com/lucide@latest`.
- **Used for:** menu, close, arrow-right (link affordance), linkedin, mail, phone, map-pin.
- **Not used for:** decorative iconography on cards.

### Emoji
**Never used.**

### Unicode marks
- `&` is sacred — always in `F&L`.
- `#` is the textual badge.
- Em-dash `—` over en-dash and double-hyphens.

---

## How to use

Read this README + `colors_and_type.css`. For visual artifacts, copy assets out of `assets/` and import the CSS. For React work, see `ui_kits/website/` for component patterns.

When in doubt: **clean, confident, blue, magazine-grade**. If a design feels like a tech startup, you've drifted.
