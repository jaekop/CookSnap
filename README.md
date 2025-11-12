# CookSnap — Effortless Power Pantry Ops

CookSnap is a Next.js App Router experience that keeps household food flowing. Scan barcodes, OCR receipts, and track manual adds while Supabase syncs freshness risk bands, activity logs, and shared recipes optimized for what needs to be used tonight.

## Core flows
- **Add items three ways**: barcode (ZXing WASM), receipt OCR (Tesseract.js with confirm table), or manual fallback.
- **Adaptive expiry insights**: every item gets a calculated risk band (safe -> risky) and a next check reminder.
- **Use-It-Now recipes**: scoring favors recipes that burn through near-expiry stock with diet/time/tag filters.
- **Household awareness**: activity log + lightweight analytics for add and cook events.

## Tech stack
- Next.js App Router (React 19, React Compiler enabled)
- TypeScript + Tailwind CSS + shadcn/ui
- Supabase (Auth, Postgres, RLS policies)
- ZXing WASM (barcode scanning) and Tesseract.js (client receipt OCR)
- Biome for linting/formatting

## Installation
1. **Clone & install**
   ```bash
   git clone https://github.com/your-org/cooksnap.git
   cd cooksnap
   npm install
   ```
2. **Configure environment**
   - Duplicate `.env.example` (or create `.env.local`) and set:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - These keys power both browser and server Supabase clients, so keep them in sync.
3. **Provision Supabase**
   - Open the Supabase SQL editor and run `docs/supabase.sql`. It creates tables, helper functions, RLS policies, and demo data.
   - Replace the placeholder `user_id` inside the script with your real `auth.users.id` before executing.
4. **Run the dev server**
   ```bash
   npm run dev
   ```
   - Visit `http://localhost:3000`, sign in with Google (ensure the `/auth/callback` redirect is added in Supabase), and start adding pantry items.
5. **Optional sanity checks**
   - `npm run lint` (Biome) and `npm run typecheck` keep the codebase healthy before committing.

## Scripts
- `npm run dev` — Next.js dev server (`next dev --turbo`)
- `npm run build` — production build
- `npm run start` — serve the built app
- `npm run fmt` — format with Biome
- `npm run lint` — lint with Biome
- `npm run typecheck` — TypeScript no-emit check

## Supabase configuration
Use the SQL in `docs/supabase.sql` (also included in the handoff) to create tables, helpers, RLS policies, and seed demo data. Policies assume users belong to at most one household via `household_members`.

## Key files & directories
- `app/` — Next.js App Router tree.
  - `app/layout.tsx` wires global fonts, theme script, and header navigation with Supabase-aware greeting.
  - `app/page.tsx` renders the dashboard, fetching pantry items, events, and recipe recommendations via the server Supabase client.
  - `app/login/page.tsx` launches Google OAuth using the browser Supabase client.
  - `app/add/page.tsx` hosts the barcode/receipt/manual add tabs.
  - `app/pantry/page.tsx`, `app/recipes/page.tsx`, `app/thanks/page.tsx` provide authenticated feature surfaces.
  - `app/api/items/route.ts` and `app/api/track/route.ts` are serverless APIs for CRUD + activity tracking.
- `components/` — UI primitives and feature widgets (AddManual form, barcode scanner, recipe cards, etc.).
- `data/recipes.json` — default recipe catalog used when the Supabase table is empty.
- `docs/supabase.sql` — single source of truth for schema, RLS policies, helper functions, and seed data.
- `lib/supabase.ts` — async server/route Supabase client factory plus `requireUserId` guard.
- `lib/supabase-browser.ts` — browser Supabase client helper for OAuth flows.
- `lib/utils.ts` & other helpers — formatting utilities, analytics trackers, risk calculations.
- `public/` — static assets (favicons, logos) consumed by the App Router.
- `styles/` & `tailwind.config.ts` — Tailwind theme tokens and global CSS.
- `types/` — shared TypeScript contracts (items, recipes, events).
- `package.json`, `tsconfig.json`, `.biome.json` — tooling configuration for scripts, TypeScript, and linting.

## Deployment
1. Push to GitHub.
2. Import the repo in Vercel. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` env vars.
3. Deploy with defaults. Turbopack and React Compiler are already configured.

## Demo checklist (60 seconds)
1. Sign in with Supabase auth (magic link works).
2. Add an item via barcode scan.
3. Upload a receipt image, confirm rows, add all.
4. Open Pantry to view risk groups and quick actions.
5. Jump to Recipes, open "Use-It-Now Meal Pack", and mark items used.
6. Peek at the Activity Log. Done.

Effortless power, fridge included.
