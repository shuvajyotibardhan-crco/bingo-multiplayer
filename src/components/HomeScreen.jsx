export default function HomeScreen({ setPhase, setConfig }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-7xl font-black tracking-widest text-indigo-400 drop-shadow-lg">
          BINGO
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Multiplayer number bingo</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => {
            setConfig(prev => ({ ...prev, isHost: true, mode: 'human' }))
            setPhase('setup')
          }}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors shadow-lg"
        >
          Create Game
        </button>

        <button
          onClick={() => setPhase('join')}
          className="bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors shadow-lg"
        >
          Join Game
        </button>

        <button
          onClick={() => {
            setConfig(prev => ({ ...prev, isHost: true, mode: 'bot' }))
            setPhase('setup')
          }}
          className="bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors shadow-lg"
        >
          Play vs Computer
        </button>
      </div>
    </div>
  )
}
