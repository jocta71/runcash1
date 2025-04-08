import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RunCash',
  description: 'RunCash - Análise de Roletas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt">
      <body>
        {children}
      </body>
    </html>
  )
} 
