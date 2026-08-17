'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-[var(--shadow-card)] p-8">
      <h2 className="font-display text-xl font-semibold text-ink mb-6">Entrar</h2>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Input
          id="email"
          label="E-mail"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          id="password"
          label="Senha"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="text-sm text-danger text-center">{error}</p>
        )}

        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2 text-center text-sm">
        <Link
          href="/reset-password"
          className="text-primary hover:underline"
        >
          Esqueci minha senha
        </Link>
        <p className="text-muted">
          Não tem conta?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  )
}
