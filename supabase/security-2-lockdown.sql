-- ═════════════════════════════════════════════════════════════════════
-- Security, part 2 of 2: lock it down
-- Run AFTER part 1 (security-1-accounts.sql) AND after the app update
-- that signs players in is live. From here on only signed-in players see
-- their own campaigns, and the admin sees everything; the public key on
-- its own can't read or change anything. Anyone with the app already open
-- is asked to log in again.
-- ═════════════════════════════════════════════════════════════════════

-- Remove the old open access ("anon full access …") everywhere.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname in ('public', 'storage') and 'anon' = any (roles)
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- The admin's membership list follows the same rules as its tables.
revoke select on campaign_memberships from anon;
alter view campaign_memberships set (security_invoker = true);

-- Functions that act for a player now check it's really them.
create or replace function assert_caller(p_player_id uuid)
returns void
language plpgsql stable as $$
begin
  if p_player_id is null or (p_player_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'Please log in again';
  end if;
end;
$$;

create or replace function is_campaign_dm(p_player_id uuid, p_campaign_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select is_admin() or (
    p_player_id = auth.uid() and (
      exists (
        select 1 from campaign_members
        where campaign_id = p_campaign_id and player_id = p_player_id and role in ('dm', 'creator')
      ) or exists (
        select 1 from campaigns where id = p_campaign_id and created_by = p_player_id
      )
    )
  );
$$;

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
  perform assert_caller(p_player_id);
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
  perform assert_caller(p_player_id);
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

create or replace function accept_player_invite(p_player_id uuid, p_token text)
returns table(campaign_id uuid, campaign_name text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
#variable_conflict use_column
declare
  v_invite player_invites%rowtype;
  v_added integer;
begin
  perform assert_caller(p_player_id);
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
  perform assert_caller(p_player_id);
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

create or replace function get_my_account(p_player_id uuid)
returns table(username text, display_name text, email_hint text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.username, p.display_name,
    case when p.email is null or p.email = '' then null
         else left(p.email, 1) || '•••' || substring(p.email from position('@' in p.email)) end
  from players p where p.id = p_player_id and (p.id = auth.uid() or is_admin());
$$;
grant execute on function get_my_account(uuid) to anon;

create or replace function list_campaign_members(p_campaign_id uuid)
returns table(membership_id uuid, player_id uuid, username text, role text)
language sql security definer set search_path = public, extensions, pg_temp as $$
  select cm.id, cm.player_id, p.username, cm.role
  from campaign_members cm
  join players p on p.id = cm.player_id
  where cm.campaign_id = p_campaign_id and is_member(p_campaign_id);
$$;
grant execute on function list_campaign_members(uuid) to anon;

create or replace function list_campaign_players(p_campaign_id uuid)
returns table(player_id uuid, username text, display_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select cm.player_id, p.username, p.display_name, cm.role, cm.created_at
  from campaign_members cm
  join players p on p.id = cm.player_id
  where cm.campaign_id = p_campaign_id and is_member(p_campaign_id)
  order by cm.role = 'player', lower(coalesce(nullif(p.display_name, ''), p.username));
$$;
grant execute on function list_campaign_players(uuid) to anon;

notify pgrst, 'reload schema';
