-- Adventurer's Log — Supabase schema, RLS, and storage setup
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run in full any time — every statement is idempotent.

-- pgcrypto provides crypt()/gen_salt() for password hashing below.
-- Force it into a known, explicit schema rather than trusting wherever
-- "create extension if not exists" happens to land it (this varies by
-- project and is the source of "function gen_salt(...) does not exist"
-- errors if the schema drifts from whatever search_path assumes) — the
-- function bodies below call extensions.crypt()/extensions.gen_salt()
-- directly, so this schema choice is the only thing that matters.
create schema if not exists extensions;
drop extension if exists pgcrypto;
create extension pgcrypto with schema extensions;

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

-- ── Players & campaign membership ────────────────────────────────────
-- Player accounts are created only by the admin (via the create_player
-- function further down) — there's no self-signup. The players table
-- deliberately has NO anon policies at all: the only way to read or
-- write it is through the SECURITY DEFINER functions below, so the
-- anon key can never read password_hash or dump usernames directly.
-- If this table ever gets a policy or a raw grant, that protection
-- is gone.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists players_username_lower_idx on players (lower(username));

create table if not exists campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text not null default 'player' check (role in ('creator','player','dm')),
  created_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

-- 'dm' is an admin-assignable role (see set_membership_role below) granting
-- the same in-app access as 'creator' — re-run the check to widen it on
-- databases that already had this table with only 'creator'/'player'.
alter table campaign_members drop constraint if exists campaign_members_role_check;
alter table campaign_members add constraint campaign_members_role_check
  check (role in ('creator','player','dm'));

-- Nullable: the pre-existing default "My Campaign" row above has neither
-- (unique allows multiple nulls, so this doesn't block anything).
alter table campaigns add column if not exists join_code text unique;
alter table campaigns add column if not exists created_by uuid references players(id);

-- Re-pin created_by's FK with ON DELETE SET NULL every run (idempotent
-- drop+add): without this, deleting a player who created a campaign
-- would fail with a foreign key violation instead of just clearing the
-- reference on their campaigns.
alter table campaigns drop constraint if exists campaigns_created_by_fkey;
alter table campaigns add constraint campaigns_created_by_fkey
  foreign key (created_by) references players(id) on delete set null;

-- ── Tables ──────────────────────────────────────────────────────────

create table if not exists maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  image_path text not null,        -- object key in the "maps" storage bucket
  caption text not null default '',
  created_at timestamptz not null default now()
);

-- World Map flag: exactly one map per campaign may be flagged as the
-- interactive World Map (pan/zoom + markers). All other maps keep the
-- plain static lightbox. Un-flagging/reassigning it never touches
-- pin_x/pin_y or map_markers below — they stay tied to map_id and just
-- become unreachable via the interactive UI until re-flagged.
alter table maps add column if not exists is_world_map boolean not null default false;

-- Shared party "I am here" pin — a single point per map (not one per
-- player), so plain nullable columns are simpler than a one-row-per-map
-- side table. Stored as fractions (0..1) of the image's own dimensions
-- so it stays aligned to the same world-space point across every zoom
-- level and viewport size.
alter table maps add column if not exists pin_x double precision;
alter table maps add column if not exists pin_y double precision;

alter table maps drop constraint if exists maps_pin_x_range_check;
alter table maps add constraint maps_pin_x_range_check
  check (pin_x is null or (pin_x >= 0 and pin_x <= 1));
alter table maps drop constraint if exists maps_pin_y_range_check;
alter table maps add constraint maps_pin_y_range_check
  check (pin_y is null or (pin_y >= 0 and pin_y <= 1));

-- A campaign can have any number of interactive maps (is_world_map), so
-- the old one-per-campaign unique index is gone.
drop index if exists maps_one_world_map_per_campaign_idx;

-- Event markers on the World Map — "what happened here" notes with an
-- optional photo. x/y are fractions (0..1) of the image's own
-- dimensions, same reasoning as pin_x/pin_y above. Anon-writable like
-- every other shared tab in this app (Loot, Quests, NPCs) — no
-- ownership column, any player can add/edit/delete any marker.
create table if not exists map_markers (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  title text not null default '',
  notes text not null default '',
  photo_path text,                 -- object key in the "map-marker-photos" bucket, nullable
  created_at timestamptz not null default now()
);

-- 'zoom' markers open a nested map (see maps.source_marker_id below)
-- instead of the title/notes/photo popup 'event' markers show.
alter table map_markers add column if not exists kind text not null default 'event';
alter table map_markers drop constraint if exists map_markers_kind_check;
alter table map_markers add constraint map_markers_kind_check check (kind in ('event','zoom'));

-- Backs a 'zoom' marker: the nested map it opens is just another maps
-- row (its own image, its own pin, its own markers — which can
-- themselves include further 'zoom' markers, nesting arbitrarily deep).
-- Null for ordinary top-level campaign maps. ON DELETE CASCADE means
-- deleting the zoom marker on the parent map deletes this nested map
-- (and, transitively, everything nested under it) automatically.
alter table maps add column if not exists source_marker_id uuid references map_markers(id) on delete cascade;

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

alter table npcs add column if not exists description text not null default '';

create table if not exists loot (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item text not null,
  found_at text not null default '',
  holder text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- "usable" marks consumables (potions, scrolls, charges) that get a Use
-- button on their card; "used" flips once a player confirms using it.
alter table loot add column if not exists usable boolean not null default false;
alter table loot add column if not exists used boolean not null default false;
-- The $tag the item was logged with from session notes ('Item',
-- 'Artifact', 'Magic Item'), or '' for untagged loot.
alter table loot add column if not exists kind text not null default '';

-- Named places shown as cards under the Maps tab. Usually created by
-- tagging "#city Waterdeep" etc. in session notes; kind is that tag.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  kind text not null default 'Location',
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
  level integer not null default 1,       -- character level; drives spell-level availability in the Spells tab
  notes text not null default '',
  photo_path text,                        -- object key in the "party-portraits" bucket, nullable
  claimed_by uuid references players(id) on delete set null, -- the player who claimed this as their character
  created_at timestamptz not null default now()
);

alter table party_members add column if not exists claimed_by uuid references players(id) on delete set null;
alter table party_members add column if not exists level integer not null default 1;
alter table party_members add column if not exists animal_companion text not null default '';

alter table party_members drop constraint if exists party_members_level_check;
alter table party_members add constraint party_members_level_check check (level between 1 and 20);

-- One claimed character per player PER CAMPAIGN — not globally, since a
-- player in multiple campaigns claims a separate character in each one.
create unique index if not exists party_members_campaign_claimed_by_idx
  on party_members (campaign_id, claimed_by) where claimed_by is not null;

