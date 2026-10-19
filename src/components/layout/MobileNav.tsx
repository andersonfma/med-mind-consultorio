'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FEED_ROUTE, CHALLENGE_ROUTE, RANKING_ROUTE, EDIT_PROFILE_ROUTE, DASHBOARD_ROUTE } from '@/lib/routes'

const ITEMS = [
  { href: DASHBOARD_ROUTE, label: 'Consultório', icon: 'M9 3v2a3 3 0 0 0 6 0V3M6 5a3 3 0 0 0-3 3v3a6 6 0 0 0 12 0V8a3 3 0 0 0-3-3M15 14v2a4 4 0 0 1-8 0M19 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z' },
  { href: FEED_ROUTE, label: 'Feed', icon: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z' },
  { href: CHALLENGE_ROUTE, label: 'Desafio', icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { href: RANKING_ROUTE, label: 'Ranking', icon: 'M6 20V10M12 20V4M18 20v-7' },
  { href: EDIT_PROFILE_ROUTE, label: 'Perfil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0' },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md sm:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map(it => {
          const active = pathname === it.href || (it.href !== '/feed' && pathname.startsWith(it.href))
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${active ? 'text-primary' : 'text-muted'}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
