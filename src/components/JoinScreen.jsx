import { useState } from 'react'
import { joinRoom } from '../firebase/rooms.js'

export default function JoinScreen({ config, setConfig, setPhase, goHome }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    const trimCode = code.trim().toUpperCase()
    const trimName = name.trim()
    if (trimCode.length !== 5) { setError('Enter the 5-character room code'); return }
    if (!trimName) { setError('Enter your name'); return }
    setLoading(true)
    setError('')
    try {
      await joinRoom(trimCode, config.playerId, trimName)
      setConfig(prev => ({
        ...prev,
        roomCode: trimCode,
        playerName: trimName,
        isHost: false,
      }))
      setPhase('lobby')
    } catch (e) {
      setError(e.message || 'Could not join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Join Game</h2>
        <p className="text-slate-400 mt-1">Enter the room code from the host</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-xl">
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-2">Room Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 5))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="XXXXX"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 text-2xl tracking-widest font-mono text-center uppercase"
            autoFocus
          />
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-2">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 text-lg"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-lg transition-colors"
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>

        <button onClick={goHome} className="text-slate-400 hover:text-slate-300 text-sm transition-colors">
          ← Back
        </button>
      </div>
    </div>
  )
}
