# FlowDesk Sales Command Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the private outreach dashboard (`leads/leads-dashboard.html`) into the FlowDesk revenue-and-conversion command center — executive pulse banner, lead health, personal pay links, dossier drawer, and a turbo closing engine — without touching the public Sell Out Challenge funnel.

**Architecture:** Two files change. `leads/leads-dashboard.html` (single-file, inline CSS/JS, 1531 lines today) gains: FlowDesk brand shell, a pulse banner (conversion gauge + cash-realization meter + alert strip), tokenized angles + personal pay-link, a right-side dossier drawer replacing the centered modal, expanded objection/note tooling, and turbo speed-run mode. `step-2.html` gains additive `?ref=` consumption so personal pay links display the caller's reference at checkout. All state continues to persist in the existing `soc_*` localStorage records (keys unchanged, so no data loss).

**Tech Stack:** Plain HTML + Tailwind CSS CDN + vanilla JS (single file convention), Puppeteer (`node screenshot.mjs`, `node serve.mjs`) for verification. New dev-only helper: `leads/verify-flowdesk.mjs`.

## Global Constraints

(Every task inherits these. Exact values, copied verbatim.)

- **Do NOT modify:** `index.html`, `step-3.html`, `leads/data/leads-data.js`, `leads/data/*.csv`, `serve.mjs`, `screenshot.mjs`, `assets/*`, `reference/*`.
- **Only files modified:** `leads/leads-dashboard.html` (primary), `step-2.html` (additive `?ref=` support only — zero visual/checkout-logic change), new dev-only `leads/verify-flowdesk.mjs`.
- **Storage keys unchanged:** `soc_cmd_unlocked`, `soc_progress_v1`, `soc_arsenal_v1`. Never rename, or existing progress is lost.
- **Brand name is `FlowDesk`** (not FlowOS / DealFlow / FlowKit), used in title, meta, header badge, favicon (FD mark). Brand palette locked: surface `#070B16`, pearl `#FBFCF8`, royal `#2654B6`, royal-deep `#16357F`, royal-light `#3A6FE0`, amber `#F5A623`, tier2 `#4A9EFF`, tier3 `#34D399`, tier4 `#6B7280`.
- **Type:** Instrument Serif (display), Inter (body), JetBrains Mono (all numerals/data labels). Body line-height 1.7; display tracking `-0.03em`.
- **Pricing truth:** full price ₦10,000; coupon `SELLOUT25` → ₦7,500; seat goal 50 → ₦500,000 at full price. All new revenue math uses these numbers. (Current code at line 665-666 hardcodes 5000 — must change.)
- **Animation:** transform + opacity ONLY. Spring easing `cubic-bezier(0.16,1,0.3,1)`, 150–300ms. **No `transition-all`.** Respect `@media (prefers-reduced-motion: reduce)`.
- **Interaction states:** every clickable element ships hover + `:focus-visible` + `:active` (tactile `scale`/`translate`). Touch targets ≥ 44px.
- **Keyboard:** `Esc` closes top-most overlay (confirm → turbo → dossier → arsenal). Shortcuts only fire when NOT typing and NO overlay is open. Preserve browser/system shortcuts.
- **Copy:** sentence case, action verbs, one register (command-center mono). Errors/empty states direct, never moody, never apologetic.
- **Don't break the public funnel:** nothing in `index.html`/`step-3.html`; `step-2.html` change is strictly additive (a `?ref=` param influences the displayed reference when present, otherwise behavior identical).
- **Verify on localhost only** (`node serve.mjs` → `http://localhost:3000`); screenshots auto-saved to `temporary screenshots/screenshot-N-label.png`; read the PNGs back with the Read tool. Do ≥2 comparison passes at 1280×800 and 375×844.
- **Gate:** the dashboard is gated (SHA-256 on `soc_cmd_unlocked` session key). Puppeteer runs must seed sessionStorage via `page.evaluateOnNewDocument(() => { try { sessionStorage.setItem('soc_cmd_unlocked','1'); } catch(e){} })`.

---

### Task 1: FlowDesk brand shell + pricing truth

**Files:**
- Modify: `leads/leads-dashboard.html:6` (title), `:7` (favicon), `:281-310` (header)
- Test: `leads/verify-flowdesk.mjs` (created this task, reused by all later tasks)

