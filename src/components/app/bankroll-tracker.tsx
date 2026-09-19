import React, { useState } from 'react'
import { useBankrollStore, useBankrollStats } from '@/lib/bankroll-store'
import { TrendingUp, TrendingDown, Trash2, Plus, Minus } from 'lucide-react'

const Sparkline = ({ data }: { data: number[] }) => {
  if (data.length < 1) return null

  const width = 300
  const height = 100
  const plotData = [0, ...data]
  const min = Math.min(0, ...plotData)
  const max = Math.max(0, ...plotData)
  const range = max - min || 1

  const points = plotData.map((val, i) => {
    const x = (i / (plotData.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const isPositive = plotData[plotData.length - 1] >= 0

  return (
    <div className="w-full h-[100px] my-6 relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        {/* Zero line */}
        <line x1="0" y1={height - ((0 - min) / range) * height} x2={width} y2={height - ((0 - min) / range) * height} stroke="#27272a" strokeWidth="1" strokeDasharray="4" />
        <polyline
          fill="none"
          stroke={isPositive ? '#10b981' : '#ef4444'}
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  )
}

export function BankrollTracker() {
  const { entries, addEntry, removeEntry, clearAll } = useBankrollStore()
  const stats = useBankrollStats()

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const handleAdd = (type: 'win' | 'loss') => {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return
    addEntry({ type, amount: val, note })
    setAmount('')
    setNote('')
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all bankroll data?')) {
      clearAll()
    }
  }

  return (
    <div className="bg-panel rounded-lg border border-line p-6 max-w-2xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <h2 className="text-xl font-display text-ink font-semibold">Bankroll Tracker</h2>
        <div className={`text-3xl font-mono font-bold ${stats.netProfit >= 0 ? 'text-neon' : 'text-red-500'}`}>
          {stats.netProfit >= 0 ? '+' : '-'}${Math.abs(stats.netProfit).toFixed(2)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
        <div className="bg-obsidian border border-line rounded-lg p-3 text-center">
          <div className="text-muted mb-1 text-xs">Total Wins</div>
          <div className="text-ink font-mono font-semibold">{stats.totalWins}</div>
        </div>
        <div className="bg-obsidian border border-line rounded-lg p-3 text-center">
          <div className="text-muted mb-1 text-xs">Total Losses</div>
          <div className="text-ink font-mono font-semibold">{stats.totalLosses}</div>
        </div>
        <div className="bg-obsidian border border-line rounded-lg p-3 text-center">
          <div className="text-muted mb-1 text-xs">ROI</div>
          <div className="text-ink font-mono font-semibold">{stats.roi.toFixed(1)}%</div>
        </div>
        <div className="bg-obsidian border border-line rounded-lg p-3 text-center">
          <div className="text-muted mb-1 text-xs">Streak</div>
          <div className="text-ink font-mono font-semibold">{stats.currentStreak}</div>
        </div>
      </div>

      <Sparkline data={stats.chartData} />

      <div className="bg-obsidian border border-line rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs text-muted block mb-1">Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-panel border border-line rounded p-2 text-ink text-sm font-mono focus:outline-none focus:border-primary"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="text-xs text-muted block mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-panel border border-line rounded p-2 text-ink text-sm focus:outline-none focus:border-primary"
            placeholder="e.g. Lakers ML"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleAdd('win')}
            className="flex-1 sm:flex-none bg-neon/10 text-neon hover:bg-neon/20 border border-neon/20 px-4 py-2 rounded flex items-center justify-center gap-1 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Win
          </button>
          <button
            onClick={() => handleAdd('loss')}
            className="flex-1 sm:flex-none bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 px-4 py-2 rounded flex items-center justify-center gap-1 text-sm font-medium transition-colors"
          >
            <Minus className="w-4 h-4" /> Loss
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ink">Recent Entries</h3>
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="text-xs text-muted hover:text-red-500 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted bg-obsidian rounded-lg border border-line border-dashed">
            No entries yet. Add your first win or loss above.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between bg-obsidian border border-line p-3 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className={`text-xs font-bold px-2 py-1 rounded w-12 text-center ${entry.type === 'win' ? 'bg-neon/10 text-neon' : 'bg-red-500/10 text-red-500'}`}>
                    {entry.type === 'win' ? 'WIN' : 'LOSS'}
                  </div>
                  <div>
                    <div className="text-ink font-mono font-medium">${entry.amount.toFixed(2)}</div>
                    <div className="text-xs text-muted">
                      {new Date(entry.date).toLocaleDateString()} {entry.note && <span className="text-ink opacity-80">• {entry.note}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-2 text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                  title="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
