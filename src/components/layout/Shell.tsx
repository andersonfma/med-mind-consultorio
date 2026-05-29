import { type ReactNode } from 'react'
import Link from 'next/link'
import { LogoutButton } from './LogoutButton'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-gray-900">
            Med Mind
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">Módulo Consultório</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
