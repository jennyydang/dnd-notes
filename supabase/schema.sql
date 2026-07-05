-- Adventurer's Log — Supabase schema, RLS, and storage setup
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ── Tables ──────────────────────────────────────────────────────────

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,        -- object key in the "maps" storage bucket
  caption text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists npcs (
  id uuid primary key default gen_random_uuid(),
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
  item text not null,
  found_at text not null default '',
  holder text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Active'
    check (status in ('Active','Completed','Failed')),
  given_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists party_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  player_name text not null default '',   -- real-world player name; blank for NPC-type entries
  member_type text not null default 'Player'
    check (member_type in ('Player','NPC')),
  race_class text not null default '',
  notes text not null default '',
  photo_path text,                        -- object key in the "party-portraits" bucket, nullable
  created_at timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────────────
-- No login for this app: everyone who has the app URL shares one
-- campaign, so the anon role gets full read/write/delete. Anyone who
-- obtains the public anon key can also read/write directly — acceptable
-- for a small private link shared with your table, not for a public URL.

alter table maps          enable row level security;
alter table npcs          enable row level security;
alter table loot          enable row level security;
alter table quests        enable row level security;
alter table party_members enable row level security;

create policy "anon full access maps"          on maps          for all to anon using (true) with check (true);
create policy "anon full access npcs"          on npcs          for all to anon using (true) with check (true);
create policy "anon full access loot"          on loot          for all to anon using (true) with check (true);
create policy "anon full access quests"        on quests        for all to anon using (true) with check (true);
create policy "anon full access party_members" on party_members for all to anon using (true) with check (true);

-- ── Storage buckets for map images, NPC portraits, and party portraits ──

insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('npc-portraits', 'npc-portraits', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('party-portraits', 'party-portraits', true)
on conflict (id) do nothing;

create policy "anon full access maps bucket"
  on storage.objects for all to anon
  using (bucket_id = 'maps') with check (bucket_id = 'maps');

create policy "anon full access npc-portraits bucket"
  on storage.objects for all to anon
  using (bucket_id = 'npc-portraits') with check (bucket_id = 'npc-portraits');

create policy "anon full access party-portraits bucket"
  on storage.objects for all to anon
  using (bucket_id = 'party-portraits') with check (bucket_id = 'party-portraits');

-- If inserts/updates fail with "permission denied for schema public",
-- run this once too (RLS policies still apply on top of these grants):
-- grant usage on schema public to anon, authenticated;
-- grant all on all tables in schema public to anon, authenticated;
