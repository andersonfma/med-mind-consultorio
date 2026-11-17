import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

// Web App Manifest — torna o app instalável (Adicionar à Tela de Início).
// No iOS (16.4+) é pré-requisito para receber Web Push.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: 'Treine o raciocínio clínico com pacientes virtuais e avaliação por IA.',
    start_url: '/inicio',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070B14',
    theme_color: '#070B14',
    lang: 'pt-BR',
    categories: ['education', 'medical'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
