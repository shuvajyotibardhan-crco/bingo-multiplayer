# Bingo Multiplayer — Requirements

## Overview

Bingo Multiplayer is a real-time, browser-based multiplayer bingo game. Players create or join rooms using a shared code and compete to mark called numbers on their cards. The first player to complete a row, column, diagonal, or full card wins that category. The game supports 2–8 human players and an AI bot mode for solo play. A Paper / Offline mode generates printable bingo cards and a call-out list as a downloadable PDF for in-person play. No account or login is required.

## Scope

### In Scope
- Room creation with a shareable 5-character code
- Human multiplayer via real-time Firestore sync
- AI bot mode (host vs configurable number of bots)
- Random number calling (1–99) at a fixed interval
- Interactive 5×5 bingo card with click-to-mark cells
- Four win categories: ROW, COL, DIAGONAL, HOUSE
- Server-side win validation via Firestore transactions
- Real-time leaderboard and win notifications
- Host controls: pause, resume, end game
- Results screen with category winners and all-player summary
- Paper / Offline mode: generate cards + call-out list as a downloadable PDF

### Out of Scope
- User accounts or persistent profiles
- Custom card configuration
- Chat or voice communication
- Mobile native application
- Spectator mode

---

## Feature 1 — Room Creation

**User story:** As a host, I want to create a game room so that friends can join using a shared code.

**Acceptance Criteria:**
1. Host **shall** enter a display name (required, max 20 characters).
2. Host **shall** select a player count (2–8).
3. On submit, the system **shall** generate a unique 5-character alphanumeric room code (excluding ambiguous characters: 0, O, I, 1, L).
4. Room **must** be written to Firestore with status `'lobby'`.
5. Host **shall** be taken to the lobby screen immediately after creation.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Submit with name blank | Validation prevents submission |
| Submit valid name + player count | Room created; lobby screen shown with code |
| Two rooms created near-simultaneously | Codes are distinct (UUID uniqueness) |

---

## Feature 2 — Room Joining

**User story:** As a player, I want to join an existing game using a room code so that I can play with friends.

**Acceptance Criteria:**
1. Player **shall** enter a 5-character room code (auto-uppercased).
2. Player **shall** enter a display name (required, max 20 characters).
3. System **must** reject codes for rooms that do not exist.
4. System **must** reject joins when the room status is not `'lobby'` (game already started).
5. On success, player **shall** appear in the lobby in real time.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Enter valid code + name | Player appears in lobby; host sees updated list |
| Enter non-existent code | Error: "Room not found" |
| Enter code for in-progress game | Error: "Game already started" |
| Enter code with lowercase letters | Auto-uppercased before lookup |

---

## Feature 3 — Play vs Computer (Bot Mode)

**User story:** As a solo player, I want to play against AI opponents so that I can enjoy the game without waiting for friends.

**Acceptance Criteria:**
1. Host **shall** select a name and player count (2–8; all other slots filled by bots).
2. On submit, all cards **must** be generated and written to Firestore immediately.
3. Game **shall** start without a lobby wait.
4. Bots **shall** automatically mark their cells when numbers are called.
5. Bots **shall** claim wins with a realistic delay (800ms + random 0–3200ms).

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Start bot game with 4 bots | 4 bot cards appear; game starts immediately |
| Number called | Bots' marked cells update within ~4 seconds |
| Bot achieves row win | Bot claims ROW; win banner displayed |

---

## Feature 4 — Lobby & Game Start

**User story:** As a host, I want to wait in a lobby and start the game once all players have joined.

**Acceptance Criteria:**
1. Lobby **shall** display the room code prominently (clickable to copy).
2. Player list **shall** update in real time as players join.
3. Expected vs joined player count **shall** be shown (e.g. "2 / 4 players").
4. "Start Game" button **must** only be enabled when the expected player count is reached.
5. Non-host players **shall** see a waiting message (no Start button).
6. Host **shall** generate all cards and write them to Firestore before setting status to `'playing'`.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Open lobby (1 of 4 joined) | Start button disabled |
| All 4 players join | Start button enabled |
| Non-host views lobby | Start button absent; waiting message shown |
| Host clicks Start | All clients navigate to game screen |

---

## Feature 5 — Number Calling

**User story:** As a player, I want numbers to be called automatically so that I can mark my card.

**Acceptance Criteria:**
1. Host **shall** call a random uncalled number every 5 seconds automatically.
2. Numbers **must** be drawn without replacement (1–99, no duplicates).
3. Latest called number **shall** be displayed prominently.
4. A scrollable history of all called numbers **shall** be shown (most recent highlighted).
5. Host **shall** be able to pause and resume calling.
6. Game **shall** not end automatically when all 99 numbers are called — it continues until wins are claimed or the host ends it.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Game starts | First number called within 5 seconds |
| Observe over time | No number repeated |
| Host clicks Pause | Number calling stops; Resume button shown |
| Host clicks Resume | Calling resumes from next interval |
| All 99 numbers called | No crash; game continues |

---

## Feature 6 — Interactive Bingo Card

**User story:** As a player, I want to mark called numbers on my card so that I can track my progress.

