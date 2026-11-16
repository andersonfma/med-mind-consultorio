'use client'
import { useEffect } from 'react'

// Dispara a caixa de impressão do navegador ao abrir o relatório (o usuário
// escolhe "Salvar como PDF"). Pequeno atraso para o layout assentar.
export function PrintOnLoad() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return null
}
