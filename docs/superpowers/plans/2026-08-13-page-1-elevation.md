# Page 1 Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the built `index.html` sales page from "basic" to a modern, high-converting, premium page: bigger editorial type, Instrument Serif italic accents, numbered section markers, watermark numerals, a marquee band, money counters, a countdown, plus new Testimonials, Guarantee, and FAQ sections.

**Architecture:** Single-file page with inline Tailwind + CSS + JS (unchanged approach). Elevate the existing 12 sections in place, insert 4 new blocks (Testimonials, Guarantee, FAQ, Countdown), and add 3 design building blocks (marquee, counters, section markers/watermarks). No build step, no framework.

**Tech Stack:** Tailwind CDN, Bricolage Grotesque + Archivo + IBM Plex Mono + Instrument Serif (Google Fonts), vanilla JS (IntersectionObserver), local server `node serve.mjs` on `http://localhost:3000`, Puppeteer QA + screenshots.

## Global Constraints
- **No em dashes (—) anywhere in copy.** Use commas, periods, or colons. En dashes in ranges (₦50k–₦200k) are allowed. Applies to `index.html` and the copy map.
- **No `transition-all`.** Only `transform` + `opacity` animations; spring easing `cubic-bezier(.16,1,.3,1)`.
- **No default Tailwind blue/indigo.** Brand hex only: royal `#2654B6`, royal-deep `#16357F`, royal-light `#3A6FE0`, pearl `#FBFCF8`, ink `#0B1526`, accent `#FF6B35`. Plus tints: `#EDF2FB`, `#7FA3F0`, `#FFA37D`, `#B0454B`, `#B7C2D6`, `#E6EAF3`, `#9AA7BE`, `#5A6B85`.
- Layered, color-tinted shadows (no flat `shadow-md`). Multi-radial gradients + SVG grain overlay.
- `:focus-visible`, `:hover`, `:active` on every interactive element.
- Images get gradient overlay + color treatment (proof cards get a bottom gradient scrim on the reference funnel pattern).
- Content never invents facts. Confirmed facts: 60–90 min/day; replays shared in Telegram community (no duration claim); **no refunds after joining**; guarantee = commitment guarantee (work-review promise, NOT money-back).
- CTA verb exact: **Join the Sell Out Challenge** → `step-2.html` (short bar variant: Join the Challenge).
- Mobile-first responsive. All CTAs keep `step-2.html` target.

## Design decisions (approved by user 2026-08-13)
- Hero center-aligned. Type: hero `clamp(3rem, 7vw, 6rem)` tracking `-0.035em`; H2 `clamp(2.5rem, 4.5vw, 4rem)` tracking `-0.03em`; body `1.125–1.375rem` line-height `1.7`.
- Instrument Serif (italic only) on: Reframe "want", Vision "Because confusion is expensive.", story pull-quote, Guarantee commitment line, closing "The choice is yours.".
- `.sec-marker` mono editorial markers `01 / The Pattern` style with flex hairline; light variants on dark sections.
- `.watermark` outlined Bricolage numerals (Reframe 02, Curriculum 05, Bonuses 07, Testimonials 10, Story 11, FAQ 13).
- Marquee band (ink) under hero; seamless `translateX(-50%)` loop; pauses on hover; disabled under `prefers-reduced-motion`.
- Counters (`data-count`, `data-prefix`, `data-suffix`) on TOTAL VALUE ₦60,000+, bonus total ₦80,000+, price ₦5,000. rAF ease-out; instant under reduced motion.
- Countdown: dummy, 7 days from page load, 4 cells (Days/Hours/Min/Sec). **Must be replaced with the real early-bird deadline before launch.**
- Testimonials: 7 proof cards from `assets/proofs/` (King David, TBS, Malik Esther, Ajet, Morayo, Solomon, Tife). Mobile = horizontal snap-scroll; sm+ = grid with `lg:mt-14` offsets.
- Guarantee: ink card, shield icon, commitment copy (no refunds; keep reviewing work until it works).
- FAQ: 8 `<details>/<summary>` items, hairline rows, rotating `+` chip.

## Files
- Modify: `index.html` (full elevation).
- Modify: `docs/superpowers/plans/2026-08-12-page-1-copy.md` (em-dash purge + new sections 13–15 + countdown note).
- Modify: `memory.md` (no-em-dash rule, Instrument Serif, elevation notes, Tife asset).
- Create: `docs/superpowers/plans/2026-08-13-page-1-elevation.md` (this file).
- QA: `%TEMP%\opencode\qa-elevation.mjs` + `shot-elevation.mjs` (screenshots to `temporary screenshots/`).

## Tasks
- [ ] Task 1 — Rewrite `index.html` with the full elevation (done 2026-08-13): type scale, serif accent, markers, watermarks, marquee, counters, countdown, testimonials, guarantee, FAQ, em-dash purge, centered hero.
- [ ] Task 2 — Purge em dashes from copy map + add new section copy + countdown note (done).
- [ ] Task 3 — Update `memory.md` (done).
- [ ] Task 4 — Programmatic QA: em dash count in `body.innerText` = 0; no `transition-all`; 4 font families load (Instrument Serif included); no horizontal overflow at 1280x800 and 390x844; 7/7 CTA hrefs = `step-2.html`; 7 proof images + portrait + logo all load (naturalWidth > 0); 8 `<details>` items toggle to `[open]`; countdown cells tick; 3 counters animate; ≥10 section markers; 6 watermarks; no console/page errors.
- [ ] Task 5 — Screenshots (desktop full-page + mobile full-page) into `temporary screenshots/`; 2 comparison rounds with the user.

## Verification commands
- Em dashes in rendered copy: check `document.body.innerText` for U+2014 → expect 0.
- `transition-all` scan: `index.html` contains no `transition-all`.
- Serve + QA: `node serve.mjs`, then run QA script from `C:\Users\NexusPC\AppData\Local\Temp\puppeteer-test` (workdir) targeting `http://localhost:3000`.

## Execution handoff
Completed inline in this session on 2026-08-13 after user approval ("let's build"). No commits/deploys (per global rules; repo has no remote yet).
