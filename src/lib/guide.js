// The in-app guide (AppGuide.jsx): how to use every part of the app.
// Each section has topics; `for` is 'player', 'dm' or 'all' (default).
// Text can use **bold** and `keys`.

export const GUIDE = [
  {
    id: 'start',
    title: 'Getting started',
    icon: 'compass',
    intro:
      'Adventurer’s Log is your party’s shared campaign notebook. Everyone in a campaign sees the same NPCs, places, quests and loot, live; your session recaps, quick notes and prep stay private to you.',
    topics: [
      {
        title: 'Create or join a campaign',
        where: 'Your campaign list',
        steps: [
          'To start one, create a new campaign and give it a name, description and cover picture. You become its creator.',
          'To join a friend’s, use **Join with a code** and type the code they give you, or open the invite link they send.',
          'Tap a campaign’s card to open it.',
        ],
        tips: ['Every card shows its join code, so the creator can read it out at the table.'],
      },
      {
        title: 'Find your way around',
        where: 'Inside a campaign',
        steps: [
          'Screens are grouped into **Home**, **Session**, **Journal**, **Character** and **Prep**: the sidebar on a computer or tablet, the bar along the bottom on a phone.',
          'An area with several screens shows them as a row of pills along the top.',
          'The app remembers the last screen you had open in each campaign.',
        ],
      },
      {
        title: 'Search everything',
        where: 'The search bar at the top',
        steps: [
          'Click the search bar, or press `⌘K` / `Ctrl+K` anywhere in a campaign.',
          'Type part of a name or anything from the notes. Spelling mistakes are forgiven.',
          'Filter by type, then use the arrow keys and `Enter` (or tap) to open a result.',
        ],
      },
      {
        title: 'Your account',
        where: 'Your initial or picture, top right',
        steps: [
          '**Account** changes your username or password.',
          '**Profile picture** adds a photo; the party sees it on your face in the “here now” row.',
          '**Settings** holds app preferences and your AI assistant connection.',
          '**App guide** opens this guide, and **Send Feedback** reaches the app’s maker.',
        ],
      },
    ],
  },
  {
    id: 'home',
    title: 'Home',
    icon: 'home',
    topics: [
      {
        title: 'What Home shows',
        where: 'Home',
        steps: [
          'Your campaign, the next session date (set it in Prep), and the in-world **Day** counter.',
          '**Start Session** (or **Resume Session**) takes you into Session Mode.',
          '**Previously on…** opens a recap card of last session to read aloud.',
          'Below: the party’s goals, your character at a glance, quick add, open threads, and recent sessions and entries.',
        ],
      },
      {
        title: 'Quick add',
        where: 'Home → Quick add',
        steps: [
          'Type a quick note and press **Save**, or tap **NPC**, **Location**, **Quest**, **Clue** or **Session recap** to start that entry straight away.',
        ],
      },
      {
        title: 'In-world calendar and deadlines',
        where: 'Home → Day',
        steps: [
          'Tap **+1 day** after a long rest.',
          'Tap the **Day** itself for travel or downtime: pick 1 day, 3 days, a week or any number, add what happened (“Kingsroad to Palomerie”), and move the calendar on.',
          'Quests and party goals can be given a deadline (“Due in 4 days”) in their edit form; their badges count down as the days pass: “3 days left”, “Due today”, “Overdue”.',
        ],
        tips: ['The whole party shares one calendar, and its history is listed in the Day window.', 'Going back a few days is allowed, for fixing mistakes.'],
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
        title: 'Start and end a session',
        where: 'Home → Start Session',
        steps: [
          '**Start Session** opens the “Previously on…” card; read it out, then begin.',
          'During play, Session Mode tracks your HP, conditions, spell slots and notes.',
          '**End Session** writes a recap draft from your quick notes for you to tidy up and save.',
        ],
      },
      {
        title: 'Hit points, conditions and rests',
        where: 'Session → Session Mode',
        steps: [
          'Enter an amount and tap damage or heal; undo puts it back. Temporary HP is used up first.',
          'Track conditions, exhaustion, concentration, death saves, spell slots and limited-use features.',
          'Short and long rests restore what they should.',
        ],
        tips: ['Stats come from your Character Sheet. Anything missing shows “—” with a link to fill it in.'],
      },
      {
        title: 'Quick notes',
        where: 'Session → Session Mode',
        steps: [
          'Jot notes as things happen; each is timestamped.',
          'Type a tag (see **Tags** below) to link a person, place or item as you write.',
          'Turn a note into an NPC, location, quest, clue, lore or loot entry without retyping it.',
        ],
      },
      {
        title: 'Record the session',
        where: 'Session → Session Mode',
        steps: [
          'Start a recording to capture the table’s audio.',
          'Drop a bookmark at big moments; bookmarks show in the session’s highlight reel and jump the recording to that point.',
        ],
      },
      {
        title: 'Initiative and your turn',
        where: 'Anywhere in the app',
        steps: [
          'When the DM calls for initiative, your screen shakes with a **Roll for initiative!** alert.',
          'Tap **Roll for me** to roll with your bonus, or roll real dice and tell the DM.',
          'You’ll get **You’re up next** a turn ahead and a **Your turn** banner when it’s yours. Phones buzz too.',
        ],
        tips: ['The red combat badge at the top reopens the roll prompt until you’ve rolled.'],
      },
      {
        title: 'Party votes',
        where: 'Session Mode (players) · Tools (DM)',
        steps: ['When the DM opens a vote, it pops up for you. Pick an answer, and see the result when the DM closes it.'],
      },
    ],
  },
  {
    id: 'notes',
    title: 'Session notes & tags',
    icon: 'book',
    topics: [
      {
        title: 'Write a recap',
        where: 'Journal → Session Notes',
        steps: [
          'Tap **+ Add Session Notes**, give it a title and date, and write what happened.',
          '`Return` starts a new paragraph; `Shift+Return` starts a new line in the same paragraph.',
          'Start a line with `- ` (or `•`) for bullets. Use the toolbar for **bold**, italics, underline and lists.',
        ],
        tips: ['Recaps are private to you. Copy notes or **Export** them to share.'],
      },
      {
        title: 'Tags',
        where: 'Any recap or quick note',
        steps: [
          'Type a tag character and pick from the list, or create a new entry on the spot:',
          '`@` people (NPCs) · `#` places · `~` lore, factions and clues · `$` loot · `%` creatures · `!event` timeline events.',
          'A tag becomes a chip; tap it to open that entry.',
        ],
        tips: [
          'Tags are what connect your notes: they power the Timeline, Connections, World Wiki, Prep’s “came up recently” and each entry’s related list.',
        ],
      },
      {
        title: 'Highlight reel',
        where: 'Journal → Session Notes → a session',
        steps: [
          'Each session shows a highlight reel: who you met, where you went, what you found and faced, bookmarks, votes and quests.',
          'Tap **Play** to step through it, or tap a moment to open it.',
        ],
      },
      {
        title: 'Export and share',
        where: 'Journal → Session Notes',
        steps: [
          '**Export** saves one session or all of them as a document.',
          'Share a note’s text with the party from its menu; tags come along.',
        ],
      },
    ],
  },
  {
    id: 'world',
    title: 'The world: NPCs, places & more',
    icon: 'users',
    intro: 'These lists are shared by the whole party, and changes show up on everyone’s screen within a moment.',
    topics: [
      {
        title: 'NPCs',
        where: 'Journal → NPCs',
        steps: [
          '**+ Add NPC**: name, race, where you met, status (Alive, Deceased, Unknown, Missing), a portrait and notes.',
          'Tap the **Rapport** pill to record how they feel about the party (Hostile → Ally) and why; the history is kept.',
        ],
      },
      {
        title: 'Creatures',
        where: 'Journal → Creatures',
        steps: [
          '**+ Add Creature**: name, type (pick from the list or type your own), where you met it, photos (as many as you like) and notes.',
          'Tap the cover picture to see every photo full size.',
        ],
      },
      {
        title: 'Maps & places',
        where: 'Journal → Maps & Places',
        steps: [
          'Upload maps and open one to view it full screen.',
          'Drop pins for places, give them a type, and link them to NPCs, quests or notes. Filter pins by type.',
          'Move the party marker as you travel; its journey trail shows where you’ve been.',
          'Places also have their own list, with notes, and **Show on map** for pinned ones.',
        ],
      },
      {
        title: 'Quests',
        where: 'Journal → Quests',
        steps: [
          '**+ Add Quest**: name, who gave it, status, an optional deadline and notes.',
          'Drag quests between **Rumours**, **Active** and **Done** (or use the ‹ › buttons).',
        ],
      },
      {
        title: 'Loot',
        where: 'Journal → Loot',
        steps: ['Log items with a photo, kind, quantity, where you found them and who holds them. Mark usable items as used.'],
      },
      {
        title: 'Lore, clues and factions',
        where: 'Journal → Lore & Clues',
        steps: [
          'Record history, religions, factions and clues.',
          'Give an entry the **Faction** category and its card gets a standing track (Hated → Revered). Tap it to change the party’s standing and say why.',
        ],
      },
      {
        title: 'Art',
        where: 'Journal → Art',
        steps: ['Art the DM has shared with the table: portraits, scenes and handouts. Tap one to view it full size.'],
      },
      {
        title: 'Your own tabs',
        where: 'Journal → +',
        steps: ['Add a custom tab for anything else, such as a recipe book or a bounty board. Rename or delete it from inside the tab.'],
      },
      {
        title: 'Links between entries',
        where: 'Any card → Links',
        steps: [
          'Open an entry’s links to see everything related to it: links you’ve added, and sessions whose recap tags it.',
          'Add a link (“Works for”, “Lives in”…) or remove one there.',
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
        where: 'Journal → World Wiki',
        steps: [
          'Every NPC, place, lore entry, item, creature and quest as a wiki article, A–Z, with search and type filters.',
          'Each article shows its facts, what’s been written about it, **First noted in** which session, and every recap and quick note that mentions it, with the lines around it.',
          '**Connections** at the bottom jumps to related articles; **Open entry** edits it.',
        ],
        tips: ['It reads your own recaps and quick notes, so the more you tag, the richer it gets.'],
      },
      {
        title: 'Timeline',
        where: 'Journal → Timeline',
        steps: ['The story so far, session by session, including the `!event` moments you tagged.'],
      },
      {
        title: 'Connections',
        where: 'Journal → Connections',
        steps: [
          'A web of how people, places, factions and the party connect, drawn from your links and tags.',
          'Filter what’s shown, and tap a dot to see its connections and open it.',
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
          'Fill in ability scores, saves, skills, HP, AC, spell slots, resources and inventory; modifiers work themselves out.',
          'The roleplay side keeps your persona, private thoughts, voice lines, personality, relationships and a development log.',
          'Everything saves as you type.',
        ],
      },
      {
        title: 'Import from D&D Beyond',
        where: 'Character → Character Sheet',
        steps: [
          'Set your D&D Beyond character to **Public**, tap **Import from D&D Beyond** and paste its link.',
          'Check the preview and choose what to bring in. If the link doesn’t work, use **Upload a file instead**.',
        ],
        tips: ['Double-check values the app had to calculate, such as AC.'],
      },
      {
        title: 'Roleplay assistant',
        where: 'Character → Character Sheet',
        steps: [
          'Ask for in-character ideas based on your notes.',
          'Connect your own Claude or ChatGPT account in **Settings → AI Assistant** (kept on your device only), or use **Copy prompt** to paste into any assistant.',
        ],
      },
      {
        title: 'Spells',
        where: 'Character → Spells',
        steps: ['Keep your spell list with level, school and notes, and open a spell for its full text.'],
      },
      {
        title: 'Party and goals',
        where: 'Character → Party',
        steps: [
          'The roster of everyone adventuring together; claim your character so it’s linked to you.',
          '**Party goals**: what the group is working towards, broken into subtasks with a progress ring. Tick off the goal when it’s done.',
          '**Personal goals** are private: only you see them.',
        ],
        tips: ['Level up a character and the whole party sees it celebrated.'],
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
          'Read last session’s recap, the open threads (tap **+** to make one an objective) and who came up recently.',
          'Keep your own lists: planned scenes and objectives, questions for the DM, items and abilities to prepare, and a before-the-session checklist. Each item can link to an entry.',
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
        title: 'Money and shards',
        where: 'Session → Tools',
        for: 'player',
        steps: [
          '**Money Tracker** keeps your coins; the **Currency Calculator** converts between them.',
          '**Your Shards** shows the shards your DM has given you. When the DM gives or takes some, a gem pops up on your screen.',
        ],
      },
      {
        title: 'Team generator',
        where: 'Session → Tools',
        steps: ['Split the party into random teams, such as watches or splitting up in a dungeon.'],
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
        steps: [
          'When the DM reveals an NPC, creature, map or art, it lands here.',
          'Tap **Add to …** to put it in the party’s list (it’s added once, for everyone).',
        ],
      },
      {
        title: 'Offline and syncing',
        where: 'Anywhere',
        steps: [
          'Install the app to your phone’s home screen; it opens without a connection and shows what you’ve already loaded.',
          'Changes made offline are saved on the device and sent when you reconnect. The top bar shows what’s waiting to sync.',
        ],
      },
      {
        title: 'Phone gestures',
        where: 'On a phone',
        steps: [
          'Swipe a card left for its actions.',
          'Pull down at the top of a list to refresh it.',
          'Swipe a pop-up sheet down to close it.',
        ],
      },
    ],
  },
  {
    id: 'dm',
    title: 'For the DM',
    icon: 'eye',
    for: 'dm',
    intro: 'A DM gets their own set of screens. Everything there is private until you reveal it.',
    topics: [
      {
        title: 'Invite players',
        where: 'Players',
        steps: [
          'Create an invite link and send it; whoever opens it can sign up and lands in your campaign.',
          'See everyone in the campaign and their characters, and remove a player if you need to.',
        ],
      },
      {
        title: 'Prepare NPCs, creatures, maps and art',
        where: 'NPCs · Creatures · Art · Maps',
        steps: [
          'Write them up ahead of time. **DM only** notes are never shown to players.',
          'When the party meets one, tap **Reveal now**: it pops up full screen on every player’s device and lands in their notifications to add.',
          'Revealed cards grey out so you can see what’s still to come; the tag shows whether a player has added it.',
        ],
      },
      {
        title: 'Run combat',
        where: 'Combat',
        steps: [
          'Pick the dice (d20 by default; normal, advantage or disadvantage) and tap **Call for initiative!**. Every player gets the roll prompt and the app turns red.',
          'Add monsters and party members; the order sorts itself, and you can drag rows to break ties.',
          'Add conditions with a number of rounds; they count down on that combatant’s turn.',
          '**End combat** returns everyone to normal.',
        ],
      },
      {
        title: 'Party votes, shards and tools',
        where: 'Tools',
        steps: [
          'Start a party vote; players answer from their Session Mode, and you close it to show the result.',
          '**Player Shards**: give or take shards per player with − and +. Each player gets an animated alert.',
        ],
      },
      {
        title: 'Follow what the party knows',
        where: 'Overview · World Wiki',
        steps: [
          '**Party Overview** shows what the party has found, their quests and rumours, who’s with them, faction standing and goals.',
          'The **World Wiki** shows every entry the party has written about the world.',
        ],
      },
    ],
  },
]
