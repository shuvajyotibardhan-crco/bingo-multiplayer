# Bingo Multiplayer — Project Context

## What this is
Multiplayer Bingo webapp. Vite + React (JSX, no TypeScript) + Tailwind CSS v4 + Firebase Firestore.

## Firebase
- Project ID: `bingo-game-b09b8`
- Firestore for all real-time state — no Firebase Auth (player identity via random UUID in localStorage)
- Rules file: `firestore.rules` — deploy with `firebase deploy --only firestore:rules`
- **Never touch the Mental Maths Firebase project**

## GitHub
- Repo: https://github.com/shuvajyotibardhan-crco/bingo-multiplayer
- Branch: `main`
- Push all changes after every meaningful edit

## Architecture
- `src/firebase/config.js` — Firebase init (reads from `.env`)
- `src/firebase/rooms.js` — all Firestore ops (create/join room, call number, mark cell, claim win, listeners)
- `src/engine/cardGenerator.js` — number uniqueness algorithm + room code generation
- `src/engine/winDetector.js` — row/col/diagonal/house detection, available claims, winning cell highlight
- `src/App.jsx` — phase controller (home → setup/join → lobby → game → results)
- `src/components/` — one file per screen + BingoCard, NumberCallHistory, PlayerList

## Key rules / decisions
- Firestore does NOT support nested arrays — card (5x5) and marked (5x5) are stored flat (25 elements) and unflattened on read via `hydratePlayer()` in `rooms.js`
- Win eligibility uses `markedCalledSet` (numbers the player actually clicked), NOT `calledSet` — prevents phantom highlighting and false HOUSE claims
- Marked cells are locked (one-way) — cannot be unmarked
- All 4 claim buttons (ROW/COL/DIAGONAL/HOUSE) are always visible and styled the same — no visual hint about eligibility — only disabled after that category is globally won
- Bots are simulated by the host browser (not a server) — bot AI runs in `GameScreen.jsx` useEffect on `calledNumbers.length`
- Number calling: host runs `setInterval` every 5000ms, respects `room.paused` flag
- Claim race: Firestore transaction — first writer wins, others see non-null `wins[type]` and abort

## Number uniqueness algorithm
```
totalSlots = playerCount * 24
fFloor = floor(totalSlots / 99)
remainder = totalSlots - fFloor * 99
Numbers 1..remainder appear (fFloor+1) times across all cards
Numbers (remainder+1)..99 appear fFloor times
Pool is shuffled, then sliced per player
```

## Game flow
- Bot mode: cards generated and written immediately, status set to `playing` in SetupScreen
- Human mode: cards generated and written when host clicks Start in LobbyScreen
- Phase transitions driven by `room.status` changes via `onSnapshot` in App.jsx

## .env (not in git)
See `.env.example` for required variable names. Never commit actual credentials.
