# Step 2 — Checkout Page Implementation Plan

## Design Decisions Locked

| Decision | Answer |
|----------|--------|
| Product | Single: The Sell Out Challenge at ₦10,000 |
| Coupon | Manual input field, SELLOUT25 → ₦7,500 (25% OFF) |
| Order bump | Skip for now |
| Payment integration | Placeholder/mock (real Paystack setup separately) |
| Layout | Two-column feature-rich (desktop), stacked (mobile) |
| 10 upgrades | All included |

---

## Page Structure

```
step-2.html (single-file, inline everything, zero bundler)

┌─────────────────────────────────────────────────────┐
│  HEADER: TDB crest + "Sell Out Challenge" | 🔒 SSL badge | Cohort 01 pill
├─────────────────────────────────────────────────────┤
│  URGENCY BAR: "Your seat is reserved for 14:59" countdown
├───────────────────────┬─────────────────────────────┤
│  LEFT COLUMN          │  RIGHT COLUMN (sticky)      │
│                       │                             │
│  STEP 01: Details     │  Order Summary Ledger       │
│  - Full Name          │  - 7 items listed           │
│  - WhatsApp Number    │  - Early Bird discount      │
│  - Email Address      │  - Coupon input field       │
│                       │  - Live total (dynamic)     │
│  STEP 02: Coupon      │                             │
│  - Code input + apply │  Guarantee Badge            │
│                       │                             │
│  STEP 03: Payment     │  Testimonial Card           │
│  - Tab: Paystack      │                             │
│  - Tab: Bank Transfer │  Security Badges            │
│  - Tab: International │                             │
│                       │                             │
│  CTA Button           │                             │
│  Trust microcopy      │                             │
├───────────────────────┴─────────────────────────────┤
│  FOOTER: Trust seals · Privacy · WhatsApp float
├─────────────────────────────────────────────────────┤
│  OVERLAYS: Exit-intent modal · Social proof toasts
└─────────────────────────────────────────────────────┘
```

---

## HTML Sections (in order)

**1. Head & Meta**
- Same `<head>` pattern as `index.html`: Tailwind CDN, Google Fonts (Bricolage Grotesque, Archivo, IBM Plex Mono, Instrument Serif), favicon SVG
- Title: "Secure Your Spot | The Sell Out Challenge"
- `<script src="https://js.paystack.co/v1/inline.js"></script>` (loaded but not active until user switches to Paystack tab)

**2. CSS (inline `<style>`)**
- Reuse exact `:root` variables and base typography from `index.html`
- Reuse: `.btn`, `.btn-accent`, `.btn-primary`, `.grain`, `.pulse-dot`, `.money-sweep`, `.mono`, `.font-display`, `.serif-i`
- New checkout-specific styles:
  - `.checkout-grid` — two-column layout (CSS Grid, `grid-template-columns: 1.1fr 0.9fr` on lg+)
  - `.form-input` — styled text inputs with focus ring, padding, border-radius matching brand
  - `.form-label` — mono kicker labels
  - `.form-helper` — small muted helper text below fields
  - `.form-error` — red error state for validation
  - `.tier-card` — radio card for tier selection (border, bg, checked state)
  - `.tier-card.selected` — active state with accent border
  - `.payment-tab` — tab button for payment method switcher
  - `.payment-tab.active` — active tab with accent underline
  - `.payment-panel` — hidden/shown content panel per tab
  - `.order-line` — single row in the order ledger
  - `.order-total` — bold total row with accent color
  - `.coupon-input-group` — input + button inline group
  - `.guarantee-plaque` — embossed badge card
  - `.testimonial-card` — small proof card
  - `.urgency-bar` — fixed-top countdown strip
  - `.exit-modal-overlay` — glassmorphic exit-intent overlay
  - `.whatsapp-fab` — floating WhatsApp button (bottom-right)
  - `.social-toast` — bottom-left social proof notification
  - Mobile overrides: single-column stack, reduced padding, adjusted font sizes

**3. Grain overlay** — identical to `index.html`

**4. Header** (minimal, not the full nav)
- Flex row: TDB crest logo (from `assets/tdb-logo.png` or text fallback) + "Sell Out Challenge" text
- Right side: 🔒 "256-Bit SSL Encrypted" mono badge + "Cohort 01" pill
- Sticky top, glass background on scroll

**5. Urgency Reservation Bar**
- Below header, full-width accent gradient strip
- Copy: "Your seat is reserved for"
- Live countdown badge: `14:59` counting down (15-minute window, stored in sessionStorage so it persists per visitor)
- Microcopy: "Due to live feedback constraints, seats are strictly capped at 50 participants."
- Pulse dot animation on the timer

**6. Main Content — Two-Column Grid**

