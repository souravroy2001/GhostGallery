import type { Metadata } from 'next'
import { Space_Mono, Bebas_Neue, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono' })
const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: ['400'], variable: '--font-display' })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Ghost Gallery - Secure One-Time Delivery',
  description: 'Share photos securely with time-limited, one-time access links',
}

import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${bebasNeue.variable} ${dmSans.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen" suppressHydrationWarning>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
