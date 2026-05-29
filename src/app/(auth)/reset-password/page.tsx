'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type PageState = 'request' | 'set-password' | 'success' | 'error'

function ResetPasswordContent() {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pageState, setPageState] = useState<PageState>('request')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setPageState('error')
        setMessage('Link inválido ou expirado. Solicite um novo link.')
      } else {
        setPageState('set-password')
      }
    })
  }, [supabase])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setMessage('Erro ao enviar e-mail. Tente novamente.')
    } else {
      setMessage('E-mail enviado! Verifique sua caixa de entrada.')
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (error) {
      setMessage('Erro ao atualizar senha. Tente novamente.')
    } else {
      setPageState('success')
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  if (pageState === 'error') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-red-600 text-sm">{message}</p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setPageState('request')
            setMessage(null)
          }}
        >
          Solicitar novo link
        </Button>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-green-600 text-sm font-medium">
          Senha atualizada! Redirecionando...
        </p>
      </div>
    )
  }

  if (pageState === 'set-password') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Nova senha
        </h2>
        <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
          <Input
            id="newPassword"
            label="Nova senha"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {message && (
            <p className="text-sm text-red-600 text-center">{message}</p>
          )}
          <Button type="submit" loading={loading}>
            Salvar nova senha
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Recuperar senha
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Enviaremos um link para o seu e-mail.
      </p>
      <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
        <Input
          id="email"
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        {message && (
          <p className="text-sm text-gray-600 text-center">{message}</p>
        )}
        <Button type="submit" loading={loading}>
          Enviar link
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <ResetPasswordContent />
}
