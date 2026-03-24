const WIN_LABELS = { row: 'ROW', col: 'COL', diagonal: 'DIAG', house: 'HOUSE' }
const WIN_COLORS = {
  row: 'bg-blue-600 text-blue-100',
  col: 'bg-purple-600 text-purple-100',
  diagonal: 'bg-orange-600 text-orange-100',
  house: 'bg-yellow-500 text-yellow-900',
}

export default function PlayerList({ players, wins, myPlayerId }) {
  return (
    <div className="bg-slate-800 rounded-2xl p-4 flex flex-col gap-2">
      <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Players</h3>
      {players.map(p => {
        const myWins = Object.entries(wins)
          .filter(([, v]) => v?.playerId === p.id)
          .map(([type]) => type)

        return (
          <div
            key={p.id}
            className={`flex flex-col rounded-xl px-3 py-2 gap-1 ${p.id === myPlayerId ? 'bg-indigo-900/40 border border-indigo-700' : 'bg-slate-700'}`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${p.isBot ? 'bg-slate-400' : 'bg-emerald-400'}`} />
              <span className="text-white font-medium text-sm truncate flex-1">{p.name}</span>
              {p.id === myPlayerId && <span className="text-indigo-400 text-xs">YOU</span>}
              {p.isBot && <span className="text-slate-500 text-xs">BOT</span>}
            </div>
            {myWins.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {myWins.map(type => (
                  <span key={type} className={`text-xs font-bold px-2 py-0.5 rounded ${WIN_COLORS[type]}`}>
                    {WIN_LABELS[type]}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
