import { useState } from 'react'
import { generateCards } from '../engine/cardGenerator.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawCard(doc, card, playerLabel, x, y, cellSize) {
  const headerH = 8
  const gridSize = cellSize * 5

  // Player label
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60, 60, 60)
  doc.text(playerLabel, x + gridSize / 2, y, { align: 'center' })

  // BINGO header row
  const bingoLetters = ['B', 'I', 'N', 'G', 'O']
  const headerY = y + headerH
  doc.setFillColor(79, 70, 229)
  doc.rect(x, headerY, gridSize, cellSize, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  bingoLetters.forEach((letter, c) => {
    const cx = x + c * cellSize + cellSize / 2
    const cy = headerY + cellSize / 2 + 3.5
    doc.text(letter, cx, cy, { align: 'center' })
  })

  // Grid cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = x + c * cellSize
      const cy = headerY + (r + 1) * cellSize
      const isFree = r === 2 && c === 2

      if (isFree) {
        doc.setFillColor(237, 233, 254)
      } else {
        doc.setFillColor(r % 2 === c % 2 ? 249 : 255, 250, 251)
      }
      doc.rect(cx, cy, cellSize, cellSize, 'FD')

      doc.setDrawColor(200, 200, 210)
      doc.setLineWidth(0.3)
      doc.rect(cx, cy, cellSize, cellSize, 'S')

      if (isFree) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bolditalic')
        doc.setTextColor(109, 40, 217)
        doc.text('FREE', cx + cellSize / 2, cy + cellSize / 2 + 2, { align: 'center' })
      } else {
        const num = card[r][c]
        doc.setFontSize(num >= 10 ? 11 : 12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text(String(num), cx + cellSize / 2, cy + cellSize / 2 + 3.5, { align: 'center' })
      }
    }
  }

  // Outer border
  doc.setDrawColor(79, 70, 229)
  doc.setLineWidth(0.8)
  doc.rect(x, headerY, gridSize, cellSize * 6, 'S')
}

async function generatePDF(playerCount, cards, callList) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 12
  const cellSize = 14
  const cardW = cellSize * 5
  const cardH = cellSize * 7 // header row + 5 rows + label space

  // Two cards per row, two rows per page = 4 per page
  const cols = 2
  const colGap = (pageW - margin * 2 - cardW * cols) / (cols - 1)
  const rowGap = 16
  let cardIdx = 0
  let pageCardCount = 0

  const startX = (i) => margin + i * (cardW + colGap)
  const startY = (i) => margin + i * (cardH + rowGap)

  for (let p = 0; p < playerCount; p++) {
    if (pageCardCount === 4) {
      doc.addPage()
      pageCardCount = 0
    }
    const col = pageCardCount % cols
    const row = Math.floor(pageCardCount / cols)
    drawCard(doc, cards[p], `Player ${p + 1}`, startX(col), startY(row), cellSize)
    pageCardCount++
  }

  // Call-out list page
  doc.addPage()
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(79, 70, 229)
  doc.text('CALL-OUT LIST', pageW / 2, margin + 4, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`${playerCount} players · ${callList.length} numbers · read each number aloud and cross it off`, pageW / 2, margin + 10, { align: 'center' })

  // Draw numbers in a grid: 11 per row
  const numCols = 11
  const numW = (pageW - margin * 2) / numCols
  const numH = 8
  const listStartY = margin + 18

  callList.forEach((num, i) => {
    const col = i % numCols
    const row = Math.floor(i / numCols)
    const nx = margin + col * numW
    const ny = listStartY + row * numH
    const order = i + 1

    // Alternating row shading
    if (row % 2 === 0) {
      doc.setFillColor(245, 245, 255)
      if (col === 0) doc.rect(margin, ny, pageW - margin * 2, numH, 'F')
    }

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text(`${order}.`, nx + 1.5, ny + numH / 2 + 2)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(String(num), nx + numW / 2 + 2, ny + numH / 2 + 2.5, { align: 'center' })
  })

  // Box around whole call list
  const listRows = Math.ceil(callList.length / numCols)
  doc.setDrawColor(200, 200, 210)
  doc.setLineWidth(0.3)
  doc.rect(margin, listStartY, pageW - margin * 2, listRows * numH, 'S')

  doc.save(`bingo-paper-${playerCount}players.pdf`)
}

export default function PaperScreen({ goHome }) {
  const [playerCount, setPlayerCount] = useState(4)
  const [generated, setGenerated] = useState(null)

  function handleGenerate() {
    const cards = generateCards(playerCount)
    const callList = shuffle(Array.from({ length: 99 }, (_, i) => i + 1))
    setGenerated({ cards, callList })
  }

  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!generated) return
    setDownloading(true)
    await generatePDF(playerCount, generated.cards, generated.callList)
    setDownloading(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-widest text-indigo-400 drop-shadow-lg">
          BINGO
        </h1>
        <p className="text-slate-400 mt-1 text-base">Paper / Offline Mode</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 shadow-xl">
        <div className="flex flex-col gap-2">
          <label className="text-slate-300 font-semibold text-sm">
            Number of Players
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPlayerCount(p => Math.max(2, p - 1)); setGenerated(null) }}
              className="bg-slate-700 hover:bg-slate-600 text-white w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center"
            >-</button>
            <span className="text-white text-2xl font-bold w-12 text-center">{playerCount}</span>
            <button
              onClick={() => { setPlayerCount(p => Math.min(20, p + 1)); setGenerated(null) }}
              className="bg-slate-700 hover:bg-slate-600 text-white w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center"
            >+</button>
          </div>
          <p className="text-slate-500 text-xs text-center">2 – 20 players</p>
        </div>

        <button
          onClick={handleGenerate}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors shadow-lg"
        >
          Generate Cards
        </button>

        {generated && (
          <div className="flex flex-col gap-3">
            <div className="bg-slate-700 rounded-xl p-4 text-center">
              <p className="text-emerald-400 font-bold text-sm">Ready to download</p>
              <p className="text-slate-300 text-xs mt-1">
                {playerCount} bingo card{playerCount > 1 ? 's' : ''} + call-out list (99 numbers)
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors shadow-lg"
            >
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={goHome}
        className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        ← Back to Home
      </button>
    </div>
  )
}
