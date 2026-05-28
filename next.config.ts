import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // images.remotePatterns: adicionar quando houver imagens externas
  // serverExternalPackages: adicionar se OpenAI SDK não buildar
}

export default nextConfig
