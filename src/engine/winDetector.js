// card: 5x5 number[][], 0 = FREE cell at [2][2]
// calledSet: Set<number>

function isCellValid(card, r, c, calledSet) {
  if (r === 2 && c === 2) return true // FREE always valid
  return calledSet.has(card[r][c])
}

export function checkRow(card, calledSet) {
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every(c => isCellValid(card, r, c, calledSet))) return r
  }
  return -1
}

export function checkCol(card, calledSet) {
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every(r => isCellValid(card, r, c, calledSet))) return c
  }
  return -1
}

export function checkDiagonal(card, calledSet) {
  const main = [0, 1, 2, 3, 4].every(i => isCellValid(card, i, i, calledSet))
  if (main) return 0
  const anti = [0, 1, 2, 3, 4].every(i => isCellValid(card, i, 4 - i, calledSet))
  if (anti) return 1
  return -1
}

export function checkHouse(card, calledSet) {
  return [0, 1, 2, 3, 4].every(r =>
    [0, 1, 2, 3, 4].every(c => isCellValid(card, r, c, calledSet))
  )
}

/**
 * Returns an array of win types available to claim right now.
 * Excludes types already won globally or already claimed by this player.
 */
export function getAvailableClaims(card, calledSet, claimedWins, globalWins) {
  const available = []
  if (!globalWins.row && !claimedWins.includes('row') && checkRow(card, calledSet) >= 0) {
    available.push('row')
  }
  if (!globalWins.col && !claimedWins.includes('col') && checkCol(card, calledSet) >= 0) {
    available.push('col')
  }
  if (!globalWins.diagonal && !claimedWins.includes('diagonal') && checkDiagonal(card, calledSet) >= 0) {
    available.push('diagonal')
  }
  if (!globalWins.house && !claimedWins.includes('house') && checkHouse(card, calledSet)) {
    available.push('house')
  }
  return available
}

/**
 * Returns the set of cells [r][c] that form a winning pattern for display.
 * Used to highlight winning cells on the board.
 */
export function getWinningCells(card, calledSet, globalWins, claimedWins) {
  const winning = new Set()

  const mark = (cells) => cells.forEach(([r, c]) => winning.add(`${r},${c}`))

  const rowIdx = checkRow(card, calledSet)
  if (rowIdx >= 0 && globalWins.row) {
    mark([0, 1, 2, 3, 4].map(c => [rowIdx, c]))
  }

  const colIdx = checkCol(card, calledSet)
  if (colIdx >= 0 && globalWins.col) {
    mark([0, 1, 2, 3, 4].map(r => [r, colIdx]))
  }

  const diagIdx = checkDiagonal(card, calledSet)
  if (diagIdx >= 0 && globalWins.diagonal) {
    if (diagIdx === 0) mark([0, 1, 2, 3, 4].map(i => [i, i]))
    else mark([0, 1, 2, 3, 4].map(i => [i, 4 - i]))
  }

  if (globalWins.house && checkHouse(card, calledSet)) {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) winning.add(`${r},${c}`)
  }

  return winning
}
