# Adventurer's Log

A D&D campaign companion for playing at the table and planning between
sessions, built with React and SCSS on Supabase.

## Companion layout

Inside a campaign, everything is grouped into five areas — a bottom bar on
phones, a grouped sidebar on wider screens:

- **Home** — Start/Resume Session, your character at a glance, next session
  date, quick capture (note / NPC / location / quest / clue / recap), open
  threads (active quests and party goals), recent sessions and entries, and
  a JSON backup export.
- **Session** — *Session Mode*: HP with damage/heal/undo and temp HP, AC,
  initiative, speed, proficiency, passive Perception, conditions,
  exhaustion, concentration, death saves, spell slots, limited-use
  resources, short/long rests; timestamped quick notes that turn into NPC /
  location / quest / clue / lore / loot entries without retyping; an
  initiative tracker; a reference drawer (spells, inventory, skills,
  roleplay notes); and End Session, which pre-fills a recap from the
  session's quick notes. Plus the existing *Tools*.
- **Journal** — Session Notes, Timeline, NPCs, Maps & Places, Quests, Loot,
  Lore & Clues and custom tabs. Every NPC / quest / place / lore / loot card
  has **Links**: a detail view of everything related (links you add, and
  sessions whose recap tags it), where you can add or remove links.
- **Character** — an autosaved character sheet with mechanics (ability
  scores → modifiers, saves, skills with proficiency/expertise, spell DC and
  attack, spell slots, resources, inventory) kept separate from roleplay
  (public persona vs. private thoughts, voice lines, dialogue guidance,
  personality, relationships, optional quirks, development log), a
  quick-reference card and a roleplay assistant. Plus Spells and Party.
- **Prep** — last session's recap, open threads, NPCs/places that came up
  recently, next session date, and your own lists (objectives, questions for
  the DM, things to prepare, checklist) — each item can link to an entry.

**Search** (the bar at the top, or ⌘/Ctrl+K) covers NPCs, places, quests,
lore & clues, loot, sessions, quick notes, party and goals, with type
filters, sorting, typo-tolerant matching and keyboard navigation.

Nothing is invented: stats you haven't entered show "—" with a pointer to
the sheet. For a character named Seiya, the Roleplay page offers to fill
empty fields from her character brief (see `src/lib/seiya.js`; no Seiya
files were found in this repo, so relationships, ideals and bonds are left
for the player).

### Import from D&D Beyond

On the Character screen, **Import from D&D Beyond** fills the sheet from a
D&D Beyond character. Players set the character's privacy to *Public*,
paste its link, check a preview and choose which parts to import (ability
scores/saves/skills, HP/AC/speed, spell slots, features, resources,
inventory, roleplay text — which only fills empty fields — plus the Party
roster's race/class/level and the Spells list).

The link is fetched by `api/ddb-character.js`, a Vercel Function (D&D
Beyond doesn't let browsers on other sites call it directly); `npm run dev`
serves the same handler locally. It uses D&D Beyond's **unofficial**
character service, which can change or block access at any time — if the
link route stops working, the dialog's *Upload a file instead* option
reads the same data from a saved file. Conversion lives in
`src/lib/ddbImport.js`; derived values such as AC are calculated and
flagged for the player to double-check.

### Roleplay assistant

The app has no AI model built in, and model keys must never ship in client
code. Set `VITE_ROLEPLAY_ASSISTANT_URL` to a server endpoint (for example a
Supabase Edge Function that holds the key) to enable suggestions — the
request/response contract is documented in `src/lib/roleplayAssistant.js`.
Without it the assistant says so plainly and offers **Copy prompt**, built
only from the character's recorded notes, for use in any assistant.

## Original features

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
- `npm test` — run the unit tests (Vitest) for search, character rules,
  initiative, recap building and the roleplay helpers

## Upgrading an existing database

The companion features add four tables — `character_sheets`,
`quick_notes`, `entity_links` and `session_prep` — at the end of
`supabase/schema.sql` (self-contained, idempotent). Re-run the whole file,
or just that last block. Until it's run, the rest of the app keeps working
and those screens explain what's missing instead of failing.

Per-device state that isn't campaign content — the open campaign and tab,
whether a session is in progress, the current initiative order, unsent
quick-note drafts — lives in `localStorage`.
