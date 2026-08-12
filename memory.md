# Memory — Sell Out Challenge

Session note: created 2026-08-12. Keep this current — overwrite stale sections.

## Project overview
- **Sell Out Challenge** = Divine Bakare's 3-step challenge course funnel (3 separate pages).
- **Location:** `C:\Users\NexusPC\Projects\Sell Out Challenge`
- **Sibling repo:** Sell Out Campaign registration funnel at `C:\Users\NexusPC\Projects\Sell Out Campaign` (live: https://selloutreg.vercel.app). Brand + assets are shared; needed assets are copied into this repo so it's self-contained.
- **Git repo:** yes — no remote yet. Intended: `https://github.com/thedivinebakare/sellout-challenge.git`, branch `main`, identity Divine Bakare <officialdivinebakare@gmail.com>.
- **Not yet deployed.** Intended Vercel project: `sellout-challenge` → `https://sellout-challenge.vercel.app`. First deploy links the project.

## Structure
- `index.html` — **Step 1** of the funnel (single-file, inline styles, Tailwind CDN, mobile-first).
- `step-2.html` — **Step 2**.
- `step-3.html` — **Step 3**.
- `assets/` — ALL local images: `tdb-logo.png`, `My Image (1).jpg` (Divine's portrait), `proofs/` (testimonials + `cropped/`). Reference as `assets/...`.
- `reference/` — blueprint + reuse sources: `registration-funnel/index.html` (snapshot of the LIVE registration build for importing sections/assets), `visual-identity.md` (brand guide), `3 step workshop funnel.jpg`, `SELL OUT WIREFRAME.png`, `arena-masterclass-page.html`.
- `serve.mjs` — local server on port 3000 (`node serve.mjs`; `PORT` env overrides).
- `screenshot.mjs` — desktop (1280x800) puppeteer screenshot → `temporary screenshots/screenshot-N[-label].png`.
- `CLAUDE.md` — frontend rules (invoke `frontend-design` skill first; never `file://` screenshots; deploy workflow).

## Design system (inherited from TDB visual identity)
- Palette: royal blue `#2654B6`, pearl `#FBFCF8`, ink `#0B1526`, royal deep `#16357F`, royal light `#3A6FE0`, accent orange `#FF6B35` (from registration build CSS vars).
- Type: Bricolage Grotesque display + Archivo body + IBM Plex Mono labels (as used in registration funnel).
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
