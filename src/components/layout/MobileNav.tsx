'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FEED_ROUTE, RESULTS_ROUTE, RANKING_ROUTE, EDIT_PROFILE_ROUTE } from '@/lib/routes'

const ITEMS = [
  { href: FEED_ROUTE, label: 'Feed', icon: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z' },
  { href: RESULTS_ROUTE, label: 'Resultados', icon: 'M4 5h16M4 12h16M4 19h10' },
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
