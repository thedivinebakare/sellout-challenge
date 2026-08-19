# Memory — Sell Out Challenge

Session note: created 2026-08-12. Keep this current — overwrite stale sections.

## Project overview
- **Sell Out Challenge** = Divine Bakare's 3-step challenge course funnel (3 separate pages).
- **Location:** `C:\Users\NexusPC\Projects\Sell Out Challenge`
- **Sibling repo:** Sell Out Campaign registration funnel at `C:\Users\NexusPC\Projects\Sell Out Campaign` (live: https://selloutreg.vercel.app). Brand + assets are shared; needed assets are copied into this repo so it's self-contained.
- **Git repo:** yes — no remote yet. Intended: `https://github.com/thedivinebakare/sellout-challenge.git`, branch `main`, identity Divine Bakare <officialdivinebakare@gmail.com>.
- **Not yet deployed.** Intended Vercel project: `sellout-challenge` → `https://sellout-challenge.vercel.app`. First deploy links the project.

## Structure
- `index.html` — **Step 1** of the funnel (single-file, inline styles, Tailwind CDN, mobile-first). **BUILT + ELEVATED (2026-08-13): 15 sections.**
- `step-2.html` — **Step 2** (payment page — NOT built yet; all CTAs on `index.html` link here).
- `step-3.html` — **Step 3** (thank-you — NOT built yet).
- `docs/superpowers/plans/2026-08-12-page-1-sales-page.md` — implementation plan.
- `docs/superpowers/plans/2026-08-12-page-1-copy.md` — final copy map (copy source for the build; updated 2026-08-13 with new sections + em-dash purge).
- `docs/superpowers/plans/2026-08-13-page-1-elevation.md` — elevation implementation plan.

## COPY RULES (user-set)
- **NO em dashes (—) anywhere in copy. Use commas, periods, or colons.** Applies to all pages, copy maps, and new copy. En dashes in ranges (₦50k–₦200k) are fine.

## Page 1 build decisions (2026-08-12)
- Full-length sales page, 12 sections per the approved copy map.
- Funnel structure (per Divine's copy): Hero → Agitation ("Does this sound familiar?") → Reframe ("Here's what most people don't realise") → Vision ("Imagine this...") → Intro (Sell Out Challenge) → Day 1–7 Curriculum → Value Stack (₦60,000+ ledger) → Bonuses (₦80,000+) → Price (₦5,000 early bird → ₦7,500 → ₦10,000 tiers) → Who For/Not → Divine's Story → Closing CTA → Footer.
- Offer facts: 7-day live challenge, 7 live classes, price tiers ₦5,000 (first 50) / ₦7,500 / ₦10,000, value stack ₦60,000+, bonuses total ₦80,000+.
- Design: TDB palette (royal/pearl/ink + accent orange), Bricolage Grotesque display + Archivo body + IBM Plex Mono labels, "₦ ledger" concept (money-sweep underline, mono value-ledger card), grain overlay, layered royal/orange shadows, dark ink sections alternating with pearl/white.
- All CTAs → `step-2.html` (payment page). Nav anchors scroll to `#journey`, `#what-you-build`, `#pricing`; `#join` = closing CTA section.
- Interactive: sticky CTA bar (shows after 80% viewport scroll), scroll progress rail, reveal-on-scroll (34 elements), mobile menu, hover/focus/active on all CTAs.
- QA: puppeteer screenshots saved (`temporary screenshots/screenshot-*.png`); programmatic QA scripts at `Temp/opencode/qa*.mjs` (fonts, overflow, guardrails, reveal verification). No console errors. NOTE: current session model cannot read images — visual confirmation is on the user.
- `assets/` — ALL local images: `tdb-logo.png`, `My Image (1).jpg` (Divine's portrait), `proofs/` (testimonials incl. `Tife's review...jpg` + `cropped/`). Reference as `assets/...`.
- `reference/` — blueprint + reuse sources: `registration-funnel/index.html` (snapshot of the LIVE registration build for importing sections/assets), `visual-identity.md` (brand guide), `3 step workshop funnel.jpg`, `SELL OUT WIREFRAME.png`, `arena-masterclass-page.html`.
- `serve.mjs` — local server on port 3000 (`node serve.mjs`; `PORT` env overrides).
- `screenshot.mjs` — desktop (1280x800) puppeteer screenshot → `temporary screenshots/screenshot-N[-label].png`.
- `CLAUDE.md` — frontend rules (invoke `frontend-design` skill first; never `file://` screenshots; deploy workflow).

## Page 1 elevation decisions (2026-08-13)
- User approved "full design privileges" after feedback that the first build was "basic/weak/generic". Wants modern, high-converting, premium.
- **Type:** Bricolage Grotesque display + Archivo body + IBM Plex Mono labels + **Instrument Serif (italic only)** accent for pull-quotes and signature sublines (e.g. "Because confusion is expensive.", "The choice is yours.", the story pull-quote, the guarantee commitment line). Hero `clamp(3rem,7vw,6rem)`; H2 `clamp(2.5rem,4.5vw,4rem)`.
- **Hero is center-aligned.** Marquee band (ink) below hero: "Sell Out Challenge · 7 Days · ₦50k–₦200k System · Live Classes · Assignments · Feedback · Telegram Community" (seamless CSS loop, pauses on hover, disabled under reduced motion).
- **New building blocks:** `.sec-marker` editorial section numbers (01–14 with flex hairline; light variants on dark sections), `.watermark` outlined numerals behind H2s (Reframe 02, Curriculum 05, Bonuses 07, Testimonials 10, Story 11, FAQ 13), `.serif-i` Instrument Serif italic, count-up counters (`data-count`/`data-prefix`/`data-suffix` on ₦60,000+, ₦80,000+, ₦5,000).
- **New sections (all content user-approved):** Testimonials (7 proof cards: King David, TBS, Malik Esther, Ajet, Morayo, Solomon, Tife from `assets/proofs/`, mobile snap-scroll carousel), Guarantee (commitment guarantee, NO refunds after joining; work-review promise), FAQ (8 `<details>/<summary>` items; replays exist; 60–90 min/day; no refunds), Countdown (dummy, 7 days from page load; replace with real early-bird deadline before launch).
- Section order now: Hero → Marquee → Agitation → Reframe → Vision → Intro → Curriculum → Value → Bonuses → Price → Who For/Not → Testimonials → Story → Guarantee → FAQ → Closing CTA → Footer.
- All em dashes purged from index.html + copy map. En dashes in ranges kept.

## Design system (inherited from TDB visual identity)
- Palette: royal blue `#2654B6`, pearl `#FBFCF8`, ink `#0B1526`, royal deep `#16357F`, royal light `#3A6FE0`, accent orange `#FF6B35` (from registration build CSS vars).
- Type: Bricolage Grotesque display + Archivo body + IBM Plex Mono labels (as used in registration funnel). + Instrument Serif italic accent (added 2026-08-13).
- Funnel structure, section decisions, and chosen refs to be recorded here as the build progresses.

## ENVIRONMENT / TOOLING
- **Dev server:** `node serve.mjs` → http://localhost:3000. Start before screenshots/QA.
- **Screenshots:** `node screenshot.mjs http://localhost:3000 [label]` (desktop). Multi-page: also `http://localhost:3000/step-2.html`, `/step-3.html`.
- **Puppeteer:** installed at `C:/Users/NexusPC/AppData/Local/Temp/puppeteer-test/`; Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`; cache `C:/Users/NexusPC/.cache/puppeteer/`. Always unique timestamped profile dir; **kill stale chrome**: `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ? { $_.CommandLine -match 'profile-' } | % { Stop-Process -Id $_.ProcessId -Force }`.
- **PowerShell flakiness:** node scripts hang sometimes from `Temp\opencode`; run from `puppeteer-test` with workdir. Large `Copy-Item` batches can also hang — copy files individually.

## DEPLOY WORKFLOW (per CLAUDE.md — "make it live")
1. (Once) `git remote add origin https://github.com/thedivinebakare/sellout-challenge.git`
2. `git add . && git commit -m "..."` → `git push origin main`
3. `vercel --prod --name sellout-challenge` (first run links/creates the project; `vercel login` if needed)
4. Verify: `Invoke-WebRequest https://sellout-challenge.vercel.app` → expect 200; tell the user the live link.
- **Never deploy without explicit instruction.**
