/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://runcash1-production.up.railway.app',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'https://runcash1-production.up.railway.app',
    NEXT_PUBLIC_SSE_SERVER_URL: process.env.NEXT_PUBLIC_SSE_SERVER_URL || 'https://runcash1-production.up.railway.app/api/events',
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://runcash5.vercel.app/api'
  }
}

module.exports = nextConfig 