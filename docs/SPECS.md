# Bingo Multiplayer — Technical Specifications

## Data Models

### Room Document
Stored in Firestore collection `rooms`, document ID = room code (5-char alphanumeric).

```js
{
  status:        'lobby' | 'playing' | 'finished',
  hostId:        string,         // playerId of the room creator
  mode:          'human' | 'bot',
  playerCount:   number,         // expected total players (2–8)
  calledNumbers: number[],       // called numbers in order (1–99)
  paused:        boolean,        // true when host has paused calling
  createdAt:     Timestamp,
  wins: {
    row:      WinRecord | null,
    col:      WinRecord | null,
    diagonal: WinRecord | null,
    house:    WinRecord | null,
  }
}
```

### WinRecord (nested in Room.wins)
```js
{
  playerId:    string,
  playerName:  string,
  calledCount: number,   // how many numbers had been called when win was claimed
}
```

### Player Document
Stored in Firestore subcollection `rooms/{roomCode}/players`, document ID = playerId.

```js
{
  name:        string,      // display name (max 20 chars)
  isBot:       boolean,
  card:        number[],    // flat 25-element array (5×5 unflattened on read); centre = 0 (FREE)
  marked:      boolean[],   // flat 25-element array; centre [index 12] always true
  claimedWins: string[],    // win types claimed by this player, e.g. ['row', 'diagonal']
  joinedAt:    Timestamp,
}
```

**Why flat arrays?** Firestore does not support nested arrays. Cards are flattened to 1D before writing and reconstructed to 5×5 via `hydratePlayer()` on read.

---

## Storage Schema

### Firestore Collections

| Collection / Subcollection | Doc ID | Contents |
|---------------------------|--------|----------|
| `rooms` | 5-char room code | Room metadata: status, calledNumbers, wins, paused |
| `rooms/{code}/players` | playerId (UUID) | Card (flat), marked (flat), claimedWins, isBot |

### localStorage

| Key | Type | Purpose |
|-----|------|---------|
| `bingo_player_id` | string (UUID) | Anonymous player identity; persists across sessions |

---

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
      match /players/{playerId} {
        allow read, write: if true;
      }
    }
  }
}
```

**Note:** Open rules are acceptable for an MVP with no sensitive data. A production deployment should restrict writes to authenticated players who own the document.

---

## Algorithms

### Card Generation (`cardGenerator.js`)

Distributes numbers 1–99 fairly across all cards so every called number is relevant to at least one player.

```
generateCards(playerCount):
  totalSlots = playerCount × 24    // 24 playable cells per card (centre is FREE)
  fFloor = floor(totalSlots / 99)
  remainder = totalSlots - fFloor × 99

  // Build number pool:
  // Numbers 1..remainder appear (fFloor + 1) times
  // Numbers (remainder+1)..99 appear fFloor times
  pool = []
  for n = 1 to 99:
    count = (n <= remainder) ? fFloor + 1 : fFloor
    repeat count times: pool.push(n)

  shuffle(pool)

  // Slice into per-player chunks
  cards = []
  for i = 0 to playerCount - 1:
    chunk = pool.slice(i × 24, (i+1) × 24)
    grid = 5×5 array filled with chunk, centre [2][2] = 0 (FREE)
    cards.push(grid)
  return cards
```

**Example (2 players, 48 slots):** fFloor = 0, remainder = 48. Each of numbers 1–48 appears once; 49–99 appear 0 times. Each player gets 24 unique numbers from the range 1–48.

### Room Code Generation

```
generateRoomCode():
  alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // excludes 0, O, I, 1, L
  return 5 random chars from alphabet
```

### Win Detection (`winDetector.js`)

```
checkRow(card, calledSet):
  for each row r in 0..4:
    if all card[r][c] in calledSet (or card[r][c] === 0 for FREE):
      return r
  return -1

checkCol(card, calledSet):
  for each col c in 0..4:
    if all card[r][c] in calledSet for r in 0..4:
      return c
  return -1

checkDiagonal(card, calledSet):
  main  = [0,0],[1,1],[2,2],[3,3],[4,4]
  anti  = [0,4],[1,3],[2,2],[3,1],[4,0]
  if all main cells in calledSet: return 0
  if all anti cells in calledSet: return 1
  return -1

checkHouse(card, calledSet):
  return all 25 cells in calledSet (centre always counts as called)
```

**Client-side only.** The authoritative check is in `claimWin()` in `rooms.js`.

### Win Claim — Firestore Transaction

```
claimWin(code, playerId, playerName, winType, card, calledNumbers):
  runTransaction(db, tx => {
    roomDoc = tx.get(rooms/{code})
    playerDoc = tx.get(rooms/{code}/players/{playerId})

    // Guard: category already won globally
    if roomDoc.wins[winType] !== null: throw 'already won'

    // Guard: player already claimed this type
    if playerDoc.claimedWins includes winType: throw 'already claimed'

    // Validate: re-check the win using calledNumbers from Firestore
    calledSet = new Set(roomDoc.calledNumbers)
    if not isWinValid(card, calledSet, winType): throw 'invalid win'

    // Atomic write
    tx.update(rooms/{code}, {
      wins[winType]: { playerId, playerName, calledCount: calledNumbers.length }
    })
    tx.update(rooms/{code}/players/{playerId}, {
      claimedWins: arrayUnion(winType)
    })
  })
