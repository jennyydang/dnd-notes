-- ═════════════════════════════════════════════════════════════════════
-- Security, part 1 of 2: real logins
-- Safe to run any time, and again: it only adds things, so the app keeps
-- working as it is. Run it BEFORE deploying the app update that signs
-- players in, then run part 2 (security-2-lockdown.sql) after.
--
-- Every player gets a Supabase login with the same id and password as
-- their account (passwords are already bcrypt, which Supabase Auth
-- reads), kept in step automatically when an account is made, changes
-- its password or is deleted. The admin gets one too. Players still log
-- in with their username: the app looks up their id, then signs in.
-- The emails on these logins (u-<id>@players.example.com) are internal
-- and never receive mail. Works on Supabase's Free plan.
-- ═════════════════════════════════════════════════════════════════════

-- ── The admin password ──────────────────────────────────────────────
-- Stored hashed in a table nothing can read directly, instead of written
-- in this (public) file. It starts as the old password; change it in the
-- admin dashboard (it warns until you do).
create table if not exists app_admin (
  id integer primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table app_admin enable row level security;
insert into app_admin (password_hash)
values (extensions.crypt('dndrules', extensions.gen_salt('bf', 8)))
on conflict (id) do nothing;

create or replace function check_admin_password(p_password text)
returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce((select password_hash = extensions.crypt(coalesce(p_password, ''), password_hash) from app_admin where id = 1), false);
$$;

-- The admin's login id, and the internal email every login uses.
create or replace function admin_user_id()
returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-00000000ad01'::uuid $$;

create or replace function auth_email(p_id uuid)
returns text
language sql immutable as $$ select 'u-' || p_id::text || '@players.example.com' $$;

-- Creates or updates the Supabase login for an id, with a bcrypt hash.
create or replace function sync_auth_user(p_id uuid, p_password_hash text)
returns void
language plpgsql security definer set search_path = public, auth, extensions, pg_temp as $$
declare
  v_email text := auth_email(p_id);
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', v_email, p_password_hash, now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  )
  on conflict (id) do update set encrypted_password = excluded.encrypted_password, email = excluded.email, updated_at = now();

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;
end;
$$;
-- Never callable from the app: it would let anyone set any password.
revoke execute on function sync_auth_user(uuid, text) from public, anon, authenticated;

create or replace function players_sync_auth()
returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    delete from auth.users where id = old.id;
    return old;
  end if;
  perform sync_auth_user(new.id, new.password_hash);
  return new;
end;
$$;
revoke execute on function players_sync_auth() from public, anon, authenticated;
drop trigger if exists players_sync_auth on players;
create trigger players_sync_auth
  after insert or update of password_hash or delete on players
  for each row execute function players_sync_auth();

-- Logins for everyone who already has an account, and for the admin.
select sync_auth_user(id, password_hash) from players;
select sync_auth_user(admin_user_id(), password_hash) from app_admin where id = 1;

-- Changing the admin password (from the admin dashboard).
create or replace function change_admin_password(p_current text, p_new text)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_hash text;
begin
  if not check_admin_password(p_current) then
    raise exception 'The current admin password isn’t right';
  end if;
  if length(coalesce(p_new, '')) < 10 then
    raise exception 'Use at least 10 characters for the admin password';
  end if;
  v_hash := extensions.crypt(p_new, extensions.gen_salt('bf', 8));
  update app_admin set password_hash = v_hash, updated_at = now() where id = 1;
  perform sync_auth_user(admin_user_id(), v_hash);
end;
$$;
grant execute on function change_admin_password(text, text) to anon, authenticated;

-- Whether the admin still uses the old password that was in the code.
create or replace function admin_password_is_default()
returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select case when auth.uid() = admin_user_id() then check_admin_password('dndrules') end;
$$;
grant execute on function admin_password_is_default() to authenticated;

-- ── Who may see what ─────────────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql stable as $$ select auth.uid() is not null and auth.uid() = admin_user_id() $$;

-- Is the signed-in player in this campaign (or the admin)?
create or replace function is_member(p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select is_admin() or exists (
    select 1 from campaign_members where campaign_id = p_campaign_id and player_id = auth.uid()
  );
$$;

-- The campaign a row belongs to, for tables keyed by a parent row.
create or replace function campaign_of_map(p_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select campaign_id from maps where id = p_id $$;
create or replace function campaign_of_tab(p_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select campaign_id from custom_tabs where id = p_id $$;
create or replace function campaign_of_party_member(p_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select campaign_id from party_members where id = p_id $$;
create or replace function campaign_of_share(p_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select campaign_id from dm_shares where id = p_id $$;
create or replace function campaign_of_session(p_id uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select campaign_id from session_notes where id = p_id $$;

-- ── Signed-in access ─────────────────────────────────────────────────
-- Added next to the old open ("anon") rules, which part 2 removes. A
-- campaign's data is for its members (and the admin) only.
do $$
declare t text;
begin
  foreach t in array array['maps', 'npcs', 'loot', 'places', 'quests', 'party_members', 'party_goals', 'spells', 'player_wallets', 'player_shards', 'session_notes', 'lore_entries', 'custom_tabs', 'character_sheets', 'quick_notes', 'entity_links', 'session_prep', 'creatures', 'dm_npcs', 'campaign_art', 'dm_maps', 'dm_shares', 'dm_creatures', 'encounters', 'polls', 'poll_votes', 'personal_goals', 'campaign_calendar', 'mysteries', 'theories', 'theory_votes', 'merchants', 'merchant_items', 'trades'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "members %1$s" on %1$I', t);
      execute format('create policy "members %1$s" on %1$I for all to authenticated using (is_member(campaign_id)) with check (is_member(campaign_id))', t);
    end if;
  end loop;
end $$;

drop policy if exists "members map_markers" on map_markers;
create policy "members map_markers" on map_markers for all to authenticated using (is_member(campaign_of_map(map_id))) with check (is_member(campaign_of_map(map_id)));
drop policy if exists "members map_pin_moves" on map_pin_moves;
create policy "members map_pin_moves" on map_pin_moves for all to authenticated using (is_member(campaign_of_map(map_id))) with check (is_member(campaign_of_map(map_id)));
drop policy if exists "members custom_tab_entries" on custom_tab_entries;
create policy "members custom_tab_entries" on custom_tab_entries for all to authenticated using (is_member(campaign_of_tab(custom_tab_id))) with check (is_member(campaign_of_tab(custom_tab_id)));
drop policy if exists "members party_notes" on party_notes;
create policy "members party_notes" on party_notes for all to authenticated using (is_member(campaign_of_party_member(party_member_id))) with check (is_member(campaign_of_party_member(party_member_id)));
drop policy if exists "members dm_share_dismissals" on dm_share_dismissals;
create policy "members dm_share_dismissals" on dm_share_dismissals for all to authenticated using (is_member(campaign_of_share(share_id))) with check (is_member(campaign_of_share(share_id)));
drop policy if exists "members session_transcripts" on session_transcripts;
create policy "members session_transcripts" on session_transcripts for all to authenticated using (is_member(campaign_of_session(session_id))) with check (is_member(campaign_of_session(session_id)));

-- Campaigns: members see them; the DM (or creator) and the admin change them.
drop policy if exists "members read campaigns" on campaigns;
drop policy if exists "dm changes campaigns" on campaigns;
drop policy if exists "dm deletes campaigns" on campaigns;
drop policy if exists "admin adds campaigns" on campaigns;
create policy "members read campaigns" on campaigns for select to authenticated using (is_member(id));
create policy "dm changes campaigns" on campaigns for update to authenticated using (is_admin() or is_campaign_dm(auth.uid(), id)) with check (is_admin() or is_campaign_dm(auth.uid(), id) or is_member(id));
create policy "dm deletes campaigns" on campaigns for delete to authenticated using (is_admin() or is_campaign_dm(auth.uid(), id));
create policy "admin adds campaigns" on campaigns for insert to authenticated with check (is_admin());

-- Memberships: members see who's in; the DM and admin add and change them;
-- anyone can leave.
drop policy if exists "members read memberships" on campaign_members;
drop policy if exists "dm adds members" on campaign_members;
drop policy if exists "dm changes members" on campaign_members;
drop policy if exists "dm or self removes members" on campaign_members;
create policy "members read memberships" on campaign_members for select to authenticated using (is_member(campaign_id));
create policy "dm adds members" on campaign_members for insert to authenticated with check (is_admin() or is_campaign_dm(auth.uid(), campaign_id));
create policy "dm changes members" on campaign_members for update to authenticated using (is_admin() or is_campaign_dm(auth.uid(), campaign_id));
create policy "dm or self removes members" on campaign_members for delete to authenticated using (is_admin() or player_id = auth.uid() or is_campaign_dm(auth.uid(), campaign_id));

-- Profile pictures: everyone signed in sees them; you change your own.
drop policy if exists "signed-in read profiles" on player_profiles;
drop policy if exists "own profile" on player_profiles;
create policy "signed-in read profiles" on player_profiles for select to authenticated using (true);
create policy "own profile" on player_profiles for all to authenticated using (player_id = auth.uid() or is_admin()) with check (player_id = auth.uid() or is_admin());

-- Notifications: yours to read and clear; anyone signed in can send one.
drop policy if exists "own notifications" on notifications;
drop policy if exists "send notifications" on notifications;
create policy "own notifications" on notifications for all to authenticated using (player_id = auth.uid() or is_admin()) with check (player_id = auth.uid() or is_admin());
create policy "send notifications" on notifications for insert to authenticated with check (true);

-- Feedback: anyone signed in sends it; only the admin reads it.
drop policy if exists "send feedback" on feedback;
drop policy if exists "admin reads feedback" on feedback;
create policy "send feedback" on feedback for insert to authenticated with check (true);
create policy "admin reads feedback" on feedback for all to authenticated using (is_admin()) with check (is_admin());

-- The admin's view of every membership.
grant select on campaign_memberships to authenticated;

-- Files: anyone signed in can add, change and remove them (pictures are
-- still shown by their public links).
drop policy if exists "signed-in files" on storage.objects;
create policy "signed-in files" on storage.objects for all to authenticated using (bucket_id in ('maps', 'npc-portraits', 'party-portraits', 'campaign-covers', 'map-marker-photos', 'player-backgrounds', 'campaign-art', 'loot-photos', 'player-avatars', 'session-audio', 'creature-photos')) with check (bucket_id in ('maps', 'npc-portraits', 'party-portraits', 'campaign-covers', 'map-marker-photos', 'player-backgrounds', 'campaign-art', 'loot-photos', 'player-avatars', 'session-audio', 'creature-photos'));

-- ── Admin functions check the stored admin password ────────────────
-- (They used to compare against the password written in the code.)
drop function if exists list_players(text);
create or replace function verify_admin_password(p_admin_password text)
returns boolean
language sql security definer set search_path = public, extensions, pg_temp as $$
  select check_admin_password(p_admin_password);
$$;
grant execute on function verify_admin_password(text) to anon;

create or replace function create_player(p_username text, p_password text, p_admin_password text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid;
begin
  if not check_admin_password(p_admin_password) then
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
  if not check_admin_password(p_admin_password) then
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
  if not check_admin_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;

  delete from players where id = p_player_id;
end;
$$;
grant execute on function delete_player(uuid, text) to anon;

create or replace function list_players(p_admin_password text)
returns table(id uuid, username text, display_name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not check_admin_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;
  return query
    select p.id, p.username, p.display_name, p.email, p.created_at from players p order by p.created_at;
end;
$$;
grant execute on function list_players(text) to anon;

create or replace function create_player_invite(p_admin_password text, p_campaign_id uuid, p_note text default '')
returns table(id uuid, token text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not check_admin_password(p_admin_password) then
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
  if not check_admin_password(p_admin_password) then
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
  if not check_admin_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;
  update player_invites set revoked_at = now() where id = p_invite_id and used_at is null and revoked_at is null;
end;
$$;
grant execute on function revoke_player_invite(text, uuid) to anon;

create or replace function list_password_reset_requests(p_admin_password text)
returns table(id uuid, player_id uuid, username text, display_name text, email text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not check_admin_password(p_admin_password) then
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
  if not check_admin_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;
  update password_reset_requests set handled_at = now() where id = p_request_id;
end;
$$;
grant execute on function dismiss_password_reset_request(text, uuid) to anon;

create or replace function create_password_reset(p_admin_password text, p_player_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  if not check_admin_password(p_admin_password) then
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

create or replace function delete_player_invite(p_admin_password text, p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not check_admin_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;
  delete from player_invites where id = p_invite_id;
end;
$$;
grant execute on function delete_player_invite(text, uuid) to anon;

notify pgrst, 'reload schema';
