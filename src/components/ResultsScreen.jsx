const WIN_LABELS = { row: 'Row Winner', col: 'Column Winner', diagonal: 'Diagonal Winner', house: 'HOUSE!' }
const WIN_ICONS = { row: '➡️', col: '⬇️', diagonal: '↗️', house: '🏆' }
const WIN_COLORS = {
  row: 'border-blue-500 bg-blue-900/30',
  col: 'border-purple-500 bg-purple-900/30',
  diagonal: 'border-orange-500 bg-orange-900/30',
  house: 'border-yellow-400 bg-yellow-900/30',
}

export default function ResultsScreen({ room, players, config, goHome }) {
  const wins = room?.wins ?? {}
  const getPlayerName = (id) => players.find(p => p.id === id)?.name ?? id

  const allWins = Object.entries(wins)
    .filter(([, v]) => v !== null)
    .sort((a, b) => (a[0] === 'house' ? 1 : 0) - (b[0] === 'house' ? 1 : 0))

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h2 className="text-5xl font-black text-white">Game Over!</h2>
        <p className="text-slate-400 mt-2">{room?.calledNumbers?.length ?? 0} numbers were called</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        {allWins.map(([type, winner]) => (
          <div
            key={type}
            className={`border-2 rounded-2xl p-5 flex items-center gap-4 ${WIN_COLORS[type]}`}
          >
            <span className="text-4xl">{WIN_ICONS[type]}</span>
            <div>
              <p className="text-slate-400 text-sm">{WIN_LABELS[type]}</p>
              <p className="text-white font-bold text-xl">
                {winner.playerName}
                {winner.playerId === config.playerId && (
                  <span className="ml-2 text-indigo-400 text-sm font-normal">(You!)</span>
                )}
              </p>
            </div>
          </div>
        ))}

        {allWins.length === 0 && (
          <p className="text-slate-500 text-center">No one claimed a win!</p>
        )}
      </div>

      {/* All players */}
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-md">
        <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-3">All Players</h3>
        {players.map(p => {
          const theirWins = Object.entries(wins)
            .filter(([, v]) => v?.playerId === p.id)
            .map(([t]) => WIN_LABELS[t])
          return (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
              <span className="text-white font-medium flex-1">{p.name}</span>
              {theirWins.length > 0
                ? <span className="text-emerald-400 text-sm">{theirWins.join(', ')}</span>
                : <span className="text-slate-600 text-sm">—</span>
              }
            </div>
          )
        })}
      </div>

      <button
        onClick={goHome}
        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-10 rounded-xl text-xl transition-colors shadow-lg"
      >
        Play Again
      </button>
    </div>
  )
}
