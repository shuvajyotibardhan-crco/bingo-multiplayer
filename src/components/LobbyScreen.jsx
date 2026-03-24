import { useState } from 'react'
import { generateCards } from '../engine/cardGenerator.js'
import { startGame } from '../firebase/rooms.js'

export default function LobbyScreen({ config, players, room, goHome }) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const isHost = config.isHost
  const code = config.roomCode
  const needed = room?.playerCount ?? config.playerCount
  const joined = players.length
  const canStart = isHost && joined >= needed

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const cards = generateCards(players.length)
      const playerIds = players.map(p => p.id)
      await startGame(code, playerIds, cards)
      // Phase transition happens via onSnapshot in App.jsx
    } catch (e) {
      setError(e.message || 'Failed to start')
      setStarting(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => {})
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Waiting Room</h2>
        <p className="text-slate-400 mt-1">
          {isHost ? 'Share this code with other players' : 'Waiting for the host to start…'}
        </p>
      </div>

      {/* Room code */}
      <div
        onClick={copyCode}
        className="bg-slate-800 border-2 border-indigo-500 rounded-2xl px-10 py-6 text-center cursor-pointer hover:bg-slate-700 transition-colors select-all"
        title="Click to copy"
      >
        <p className="text-slate-400 text-sm mb-1">Room Code</p>
        <p className="text-5xl font-black tracking-widest text-indigo-300 font-mono">{code}</p>
        <p className="text-slate-500 text-xs mt-2">Tap to copy</p>
      </div>

      {/* Player list */}
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-slate-300 font-semibold">Players</h3>
          <span className="text-slate-400 text-sm">{joined} / {needed}</span>
        </div>
        <div className="flex flex-col gap-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-slate-700 rounded-lg px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-white font-medium">{p.name}</span>
              {p.id === room?.hostId && (
                <span className="ml-auto text-xs text-indigo-400 font-medium">HOST</span>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, needed - joined) }, (_, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-4 py-2 border border-dashed border-slate-600">
              <div className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-slate-500 text-sm">Waiting…</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isHost && (
        <button
          onClick={handleStart}
          disabled={!canStart || starting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-xl text-xl transition-colors shadow-lg w-full max-w-sm"
        >
          {starting ? 'Starting…' : canStart ? 'Start Game' : `Need ${needed - joined} more player${needed - joined !== 1 ? 's' : ''}`}
        </button>
      )}

      <button onClick={goHome} className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
        ← Leave room
      </button>
    </div>
  )
}
