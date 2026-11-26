Rebuild this design in your project. Match it exactly: same layout,
typography, color, spacing, radius, shadow, and motion. Do not invent
new visuals.

## design.md

# Cinematic 3 — Style Reference
> Cinematic: A dark stage lit like a film still: full-bleed photography, a vide…

**Theme:** light

A dark stage lit like a film still: full-bleed photography, a video frame or one dramatically lit object fills the screen, with oversized type set over or beside it. Chrome is minimal and translucent, light falls on what matters, and fine grain and deep shadow give scale; a night sky, a city at dusk or a product under a spotlight all fit. Near-black grounds that take their tint from the imagery, warm amber or cold blue; color comes from the photography and its light, plus one restrained accent for action. Text over images sits on a soft dark scrim. A large, confident display face (a sharp serif or a heavy grotesk) for headlines, with a small, light grotesk for everything else.

**Ground truth (computed from tokens + reference HTML):** light theme · page #fdf6ee · ink #2d1a08 · primary #b8620a · secondary #e8a040 · applied action color #e8a040 · display "Noto Sans JP" · body "Noto Serif JP". Where the description above conflicts with these values or the Reference HTML, the tokens and HTML are authoritative.

## Tokens: Colors

| Name | Value | Token | Role | Usage | Contrast |
|------|-------|-------|------|-------|----------|
| Canvas | `#fdf6ee` | `--gesso-canvas` | Page background, the floor everything sits on. | Outermost background: body, full-bleed sections. Mirrors Neutral 50. | n/a |
| Surface recessed | `#f3ece4` | `--gesso-surface-recessed` | Sunken surface below the canvas. | Inset wells: input fields, progress tracks, code blocks. | n/a |
| Surface | `#fff8f0` | `--gesso-surface` | Card and panel fill, raised above the canvas. | Cards, panels, sheets, table rows. Mirrors Neutral 100. | n/a |
| Surface elevated | `#f5eee6` | `--gesso-surface-elevated` | Top elevation tier. | Modals, dropdowns, popovers, tooltips. | n/a |
| Divider | `rgba(0,0,0,0.04)` | `--gesso-divider` | Hairline borders and separators. | 1px rules between rows and sections. Never for text. | n/a |
| Foreground | `#2d1a08` | `--gesso-fg` | Primary text and high-emphasis icons. | Body copy, headings, primary icons. Mirrors Neutral 900. | AA 4.5:1 on canvas (guaranteed) |
| Foreground muted | `#7a5a3a` | `--gesso-fg-muted` | Secondary text. | Captions, metadata, placeholders, disabled labels. Mirrors Neutral 600. | AA 3.0:1 on canvas (guaranteed) |
| Primary | `#b8620a` | `--gesso-primary` | Brand accent, FILL only (alias: --gesso-accent). | CTA fills, active and selected states, focus rings. 2 to 3 per screen. Do NOT use as text, reach for --gesso-accent-text. | Pair with --gesso-on-accent for the label on top. |
| On primary | `#000000` | `--gesso-on-accent` | Text and icons on a filled primary. | Label color for buttons and chips filled with --gesso-primary. | Contrast-derived against --gesso-primary. |
| Accent (as text) | `#a65809` | `--gesso-accent-text` | AA-safe accent for text and icons. | Use THIS for accent-colored links, headings, and icons. Use --gesso-primary for fills. | AA 4.5:1 on canvas (guaranteed). |
| Secondary | `#e8a040` | `--gesso-secondary` | Supporting brand accent. | Secondary fills, logo discs, supporting highlights. | Pair with on-fill text per --gesso-on-accent. |
| Secondary (as text) | `#97682a` | `--gesso-accent-2-text` | AA-safe secondary for text. | Secondary accent used as text or icons. | AA 4.5:1 on canvas (guaranteed). |
| Neutral 50 | `#fdf6ee` | `--gesso-neutral-50` | Page background. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 100 | `#fff8f0` | `--gesso-neutral-100` | Surface. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 200 | `#e3d7c9` | `--gesso-neutral-200` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 300 | `#c8b6a3` | `--gesso-neutral-300` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 400 | `#ad977f` | `--gesso-neutral-400` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 500 | `#93785c` | `--gesso-neutral-500` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 600 | `#7a5a3a` | `--gesso-neutral-600` | Muted text and dividers. | Ramp access by step; prefer the role token above where one exists. | AA 3.0:1 on canvas. |
| Neutral 700 | `#5f4328` | `--gesso-neutral-700` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 800 | `#452e18` | `--gesso-neutral-800` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Neutral 900 | `#2d1a08` | `--gesso-neutral-900` | Primary text. | Ramp access by step; prefer the role token above where one exists. | AA 4.5:1 on canvas. |
| Neutral 950 | `#281707` | `--gesso-neutral-950` | Neutral ramp step. | Ramp access by step; prefer the role token above where one exists. | n/a |
| Success | `#149343` | `--gesso-success` | Positive signals (gains, completed states). | Meaning only, never decoration. | AA 3.0:1 on canvas, chroma-floored distinct. |
| Warning | `#c36b05` | `--gesso-warning` | Caution states. | Meaning only, never decoration. | AA 3.0:1 on canvas, chroma-floored distinct. |
| Error | `#DC2626` | `--gesso-error` | Errors, destructive actions, negative signals. | Meaning only, never decoration. | AA 3.0:1 on canvas, chroma-floored distinct. |
| Data 1 | `#814200` | `--gesso-data-1` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |
| Data 2 | `#a25400` | `--gesso-data-2` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |
| Data 3 | `#c06919` | `--gesso-data-3` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |
| Data 4 | `#db8239` | `--gesso-data-4` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |
| Data 5 | `#f79b54` | `--gesso-data-5` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |
| Data 6 | `#ffbe8f` | `--gesso-data-6` | Categorical data-viz series color. | Charts and series, applied in order. | n/a |

## Tokens: Typography

### Noto Sans JP — Display. Headings, hero copy, large numerical specimens. · `--gesso-font-display`
- **Weights:** 400, 500, 600, 700
- **Line height:** 1.1
- **Letter spacing:** -0.02em
- **Role:** Display. Headings, hero copy, large numerical specimens.

### Noto Serif JP — Body. Paragraphs, labels, UI chrome. · `--gesso-font-body`
- **Weights:** 400, 500, 600, 700
- **Line height:** 1.5
- **Letter spacing:** 0em
- **Role:** Body. Paragraphs, labels, UI chrome.

### Geist — Mono. Code, numerical tickers, mono-spaced metadata. · `--gesso-font-mono`
- **Weights:** 400, 500, 600, 700
- **Line height:** 1.4
- **Letter spacing:** 0em
- **Role:** Mono. Code, numerical tickers, mono-spaced metadata.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| H1 | 48px | 1.2 | — | `--gesso-text-4xl` |
| H2 | 36px | 1.2 | — | `--gesso-text-3xl` |
| H3 | 28px | 1.2 | — | `--gesso-text-2xl` |
| Body | 16px | 1.5 | — | `--gesso-text-base` |
| Caption | 12px | 1.5 | — | `--gesso-text-xs` |

## Tokens: Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| space-1 | 4px | `--gesso-space-1` |
| space-2 | 8px | `--gesso-space-2` |
| space-3 | 12px | `--gesso-space-3` |
| space-4 | 16px | `--gesso-space-4` |
| space-6 | 24px | `--gesso-space-6` |
| space-8 | 32px | `--gesso-space-8` |
| space-12 | 48px | `--gesso-space-12` |
| space-16 | 64px | `--gesso-space-16` |
| space-24 | 96px | `--gesso-space-24` |
| space-32 | 128px | `--gesso-space-32` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |
| sm | 4px |
| md | 8px |
| lg | 16px |
| full | 9999px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| sm | `0 1px 2px rgba(0,0,0,0.05)` | `--gesso-shadow-sm` |
| md | `0 4px 12px rgba(0,0,0,0.08)` | `--gesso-shadow-md` |
| lg | `0 16px 40px rgba(0,0,0,0.12)` | `--gesso-shadow-lg` |

## Components

### Card
**Role:** Container surface for content groupings.