```

### Number Calling Loop (host browser)

```
setInterval(5000ms):
  if not host: return
  if room.status !== 'playing': return
  if room.paused: return

  remaining = [1..99] minus calledNumbers set
  if remaining is empty: return

  num = random element from remaining
  callNumber(roomCode, num)   // Firestore arrayUnion
```

### Bot AI (host browser, runs per calledNumbers.length change)

```
for each bot player:
  newlyCalledNumber = calledNumbers[last]

  // Mark cell if it matches
  flatIndex = card.findIndex(cell => cell === newlyCalledNumber)
  if flatIndex >= 0 and not already marked:
    markCell(roomCode, bot.id, flatIndex)

  // Check for available wins
  available = getAvailableClaims(card, calledSet, globalWins, bot.claimedWins)
  for each winType in available:
    delay = 800 + random(0, 3200) ms
    setTimeout(() => claimWin(roomCode, bot.id, bot.name, winType, card, calledNumbers), delay)
```

### Player Hydration

Firestore stores cards and marked arrays flat. On every `subscribePlayers` snapshot:

```
hydratePlayer(doc):
  flat = doc.card                      // 25-element array
  grid = flat.slice into 5 rows of 5  // [[...], [...], [...], [...], [...]]
  markedFlat = doc.marked              // 25-element boolean array
  markedGrid = markedFlat.slice into 5 rows of 5
  return { ...doc, card: grid, marked: markedGrid }
```

---

## Configuration

### Environment Variables (`.env`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=bingo-game-b09b8
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

See `.env.example` for variable names. Real values from Firebase Console → Project Settings → Your apps.

### Game Constants (hardcoded in source)

```
CALL_INTERVAL_MS    = 5000     // milliseconds between number calls
BOT_CLAIM_DELAY_MIN = 800      // ms minimum reaction time for bots
BOT_CLAIM_DELAY_MAX = 4000     // ms maximum (800 + random 0–3200)
WIN_BANNER_DURATION = 5000     // ms before win banner auto-dismisses
MAX_PLAYER_NAME     = 20       // characters
MIN_PLAYERS         = 2
MAX_PLAYERS         = 8
ROOM_CODE_LENGTH    = 5
NUMBER_RANGE        = 1–99
CARD_SIZE           = 5×5 (24 playable + 1 FREE centre)
FREE_CELL_INDEX     = [2][2]   // flat index 12
```

---

## File Inventory

```
Bingo/
├── .env                       Firebase credentials (git-ignored)
├── .env.example               Variable names without values
├── .gitignore
├── firebase.json              Hosting config (SPA rewrite to index.html)
├── firestore.rules            Firestore security rules
├── index.html                 HTML entry; loads src/main.jsx
├── package.json
├── vite.config.js             Vite + React + Tailwind plugins
│
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md
│   └── SPECS.md               (this file)
│
└── src/
    ├── main.jsx               ReactDOM.createRoot entry
    ├── App.jsx                Phase controller; Firestore subscriptions
    ├── index.css              Tailwind + custom bingo-cell animations
    │
    ├── firebase/
    │   ├── config.js          Firebase init; exports app, db
    │   └── rooms.js           All Firestore CRUD; claimWin transaction; hydratePlayer
    │
    ├── engine/
    │   ├── cardGenerator.js   generateCards(), generateRoomCode(), generatePlayerId()
    │   └── winDetector.js     checkRow/Col/Diagonal/House, getAvailableClaims, getWinningCells
    │
    └── components/
        ├── HomeScreen.jsx          Main menu (3 buttons)
        ├── SetupScreen.jsx         Create room + bot mode
        ├── JoinScreen.jsx          Enter code + name
        ├── LobbyScreen.jsx         Waiting room; real-time player list
        ├── GameScreen.jsx          Main gameplay; number-call loop; bot AI
        ├── ResultsScreen.jsx       Category winners + all-player summary
        ├── BingoCard.jsx           5×5 grid; cell state rendering
        ├── NumberCallHistory.jsx   Scrollable called-number list
        └── PlayerList.jsx          Sidebar: all players + their wins
```

---

## Browser Compatibility

| Feature | Minimum Requirement |
|---------|-------------------|
| ES Modules | Chrome 61+, Firefox 60+, Safari 11+ |
| CSS Custom Properties | Chrome 49+, Firefox 31+, Safari 9.1+ |
| Firebase SDK v11 | Same as ES Module support |
| localStorage | All modern browsers |
| `crypto.randomUUID()` | Chrome 92+, Safari 15.4+, Firefox 95+ |

Target: evergreen browsers (Chrome, Firefox, Safari, Edge — current versions).

---

## Security Notes

- Firebase credentials are read from `.env` at build time; `.env` is git-ignored.
- No Firebase Authentication — player identity is a UUID in `localStorage`. Anyone who obtains a player's UUID could impersonate them within an active game session. Acceptable for a casual family game.
- Firestore rules are open (`allow read, write: if true`). Suitable for MVP only. A production hardening step would scope writes to the player's own document and room creation.
- No user-generated HTML is injected into the DOM via `innerHTML` — React's JSX escaping prevents XSS.
- Bot AI and number calling run in the host's browser. The host can theoretically manipulate the calling order, but there is no mechanism to prevent this without a server-side caller.