**LEFT COLUMN: The Checkout Engine**

*Step 01: Participant Details*
- Kicker: "STEP 01 / YOUR DETAILS"
- Subhead: "Enter where your challenge access link and daily workbooks should be sent."
- Field 1: Full Name — placeholder "e.g. Adebayo Johnson", required, autocomplete="name"
- Field 2: WhatsApp Number — placeholder "e.g. 0801 234 5678", required, helper text: "Your private Telegram invite and daily assignment reminders will be delivered here." Auto-format to +234 prefix on blur.
- Field 3: Email Address — placeholder "e.g. adebayo@gmail.com", required, helper text: "Your receipt and Zoom access credentials will be emailed immediately."
- All fields save to sessionStorage on blur (abandoned checkout recovery)

*Step 02: Coupon Code*
- Kicker: "STEP 02: CLAIM YOUR COUPON"
- Input field with inline "Apply" button
- On apply: validate code = "SELLOUT25" (case-insensitive)
  - Success: show "25% OFF applied! You save ₦2,500" + strike through ₦10,000, show ₦7,500
  - Fail: show "Invalid coupon code. Please check and try again."
- Coupon state saved to sessionStorage
- If URL contains `?coupon=SELLOUT25`, auto-apply on page load

*Step 03: Payment Method*
- Kicker: "STEP 03: CHOOSE PAYMENT METHOD"
- Three-tab switcher:
  - **Tab 1: Paystack (Recommended)** — "Pay with debit card, bank transfer, USSD, or Apple Pay"
    - Placeholder CTA area (real Paystack popup wired later)
    - Badge: "Instant automated activation"
  - **Tab 2: Direct Bank Transfer** — "Transfer directly to our bank account"
    - Bank details card: Bank Name, Account Number (with copy button), Account Name
    - Placeholder details (real bank info added later)
    - "After transfer, send proof via WhatsApp" button → generates WhatsApp link with pre-filled message
    - Badge: "Manual verification within 2 hours"
  - **Tab 3: International Payment** — "Pay in USD, GBP, or GHS"
    - Currency toggle pills: USD / GBP / GHS
    - Dynamic conversion display (placeholder rates)
    - Badge: "Powered by Paystack International"

*Primary CTA*
- Button: "🔒 Complete Registration & Secure My Seat · ₦10,000"
- Dynamic price label updates when coupon applied: "· ₦7,500"
- Full-width on mobile, accent orange with shimmer on hover
- Trust microcopy below:
  - ✓ Instant Access Link via Email & WhatsApp
  - ✓ 256-Bit Encrypted Payment Processing
  - ✓ Commitment Guarantee Protected

**RIGHT COLUMN: Order Summary & Trust Engine (sticky on desktop)**

*Order Summary Ledger*
- Card with "Order Summary" header
- Line items:
  - 7-Day Live Implementation Sprint — ₦25,000
  - Live Assignment Reviews & Hotseats — ₦15,000
  - Private Telegram Community Access — ₦10,000
  - Challenge Workbook & Action Sheets — ₦10,000
  - Bonus: 10 AI Messaging Prompts — FREE (₦10,000)
  - Bonus: Sell Out Messaging Guide (PDF) — FREE (₦10,000)
  - Bonus: Live Offer Review Opportunity — FREE (Priceless)
  - Early Bird Cohort Discount — -₦55,000
- Divider
- Subtotal: ₦10,000 (or ₦7,500 with coupon, dynamically updated)
- "Total Due Today" — bold, large, accent color

*Coupon Input (inside order summary too)*
- Small inline input: "Have a coupon code?" + Apply button
- Same logic as Step 02 coupon (synced state)

*Guarantee Badge*
- Embossed plaque card with gold shield icon
- Copy: "The Only Guarantee That Matters: Complete all seven assignments. If the system does not give you clarity and positioning to sell, Divine will personally continue reviewing your work until it does. No fluff, no fine print."

*Testimonial Card*
- Small card with student photo (placeholder `https://placehold.co/48x48`) and quote
- "Divine's offer framework helped me close ₦180,000 in 48 hours without spending a kobo on ads." — King David

*Security Badges*
- Row of trust icons: "SSL Secured" · "Paystack Partner" · "256-Bit Encryption"

**7. Footer**
- Trust seals row
- "Privacy Policy" link (placeholder)
- "Terms of Service" link (placeholder)
- © 2026 The Divine Bakare

**8. Floating WhatsApp Button**
- Bottom-right: green WhatsApp icon
- Tooltip: "Having payment issues? Chat with Divine"
- Opens `https://wa.me/234XXXXXXXXXX?text=Hello Divine, I need help with my Sell Out Challenge registration.` (placeholder number)