**Interfaces:**
- Produces: `LEADS`, `progress`, `saveProgress()`, `renderPipeline()`, `renderStats()`, `applyFilters()` retained as-is; new module-level constants `SEAT_TARGET = 50`, `PRICE_FULL = 10000`, `PRICE_COUPON = 7500`, and `BRAND = "FlowDesk"`.

- [ ] **Step 1: Create the verification harness** `leads/verify-flowdesk.mjs` (Puppeteer driver; also unlocks the gate) — full source in build output.
- [ ] **Step 2: Run harness**, confirm gate bypass + grid renders: `node leads/verify-flowdesk.mjs` → `gateHidden: true`, `cards > 0`, `errors: []`
- [ ] **Step 3: Rename title + favicon** (`SO` text → `FD` mark). Title → `FlowDesk · Revenue & Outreach Command`.
- [ ] **Step 4: Replace the header block** (lines 281–310) with the FlowDesk badge row + `#status-strip`, plus `renderStatusStrip()` renderer.
- [ ] **Step 5: Fix pricing constants** — `SEAT_TARGET = 50`, `PRICE_FULL = 10000`, `PRICE_COUPON = 7500`; remove legacy `PRICE = 5000`.
- [ ] **Step 6: Wire `renderStatusStrip`** into `bootstrap()` and at the end of `renderPipeline()`.
- [ ] **Step 7: Verify** (harness + screenshots 1280×800 / 375×844, read PNGs).
- [ ] **Step 8: Commit** — `feat(flowdesk): brand shell, revenue truth, and gate-aware verify harness`

### Task 2: Executive pulse banner (conversion gauge, cash meter, alert strip)

**Files:**
- Modify: `leads/leads-dashboard.html:313` (insert `#pulse-banner` + `#alert-strip`), `:662-703` (pulse renderer split from renderPipeline)
- Test: `leads/verify-flowdesk.mjs` (extend)

**Interfaces:**
- Consumes: `pipelineCounts()`, `progress`, `dueTouch(phone)`, `isContacted(phone)`, `PRICE_FULL`, `SEAT_TARGET`
- Produces: `computeAlerts()` → `[{ icon, label, setTier, setStatus, setFollow }]`; `renderPulse()`; alert chips carry `data-alert` (JSON) consumed via delegated click → `applyFilters()`.

- [ ] **Step 1:** Insert `#pulse-banner` (grid 1/3) + `#alert-strip` after `#pipeline-strip`.
- [ ] **Step 2:** `renderPipeline()` ends with `renderPulse()`; hoist `goal = SEAT_TARGET * PRICE_FULL` to module scope.
- [ ] **Step 3:** Add `computeAlerts()` (VIP uncontacted / VIP cooling 24h+ / Touch 3 due / cohort-full) and `renderPulse()` (conversion gauge card, cash meter card, priority alert chips).
- [ ] **Step 4:** Delegated click on `#pulse-banner [data-alert]` → parse JSON → set tier/status/follow filters → `renderStats()` + `applyFilters()` + `flash()`.
- [ ] **Step 5:** Verify (screenshot both viewports) + harness asserts (`pipelineCells === 5`, pulse cells === 3, `errors: []`).
- [ ] **Step 6:** Commit — `feat(flowdesk): executive pulse banner with conversion gauge, cash meter, and priority alerts`

### Task 3: Lead health chip + spring status pills

**Files:**
- Modify: `leads/leads-dashboard.html:585-597` (chip helpers), `:856-914` (renderCard), `:803-811` (status delegation), `:972-984` (grid click delegation)
- Test: `leads/verify-flowdesk.mjs` (extend)

**Interfaces:**
- Produces: `healthOf(lead)` → `{ icon, label, cls }`; `healthChip(lead)`; `STATUS_CHAIN = ["New","Contacted","In Conversation","Enrolled"]`; `statusNext(status)`; `statusPillLabel(phone)`; `advanceStatus(phone)`; delegated click on `[data-health-advance]`.

