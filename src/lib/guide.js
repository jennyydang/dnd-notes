// The in-app guide (AppGuide.jsx): how to use every part of the app.
// Each section has topics; `for` is 'player', 'dm' or 'all' (default), on
// a section or a single topic. Text can use **bold** and `keys`. Button
// names are quoted as they appear on screen — keep them in step.

export const GUIDE = [
  {
    id: 'start',
    title: 'Getting started',
    icon: 'compass',
    intro:
      'Adventurer’s Log is your party’s shared campaign notebook. Everyone in a campaign sees the same NPCs, places, quests, loot and lore, live. Your session recaps, quick notes, prep and personal goals stay private to you.',
    topics: [
      {
        title: 'Create or join a campaign',
        where: 'Your Campaigns',
        steps: [
          'Tap **+ Campaign**.',
          '**New Campaign**: add a cover, name and description, then **Create Campaign**.',
          '**Join Existing**: type the **Join Code** the campaign’s creator gives you, then **Join**.',
          'Or open an invite link someone sent you, and tap **Join campaign**.',
          'Tap a campaign’s card to open it.',
        ],
        tips: [
          'The creator (or DM) of a campaign gets **Edit**, **Members**, **Archive** and **Delete** on its card. **Members** shows the join code and lets them remove someone.',
          '**Show archived** brings archived campaigns back into view.',
        ],
      },
      {
        title: 'Find your way around',
        where: 'Inside a campaign',
        steps: [
          'Players’ screens are grouped into **Home**, **Session**, **Journal**, **Character** and **Prep**: the sidebar on a computer or tablet, the bar along the bottom on a phone. A DM gets their own menu (see **For the DM**).',
          'A group with several screens shows them as a row of pills along the top.',
          '**← Campaigns** goes back to your campaign list. The app remembers the last screen you had open in each campaign.',
        ],
      },
      {
        title: 'Search everything',
        where: 'The search box at the top',
        for: 'player',
        steps: [
          'Click **Search NPCs, places, quests, notes…**, or press `⌘K` / `Ctrl+K` anywhere in a campaign.',
          'Type part of a name or anything from the notes; spelling mistakes are forgiven. Filter by type, or change **Sort** (Best match, Newest, A → Z).',
          'Use `↑` `↓` and `Enter` (or tap) to open a result. Screens show up too (“Go to Quests”), and **+ Create “…”** makes a new NPC with that name.',
        ],
      },
      {
        title: 'Your account and settings',
        where: 'Your initial or picture, top right',
        steps: [
          '**Account**: change your username, name, email or password (your current password is needed to save).',
          '**Profile picture**: upload and crop a photo. The party sees it on your face in the “here now” row.',
          '**Settings**: background (or upload your own), moving background (Embers & Fog, Fog Only, Off), font, text size, and the **AI Assistant** connection. **Reset to Defaults** undoes it all.',
          '**App guide** opens this guide. **Send Feedback** reaches the app’s maker; tick **Tell me when it’s solved** and the reply arrives in your bell.',
        ],
      },
    ],
  },
  {
    id: 'home',
    title: 'Home',
    icon: 'home',
    for: 'player',
    topics: [
      {
        title: 'What Home shows',
        where: 'Home',
        steps: [
          '**Start Session** (or **Resume Session**) and the next session date (set it in Prep).',
          '**Previously on…** opens last session’s recap to read out, with **Read it aloud**.',
          'The party’s goals with their progress rings (**All goals →**), your character’s HP and AC, **Quick add**, **Last session**, **Open threads** and **Recently added**.',
          'When the DM has revealed something new, a banner says so; **View →** opens the bell.',
        ],
      },
      {
        title: 'Quick add',
        where: 'Home → Quick add',
        steps: [
          'Type in **Jot a quick note…** and press **Save**.',
          'Or tap **NPC**, **Location**, **Quest**, **Clue** or **Session recap** to start that entry straight away.',
        ],
      },
      {
        title: 'In-world calendar and deadlines',
        where: 'Home → Day',
        steps: [
          'Tap **+1 day** after a long rest.',
          'Tap **Day N** itself for travel or downtime: pick **1 day**, **3 days**, **A week** or any number, add what happened (“Kingsroad to Palomerie”), then **Move to day N**.',
          'Give quests and goals a deadline (“Due in 4 days”) in their edit form. Their badges count down as the days pass: “3 days left”, “Due today”, “Overdue by 2 days”.',
        ],
        tips: ['The whole party shares one calendar; the Day window lists its history and what’s coming due.', 'You can go back a few days to fix a mistake.'],
      },
      {
        title: 'Back up the campaign',
        where: 'Home → bottom of the page',
        steps: ['**Export campaign backup (JSON)** downloads everything in the campaign as one file.'],
      },
    ],
  },
  {
    id: 'session',
    title: 'Playing a session',
    icon: 'dice',
    for: 'player',
    intro: 'Session Mode keeps everything you need at the table on one screen.',
    topics: [
      {
        title: 'Start, pause and end',
        where: 'Session → Session Mode',
        steps: [
          '**Start session** (or **Start Session** on Home). If there’s a past session, the “Previously on…” card opens first; tap **Begin session**.',
          '**Pause** / **Resume** as needed. While a session runs, a session dock follows you to other screens with a note box and quick-add buttons.',
          '**■ End session** opens your recap, already filled in from this session’s quick notes. Tidy it and tap **Save recap & end**, or **End without recap**.',
        ],
      },
      {
        title: 'Your character in play',
        where: 'Session Mode → Character',
        steps: [
          'Type an amount and tap **− Damage** or **+ Heal**; **Undo** puts it back. Temp HP is used up first.',
          'At 0 HP, track **Death saves**; the edges of your screen pulse red until you’re back up.',
          'Track concentration (**On which spell?**), conditions, exhaustion, spell slots (◆ tap to spend, ◇ tap to restore) and resources.',
          '**Short rest** and **Long rest** restore what they should.',
        ],
        tips: ['Stats come from your Character Sheet; anything missing shows “—”.'],
      },
      {
        title: 'Quick notes',
        where: 'Session Mode → Notes',
        steps: [
          'Type in **What just happened? (Enter to save)**; each note is timestamped.',
          'Use tags (see **Session notes & tags**) to link people, places and items as you write.',
          '**Make entry ▾** turns a note into an NPC, location, quest, clue, lore or loot entry without retyping it.',
        ],
      },
      {
        title: 'Record the session',
        where: 'Session Mode → Record audio',
        steps: [
          'Tap **Record audio**. A recording bar stays on screen wherever you go.',
          'Tap **Mark** at big moments; bookmarks appear in the session’s highlight reel and jump the recording to that point.',
          'The recording is attached to your recap when you end the session.',
        ],
      },
      {
        title: 'Party votes',
        where: 'Session Mode → Vote',
        steps: [
          '**+ New vote**: a question and choices, then **Start vote**. The DM can start votes too.',
          'When a vote opens, “The party is voting” pops up wherever you are. Tap a choice.',
          'The vote’s creator (or the DM) can **Close vote** to show the result.',
        ],
      },
      {
        title: 'Initiative and your turn',
        where: 'Anywhere in the app',
        steps: [
          'When the DM calls for initiative, your screen shakes with **Roll for initiative!** and the app turns red.',
          'Tap **Roll for me** to roll with your bonus, or roll real dice and tell the DM.',
          '**You’re up next** warns you a turn ahead, and **Your turn** shows when it’s yours. Phones buzz too.',
        ],
        tips: ['The ⚔ Round badge at the top reopens the roll prompt until you’ve rolled.'],
      },
      {
        title: 'Look things up',
        where: 'Session Mode → Reference',
        steps: ['Your spells, inventory, skills and roleplay notes, without leaving the table screen.'],
      },
    ],
  },
  {
    id: 'notes',
    title: 'Session notes & tags',
    icon: 'book',
    for: 'player',
    topics: [
      {
        title: 'Write a recap',
        where: 'Journal → Session Notes',
        steps: [
          'Tap **+ Add Session Notes**, give it a title and date, and write what happened.',
          '`Return` starts a new paragraph; `Shift+Return` starts a new line in the same paragraph.',
          'Start a line with `- ` or `•` for a bullet list, or use the toolbar.',
        ],
        tips: ['Recaps are private to you.'],
      },
      {
        title: 'Tags',
        where: 'Recaps and quick notes',
        steps: [
          'Type a symbol and pick from the list, or choose **+ New …** to create the entry on the spot:',
          '`@` people · `#` places (`#city`, `#dungeon`…) · `~` lore, factions and clues · `$` loot · `%` creatures · `!event` timeline events.',
          'A tag becomes a chip; tap it to open the entry. A session lists its tags under People Met, Places Visited, Lore, Loot Found, Creatures and Events.',
        ],
        tips: [
          'Tags connect your notes: they power the Timeline, Connections, World Wiki, Prep’s “Came up recently” and each entry’s links.',
        ],
      },
      {
        title: 'Recording and highlight reel',
        where: 'Journal → Session Notes → a session',
        steps: [
          'Play the session’s recording, or tap a bookmark (“Play from 12:40”). **Record**, **Mark** and **Upload audio** work here too.',
          'The **Highlight reel** walks through who you met, where you went, what you found and decided. Tap **Play**, or tap a moment to open it.',
        ],
      },
      {
        title: 'Export',
        where: 'Journal → Session Notes',
        steps: [
          '**Export** one session or **Export all**.',
          'Choose **Copy as text**, **Copy formatted**, **Download for Word**, **Save as PDF** or **Download text file**.',
          'Tick the box to add a list of everyone and everything tagged.',
        ],
      },
    ],
  },
  {
    id: 'world',
    title: 'The world: NPCs, places & more',
    icon: 'users',
    for: 'player',
    intro: 'These lists are shared by the whole party; changes show up on everyone’s screen within a moment.',
    topics: [
      {
        title: 'NPCs',
        where: 'Journal → NPCs',
        steps: [
          '**+ Add NPC**: portrait, name, race, where you met them, life status (Alive, Deceased, Unknown, Missing) and a description.',
          'Tap **+ Rapport** (or the current one, like “● Wary”) to record how they feel about the party, from Hostile to Ally, and why. The history is kept.',
        ],
      },
      {
        title: 'Creatures',
        where: 'Journal → Creatures',
        steps: [
          '**+ Add Creature**: name, type (pick from the list or type your own), where you met it, notes, and **Add photos** (several at once).',
          'Tap the cover picture to see every photo full size.',
        ],
      },
      {
        title: 'Maps & places',
        where: 'Journal → Maps & Places',
        steps: [
          '**+ Add Map Image**, then **Set as Interactive Map** to play on it.',
          'Drag **Pin** (or **Zoom area**) from the tray onto the map. Give a pin a type (Event, Town, Dungeon, Quest, Danger), a photo and a linked NPC, place, quest or lore entry. Filter pins by type.',
          'Drag **Party** onto the map and move it as you travel. **Show journey** draws the trail; **Undo last move** and **Clear trail** fix it.',
          'Press and hold a spot to ping it for everyone looking at the map.',
          '**+ Add Place** keeps a list of places; **Show on map** jumps to a pinned one.',
        ],
      },
      {
        title: 'Quests',
        where: 'Journal → Quests',
        steps: [
          '**+ Add Quest**: name, who gave it, status, an optional deadline and notes.',
          'Drag a quest between **Rumours**, **Active** and **Done** (long-press first on a touch screen), or use the arrow buttons. Mark it Failed from **Edit**.',
        ],
      },
      {
        title: 'Loot',
        where: 'Journal → Loot',
        steps: [
          '**+ Add Loot** with a picture, kind, quantity, where it was found and who holds it.',
          'Switch between holders (**Everyone**, each person, **Unclaimed**) and sort by **Newest** or **A → Z**.',
          '**Use** a usable item; for a stack, choose how many.',
        ],
      },
      {
        title: 'Lore, clues and factions',
        where: 'Journal → Lore & Clues',
        steps: [
          '**+ Add Lore**: history, religions, factions and clues.',
          'Give an entry the **Faction** category and its card gets a standing track. Tap **+ Standing** to set where the party stands, from Hated to Revered, and why.',
        ],
      },
      {
        title: 'Art',
        where: 'Journal → Art',
        steps: ['Art the DM has shared with the table: portraits, scenes and handouts. Tap one to view it full size.'],
      },
      {
        title: 'Custom tabs',
        where: 'Journal',
        steps: [
          'Extra tabs in the Journal (a lock means private) hold simple entries: **+ Add Entry**, **Edit**, **Delete**.',
          '**Rename Tab** and **Delete Tab** are inside the tab.',
        ],
      },
      {
        title: 'Links between entries',
        where: 'Open any entry',
        steps: [
          'Opening an entry shows everything related to it: links you’ve added, and sessions whose recap tags it.',
          '**Add a link** (“Works for”, “Lives in”…) and **Save link**. **Open in …** takes you to its tab.',
        ],
      },
    ],
  },
  {
    id: 'big-picture',
    title: 'Wiki, timeline & connections',
    icon: 'library',
    topics: [
      {
        title: 'World Wiki',
        where: 'Prep → World Wiki (DM: World Wiki)',
        steps: [
          'Every NPC, place, lore entry, item, creature and quest as a wiki article, A–Z, with search and type filters.',
          'An article shows its facts, what’s written about it, **First noted in** which session, and every recap and quick note that mentions it, with the lines around it.',
          'Tap a connection at the bottom to jump to that article, or **Open entry** to edit it.',
        ],
        tips: ['It reads your own recaps and quick notes, so the more you tag, the richer it gets.'],
      },
      {
        title: 'Timeline',
        where: 'Journal → Timeline',
        for: 'player',
        steps: [
          'The story so far, built from the `!event` tags in your recaps, session by session.',
          '**↑ Earlier** and **Later ↓** move through it.',
        ],
      },
      {
        title: 'Connections',
        where: 'Journal → Connections',
        for: 'player',
        steps: [
          'A web of how the party, NPCs, places, factions, quests, loot and creatures connect, from your links and tags.',
          'Search, or filter by type. Drag to pan, pinch or scroll to zoom, and **Fit everything** to see it all.',
          'Tap a dot to highlight its connections; **Open** goes to the entry.',
        ],
      },
    ],
  },
  {
    id: 'character',
    title: 'Character & party',
    icon: 'character',
    for: 'player',
    topics: [
      {
        title: 'Character sheet',
        where: 'Character → Character Sheet',
        steps: [
          'Claim your character on the Party screen first.',
          '**Mechanics**: ability scores, saves, skills, spellcasting and resources. Modifiers work themselves out.',
          '**Roleplay**: identity, public persona and private thoughts, voice, personality, relationships, quirks.',
          '**Quick reference** sums it up for the table. Everything saves as you type.',
        ],
      },
      {
        title: 'Import from D&D Beyond',
        where: 'Character Sheet → Import from D&D Beyond',
        steps: [
          'Set your D&D Beyond character to **Public**, paste its link and tap **Import**.',
          'If that doesn’t work, use **Upload a file instead** (or paste the text).',
          'Pick what to bring in, then **Import selected**.',
        ],
        tips: ['Double-check values the app had to calculate, such as AC.'],
      },
      {
        title: 'Roleplay assistant',
        where: 'Character Sheet → Assistant',
        steps: [
          'Describe what’s happening, pick a tone, and tap **Suggest reactions** for in-character ideas based on your notes.',
          'Connect your own Claude or ChatGPT account in **Settings → AI Assistant** (kept on your device only), or use **Copy prompt** to paste into any assistant.',
        ],
      },
      {
        title: 'Spells',
        where: 'Character → Spells',
        steps: ['**+ Add Spell**, switch between **Cantrips** and **Spells**, and tap a spell’s icon for its full text.'],
      },
      {
        title: 'Party and goals',
        where: 'Character → Party',
        steps: [
          '**+ Add Party Member** (a player’s character or an NPC companion). **Claim this character** links it to you.',
          '**Party Goals** are shared: tick a goal off when it’s done, and break it into subtasks.',
          '**My Goals** are private to you.',
        ],
        tips: ['When the DM levels the party up, your screen celebrates; everyone else sees a banner.'],
      },
    ],
  },
  {
    id: 'prep',
    title: 'Session prep',
    icon: 'prep',
    for: 'player',
    topics: [
      {
        title: 'Get ready for next session',
        where: 'Prep → Session Prep',
        steps: [
          'Set the **Next session** date; Home shows it.',
          'Read last session’s recap, the **Open threads** (tap ＋ to make one an objective), and who **Came up recently**.',
          'Keep your own lists: planned scenes and objectives, questions for the DM, items and abilities to prepare, and a checklist. Each item can link to an entry.',
        ],
        tips: ['Prep is private to you and saves as you type.'],
      },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    icon: 'tools',
    topics: [
      {
        title: 'Money',
        where: 'Session → Tools',
        for: 'player',
        steps: [
          '**Money Tracker**: enter your coins and **Save**. **Buy or Sell Something** with **Spend** or **Earn**.',
          'The **Currency Calculator** converts between platinum, gold, silver, shillings and copper.',
        ],
      },
      {
        title: 'Shards',
        where: 'Session → Tools',
        for: 'player',
        steps: ['**Your Shards** shows how many your DM has given you. When the DM gives or takes some, a gem pops up on your screen.'],
      },
      {
        title: 'Team generator',
        where: 'Tools',
        steps: ['Add names (or **Use party**), pick how many teams, and **Generate Teams**. **Reshuffle** for a new split.'],
      },
    ],
  },
  {
    id: 'together',
    title: 'Playing together',
    icon: 'users',
    topics: [
      {
        title: 'Who’s here',
        where: 'Faces at the top',
        steps: [
          'Everyone with the campaign open shows as a face in their own colour. Tap one to see who’s here and which page each is on.',
          'When others have your page open, a strip says “Aria and Bram are here too”.',
        ],
      },
      {
        title: 'Notifications',
        where: 'The bell, top right',
        for: 'player',
        steps: [
          'Revealed NPCs, creatures, maps and art from your DM land under **From your DM**, along with replies to your feedback.',
          'Tap **+ Add to …** to put it in the party’s list. It’s added once for everyone, and a tagged quick note is written for you.',
        ],
      },
      {
        title: 'Offline and syncing',
        where: 'Anywhere',
        steps: [
          'Install the app to your phone’s home screen; it opens without a connection and shows what you’ve already loaded.',
          'Changes made offline are saved on the device and sent when you reconnect. The top bar shows **Offline · N to sync**, **Syncing…**, or **N changes not saved** if something was turned down.',
        ],
      },
      {
        title: 'Phone gestures',
        where: 'On a phone',
        steps: [
          'Swipe a card left for its **Edit** and **Delete**.',
          'Pull down at the top of the page to refresh.',
          'Pinch to zoom maps; press and hold a quest to drag it.',
        ],
      },
    ],
  },
  {
    id: 'dm',
    title: 'For the DM',
    icon: 'eye',
    for: 'dm',
    intro:
      'A DM gets their own menu: Overview, World Wiki, Players, NPCs, Creatures, Art, Maps, Combat and Tools. Everything you write there is private until you reveal it — a campaign can have several DMs, and each one’s notes are their own.',
    topics: [
      {
        title: 'Switch between DM and player view',
        where: 'DM | Player switch, top bar',
        steps: [
          'If you DM and also play, tap **Player** to see the campaign as your character: Home, Session, Journal, Character and Prep, just like the rest of the party.',
          'Tap **DM** to go back to your private notes and DM tools. The app remembers which view you were in for each campaign.',
        ],
      },
      {
        title: 'Invite players',
        where: 'Players',
        steps: [
          '**Invite players**, optionally say who it’s for, then **Create invite link**. **Copy link** or **Share** it. It works once and lasts 30 days.',
          'See each player and their characters. **Remove from campaign** takes someone out (their account stays).',
        ],
      },
      {
        title: 'Prepare NPCs, creatures, maps and art',
        where: 'NPCs · Creatures · Art · Maps',
        steps: [
          'Write them up ahead of time. **DM only** notes are never shown to players.',
          'When the party meets one, tap **Reveal now**: it pops up full screen on every player’s device and lands in their bell to add.',
          'Revealed cards grey out so you can see what’s still to come. The tag shows **Sent — waiting for a player to add** or **✓ In players’ …**.',
        ],
      },
      {
        title: 'Run combat',
        where: 'Combat',
        steps: [
          'Pick the dice (d20 by default; Normal, Advantage or Disadvantage) and tap **Call for initiative!**. Every player gets the roll prompt and the app turns red.',
          'Add monsters (name, initiative, HP, **Add**) and party members (**+ name**). The order sorts itself; drag rows to break ties.',
          'Give a combatant a condition with a number of rounds; it counts down on their turn.',
          '**Start combat**, **Next turn**, then **End combat**.',
        ],
        tips: ['**Level up the party** (or selected members) plays the level-up celebration for everyone.'],
      },
      {
        title: 'Votes and shards',
        where: 'Tools',
        steps: [
          '**+ New vote** starts a party vote; players answer from any screen. **Close vote** shows the result.',
          '**Player Shards**: give or take shards per player with − and +. Each player gets an animated alert.',
        ],
      },
      {
        title: 'Follow what the party knows',
        where: 'Overview · World Wiki',
        steps: [
          '**Overview** shows what the party is chasing, the rumours they’ve heard, who’s with them, faction standing and their goals.',
          '**World Wiki** shows every entry the party has written about the world.',
        ],
      },
    ],
  },
]
