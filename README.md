# Adventurer's Log

A D&D campaign notes app built with React and SCSS. Start at a dashboard
listing your campaigns — create, edit, archive, or delete them — and open
one to get its own Adventurer's Log with seven tabs:

- **Maps** — upload and browse map images shared by your DM, with a
  full-size lightbox view.
- **Lore** — world history, locations, deities, and organizations, each
  with a title, category, and notes.
- **Party** — roster of who's adventuring together, tagged as a Player
  or an NPC companion, with race/class, a photo, and notes (for Players,
  also tracks the real person playing them).
- **NPCs** — track name, race, where you met them, life status
  (Alive / Deceased / Unknown / Missing), and a photo.
- **Loot** — log items, where you found them, who currently holds them,
  and free-form notes.
- **Quests** — track quest name, who gave it, status
  (Active / Completed / Failed), and notes.
- **Session Notes** — a recap log of each game session (title, date, and
  notes), newest first.

Data is stored in [Supabase](https://supabase.com) (Postgres + Storage),
so your whole party can share one set of notes from any browser.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to the **SQL Editor**, paste the contents
   of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This
   creates the `campaigns` table plus `maps`, `npcs`, `loot`, `quests`,
   `party_members`, `session_notes`, and `lore_entries` (each scoped to a
   campaign via `campaign_id`), and the `maps`, `npc-portraits`,
   `party-portraits`, and `campaign-covers` storage buckets. It's safe to
   re-run the whole file any time — every statement is idempotent. If
   you're upgrading a database that already had data before campaigns
   existed, this script automatically creates a "My Campaign" entry and
   moves all existing rows into it, so nothing is lost.
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

### A note on access

This app has **no login** — it's built for a small group sharing one
private link, so anyone with the app URL can read and write all the
data. The Supabase policies grant the public `anon` key full access on
purpose. Don't post the app URL somewhere public, and don't reuse this
setup for anything that needs real access control.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run preview` — preview the production build
- `npm run lint` — run Oxlint
