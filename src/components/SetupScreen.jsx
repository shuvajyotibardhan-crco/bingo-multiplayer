import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { generateRoomCode, generateCards } from '../engine/cardGenerator.js'
import { createRoom, addBotPlayers, markCell } from '../firebase/rooms.js'

const BOT_NAMES = ['Ace', 'Blaze', 'Comet', 'Duke', 'Echo', 'Frost', 'Ghost', 'Hawk']

function makeInitMarked() {
  return Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r === 2 && c === 2)
  )
}

export default function SetupScreen({ config, setConfig, setPhase, goHome }) {
  const [name, setName] = useState('')
  const [playerCount, setPlayerCount] = useState(config.mode === 'bot' ? 4 : 2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isBot = config.mode === 'bot'

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Please enter your name'); return }
    setLoading(true)
    setError('')
    try {
      const code = generateRoomCode()
      const cards = generateCards(playerCount)

      await createRoom(code, config.playerId, trimmed, config.mode, playerCount)

      if (isBot) {
        // Add bot players with pre-generated cards
        const bots = Array.from({ length: playerCount - 1 }, (_, i) => ({
          id: `bot_${i}`,
          name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
          card: cards[i + 1],
          marked: makeInitMarked(),
        }))
        await addBotPlayers(code, bots)

        // Give the host their card and start immediately
        await markCell(code, config.playerId, makeInitMarked())
        // markCell only updates marked — also set card via updateDoc with flat array
        await updateDoc(doc(db, 'rooms', code, 'players', config.playerId), {
          card: cards[0].flat(),
        })
        await updateDoc(doc(db, 'rooms', code), { status: 'playing' })
      }

      setConfig(prev => ({
        ...prev,
        roomCode: code,
        playerName: trimmed,
        playerCount,
        isHost: true,
      }))
      setPhase('lobby')
    } catch (e) {
      setError(e.message || 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">
          {isBot ? 'Play vs Computer' : 'Create Game'}
        </h2>
        <p className="text-slate-400 mt-1">
          {isBot ? 'Set up your game' : 'Others will join with your room code'}
        </p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-xl">
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-2">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 text-lg"
            autoFocus
          />
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-2">
            {isBot ? 'Total Players (you + bots)' : 'Number of Players'}
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlayerCount(p => Math.max(2, p - 1))}
              className="bg-slate-700 hover:bg-slate-600 text-white w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center"
            >−</button>
            <span className="text-white text-2xl font-bold w-12 text-center">{playerCount}</span>
            <button
              onClick={() => setPlayerCount(p => Math.min(8, p + 1))}
              className="bg-slate-700 hover:bg-slate-600 text-white w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center"
            >+</button>
          </div>
          {isBot && (
            <p className="text-slate-500 text-sm mt-1">
              {playerCount - 1} bot{playerCount - 1 !== 1 ? 's' : ''} will join you
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-lg transition-colors"
        >
          {loading ? 'Setting up…' : isBot ? 'Start Game' : 'Create Room'}
        </button>

        <button onClick={goHome} className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
          ← Back
        </button>
      </div>
    </div>
  )
}
