import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import BingoCard from './BingoCard.jsx'
import NumberCallHistory from './NumberCallHistory.jsx'
import PlayerList from './PlayerList.jsx'
import { getAvailableClaims, getWinningCells } from '../engine/winDetector.js'
import { callNumber, markCell, claimWin, setPaused } from '../firebase/rooms.js'

const CALL_INTERVAL_MS = 5000

const WIN_LABELS = { row: 'ROW', col: 'COL', diagonal: 'DIAGONAL', house: 'HOUSE' }
const WIN_COLORS = {
  row: 'bg-blue-500',
  col: 'bg-purple-500',
  diagonal: 'bg-orange-500',
  house: 'bg-yellow-500 text-slate-900',
}

export default function GameScreen({ config, room, players, goHome }) {
  const { roomCode, playerId, playerName, isHost } = config

  const myPlayer = players.find(p => p.id === playerId)
  const card = myPlayer?.card ?? null
  const marked = myPlayer?.marked ?? null
  const claimedWins = myPlayer?.claimedWins ?? []

  const calledNumbers = room?.calledNumbers ?? []
  const wins = room?.wins ?? { row: null, col: null, diagonal: null, house: null }

  const calledSet = new Set(calledNumbers)
  const lastCalled = calledNumbers[calledNumbers.length - 1]

  // Build a set of numbers the player has actually marked (used for both claim eligibility and win display)
  const markedCalledSet = new Set()
  if (card && marked) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (marked[r][c] && !(r === 2 && c === 2)) markedCalledSet.add(card[r][c])
      }
    }
  }

  // Claim eligibility based on what the player has actually marked, not just called numbers
  const availableClaims = card ? getAvailableClaims(card, markedCalledSet, claimedWins, wins) : []
  const winningCells = card ? getWinningCells(card, markedCalledSet, wins, claimedWins) : new Set()

  // Win notification — show for 5s, then clear
  // prevWinsRef tracks which types were already won so we only flash on new wins
  const [newWin, setNewWin] = useState(null)
  const prevWinsRef = useRef({ row: null, col: null, diagonal: null, house: null })
  const bannerTimerRef = useRef(null)

  useEffect(() => {
    for (const type of ['row', 'col', 'diagonal', 'house']) {
      if (!prevWinsRef.current[type] && wins[type]) {
        prevWinsRef.current = { ...prevWinsRef.current, [type]: wins[type] }
        clearTimeout(bannerTimerRef.current)
        setNewWin({ type, ...wins[type] })
        bannerTimerRef.current = setTimeout(() => setNewWin(null), 5000)
      }
    }
  }, [wins])

  // Manual cell toggle — only allowed if number has been called
  const handleToggleCell = useCallback((r, c) => {
    if (!card || !marked) return
    if (!calledSet.has(card[r][c])) return
    if (marked[r][c]) return // already marked — locked
    const newMarked = marked.map(row => [...row])
    newMarked[r][c] = true
    markCell(roomCode, playerId, newMarked).catch(console.error)
  }, [card, marked, calledSet, roomCode, playerId])

  // Host: call numbers on interval
  const calledRef = useRef(new Set(calledNumbers))
  useEffect(() => { calledRef.current = new Set(calledNumbers) }, [calledNumbers])

  useEffect(() => {
    if (!isHost || !room || room.status !== 'playing') return
    if (room.paused) return

    const allWon = Object.values(wins).every(v => v !== null)
    if (allWon || calledNumbers.length >= 99) {
      updateDoc(doc(db, 'rooms', roomCode), { status: 'finished' }).catch(console.error)
      return
    }

    const interval = setInterval(() => {
      const remaining = []
      for (let n = 1; n <= 99; n++) {
        if (!calledRef.current.has(n)) remaining.push(n)
      }
      if (remaining.length === 0) return
      const num = remaining[Math.floor(Math.random() * remaining.length)]
      callNumber(roomCode, num).catch(console.error)
    }, CALL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isHost, room?.status, room?.paused, calledNumbers.length, wins])

  // Host: bot AI — mark cells and claim wins
  useEffect(() => {
    if (!isHost || !players.length) return
    const bots = players.filter(p => p.isBot && p.card)
    if (!bots.length) return

    bots.forEach(bot => {
      if (!bot.marked) return

      const newMarked = bot.marked.map(row => [...row])
      let changed = false
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!newMarked[r][c] && calledSet.has(bot.card[r][c])) {
            newMarked[r][c] = true
            changed = true
          }
        }
      }
      if (changed) markCell(roomCode, bot.id, newMarked).catch(console.error)

      const botClaimed = bot.claimedWins ?? []
      const available = getAvailableClaims(bot.card, calledSet, botClaimed, wins)
      available.forEach(type => {
        const delay = 800 + Math.random() * 3200
        setTimeout(() => {
          claimWin(roomCode, bot.id, bot.name, type, bot.card, calledNumbers).catch(console.error)
        }, delay)
      })
    })
  }, [calledNumbers.length])

  async function handleClaim(type) {
    if (!card) return
    try {
      await claimWin(roomCode, playerId, playerName, type, card, calledNumbers)
    } catch (e) {
      console.error('Claim failed', e)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-dvh overflow-hidden">
      {/* Win flash banner */}
      {newWin && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-black text-xl shadow-2xl animate-bounce ${WIN_COLORS[newWin.type] || 'bg-white text-slate-900'}`}>
          🎉 {newWin.playerName} wins {WIN_LABELS[newWin.type]}!
        </div>
      )}

      {/* Header bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm font-medium whitespace-nowrap">Latest</div>
          <div className="text-5xl font-black text-yellow-400 min-w-[3rem] text-center">
            {lastCalled ?? '–'}
          </div>
        </div>
        <div className="text-slate-500 text-sm">{calledNumbers.length} / 99 called</div>
        <div className="flex items-center gap-2">
          {isHost ? (
            <button
              onClick={() => setPaused(roomCode, !room?.paused).catch(console.error)}
              className={`font-bold px-4 py-2 rounded-lg text-sm transition-colors ${room?.paused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
            >
              {room?.paused ? '▶ Resume' : '⏸ Pause'}
            </button>
          ) : (
            room?.paused && <span className="text-yellow-400 text-sm font-semibold">⏸ Paused</span>
          )}
          <button
            onClick={async () => {
              if (isHost) {
                await updateDoc(doc(db, 'rooms', roomCode), { status: 'finished' }).catch(console.error)
              }
              goHome()
            }}
            className="font-bold px-4 py-2 rounded-lg text-sm bg-red-900 hover:bg-red-800 text-red-300 transition-colors"
          >
            End Game
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-auto">
        <div className="hidden md:block md:w-52 shrink-0">
          <PlayerList players={players} wins={wins} myPlayerId={playerId} />
        </div>

        <div className="flex-1 flex flex-col items-center gap-4">
          <BingoCard
            card={card}
            marked={marked}
            calledSet={calledSet}
            winningCells={winningCells}
            onToggle={handleToggleCell}
          />

          <div className="flex flex-wrap gap-3 justify-center">
            {['row', 'col', 'diagonal', 'house'].map(type => {
              const globallyWon = wins[type] !== null
              return (
                <button
                  key={type}
                  onClick={() => handleClaim(type)}
                  disabled={globallyWon}
                  className={`font-black text-base px-5 py-2.5 rounded-xl transition-all
                    ${globallyWon
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed line-through'
                      : `${WIN_COLORS[type]} hover:scale-105 shadow-lg cursor-pointer`
                    }`}
                >
                  {globallyWon
                    ? `${WIN_LABELS[type]}: ${wins[type].playerName}`
                    : `CLAIM ${WIN_LABELS[type]}`}
                </button>
              )
            })}
          </div>

          <div className="md:hidden w-full">
            <PlayerList players={players} wins={wins} myPlayerId={playerId} />
          </div>
        </div>

        <div className="md:w-52 shrink-0 min-h-40 md:min-h-0">
          <NumberCallHistory calledNumbers={calledNumbers} />
        </div>
      </div>

      {/* Win status bar */}
      {Object.values(wins).some(v => v !== null) && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap gap-3 justify-center">
          {Object.entries(wins).map(([type, winner]) =>
            winner ? (
              <span key={type} className={`text-xs font-bold px-3 py-1 rounded-full ${WIN_COLORS[type] || 'bg-slate-600'}`}>
                {WIN_LABELS[type]}: {winner.playerName}
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
