'use client'

import { useState } from 'react'
import type { Leaderboard, LeaderRow } from '@/lib/scoring/leaderboard'

function medal(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

function Row({ row }: { row: LeaderRow }) {
  const m = medal(row.rank)
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
        row.isMe ? 'bg-primary/10 ring-1 ring-primary/30' : 'odd:bg-surface-2/40'
      }`}
    >
      <span className="w-8 shrink-0 text-center font-display text-base font-bold tabular-nums text-muted">
        {m ?? row.rank}
      </span>
      <span className={`flex-1 truncate text-sm ${row.isMe ? 'font-semibold text-primary' : 'text-ink'}`}>
        {row.name}
      </span>
      <span className="shrink-0 text-xs text-muted tabular-nums">{row.cases} casos</span>
      <span className="w-20 shrink-0 text-right font-display text-base font-bold tabular-nums text-ink">
        {row.xp.toLocaleString('pt-BR')}
        <span className="ml-1 text-[10px] font-medium uppercase text-muted">MC</span>
      </span>
    </li>
  )
}

function Board({ board }: { board: Leaderboard }) {
  if (board.top.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
        Ainda não há MedCoin neste período. Conclua uma consulta ou o desafio do dia para aparecer aqui.
      </p>
    )
  }

  const meInTop = board.me && board.top.some(r => r.isMe)

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {board.top.map(row => (
          <Row key={row.rank} row={row} />
        ))}
      </ol>
      {board.me && !meInTop && (
        <>
          <p className="px-3 pt-1 text-center text-xs text-muted">··· sua posição ···</p>
          <ol>
            <Row row={board.me} />
          </ol>
        </>
      )}
    </div>
  )
}

export function RankingTabs({ week, all }: { week: Leaderboard; all: Leaderboard }) {
  const [tab, setTab] = useState<'week' | 'all'>('week')
  const board = tab === 'week' ? week : all

  return (
    <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="mb-3 inline-flex rounded-lg border border-border bg-surface-2/40 p-0.5">
        {(['week', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t === 'week' ? 'Semana' : 'Geral'}
          </button>
        ))}
      </div>
      <Board board={board} />
    </section>
  )
}
