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
  role text not null default 'player' check (role in ('creator','player')),
  created_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

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

create table if not exists custom_tab_entries (
  id uuid primary key default gen_random_uuid(),
  custom_tab_id uuid not null references custom_tabs(id) on delete cascade,
  title text not null,
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
alter table npcs               enable row level security;
alter table loot                enable row level security;
alter table quests              enable row level security;
alter table party_members       enable row level security;
alter table party_goals         enable row level security;
alter table party_notes         enable row level security;
alter table spells              enable row level security;
alter table player_wallets      enable row level security;
alter table session_notes       enable row level security;
alter table lore_entries        enable row level security;
alter table custom_tabs         enable row level security;
alter table custom_tab_entries  enable row level security;
alter table campaign_members    enable row level security;

-- players: RLS enabled, but INTENTIONALLY no policy of any kind — this is
-- what blocks the anon role from reading password_hash. All access goes
-- through the SECURITY DEFINER functions below. Do not add a policy here.
alter table players enable row level security;

drop policy if exists "anon full access campaigns"          on campaigns;
drop policy if exists "anon full access maps"               on maps;
drop policy if exists "anon full access npcs"               on npcs;
drop policy if exists "anon full access loot"               on loot;
drop policy if exists "anon full access quests"             on quests;
drop policy if exists "anon full access party_members"      on party_members;
drop policy if exists "anon full access party_goals"        on party_goals;
drop policy if exists "anon full access party_notes"        on party_notes;
drop policy if exists "anon full access spells"             on spells;
drop policy if exists "anon full access player_wallets"     on player_wallets;
drop policy if exists "anon full access session_notes"      on session_notes;
drop policy if exists "anon full access lore_entries"       on lore_entries;
drop policy if exists "anon full access custom_tabs"        on custom_tabs;
drop policy if exists "anon full access custom_tab_entries" on custom_tab_entries;
drop policy if exists "anon full access campaign_members"    on campaign_members;

create policy "anon full access campaigns"          on campaigns          for all to anon using (true) with check (true);
create policy "anon full access maps"               on maps               for all to anon using (true) with check (true);
create policy "anon full access npcs"               on npcs               for all to anon using (true) with check (true);
create policy "anon full access loot"               on loot               for all to anon using (true) with check (true);
create policy "anon full access quests"             on quests             for all to anon using (true) with check (true);
create policy "anon full access party_members"      on party_members      for all to anon using (true) with check (true);
create policy "anon full access party_goals"        on party_goals        for all to anon using (true) with check (true);
create policy "anon full access party_notes"        on party_notes        for all to anon using (true) with check (true);
create policy "anon full access spells"              on spells             for all to anon using (true) with check (true);
create policy "anon full access player_wallets"     on player_wallets     for all to anon using (true) with check (true);
create policy "anon full access session_notes"      on session_notes      for all to anon using (true) with check (true);
create policy "anon full access lore_entries"       on lore_entries       for all to anon using (true) with check (true);
create policy "anon full access custom_tabs"        on custom_tabs        for all to anon using (true) with check (true);
create policy "anon full access custom_tab_entries" on custom_tab_entries for all to anon using (true) with check (true);
create policy "anon full access campaign_members"   on campaign_members   for all to anon using (true) with check (true);

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
