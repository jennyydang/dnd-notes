-- Adventurer's Log — Supabase schema, RLS, and storage setup
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run in full any time — every statement is idempotent.

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ── Campaigns ─────────────────────────────────────────────────────────
-- Everything else (maps, npcs, loot, quests, party_members, session_notes,
-- lore_entries) belongs to a campaign via campaign_id. A fixed-id default
-- campaign is created here so that a database that already has data from
-- before campaigns existed can be backfilled onto it below, rather than
-- losing access to existing rows.

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cover_image_path text,           -- object key in the "campaign-covers" bucket, nullable
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

insert into campaigns (id, name)
values ('00000000-0000-0000-0000-000000000001', 'My Campaign')
on conflict (id) do nothing;

-- ── Tables ──────────────────────────────────────────────────────────

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  image_path text not null,        -- object key in the "maps" storage bucket
  caption text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  race text not null default '',
  met_at text not null default '',
  status text not null default 'Alive'
    check (status in ('Alive','Deceased','Unknown','Missing')),
  photo_path text,                 -- object key in the "npc-portraits" bucket, nullable
  created_at timestamptz not null default now()
);

create table if not exists loot (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item text not null,
  found_at text not null default '',
  holder text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  status text not null default 'Active'
    check (status in ('Active','Completed','Failed')),
  given_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists party_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  player_name text not null default '',   -- real-world player name; blank for NPC-type entries
  member_type text not null default 'Player'
    check (member_type in ('Player','NPC')),
  race_class text not null default '',
  notes text not null default '',
  photo_path text,                        -- object key in the "party-portraits" bucket, nullable
  created_at timestamptz not null default now()
);

create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null default '',
  session_date text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists lore_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  category text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ── Migration: backfill campaign_id onto tables that already existed ──
-- No-ops on a fresh database (the columns above already exist and are
-- already NOT NULL). On a database created before campaigns existed,
-- this adds the column, points every existing row at the default
-- campaign above, then locks the column down to NOT NULL.

do $$
declare
  t text;
begin
  foreach t in array array['maps','npcs','loot','quests','party_members','session_notes','lore_entries']
  loop
    execute format('alter table %I add column if not exists campaign_id uuid references campaigns(id) on delete cascade', t);
    execute format('update %I set campaign_id = %L where campaign_id is null', t, '00000000-0000-0000-0000-000000000001');
    execute format('alter table %I alter column campaign_id set not null', t);
  end loop;
end $$;

-- ── Row Level Security ──────────────────────────────────────────────
-- No login for this app: everyone who has the app URL shares access, so
-- the anon role gets full read/write/delete. Anyone who obtains the
-- public anon key can also read/write directly — acceptable for a small
-- private link shared with your table, not for a public URL.

alter table campaigns      enable row level security;
alter table maps           enable row level security;
alter table npcs           enable row level security;
alter table loot           enable row level security;
alter table quests         enable row level security;
alter table party_members  enable row level security;
alter table session_notes  enable row level security;
alter table lore_entries   enable row level security;

drop policy if exists "anon full access campaigns"     on campaigns;
drop policy if exists "anon full access maps"          on maps;
drop policy if exists "anon full access npcs"          on npcs;
drop policy if exists "anon full access loot"          on loot;
drop policy if exists "anon full access quests"        on quests;
drop policy if exists "anon full access party_members" on party_members;
drop policy if exists "anon full access session_notes" on session_notes;
drop policy if exists "anon full access lore_entries"  on lore_entries;

create policy "anon full access campaigns"     on campaigns     for all to anon using (true) with check (true);
create policy "anon full access maps"          on maps          for all to anon using (true) with check (true);
create policy "anon full access npcs"          on npcs          for all to anon using (true) with check (true);
create policy "anon full access loot"          on loot          for all to anon using (true) with check (true);
create policy "anon full access quests"        on quests        for all to anon using (true) with check (true);
create policy "anon full access party_members" on party_members for all to anon using (true) with check (true);
create policy "anon full access session_notes" on session_notes for all to anon using (true) with check (true);
create policy "anon full access lore_entries"  on lore_entries  for all to anon using (true) with check (true);

-- ── Storage buckets ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('npc-portraits', 'npc-portraits', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('party-portraits', 'party-portraits', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('campaign-covers', 'campaign-covers', true)
on conflict (id) do nothing;

drop policy if exists "anon full access maps bucket" on storage.objects;
drop policy if exists "anon full access npc-portraits bucket" on storage.objects;
drop policy if exists "anon full access party-portraits bucket" on storage.objects;
drop policy if exists "anon full access campaign-covers bucket" on storage.objects;

create policy "anon full access maps bucket"
  on storage.objects for all to anon
  using (bucket_id = 'maps') with check (bucket_id = 'maps');

create policy "anon full access npc-portraits bucket"
  on storage.objects for all to anon
  using (bucket_id = 'npc-portraits') with check (bucket_id = 'npc-portraits');

create policy "anon full access party-portraits bucket"
  on storage.objects for all to anon
  using (bucket_id = 'party-portraits') with check (bucket_id = 'party-portraits');

create policy "anon full access campaign-covers bucket"
  on storage.objects for all to anon
  using (bucket_id = 'campaign-covers') with check (bucket_id = 'campaign-covers');

-- If inserts/updates fail with "permission denied for schema public",
-- run this once too (RLS policies still apply on top of these grants):
-- grant usage on schema public to anon, authenticated;
-- grant all on all tables in schema public to anon, authenticated;
