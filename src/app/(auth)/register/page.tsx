'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FACULTIES } from '@/lib/faculties'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [crm, setCrm] = useState('')
  const [userType, setUserType] = useState<'student' | 'doctor'>('student')
  const [faculty, setFaculty] = useState('')
  const [period, setPeriod] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!fullName.trim()) {
      setError('Nome completo é obrigatório.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName.trim(),
          crm: crm.trim() || null,
          user_type: userType,
          faculty: faculty.trim() || null,
          faculty_period: period.trim() || null,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setEmailSent(true)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (emailSent) {
    return (
      <div className="bg-surface rounded-xl border border-border shadow-[var(--shadow-card)] p-8 text-center">
        <h2 className="font-display text-xl font-semibold text-ink mb-3">Confirme seu e-mail</h2>
        <p className="text-sm text-muted">
          Enviamos um link de confirmação para <strong>{email}</strong>.
          Verifique sua caixa de entrada e clique no link para ativar sua conta.
        </p>
        <p className="text-xs text-muted mt-3">Não recebeu? Verifique a pasta de spam.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-[var(--shadow-card)] p-8">
      <h2 className="font-display text-xl font-semibold text-ink mb-6">Criar conta</h2>

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <Input
          id="fullName"
          label="Nome completo"
          type="text"
          name="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />
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
          autoComplete="new-password"
          minLength={6}
        />
        <div>
          <span className="text-sm font-medium text-ink">Você é</span>
          <div className="mt-1 flex gap-2">
            {(['student', 'doctor'] as const).map((t) => (
              <button type="button" key={t} onClick={() => setUserType(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${userType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}>
                {t === 'student' ? 'Estudante' : 'Médico(a)'}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-ink">{userType === 'doctor' ? 'Onde se formou' : 'Faculdade'}</span>
          <input list="faculties" value={faculty} onChange={(e) => setFaculty(e.target.value)} required autoComplete="off" placeholder="Comece a digitar…"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
          <datalist id="faculties">{FACULTIES.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">{userType === 'doctor' ? 'Ano de formação' : 'Período / ano'}</span>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={userType === 'doctor' ? 'ex.: 2020' : 'ex.: 5º período'}
            className="mt-1 w-full rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
        </label>
        {userType === 'doctor' && (
          <Input id="crm" label="CRM (opcional)" type="text" inputMode="numeric" pattern="[0-9]*" name="crm"
            value={crm} onChange={(e) => setCrm(e.target.value.replace(/\D/g, ''))} placeholder="Somente números" />
        )}

        {error && (
          <p className="text-sm text-danger text-center">{error}</p>
        )}

        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
