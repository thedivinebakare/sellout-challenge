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

## Page 1 full conversion elevation (Option A - 2026-08-19)
- **Aesthetic & Visual Status:** Luxury dark ink + pearl editorial backdrop, radial ambient mesh glows, glassmorphic micro-borders, and layered spring cards.
- **Hero Command Center:** Added floating interactive "Challenge Implementation Hub" preview card showcasing Live Room, Daily Action Sheets, and Feedback Hotseats.
- **Visceral Agitation ("The Hustle Trap"):** Upgraded problem section with 3 realistic visual DM/analytics scenario cards (The "Seen" Zone DM ghosting, The Algorithm Treadmill, and Random Unpredictable Sales) plus internal whisper quote boxes.
- **The Proprietary Mechanism ("The 3-Pillar Sell Out System"):**
  1. *Pillar 01: Irresistible Offer Architecture* (Day 3 Deliverable: 1-Page Offer Blueprint)
  2. *Pillar 02: Frictionless Positioning* (Day 4 Deliverable: High-Ticket Positioning Matrix)
  3. *Pillar 03: Conversational Inbound Closing* (Day 5 Deliverable: Inbound DM Script)
- **Curriculum Sprint Roadmap:** Converted 7 daily rows into actionable Sprint Cards with tactical deliverable tags.
- **Value Stack & Bonuses:** Financial ledger card with animated count-up counters + 3 standalone mockup bonus cards (The AI Sales Copy Vault, The Sell Out Messaging Playbook PDF, Live Offer Hotseat Pass) totaling over ₦80,000+ in value.
- **Proof & Guarantee:** Verified student review cards with 3D tilt + Official Zero-Risk Commitment Certificate.
- **Enforced Rules:** Strictly 0 em dashes (`—`), 0 `transition-all`, 7/7 CTAs pointing to `step-2.html`. Server running on port 3000.

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
