import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EntryType = 'win' | 'loss'

export interface BankrollEntry {
  id: string
  date: string
  type: EntryType
  amount: number
  note?: string
}

export interface BankrollState {
  entries: BankrollEntry[]
  addEntry: (entry: Omit<BankrollEntry, 'id' | 'date'>) => void
  removeEntry: (id: string) => void
  clearAll: () => void
}

export const useBankrollStore = create<BankrollState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            {
              ...entry,
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
            },
            ...state.entries,
          ],
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'sportslock-bankroll-storage',
    }
  )
)

export const useBankrollStats = () => {
  const entries = useBankrollStore((state) => state.entries)

  let totalWins = 0
  let totalLosses = 0
  let winAmount = 0
  let lossAmount = 0
  let currentStreak = 0
  let streakType: 'win' | 'loss' | null = null

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.type === 'win') {
      totalWins++
      winAmount += entry.amount
      if (streakType === null || streakType === 'win') {
        streakType = 'win'
        if (i === currentStreak) currentStreak++
      }
    } else {
      totalLosses++
      lossAmount += entry.amount
      if (streakType === null || streakType === 'loss') {
        streakType = 'loss'
        if (i === currentStreak) currentStreak++
      }
    }
  }

  const netProfit = winAmount - lossAmount
  const totalAmount = winAmount + lossAmount
  const roi = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0
  
  const chronological = [...entries].reverse()
  let running = 0
  const chartData = chronological.map(e => {
    running += e.type === 'win' ? e.amount : -e.amount
    return running
  })

  return {
    totalWins,
    totalLosses,
    netProfit,
    roi,
    currentStreak: streakType ? `${currentStreak}${streakType === 'win' ? 'W' : 'L'}` : '-',
    chartData
  }
}
