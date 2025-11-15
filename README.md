<h1 align="left">
  <img src="./public/favicon.svg" alt="CookSnap logo" width="100" height="100" style="vertical-align:middle;margin-right:12px;" />
  CookSnap · Alpha v0.6
</h1>

CookSnap is a full-stack pantry ops platform built with Next.js App Router + Supabase. Scan barcodes, OCR receipts, or add items manually while a Supabase backend keeps risk bands, households, and recipes in sync. Alpha v0.6 wires the open-recipe pipeline into every surface: the `/recipes` view now ships a dataset-backed search API, Ready/Use-it-now rails, and pantry coverage badges, recipe cards gained a one-tap “Add ingredients to shopping list” action, and the shopping list workspace picked up manual reminder fields, completion toggles, and `.txt` exports. This guide walks through the setup, current features, what’s coming next, and how the stack fits together.

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
      SPOONACULAR_API_KEY=your_spoonacular_key
      ```
      (Server helpers reuse the same anon key; no service key required for this Alpha.) The Spoonacular key powers live recipe enrichment—omit it if you’re fine using the bundled fallback recipes.

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

Once those steps are complete, CookSnap Alpha v0.6 is fully operational locally.

### Optional: large recipe dataset
To unlock thousands of offline recipes, download an open dataset (e.g., [openrecipes](https://github.com/mennovanhout/openrecipes) CSV) and place it under `data/open-recipes/full_dataset.csv`. For fast fuzzy search, convert that CSV once into a JSON cache:

```bash
python scripts/build-open-recipes.py
```

This writes `data/open-recipes/dataset.json`, which CookSnap loads at start-up instead of reparsing the CSV on every request. These files are ignored by git—commit only the instructions, not the data. Alpha v0.6’s recipe search box and Ready/Use-it-now rails automatically detect this JSON; when it’s missing, the UI falls back to the smaller seeded `data/recipes.json`.

## Implemented Features (Alpha v0.6)
- **Supabase-authenticated households**: Users sign in via Google OAuth, and the API auto-creates a household + membership with safe RLS defaults (now resilient to RLS-returning errors thanks to UUID pre-generation).
- **Three add flows**:
  - *Barcode scanning* powered by the native `BarcodeDetector` API (with ZXing-compatible fallbacks ready to slot in) plus Open Food Facts lookups.
  - *Receipt OCR* (placeholder UI referencing Tesseract.js pipeline).
  - *Manual entry* (fully working form hitting `/api/items`).
- **Pantry dashboard + revamped pantry view**:
  - Summary cards for inventory size, high-risk count, last event timestamp.
  - New Pantry grouping UI (Pantry / Fridge / Freezer) with Safe / Use-now / Risky clusters, relative timestamps, richer risk badges, UPC thumbnails, and deep-links to `/pantry/{itemId}` editors.
- **Item-level detail route (`/pantry/[id]`)**:
  - Inline editor for quantity/unit/category/storage/opened state.
  - Delete action with redirect back to the pantry grid.
  - Upstream UPC metadata surface (brand, package info, categories, raw payload) plus product imagery when available.
- **Shopping list workspace (/shopping_list)**:
  - Ingredients forwarded from recipe cards land here automatically with recipe context tags, deduped per recipe, and persisted client-side.
  - Manual reminders capture qty/unit/store/note fields, include completion + remove controls, and export to a shareable `.txt`.
- **Recipes view**:
  - Ready-now / Use-it-now / Chef’s inspiration rails show pantry coverage, risky ingredient rescues, and random inspiration sourced from the open-recipe dataset (with Supabase + `data/recipes.json` fallbacks when the CSV isn’t present).
  - Dataset-backed search (`/api/recipes/search`) fans out to the CSV/JSON cache via Fuse.js with fallback to `data/recipes.json`, so the search box works even offline.
  - Recipe cards surface owned vs missing ingredients, show risk badges, and now expose a one-tap “Add ingredients to shopping list” action tied to the workspace above.
- **Profile hub (/profile)**:
  - Update first/last name via Supabase metadata and log out from the same page; header “Hey, {name}” links directly here.
- **Navigation & branding refresh**:
  - Logo + favicon swap to the new SVG, expanded nav pill for Shopping List, responsive typography tweaks.
- **API routes**:
  - `/api/items` handles CRUD with household bootstrap + risk recalculation (now pre-generates UUIDs to dodge RLS RETURNING failures) and persists UPC metadata/image references for each item.
  - `/api/recipes/search` pipes queries to the open-recipe dataset (Fuse.js + fallback to `data/recipes.json`) for the new search field.
  - `/api/track` stores events for analytics.
- **Barcode metadata cache**:
  - `/api/barcode` resolves UPC/EAN codes via Open Food Facts, caches responses in Supabase, and falls back gracefully when the cache table is missing.
- **Theme system**:
  - Light/dark palettes with persisted preference and accessible toggle; header logo background now follows theme variables.

## Planned / Upcoming Features
- **ZXing fallback + offline cache**: add a WASM-based decoder for browsers without `BarcodeDetector`, and sync UPC cache entries to the client for offline scans.
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
  - Domain helpers span `risk.ts`, `recommend.ts`, `analytics.ts`, `utils.ts`, the open-recipe ingestion/search utilities in `open-recipes.ts`, and the shopping list persistence helpers in `shopping-list.ts`.
- **UI + Components** (`components/`):
  - Shadcn-style primitives in `components/ui/` (button, card, input, label, tabs).
  - Feature widgets (`AddManual`, `BarcodeAdd`, `ReceiptAdd`, `PantryClient`, `RecipesClient`, `RecipeCard`, `ShoppingListClient`, `RiskBadge`, `ThemeToggle`).
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

CookSnap Alpha v0.6 is stable enough for local demos; future milestones will layer in collaboration, analytics, and the enhanced automation features listed above. Contributions and issue reports are welcome—open a PR or drop feedback in the repo.
