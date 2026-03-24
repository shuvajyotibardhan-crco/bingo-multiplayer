export default function NumberCallHistory({ calledNumbers }) {
  const recent = [...calledNumbers].reverse()

  return (
    <div className="bg-slate-800 rounded-2xl p-4 h-full flex flex-col">
      <h3 className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wider">
        Called Numbers ({calledNumbers.length})
      </h3>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {recent.map((n, i) => (
            <span
              key={i}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-bold text-sm
                ${i === 0
                  ? 'bg-yellow-400 text-slate-900 ring-2 ring-yellow-300 ring-offset-1 ring-offset-slate-800'
                  : 'bg-slate-700 text-slate-300'
                }`}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
