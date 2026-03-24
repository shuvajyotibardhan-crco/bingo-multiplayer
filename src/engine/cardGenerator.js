function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Generate cards for all players using the uniqueness algorithm:
 *
 * totalSlots = playerCount * 24
 * fFloor = floor(totalSlots / 99)
 * remainder = totalSlots - fFloor * 99
 *
 * Numbers 1..remainder appear (fFloor + 1) times across all cards.
 * Numbers (remainder+1)..99 appear fFloor times.
 *
 * Total = remainder*(fFloor+1) + (99-remainder)*fFloor = totalSlots ✓
 *
 * Returns an array of 5x5 grids. Center cell [2][2] is 0 (FREE).
 */
export function generateCards(playerCount) {
  const totalSlots = playerCount * 24
  const fFloor = Math.floor(totalSlots / 99)
  const remainder = totalSlots - fFloor * 99

  const pool = []
  for (let n = 1; n <= 99; n++) {
    const count = n <= remainder ? fFloor + 1 : fFloor
    for (let i = 0; i < count; i++) pool.push(n)
  }

  shuffle(pool)

  const cards = []
  for (let p = 0; p < playerCount; p++) {
    const slice = pool.slice(p * 24, (p + 1) * 24)
    const grid = []
    let idx = 0
    for (let r = 0; r < 5; r++) {
      const row = []
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          row.push(0) // FREE
        } else {
          row.push(slice[idx++])
        }
      }
      grid.push(row)
    }
    cards.push(grid)
  }
  return cards
}

export function generateRoomCode() {
  // Avoids visually ambiguous characters (0/O, 1/I, etc.)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function generatePlayerId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export function getOrCreatePlayerId() {
  let pid = localStorage.getItem('bingoPlayerId')
  if (!pid) {
    pid = generatePlayerId()
    localStorage.setItem('bingoPlayerId', pid)
  }
  return pid
}