-- The party's own shared goals (e.g. "buy a ship", "find Kael's sister") —
-- separate from quests, which are plot threads handed to the party by an
-- NPC. Not tied to any one party_member since these belong to the whole
-- party.
create table if not exists party_goals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  status text not null default 'Active'
    check (status in ('Active','Completed')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Private notes one player keeps about another player's character. Same
-- trust model as session_notes: RLS below is anon-full-access like every
-- other table (there's no real per-player DB security without real
-- Supabase Auth) — privacy is enforced by the app only ever querying/
-- writing rows scoped to author_player_id = the logged-in player. Deleting
-- the character or the author's player account cleans up any note on it.
create table if not exists party_notes (
  id uuid primary key default gen_random_uuid(),
  party_member_id uuid not null references party_members(id) on delete cascade,
  author_player_id uuid not null references players(id) on delete cascade,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (party_member_id, author_player_id)
);

-- Each logged-in player's private spellbook for a campaign. Same privacy
-- model as session_notes/party_notes: RLS is anon-full-access, and the
-- app only ever queries/writes rows scoped to player_id = the logged-in
-- player; admin (no player_id) sees every player's spells. level 0 is a
-- cantrip, 1-9 are spell levels. The Spells tab compares each spell's
-- level against the player's claimed party_members.level to grey out
-- spells they can't cast yet — that comparison happens client-side, not
-- via any constraint here, since a spell's level is independent of
-- whether it's currently "locked" for a given character.
create table if not exists spells (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  name text not null,
  level integer not null default 0 check (level between 0 and 9),
  details text not null default '',
  created_at timestamptz not null default now()
);

-- Structured fields alongside the free-form `details` (used as the spell's
-- description/effect text). Split out so players can fill in a spell by
-- hand field-by-field instead of composing one blob of text themselves.
alter table spells add column if not exists casting_time text not null default '';
alter table spells add column if not exists range text not null default '';
alter table spells add column if not exists components text not null default '';
alter table spells add column if not exists duration text not null default '';
alter table spells add column if not exists effect text not null default '';

-- Narrative flavor text shown in the spell card's flavor-text popup —
-- separate from `details` (a short reminder shown inline on the card
-- itself), so the popup isn't just re-showing text already on screen.
alter table spells add column if not exists flavor text not null default '';

-- Each logged-in player's coin purse for a campaign — five independent
-- counts, not one converted total: having 15 gold means 15 gold coins
-- and 0 of everything else, not "15 gold's worth" smeared proportionally
-- across every denomination (real coins don't auto-convert; the Tools
-- tab's currency calculator is the separate tool for figuring out
-- equivalents/making change). Same privacy model as session_notes/
-- party_notes: RLS is anon-full-access, and the app only ever queries/
-- writes rows scoped to player_id = the logged-in player; admin (no
-- player_id) sees every player's wallet.
create table if not exists player_wallets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  platinum integer not null default 0,
  gold integer not null default 0,
  silver integer not null default 0,
  shilling integer not null default 0,
  copper integer not null default 0,
  created_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

-- Superseded-column migration: earlier version of this table stored one
-- fungible total_copper value instead of five independent coin counts.
alter table player_wallets add column if not exists platinum integer not null default 0;
alter table player_wallets add column if not exists gold integer not null default 0;
alter table player_wallets add column if not exists silver integer not null default 0;
alter table player_wallets add column if not exists shilling integer not null default 0;
alter table player_wallets add column if not exists copper integer not null default 0;
alter table player_wallets drop column if exists total_copper;

-- Shards the DM has handed each player, tracked from the Tools tab.
-- One row per player per campaign, same scoping as player_wallets.
create table if not exists player_shards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  shards integer not null default 0 check (shards >= 0),
  created_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

-- Unlike every other tab, session notes are personal to each player —
-- everyone in a campaign shares the same maps/npcs/loot/etc., but each
-- player keeps their own private recap. player_id is nullable rather
-- than NOT NULL: a session_notes row predating this feature (or one
-- added by the admin, who isn't a player) may have no player attached;
-- those rows simply won't match any specific player's filter.
create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  title text not null default '',
  session_date text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table session_notes add column if not exists player_id uuid references players(id) on delete cascade;

-- Best-effort backfill for rows that predate this column: attribute them
-- to whichever player created that campaign, if known. Rows in a campaign
-- with no recorded creator (e.g. the original default "My Campaign") stay
-- player_id = null and won't show up for any specific player anymore.
update session_notes sn
set player_id = c.created_by
from campaigns c
where sn.campaign_id = c.id
  and sn.player_id is null
  and c.created_by is not null;

create table if not exists lore_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  title text not null,
  category text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- User-defined tabs, added from the campaign view. Each one is a simple
-- title + notes list (custom_tab_entries), scoped to a custom_tabs row
-- which is itself scoped to a campaign.
create table if not exists custom_tabs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- A private tab is visible only to the player who made it — same trust
-- model as session_notes/party_notes: RLS below stays anon-full-access
-- (everyone can technically read every row through the anon key), and
-- privacy is enforced by the app only ever rendering a private tab to
-- created_by = the logged-in player (or to the admin, who has no player
-- account and sees every tab regardless). created_by is nullable and ON
-- DELETE SET NULL rather than CASCADE: a tab predating this feature, or
-- one made by the admin, has no owner to match against, so it just stays
-- hidden from every player instead of vanishing outright if its creator's
-- account is later deleted.
alter table custom_tabs add column if not exists created_by uuid references players(id) on delete set null;
alter table custom_tabs add column if not exists is_private boolean not null default false;

create table if not exists custom_tab_entries (
  id uuid primary key default gen_random_uuid(),
  custom_tab_id uuid not null references custom_tabs(id) on delete cascade,
  title text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Bug/suggestion box for players and DMs to send straight to the admin.
-- Genuinely anonymous, not just "app-enforced" privacy like session_notes/
-- party_notes/private custom tabs: there is NO player_id, campaign_id, or
-- any other identifying column here at all, so there's nothing for the
-- admin to trace a submission back to even if they wanted to.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'issue' check (kind in ('issue','suggestion')),
  message text not null,
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

-- ── Campaign memberships view ─────────────────────────────────────────
-- Lets a player's personal dashboard query "campaigns I belong to" as a
-- normal select, reusing the app's generic data-fetching hook. Writes
-- (rename/archive/delete) still go directly against the campaigns
-- table, since a multi-table join view isn't writable.
--
-- GUARDRAIL: never join `players` into any view exposed to anon.
-- Postgres evaluates a view's underlying RLS as the VIEW OWNER, not the
-- querying role, so a view joining players would silently let anon
-- read password_hash despite players having zero anon policies. This
-- view only touches campaigns + campaign_members, neither of which has
-- secrets, so it's safe.
create or replace view campaign_memberships as
select cm.player_id, cm.role, c.*
from campaign_members cm
join campaigns c on c.id = cm.campaign_id;

grant select on campaign_memberships to anon;

-- ── Row Level Security ──────────────────────────────────────────────
-- No login for this app: everyone who has the app URL shares access, so
-- the anon role gets full read/write/delete. Anyone who obtains the
-- public anon key can also read/write directly — acceptable for a small
-- private link shared with your table, not for a public URL.

alter table campaigns          enable row level security;
alter table maps               enable row level security;
alter table map_markers         enable row level security;
alter table npcs               enable row level security;
alter table loot                enable row level security;
alter table places              enable row level security;
alter table quests              enable row level security;
alter table party_members       enable row level security;
alter table party_goals         enable row level security;
alter table party_notes         enable row level security;
alter table spells              enable row level security;
alter table player_wallets      enable row level security;
alter table player_shards       enable row level security;
alter table session_notes       enable row level security;
alter table lore_entries        enable row level security;
alter table custom_tabs         enable row level security;
alter table custom_tab_entries  enable row level security;
alter table campaign_members    enable row level security;
alter table feedback            enable row level security;

-- players: RLS enabled, but INTENTIONALLY no policy of any kind — this is
-- what blocks the anon role from reading password_hash. All access goes
-- through the SECURITY DEFINER functions below. Do not add a policy here.
alter table players enable row level security;

drop policy if exists "anon full access campaigns"          on campaigns;
drop policy if exists "anon full access maps"               on maps;
drop policy if exists "anon full access map_markers"        on map_markers;
drop policy if exists "anon full access npcs"               on npcs;
drop policy if exists "anon full access loot"               on loot;
drop policy if exists "anon full access places"             on places;
drop policy if exists "anon full access quests"             on quests;
drop policy if exists "anon full access party_members"      on party_members;
drop policy if exists "anon full access party_goals"        on party_goals;
drop policy if exists "anon full access party_notes"        on party_notes;
drop policy if exists "anon full access spells"             on spells;
drop policy if exists "anon full access player_wallets"     on player_wallets;
drop policy if exists "anon full access player_shards"      on player_shards;
drop policy if exists "anon full access session_notes"      on session_notes;
drop policy if exists "anon full access lore_entries"       on lore_entries;
drop policy if exists "anon full access custom_tabs"        on custom_tabs;
drop policy if exists "anon full access custom_tab_entries" on custom_tab_entries;
drop policy if exists "anon full access campaign_members"    on campaign_members;
drop policy if exists "anon full access feedback"            on feedback;

create policy "anon full access campaigns"          on campaigns          for all to anon using (true) with check (true);
create policy "anon full access maps"               on maps               for all to anon using (true) with check (true);
create policy "anon full access map_markers"        on map_markers        for all to anon using (true) with check (true);
create policy "anon full access npcs"               on npcs               for all to anon using (true) with check (true);
create policy "anon full access loot"               on loot               for all to anon using (true) with check (true);
create policy "anon full access places"             on places             for all to anon using (true) with check (true);
create policy "anon full access quests"             on quests             for all to anon using (true) with check (true);
create policy "anon full access party_members"      on party_members      for all to anon using (true) with check (true);
create policy "anon full access party_goals"        on party_goals        for all to anon using (true) with check (true);
create policy "anon full access party_notes"        on party_notes        for all to anon using (true) with check (true);
create policy "anon full access spells"              on spells             for all to anon using (true) with check (true);
create policy "anon full access player_wallets"     on player_wallets     for all to anon using (true) with check (true);
create policy "anon full access player_shards"      on player_shards      for all to anon using (true) with check (true);
create policy "anon full access session_notes"      on session_notes      for all to anon using (true) with check (true);
create policy "anon full access lore_entries"       on lore_entries       for all to anon using (true) with check (true);
create policy "anon full access custom_tabs"        on custom_tabs        for all to anon using (true) with check (true);
create policy "anon full access custom_tab_entries" on custom_tab_entries for all to anon using (true) with check (true);
create policy "anon full access campaign_members"   on campaign_members   for all to anon using (true) with check (true);
create policy "anon full access feedback"           on feedback           for all to anon using (true) with check (true);

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

insert into storage.buckets (id, name, public)
values ('map-marker-photos', 'map-marker-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('player-backgrounds', 'player-backgrounds', true)
on conflict (id) do nothing;

drop policy if exists "anon full access maps bucket" on storage.objects;
drop policy if exists "anon full access npc-portraits bucket" on storage.objects;
drop policy if exists "anon full access party-portraits bucket" on storage.objects;
drop policy if exists "anon full access campaign-covers bucket" on storage.objects;
drop policy if exists "anon full access map-marker-photos bucket" on storage.objects;
drop policy if exists "anon full access player-backgrounds bucket" on storage.objects;

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

create policy "anon full access map-marker-photos bucket"
  on storage.objects for all to anon
  using (bucket_id = 'map-marker-photos') with check (bucket_id = 'map-marker-photos');

create policy "anon full access player-backgrounds bucket"
  on storage.objects for all to anon
  using (bucket_id = 'player-backgrounds') with check (bucket_id = 'player-backgrounds');

-- ── Functions: player accounts, admin gate, and campaign joining ──────
-- All SECURITY DEFINER (run with the function owner's privileges, which
-- is what lets them read/write `players` despite it having zero anon
-- policies) and pinned with `set search_path` to guard against
-- search-path hijacking. Each admin-only function re-checks the admin
-- password INSIDE the function body — the client's "admin session" is
-- just a UI convenience flag, not a security boundary, so this re-check
-- is what actually stops a random anon caller from doing admin things.
--
-- This is a deliberately lightweight, UI-enforced permission model, not
-- real per-player database security (see README.md for the tradeoffs
-- vs. real Supabase Auth). The literal admin password below is stored
-- in plaintext in this file — fine for a private repo, not a secret in
-- any strong sense.
--
-- create_player/verify_login call extensions.crypt()/extensions.gen_salt()
-- fully-qualified (pgcrypto is forced into that schema up top), so
-- password hashing doesn't depend on search_path guessing correctly.
-- `extensions` is kept in search_path too as a harmless second layer.

create or replace function verify_admin_password(p_admin_password text)
returns boolean
language sql security definer set search_path = public, extensions, pg_temp as $$
  select p_admin_password = 'dndrules';
$$;
grant execute on function verify_admin_password(text) to anon;

create or replace function create_player(p_username text, p_password text, p_admin_password text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid;
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;

  if trim(p_username) = '' then
    raise exception 'Username is required';
  end if;

  begin
    insert into players (username, password_hash)
    values (trim(p_username), extensions.crypt(p_password, extensions.gen_salt('bf', 8)))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That username is already taken';
  end;

  return v_id;
end;
$$;
grant execute on function create_player(text, text, text) to anon;

create or replace function update_player(
  p_player_id uuid,
  p_username text,
  p_password text,
  p_admin_password text
)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;

  if trim(p_username) = '' then
    raise exception 'Username is required';
  end if;

  begin
    if p_password is not null and p_password <> '' then
      update players
      set username = trim(p_username),
          password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8))
      where id = p_player_id;
    else
      update players set username = trim(p_username) where id = p_player_id;
    end if;
  exception when unique_violation then
    raise exception 'That username is already taken';
  end;
end;
$$;
grant execute on function update_player(uuid, text, text, text) to anon;

create or replace function delete_player(p_player_id uuid, p_admin_password text)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;

  delete from players where id = p_player_id;
end;
$$;
grant execute on function delete_player(uuid, text) to anon;

create or replace function verify_login(p_username text, p_password text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_player players%rowtype;
begin
  select * into v_player from players where lower(username) = lower(trim(p_username));

  if v_player.id is null or v_player.password_hash <> extensions.crypt(p_password, v_player.password_hash) then
    raise exception 'Invalid username or password';
  end if;

  return v_player.id;
end;
$$;
grant execute on function verify_login(text, text) to anon;

create or replace function list_players(p_admin_password text)
returns table(id uuid, username text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;

  return query select p.id, p.username, p.created_at from players p order by p.created_at;
end;
$$;
grant execute on function list_players(text) to anon;

create or replace function create_campaign(
  p_player_id uuid,
  p_name text,
  p_description text default '',
  p_cover_image_path text default null
)
returns table(id uuid, join_code text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L, easy to read aloud
  v_code text;
  v_campaign_id uuid;
  v_attempts int := 0;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1);
    end loop;

    begin
      insert into campaigns (name, description, cover_image_path, created_by, join_code)
      values (p_name, p_description, p_cover_image_path, p_player_id, v_code)
      returning campaigns.id into v_campaign_id;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 20 then
        raise exception 'Could not generate a unique join code, please try again';
      end if;
    end;
  end loop;

  insert into campaign_members (campaign_id, player_id, role)
  values (v_campaign_id, p_player_id, 'creator');

  return query select v_campaign_id, v_code;
end;
$$;
grant execute on function create_campaign(uuid, text, text, text) to anon;

create or replace function join_campaign(p_player_id uuid, p_join_code text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_campaign_id uuid;
begin
  select campaigns.id into v_campaign_id
  from campaigns
  where upper(join_code) = upper(trim(p_join_code));

  if v_campaign_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into campaign_members (campaign_id, player_id, role)
  values (v_campaign_id, p_player_id, 'player')
  on conflict (campaign_id, player_id) do nothing;

  return v_campaign_id;
end;
$$;
grant execute on function join_campaign(uuid, text) to anon;

create or replace function list_campaign_members(p_campaign_id uuid)
returns table(membership_id uuid, player_id uuid, username text, role text)
language sql security definer set search_path = public, extensions, pg_temp as $$
  select cm.id, cm.player_id, p.username, cm.role
  from campaign_members cm
  join players p on p.id = cm.player_id
  where cm.campaign_id = p_campaign_id;
$$;
grant execute on function list_campaign_members(uuid) to anon;

-- If inserts/updates fail with "permission denied for schema public",
-- run this once too (RLS policies still apply on top of these grants,
-- but note this would also grant anon raw table access to `players` if
-- ever run — re-check the players table has no policies afterward):
-- grant usage on schema public to anon, authenticated;
-- grant all on all tables in schema public to anon, authenticated;

-- ── Companion features (Session Mode, character sheets, links, prep) ──
-- Self-contained block: creates its own tables, RLS and policies, so it
-- can also be pasted on its own to upgrade an existing database.

-- Mechanics + roleplay for one party member (normally the character a
-- player has claimed). Kept as two JSON documents rather than dozens of
-- columns: the sheet is always read and written whole by one client, and
-- the shapes (see src/lib/character.js) evolve without migrations.
create table if not exists character_sheets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  party_member_id uuid not null references party_members(id) on delete cascade,
  mechanics jsonb not null default '{}'::jsonb,
  narrative jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (party_member_id)
);

-- Timestamped notes jotted during a live session. Private per player,
-- like session_notes. session_note_id is set once the note has been
-- folded into a session recap; converted_to records "npcs:<id>" etc.
-- when it was turned into a journal entry.
create table if not exists quick_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  content text not null,
  session_note_id uuid references session_notes(id) on delete set null,
  converted_to text not null default '',
  created_at timestamptz not null default now()
);

-- Explicit relationships between any two campaign entries ("NPC
-- encountered at location", "clue associated with quest"...). Entries are
-- referenced by (table, id) so one table covers every pairing; a link to a
-- since-deleted entry is shown as missing and can be removed in the UI.
create table if not exists entity_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  relation text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists entity_links_source_idx on entity_links (campaign_id, source_id);
create index if not exists entity_links_target_idx on entity_links (campaign_id, target_id);

-- One prep sheet per player per campaign (objectives, questions for the
-- DM, things to prepare, checklist, next session date) as JSON.
create table if not exists session_prep (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

alter table character_sheets enable row level security;
alter table quick_notes      enable row level security;
alter table entity_links     enable row level security;
alter table session_prep     enable row level security;

drop policy if exists "anon full access character_sheets" on character_sheets;
drop policy if exists "anon full access quick_notes"      on quick_notes;
drop policy if exists "anon full access entity_links"     on entity_links;
drop policy if exists "anon full access session_prep"     on session_prep;

create policy "anon full access character_sheets" on character_sheets for all to anon using (true) with check (true);
create policy "anon full access quick_notes"      on quick_notes      for all to anon using (true) with check (true);
create policy "anon full access entity_links"     on entity_links     for all to anon using (true) with check (true);
create policy "anon full access session_prep"     on session_prep     for all to anon using (true) with check (true);

-- Monsters & Creatures the party has run into, shared by the whole
-- campaign (any player can add, edit or remove). kind splits the list
-- into the tab's Monsters / Creatures filter.
create table if not exists creatures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  kind text not null default 'Monster' check (kind in ('Monster','Creature')),
  creature_type text not null default '',
  challenge text not null default '',
  armor_class integer check (armor_class is null or armor_class between 0 and 50),
  hit_points integer check (hit_points is null or hit_points between 0 and 9999),
  encountered_at text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table creatures enable row level security;
drop policy if exists "anon full access creatures" on creatures;
create policy "anon full access creatures" on creatures for all to anon using (true) with check (true);

-- ── DM tools ──────────────────────────────────────────────────────────
-- Only campaign DMs/creators see these in the app. Like everything else
-- here that is UI-level privacy, not database security: the anon key can
-- still read these tables (see the Row Level Security note above).

-- NPCs the DM is drafting before the party meets them. "Reveal" copies
-- the player-safe fields into npcs (never `secrets`) and records which
-- row it made; deleting that npcs row clears the link again.
create table if not exists dm_npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  race text not null default '',
  occupation text not null default '',
  location text not null default '',
  description text not null default '',
  secrets text not null default '',
  photo_path text,                 -- object key in the "npc-portraits" bucket, nullable
  revealed_npc_id uuid references npcs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Art the DM has used in the campaign. `shared` pieces also show in the
-- players' Journal → Art tab.
create table if not exists campaign_art (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  image_path text not null,        -- object key in the "campaign-art" bucket
  title text not null default '',
  category text not null default 'Other',
  notes text not null default '',
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

alter table dm_npcs      enable row level security;
alter table campaign_art enable row level security;
drop policy if exists "anon full access dm_npcs" on dm_npcs;
drop policy if exists "anon full access campaign_art" on campaign_art;
create policy "anon full access dm_npcs"      on dm_npcs      for all to anon using (true) with check (true);
create policy "anon full access campaign_art" on campaign_art for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('campaign-art', 'campaign-art', true)
on conflict (id) do nothing;

drop policy if exists "anon full access campaign-art bucket" on storage.objects;
create policy "anon full access campaign-art bucket"
  on storage.objects for all to anon
  using (bucket_id = 'campaign-art') with check (bucket_id = 'campaign-art');

-- ── DM sharing ────────────────────────────────────────────────────────
-- The DM keeps NPCs, art and maps private, then presses Share: that posts
-- a dm_shares row (a notification every player sees) carrying a snapshot
-- of the player-safe fields. Any player can Add it to the right tab. The
-- unique dm_npc_id / dm_map_id columns are what stop two players adding
-- the same item twice — the second insert simply fails and is ignored.

-- Private maps the DM has uploaded (images live in the "maps" bucket).
create table if not exists dm_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  image_path text not null,
  caption text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table npcs add column if not exists dm_npc_id uuid unique references dm_npcs(id) on delete set null;
alter table maps add column if not exists dm_map_id uuid unique references dm_maps(id) on delete set null;

create table if not exists dm_shares (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null check (kind in ('npc', 'art', 'map')),
  source_id uuid not null,         -- dm_npcs / campaign_art / dm_maps row
  title text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A player clearing a notification from their own list.
create table if not exists dm_share_dismissals (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references dm_shares(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (share_id, player_id)
);

alter table dm_maps             enable row level security;
alter table dm_shares           enable row level security;
alter table dm_share_dismissals enable row level security;
drop policy if exists "anon full access dm_maps" on dm_maps;
drop policy if exists "anon full access dm_shares" on dm_shares;
drop policy if exists "anon full access dm_share_dismissals" on dm_share_dismissals;
create policy "anon full access dm_maps"             on dm_maps             for all to anon using (true) with check (true);
create policy "anon full access dm_shares"           on dm_shares           for all to anon using (true) with check (true);
create policy "anon full access dm_share_dismissals" on dm_share_dismissals for all to anon using (true) with check (true);

-- Monsters & creatures the DM preps privately. Sharing works like NPCs:
-- a player's Add copies the player-safe fields into `creatures` (stats
-- only when the DM ticks share_stats), linked by the unique
-- dm_creature_id so it can't be added twice.
create table if not exists dm_creatures (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  kind text not null default 'Monster' check (kind in ('Monster','Creature')),
  creature_type text not null default '',
  challenge text not null default '',
  armor_class integer check (armor_class is null or armor_class between 0 and 50),
  hit_points integer check (hit_points is null or hit_points between 0 and 9999),
  description text not null default '',
  secrets text not null default '',
  share_stats boolean not null default false,
  created_at timestamptz not null default now()
);

alter table creatures add column if not exists dm_creature_id uuid unique references dm_creatures(id) on delete set null;

alter table dm_shares drop constraint if exists dm_shares_kind_check;
alter table dm_shares add constraint dm_shares_kind_check
  check (kind in ('npc', 'art', 'map', 'creature'));

alter table dm_creatures enable row level security;
drop policy if exists "anon full access dm_creatures" on dm_creatures;
create policy "anon full access dm_creatures" on dm_creatures for all to anon using (true) with check (true);

-- Optional picture for a loot item (object key in "loot-photos").
alter table loot add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('loot-photos', 'loot-photos', true)
on conflict (id) do nothing;

drop policy if exists "anon full access loot-photos bucket" on storage.objects;
create policy "anon full access loot-photos bucket"
  on storage.objects for all to anon
  using (bucket_id = 'loot-photos') with check (bucket_id = 'loot-photos');

-- ── Live updates (Supabase Realtime) ─────────────────────────────────
-- The app subscribes to changes on these tables so one player's edits
-- show up on everyone else's screen without a reload. Adds each table to
-- the supabase_realtime publication if it isn't there yet (and skips any
-- that don't exist), so this block is safe to re-run. `players` is
-- deliberately left out.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'campaigns', 'campaign_members', 'maps', 'map_markers', 'npcs', 'loot', 'places', 'quests',
    'party_members', 'party_goals', 'party_notes', 'spells', 'player_wallets', 'player_shards',
    'session_notes', 'lore_entries', 'custom_tabs', 'custom_tab_entries', 'character_sheets',
    'quick_notes', 'entity_links', 'session_prep', 'creatures', 'dm_npcs', 'campaign_art',
    'dm_maps', 'dm_shares', 'dm_share_dismissals', 'dm_creatures'
  ] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Profile pictures ─────────────────────────────────────────────────
-- One optional picture per player (object key in "player-avatars"). Kept
-- out of `players` on purpose: that table must stay without anon
-- policies (see above), and a picture is no secret.
create table if not exists player_profiles (
  player_id uuid primary key references players(id) on delete cascade,
  avatar_path text,
  updated_at timestamptz not null default now()
);

alter table player_profiles enable row level security;
drop policy if exists "anon full access player_profiles" on player_profiles;
create policy "anon full access player_profiles" on player_profiles for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('player-avatars', 'player-avatars', true)
on conflict (id) do nothing;

drop policy if exists "anon full access player-avatars bucket" on storage.objects;
create policy "anon full access player-avatars bucket"
  on storage.objects for all to anon
  using (bucket_id = 'player-avatars') with check (bucket_id = 'player-avatars');

-- ── Notifications and solved feedback ────────────────────────────────
-- Feedback can be marked solved by the admin. A player who ticked "Tell
-- me when it's solved" is recorded on their submission (player_id; the
-- admin screen never shows who) and gets a notification when it is.
-- Unticked, nothing identifies the sender.
alter table feedback add column if not exists player_id uuid references players(id) on delete set null;
alter table feedback add column if not exists status text not null default 'open';
alter table feedback add column if not exists solved_at timestamptz;
alter table feedback drop constraint if exists feedback_status_check;
alter table feedback add constraint feedback_status_check check (status in ('open', 'solved'));

-- Per-player notifications shown in the bell (any kind, not just DM
-- shares). read_at is set once the player has seen it.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  kind text not null default 'general',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_player_idx on notifications (player_id, created_at desc);

alter table notifications enable row level security;
drop policy if exists "anon full access notifications" on notifications;
create policy "anon full access notifications" on notifications for all to anon using (true) with check (true);

-- Live delivery: a new notification shows up in the bell without a reload.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ── Shared initiative ────────────────────────────────────────────────
-- One live encounter per campaign (turn order, HP, conditions), shared by
-- every device at the table so the DM can run it and players see whose
-- turn it is. `state` is the tracker's JSON (see src/lib/initiative.js).
create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references campaigns(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table encounters enable row level security;
drop policy if exists "anon full access encounters" on encounters;
create policy "anon full access encounters" on encounters for all to anon using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'encounters'
  ) then
    alter publication supabase_realtime add table public.encounters;
  end if;
end $$;

-- ── Sign-up by invite link ───────────────────────────────────────────
-- Only the admin invites. Each invite is a private, single-use link
-- (…/?invite=<token>) that expires after 30 days and can be revoked. It
-- can carry a campaign the new player joins on sign-up; without one they
-- join later with a campaign's join code. The admin can still create
-- accounts directly. Name and email live on `players`, and invites in
-- `player_invites` — neither has anon access, so both are only reachable
-- through the functions below.
alter table players add column if not exists display_name text not null default '';
alter table players add column if not exists email text;
create unique index if not exists players_email_lower_idx on players (lower(email)) where email is not null;

create table if not exists player_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  campaign_id uuid references campaigns(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  used_by uuid references players(id) on delete set null,
  revoked_at timestamptz
);
-- RLS on, no policies: invite tokens are never readable directly.
alter table player_invites enable row level security;

-- Earlier drafts of open sign-up; make sure none linger.
drop function if exists register_player(text, text, text, text);
drop function if exists register_player(text, text, text, text, text);

create or replace function create_player_invite(p_admin_password text, p_campaign_id uuid, p_note text default '')
returns table(id uuid, token text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  if p_campaign_id is not null and not exists (select 1 from campaigns c where c.id = p_campaign_id) then
    raise exception 'That campaign no longer exists';
  end if;
  return query
    insert into player_invites (token, campaign_id, note)
    values (encode(extensions.gen_random_bytes(18), 'hex'), p_campaign_id, left(trim(coalesce(p_note, '')), 120))
    returning player_invites.id, player_invites.token;
end;
$$;
grant execute on function create_player_invite(text, uuid, text) to anon;

create or replace function list_player_invites(p_admin_password text)
returns table(
  id uuid, token text, campaign_id uuid, campaign_name text, note text,
  created_at timestamptz, expires_at timestamptz, used_at timestamptz,
  used_by_username text, revoked_at timestamptz
)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  return query
    select i.id, i.token, i.campaign_id, c.name, i.note, i.created_at, i.expires_at, i.used_at, p.username, i.revoked_at
    from player_invites i
    left join campaigns c on c.id = i.campaign_id
    left join players p on p.id = i.used_by
    order by i.created_at desc;
end;
$$;
grant execute on function list_player_invites(text) to anon;

create or replace function revoke_player_invite(p_admin_password text, p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  update player_invites set revoked_at = now() where id = p_invite_id and used_at is null and revoked_at is null;
end;
$$;
grant execute on function revoke_player_invite(text, uuid) to anon;

-- What the sign-up page shows before the form: whether the link still
-- works, and the campaign it joins (nothing else about the invite).
create or replace function check_player_invite(p_token text)
returns table(status text, campaign_name text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_invite player_invites%rowtype;
begin
  select * into v_invite from player_invites where token = trim(coalesce(p_token, ''));
  if v_invite.id is null then
    return query select 'invalid'::text, null::text;
  elsif v_invite.revoked_at is not null then
    return query select 'revoked'::text, null::text;
  elsif v_invite.used_at is not null then
    return query select 'used'::text, null::text;
  elsif v_invite.expires_at < now() then
    return query select 'expired'::text, null::text;
  else
    return query select 'ok'::text, (select c.name from campaigns c where c.id = v_invite.campaign_id);
  end if;
end;
$$;
grant execute on function check_player_invite(text) to anon;

create or replace function register_player(
  p_invite_token text,
  p_username text,
  p_display_name text,
  p_password text,
  p_email text
)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_invite player_invites%rowtype;
  v_id uuid;
  v_username text := trim(coalesce(p_username, ''));
  v_name text := trim(coalesce(p_display_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  -- Locked so the same link can't make two accounts at once.
  select * into v_invite from player_invites where token = trim(coalesce(p_invite_token, '')) for update;
  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'This invite link is no longer valid — ask whoever invited you for a new one';
  end if;

  if v_username !~ '^[A-Za-z0-9_.-]{3,30}$' then
    raise exception 'Usernames are 3–30 letters, numbers, dots, dashes or underscores';
  end if;
  if v_name = '' or length(v_name) > 60 then
    raise exception 'Enter your name (up to 60 characters)';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter a valid email address';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Passwords need at least 8 characters';
  end if;
  if exists (select 1 from players where lower(username) = lower(v_username)) then
    raise exception 'That username is already taken';
  end if;
  if exists (select 1 from players where lower(email) = v_email) then
    raise exception 'An account with that email already exists';
  end if;

  begin
    insert into players (username, display_name, email, password_hash)
    values (v_username, v_name, v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 8)))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That username or email is already taken';
  end;

  update player_invites set used_at = now(), used_by = v_id where id = v_invite.id;

  if v_invite.campaign_id is not null then
    insert into campaign_members (campaign_id, player_id, role)
    values (v_invite.campaign_id, v_id, 'player')
    on conflict (campaign_id, player_id) do nothing;
  end if;

  return v_id;
end;
$$;
grant execute on function register_player(text, text, text, text, text) to anon;

-- The admin's player list also returns name and email (a changed return
-- type needs the old function dropped first).
drop function if exists list_players(text);
create function list_players(p_admin_password text)
returns table(id uuid, username text, display_name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  return query
    select p.id, p.username, p.display_name, p.email, p.created_at from players p order by p.created_at;
end;
$$;
grant execute on function list_players(text) to anon;

-- ── DM invites and the DM's Players tab ──────────────────────────────
-- Needs the "Sign-up by invite link" block above. A campaign's DM (or its
-- creator) can make sign-up links for that campaign only, see them and
-- cancel them, and list who's in the campaign by name. Same trust model
-- as the rest of the app: the caller passes their player id.
alter table player_invites add column if not exists created_by uuid references players(id) on delete set null;

create or replace function is_campaign_dm(p_player_id uuid, p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from campaign_members
    where campaign_id = p_campaign_id and player_id = p_player_id and role in ('dm', 'creator')
  ) or exists (
    select 1 from campaigns where id = p_campaign_id and created_by = p_player_id
  );
$$;

create or replace function create_campaign_invite(p_player_id uuid, p_campaign_id uuid, p_note text default '')
returns table(id uuid, token text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not is_campaign_dm(p_player_id, p_campaign_id) then
    raise exception 'Only this campaign''s DM can invite players to it';
  end if;
  return query
    insert into player_invites (token, campaign_id, note, created_by)
    values (encode(extensions.gen_random_bytes(18), 'hex'), p_campaign_id, left(trim(coalesce(p_note, '')), 120), p_player_id)
    returning player_invites.id, player_invites.token;
end;
$$;
grant execute on function create_campaign_invite(uuid, uuid, text) to anon;

create or replace function list_campaign_invites(p_player_id uuid, p_campaign_id uuid)
returns table(
  id uuid, token text, campaign_id uuid, campaign_name text, note text,
  created_at timestamptz, expires_at timestamptz, used_at timestamptz,
  used_by_username text, revoked_at timestamptz
)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not is_campaign_dm(p_player_id, p_campaign_id) then
    raise exception 'Only this campaign''s DM can see its invites';
  end if;
  return query
    select i.id, i.token, i.campaign_id, c.name, i.note, i.created_at, i.expires_at, i.used_at, p.username, i.revoked_at
    from player_invites i
    join campaigns c on c.id = i.campaign_id
    left join players p on p.id = i.used_by
    where i.campaign_id = p_campaign_id
    order by i.created_at desc;
end;
$$;
grant execute on function list_campaign_invites(uuid, uuid) to anon;

create or replace function revoke_campaign_invite(p_player_id uuid, p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from player_invites where id = p_invite_id;
  if v_campaign_id is null or not is_campaign_dm(p_player_id, v_campaign_id) then
    raise exception 'Only this campaign''s DM can cancel its invites';
  end if;
  update player_invites set revoked_at = now() where id = p_invite_id and used_at is null and revoked_at is null;
end;
$$;
grant execute on function revoke_campaign_invite(uuid, uuid) to anon;

-- Who's in a campaign, by name (no emails), for the DM's Players tab.
create or replace function list_campaign_players(p_campaign_id uuid)
returns table(player_id uuid, username text, display_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select cm.player_id, p.username, p.display_name, cm.role, cm.created_at
  from campaign_members cm
  join players p on p.id = cm.player_id
  where cm.campaign_id = p_campaign_id
  order by cm.role = 'player', lower(coalesce(nullif(p.display_name, ''), p.username));
$$;
grant execute on function list_campaign_players(uuid) to anon;

-- ── Existing players can use invite links ────────────────────────────
-- Needs the two invite blocks above. A player who already has an account
-- can open a campaign invite link and join with it (logged in, or by
-- logging in from the link) — there's no limit on how many campaigns a
-- player is in. The link is used up only if they weren't already a
-- member. Links with no campaign are for new accounts only.
create or replace function accept_player_invite(p_player_id uuid, p_token text)
returns table(campaign_id uuid, campaign_name text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_invite player_invites%rowtype;
  v_added integer;
begin
  if not exists (select 1 from players where id = p_player_id) then
    raise exception 'Log in again, then open the invite link';
  end if;
  select * into v_invite from player_invites where token = trim(coalesce(p_token, '')) for update;
  if v_invite.id is null or v_invite.revoked_at is not null or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'This invite link is no longer valid — ask whoever invited you for a new one';
  end if;
  if v_invite.campaign_id is null then
    raise exception 'This invite link is for making a new account. To join a campaign, use the join code from your DM.';
  end if;

  insert into campaign_members (campaign_id, player_id, role)
  values (v_invite.campaign_id, p_player_id, 'player')
  on conflict (campaign_id, player_id) do nothing;
  get diagnostics v_added = row_count;
  if v_added > 0 then
    update player_invites set used_at = now(), used_by = p_player_id where id = v_invite.id;
  end if;

  return query select c.id, c.name from campaigns c where c.id = v_invite.campaign_id;
end;
$$;
grant execute on function accept_player_invite(uuid, text) to anon;

-- ── Loot quantities ───────────────────────────────────────────────────
-- How many of an item the party has (potions, arrows, scrolls…). Blank
-- (null) is a single item. Using a counted, usable item asks how many and
-- deducts them; at 0 it shows as used up.
alter table loot add column if not exists quantity integer;
alter table loot drop constraint if exists loot_quantity_check;
alter table loot add constraint loot_quantity_check check (quantity is null or quantity between 0 and 9999);

-- ── Account settings and password resets ─────────────────────────────
-- Needs the "Sign-up by invite link" block above. Players change their
-- own username, name, email and password (always confirming the current
-- password). There's no email sending, so a forgotten password goes via
-- the admin: "Forgot password?" on the login records a request, the
-- admin makes a single-use reset link (24 hours) and sends it, and the
-- player picks a new password from it. Passwords stay bcrypt-hashed —
-- nobody, the admin included, can read them; the admin can only reset.
create table if not exists password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz
);
-- RLS on, no policies: only reachable through the functions below.
alter table password_reset_requests enable row level security;
alter table password_resets enable row level security;

-- The player's own details for the Account screen; the email is masked
-- (j•••@example.com) since player ids aren't secret.
create or replace function get_my_account(p_player_id uuid)
returns table(username text, display_name text, email_hint text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.username, p.display_name,
    case when p.email is null or p.email = '' then null
         else left(p.email, 1) || '•••' || substring(p.email from position('@' in p.email)) end
  from players p where p.id = p_player_id;
$$;
grant execute on function get_my_account(uuid) to anon;

-- Changes only what's passed (null = keep). The current password is
-- always required.
create or replace function update_my_account(
  p_player_id uuid,
  p_current_password text,
  p_username text default null,
  p_display_name text default null,
  p_email text default null,
  p_new_password text default null
)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_player players%rowtype;
  v_username text := nullif(trim(coalesce(p_username, '')), '');
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  select * into v_player from players where id = p_player_id for update;
  if v_player.id is null or v_player.password_hash <> extensions.crypt(coalesce(p_current_password, ''), v_player.password_hash) then
    raise exception 'Your current password isn’t right';
  end if;

  if v_username is not null and v_username <> v_player.username then
    if v_username !~ '^[A-Za-z0-9_.-]{3,30}$' then
      raise exception 'Usernames are 3–30 letters, numbers, dots, dashes or underscores';
    end if;
    if exists (select 1 from players where lower(username) = lower(v_username) and id <> p_player_id) then
      raise exception 'That username is already taken';
    end if;
  end if;
  if v_name is not null and length(v_name) > 60 then
    raise exception 'Names are up to 60 characters';
  end if;
  if v_email is not null then
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
      raise exception 'Enter a valid email address';
    end if;
    if exists (select 1 from players where lower(email) = v_email and id <> p_player_id) then
      raise exception 'An account with that email already exists';
    end if;
  end if;
  if p_new_password is not null and p_new_password <> '' and length(p_new_password) < 8 then
    raise exception 'Passwords need at least 8 characters';
  end if;

  begin
    update players set
      username = coalesce(v_username, username),
      display_name = coalesce(v_name, display_name),
      email = coalesce(v_email, email),
      password_hash = case when coalesce(p_new_password, '') <> ''
        then extensions.crypt(p_new_password, extensions.gen_salt('bf', 8)) else password_hash end
    where id = p_player_id;
  exception when unique_violation then
    raise exception 'That username or email is already taken';
  end;
end;
$$;
grant execute on function update_my_account(uuid, text, text, text, text, text) to anon;

-- "Forgot password?" — always succeeds, so it never reveals whether an
-- account exists. One open request per player.
create or replace function request_password_reset(p_identifier text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_key text := lower(trim(coalesce(p_identifier, '')));
begin
  if v_key = '' then return; end if;
  select id into v_id from players where lower(username) = v_key or lower(email) = v_key limit 1;
  if v_id is null then return; end if;
  update password_reset_requests set created_at = now() where player_id = v_id and handled_at is null;
  if not found then
    insert into password_reset_requests (player_id) values (v_id);
  end if;
end;
$$;
grant execute on function request_password_reset(text) to anon;

create or replace function list_password_reset_requests(p_admin_password text)
returns table(id uuid, player_id uuid, username text, display_name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  return query
    select r.id, p.id, p.username, p.display_name, p.email, r.created_at
    from password_reset_requests r join players p on p.id = r.player_id
    where r.handled_at is null
    order by r.created_at desc;
end;
$$;
grant execute on function list_password_reset_requests(text) to anon;

create or replace function dismiss_password_reset_request(p_admin_password text, p_request_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  update password_reset_requests set handled_at = now() where id = p_request_id;
end;
$$;
grant execute on function dismiss_password_reset_request(text, uuid) to anon;

-- Admin: a single-use reset link for a player (older unused links stop
-- working; their open request is marked handled).
create or replace function create_password_reset(p_admin_password text, p_player_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  if p_admin_password <> 'dndrules' then
    raise exception 'Invalid admin password';
  end if;
  if not exists (select 1 from players where id = p_player_id) then
    raise exception 'That player no longer exists';
  end if;
  update password_resets set expires_at = least(expires_at, now())
    where player_id = p_player_id and used_at is null;
  insert into password_resets (player_id, token) values (p_player_id, v_token);
  update password_reset_requests set handled_at = now() where player_id = p_player_id and handled_at is null;
  return v_token;
end;
$$;
grant execute on function create_password_reset(text, uuid) to anon;

create or replace function check_password_reset(p_token text)
returns table(status text, username text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reset password_resets%rowtype;
begin
  select * into v_reset from password_resets where token = trim(coalesce(p_token, ''));
  if v_reset.id is null then
    return query select 'invalid'::text, null::text;
  elsif v_reset.used_at is not null then
    return query select 'used'::text, null::text;
  elsif v_reset.expires_at < now() then
    return query select 'expired'::text, null::text;
  else
    return query select 'ok'::text, (select p.username from players p where p.id = v_reset.player_id);
  end if;
end;
$$;
grant execute on function check_password_reset(text) to anon;

-- Sets the new password and returns the username, for logging in.
create or replace function complete_password_reset(p_token text, p_new_password text)
returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_reset password_resets%rowtype;
  v_username text;
begin
  select * into v_reset from password_resets where token = trim(coalesce(p_token, '')) for update;
  if v_reset.id is null or v_reset.used_at is not null or v_reset.expires_at < now() then
    raise exception 'This reset link is no longer valid — ask the admin for a new one';
  end if;
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'Passwords need at least 8 characters';
  end if;
  update players set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 8))
    where id = v_reset.player_id
    returning username into v_username;
  update password_resets set used_at = now() where id = v_reset.id;
  return v_username;
end;
$$;
grant execute on function complete_password_reset(text, text) to anon;

-- ── Live map: party journey trail, typed and linked pins ─────────────
-- Every time the party pin is moved, a row here records where it went,
-- so the map can draw the party's journey as a dotted trail (labelled
-- by the session played on that day). Anon-writable like map_markers.
create table if not exists map_pin_moves (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references maps(id) on delete cascade,
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  created_at timestamptz not null default now()
);
create index if not exists map_pin_moves_map_idx on map_pin_moves (map_id, created_at);

alter table map_pin_moves enable row level security;
drop policy if exists "anon full access map_pin_moves" on map_pin_moves;
create policy "anon full access map_pin_moves" on map_pin_moves for all to anon using (true) with check (true);

-- A pin's type (shown as its icon and used by the map's filters), and an
-- optional link to the campaign entry it's about — tapping the pin opens
-- that NPC / place / quest / lore card, and the card can show its pin.
alter table map_markers add column if not exists category text not null default 'event';
alter table map_markers drop constraint if exists map_markers_category_check;
alter table map_markers add constraint map_markers_category_check
  check (category in ('event', 'town', 'dungeon', 'quest', 'danger'));
alter table map_markers add column if not exists entity_type text;
alter table map_markers add column if not exists entity_id uuid;
alter table map_markers drop constraint if exists map_markers_entity_type_check;
alter table map_markers add constraint map_markers_entity_type_check
  check (entity_type is null or entity_type in ('npc', 'place', 'quest', 'lore'));
create index if not exists map_markers_entity_idx on map_markers (entity_type, entity_id);

-- Live updates for the trail (the pin itself already syncs via maps).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'map_pin_moves'
  ) then
    alter publication supabase_realtime add table public.map_pin_moves;
  end if;
end $$;

-- The order of a map's pins in its Pins list, set by the campaign's
-- creator or DM by dragging. Unset pins sort after, oldest first.
alter table map_markers add column if not exists sort_order double precision;

-- ── Session recordings ───────────────────────────────────────────────
-- A recap's audio: recorded in the app (Session Mode, or a recap's own
-- page) or uploaded. The file lives in the "session-audio" bucket;
-- audio_seconds is its length, shown on the recap's card.
alter table session_notes add column if not exists audio_path text;
alter table session_notes add column if not exists audio_seconds integer;

insert into storage.buckets (id, name, public)
values ('session-audio', 'session-audio', true)
on conflict (id) do nothing;

drop policy if exists "anon full access session-audio bucket" on storage.objects;
create policy "anon full access session-audio bucket"
  on storage.objects for all to anon
  using (bucket_id = 'session-audio') with check (bucket_id = 'session-audio');

-- (Recordings briefly had a drawn "doodle"; it was removed.)
alter table session_notes drop column if exists audio_doodle;

-- A recording's bookmarks: moments marked while recording (or listening
-- back), as [{ "t": seconds, "label": "Big fight" }].
alter table session_notes add column if not exists audio_marks jsonb not null default '[]'::jsonb;

-- ── Quest board ──────────────────────────────────────────────────────
-- Quests gain a "Rumour" stage before Active (the board's first column).
alter table quests drop constraint if exists quests_status_check;
alter table quests add constraint quests_status_check
  check (status in ('Rumour','Active','Completed','Failed'));

-- ── Party polls ──────────────────────────────────────────────────────
-- A question put to the table ("River or mountain pass?"); everyone votes
-- live. When it's closed the decision is written into each member's quick
-- notes, so it lands in their session recap.
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  created_by uuid references players(id) on delete set null,
  created_by_name text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  result text not null default '',
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists polls_campaign_idx on polls (campaign_id, created_at desc);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  voter_name text not null default '',
  option_index int not null,
  created_at timestamptz not null default now(),
  unique (poll_id, player_id)
);
create index if not exists poll_votes_campaign_idx on poll_votes (campaign_id);

alter table polls enable row level security;
alter table poll_votes enable row level security;
drop policy if exists "anon full access polls" on polls;
drop policy if exists "anon full access poll_votes" on poll_votes;
create policy "anon full access polls" on polls for all to anon using (true) with check (true);
create policy "anon full access poll_votes" on poll_votes for all to anon using (true) with check (true);

do $$
declare t text;
begin
  foreach t in array array['polls', 'poll_votes'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Party goal steps ──────────────────────────────────────────────────
-- A goal broken into checkable steps ([{ id, text, done }]) — its
-- progress ring fills as they're ticked off — and when it was achieved.
alter table party_goals add column if not exists steps jsonb not null default '[]'::jsonb;
alter table party_goals add column if not exists completed_at timestamptz;

-- ── Personal goals ───────────────────────────────────────────────────
-- A player's own goals for their character, shaped like party_goals.
-- Same trust model as session_notes: the app only ever reads and writes
-- the logged-in player's rows (player_id), and they're kept out of the
-- campaign-wide index, so other players never see them.
create table if not exists personal_goals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  title text not null,
  status text not null default 'Active' check (status in ('Active', 'Completed')),
  notes text not null default '',
  steps jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists personal_goals_owner_idx on personal_goals (campaign_id, player_id);

alter table personal_goals enable row level security;
drop policy if exists "anon full access personal_goals" on personal_goals;
create policy "anon full access personal_goals" on personal_goals for all to anon using (true) with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_goals'
  ) then
    alter publication supabase_realtime add table public.personal_goals;
  end if;
end $$;

-- ── NPC attitude ─────────────────────────────────────────────────────
-- How an NPC feels about the party (Hostile · Wary · Neutral · Friendly ·
-- Ally; null = not judged yet), and the history of how that changed:
-- [{ from, to, note, at }].
alter table npcs add column if not exists attitude text;
alter table npcs drop constraint if exists npcs_attitude_check;
alter table npcs add constraint npcs_attitude_check
  check (attitude is null or attitude in ('Hostile', 'Wary', 'Neutral', 'Friendly', 'Ally'));
alter table npcs add column if not exists attitude_log jsonb not null default '[]'::jsonb;

-- ── Creatures (monsters folded in) ───────────────────────────────────
-- "Monster" and "Creature" are now just creatures: existing monsters are
-- relabelled. CR / AC / HP aren't shown any more (the columns stay, so
-- nothing already written is lost). Creatures can have several photos:
-- storage paths in the creature-photos bucket.
update creatures set kind = 'Creature' where kind = 'Monster';
alter table creatures alter column kind set default 'Creature';
alter table creatures add column if not exists photos jsonb not null default '[]'::jsonb;

update dm_creatures set kind = 'Creature' where kind = 'Monster';
alter table dm_creatures alter column kind set default 'Creature';
alter table dm_creatures add column if not exists photos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('creature-photos', 'creature-photos', true)
on conflict (id) do nothing;
drop policy if exists "anon full access creature-photos bucket" on storage.objects;
create policy "anon full access creature-photos bucket"
  on storage.objects for all to anon
  using (bucket_id = 'creature-photos') with check (bucket_id = 'creature-photos');

-- ── Faction standing ─────────────────────────────────────────────────
-- The party's reputation with a faction (a lore entry whose category is
-- "Faction"): −3 Hated … 0 Neutral … +3 Revered, null = not set yet, and
-- the history of how it moved: [{ from, to, note, at }].
alter table lore_entries add column if not exists standing smallint;
alter table lore_entries drop constraint if exists lore_entries_standing_check;
alter table lore_entries add constraint lore_entries_standing_check
  check (standing is null or standing between -3 and 3);
alter table lore_entries add column if not exists standing_log jsonb not null default '[]'::jsonb;

-- ── In-world calendar ────────────────────────────────────────────────
-- One row per campaign: the in-world day count ("Day 47") and a log of how
-- it moved ([{ from, to, note, at }], newest last). Quests and party
-- goals can have a deadline: the day they're due.
create table if not exists campaign_calendar (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references campaigns(id) on delete cascade,
  day integer not null default 1 check (day >= 1),
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table campaign_calendar enable row level security;
drop policy if exists "anon full access campaign_calendar" on campaign_calendar;
create policy "anon full access campaign_calendar" on campaign_calendar
  for all to anon using (true) with check (true);
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_calendar'
  ) then
    alter publication supabase_realtime add table public.campaign_calendar;
  end if;
end $$;

alter table quests      add column if not exists due_day integer;
alter table party_goals add column if not exists due_day integer;
alter table personal_goals add column if not exists due_day integer;

-- ── Each DM's own notes ──────────────────────────────────────────────
-- A campaign can have several DMs; each one's private NPCs, creatures,
-- maps and art are theirs alone (dm_id). Players still see whatever any
-- DM reveals. Rows from before this go to the campaign's first DM (or,
-- with no DM, its creator). The admin sees everything.
do $$
declare
  t text;
begin
  foreach t in array array['dm_npcs', 'dm_creatures', 'dm_maps', 'campaign_art'] loop
    execute format('alter table %I add column if not exists dm_id uuid references players(id) on delete set null', t);
    execute format(
      'update %I x set dm_id = coalesce(
         (select m.player_id from campaign_members m
           where m.campaign_id = x.campaign_id and m.role = ''dm''
           order by m.created_at limit 1),
         (select c.created_by from campaigns c where c.id = x.campaign_id))
       where x.dm_id is null', t);
    execute format('create index if not exists %I on %I (campaign_id, dm_id)', t || '_dm_idx', t);
  end loop;
end $$;