**9. Exit-Intent Modal**
- Desktop only (cursor moves to close tab)
- Glassmorphic dark overlay + card
- Copy: "Wait! Don't lose your spot."
- "Need help paying via bank transfer? Click below to get instant assistance."
- CTA: "Chat on WhatsApp" + "No thanks, continue" dismiss
- sessionStorage flag to only show once per session

**10. Social Proof Toasts**
- Bottom-left corner, periodic micro-notifications
- Same pattern as `index.html` sales toast
- Queue: 5-6 simulated recent registrations from Nigerian cities
- Show every 14 seconds, auto-dismiss after 5 seconds

---

## JavaScript Architecture

All JS inline in `<script>` at bottom of `<body>`. Functions:

| Function | Purpose |
|----------|---------|
| `formatWhatsApp(input)` | Auto-format phone to +234 on blur |
| `applyCoupon()` | Validate SELLOUT25, update price display |
| `removeCoupon()` | Reset to ₦10,000 |
| `switchPaymentTab(tab)` | Show/hide payment panels, update active tab |
| `copyBankDetails()` | Copy account number to clipboard |
| `generateWhatsAppLink()` | Open wa.me with pre-filled receipt message |
| `startReservationTimer(minutes)` | 15-min countdown, persist end time in sessionStorage |
| `calculateTotal()` | Recalculate based on coupon state, update all price displays |
| `saveFormState()` | Save all field values to sessionStorage on blur |
| `loadFormState()` | Restore fields from sessionStorage on page load |
| `handleExitIntent(e)` | Detect mouseleave top, show modal once |
| `showSocialToast()` | Cycle through simulated registration notifications |
| `initPaystack()` | Placeholder: will call `PaystackPop.setup({...})` later |
| `validateForm()` | Check all required fields before CTA enable |
| `submitRegistration()` | Validate → redirect to step-3.html with params |

---

## Data Flow

```
Page Load
  → Load sessionStorage (form state, coupon, timer end time)
  → If ?coupon=SELLOUT25 in URL → auto-apply coupon
  → Start/resume reservation timer
  → Begin social toast cycle

User Types in Fields
  → Auto-save to sessionStorage on blur
  → Auto-format WhatsApp number

User Applies Coupon
  → Validate code
  → Update all price displays (order summary, CTA button, tier card)
  → Save coupon state to sessionStorage

User Switches Payment Tab
  → Show/hide relevant panels
  → No price change (all methods charge same amount)

User Clicks CTA
  → Validate all fields
  → If Paystack tab: init Paystack popup (placeholder for now)
  → If Bank Transfer: show bank details + WhatsApp button
  → If International: init international Paystack (placeholder)
  → On success: redirect to step-3.html?name=...&email=...&whatsapp=...&tier=standard

Exit Intent (desktop)
  → Show modal once per session
  → Dismiss on "no thanks" or WhatsApp click
```

---

## Mobile Behavior

- Two-column → single column stack (order summary moves below form on mobile)
- Urgency bar: sticky below header, compact timer
- Form fields: full-width, larger touch targets
- Payment tabs: horizontal scroll if needed
- CTA button: full-width, sticky at bottom of viewport on mobile
- WhatsApp FAB: smaller, bottom-right
- Exit-intent modal: disabled on mobile (no cursor)
- Social toasts: positioned above sticky CTA

---

## Copy Inventory (all prices confirmed)

| Location | Copy |
|----------|------|
| Urgency bar | "Your seat is reserved for" |
| CTA button | "🔒 Complete Registration & Secure My Seat · ₦10,000" |
| CTA with coupon | "🔒 Complete Registration & Secure My Seat · ₦7,500" |
| Order total | "₦10,000" / "₦7,500" |
| Coupon success | "25% OFF applied! You save ₦2,500" |
| Coupon fail | "Invalid coupon code. Please check and try again." |
| Social toast | "Chidinma from Abuja secured a spot 4 minutes ago" |
| Exit modal | "Wait! Don't lose your spot." |
| WhatsApp FAB | "Having payment issues? Chat with Divine" |
| Bank transfer | Placeholder bank name/number/account |

---

## Verification Plan

After build:
1. **Em-dash scan**: `Select-String -Pattern "—"` → 0 results
2. **No transition-all**: `Select-String -Pattern "transition-all"` → 0 results
3. **CTAs**: all point to `step-3.html`
4. **Coupon logic**: SELLOUT25 → ₦7,500, invalid code → error, URL auto-apply works
5. **Price display**: all instances show ₦10,000 default, ₦7,500 with coupon
6. **Form state**: fill fields, refresh page, fields restored
7. **Mobile layout**: serve on localhost, screenshot at 390px width
8. **Deploy**: `vercel deploy --prod --yes` → HTTP 200