**Acceptance Criteria:**
1. Card **shall** be a 5×5 grid with the centre cell [2][2] permanently marked as FREE.
2. Cells **shall** only be markable if the number has been called.
3. Marked cells **must** be locked (cannot be unmarked).
4. Marking a cell **must** be persisted to Firestore immediately.
5. Winning cells **shall** be highlighted distinctly from non-winning marked cells.
6. Column headers (B, I, N, G, O) **shall** be displayed above the grid.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Click uncalled number | Cell not marked |
| Click called number | Cell turns green; Firestore updated |
| Click already-marked cell | No change |
| Winning pattern achieved | Winning cells highlighted with glow |

---

## Feature 7 — Win Claims

**User story:** As a player, I want to claim a win when I complete a pattern so that I am recognised as the winner of that category.

**Acceptance Criteria:**
1. Four claim buttons **shall** always be visible: CLAIM ROW, CLAIM COL, CLAIM DIAGONAL, CLAIM HOUSE.
2. Win validation **must** occur server-side via a Firestore transaction.
3. A button **must** be disabled after that category has been won globally (by any player).
4. A player **must not** be able to claim the same category twice.
5. Win eligibility **must** be calculated from *marked* cells only (not just called numbers).
6. The first valid claim wins; concurrent claims are resolved atomically.
7. Winner name **shall** be displayed on the disabled button after the category is won.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Claim ROW with valid marked row | Win recorded; ROW button disabled for all players |
| Attempt to claim ROW after it is won | Button already disabled |
| Attempt to claim with incomplete pattern | No win recorded |
| Two players race to claim same category | Exactly one wins; the other is rejected |

---

## Feature 8 — Win Notifications & Status

**User story:** As a player, I want to be notified when someone wins a category so that I know the game state.

**Acceptance Criteria:**
1. A banner **shall** appear at the top of the screen when any category is won, showing winner name and category.
2. Banner **shall** auto-dismiss after 5 seconds.
3. A status bar at the bottom of the game screen **shall** list all won categories and their winners once any win occurs.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Any player wins ROW | Banner: "🎉 PlayerName wins ROW!" shown to all |
| Banner shown | Dismissed automatically after 5 seconds |
| Multiple categories won | All winners listed in the status bar |

---

## Feature 9 — Host Controls

**User story:** As a host, I want to control the pace of the game so that I can manage the session.

**Acceptance Criteria:**
1. Host **shall** have a Pause button during gameplay that stops number calling.
2. Host **shall** have a Resume button when paused.
3. Host **shall** have an End Game button to finish the session at any time.
4. Pause/Resume and End Game controls **must** only be visible and operable by the host.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Host clicks Pause | Calling stops; non-host players see no change to controls |
| Host clicks Resume | Calling resumes |
| Host clicks End Game | Game finishes; all clients navigate to Results |
| Non-host client | Pause/Resume/End Game buttons not shown |

---

## Feature 10 — Results Screen

**User story:** As a player, I want to see the final results so that I know who won each category.

**Acceptance Criteria:**
1. Results screen **shall** show how many numbers were called.
2. Each category winner **shall** be listed with their name and category icon.
3. All players **shall** be listed with any categories they won.
4. "Play Again" button **shall** return all users to the home screen.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Game ends | Results screen shown to all players |
| View results | All 4 categories shown; unclaimed shown as empty |
| Click Play Again | Home screen shown |

---

## Feature 11 — Paper / Offline Mode

**User story:** As an organiser, I want to generate printed bingo cards and a call-out list so that I can run a game in person without any device per player.

**Acceptance Criteria:**
1. User **shall** be able to access Paper / Offline mode from the home screen without creating a room.
2. User **shall** set the number of players (2–20).
3. System **shall** generate one unique 5×5 bingo card per player using the same uniqueness algorithm as the online mode.
4. System **shall** generate a shuffled call-out list containing all 99 numbers (1–99) in random order.
5. User **shall** be able to download a PDF containing all cards and the call-out list.
6. PDF **must** include one card per player, labelled "Player 1", "Player 2", etc., with BINGO column headers and a FREE centre cell.
7. PDF **must** include a final page with all 99 numbers in shuffled order, numbered 1–99 for the caller.
8. Cards **must** fit up to 4 per A4 page for compact printing.
9. Generating new cards **shall** replace the previous set (no accumulation).
10. PDF generation **must** be client-side only — no server or network request.

**Test Plan:**

| Step | Expected Result |
|------|----------------|
| Click "Paper / Offline" on home screen | PaperScreen shown; player count input defaulted to 4 |
| Set player count to 6, click Generate Cards | "Ready to download" confirmation shown; Download PDF enabled |
| Click Download PDF | PDF file downloaded; contains 6 cards across pages + call-out page |
| Inspect PDF cards | Each card has BINGO header, FREE centre, 24 unique numbers |
| Inspect call-out page | All 99 numbers present, shuffled, numbered 1–99 |
| Click Generate Cards again | New card set generated (numbers reshuffled) |
| Click Back to Home | Home screen shown; no room created in Firestore |
