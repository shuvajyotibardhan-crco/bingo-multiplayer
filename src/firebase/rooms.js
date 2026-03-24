import {
  doc, collection, getDoc, setDoc, updateDoc, onSnapshot,
  arrayUnion, runTransaction, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from './config.js'

// ── Grid helpers (Firestore doesn't support nested arrays) ───────────────────
function flattenGrid(grid) {
  return grid.flat()
}

function unflattenGrid(flat, cols = 5) {
  if (!flat) return null
  const grid = []
  for (let i = 0; i < flat.length; i += cols) {
    grid.push(flat.slice(i, i + cols))
  }
  return grid
}

function hydratePlayer(data) {
  return {
    ...data,
    card: data.card ? unflattenGrid(data.card) : null,
    marked: data.marked ? unflattenGrid(data.marked) : null,
  }
}

// ── Room helpers ─────────────────────────────────────────────────────────────

export function roomRef(code) {
  return doc(db, 'rooms', code)
}
export function playerRef(code, playerId) {
  return doc(db, 'rooms', code, 'players', playerId)
}
export function playersRef(code) {
  return collection(db, 'rooms', code, 'players')
}

export async function createRoom(code, hostId, hostName, mode, playerCount) {
  await setDoc(roomRef(code), {
    status: 'lobby',
    hostId,
    mode,
    playerCount,
    calledNumbers: [],
    wins: { row: null, col: null, diagonal: null, house: null },
    createdAt: serverTimestamp(),
  })
  await setDoc(playerRef(code, hostId), {
    name: hostName,
    isBot: false,
    card: null,
    marked: null,
    joinedAt: serverTimestamp(),
    claimedWins: [],
  })
}

export async function joinRoom(code, playerId, playerName) {
  const snap = await getDoc(roomRef(code))
  if (!snap.exists()) throw new Error('Room not found')
  if (snap.data().status !== 'lobby') throw new Error('Game already started')
  await setDoc(playerRef(code, playerId), {
    name: playerName,
    isBot: false,
    card: null,
    marked: null,
    joinedAt: serverTimestamp(),
    claimedWins: [],
  })
  return snap.data()
}

export async function startGame(code, playerIds, cards) {
  for (let i = 0; i < playerIds.length; i++) {
    const initMarked = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => r === 2 && c === 2)
    )
    await updateDoc(playerRef(code, playerIds[i]), {
      card: flattenGrid(cards[i]),
      marked: flattenGrid(initMarked),
    })
  }
  await updateDoc(roomRef(code), { status: 'playing' })
}

export async function callNumber(code, number) {
  await updateDoc(roomRef(code), {
    calledNumbers: arrayUnion(number),
  })
}

export async function setPaused(code, paused) {
  await updateDoc(roomRef(code), { paused })
}

export async function markCell(code, playerId, marked2D) {
  await updateDoc(playerRef(code, playerId), { marked: flattenGrid(marked2D) })
}

export async function claimWin(code, playerId, playerName, winType, card, calledNumbers) {
  const rRef = roomRef(code)
  const pRef = playerRef(code, playerId)

  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(rRef)
    const playerSnap = await tx.get(pRef)
    const roomData = roomSnap.data()
    const playerData = playerSnap.data()

    // Already won globally
    if (roomData.wins[winType] !== null) return

    // Already claimed by this player
    if (playerData.claimedWins.includes(winType)) return

    // Validate claim against called numbers
    const calledSet = new Set(calledNumbers)
    if (!isWinValid(card, calledSet, winType)) return

    tx.update(rRef, {
      [`wins.${winType}`]: {
        playerId,
        playerName,
        calledCount: calledNumbers.length,
      },
    })
    tx.update(pRef, {
      claimedWins: arrayUnion(winType),
    })
  })
}

function isCellValid(card, r, c, calledSet) {
  if (r === 2 && c === 2) return true
  return calledSet.has(card[r][c])
}

function isWinValid(card, calledSet, winType) {
  if (winType === 'row') {
    return [0, 1, 2, 3, 4].some(r =>
      [0, 1, 2, 3, 4].every(c => isCellValid(card, r, c, calledSet))
    )
  }
  if (winType === 'col') {
    return [0, 1, 2, 3, 4].some(c =>
      [0, 1, 2, 3, 4].every(r => isCellValid(card, r, c, calledSet))
    )
  }
  if (winType === 'diagonal') {
    const main = [0, 1, 2, 3, 4].every(i => isCellValid(card, i, i, calledSet))
    const anti = [0, 1, 2, 3, 4].every(i => isCellValid(card, i, 4 - i, calledSet))
    return main || anti
  }
  if (winType === 'house') {
    return [0, 1, 2, 3, 4].every(r =>
      [0, 1, 2, 3, 4].every(c => isCellValid(card, r, c, calledSet))
    )
  }
  return false
}

// ── Listeners ────────────────────────────────────────────────────────────────

export function subscribeRoom(code, callback) {
  return onSnapshot(roomRef(code), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export function subscribePlayers(code, callback) {
  return onSnapshot(
    query(playersRef(code), orderBy('joinedAt')),
    snap => {
      const players = snap.docs.map(d => ({ id: d.id, ...hydratePlayer(d.data()) }))
      callback(players)
    }
  )
}

export async function addBotPlayers(code, bots) {
  for (const bot of bots) {
    await setDoc(playerRef(code, bot.id), {
      name: bot.name,
      isBot: true,
      card: flattenGrid(bot.card),
      marked: flattenGrid(bot.marked),
      joinedAt: serverTimestamp(),
      claimedWins: [],
    })
  }
}
