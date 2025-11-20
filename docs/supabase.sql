-- Enable UUID helpers
create extension if not exists "pgcrypto" with schema public;

-- Core tables
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null check (category in ('dry', 'fridge', 'freezer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty numeric not null default 1,
  unit text,
  category text,
  barcode text,
  upc_metadata jsonb,
  upc_image_url text,
  storage text,
  storage_location_id uuid references public.storage_locations(id) on delete set null,
  opened boolean not null default false,
  added_at timestamptz not null default now(),
  last_used_at timestamptz,
  risk_level text not null default 'safe'
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time_min integer,
  diet text,
  tags text[] not null default '{}',
  ingredients jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.barcode_cache (
  upc text primary key,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'open_food_facts',
  last_verified_at timestamptz not null default now(),
  hit_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.items add column if not exists upc_metadata jsonb;
alter table public.items add column if not exists upc_image_url text;
alter table public.items add column if not exists storage_location_id uuid references public.storage_locations(id) on delete set null;

create table if not exists public.external_recipes (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  title text not null,
  image_url text,
  source_url text,
  summary text,
  instructions text,
  ingredients jsonb not null default '[]'::jsonb,
  diet_tags text[] not null default '{}',
  total_time integer,
  servings integer,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_id)
);

-- Performance indexes
create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists items_household_idx on public.items(household_id, added_at desc);
create index if not exists items_user_idx on public.items(user_id);
create index if not exists storage_locations_household_idx on public.storage_locations(household_id);
create index if not exists items_storage_location_idx on public.items(storage_location_id);
create index if not exists events_user_idx on public.events(user_id, created_at desc);

-- Helper for RLS
create or replace function public.is_household_member(p_household uuid, p_user uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household
      and hm.user_id = p_user
  );
$$;

-- Enable RLS on tables
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.storage_locations enable row level security;
alter table public.items enable row level security;
alter table public.recipes enable row level security;
alter table public.events enable row level security;
alter table public.barcode_cache enable row level security;
alter table public.external_recipes enable row level security;

-- Helper anonymous block to drop a policy if it exists
-- Usage:
-- DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='X' AND policyname='Y') THEN EXECUTE 'DROP POLICY "Y" ON public.X'; END IF; END; $$;

-- Households: members can see/manage their household
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'Members can view household'
  ) THEN
    EXECUTE 'DROP POLICY "Members can view household" ON public.households';
  END IF;
END;
$$;
CREATE POLICY "Members can view household" ON public.households
  FOR SELECT USING (public.is_household_member(id, (SELECT auth.uid())));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'Members can update household'
  ) THEN
    EXECUTE 'DROP POLICY "Members can update household" ON public.households';
  END IF;
END;
$$;
CREATE POLICY "Members can update household" ON public.households
  FOR UPDATE USING (public.is_household_member(id, (SELECT auth.uid())))
  WITH CHECK (public.is_household_member(id, (SELECT auth.uid())));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'Members can insert household'
  ) THEN
    EXECUTE 'DROP POLICY "Members can insert household" ON public.households';
  END IF;
END;
$$;
CREATE POLICY "Members can insert household" ON public.households
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Household members table policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_members'
      AND policyname = 'Members read membership'
  ) THEN
    EXECUTE 'DROP POLICY "Members read membership" ON public.household_members';
  END IF;
END;
$$;
CREATE POLICY "Members read membership" ON public.household_members
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_members'
      AND policyname = 'Members insert membership'
  ) THEN
    EXECUTE 'DROP POLICY "Members insert membership" ON public.household_members';
  END IF;
END;
$$;
CREATE POLICY "Members insert membership" ON public.household_members
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_members'
      AND policyname = 'Members remove themselves'
  ) THEN
    EXECUTE 'DROP POLICY "Members remove themselves" ON public.household_members';
  END IF;
END;
$$;
CREATE POLICY "Members remove themselves" ON public.household_members
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Storage location policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'storage_locations'
      AND policyname = 'Members read storage'
  ) THEN
    EXECUTE 'DROP POLICY "Members read storage" ON public.storage_locations';
  END IF;
END;
$$;
CREATE POLICY "Members read storage" ON public.storage_locations
  FOR SELECT USING (public.is_household_member(household_id, (SELECT auth.uid())));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'storage_locations'
      AND policyname = 'Members manage storage'
  ) THEN
    EXECUTE 'DROP POLICY "Members manage storage" ON public.storage_locations';
  END IF;
END;
$$;
CREATE POLICY "Members manage storage" ON public.storage_locations
  FOR ALL USING (public.is_household_member(household_id, (SELECT auth.uid())))
  WITH CHECK (public.is_household_member(household_id, (SELECT auth.uid())));

-- Items policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'items'
      AND policyname = 'Members read items'
  ) THEN
    EXECUTE 'DROP POLICY "Members read items" ON public.items';
  END IF;
END;
$$;
CREATE POLICY "Members read items" ON public.items
  FOR SELECT USING (public.is_household_member(household_id, (SELECT auth.uid())));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'items'
      AND policyname = 'Members manage items'
  ) THEN
    EXECUTE 'DROP POLICY "Members manage items" ON public.items';
  END IF;
END;
$$;
CREATE POLICY "Members manage items" ON public.items
  FOR ALL USING (public.is_household_member(household_id, (SELECT auth.uid())))
  WITH CHECK (public.is_household_member(household_id, (SELECT auth.uid())));