- [ ] **Step 1:** Add health + pill helpers after `dueChip`.
- [ ] **Step 2:** Prepend `healthChip(l)` to the card chips row.
- [ ] **Step 3:** Replace the status `<select>` on cards with the spring pill button (`data-health-advance`, `min-h-11`).
- [ ] **Step 4:** Delegated click → `advanceStatus(phone)`; scope the old status-select change handler to the dossier (`#modal-content .status-select`).
- [ ] **Step 5:** Verify persistence (click → localStorage → reload → assert same status) + screenshots.
- [ ] **Step 6:** Commit — `feat(flowdesk): lead health chips and one-tap spring status pills with persistence`

### Task 4: Tokenized angles + personal pay link

**Files:**
- Modify: `leads/leads-dashboard.html:473-478` (ANGLES), `:493-496` (msgFor), `:856-914` (renderCard) — no `leads-data.js` changes
- Test: extend `verify-flowdesk.mjs`

**Interfaces:**
- Produces: `payRef(lead)` → `"SOC-" + digits.slice(-5)`; `payLinkFor(lead)` → `location.origin + "/step-2.html?ref=" + payRef(lead)`; `composeToken(lead, angle)` for `urgent`/`objection`; `ANGLES` grows to 6.

- [ ] **Step 1:** Extend `ANGLES` with `urgent` (⏰ Urgent Proof) and `objection` (🛡️ Objection Breaker).
- [ ] **Step 2:** Add `payRef`/`payLinkFor`/`composeToken`.
- [ ] **Step 3:** Route `msgFor` → `composeToken` for the two new angles.
- [ ] **Step 4:** Angle pill row wraps 3-per-row (`flex-wrap`, `flex-[1_1_calc(33.333%-4px)]`).
- [ ] **Step 5:** Pay-link copy button (`data-paylink`, `w-11 h-11`) in card header cluster; delegated handler → `copyText(payLinkFor(l), "Seat link")`.
- [ ] **Step 6:** Verify (compose outputs, payLink URL shape, pill wrap) + screenshots.
- [ ] **Step 7:** Commit — `feat(flowdesk): tokenized urgent/objection angles and per-lead personal pay links`

### Task 5: `step-2.html` personal reference support

**Files:**
- Modify: `step-2.html:616-620` (`getBankRef`)
- Test: extend `verify-flowdesk.mjs`

**Interfaces:**
- Produces: `getBankRef()` honors `?ref=` (trimmed, uppercased, spaces removed) and persists to `sessionStorage['soc_bank_ref']`; zero change when absent.

- [ ] **Step 1:** Replace `getBankRef()` — additive `?ref=` branch before existing logic.
- [ ] **Step 2:** Verify (`step-2.html?ref=SOC-ENIOLA` → `#bank-ref`/`#instructions-ref` show `SOC-ENIOLA`; no-param unchanged) + step-2 visual sanity screenshot (no delta).
- [ ] **Step 3:** Commit — `feat(checkout): accept ?ref= to preset a lead's personal bank reference`

### Task 6: Dossier drawer (replaces centered modal) + objection toolkit + notes/audit trail

**Files:**
- Modify: `leads/leads-dashboard.html:401-408` (modal → drawer), `:1027-1142` (modal JS → dossier JS), `:1260-1427` (objection additions), `:469-498` (progress record shape)
- Test: extend `verify-flowdesk.mjs`

**Interfaces:**
- Consumes: `progress[phone].history` (`{angle, timestamp}`), `.notes` (`{text, ts}`)
- Produces: `renderModal(lead)` (dossier), `openModal`/`closeModal` unchanged signatures, `renderAudit(rec)`, `handleNote()`, `OBJECTION_META`, new `ARSENAL_COPY` keys `PMT_THINK`/`PMT_LIVE`/`PMT_INSTAL`, dossier slide-in CSS classes.

- [ ] **Step 1:** Replace modal markup with `#dossier-panel`/`#dossier-backdrop` drawer + `.open` CSS transitions.
- [ ] **Step 2:** Rewire open/close, Escape order, turbo guard, backdrop click.
- [ ] **Step 3:** Rebuild `renderModal` as the dossier (facts grid, pay link row, 6 angle tabs, follow-ups, message, status select, live objections, audit + note logger).
- [ ] **Step 4:** `renderAudit` + `handleNote` persist notes; add `OBJECTION_META` + 3 new `ARSENAL_COPY` strings + `copyArsenal` cases.
- [ ] **Step 5:** Verify (note add → persist → reload; objection copy; drawer slide; 375px no overflow) + screenshots.
- [ ] **Step 6:** Commit — `feat(flowdesk): dossier drawer with live objections, audit trail, and sticky notes`

