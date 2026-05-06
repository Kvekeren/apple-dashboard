# F&L Media — Website UI Kit

A pixel-grade reference recreation of the **fnlmedia.nl** corporate marketing site.

## What's in here

- `index.html` — interactive demo page; click navigation, scroll through the magazine grid, see the editorial layout in action.
- `Header.jsx` — sticky top nav with logo, nav items, "Adverteren" CTA.
- `Hero.jsx` — masthead headline + lede + meta strip.
- `MagazineGrid.jsx` — the asymmetric news/brand card grid (the homepage's signature layout).
- `Card.jsx` — the editorial card: hashtag chips + headline, optional image.
- `BrandTile.jsx` — flat brand tile used on the /merken/ page.
- `Footer.jsx` — multi-column footer with address, navigation, and legal links.
- `data.js` — content lifted directly from fnlmedia.nl (headlines, hashtags, links).

## Notes
- All copy is real F&L Media content (sourced from the marketing site). Brand names, tags, and headlines are preserved exactly.
- Image thumbnails fall back to brand-color tiles since the live `app/uploads/` paths can't be loaded from the sandbox.
- The kit is cosmetic. There's no real CMS, search, or routing.
