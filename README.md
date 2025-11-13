<h1 align="left">
  <img src="./public/favicon.svg" alt="CookSnap logo" width="100" height="100" style="vertical-align:middle;margin-right:12px;" />
  CookSnap · Alpha v0.3
</h1>

CookSnap is a full-stack pantry ops platform built with Next.js App Router + Supabase. Scan barcodes, OCR receipts, or add items manually while a Supabase backend keeps risk bands, households, and recipes in sync. Alpha v0.3 adds a household shopping list workspace, richer pantry groupings, a profile hub, refreshed branding, and tighter chat-ready copy throughout this README. This guide walks through the setup, current features, what’s coming next, and how the stack fits together.

## Installation & Setup (from zero)
1. **Clone the repository**
   ```bash
   git clone https://github.com/jaekop/CookSnap.git
   cd CookSnap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   - Node 20+ is recommended (matches Next 15 + React 19 requirements).
   - npm v10 ships with Node 20; upgrade if necessary.

3. **Configure Supabase credentials**
   1. Create a Supabase project (if you don’t already have one).
   2. In the project dashboard grab your URL + anon key.
   3. Create `.env.local` in the repo root with:
      ```env
      NEXT_PUBLIC_SUPABASE_URL=your_project_url
      NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
      SUPABASE_URL=your_project_url
      SUPABASE_ANON_KEY=your_anon_key
      ```
      (Server helpers reuse the same anon key; no service key required for this Alpha.)

4. **Provision the database**
   - Open Supabase → SQL Editor and paste `docs/supabase.sql`.
   - Replace the placeholder user UUID (`51689886-17c8-40e8-acd8-1566f14f4edc`) with your actual `auth.users.id` so the seed data links to your account.
   - Run the script once; it creates tables, helper function, RLS policies, and sample data.

5. **Run the local dev server**
   ```bash
   npm run dev
   ```
   - Visit `http://localhost:3000`.
   - Enable Google OAuth in Supabase Auth → Providers and add `http://localhost:3000/auth/callback` to the redirect list before attempting login.

6. **Optional validation commands**
   - `npm run lint` → Biome lint pass
   - `npm run fmt` → Biome format
   - `npm run typecheck` → TypeScript `--noEmit`
   - `npm run build` → Production build smoke test

Once those steps are complete, CookSnap Alpha v0.3 is fully operational locally.

## Implemented Features (Alpha v0.3)
- **Supabase-authenticated households**: Users sign in via Google OAuth, and the API auto-creates a household + membership with safe RLS defaults (now resilient to RLS-returning errors thanks to UUID pre-generation).
- **Three add flows**:
  - *Barcode scanning* (placeholder UI wired to ZXing WASM entry points).
  - *Receipt OCR* (placeholder UI referencing Tesseract.js pipeline).
  - *Manual entry* (fully working form hitting `/api/items`).
- **Pantry dashboard + revamped pantry view**:
  - Summary cards for inventory size, high-risk count, last event timestamp.
  - New Pantry grouping UI (Pantry / Fridge / Freezer) with Safe / Use-now / Risky clusters, relative timestamps, and richer risk badges.
- **Shopping list workspace (/shopping_list)**:
  - Auto-generated ingredient gaps per recipe with recipe context tags.
  - Manual reminder list with local persistence, completion toggles, and downloadable `.txt` export.
- **Recipes view**:
  - Client-side filters (tags/diet/time) with fallback to bundled recipes, and safer loading when no household membership exists.
- **Profile hub (/profile)**:
  - Update first/last name via Supabase metadata and log out from the same page; header “Hey, {name}” links directly here.
- **Navigation & branding refresh**:
  - Logo + favicon swap to the new SVG, expanded nav pill for Shopping List, responsive typography tweaks.
- **API routes**:
  - `/api/items` handles CRUD with household bootstrap + risk recalculation (now pre-generates UUIDs to dodge RLS RETURNING failures).
  - `/api/track` stores events for analytics.
- **Theme system**:
  - Light/dark palettes with persisted preference and accessible toggle; header logo background now follows theme variables.

## Planned / Upcoming Features
- **Real barcode lookups**: integrate ZXing scanning + UPC databases to auto-fill item metadata.
- **Receipt OCR confirm table**: connect the `ReceiptAdd` placeholder to a real Tesseract.js pipeline with multi-row confirmation UI.
- **Household invites**: allow multiple Supabase users per household, plus role management.
- **Event analytics**: charts for add/use trends, expiring items, and notification hooks.
- **Mobile scanner shell**: PWA tweaks for camera permissions and offline caching.
- **Shopping trip planner**: pre-built “use these risky items” plan with recipe suggestions.

## Tech Stack & Architecture
CookSnap leans on a modern, typed React stack:

- **Next.js 15 App Router + React 19**: Server Components for all pages (`app/*.tsx`), API Route Handlers under `app/api`, and a pure CSS/tailwind design system. Layout and header live in `app/layout.tsx`.
- **Supabase**:
  - Auth: Google OAuth via `createSupabaseBrowserClient` on the login page and `/auth/callback` route.
  - Database: SQL schema lives in `docs/supabase.sql`. RLS ensures every row is tied to `household_id` and checks are encapsulated in `is_household_member`.
  - Storage: Not used yet in Alpha, but the pattern is set for receipts/barcode assets.
- **Lib layer** (`lib/`):
  - `supabase.ts` (async server client + cookie adapter + `requireUserId`).
  - `supabase-browser.ts` (client SDK wrapper).
  - `risk.ts`, `recommend.ts`, `analytics.ts`, `utils.ts` provide domain helpers.
- **UI + Components** (`components/`):
  - Shadcn-style primitives in `components/ui/` (button, card, input, label, tabs).
  - Feature widgets (`AddManual`, `BarcodeAdd`, `ReceiptAdd`, `PantryClient`, `RecipesClient`, `RecipeCard`, `RiskBadge`, `ThemeToggle`).
- **Data + Types**:
  - `data/recipes.json` seeds fallback recipes.
  - `types/index.ts` exports `Item`, `Recipe`, etc., shared between pages/APIs.
- **Styles**:
  - `app/globals.css` defines CSS variables for both themes, Tailwind base utilities, and UI polish.
  - `tailwind.config.ts` scopes scanning to `app/`, `components/`, and `lib/`.
- **Tooling**:
  - Biome handles lint + format via `biome.json`.
  - TypeScript is strict-ish (no implicit any) with path aliases (`@/*`).
  - Scripts in `package.json` cover dev, build, start, lint, format, typecheck.

## Repository Layout
```
app/                Next.js App Router pages + API routes
components/         UI primitives and feature components
components.json     shadcn/ui config (aliases + settings)
data/               Seed data (recipes)
docs/supabase.sql   Schema, RLS, seed script
lib/                Supabase clients + domain helpers
public/             Static assets (favicons, logos)
styles/             Extra CSS placeholders
types/              Shared TypeScript types
package.json        npm scripts and dependencies
tsconfig.json       TS config with path aliases
biome.json          Lint/format rules
README.md           You are here
```

CookSnap Alpha v0.3 is stable enough for local demos; future milestones will layer in the planned shopping, notifications, and richer automation features. Contributions and issue reports are welcome—open a PR or drop feedback in the repo.
