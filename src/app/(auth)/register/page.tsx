'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Role } from '@/types/domain'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [crm, setCrm] = useState('')
  const [role, setRole] = useState<Role>('student')
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          crm: crm.trim() || null,
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Confirme seu e-mail</h2>
        <p className="text-sm text-gray-600">
          Enviamos um link de confirmação para <strong>{email}</strong>.
          Verifique sua caixa de entrada e clique no link para ativar sua conta.
        </p>
        <p className="text-xs text-gray-400 mt-3">Não recebeu? Verifique a pasta de spam.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Criar conta</h2>

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

        <div className="flex flex-col gap-1">
          <label htmlFor="role" className="text-sm font-medium text-gray-700">
            Perfil
          </label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="student">Estudante de medicina</option>
            <option value="resident">Residente</option>
            <option value="physician">Médico</option>
          </select>
        </div>

        <Input
          id="crm"
          label="CRM (opcional)"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          name="crm"
          value={crm}
          onChange={(e) => setCrm(e.target.value.replace(/\D/g, ''))}
          placeholder="Somente números"
        />

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <Button type="submit" loading={loading}>
          Criar conta
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
