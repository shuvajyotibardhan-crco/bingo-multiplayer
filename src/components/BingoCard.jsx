const HEADERS = ['B', 'I', 'N', 'G', 'O']

export default function BingoCard({ card, marked, calledSet, winningCells, onToggle }) {
  if (!card) {
    return (
      <div className="aspect-square w-full max-w-sm bg-slate-800 rounded-2xl flex items-center justify-center">
        <p className="text-slate-500">Loading card…</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto select-none">
      {/* Column headers */}
      <div className="grid grid-cols-5 gap-1 mb-1">
        {HEADERS.map(h => (
          <div key={h} className="flex items-center justify-center font-black text-indigo-400 text-xl py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1">
        {card.map((row, r) =>
          row.map((num, c) => {
            const key = `${r},${c}`
            const isFree = r === 2 && c === 2
            const isCalled = !isFree && calledSet.has(num)
            const isMarked = marked?.[r]?.[c] ?? isFree
            const isWin = winningCells?.has(key)

            let cellClass = 'bingo-cell '
            if (isFree) cellClass += 'cell-free'
            else if (isWin) cellClass += 'cell-win'
            else if (isMarked) cellClass += 'cell-marked'
            else cellClass += 'cell-default'

            return (
              <button
                key={key}
                className={cellClass}
                onClick={() => onToggle?.(r, c)}
                disabled={isFree || !isCalled || isMarked}
                style={{ fontSize: 'clamp(12px, 3vw, 20px)' }}
              >
                {isFree ? 'FREE' : num}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
