# CLAUDE.md — Sell Out Challenge Frontend Rules

## About This Build
- **Sell Out Challenge** = Divine Bakare's 3-step challenge course funnel (3 separate pages).
- Sibling repo to the Sell Out Campaign registration funnel (`C:\Users\NexusPC\Projects\Sell Out Campaign`). Brand is shared; assets are copied locally so this repo is fully self-contained.

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves this project root at `http://localhost:3000`; `PORT` env overrides if 3000 is busy).
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/NexusPC/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/NexusPC/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Multi-page funnel: also screenshot each step, e.g. `node screenshot.mjs http://localhost:3000/step-2.html step2`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single-file pages: `index.html`, `step-2.html`, `step-3.html` — all styles inline per page, unless user says otherwise.
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Local images live in `assets/` — reference as `assets/...` (self-contained for standalone deploy).
- Cross-page links are relative: `step-2.html`, `step-3.html`.
- Mobile-first responsive

## Brand Assets
- Brand assets are copied into `assets/` (`tdb-logo.png`, `My Image (1).jpg` = Divine's portrait, `proofs/` testimonials).
- `reference/visual-identity.md` = brand guide (palette, type, philosophy). Use those exact values — do not invent brand colors.
- Source of truth for brand assets is the Sell Out Campaign repo (`brand_assets/`); if a new asset appears there, copy it over.

## Reference Folder
- `reference/` holds blueprint sources to study for **structure and layout** — plus reusable brand/style material:
  - `registration-funnel/index.html` — **snapshot of the LIVE registration funnel build.** Import sections, component patterns, and asset usage from it as needed (do not copy its look wholesale; re-render in the funnel's own structure per the Anti-Generic Guardrails).
  - `visual-identity.md` — brand style guide.
  - `3 step workshop funnel.jpg`, `SELL OUT WIREFRAME.png`, `arena-masterclass-page.html` — structural blueprints.
- User drops new images here for understudy. Extract the structural blueprint (wireframe-level), then re-render using TDB brand styling.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Deployment Workflow (IMPORTANT)
- **Local-first:** All changes are made locally and previewed on `http://localhost:3000`. Nothing goes live without explicit instruction.
- **Never push/deploy automatically.** Do not run `git commit`, `git push`, `vercel deploy`, or `vercel --prod` unless the user explicitly says something like "push it", "make it live", "deploy".
- This repo is not yet linked to GitHub/Vercel. When it is:
  - "Make it live" = `git remote add origin https://github.com/thedivinebakare/sellout-challenge.git` (once), then `git add .` + commit + push, then `vercel --prod --name sellout-challenge` (first deploy links the project; `vercel login` if prompted).
  - Live URL: `https://sellout-challenge.vercel.app`
- After deploy, verify with `Invoke-WebRequest` (expect HTTP 200) and tell the user the live link.
- Git identity (local to this repo): Divine Bakare <officialdivinebakare@gmail.com>.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
