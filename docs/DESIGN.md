# Bingo Multiplayer — Design

## High-Level Overview

Bingo Multiplayer is a single-page React application with no backend server. All real-time game state is stored in Firebase Firestore, which acts as both the database and the real-time communication layer via `onSnapshot` listeners. Player identity is established using a random UUID stored in `localStorage` — no Firebase Authentication is used. The design prioritises simplicity: a single collection with a subcollection handles all game data, and all game logic (card generation, win detection, bot AI) runs in the host's browser.

---

## Architecture Diagram

```
Browser (React SPA)
  │
  ├── main.jsx → App.jsx
  │     ├── subscribeRoom()    ──► Firestore onSnapshot (room doc)
  │     ├── subscribePlayers() ──► Firestore onSnapshot (players subcollection)
  │     │
  │     ├── HomeScreen          No external deps
  │     ├── PaperScreen
  │     │     ├── generateCards()     ──► cardGenerator.js
  │     │     └── jsPDF (lazy import) ──► client-side PDF generation
  │     ├── SetupScreen
  │     │     ├── generateRoomCode()  ──► cardGenerator.js
  │     │     ├── generateCards()     ──► cardGenerator.js
  │     │     └── createRoom()        ──► rooms.js → Firestore
  │     ├── JoinScreen
  │     │     └── joinRoom()          ──► rooms.js → Firestore
  │     ├── LobbyScreen
  │     │     ├── generateCards()     ──► cardGenerator.js
  │     │     └── startGame()         ──► rooms.js → Firestore
  │     ├── GameScreen
  │     │     ├── BingoCard           UI component
  │     │     ├── PlayerList          UI component
  │     │     ├── NumberCallHistory   UI component
  │     │     ├── callNumber()        ──► rooms.js → Firestore
  │     │     ├── markCell()          ──► rooms.js → Firestore
  │     │     ├── claimWin()          ──► rooms.js → Firestore (transaction)
  │     │     ├── setPaused()         ──► rooms.js → Firestore
  │     │     ├── getAvailableClaims() ──► winDetector.js
  │     │     ├── getWinningCells()    ──► winDetector.js
  │     │     └── Bot AI logic        (host browser only, no Firestore reads)
  │     └── ResultsScreen       Display only
  │
  ├── Engine (src/engine/)
  │     ├── cardGenerator.js   Pure functions: card gen, room code, player ID
  │     └── winDetector.js     Pure functions: row/col/diag/house check
  │
  └── Firebase (src/firebase/)
        ├── config.js          Firebase init from .env
        └── rooms.js           All Firestore CRUD + claimWin transaction

Firestore
  └── /rooms/{roomCode}
        ├── (room document: status, calledNumbers, wins, paused…)
        └── /players/{playerId}
              └── (player document: card[], marked[], claimedWins[])
```

---

## Module Design

### `src/firebase/config.js`
Initialises the Firebase app from `.env` variables and exports `app` and `db`. All Firestore access goes through these exports — no other file imports from the Firebase SDK directly.

### `src/firebase/rooms.js`
All Firestore operations for the game. Key functions:
- `createRoom(code, hostId, mode, playerCount)` — writes the room document with status `'lobby'`
- `joinRoom(code, playerId, name)` — adds a player document to the subcollection
- `startGame(code, players)` — writes all player cards to Firestore and sets status to `'playing'`
- `addBotPlayers(code, cards, botNames)` — writes bot player documents and sets status to `'playing'` in one batch
- `callNumber(code, num)` — appends to `calledNumbers` array via `arrayUnion`
- `markCell(code, playerId, flatIndex)` — updates the `marked` flat array at a specific index
- `setPaused(code, paused)` — toggles the `paused` field
- `claimWin(code, playerId, playerName, winType, card, calledNumbers)` — Firestore transaction that atomically validates and records a win; first valid writer wins, concurrent claims are rejected
- `subscribeRoom(code, cb)` / `subscribePlayers(code, cb)` — `onSnapshot` wrappers

### `src/engine/cardGenerator.js`
Pure functions with no side effects:
- `generateRoomCode()` — 5-character alphanumeric code; excludes 0, O, I, 1, L to avoid ambiguity
- `generatePlayerId()` — random UUID for anonymous player identity
- `generateCards(playerCount)` — distributes numbers 1–99 fairly across all players' cards (see algorithm below); returns array of 5×5 grids with `0` at `[2][2]` (FREE)

### `src/engine/winDetector.js`
Pure functions used for client-side display only (not authoritative):
- `checkRow(card, calledSet)` — returns row index of complete row, or -1
- `checkCol(card, calledSet)` — returns column index, or -1
- `checkDiagonal(card, calledSet)` — returns 0 (main), 1 (anti-diagonal), or -1
- `checkHouse(card, calledSet)` — returns boolean (all 25 cells marked)
- `getAvailableClaims(card, calledSet, globalWins, playerClaimedWins)` — filters out already-won and already-claimed categories
- `getWinningCells(card, calledSet, winType)` — returns a `Set` of flat cell indices forming the winning pattern (used for cell highlighting)

### `src/components/PaperScreen.jsx`
Fully self-contained screen for the Paper / Offline mode. No Firestore interaction. Responsibilities:
- Player count selector (2–20) using − / + buttons, matching the Create Game screen
- Single "Download PDF" button generates cards, shuffles call-out list, and downloads in one action
- Lazily imports `jspdf` on first download click (keeps initial bundle lean)
- Draws the PDF directly via jsPDF canvas calls: BINGO header row, 5×5 grid with FREE centre, up to 4 cards per A4 page; final page with call-out sequence
- Saves the file via `jsPDF.save()` — no server involved

