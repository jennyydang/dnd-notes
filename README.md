# Adventurer's Log

A D&D campaign notes app built with React and SCSS. Players log in and see
a dashboard of just the campaigns they created or joined — create, edit,
archive, or delete the ones you created — and open one to get its own
Adventurer's Log with seven built-in tabs, in this order:

- **Session Notes** — a recap log of each game session (title, date, and
  notes), newest first.
- **Party** — roster of who's adventuring together, tagged as a Player
  or an NPC companion, with race/class, a photo, and notes (for Players,
  also tracks the real person playing them).
- **Maps** — upload and browse map images shared by your DM, with a
  full-size lightbox view.
- **Loot** — log items, where you found them, who currently holds them,
  and free-form notes.
- **Quests** — track quest name, who gave it, status
  (Active / Completed / Failed), and notes.
- **NPCs** — track name, race, where you met them, life status
  (Alive / Deceased / Unknown / Missing), and a photo.
- **Lore** — world history, locations, deities, and organizations, each
  with a title, category, and notes.

You can also add your own custom tabs (the **+** next to the built-in
tabs) — each one is a simple title + notes list, and can be renamed or
deleted later from within the tab itself.

Data is stored in [Supabase](https://supabase.com) (Postgres + Storage),
so your whole party can share one set of notes from any browser.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to the **SQL Editor**, paste the contents
   of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This
   creates the `campaigns` table plus `maps`, `npcs`, `loot`, `quests`,
   `party_members`, `session_notes`, `lore_entries`, `custom_tabs`,
   `custom_tab_entries`, `players`, and `campaign_members` (each of the
   first group scoped to a campaign via `campaign_id`), a
   `campaign_memberships` view, several login/join Postgres functions, and
   the `maps`, `npc-portraits`, `party-portraits`, and `campaign-covers`
   storage buckets. It's safe to re-run the whole file any time — every
   statement is idempotent. If you're upgrading a database that already
   had data before campaigns existed, this script automatically creates a
   "My Campaign" entry and moves all existing rows into it, so nothing is
   lost.
3. In **Project Settings → API**, copy the Project URL and the `anon`
   `public` key.
4. Copy `.env.example` to `.env` and fill in the two values:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Visit `/admin` on your deployed (or local) app and enter the admin
   password (`dndrules` — see below to change it) to create the first
   player account. Without at least one player account, the main app URL
   only shows a login screen with no way in.

### Logins and access model

- **Admin**: visiting `/admin` prompts for a password (`dndrules`,
  hardcoded in `supabase/schema.sql` — search that file for `dndrules`
  and replace both occurrences, then re-run the script, if you want to
  change it). The admin can create player accounts and sees every
  campaign, unrestricted.
- **Players**: created only by the admin — there's no self-signup. A
  player logs in at the normal app URL and sees a personal dashboard of
  just the campaigns they created or joined. Creating a campaign gives it
  a short join code to share with your group; anyone who enters that code
  is added as a member. The creator (or admin) can rename/archive/delete
  a campaign and manage its members; other members can fully edit tab
  content but don't see those campaign-management controls.
- **This is a lightweight login, not real database-level security.**
  Supabase's Row Level Security can only truly isolate individual users
  with its own built-in Auth system (real signed-in sessions), which this
  app doesn't use — everything still goes through one shared public
  `anon` key, same as before logins existed. In practice this means: the
  `players` table itself is locked down (no anon policies at all — the
  anon key can never read password hashes or dump usernames), but a
  technically sophisticated person with access to the deployed app could
  still bypass the login UI entirely and query campaign data directly.
  This is the same "small trusted group" tradeoff this app has always
  made, just now with proper accounts and personalized dashboards on top
  of it. Don't reuse the admin or player passwords anywhere sensitive.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run preview` — preview the production build
- `npm run lint` — run Oxlint