-- Barcode cache policies (any authenticated user)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'barcode_cache'
      AND policyname = 'Authenticated read barcode cache'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated read barcode cache" ON public.barcode_cache';
  END IF;
END;
$$;
CREATE POLICY "Authenticated read barcode cache" ON public.barcode_cache
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'barcode_cache'
      AND policyname = 'Authenticated insert barcode cache'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated insert barcode cache" ON public.barcode_cache';
  END IF;
END;
$$;
CREATE POLICY "Authenticated insert barcode cache" ON public.barcode_cache
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'barcode_cache'
      AND policyname = 'Authenticated update barcode cache'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated update barcode cache" ON public.barcode_cache';
  END IF;
END;
$$;
CREATE POLICY "Authenticated update barcode cache" ON public.barcode_cache
  FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- External recipes cache (read for all, insert/update for service role)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_recipes'
      AND policyname = 'Anyone can read external recipes'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can read external recipes" ON public.external_recipes';
  END IF;
END;
$$;
CREATE POLICY "Anyone can read external recipes" ON public.external_recipes
  FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_recipes'
      AND policyname = 'Service role inserts external recipes'
  ) THEN
    EXECUTE 'DROP POLICY "Service role inserts external recipes" ON public.external_recipes';
  END IF;
END;
$$;
CREATE POLICY "Service role inserts external recipes" ON public.external_recipes
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_recipes'
      AND policyname = 'Service role updates external recipes'
  ) THEN
    EXECUTE 'DROP POLICY "Service role updates external recipes" ON public.external_recipes';
  END IF;
END;
$$;
CREATE POLICY "Service role updates external recipes" ON public.external_recipes
  FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Recipes: world readable, members can manage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND policyname = 'Anyone can read recipes'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can read recipes" ON public.recipes';
  END IF;
END;
$$;
CREATE POLICY "Anyone can read recipes" ON public.recipes
  FOR SELECT USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes'
      AND policyname = 'Members manage recipes'
  ) THEN
    EXECUTE 'DROP POLICY "Members manage recipes" ON public.recipes';
  END IF;
END;
$$;
CREATE POLICY "Members manage recipes" ON public.recipes
  FOR ALL USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Events limited to owner user
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Owner reads events'
  ) THEN
    EXECUTE 'DROP POLICY "Owner reads events" ON public.events';
  END IF;
END;
$$;
CREATE POLICY "Owner reads events" ON public.events
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Owner inserts events'
  ) THEN
    EXECUTE 'DROP POLICY "Owner inserts events" ON public.events';
  END IF;
END;
$$;
CREATE POLICY "Owner inserts events" ON public.events
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- Seed demo data
insert into public.households (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Household')
on conflict (id) do nothing;

-- Replace the demo user id with an actual auth.users id from your project.
insert into public.household_members (household_id, user_id)
values ('11111111-1111-1111-1111-111111111111', '51689886-17c8-40e8-acd8-1566f14f4edc')
on conflict do nothing;

insert into public.storage_locations (id, household_id, name, category)
values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Dry storage', 'dry'),
  ('21111111-1111-1111-1111-222222222222', '11111111-1111-1111-1111-111111111111', 'Fridge storage', 'fridge'),
  ('21111111-1111-1111-1111-333333333333', '11111111-1111-1111-1111-111111111111', 'Freezer storage', 'freezer')
on conflict (id) do nothing;

insert into public.items (id, user_id, household_id, name, qty, unit, category, storage, storage_location_id, opened, risk_level, added_at)
values
  ('20000000-0000-0000-0000-000000000001', '51689886-17c8-40e8-acd8-1566f14f4edc', '11111111-1111-1111-1111-111111111111', 'Baby Spinach', 1, 'pack', 'Produce', 'fridge', '21111111-1111-1111-1111-222222222222', false, 'caution', now() - interval '4 days'),
  ('20000000-0000-0000-0000-000000000002', '51689886-17c8-40e8-acd8-1566f14f4edc', '11111111-1111-1111-1111-111111111111', 'Greek Yogurt', 1, 'tub', 'Dairy', 'fridge', '21111111-1111-1111-1111-222222222222', false, 'use-now', now() - interval '9 days')
on conflict (id) do nothing;

insert into public.recipes (id, title, time_min, diet, tags, ingredients)
values
  ('30000000-0000-0000-0000-000000000001', 'Use-It-Now Meal Pack', 25, 'omnivore', array['use-it-now','weeknight'], '[{"name":"Baby Spinach","qty":4,"unit":"oz"},{"name":"Black Beans","qty":1,"unit":"can"}]'),
  ('30000000-0000-0000-0000-000000000002', 'Power Spinach Frittata', 20, 'vegetarian', array['breakfast','use-it-now'], '[{"name":"Eggs","qty":6,"unit":"ea"},{"name":"Baby Spinach","qty":3,"unit":"cup"}]')
on conflict (id) do nothing;

insert into public.events (id, user_id, type, payload)
values ('40000000-0000-0000-0000-400000000001', '51689886-17c8-40e8-acd8-1566f14f4edc', 'add_item', jsonb_build_object('source', 'seed', 'name', 'Baby Spinach'))
on conflict (id) do nothing;