### `src/App.jsx`
Top-level state controller. Manages:
- `phase` — `'home' | 'setup' | 'join' | 'lobby' | 'game' | 'results' | 'paper'`
- `config` — room code, player count, mode
- `room` / `players` — live Firestore data from `onSnapshot` subscriptions
- Phase transitions driven by Firestore `room.status` changes (lobby → playing → finished)
- Mounts/unmounts `onSnapshot` listeners on phase changes

### `src/components/screens/GameScreen.jsx`
The most complex screen. Responsibilities:
- Runs the number-calling `setInterval` loop (host only; checks `paused` flag)
- Renders the bingo card, score sidebar, and call history
- Runs the bot AI loop: on every change to `calledNumbers.length`, marks all bot cells and claims available wins with a randomised delay
- Manages the win banner (5-second auto-dismiss)

### `src/components/game/`
Presentational components:
- `BingoCard.jsx` — 5×5 grid; cell states: unmarked (slate), marked (green), winning (bright green with glow)
- `NumberPad.jsx` — (not applicable; number entry is automatic)
- `NumberCallHistory.jsx` — scrollable list of called numbers, most recent highlighted
- `PlayerList.jsx` — sidebar listing all players and their wins

---

## Design Considerations

### Why Firestore instead of a custom WebSocket server?
Firestore's `onSnapshot` provides real-time pub/sub with no server required. For a game with 2–8 players and simple state transitions, Firestore's document model is sufficient and eliminates all infrastructure concerns (deployment, scaling, uptime).

### Why no Firebase Authentication?
Bingo is a casual, session-based game. Requiring an account creates unnecessary friction. UUID-based identity in `localStorage` is sufficient for a single game session. There are no persistent user profiles or sensitive data.

### Why flat arrays for card and marked cells?
Firestore does not support nested arrays (array-of-arrays). Cards are stored as flat 25-element arrays and reconstructed into 5×5 grids via `hydratePlayer()` in `rooms.js` on every read.

### Why run the number-calling loop and bot AI in the host's browser?
For a small multiplayer game, running logic in the host's browser avoids the need for a backend. The host writes called numbers and bot progress to Firestore, which all other clients observe. This is acceptable because: (1) all clients share the same Firestore source of truth, and (2) the game is casual with no financial stakes.

### Why Firestore transactions for win claims?
Without a transaction, two players could simultaneously read that a category is unclaimed, both validate their win, and both write — creating a double-winner. A Firestore transaction's atomic read-then-write guarantees exactly one winner per category.

### Why validate wins server-side (in the transaction) rather than trust the client?
Client-side validation (in `winDetector.js`) is used only to decide whether to show claim buttons. The authoritative check in `claimWin()` re-validates the card against `calledNumbers` inside the transaction, preventing phantom wins from race conditions or tampered clients.

### Why a single document per room (not subcollections for everything)?
Room metadata (status, calledNumbers, wins, paused) changes together and is always read together. Keeping it in one document means one `onSnapshot` listener covers all game state changes. The `players` subcollection is separate because player count varies and each player's data (25-cell card, 25-element marked array) would push the room document toward Firestore's 1MB limit.

### Why distribute numbers 1–99 across cards algorithmically?
In standard bingo, all players draw from the same pool of numbers. To replicate this without a shared pool, `generateCards()` calculates how many times each number (1–99) should appear across all cards proportionally, shuffles, and distributes. This ensures every called number is relevant to at least one player.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI Framework | React 19 | Component model suits the per-screen game flow |
| Language | JavaScript (JSX) | No TypeScript; simpler for a small project |
| Styling | Tailwind CSS v4 | Utility-first; Vite-native plugin |
| Build | Vite 6 | Fast HMR, ESM-first; lazy chunks via dynamic import |
| Database / Real-time | Cloud Firestore | Real-time onSnapshot; no backend required |
| Auth | None (UUID in localStorage) | No accounts needed for casual play |
| Hosting | Firebase Hosting | CDN, SPA rewrites, free tier |
| PDF Generation | jsPDF (lazy import) | Client-side PDF for Paper mode; not loaded until first use |

---

## Deployment

1. Run `npm run build` — Vite bundles to `dist/`
2. Run `firebase deploy --only hosting`
3. Firebase Hosting serves `dist/` at `https://bingo-game-b09b8.web.app`
4. All routes rewrite to `index.html` (SPA mode, configured in `firebase.json`)
5. `.env` is never committed — must be present locally for build

Firebase project: `bingo-game-b09b8`
GitHub repo: https://github.com/shuvajyotibardhan-crco/bingo-multiplayer

---

## Constraints & Known Limitations

| Constraint | Detail |
|-----------|--------|
| Host dependency | Number calling and bot AI run in the host's browser. If the host closes the tab, the game stalls for other players. |
| Open Firestore rules | Rules allow read/write to anyone. Acceptable for an MVP with no sensitive data; should be tightened for public deployment. |
| No reconnection handling | If a player disconnects and rejoins mid-game, their marked cells persist in Firestore but the in-memory state may be inconsistent. |
| Bot AI in host browser | Bots are simulated locally; if the host is slow, bot reactions are slow. |
| No persistence across sessions | Room codes expire when the game ends; there is no lobby recovery or game history. |
| jsPDF bundle size | jsPDF adds ~390 KB minified to the bundle, loaded lazily only when Paper mode PDF is downloaded. |