### Task 7: Turbo closing engine (queue presets, E key, progress, milestone)

**Files:**
- Modify: `leads/leads-dashboard.html:364-374` (presets UI), `:427-448` (turbo bar), `:1144-1228` (turbo JS)
- Test: extend `verify-flowdesk.mjs` (keyboard dispatch)

**Interfaces:**
- Produces: `turboPresetQueue(key)` (`vip10`/`uncontacted`/`touch2`); `startTurbo(q?)` accepts explicit queue; `turboEnroll()`; `milestone(count)`; `#turbo-progress`; keydown `e`.

- [ ] **Step 1:** Presets UI group (`data-preset`) before turbo-limit select.
- [ ] **Step 2:** `turboPresetQueue` + refactored `startTurbo(q)` + preset click wiring.
- [ ] **Step 3:** Turbo bar: progress track + Enroll `E` button.
- [ ] **Step 4:** `turboEnroll`, `milestone` (toast + vibrate gated on reduced-motion), progress width in `syncTurboBar`.
- [ ] **Step 5:** Keyboard `e` branch.
- [ ] **Step 6:** Verify (preset queue contents, E/S/Esc dispatch, persistence, progress) + screenshots.
- [ ] **Step 7:** Commit — `feat(flowdesk): turbo queue presets, E-key enrollment, progress track, and milestone feedback`

### Task 8: Keyboard/focus/a11y + contrast + reduced-motion audit

**Files:**
- Modify: `leads/leads-dashboard.html:1236-1258` (keyboard router), `:252-256` (reduced-motion), targeted class tweaks

**Interfaces:**
- Produces: `anyOverlayOpen()`; single keyboard router; `lastFocused` focus restore; reduced-motion overrides.

- [ ] **Step 1:** Replace keydown with single router (Escape top-down; gate on `anyOverlayOpen` + `typing` + ctrl/meta/alt).
- [ ] **Step 2:** Dossier focus management (store `lastFocused`, restore on close, focus close btn on open).
- [ ] **Step 3:** Reduced-motion overrides for dossier/arsenal/confirm/turbo/ping.
- [ ] **Step 4:** Contrast bumps on tiny new labels (10-11px `text-gray-600`→`gray-400` where below AA), touch targets to 44px (`w-11 h-11`), `:focus-visible` rings on new controls.
- [ ] **Step 5:** Verify (reduced-motion emulation, tab focus, Escape walk) + screenshots.
- [ ] **Step 6:** Commit — `style(flowdesk): keyboard router, focus management, reduced-motion, and contrast/touch audit`

### Task 9: Full verification pass + CSV/export integrity + final commit

**Files:**
- Test: `leads/verify-flowdesk.mjs` (all scenarios); screenshot workflow both viewports, PNG read-back
- No source changes unless a check fails.

- [ ] **Step 1:** Run full harness suite + funnel sanity screenshots (`/`, `step-2.html`, `step-3.html`).
- [ ] **Step 2:** Two-round visual compare (1280×800 + 375×844; dashboard default / dossier / turbo).
- [ ] **Step 3:** Zero-uncaught-error sweep (all angles, tabs, objections, notes, turbo keys, step-2 ref flow).
- [ ] **Step 4:** Funnel non-regression — `git status` shows only intended files; funnel screenshots identical to baseline.
- [ ] **Step 5:** Final commit — `feat(flowdesk): ship revenue pulse, dossier drawer, tokenized angles, and turbo closing engine`

---

## Self-Review (against the plan spec)

- Brand shell + exposed stats → Task 1
- Pulse banner (gauge, meter, alerts) → Task 2
- Angle switcher into cards + health/momentum → Tasks 3, 4
- One-click WA + springs + pay link → Tasks 3, 4
- Dossier + objection destroyer + audit/notes → Task 6
- Turbo W/S/E/Esc + presets + progress + milestone → Task 7
- `1-4` angle hotkeys → **explicitly dropped** (collision risk) in Task 8
- localStorage persistence + export/import → Tasks 3/6/9
- Public funnel untouched → Global Constraints + Task 9
- `step-2.html?ref=` prefill → Task 5
- Pricing aligned ₦10,000 / coupon ₦7,500 → Tasks 1, 2