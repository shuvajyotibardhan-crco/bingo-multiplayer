import { useState, useEffect, useRef, useCallback } from 'react'
import HomeScreen from './components/HomeScreen.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import JoinScreen from './components/JoinScreen.jsx'
import LobbyScreen from './components/LobbyScreen.jsx'
import GameScreen from './components/GameScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import PaperScreen from './components/PaperScreen.jsx'
import { getOrCreatePlayerId } from './engine/cardGenerator.js'
import { subscribeRoom, subscribePlayers } from './firebase/rooms.js'

export default function App() {
  const [phase, setPhase] = useState('home') // home | setup | join | lobby | game | results | paper
  const [config, setConfig] = useState({
    roomCode: null,
    playerId: getOrCreatePlayerId(),
    playerName: null,
    isHost: false,
    mode: null, // 'human' | 'bot'
    playerCount: 2,
  })

  // Live Firestore data
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])

  const unsubRoom = useRef(null)
  const unsubPlayers = useRef(null)

  // Subscribe to Firestore whenever we have a roomCode and are past home/setup
  useEffect(() => {
    if (!config.roomCode || phase === 'home' || phase === 'setup' || phase === 'join') return

    unsubRoom.current?.()
    unsubPlayers.current?.()

    unsubRoom.current = subscribeRoom(config.roomCode, (data) => {
      setRoom(data)
      if (data) {
        if (data.status === 'playing' && phase === 'lobby') setPhase('game')
        if (data.status === 'finished' && phase === 'game') setPhase('results')
      }
    })

    unsubPlayers.current = subscribePlayers(config.roomCode, setPlayers)

    return () => {
      unsubRoom.current?.()
      unsubPlayers.current?.()
    }
  }, [config.roomCode, phase])

  // Also drive phase from room.status after subscription starts
  useEffect(() => {
    if (!room) return
    if (room.status === 'playing' && phase === 'lobby') setPhase('game')
    if (room.status === 'finished' && phase === 'game') setPhase('results')
  }, [room?.status])

  const goHome = useCallback(() => {
    unsubRoom.current?.()
    unsubPlayers.current?.()
    setRoom(null)
    setPlayers([])
    setConfig(prev => ({
      ...prev,
      roomCode: null,
      isHost: false,
      mode: null,
      playerCount: 2,
      playerName: null,
    }))
    setPhase('home')
  }, [])

  const commonProps = { config, setConfig, setPhase, room, players, goHome }

  return (
    <div className="min-h-dvh flex flex-col">
      {phase === 'home' && <HomeScreen {...commonProps} />}
      {phase === 'setup' && <SetupScreen {...commonProps} />}
      {phase === 'join' && <JoinScreen {...commonProps} />}
      {phase === 'lobby' && <LobbyScreen {...commonProps} />}
      {phase === 'game' && <GameScreen {...commonProps} />}
      {phase === 'results' && <ResultsScreen {...commonProps} />}
      {phase === 'paper' && <PaperScreen goHome={goHome} />}
    </div>
  )
}