Background --gesso-neutral-50 (#fdf6ee), border 1px solid --gesso-neutral-200 (#E4E4E7), border-radius var(--gesso-radius-md) (8px), padding 16px, --gesso-shadow-sm. Body font for content; display font for any embedded headline. Text fg --gesso-neutral-900 (#2d1a08).

### Primary Button
**Role:** Highest-emphasis action. Reserved for the main CTA per screen.

Background --gesso-primary (#b8620a), text auto-picked for max contrast (white or near-black), padding 12px 24px, border-radius var(--gesso-radius-md) (8px), font-family --gesso-font-body, font-weight 600. Hover: mix toward --gesso-fg by 10-12%. Use 1-2 per screen, never more. The reference screen applies #e8a040 as its dominant on-screen action color; follow the Reference HTML for color application.

### Secondary Button
**Role:** Supporting action next to a primary CTA.

Background transparent, border 1.5px solid --gesso-primary (#b8620a), text --gesso-primary, padding 12px 24px (minus 1.5px each axis to compensate for the border), border-radius var(--gesso-radius-md) (8px), body font, weight 600.

### Input
**Role:** Single-line text entry. Default form field.

Background --gesso-neutral-100 (#fff8f0), border 1px solid --gesso-neutral-300 (#D4D4D8), border-radius var(--gesso-radius-md) (8px), padding 12px 16px, font-size 16px (prevents iOS zoom), body font. Focus: border --gesso-primary, ring 3px --gesso-primary at 14% alpha.

### Badge
**Role:** Compact label for status, tags, counts.

Background --gesso-primary (#b8620a) at 12% alpha, text --gesso-primary, padding 8px 12px, border-radius var(--gesso-radius-full) (9999px), font-size 12px, body font, weight 600, uppercase, letter-spacing 0.04em.

### Modal
**Role:** Focus-stealing overlay for confirmations or short flows.

Background --gesso-neutral-50 (#fdf6ee), border 1px solid --gesso-neutral-200, border-radius var(--gesso-radius-lg) (16px), padding 24px, --gesso-shadow-lg. Backdrop: fg at 40% alpha + blur 12px. Max-width 480px on mobile, 560px on desktop.

### Nav Item
**Role:** Single entry in a navigation list (sidebar, top bar, or tab row).

Padding 8px 12px, border-radius var(--gesso-radius-sm) (4px), text --gesso-neutral-700 (#3F3F46), body font, weight 400. Hover: bg --gesso-neutral-100. Active: bg --gesso-primary at 12% alpha, text --gesso-primary, weight 600.

### Avatar
**Role:** Identity surface for users / accounts / brands.

Background --gesso-secondary (#e8a040), text auto-picked for contrast on secondary, border-radius var(--gesso-radius-full) (9999px), aspect-ratio 1:1. Size variants: 24/32/40/48px. Initials at body weight 600, sized to ~40% of the avatar diameter.

## Do's and Don'ts

### Do

- Open every screen with an image, frame or lit object that fills the width
- Set the headline large over the image on a soft dark scrim for contrast
- Keep controls few, small and translucent so the image stays the subject
- Pace content as scenes: one idea and one image per section
- Apply --gesso-primary (#b8620a) to a maximum of 2-3 elements per screen: a button, a highlight, a badge. Never paint large areas with primary.
- Use --gesso-radius-md (8px) for cards and inputs, --gesso-radius-full for badges and avatars. Inner radii inside a parent: subtract the parent's padding from its radius.

### Don't

- Use a flat white ground or small boxed thumbnails as the main image
- Crowd scenes with cards, badges or icon grids
- Use cheerful stock photography or bright chrome that competes with the image
- Signal premium with gold, brass, bronze or champagne, metallic gradients or foil; let the grid, generous space, scale and restraint carry it, and use a metallic hue only when the user names it
- Don't use Inter as the display font. It's the most overused font in tech. Pick something with character from the fontHints display list.
- Don't use #3B82F6 / indigo-600 as primary unless explicitly briefed. Default blue is the hallmark of a generic SaaS aesthetic.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page | `#fdf6ee` | Default page background. The lightest surface. |
| 1 | Raised | `#fff8f0` | Cards, panels, sidebars: anything that sits on top of the page. |
| 2 | Sunken | `#E4E4E7` | Inset surfaces (search bars, code blocks, disabled fields). |
| 3 | Overlay | `#fdf6ee` | Modals and floating panels. Same hue as page; depth comes from --gesso-shadow-lg. |

## Agent Prompt Guide

**Quick Color Reference**

- Primary: #b8620a
- Secondary: #e8a040
- Page bg: #fdf6ee
- Body fg: #2d1a08
- Muted fg: #7a5a3a
- Success: #149343

**Example Component Prompts**

1. Build a card component. Background #fdf6ee, border 1px solid #E4E4E7, border-radius 8px, padding 16px, body font (Noto Serif JP), text color #2d1a08. Use Tailwind v4 arbitrary values: bg-[#fdf6ee].

2. Build a primary button. Background #b8620a, text white (or #2d1a08 if primary is light), padding 12px 24px, border-radius 8px, font weight 600, hover: shift bg toward #2d1a08 by 10%.

3. Build a heading hierarchy (CSS-standard roles). H1: 48px display font (Noto Sans JP) weight 700, H2: 36px, H3: 28px, Body: 16px body font (Noto Serif JP), Caption: 12px, color #2d1a08.

4. Build a form input. Background #fff8f0, border 1px solid #D4D4D8, border-radius 8px, padding 12px 16px, font-size 16px, focus border #b8620a.

5. Build a navigation bar. Background #fdf6ee, items at color #3F3F46 body weight, hover bg #fff8f0, active item color #b8620a weight 600.

## Flow: Flow

> Prompt: "Design the primary user flow for "Cinematic 3"."

### 1. Cinematic 3

- Role: primary
- Purpose: Source screen the flow starts from.

<details><summary>HTML</summary>

```html
<!doctype html>
<html lang="ja"><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto%20Sans%20JP:wght@400;500;600;700&family=Noto%20Serif%20JP:wght@400;500;600;700&family=Geist:wght@400;500;600;700&display=swap"><style id="gesso-direct-faces">:root{--gesso-font-display:"Noto Sans JP", system-ui, -apple-system, sans-serif;--gesso-font-body:"Noto Serif JP", system-ui, -apple-system, sans-serif;}</style><style id="gesso-link-reset">:where(a){color:inherit;text-decoration:none}</style>
<meta name="gesso-pipeline" content="direct">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>わたしの本棚の手帖 — Bookshelf</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&amp;family=Noto+Serif+JP:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
:root{
  --gesso-canvas:#fdf6ee;
  --gesso-surface:#fff8f0;
  --gesso-fg:#2d1a08;
  --gesso-fg-muted:#7a5a3a;
  --gesso-accent:#b8620a;
  --gesso-on-accent:#06201a;
  --gesso-accent-2:#e8a040;
  --gesso-divider:#e2cdb0;
  --font-display:"Sentient","Noto Serif JP",serif;
  --font-body:var(--gesso-font-mono),"Noto Sans JP",sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{background:var(--gesso-canvas)}
body{
  min-height:100vh;
  background:var(--gesso-canvas);
  color:var(--gesso-fg);
  font-family:var(--font-body);
  font-weight:400;
  padding:44px 0 132px;
}
.ic{width: 16px;height: 16px;flex:none}
.ic-lg{width: 24px;height: 24px;flex:none}
.ic-xl{width: 32px;height: 32px;flex:none}

/* ---------- fixed header over the shelf image ---------- */
.head{
  position:fixed;top:44px;left:0;right:0;z-index:30;
  padding:14px 20px 46px;
  background:linear-gradient(180deg,rgba(11,17,21,.94) 0%,rgba(11,17,21,.72) 62%,rgba(11,17,21,0) 100%);
}
.head-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.kicker{
  font-size:10px;letter-spacing:.22em;color:var(--gesso-fg-muted);
  font-weight:400;margin-bottom:7px;
}
.title-row{display:flex;align-items:baseline;gap:10px}
h1{
  font-family:var(--font-display);font-weight:500;font-size:34px;line-height:1.1;
  letter-spacing:.02em;color:var(--gesso-fg);
}
.count{font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.06em}
.head-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-top:14px}
.btn-scan{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  font:600 12.5px/1 var(--font-body);letter-spacing:.04em;
  padding:10px 16px;border-radius:999px;border:none;cursor:pointer;
}
.scan-hint{font-size:10px;color:var(--gesso-fg-muted);letter-spacing:.08em}

/* ---------- shelf scene ---------- */
.shelf{position:relative}
.scene{
  position:relative;
  background:
    repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 2px,transparent 2px 9px,rgba(255,255,255,.03) 9px 10px,transparent 10px 30px),
    linear-gradient(180deg,#2a1e14,#191108);
}
.wood{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  filter:brightness(.58) contrast(1.05) saturate(.85);
}
.grain{
  position:absolute;inset:0;pointer-events:none;opacity:.07;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>");
}
.bay{position:relative;padding-top:134px}
.board{
  position:relative;z-index:2;height:12px;margin:0 0 0 0;border-radius:2px;
  background:linear-gradient(180deg,#8a6642 0,#5f432a 40%,#31231500 100%);
  background-color:#5f432a;
  box-shadow:0 12px 26px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,235,205,.25);
}
.board.top{
  height:9px;margin:0 0 2px;
  background:linear-gradient(180deg,#3a2a1b,#241a11);
  box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,235,205,.14);
}
.rail{
  position:relative;z-index:1;
  display:flex;align-items:flex-end;gap:6px;
  height:244px;padding:0 22px;
  overflow-x:auto;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);
}
.rail::-webkit-scrollbar{display:none}
.run{display:flex;align-items:flex-end;gap:6px;flex:none;padding-right:36px}

/* ---------- spines ---------- */
.sp,.sp-d{
  position:relative;flex:none;
  width:var(--w,48px);height:var(--h,210px);
  border-radius:3px 3px 2px 2px;
  background:
    linear-gradient(90deg,rgba(0,0,0,.32),rgba(255,255,255,.07) 16%,rgba(0,0,0,0) 46%,rgba(0,0,0,.24)),
    var(--c,#33424e);
  box-shadow:inset -2px 0 3px rgba(0,0,0,.4), 3px 0 4px rgba(0,0,0,.38);
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:12px 0 9px;
  cursor:pointer;user-select:none;
  transition:transform .25s ease, box-shadow .25s ease;
}
.sp .t,.sp-d .t{
  writing-mode:vertical-rl;text-orientation:mixed;
  font:500 12.5px/1.15 var(--font-body);letter-spacing:.14em;
  color:rgba(238,241,240,.94);
}
.sp .a,.sp-d .a{
  writing-mode:vertical-rl;
  font:400 8.5px/1 var(--font-body);letter-spacing:.12em;
  color:rgba(238,241,240,.5);
}
.prog{
  position:absolute;left:0;bottom:0;height:3px;width:var(--p,0%);
  background:var(--gesso-accent);border-radius:0 2px 2px 0;opacity:.95;
}
.sp.cd,.sp-d.cd{width:20px;padding:9px 0 7px;border-radius:2px}
.sp.cd .t,.sp-d.cd .t{font-size:8.5px;letter-spacing:.1em;line-height:1.2}
.sp.dvd,.sp-d.dvd{width:26px}
.sp.dvd .t,.sp-d.dvd .t{font-size:10px}
.sp.dvd .a,.sp-d.dvd .a{font-size:8px}
.sp-add{
  flex:none;width:38px;height:192px;border-radius:3px;
  border:1.5px dashed rgba(163,175,179,.42);
  background:rgba(21,29,35,.35);
  display:flex;align-items:center;justify-content:center;
  color:var(--gesso-fg-muted);
}
.srx{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}

/* lifted (tapped) spine */
.shelf:has(#b-fune:checked) .sp-fune,
.shelf:has(#b-santi:checked) .sp-santi,
.shelf:has(#b-kokuhaku:checked) .sp-kokuhaku,
.shelf:has(#b-waltz:checked) .sp-waltz,
.shelf:has(#b-sen:checked) .sp-sen{
  transform:translateY(-16px);
  box-shadow:
    0 0 0 1px rgba(63,184,160,.45),
    0 18px 32px rgba(0,0,0,.6),
    0 8px 22px rgba(63,184,160,.14),
    inset -2px 0 3px rgba(0,0,0,.4);
}
.shelf:has(#b-fune:focus-visible) .sp-fune,
.shelf:has(#b-santi:focus-visible) .sp-santi,
.shelf:has(#b-kokuhaku:focus-visible) .sp-kokuhaku,
.shelf:has(#b-waltz:focus-visible) .sp-waltz,
.shelf:has(#b-sen:focus-visible) .sp-sen{
  outline:2px solid var(--gesso-accent);outline-offset:3px;
}
.scroll-hint{
  position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:6px;
  padding:10px 0 14px;
  font-size:10px;letter-spacing:.18em;color:var(--gesso-fg-muted);
}
.scene-fade{
  position:relative;z-index:3;height:52px;margin-top:-30px;pointer-events:none;
  background:linear-gradient(180deg,rgba(11,17,21,0),var(--gesso-canvas));
}

/* ---------- filter chips ---------- */
.chips{
  display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;
  padding:2px 20px 4px;
}
.chips::-webkit-scrollbar{display:none}
.chip{
  flex:none;display:inline-flex;align-items:baseline;gap:7px;
  padding:9px 14px;border-radius:999px;
  border:1px solid var(--gesso-divider);background:rgba(21,29,35,.72);
  font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.04em;
}
.chip b{font-weight:500;font-size:11px;color:var(--gesso-fg);font-family:var(--font-body)}
.chip.on{background:var(--gesso-fg);border-color:var(--gesso-fg);color:#0b1115}
.chip.on b{color:#0b1115}
.chip-cap{
  display:flex;align-items:center;gap:6px;
  padding:9px 22px 0;font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.05em;
}
.chip-cap .ic{width: 16px;height: 16px;color:var(--gesso-accent-2)}

/* ---------- detail card ---------- */
.detail{display:none}
.shelf:has(#b-fune:checked) #d-fune,
.shelf:has(#b-santi:checked) #d-santi,
.shelf:has(#b-kokuhaku:checked) #d-kokuhaku,
.shelf:has(#b-waltz:checked) #d-waltz,
.shelf:has(#b-sen:checked) #d-sen{
  display:block;animation:rise .32s ease;
}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card{
  margin:14px 20px 26px;
  background:var(--gesso-surface);
  border:1px solid var(--gesso-divider);
  border-radius:20px;
  padding:20px 20px 18px;
  box-shadow:0 20px 44px rgba(0,0,0,.35);
}
.d-top{display:flex;align-items:center;gap:7px}
.tag{
  font:500 9.5px/1 var(--font-body);letter-spacing:.2em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;
  border:1px solid rgba(216,154,106,.4);color:var(--gesso-accent-2);
}
.tag.st{
  border:1px solid rgba(63,184,160,.35);color:var(--gesso-accent);
  background:rgba(63,184,160,.1);text-transform:none;letter-spacing:.1em;
}
.d-memo{
  margin-left:auto;display:inline-flex;align-items:center;gap:6px;
  font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.05em;
}
.d-memo .ic{width: 16px;height: 16px;color:var(--gesso-accent-2)}
.card h2{
  font-family:var(--font-display);font-weight:500;font-size:27px;line-height:1.2;
  letter-spacing:.01em;margin:14px 0 3px;color:var(--gesso-fg);
}
.d-author{font-size:13px;color:var(--gesso-fg-muted);letter-spacing:.04em}
.d-sub{font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.12em;margin-top:3px}
.meter{
  height:5px;border-radius:999px;background:rgba(38,50,58,.9);
  margin-top:16px;overflow:hidden;
}
.meter i{display:block;height:100%;border-radius:999px;background:var(--gesso-accent)}
.d-stats{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px}
.d-stats .l{font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.05em}
.d-stats .r{font-size:16px;font-weight:600;color:var(--gesso-accent);letter-spacing:.02em}
.d-meta{
  display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  border-top:1px solid var(--gesso-divider);
  margin-top:14px;padding-top:11px;
}
.d-meta span{font-size:9.5px;letter-spacing:.2em;color:var(--gesso-fg-muted);text-transform:uppercase}
.d-meta b{font-size:12.5px;font-weight:400;color:var(--gesso-fg);letter-spacing:.04em}
.d-actions{display:flex;gap:10px;margin-top:16px}
.btn-acc{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  font:600 12.5px/1 var(--font-body);letter-spacing:.03em;
  padding:11px 16px;border-radius:999px;border:none;cursor:pointer;
}
.btn-ghost{
  display:inline-flex;align-items:center;gap:4px;
  background:transparent;color:var(--gesso-fg-muted);
  font:400 12.5px/1 var(--font-body);letter-spacing:.03em;
  padding:11px 14px;border-radius:999px;border:1px solid var(--gesso-divider);cursor:pointer;
}

/* ---------- bottom tab bar ---------- */
.tabs{
  position:fixed;left:0;right:0;bottom:0;z-index:40;
  display:flex;align-items:center;justify-content:space-around;
  padding:10px 14px calc(10px + env(safe-area-inset-bottom));
  background:rgba(21,29,35,.92);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-top:1px solid var(--gesso-divider);
}
.tab{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  text-decoration:none;color:var(--gesso-fg-muted);
  font-size:10px;letter-spacing:.08em;min-width:52px;
}
.tab .ic{width: 16px;height: 16px}
.tab[aria-current="page"]{color:var(--gesso-accent)}
.tab-scan{
  width:54px;height:54px;border-radius:50%;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  display:flex;align-items:center;justify-content:center;
  transform:translateY(-16px);
  box-shadow:0 12px 26px rgba(63,184,160,.3),0 4px 10px rgba(0,0,0,.4);
}
</style>
<style>/* gesso-icon-base v1 */
.ic { display: inline-block; width: 16px; height: 16px; vertical-align: -0.125em; flex-shrink: 0; line-height: 0; }
.ic svg { width: 100%; height: 100%; display: block; }
svg.ic { width: 16px; height: 16px; display: inline-block; vertical-align: -0.125em; flex-shrink: 0; }
.ic[data-icon-style="line"] { stroke-width: var(--ic-stroke, 2); }
.ic[data-icon-style="line"] svg path, .ic[data-icon-style="line"] svg circle, .ic[data-icon-style="line"] svg rect, .ic[data-icon-style="line"] svg line, .ic[data-icon-style="line"] svg polyline, .ic[data-icon-style="line"] svg polygon { stroke-width: inherit; }
.ic-sm { --ic-stroke: 2.25; }
.ic-xs { --ic-stroke: 2.5; }
svg.ic-lg, .ic-lg svg { width: 24px; height: 24px; }
svg.ic-xl, .ic-xl svg { width: 32px; height: 32px; }
svg.ic-2xl, .ic-2xl svg { width: 32px; height: 32px; }
.ic-lg { --ic-stroke: 1.75; }
.ic-xl { --ic-stroke: 1.5; }
.ic-2xl { --ic-stroke: 1.5; }
</style>
<style id="gesso-overflow-guard">html,body{overflow-x:clip!important}</style>
<style id="comment-css-card-2-mwv7unu6">[data-brief-id="card-2"] {
  background: linear-gradient(180deg, #c8a46e 0%, #a07840 20%, #7a5a2a 50%, #5c3f1a 80%, #2e1e0800 100%) !important;
  background-color: #8a6030 !important;
  box-shadow: 0 12px 26px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,245,220,.30), inset 0 -1px 0 rgba(0,0,0,.4) !important;
}</style><style id="frame-edit-restyle">/* ── 木材写真を棚シーンの背景に使用 ── */
.scene {
  background:
    /* gloss coating highlight */
    radial-gradient(ellipse 70% 38% at 42% 36%, rgba(255,248,220,.18) 0%, transparent 68%),
    /* lacquer sheen overlay */
    linear-gradient(175deg, rgba(255,245,200,.10) 0%, transparent 55%, rgba(0,0,0,.08) 100%) !important;
  background-color: #8b4a06 !important;
}

/* wood photo — full brightness, saturated, warm */
.wood {
  filter: brightness(.92) contrast(1.08) saturate(1.18) !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

/* grain overlay — reinforce wood striations, like lacquered surface */
.grain {
  opacity: .13 !important;
  mix-blend-mode: overlay !important;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='60' filter='url(%23n)'/></svg>") !important;
  background-size: 200px 60px !important;
}

/* extra gloss coating layer on top of grain */
.scene::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* specular bloom — like the light pool in the reference photo */
    radial-gradient(ellipse 55% 32% at 44% 40%, rgba(255,250,225,.22) 0%, rgba(255,230,160,.08) 45%, transparent 70%),
    /* subtle horizontal sheen bands mimicking lacquer reflections */
    repeating-linear-gradient(180deg,
      rgba(255,255,255,.025) 0px,
      rgba(255,255,255,.025) 1px,
      transparent 1px,
      transparent 7px
    );
}

/* shelf boards — richer oak colour, deeper gloss */
.board {
  background: linear-gradient(180deg,
    #c8a05a 0%,
    #a06830 25%,
    #7a4a1e 55%,
    #3c220800 100%) !important;
  background-color: #8a5828 !important;
  box-shadow:
    0 14px 30px rgba(0,0,0,.62),
    inset 0 2px 0 rgba(255,245,210,.38),
    inset 0 1px 6px rgba(255,235,180,.18),
    inset 0 -1px 0 rgba(0,0,0,.45) !important;
}

.board.top {
  background: linear-gradient(180deg, #6a3e1e, #3e200a) !important;
  box-shadow:
    0 6px 18px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,235,180,.22),
    inset 0 -1px 0 rgba(0,0,0,.35) !important;
}

[data-brief-id="card-2"] {
  background: linear-gradient(180deg,
    #c8a05a 0%,
    #a06830 25%,
    #7a4a1e 55%,
    #3c220800 100%) !important;
  background-color: #8a5828 !important;
  box-shadow:
    0 14px 30px rgba(0,0,0,.62),
    inset 0 2px 0 rgba(255,245,210,.38),
    inset 0 1px 6px rgba(255,235,180,.18),
    inset 0 -1px 0 rgba(0,0,0,.45) !important;
}

/* header gradient stays warm-light readable */
.head {
  background: linear-gradient(180deg,
    rgba(253,246,238,.96) 0%,
    rgba(253,246,238,.78) 60%,
    rgba(253,246,238,0) 100%) !important;
}

/* scene fade to warm canvas */
.scene-fade {
  background: linear-gradient(180deg, rgba(253,246,238,0), #fdf6ee) !important;
}</style><!--gesso-fonts:start--><style id="gesso-font-lock">:root{--gesso-font-display:"Noto Sans JP", system-ui, -apple-system, sans-serif !important;--gesso-font-body:"Noto Serif JP", system-ui, -apple-system, sans-serif !important;--gesso-font-mono:"Geist", ui-monospace, "JetBrains Mono", monospace !important;}</style><!--gesso-fonts:end-->
</head>
<body data-brief-role="screen" data-brief-id="screen-root" style="padding-top: 48px !important;">

<header class="head" data-brief-id="header" data-brief-role="header">
  <div class="head-row">
    <div>
      <p class="kicker">わたしの本棚の手帖 — Bookshelf</p>
      <div class="title-row">
        <h1>わたしの本棚の手帖</h1>
        <span class="count">全197点</span>
      </div>
    </div>
    <div class="head-right">
      <button class="btn-scan" type="button" data-brief-id="button" data-brief-role="button"><svg data-icon="tabler/barcode" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 7V6a2 2 0 0 1 2-2h2M4 17v1a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v1m-4 13h2a2 2 0 0 0 2-2v-1M5 11h1v2H5zm5 0v2m4-2h1v2h-1zm5 0v2"></path></svg>スキャン</button>
      <span class="scan-hint">バーコードで3秒追加</span>
    </div>
  </div>
</header>

<main class="shelf" data-brief-id="section" data-brief-role="section">

  
  <input class="srx" type="radio" name="spine" id="b-fune" checked="" data-brief-id="input" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-santi" data-brief-id="input-2" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-kokuhaku" data-brief-id="input-3" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-waltz" data-brief-id="input-4" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-sen" data-brief-id="input-5" data-brief-role="input">

  
  <div class="scene">
    <img class="wood" src="https://rpreisbpsxrjwqsfeggf.supabase.co/storage/v1/object/public/direction-images/directions/84fd99c4-eaf8-4668-89f9-4469a7f44839/5a84b77e40bf.jpg" data-photo-aspect="hero" alt="" style="max-width:100%" data-stock-provider="pexels" data-stock-page="https://www.pexels.com/photo/grayscale-photo-of-wooden-wall-7789881/" data-stock-photographer="Ivan Babydov">
    <div class="grain"></div>
    <div class="bay">
      <div class="board top" data-brief-id="card" data-brief-role="card"></div>
      <div class="rail" data-brief-id="card-1q84-waltz-for-debby" data-brief-role="card">
        <div class="run">
          <label class="sp sp-fune" for="b-fune" style="--c:#2f6257;--w:52px;--h:218px;--p:64%">
            <span class="t">舟を編む</span><span class="a">三浦しをん</span><i class="prog"></i>
          </label>
          <label class="sp sp-santi" for="b-santi" style="--c:#37414d;--w:60px;--h:232px;--p:31%">
            <span class="t">三体</span><span class="a">劉慈欣</span><i class="prog"></i>
          </label>
          <label class="sp sp-kokuhaku" for="b-kokuhaku" style="--c:#5a3a41;--w:48px;--h:206px">
            <span class="t">告白</span><span class="a">湊かなえ</span><i class="prog"></i>
          </label>
          <div class="sp-d" style="--c:#41503a;--w:50px;--h:224px">
            <span class="t">ノルウェイの森</span><span class="a">村上春樹</span>
          </div>
          <div class="sp-d" style="--c:#46564f;--w:46px;--h:198px">
            <span class="t">コンビニ人間</span><span class="a">村田沙耶香</span>
          </div>
          <div class="sp-d" style="--c:#4c6478;--w:48px;--h:210px">
            <span class="t">氷菓</span><span class="a">米澤穂信</span>
          </div>
          <div class="sp-d" style="--c:#5b4a52;--w:56px;--h:236px">
            <span class="t">1Q84</span><span class="a">村上春樹</span>
          </div>
          <label class="sp cd sp-waltz" for="b-waltz" style="--c:#7d5a40">
            <span class="t">WALTZ<br>FOR DEBBY</span>
          </label>
          <div class="sp-d cd" style="--c:#3a567a">
            <span class="t">KIND OF BLUE</span>
          </div>
          <div class="sp-d cd" style="--c:#6e675c">
            <span class="t">GOLDBERG<br>VARIATIONS</span>
          </div>
          <label class="sp dvd sp-sen" for="b-sen" style="--c:#33424e;--h:186px;--p:38%">
            <span class="t">千と千尋の神隠し</span><i class="prog"></i>
          </label>
          <div class="sp-d dvd" style="--c:#2a333d;--h:178px">
            <span class="t">イノセンス</span><span class="a">押井守</span>
          </div>
          <div class="sp-d dvd" style="--c:#4a3b45;--h:190px">
            <span class="t">千年女優</span><span class="a">今敏</span>
          </div>
          <div class="sp-add"><svg data-icon="tabler/plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path></svg></div>
        </div>
        <div class="run" aria-hidden="true">
          <div class="sp-d" style="--c:#2f6257;--w:52px;--h:218px;--p:64%" data-brief-id="card-4" data-brief-role="card"><span class="t">舟を編む</span><span class="a">三浦しをん</span><i class="prog"></i></div>
          <div class="sp-d" style="--c:#37414d;--w:60px;--h:232px;--p:31%" data-brief-id="card-5" data-brief-role="card"><span class="t">三体</span><span class="a">劉慈欣</span><i class="prog"></i></div>
          <div class="sp-d" style="--c:#5a3a41;--w:48px;--h:206px" data-brief-id="card-6" data-brief-role="card"><span class="t">告白</span><span class="a">湊かなえ</span></div>
          <div class="sp-d" style="--c:#41503a;--w:50px;--h:224px" data-brief-id="card-7" data-brief-role="card"><span class="t">ノルウェイの森</span><span class="a">村上春樹</span></div>
          <div class="sp-d" style="--c:#46564f;--w:46px;--h:198px" data-brief-id="card-8" data-brief-role="card"><span class="t">コンビニ人間</span><span class="a">村田沙耶香</span></div>
          <div class="sp-d" style="--c:#4c6478;--w:48px;--h:210px" data-brief-id="card-9" data-brief-role="card"><span class="t">氷菓</span><span class="a">米澤穂信</span></div>
          <div class="sp-d" style="--c:#5b4a52;--w:56px;--h:236px" data-brief-id="card-1q84" data-brief-role="card"><span class="t">1Q84</span><span class="a">村上春樹</span></div>
          <div class="sp-d cd" style="--c:#7d5a40" data-brief-id="card-waltz-for-debby" data-brief-role="card"><span class="t">WALTZ<br>FOR DEBBY</span></div>
          <div class="sp-d cd" style="--c:#3a567a" data-brief-id="card-kind-of-blue" data-brief-role="card"><span class="t">KIND OF BLUE</span></div>
          <div class="sp-d cd" style="--c:#6e675c" data-brief-id="card-goldberg-variations" data-brief-role="card"><span class="t">GOLDBERG<br>VARIATIONS</span></div>
          <div class="sp-d dvd" style="--c:#33424e;--h:186px;--p:38%" data-brief-id="card-10" data-brief-role="card"><span class="t">千と千尋の神隠し</span><i class="prog"></i></div>
          <div class="sp-d dvd" style="--c:#2a333d;--h:178px" data-brief-id="card-11" data-brief-role="card"><span class="t">イノセンス</span><span class="a">押井守</span></div>
          <div class="sp-d dvd" style="--c:#4a3b45;--h:190px" data-brief-id="card-12" data-brief-role="card"><span class="t">千年女優</span><span class="a">今敏</span></div>
          <div class="sp-add" data-brief-id="card-13" data-brief-role="card"><svg data-icon="tabler/plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path></svg></div>
        </div>
      </div>
      <div class="board" data-brief-id="card-2" data-brief-role="card"></div>
      <div class="scroll-hint" data-brief-id="card-3" data-brief-role="card"><svg data-icon="tabler/chevrons-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m7 7l5 5l-5 5m6-10l5 5l-5 5"></path></svg>横にスクロール</div>
    </div>
    <div class="scene-fade"></div>
  </div>

  
  <div class="chips">
    <span class="chip on">すべて<b>197</b></span>
    <span class="chip">書籍<b>128</b></span>
    <span class="chip">CD<b>42</b></span>
    <span class="chip">DVD<b>27</b></span>
    <span class="chip">未読のみ<b>34</b></span>
    <span class="chip">メモ付きのみ表示</span>
  </div>
  <p class="chip-cap"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>読書メモ・視聴メモを書き込んだ作品</p>

  
  <article class="detail" id="d-fune">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-5" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">読み進め中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 5件</span>
      </div>
      <h2>舟を編む</h2>
      <p class="d-author">三浦しをん</p>
      <div class="meter" data-brief-id="card-14" data-brief-role="card"><i style="width:64%"></i></div>
      <div class="d-stats" data-brief-id="card-p-182-28564" data-brief-role="card"><span class="l">p.182 / 285</span><span class="r">64%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-16-328605" data-brief-role="card"><span>ISBN</span><b>978-4-16-328605-7</b></div>
      <div class="d-actions" data-brief-id="card-15" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-2" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-3" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-santi">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-2" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">読み進め中・視聴中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 2件</span>
      </div>
      <h2>三体</h2>
      <p class="d-author">劉慈欣</p>
      <div class="meter" data-brief-id="card-16" data-brief-role="card"><i style="width:31%"></i></div>
      <div class="d-stats" data-brief-id="card-p-112-36031" data-brief-role="card"><span class="l">p.112 / 360</span><span class="r">31%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-15-050027" data-brief-role="card"><span>ISBN</span><b>978-4-15-050027-4</b></div>
      <div class="d-actions" data-brief-id="card-17" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-4" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-5" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-kokuhaku">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-0" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">未読</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 0件</span>
      </div>
      <h2>告白</h2>
      <p class="d-author">湊かなえ</p>
      <div class="meter" data-brief-id="card-18" data-brief-role="card"><i style="width:0%"></i></div>
      <div class="d-stats" data-brief-id="card-p-0-2710" data-brief-role="card"><span class="l">p.0 / 271</span><span class="r">0%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-10-127241" data-brief-role="card"><span>ISBN</span><b>978-4-10-127241-2</b></div>
      <div class="d-actions" data-brief-id="card-19" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-6" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-7" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-waltz">
    <div class="card">
      <div class="d-top" data-brief-id="card-cd-3" data-brief-role="card">
        <span class="tag">CD</span>
        <span class="tag st">視聴済み</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>視聴メモ 3件</span>
      </div>
      <h2>WALTZ FOR DEBBY</h2>
      <p class="d-author">ビル・エヴァンス・トリオ</p>
      <p class="d-sub">1962 ・ RIVERSIDE RECORDS</p>
      <div class="d-meta" data-brief-id="card-jan4988031-302219" data-brief-role="card"><span>JAN</span><b>4988031-302219</b></div>
      <div class="d-actions" data-brief-id="card-20" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-8" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>視聴メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-9" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-sen">
    <div class="card">
      <div class="d-top" data-brief-id="card-dvd-1" data-brief-role="card">
        <span class="tag">DVD</span>
        <span class="tag st">視聴中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>視聴メモ 1件</span>
      </div>
      <h2>千と千尋の神隠し</h2>
      <p class="d-author">宮崎駿</p>
      <div class="meter" data-brief-id="card-21" data-brief-role="card"><i style="width:38%"></i></div>
      <div class="d-stats" data-brief-id="card-00-47-125-38" data-brief-role="card"><span class="l">00:47 / 125分</span><span class="r">38%</span></div>
      <div class="d-meta" data-brief-id="card-jan4959241-982233" data-brief-role="card"><span>JAN</span><b>4959241-982233</b></div>
      <div class="d-actions" data-brief-id="card-22" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-10" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>視聴メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-11" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

</main>

<nav class="tabs" data-brief-role="tab-bar" data-brief-id="nav-top">
  <a class="tab" href="#" aria-current="page" data-brief-id="button-12" data-brief-role="button"><svg data-icon="tabler/home" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></g></svg>本棚</a>
  <a class="tab" href="#" data-brief-id="button-13" data-brief-role="button"><svg data-icon="tabler/search" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6"></path></svg>検索</a>
  <a class="tab tab-scan" href="#" aria-label="スキャン" data-brief-id="button-14" data-brief-role="button"><svg data-icon="tabler/scan" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M17 3h2a2 2 0 0 1 2 2v2m-4 14h2a2 2 0 0 0 2-2v-2"></path></svg></a>
  <a class="tab" href="#" data-brief-id="button-15" data-brief-role="button"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ</a>
  <a class="tab" href="#" data-brief-id="button-16" data-brief-role="button"><svg data-icon="tabler/settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0"></path></g></svg>設定</a>
</nav>

</body></html>
```

</details>

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --gesso-canvas: #fdf6ee;
  --gesso-surface-recessed: #f3ece4;
  --gesso-surface: #fff8f0;
  --gesso-surface-elevated: #f5eee6;
  --gesso-divider: rgba(0,0,0,0.04);
  --gesso-fg: #2d1a08;
  --gesso-fg-muted: #7a5a3a;
  --gesso-primary: #b8620a;
  --gesso-on-accent: #000000;
  --gesso-accent-text: #a65809;
  --gesso-secondary: #e8a040;
  --gesso-accent-2-text: #97682a;
  --gesso-neutral-50: #fdf6ee;
  --gesso-neutral-100: #fff8f0;
  --gesso-neutral-200: #e3d7c9;
  --gesso-neutral-300: #c8b6a3;
  --gesso-neutral-400: #ad977f;
  --gesso-neutral-500: #93785c;
  --gesso-neutral-600: #7a5a3a;
  --gesso-neutral-700: #5f4328;
  --gesso-neutral-800: #452e18;
  --gesso-neutral-900: #2d1a08;
  --gesso-neutral-950: #281707;
  --gesso-success: #149343;
  --gesso-warning: #c36b05;
  --gesso-error: #DC2626;
  --gesso-data-1: #814200;
  --gesso-data-2: #a25400;
  --gesso-data-3: #c06919;
  --gesso-data-4: #db8239;
  --gesso-data-5: #f79b54;
  --gesso-data-6: #ffbe8f;

  /* Typography — Font Families */
  --gesso-font-display: 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --gesso-font-body: 'Noto Serif JP', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --gesso-font-mono: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --gesso-text-4xl: 48px;
  --gesso-leading-4xl: 1.2;
  --gesso-text-3xl: 36px;
  --gesso-leading-3xl: 1.2;
  --gesso-text-2xl: 28px;
  --gesso-leading-2xl: 1.2;
  --gesso-text-base: 16px;
  --gesso-leading-base: 1.5;
  --gesso-text-xs: 12px;
  --gesso-leading-xs: 1.5;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --gesso-space-1: 4px;
  --gesso-space-2: 8px;
  --gesso-space-3: 12px;
  --gesso-space-4: 16px;
  --gesso-space-6: 24px;
  --gesso-space-8: 32px;
  --gesso-space-12: 48px;
  --gesso-space-16: 64px;
  --gesso-space-24: 96px;
  --gesso-space-32: 128px;

  /* Border Radius */
  --radius-none: 0px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --gesso-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --gesso-shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --gesso-shadow-lg: 0 16px 40px rgba(0,0,0,0.12);

  /* Surfaces */
  --surface-page: #fdf6ee;
  --surface-raised: #fff8f0;
  --surface-sunken: #E4E4E7;
  --surface-overlay: #fdf6ee;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --gesso-canvas: #fdf6ee;
  --gesso-surface-recessed: #f3ece4;
  --gesso-surface: #fff8f0;
  --gesso-surface-elevated: #f5eee6;
  --gesso-divider: rgba(0,0,0,0.04);
  --gesso-fg: #2d1a08;
  --gesso-fg-muted: #7a5a3a;
  --gesso-primary: #b8620a;
  --gesso-on-accent: #000000;
  --gesso-accent-text: #a65809;
  --gesso-secondary: #e8a040;
  --gesso-accent-2-text: #97682a;
  --gesso-neutral-50: #fdf6ee;
  --gesso-neutral-100: #fff8f0;
  --gesso-neutral-200: #e3d7c9;
  --gesso-neutral-300: #c8b6a3;
  --gesso-neutral-400: #ad977f;
  --gesso-neutral-500: #93785c;
  --gesso-neutral-600: #7a5a3a;
  --gesso-neutral-700: #5f4328;
  --gesso-neutral-800: #452e18;
  --gesso-neutral-900: #2d1a08;
  --gesso-neutral-950: #281707;
  --gesso-success: #149343;
  --gesso-warning: #c36b05;
  --gesso-error: #DC2626;
  --gesso-data-1: #814200;
  --gesso-data-2: #a25400;
  --gesso-data-3: #c06919;
  --gesso-data-4: #db8239;
  --gesso-data-5: #f79b54;
  --gesso-data-6: #ffbe8f;

  /* Typography */
  --gesso-font-display: 'Noto Sans JP', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --gesso-font-body: 'Noto Serif JP', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --gesso-font-mono: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --gesso-text-4xl: 48px;
  --gesso-leading-4xl: 1.2;
  --gesso-text-3xl: 36px;
  --gesso-leading-3xl: 1.2;
  --gesso-text-2xl: 28px;
  --gesso-leading-2xl: 1.2;
  --gesso-text-base: 16px;
  --gesso-leading-base: 1.5;
  --gesso-text-xs: 12px;
  --gesso-leading-xs: 1.5;

  /* Spacing */
  --gesso-space-1: 4px;
  --gesso-space-2: 8px;
  --gesso-space-3: 12px;
  --gesso-space-4: 16px;
  --gesso-space-6: 24px;
  --gesso-space-8: 32px;
  --gesso-space-12: 48px;
  --gesso-space-16: 64px;
  --gesso-space-24: 96px;
  --gesso-space-32: 128px;

  /* Border Radius */
  --radius-none: 0px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --gesso-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --gesso-shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --gesso-shadow-lg: 0 16px 40px rgba(0,0,0,0.12);
}
```


## Tokens (JSON)

```json
{
  "color": {
    "neutral": {
      "50": "#0b1115",
      "100": "#151d23",
      "200": "#E4E4E7",
      "300": "#D4D4D8",
      "400": "#A1A1AA",
      "500": "#71717A",
      "600": "#a3afb3",
      "700": "#3F3F46",
      "800": "#27272A",
      "900": "#eef1f0",
      "950": "#09090B"
    },
    "primary": "#3fb8a0",
    "semantic": {
      "error": "#DC2626",
      "success": "#16A34A",
      "warning": "#D97706"
    },
    "secondary": "#d89a6a"
  },
  "motion": {
    "easing": {
      "default": "cubic-bezier(0.2, 0, 0, 1)",
      "emphasis": "cubic-bezier(0.3, 0, 0, 1)"
    },
    "duration": {
      "base": "250ms",
      "fast": "150ms",
      "slow": "400ms"
    }
  },
  "radius": {
    "lg": "16px",
    "md": "8px",
    "sm": "4px",
    "full": "9999px",
    "none": "0"
  },
  "shadow": {
    "lg": "0 16px 40px rgba(0,0,0,0.12)",
    "md": "0 4px 12px rgba(0,0,0,0.08)",
    "sm": "0 1px 2px rgba(0,0,0,0.05)"
  },
  "spacing": {
    "unit": 4,
    "scale": {
      "1": "4px",
      "2": "8px",
      "3": "12px",
      "4": "16px",
      "6": "24px",
      "8": "32px",
      "12": "48px",
      "16": "64px",
      "24": "96px",
      "32": "128px"
    }
  },
  "typeface": {
    "body": "Noto Serif JP",
    "mono": "Geist",
    "scale": {
      "lg": "18px",
      "sm": "14px",
      "xl": "22px",
      "xs": "12px",
      "2xl": "28px",
      "3xl": "36px",
      "4xl": "48px",
      "base": "16px"
    },
    "display": "Noto Sans JP",
    "weights": [
      400,
      500,
      600,
      700
    ],
    "bodyWeight": 400,
    "displayWeight": 600
  }
}
```

## Reference HTML

```html
<!doctype html>
<html lang="ja"><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto%20Sans%20JP:wght@400;500;600;700&family=Noto%20Serif%20JP:wght@400;500;600;700&family=Geist:wght@400;500;600;700&display=swap"><style id="gesso-direct-faces">:root{--gesso-font-display:"Noto Sans JP", system-ui, -apple-system, sans-serif;--gesso-font-body:"Noto Serif JP", system-ui, -apple-system, sans-serif;}</style><style id="gesso-link-reset">:where(a){color:inherit;text-decoration:none}</style>
<meta name="gesso-pipeline" content="direct">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>わたしの本棚の手帖 — Bookshelf</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&amp;family=Noto+Serif+JP:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
:root{
  --gesso-canvas:#fdf6ee;
  --gesso-surface:#fff8f0;
  --gesso-fg:#2d1a08;
  --gesso-fg-muted:#7a5a3a;
  --gesso-accent:#b8620a;
  --gesso-on-accent:#06201a;
  --gesso-accent-2:#e8a040;
  --gesso-divider:#e2cdb0;
  --font-display:"Sentient","Noto Serif JP",serif;
  --font-body:var(--gesso-font-mono),"Noto Sans JP",sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{background:var(--gesso-canvas)}
body{
  min-height:100vh;
  background:var(--gesso-canvas);
  color:var(--gesso-fg);
  font-family:var(--font-body);
  font-weight:400;
  padding:44px 0 132px;
}
.ic{width: 16px;height: 16px;flex:none}
.ic-lg{width: 24px;height: 24px;flex:none}
.ic-xl{width: 32px;height: 32px;flex:none}

/* ---------- fixed header over the shelf image ---------- */
.head{
  position:fixed;top:44px;left:0;right:0;z-index:30;
  padding:14px 20px 46px;
  background:linear-gradient(180deg,rgba(11,17,21,.94) 0%,rgba(11,17,21,.72) 62%,rgba(11,17,21,0) 100%);
}
.head-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.kicker{
  font-size:10px;letter-spacing:.22em;color:var(--gesso-fg-muted);
  font-weight:400;margin-bottom:7px;
}
.title-row{display:flex;align-items:baseline;gap:10px}
h1{
  font-family:var(--font-display);font-weight:500;font-size:34px;line-height:1.1;
  letter-spacing:.02em;color:var(--gesso-fg);
}
.count{font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.06em}
.head-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;padding-top:14px}
.btn-scan{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  font:600 12.5px/1 var(--font-body);letter-spacing:.04em;
  padding:10px 16px;border-radius:999px;border:none;cursor:pointer;
}
.scan-hint{font-size:10px;color:var(--gesso-fg-muted);letter-spacing:.08em}

/* ---------- shelf scene ---------- */
.shelf{position:relative}
.scene{
  position:relative;
  background:
    repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 2px,transparent 2px 9px,rgba(255,255,255,.03) 9px 10px,transparent 10px 30px),
    linear-gradient(180deg,#2a1e14,#191108);
}
.wood{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  filter:brightness(.58) contrast(1.05) saturate(.85);
}
.grain{
  position:absolute;inset:0;pointer-events:none;opacity:.07;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>");
}
.bay{position:relative;padding-top:134px}
.board{
  position:relative;z-index:2;height:12px;margin:0 0 0 0;border-radius:2px;
  background:linear-gradient(180deg,#8a6642 0,#5f432a 40%,#31231500 100%);
  background-color:#5f432a;
  box-shadow:0 12px 26px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,235,205,.25);
}
.board.top{
  height:9px;margin:0 0 2px;
  background:linear-gradient(180deg,#3a2a1b,#241a11);
  box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,235,205,.14);
}
.rail{
  position:relative;z-index:1;
  display:flex;align-items:flex-end;gap:6px;
  height:244px;padding:0 22px;
  overflow-x:auto;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 26px,#000 calc(100% - 26px),transparent 100%);
}
.rail::-webkit-scrollbar{display:none}
.run{display:flex;align-items:flex-end;gap:6px;flex:none;padding-right:36px}

/* ---------- spines ---------- */
.sp,.sp-d{
  position:relative;flex:none;
  width:var(--w,48px);height:var(--h,210px);
  border-radius:3px 3px 2px 2px;
  background:
    linear-gradient(90deg,rgba(0,0,0,.32),rgba(255,255,255,.07) 16%,rgba(0,0,0,0) 46%,rgba(0,0,0,.24)),
    var(--c,#33424e);
  box-shadow:inset -2px 0 3px rgba(0,0,0,.4), 3px 0 4px rgba(0,0,0,.38);
  display:flex;flex-direction:column;align-items:center;justify-content:space-between;
  padding:12px 0 9px;
  cursor:pointer;user-select:none;
  transition:transform .25s ease, box-shadow .25s ease;
}
.sp .t,.sp-d .t{
  writing-mode:vertical-rl;text-orientation:mixed;
  font:500 12.5px/1.15 var(--font-body);letter-spacing:.14em;
  color:rgba(238,241,240,.94);
}
.sp .a,.sp-d .a{
  writing-mode:vertical-rl;
  font:400 8.5px/1 var(--font-body);letter-spacing:.12em;
  color:rgba(238,241,240,.5);
}
.prog{
  position:absolute;left:0;bottom:0;height:3px;width:var(--p,0%);
  background:var(--gesso-accent);border-radius:0 2px 2px 0;opacity:.95;
}
.sp.cd,.sp-d.cd{width:20px;padding:9px 0 7px;border-radius:2px}
.sp.cd .t,.sp-d.cd .t{font-size:8.5px;letter-spacing:.1em;line-height:1.2}
.sp.dvd,.sp-d.dvd{width:26px}
.sp.dvd .t,.sp-d.dvd .t{font-size:10px}
.sp.dvd .a,.sp-d.dvd .a{font-size:8px}
.sp-add{
  flex:none;width:38px;height:192px;border-radius:3px;
  border:1.5px dashed rgba(163,175,179,.42);
  background:rgba(21,29,35,.35);
  display:flex;align-items:center;justify-content:center;
  color:var(--gesso-fg-muted);
}
.srx{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}

/* lifted (tapped) spine */
.shelf:has(#b-fune:checked) .sp-fune,
.shelf:has(#b-santi:checked) .sp-santi,
.shelf:has(#b-kokuhaku:checked) .sp-kokuhaku,
.shelf:has(#b-waltz:checked) .sp-waltz,
.shelf:has(#b-sen:checked) .sp-sen{
  transform:translateY(-16px);
  box-shadow:
    0 0 0 1px rgba(63,184,160,.45),
    0 18px 32px rgba(0,0,0,.6),
    0 8px 22px rgba(63,184,160,.14),
    inset -2px 0 3px rgba(0,0,0,.4);
}
.shelf:has(#b-fune:focus-visible) .sp-fune,
.shelf:has(#b-santi:focus-visible) .sp-santi,
.shelf:has(#b-kokuhaku:focus-visible) .sp-kokuhaku,
.shelf:has(#b-waltz:focus-visible) .sp-waltz,
.shelf:has(#b-sen:focus-visible) .sp-sen{
  outline:2px solid var(--gesso-accent);outline-offset:3px;
}
.scroll-hint{
  position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:6px;
  padding:10px 0 14px;
  font-size:10px;letter-spacing:.18em;color:var(--gesso-fg-muted);
}
.scene-fade{
  position:relative;z-index:3;height:52px;margin-top:-30px;pointer-events:none;
  background:linear-gradient(180deg,rgba(11,17,21,0),var(--gesso-canvas));
}

/* ---------- filter chips ---------- */
.chips{
  display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;
  padding:2px 20px 4px;
}
.chips::-webkit-scrollbar{display:none}
.chip{
  flex:none;display:inline-flex;align-items:baseline;gap:7px;
  padding:9px 14px;border-radius:999px;
  border:1px solid var(--gesso-divider);background:rgba(21,29,35,.72);
  font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.04em;
}
.chip b{font-weight:500;font-size:11px;color:var(--gesso-fg);font-family:var(--font-body)}
.chip.on{background:var(--gesso-fg);border-color:var(--gesso-fg);color:#0b1115}
.chip.on b{color:#0b1115}
.chip-cap{
  display:flex;align-items:center;gap:6px;
  padding:9px 22px 0;font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.05em;
}
.chip-cap .ic{width: 16px;height: 16px;color:var(--gesso-accent-2)}

/* ---------- detail card ---------- */
.detail{display:none}
.shelf:has(#b-fune:checked) #d-fune,
.shelf:has(#b-santi:checked) #d-santi,
.shelf:has(#b-kokuhaku:checked) #d-kokuhaku,
.shelf:has(#b-waltz:checked) #d-waltz,
.shelf:has(#b-sen:checked) #d-sen{
  display:block;animation:rise .32s ease;
}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card{
  margin:14px 20px 26px;
  background:var(--gesso-surface);
  border:1px solid var(--gesso-divider);
  border-radius:20px;
  padding:20px 20px 18px;
  box-shadow:0 20px 44px rgba(0,0,0,.35);
}
.d-top{display:flex;align-items:center;gap:7px}
.tag{
  font:500 9.5px/1 var(--font-body);letter-spacing:.2em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;
  border:1px solid rgba(216,154,106,.4);color:var(--gesso-accent-2);
}
.tag.st{
  border:1px solid rgba(63,184,160,.35);color:var(--gesso-accent);
  background:rgba(63,184,160,.1);text-transform:none;letter-spacing:.1em;
}
.d-memo{
  margin-left:auto;display:inline-flex;align-items:center;gap:6px;
  font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.05em;
}
.d-memo .ic{width: 16px;height: 16px;color:var(--gesso-accent-2)}
.card h2{
  font-family:var(--font-display);font-weight:500;font-size:27px;line-height:1.2;
  letter-spacing:.01em;margin:14px 0 3px;color:var(--gesso-fg);
}
.d-author{font-size:13px;color:var(--gesso-fg-muted);letter-spacing:.04em}
.d-sub{font-size:11px;color:var(--gesso-fg-muted);letter-spacing:.12em;margin-top:3px}
.meter{
  height:5px;border-radius:999px;background:rgba(38,50,58,.9);
  margin-top:16px;overflow:hidden;
}
.meter i{display:block;height:100%;border-radius:999px;background:var(--gesso-accent)}
.d-stats{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px}
.d-stats .l{font-size:12px;color:var(--gesso-fg-muted);letter-spacing:.05em}
.d-stats .r{font-size:16px;font-weight:600;color:var(--gesso-accent);letter-spacing:.02em}
.d-meta{
  display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  border-top:1px solid var(--gesso-divider);
  margin-top:14px;padding-top:11px;
}
.d-meta span{font-size:9.5px;letter-spacing:.2em;color:var(--gesso-fg-muted);text-transform:uppercase}
.d-meta b{font-size:12.5px;font-weight:400;color:var(--gesso-fg);letter-spacing:.04em}
.d-actions{display:flex;gap:10px;margin-top:16px}
.btn-acc{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  font:600 12.5px/1 var(--font-body);letter-spacing:.03em;
  padding:11px 16px;border-radius:999px;border:none;cursor:pointer;
}
.btn-ghost{
  display:inline-flex;align-items:center;gap:4px;
  background:transparent;color:var(--gesso-fg-muted);
  font:400 12.5px/1 var(--font-body);letter-spacing:.03em;
  padding:11px 14px;border-radius:999px;border:1px solid var(--gesso-divider);cursor:pointer;
}

/* ---------- bottom tab bar ---------- */
.tabs{
  position:fixed;left:0;right:0;bottom:0;z-index:40;
  display:flex;align-items:center;justify-content:space-around;
  padding:10px 14px calc(10px + env(safe-area-inset-bottom));
  background:rgba(21,29,35,.92);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-top:1px solid var(--gesso-divider);
}
.tab{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  text-decoration:none;color:var(--gesso-fg-muted);
  font-size:10px;letter-spacing:.08em;min-width:52px;
}
.tab .ic{width: 16px;height: 16px}
.tab[aria-current="page"]{color:var(--gesso-accent)}
.tab-scan{
  width:54px;height:54px;border-radius:50%;
  background:var(--gesso-accent);color:var(--gesso-on-accent);
  display:flex;align-items:center;justify-content:center;
  transform:translateY(-16px);
  box-shadow:0 12px 26px rgba(63,184,160,.3),0 4px 10px rgba(0,0,0,.4);
}
</style>
<style>/* gesso-icon-base v1 */
.ic { display: inline-block; width: 16px; height: 16px; vertical-align: -0.125em; flex-shrink: 0; line-height: 0; }
.ic svg { width: 100%; height: 100%; display: block; }
svg.ic { width: 16px; height: 16px; display: inline-block; vertical-align: -0.125em; flex-shrink: 0; }
.ic[data-icon-style="line"] { stroke-width: var(--ic-stroke, 2); }
.ic[data-icon-style="line"] svg path, .ic[data-icon-style="line"] svg circle, .ic[data-icon-style="line"] svg rect, .ic[data-icon-style="line"] svg line, .ic[data-icon-style="line"] svg polyline, .ic[data-icon-style="line"] svg polygon { stroke-width: inherit; }
.ic-sm { --ic-stroke: 2.25; }
.ic-xs { --ic-stroke: 2.5; }
svg.ic-lg, .ic-lg svg { width: 24px; height: 24px; }
svg.ic-xl, .ic-xl svg { width: 32px; height: 32px; }
svg.ic-2xl, .ic-2xl svg { width: 32px; height: 32px; }
.ic-lg { --ic-stroke: 1.75; }
.ic-xl { --ic-stroke: 1.5; }
.ic-2xl { --ic-stroke: 1.5; }
</style>
<style id="gesso-overflow-guard">html,body{overflow-x:clip!important}</style>
<style id="comment-css-card-2-mwv7unu6">[data-brief-id="card-2"] {
  background: linear-gradient(180deg, #c8a46e 0%, #a07840 20%, #7a5a2a 50%, #5c3f1a 80%, #2e1e0800 100%) !important;
  background-color: #8a6030 !important;
  box-shadow: 0 12px 26px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,245,220,.30), inset 0 -1px 0 rgba(0,0,0,.4) !important;
}</style><style id="frame-edit-restyle">/* ── 木材写真を棚シーンの背景に使用 ── */
.scene {
  background:
    /* gloss coating highlight */
    radial-gradient(ellipse 70% 38% at 42% 36%, rgba(255,248,220,.18) 0%, transparent 68%),
    /* lacquer sheen overlay */
    linear-gradient(175deg, rgba(255,245,200,.10) 0%, transparent 55%, rgba(0,0,0,.08) 100%) !important;
  background-color: #8b4a06 !important;
}

/* wood photo — full brightness, saturated, warm */
.wood {
  filter: brightness(.92) contrast(1.08) saturate(1.18) !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

/* grain overlay — reinforce wood striations, like lacquered surface */
.grain {
  opacity: .13 !important;
  mix-blend-mode: overlay !important;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='60' filter='url(%23n)'/></svg>") !important;
  background-size: 200px 60px !important;
}

/* extra gloss coating layer on top of grain */
.scene::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* specular bloom — like the light pool in the reference photo */
    radial-gradient(ellipse 55% 32% at 44% 40%, rgba(255,250,225,.22) 0%, rgba(255,230,160,.08) 45%, transparent 70%),
    /* subtle horizontal sheen bands mimicking lacquer reflections */
    repeating-linear-gradient(180deg,
      rgba(255,255,255,.025) 0px,
      rgba(255,255,255,.025) 1px,
      transparent 1px,
      transparent 7px
    );
}

/* shelf boards — richer oak colour, deeper gloss */
.board {
  background: linear-gradient(180deg,
    #c8a05a 0%,
    #a06830 25%,
    #7a4a1e 55%,
    #3c220800 100%) !important;
  background-color: #8a5828 !important;
  box-shadow:
    0 14px 30px rgba(0,0,0,.62),
    inset 0 2px 0 rgba(255,245,210,.38),
    inset 0 1px 6px rgba(255,235,180,.18),
    inset 0 -1px 0 rgba(0,0,0,.45) !important;
}

.board.top {
  background: linear-gradient(180deg, #6a3e1e, #3e200a) !important;
  box-shadow:
    0 6px 18px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,235,180,.22),
    inset 0 -1px 0 rgba(0,0,0,.35) !important;
}

[data-brief-id="card-2"] {
  background: linear-gradient(180deg,
    #c8a05a 0%,
    #a06830 25%,
    #7a4a1e 55%,
    #3c220800 100%) !important;
  background-color: #8a5828 !important;
  box-shadow:
    0 14px 30px rgba(0,0,0,.62),
    inset 0 2px 0 rgba(255,245,210,.38),
    inset 0 1px 6px rgba(255,235,180,.18),
    inset 0 -1px 0 rgba(0,0,0,.45) !important;
}

/* header gradient stays warm-light readable */
.head {
  background: linear-gradient(180deg,
    rgba(253,246,238,.96) 0%,
    rgba(253,246,238,.78) 60%,
    rgba(253,246,238,0) 100%) !important;
}

/* scene fade to warm canvas */
.scene-fade {
  background: linear-gradient(180deg, rgba(253,246,238,0), #fdf6ee) !important;
}</style><!--gesso-fonts:start--><style id="gesso-font-lock">:root{--gesso-font-display:"Noto Sans JP", system-ui, -apple-system, sans-serif !important;--gesso-font-body:"Noto Serif JP", system-ui, -apple-system, sans-serif !important;--gesso-font-mono:"Geist", ui-monospace, "JetBrains Mono", monospace !important;}</style><!--gesso-fonts:end-->
</head>
<body data-brief-role="screen" data-brief-id="screen-root" style="padding-top: 48px !important;">

<header class="head" data-brief-id="header" data-brief-role="header">
  <div class="head-row">
    <div>
      <p class="kicker">わたしの本棚の手帖 — Bookshelf</p>
      <div class="title-row">
        <h1>わたしの本棚の手帖</h1>
        <span class="count">全197点</span>
      </div>
    </div>
    <div class="head-right">
      <button class="btn-scan" type="button" data-brief-id="button" data-brief-role="button"><svg data-icon="tabler/barcode" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 7V6a2 2 0 0 1 2-2h2M4 17v1a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v1m-4 13h2a2 2 0 0 0 2-2v-1M5 11h1v2H5zm5 0v2m4-2h1v2h-1zm5 0v2"></path></svg>スキャン</button>
      <span class="scan-hint">バーコードで3秒追加</span>
    </div>
  </div>
</header>

<main class="shelf" data-brief-id="section" data-brief-role="section">

  
  <input class="srx" type="radio" name="spine" id="b-fune" checked="" data-brief-id="input" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-santi" data-brief-id="input-2" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-kokuhaku" data-brief-id="input-3" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-waltz" data-brief-id="input-4" data-brief-role="input">
  <input class="srx" type="radio" name="spine" id="b-sen" data-brief-id="input-5" data-brief-role="input">

  
  <div class="scene">
    <img class="wood" src="https://rpreisbpsxrjwqsfeggf.supabase.co/storage/v1/object/public/direction-images/directions/84fd99c4-eaf8-4668-89f9-4469a7f44839/5a84b77e40bf.jpg" data-photo-aspect="hero" alt="" style="max-width:100%" data-stock-provider="pexels" data-stock-page="https://www.pexels.com/photo/grayscale-photo-of-wooden-wall-7789881/" data-stock-photographer="Ivan Babydov">
    <div class="grain"></div>
    <div class="bay">
      <div class="board top" data-brief-id="card" data-brief-role="card"></div>
      <div class="rail" data-brief-id="card-1q84-waltz-for-debby" data-brief-role="card">
        <div class="run">
          <label class="sp sp-fune" for="b-fune" style="--c:#2f6257;--w:52px;--h:218px;--p:64%">
            <span class="t">舟を編む</span><span class="a">三浦しをん</span><i class="prog"></i>
          </label>
          <label class="sp sp-santi" for="b-santi" style="--c:#37414d;--w:60px;--h:232px;--p:31%">
            <span class="t">三体</span><span class="a">劉慈欣</span><i class="prog"></i>
          </label>
          <label class="sp sp-kokuhaku" for="b-kokuhaku" style="--c:#5a3a41;--w:48px;--h:206px">
            <span class="t">告白</span><span class="a">湊かなえ</span><i class="prog"></i>
          </label>
          <div class="sp-d" style="--c:#41503a;--w:50px;--h:224px">
            <span class="t">ノルウェイの森</span><span class="a">村上春樹</span>
          </div>
          <div class="sp-d" style="--c:#46564f;--w:46px;--h:198px">
            <span class="t">コンビニ人間</span><span class="a">村田沙耶香</span>
          </div>
          <div class="sp-d" style="--c:#4c6478;--w:48px;--h:210px">
            <span class="t">氷菓</span><span class="a">米澤穂信</span>
          </div>
          <div class="sp-d" style="--c:#5b4a52;--w:56px;--h:236px">
            <span class="t">1Q84</span><span class="a">村上春樹</span>
          </div>
          <label class="sp cd sp-waltz" for="b-waltz" style="--c:#7d5a40">
            <span class="t">WALTZ<br>FOR DEBBY</span>
          </label>
          <div class="sp-d cd" style="--c:#3a567a">
            <span class="t">KIND OF BLUE</span>
          </div>
          <div class="sp-d cd" style="--c:#6e675c">
            <span class="t">GOLDBERG<br>VARIATIONS</span>
          </div>
          <label class="sp dvd sp-sen" for="b-sen" style="--c:#33424e;--h:186px;--p:38%">
            <span class="t">千と千尋の神隠し</span><i class="prog"></i>
          </label>
          <div class="sp-d dvd" style="--c:#2a333d;--h:178px">
            <span class="t">イノセンス</span><span class="a">押井守</span>
          </div>
          <div class="sp-d dvd" style="--c:#4a3b45;--h:190px">
            <span class="t">千年女優</span><span class="a">今敏</span>
          </div>
          <div class="sp-add"><svg data-icon="tabler/plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path></svg></div>
        </div>
        <div class="run" aria-hidden="true">
          <div class="sp-d" style="--c:#2f6257;--w:52px;--h:218px;--p:64%" data-brief-id="card-4" data-brief-role="card"><span class="t">舟を編む</span><span class="a">三浦しをん</span><i class="prog"></i></div>
          <div class="sp-d" style="--c:#37414d;--w:60px;--h:232px;--p:31%" data-brief-id="card-5" data-brief-role="card"><span class="t">三体</span><span class="a">劉慈欣</span><i class="prog"></i></div>
          <div class="sp-d" style="--c:#5a3a41;--w:48px;--h:206px" data-brief-id="card-6" data-brief-role="card"><span class="t">告白</span><span class="a">湊かなえ</span></div>
          <div class="sp-d" style="--c:#41503a;--w:50px;--h:224px" data-brief-id="card-7" data-brief-role="card"><span class="t">ノルウェイの森</span><span class="a">村上春樹</span></div>
          <div class="sp-d" style="--c:#46564f;--w:46px;--h:198px" data-brief-id="card-8" data-brief-role="card"><span class="t">コンビニ人間</span><span class="a">村田沙耶香</span></div>
          <div class="sp-d" style="--c:#4c6478;--w:48px;--h:210px" data-brief-id="card-9" data-brief-role="card"><span class="t">氷菓</span><span class="a">米澤穂信</span></div>
          <div class="sp-d" style="--c:#5b4a52;--w:56px;--h:236px" data-brief-id="card-1q84" data-brief-role="card"><span class="t">1Q84</span><span class="a">村上春樹</span></div>
          <div class="sp-d cd" style="--c:#7d5a40" data-brief-id="card-waltz-for-debby" data-brief-role="card"><span class="t">WALTZ<br>FOR DEBBY</span></div>
          <div class="sp-d cd" style="--c:#3a567a" data-brief-id="card-kind-of-blue" data-brief-role="card"><span class="t">KIND OF BLUE</span></div>
          <div class="sp-d cd" style="--c:#6e675c" data-brief-id="card-goldberg-variations" data-brief-role="card"><span class="t">GOLDBERG<br>VARIATIONS</span></div>
          <div class="sp-d dvd" style="--c:#33424e;--h:186px;--p:38%" data-brief-id="card-10" data-brief-role="card"><span class="t">千と千尋の神隠し</span><i class="prog"></i></div>
          <div class="sp-d dvd" style="--c:#2a333d;--h:178px" data-brief-id="card-11" data-brief-role="card"><span class="t">イノセンス</span><span class="a">押井守</span></div>
          <div class="sp-d dvd" style="--c:#4a3b45;--h:190px" data-brief-id="card-12" data-brief-role="card"><span class="t">千年女優</span><span class="a">今敏</span></div>
          <div class="sp-add" data-brief-id="card-13" data-brief-role="card"><svg data-icon="tabler/plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14"></path></svg></div>
        </div>
      </div>
      <div class="board" data-brief-id="card-2" data-brief-role="card"></div>
      <div class="scroll-hint" data-brief-id="card-3" data-brief-role="card"><svg data-icon="tabler/chevrons-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m7 7l5 5l-5 5m6-10l5 5l-5 5"></path></svg>横にスクロール</div>
    </div>
    <div class="scene-fade"></div>
  </div>

  
  <div class="chips">
    <span class="chip on">すべて<b>197</b></span>
    <span class="chip">書籍<b>128</b></span>
    <span class="chip">CD<b>42</b></span>
    <span class="chip">DVD<b>27</b></span>
    <span class="chip">未読のみ<b>34</b></span>
    <span class="chip">メモ付きのみ表示</span>
  </div>
  <p class="chip-cap"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>読書メモ・視聴メモを書き込んだ作品</p>

  
  <article class="detail" id="d-fune">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-5" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">読み進め中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 5件</span>
      </div>
      <h2>舟を編む</h2>
      <p class="d-author">三浦しをん</p>
      <div class="meter" data-brief-id="card-14" data-brief-role="card"><i style="width:64%"></i></div>
      <div class="d-stats" data-brief-id="card-p-182-28564" data-brief-role="card"><span class="l">p.182 / 285</span><span class="r">64%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-16-328605" data-brief-role="card"><span>ISBN</span><b>978-4-16-328605-7</b></div>
      <div class="d-actions" data-brief-id="card-15" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-2" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-3" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-santi">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-2" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">読み進め中・視聴中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 2件</span>
      </div>
      <h2>三体</h2>
      <p class="d-author">劉慈欣</p>
      <div class="meter" data-brief-id="card-16" data-brief-role="card"><i style="width:31%"></i></div>
      <div class="d-stats" data-brief-id="card-p-112-36031" data-brief-role="card"><span class="l">p.112 / 360</span><span class="r">31%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-15-050027" data-brief-role="card"><span>ISBN</span><b>978-4-15-050027-4</b></div>
      <div class="d-actions" data-brief-id="card-17" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-4" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-5" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-kokuhaku">
    <div class="card">
      <div class="d-top" data-brief-id="card-book-0" data-brief-role="card">
        <span class="tag">Book</span>
        <span class="tag st">未読</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ 0件</span>
      </div>
      <h2>告白</h2>
      <p class="d-author">湊かなえ</p>
      <div class="meter" data-brief-id="card-18" data-brief-role="card"><i style="width:0%"></i></div>
      <div class="d-stats" data-brief-id="card-p-0-2710" data-brief-role="card"><span class="l">p.0 / 271</span><span class="r">0%</span></div>
      <div class="d-meta" data-brief-id="card-isbn978-4-10-127241" data-brief-role="card"><span>ISBN</span><b>978-4-10-127241-2</b></div>
      <div class="d-actions" data-brief-id="card-19" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-6" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>読書メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-7" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-waltz">
    <div class="card">
      <div class="d-top" data-brief-id="card-cd-3" data-brief-role="card">
        <span class="tag">CD</span>
        <span class="tag st">視聴済み</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>視聴メモ 3件</span>
      </div>
      <h2>WALTZ FOR DEBBY</h2>
      <p class="d-author">ビル・エヴァンス・トリオ</p>
      <p class="d-sub">1962 ・ RIVERSIDE RECORDS</p>
      <div class="d-meta" data-brief-id="card-jan4988031-302219" data-brief-role="card"><span>JAN</span><b>4988031-302219</b></div>
      <div class="d-actions" data-brief-id="card-20" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-8" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>視聴メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-9" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

  <article class="detail" id="d-sen">
    <div class="card">
      <div class="d-top" data-brief-id="card-dvd-1" data-brief-role="card">
        <span class="tag">DVD</span>
        <span class="tag st">視聴中</span>
        <span class="d-memo"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>視聴メモ 1件</span>
      </div>
      <h2>千と千尋の神隠し</h2>
      <p class="d-author">宮崎駿</p>
      <div class="meter" data-brief-id="card-21" data-brief-role="card"><i style="width:38%"></i></div>
      <div class="d-stats" data-brief-id="card-00-47-125-38" data-brief-role="card"><span class="l">00:47 / 125分</span><span class="r">38%</span></div>
      <div class="d-meta" data-brief-id="card-jan4959241-982233" data-brief-role="card"><span>JAN</span><b>4959241-982233</b></div>
      <div class="d-actions" data-brief-id="card-22" data-brief-role="card">
        <button class="btn-acc" type="button" data-brief-id="button-10" data-brief-role="button"><svg data-icon="tabler/pencil" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16zm9.5-13.5l4 4"></path></svg>視聴メモを書く</button>
        <button class="btn-ghost" type="button" data-brief-id="button-11" data-brief-role="button">詳細<svg data-icon="tabler/chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m9 6l6 6l-6 6"></path></svg></button>
      </div>
    </div>
  </article>

</main>

<nav class="tabs" data-brief-role="tab-bar" data-brief-id="nav-top">
  <a class="tab" href="#" aria-current="page" data-brief-id="button-12" data-brief-role="button"><svg data-icon="tabler/home" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></g></svg>本棚</a>
  <a class="tab" href="#" data-brief-id="button-13" data-brief-role="button"><svg data-icon="tabler/search" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6"></path></svg>検索</a>
  <a class="tab tab-scan" href="#" aria-label="スキャン" data-brief-id="button-14" data-brief-role="button"><svg data-icon="tabler/scan" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic ic-lg" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M17 3h2a2 2 0 0 1 2 2v2m-4 14h2a2 2 0 0 0 2-2v-2"></path></svg></a>
  <a class="tab" href="#" data-brief-id="button-15" data-brief-role="button"><svg data-icon="tabler/notebook" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m3 0v18m4-14h2m-2 4h2"></path></svg>メモ</a>
  <a class="tab" href="#" data-brief-id="button-16" data-brief-role="button"><svg data-icon="tabler/settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" data-icon-style="line" class="ic" style="max-width:32px;max-height:32px"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0"></path></g></svg>設定</a>
</nav>

</body></html>
```

Use the tokens as CSS variables. Treat the reference HTML as the visual
source of truth; adapt structure to your framework, but do not deviate
from the visual system.
